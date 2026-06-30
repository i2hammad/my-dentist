import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Points earned per paid bill (matching the earn rules shown in RewardsTab)
const PTS_PER_BILL = 50;

function groupBillsByMonth(bills) {
  const map = {};
  bills.forEach((b) => {
    if (b.status !== 'paid') return;
    const d = new Date(b.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) {
      map[key] = { year: d.getFullYear(), month: d.getMonth(), bills: [] };
    }
    map[key].bills.push(b);
  });
  // Sort newest first
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, val]) => ({ key, ...val, points: val.bills.length * PTS_PER_BILL }));
}

export default function PointsHistoryScreen({ navigation, route }) {
  const totalPoints = route?.params?.totalPoints || 0;

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/api/bills/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) setBills(res.data.data);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const monthGroups = groupBillsByMonth(bills);
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthGroup = monthGroups.find((g) => g.key === thisMonthKey);
  const thisMonthPts = thisMonthGroup?.points || 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#0052FF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Points History</Text>
          <Text style={styles.headerSub}>Monthly breakdown of earned points</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Total Points Card */}
          <View style={styles.totalCard}>
            <View style={styles.totalLeft}>
              <View style={styles.coinWrap}>
                <Ionicons name="star" size={22} color="#D97706" />
              </View>
              <View>
                <Text style={styles.totalLabel}>Total Points Earned</Text>
                <Text style={styles.totalValue}>{totalPoints.toLocaleString()} pts</Text>
              </View>
            </View>
            <View style={styles.totalRight}>
              <Text style={styles.totalRightLabel}>This Month</Text>
              <Text style={styles.totalRightValue}>+{thisMonthPts.toLocaleString()} pts</Text>
            </View>
          </View>

          {/* This Month Highlight */}
          <View style={styles.thisMonthCard}>
            <Ionicons name="calendar" size={18} color="#0052FF" style={{ marginRight: 10 }} />
            <Text style={styles.thisMonthText}>
              This month you earned{' '}
              <Text style={styles.thisMonthPts}>{thisMonthPts.toLocaleString()} points</Text>
              {thisMonthGroup
                ? ` from ${thisMonthGroup.bills.length} completed visit${thisMonthGroup.bills.length !== 1 ? 's' : ''}.`
                : ' — no paid visits yet this month.'}
            </Text>
          </View>

          {/* How points are earned */}
          <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>How Points Are Counted</Text>
            <View style={styles.ruleRow}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.ruleText}>Each paid patient visit = <Text style={styles.rulePts}>+{PTS_PER_BILL} pts</Text></Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
              <Text style={styles.ruleText}>Review & referral points are included in your total but shown separately by the backend.</Text>
            </View>
          </View>

          {/* Monthly List */}
          <Text style={styles.sectionTitle}>Monthly Breakdown</Text>

          {monthGroups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={36} color="#CBD5E1" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No paid visits recorded yet.</Text>
              <Text style={styles.emptySub}>Points will appear here once patients complete and pay for their visits.</Text>
            </View>
          ) : (
            monthGroups.map((g) => {
              const isThisMonth = g.key === thisMonthKey;
              return (
                <View key={g.key} style={[styles.monthCard, isThisMonth && styles.monthCardActive]}>
                  {/* Month label */}
                  <View style={styles.monthTop}>
                    <View style={styles.monthLabelRow}>
                      {isThisMonth && (
                        <View style={styles.nowBadge}>
                          <Text style={styles.nowBadgeText}>Current</Text>
                        </View>
                      )}
                      <Text style={[styles.monthName, isThisMonth && { color: '#0052FF' }]}>
                        {MONTH_NAMES[g.month]} {g.year}
                      </Text>
                    </View>
                    <View style={styles.ptsWrap}>
                      <Ionicons name="star" size={13} color="#D97706" style={{ marginRight: 4 }} />
                      <Text style={styles.monthPts}>+{g.points.toLocaleString()} pts</Text>
                    </View>
                  </View>

                  {/* Stats row */}
                  <View style={styles.monthStats}>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatVal}>{g.bills.length}</Text>
                      <Text style={styles.monthStatLabel}>Paid Visits</Text>
                    </View>
                    <View style={styles.monthStatDiv} />
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatVal}>{PTS_PER_BILL} pts</Text>
                      <Text style={styles.monthStatLabel}>Per Visit</Text>
                    </View>
                    <View style={styles.monthStatDiv} />
                    <View style={styles.monthStat}>
                      <Text style={[styles.monthStatVal, { color: '#16A34A' }]}>
                        Rs. {g.bills.reduce((s, b) => s + (b.finalAmount || b.amount || 0), 0).toLocaleString()}
                      </Text>
                      <Text style={styles.monthStatLabel}>Total Collected</Text>
                    </View>
                  </View>

                  {/* Individual bills */}
                  {g.bills.map((b, i) => {
                    const d = new Date(b.createdAt);
                    const dateStr = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
                    return (
                      <View key={b._id || i} style={[styles.billRow, i === 0 && styles.billRowFirst]}>
                        <View style={styles.billIconWrap}>
                          <Ionicons name="medical-outline" size={14} color="#0052FF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.billPatient} numberOfLines={1}>
                            {b.patientId?.fullName || 'Patient'}
                          </Text>
                          <Text style={styles.billDate}>{dateStr} · {b.treatmentName || 'Treatment'}</Text>
                        </View>
                        <View style={styles.billRight}>
                          <Text style={styles.billPts}>+{PTS_PER_BILL} pts</Text>
                          <Text style={styles.billAmt}>Rs. {(b.finalAmount || b.amount || 0).toLocaleString()}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },

  scroll: { padding: 16 },

  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#020617', borderRadius: 16, padding: 20, marginBottom: 14,
  },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FDE047',
  },
  totalLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  totalRight: { alignItems: 'flex-end' },
  totalRightLabel: { fontSize: 11, color: '#64748B', marginBottom: 4 },
  totalRightValue: { fontSize: 16, fontWeight: '700', color: '#FDE047' },

  thisMonthCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 14,
  },
  thisMonthText: { flex: 1, fontSize: 14, color: '#1E3A8A', lineHeight: 20 },
  thisMonthPts: { fontWeight: '800', color: '#0052FF' },

  ruleCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20,
  },
  ruleTitle: { fontSize: 13, fontWeight: '700', color: '#0A1551', marginBottom: 10 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  ruleText: { fontSize: 12, color: '#475569', flex: 1, lineHeight: 18 },
  rulePts: { fontWeight: '700', color: '#16A34A' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0A1551', marginBottom: 12 },

  emptyCard: {
    alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 16, padding: 32, borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 6 },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  monthCard: {
    backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
    marginBottom: 14, overflow: 'hidden',
  },
  monthCardActive: { borderColor: '#BFDBFE', backgroundColor: '#FAFCFF' },

  monthTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingBottom: 12,
  },
  monthLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowBadge: {
    backgroundColor: '#0052FF', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  nowBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  monthName: { fontSize: 15, fontWeight: '700', color: '#0A1551' },
  ptsWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  monthPts: { fontSize: 14, fontWeight: '800', color: '#D97706' },

  monthStats: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  monthStat: { flex: 1, alignItems: 'center' },
  monthStatVal: { fontSize: 15, fontWeight: '700', color: '#0A1551', marginBottom: 2 },
  monthStatLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  monthStatDiv: { width: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 },

  billRowFirst: { borderTopWidth: 0 },
  billRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F8FAFC',
  },
  billIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  billPatient: { fontSize: 13, fontWeight: '600', color: '#0A1551' },
  billDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  billRight: { alignItems: 'flex-end' },
  billPts: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  billAmt: { fontSize: 11, color: '#64748B', marginTop: 2 },
});
