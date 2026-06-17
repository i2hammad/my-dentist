import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, Alert, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import { openWhatsApp } from '../../../utils/support';

const { width } = Dimensions.get('window');
const isWide = width >= 768;


export default function RewardsTab({ profile, bills = [], setActiveTab }) {
  const [earnings, setEarnings] = useState({
    totalPoints: 0,
    totalEarnings: '0',
    thisMonth: '0',
    totalPatients: 0,
    totalPayments: '0',
    debitPayments: '0',
    creditPayments: '0'
  });

  useEffect(() => {
    calculateEarnings();
  }, [bills]);

  const calculateEarnings = () => {
    try {
      const totalAmount = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
      // Points are the doctor's real accumulated reward points (earned from
      // completed visits & reviews), not a guess from bill totals.
      const calcPoints = profile?.rewardPoints || 0;

      // This month logic
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthBills = bills.filter(b => {
        const d = new Date(b.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const monthAmount = monthBills.reduce((sum, b) => sum + (b.amount || 0), 0);

      // Debit/Credit split based on paymentMethod
      const debitVal = bills.filter(b => b.paymentMethod && b.paymentMethod !== 'cash').reduce((sum, b) => sum + (b.amount || 0), 0);
      const creditVal = bills.filter(b => !b.paymentMethod || b.paymentMethod === 'cash').reduce((sum, b) => sum + (b.amount || 0), 0);

      // Unique patients count from bills
      const uniquePatients = new Set(bills.map(b => b.patientId?._id || b.patientId).filter(Boolean)).size;

      setEarnings({
        totalPoints: calcPoints,
        totalEarnings: totalAmount.toLocaleString(),
        thisMonth: monthAmount.toLocaleString(),
        totalPatients: uniquePatients,
        totalPayments: totalAmount.toLocaleString(),
        debitPayments: debitVal.toLocaleString(),
        creditPayments: creditVal.toLocaleString()
      });
    } catch (error) {
      console.log('Error calculating earnings:', error);
    }
  };

  const doctorName = profile?.fullName || '';
  const points = profile?.rewardPoints || 0;
  const isPopular = profile?.isPopular;

  // Pay PKR 100,000 → admin manually grants the blue paid badge.
  const handlePaidPopular = () => {
    if (isPopular && profile?.popularType === 'paid') {
      Alert.alert('Already Popular', 'You already have the paid (blue) popular badge.');
      return;
    }
    Alert.alert(
      'Get Popular (Paid)',
      'Become a Popular Doctor for top visibility in patient search by paying PKR 100,000. Our team will verify your payment and activate your blue Popular badge.\n\nContact support to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact Support', onPress: () => openWhatsApp(`Hello, I'm Dr. ${doctorName}. I want the PAID Popular Doctor badge (PKR 100,000). Please guide me on payment.`) },
      ]
    );
  };

  // Earn 20,000 points → green badge is granted automatically by the backend.
  const handleRedeemPopular = () => {
    if (isPopular && profile?.popularType === 'earned') {
      Alert.alert('You are Popular!', 'You have reached 20,000 points — your green Popular badge is active and you rank at the top of search.');
      return;
    }
    const remaining = Math.max(0, 20000 - points);
    Alert.alert(
      'Earn the Popular Badge',
      `Reach 20,000 points to automatically unlock the green Popular badge and rank at the top of patient search.\n\nYour points: ${points.toLocaleString()}\nRemaining: ${remaining.toLocaleString()}\n\nEarn points from completed appointments and patient reviews.`,
      [{ text: 'Got it' }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.welcomeTitle}>Welcome, Dr. {doctorName}</Text>
        <Text style={styles.welcomeSubtitle}>Manage rewards, track earnings and view payments</Text>
      </View>

      {/* Promotional Banners */}
      <View style={styles.promosRow}>
        <TouchableOpacity style={styles.promoCard} activeOpacity={0.85} onPress={handlePaidPopular}>
          <View style={styles.promoTagBlue}><Ionicons name="star" size={10} color="#FFF" /><Text style={styles.promoTagText}>POPULAR</Text></View>
          <Image source={{uri: `https://ui-avatars.com/api/?name=${doctorName.replace(' ', '+')}&background=EFF6FF&color=0052FF&size=100`}} style={styles.promoAvatar} />
          <View style={{flex: 1, paddingLeft: 10}}>
            <Text style={styles.promoText}>Get popular doctor banner{'\n'}by paying PKR 100,000</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#0A1551" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.promoCard} activeOpacity={0.85} onPress={handleRedeemPopular}>
          <View style={styles.promoTagGreen}><Ionicons name="star" size={10} color="#FFF" /><Text style={styles.promoTagText}>POPULAR</Text></View>
          <Image source={{uri: `https://ui-avatars.com/api/?name=${doctorName.replace(' ', '+')}&background=F0FDF4&color=16A34A&size=100`}} style={styles.promoAvatar} />
          <View style={{flex: 1, paddingLeft: 10}}>
            <Text style={styles.promoText}>Get popular doctor banner{'\n'}by earning 20,000 points</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#0A1551" />
        </TouchableOpacity>
      </View>

      {/* Points Layout */}
      <View style={styles.pointsLayout}>
        {/* Left deep blue card */}
        <View style={styles.bluePointsCard}>
          <View style={styles.blueHeaderRow}>
            <Text style={styles.blueCardTitle}>Total Reward Points Earned</Text>
            <Ionicons name="information-circle-outline" size={16} color="#FFF" />
          </View>
          
          <View style={styles.pointsNumberRow}>
            <Text style={styles.pointsHugeText}>{earnings.totalPoints.toLocaleString()}</Text>
            <View style={styles.coinIcon}><Ionicons name="star" size={16} color="#D97706" /></View>
          </View>

          <Text style={styles.blueCardDesc}>
            With Paying only <Text style={{color: '#FDE047', fontWeight: 'bold'}}>10% commission</Text>{'\n'}
            <Text style={{color: '#FDE047', fontWeight: 'bold'}}>get more and more patients.</Text>
          </Text>

          <TouchableOpacity 
            style={styles.historyBtn} 
            onPress={() => Alert.alert('Points History', `You have earned a total of ${earnings.totalPoints} points from patient visits, online payments, and reviews.`)}
          >
            <Ionicons name="gift-outline" size={16} color="#0052FF" style={{marginRight: 8}} />
            <Text style={styles.historyBtnText}>View Points History</Text>
            <Ionicons name="chevron-forward" size={14} color="#0052FF" style={{marginLeft: 4}} />
          </TouchableOpacity>

          {/* Abstract Trophy Graphic */}
          <Ionicons name="trophy" size={100} color="#FDE047" style={styles.trophyGraphic} />
        </View>

        {/* Right How to earn points card */}
        <View style={styles.earnPointsCard}>
          <Text style={styles.earnCardTitle}>How You Earn Points</Text>
          
          <View style={styles.earnRow}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#DCFCE7'}]}><Ionicons name="person" size={16} color="#16A34A" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Patient Visit Completed</Text>
              <Text style={styles.earnRuleDesc}>Per visit completed</Text>
            </View>
            <Text style={styles.earnPointsText}>+10 pts</Text>
          </View>
          
          <View style={styles.earnRow}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#EFF6FF'}]}><Ionicons name="card" size={16} color="#0052FF" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Debit Payment Received</Text>
              <Text style={styles.earnRuleDesc}>When patient pays online to{'\n'}My Dentist Accounts</Text>
            </View>
            <Text style={styles.earnPointsText}>+20 pts</Text>
          </View>

          <View style={styles.earnRow}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#EFF6FF'}]}><Ionicons name="card-outline" size={16} color="#0052FF" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Credit Payment Received</Text>
              <Text style={styles.earnRuleDesc}>When patient pays online to{'\n'}My Dentist Accounts</Text>
            </View>
            <Text style={styles.earnPointsText}>+20 pts</Text>
          </View>

          <View style={[styles.earnRow, {borderBottomWidth: 0, paddingBottom: 0}]}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#FFFBEB'}]}><Ionicons name="star-outline" size={16} color="#D97706" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Patient Review Received</Text>
              <Text style={styles.earnRuleDesc}>When patient submits review</Text>
            </View>
            <Text style={styles.earnPointsText}>+15 pts</Text>
          </View>
        </View>
      </View>

        {/* Redeem Points Card */}
        <View style={[styles.redeemCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
            <View style={styles.redeemIcon}><Text style={{color: '#FFF', fontWeight: '900'}}>%</Text></View>
            <View style={{flex: 1, paddingHorizontal: 12}}>
              <Text style={styles.redeemTitle}>Redeem Points</Text>
              <Text style={styles.redeemSub}>Convert your points into rewards for your services</Text>
              
              <View style={styles.redeemInfoRow}>
                <Ionicons name="information-circle-outline" size={14} color="#64748B" />
                <Text style={styles.redeemInfoText}>You can use these points to get Popular Doctor Banner{'\n'}for top visibility in patient search.</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => Alert.alert('Coming Soon', 'Reward code generation will be available in a future update.')}
          >
            <Text style={styles.generateBtnTextMain}>Tap to Generate Code</Text>
            <Text style={styles.generateBtnTextSub}>Get a code to redeem points</Text>
          </TouchableOpacity>
        </View>

      {/* Earnings Overview */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Earnings Overview</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconBg, {backgroundColor: '#DCFCE7'}]}><Ionicons name="wallet-outline" size={16} color="#16A34A" /></View>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <Text style={styles.statValue}>PKR {earnings.totalEarnings}</Text>
          <Text style={styles.statFooter}>All time</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconBg, {backgroundColor: '#EFF6FF'}]}><Ionicons name="calendar-outline" size={16} color="#0052FF" /></View>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <Text style={styles.statValue}>PKR {earnings.thisMonth}</Text>
          <Text style={styles.statFooter}>{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconBg, {backgroundColor: '#F3E8FF'}]}><Ionicons name="people-outline" size={16} color="#9333EA" /></View>
            <Text style={styles.statLabel}>Total Patients</Text>
          </View>
          <Text style={styles.statValue}>{earnings.totalPatients}</Text>
          <Text style={styles.statFooter}>All time</Text>
        </View>

        <View style={styles.statCardWide}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconBg, {backgroundColor: '#FFFBEB'}]}><Ionicons name="card-outline" size={16} color="#D97706" /></View>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>
          <Text style={styles.statValue}>PKR {earnings.totalPayments}</Text>
          <View style={styles.paymentSplitRow}>
            <Text style={styles.paymentSplitLabel}>Debit Payments</Text>
            <Text style={styles.paymentSplitVal}>PKR {earnings.debitPayments}</Text>
          </View>
          <View style={styles.paymentSplitRow}>
            <Text style={styles.paymentSplitLabel}>Credit Payments</Text>
            <Text style={styles.paymentSplitVal}>PKR {earnings.creditPayments}</Text>
          </View>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => setActiveTab && setActiveTab('bills')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal={!isWide} showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>
        <View style={styles.transactionsList}>
          {bills.length > 0 ? (
            bills.slice(0, 4).map((tx, idx) => {
              const txDate = new Date(tx.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
              const txTime = new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const pts = Math.floor((tx.amount || 0) * 0.1);
              return (
                <View key={tx._id || idx} style={styles.txRow}>
                  <View style={[styles.txIconWrap, {borderColor: '#0052FF'}]}><Ionicons name="medical-outline" size={16} color="#0052FF" /></View>
                  <View style={{flex: 1, paddingHorizontal: 12, minWidth: 120}}>
                    <Text style={styles.txName}>{tx.patientId?.fullName || 'Patient'}</Text>
                    <Text style={styles.txTreatment}>{tx.treatmentName || 'Treatment'}</Text>
                  </View>
                  <View style={{flex: 1, minWidth: 100}}>
                    <Text style={styles.txDate}>{txDate}</Text>
                    <Text style={styles.txTime}>{txTime}</Text>
                  </View>
                  <Text style={styles.txAmount}>PKR {tx.amount?.toLocaleString()}</Text>
                  <Text style={styles.txPoints}>+{pts} pts</Text>
                  <View style={[styles.txBadge, { backgroundColor: tx.status === 'paid' ? '#DCFCE7' : '#FEE2E2' }]}><Text style={[styles.txBadgeText, { color: tx.status === 'paid' ? '#16A34A' : '#EF4444' }]}>{tx.status === 'paid' ? 'Paid' : 'Unpaid'}</Text></View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
              );
            })
          ) : (
            <Text style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>No transactions recorded yet.</Text>
          )}
        </View>
      </ScrollView>

      {/* Payment Accounts */}
      <View style={styles.paymentBox}>
        <View style={styles.paymentBoxContent}>
          <View style={[styles.paymentIconWrap, {backgroundColor: '#EFF6FF', borderColor: '#0052FF'}]}>
            <Ionicons name="business" size={20} color="#0052FF" />
          </View>
          <View style={{flex: 1.5, paddingRight: isWide ? 20 : 0, marginBottom: isWide ? 0 : 12}}>
            <Text style={[styles.paymentTitle, {color: '#0052FF'}]}>Doctor payments to My Dentist account</Text>
            <Text style={[styles.paymentDesc, {color: '#0052FF'}]}>Online or cash payments you receive from patient pay 10% commission to my dentist</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={[styles.paymentTitle, {color: '#0052FF'}]}>Account Number (Auto)</Text>
            <TouchableOpacity 
              style={{flexDirection: 'row', alignItems: 'center'}}
              onPress={() => {
                const acct = profile?.accountNumber;
                if (acct) {
                  Clipboard.setString(acct);
                  Alert.alert('Copied', 'Account number copied to clipboard!');
                } else {
                  Alert.alert('Not Set', 'Your account number has not been configured yet.');
                }
              }}
            >
              <Text style={[styles.paymentDesc, {color: '#0052FF', fontWeight: 'bold'}]}>{profile?.accountNumber || 'Not configured'}</Text>
              <Ionicons name="copy-outline" size={14} color="#0052FF" style={{marginLeft: 8}} />
            </TouchableOpacity>
          </View>
        </View>
        {isWide && <Ionicons name="chevron-forward" size={20} color="#0052FF" />}
      </View>

      <View style={[styles.paymentBox, {backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', marginTop: 16}]}>
        <View style={styles.paymentBoxContent}>
          <View style={[styles.paymentIconWrap, {backgroundColor: '#DCFCE7', borderColor: '#16A34A'}]}>
            <Ionicons name="business" size={20} color="#16A34A" />
          </View>
          <View style={{flex: 1.5, paddingRight: isWide ? 20 : 0, marginBottom: isWide ? 0 : 12}}>
            <Text style={styles.paymentTitle}>My dentist Payments to doctor account</Text>
            <Text style={styles.paymentDesc}>Claim 90% amount of that Payments which patients paid to My Dentist Accounts</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.paymentTitle}>Add Account Number</Text>
            <Text style={styles.paymentDesc}>Add your bank account to receive payments</Text>
          </View>
        </View>
        {isWide && <Ionicons name="chevron-forward" size={20} color="#0A1551" />}
      </View>

      {/* Deep Blue Footer Banner */}
      <View style={styles.footerBanner}>
        <View style={styles.footerBannerContent}>
          <View style={styles.footerIconWrap}>
            <Ionicons name="people" size={24} color="#0052FF" />
          </View>
          <View style={{flex: 1, paddingHorizontal: isWide ? 16 : 0, marginVertical: isWide ? 0 : 12}}>
            <Text style={styles.footerBannerTitle}>Grow your clinic with paying only 10%{'\n'}commission on a whole treatment amount</Text>
            <Text style={styles.footerBannerDesc}>Encourage visits, online payments and reviews.</Text>
          </View>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => Alert.alert('Coming Soon', 'Earnings insights will be available in a future update.')}
          >
            <Text style={styles.footerBtnText}>View Insights</Text>
          </TouchableOpacity>
        </View>
        
        {/* Abstract Gifts Graphic */}
        <View style={styles.giftsGraphic}>
          <Ionicons name="gift" size={50} color="#D97706" />
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  headerArea: { marginBottom: 20 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: '#0A1551' },
  welcomeSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },

  promosRow: { flexDirection: isWide ? 'row' : 'column', gap: 16, marginBottom: 24 },
  promoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', position: 'relative' },
  promoTagBlue: { position: 'absolute', top: -10, left: 12, backgroundColor: '#6366F1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 10 },
  promoTagGreen: { position: 'absolute', top: -10, left: 12, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 10 },
  promoTagText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', marginLeft: 4 },
  promoAvatar: { width: 50, height: 50, borderRadius: 25 },
  promoText: { fontSize: 13, fontWeight: '600', color: '#0A1551', lineHeight: 18 },

  pointsLayout: { flexDirection: isWide ? 'row' : 'column', gap: 20, marginBottom: 20 },
  
  bluePointsCard: { flex: 1, backgroundColor: '#020617', borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' },
  blueHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  blueCardTitle: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  pointsNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pointsHugeText: { fontSize: 48, fontWeight: '900', color: '#FFF' },
  coinIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#D97706', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FDE047' },
  blueCardDesc: { fontSize: 14, color: '#FFF', lineHeight: 22, marginBottom: 24 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, alignSelf: 'flex-start' },
  historyBtnText: { color: '#0052FF', fontSize: 12, fontWeight: 'bold' },
  trophyGraphic: { position: 'absolute', right: -20, bottom: -20, opacity: 0.9 },

  earnPointsCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  earnCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  earnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  earnIconWrap: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  earnRuleTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551' },
  earnRuleDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  earnPointsText: { fontSize: 14, fontWeight: 'bold', color: '#16A34A' },

  redeemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 30 },
  redeemIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  redeemTitle: { fontSize: 16, fontWeight: 'bold', color: '#0A1551' },
  redeemSub: { fontSize: 12, color: '#0A1551', fontWeight: '600', marginTop: 2 },
  redeemInfoRow: { flexDirection: 'row', marginTop: 6, alignItems: 'flex-start' },
  redeemInfoText: { fontSize: 11, color: '#64748B', marginLeft: 6, flex: 1 },
  generateBtn: { backgroundColor: '#16A34A', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  generateBtnTextMain: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  generateBtnTextSub: { color: '#FFF', fontSize: 10, marginTop: 2 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  viewAllText: { fontSize: 13, fontWeight: 'bold', color: '#0052FF' },

  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 30, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: isWide ? '22%' : '45%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  statCardWide: { flex: 1.5, minWidth: isWide ? '30%' : '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#0A1551', marginBottom: 6 },
  statFooter: { fontSize: 11, color: '#64748B' },
  paymentSplitRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paymentSplitLabel: { fontSize: 11, color: '#475569' },
  paymentSplitVal: { fontSize: 11, fontWeight: 'bold', color: '#16A34A' },

  transactionsList: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', minWidth: isWide ? '100%' : 700 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  txIconWrap: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  txName: { fontSize: 13, fontWeight: 'bold', color: '#0A1551' },
  txTreatment: { fontSize: 11, color: '#64748B', marginTop: 2 },
  txDate: { fontSize: 12, color: '#0A1551', fontWeight: '500' },
  txTime: { fontSize: 11, color: '#64748B', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', width: 90, textAlign: 'right' },
  txPoints: { fontSize: 13, fontWeight: 'bold', color: '#16A34A', width: 70, textAlign: 'right', marginRight: 12 },
  txBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 12 },
  txBadgeText: { fontSize: 10, color: '#16A34A', fontWeight: 'bold' },

  paymentBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  paymentBoxContent: { flexDirection: isWide ? 'row' : 'column', alignItems: isWide ? 'center' : 'flex-start', width: '100%' },
  paymentIconWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 16, marginBottom: isWide ? 0 : 12 },
  paymentTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', marginBottom: 4 },
  paymentDesc: { fontSize: 11, color: '#64748B', lineHeight: 16 },

  footerBanner: { backgroundColor: '#020617', borderRadius: 16, padding: 24, marginTop: 30, overflow: 'hidden' },
  footerBannerContent: { flexDirection: isWide ? 'row' : 'column', alignItems: isWide ? 'center' : 'flex-start', position: 'relative', zIndex: 2 },
  footerIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: isWide ? 0 : 12 },
  footerBannerTitle: { fontSize: 15, fontWeight: 'bold', color: '#FFF', lineHeight: 22 },
  footerBannerDesc: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  footerBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  footerBtnText: { color: '#0052FF', fontSize: 12, fontWeight: 'bold' },
  giftsGraphic: { position: 'absolute', right: 10, bottom: -10, opacity: 0.8 }

});
