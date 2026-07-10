import React, { useState, useCallback } from 'react';
import { useRequireLogin } from "../utils/authGuard";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { Platform } from 'react-native';
import PromoCard from '../components/PromoCard';
import PatientHeader from '../components/PatientHeader';
import { showDialog } from '../components/AppDialog';
import PaymentSheet from '../components/PaymentSheet';
import { buildReceiptHtml, thermalPdfSize } from './doctor/tabs/BillsTab';
import webContent, { isWeb } from '../config/webLayout';

const PAGE_SIZE = 15; // bills per page (infinite scroll grows this)
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'draft', label: 'Draft' },
];

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const STATUS = {
  paid:            { color: '#16A34A', bg: '#DCFCE7', label: 'Paid', icon: 'checkmark-circle' },
  unpaid:          { color: '#D97706', bg: '#FEF3C7', label: 'Unpaid', icon: 'time' },
  draft:           { color: '#6B7280', bg: '#F3F4F6', label: 'Draft', icon: 'document-outline' },
  payment_pending: { color: '#7C3AED', bg: '#EDE9FE', label: 'Awaiting Confirmation', icon: 'hourglass-outline' },
};

function SummaryCard({ icon, label, value, color }) {
  return (
    <View style={styles.sumCard}>
      <View style={[styles.sumIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.sumValue}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

function BillCard({ bill, onPress, onPay, onDownload, paying }) {
  const doc = bill.doctorId || {};
  const s = STATUS[bill.status] || STATUS.unpaid;
  const final = bill.finalAmount || bill.amount;
  const hasDiscount = (bill.discountFromRewards || 0) > 0;
  const isUnpaid = bill.status === 'unpaid';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPress(bill)}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.treatment} numberOfLines={1}>{bill.treatmentName || 'Treatment'}</Text>
          <Text style={styles.docName} numberOfLines={1}>
            <Ionicons name="person-outline" size={12} color="#94A3B8" /> {doc.fullName || 'Doctor'}
          </Text>
          {!!doc.clinicName && <Text style={styles.clinic} numberOfLines={1}>{doc.clinicName}</Text>}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={12} color={s.color} />
          <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.invoiceNo}>#{bill.invoiceNumber}</Text>
          <Text style={styles.date}>{fmtDate(bill.paidAt || bill.createdAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {hasDiscount && <Text style={styles.discount}>−{rs(bill.discountFromRewards)} reward</Text>}
          <Text style={styles.amount}>{rs(final)}</Text>
        </View>
      </View>

      {bill.status === 'payment_pending' && (
        <View style={styles.pendingHint}>
          <Ionicons name="hourglass-outline" size={14} color="#7C3AED" />
          <Text style={styles.pendingHintText}>
            {bill.paymentMethodLabel ? `${bill.paymentMethodLabel} · ` : ''}Awaiting doctor confirmation
          </Text>
        </View>
      )}

      {/* Actions: preview/download receipt (always) + pay (unpaid only) */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.previewBtn} activeOpacity={0.85} onPress={() => onDownload(bill)}>
          <Ionicons name="receipt-outline" size={16} color="#0052FF" />
          <Text style={styles.previewBtnText}>Invoice</Text>
        </TouchableOpacity>
        {isUnpaid && (
          <TouchableOpacity
            style={styles.payBtn}
            activeOpacity={0.85}
            disabled={paying}
            onPress={() => onPay(bill)}
          >
            {paying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                <Text style={styles.payBtnText}>Pay Now · {rs(final)}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function BillsHistoryScreen({ navigation }) {
  useRequireLogin();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [paySheetBill, setPaySheetBill] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset the page window whenever search/filter changes.
  React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter]);

  const fetchData = useCallback(async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setLoading(false); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const [billsRes, sumRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/bills/my?limit=100`, { headers }),
        axios.get(`${API_BASE_URL}/api/bills/summary`, { headers }).catch(() => null),
      ]);
      if (billsRes.data?.success) setBills(billsRes.data.data || []);
      if (sumRes?.data?.success) setSummary(sumRes.data.data);
    } catch {
      // ignore — empty state shows
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isWeb) setStatusBarStyle('light');
    fetchData();
  }, [fetchData]));

  const openBill = (bill) => {
    const doc = bill.doctorId;
    if (doc?._id) navigation.navigate('DoctorProfile', { doctorId: doc._id, doctor: doc });
  };

  // Open the payment-method sheet.
  const payNow = (bill) => setPaySheetBill(bill);

  // Called by PaymentSheet with the chosen method.
  const doPay = async (selection) => {
    const bill = paySheetBill;
    if (!bill) return;
    setPaySheetBill(null);
    setPayingId(bill._id);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.put(`${API_BASE_URL}/api/bills/${bill._id}/pay`, selection, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        if (res.data.data?.pending) {
          showDialog({ title: 'Cash Payment Recorded', message: `Marked bill #${bill.invoiceNumber} as paid by cash. Awaiting your doctor's confirmation.` });
        } else {
          showDialog({ title: 'Payment Successful', message: `Bill #${bill.invoiceNumber} has been paid.` });
        }
        fetchData(); // refresh list + summary
      } else {
        showDialog({ title: 'Payment Failed', message: res.data?.message || 'Could not pay this bill.' });
      }
    } catch (e) {
      showDialog({ title: 'Payment Failed', message: e.response?.data?.message || 'Something went wrong. Please try again.' });
    } finally {
      setPayingId(null);
    }
  };

  // Download / share the bill receipt (reuses the doctor BillsTab receipt builder).
  const downloadReceipt = async (bill) => {
    const doc = bill.doctorId || {};
    const final = bill.finalAmount || bill.amount;
    const invoice = {
      invoiceNumber: bill.invoiceNumber,
      date: fmtDate(bill.paidAt || bill.createdAt),
      time: '',
      patientName: bill.patientId?.fullName || 'You',
      patientPhone: bill.patientId?.mobileNumber || '',
      // Prefer the saved per-treatment line items (with prices) for a proper invoice.
      treatments: (Array.isArray(bill.treatments) && bill.treatments.length)
        ? bill.treatments.map((t) => ({ name: t.name || 'Treatment', price: t.price ? String(t.price) : '' }))
        : String(bill.treatmentName || 'Treatment').split(',').map((n) => ({ name: n.trim(), price: '' })),
      total: bill.amount,
      discount: bill.discountFromRewards || 0,
      paid: bill.paidAmount || 0,
      outstanding: Math.max(0, final - (bill.paidAmount || 0)),
      status: bill.status || 'unpaid',
    };
    const meta = {
      docName: doc.fullName || 'Doctor',
      clinic: doc.clinicName || 'Clinic',
      spec: doc.specialization || '',
    };
    try {
      if (isWeb) {
        const html = buildReceiptHtml(invoice, { ...meta, type: 'normal', autoPrint: true });
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
        return;
      }
      // Patients get the styled A4 invoice (not the thermal/text receipt).
      const Print = require('expo-print');
      const html = buildReceiptHtml(invoice, { ...meta, type: 'normal', autoPrint: false });
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoiceNumber}` });
    } catch {
      showDialog({ title: 'Error', message: 'Could not generate the receipt.' });
    }
  };

  // Search + status filter + infinite-scroll window.
  const q = search.trim().toLowerCase();
  const filteredBills = bills.filter((b) => {
    if (statusFilter !== 'all' && (b.status || 'unpaid') !== statusFilter) return false;
    if (!q) return true;
    const hay = `${b.invoiceNumber || ''} ${b.treatmentName || ''} ${b.doctorId?.fullName || ''}`.toLowerCase();
    return hay.includes(q);
  });
  const visibleBills = filteredBills.slice(0, visibleCount);
  const hasMore = visibleBills.length < filteredBills.length;

  const onScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200 && hasMore) {
      setVisibleCount((c) => c + PAGE_SIZE);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={isWeb ? ['top'] : []}>
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}
      <PatientHeader greeting="Bills & Payments" subtitle="Your treatment invoices and history" />

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, webContent]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <PromoCard />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0052FF" /></View>
        ) : (
          <>
            {summary && (
              <View style={styles.summaryRow}>
                <SummaryCard icon="receipt-outline" label="Total Bills" value={summary.totalBills} color="#0052FF" />
                <SummaryCard icon="wallet-outline" label="Outstanding" value={rs(summary.outstanding)} color="#D97706" />
                <SummaryCard icon="checkmark-circle-outline" label="Total Paid" value={rs(summary.totalPaid)} color="#16A34A" />
              </View>
            )}

            {bills.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No bills yet</Text>
                <Text style={styles.emptyText}>Bills from your treatments will appear here.</Text>
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Home')}>
                  <Text style={styles.viewAllBtnText}>Find Doctors</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Search */}
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search invoice, treatment or doctor..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status filter chips */}
                <View style={styles.filterRow}>
                  {STATUS_FILTERS.map((f) => {
                    const active = statusFilter === f.key;
                    return (
                      <TouchableOpacity key={f.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setStatusFilter(f.key)}>
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {filteredBills.length === 0 ? (
                  <Text style={styles.noMatch}>No bills match your search.</Text>
                ) : (
                  <>
                    <Text style={styles.countLabel}>
                      Showing {visibleBills.length} of {filteredBills.length}
                    </Text>
                    {visibleBills.map((b) => (
                      <BillCard
                        key={b._id}
                        bill={b}
                        onPress={openBill}
                        onPay={payNow}
                        onDownload={downloadReceipt}
                        paying={payingId === b._id}
                      />
                    ))}
                    {hasMore && (
                      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator color="#0052FF" />
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <PaymentSheet
        visible={!!paySheetBill}
        bill={paySheetBill}
        onClose={() => setPaySheetBill(null)}
        onConfirm={doPay}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0052FF' },
  blueHeader: { backgroundColor: '#0052FF', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1, backgroundColor: '#F4F6FA' },
  bodyContent: { paddingBottom: 32 },

  center: { paddingVertical: 60, alignItems: 'center' },

  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  sumCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, alignItems: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sumIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  sumValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sumLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },

  countLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 18, marginBottom: 10, marginHorizontal: 18 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginHorizontal: 16, marginTop: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 6 },
  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
  noMatch: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginVertical: 30 },

  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  treatment: { fontSize: 15.5, fontWeight: '800', color: '#0F172A' },
  docName: { fontSize: 12.5, color: '#64748B', marginTop: 3 },
  clinic: { fontSize: 11.5, color: '#94A3B8', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusTxt: { fontSize: 11, fontWeight: '800', marginLeft: 4 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 11 },

  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  invoiceNo: { fontSize: 12, color: '#475569', fontWeight: '700' },
  date: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },
  discount: { fontSize: 11, color: '#16A34A', fontWeight: '700', marginBottom: 2 },
  amount: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  pendingHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 12 },
  pendingHintText: { fontSize: 12, color: '#7C3AED', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
  previewBtnText: { color: '#0052FF', fontWeight: '800', fontSize: 14 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 11 },
  payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 14 },
  emptyText: { fontSize: 13.5, color: '#94A3B8', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  viewAllBtn: { marginTop: 18, backgroundColor: '#0052FF', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24 },
  viewAllBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
