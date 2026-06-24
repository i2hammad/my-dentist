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
        message: `Check out ${drName(doctor.fullName)}'s profile on My Dentist PK: ${shareUrl}`,
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
    try {
      setPayingBillId(checkoutBill._id);
      const token = await storage.getItem('userToken');
      const res = await axios.put(`${API_BASE_URL}/api/bills/${checkoutBill._id}/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Bill marked as paid! Generating receipt...');
        setShowPaymentModal(false);
        // Refresh billing list
        const billRes = await axios.get(`${API_BASE_URL}/api/bills/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (billRes.data?.success) {
          const docId = doctor._id || doctor.userId;
          setBills(billRes.data.data.filter(b => b.doctorId?._id === docId || b.doctorId === docId));
        }
        // Also refresh rewards
        const rewardRes = await axios.get(`${API_BASE_URL}/api/rewards/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (rewardRes.data?.success) {
          setRewards(rewardRes.data.data || { points: 0, transactions: [] });
        }
        // Download/share receipt
        const updatedBill = res.data.data.bill || checkoutBill;
        updatedBill.status = 'paid';
        handleDownloadInvoice(updatedBill);
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

  const handleDownloadInvoice = (bill) => {
    if (!bill || !doctor) return;

    const invoice = {
      invoiceNumber: bill.invoiceNumber,
      date: new Date(bill.createdAt).toLocaleDateString(),
      patientName: patientProfile?.fullName || 'Patient',
      patientPhone: patientProfile?.mobileNumber || '',
      treatmentName: bill.treatmentName,
      total: bill.amount,
      discount: bill.discountFromRewards || 0,
      paid: bill.paidAmount || 0,
      payable: bill.finalAmount || bill.amount,
      outstanding: bill.status === 'paid' ? 0 : Math.max((bill.finalAmount || bill.amount) - (bill.paidAmount || 0), 0),
      status: bill.status,
      paymentMethod: bill.paymentMethod || 'cash'
    };

    const docName = drName(doctor.fullName, 'Dentist');
    const clinic = doctor.clinicName || 'Dentist Clinic';
    const spec = doctor.specialization || 'General Doctor';

    // Formatted text for native sharing on mobile
    const receiptText = `
=== ${clinic.toUpperCase()} ===
Doctor: ${docName} (${spec})
Invoice: ${invoice.invoiceNumber}
Date: ${invoice.date}
Payment Method: ${invoice.paymentMethod.toUpperCase()}
---------------------------------
Patient Name: ${invoice.patientName}
Phone Number: ${invoice.patientPhone}
---------------------------------
TREATMENT DETAILS:
1. ${invoice.treatmentName} - PKR ${invoice.total}
---------------------------------
Total Bill: PKR ${invoice.total}
Discount Given: PKR ${invoice.discount}
Paid Amount: PKR ${invoice.paid}
Outstanding: PKR ${invoice.outstanding}
Payment Status: ${invoice.status.toUpperCase()}
---------------------------------
Thank you for visiting!
`;

    if (Platform.OS === 'web') {
      // Trigger local HTML file download
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 25px; max-width: 400px; margin: auto; border: 1px dashed #0052ff; border-radius: 10px; background-color: #fafafa; }
          .header { text-align: center; margin-bottom: 20px; }
          .clinic { font-size: 20px; font-weight: bold; color: #0052ff; }
          .meta { font-size: 12px; color: #555; margin-top: 4px; }
          .divider { border-top: 1px dashed #888; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin: 6px 0; }
          .bold { font-weight: bold; }
          .footer { text-align: center; font-size: 12px; margin-top: 30px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic">${clinic.toUpperCase()}</div>
          <div class="meta">${docName} (${spec})</div>
          <div class="meta">Invoice: ${invoice.invoiceNumber}</div>
          <div class="meta">Date: ${invoice.date}</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span class="bold">Patient:</span><span>${invoice.patientName}</span></div>
        <div class="row"><span class="bold">Phone:</span><span>${invoice.patientPhone}</span></div>
        <div class="row"><span class="bold">Method:</span><span>${invoice.paymentMethod.toUpperCase()}</span></div>
        <div class="divider"></div>
        <div class="bold" style="font-size: 13px; margin-bottom: 8px;">Treatments:</div>
        <div class="row"><span>1. ${invoice.treatmentName}</span><span>PKR ${invoice.total}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Total Amount:</span><span>PKR ${invoice.total}</span></div>
        <div class="row"><span>Discount:</span><span style="color: green;">- PKR ${invoice.discount}</span></div>
        <div class="row bold"><span>Paid Amount:</span><span>PKR ${invoice.paid}</span></div>
        <div class="divider"></div>
        <div class="row bold" style="color: ${invoice.outstanding > 0 ? 'red' : 'green'}">
          <span>Outstanding:</span><span>PKR ${invoice.outstanding}</span>
        </div>
        <div class="row bold"><span>Status:</span><span>${invoice.status.toUpperCase()}</span></div>
        <div class="footer">
          Thank you for visiting!<br>Please visit again.
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
      `;

      const element = document.createElement("a");
      const file = new Blob([htmlContent], { type: 'text/html' });
      element.href = URL.createObjectURL(file);
      element.download = `receipt-${invoice.invoiceNumber}.html`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      // Trigger native share menu
      Share.share({
        message: receiptText,
        title: `Receipt ${invoice.invoiceNumber}`
      });
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
        {doctor.consultationFee ? (
          <View style={styles.webFeeRow}>
            <Text style={styles.webFeeLabel}>Consultation Fee</Text>
            <Text style={styles.webFeeValue}>Rs. {doctor.consultationFee}</Text>
          </View>
        ) : null}
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
              {doctor.consultationFee ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="cash-outline" size={14} color="#D97706" />
                  </View>
                  <Text style={{ fontSize: 13, color: '#475569' }}>Consultation Fee</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginLeft: 'auto' }}>Rs. {doctor.consultationFee}</Text>
                </View>
              ) : null}
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
            <View>
              <Text style={styles.sectionTitle}>About Doctor</Text>
              <Text style={styles.aboutDesc}>
                {doctor.about || 'No biography provided.'}
              </Text>
              <View style={styles.infoList}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="time-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>Experience</Text>
                  <Text style={styles.infoValue}>{doctor.experience || 0}+ Years</Text>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="school-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>Qualification</Text>
                  <Text style={styles.infoValue}>{doctor.qualification || 'BDS'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="medkit-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>Specialization</Text>
                  <Text style={styles.infoValue}>{doctor.specialization || 'Dentist'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="shield-checkmark-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>PMDC Verified</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={[styles.infoValue, { flex: 0, marginRight: 6 }]}>{doctor.pmdcVerified ? 'Yes' : 'Pending'}</Text>
                    {doctor.pmdcVerified && <Ionicons name="checkmark-circle" size={16} color="#16A34A" />}
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="globe-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>Languages</Text>
                  <Text style={styles.infoValue}>{(doctor.languages || ['English', 'Urdu']).join(', ')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="time-outline" size={18} color="#0052FF" /></View>
                  <Text style={styles.infoLabel}>Clinic Timing</Text>
                  <Text style={[styles.infoValue, { flex: 1 }]}>{formatClinicTiming(doctor.clinicTiming)}</Text>
                  <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                </View>
              </View>
            </View>
          )}

          {/* ══════════════ TREATMENTS ══════════════ */}
          {activeTab === 'Treatments' && (
            <View>
              <Text style={styles.sectionTitle}>Dental Treatments</Text>
              <Text style={styles.sectionSubtitle}>Select or view treatments offered by {drName(doctor.fullName)}</Text>
              {treatments.length > 0 ? (
                treatments.map((t) => (
                  <View key={t._id} style={styles.treatmentRow}>
                    <View style={styles.checkboxContainer}>
                      <Ionicons name="checkmark-circle" size={18} color="#0052FF" style={{ marginRight: 8 }} />
                      <Text style={styles.treatmentNameTxt}>{t.name}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceTxt}>PKR {(t.priceMin || 0).toLocaleString()} - {(t.priceMax || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No treatments listed yet.</Text>
              )}
            </View>
          )}

          {/* ══════════════ GALLERY ══════════════ */}
          {activeTab === 'Gallery' && (
            <View>
              <Text style={styles.sectionTitle}>Clinic Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {clinicPhotos.length > 0 ? (
                  clinicPhotos.map(item => (
                    <TouchableOpacity key={item._id} onPress={() => setLightboxUri(imgUrl(item.imageUrl))}>
                      <ShimmerImage source={{ uri: imgUrl(item.imageUrl) }} style={styles.galleryImage} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No clinic photos uploaded.</Text>
                )}
              </ScrollView>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Before & After Results</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {beforeAfters.length > 0 ? (
                  beforeAfters.map(item => (
                    <View key={item._id} style={styles.beforeAfterCard}>
                      {item.beforeImage && item.afterImage ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={() => setLightboxUri(imgUrl(item.beforeImage))}>
                            <ShimmerImage source={{ uri: imgUrl(item.beforeImage) }} style={styles.beforeAfterImg} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setLightboxUri(imgUrl(item.afterImage))}>
                            <ShimmerImage source={{ uri: imgUrl(item.afterImage) }} style={styles.beforeAfterImg} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => setLightboxUri(imgUrl(item.imageUrl || item.beforeImage || item.afterImage))}>
                          <ShimmerImage source={{ uri: imgUrl(item.imageUrl || item.beforeImage || item.afterImage) }} style={[styles.beforeAfterImg, { width: 180 }]} />
                        </TouchableOpacity>
                      )}
                      {item.title ? <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 4 }}>{item.title}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No comparisons uploaded.</Text>
                )}
              </ScrollView>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Certificates & Awards</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {certificates.length > 0 ? (
                  certificates.map(item => (
                    <TouchableOpacity key={item._id} onPress={() => setLightboxUri(imgUrl(item.imageUrl))}>
                      <ShimmerImage source={{ uri: imgUrl(item.imageUrl) }} style={styles.certificateImg} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No certificates uploaded.</Text>
                )}
              </ScrollView>
              <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>Tap any image to view full size</Text>
            </View>
          )}

          {/* ══════════════ FACILITIES & SERVICES ══════════════ */}
          {activeTab === 'Facilities' && (
            <View>
              {/* Clinic Tier Badge */}
              <View style={[styles.tierCard, { borderLeftColor: tier.color }]}>
                <View style={styles.tierTopRow}>
                  <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
                    <Ionicons name="ribbon-outline" size={16} color={tier.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
                  </View>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreCircleNum}>{facilityScore}</Text>
                    <Text style={styles.scoreCircleLabel}>pts</Text>
                  </View>
                </View>
                <Text style={styles.tierDesc}>{tier.desc}</Text>
                <View style={styles.tierLevels}>
                  {[
                    { label: 'Standard', range: '1–15', color: '#94A3B8' },
                    { label: 'Modern',   range: '16–30', color: '#0052FF' },
                    { label: 'Elite',    range: '31+',   color: '#D97706' },
                  ].map(lvl => (
                    <View key={lvl.label} style={[styles.tierLevel, { borderTopColor: lvl.color, borderTopWidth: 3 }]}>
                      <Text style={[styles.tierLevelName, { color: lvl.color }]}>{lvl.label}</Text>
                      <Text style={styles.tierLevelRange}>{lvl.range}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Services & Facilities Grid */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Available Services</Text>
              <Text style={styles.sectionSubtitle}>Facilities & services available at this clinic</Text>
              {facilityList.length > 0 ? (
                <View style={styles.servicesGrid}>
                  {facilityList.map((fac, idx) => (
                    <View key={idx} style={[styles.serviceTag, { paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 }]}>
                      <Ionicons name={fac.icon || 'checkmark-circle-outline'} size={16} color="#0052FF" style={{ marginRight: 8 }} />
                      <Text style={[styles.serviceTagText, { fontSize: 13 }]}>{fac.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No facilities listed for this clinic.</Text>
              )}

              {/* Verified Highlights */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Verified Highlights</Text>
              {['Verified Services', 'High Patient Satisfaction', 'Advanced Technology', 'Hygiene & Safety'].map(h => (
                <View key={h} style={styles.highlightRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 8 }} />
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          )}

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
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>My Appointments with {drName(doctor.fullName)}</Text>
              </View>
              {appointments.length > 0 ? (
                appointments.map(apt => (
                  <TouchableOpacity
                    key={apt._id}
                    activeOpacity={0.85}
                    style={styles.apptCard}
                    onPress={() => navigation.navigate('AppointmentDetail', { appointment: { ...apt, doctorId: apt.doctorId || doctor } })}
                  >
                    <View style={styles.apptRow}>
                      <View style={styles.timeBadge}>
                        <Text style={styles.timeText}>{apt.time}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.treatmentName}>{apt.treatmentType}</Text>
                        <Text style={styles.dateLabel}>{new Date(apt.date).toLocaleDateString()}</Text>
                      </View>
                      <View style={[styles.statusBadge, {
                        backgroundColor: apt.status === 'confirmed' ? '#DCFCE7' : apt.status === 'pending' ? '#FEF9C3' : '#F1F5F9'
                      }]}>
                        <Text style={[styles.statusText, {
                          color: apt.status === 'confirmed' ? '#16A34A' : apt.status === 'pending' ? '#CA8A04' : '#64748B'
                        }]}>
                          {apt.status.toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />
                    </View>
                    {apt.visitSummary ? (
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                          TREATMENT RECORD / VISIT SUMMARY:
                        </Text>
                        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 16 }}>
                          {apt.visitSummary}
                        </Text>
                      </View>
                    ) : apt.status === 'completed' ? (
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#94A3B8' }}>
                          No treatment record entered by doctor yet.
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>You haven't booked any appointments with this doctor.</Text>
              )}
            </View>
          )}

          {/* ══════════════ BILLS (ENHANCED) ══════════════ */}
          {activeTab === 'Bills & Bill History' && (
            <View>
              {/* Summary Grid — 4 cards */}
              <View style={styles.summaryGridWrap}>
                <View style={styles.summarySubCard}>
                  <Text style={styles.sumLabel}>Total Invoices</Text>
                  <Text style={styles.sumVal}>{totalBillsCount}</Text>
                </View>
                <View style={[styles.summarySubCard, { borderLeftColor: '#16A34A', borderLeftWidth: 4 }]}>
                  <Text style={styles.sumLabel}>Paid Amount</Text>
                  <Text style={[styles.sumVal, { color: '#16A34A' }]}>PKR {totalPaidAmount.toLocaleString()}</Text>
                </View>
                <View style={[styles.summarySubCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
                  <Text style={styles.sumLabel}>Outstanding</Text>
                  <Text style={[styles.sumVal, { color: '#EF4444' }]}>PKR {totalOutstanding.toLocaleString()}</Text>
                </View>
                <View style={[styles.summarySubCard, { borderLeftColor: '#7C3AED', borderLeftWidth: 4 }]}>
                  <Text style={styles.sumLabel}>Total Discount</Text>
                  <Text style={[styles.sumVal, { color: '#7C3AED' }]}>PKR {totalDiscount.toLocaleString()}</Text>
                  <Text style={styles.sumSubLabel}>From rewards</Text>
                </View>
              </View>

              {/* Privacy badge */}
              <View style={styles.privacyBadge}>
                <Ionicons name="shield-checkmark" size={18} color="#0052FF" />
                <Text style={styles.privacyText}>All transactions are encrypted and processed securely.</Text>
              </View>

              {/* Upcoming Payment */}
              {unpaidBill && (
                <View style={styles.upcomingPayCard}>
                  <View style={styles.upcomingPayTop}>
                    <View style={styles.upcomingIconWrap}>
                      <Ionicons name="calendar" size={22} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.upcomingTreatment}>{unpaidBill.treatmentName}</Text>
                      <Text style={styles.upcomingDate}>{new Date(unpaidBill.createdAt).toLocaleDateString()}</Text>
                      <Text style={styles.upcomingAmount}>Amount PKR {unpaidBill.amount?.toLocaleString()}</Text>
                      <Text style={styles.upcomingDue}>Due: {new Date(unpaidBill.dueDate || unpaidBill.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={styles.upcomingPayActions}>
                    <TouchableOpacity
                      style={styles.payNowBtnBlue}
                      onPress={() => handlePayBill(unpaidBill)}
                    >
                      <Text style={styles.payNowBtnBlueText}>Pay Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setSelectedBillDetail(unpaidBill); setShowBillDetailModal(true); }}>
                      <Text style={styles.viewDetailsLink}>View Details ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Invoices */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Invoices</Text>
              {bills.length > 0 ? (
                bills.map(bill => {
                  const ti = getTreatmentIcon(bill.treatmentName);
                  return (
                    <View key={bill._id} style={styles.billRowNew}>
                      {/* Left icon */}
                      <View style={[styles.billIconCircle, { backgroundColor: ti.color + '18' }]}>
                        <Ionicons name={ti.icon} size={20} color={ti.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.billInvoiceNum}>{bill.invoiceNumber}</Text>
                        <Text style={styles.billDate}>{new Date(bill.createdAt).toLocaleDateString()}</Text>
                        <Text style={styles.billDesc}>{bill.treatmentName}</Text>
                      </View>
                      <View style={styles.billActionCol}>
                        <Text style={styles.billAmount}>PKR {bill.amount?.toLocaleString()}</Text>
                        {bill.status === 'unpaid' ? (
                          <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePayBill(bill)}
                          >
                            <Text style={styles.payBtnText}>Pay Now</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadInvoice(bill)}>
                            <Ionicons name="cloud-download-outline" size={16} color="#0052FF" />
                            <Text style={styles.downloadBtnText}>Invoice</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => { setSelectedBillDetail(bill); setShowBillDetailModal(true); }}>
                          <Text style={styles.viewDetailsLink}>View Details ›</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No invoices generated for this doctor.</Text>
              )}

              {/* Help Card */}
              <View style={styles.helpCard}>
                <View style={styles.helpIconWrap}>
                  <Ionicons name="help-circle" size={28} color="#0052FF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.helpTitle}>Need help with a payment?</Text>
                  <Text style={styles.helpSub}>Our support team is available 24/7 to assist you with billing queries.</Text>
                </View>
                <TouchableOpacity style={styles.contactSupportBtn}>
                  <Text style={styles.contactSupportText}>Contact Support</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════ REWARDS (ENHANCED) ══════════════ */}
          {activeTab === 'Rewards & Payments' && (
            <View>
              {/* Points Card + How You Earn — side-by-side on wide screens */}
              <View style={isWide ? styles.rewardsTopRow : {}}>
                {/* Dark Blue Points Card */}
                <View style={[styles.pointsCard, isWide && { flex: 1, marginRight: 10 }]}>
                  <View style={styles.pointsHeader}>
                    <View>
                      <Text style={styles.pointsLabel}>Available Reward Points</Text>
                      <Text style={styles.pointsVal}>{rewards.totalPoints || rewards.points || 0}</Text>
                      <Text style={styles.pointsDesc}>= PKR {(rewards.totalPoints || rewards.points || 0)} Discount Value</Text>
                    </View>
                    <Ionicons name="gift" size={48} color="#FFF" style={{ opacity: 0.8 }} />
                  </View>
                  {/* View Rewards History button */}
                  <TouchableOpacity style={styles.rewardsHistoryBtn} onPress={() => setShowRewardHistory(v => !v)}>
                    <Text style={styles.rewardsHistoryBtnText}>{showRewardHistory ? 'Hide Rewards History' : 'View Rewards History'} {showRewardHistory ? '⌃' : '›'}</Text>
                  </TouchableOpacity>

                  {showRewardHistory && (
                    <View style={{ marginTop: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      {(() => {
                        const history = rewards.recentHistory || rewards.transactions || [];
                        if (!history.length) {
                          return <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 }}>No reward activity yet.</Text>;
                        }
                        return history.map((h, i) => (
                          <View key={h._id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{h.description || h.type || 'Reward'}</Text>
                              <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: (h.points || 0) >= 0 ? '#16A34A' : '#DC2626' }}>
                              {(h.points || 0) >= 0 ? '+' : ''}{h.points || 0} pts
                            </Text>
                          </View>
                        ));
                      })()}
                    </View>
                  )}
                </View>

                {/* How You Earn Points */}
                <View style={[styles.earnCard, isWide && { flex: 1, marginLeft: 10, marginTop: 0 }]}>
                  <Text style={styles.earnTitle}>How You Earn Points</Text>
                  <View style={styles.earnRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 8 }} />
                    <Text style={styles.earnDesc}>Visit Completed & online payment</Text>
                    <Text style={styles.earnPts}>+2%</Text>
                  </View>
                  <View style={styles.earnRow}>
                    <Ionicons name="person-add-outline" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                    <Text style={styles.earnDesc}>Refer a Friend / When friend completes first visit</Text>
                    <Text style={styles.earnPts}>+100 pts</Text>
                  </View>
                  <View style={styles.earnRow}>
                    <Ionicons name="star-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={styles.earnDesc}>Review / After submitting verified review</Text>
                    <Text style={styles.earnPts}>+50 pts</Text>
                  </View>
                </View>
              </View>

              {/* Redeem Points Card */}
              <View style={styles.redeemCard}>
                <View style={styles.redeemLeft}>
                  <View style={styles.redeemIconWrap}>
                    <Ionicons name="pricetag-outline" size={22} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.redeemTitle}>Redeem Points</Text>
                    <Text style={styles.redeemSub}>Redeem all {rewards.totalPoints || rewards.points || 0} pts = PKR {rewards.totalPoints || rewards.points || 0} discount</Text>
                  </View>
                </View>
                {redeemCode ? (
                  <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700', marginBottom: 4 }}>YOUR DISCOUNT CODE</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#0A1551', letterSpacing: 4 }}>{redeemCode}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 6 }}>Share this code with your doctor. They'll apply it to your bill.</Text>
                    <TouchableOpacity onPress={() => { Share.share({ message: `My Dentist Discount Code: ${redeemCode}` }); }} style={{ marginTop: 8, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="share-social-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Share Code</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.redeemBtn} onPress={handleRedeem} disabled={redeemLoading}>
                    {redeemLoading ? <ActivityIndicator color="#FFF" size="small" /> : (
                      <>
                        <Text style={styles.redeemBtnText}>Tap to Generate Code</Text>
                        <Ionicons name="chevron-forward" size={14} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <Text style={styles.redeemInfo}>
                  Share this code with the doctor. They can apply it to deduct the amount from your bill.
                </Text>
              </View>


              {/* Saved Payment Methods — 2×2 grid */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
                <TouchableOpacity 
                  style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                  onPress={() => setShowAddMethodModal(true)}
                >
                  <Text style={{ fontSize: 11, color: '#0052FF', fontWeight: 'bold' }}>+ Add Method</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.paymentGrid}>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => {
                    const isCard = pm.type === 'visa' || pm.type === 'mastercard';
                    const bgColor = pm.type === 'visa' ? '#1E3A8A' : pm.type === 'mastercard' ? '#374151' : pm.type === 'easypaisa' ? '#16A34A' : '#DC2626';
                    return (
                      <View key={pm._id} style={[styles.paymentCard, { backgroundColor: bgColor }]}>
                        <View style={styles.paymentCardTop}>
                          <Ionicons name={isCard ? "card-outline" : "phone-portrait-outline"} size={22} color="#FFF" />
                          {pm.isDefault && (
                            <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
                          )}
                        </View>
                        <Text style={styles.paymentCardNum}>
                          {pm.type.toUpperCase()} {isCard ? `●●●● ${pm.lastFourDigits || ''}` : ''}
                        </Text>
                        <Text style={styles.paymentCardExp}>
                          {isCard ? `Expires ${pm.expiryDate || ''}` : pm.accountNumber}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeletePaymentMethod(pm._id)}>
                          <Text style={styles.removeTextCard}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyText, { width: '100%' }]}>
                    No saved payment methods. Add one to complete your profile!
                  </Text>
                )}
              </View>
              
              {/* Payment History */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Payment History</Text>
              {bills.filter(b => b.status === 'paid').length > 0 ? (
                bills.filter(b => b.status === 'paid').map(b => (
                  <View key={b._id} style={styles.historyRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.historyName}>{b.treatmentName}</Text>
                      <Text style={styles.historyDate}>{new Date(b.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.historyPrice}>PKR {b.amount?.toLocaleString()}</Text>
                      <TouchableOpacity 
                        style={styles.downloadHistoryBtn} 
                        onPress={() => handleDownloadInvoice(b)}
                      >
                        <Ionicons name="cloud-download-outline" size={14} color="#0052FF" />
                        <Text style={styles.downloadHistoryBtnText}>Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No paid transaction history.</Text>
              )}

              {/* Referral Banner */}
              <View style={styles.referralBanner}>
                <View style={styles.referralIconWrap}>
                  <Ionicons name="gift" size={30} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={styles.referralTitle}>Refer a Friend & Get 100 Points</Text>
                  <Text style={styles.referralSub}>You and your friend get 100 points each on your friend's first visit completion and online payment in My Dentist accounts.</Text>
                  <TouchableOpacity style={styles.referNowBtn} onPress={async () => {
                    try {
                      const token = await storage.getItem('userToken');
                      const res = await axios.get(`${API_BASE_URL}/api/users/referral`, { headers: { Authorization: `Bearer ${token}` } });
                      const data = res.data?.data;
                      if (data?.code) {
                        Share.share({ message: `🦷 Join me on My Dentist PK!\n\nUse my referral code: *${data.code}*\n\nWe both earn 100 reward points after your first treatment! 🎁` });
                      }
                    } catch (e) { Alert.alert('Error', 'Could not load referral code.'); }
                  }}>
                    <Text style={styles.referNowBtnText}>Refer Now</Text>
                  </TouchableOpacity>
                </View>
                <Ionicons name="happy-outline" size={40} color="rgba(255,255,255,0.4)" />
              </View>
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
        animationType="slide"
        onRequestClose={() => setShowBillDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', paddingBottom: insets.bottom + 20 }]}>
            {selectedBillDetail && (() => {
              const b = selectedBillDetail;
              const isPaid = b.status === 'paid';
              const outstanding = isPaid ? 0 : Math.max((b.finalAmount || b.amount) - (b.paidAmount || 0), 0);
              return (
                <>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0A1551' }}>Bill Details</Text>
                    <TouchableOpacity onPress={() => setShowBillDetailModal(false)}>
                      <Ionicons name="close-circle" size={28} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* Status Badge */}
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ backgroundColor: isPaid ? '#F0FDF4' : '#FEF2F2', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isPaid ? '#16A34A' : '#EF4444' }}>
                        {isPaid ? '✓ PAID' : '⚠ UNPAID'}
                      </Text>
                    </View>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Invoice Info */}
                    {[
                      { label: 'Invoice Number', value: b.invoiceNumber },
                      { label: 'Date',           value: new Date(b.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) },
                      { label: 'Due Date',       value: b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                      { label: 'Treatment',      value: b.treatmentName },
                      { label: 'Payment Method', value: (b.paymentMethod || 'cash').toUpperCase() },
                    ].map(row => (
                      <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>{row.label}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A', maxWidth: '55%', textAlign: 'right' }}>{row.value}</Text>
                      </View>
                    ))}

                    {/* Amount breakdown */}
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>Total Amount</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>PKR {b.amount?.toLocaleString()}</Text>
                      </View>
                      {(b.discountFromRewards || 0) > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, color: '#64748B' }}>Discount</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A34A' }}>- PKR {(b.discountFromRewards || 0).toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>Paid Amount</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>PKR {(b.paidAmount || 0).toLocaleString()}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0A1551' }}>Outstanding</Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: outstanding > 0 ? '#EF4444' : '#16A34A' }}>
                          PKR {outstanding.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                    {!isPaid && (
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#0052FF', padding: 14, borderRadius: 12, alignItems: 'center' }}
                        onPress={() => { setShowBillDetailModal(false); handlePayBill(b); }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Pay Now</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#F0FDF4', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      onPress={() => { setShowBillDetailModal(false); handleDownloadInvoice(b); }}
                    >
                      <Ionicons name="cloud-download-outline" size={16} color="#16A34A" />
                      <Text style={{ color: '#16A34A', fontWeight: 'bold', fontSize: 14 }}>
                        {isPaid ? 'Download Receipt' : 'Download Invoice'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 20, padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                      onPress={() => setShowBillDetailModal(false)}
                    >
                      <Text style={{ color: '#64748B', fontWeight: '600' }}>Close</Text>
                    </TouchableOpacity>
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
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout / Pay Invoice</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>

            {checkoutBill && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
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
                      <Ionicons name="receipt-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmPayBtnText}>Confirm Cash Payment & Download Receipt</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal
        visible={showAddMethodModal}
        transparent={true}
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
