import React, { useCallback, useState } from 'react';
import { useRequireLogin } from "../utils/authGuard";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import webContent, { isWeb } from '../config/webLayout';
import PromoCard from '../components/PromoCard';
import PatientHeader from '../components/PatientHeader';

const earnRules = [
  { icon: 'checkmark-circle', tint: '#DCFCE7', border: '#BBF7D0', color: '#16A34A', title: 'Visit Completed', sub: 'On every online payment', pts: '+2%' },
  { icon: 'person-add', tint: '#EDE9FE', border: '#DDD6FE', color: '#7C3AED', title: 'Refer a Friend', sub: 'When friend completes first visit', pts: '+100 pts' },
  { icon: 'star', tint: '#FEF3C7', border: '#FDE68A', color: '#D97706', title: 'Write a Review', sub: 'After submitting a verified review', pts: '+50 pts' },
];

export default function PatientRewardsScreen() {
  useRequireLogin();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState({ totalPoints: 0, equivalentPKR: 0, recentHistory: [] });
  const [showHistory, setShowHistory] = useState(false);
  const [redeemCode, setRedeemCode] = useState(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const points = rewards.totalPoints || rewards.points || 0;
  const discountPKR = rewards.equivalentPKR ?? points;
  const history = rewards.recentHistory || rewards.transactions || [];

  const fetchRewards = useCallback(async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setLoading(false); return; }
      const res = await axios.get(`${API_BASE_URL}/api/rewards/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setRewards(res.data.data || { totalPoints: 0, equivalentPKR: 0, recentHistory: [] });
      }
    } catch {
      // Empty state remains useful if reward fetch fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isWeb) setStatusBarStyle('light');
    fetchRewards();
  }, [fetchRewards]));

  const doRedeem = async () => {
    if (points <= 0) return Alert.alert('No Points', 'You have no reward points to redeem.');
    setRedeemLoading(true);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.post(
        `${API_BASE_URL}/api/rewards/redeem`,
        { points },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setRedeemCode(res.data.data?.code);
        fetchRewards();
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not generate code. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleRedeem = () => {
    if (points <= 0) return Alert.alert('No Points', 'You have no reward points to redeem.');
    const msg = `You are about to redeem ${points} pts for a PKR ${discountPKR} discount code.\n\nOnce generated, write it down or take a screenshot right away. If you close the app before giving the code to your doctor, the code will be lost and your points will be reset to zero.`;
    if (isWeb && typeof window !== 'undefined') {
      if (window.confirm(msg)) doRedeem();
      return;
    }
    Alert.alert(
      'Generate Redemption Code?',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate Code', onPress: doRedeem },
      ],
      { cancelable: true }
    );
  };

  const shareCode = () => {
    if (!redeemCode) return;
    Share.share({ message: 'My Dentist Discount Code: ' + redeemCode });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={isWeb ? ['top'] : []}>
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}
      <PatientHeader greeting="Rewards" subtitle="Your points, discounts and reward history" />

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
            <View style={styles.heroCard}>
              <View style={styles.orbTop} />
              <View style={styles.orbBottom} />
              <View style={styles.heroTop}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={styles.eyebrowRow}>
                    <View style={styles.eyebrowDot} />
                    <Text style={styles.eyebrow}>AVAILABLE REWARD POINTS</Text>
                  </View>
                  <Text style={styles.pointsText} numberOfLines={1} adjustsFontSizeToFit>{points}</Text>
                  <View style={styles.valuePill}>
                    <Ionicons name="cash-outline" size={13} color="#16A34A" style={{ marginRight: 5 }} />
                    <Text style={styles.valuePillText}>= PKR {discountPKR} Discount Value</Text>
                  </View>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons name="gift" size={26} color="#0052FF" />
                </View>
              </View>

              <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory(v => !v)} activeOpacity={0.85}>
                <Ionicons name={showHistory ? 'chevron-up' : 'time-outline'} size={16} color="#0052FF" style={{ marginRight: 7 }} />
                <Text style={styles.historyToggleText}>{showHistory ? 'Hide Rewards History' : 'View Rewards History'}</Text>
              </TouchableOpacity>

              {showHistory && (
                <View style={styles.historyBox}>
                  {history.length === 0 ? (
                    <View style={styles.emptyHistory}>
                      <View style={styles.emptyIcon}>
                        <Ionicons name="sparkles-outline" size={20} color="#0052FF" />
                      </View>
                      <Text style={styles.emptyTitle}>No reward activity yet.</Text>
                      <Text style={styles.emptyText}>Earn points on visits, referrals and reviews.</Text>
                    </View>
                  ) : (
                    history.map((h, i) => {
                      const pts = h.points || 0;
                      const positive = pts >= 0;
                      return (
                        <View key={h._id || i} style={[styles.historyRow, i === history.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={[styles.historyIcon, { backgroundColor: positive ? '#DCFCE7' : '#FEE2E2' }]}>
                            <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={15} color={positive ? '#16A34A' : '#DC2626'} />
                          </View>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.historyTitle} numberOfLines={1}>{h.description || h.type || 'Reward'}</Text>
                            <Text style={styles.historyDate}>{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</Text>
                          </View>
                          <Text style={[styles.historyPoints, { color: positive ? '#16A34A' : '#DC2626' }]}>
                            {positive ? '+' : ''}{pts} pts
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            <SectionTitle color="#0052FF" title="HOW YOU EARN POINTS" />
            <View style={styles.rulesCard}>
              {earnRules.map((r, i) => (
                <View key={r.title} style={[styles.ruleRow, i === earnRules.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.ruleIcon, { backgroundColor: r.tint, borderColor: r.border }]}>
                    <Ionicons name={r.icon} size={21} color={r.color} />
                  </View>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ruleTitle}>{r.title}</Text>
                    <Text style={styles.ruleSub}>{r.sub}</Text>
                  </View>
                  <View style={[styles.rulePill, { backgroundColor: r.color }]}>
                    <Text style={styles.rulePillText}>{r.pts}</Text>
                  </View>
                </View>
              ))}
            </View>

            <SectionTitle color="#16A34A" title="REDEEM POINTS" />
            <View style={styles.redeemCard}>
              <View style={styles.redeemHeader}>
                <View style={styles.redeemIcon}>
                  <Ionicons name="pricetag" size={22} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.redeemTitle}>Redeem Points</Text>
                  <Text style={styles.redeemSub}>Redeem all {points} pts = PKR {discountPKR} discount</Text>
                </View>
              </View>

              {redeemCode ? (
                <View style={styles.codeBox}>
                  <View style={styles.codeLabelRow}>
                    <Ionicons name="checkmark-circle" size={15} color="#16A34A" style={{ marginRight: 5 }} />
                    <Text style={styles.codeLabel}>YOUR DISCOUNT CODE</Text>
                  </View>
                  <View style={styles.codeInner}>
                    <Text style={styles.codeText}>{redeemCode}</Text>
                  </View>
                  <TouchableOpacity style={styles.shareBtn} onPress={shareCode} activeOpacity={0.85}>
                    <Ionicons name="share-social-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                    <Text style={styles.shareBtnText}>Share Code</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.generateBtn, redeemLoading && { opacity: 0.85 }]}
                  onPress={handleRedeem}
                  disabled={redeemLoading}
                  activeOpacity={0.85}
                >
                  {redeemLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="pricetags-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.generateBtnText}>Tap to Generate Code</Text>
                      <Ionicons name="chevron-forward" size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={14} color="#94A3B8" style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.infoText}>Share this code with the doctor. They can apply it to deduct the amount from your bill.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ color, title }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionTitleDash, { backgroundColor: color }]} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0052FF' },
  body: { flex: 1, backgroundColor: '#F4F6FA' },
  bodyContent: { paddingTop: 16, paddingBottom: 32 },
  center: { paddingVertical: 60, alignItems: 'center' },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EEF9',
    overflow: 'hidden',
    shadowColor: '#0A1551',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  orbTop: { position: 'absolute', top: -50, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F1F6FF' },
  orbBottom: { position: 'absolute', bottom: -60, left: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: '#FBF9FF' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0052FF', marginRight: 8 },
  eyebrow: { fontSize: 10.5, fontWeight: '800', color: '#64748B', letterSpacing: 1.4 },
  pointsText: { fontSize: 44, fontWeight: '900', color: '#0A1551', letterSpacing: -1, lineHeight: 48 },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  valuePillText: { fontSize: 12.5, fontWeight: '700', color: '#16A34A' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  historyToggle: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 14, paddingVertical: 12 },
  historyToggleText: { color: '#0052FF', fontWeight: '700', fontSize: 13.5 },
  historyBox: { marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7', padding: 6 },
  emptyHistory: { alignItems: 'center', paddingVertical: 22 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  emptyText: { fontSize: 12, color: '#94A3B8' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  historyDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  historyPoints: { fontSize: 14, fontWeight: '800' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12, marginHorizontal: 16 },
  sectionTitleDash: { width: 16, height: 3, borderRadius: 2, marginRight: 9 },
  sectionTitleText: { fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 },
  rulesCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ruleIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  ruleTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  ruleSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rulePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  rulePillText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },
  redeemCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  redeemHeader: { flexDirection: 'row', alignItems: 'center' },
  redeemIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  redeemTitle: { fontSize: 15, fontWeight: '800', color: '#0A1551' },
  redeemSub: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  generateBtn: { marginTop: 14, backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#0052FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 },
  generateBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  codeBox: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' },
  codeLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  codeLabel: { fontSize: 10.5, color: '#16A34A', fontWeight: '800', letterSpacing: 1.2 },
  codeInner: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', borderStyle: 'dashed', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8 },
  codeText: { fontSize: 26, fontWeight: '900', color: '#0A1551', letterSpacing: 6, textAlign: 'center' },
  shareBtn: { marginTop: 4, backgroundColor: '#16A34A', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  shareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 },
  infoText: { flex: 1, fontSize: 11.5, color: '#94A3B8', lineHeight: 16 },
});
