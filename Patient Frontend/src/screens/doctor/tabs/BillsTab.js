import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, ActivityIndicator, Alert, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

export default function BillsTab({ profile, appointments, isProfileComplete = true, missingFields = [] }) {
  const [subTab, setSubTab] = useState('previous'); // previous, current, print
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const res = await axios.get(`${API_BASE_URL}/api/bills/my`, {
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

  const applyPointsDiscount = () => {
    const code = pointsCode.trim();
    Alert.alert('Coming Soon', 'Code validation will be available in a future update.');
    return;
  };

  const handleCreateBill = async () => {
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
    if (items.length === 0 || items.some(it => !it.name || !it.price)) {
      Alert.alert('Error', 'Please ensure all treatments have a name and price.');
      return;
    }

    try {
      setSaving(true);
      const token = await storage.getItem('userToken');
      
      const payload = {
        patientId: selectedPatient.id,
        treatmentName: items.map(it => it.name).join(', '),
        amount: totalAmount,
        discountFromRewards: discountVal,
        paidAmount: paidVal,
        paymentMethod: paymentMethod,
        dueDate: new Date().toISOString()
      };

      const res = await axios.post(`${API_BASE_URL}/api/bills`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        const newBill = res.data.data;
        Alert.alert('Success', 'Bill created successfully!');

        // Populate specimen for Print Current Bill tab
        setCurrentInvoice({
          invoiceNumber: newBill.invoiceNumber,
          date: new Date(newBill.createdAt).toLocaleDateString(),
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
      Alert.alert('Error', err.response?.data?.message || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!currentInvoice && !selectedPatient) {
      Alert.alert('No Bill Selected', 'Please select a patient and create a bill before downloading a receipt.');
      return;
    }
    const invoice = currentInvoice || {
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
      paymentMethod: paymentMethod
    };

    const docName = profile?.fullName || 'Dentist';
    const clinic = profile?.clinicName || 'Dentist Clinic';
    const spec = profile?.specialization || 'General Doctor';

    // Formatted text for native sharing on mobile
    const receiptText = `
=== ${clinic.toUpperCase()} ===
Doctor: Dr. ${docName} (${spec})
Invoice: ${invoice.invoiceNumber}
Date: ${invoice.date}
Payment Method: ${(invoice.paymentMethod || 'cash').toUpperCase()}
---------------------------------
Patient Name: ${invoice.patientName}
Phone Number: ${invoice.patientPhone}
---------------------------------
TREATMENT DETAILS:
${invoice.treatments.map((it, idx) => `${idx + 1}. ${it.name} - PKR ${it.price}`).join('\n')}
---------------------------------
Total Bill: PKR ${invoice.total}
Discount Given: PKR ${invoice.discount}
Paid Amount: PKR ${invoice.paid}
Outstanding: PKR ${invoice.outstanding}
Payment Status: ${invoice.status.toUpperCase()}
---------------------------------
Thank you for visiting!
`;

    // Thermal 57mm receipt layout — sized for 57mm roll printers, also
    // "Save as PDF" from the browser print dialog.
    const thermalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${invoice.invoiceNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: 57mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: 'Courier New', Courier, monospace; width: 57mm; margin: 0 auto; padding: 6px 8px; color: #000; font-size: 11px; }
          .center { text-align: center; }
          .clinic { font-size: 14px; font-weight: bold; }
          .meta { font-size: 10px; margin-top: 2px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold { font-weight: bold; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
          @media screen { body { border: 1px dashed #999; margin-top: 16px; border-radius: 6px; } }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="clinic">${clinic.toUpperCase()}</div>
          <div class="meta">Dr. ${docName}</div>
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
        ${invoice.treatments.map((it, idx) => `<div class="row"><span>${idx + 1}. ${it.name}</span><span>${it.price}</span></div>`).join('')}
        <div class="divider"></div>
        <div class="row"><span>Total:</span><span>PKR ${invoice.total}</span></div>
        <div class="row"><span>Discount:</span><span>- ${invoice.discount}</span></div>
        <div class="row bold"><span>Paid:</span><span>PKR ${invoice.paid}</span></div>
        <div class="row bold"><span>Outstanding:</span><span>PKR ${invoice.outstanding}</span></div>
        <div class="row bold"><span>Status:</span><span>${invoice.status.toUpperCase()}</span></div>
        <div class="footer">Thank you for visiting!<br/>Powered by My Dentist PK</div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
      </body>
      </html>`;

    if (Platform.OS === 'web') {
      // Open the thermal receipt in a new window and trigger print → user can
      // pick a 57mm thermal printer or "Save as PDF".
      const w = window.open('', '_blank', 'width=320,height=600');
      if (w) { w.document.write(thermalHtml); w.document.close(); }
      else { window.alert('Please allow pop-ups to print/save the receipt.'); }
    } else {
      // Native: try expo-print → PDF + share; fall back to text share.
      try {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html: thermalHtml, width: 162 }); // ~57mm @ 72dpi
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Receipt ${invoice.invoiceNumber}` });
        } else {
          await Share.share({ url: uri, message: receiptText, title: `Receipt ${invoice.invoiceNumber}` });
        }
      } catch (e) {
        // expo-print/sharing not installed — fall back to plain text share.
        Share.share({ message: receiptText, title: `Receipt ${invoice.invoiceNumber}` });
      }
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

            {loading ? (
              <ActivityIndicator size="small" color="#0052FF" style={{ marginVertical: 30 }} />
            ) : bills.length > 0 ? (
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

                  {bills.map((inv, idx) => {
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
                          <View style={[styles.statusBadge, {backgroundColor: inv.status === 'paid' ? '#DCFCE7' : '#FEE2E2'}]}>
                            <Text style={[styles.statusBadgeText, {color: inv.status === 'paid' ? '#16A34A' : '#DC2626'}]}>
                              {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={{width: 50, alignItems: 'center'}}
                          onPress={() => {
                            setCurrentInvoice({
                              invoiceNumber: inv.invoiceNumber,
                              date: billDate,
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
              <Text style={{ textAlign: 'center', marginVertical: 30, color: '#94A3B8' }}>No bills found. Create a bill in the 'Current Bill' tab.</Text>
            )}

            <View style={styles.supportBox}>
              <View style={styles.supportIcon}><Ionicons name="help" size={20} color="#0052FF" /></View>
              <View style={{flex: 1, marginLeft: 12}}>
                <Text style={styles.supportTitle}>Need help with billing?</Text>
                <Text style={styles.supportDesc}>Contact our support team for setup assistance.</Text>
              </View>
              <TouchableOpacity style={styles.contactBtn}>
                <Text style={styles.contactBtnText}>Support</Text>
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
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setItems([{ name: 'Teeth Cleaning', price: '1500' }])}><Text style={styles.cancelBtnText}>Reset</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.createBtn} onPress={handleCreateBill} disabled={saving}>
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createBtnText}>Create Bill</Text>}
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </View>
        )}

        {/* --- PRINT PREVIEW --- */}
        {subTab === 'print' && (
          <View>
            <Text style={styles.pageTitle}>Receipt Specimen</Text>
            <Text style={styles.pageSubtitle}>Review and download/share the generated patient receipt.</Text>

            <View style={[styles.splitLayout, { alignItems: 'center' }]}>
              
              {/* Receipt Paper */}
              <View style={styles.receiptPaper}>
                <View style={styles.receiptInner}>
                  <Ionicons name="medical-outline" size={32} color="#0052FF" style={{alignSelf: 'center'}} />
                  <Text style={styles.rTitle}>{profile?.clinicName?.toUpperCase() || 'MY DENTIST CLINIC'}</Text>
                  <Text style={styles.rSub}>Dr. {profile?.fullName || 'Doctor'}</Text>
                  <Text style={styles.rSub}>{profile?.specialization || 'Dental Specialist'}</Text>
                  
                  <Text style={styles.rDivider}>----------------------------------------</Text>
                  <Text style={styles.rHeading}>RECEIPT</Text>

                  <View style={styles.rRow}><Text style={styles.rLabel}>Bill No.</Text><Text style={styles.rVal}>: {currentInvoice?.invoiceNumber || '—'}</Text></View>
                  <View style={styles.rRow}><Text style={styles.rLabel}>Date</Text><Text style={styles.rVal}>: {currentInvoice?.date || new Date().toLocaleDateString()}</Text></View>
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

              {/* Download / Share Action Button */}
              <TouchableOpacity style={[styles.printNowBtn, { width: 320, marginTop: 20 }]} onPress={handleDownloadReceipt}>
                <Ionicons name="download-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.printNowText}>{Platform.OS === 'web' ? 'Download PDF/HTML Receipt' : 'Share Receipt'}</Text>
              </TouchableOpacity>

            </View>
          </View>
        )}

      </ScrollView>
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

  /* Print / Share Receipt */
  printNowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, backgroundColor: '#0052FF', borderRadius: 8 },
  printNowText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' },

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
