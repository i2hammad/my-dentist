import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView,
  Dimensions, Platform, ActivityIndicator, Alert, Share, Modal, TextInput, Linking, Pressable, StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import storage from '../config/storage';
import useResponsive from '../hooks/useResponsive';
import { SkeletonDoctorDetail, ShimmerImage } from '../components/Skeleton';
import { drName } from '../utils/doctorName';
import { buildReceiptHtml } from './doctor/tabs/BillsTab';
import PromoCard from '../components/PromoCard';
import { openWhatsApp, openSupportEmail } from '../utils/support';

// Used only by a couple of static StyleSheet entries below (half-width cards).
// Component layout uses the live useResponsive() hook instead.
const { width } = Dimensions.get('window');

// ─── Distance helpers (match HomeScreen) ──────────────────────────────────────
const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const fmtKm = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
// Parse a "lat, lng" string into { lat, lng } or null.
const parseCoords = (s) => {
  if (!s) return null;
  const p = String(s).split(',').map(Number);
  if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) return null;
  return { lat: p[0], lng: p[1] };
};

// ─── No Default Facilities ────────────────────────────────────────────────────────

// ─── Clinic Tier Helper ─── Standard 1-15 · Modern 16-30 · Elite 31+ ──────────
const getClinicTier = (score) => {
  if (score >= 31) return { label: 'Elite Clinic',    color: '#D97706', bg: '#FEF3C7', desc: 'Top-tier dental facility with advanced technology & premium hygiene.' };
  if (score >= 16) return { label: 'Modern Clinic',   color: '#0052FF', bg: '#EFF6FF', desc: 'Well-equipped modern clinic with quality standards.' };
  if (score >= 1)  return { label: 'Standard Clinic', color: '#64748B', bg: '#F1F5F9', desc: 'Basic dental care with standard safety protocols.' };
  return              { label: 'Unrated',            color: '#94A3B8', bg: '#F8FAFC', desc: 'Facility score not yet available.' };
};

// ─── Treatment Icon Helper ─────────────────────────────────────────────────────
const getTreatmentIcon = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('implant'))    return { icon: 'construct-outline',    color: '#7C3AED' };
  if (n.includes('root'))       return { icon: 'git-branch-outline',   color: '#DC2626' };
  if (n.includes('whitening'))  return { icon: 'sparkles-outline',     color: '#D97706' };
  if (n.includes('brace') || n.includes('ortho')) return { icon: 'git-network-outline', color: '#0052FF' };
  if (n.includes('extract'))    return { icon: 'cut-outline',          color: '#EF4444' };
  if (n.includes('clean') || n.includes('scal')) return { icon: 'water-outline', color: '#16A34A' };
  return { icon: 'medical-outline', color: '#0052FF' };
};

// Readable clinic timing: prefers morning/evening sessions + days, falls back
// to the legacy single range.
function formatClinicTiming(t) {
  if (!t) return 'Mon – Sat, 10:00 AM – 08:00 PM';
  if (typeof t === 'string') return t;
  const parts = [];
  const days = (t.availableDays && t.availableDays.length) ? t.availableDays.join(', ') : (t.days || '');
  if (days) parts.push(days);
  if (t.morningStart && t.morningEnd) parts.push(`Morning ${t.morningStart} – ${t.morningEnd}`);
  if (t.eveningStart && t.eveningEnd) parts.push(`Evening ${t.eveningStart} – ${t.eveningEnd}`);
  if (!t.morningStart && !t.eveningStart && t.startTime && t.endTime) parts.push(`${t.startTime} – ${t.endTime}`);
  if (t.offDays && t.offDays.length) parts.push(`Off: ${t.offDays.join(', ')}`);
  return parts.length ? parts.join('\n') : 'Not specified';
}

