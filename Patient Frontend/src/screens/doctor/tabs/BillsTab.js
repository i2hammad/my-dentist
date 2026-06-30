import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, ActivityIndicator, Alert, Share, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import imgUrl from '../../../config/imgUrl';
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

export default function BillsTab({ profile, appointments, isProfileComplete = true, missingFields = [], editBillId = null }) {
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
  // Patient bills modal
  const [patientModal, setPatientModal] = useState(null); // { _id, name } | null
  const [billDetail, setBillDetail] = useState(null);     // individual bill for detail view inside modal
  // Treatment mode in Current Bill: 'view' = auto-loaded from appointment, 'edit' = manual editable form
  const [treatmentMode, setTreatmentMode] = useState('edit');

  // Load a draft bill back into the Current Bill form for editing.
  const editDraft = (bill) => {
    setEditingBillId(bill._id);
    const amount = Number(bill.amount) || 0;
    let restored;
    if (Array.isArray(bill.treatments) && bill.treatments.length) {
      // Saved line items → restore exact name + price.
      restored = bill.treatments.map(t => ({ name: t.name || '', price: t.price ? String(t.price) : '' }));
    } else {
      // Legacy bills (no saved split) → single = full amount; multiple = total on first.
      const names = (bill.treatmentName || '').split(',').map(s => s.trim()).filter(Boolean);
      restored = names.length
        ? names.map((n, i) => ({ name: n, price: i === 0 ? String(amount) : '' }))
        : [{ name: '', price: amount ? String(amount) : '' }];
    }
    setItems(restored);
    setDiscount(String(bill.discountFromRewards || 0));
    setPaidAmount(String(bill.paidAmount || 0));
    const p = bill.patientId;
    if (p && (p._id || p)) {
      setSelectedPatient({ id: p._id || p, name: p.fullName || 'Patient', phone: p.mobileNumber || '' });
    }
    setSubTab('current');
    Alert.alert('Editing Bill', 'This bill is loaded for editing. Update it and save.');
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

  // Build the print-preview invoice object from a saved bill row.
  const billToInvoice = (inv) => {
    const billDate = new Date(inv.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const billOut = Math.max((inv.finalAmount || inv.amount) - (inv.paidAmount || 0), 0);
    return {
      invoiceNumber: inv.invoiceNumber,
      date: billDate,
      time: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientName: inv.patientId?.fullName || 'Patient',
      patientPhone: 'Provided',
      treatments: [{ name: inv.treatmentName, price: String(inv.amount) }],
      total: inv.amount,
      discount: inv.discountFromRewards || 0,
      paid: inv.paidAmount || 0,
      payable: inv.finalAmount,
      outstanding: billOut,
      status: inv.status,
    };
  };
  const previewBillRow = (inv) => { setCurrentInvoice(billToInvoice(inv)); setSubTab('print'); };
  const downloadBillRow = (inv) => { setCurrentInvoice(billToInvoice(inv)); setTimeout(handleDownloadReceipt, 100); };

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
            phone: apt.patientId.mobileNumber || '',
            appointments: [],
          };
        }
        if (apt.treatmentType) {
          patientMap[pid].appointments.push({
            _id: apt._id,
            treatmentType: apt.treatmentType,
            date: apt.date,
            description: apt.description || '',
          });
        }
      }
    });

    const pts = Object.values(patientMap);
    setPatients(pts);
    if (pts.length > 0 && !editBillId) {
      const first = pts[0];
      setSelectedPatient(first);
      // Pre-load treatments from the first patient's appointments
      if (first.appointments && first.appointments.length > 0) {
        setItems(first.appointments.map(a => ({ name: a.treatmentType, price: '' })));
        setTreatmentMode('view');
      }
    }
  }, [appointments]);

  // Edit redirect from Patient Details: load the bill into the form and open Current Bill.
  useEffect(() => {
    if (!editBillId) return;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/api/bills/${editBillId}`, { headers: { Authorization: `Bearer ${token}` } });
        const bill = res.data?.data;
        if (bill) editDraft(bill);
      } catch { /* ignore */ }
    })();
  }, [editBillId]);

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
        // Persist per-treatment line items so editing later restores exact prices.
        treatments: items
          .filter(it => it.name || it.price)
          .map(it => ({ name: it.name || '', price: Number(it.price) || 0 })),
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
      const Print = require('expo-print');
      const docName = drName(profile?.fullName, 'Dentist');
      const clinic  = profile?.clinicName || 'Dentist Clinic';
      const spec    = profile?.specialization || 'General Doctor';
      const html    = buildReceiptHtml(invoice, { docName, clinic, spec, type: printerType, autoPrint: false });

      // The Android print framework defaults its paper to Letter and ignores the
      // HTML @page size, so pass explicit page dimensions (in points @72dpi):
      //   thermal ≈ 58mm wide, content-fit height;  normal = A4 (595 x 842).
      if (printerType === 'thermal') {
        await Print.printAsync({ html, ...thermalPdfSize(invoice) });
      } else {
        await Print.printAsync({ html, width: 595, height: 842 });
      }
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

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
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
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
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
            ) : filteredBills.length === 0 ? (
              <Text style={{ textAlign: 'center', marginVertical: 30, color: '#94A3B8' }}>
                {billQ || billStatusFilter !== 'all' ? 'No bills match your search.' : "No bills found. Create a bill in the 'Current Bill' tab."}
              </Text>
            ) : !isWide ? (
              // ── Phone: stacked cards (no horizontal scroll) ──
              <View style={{ marginBottom: 24 }}>
                {visibleBills.map((inv, idx) => {
                  const billDate = new Date(inv.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                  const billOut = Math.max((inv.finalAmount || inv.amount) - (inv.paidAmount || 0), 0);
                  const patientName = inv.patientId?.fullName || 'Patient';
                  const patientId = inv.patientId?._id || inv.patientId;
                  const sm = {
                    paid:            { bg: '#DCFCE7', color: '#16A34A', label: 'Paid' },
                    draft:           { bg: '#FEF3C7', color: '#D97706', label: 'Draft' },
                    payment_pending: { bg: '#EDE9FE', color: '#7C3AED', label: 'Pending' },
                    unpaid:          { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' },
                  }[inv.status] || { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' };
                  return (
                    <View key={inv._id || idx} style={styles.billCard}>
                      <View style={styles.billCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.billCardInv}>{inv.invoiceNumber}</Text>
                          <TouchableOpacity onPress={() => setPatientModal({ _id: patientId, name: patientName })} hitSlop={6}>
                            <View style={styles.patientNamePill}>
                              <Ionicons name="person-circle-outline" size={12} color="#0052FF" />
                              <Text style={styles.patientNamePillText} numberOfLines={1}>{patientName}</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: sm.color }]}>{sm.label}</Text>
                        </View>
                      </View>

                      <Text style={styles.billCardTreat} numberOfLines={2}>{inv.treatmentName}</Text>

                      <View style={styles.billCardMetaRow}>
                        <Text style={styles.billCardDate}>{billDate}</Text>
                        <Text style={styles.billCardAmount}>PKR {Number(inv.amount).toLocaleString()}</Text>
                      </View>
                      <View style={styles.billCardSubRow}>
                        <Text style={styles.billCardSub}>Paid PKR {Number(inv.paidAmount || 0).toLocaleString()}</Text>
                        {billOut > 0 && <Text style={[styles.billCardSub, { color: '#DC2626', fontWeight: '700' }]}>Due PKR {Number(billOut).toLocaleString()}</Text>}
                        {(inv.discountFromRewards || 0) > 0 && <Text style={[styles.billCardSub, { color: '#16A34A' }]}>−PKR {Number(inv.discountFromRewards).toLocaleString()}</Text>}
                      </View>

                      <View style={styles.billCardActions}>
                        <TouchableOpacity style={styles.billCardBtn} onPress={() => previewBillRow(inv)}>
                          <Ionicons name="eye-outline" size={15} color="#0052FF" />
                          <Text style={styles.billCardBtnText}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.billCardBtn} onPress={() => downloadBillRow(inv)}>
                          <Ionicons name="download-outline" size={15} color="#0052FF" />
                          <Text style={styles.billCardBtnText}>Receipt</Text>
                        </TouchableOpacity>
                        {inv.status === 'draft' && (
                          <TouchableOpacity style={styles.billCardBtn} onPress={() => editDraft(inv)}>
                            <Ionicons name="create-outline" size={15} color="#0052FF" />
                            <Text style={styles.billCardBtnText}>Edit</Text>
                          </TouchableOpacity>
                        )}
                        {inv.status === 'payment_pending' && (
                          <TouchableOpacity style={[styles.billCardBtn, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]} onPress={() => confirmPayment(inv)}>
                            <Ionicons name="checkmark-circle-outline" size={15} color="#16A34A" />
                            <Text style={[styles.billCardBtnText, { color: '#16A34A' }]}>Confirm</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal={false} showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, {width: 140}]}>Invoice / Patient</Text>
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
                    const patientName = inv.patientId?.fullName || 'Patient';
                    const patientId   = inv.patientId?._id || inv.patientId;
                    return (
                      <View key={inv._id || idx} style={styles.tableRow}>
                        <View style={{width: 140}}>
                          <Text style={[styles.td, {color: '#0A1551', fontWeight: 'bold'}]}>{inv.invoiceNumber}</Text>
                          <TouchableOpacity
                            onPress={() => setPatientModal({ _id: patientId, name: patientName })}
                            hitSlop={6}
                          >
                            <View style={styles.patientNamePill}>
                              <Ionicons name="person-circle-outline" size={12} color="#0052FF" />
                              <Text style={styles.patientNamePillText} numberOfLines={1}>{patientName}</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
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
                        // Load actual treatments from this patient's appointments
                        if (p.appointments && p.appointments.length > 0) {
                          setItems(p.appointments.map(a => ({ name: a.treatmentType, price: '' })));
                          setTreatmentMode('view');
                        } else {
                          setItems([{ name: '', price: '' }]);
                          setTreatmentMode('edit');
                        }
                        setDiscount('0');
                        setPaidAmount('0');
                        setPointsCode('');
                        setEditingBillId(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#0A1551', fontWeight: '600' }}>{p.name}</Text>
                        {p.appointments?.length > 0 && (
                          <Text style={{ fontSize: 11, color: '#64748B' }}>{p.appointments.length} treatment{p.appointments.length !== 1 ? 's' : ''}</Text>
                        )}
                      </View>
                      {p.appointments?.slice(0, 2).map((a, i) => (
                        <Text key={i} style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>• {a.treatmentType}</Text>
                      ))}
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

                {/* Unified editable cards — one consistent UI (name + price editable, delete) */}
                {items.map((it, i) => (
                  <View key={i} style={styles.tmCard}>
                    <View style={styles.tmCardTop}>
                      <View style={styles.tmCardIcon}>
                        <Ionicons name="medical-outline" size={18} color="#0052FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={styles.tmNameInput}
                          value={it.name}
                          placeholder="Treatment name"
                          placeholderTextColor="#94A3B8"
                          onChangeText={(txt) => handleItemChange(i, 'name', txt)}
                        />
                        <View style={styles.tmPtsBadge}>
                          <Ionicons name="star" size={11} color="#D97706" />
                          <Text style={styles.tmPtsText}>50 reward pts on payment</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.tmDeleteBtn} hitSlop={6} onPress={() => handleItemDelete(i)}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.tmPriceRow}>
                      <Text style={styles.tmPriceLabel}>Price (PKR)</Text>
                      <TextInput
                        style={styles.tmPriceInput}
                        value={it.price}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#CBD5E1"
                        onChangeText={(txt) => handleItemChange(i, 'price', txt)}
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.tmAddMore} onPress={handleAddTreatment}>
                  <Ionicons name="add-circle-outline" size={16} color="#0052FF" />
                  <Text style={styles.tmAddMoreText}>Add Treatment</Text>
                </TouchableOpacity>
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
            {/* Page header */}
            <View style={styles.printHeader}>
              <View style={styles.printHeaderLeft}>
                <View style={styles.printHeaderIcon}>
                  <Ionicons name="print-outline" size={22} color="#0052FF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.printHeaderTitle}>Receipt Preview</Text>
                  <Text style={styles.printHeaderSub} numberOfLines={1}>Preview, print or download the receipt</Text>
                  {/* Invoice number on its own line below the title */}
                  {currentInvoice ? (
                    <View style={styles.invBadge}>
                      <Ionicons name="document-text-outline" size={12} color="#0052FF" style={{ marginRight: 4 }} />
                      <Text style={styles.invBadgeText} numberOfLines={1}>{currentInvoice.invoiceNumber}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={[styles.splitLayout, { alignItems: 'flex-start', gap: isWide ? 24 : 20 }]}>

              {/* ── Left: receipt paper (width + style reflects the printer type) ── */}
              <View style={{ flex: isWide ? 1 : undefined, alignSelf: isWide ? 'auto' : 'stretch', alignItems: 'center' }}>
                {/* Paper-size hint label */}
                <Text style={styles.paperHint}>
                  {printerType === 'thermal' ? '🧾 58mm Thermal Roll' : '📄 A4 Sheet'}
                </Text>
                <View style={[styles.receiptPaper, printerType === 'thermal' ? styles.receiptPaperThermal : styles.receiptPaperA4]}>
                  {/* Clinic banner — blue card for A4, plain centered text for thermal */}
                  {printerType === 'thermal' ? (
                    <View style={styles.receiptBannerThermal}>
                      <Text style={styles.receiptClinicThermal}>{(profile?.clinicName || 'MY DENTIST CLINIC').toUpperCase()}</Text>
                      <Text style={styles.receiptDocNameThermal}>{drName(profile?.fullName)}</Text>
                      <Text style={styles.receiptSpecThermal}>{profile?.specialization || 'Dental Specialist'}</Text>
                      <View style={styles.thermalDash} />
                    </View>
                  ) : (
                    <View style={styles.receiptBanner}>
                      <View style={styles.receiptBannerIcon}>
                        {profile?.photo ? (
                          <Image source={{ uri: imgUrl(profile.photo) }} style={styles.receiptLogo} resizeMode="cover" />
                        ) : (
                          <Image source={require('../../../../assets/logo-mark.png')} style={styles.receiptLogo} resizeMode="contain" />
                        )}
                      </View>
                      <Text style={styles.receiptClinic}>{profile?.clinicName?.toUpperCase() || 'MY DENTIST CLINIC'}</Text>
                      <Text style={styles.receiptDocName}>{drName(profile?.fullName)}</Text>
                      <Text style={styles.receiptSpec}>{profile?.specialization || 'Dental Specialist'}</Text>
                    </View>
                  )}

                  <View style={[styles.receiptBody, printerType === 'thermal' && { padding: 10, paddingTop: 4 }]}>
                    {/* Invoice meta */}
                    <View style={styles.rMetaGrid}>
                      <View style={styles.rMetaCell}>
                        <Text style={styles.rMetaLabel}>Bill No.</Text>
                        <Text style={styles.rMetaVal}>{currentInvoice?.invoiceNumber || '—'}</Text>
                      </View>
                      <View style={styles.rMetaCell}>
                        <Text style={styles.rMetaLabel}>Date</Text>
                        <Text style={styles.rMetaVal}>{currentInvoice?.date || new Date().toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.rMetaCell}>
                        <Text style={styles.rMetaLabel}>Patient</Text>
                        <Text style={styles.rMetaVal}>{currentInvoice?.patientName || '—'}</Text>
                      </View>
                      <View style={styles.rMetaCell}>
                        <Text style={styles.rMetaLabel}>Method</Text>
                        <Text style={[styles.rMetaVal, { textTransform: 'uppercase' }]}>{currentInvoice?.paymentMethod || 'Cash'}</Text>
                      </View>
                    </View>

                    {/* Treatments */}
                    <View style={styles.rTreatSection}>
                      <View style={styles.rTreatHeader}>
                        <Text style={[styles.rTreatTh, { flex: 1 }]}>Treatment</Text>
                        <Text style={styles.rTreatTh}>PKR</Text>
                      </View>
                      {(currentInvoice?.treatments || items).map((it, idx) => (
                        <View key={idx} style={styles.rTreatRow}>
                          <Text style={[styles.rTreatTd, { flex: 1 }]}>{it.name || 'Treatment'}</Text>
                          <Text style={styles.rTreatTd}>{Number(it.price || 0).toLocaleString()}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Totals */}
                    <View style={styles.rTotals}>
                      <View style={styles.rTotalRow}>
                        <Text style={styles.rTotalLabel}>Total Amount</Text>
                        <Text style={styles.rTotalVal}>PKR {(currentInvoice?.total || totalAmount).toLocaleString()}</Text>
                      </View>
                      {(currentInvoice?.discount || discountVal) > 0 && (
                        <View style={styles.rTotalRow}>
                          <Text style={[styles.rTotalLabel, { color: '#16A34A' }]}>Discount</Text>
                          <Text style={[styles.rTotalVal, { color: '#16A34A' }]}>- PKR {(currentInvoice?.discount || discountVal).toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={styles.rTotalRow}>
                        <Text style={styles.rTotalLabel}>Amount Paid</Text>
                        <Text style={styles.rTotalVal}>PKR {(currentInvoice?.paid || paidVal).toLocaleString()}</Text>
                      </View>
                      <View style={[styles.rTotalRow, styles.rTotalRowFinal]}>
                        <Text style={styles.rTotalLabelFinal}>Outstanding</Text>
                        <Text style={[styles.rTotalValFinal, { color: (currentInvoice?.outstanding ?? outstandingVal) > 0 ? '#DC2626' : '#16A34A' }]}>
                          PKR {(currentInvoice?.outstanding ?? outstandingVal).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.rThankYou}>Thank you for visiting! — Powered by My Dentist</Text>
                  </View>
                </View>
              </View>

              {/* ── Right: printer options + actions ── */}
              <View style={{ flex: isWide ? 1 : undefined, width: isWide ? undefined : '100%' }}>

                {/* Printer type */}
                <Text style={styles.optSectionTitle}>Printer Type</Text>
                <View style={styles.printerTypeRow}>
                  {[
                    { key: 'thermal', icon: 'receipt-outline', label: 'Thermal (57mm)', sub: 'Roll / POS receipt' },
                    { key: 'normal',  icon: 'print-outline',   label: 'Normal (A4)',    sub: 'Inkjet / laser printer' },
                  ].map(pt => (
                    <TouchableOpacity
                      key={pt.key}
                      style={[styles.printerTypeBtn, printerType === pt.key && styles.printerTypeBtnActive]}
                      onPress={() => setPrinterType(pt.key)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.ptIconWrap, printerType === pt.key && { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name={pt.icon} size={20} color={printerType === pt.key ? '#0052FF' : '#94A3B8'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.printerTypeTitle, printerType === pt.key && { color: '#0052FF' }]}>{pt.label}</Text>
                        <Text style={styles.printerTypeSub}>{pt.sub}</Text>
                      </View>
                      <View style={[styles.ptRadio, printerType === pt.key && styles.ptRadioActive]}>
                        {printerType === pt.key && <View style={styles.ptRadioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action buttons */}
                <Text style={styles.optSectionTitle}>Actions</Text>

                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={openBtPrinter} activeOpacity={0.85}>
                    <View style={[styles.actionBtnIcon, { backgroundColor: '#1D4ED8' }]}>
                      <Ionicons name="bluetooth-outline" size={18} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionBtnLabel}>Bluetooth Thermal Print</Text>
                      <Text style={styles.actionBtnSub}>Send directly to paired 58mm printer</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.actionBtn} onPress={handlePrint} activeOpacity={0.85}>
                  <View style={[styles.actionBtnIcon, { backgroundColor: '#0052FF' }]}>
                    <Ionicons name="print-outline" size={18} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionBtnLabel}>Print Receipt</Text>
                    <Text style={styles.actionBtnSub}>{Platform.OS === 'web' ? 'Opens browser print dialog' : 'Opens system print dialog'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadReceipt} activeOpacity={0.85}>
                  <View style={[styles.actionBtnIcon, { backgroundColor: '#16A34A' }]}>
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionBtnLabel}>{Platform.OS === 'web' ? 'Save / Download PDF' : 'Save PDF to Device'}</Text>
                    <Text style={styles.actionBtnSub}>{Platform.OS === 'web' ? 'Opens receipt in new tab' : 'Share or save to Files'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

              </View>
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

      {/* ── Patient Bills Modal ─────────────────────────────────── */}
      {patientModal && (() => {
        const pid = patientModal._id;
        const pBills = bills.filter(b => (b.patientId?._id || b.patientId) === pid);
        const pendingCount = pBills.filter(b => b.status === 'unpaid' || b.status === 'payment_pending').length;
        const totalPaidP = pBills.filter(b => b.status === 'paid').reduce((s, b) => s + (b.paidAmount || b.amount || 0), 0);

        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => { setPatientModal(null); setBillDetail(null); }}>
            <View style={styles.pmOverlay}>
              <View style={styles.pmSheet}>

                {/* Header */}
                <View style={styles.pmHeader}>
                  <View style={styles.pmAvatar}>
                    <Ionicons name="person" size={22} color="#0052FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pmName}>{patientModal.name}</Text>
                    <Text style={styles.pmSub}>{pBills.length} bill{pBills.length !== 1 ? 's' : ''} total</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setPatientModal(null); setBillDetail(null); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={26} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Summary chips */}
                <View style={styles.pmChipsRow}>
                  <View style={[styles.pmChip, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                    <Text style={[styles.pmChipText, { color: '#DC2626' }]}>{pendingCount} Pending</Text>
                  </View>
                  <View style={[styles.pmChip, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
                    <Text style={[styles.pmChipText, { color: '#16A34A' }]}>PKR {totalPaidP.toLocaleString()} Collected</Text>
                  </View>
                </View>

                {/* Bill detail expanded */}
                {billDetail ? (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity onPress={() => setBillDetail(null)} style={styles.bdBackRow}>
                      <Ionicons name="chevron-back" size={16} color="#0052FF" />
                      <Text style={styles.bdBackText}>Back to bills</Text>
                    </TouchableOpacity>

                    {/* Bill detail card */}
                    <View style={styles.bdCard}>
                      <View style={styles.bdCardTop}>
                        <View>
                          <Text style={styles.bdInvNo}>{billDetail.invoiceNumber}</Text>
                          <Text style={styles.bdDate}>{new Date(billDetail.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                        </View>
                        {(() => {
                          const sm = {
                            paid: { bg: '#DCFCE7', color: '#16A34A', label: 'Paid' },
                            draft: { bg: '#FEF3C7', color: '#D97706', label: 'Draft' },
                            payment_pending: { bg: '#EDE9FE', color: '#7C3AED', label: 'Pending' },
                            unpaid: { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' },
                          }[billDetail.status] || { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' };
                          return (
                            <View style={[styles.statusBadge, { backgroundColor: sm.bg, paddingHorizontal: 12, paddingVertical: 6 }]}>
                              <Text style={[styles.statusBadgeText, { color: sm.color, fontSize: 12 }]}>{sm.label}</Text>
                            </View>
                          );
                        })()}
                      </View>

                      <View style={styles.bdDivider} />

                      <Text style={styles.bdSectionLabel}>Treatment</Text>
                      <Text style={styles.bdTreatment}>{billDetail.treatmentName}</Text>

                      <View style={styles.bdDivider} />

                      <View style={styles.bdRow}><Text style={styles.bdLabel}>Total Amount</Text><Text style={styles.bdVal}>PKR {(billDetail.amount || 0).toLocaleString()}</Text></View>
                      {(billDetail.discountFromRewards || 0) > 0 && (
                        <View style={styles.bdRow}>
                          <Text style={[styles.bdLabel, { color: '#16A34A' }]}>Points Discount</Text>
                          <Text style={[styles.bdVal, { color: '#16A34A' }]}>- PKR {billDetail.discountFromRewards.toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={styles.bdRow}><Text style={styles.bdLabel}>Payable Amount</Text><Text style={[styles.bdVal, { color: '#0052FF', fontWeight: '800' }]}>PKR {(billDetail.finalAmount || 0).toLocaleString()}</Text></View>
                      <View style={styles.bdRow}><Text style={styles.bdLabel}>Amount Paid</Text><Text style={styles.bdVal}>PKR {(billDetail.paidAmount || 0).toLocaleString()}</Text></View>
                      <View style={[styles.bdRow, styles.bdRowFinal]}>
                        <Text style={styles.bdLabelFinal}>Outstanding</Text>
                        <Text style={[styles.bdValFinal, { color: Math.max((billDetail.finalAmount || 0) - (billDetail.paidAmount || 0), 0) > 0 ? '#DC2626' : '#16A34A' }]}>
                          PKR {Math.max((billDetail.finalAmount || 0) - (billDetail.paidAmount || 0), 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.bdDivider} />
                      <View style={styles.bdRow}><Text style={styles.bdLabel}>Payment Method</Text><Text style={styles.bdVal}>{(billDetail.paymentMethod || 'cash').toUpperCase()}</Text></View>
                      <View style={styles.bdRow}><Text style={styles.bdLabel}>Created</Text><Text style={styles.bdVal}>{new Date(billDetail.createdAt).toLocaleString()}</Text></View>
                    </View>

                    {/* View Receipt button */}
                    <TouchableOpacity
                      style={styles.bdViewBtn}
                      onPress={() => {
                        const d = billDetail;
                        const dDate = new Date(d.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                        const dOut = Math.max((d.finalAmount || 0) - (d.paidAmount || 0), 0);
                        setCurrentInvoice({
                          invoiceNumber: d.invoiceNumber,
                          date: dDate,
                          time: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          patientName: patientModal.name,
                          patientPhone: 'Provided',
                          treatments: [{ name: d.treatmentName, price: (d.amount || 0).toString() }],
                          total: d.amount || 0,
                          discount: d.discountFromRewards || 0,
                          paid: d.paidAmount || 0,
                          payable: d.finalAmount || 0,
                          outstanding: dOut,
                          status: d.status,
                          paymentMethod: d.paymentMethod || 'cash',
                        });
                        setPatientModal(null);
                        setBillDetail(null);
                        setSubTab('print');
                      }}
                    >
                      <Ionicons name="receipt-outline" size={16} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.bdViewBtnText}>Open Receipt / Print Preview</Text>
                    </TouchableOpacity>
                  </ScrollView>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                    {pBills.length === 0 ? (
                      <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 30 }}>No bills found for this patient.</Text>
                    ) : (
                      pBills.map((b, i) => {
                        const bDate = new Date(b.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                        const bOut = Math.max((b.finalAmount || 0) - (b.paidAmount || 0), 0);
                        const sm = {
                          paid: { bg: '#DCFCE7', color: '#16A34A', label: 'Paid' },
                          draft: { bg: '#FEF3C7', color: '#D97706', label: 'Draft' },
                          payment_pending: { bg: '#EDE9FE', color: '#7C3AED', label: 'Pending' },
                          unpaid: { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' },
                        }[b.status] || { bg: '#FEE2E2', color: '#DC2626', label: 'Unpaid' };
                        return (
                          <TouchableOpacity key={b._id || i} style={styles.pmBillRow} onPress={() => setBillDetail(b)} activeOpacity={0.75}>
                            <View style={styles.pmBillLeft}>
                              <View style={styles.pmBillIcon}>
                                <Ionicons name="document-text-outline" size={16} color="#0052FF" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pmBillInv}>{b.invoiceNumber}</Text>
                                <Text style={styles.pmBillTreat} numberOfLines={1}>{b.treatmentName}</Text>
                                <Text style={styles.pmBillDate}>{bDate}</Text>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <View style={[styles.statusBadge, { backgroundColor: sm.bg, marginBottom: 4 }]}>
                                <Text style={[styles.statusBadgeText, { color: sm.color }]}>{sm.label}</Text>
                              </View>
                              <Text style={styles.pmBillAmt}>PKR {(b.finalAmount || b.amount || 0).toLocaleString()}</Text>
                              {bOut > 0 && <Text style={styles.pmBillOut}>Due: PKR {bOut.toLocaleString()}</Text>}
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 8 }} />
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // The single vertical scroller; flex:1 so it fills the height under the pinned
  // sub-tab bar. paddingBottom clears the bottom tab bar (the outer ScrollView's
  // padding that used to do this is gone).
  contentScroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 110 },
  
  /* Top Tabs */
  // Fixed height — a horizontal ScrollView in a flex:1 column otherwise expands
  // to fill all vertical space (huge gap above the content). flexGrow:0 keeps it
  // from growing; the height pins it to the tab row.
  tabBar: { height: 50, flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 12, alignItems: 'stretch' },
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
  // Phone bill cards
  billCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7', padding: 14, marginBottom: 10 },
  billCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  billCardInv: { fontSize: 14.5, fontWeight: '800', color: '#0A1551' },
  billCardTreat: { fontSize: 13, color: '#475569', marginTop: 8 },
  billCardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  billCardDate: { fontSize: 12, color: '#94A3B8' },
  billCardAmount: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  billCardSubRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  billCardSub: { fontSize: 11.5, color: '#64748B' },
  billCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F4F6FA' },
  billCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  billCardBtnText: { fontSize: 12.5, fontWeight: '700', color: '#0052FF' },
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

  /* Print Preview header */
  printHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  printHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  printHeaderIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  printHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  printHeaderSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  invBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  invBadgeText: { color: '#0052FF', fontSize: 12, fontWeight: '800' },

  /* Receipt paper */
  receiptPaper: {
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  // A4: wider rounded sheet.    Thermal: narrow roll, square corners.
  receiptPaperA4: { width: 300, borderRadius: 16 },
  receiptPaperThermal: { width: 230, borderRadius: 4 },
  paperHint: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10 },
  receiptBannerThermal: { paddingTop: 14, paddingHorizontal: 12, alignItems: 'center' },
  receiptClinicThermal: { fontSize: 13, fontWeight: '900', color: '#0A1551', textAlign: 'center', letterSpacing: 0.3 },
  receiptDocNameThermal: { fontSize: 10, color: '#475569', marginTop: 2, textAlign: 'center' },
  receiptSpecThermal: { fontSize: 9, color: '#94A3B8', marginTop: 1, textAlign: 'center' },
  thermalDash: { alignSelf: 'stretch', marginTop: 8, marginBottom: 2, borderTopWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' },
  receiptBanner: {
    backgroundColor: '#0052FF', paddingVertical: 20, paddingHorizontal: 16,
    alignItems: 'center',
  },
  receiptBannerIcon: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  receiptLogo: { width: 40, height: 40, borderRadius: 20 },
  receiptClinic: { fontSize: 14, fontWeight: '900', color: '#FFF', textAlign: 'center', letterSpacing: 0.5 },
  receiptDocName: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  receiptSpec: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1, textAlign: 'center' },
  receiptBody: { padding: 16 },

  rMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, backgroundColor: '#F8FAFC', borderRadius: 10, overflow: 'hidden' },
  rMetaCell: { width: '50%', padding: 10, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#F1F5F9' },
  rMetaLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  rMetaVal: { fontSize: 11, fontWeight: '700', color: '#0A1551' },

  rTreatSection: { marginBottom: 12 },
  rTreatHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 4 },
  rTreatTh: { fontSize: 9, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  rTreatRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  rTreatTd: { fontSize: 11, color: '#0A1551' },

  rTotals: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 12 },
  rTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rTotalLabel: { fontSize: 11, color: '#475569' },
  rTotalVal: { fontSize: 11, fontWeight: '600', color: '#0A1551' },
  rTotalRowFinal: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  rTotalLabelFinal: { fontSize: 12, fontWeight: '700', color: '#0A1551' },
  rTotalValFinal: { fontSize: 13, fontWeight: '800' },
  rThankYou: { fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 4, lineHeight: 14 },

  /* Printer type selector */
  optSectionTitle: { fontSize: 13, fontWeight: '700', color: '#0A1551', marginBottom: 10, marginTop: 4 },
  printerTypeRow: { gap: 8, marginBottom: 20 },
  printerTypeBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF', gap: 10 },
  printerTypeBtnActive: { borderColor: '#0052FF', backgroundColor: '#F5F9FF' },
  ptIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  printerTypeTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  printerTypeSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  ptRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  ptRadioActive: { borderColor: '#0052FF' },
  ptRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0052FF' },

  /* Action buttons */
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F1F5F9',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionBtnIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  actionBtnLabel: { fontSize: 13.5, fontWeight: '700', color: '#0A1551' },
  actionBtnSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  /* Treatment view/edit mode */
  tmViewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tmBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tmBadgeText: { fontSize: 11, fontWeight: '700', color: '#0052FF' },
  tmEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#0052FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFF' },
  tmEditBtnText: { fontSize: 12, fontWeight: '700', color: '#0052FF' },
  tmCard: {
    backgroundColor: '#FFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 14, marginBottom: 10,
  },
  tmCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tmCardIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  tmTreatName: { fontSize: 14, fontWeight: '700', color: '#0A1551', marginBottom: 4 },
  tmNameInput: {
    fontSize: 14, fontWeight: '700', color: '#0A1551',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    includeFontPadding: false, marginBottom: 4,
  },
  tmDeleteBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  tmPtsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tmPtsText: { fontSize: 10, color: '#D97706', fontWeight: '600' },
  tmPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F4F6FA' },
  tmPriceLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  tmPriceInput: {
    width: 130, minHeight: 40, borderWidth: 1, borderColor: '#0052FF',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15, fontWeight: '700', color: '#0052FF', backgroundColor: '#F5F9FF',
    textAlign: 'right', textAlignVertical: 'center', includeFontPadding: false,
  },
  tmAddMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: '#0052FF', borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 10, backgroundColor: '#EFF6FF', marginTop: 4,
  },
  tmAddMoreText: { fontSize: 12, fontWeight: '700', color: '#0052FF' },

  /* Patient name pill in table */
  patientNamePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4, backgroundColor: '#EFF6FF',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start',
  },
  patientNamePillText: { fontSize: 10, fontWeight: '700', color: '#0052FF', maxWidth: 110 },

  /* Patient bills modal */
  pmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pmSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%', minHeight: '60%',
  },
  pmHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  pmAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  pmName: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  pmSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  pmChipsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pmChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  pmChipText: { fontSize: 12, fontWeight: '700' },
  pmBillRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
    padding: 14, marginBottom: 10,
  },
  pmBillLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pmBillIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  pmBillInv: { fontSize: 13, fontWeight: '700', color: '#0A1551' },
  pmBillTreat: { fontSize: 11, color: '#475569', marginTop: 2 },
  pmBillDate: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  pmBillAmt: { fontSize: 12, fontWeight: '700', color: '#0A1551' },
  pmBillOut: { fontSize: 10, color: '#DC2626', fontWeight: '600', marginTop: 2 },

  /* Bill detail view (inside patient modal) */
  bdBackRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  bdBackText: { fontSize: 13, fontWeight: '700', color: '#0052FF' },
  bdCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 18, marginBottom: 16 },
  bdCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  bdInvNo: { fontSize: 16, fontWeight: '800', color: '#0A1551' },
  bdDate: { fontSize: 12, color: '#64748B', marginTop: 3 },
  bdDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  bdSectionLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
  bdTreatment: { fontSize: 14, fontWeight: '600', color: '#0A1551' },
  bdRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bdLabel: { fontSize: 13, color: '#64748B' },
  bdVal: { fontSize: 13, fontWeight: '600', color: '#0A1551' },
  bdRowFinal: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 4 },
  bdLabelFinal: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  bdValFinal: { fontSize: 15, fontWeight: '800' },
  bdViewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14,
  },
  bdViewBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
