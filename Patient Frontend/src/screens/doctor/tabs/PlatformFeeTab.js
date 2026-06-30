import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

const fmt = (amount) => `Rs. ${Number(amount || 0).toLocaleString()}`;

function StatCard({ icon, iconBg, iconColor, label, value, valueColor, note }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

function Row({ label, value, valueColor, bold }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '700' }, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

export default function PlatformFeeTab({ profile, bills = [] }) {
  const totalRedeemedAmount = bills.reduce((sum, b) => sum + (b.discountFromRewards || 0), 0);
  const duePlatformFee = profile?.commissionDue || 0;
  const remainingPlatformFee = Math.max(0, duePlatformFee - totalRedeemedAmount);
  const commissionRate = 10;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="receipt-outline" size={24} color="#0052FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Platform Fee Summary</Text>
          <Text style={styles.headerSub}>
            Track your commission dues and patient reward redemptions
          </Text>
        </View>
      </View>

      {/* Stat Cards */}
      <View style={[styles.cardsRow, isWide && { flexDirection: 'row' }]}>
        <StatCard
          icon="gift-outline"
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Total Patient Redeemed Amount"
          value={fmt(totalRedeemedAmount)}
          valueColor="#16A34A"
          note="Reward discounts applied by patients through your clinic"
        />
        <StatCard
          icon="warning-outline"
          iconBg="#FEF3C7"
          iconColor="#D97706"
          label="Due Platform Fee"
          value={fmt(duePlatformFee)}
          valueColor={duePlatformFee > 0 ? '#D97706' : '#16A34A'}
          note={`${commissionRate}% commission owed to My Dentist platform`}
        />
        <StatCard
          icon="cash-outline"
          iconBg="#EFF6FF"
          iconColor="#0052FF"
          label="Remaining Platform Fee"
          value={fmt(remainingPlatformFee)}
          valueColor={remainingPlatformFee > 0 ? '#0052FF' : '#16A34A'}
          note="Due platform fee after deducting patient redemptions"
        />
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Fee Breakdown</Text>

        <Row
          label="Patient Redeemed Amount"
          value={`- ${fmt(totalRedeemedAmount)}`}
          valueColor="#16A34A"
        />
        <Row
          label="Due Platform Fee"
          value={fmt(duePlatformFee)}
          valueColor="#D97706"
        />
        <View style={styles.divider} />
        <Row
          label="Remaining Platform Fee"
          value={fmt(remainingPlatformFee)}
          valueColor={remainingPlatformFee > 0 ? '#0052FF' : '#16A34A'}
          bold
        />
      </View>

      {/* How it works */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>

        <View style={styles.infoRow}>
          <View style={[styles.infoIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="percent-outline" size={16} color="#0052FF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>{commissionRate}% Platform Commission</Text>
            <Text style={styles.infoDesc}>
              My Dentist charges a {commissionRate}% commission on your collected treatment amount.
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={[styles.infoIconWrap, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="gift-outline" size={16} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Patient Reward Redemptions</Text>
            <Text style={styles.infoDesc}>
              When patients use reward points for discounts at your clinic, those amounts offset your
              platform fee. 1 point = Rs. 1 discount.
            </Text>
          </View>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={[styles.infoIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="calculator-outline" size={16} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Remaining Fee Calculation</Text>
            <Text style={styles.infoDesc}>
              Remaining Platform Fee = Due Platform Fee − Patient Redeemed Amount
            </Text>
          </View>
        </View>
      </View>

      {/* Example */}
      <View style={styles.exampleCard}>
        <View style={styles.exampleHeader}>
          <Ionicons name="bulb-outline" size={16} color="#7C3AED" style={{ marginRight: 8 }} />
          <Text style={styles.exampleTitle}>Example</Text>
        </View>
        <Text style={styles.exampleLine}>Patient Redeemed Amount: <Text style={styles.exampleGreen}>Rs. 2,000</Text></Text>
        <Text style={styles.exampleLine}>Due Platform Fee: <Text style={styles.exampleAmber}>Rs. 2,500</Text></Text>
        <Text style={styles.exampleLine}>
          Remaining Platform Fee: <Text style={styles.exampleBlue}>Rs. 500</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 17 },

  cardsRow: { flexDirection: 'column', gap: 14, marginBottom: 24 },

  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0A1551', marginBottom: 6 },
  statNote: { fontSize: 11, color: '#94A3B8', lineHeight: 15 },

  breakdownCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  breakdownTitle: { fontSize: 15, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 13, color: '#475569', flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },

  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoLabel: { fontSize: 13, fontWeight: '700', color: '#0A1551', marginBottom: 3 },
  infoDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  exampleCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  exampleTitle: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED' },
  exampleLine: { fontSize: 13, color: '#334155', marginBottom: 6 },
  exampleGreen: { color: '#16A34A', fontWeight: '700' },
  exampleAmber: { color: '#D97706', fontWeight: '700' },
  exampleBlue: { color: '#0052FF', fontWeight: '700' },
});
