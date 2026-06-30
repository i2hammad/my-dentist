import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, Alert, Clipboard, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import { openWhatsApp } from '../../../utils/support';

const { width } = Dimensions.get('window');
const isWide = width >= 768;


export default function RewardsTab({ profile, bills = [], setActiveTab, navigation }) {
  const [earnings, setEarnings] = useState({
    totalPoints: 0,
    totalEarnings: '0',
    thisMonth: '0',
    totalPatients: 0,
    totalPayments: '0',
    debitPayments: '0',
    creditPayments: '0'
  });

  const [platformPayments, setPlatformPayments] = useState({
    bankAccount: '',
    bankName: '',
    bankTitle: '',
    easypaisaNumber: '',
    easypaisaTitle: '',
    jazzcashNumber: '',
    jazzcashTitle: '',
  });

  // Doctor's payout (bank) account for receiving My Dentist payments.
  // `payout` = the saved account; `form` = the modal's editable copy.
  const [payoutModal, setPayoutModal] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const EMPTY_PAYOUT = { bankName: '', accountTitle: '', accountNumber: '' };
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [form, setForm] = useState(EMPTY_PAYOUT);
  useEffect(() => {
    const p = profile?.payoutAccount;
    if (p) setPayout({ bankName: p.bankName || '', accountTitle: p.accountTitle || '', accountNumber: p.accountNumber || '' });
  }, [profile]);
  const hasPayout = !!(payout.bankName || payout.accountNumber || payout.accountTitle);
  const openPayout = () => { setForm(payout); setPayoutModal(true); };

  // Bills is now its own bottom-tab screen (no longer a tab inside this screen),
  // so the old setActiveTab('bills') matched nothing and showed a blank view.
  const goToBills = () => {
    if (navigation?.navigate) navigation.navigate('DoctorTabs', { screen: 'DoctorBills' });
    else if (setActiveTab) setActiveTab('bills');
  };

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
      const res = await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, { payoutAccount }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setPayout(payoutAccount); // commit only on success
        setPayoutModal(false);
        Alert.alert('Saved', 'Your payout account has been saved.');
      } else {
        Alert.alert('Error', res.data?.message || 'Could not save the account.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not save the account.');
    } finally { setSavingPayout(false); }
  };

  useEffect(() => {
    calculateEarnings();
  }, [bills]);

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

  const POINTS_THRESHOLD = 20000;
  const canGenerateCode = points >= POINTS_THRESHOLD;

  const handleGenerateCode = () => {
    if (!canGenerateCode) {
      const remaining = (POINTS_THRESHOLD - points).toLocaleString();
      Alert.alert(
        'Not Enough Points',
        `You need 20,000 points to generate a redemption code.\n\nYour points: ${points.toLocaleString()}\nStill needed: ${remaining}\n\nEarn points by completing patient visits, receiving payments, and collecting reviews.`
      );
      return;
    }
    const codeId = (profile?._id || '000000').slice(-6).toUpperCase();
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const code = `POP-${codeId}-${ym}`;

    Alert.alert(
      'Popular Badge Redemption Code',
      `Send this code to the admin to receive your Popular Doctor badge:\n\n${code}\n\nThis code is linked to your account. The admin will verify your 20,000 points and activate your badge.`,
      [
        {
          text: 'Copy Code',
          onPress: () => {
            Clipboard.setString(code);
            Alert.alert('Copied!', 'Redemption code copied to clipboard.');
          },
        },
        {
          text: 'Send to Admin via WhatsApp',
          onPress: () => openWhatsApp(
            `Hello, I'm Dr. ${doctorName}. I have earned ${points.toLocaleString()} reward points on My Dentist app. My redemption code is: ${code}. Please activate my Popular Doctor badge.`
          ),
        },
        { text: 'Cancel', style: 'cancel' },
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
            onPress={() => navigation?.navigate('PointsHistory', { totalPoints: earnings.totalPoints })}
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
            <Text style={styles.earnPointsText}>+50 pts</Text>
          </View>

          <View style={styles.earnRow}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#EFF6FF'}]}><Ionicons name="card" size={16} color="#0052FF" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Current Visit Payment Received</Text>
              <Text style={styles.earnRuleDesc}>When patient pays online to{'\n'}My Dentist Accounts</Text>
            </View>
            <Text style={styles.earnPointsText}>+50 pts</Text>
          </View>

          <View style={styles.earnRow}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#EFF6FF'}]}><Ionicons name="card-outline" size={16} color="#0052FF" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Last Visit Payment Received</Text>
              <Text style={styles.earnRuleDesc}>When patient pays online to{'\n'}My Dentist Accounts</Text>
            </View>
            <Text style={styles.earnPointsText}>+50 pts</Text>
          </View>

          <View style={[styles.earnRow, {borderBottomWidth: 0, paddingBottom: 0}]}>
            <View style={[styles.earnIconWrap, {backgroundColor: '#FFFBEB'}]}><Ionicons name="star-outline" size={16} color="#D97706" /></View>
            <View style={{flex: 1}}>
              <Text style={styles.earnRuleTitle}>Patient Review Received</Text>
              <Text style={styles.earnRuleDesc}>When patient submits review</Text>
            </View>
            <Text style={styles.earnPointsText}>+50 pts</Text>
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
                <Text style={styles.redeemInfoText}>
                  {canGenerateCode
                    ? 'You have reached 20,000 points! Generate your code and send it to the admin to get your Popular Doctor Banner.'
                    : `You need 20,000 points to generate a redemption code. You have ${points.toLocaleString()} pts — ${(POINTS_THRESHOLD - points).toLocaleString()} more to go.`}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress bar toward 20,000 */}
          {!canGenerateCode && (
            <View style={styles.progressBarWrap}>
              <View style={[styles.progressBarFill, { width: `${Math.min((points / POINTS_THRESHOLD) * 100, 100)}%` }]} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateBtn, !canGenerateCode && styles.generateBtnLocked]}
            onPress={handleGenerateCode}
          >
            <Ionicons
              name={canGenerateCode ? 'gift-outline' : 'lock-closed-outline'}
              size={16}
              color="#FFF"
              style={{ marginRight: 8 }}
            />
            <View>
              <Text style={styles.generateBtnTextMain}>
                {canGenerateCode ? 'Tap to Generate Code' : 'Locked — 20,000 pts required'}
              </Text>
              <Text style={styles.generateBtnTextSub}>
                {canGenerateCode ? 'Get a code to redeem your Popular badge' : `${points.toLocaleString()} / 20,000 pts earned`}
              </Text>
            </View>
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
        <TouchableOpacity onPress={goToBills}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.transactionsList, { marginBottom: 30 }]}>
        {bills.length > 0 ? (
          bills.slice(0, 4).map((tx, idx) => {
            const txDate = new Date(tx.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
            const txTime = new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const paid = tx.status === 'paid';
            const pts = paid ? 50 : 0;
            const last = idx === Math.min(bills.length, 4) - 1;
            return (
              <TouchableOpacity key={tx._id || idx} style={[styles.txRow, last && { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={goToBills}>
                <View style={[styles.txIconWrap, { borderColor: paid ? '#16A34A' : '#0052FF', backgroundColor: paid ? '#F0FDF4' : '#EFF4FF' }]}>
                  <Ionicons name="medical-outline" size={16} color={paid ? '#16A34A' : '#0052FF'} />
                </View>
                <View style={styles.txMid}>
                  <Text style={styles.txName} numberOfLines={1}>{tx.patientId?.fullName || 'Patient'}</Text>
                  <Text style={styles.txTreatment} numberOfLines={1}>{tx.treatmentName || 'Treatment'}</Text>
                  <Text style={styles.txMeta}>{txDate} · {txTime}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txAmount}>PKR {tx.amount?.toLocaleString()}</Text>
                  <View style={[styles.txBadge, { backgroundColor: paid ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Text style={[styles.txBadgeText, { color: paid ? '#16A34A' : '#EF4444' }]}>{paid ? 'Paid' : 'Unpaid'}</Text>
                  </View>
                  {pts > 0 && <Text style={styles.txPoints}>+{pts} pts</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>No transactions recorded yet.</Text>
        )}
      </View>

      {/* Payment Accounts — My Dentist company accounts (set by admin) */}
      <View style={styles.commissionBox}>
        <View style={styles.commissionHeader}>
          <View style={styles.commissionIconWrap}>
            <Ionicons name="business" size={20} color="#0052FF" />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.commissionTitle}>Pay 10% Commission to My Dentist</Text>
            <Text style={styles.commissionDesc}>Send payment to any account below. Tap account number to copy.</Text>
          </View>
        </View>

        {/* Bank / IBAN */}
        {(platformPayments.bankAccount || platformPayments.bankName) ? (
          <View style={styles.acctRow}>
            <View style={[styles.acctIcon, {backgroundColor: '#EEF3FF'}]}>
              <Ionicons name="card-outline" size={20} color="#1A3FAA" />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.acctName}>{platformPayments.bankName || 'Bank'}</Text>
              {platformPayments.bankTitle ? <Text style={styles.acctHolder}>{platformPayments.bankTitle}</Text> : null}
              <Text style={styles.acctNumber}>{platformPayments.bankAccount}</Text>
            </View>
            <TouchableOpacity
              style={[styles.acctCopyBtn, {backgroundColor: '#EEF3FF'}]}
              onPress={() => { Clipboard.setString(platformPayments.bankAccount); Alert.alert('Copied', 'IBAN copied!'); }}
            >
              <Ionicons name="copy-outline" size={14} color="#1A3FAA" />
              <Text style={[styles.acctCopyTxt, {color: '#1A3FAA'}]}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Divider */}
        {(platformPayments.bankAccount || platformPayments.bankName) && platformPayments.easypaisaNumber ? (
          <View style={styles.acctDivider} />
        ) : null}

        {/* EasyPaisa */}
        {platformPayments.easypaisaNumber ? (
          <View style={styles.acctRow}>
            <View style={[styles.acctIcon, {backgroundColor: '#F0FDF4'}]}>
              <Ionicons name="phone-portrait-outline" size={20} color="#166534" />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.acctName}>EasyPaisa</Text>
              {platformPayments.easypaisaTitle ? <Text style={styles.acctHolder}>{platformPayments.easypaisaTitle}</Text> : null}
              <Text style={styles.acctNumber}>{platformPayments.easypaisaNumber}</Text>
            </View>
            <TouchableOpacity
              style={[styles.acctCopyBtn, {backgroundColor: '#F0FDF4'}]}
              onPress={() => { Clipboard.setString(platformPayments.easypaisaNumber); Alert.alert('Copied', 'EasyPaisa number copied!'); }}
            >
              <Ionicons name="copy-outline" size={14} color="#166534" />
              <Text style={[styles.acctCopyTxt, {color: '#166534'}]}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* JazzCash */}
        {platformPayments.jazzcashNumber ? (
          <>
            {platformPayments.easypaisaNumber ? <View style={styles.acctDivider} /> : null}
            <View style={styles.acctRow}>
              <View style={[styles.acctIcon, {backgroundColor: '#FFFBEB'}]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#92400E" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.acctName}>JazzCash</Text>
                {platformPayments.jazzcashTitle ? <Text style={styles.acctHolder}>{platformPayments.jazzcashTitle}</Text> : null}
                <Text style={styles.acctNumber}>{platformPayments.jazzcashNumber}</Text>
              </View>
              <TouchableOpacity
                style={[styles.acctCopyBtn, {backgroundColor: '#FFFBEB'}]}
                onPress={() => { Clipboard.setString(platformPayments.jazzcashNumber); Alert.alert('Copied', 'JazzCash number copied!'); }}
              >
                <Ionicons name="copy-outline" size={14} color="#92400E" />
                <Text style={[styles.acctCopyTxt, {color: '#92400E'}]}>Copy</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* Nothing configured yet */}
        {!platformPayments.bankAccount && !platformPayments.easypaisaNumber && !platformPayments.jazzcashNumber && (
          <Text style={[styles.paymentDesc, {color: '#94A3B8', fontStyle: 'italic', marginTop: 8}]}>
            Payment accounts not configured yet. Contact admin.
          </Text>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openPayout}
        style={[styles.paymentBox, {backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', marginTop: 16}]}
      >
        <View style={styles.paymentBoxContent}>
          <View style={[styles.paymentIconWrap, {backgroundColor: '#DCFCE7', borderColor: '#16A34A'}]}>
            <Ionicons name="business" size={20} color="#16A34A" />
          </View>
          <View style={{flex: 1.5, paddingRight: isWide ? 20 : 0, marginBottom: isWide ? 0 : 12}}>
            <Text style={styles.paymentTitle}>My dentist Payments to doctor account</Text>
            <Text style={styles.paymentDesc}>Claim 90% amount of that Payments which patients paid to My Dentist Accounts</Text>
          </View>
          <View style={{flex: 1}}>
            {hasPayout ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.paymentTitle}>{payout.bankName || 'Bank account'}</Text>
                  <View style={styles.payoutEditPill}><Ionicons name="create-outline" size={11} color="#0052FF" /><Text style={styles.payoutEditText}>Edit</Text></View>
                </View>
                {!!payout.accountTitle && <Text style={styles.acctHolder}>{payout.accountTitle}</Text>}
                <Text style={styles.paymentDesc}>{payout.accountNumber}</Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="add-circle" size={16} color="#16A34A" />
                  <Text style={styles.paymentTitle}>Add Account Number</Text>
                </View>
                <Text style={styles.paymentDesc}>Add your bank account to receive payments</Text>
              </>
            )}
          </View>
        </View>
        {isWide && <Ionicons name="chevron-forward" size={20} color="#0A1551" />}
      </TouchableOpacity>

      {/* Payout account modal */}
      <Modal visible={payoutModal} transparent animationType="slide" onRequestClose={() => setPayoutModal(false)}>
        <View style={styles.payoutOverlay}>
          <View style={styles.payoutSheet}>
            <View style={styles.payoutHead}>
              <Text style={styles.payoutTitle}>{hasPayout ? 'Edit Payout Account' : 'Add Payout Account'}</Text>
              <TouchableOpacity onPress={() => setPayoutModal(false)} hitSlop={10}><Ionicons name="close" size={22} color="#0A1551" /></TouchableOpacity>
            </View>
            <Text style={styles.payoutNote}>Where My Dentist sends your 90% payout for payments patients made to the platform accounts.</Text>

            <Text style={styles.payoutLabel}>Bank Name</Text>
            <TextInput style={styles.payoutInput} placeholder="e.g. HBL, Meezan" placeholderTextColor="#94A3B8" value={form.bankName} onChangeText={(v) => setForm((p) => ({ ...p, bankName: v }))} />

            <Text style={styles.payoutLabel}>Account Title</Text>
            <TextInput style={styles.payoutInput} placeholder="Account holder name" placeholderTextColor="#94A3B8" value={form.accountTitle} onChangeText={(v) => setForm((p) => ({ ...p, accountTitle: v }))} autoCapitalize="words" />

            <Text style={styles.payoutLabel}>Account Number / IBAN</Text>
            <TextInput style={styles.payoutInput} placeholder="PK00XXXX0000000000000000" placeholderTextColor="#94A3B8" value={form.accountNumber} onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v }))} autoCapitalize="characters" />

            <TouchableOpacity style={[styles.payoutSaveBtn, savingPayout && { opacity: 0.7 }]} disabled={savingPayout} onPress={savePayout}>
              {savingPayout ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.payoutSaveText}>Save Account</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

  // Payout account
  payoutEditPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#EFF4FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  payoutEditText: { fontSize: 11, fontWeight: '700', color: '#0052FF' },
  payoutOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'flex-end' },
  payoutSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  payoutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  payoutTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  payoutNote: { fontSize: 12.5, color: '#64748B', marginBottom: 12 },
  payoutLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 12 },
  payoutInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC' },
  payoutSaveBtn: { backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  payoutSaveText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

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
  generateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16A34A', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  generateBtnLocked: { backgroundColor: '#94A3B8' },
  generateBtnTextMain: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  generateBtnTextSub: { color: '#FFF', fontSize: 10, marginTop: 2 },
  progressBarWrap: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#16A34A', borderRadius: 3 },

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

  transactionsList: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  txIconWrap: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  txMid: { flex: 1, minWidth: 0 },
  txName: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  txTreatment: { fontSize: 12, color: '#64748B', marginTop: 2 },
  txMeta: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  txPoints: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  txBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  txBadgeText: { fontSize: 10, fontWeight: 'bold' },

  paymentBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  paymentBoxContent: { flexDirection: isWide ? 'row' : 'column', alignItems: 'flex-start', width: '100%' },
  paymentIconWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 16, marginBottom: isWide ? 0 : 12 },
  paymentTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', marginBottom: 4 },
  paymentDesc: { fontSize: 11, color: '#64748B', lineHeight: 16 },

  commissionBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#BFDBFE', marginBottom: 0 },
  commissionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  commissionIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#0052FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  commissionTitle: { fontSize: 14, fontWeight: '800', color: '#0052FF', marginBottom: 2 },
  commissionDesc: { fontSize: 11, color: '#64748B', lineHeight: 15 },

  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  acctIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  acctName: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  acctHolder: { fontSize: 13, color: '#475569', fontWeight: '500', marginTop: 1 },
  acctNumber: { fontSize: 13, color: '#64748B', marginTop: 3 },
  acctCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  acctCopyTxt: { fontSize: 12, fontWeight: '700' },
  acctDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 0 },

  footerBanner: { backgroundColor: '#020617', borderRadius: 16, padding: 24, marginTop: 30, overflow: 'hidden' },
  footerBannerContent: { flexDirection: isWide ? 'row' : 'column', alignItems: isWide ? 'center' : 'flex-start', position: 'relative', zIndex: 2 },
  footerIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: isWide ? 0 : 12 },
  footerBannerTitle: { fontSize: 15, fontWeight: 'bold', color: '#FFF', lineHeight: 22 },
  footerBannerDesc: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  footerBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  footerBtnText: { color: '#0052FF', fontSize: 12, fontWeight: 'bold' },
  giftsGraphic: { position: 'absolute', right: 10, bottom: -10, opacity: 0.8 }

});
