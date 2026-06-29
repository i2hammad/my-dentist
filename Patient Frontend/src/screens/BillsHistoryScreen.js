import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import PromoCard from '../components/PromoCard';
import PatientHeader from '../components/PatientHeader';
import webContent, { isWeb } from '../config/webLayout';

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const STATUS = {
  paid:   { color: '#16A34A', bg: '#DCFCE7', label: 'Paid', icon: 'checkmark-circle' },
  unpaid: { color: '#D97706', bg: '#FEF3C7', label: 'Unpaid', icon: 'time' },
  draft:  { color: '#6B7280', bg: '#F3F4F6', label: 'Draft', icon: 'document-outline' },
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

function BillCard({ bill, onPress }) {
  const doc = bill.doctorId || {};
  const s = STATUS[bill.status] || STATUS.unpaid;
  const final = bill.finalAmount || bill.amount;
  const hasDiscount = (bill.discountFromRewards || 0) > 0;
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
    </TouchableOpacity>
  );
}

export default function BillsHistoryScreen({ navigation }) {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={isWeb ? ['top'] : []}>
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}
      <PatientHeader greeting="Bills & Payments" subtitle="Your treatment invoices and history" />

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, webContent]}
        showsVerticalScrollIndicator={false}
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
                <SummaryCard icon="gift-outline" label="Saved" value={rs(summary.totalDiscount)} color="#16A34A" />
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
                <Text style={styles.countLabel}>{bills.length} bill{bills.length === 1 ? '' : 's'}</Text>
                {bills.map((b) => <BillCard key={b._id} bill={b} onPress={openBill} />)}
              </>
            )}
          </>
        )}
      </ScrollView>
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

  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 14 },
  emptyText: { fontSize: 13.5, color: '#94A3B8', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  viewAllBtn: { marginTop: 18, backgroundColor: '#0052FF', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24 },
  viewAllBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
