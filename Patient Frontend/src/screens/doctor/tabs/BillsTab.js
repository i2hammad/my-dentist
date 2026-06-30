import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, ActivityIndicator, Alert, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import { openWhatsApp, openSupportEmail, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../../../utils/support';
import { drName } from '../../../utils/doctorName';
import BtPrinterPicker from '../../../components/BtPrinterPicker';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

// Build the printable receipt HTML for either a thermal (57mm roll) or a
// normal (A4/Letter) printer. `autoPrint` injects a window.print() for web.
// expo-print's printToFileAsync defaults the PDF page to A4 (595x842pt) and does
// NOT honor CSS `@page { size: 57mm auto }`. For a thermal receipt we must pass
// an explicit narrow width AND a content-fit height in the print options, else
// the receipt sits at the top of a tall A4 page. 57mm ≈ 162pt wide. Height is
// estimated from the number of content lines so the page hugs the receipt.
export function thermalPdfSize(invoice) {
  const rows = (invoice?.treatments?.length || 1);
  // base header/footer/totals lines + one per treatment, ~16pt per line, + padding
  const lines = 18 + rows;
  const height = Math.max(260, Math.round(lines * 16 + 40));
  return { width: 162, height };
}

export function buildReceiptHtml(invoice, { docName, clinic, spec, type = 'thermal', autoPrint = false }) {
  const isThermal = type === 'thermal';
  const rows = invoice.treatments
    .map((it, idx) => `<div class="row"><span>${idx + 1}. ${it.name}</span><span>${it.price}</span></div>`)
    .join('');
  const autoPrintScript = autoPrint
    ? `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>`
    : '';

  const thermalCss = `
    @page { size: 57mm auto; margin: 0; }
    html, body { width: 100%; }
    body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 4px 5px; color: #000; font-size: 12px; line-height: 1.35; }
    .clinic { font-size: 15px; font-weight: bold; }
    .meta { font-size: 11px; margin-top: 1px; }
    .row { margin: 2px 0; }
    .divider { margin: 5px 0; }
    .footer { margin-top: 8px; font-size: 10px; }
    @media screen { body { border: 1px dashed #999; margin-top: 16px; border-radius: 6px; } }
  `;
  const normalCss = `
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #0F172A; font-size: 14px; }
    .clinic { font-size: 24px; font-weight: 800; color: #0052FF; }
    .meta { font-size: 13px; margin-top: 4px; color: #475569; }
    .row { font-size: 14px !important; margin: 6px 0 !important; }
    .divider { border-top: 1px solid #CBD5E1 !important; }
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${invoice.invoiceNumber}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 12px; font-size: 10px; }
        ${isThermal ? thermalCss : normalCss}
      </style>
    </head>
    <body>
      <div class="center">
        <div class="clinic">${clinic.toUpperCase()}</div>
        <div class="meta">${docName}</div>
        <div class="meta">${spec}</div>
      </div>
      <div class="divider"></div>
      <div class="row"><span>Invoice:</span><span>${invoice.invoiceNumber}</span></div>
      <div class="row"><span>Date:</span><span>${invoice.date}</span></div>
      <div class="row"><span>Time:</span><span>${invoice.time || ''}</span></div>
      <div class="row"><span>Patient:</span><span>${invoice.patientName}</span></div>
      ${invoice.patientPhone ? `<div class="row"><span>Phone:</span><span>${invoice.patientPhone}</span></div>` : ''}
      <div class="divider"></div>
      <div class="bold">Treatments</div>
      ${rows}
      <div class="divider"></div>
      <div class="row"><span>Total:</span><span>PKR ${invoice.total}</span></div>
      <div class="row"><span>Discount:</span><span>- ${invoice.discount}</span></div>
      <div class="row bold"><span>Paid:</span><span>PKR ${invoice.paid}</span></div>
      <div class="row bold"><span>Outstanding:</span><span>PKR ${invoice.outstanding}</span></div>
      <div class="row bold"><span>Status:</span><span>${invoice.status.toUpperCase()}</span></div>
      <div class="footer">Thank you for visiting!<br/>Powered by My Dentist</div>
      ${autoPrintScript}
    </body>
    </html>`;
}

export default function BillsTab({ profile, appointments, isProfileComplete = true, missingFields = [] }) {
  const [subTab, setSubTab] = useState('previous'); // previous, current, print
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState('all');
  const [billVisible, setBillVisible] = useState(20); // infinite-scroll window
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Current Bill State
  const [items, setItems] = useState([
    { name: 'Teeth Cleaning', price: '1500' },
    { name: 'Consultation', price: '1500' }
  ]);
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [pointsCode, setPointsCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Active / Specimen Invoice for Printing
  const [currentInvoice, setCurrentInvoice] = useState(null);
  // Printer type for the receipt layout: 'thermal' (57mm roll) or 'normal' (A4/Letter).
  const [printerType, setPrinterType] = useState('thermal');
  const [btInvoice, setBtInvoice] = useState(null); // invoice passed to the BT printer picker
  // Draft being edited (id) — null when creating fresh.
  const [editingBillId, setEditingBillId] = useState(null);

  // Load a draft bill back into the Current Bill form for editing.
  const editDraft = (bill) => {
    setEditingBillId(bill._id);
    const names = (bill.treatmentName || '').split(',').map(s => s.trim()).filter(Boolean);
    setItems(names.length ? names.map(n => ({ name: n, price: '' })) : [{ name: '', price: '' }]);
    setDiscount(String(bill.discountFromRewards || 0));
    setPaidAmount(String(bill.paidAmount || 0));
    const p = bill.patientId;
    if (p && (p._id || p)) {
      setSelectedPatient({ id: p._id || p, name: p.fullName || 'Patient', phone: p.mobileNumber || '' });
    }
    setSubTab('current');
    Alert.alert('Editing Draft', 'This draft is loaded for editing. Save it as a final bill or update the draft.');
  };

  // Doctor confirms a pending (cash) payment.
  const confirmPayment = (bill) => {
    const run = async () => {
      try {
        const token = await storage.getItem('userToken');
        const res = await axios.put(`${API_BASE_URL}/api/bills/${bill._id}/confirm-payment`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) { Alert.alert('Confirmed', `Payment for ${bill.invoiceNumber} confirmed.`); fetchBills(); }
        else Alert.alert('Error', res.data?.message || 'Could not confirm payment.');
      } catch (e) {
        Alert.alert('Error', e.response?.data?.message || 'Could not confirm payment.');
      }
    };
    if (Platform.OS === 'web') { run(); return; }
    Alert.alert('Confirm Payment', `Confirm cash payment received for ${bill.invoiceNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: run },
    ]);
  };

  useEffect(() => {
    fetchBills();
    
    // Parse unique patients from appointments prop
    const upcoming = appointments?.upcoming || [];
    const past = appointments?.past || [];
    const allApts = [...upcoming, ...past];
    
    const patientMap = {};
    allApts.forEach(apt => {
      if (apt.patientId && apt.patientId._id) {
        const pid = apt.patientId._id;
        if (!patientMap[pid]) {
          patientMap[pid] = {
            id: pid,
            name: apt.patientId.fullName || 'Patient',
            phone: apt.patientId.mobileNumber || ''
          };
        }
      }
    });
    
    const pts = Object.values(patientMap);
    setPatients(pts);
    if (pts.length > 0) {
      setSelectedPatient(pts[0]);
    }
  }, [appointments]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/bills/my?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setBills(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTreatment = () => {
    setItems([...items, { name: '', price: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleItemDelete = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => {
    const p = parseFloat(item.price.replace(/,/g, '')) || 0;
    return sum + p;
  }, 0);

  const discountVal = parseFloat(discount) || 0;
  const paidVal = parseFloat(paidAmount) || 0;
  const finalAmount = Math.max(totalAmount - discountVal, 0);
  const outstandingVal = Math.max(finalAmount - paidVal, 0);

  const [validatingCode, setValidatingCode] = useState(false);
  const applyPointsDiscount = async () => {
    const code = pointsCode.trim().toUpperCase();
    if (code.length !== 8) {
      Alert.alert('Invalid Code', 'Enter the 8-character code from the patient.');
      return;
    }
    setValidatingCode(true);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.post(
        `${API_BASE_URL}/api/rewards/validate-code`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        const pkr = res.data.data?.discountPKR || 0;
        setDiscount(String(pkr));
        Alert.alert('Code Applied', `PKR ${pkr} discount applied from the patient's reward points.`);
      } else {
        Alert.alert('Invalid Code', res.data?.message || 'Could not apply this code.');
      }
    } catch (e) {
      Alert.alert('Invalid Code', e.response?.data?.message || 'Could not validate this code.');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleCreateBill = async (asDraft = false) => {
    if (!isProfileComplete) {
      Alert.alert(
        'Profile Setup Incomplete',
        'You must complete all mandatory profile details and upload verification documents before creating bills.'
      );
      return;
    }
    if (!selectedPatient) {
      Alert.alert('Error', 'Please select a patient first.');
      return;
    }
    // Drafts can be incomplete; a final bill needs valid treatments.
    if (!asDraft && (items.length === 0 || items.some(it => !it.name || !it.price))) {
      Alert.alert('Error', 'Please ensure all treatments have a name and price.');
      return;
    }

    try {
      setSaving(true);
      const token = await storage.getItem('userToken');

      const treatmentName = items.map(it => it.name).filter(Boolean).join(', ') || 'Draft Bill';
      const payload = {
        patientId: selectedPatient.id,
        treatmentName,
        amount: totalAmount || 0,
        discountFromRewards: discountVal,
        paidAmount: paidVal,
        paymentMethod: paymentMethod,
        dueDate: new Date().toISOString(),
        ...(asDraft ? { status: 'draft' } : {}),
      };

      // Editing an existing draft → PUT; otherwise create a new bill.
      const res = editingBillId
        ? await axios.put(`${API_BASE_URL}/api/bills/${editingBillId}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        : await axios.post(`${API_BASE_URL}/api/bills`, payload, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data?.success) {
        const newBill = res.data.data;
        Alert.alert('Success', asDraft ? 'Saved as draft.' : (editingBillId ? 'Bill updated successfully!' : 'Bill created successfully!'));
        setEditingBillId(null);

        // Drafts: just refresh the list and stay; don't go to print.
        if (asDraft) {
          setItems([{ name: 'Teeth Cleaning', price: '1500' }, { name: 'Consultation', price: '1500' }]);
          setPaidAmount('0'); setDiscount('0'); setPointsCode('');
          fetchBills();
          setSubTab('previous');
          setSaving(false);
          return;
        }

        // Populate specimen for Print Current Bill tab
        setCurrentInvoice({
          invoiceNumber: newBill.invoiceNumber,
          date: new Date(newBill.createdAt).toLocaleDateString(),
          time: new Date(newBill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          patientName: selectedPatient.name,
          patientPhone: selectedPatient.phone || 'Not provided',
          treatments: items,
          total: totalAmount,
          discount: discountVal,
          paid: paidVal,
          payable: finalAmount,
          outstanding: outstandingVal,
          status: newBill.status,
          paymentMethod: newBill.paymentMethod || paymentMethod
        });

        // Reset inputs
        setItems([
          { name: 'Teeth Cleaning', price: '1500' },
          { name: 'Consultation', price: '1500' }
        ]);
        setPaidAmount('0');
        setDiscount('0');
        setPointsCode('');
        
        fetchBills();
        setSubTab('print'); // Redirect to print tab immediately
      }
    } catch (err) {
      console.log('Error creating bill:', err);
      const errors = err.response?.data?.errors;
      const msg = (errors && errors.length > 0)
        ? errors.map(e => e.message).join('\n')
        : (err.response?.data?.message || (asDraft ? 'Failed to save draft. Please try again.' : 'Failed to create bill.'));
      Alert.alert(asDraft ? 'Draft Not Saved' : 'Error', msg);
    } finally {
      setSaving(false);
    }
  };

  // Shared helper — builds the receipt invoice object from current state.
  const buildInvoice = () => currentInvoice || {
    invoiceNumber: 'INV-PENDING',
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    patientName: selectedPatient?.name || '',
    patientPhone: selectedPatient?.phone || '',
    treatments: items,
    total: totalAmount,
    discount: discountVal,
    paid: paidVal,
    payable: finalAmount,
    outstanding: outstandingVal,
    status: paidVal >= finalAmount ? 'paid' : 'unpaid',
    paymentMethod: paymentMethod,
  };

  // ── shared PDF generator ───────────────────────────────────────────────────
  const generatePdf = async (invoice) => {
    const Print = require('expo-print');
    const docName = drName(profile?.fullName, 'Dentist');
    const clinic  = profile?.clinicName || 'Dentist Clinic';
    const spec    = profile?.specialization || 'General Doctor';
    const html    = buildReceiptHtml(invoice, { docName, clinic, spec, type: printerType, autoPrint: false });
    const opts    = printerType === 'thermal' ? { html, ...thermalPdfSize(invoice) } : { html };
    const { uri } = await Print.printToFileAsync(opts);
    return { uri, html, docName, clinic, spec };
  };

  // ── PRINT ──────────────────────────────────────────────────────────────────
  // Open the Bluetooth thermal-printer picker for the current receipt.
  const openBtPrinter = () => {
    if (!currentInvoice && !selectedPatient) {
      Alert.alert('No Bill Selected', 'Please select a patient and create a bill before printing.');
      return;
    }
    setBtInvoice(buildInvoice());
  };

  const handlePrint = async () => {
    if (!currentInvoice && !selectedPatient) {
      Alert.alert('No Bill Selected', 'Please select a patient and create a bill before printing.');
      return;
    }
    const invoice = buildInvoice();

    if (Platform.OS === 'web') {
      const docName = drName(profile?.fullName, 'Dentist');
      const clinic  = profile?.clinicName || 'Dentist Clinic';
      const spec    = profile?.specialization || 'General Doctor';
      const html    = buildReceiptHtml(invoice, { docName, clinic, spec, type: printerType, autoPrint: true });
      const w = window.open('', '_blank', 'width=380,height=640');
      if (w) { w.document.write(html); w.document.close(); }
      else    { window.alert('Please allow pop-ups to print the receipt.'); }
      return;
    }

    try {
      // Generate PDF first, then open native print dialog.
      // printAsync alone sometimes fails on Android; generating the PDF first
      // and passing it is more reliable across devices.
      const { uri } = await generatePdf(invoice);
      const Print   = require('expo-print');
      await Print.printAsync({ uri });
    } catch (e) {
      // Offer to save as PDF if printing fails
      Alert.alert(
        'Printer Not Found',
        'No printer detected. Would you like to save the receipt as a PDF instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save PDF', onPress: () => handleDownloadReceipt() },
        ]
      );
    }
  };

  // ── SAVE PDF TO DEVICE ─────────────────────────────────────────────────────
  const handleDownloadReceipt = async () => {
    if (!currentInvoice && !selectedPatient) {
      Alert.alert('No Bill Selected', 'Please select a patient and create a bill before saving a receipt.');
      return;
    }
    const invoice = buildInvoice();

    if (Platform.OS === 'web') {
      const docName = drName(profile?.fullName, 'Dentist');
      const clinic  = profile?.clinicName || 'Dentist Clinic';
      const spec    = profile?.specialization || 'General Doctor';
      const html    = buildReceiptHtml(invoice, { docName, clinic, spec, type: printerType, autoPrint: false });
      const w = window.open('', '_blank', 'width=380,height=640');
      if (w) { w.document.write(html); w.document.close(); }
      else    { window.alert('Please allow pop-ups to save/print the receipt.'); }
      return;
    }

    try {
      const { uri } = await generatePdf(invoice);
      const Sharing = require('expo-sharing');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Receipt PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Last resort: copy to documents dir and tell user where it is
        const FileSystem = require('expo-file-system');
        const safeInv    = (invoice.invoiceNumber || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
        const destUri    = FileSystem.documentDirectory + `Receipt_${safeInv}.pdf`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        Alert.alert('PDF Saved', `Receipt_${safeInv}.pdf saved to app storage.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate the PDF. Please try again.');
    }
  };

  const renderPatientInfo = () => {
    if (!selectedPatient) return null;
    return (
      <View style={styles.patientInfoRow}>
        <View style={styles.piCol}>
          <Text style={styles.piLabel}>Patient Name</Text>
          <Text style={styles.piValue}>{selectedPatient.name}</Text>
        </View>
        <View style={styles.piCol}>
          <Text style={styles.piLabel}>Cell Number</Text>
          <Text style={styles.piValue}>{selectedPatient.phone || 'Not provided'}</Text>
        </View>
        <View style={styles.piCol}>
          <Text style={styles.piLabel}>Date Generated</Text>
          <Text style={styles.piValue}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>
    );
  };

  // Stats calculation from real bills list
  const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);
  const totalDiscount = bills.reduce((sum, b) => sum + (b.discountFromRewards || 0), 0);
  const totalOutstanding = bills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + Math.max(b.finalAmount - (b.paidAmount || 0), 0), 0);

  // Search + status filter + infinite-scroll window for Previous Bills.
  const billQ = billSearch.trim().toLowerCase();
  const filteredBills = bills.filter((b) => {
    if (billStatusFilter !== 'all' && (b.status || 'unpaid') !== billStatusFilter) return false;
    if (!billQ) return true;
    const hay = `${b.invoiceNumber || ''} ${b.treatmentName || ''} ${b.patientId?.fullName || ''}`.toLowerCase();
    return hay.includes(billQ);
  });
  const visibleBills = filteredBills.slice(0, billVisible);
  const hasMoreBills = visibleBills.length < filteredBills.length;
  const BILL_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'payment_pending', label: 'Pending' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'draft', label: 'Draft' },
  ];
  React.useEffect(() => { setBillVisible(20); }, [billSearch, billStatusFilter]);

  return (
    <View style={styles.container}>
      {/* Sub Tabs — horizontal scroll so all tabs fit on any screen size */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
        bounces={false}
      >
        <TouchableOpacity style={[styles.tabBtn, subTab === 'previous' && styles.tabBtnActive]} onPress={() => setSubTab('previous')}>
          <Ionicons name="document-text-outline" size={16} color={subTab === 'previous' ? '#0052FF' : '#94A3B8'} />
          <Text style={[styles.tabText, subTab === 'previous' && styles.tabTextActive]}>Previous Bills</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, subTab === 'current' && styles.tabBtnActive]} onPress={() => setSubTab('current')}>
          <Ionicons name="document-outline" size={16} color={subTab === 'current' ? '#0052FF' : '#94A3B8'} />
          <Text style={[styles.tabText, subTab === 'current' && styles.tabTextActive]}>Current Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, subTab === 'print' && styles.tabBtnActive]} onPress={() => setSubTab('print')}>
          <Ionicons name="print-outline" size={16} color={subTab === 'print' ? '#0052FF' : '#94A3B8'} />
          <Text style={[styles.tabText, subTab === 'print' && styles.tabTextActive]}>Print Preview</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- PREVIOUS BILLS --- */}
        {subTab === 'previous' && (
          <View>
            <Text style={styles.pageTitle}>Previous Bills</Text>
            <Text style={styles.pageSubtitle}>View, create and download the bills generated for this clinic</Text>
            
            <View style={styles.statsRow}>
              <View style={[styles.statCard, {backgroundColor: '#EFF6FF'}]}>
                <View style={styles.statIconWrap}><Ionicons name="document-text" size={20} color="#0052FF" /></View>
                <View>
                  <Text style={styles.statLabel}>Total Paid</Text>
                  <Text style={styles.statValue}>PKR {totalPaid.toLocaleString()}</Text>
                </View>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#F0FDF4'}]}>
                <View style={styles.statIconWrap}><Ionicons name="wallet" size={20} color="#16A34A" /></View>
                <View>
                  <Text style={styles.statLabel}>Total Discount</Text>
                  <Text style={[styles.statValue, {color: '#16A34A'}]}>PKR {totalDiscount.toLocaleString()}</Text>
                </View>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#FFFBEB'}]}>
                <View style={styles.statIconWrap}><Ionicons name="pricetag" size={20} color="#D97706" /></View>
                <View>
                  <Text style={styles.statLabel}>Outstanding</Text>
                  <Text style={[styles.statValue, {color: '#D97706'}]}>PKR {totalOutstanding.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Search + status filter */}
            <View style={styles.billSearchWrap}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.billSearchInput}
                placeholder="Search invoice, treatment or patient..."
                placeholderTextColor="#94A3B8"
                value={billSearch}
                onChangeText={setBillSearch}
              />
              {billSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBillSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.billFilterRow}>
              {BILL_FILTERS.map((f) => {
                const active = billStatusFilter === f.key;
                return (
                  <TouchableOpacity key={f.key} style={[styles.billChip, active && styles.billChipActive]} onPress={() => setBillStatusFilter(f.key)}>
                    <Text style={[styles.billChipText, active && styles.billChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#0052FF" style={{ marginVertical: 30 }} />
            ) : filteredBills.length > 0 ? (
              <ScrollView horizontal={!isWide} showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, {width: 120}]}>Invoice No.</Text>
                    <Text style={[styles.th, {width: 100}]}>Date</Text>
                    <Text style={[styles.th, {width: 150}]}>Description</Text>
                    <Text style={[styles.th, {width: 100}]}>Total Amount</Text>
                    <Text style={[styles.th, {width: 100}]}>Paid Amount</Text>
                    <Text style={[styles.th, {width: 100}]}>Discount</Text>
                    <Text style={[styles.th, {width: 100}]}>Outstanding</Text>
                    <Text style={[styles.th, {width: 80, textAlign: 'center'}]}>Status</Text>
                    <Text style={[styles.th, {width: 50, textAlign: 'center'}]}>View</Text>
                    <Text style={[styles.th, {width: 80, textAlign: 'center'}]}>Download</Text>
                  </View>

                  {visibleBills.map((inv, idx) => {
                    const billDate = new Date(inv.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                    const billOut = Math.max(inv.finalAmount - (inv.paidAmount || 0), 0);
                    return (
                      <View key={inv._id || idx} style={styles.tableRow}>
                        <Text style={[styles.td, {width: 120, color: '#0A1551', fontWeight: 'bold'}]}>{inv.invoiceNumber}</Text>
                        <Text style={[styles.td, {width: 100}]}>{billDate}</Text>
                        <Text style={[styles.td, {width: 150}]}>{inv.treatmentName}</Text>
                        <Text style={[styles.td, {width: 100, fontWeight: 'bold'}]}>PKR {inv.amount}</Text>
                        <Text style={[styles.td, {width: 100}]}>PKR {inv.paidAmount || 0}</Text>
                        <Text style={[styles.td, {width: 100}]}>PKR {inv.discountFromRewards || 0}</Text>
                        <Text style={[styles.td, {width: 100}]}>PKR {billOut}</Text>
                        <View style={{width: 80, alignItems: 'center'}}>
                          {(() => {
                            const sm = {
                              paid:            { bg: '#DCFCE7', color: '#16A34A', label: 'Paid' },
                              draft:           { bg: '#FEF3C7', color: '#D97706', label: 'Draft' },
                              payment_pending: { bg: '#EDE9FE', color: '#7C3AED', label: 'Pending' },
                              unpaid:          { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' },
                            }[inv.status] || { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' };
                            return (
                              <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
                                <Text style={[styles.statusBadgeText, { color: sm.color }]}>{sm.label}</Text>
                              </View>
                            );
                          })()}
                          {inv.status === 'draft' && (
                            <TouchableOpacity onPress={() => editDraft(inv)} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="create-outline" size={13} color="#0052FF" />
                              <Text style={{ color: '#0052FF', fontSize: 11, fontWeight: '700', marginLeft: 2 }}>Edit</Text>
                            </TouchableOpacity>
                          )}
                          {inv.status === 'payment_pending' && (
                            <TouchableOpacity onPress={() => confirmPayment(inv)} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="checkmark-circle-outline" size={13} color="#16A34A" />
                              <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '700', marginLeft: 2 }}>Confirm</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <TouchableOpacity 
                          style={{width: 50, alignItems: 'center'}}
                          onPress={() => {
                            setCurrentInvoice({
                              invoiceNumber: inv.invoiceNumber,
                              date: billDate,
                              time: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              patientName: inv.patientId?.fullName || 'Patient',
                              patientPhone: 'Provided',
                              treatments: [{ name: inv.treatmentName, price: inv.amount.toString() }],
                              total: inv.amount,
                              discount: inv.discountFromRewards || 0,
                              paid: inv.paidAmount || 0,
                              payable: inv.finalAmount,
                              outstanding: billOut,
                              status: inv.status
                            });
                            setSubTab('print');
                          }}
                        >
                          <Ionicons name="eye-outline" size={18} color="#0052FF" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={{width: 80, alignItems: 'center'}}
                          onPress={() => {
                            setCurrentInvoice({
                              invoiceNumber: inv.invoiceNumber,
                              date: billDate,
                              time: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              patientName: inv.patientId?.fullName || 'Patient',
                              patientPhone: 'Provided',
                              treatments: [{ name: inv.treatmentName, price: inv.amount.toString() }],
                              total: inv.amount,
                              discount: inv.discountFromRewards || 0,
                              paid: inv.paidAmount || 0,
                              payable: inv.finalAmount,
                              outstanding: billOut,
                              status: inv.status
                            });
                            setTimeout(handleDownloadReceipt, 100);
                          }}
                        >
                          <Ionicons name="download-outline" size={18} color="#0052FF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <Text style={{ textAlign: 'center', marginVertical: 30, color: '#94A3B8' }}>
                {billQ || billStatusFilter !== 'all' ? 'No bills match your search.' : "No bills found. Create a bill in the 'Current Bill' tab."}
              </Text>
            )}

            {/* Pagination: showing count + Load More */}
            {!loading && filteredBills.length > 0 && (
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: hasMoreBills ? 10 : 0 }}>
                  Showing {visibleBills.length} of {filteredBills.length}
                </Text>
                {hasMoreBills && (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setBillVisible((c) => c + 20)}>
                    <Text style={styles.loadMoreText}>Load More</Text>
                    <Ionicons name="chevron-down" size={16} color="#0052FF" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Support & Help — same card as the Profile tab (synced via utils/support.js) */}
            <View style={styles.supportCard}>
              <Text style={styles.supportCardTitle}>Support & Help</Text>
              <TouchableOpacity style={styles.supportRow} onPress={() => openWhatsApp('Hello, I need help with billing on My Dentist.')}>
                <View style={[styles.supportRowIcon, { backgroundColor: '#DCFCE7' }]}><Ionicons name="logo-whatsapp" size={22} color="#25D366" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportRowLabel}>WhatsApp Support</Text><Text style={styles.supportRowValue}>{SUPPORT_WHATSAPP}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportRow} onPress={() => openSupportEmail('My Dentist — Billing Support')}>
                <View style={[styles.supportRowIcon, { backgroundColor: '#DBEAFE' }]}><Ionicons name="mail-outline" size={22} color="#2563EB" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportRowLabel}>Email Support</Text><Text style={styles.supportRowValue}>{SUPPORT_EMAIL}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* --- CURRENT BILL --- */}
        {subTab === 'current' && (
          <View>
            <Text style={styles.pageTitle}>Create Bill</Text>
            <Text style={styles.pageSubtitle}>Add treatments, apply rewards discount, and specify custom paid amounts.</Text>
            
            {/* Patient Select Dropdown */}
            <View style={{ marginBottom: 20, zIndex: 10 }}>
              <Text style={styles.inputLabel}>Select Patient *</Text>
              <TouchableOpacity style={styles.inputWrap} onPress={() => setShowPatientDropdown(!showPatientDropdown)}>
                <Text style={styles.inputText}>{selectedPatient ? selectedPatient.name : 'Choose a patient...'}</Text>
                <Ionicons name="chevron-down" size={16} color="#0A1551" />
              </TouchableOpacity>
              {showPatientDropdown && (
                <View style={styles.dropdownContainer}>
                  {patients.length > 0 ? patients.map(p => (
                    <TouchableOpacity 
                      key={p.id} 
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedPatient(p);
                        setShowPatientDropdown(false);
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#0A1551' }}>{p.name}</Text>
                    </TouchableOpacity>
                  )) : (
                    <Text style={{ padding: 12, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>No patients found from appointments.</Text>
                  )}
                </View>
              )}
            </View>

            {renderPatientInfo()}

            <View style={styles.splitLayout}>
              
              {/* Left Col */}
              <View style={{flex: 1.5, paddingRight: isWide ? 20 : 0}}>
                <Text style={styles.sectionHeading}>Treatments / Items</Text>
                
                {/* Items Table */}
                <View style={styles.itemsTable}>
                  <View style={styles.itemsHeader}>
                    <Text style={[styles.th, {width: 40, textAlign: 'center'}]}>#</Text>
                    <Text style={[styles.th, {flex: 1}]}>Treatment Name</Text>
                    <Text style={[styles.th, {width: 120}]}>Price (PKR)</Text>
                    <Text style={[styles.th, {width: 60, textAlign: 'center'}]}>Action</Text>
                  </View>
                  
                  {items.map((it, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={[styles.td, {width: 40, textAlign: 'center', fontWeight: 'bold'}]}>{i+1}</Text>
                      <TextInput 
                        style={[styles.inputBox, {flex: 1, marginRight: 8}]} 
                        value={it.name} 
                        placeholder="e.g. Scaling"
                        onChangeText={(txt) => handleItemChange(i, 'name', txt)}
                      />
                      <TextInput 
                        style={[styles.inputBox, {width: 120}]} 
                        value={it.price} 
                        keyboardType="numeric"
                        placeholder="Price"
                        onChangeText={(txt) => handleItemChange(i, 'price', txt)}
                      />
                      <TouchableOpacity style={{width: 60, alignItems: 'center'}} onPress={() => handleItemDelete(i)}>
                        <Ionicons name="trash-outline" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity style={styles.addAnotherBtn} onPress={handleAddTreatment}>
                    <Ionicons name="add" size={16} color="#0052FF" />
                    <Text style={styles.addAnotherText}>Add Another Treatment</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Right Col */}
              <View style={{flex: 1}}>
                <Text style={styles.sectionHeading}>Bill Summary</Text>
                
                <View style={styles.summaryBox}>
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabelText}>Total Amount</Text>
                    <Text style={styles.sumValText}>PKR {totalAmount.toLocaleString()}</Text>
                  </View>

                  <Text style={styles.sumLabelText}>Redeem Points Code</Text>
                  <View style={styles.redeemRow}>
                    <TextInput style={styles.redeemInput} placeholder="Enter points code" value={pointsCode} onChangeText={setPointsCode} />
                    <TouchableOpacity style={styles.applyBtn} onPress={applyPointsDiscount}><Text style={styles.applyBtnText}>Apply</Text></TouchableOpacity>
                  </View>

                  {discountVal > 0 && (
                    <View style={styles.sumRow}>
                      <Text style={styles.sumLabelText}>Redeemed Points Discount</Text>
                      <Text style={[styles.sumValText, {color: '#16A34A'}]}>- PKR {discountVal.toLocaleString()}</Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* CUSTOM PAID AMOUNT INPUT */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.sumLabelText}>Amount Paid (PKR)</Text>
                    <TextInput 
                      style={[styles.redeemInput, { marginTop: 6, width: '100%' }]} 
                      value={paidAmount} 
                      keyboardType="numeric"
                      onChangeText={setPaidAmount}
                      placeholder="e.g. 300"
                    />
                  </View>

                  {/* PAYMENT METHOD SELECTOR */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.sumLabelText}>Payment Method</Text>
                    <View style={{ marginTop: 6, gap: 8 }}>
                      <TouchableOpacity 
                        style={[
                          styles.payMethodBtn, 
                          paymentMethod === 'cash' && styles.payMethodBtnActive
                        ]}
                        onPress={() => setPaymentMethod('cash')}
                      >
                        <Ionicons name="cash-outline" size={16} color={paymentMethod === 'cash' ? '#0052FF' : '#475569'} />
                        <Text style={[styles.payMethodText, paymentMethod === 'cash' && styles.payMethodTextActive]}>Cash</Text>
                      </TouchableOpacity>

                      <View style={[styles.payMethodBtn, styles.payMethodBtnDisabled]}>
                        <Ionicons name="phone-portrait-outline" size={16} color="#94A3B8" />
                        <Text style={styles.payMethodTextDisabled}>EasyPaisa</Text>
                        <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                      </View>

                      <View style={[styles.payMethodBtn, styles.payMethodBtnDisabled]}>
                        <Ionicons name="wallet-outline" size={16} color="#94A3B8" />
                        <Text style={styles.payMethodTextDisabled}>JazzCash</Text>
                        <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                      </View>

                      <View style={[styles.payMethodBtn, styles.payMethodBtnDisabled]}>
                        <Ionicons name="card-outline" size={16} color="#94A3B8" />
                        <Text style={styles.payMethodTextDisabled}>Credit / Debit Card</Text>
                        <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sumRow}>
                    <Text style={[styles.sumLabelText, {fontWeight: 'bold', color: '#0A1551'}]}>Payable Amount</Text>
                    <Text style={[styles.sumValText, {color: '#0052FF', fontSize: 16}]}>PKR {finalAmount.toLocaleString()}</Text>
                  </View>

                  <View style={styles.sumRow}>
                    <Text style={[styles.sumLabelText, {fontWeight: 'bold', color: '#64748B'}]}>Outstanding Balance</Text>
                    <Text style={[styles.sumValText, {color: outstandingVal > 0 ? '#DC2626' : '#16A34A', fontSize: 16}]}>PKR {outstandingVal.toLocaleString()}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionBtnsRow}>
                  <TouchableOpacity style={styles.draftBtn} onPress={() => handleCreateBill(true)} disabled={saving}>
                    <Ionicons name="save-outline" size={16} color="#0052FF" style={{ marginRight: 6 }} />
                    <Text style={styles.draftBtnText}>Save as Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.createBtn} onPress={() => handleCreateBill(false)} disabled={saving}>
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createBtnText}>{editingBillId ? 'Save Bill' : 'Create Bill'}</Text>}
                  </TouchableOpacity>
                </View>
                {editingBillId && (
                  <TouchableOpacity onPress={() => { setEditingBillId(null); setItems([{ name: 'Teeth Cleaning', price: '1500' }]); setSelectedPatient(null); }} style={{ marginTop: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancel editing draft</Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>
          </View>
        )}

        {/* --- PRINT PREVIEW --- */}
        {subTab === 'print' && (
          <View>
            <Text style={styles.pageTitle}>Receipt Specimen</Text>
            <Text style={styles.pageSubtitle}>Select your printer type, tap Print to send to a paired printer, or Save PDF to download the receipt to your device.</Text>

            {/* Printer type selector */}
            <Text style={styles.printerLabel}>Printer Type</Text>
            <View style={styles.printerTypeRow}>
              <TouchableOpacity
                style={[styles.printerTypeBtn, printerType === 'thermal' && styles.printerTypeBtnActive]}
                onPress={() => setPrinterType('thermal')}
                activeOpacity={0.85}
              >
                <Ionicons name="receipt-outline" size={20} color={printerType === 'thermal' ? '#0052FF' : '#64748B'} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[styles.printerTypeTitle, printerType === 'thermal' && { color: '#0052FF' }]}>Thermal (57mm)</Text>
                  <Text style={styles.printerTypeSub}>Roll / POS receipt printer</Text>
                </View>
                {printerType === 'thermal' && <Ionicons name="checkmark-circle" size={18} color="#0052FF" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.printerTypeBtn, printerType === 'normal' && styles.printerTypeBtnActive]}
                onPress={() => setPrinterType('normal')}
                activeOpacity={0.85}
              >
                <Ionicons name="print-outline" size={20} color={printerType === 'normal' ? '#0052FF' : '#64748B'} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[styles.printerTypeTitle, printerType === 'normal' && { color: '#0052FF' }]}>Normal (A4)</Text>
                  <Text style={styles.printerTypeSub}>Inkjet / laser A4 printer</Text>
                </View>
                {printerType === 'normal' && <Ionicons name="checkmark-circle" size={18} color="#0052FF" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            </View>

            <View style={[styles.splitLayout, { alignItems: 'center' }]}>
              
              {/* Receipt Paper */}
              <View style={styles.receiptPaper}>
                <View style={styles.receiptInner}>
                  <Ionicons name="medical-outline" size={32} color="#0052FF" style={{alignSelf: 'center'}} />
                  <Text style={styles.rTitle}>{profile?.clinicName?.toUpperCase() || 'MY DENTIST CLINIC'}</Text>
                  <Text style={styles.rSub}>{drName(profile?.fullName)}</Text>
                  <Text style={styles.rSub}>{profile?.specialization || 'Dental Specialist'}</Text>
                  
                  <Text style={styles.rDivider}>----------------------------------------</Text>
                  <Text style={styles.rHeading}>RECEIPT</Text>

                  <View style={styles.rRow}><Text style={styles.rLabel}>Bill No.</Text><Text style={styles.rVal}>: {currentInvoice?.invoiceNumber || '—'}</Text></View>
                  <View style={styles.rRow}><Text style={styles.rLabel}>Date</Text><Text style={styles.rVal}>: {currentInvoice?.date || new Date().toLocaleDateString()}</Text></View>
                  <View style={styles.rRow}><Text style={styles.rLabel}>Time</Text><Text style={styles.rVal}>: {currentInvoice?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
                  <View style={styles.rRow}><Text style={styles.rLabel}>Patient</Text><Text style={styles.rVal}>: {currentInvoice?.patientName || '—'}</Text></View>
                  <View style={styles.rRow}><Text style={styles.rLabel}>Method</Text><Text style={styles.rVal}>: {(currentInvoice?.paymentMethod || 'cash').toUpperCase()}</Text></View>

                  <Text style={styles.rDivider}>----------------------------------------</Text>

                  <View style={[styles.rRow, {marginBottom: 8}]}>
                    <Text style={[styles.rLabel, {width: 20}]}>#</Text>
                    <Text style={[styles.rLabel, {flex: 1}]}>Item</Text>
                    <Text style={styles.rLabel}>Price (PKR)</Text>
                  </View>

                  {(currentInvoice?.treatments || items).map((it, idx) => (
                    <View key={idx} style={styles.rRow}>
                      <Text style={[styles.rVal, {width: 20}]}>{idx+1}</Text>
                      <Text style={[styles.rVal, {flex: 1}]}>{it.name || 'Treatment'}</Text>
                      <Text style={styles.rVal}>{parseFloat(it.price).toLocaleString()}</Text>
                    </View>
                  ))}

                  <Text style={styles.rDivider}>----------------------------------------</Text>

                  <View style={styles.rRow}><Text style={[styles.rLabel, {fontWeight: 'bold', color: '#000'}]}>Total Amount</Text><Text style={[styles.rVal, {fontWeight: 'bold', color: '#000'}]}>{currentInvoice?.total || totalAmount}</Text></View>
                  <View style={styles.rRow}><Text style={[styles.rLabel, {color: '#16A34A'}]}>Discount</Text><Text style={[styles.rVal, {color: '#16A34A'}]}>-{currentInvoice?.discount || discountVal}</Text></View>
                  <View style={styles.rRow}><Text style={[styles.rLabel, {fontWeight: 'bold', color: '#000'}]}>Amount Paid</Text><Text style={[styles.rVal, {fontWeight: 'bold', color: '#000'}]}>{currentInvoice?.paid || paidVal}</Text></View>
                  <View style={styles.rRow}><Text style={[styles.rLabel, {fontWeight: 'bold', color: '#DC2626'}]}>Outstanding</Text><Text style={[styles.rVal, {fontWeight: 'bold', color: '#DC2626'}]}>{currentInvoice?.outstanding || outstandingVal}</Text></View>

                  <Text style={styles.rDivider}>----------------------------------------</Text>
                  <Text style={[styles.rSub, {marginTop: 10, color: '#000', fontWeight: 'bold'}]}>Thank you for visiting!</Text>
                </View>
              </View>

              {/* Bluetooth thermal printer — direct ESC/POS to a paired 58mm printer (native only) */}
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={[styles.printNowBtn, { width: 320, marginTop: 20 }]} onPress={openBtPrinter}>
                  <Ionicons name="bluetooth-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.printNowText}>Print to Thermal Printer</Text>
                </TouchableOpacity>
              )}

              {/* Print — opens native OS print dialog (Wi-Fi / system printers) or web print */}
              <TouchableOpacity style={[styles.printNowBtnGhost, { width: 320, marginTop: 12 }]} onPress={handlePrint}>
                <Ionicons name="print-outline" size={18} color="#0052FF" style={{marginRight: 8}} />
                <Text style={styles.printNowTextGhost}>{Platform.OS === 'web' ? 'Print Receipt' : 'System Print / PDF'}</Text>
              </TouchableOpacity>

              {/* Save PDF directly to device storage */}
              <TouchableOpacity style={[styles.printNowBtnGhost, { width: 320, marginTop: 12 }]} onPress={handleDownloadReceipt}>
                <Ionicons name="download-outline" size={18} color="#0052FF" style={{marginRight: 8}} />
                <Text style={styles.printNowTextGhost}>{Platform.OS === 'web' ? 'Save / Download PDF' : 'Save PDF to Device'}</Text>
              </TouchableOpacity>

              <Text style={styles.printerHint}>
                Print: opens the print dialog — select a paired printer.{'\n'}
                Save PDF: opens the share sheet — tap "Save to Files / Downloads" to save, or send via WhatsApp / Email.
              </Text>

            </View>
          </View>
        )}

      </ScrollView>

      <BtPrinterPicker
        visible={!!btInvoice}
        invoice={btInvoice}
        meta={{ docName: drName(profile?.fullName, 'Dentist'), clinic: profile?.clinicName || 'Dentist Clinic', spec: profile?.specialization || '' }}
        onClose={(res) => {
          setBtInvoice(null);
          if (res?.ok) Alert.alert('Printed', 'Receipt sent to the printer.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 60 },
  
  /* Top Tabs */
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 6 },
  tabBtnActive: { borderBottomColor: '#0052FF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#0052FF', fontWeight: '700' },

  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 },
  billSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginBottom: 10 },
  billSearchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 6 },
  billFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  billChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  billChipActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  billChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  billChipTextActive: { color: '#FFFFFF' },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22 },
  loadMoreText: { color: '#0052FF', fontWeight: '700', fontSize: 13 },

  /* Previous Bills Stats */
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: isWide ? '30%' : '45%', flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  statIconWrap: { width: 36, height: 36, backgroundColor: '#FFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  statLabel: { fontSize: 11, color: '#64748B' },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#0052FF', marginTop: 2 },

  /* Patient Info Banner */
  patientInfoRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20, gap: 12 },
  piCol: { flex: 1 },
  piLabel: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  piValue: { fontSize: 12, fontWeight: 'bold', color: '#0A1551' },

  /* Table */
  tableContainer: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  th: { fontSize: 11, fontWeight: 'bold', color: '#64748B' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', alignItems: 'center' },
  td: { fontSize: 12, color: '#475569' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },

  supportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginTop: 20 },
  supportCardTitle: { fontSize: 15, fontWeight: '700', color: '#0A1551', marginBottom: 6 },
  supportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  supportRowIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supportRowLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  supportRowValue: { fontSize: 13, color: '#64748B', marginTop: 1 },
  supportBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginTop: 20 },
  supportIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0052FF' },
  supportTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551' },
  supportDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  contactBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#0052FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  contactBtnText: { color: '#0052FF', fontSize: 12, fontWeight: 'bold' },

  splitLayout: { flexDirection: isWide ? 'row' : 'column', gap: isWide ? 0 : 20 },
  sectionHeading: { fontSize: 14, fontWeight: 'bold', color: '#0A1551', marginBottom: 12 },
  
  /* Current Bill */
  itemsTable: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, marginBottom: 20 },
  itemsHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemRow: { flexDirection: 'row', padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  inputBox: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 10, height: 36, fontSize: 12, color: '#0A1551' },
  addAnotherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  addAnotherText: { color: '#0052FF', fontSize: 13, fontWeight: 'bold', marginLeft: 8 },

  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#0A1551', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, height: 40, backgroundColor: '#FFF' },
  inputText: { fontSize: 13, color: '#0A1551' },
  
  dropdownContainer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginTop: 4, maxHeight: 150, overflow: 'scroll', zIndex: 999 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },

  /* Bill Summary Box */
  summaryBox: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 16, marginBottom: 16 },
  payMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#FFF'
  },
  payMethodBtnActive: {
    borderColor: '#0052FF',
    backgroundColor: '#EFF6FF'
  },
  payMethodBtnDisabled: {
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    opacity: 0.7
  },
  payMethodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 8,
    flex: 1
  },
  payMethodTextActive: {
    color: '#0052FF',
    fontWeight: '600'
  },
  payMethodTextDisabled: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginLeft: 8,
    flex: 1
  },
  comingSoonBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#EF4444'
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumLabelText: { fontSize: 12, color: '#0A1551', fontWeight: '600' },
  sumValText: { fontSize: 12, fontWeight: 'bold', color: '#0A1551' },
  redeemRow: { flexDirection: 'row', gap: 6, marginBottom: 10, marginTop: 4 },
  redeemInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, height: 36, paddingHorizontal: 10, fontSize: 12, color: '#0A1551', backgroundColor: '#FFF' },
  applyBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#0052FF', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6 },
  applyBtnText: { color: '#0052FF', fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },

  actionBtnsRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0052FF', borderRadius: 8 },
  cancelBtnText: { color: '#0052FF', fontSize: 12.5, fontWeight: 'bold' },
  createBtn: { flex: 2, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052FF', borderRadius: 8 },
  createBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' },
  draftBtn: { flex: 1.4, height: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0052FF', borderRadius: 8, backgroundColor: '#EFF6FF' },
  draftBtnText: { color: '#0052FF', fontSize: 12.5, fontWeight: 'bold' },

  /* Print / Share Receipt */
  printNowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, backgroundColor: '#0052FF', borderRadius: 10 },
  printNowText: { color: '#FFF', fontSize: 13.5, fontWeight: 'bold' },
  printNowBtnGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  printNowTextGhost: { color: '#0052FF', fontSize: 13, fontWeight: '700' },
  printerHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 14, maxWidth: 340, lineHeight: 16 },
  printerLabel: { fontSize: 13, fontWeight: '700', color: '#0A1551', marginTop: 8, marginBottom: 8 },
  printerTypeRow: { flexDirection: isWide ? 'row' : 'column', gap: 10, marginBottom: 8 },
  printerTypeBtn: { flex: isWide ? 1 : undefined, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  printerTypeBtnActive: { borderColor: '#0052FF', backgroundColor: '#F5F9FF' },
  printerTypeTitle: { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  printerTypeSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  receiptPaper: { width: 320, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  receiptInner: { padding: 20, backgroundColor: '#FFF', borderRadius: 12 },
  rTitle: { fontSize: 14, fontWeight: '900', color: '#0A1551', textAlign: 'center', marginTop: 10 },
  rSub: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 2 },
  rDivider: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginVertical: 8, letterSpacing: 2 },
  rHeading: { fontSize: 13, fontWeight: '900', color: '#0A1551', textAlign: 'center', marginBottom: 8 },
  rRow: { flexDirection: 'row', marginBottom: 4 },
  rLabel: { fontSize: 11, color: '#475569', width: 80 },
  rVal: { fontSize: 11, color: '#000', flex: 1 }
});
