import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Clipboard, Modal, TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../../../config/storage';
import API_BASE_URL from '../../../config/api';
import { openWhatsApp } from '../../../utils/support';

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

const EMPTY_PAYOUT = { bankName: '', accountTitle: '', accountNumber: '' };

export default function PlatformFeeTab({ profile, bills = [] }) {
  const totalRedeemedAmount = bills.reduce((sum, b) => sum + (b.discountFromRewards || 0), 0);
  const duePlatformFee = profile?.commissionDue || 0;
  const remainingPlatformFee = Math.max(0, duePlatformFee - totalRedeemedAmount);
  const commissionRate = 10;

  // Admin payment accounts
  const [platformPayments, setPlatformPayments] = useState({
    bankAccount: '', bankName: '', bankTitle: '',
    easypaisaNumber: '', easypaisaTitle: '',
    jazzcashNumber: '', jazzcashTitle: '',
  });

  // Doctor's own payout account
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [form, setForm] = useState(EMPTY_PAYOUT);
  const [payoutModal, setPayoutModal] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    const p = profile?.payoutAccount;
    if (p) setPayout({ bankName: p.bankName || '', accountTitle: p.accountTitle || '', accountNumber: p.accountNumber || '' });
  }, [profile]);

  const hasPayout = !!(payout.bankName || payout.accountNumber || payout.accountTitle);
  const openPayout = () => { setForm(payout); setPayoutModal(true); };

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/api/users/platform-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) setPlatformPayments(res.data.data.payments);
      } catch (_) {}
    })();
  }, []);

  const savePayout = async () => {
    if (!form.accountTitle.trim()) return Alert.alert('Required', 'Enter the account title.');
    if (!form.accountNumber.trim()) return Alert.alert('Required', 'Enter the account number / IBAN.');
    setSavingPayout(true);
    try {
      const token = await storage.getItem('userToken');
      const payoutAccount = {
        bankName: form.bankName.trim(),
        accountTitle: form.accountTitle.trim(),
        accountNumber: form.accountNumber.trim(),
      };
      const res = await axios.put(
        `${API_BASE_URL}/api/users/doctor-profile`,
        { payoutAccount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setPayout(payoutAccount);
        setPayoutModal(false);
        Alert.alert('Saved', 'Your payout account has been saved.');
      } else {
        Alert.alert('Error', res.data?.message || 'Could not save the account.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not save the account.');
    } finally { setSavingPayout(false); }
  };

  const handleClaim = () => {
    if (!hasPayout) {
      Alert.alert(
        'Account Required',
        'Please add your payout bank account first so we know where to send your payment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Account', onPress: openPayout },
        ]
      );
      return;
    }
    const doctorName = profile?.fullName || 'Doctor';
    openWhatsApp(
      `Hello, I'm Dr. ${doctorName}. I would like to claim my 90% payout for patient payments received through My Dentist.\n\nBank: ${payout.bankName || ''}\nAccount Title: ${payout.accountTitle || ''}\nAccount Number / IBAN: ${payout.accountNumber || ''}\n\nPlease process the payment. Thank you.`
    );
  };

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

      {/* Fee Breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Fee Breakdown</Text>
        <Row label="Patient Redeemed Amount" value={`- ${fmt(totalRedeemedAmount)}`} valueColor="#16A34A" />
        <Row label="Due Platform Fee" value={fmt(duePlatformFee)} valueColor="#D97706" />
        <View style={styles.divider} />
        <Row label="Remaining Platform Fee" value={fmt(remainingPlatformFee)} valueColor={remainingPlatformFee > 0 ? '#0052FF' : '#16A34A'} bold />
      </View>

      {/* ── Pay 10% Commission to My Dentist ── */}
      <View style={styles.commissionBox}>
        <View style={styles.commissionHeader}>
          <View style={styles.commissionIconWrap}>
            <Ionicons name="business" size={20} color="#0052FF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.commissionTitle}>Pay 10% Commission to My Dentist</Text>
            <Text style={styles.commissionDesc}>Send payment to any account below. Tap account number to copy.</Text>
          </View>
        </View>

        {/* Bank / IBAN */}
        {(platformPayments.bankAccount || platformPayments.bankName) ? (
          <View style={styles.acctRow}>
            <View style={[styles.acctIcon, { backgroundColor: '#EEF3FF' }]}>
              <Ionicons name="card-outline" size={20} color="#1A3FAA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.acctName}>{platformPayments.bankName || 'Bank'}</Text>
              {platformPayments.bankTitle ? <Text style={styles.acctHolder}>{platformPayments.bankTitle}</Text> : null}
              <Text style={styles.acctNumber}>{platformPayments.bankAccount}</Text>
            </View>
            <TouchableOpacity
              style={[styles.acctCopyBtn, { backgroundColor: '#EEF3FF' }]}
              onPress={() => { Clipboard.setString(platformPayments.bankAccount); Alert.alert('Copied', 'IBAN copied!'); }}
            >
              <Ionicons name="copy-outline" size={14} color="#1A3FAA" />
              <Text style={[styles.acctCopyTxt, { color: '#1A3FAA' }]}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(platformPayments.bankAccount || platformPayments.bankName) && platformPayments.easypaisaNumber
          ? <View style={styles.acctDivider} /> : null}

        {/* EasyPaisa */}
        {platformPayments.easypaisaNumber ? (
          <View style={styles.acctRow}>
            <View style={[styles.acctIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="phone-portrait-outline" size={20} color="#166534" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.acctName}>EasyPaisa</Text>
              {platformPayments.easypaisaTitle ? <Text style={styles.acctHolder}>{platformPayments.easypaisaTitle}</Text> : null}
              <Text style={styles.acctNumber}>{platformPayments.easypaisaNumber}</Text>
            </View>
            <TouchableOpacity
              style={[styles.acctCopyBtn, { backgroundColor: '#F0FDF4' }]}
              onPress={() => { Clipboard.setString(platformPayments.easypaisaNumber); Alert.alert('Copied', 'EasyPaisa number copied!'); }}
            >
              <Ionicons name="copy-outline" size={14} color="#166534" />
              <Text style={[styles.acctCopyTxt, { color: '#166534' }]}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* JazzCash */}
        {platformPayments.jazzcashNumber ? (
          <>
            {platformPayments.easypaisaNumber ? <View style={styles.acctDivider} /> : null}
            <View style={styles.acctRow}>
              <View style={[styles.acctIcon, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.acctName}>JazzCash</Text>
                {platformPayments.jazzcashTitle ? <Text style={styles.acctHolder}>{platformPayments.jazzcashTitle}</Text> : null}
                <Text style={styles.acctNumber}>{platformPayments.jazzcashNumber}</Text>
              </View>
              <TouchableOpacity
                style={[styles.acctCopyBtn, { backgroundColor: '#FFFBEB' }]}
                onPress={() => { Clipboard.setString(platformPayments.jazzcashNumber); Alert.alert('Copied', 'JazzCash number copied!'); }}
              >
                <Ionicons name="copy-outline" size={14} color="#92400E" />
                <Text style={[styles.acctCopyTxt, { color: '#92400E' }]}>Copy</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {!platformPayments.bankAccount && !platformPayments.easypaisaNumber && !platformPayments.jazzcashNumber && (
          <Text style={[styles.commissionDesc, { color: '#94A3B8', fontStyle: 'italic', marginTop: 8 }]}>
            Payment accounts not configured yet. Contact admin.
          </Text>
        )}
      </View>

      {/* ── My Dentist Payments to Doctor Account ── */}
      <View style={[styles.paymentBox, { marginTop: 16 }]}>
        <View style={styles.paymentBoxContent}>
          <View style={[styles.paymentIconWrap, { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }]}>
            <Ionicons name="business" size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1, paddingRight: isWide ? 20 : 0, marginBottom: isWide ? 0 : 12 }}>
            <Text style={styles.paymentTitle}>My Dentist Payments to Doctor Account</Text>
            <Text style={styles.paymentDesc}>
              Claim 90% of patient payments received through My Dentist Accounts
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.paymentIconWrap, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', marginRight: 0 }]}
            onPress={openPayout}
          >
            {hasPayout ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.paymentTitle, { fontSize: 11 }]} numberOfLines={1}>{payout.bankName || 'Bank'}</Text>
                {!!payout.accountTitle && <Text style={[styles.paymentDesc, { fontSize: 10 }]} numberOfLines={1}>{payout.accountTitle}</Text>}
                <Text style={[styles.paymentDesc, { fontSize: 10 }]} numberOfLines={1}>{payout.accountNumber}</Text>
                <View style={styles.payoutEditPill}>
                  <Ionicons name="create-outline" size={11} color="#0052FF" />
                  <Text style={styles.payoutEditText}>Edit</Text>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="add-circle" size={20} color="#16A34A" />
                <Text style={[styles.paymentDesc, { fontSize: 10, textAlign: 'center', marginTop: 2 }]}>Add Account</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Claim Button */}
        <TouchableOpacity style={styles.claimBtn} onPress={handleClaim} activeOpacity={0.85}>
          <Ionicons name="cash-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.claimBtnText}>Claim 90% Payout via WhatsApp</Text>
          <Ionicons name="logo-whatsapp" size={16} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
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

      {/* Payout Account Modal */}
      <Modal visible={payoutModal} transparent animationType="slide" onRequestClose={() => setPayoutModal(false)}>
        <View style={styles.payoutOverlay}>
          <View style={styles.payoutSheet}>
            <View style={styles.payoutHead}>
              <Text style={styles.payoutTitle}>{hasPayout ? 'Edit Payout Account' : 'Add Payout Account'}</Text>
              <TouchableOpacity onPress={() => setPayoutModal(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#0A1551" />
              </TouchableOpacity>
            </View>
            <Text style={styles.payoutNote}>
              Where My Dentist sends your 90% payout for payments patients made to the platform accounts.
            </Text>

            <Text style={styles.payoutLabel}>Bank Name</Text>
            <TextInput
              style={styles.payoutInput}
              placeholder="e.g. HBL, Meezan"
              placeholderTextColor="#94A3B8"
              value={form.bankName}
              onChangeText={(v) => setForm((p) => ({ ...p, bankName: v }))}
            />

            <Text style={styles.payoutLabel}>Account Title</Text>
            <TextInput
              style={styles.payoutInput}
              placeholder="Account holder name"
              placeholderTextColor="#94A3B8"
              value={form.accountTitle}
              onChangeText={(v) => setForm((p) => ({ ...p, accountTitle: v }))}
              autoCapitalize="words"
            />

            <Text style={styles.payoutLabel}>Account Number / IBAN</Text>
            <TextInput
              style={styles.payoutInput}
              placeholder="PK00XXXX0000000000000000"
              placeholderTextColor="#94A3B8"
              value={form.accountNumber}
              onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v }))}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.payoutSaveBtn, savingPayout && { opacity: 0.7 }]}
              disabled={savingPayout}
              onPress={savePayout}
            >
              {savingPayout
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.payoutSaveText}>Save Account</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#BFDBFE',
  },
  headerIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 17 },

  cardsRow: { flexDirection: 'column', gap: 14, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#F1F5F9',
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0A1551', marginBottom: 6 },
  statNote: { fontSize: 11, color: '#94A3B8', lineHeight: 15 },

  breakdownCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
  },
  breakdownTitle: { fontSize: 15, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowLabel: { fontSize: 13, color: '#475569', flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },

  // Commission / payment accounts
  commissionBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#BFDBFE', marginBottom: 0,
  },
  commissionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  commissionIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#0052FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  commissionTitle: { fontSize: 14, fontWeight: '800', color: '#0052FF', marginBottom: 2 },
  commissionDesc: { fontSize: 11, color: '#64748B', lineHeight: 15 },

  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  acctIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  acctName: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  acctHolder: { fontSize: 13, color: '#475569', fontWeight: '500', marginTop: 1 },
  acctNumber: { fontSize: 13, color: '#64748B', marginTop: 3 },
  acctCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  acctCopyTxt: { fontSize: 12, fontWeight: '700' },
  acctDivider: { height: 1, backgroundColor: '#F1F5F9' },

  // Payout / claim section
  paymentBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  paymentBoxContent: {
    flexDirection: isWide ? 'row' : 'row',
    alignItems: 'flex-start', gap: 12, marginBottom: 16,
  },
  paymentIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  paymentTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', marginBottom: 4 },
  paymentDesc: { fontSize: 11, color: '#64748B', lineHeight: 16 },
  payoutEditPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#EFF4FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  payoutEditText: { fontSize: 11, fontWeight: '700', color: '#0052FF' },

  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16A34A', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  claimBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // How it works
  infoCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, marginTop: 16,
  },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  infoLabel: { fontSize: 13, fontWeight: '700', color: '#0A1551', marginBottom: 3 },
  infoDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  exampleCard: {
    backgroundColor: '#FAF5FF', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  exampleTitle: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED' },
  exampleLine: { fontSize: 13, color: '#334155', marginBottom: 6 },
  exampleGreen: { color: '#16A34A', fontWeight: '700' },
  exampleAmber: { color: '#D97706', fontWeight: '700' },
  exampleBlue: { color: '#0052FF', fontWeight: '700' },

  // Payout modal
  payoutOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'flex-end' },
  payoutSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 36,
  },
  payoutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  payoutTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  payoutNote: { fontSize: 12.5, color: '#64748B', marginBottom: 12 },
  payoutLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 12 },
  payoutInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  payoutSaveBtn: {
    backgroundColor: '#0052FF', borderRadius: 14,
    paddingVertical: 15, marginTop: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  payoutSaveText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