export default function DoctorProfileScreen({ route, navigation }) {
  const { isWide } = useResponsive();
  const insets = useSafeAreaInsets();
  const [loading, setLoading]       = useState(!route.params?.doctor);
  const [doctor, setDoctor]         = useState(route.params?.doctor || null);
  const [treatments, setTreatments] = useState([]);
  const [gallery, setGallery]       = useState([]);
  const [reviews, setReviews]       = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [bills, setBills]               = useState([]);
  const [rewards, setRewards]           = useState({ points: 0, transactions: [] });
  const [payingBillId, setPayingBillId] = useState(null);

  const [activeTab, setActiveTab] = useState('About');
  const [tabsScrollEnd, setTabsScrollEnd] = useState(false);
  const [tabsScrollStart, setTabsScrollStart] = useState(true); // at the far-left start
  const [tabsScrollable, setTabsScrollable] = useState(false); // content wider than viewport
  const tabsLayoutW = useRef(0);
  const tabsScrollRef = useRef(null);
  const [saved, setSaved] = useState(false);
  const [patientProfile, setPatientProfile] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Payment Modal States
  const [checkoutBill, setCheckoutBill] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState('visa');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Bill Detail Modal
  const [selectedBillDetail, setSelectedBillDetail] = useState(null);
  const [showBillDetailModal, setShowBillDetailModal] = useState(false);

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasCompletedAppointment, setHasCompletedAppointment] = useState(false);

  // Lightbox
  const [lightboxUri, setLightboxUri] = useState(null);

  // Redeem Points
  const [redeemCode, setRedeemCode] = useState(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showRewardHistory, setShowRewardHistory] = useState(false);

  // Jump to a specific tab when navigated from a notification
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Check if patient has a completed appointment with this doctor
  useEffect(() => {
    const checkCompletedApt = async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const docId = route.params?.doctorId || route.params?.doctor?._id;
        if (!docId) return;
        const res = await axios.get(`${API_BASE_URL}/api/appointments/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          const all = [...(res.data.data.upcoming || []), ...(res.data.data.past || [])];
          const completed = all.some(a =>
            a.status === 'completed' && (
              String(a.doctorId?._id) === String(docId) ||
              String(a.doctorId) === String(docId)
            )
          );
          setHasCompletedAppointment(completed);
        }
      } catch {}
    };
    checkCompletedApt();
  }, []);

  // Load favorites/saved from backend on mount
  useEffect(() => {
    const loadFavState = async () => {
      try {
        const docId = route.params?.doctorId || route.params?.doctor?._id;
        if (!docId) return;
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          const ids = (res.data.data || []).map(f => String(f.doctorId?._id || f.doctorId)).filter(Boolean);
          const isFav = ids.includes(String(docId));
          setIsFavorite(isFav);
          setSaved(isFav);
        }
      } catch (e) { /* ignore */ }
    };
    loadFavState();
  }, []);

  const toggleFavorite = useCallback(async () => {
    const docId = doctor?._id;
    if (!docId) return;
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      if (newVal) {
        await axios.post(`${API_BASE_URL}/api/favorites/${docId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.delete(`${API_BASE_URL}/api/favorites/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (e) { /* ignore */ }
  }, [isFavorite, doctor]);

  const toggleSaved = useCallback(async () => {
    const docId = doctor?._id;
    if (!docId) return;
    const newVal = !saved;
    setSaved(newVal);
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      if (newVal) {
        await axios.post(`${API_BASE_URL}/api/favorites/${docId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Saved', 'Doctor added to your favourites.');
      } else {
        await axios.delete(`${API_BASE_URL}/api/favorites/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert('Removed', 'Doctor removed from favourites.');
      }
      setIsFavorite(newVal);
    } catch (e) { /* ignore */ }
  }, [saved, doctor]);

  const handleRedeem = async () => {
    const pts = rewards.totalPoints || rewards.points || 0;
    if (pts <= 0) return Alert.alert('No Points', 'You have no reward points to redeem.');
    setRedeemLoading(true);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.post(`${API_BASE_URL}/api/rewards/redeem`, { points: pts }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setRedeemCode(res.data.data?.code);
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not generate code. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const TAB_ICONS = {
    'About': 'person-outline',
    'Treatments': 'medkit-outline',
    'Gallery': 'images-outline',
    'Facilities': 'business-outline',
    'Reviews': 'star-outline',
    'Appointments': 'calendar-outline',
    'Bills & Bill History': 'receipt-outline',
    'Rewards & Payments': 'gift-outline',
  };

  const tabs = ['About', 'Treatments', 'Gallery', 'Facilities', 'Reviews', 'Appointments', 'Bills & Bill History', 'Rewards & Payments'];

  useEffect(() => {
    fetchDoctorData();
  }, [route.params?.doctorId, route.params?.doctor]);

  const fetchDoctorData = async () => {
    try {
      const docId = route.params?.doctorId || route.params?.doctor?._id || route.params?.doctor?.userId || doctor?._id || doctor?.userId;
      if (!docId) { setLoading(false); return; }

      const token = await storage.getItem('userToken');

      // Fetch doctor details
      try {
        const docRes = await axios.get(`${API_BASE_URL}/api/doctors/${docId}`);
        if (docRes.data?.success) setDoctor(docRes.data.data);
      } catch (e) {
        console.log('Error fetching doctor details:', e?.message);
      }

      // Fetch treatments
      try {
        const treatRes = await axios.get(`${API_BASE_URL}/api/treatments/doctor/${docId}`);
        if (treatRes.data?.success) {
          const active = (treatRes.data.data || []).filter(t => t.active !== false);
          setTreatments(active);
        }
      } catch (e) {
        console.log('Error fetching treatments:', e?.message);
      }

      // Fetch gallery
      try {
        const galRes = await axios.get(`${API_BASE_URL}/api/gallery/doctor/${docId}`);
        if (galRes.data?.success) setGallery(galRes.data.data || []);
      } catch (e) {
        console.log('Error fetching gallery:', e?.message);
      }

      // Fetch reviews (paginated list)
      try {
        const revRes = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${docId}`);
        if (revRes.data?.success) setReviews(Array.isArray(revRes.data.data) ? revRes.data.data : []);
      } catch (e) {
        console.log('Error fetching reviews:', e?.message);
      }
      // Fetch aggregate stats (true average/count/recommend over ALL reviews)
      try {
        const statsRes = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${docId}/stats`);
        if (statsRes.data?.success) setReviewStats(statsRes.data.data);
      } catch (e) { /* fall back to client-side calc */ }

      if (token) {
        // Fetch appointments
        try {
          const apptRes = await axios.get(`${API_BASE_URL}/api/appointments/my`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (apptRes.data?.success) {
            const allAppts = [...(apptRes.data.data?.upcoming || []), ...(apptRes.data.data?.past || [])];
            setAppointments(allAppts.filter(a => a && (a.doctorId?._id === docId || a.doctorId === docId)));
          }
        } catch (e) {
          console.log('Error fetching appointments:', e?.message);
        }

        // Fetch bills
        try {
          const billRes = await axios.get(`${API_BASE_URL}/api/bills/my`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (billRes.data?.success) {
            const billData = billRes.data.data || [];
            if (Array.isArray(billData)) {
              setBills(billData.filter(b => b && (b.doctorId?._id === docId || b.doctorId === docId)));
            }
          }
        } catch (e) {
          console.log('Error fetching bills:', e?.message);
        }

        // Fetch rewards
        try {
          const rewRes = await axios.get(`${API_BASE_URL}/api/rewards/my`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (rewRes.data?.success) setRewards(rewRes.data.data || { totalPoints: 0, equivalentPKR: 0, recentHistory: [] });
        } catch (e) {
          console.log('Error fetching rewards:', e?.message);
        }

        // Fetch patient profile
        try {
          const profileRes = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (profileRes.data?.success && profileRes.data.data.profile) {
            setPatientProfile(profileRes.data.data.profile);
          }
        } catch (e) {
          console.log('Error fetching profile:', e?.message);
        }

        // Fetch saved payment methods
        try {
          const pmRes = await axios.get(`${API_BASE_URL}/api/payments/methods`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (pmRes.data?.success) {
            setPaymentMethods(pmRes.data.data || []);
          }
        } catch (e) {
          console.log('Error fetching payment methods:', e?.message);
        }
      }
    } catch (err) {
      console.log('Error in fetchDoctorData:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!doctor) return;
    try {
      const docId = doctor._id || doctor.userId;
      const shareUrl = `mydentist://doctor/${docId}`;
      await Share.share({
        message: `Check out ${drName(doctor.fullName)}'s profile on My Dentist: ${shareUrl}`,
        url: shareUrl,
        title: `${drName(doctor.fullName)}'s Profile`
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  // Returns true only when doctor has a real non-zero GPS coordinate set
  const doctorHasLocation = (() => {
    if (!doctor?.coordinates) return false;
    const p = String(doctor.coordinates).split(',').map(Number);
    if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) return false;
    if (Math.abs(p[0]) < 0.001 && Math.abs(p[1]) < 0.001) return false;
    return true;
  })();

  const handleOpenMap = () => {
    if (doctorHasLocation) {
      const p = String(doctor.coordinates).split(',').map(Number);
      const lat = p[0], lng = p[1];
      const url = Platform.select({
        ios: `maps://?ll=${lat},${lng}&q=${encodeURIComponent(doctor.clinicName || 'Clinic')}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(doctor.clinicName || 'Clinic')})`,
        default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      });
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
          Alert.alert('Error', 'Could not open map navigation.')
        );
      });
    }
  };

  const confirmPayBill = async () => {
    if (!checkoutBill) return;
    const paidBillId = checkoutBill._id;
    const invoiceNo = checkoutBill.invoiceNumber;
    try {
      setPayingBillId(paidBillId);
      const token = await storage.getItem('userToken');
      const res = await axios.put(`${API_BASE_URL}/api/bills/${paidBillId}/pay`,
        { paymentType: 'cash', paymentMethodLabel: 'Cash' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        // Cash goes to "payment_pending" (doctor must confirm receipt); card/wallet settles instantly.
        const pending = !!res.data.data?.pending;
        const serverBill = res.data.data?.bill || {};
        const newStatus = pending ? 'payment_pending' : 'paid';
        setShowPaymentModal(false);

        // Reflect the new status immediately in every open view (list + detail sheet).
        const applyStatus = (x) => (x && x._id === paidBillId)
          ? { ...x, status: newStatus, paymentType: 'cash', paymentMethodLabel: 'Cash',
              paidAmount: pending ? (x.paidAmount || 0) : (x.finalAmount || x.amount) }
          : x;
        setBills(prev => prev.map(applyStatus));
        setSelectedBillDetail(prev => applyStatus(prev));
        setCheckoutBill(null);

        // Hard refresh from the server (source of truth), then re-sync the open detail sheet.
        const docId = doctor._id || doctor.userId;
        try {
          const billRes = await axios.get(`${API_BASE_URL}/api/bills/my`, { headers: { Authorization: `Bearer ${token}` } });
          if (billRes.data?.success) {
            const fresh = billRes.data.data.filter(b => b.doctorId?._id === docId || b.doctorId === docId);
            setBills(fresh);
            setSelectedBillDetail(prev => prev ? (fresh.find(b => b._id === prev._id) || applyStatus(prev)) : prev);
          }
          const rewardRes = await axios.get(`${API_BASE_URL}/api/rewards/my`, { headers: { Authorization: `Bearer ${token}` } });
          if (rewardRes.data?.success) setRewards(rewardRes.data.data || { points: 0, transactions: [] });
        } catch (_) {}

        if (pending) {
          Alert.alert(
            'Cash Payment Recorded',
            `Bill ${invoiceNo} is marked as paid by cash.\n\nIt will show as Paid once your doctor confirms they received the cash.`
          );
        } else {
          Alert.alert('Payment Successful', 'Your payment is confirmed. Generating receipt…');
          handleDownloadInvoice({ ...checkoutBill, ...serverBill, status: 'paid' });
        }
      }
    } catch (e) {
      console.log('Error paying bill:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to pay bill');
    } finally {
      setPayingBillId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewComment.trim() || reviewComment.trim().length < 5) {
      Alert.alert('Error', 'Comment must be at least 5 characters long.');
      return;
    }
    try {
      setSubmittingReview(true);
      const token = await storage.getItem('userToken');
      const docId = doctor._id || doctor.userId;
      const payload = {
        doctorId: docId,
        rating: reviewRating,
        comment: reviewComment.trim()
      };
      const res = await axios.post(`${API_BASE_URL}/api/reviews`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Thank you for your feedback! You earned +50 points!');
        setShowReviewModal(false);
        setReviewComment('');
        setReviewRating(5);
        // Refresh doctor data and reviews
        fetchDoctorData();
      }
    } catch (e) {
      console.log('Error submitting review:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handlePayBill = (bill) => {
    setCheckoutBill(bill);
    setShowPaymentModal(true);
  };

  const fetchPaymentMethodsOnly = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/payments/methods`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setPaymentMethods(res.data.data || []);
      }
    } catch (e) {
      console.log('Error fetching payment methods:', e);
    }
  };

  const handleDeletePaymentMethod = async (methodId) => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.delete(`${API_BASE_URL}/api/payments/methods/${methodId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Payment method deleted successfully.');
        fetchPaymentMethodsOnly();
      }
    } catch (e) {
      console.log('Error deleting payment method:', e);
      Alert.alert('Error', 'Failed to delete payment method.');
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!newAccountNumber.trim()) {
      Alert.alert('Error', 'Please enter account or card number.');
      return;
    }
    try {
      const token = await storage.getItem('userToken');
      const payload = {
        type: newMethodType,
        accountNumber: newAccountNumber.trim(),
        lastFourDigits: newMethodType === 'visa' || newMethodType === 'mastercard' 
          ? newAccountNumber.trim().slice(-4) 
          : undefined,
        expiryDate: newMethodType === 'visa' || newMethodType === 'mastercard' 
          ? newExpiryDate.trim() 
          : undefined,
      };
      const res = await axios.post(`${API_BASE_URL}/api/payments/methods`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Payment method added successfully.');
        setShowAddMethodModal(false);
        setNewAccountNumber('');
        setNewExpiryDate('');
        fetchPaymentMethodsOnly();
      }
    } catch (e) {
      console.log('Error adding payment method:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to add payment method.');
    }
  };

  // Styled A4 invoice (same template as the doctor side), not plain text.
  const handleDownloadInvoice = async (bill) => {
    if (!bill || !doctor) return;
    const final = bill.finalAmount || bill.amount;
    const invoice = {
      invoiceNumber: bill.invoiceNumber,
      date: new Date(bill.paidAt || bill.createdAt).toLocaleDateString(),
      time: '',
      patientName: patientProfile?.fullName || 'Patient',
      patientPhone: patientProfile?.mobileNumber || '',
      treatments: (Array.isArray(bill.treatments) && bill.treatments.length)
        ? bill.treatments.map((t) => ({ name: t.name || 'Treatment', price: t.price ? String(t.price) : '' }))
        : String(bill.treatmentName || 'Treatment').split(',').map((n) => ({ name: n.trim(), price: '' })),
      total: bill.amount,
      discount: bill.discountFromRewards || 0,
      paid: bill.paidAmount || 0,
      outstanding: bill.status === 'paid' ? 0 : Math.max(final - (bill.paidAmount || 0), 0),
      status: bill.status,
    };
    const meta = {
      docName: drName(doctor.fullName, 'Dentist'),
      clinic: doctor.clinicName || 'Dentist Clinic',
      spec: doctor.specialization || '',
    };
    try {
      if (Platform.OS === 'web') {
        const html = buildReceiptHtml(invoice, { ...meta, type: 'normal', autoPrint: true });
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
        return;
      }
      const Print = require('expo-print');
      const html = buildReceiptHtml(invoice, { ...meta, type: 'normal', autoPrint: false });
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoiceNumber}` });
    } catch {
      Alert.alert('Error', 'Could not generate the invoice.');
    }
  };

  if (loading) {
    return <SkeletonDoctorDetail topInset={insets.top} />;
  }

  if (!doctor) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Doctor profile not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clinicPhotos  = gallery.filter(i => i.category === 'clinic_photo' || i.category === 'clinic_photos');
  const beforeAfters  = gallery.filter(i => i.category === 'before_after');
  const certificates  = gallery.filter(i => i.category === 'certificate' || i.category === 'certificates');

  // Billing Stats
  const totalBillsCount   = bills.length;
  const totalPaidAmount   = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
  const totalDiscount     = bills.reduce((s, b) => s + (b.discountFromRewards || 0), 0);
  const totalOutstanding  = bills.filter(b => b.status === 'unpaid').reduce((s, b) => s + b.amount, 0);
  const unpaidBill        = bills.find(b => b.status === 'unpaid');

  // Reviews Stats — prefer backend aggregate (all reviews); fall back to the
  // fetched page if the stats endpoint is unavailable.
  const avgRating   = reviewStats
    ? Number(reviewStats.avgRating || 0).toFixed(1)
    : (reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1) : '0.0');
  const recommendPct = reviewStats
    ? (reviewStats.recommendPercentage || 0)
    : (reviews.length ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100) : 0);
  const starCounts  = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviewStats?.ratingDistribution ? (reviewStats.ratingDistribution[s] || 0) : reviews.filter(r => r.rating === s).length,
  }));
  const totalReviewCount = reviewStats ? (reviewStats.totalReviews || 0) : reviews.length;

  // Facilities (using doctor.services from database)
  const facilityList = (doctor.services && doctor.services.length > 0)
    ? doctor.services.filter(Boolean).map(f => ({ label: typeof f === 'string' ? f : (f.name || f.label || ''), icon: 'checkmark-circle-outline' }))
    : [];

  // Distance between the patient and this doctor (null if either lacks coords).
  const patientCoords = parseCoords(patientProfile?.coordinates);
  const doctorCoords = parseCoords(doctor.coordinates);
  const distanceKm = (patientCoords && doctorCoords)
    ? haversineKm(patientCoords.lat, patientCoords.lng, doctorCoords.lat, doctorCoords.lng)
    : null;
  const distanceLabel = distanceKm !== null ? fmtKm(distanceKm) : null;

  // Clinic Tier
  const facilityScore = doctor.facilityScore || 0;
  const tier = getClinicTier(facilityScore);

  // ── Desktop left rail: doctor identity + sticky booking card.
  // Reuses the same data/handlers as the phone layout but is always visible
  // on wide screens (not gated to the About tab).
  const photoUri = (doctor.photo || doctor.avatar) ? imgUrl(doctor.photo || doctor.avatar) : null;
  const leftRail = (
    <View style={styles.webRail}>
      <View style={styles.webRailCard}>
        {photoUri
          ? <Image source={{ uri: photoUri }} style={styles.webRailPhoto} />
          : <View style={[styles.webRailPhoto, styles.webRailPhotoPlaceholder]}><Ionicons name="person" size={48} color="#0052FF" /></View>}
        <View style={styles.nameRow}>
          <Text style={styles.doctorName}>{drName(doctor.fullName)}</Text>
          {doctor.pmdcVerified && <Ionicons name="checkmark-circle" size={18} color="#0052FF" style={{ marginLeft: 6 }} />}
        </View>
        <Text style={styles.doctorSpecialty}>{doctor.specialization} • {doctor.qualification || 'BDS'}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.ratingText}>{avgRating} <Text style={{ color: '#64748B', fontWeight: 'normal' }}>({totalReviewCount} Reviews)</Text></Text>
        </View>
        {doctor.isPopular && (
          <View style={[styles.popularPill, { backgroundColor: doctor.popularType === 'paid' ? '#DBEAFE' : '#DCFCE7', marginTop: 8 }]}>
            <Ionicons name="star" size={11} color={doctor.popularType === 'paid' ? '#1D4ED8' : '#15803D'} />
            <Text style={[styles.popularPillText, { color: doctor.popularType === 'paid' ? '#1D4ED8' : '#15803D' }]}>Popular</Text>
          </View>
        )}
        {doctor.clinicName && (
          <View style={[styles.clinicTag, { marginTop: 10 }]}>
            <Ionicons name="ribbon-outline" size={14} color="#0052FF" style={{ marginRight: 4 }} />
            <Text style={styles.clinicText}>{doctor.clinicName}</Text>
          </View>
        )}
        {(doctor.address || distanceLabel) && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#64748B" />
            {!!doctor.address && (
              <Text style={styles.distanceText}>{doctor.address}{doctor.city ? `, ${doctor.city}` : ''}</Text>
            )}
            {distanceLabel && (
              <View style={styles.distanceChip}>
                <Ionicons name="navigate" size={11} color="#2563EB" />
                <Text style={styles.distanceChipText}>{distanceLabel} away</Text>
              </View>
            )}
          </View>
        )}
        {(activeTab === 'Treatments' || activeTab === 'Appointments') && (
          <TouchableOpacity style={styles.webBookBtn} onPress={() => navigation.navigate('Booking', { doctor })}>
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.bookBtnTxt}>Book Appointment</Text>
          </TouchableOpacity>
        )}
        <View style={styles.webRailActions}>
          <TouchableOpacity style={styles.webRailAction} onPress={() => {
            const docUserId = doctor.userId?._id || doctor.userId;
            if (!docUserId) { Alert.alert('Error', 'Unable to start chat.'); return; }
            navigation.navigate('Chat', { userId: docUserId, userName: drName(doctor.fullName) });
          }}>
            <Ionicons name="chatbubble-outline" size={18} color="#0052FF" /><Text style={styles.actionBtnText}>Chat</Text>
          </TouchableOpacity>
          {doctorHasLocation && (
            <TouchableOpacity style={styles.webRailAction} onPress={handleOpenMap}>
              <Ionicons name="navigate-outline" size={18} color="#0052FF" /><Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.webRailAction, saved && { backgroundColor: '#0052FF', borderColor: '#0052FF' }]} onPress={toggleSaved}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? '#FFFFFF' : '#0052FF'} /><Text style={[styles.actionBtnText, saved && { color: '#FFFFFF' }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={isWide ? ['top'] : []} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={[
          { paddingBottom: 150 + (isWide ? 0 : insets.bottom) },
          isWide && styles.webScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isWide && (
          <View style={styles.webTopBar}>
            <TouchableOpacity style={styles.webBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
              <Text style={styles.webBackText} numberOfLines={1}>Back</Text>
            </TouchableOpacity>
            <View style={styles.webCrumb}>
              <Text style={styles.webCrumbMuted}>Doctors</Text>
              <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              <Text style={styles.webCrumbActive} numberOfLines={1}>{drName(doctor.fullName)}</Text>
            </View>
          </View>
        )}
        <View style={isWide ? styles.webGrid : undefined}>
          {isWide && leftRail}
          <View style={isWide ? styles.webMain : undefined}>
        {/* Header — About tab, phone only */}
        {activeTab === 'About' && !isWide && (
          <View style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </TouchableOpacity>
            {/* Right side: online badge + share */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: doctor.onlineStatus === 'online' ? '#DCFCE7' : '#F1F5F9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: doctor.onlineStatus === 'online' ? '#86EFAC' : '#E2E8F0' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: doctor.onlineStatus === 'online' ? '#16A34A' : '#94A3B8', marginRight: 5 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: doctor.onlineStatus === 'online' ? '#15803D' : '#64748B' }}>
                  {doctor.onlineStatus === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
              <TouchableOpacity style={styles.iconCircle} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Compact Header — shown on all non-About tabs (phone only) */}
        {activeTab !== 'About' && !isWide && (
          <View style={[styles.compactHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.compactBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </TouchableOpacity>
            {doctor.photo || doctor.avatar ? (
              <Image source={{ uri: imgUrl(doctor.photo || doctor.avatar) }} style={styles.compactAvatar} />
            ) : (
              <View style={[styles.compactAvatar, { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={28} color="#0052FF" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.compactDoctorName} numberOfLines={1}>{drName(doctor.fullName)}</Text>
                {doctor.pmdcVerified && <Ionicons name="checkmark-circle" size={14} color="#0052FF" style={{ marginLeft: 4 }} />}
              </View>
              <Text style={styles.compactSpecialty} numberOfLines={1}>{doctor.specialization} • {doctor.qualification || 'BDS'}</Text>
              {doctor.clinicName && (
                <View style={[styles.clinicTag, { marginTop: 2 }]}>
                  <Ionicons name="medical-outline" size={11} color="#0052FF" style={{ marginRight: 3 }} />
                  <Text style={[styles.clinicText, { fontSize: 11 }]}>{doctor.clinicName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Floating Doctor Card — only on About tab (phone only) */}
        {activeTab === 'About' && !isWide && (
          <View style={styles.floatingCard}>
            {/* Avatar + Name row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {doctor.photo || doctor.avatar ? (
                <Image source={{ uri: imgUrl(doctor.photo || doctor.avatar) }} style={styles.doctorAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={38} color="#0052FF" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.doctorName}>{drName(doctor.fullName)}</Text>
                  {doctor.pmdcVerified && (
                    <Ionicons name="checkmark-circle" size={17} color="#0052FF" style={{ marginLeft: 5 }} />
                  )}
                </View>
                <Text style={styles.doctorSpecialty}>{doctor.specialization} • {doctor.qualification || 'BDS'}</Text>
                {/* Rating inline */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                  <Ionicons name="star" size={13} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{avgRating}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8' }}>({totalReviewCount} reviews)</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

            {/* Clinic + Location row */}
            <View style={{ gap: 6 }}>
              {doctor.clinicName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="ribbon-outline" size={14} color="#0052FF" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{doctor.clinicName}</Text>
                  {tier && (
                    <View style={{ backgroundColor: tier.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: tier.color }}>{tier.label}</Text>
                    </View>
                  )}
                </View>
              )}
              {(doctor.address || doctor.city) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={14} color="#16A34A" />
                  </View>
                  <Text style={{ fontSize: 13, color: '#475569', flex: 1 }} numberOfLines={1}>
                    {[doctor.address, doctor.city].filter(Boolean).join(', ')}
                  </Text>
                  {distanceLabel && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Ionicons name="navigate" size={10} color="#2563EB" />
                      <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700', marginLeft: 3 }}>{distanceLabel}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action buttons — About tab, phone only */}
        {activeTab === 'About' && !isWide && (
          <View style={{ flexDirection: 'row', marginHorizontal: 14, marginTop: 10, gap: 8 }}>
            {/* Book Appointment — primary CTA */}
            <TouchableOpacity
              style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 13, gap: 6 }}
              onPress={() => navigation.navigate('Booking', { doctor })}
            >
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Book Appointment</Text>
            </TouchableOpacity>
            {/* Chat */}
            <TouchableOpacity
              style={{ flex: 0, width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' }}
              onPress={() => {
                const docUserId = doctor.userId?._id || doctor.userId;
                if (!docUserId) { Alert.alert('Error', 'Unable to start chat.'); return; }
                navigation.navigate('Chat', { userId: docUserId, userName: drName(doctor.fullName) });
              }}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#0052FF" />
            </TouchableOpacity>
            {/* Directions — only if GPS location is set */}
            {doctorHasLocation && (
              <TouchableOpacity
                style={{ flex: 0, width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' }}
                onPress={handleOpenMap}
              >
                <Ionicons name="navigate-outline" size={20} color="#0052FF" />
              </TouchableOpacity>
            )}
            {/* Save */}
            <TouchableOpacity
              style={{ flex: 0, width: 48, height: 48, borderRadius: 14, backgroundColor: saved ? '#0052FF' : '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: saved ? '#0052FF' : '#DBEAFE' }}
              onPress={toggleSaved}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? '#FFFFFF' : '#0052FF'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Marketing banner */}
        <PromoCard />

        {/* Tabs with icons above text. On web they wrap (no clipping); on
            mobile they scroll horizontally. */}
        {(() => {
          const tabButtons = tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={TAB_ICONS[tab] || 'ellipse-outline'}
                size={18}
                color={activeTab === tab ? '#0052FF' : '#94A3B8'}
                style={{ marginBottom: 4 }}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ));
          return (
            <View style={{ position: 'relative' }}>
              <ScrollView
                ref={tabsScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsContent}
                scrollEventThrottle={16}
                onLayout={(e) => { tabsLayoutW.current = e.nativeEvent.layout.width; }}
                onContentSizeChange={(w) => setTabsScrollable(w > tabsLayoutW.current + 4)}
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  // At end when scrolled within ~8px of the far edge; at start near 0.
                  setTabsScrollEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 8);
                  setTabsScrollStart(contentOffset.x <= 8);
                }}
              >
                {tabButtons}
              </ScrollView>
              {/* Left-edge chevron — tap to scroll back. Shows once scrolled away from start. */}
              {tabsScrollable && !tabsScrollStart && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.tabsScrollHint, styles.tabsScrollHintLeft]}
                  onPress={() => tabsScrollRef.current?.scrollTo?.({ x: 0, animated: true })}
                >
                  <Ionicons name="chevron-back" size={18} color="#0052FF" />
                </TouchableOpacity>
              )}
              {/* Right-edge chevron — tap to scroll the tabs forward. */}
              {tabsScrollable && !tabsScrollEnd && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.tabsScrollHint}
                  onPress={() => tabsScrollRef.current?.scrollToEnd?.({ animated: true })}
                >
                  <Ionicons name="chevron-forward" size={18} color="#0052FF" />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* Tab Content */}
        <View style={styles.tabContentContainer}>

          {/* ══════════════ ABOUT ══════════════ */}
          {activeTab === 'About' && (
            <View style={{ gap: 14 }}>

              {/* ── TRUST STRIP (soft hero: verification + metrics) ── */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                overflow: 'hidden',
                shadowColor: '#0A1551',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
              }}>
                {/* faux-gradient wash via stacked tints (behind content) */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 84, backgroundColor: '#EFF6FF' }} />
                <View style={{ position: 'absolute', top: -34, right: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: '#DBEAFE', opacity: 0.7 }} />
                <View style={{ position: 'absolute', top: 6, right: 26, width: 64, height: 64, borderRadius: 32, backgroundColor: '#BFDBFE', opacity: 0.6 }} />

                <View style={{ padding: 18 }}>
                  {/* eyebrow */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#0052FF' }} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF', letterSpacing: 1.2 }}>TRUST & CREDENTIALS</Text>
                  </View>

                  {/* PMDC verified row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 52, height: 52, borderRadius: 16,
                      backgroundColor: doctor.pmdcVerified ? '#DCFCE7' : '#FEF3C7',
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 1, borderColor: doctor.pmdcVerified ? '#BBF7D0' : '#FDE68A',
                    }}>
                      <Ionicons name={doctor.pmdcVerified ? 'shield-checkmark' : 'shield-outline'} size={26} color={doctor.pmdcVerified ? '#16A34A' : '#D97706'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 20 }}>
                        {doctor.pmdcVerified ? 'PMDC Verified' : 'PMDC Verification Pending'}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', lineHeight: 16, marginTop: 2 }}>
                        {doctor.pmdcVerified ? 'Licensed & registered practitioner' : 'Registration under review'}
                      </Text>
                    </View>
                  </View>

                  {/* divider */}
                  <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

                  {/* experience + rating + reviews mini-metrics */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#0A1551', lineHeight: 24 }}>{doctor.experience || 0}+</Text>
                      <Text style={{ fontSize: 9.5, color: '#64748B', fontWeight: '700', letterSpacing: 0.3, marginTop: 3 }} numberOfLines={1}>YEARS EXP.</Text>
                    </View>
                    <View style={{ width: 1, height: 30, backgroundColor: '#F1F5F9' }} />
                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="star" size={15} color="#D97706" />
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0A1551', lineHeight: 24 }}>{avgRating || '0.0'}</Text>
                      </View>
                      <Text style={{ fontSize: 9.5, color: '#64748B', fontWeight: '700', letterSpacing: 0.3, marginTop: 3 }} numberOfLines={1}>RATING</Text>
                    </View>
                    <View style={{ width: 1, height: 30, backgroundColor: '#F1F5F9' }} />
                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#0A1551', lineHeight: 24 }} numberOfLines={1}>{totalReviewCount || 0}</Text>
                      <Text style={{ fontSize: 9.5, color: '#64748B', fontWeight: '700', letterSpacing: 0.3, marginTop: 3 }} numberOfLines={1}>REVIEWS</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── BIOGRAPHY ── */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 18,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={16} color="#0052FF" />
                  </View>
                  <Text style={{ flex: 1, fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 }} numberOfLines={1}>ABOUT {drName(doctor.fullName).toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 13.5, color: '#475569', lineHeight: 22, fontWeight: '400' }}>
                  {doctor.about || 'No biography provided.'}
                </Text>
              </View>

              {/* ── CREDENTIALS LEDGER (full-width rows → never truncates) ── */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 2 }}>
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF' }} />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>CREDENTIALS</Text>
                </View>

                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                  {[
                    { icon: 'ribbon-outline', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', lbl: 'EXPERIENCE', val: (doctor.experience || 0) + ' years in dental practice' },
                    { icon: 'school-outline', color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', lbl: 'QUALIFICATION', val: doctor.qualification || 'BDS' },
                    { icon: 'medkit-outline', color: '#0052FF', bg: '#EFF6FF', border: '#BFDBFE', lbl: 'SPECIALIZATION', val: doctor.specialization || 'General Dentistry' },
                    doctor.pmdcVerified
                      ? { icon: 'shield-checkmark', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', lbl: 'PMDC REGISTRATION', val: 'Verified & registered practitioner' }
                      : { icon: 'shield-outline', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', lbl: 'PMDC REGISTRATION', val: 'Verification pending' },
                  ].map(function (r, i, arr) {
                    return (
                      <View key={i} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                        borderBottomColor: '#F1F5F9',
                      }}>
                        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: r.bg, borderWidth: 1, borderColor: r.border, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name={r.icon} size={21} color={r.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 3 }}>{r.lbl}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 19 }}>{r.val}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ── LANGUAGES ── */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={19} color="#0052FF" />
                  </View>
                  <Text style={{ flex: 1, fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 }} numberOfLines={1}>LANGUAGES SPOKEN</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(doctor.languages && doctor.languages.length ? doctor.languages : ['English', 'Urdu']).map(function (lang, i) {
                    return (
                      <View key={i} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        backgroundColor: '#EFF6FF',
                        borderWidth: 1, borderColor: '#DBEAFE',
                        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                      }}>
                        <Ionicons name="language-outline" size={13} color="#0052FF" />
                        <Text style={{ fontSize: 12.5, color: '#1D4ED8', fontWeight: '700' }}>{lang}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ── CLINIC LOCATION + TIMINGS ── */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#F1F5F9',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}>
                {/* header */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="business-outline" size={19} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 }}>CLINIC</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 19 }} numberOfLines={2}>
                      {doctor.clinicName || 'Clinic details'}
                    </Text>
                  </View>
                </View>

                {/* address row */}
                {(doctor.address || doctor.city) ? (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <Ionicons name="location-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 12.5, color: '#475569', fontWeight: '500', lineHeight: 18 }}>
                      {[doctor.address, doctor.city].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ) : null}

                {/* timings — one row per line from formatClinicTiming (days / morning / evening / off) */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Ionicons name="time-outline" size={15} color="#0052FF" />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 }}>OPENING HOURS</Text>
                  </View>
                  <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 4 }}>
                    {String(formatClinicTiming(doctor.clinicTiming) || '').split('\n').filter(function (l) { return l.trim().length; }).map(function (line, i, all) {
                      var text = line.trim();
                      var closed = /off|clos|holiday/i.test(text);
                      var morning = /morning/i.test(text);
                      var evening = /evening|night/i.test(text);
                      var ic = closed ? 'moon-outline' : morning ? 'sunny-outline' : evening ? 'partly-sunny-outline' : 'calendar-outline';
                      var icColor = closed ? '#94A3B8' : morning ? '#D97706' : evening ? '#7C3AED' : '#0052FF';
                      return (
                        <View key={i} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 11,
                          borderBottomWidth: i === all.length - 1 ? 0 : 1,
                          borderBottomColor: '#F1F5F9',
                        }}>
                          <Ionicons name={ic} size={16} color={icColor} />
                          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: closed ? '#94A3B8' : '#334155', lineHeight: 18 }}>{text}</Text>
                          {closed ? (
                            <View style={{ backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.4 }}>CLOSED</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

            </View>
          )}

          {/* ══════════════ TREATMENTS ══════════════ */}
          {activeTab === 'Treatments' && (
            <View>
              {/* ─── Header ─── */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF', marginRight: 8 }} />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>MENU OF CARE</Text>
                </View>
                <Text style={{ fontSize: 23, fontWeight: '800', color: '#0A1551', letterSpacing: -0.4 }}>Treatments</Text>
                <Text style={{ fontSize: 13.5, color: '#64748B', marginTop: 4, lineHeight: 20 }}>
                  Services offered by {drName(doctor.fullName)}, with clear and upfront pricing.
                </Text>
              </View>

              {(() => {
                if (!treatments || treatments.length === 0) {
                  return (
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                      <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Ionicons name="medkit-outline" size={28} color="#0052FF" />
                      </View>
                      <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#0F172A' }}>No treatments listed yet</Text>
                      <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                        {drName(doctor.fullName)} hasn't added a service menu yet. You can still book a consultation to discuss your care.
                      </Text>
                    </View>
                  );
                }

                const fmt = (v) => (Number(v) || 0).toLocaleString();

                // Derive a soft icon + colour from the treatment name (case-insensitive).
                const meta = (rawName) => {
                  const n = (rawName || '').toLowerCase();
                  if (/(whiten|bleach)/.test(n)) return { icon: 'sparkles-outline', fg: '#D97706', bg: '#FEF3C7', bd: '#FDE68A' };
                  if (/(crown|cap|veneer)/.test(n)) return { icon: 'diamond-outline', fg: '#7C3AED', bg: '#EDE9FE', bd: '#DDD6FE' };
                  if (/(root\s*canal|rct|endo)/.test(n)) return { icon: 'medical-outline', fg: '#DC2626', bg: '#FEE2E2', bd: '#FECACA' };
                  if (/(fill|cavity|restor|composite)/.test(n)) return { icon: 'bandage-outline', fg: '#7C3AED', bg: '#EDE9FE', bd: '#DDD6FE' };
                  if (/(denture|bridge)/.test(n)) return { icon: 'medkit-outline', fg: '#0052FF', bg: '#EFF6FF', bd: '#DBEAFE' };
                  if (/(implant)/.test(n)) return { icon: 'construct-outline', fg: '#0052FF', bg: '#DBEAFE', bd: '#BFDBFE' };
                  if (/(extract|removal|wisdom)/.test(n)) return { icon: 'cut-outline', fg: '#DC2626', bg: '#FEE2E2', bd: '#FECACA' };
                  if (/(scal|clean|polish|hygiene)/.test(n)) return { icon: 'water-outline', fg: '#0052FF', bg: '#EFF6FF', bd: '#DBEAFE' };
                  if (/(check|exam|consult)/.test(n)) return { icon: 'clipboard-outline', fg: '#16A34A', bg: '#DCFCE7', bd: '#BBF7D0' };
                  if (/(x-?ray|radiograph|scan)/.test(n)) return { icon: 'scan-outline', fg: '#475569', bg: '#F1F5F9', bd: '#E2E8F0' };
                  if (/(brace|align|ortho|invisalign)/.test(n)) return { icon: 'git-compare-outline', fg: '#0052FF', bg: '#EFF6FF', bd: '#DBEAFE' };
                  return { icon: 'medkit-outline', fg: '#0052FF', bg: '#EFF6FF', bd: '#DBEAFE' };
                };

                const mins = treatments.map((t) => Number(t.priceMin) || 0).filter((v) => v > 0);
                const startFrom = mins.length ? Math.min(...mins) : 0;

                return (
                  <View>
                    {/* ─── Simple summary strip ─── */}
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Ionicons name="pricetags-outline" size={22} color="#0052FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                          {treatments.length} {treatments.length === 1 ? 'Treatment' : 'Treatments'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Transparent, upfront pricing</Text>
                      </View>
                      {startFrom > 0 && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 }}>FROM</Text>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0A1551', letterSpacing: -0.3 }}>PKR {fmt(startFrom)}</Text>
                        </View>
                      )}
                    </View>

                    {/* ─── Single clean list card ─── */}
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 16, marginTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                      {treatments.map((t, i) => {
                        const m = meta(t.name);
                        const isLast = i === treatments.length - 1;
                        const min = Number(t.priceMin) || 0;
                        const max = Number(t.priceMax) || 0;
                        const samePrice = !max || max === min;
                        return (
                          <View
                            key={t._id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 16,
                              borderBottomWidth: isLast ? 0 : 1,
                              borderBottomColor: '#F1F5F9',
                            }}
                          >
                            {/* icon chip */}
                            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: m.bg, borderWidth: 1, borderColor: m.bd, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                              <Ionicons name={m.icon} size={21} color={m.fg} />
                            </View>

                            {/* name (wraps freely) */}
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', lineHeight: 21 }}>
                                {t.name}
                              </Text>
                            </View>

                            {/* price — right aligned, never collides */}
                            <View style={{ alignItems: 'flex-end', flexShrink: 0, maxWidth: 132 }}>
                              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.6, marginBottom: 2 }}>PKR</Text>
                              <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0A1551', textAlign: 'right', lineHeight: 19 }}>
                                {samePrice ? fmt(min || max) : fmt(min) + ' – ' + fmt(max)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* ─── Footer reassurance ─── */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 4, paddingHorizontal: 8 }}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 17 }}>
                        Estimated prices · Final cost confirmed after your consultation
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ══════════════ GALLERY ══════════════ */}
          {activeTab === 'Gallery' && (
            <View>
              {/* ══════════════ CLINIC PHOTOS ══════════════ */}
              <View style={{ marginBottom: 16 }}>
                {/* eyebrow */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF' }} />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>CLINIC PHOTOS</Text>
                  <View style={{ flex: 1 }} />
                  {clinicPhotos.length > 0 ? (
                    <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF' }}>{clinicPhotos.length}</Text>
                    </View>
                  ) : null}
                </View>

                {/* card */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  {/* header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="business-outline" size={22} color="#0052FF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>Inside the Clinic</Text>
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 }}>A look at the practice & facilities</Text>
                    </View>
                  </View>

                  {clinicPhotos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 2 }}>
                      {clinicPhotos.map((item, idx) => (
                        <TouchableOpacity
                          key={item._id}
                          activeOpacity={0.85}
                          onPress={() => setLightboxUri(imgUrl(item.imageUrl))}
                          style={{ marginRight: idx === clinicPhotos.length - 1 ? 0 : 10 }}
                        >
                          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' }}>
                            <ShimmerImage source={{ uri: imgUrl(item.imageUrl) }} style={{ width: 200, height: 134, resizeMode: 'cover' }} />
                            {/* corner expand affordance */}
                            <View style={{ position: 'absolute', bottom: 8, right: 8, width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(10,21,81,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE', paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center' }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="camera-outline" size={26} color="#0052FF" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>Clinic photos coming soon</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 17, marginTop: 5 }}>This dentist hasn't added photos of their space yet. Check back to preview the clinic.</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ══════════════ BEFORE & AFTER ══════════════ */}
              <View style={{ marginBottom: 16 }}>
                {/* eyebrow */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#7C3AED' }} />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>BEFORE & AFTER</Text>
                  <View style={{ flex: 1 }} />
                  {beforeAfters.length > 0 ? (
                    <View style={{ backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#7C3AED' }}>{beforeAfters.length}</Text>
                    </View>
                  ) : null}
                </View>

                {/* card */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  {/* header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="sparkles-outline" size={21} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>Treatment Results</Text>
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 }}>Real smile transformations</Text>
                    </View>
                  </View>

                  {beforeAfters.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 2 }}>
                      {beforeAfters.map((item, idx) => (
                        <View key={item._id} style={{ marginRight: idx === beforeAfters.length - 1 ? 0 : 12, width: 236 }}>
                          {item.beforeImage && item.afterImage ? (
                            <View style={{ flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' }}>
                              {/* BEFORE half */}
                              <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(imgUrl(item.beforeImage))} style={{ flex: 1 }}>
                                <ShimmerImage source={{ uri: imgUrl(item.beforeImage) }} style={{ width: '100%', height: 140, resizeMode: 'cover' }} />
                                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>BEFORE</Text>
                                </View>
                              </TouchableOpacity>
                              {/* seam */}
                              <View style={{ width: 2, backgroundColor: '#FFFFFF' }} />
                              {/* AFTER half */}
                              <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(imgUrl(item.afterImage))} style={{ flex: 1 }}>
                                <ShimmerImage source={{ uri: imgUrl(item.afterImage) }} style={{ width: '100%', height: 140, resizeMode: 'cover' }} />
                                <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(22,163,74,0.92)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>AFTER</Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(imgUrl(item.imageUrl || item.beforeImage || item.afterImage))}>
                              <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' }}>
                                <ShimmerImage source={{ uri: imgUrl(item.imageUrl || item.beforeImage || item.afterImage) }} style={{ width: 236, height: 140, resizeMode: 'cover' }} />
                                <View style={{ position: 'absolute', bottom: 8, right: 8, width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(10,21,81,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                                </View>
                              </View>
                            </TouchableOpacity>
                          )}
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#334155', textAlign: 'center', marginTop: 8 }} numberOfLines={1}>
                            {item.title || 'Smile Transformation'}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6FE', paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center' }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="happy-outline" size={26} color="#7C3AED" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>No results shared yet</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 17, marginTop: 5 }}>Before & after comparisons will appear here once this dentist showcases their work.</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ══════════════ CERTIFICATES & AWARDS ══════════════ */}
              <View style={{ marginBottom: 8 }}>
                {/* eyebrow */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#16A34A' }} />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>CERTIFICATES & AWARDS</Text>
                  <View style={{ flex: 1 }} />
                  {certificates.length > 0 ? (
                    <View style={{ backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#16A34A' }}>{certificates.length}</Text>
                    </View>
                  ) : null}
                </View>

                {/* card */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  {/* header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="ribbon-outline" size={22} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>Qualifications</Text>
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 }}>Credentials & achievements</Text>
                    </View>
                  </View>

                  {certificates.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 2 }}>
                      {certificates.map((item, idx) => (
                        <TouchableOpacity
                          key={item._id}
                          activeOpacity={0.85}
                          onPress={() => setLightboxUri(imgUrl(item.imageUrl))}
                          style={{ marginRight: idx === certificates.length - 1 ? 0 : 10 }}
                        >
                          <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', padding: 5 }}>
                            <View style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                              <ShimmerImage source={{ uri: imgUrl(item.imageUrl) }} style={{ width: 128, height: 168, resizeMode: 'cover' }} />
                            </View>
                            <View style={{ position: 'absolute', top: 10, left: 10, width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(22,163,74,0.92)', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="ribbon" size={13} color="#FFFFFF" />
                            </View>
                            <View style={{ position: 'absolute', bottom: 11, right: 11, width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(22,163,74,0.9)', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0', paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center' }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="school-outline" size={26} color="#16A34A" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>Credentials on file</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 17, marginTop: 5 }}>Certificates and awards will be displayed here as this dentist adds them.</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* tap-to-view affordance */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 2 }}>
                <Ionicons name="scan-outline" size={13} color="#94A3B8" style={{ marginRight: 5 }} />
                <Text style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: '500', textAlign: 'center' }}>Tap any image to view full size</Text>
              </View>
            </View>
          )}

          {/* ══════════════ FACILITIES & SERVICES ══════════════ */}
          {activeTab === 'Facilities' && (() => {
            const tierKey = facilityScore >= 31 ? 'elite' : facilityScore >= 16 ? 'modern' : facilityScore >= 1 ? 'standard' : 'unrated';
            const gradeIcon = tierKey === 'elite' ? 'ribbon' : tierKey === 'modern' ? 'business' : 'shield-checkmark';
            const tagLabel = (tier.label || 'Unrated').replace(' Clinic', '').toUpperCase();
            const cardBase = { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 };
            const LEGENDS = [
              { key: 'elite',    icon: 'ribbon',           name: 'Elite Clinic',    range: '31+ Points',     color: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
              { key: 'modern',   icon: 'business',         name: 'Modern Clinic',   range: '16 – 30 Points', color: '#0052FF', bg: '#EFF6FF', bd: '#BFDBFE' },
              { key: 'standard', icon: 'shield-checkmark', name: 'Standard Clinic', range: '1 – 15 Points',  color: '#64748B', bg: '#F8FAFC', bd: '#E2E8F0' },
            ];
            const tierDark = ({ elite: '#B45309', modern: '#1E40AF', standard: '#475569', unrated: '#64748B' })[tierKey];
            return (
              <View style={{ gap: 14 }}>

                {/* ── Clinic Grade — certification badge (medallion + ribbon) ── */}
                <View style={[cardBase, { padding: 20, paddingBottom: 18, alignItems: 'center' }]}>
                  {/* eyebrow */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Ionicons name="sparkles" size={11} color={tier.color} style={{ marginRight: 7 }} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.6 }}>CERTIFIED CLINIC GRADE</Text>
                    <Ionicons name="sparkles" size={11} color={tier.color} style={{ marginLeft: 7 }} />
                  </View>

                  {/* medallion seal */}
                  <View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: tier.bg, borderWidth: 2, borderColor: tier.color + '4D', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ position: 'absolute', top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: tier.color }} />
                    <View style={{ position: 'absolute', bottom: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: tier.color + '66' }} />
                    <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: tier.color, justifyContent: 'center', alignItems: 'center', shadowColor: tier.color, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 7, elevation: 3 }}>
                      <Ionicons name={gradeIcon} size={26} color={tier.color} />
                      <Text style={{ fontSize: 23, fontWeight: '900', color: '#0A1551', lineHeight: 25, marginTop: 1 }}>{facilityScore}</Text>
                      <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 }}>POINTS</Text>
                    </View>
                  </View>

                  {/* ribbon banner with fishtail ends */}
                  <View style={{ marginTop: -14, height: 34, borderRadius: 4, backgroundColor: tier.color, justifyContent: 'center', paddingHorizontal: 28, shadowColor: tierDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 }}>{tier.label.toUpperCase()}</Text>
                    <View style={{ position: 'absolute', left: 0, width: 0, height: 0, borderTopWidth: 17, borderBottomWidth: 17, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFFFFF' }} />
                    <View style={{ position: 'absolute', right: 0, width: 0, height: 0, borderTopWidth: 17, borderBottomWidth: 17, borderRightWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#FFFFFF' }} />
                  </View>

                  {/* verified + description */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                    <Ionicons name="shield-checkmark" size={13} color="#16A34A" style={{ marginRight: 5 }} />
                    <Text style={{ fontSize: 11.5, color: '#16A34A', fontWeight: '800' }}>Verified facility profile</Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18, marginHorizontal: 6 }}>{tier.desc}</Text>
                </View>

                {/* ── Verified Highlights ── */}
                <View style={[cardBase, { padding: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#16A34A', marginRight: 8 }} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>VERIFIED HIGHLIGHTS</Text>
                  </View>
                  {['Verified Services', 'High Patient Satisfaction', 'Advanced Technology', 'Hygiene & Safety'].map((h, i, arr) => (
                    <View key={h} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: '#F1F5F9' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginRight: 11 }}>
                        <Ionicons name="checkmark" size={16} color="#16A34A" />
                      </View>
                      <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#0F172A' }}>{h}</Text>
                    </View>
                  ))}
                </View>

                {/* ── Available Services ── */}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                    <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF', marginRight: 8 }} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>AVAILABLE SERVICES</Text>
                    <View style={{ flex: 1 }} />
                    {facilityList.length > 0 ? (
                      <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF' }}>{facilityList.length}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[cardBase, { padding: 14 }]}>
                    {facilityList.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {facilityList.map((fac, idx) => (
                          <View key={idx} style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 9 }}>
                            <Ionicons name="checkmark-circle" size={16} color="#0052FF" style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#0F172A', flex: 1 }} numberOfLines={2}>{fac.label}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ paddingVertical: 22, alignItems: 'center' }}>
                        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                          <Ionicons name="business-outline" size={26} color="#0052FF" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>No services listed yet</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '500', textAlign: 'center', lineHeight: 17, marginTop: 5 }}>This clinic hasn't listed its facilities & services yet.</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ── Clinic Grade legend ── */}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                    <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#D97706', marginRight: 8 }} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>CLINIC GRADES</Text>
                  </View>
                  <View style={{ gap: 10 }}>
                    {LEGENDS.map((lg) => {
                      const active = tierKey === lg.key;
                      return (
                        <View key={lg.key} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: lg.bg, borderWidth: active ? 2 : 1, borderColor: active ? lg.color : lg.bd, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
                          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: lg.color, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Ionicons name={lg.icon} size={15} color="#FFFFFF" />
                          </View>
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0A1551', flex: 1 }}>{lg.name}</Text>
                          {active && (
                            <View style={{ backgroundColor: lg.color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 }}>THIS CLINIC</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748B' }}>{lg.range}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

              </View>
            );
          })()}

          {/* ══════════════ REVIEWS (REDESIGNED) ══════════════ */}
          {activeTab === 'Reviews' && (
            <View>

              {/* ── Overall Rating ── */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Patient Reviews</Text>
                <TouchableOpacity
                  style={{ backgroundColor: hasCompletedAppointment ? '#EFF6FF' : '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: hasCompletedAppointment ? '#BFDBFE' : '#E2E8F0', flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    if (!hasCompletedAppointment) {
                      Alert.alert('Treatment Required', 'You can only review a doctor after completing a treatment with them. Book an appointment first!');
                      return;
                    }
                    setShowReviewModal(true);
                  }}
                >
                  <Ionicons name={hasCompletedAppointment ? 'create-outline' : 'lock-closed-outline'} size={14} color={hasCompletedAppointment ? '#0052FF' : '#94A3B8'} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, color: hasCompletedAppointment ? '#0052FF' : '#94A3B8', fontWeight: 'bold' }}>
                    {hasCompletedAppointment ? '+ Write a Review' : 'Complete Treatment First'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.ratingOverallCard}>
                <View style={styles.ratingBigCol}>
                  <Text style={styles.ratingBigNum}>{avgRating}</Text>
                  <View style={styles.starsRowLarge}>
                    {[1,2,3,4,5].map(i => (
                      <Ionicons key={i} name={i <= Math.round(Number(avgRating)) ? 'star' : 'star-outline'} size={18} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.ratingReviewCount}>({totalReviewCount} Reviews)</Text>
                  <View style={styles.recommendRow}>
                    <Ionicons name="thumbs-up" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                    <Text style={styles.recommendText}>{recommendPct}% Recommend</Text>
                  </View>
                </View>
                <View style={styles.starBarsCol}>
                  {starCounts.map(({ star, count }) => {
                    const pct = totalReviewCount > 0 ? Math.min(1, Math.max(0, count / totalReviewCount)) : 0;
                    const fillColor = star >= 4 ? '#16A34A' : star === 3 ? '#F59E0B' : '#EF4444';
                    return (
                      <View key={star} style={styles.starBarRow}>
                        <Text style={styles.starBarLabel}>{star}★</Text>
                        <View style={styles.starBarBg}>
                          <View style={{ flexDirection: 'row', flex: 1, height: 7 }}>
                            {pct > 0 && <View style={{ flex: pct, height: 7, backgroundColor: fillColor, borderRadius: 4 }} />}
                            {pct < 1 && <View style={{ flex: 1 - pct, height: 7 }} />}
                          </View>
                        </View>
                        <Text style={styles.starBarCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ── Individual Review Cards ── */}
              {reviews.length > 0 ? reviews.map((r, idx) => (
                <View key={r._id || idx} style={styles.reviewCardNew}>
                  <View style={styles.reviewCardTop}>
                    <View style={styles.avatarInitial}>
                      <Text style={styles.avatarInitialText}>
                        {((r.patientId?.fullName || r.name || 'P')[0] || 'P').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.reviewerRow}>
                        <Text style={styles.reviewerNameNew}>{r.patientId?.fullName || r.name || 'Patient'}</Text>
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={10} color="#16A34A" style={{ marginRight: 2 }} />
                          <Text style={styles.verifiedText}>Verified Patient</Text>
                        </View>
                      </View>
                      <View style={styles.reviewMetaRow}>
                        <View style={styles.starsRowSmall}>
                          {[1,2,3,4,5].map(i => (
                            <Ionicons key={i} name={i <= r.rating ? 'star' : 'star-outline'} size={11} color="#F59E0B" />
                          ))}
                        </View>
                        <Text style={styles.reviewDateNew}>
                          {r.createdAt ? (() => { try { return new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return r.date || ''; } })() : r.date || ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.reviewCommentNew}>{r.comment ? String(r.comment) : ''}</Text>
                  {(r.doctorReply?.text || (typeof r.doctorReply === 'string' && r.doctorReply)) ? (
                    <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#0052FF' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="chatbubble-outline" size={13} color="#0052FF" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0052FF' }}>Doctor's Reply</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 18 }}>{r.doctorReply?.text || r.doctorReply}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity>
                    <Text style={styles.helpfulLink}>Helpful ({Number(r.helpful) || 0})</Text>
                  </TouchableOpacity>
                </View>
              )) : (
                <Text style={styles.emptyText}>No patient reviews available yet.</Text>
              )}
            </View>
          )}

          {/* ══════════════ APPOINTMENTS ══════════════ */}
          {activeTab === 'Appointments' && (
            <View>
              {/* ── Header: My Appointments with Dr. X ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 2 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={22} color="#0052FF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#0F172A' }}>My Appointments</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 }} numberOfLines={1}>with {drName(doctor.fullName)}</Text>
                </View>
              </View>

              {appointments.length > 0 ? (
                (() => {
                  // ── Status resolver: covers every status; unknown falls back to slate ──
                  const statusStyle = (raw) => {
                    const s = (raw || '').toLowerCase();
                    switch (s) {
                      case 'confirmed': return { bg: '#DCFCE7', border: '#BBF7D0', text: '#16A34A', tileBg: '#F0FDF4', icon: 'checkmark-circle', label: 'Confirmed' };
                      case 'pending':   return { bg: '#FEF3C7', border: '#FDE68A', text: '#D97706', tileBg: '#FFFBEB', icon: 'time-outline', label: 'Pending' };
                      case 'completed': return { bg: '#DBEAFE', border: '#BFDBFE', text: '#0A1551', tileBg: '#EFF6FF', icon: 'checkmark-done-circle', label: 'Completed' };
                      case 'cancelled': return { bg: '#FEE2E2', border: '#FECACA', text: '#DC2626', tileBg: '#FEF2F2', icon: 'close-circle', label: 'Cancelled' };
                      default:          return { bg: '#F1F5F9', border: '#E2E8F0', text: '#64748B', tileBg: '#F8FAFC', icon: 'ellipse-outline', label: (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Scheduled') };
                    }
                  };

                  // Sortable timestamp from date + time string (safe against bad input).
                  const ts = (apt) => {
                    const d = new Date(apt.date);
                    let base = isNaN(d.getTime()) ? 0 : d.getTime();
                    const m = /^(\d{1,2}):(\d{2})/.exec(apt.time || '');
                    if (m) base += (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 60000;
                    return base;
                  };

                  // Relative-day label from today (Today / Tomorrow / In N days / N days ago).
                  const relLabel = (apt) => {
                    const d = new Date(apt.date);
                    if (isNaN(d.getTime())) return '';
                    const s = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
                    const diff = Math.round((s(d) - s(new Date())) / 86400000);
                    if (diff === 0) return 'Today';
                    if (diff === 1) return 'Tomorrow';
                    if (diff === -1) return 'Yesterday';
                    return diff > 1 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
                  };

                  const upcoming = appointments
                    .filter(a => a.status === 'confirmed' || a.status === 'pending')
                    .sort((a, b) => ts(a) - ts(b)); // soonest first
                  const past = appointments
                    .filter(a => a.status !== 'confirmed' && a.status !== 'pending')
                    .sort((a, b) => ts(b) - ts(a)); // most recent first

                  // ── Timeline item: a vertical rail (connector + status dot) beside a tappable card ──
                  const renderItem = (apt, i, arr, accent) => {
                    const ti = getTreatmentIcon(apt.treatmentType);
                    const ss = statusStyle(apt.status);
                    const isCompleted = (apt.status || '').toLowerCase() === 'completed';
                    const isUpcoming = apt.status === 'confirmed' || apt.status === 'pending';
                    const isNext = accent === '#0052FF' && i === 0;
                    const rel = isUpcoming ? relLabel(apt) : '';
                    const soon = rel === 'Today' || rel === 'Tomorrow';
                    const d = new Date(apt.date);
                    const valid = !isNaN(d.getTime());
                    const dayNum = valid ? d.getDate() : '--';
                    const monthStr = valid ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
                    const isFirst = i === 0;
                    const isLast = i === arr.length - 1;
                    const rail = '#E6EBF2';

                    return (
                      <View key={apt._id} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                        {/* Rail: top connector · status dot · bottom connector */}
                        <View style={{ width: 26, alignItems: 'center' }}>
                          <View style={{ width: 2.5, height: 22, borderRadius: 2, backgroundColor: isFirst ? 'transparent' : rail }} />
                          <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: isNext ? ss.text : '#FFFFFF', borderWidth: 3, borderColor: ss.text, justifyContent: 'center', alignItems: 'center' }}>
                            {isNext ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} /> : null}
                          </View>
                          <View style={{ width: 2.5, flex: 1, borderRadius: 2, backgroundColor: isLast ? 'transparent' : rail }} />
                        </View>

                        {/* Content column (paddingBottom lives here so the rail spans the gap) */}
                        <View style={{ flex: 1, paddingBottom: isLast ? 2 : 14, marginLeft: 6 }}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate('AppointmentDetail', { appointment: { ...apt, doctorId: apt.doctorId || doctor } })}
                            style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: isNext ? 1.5 : 1, borderColor: isNext ? '#BFDBFE' : '#EEF2F7', padding: 13, shadowColor: isNext ? '#0052FF' : '#0A1551', shadowOffset: { width: 0, height: isNext ? 4 : 2 }, shadowOpacity: isNext ? 0.1 : 0.04, shadowRadius: isNext ? 12 : 8, elevation: isNext ? 4 : 2 }}
                          >
                            {isNext ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#0052FF', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 10 }}>
                                <Ionicons name="flash" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6 }}>NEXT VISIT</Text>
                              </View>
                            ) : null}

                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {/* treatment icon */}
                              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: ti.color + '18', borderWidth: 1, borderColor: ti.color + '2E', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name={ti.icon} size={18} color={ti.color} />
                              </View>
                              <View style={{ flex: 1, marginLeft: 11 }}>
                                {/* time · date */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                  <Ionicons name="time-outline" size={12} color={ss.text} style={{ marginRight: 3 }} />
                                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: ss.text }}>{apt.time}</Text>
                                  <Text style={{ fontSize: 12, color: '#CBD5E1', marginHorizontal: 5 }}>·</Text>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B' }}>{dayNum} {monthStr}</Text>
                                </View>
                                <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A', lineHeight: 19 }} numberOfLines={1}>{apt.treatmentType}</Text>
                                {/* status + relative chip */}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 7 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: ss.bg, borderWidth: 1, borderColor: ss.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5, marginRight: 6, marginBottom: 2 }}>
                                    <Ionicons name={ss.icon} size={10} color={ss.text} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: ss.text, letterSpacing: 0.4 }}>{ss.label.toUpperCase()}</Text>
                                  </View>
                                  {isUpcoming && rel ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: soon ? '#0052FF' : '#EFF6FF', borderWidth: 1, borderColor: soon ? '#0052FF' : '#DBEAFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3.5, marginBottom: 2 }}>
                                      <Ionicons name="hourglass-outline" size={9} color={soon ? '#FFFFFF' : '#0052FF'} style={{ marginRight: 3 }} />
                                      <Text style={{ fontSize: 9.5, fontWeight: '800', color: soon ? '#FFFFFF' : '#0052FF' }}>{rel}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 4 }} />
                            </View>

                            {/* completed: visit summary tri-state */}
                            {apt.visitSummary ? (
                              <View style={{ marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                                <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 5 }}>VISIT SUMMARY</Text>
                                <Text style={{ fontSize: 12.5, color: '#334155', lineHeight: 18, fontWeight: '500' }}>{apt.visitSummary}</Text>
                              </View>
                            ) : isCompleted ? (
                              <View style={{ marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="document-text-outline" size={13} color="#94A3B8" />
                                <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#94A3B8', marginLeft: 7, flex: 1, lineHeight: 16 }}>No treatment record entered yet.</Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  };

                  return (
                    <View>
                      {/* UPCOMING */}
                      {upcoming.length > 0 ? (
                        <View style={{ marginBottom: 18 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                            <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF' }} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>UPCOMING</Text>
                            <View style={{ flex: 1 }} />
                            <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF' }}>{upcoming.length}</Text>
                            </View>
                          </View>
                          {upcoming.map((apt, i) => renderItem(apt, i, upcoming, '#0052FF'))}
                        </View>
                      ) : null}

                      {/* PAST — neutral slate eyebrow (statuses inside are mixed) */}
                      {past.length > 0 ? (
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                            <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#94A3B8' }} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>PAST</Text>
                            <View style={{ flex: 1 }} />
                            <View style={{ backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#64748B' }}>{past.length}</Text>
                            </View>
                          </View>
                          {past.map((apt, i) => renderItem(apt, i, past, '#94A3B8'))}
                        </View>
                      ) : null}
                    </View>
                  );
                })()
              ) : (
                /* ── Premium empty state ── */
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', paddingVertical: 32, paddingHorizontal: 22, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                    <Ionicons name="calendar-outline" size={27} color="#0052FF" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>No appointments yet</Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 18, marginTop: 6 }}>You haven't booked any appointments with this doctor.</Text>
                </View>
              )}
            </View>
          )}

          {/* ══════════════ BILLS (ENHANCED) ══════════════ */}
          {activeTab === 'Bills & Bill History' && (
            <View>
              {(() => {
                const statusMeta = (s) => {
                  switch (s) {
                    case 'paid':
                      return { label: 'Paid', text: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', icon: 'checkmark-circle' };
                    case 'unpaid':
                      return { label: 'Unpaid', text: '#DC2626', bg: '#FEE2E2', border: '#FECACA', icon: 'alert-circle' };
                    case 'payment_pending':
                      return { label: 'Pending', text: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: 'time' };
                    case 'draft':
                      return { label: 'Draft', text: '#475569', bg: '#F1F5F9', border: '#E2E8F0', icon: 'document-text' };
                    default:
                      return { label: (s ? String(s).replace(/_/g, ' ') : 'Other'), text: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', icon: 'ellipse' };
                  }
                };
                const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return '—'; } };
                const cardShadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 };
                const dueAmount = unpaidBill ? (() => {
                  const fin = unpaidBill.finalAmount != null ? unpaidBill.finalAmount : unpaidBill.amount;
                  const paid = unpaidBill.paidAmount != null ? unpaidBill.paidAmount : 0;
                  const rem = Number(fin || 0) - Number(paid || 0);
                  return rem > 0 ? rem : Number(unpaidBill.amount || 0);
                })() : 0;

                return (
                  <>
                    {/* ══════════════ HERO SUMMARY CARD ══════════════ */}
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                        <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF' }} />
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>BILLING OVERVIEW</Text>
                        <View style={{ flex: 1 }} />
                        <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF' }}>{totalBillsCount} total</Text>
                        </View>
                      </View>

                      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E8EEF9', overflow: 'hidden', ...cardShadow }}>
                        <View style={{ position: 'absolute', top: -46, right: -36, width: 150, height: 150, borderRadius: 75, backgroundColor: '#F1F6FF' }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: totalOutstanding > 0 ? '#EF4444' : '#16A34A', marginRight: 7 }} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#64748B', letterSpacing: 1.4 }}>TOTAL OUTSTANDING</Text>
                          </View>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="wallet-outline" size={20} color="#0052FF" />
                          </View>
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 30, fontWeight: '900', color: totalOutstanding > 0 ? '#0A1551' : '#16A34A', letterSpacing: 0.2 }}>
                          PKR {Number(totalOutstanding || 0).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 3 }}>
                          {totalOutstanding > 0 ? 'Amount still due across all invoices' : 'You are all settled up — nothing due'}
                        </Text>

                        {/* 2x2 mini-stat grid — three DISTINCT metrics (no duplicate Outstanding) */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, marginHorizontal: -5 }}>
                          {[
                            { key: 'inv', label: 'Invoices', value: `${totalBillsCount}`, tint: '#0052FF', bg: '#EFF6FF', border: '#DBEAFE', icon: 'receipt-outline', sub: 'On record' },
                            { key: 'paid', label: 'Paid', value: `PKR ${Number(totalPaidAmount || 0).toLocaleString()}`, tint: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: 'checkmark-done-outline', sub: 'Settled to date' },
                            { key: 'disc', label: 'Discount', value: `PKR ${Number(totalDiscount || 0).toLocaleString()}`, tint: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: 'gift-outline', sub: 'From rewards' },
                            { key: 'due', label: 'Outstanding', value: `PKR ${Number(totalOutstanding || 0).toLocaleString()}`, tint: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'alert-circle-outline', sub: 'Still due' },
                          ].map((s) => (
                            <View key={s.key} style={{ width: '50%', paddingHorizontal: 5, marginBottom: 10 }}>
                              <View style={{ backgroundColor: s.bg, borderRadius: 14, borderWidth: 1, borderColor: s.border, paddingVertical: 11, paddingHorizontal: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                  <Ionicons name={s.icon} size={14} color={s.tint} />
                                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginLeft: 6 }}>{s.label.toUpperCase()}</Text>
                                </View>
                                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: '900', color: s.tint }}>{s.value}</Text>
                                <Text style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600', marginTop: 2 }}>{s.sub}</Text>
                              </View>
                            </View>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Ionicons name="shield-checkmark" size={15} color="#16A34A" />
                          <Text style={{ flex: 1, fontSize: 11, color: '#64748B', fontWeight: '600', marginLeft: 8, lineHeight: 15 }}>
                            All transactions are encrypted and processed securely.
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ══════════════ AMOUNT DUE (unpaidBill) ══════════════ */}
                    {unpaidBill ? (
                      <View style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                          <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#D97706' }} />
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>UPCOMING PAYMENT</Text>
                        </View>

                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#FDE68A', padding: 16, ...cardShadow }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="alarm-outline" size={24} color="#D97706" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#D97706', letterSpacing: 0.8, marginRight: 8 }}>AMOUNT DUE</Text>
                                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#FDE68A', marginTop: 2 }}>
                                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#D97706' }}>Due {fmtDate(unpaidBill.dueDate || unpaidBill.createdAt)}</Text>
                                </View>
                              </View>
                              <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A', lineHeight: 19 }}>{unpaidBill.treatmentName || 'Treatment'}</Text>
                              <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 }}>Billed {fmtDate(unpaidBill.createdAt)}</Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', paddingVertical: 12, paddingHorizontal: 14, marginTop: 14 }}>
                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#92400E', marginRight: 10 }}>Total to pay</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontSize: 22, fontWeight: '900', color: '#0A1551', textAlign: 'right' }}>PKR {Number(dueAmount).toLocaleString()}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => handlePayBill(unpaidBill)}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 13, ...cardShadow }}
                            >
                              <Ionicons name="card-outline" size={17} color="#FFFFFF" style={{ marginRight: 7 }} />
                              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Pay Now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => { setSelectedBillDetail(unpaidBill); setShowBillDetailModal(true); }}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0052FF' }}>Details</Text>
                              <Ionicons name="chevron-forward" size={14} color="#0052FF" style={{ marginLeft: 2 }} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {/* ══════════════ INVOICES LIST ══════════════ */}
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 }}>
                        <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF' }} />
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4, marginLeft: 7 }}>INVOICES</Text>
                        <View style={{ flex: 1 }} />
                        {bills.length > 0 ? (
                          <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0052FF' }}>{bills.length}</Text>
                          </View>
                        ) : null}
                      </View>

                      {bills.length > 0 ? (
                        bills.map((bill, idx) => {
                          const ti = getTreatmentIcon(bill.treatmentName);
                          const meta = statusMeta(bill.status);
                          const isUnpaid = bill.status === 'unpaid';
                          return (
                            <View
                              key={bill._id || idx}
                              style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 14, marginBottom: idx === bills.length - 1 ? 0 : 12, ...cardShadow }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (ti.color || '#0052FF') + '18', borderWidth: 1, borderColor: (ti.color || '#0052FF') + '33', justifyContent: 'center', alignItems: 'center' }}>
                                  <Ionicons name={ti.icon} size={21} color={ti.color || '#0052FF'} />
                                </View>

                                <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="receipt-outline" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
                                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '800', color: '#0052FF', letterSpacing: 0.4 }}>
                                      {bill.invoiceNumber || 'Invoice'}
                                    </Text>
                                  </View>
                                  <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 18, marginTop: 3 }}>
                                    {bill.treatmentName || 'Treatment'}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500', marginLeft: 4 }}>{fmtDate(bill.createdAt)}</Text>
                                  </View>
                                </View>

                                <View style={{ alignItems: 'flex-end', maxWidth: 128 }}>
                                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontWeight: '900', color: '#0A1551', textAlign: 'right' }}>
                                    PKR {Number((bill.finalAmount != null ? bill.finalAmount : bill.amount) || 0).toLocaleString()}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: meta.bg, borderWidth: 1, borderColor: meta.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 }}>
                                    <Ionicons name={meta.icon} size={11} color={meta.text} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: meta.text }}>{meta.label}</Text>
                                  </View>
                                </View>
                              </View>

                              {bill.discountFromRewards ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 10 }}>
                                  <Ionicons name="gift-outline" size={12} color="#7C3AED" style={{ marginRight: 5 }} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#7C3AED' }}>PKR {Number(bill.discountFromRewards).toLocaleString()} reward discount</Text>
                                </View>
                              ) : null}

                              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginTop: 12, marginBottom: 12 }} />

                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {isUnpaid ? (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => handlePayBill(bill)}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 11 }}
                                  >
                                    <Ionicons name="card-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' }}>Pay Now</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => handleDownloadInvoice(bill)}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 12, paddingVertical: 11 }}
                                  >
                                    <Ionicons name="cloud-download-outline" size={16} color="#0052FF" style={{ marginRight: 7 }} />
                                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0052FF' }}>Download Invoice</Text>
                                  </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => { setSelectedBillDetail(bill); setShowBillDetailModal(true); }}
                                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
                                >
                                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#334155' }}>Details</Text>
                                  <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', ...cardShadow }}>
                          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                            <Ionicons name="receipt-outline" size={26} color="#0052FF" />
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>No invoices yet</Text>
                          <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 17, marginTop: 5 }}>
                            No invoices generated for this doctor.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* ══════════════ SUPPORT / HELP CARD ══════════════ */}
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DBEAFE', padding: 16, ...cardShadow }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="help-buoy-outline" size={24} color="#0052FF" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>Need help with a payment?</Text>
                          <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500', lineHeight: 16, marginTop: 2 }}>
                            Our support team is available to assist you with any billing queries.
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          const msg = 'Hello, I need help with a payment on My Dentist.';
                          if (Platform.OS === 'web') { openWhatsApp(msg); return; }
                          Alert.alert('Contact Support', 'How would you like to reach us?', [
                            { text: 'WhatsApp', onPress: () => openWhatsApp(msg) },
                            { text: 'Email', onPress: () => openSupportEmail('My Dentist — Payment Support') },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 12, marginTop: 14 }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                        <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' }}>Contact Support</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          )}

          {/* ══════════════ REWARDS (ENHANCED) ══════════════ */}
          {activeTab === 'Rewards & Payments' && (
            <View>
              {/* ===== POINTS BALANCE HERO (signature dark navy) ===== */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#E8EEF9', overflow: 'hidden', shadowColor: '#0A1551', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
                {/* soft brand-tint depth circles */}
                <View style={{ position: 'absolute', top: -50, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F1F6FF' }} />
                <View style={{ position: 'absolute', bottom: -60, left: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: '#FBF9FF' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0052FF', marginRight: 8 }} />
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#64748B', letterSpacing: 1.4 }}>AVAILABLE REWARD POINTS</Text>
                    </View>
                    <Text style={{ fontSize: 44, fontWeight: '900', color: '#0A1551', letterSpacing: -1, lineHeight: 48 }} numberOfLines={1} adjustsFontSizeToFit>
                      {rewards.totalPoints || rewards.points || 0}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Ionicons name="cash-outline" size={13} color="#16A34A" style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#16A34A' }}>= PKR {(rewards.totalPoints || rewards.points || 0)} Discount Value</Text>
                    </View>
                  </View>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBEAFE' }}>
                    <Ionicons name="gift" size={26} color="#0052FF" />
                  </View>
                </View>

                {/* View / Hide Rewards History toggle */}
                <TouchableOpacity
                  onPress={() => setShowRewardHistory(v => !v)}
                  activeOpacity={0.8}
                  style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 14, paddingVertical: 12 }}
                >
                  <Ionicons name={showRewardHistory ? 'chevron-up' : 'time-outline'} size={16} color="#0052FF" style={{ marginRight: 7 }} />
                  <Text style={{ color: '#0052FF', fontWeight: '700', fontSize: 13.5 }}>
                    {showRewardHistory ? 'Hide Rewards History' : 'View Rewards History'}
                  </Text>
                </TouchableOpacity>

                {showRewardHistory && (
                  <View style={{ marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7', padding: 6 }}>
                    {(() => {
                      const history = rewards.recentHistory || rewards.transactions || [];
                      if (!history.length) {
                        return (
                          <View style={{ alignItems: 'center', paddingVertical: 22 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                              <Ionicons name="sparkles-outline" size={20} color="#0052FF" />
                            </View>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginBottom: 3 }}>No reward activity yet.</Text>
                            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Earn points on visits, referrals and reviews.</Text>
                          </View>
                        );
                      }
                      return history.map((h, i) => {
                        const pts = h.points || 0;
                        const positive = pts >= 0;
                        return (
                          <View key={h._id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: positive ? '#DCFCE7' : '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                              <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={15} color={positive ? '#16A34A' : '#DC2626'} />
                            </View>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{h.description || h.type || 'Reward'}</Text>
                              <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: positive ? '#16A34A' : '#DC2626' }}>
                              {positive ? '+' : ''}{pts} pts
                            </Text>
                          </View>
                        );
                      });
                    })()}
                  </View>
                )}
              </View>

              {/* ===== HOW YOU EARN POINTS ===== */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0052FF', marginRight: 9 }} />
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>HOW YOU EARN POINTS</Text>
              </View>

              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                {[
                  { icon: 'checkmark-circle', tint: '#DCFCE7', border: '#BBF7D0', color: '#16A34A', title: 'Visit Completed', sub: 'On every online payment', pts: '+2%' },
                  { icon: 'person-add', tint: '#EDE9FE', border: '#DDD6FE', color: '#7C3AED', title: 'Refer a Friend', sub: 'When friend completes first visit', pts: '+100 pts' },
                  { icon: 'star', tint: '#FEF3C7', border: '#FDE68A', color: '#D97706', title: 'Write a Review', sub: 'After submitting a verified review', pts: '+50 pts' },
                ].map((r, i, arr) => (
                  <View key={r.title} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: r.tint, borderWidth: 1, borderColor: r.border, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                      <Ionicons name={r.icon} size={21} color={r.color} />
                    </View>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{r.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{r.sub}</Text>
                    </View>
                    <View style={{ backgroundColor: r.color, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' }}>{r.pts}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* ===== REDEEM POINTS ===== */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#16A34A', marginRight: 9 }} />
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>REDEEM POINTS</Text>
              </View>

              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="pricetag" size={22} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0A1551' }}>Redeem Points</Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                      Redeem all {rewards.totalPoints || rewards.points || 0} pts = PKR {rewards.totalPoints || rewards.points || 0} discount
                    </Text>
                  </View>
                </View>

                {redeemCode ? (
                  <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="checkmark-circle" size={15} color="#16A34A" style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: 10.5, color: '#16A34A', fontWeight: '800', letterSpacing: 1.2 }}>YOUR DISCOUNT CODE</Text>
                    </View>
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', borderStyle: 'dashed', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 26, fontWeight: '900', color: '#0A1551', letterSpacing: 6, textAlign: 'center' }}>{redeemCode}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { Share.share({ message: 'My Dentist Discount Code: ' + redeemCode }); }}
                      activeOpacity={0.85}
                      style={{ marginTop: 4, backgroundColor: '#16A34A', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons name="share-social-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Share Code</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleRedeem}
                    disabled={redeemLoading}
                    activeOpacity={0.85}
                    style={{ marginTop: 14, backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: redeemLoading ? 0.85 : 1, shadowColor: '#0052FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 }}
                  >
                    {redeemLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="pricetags-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Tap to Generate Code</Text>
                        <Ionicons name="chevron-forward" size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11.5, color: '#94A3B8', lineHeight: 16 }}>
                    Share this code with the doctor. They can apply it to deduct the amount from your bill.
                  </Text>
                </View>
              </View>

              {/* ===== PAYMENT HISTORY ===== */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#0A1551', marginRight: 9 }} />
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 }}>PAYMENT HISTORY</Text>
                {bills.filter(b => b.status === 'paid').length > 0 && (
                  <View style={{ marginLeft: 'auto', backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>{bills.filter(b => b.status === 'paid').length} paid</Text>
                  </View>
                )}
              </View>

              {bills.filter(b => b.status === 'paid').length > 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  {bills.filter(b => b.status === 'paid').map((b, i, arr) => (
                    <View key={b._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{b.treatmentName}</Text>
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{new Date(b.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0A1551' }}>PKR {b.amount?.toLocaleString()}</Text>
                        <TouchableOpacity
                          onPress={() => handleDownloadInvoice(b)}
                          activeOpacity={0.8}
                          style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
                        >
                          <Ionicons name="cloud-download-outline" size={13} color="#0052FF" style={{ marginRight: 5 }} />
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0052FF' }}>Receipt</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', paddingVertical: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="receipt-outline" size={24} color="#0052FF" />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>No paid transaction history.</Text>
                  <Text style={{ fontSize: 12.5, color: '#94A3B8' }}>Your paid bills will appear here.</Text>
                </View>
              )}
            </View>
          )}

        </View>
          </View>{/* /webMain */}
        </View>{/* /webGrid */}
      </ScrollView>

      {/* Fixed Bottom Button — only on Treatments & Appointments tabs */}
      {!isWide && (activeTab === 'Treatments' || activeTab === 'Appointments') && (
        <View style={[styles.bottomFixed, { bottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => navigation.navigate('Booking', { doctor })}
          >
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.bookBtnTxt}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bill Detail Modal */}
      <Modal
        visible={showBillDetailModal}
        transparent
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setShowBillDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%', paddingBottom: Math.min(insets.bottom, 8) + 16 }]}>
            {selectedBillDetail && (() => {
              const b = selectedBillDetail;
              const isPaid = b.status === 'paid';
              const isPending = b.status === 'payment_pending';
              const outstanding = isPaid ? 0 : Math.max((b.finalAmount || b.amount) - (b.paidAmount || 0), 0);
              const heroAmount = isPaid ? (b.paidAmount || b.finalAmount || b.amount || 0) : outstanding;
              // Tri-state look: paid (green) · pending doctor confirmation (purple) · unpaid (red).
              const sc = isPaid
                ? { accent: '#16A34A', tint: '#F0FDF4', border: '#BBF7D0', badge: 'PAID', icon: 'checkmark-circle', amtLabel: 'Amount Paid', amtColor: '#16A34A' }
                : isPending
                ? { accent: '#7C3AED', tint: '#F5F3FF', border: '#DDD6FE', badge: 'AWAITING CONFIRMATION', icon: 'hourglass-outline', amtLabel: 'Paid by Cash · Pending', amtColor: '#0A1551' }
                : { accent: '#EF4444', tint: '#FEF2F2', border: '#FECACA', badge: 'UNPAID', icon: 'alert-circle', amtLabel: 'Amount Due', amtColor: '#0A1551' };
              const rows = [
                { label: 'Date',           icon: 'calendar-outline', value: new Date(b.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Due Date',       icon: 'time-outline',     value: b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Treatment',      icon: 'medkit-outline',   value: b.treatmentName },
                { label: 'Payment Method', icon: 'wallet-outline',   value: (b.paymentMethodLabel || b.paymentMethod || 'cash').toUpperCase() },
              ];
              return (
                <>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0A1551' }}>Bill Details</Text>
                      <Text style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: '600', marginTop: 2 }}>{b.invoiceNumber}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowBillDetailModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                    {/* Hero: status + amount */}
                    <View style={{ borderRadius: 16, padding: 16, backgroundColor: sc.tint, borderWidth: 1, borderColor: sc.border, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: sc.border }}>
                          <Ionicons name={sc.icon} size={13} color={sc.accent} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: sc.accent }}>{sc.badge}</Text>
                        </View>
                        <Ionicons name="receipt-outline" size={22} color={sc.border} />
                      </View>
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 14 }}>{sc.amtLabel}</Text>
                      <Text style={{ fontSize: 27, fontWeight: '900', color: sc.amtColor, marginTop: 2 }}>PKR {heroAmount.toLocaleString()}</Text>
                    </View>

                    {/* Detail rows */}
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, marginBottom: 14 }}>
                      {rows.map((row, idx) => (
                        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: idx === rows.length - 1 ? 0 : 1, borderBottomColor: '#F5F7FA' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name={row.icon} size={14} color="#94A3B8" style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 13, color: '#64748B' }}>{row.label}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', maxWidth: '55%', textAlign: 'right' }}>{row.value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Amount breakdown */}
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7', padding: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>Total Amount</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>PKR {b.amount?.toLocaleString()}</Text>
                      </View>
                      {(b.discountFromRewards || 0) > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
                          <Text style={{ fontSize: 13, color: '#64748B' }}>Discount</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A' }}>- PKR {(b.discountFromRewards || 0).toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>Paid Amount</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>PKR {(b.paidAmount || 0).toLocaleString()}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 9 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0A1551' }}>Outstanding</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: outstanding > 0 ? '#EF4444' : '#16A34A' }}>
                          PKR {outstanding.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Actions */}
                  <View style={{ marginTop: 16 }}>
                    {isPending ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 }}>
                        <Ionicons name="hourglass-outline" size={17} color="#7C3AED" style={{ marginRight: 9 }} />
                        <Text style={{ flex: 1, fontSize: 12, color: '#5B21B6', fontWeight: '600', lineHeight: 16 }}>Marked as paid by cash — awaiting your doctor to confirm receipt.</Text>
                      </View>
                    ) : !isPaid ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={{ backgroundColor: '#0052FF', paddingVertical: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 10, shadowColor: '#0052FF', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                        onPress={() => { setShowBillDetailModal(false); handlePayBill(b); }}
                      >
                        <Ionicons name="card-outline" size={17} color="#FFF" style={{ marginRight: 7 }} />
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Pay Now · PKR {outstanding.toLocaleString()}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={{ flex: 1, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', paddingVertical: 13, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                        onPress={() => { setShowBillDetailModal(false); handleDownloadInvoice(b); }}
                      >
                        <Ionicons name="cloud-download-outline" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13.5 }}>{isPaid ? 'Download Receipt' : 'Download Invoice'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={{ width: 92, backgroundColor: '#F1F5F9', paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setShowBillDetailModal(false)}
                      >
                        <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13.5 }}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Checkout/Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.min(insets.bottom, 8) + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout / Pay Invoice</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>

            {checkoutBill && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
                <View style={styles.checkoutSummaryCard}>
                  <Text style={styles.checkoutInvoiceNum}>{checkoutBill.invoiceNumber}</Text>
                  <Text style={styles.checkoutDesc}>{checkoutBill.treatmentName}</Text>
                  
                  <View style={styles.checkoutPriceRow}>
                    <Text style={styles.checkoutPriceLabel}>Bill Amount</Text>
                    <Text style={styles.checkoutPriceVal}>PKR {checkoutBill.amount?.toLocaleString()}</Text>
                  </View>
                  
                  {checkoutBill.discountFromRewards > 0 && (
                    <View style={styles.checkoutPriceRow}>
                      <Text style={styles.checkoutPriceLabel}>Rewards Discount</Text>
                      <Text style={[styles.checkoutPriceVal, { color: '#16A34A' }]}>- PKR {checkoutBill.discountFromRewards?.toLocaleString()}</Text>
                    </View>
                  )}
                  
                  <View style={styles.checkoutDivider} />
                  
                  <View style={styles.checkoutPriceRow}>
                    <Text style={[styles.checkoutPriceLabel, { fontWeight: 'bold', color: '#0A1551' }]}>Total Payable</Text>
                    <Text style={[styles.checkoutPriceVal, { fontWeight: 'bold', color: '#0052FF', fontSize: 18 }]}>
                      PKR {((checkoutBill.finalAmount !== undefined ? checkoutBill.finalAmount : checkoutBill.amount) || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Select Payment Method</Text>

                {/* Enabled Method: Cash */}
                <TouchableOpacity style={[styles.methodRow, styles.methodRowActive]}>
                  <View style={styles.methodLeft}>
                    <Ionicons name="cash-outline" size={20} color="#0052FF" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.methodNameActive}>Cash at Clinic</Text>
                      <Text style={styles.methodSub}>Pay cash at the clinic counter & get printed receipt</Text>
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#0052FF" />
                </TouchableOpacity>

                {/* Disabled Methods: Online Gateways */}
                <View style={styles.disabledMethodRow}>
                  <View style={styles.methodLeft}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#94A3B8" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.methodNameDisabled}>EasyPaisa Wallet</Text>
                      <Text style={styles.methodSubDisabled}>Pay instantly using local mobile account</Text>
                    </View>
                  </View>
                  <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                </View>

                <View style={styles.disabledMethodRow}>
                  <View style={styles.methodLeft}>
                    <Ionicons name="wallet-outline" size={20} color="#94A3B8" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.methodNameDisabled}>JazzCash Wallet</Text>
                      <Text style={styles.methodSubDisabled}>Pay instantly using local mobile account</Text>
                    </View>
                  </View>
                  <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                </View>

                <View style={styles.disabledMethodRow}>
                  <View style={styles.methodLeft}>
                    <Ionicons name="card-outline" size={20} color="#94A3B8" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.methodNameDisabled}>Credit / Debit Card</Text>
                      <Text style={styles.methodSubDisabled}>Visa, MasterCard, UnionPay, PayPak</Text>
                    </View>
                  </View>
                  <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={styles.confirmPayBtn}
                  onPress={confirmPayBill}
                  disabled={payingBillId === checkoutBill._id}
                >
                  {payingBillId === checkoutBill._id ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="cash-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmPayBtnText}>Confirm Cash Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                  <Ionicons name="information-circle-outline" size={13} color="#94A3B8" style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500', textAlign: 'center', flexShrink: 1 }}>
                    Your doctor confirms cash receipt — the bill shows Paid once confirmed.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal
        visible={showAddMethodModal}
        transparent={true}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment Method</Text>
              <TouchableOpacity onPress={() => setShowAddMethodModal(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSectionTitle}>Select Method Type</Text>
              <View style={styles.methodTypeSelector}>
                {[
                  { id: 'visa', label: 'Visa Card', icon: 'card-outline' },
                  { id: 'mastercard', label: 'Mastercard', icon: 'card-outline' },
                  { id: 'easypaisa', label: 'EasyPaisa', icon: 'phone-portrait-outline' },
                  { id: 'jazzcash', label: 'JazzCash', icon: 'phone-portrait-outline' }
                ].map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeBtn,
                      newMethodType === type.id && styles.typeBtnActive
                    ]}
                    onPress={() => setNewMethodType(type.id)}
                  >
                    <Ionicons name={type.icon} size={16} color={newMethodType === type.id ? '#FFF' : '#0052FF'} />
                    <Text style={[styles.typeBtnText, newMethodType === type.id && styles.typeBtnTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                {newMethodType === 'visa' || newMethodType === 'mastercard' ? 'Card Number' : 'Mobile Account Number'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={newMethodType === 'visa' || newMethodType === 'mastercard' ? '4111 2222 3333 4444' : '0300 1234567'}
                value={newAccountNumber}
                onChangeText={setNewAccountNumber}
                keyboardType="numeric"
              />

              {(newMethodType === 'visa' || newMethodType === 'mastercard') && (
                <>
                  <Text style={styles.inputLabel}>Expiry Date (MM/YY)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="12/29"
                    value={newExpiryDate}
                    onChangeText={setNewExpiryDate}
                  />
                </>
              )}

              <TouchableOpacity style={styles.saveMethodBtn} onPress={handleAddPaymentMethod}>
                <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveMethodBtnText}>Save Payment Method</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Write a Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSectionTitle}>Rate your experience</Text>
              <View style={styles.starRatingContainer}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons
                      name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={36}
                      color="#F59E0B"
                      style={{ marginHorizontal: 6 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Write your comments (Min 5 chars)</Text>
              <TextInput
                style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Share details of your experience with this doctor..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline={true}
                numberOfLines={4}
              />

              <TouchableOpacity
                style={styles.submitReviewBtn}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitReviewBtnText}>Submit Review</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lightbox Modal */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
            onPress={() => setLightboxUri(null)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {lightboxUri ? (
            <Image source={{ uri: lightboxUri }} style={{ width: '92%', height: '70%', resizeMode: 'contain', borderRadius: 12 }} />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── No Sample Reviews ────────────────────────────────

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Platform.OS === 'web' ? '#F1F5F9' : '#FFFFFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:       { fontSize: 16, color: '#64748B', marginBottom: 12 },
  backBtn:         { backgroundColor: '#0052FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  backBtnText:     { color: '#FFF', fontWeight: 'bold' },

  // Cover
  coverContainer:  { height: 180, position: 'relative' },
  coverImage:      { width: '100%', height: '100%', resizeMode: 'cover' },
  headerIcons:     { position: 'absolute', top: Platform.OS === 'android' ? 40 : 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10, elevation: 10 },
  iconCircle:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
  onlineBadgeTop:  { position: 'absolute', bottom: 16, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', zIndex: 12, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 },
  onlineDot:       { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlineText:      { fontSize: 12, fontWeight: 'bold' },

  // Floating Card
  floatingCard:    { backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 14, marginTop: 6, padding: 18, shadowColor: '#0052FF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: '#EFF6FF' },
  doctorAvatar:    { width: 72, height: 72, borderRadius: 16, borderWidth: 2, borderColor: '#EFF6FF' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#DBEAFE' },
  doctorHeader:    { marginTop: 35 },
  nameRow:         { flexDirection: 'row', alignItems: 'center' },
  doctorName:      { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  doctorSpecialty: { fontSize: 13, color: '#64748B', marginTop: 2 },
  ratingRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingText:      { fontSize: 13, fontWeight: 'bold', color: '#D97706', marginLeft: 4 },
  clinicTag:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 10 },
  clinicText:      { color: '#0052FF', fontSize: 12, fontWeight: '600' },
  locationRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 },
  distanceText:    { fontSize: 12, color: '#64748B', marginLeft: 4 },
  distanceChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, gap: 2 },
  distanceChipText:{ fontSize: 11, color: '#2563EB', fontWeight: '700' },

  // Tabs
  tabsScroll:         { marginTop: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabsScrollHint:     { position: 'absolute', right: 0, top: 0, bottom: 1, width: 44, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  tabsScrollHintLeft: { right: undefined, left: 0, alignItems: 'flex-start', paddingRight: 0, paddingLeft: 6 },
  tabsWrap:           { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 2, paddingHorizontal: 20, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabsContent:        { paddingHorizontal: 20 },
  tabItem:            { paddingVertical: 10, paddingHorizontal: 4, marginRight: 16, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
  tabItemActive:      { borderBottomColor: '#0052FF' },
  tabText:            { fontSize: 14, color: '#64748B', fontWeight: '600' },
  tabTextActive:      { color: '#0052FF' },
  tabContentContainer:{ padding: 20 },

  // Shared
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 14 },
  aboutDesc:       { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 20 },
  infoList:        { gap: 14 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start' },
  infoIcon:        { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoLabel:       { width: 100, fontSize: 12, color: '#64748B', fontWeight: '600', paddingTop: 6 },
  infoValue:       { flex: 1, fontSize: 13, color: '#0F172A', paddingTop: 6, lineHeight: 18 },
  treatmentRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  checkboxContainer:{ flexDirection: 'row', alignItems: 'center', flex: 1 },
  treatmentNameTxt: { fontSize: 13, color: '#0F172A' },
  priceContainer:  { alignItems: 'flex-end' },
  priceTxt:        { fontSize: 13, color: '#0052FF', fontWeight: '700' },
  galleryScroll:   { marginBottom: 16 },
  galleryImage:    { width: 100, height: 100, borderRadius: 12, marginRight: 10 },
  beforeAfterCard: { marginRight: 10 },
  beforeAfterImg:  { width: 120, height: 80, borderRadius: 8, resizeMode: 'cover' },
  certificateImg:  { width: 90, height: 120, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText:       { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 10 },

  // Bottom
  bottomFixed: { position: 'absolute', bottom: 24, left: 12, right: 12, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  bookBtn:     { backgroundColor: '#0052FF', flexDirection: 'row', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bookBtnTxt:  { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  // Appointments
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  apptCard:     { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  apptRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBadge:    { width: 75, backgroundColor: '#EFF6FF', paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  timeText:     { fontSize: 11, fontWeight: '700', color: '#0052FF' },
  treatmentName:{ fontSize: 13, fontWeight: '600', color: '#0F172A' },
  dateLabel:    { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:   { fontSize: 9, fontWeight: '800' },

  // ── Reviews Tab ──
  servicesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  serviceTag:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF' },
  serviceTagText:  { fontSize: 11, color: '#1E40AF', fontWeight: '500' },

  tierCard:        { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, marginBottom: 20 },
  tierTopRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tierBadge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  tierBadgeText:   { fontSize: 13, fontWeight: '700' },
  scoreCircle:     { width: 54, height: 54, borderRadius: 27, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  scoreCircleNum:  { fontSize: 18, fontWeight: '900', color: '#FFF' },
  scoreCircleLabel:{ fontSize: 9, color: '#94A3B8', textAlign: 'center' },
  tierDesc:        { fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 16 },
  tierLevels:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tierLevel:       { flex: 1, paddingTop: 6, alignItems: 'center' },
  tierLevelName:   { fontSize: 11, fontWeight: '700' },
  tierLevelRange:  { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  highlightsTitle: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  highlightRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  highlightText:   { fontSize: 12, color: '#0F172A', fontWeight: '500' },

  ratingOverallCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, flexDirection: 'row', gap: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  ratingBigCol:    { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  ratingBigNum:    { fontSize: 38, fontWeight: '900', color: '#0F172A' },
  starsRowLarge:   { flexDirection: 'row', gap: 2, marginTop: 4 },
  ratingReviewCount:{ fontSize: 11, color: '#64748B', marginTop: 4 },
  recommendRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  recommendText:   { fontSize: 11, color: '#16A34A', fontWeight: '700' },
  starBarsCol:     { flex: 1, justifyContent: 'center', gap: 5 },
  starBarRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starBarLabel:    { fontSize: 11, color: '#64748B', width: 22, textAlign: 'right' },
  starBarBg:       { flex: 1, height: 7, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  starBarFill:     { height: 7, borderRadius: 4 },
  starBarCount:    { fontSize: 11, color: '#94A3B8', width: 22 },

  reviewCardNew:   { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  reviewCardTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatarInitial:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0052FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitialText:{ fontSize: 16, fontWeight: '700', color: '#FFF' },
  reviewerRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  reviewerNameNew: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  verifiedBadge:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  verifiedText:    { fontSize: 10, color: '#16A34A', fontWeight: '600' },
  reviewMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  starsRowSmall:   { flexDirection: 'row', gap: 2 },
  reviewDateNew:   { fontSize: 10, color: '#94A3B8' },
  reviewCommentNew:{ fontSize: 12, color: '#475569', lineHeight: 18, marginBottom: 8 },
  helpfulLink:     { fontSize: 11, color: '#0052FF', fontWeight: '600' },

  // ── Bills Tab ──
  summaryGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  summarySubCard:  { width: (width - 60) / 2, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftColor: '#0052FF', borderLeftWidth: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  sumLabel:        { fontSize: 10, color: '#64748B' },
  sumVal:          { fontSize: 13, fontWeight: '800', color: '#0A1551', marginTop: 4 },
  sumSubLabel:     { fontSize: 9, color: '#94A3B8', marginTop: 2 },

  privacyBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, marginBottom: 16 },
  privacyText:     { fontSize: 11, color: '#0052FF', flex: 1, fontWeight: '600' },

  upcomingPayCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 },
  upcomingPayTop:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  upcomingIconWrap:{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  upcomingTreatment:{ fontSize: 13, fontWeight: '700', color: '#0F172A' },
  upcomingDate:    { fontSize: 11, color: '#64748B', marginTop: 2 },
  upcomingAmount:  { fontSize: 12, color: '#0F172A', fontWeight: '600', marginTop: 4 },
  upcomingDue:     { fontSize: 11, color: '#D97706', fontWeight: '700', marginTop: 2 },
  upcomingPayActions:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  payNowBtnBlue:   { backgroundColor: '#0052FF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  payNowBtnBlueText:{ color: '#FFF', fontSize: 12, fontWeight: '700' },
  viewDetailsLink: { fontSize: 11, color: '#0052FF', fontWeight: '600' },

  billRowNew:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  billIconCircle:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  billInvoiceNum:  { fontSize: 13, fontWeight: '700', color: '#0052FF' },
  billDate:        { fontSize: 11, color: '#64748B', marginTop: 1 },
  billDesc:        { fontSize: 12, color: '#475569', marginTop: 3 },
  billActionCol:   { alignItems: 'flex-end', gap: 5 },
  billAmount:      { fontSize: 13, fontWeight: '700', color: '#0A1551' },
  payBtn:          { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  payBtnText:      { color: '#FFF', fontSize: 11, fontWeight: '700' },
  downloadBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#0052FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  downloadBtnText: { color: '#0052FF', fontSize: 10, fontWeight: '700' },

  helpCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  helpIconWrap:    { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  helpTitle:       { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  helpSub:         { fontSize: 11, color: '#64748B', lineHeight: 16 },
  contactSupportBtn:{ borderWidth: 1, borderColor: '#0052FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginLeft: 8, marginTop: 6 },
  contactSupportText:{ fontSize: 11, color: '#0052FF', fontWeight: '700' },

  // ── Rewards Tab ──
  rewardsTopRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  pointsCard:      { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 12 },
  pointsHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pointsLabel:     { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  pointsVal:       { fontSize: 32, fontWeight: '900', color: '#FFF', marginTop: 4 },
  pointsDesc:      { fontSize: 11, color: '#F59E0B', fontWeight: '700', marginTop: 2 },
  rewardsHistoryBtn:{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  rewardsHistoryBtnText:{ fontSize: 12, color: '#FFF', fontWeight: '600' },

  earnCard:        { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  earnTitle:       { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  earnRow:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  earnDesc:        { flex: 1, fontSize: 12, color: '#475569', lineHeight: 16 },
  earnPts:         { fontSize: 12, fontWeight: '700', color: '#16A34A', marginLeft: 6 },

  redeemCard:      { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 16 },
  redeemLeft:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  redeemIconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  redeemTitle:     { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  redeemSub:       { fontSize: 11, color: '#64748B' },
  redeemBtn:       { backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 10 },
  redeemBtnText:   { color: '#FFF', fontSize: 13, fontWeight: '700' },
  redeemInfo:      { fontSize: 11, color: '#64748B', lineHeight: 15 },

  paymentGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  paymentCard:     { width: (width - 60) / 2, borderRadius: 14, padding: 14, minHeight: 110 },
  paymentCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  defaultBadge:    { backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText:{ fontSize: 9, color: '#FFF', fontWeight: '700' },
  paymentCardNum:  { fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 3 },
  paymentCardExp:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  removeTextCard:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textDecorationLine: 'underline' },

  historyRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyName:     { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  historyDate:     { fontSize: 11, color: '#64748B', marginTop: 2 },
  historyPrice:    { fontSize: 13, fontWeight: '700', color: '#16A34A' },

  referralBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4F46E5', borderRadius: 16, padding: 16, marginTop: 20 },
  referralIconWrap:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  referralTitle:   { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 3 },
  referralSub:     { fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 15, marginBottom: 10 },
  referNowBtn:     { borderWidth: 1, borderColor: '#FFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  referNowBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Old - kept for safety
  savedMethods:    { gap: 10 },
  paymentMethodCard:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  cardName:        { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cardSub:         { fontSize: 11, color: '#64748B', marginTop: 2 },
  removeText:      { fontSize: 11, color: '#EF4444', fontWeight: '600' },
  summaryGrid:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  billRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },

  // ── Action buttons (Chat / Directions / Save) ──
  actionRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 8, gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0052FF', borderRadius: 12, paddingVertical: 10, gap: 4, backgroundColor: '#FFFFFF' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#0052FF' },

  // ── Compact header (for non-About tabs) ──
  compactHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  compactBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  compactAvatar: { width: 56, height: 56, borderRadius: 12 },
  compactDoctorName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  compactSpecialty: { fontSize: 12, color: '#64748B', marginTop: 1 },

  // ── Tab item updated to support icon above ──
  tabItemIconMode: { paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginRight: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },

  // Modals Overlay & Common styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0A1551' },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0A1551', marginTop: 15, marginBottom: 10 },
  
  // Checkout Summary Card
  checkoutSummaryCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  checkoutInvoiceNum: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  checkoutDesc: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  checkoutPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  checkoutPriceLabel: { fontSize: 13, color: '#475569' },
  checkoutPriceVal: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  checkoutDivider: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginVertical: 8 },

  // Method Selection
  methodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 10 },
  methodRowActive: { borderColor: '#0052FF', backgroundColor: '#EFF6FF' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  methodNameActive: { fontSize: 14, fontWeight: '600', color: '#0052FF' },
  methodSub: { fontSize: 11, color: '#64748B', marginTop: 2, marginRight: 8 },
  
  disabledMethodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', marginBottom: 10, opacity: 0.6 },
  methodNameDisabled: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  methodSubDisabled: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  comingSoonBadge: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  comingSoonText: { fontSize: 9, color: '#64748B', fontWeight: '700' },
  
  // Buttons
  confirmPayBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  confirmPayBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Method Type Selector
  methodTypeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EFF6FF' },
  typeBtnActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  typeBtnText: { fontSize: 12, color: '#0052FF', fontWeight: '600' },
  typeBtnTextActive: { color: '#FFFFFF' },

  // Inputs
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 15 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  saveMethodBtn: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveMethodBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Review Styles
  starRatingContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 15 },
  submitReviewBtn: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitReviewBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // ── Popular badge pill ──
  popularPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, gap: 3 },
  popularPillText: { fontSize: 11, fontWeight: '700' },

  // ── Web / desktop two-column layout ──
  webScrollContent: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24 },
  webTopBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 18, paddingBottom: 18 },
  webBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', flexShrink: 0 },
  webBackText: { fontSize: 14, fontWeight: '700', color: '#0F172A', flexShrink: 0 },
  webCrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  webCrumbMuted: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  webCrumbActive: { fontSize: 14, color: '#0052FF', fontWeight: '700' },
  webGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  webRail: { width: 340, flexShrink: 0, position: 'sticky', top: 20 },
  webMain: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  webRailCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  webRailPhoto: { width: 120, height: 120, borderRadius: 24, marginBottom: 14, backgroundColor: '#E2E8F0' },
  // Centered placeholder for the web rail (NOT the absolute phone-cover avatar).
  webRailPhotoPlaceholder: { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  webFeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  webFeeLabel: { color: '#64748B', fontSize: 14 },
  webFeeValue: { color: '#0F172A', fontSize: 18, fontWeight: '700' },
  webBookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 14, width: '100%', marginTop: 16 },
  webRailActions: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 12 },
  webRailAction: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
});
