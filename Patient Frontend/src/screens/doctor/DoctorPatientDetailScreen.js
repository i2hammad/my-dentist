import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import { drName } from '../../utils/doctorName';
import { showDialog } from '../../components/AppDialog';
import { buildReceiptHtml } from './tabs/BillsTab';

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

  // Print/share a single bill's receipt — reuses the BillsTab receipt builder,
  // scoped to THIS patient (no redirect to the global list).
  const printBill = async (b) => {
    const invoice = {
      invoiceNumber: b.invoiceNumber,
      date: fmtDate(b.paidAt || b.createdAt),
      time: '',
      patientName: patient?.name || b.patientId?.fullName || 'Patient',
      patientPhone: patient?.mobileNumber || '',
      treatments: String(b.treatmentName || 'Treatment').split(',').map((n) => ({ name: n.trim(), price: '' })),
      total: b.amount,
      discount: b.discountFromRewards || 0,
      paid: b.paidAmount || 0,
      outstanding: Math.max(0, (b.finalAmount || b.amount) - (b.paidAmount || 0)),
      status: b.status || 'unpaid',
    };
    const docName = drName(doctorProfile?.fullName, 'Dentist');
    const clinic = doctorProfile?.clinicName || 'Dentist Clinic';
    const spec = doctorProfile?.specialization || 'General Doctor';
    try {
      if (isWeb) {
        const html = buildReceiptHtml(invoice, { docName, clinic, spec, type: 'normal', autoPrint: true });
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
        return;
      }
      const Print = require('expo-print');
      const html = buildReceiptHtml(invoice, { docName, clinic, spec, type: 'thermal', autoPrint: false });
      const { uri } = await Print.printToFileAsync({ html, width: 162 });
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {}
  };

  // Tap a bill → show its breakdown for THIS patient, with a print option.
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
    showDialog({
      title: `Bill #${b.invoiceNumber}`,
      message: lines,
      buttons: [
        { text: 'Close', style: 'cancel' },
        { text: 'Print / Share', onPress: () => printBill(b) },
      ],
    });
  };

  if (!patient) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.empty}>Patient not found.</Text>
      </SafeAreaView>
    );
  }

  // Newest appointments first.
  const appts = [...(patient.appointments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

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
        {/* Patient summary */}
        <View style={styles.summaryCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(patient.name || '?').charAt(0)}</Text></View>
          <Text style={styles.name}>{patient.name}</Text>
          {!!patient.mobileNumber && (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={14} color="#64748B" />
              <Text style={styles.metaText}>{patient.mobileNumber}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{patient.totalVisits || appts.length}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{fmtDate(patient.lastVisit)}</Text>
              <Text style={styles.statLabel}>Last Visit</Text>
            </View>
          </View>
        </View>

        {/* Appointment history */}
        <Text style={styles.sectionTitle}>Appointment History</Text>
        {appts.length ? appts.map((a) => {
          const s = STATUS[a.status] || STATUS.pending;
          return (
            <TouchableOpacity
              key={a._id}
              style={styles.apptCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DoctorAppointmentDetail', { appointment: a })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTreatment}>{a.treatmentType || 'Consultation'}</Text>
                <Text style={styles.apptWhen}>{fmtDate(a.date)} · {fmtTime(a.time)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <Text style={styles.emptyHistory}>No appointment history.</Text>
        )}

        {/* Bills with this patient (this doctor's bills) */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Bills</Text>
        {billsLoading ? (
          <ActivityIndicator color="#0052FF" style={{ marginVertical: 16 }} />
        ) : bills.length ? bills.map((b) => {
          const s = BILL_STATUS[b.status] || BILL_STATUS.unpaid;
          const final = b.finalAmount || b.amount;
          return (
            <TouchableOpacity key={b._id} style={styles.apptCard} activeOpacity={0.8} onPress={() => openBill(b)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTreatment}>{b.treatmentName || 'Treatment'}</Text>
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
  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 18 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#0052FF' },
  name: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { fontSize: 13, color: '#64748B' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, alignSelf: 'stretch' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 15, fontWeight: '800', color: '#0052FF' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#EEF2F7', marginHorizontal: 8, alignSelf: 'stretch' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  apptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7' },
  apptTreatment: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  apptWhen: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  billAmount: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  billDiscount: { fontSize: 11, fontWeight: '700', color: '#16A34A', marginBottom: 1 },
  emptyHistory: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
