import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import { drName } from '../../utils/doctorName';
import { showDialog } from '../../components/AppDialog';
import { buildReceiptHtml, thermalPdfSize } from './tabs/BillsTab';
import BtPrinterPicker from '../../components/BtPrinterPicker';

const isWeb = Platform.OS === 'web';
const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const BILL_STATUS = {
  paid:            { bg: '#DCFCE7', text: '#16A34A', label: 'Paid' },
  unpaid:          { bg: '#FEF3C7', text: '#D97706', label: 'Unpaid' },
  draft:           { bg: '#F3F4F6', text: '#6B7280', label: 'Draft' },
  payment_pending: { bg: '#EDE9FE', text: '#7C3AED', label: 'Pending' },
};

const STATUS = {
  confirmed: { bg: '#D1FAE5', text: '#059669', label: 'Confirmed' },
  pending:   { bg: '#FEF3C7', text: '#D97706', label: 'Pending'   },
  cancelled: { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelled' },
  completed: { bg: '#EDE9FE', text: '#7C3AED', label: 'Completed' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
const fmtTime = (t) => {
  if (!t) return '';
  const [hh, mm] = String(t).split(':');
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function DoctorPatientDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const patient = route?.params?.patient;
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [btBill, setBtBill] = useState(null); // invoice for the Bluetooth printer picker

  // Fetch the bills this doctor has generated for this patient.
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const pid = patient?.id || patient?._id;
      if (!pid) { setBillsLoading(false); return; }
      try {
        const token = await storage.getItem('userToken');
        const headers = { Authorization: `Bearer ${token}` };
        // Resolve this doctor's profile id so we only show OUR bills with the patient.
        const meRes = await axios.get(`${API_BASE_URL}/api/users/me`, { headers });
        const myProfile = meRes.data?.data?.profile;
        const myDoctorId = myProfile?._id;
        if (active) setDoctorProfile(myProfile);
        const res = await axios.get(`${API_BASE_URL}/api/bills/patient/${pid}?limit=100`, { headers });
        if (!active) return;
        const all = res.data?.success ? (res.data.data || []) : [];
        const mine = myDoctorId
          ? all.filter((b) => String(b.doctorId?._id || b.doctorId) === String(myDoctorId))
          : all;
        setBills(mine);
      } catch {
        if (active) setBills([]);
      } finally {
        if (active) setBillsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [patient?.id]));

  // Build the receipt invoice from a bill, using saved per-treatment prices.
  const billToInvoice = (b) => {
    const treatments = Array.isArray(b.treatments) && b.treatments.length
      ? b.treatments.map((t) => ({ name: t.name || 'Treatment', price: String(t.price || '') }))
      : String(b.treatmentName || 'Treatment').split(',').map((n) => ({ name: n.trim(), price: '' }));
    return {
      invoiceNumber: b.invoiceNumber,
      date: fmtDate(b.paidAt || b.createdAt),
      time: '',
      patientName: patient?.name || b.patientId?.fullName || 'Patient',
      patientPhone: patient?.mobileNumber || '',
      treatments,
      total: b.amount,
      discount: b.discountFromRewards || 0,
      paid: b.paidAmount || 0,
      outstanding: Math.max(0, (b.finalAmount || b.amount) - (b.paidAmount || 0)),
      status: b.status || 'unpaid',
    };
  };
  const receiptMeta = () => ({
    docName: drName(doctorProfile?.fullName, 'Dentist'),
    clinic: doctorProfile?.clinicName || 'Dentist Clinic',
    spec: doctorProfile?.specialization || 'General Doctor',
  });

  // Save / share the receipt as a PDF (same as the doctor Bills tab).
  const shareBillPdf = async (b) => {
    const invoice = billToInvoice(b);
    const meta = receiptMeta();
    try {
      if (isWeb) {
        const html = buildReceiptHtml(invoice, { ...meta, type: 'normal', autoPrint: true });
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
        return;
      }
      const Print = require('expo-print');
      const html = buildReceiptHtml(invoice, { ...meta, type: 'thermal', autoPrint: false });
      const { uri } = await Print.printToFileAsync({ html, ...thermalPdfSize(invoice) });
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {}
  };

  // Edit → jump to the doctor Bills tab and load this bill into the form.
  const editBill = (b) => {
    navigation.navigate('DoctorTabs', { screen: 'DoctorBills', params: { editBillId: b._id } });
  };

  // Tap a bill → breakdown + actions matching the Bills tab (Thermal print, Save/Share PDF, Edit).
  const openBill = (b) => {
    const final = b.finalAmount || b.amount;
    const lines = [
      `Treatment: ${b.treatmentName || 'Treatment'}`,
      `Date: ${fmtDate(b.paidAt || b.createdAt)}`,
      `Amount: ${rs(b.amount)}`,
      (b.discountFromRewards || 0) > 0 ? `Reward discount: −${rs(b.discountFromRewards)}` : null,
      `Total: ${rs(final)}`,
      `Paid: ${rs(b.paidAmount)}`,
      `Status: ${(b.status || 'unpaid').toUpperCase()}`,
    ].filter(Boolean).join('\n');
    // A paid bill is final — no editing once it's settled.
    const isPaid = b.status === 'paid';
    const buttons = [
      { text: 'Close', style: 'cancel' },
    ];
    if (!isPaid) buttons.push({ text: 'Edit', onPress: () => editBill(b) });
    buttons.push({ text: 'Save / Share PDF', onPress: () => shareBillPdf(b) });
    if (!isWeb) buttons.push({ text: 'Print to Thermal Printer', onPress: () => setBtBill(billToInvoice(b)) });
    showDialog({ title: `Bill #${b.invoiceNumber || 'N/A'}`, message: lines, buttons });
  };

  // Billing totals (exclude drafts) derived from the fetched bills.
  // NOTE: must be declared BEFORE the early return below — hooks can't run
  // conditionally (was causing "Rendered more hooks than during the previous render").
  const billTotals = useMemo(() => {
    const real = bills.filter((b) => b.status !== 'draft');
    const totalBilled = real.reduce((s, b) => s + (b.finalAmount || b.amount || 0), 0);
    const totalPaid = real.reduce((s, b) => s + (b.paidAmount || 0), 0);
    return { totalBilled, totalPaid, outstanding: Math.max(0, totalBilled - totalPaid) };
  }, [bills]);

  if (!patient) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.empty}>Patient not found.</Text>
      </SafeAreaView>
    );
  }

  // Newest appointments first.
  const appts = [...(patient.appointments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const firstVisit = appts.length ? appts[appts.length - 1].date : patient.lastVisit;

  const hasPhone = !!patient.mobileNumber;
  const callPatient = () => hasPhone && Linking.openURL(`tel:${patient.mobileNumber}`);
  const whatsappPatient = () => {
    const wa = String(patient.mobileNumber || '').replace(/\D/g, '').replace(/^0/, '92');
    if (wa) Linking.openURL(`https://wa.me/${wa}`);
  };
  const newBill = () => navigation.navigate('DoctorTabs', { screen: 'DoctorBills' });

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.safe}>
      <View style={[styles.header, !isWeb && { paddingTop: insets.top + 10 }, isWeb && styles.webBlock]}>
        {!isWeb && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#0A1551" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Patient Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWeb && styles.webBlock]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroAvatar}><Text style={styles.heroAvatarText}>{(patient.name || '?').charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.heroName} numberOfLines={1}>{patient.name}</Text>
            {hasPhone && (
              <View style={styles.heroRow}>
                <Ionicons name="call-outline" size={13} color="#64748B" />
                <Text style={styles.heroPhone}>{patient.mobileNumber}</Text>
              </View>
            )}
            <Text style={styles.heroMeta} numberOfLines={1}>Member since {fmtDate(firstVisit)} · Last visit {fmtDate(patient.lastVisit)}</Text>
            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons name="calendar-outline" size={13} color="#0052FF" />
                <Text style={styles.heroChipText}>{patient.totalVisits || appts.length} visits</Text>
              </View>
              <View style={styles.heroChip}>
                <Ionicons name="receipt-outline" size={13} color="#0052FF" />
                <Text style={styles.heroChipText}>{bills.length} bills</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionPrimary, !hasPhone && { opacity: 0.45 }]} disabled={!hasPhone} onPress={callPatient}>
            <Ionicons name="call" size={16} color="#FFFFFF" />
            <Text style={styles.actionPrimaryText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionWa, !hasPhone && { opacity: 0.45 }]} disabled={!hasPhone} onPress={whatsappPatient}>
            <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
            <Text style={styles.actionWaText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBill} onPress={newBill}>
            <Ionicons name="add-circle-outline" size={16} color="#0052FF" />
            <Text style={styles.actionBillText}>New Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Billing summary */}
        {bills.length > 0 && (
          <View style={styles.billStrip}>
            <View style={styles.billCol}>
              <Text style={[styles.billVal, { color: '#0F172A' }]}>{rs(billTotals.totalBilled)}</Text>
              <Text style={styles.billLbl}>Total Billed</Text>
            </View>
            <View style={styles.billDiv} />
            <View style={styles.billCol}>
              <Text style={[styles.billVal, { color: '#16A34A' }]}>{rs(billTotals.totalPaid)}</Text>
              <Text style={styles.billLbl}>Paid</Text>
            </View>
            <View style={styles.billDiv} />
            <View style={styles.billCol}>
              <Text style={[styles.billVal, { color: billTotals.outstanding > 0 ? '#DC2626' : '#16A34A' }]}>{rs(billTotals.outstanding)}</Text>
              <Text style={styles.billLbl}>{billTotals.outstanding > 0 ? 'Outstanding' : 'Settled'}</Text>
            </View>
          </View>
        )}

        {/* Appointment history */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Appointment History</Text>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{appts.length}</Text></View>
          </View>
        </View>
        {appts.length ? appts.map((a) => {
          const s = STATUS[a.status] || STATUS.pending;
          return (
            <TouchableOpacity
              key={a._id}
              style={styles.itemCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DoctorAppointmentDetail', { appointment: a })}
            >
              <View style={[styles.cardIcon, { backgroundColor: '#EFF4FF' }]}>
                <Ionicons name="medkit-outline" size={18} color="#0052FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTreatment}>{a.treatmentType || 'Consultation'}</Text>
                <Text style={styles.apptWhen}>{fmtDate(a.date)}{a.time ? ` · ${fmtTime(a.time)}` : ''}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <Text style={styles.emptyHistory}>No appointment history.</Text>
        )}

        {/* Bills */}
        <View style={[styles.sectionHeader, { marginTop: 22 }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Bills</Text>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{bills.length}</Text></View>
          </View>
          <TouchableOpacity onPress={newBill} hitSlop={8}><Text style={styles.linkBtn}>+ New</Text></TouchableOpacity>
        </View>
        {billsLoading ? (
          <ActivityIndicator color="#0052FF" style={{ marginVertical: 16 }} />
        ) : bills.length ? bills.map((b) => {
          const s = BILL_STATUS[b.status] || BILL_STATUS.unpaid;
          const final = b.finalAmount || b.amount;
          const paid = b.status === 'paid';
          return (
            <TouchableOpacity key={b._id} style={styles.itemCard} activeOpacity={0.85} onPress={() => openBill(b)}>
              <View style={[styles.cardIcon, { backgroundColor: paid ? '#F0FDF4' : '#FEF7E6' }]}>
                <Ionicons name="receipt-outline" size={18} color={paid ? '#16A34A' : '#D97706'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTreatment} numberOfLines={1}>{b.treatmentName || 'Treatment'}</Text>
                <Text style={styles.apptWhen}>#{b.invoiceNumber} · {fmtDate(b.paidAt || b.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                {(b.discountFromRewards || 0) > 0 && (
                  <Text style={styles.billDiscount}>−{rs(b.discountFromRewards)}</Text>
                )}
                <Text style={styles.billAmount}>{rs(final)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <Text style={styles.emptyHistory}>No bills generated for this patient yet.</Text>
        )}
      </ScrollView>

      <BtPrinterPicker
        visible={!!btBill}
        invoice={btBill}
        meta={receiptMeta()}
        onClose={() => setBtBill(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  // Web: center + cap content so cards/rows aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, paddingTop: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  content: { padding: 16, paddingBottom: 40 },

  // Hero
  hero: { flexDirection: 'row', backgroundColor: '#EFF4FF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#DCE6FB', marginBottom: 14 },
  heroAvatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  heroAvatarText: { fontSize: 26, fontWeight: '800', color: '#0052FF' },
  heroName: { fontSize: 19, fontWeight: '800', color: '#0A1551' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  heroPhone: { fontSize: 13, color: '#475569' },
  heroMeta: { fontSize: 11.5, color: '#64748B', marginTop: 4 },
  heroChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  heroChipText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

  // Quick actions
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionPrimary: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#0052FF' },
  actionPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  actionWa: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#E7F8EF', borderWidth: 1, borderColor: '#BBF0D0' },
  actionWaText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  actionBill: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#D6E2FB' },
  actionBillText: { fontSize: 13, fontWeight: '700', color: '#0052FF' },

  // Billing summary strip
  billStrip: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7', padding: 16, marginBottom: 20, shadowColor: '#0A1551', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  billCol: { flex: 1, alignItems: 'center' },
  billDiv: { width: 1, backgroundColor: '#EEF2F7', alignSelf: 'stretch', marginHorizontal: 6 },
  billVal: { fontSize: 15, fontWeight: '800' },
  billLbl: { fontSize: 10.5, fontWeight: '600', color: '#94A3B8', marginTop: 3 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  countBadge: { backgroundColor: '#EFF4FF', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  countBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#0052FF' },
  linkBtn: { fontSize: 12.5, fontWeight: '700', color: '#0052FF' },

  // Item cards
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7', shadowColor: '#0A1551', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  apptTreatment: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  apptWhen: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  billAmount: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  billDiscount: { fontSize: 11, fontWeight: '700', color: '#16A34A', marginBottom: 1 },
  emptyHistory: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
