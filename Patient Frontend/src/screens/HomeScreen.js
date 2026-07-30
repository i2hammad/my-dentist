import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ensureAuth, useIsGuest } from "../utils/authGuard";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Pressable,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useSeo, H1 } from '../components/SeoHead';
import { REQUEST_TIMEOUT, NETWORK_MSG } from '../config/net';

const PK_CITIES = [
  'Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar',
  'Quetta', 'Multan', 'Faisalabad', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Abbottabad', 'Murree', 'Swat', 'Bahawalpur',
];

const isWeb = Platform.OS === 'web';

const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const fmtKm = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { SkeletonList, SkeletonCard } from '../components/Skeleton';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import useResponsive from '../hooks/useResponsive';
import { ctaLabel } from '../utils/promo';
import { getCoords } from '../utils/geo';
import { matchesTier } from '../utils/clinicTier';

// ─── Filter tab config ──────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'Nearby',    label: 'Nearby',           icon: 'navigate-outline' },
  { key: 'Favorites', label: 'Favorites',        icon: 'heart' },
  { key: 'Elite',     label: 'Elite Clinic',     icon: 'ribbon-outline' },
  { key: 'Modern',    label: 'Modern Clinic',    icon: 'diamond-outline' },
  { key: 'Standard',  label: 'Standard Clinic',  icon: 'shield-outline' },
];

// Facility grades: Standard 1–15 · Modern 16–30 · Elite 31+
function filterDoctors(doctors, tab, favorites, patientCoords, tierThresholds) {
  if (tab === 'Nearby') {
    if (!patientCoords) return doctors;
    const distOf = (d) => {
      if (!d.coordinates) return Infinity;
      const dc = String(d.coordinates).split(',').map(Number);
      if (dc.length < 2 || isNaN(dc[0]) || isNaN(dc[1])) return Infinity;
      if (Math.abs(dc[0]) < 0.001 && Math.abs(dc[1]) < 0.001) return Infinity; // skip 0,0
      const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
      return km == null ? Infinity : km;
    };
    return [...doctors].sort((a, b) => distOf(a) - distOf(b));
  }
  if (tab === 'Favorites') return doctors.filter(d => favorites && (favorites[String(d._id)] || favorites[String(d.userId)]));
  if (tab === 'Elite')     return doctors.filter(d => matchesTier(d.facilityScore, 'elite', tierThresholds));
  if (tab === 'Modern')    return doctors.filter(d => matchesTier(d.facilityScore, 'modern', tierThresholds));
  if (tab === 'Standard')  return doctors.filter(d => matchesTier(d.facilityScore, 'standard', tierThresholds));
  return doctors;
}

// ─── Status badge helper ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    online: { color: '#16A34A', bg: '#DCFCE7', label: 'Online' },
    busy:   { color: '#D97706', bg: '#FEF3C7', label: 'Busy' },
    offline:{ color: '#6B7280', bg: '#F3F4F6', label: 'Offline' },
  };
  const s = map[status] || map.offline;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ─── Single Doctor Card ──────────────────────────────────────────────
function DoctorCard({ doc, onPress, isFavorite, onToggleFavorite, style, patientCoords }) {
  const photoUri = doc.photo
    ? imgUrl(doc.photo, { w: 160 }) // small card avatar — request a resized thumb
    : null;

  const status = doc.isOnline === true
    ? 'online'
    : doc.isOnline === false
    ? 'offline'
    : 'offline';

  return (
    <View style={[styles.doctorCard, style]}>
      {/* Top section: photo + info */}
      <View style={styles.doctorCardTop}>
        {/* Photo */}
        <View style={styles.photoWrapper}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.doctorPhoto} />
          ) : (
            <View style={styles.doctorPhotoPlaceholder}>
              <Ionicons name="person" size={36} color="#94A3B8" />
            </View>
          )}
          {/* Status badge overlaid */}
          <View style={styles.statusBadgeOverlay}>
            <StatusBadge status={status} />
          </View>
        </View>

        {/* Doctor info */}
        <View style={styles.doctorInfo}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {doc.fullName || 'Doctor'}
            </Text>
            {doc.pmdcVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={{ marginLeft: 4 }} />
            )}
          </View>

          {/* Specialty + Distance inline */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
            <Text style={styles.doctorSpecialty} numberOfLines={1}>
              {doc.specialization || 'Dentist'}
            </Text>
            {(() => {
              if (!patientCoords || !doc.coordinates) return null;
              const dc = String(doc.coordinates).split(',').map(Number);
              if (dc.length < 2 || isNaN(dc[0]) || isNaN(dc[1])) return null;
              if (Math.abs(dc[0]) < 0.001 && Math.abs(dc[1]) < 0.001) return null; // skip 0,0
              const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
              if (km === null) return null;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Ionicons name="navigate" size={11} color="#2563EB" style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>{fmtKm(km)}</Text>
                </View>
              );
            })()}
          </View>

          {/* Popular badge — green = earned, blue = paid */}
          {doc.isPopular && (
            <View style={[styles.popularBadge, { backgroundColor: doc.popularType === 'paid' ? '#DBEAFE' : '#DCFCE7' }]}>
              <Ionicons name="star" size={11} color={doc.popularType === 'paid' ? '#1D4ED8' : '#15803D'} />
              <Text style={[styles.popularBadgeText, { color: doc.popularType === 'paid' ? '#1D4ED8' : '#15803D' }]}>Popular</Text>
            </View>
          )}

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {doc.avgRating !== undefined ? doc.avgRating : '4.9'}
            </Text>
            <Text style={styles.reviewCount}>
              ({doc.totalReviews !== undefined ? doc.totalReviews : '0'} Reviews)
            </Text>
          </View>

          {/* Clinic name */}
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicName || 'Private Clinic'}
            </Text>
          </View>

          {/* Location — distance already shows as a pill beside the specialty above */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicCity || doc.address || 'Islamabad'}
            </Text>
          </View>
        </View>

        {/* Heart / Favorite button */}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={() => onToggleFavorite(doc._id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? '#EF4444' : '#94A3B8'}
          />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row: experience + availability */}
      <View style={styles.doctorCardBottom}>
        <View style={styles.bottomInfoItem}>
          <Ionicons name="time-outline" size={14} color="#2563EB" />
          <Text style={styles.bottomInfoText}>
            Experience: {doc.experience ? `${doc.experience}+ Years` : '5+ Years'}
          </Text>
        </View>
        <View style={styles.bottomInfoItem}>
          <Ionicons name="calendar-outline" size={14} color="#16A34A" />
          <Text style={[styles.bottomInfoText, { color: '#16A34A' }]}>
            Available: Today
          </Text>
        </View>
      </View>

      {/* View Profile button */}
      <TouchableOpacity style={styles.viewProfileBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.viewProfileBtnText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main HomeScreen ─────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [profile, setProfile]         = useState(null);
  const [patientCoords, setPatientCoords] = useState(null);
  // True once we've asked the browser/OS for a location, so we ask at most once
  // per visit rather than on every tap of the Nearby chip.
  const askedForLocation = useRef(false);
  const [locating, setLocating] = useState(false);
  const [selectedCity, setSelectedCity]   = useState('Islamabad');
  // Set when the doctor fetch fails, so the UI can say "couldn't load" and offer
  // a retry instead of the misleading "No doctors found for this filter".
  const [doctorsError, setDoctorsError]   = useState(null);
  const [doctorsReloadKey, setDoctorsReloadKey] = useState(0);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [doctors, setDoctors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterTab, setFilterTab]     = useState('Nearby');
  const isNearby = filterTab === 'Nearby';
  const [favorites, setFavorites]     = useState({});
  const isGuest = useIsGuest();
  // Favorites needs an account — hide that filter chip for guests.
  const visibleFilterTabs = isGuest ? FILTER_TABS.filter(t => t.key !== 'Favorites') : FILTER_TABS;
  const [favoriteDoctors, setFavoriteDoctors] = useState([]);
  const [campaigns, setCampaigns]       = useState([]);
  const [tierThresholds, setTierThresholds] = useState(null); // admin-managed clinic tier ranges
  const [rotationInterval, setRotationInterval] = useState(10);
  const [activeCampaignIdx, setActiveCampaignIdx] = useState(0);
  const campaignScrollRef = useRef(null);
  const isFocused = useIsFocused();
  const { unreadCount, unreadChatCount } = useNotifications();
  const { isWide, columns, width: screenW } = useResponsive();
  const insets = useSafeAreaInsets();
  // Full-width campaign card (screen width minus the 16px side margins).
  const campaignCardW = Math.min(isWide ? 1100 : screenW, 1100) - 32;

  // Restore the head after React mounts. The static hero (with its <h1> and the
  // build-time <title>) is torn down on mount, so without this Google renders the
  // page, finds no heading, and invents a title from on-page text — which is how
  // the homepage ended up ranking as "Nearby Doctors".
  useSeo({
    title: 'Best Dentists in Pakistan — Find & Book Online | My Dentist',
    description:
      'Find and book verified PMDC dentists in Lahore, Karachi, Islamabad & Rawalpindi. Compare clinics, fees and reviews, then book your appointment online in seconds.',
    canonical: 'https://mydentistpk.com/',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');

      // Fetch profile
      if (token) {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data?.success && res.data?.data?.profile) {
            const p = res.data.data.profile;
            setProfile(p);
            if (p.coordinates) {
              const parts = String(p.coordinates).split(',').map(Number);
              if (parts.length === 2 && !isNaN(parts[0])) setPatientCoords({ lat: parts[0], lng: parts[1] });
            }
          }
        } catch (e) {
          console.log('Profile fetch error:', e?.message);
        }

      }

      // Doctors are fetched by the city effect below, which runs on mount too
      // (selectedCity has an initial value). Fetching here as well raced it:
      // two in-flight requests both called setDoctors, so whichever landed last
      // won — and if that was a failure, the list was silently wiped.

      // Fetch patient campaign banner
      try {
        const token = await storage.getItem('userToken');
        if (token) {
          const res = await axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.data?.success) {
            const d = res.data.data;
            const list = Array.isArray(d) ? d : (d?.campaigns || (d ? [d] : []));
            const interval = d?.rotationInterval ?? 10;
            setCampaigns(list);
            setRotationInterval(interval);
            setActiveCampaignIdx(0);
          }
        }
      } catch (e) { /* non-critical */ }

      // Fetch admin-managed clinic tier ranges so the Elite/Modern/Standard
      // filter tabs stay in sync with the Facilities settings.
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/platform-settings`);
        if (res.data?.data?.clinicTierThresholds) setTierThresholds(res.data.data.clinicTierThresholds);
      } catch (e) { /* non-critical — matchesTier falls back to defaults */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);

  // Ask the device for a location when Nearby is active and we don't already
  // have one from the signed-in profile.
  //
  // Without this, Nearby did nothing at all for signed-out visitors: coordinates
  // only ever came from /api/users/me, so `patientCoords` stayed null, the sort
  // was skipped, and the list rendered in API order while the chip and the
  // "Top dentists near you" heading both claimed otherwise.
  //
  // Asked on demand rather than at page load — a permission prompt before the
  // visitor has expressed any interest in location gets denied far more often,
  // and a denial is remembered by the browser.
  useEffect(() => {
    if (!isNearby || patientCoords || askedForLocation.current) return;
    askedForLocation.current = true;
    let active = true;
    (async () => {
      setLocating(true);
      const c = await getCoords();
      if (!active) return;
      setLocating(false);
      // Null means denied, timed out, or unsupported. Leave patientCoords unset;
      // the UI below drops the distance claim rather than faking it.
      if (c) setPatientCoords(c);
    })();
    return () => { active = false; };
  }, [isNearby, patientCoords]);

  // Re-fetch doctors when the city changes, or when the Nearby filter is picked.
  //
  // Nearby deliberately ignores the city. "Nearest" scoped to one city is not
  // nearest — a Rawalpindi clinic 3km away would lose to an Islamabad one 15km
  // away simply because the selector said Islamabad. Every other filter stays
  // city-scoped, which is what the selector is for.
  useEffect(() => {
    let active = true;
    const fetchByCity = async () => {
      setDoctorsError(null);
      try {
        const cityParam = (selectedCity && filterTab !== 'Nearby')
          ? `&city=${encodeURIComponent(selectedCity)}`
          : '';
        const res = await axios.get(
          `${API_BASE_URL}/api/doctors?limit=50${cityParam}`,
          { timeout: REQUEST_TIMEOUT },
        );
        if (!active) return; // city changed again while this was in flight
        if (res.data?.success) setDoctors(res.data.data || []);
        else setDoctorsError(res.data?.message || NETWORK_MSG);
      } catch (e) {
        if (!active) return;
        // Previously this swallowed every failure, leaving `doctors` empty — so
        // a dropped request rendered "No doctors found for this filter", which
        // blames the filter for what is actually a connection problem.
        console.log('Doctors fetch error:', e?.message);
        setDoctorsError(e?.response?.data?.message || NETWORK_MSG);
      }
    };
    fetchByCity();
    return () => { active = false; };
    // Keyed on whether Nearby is active rather than on filterTab itself: only
    // that distinction changes the request. Switching between Elite/Modern/
    // Standard filters the list we already hold and must not refetch.
  }, [selectedCity, doctorsReloadKey, isNearby]);


  useFocusEffect(
    useCallback(() => {
      // Blue header → light status-bar icons; re-assert on focus.
      if (!isWeb) setStatusBarStyle('light');
      const onBackPress = () => {
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ],
          { cancelable: true }
        );
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [navigation])
  );

  // Load favorites from backend
  const loadFavorites = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        const list = res.data.data || [];
        const favMap = {};
        list.forEach(f => { if (f.doctorId) favMap[String(f.doctorId._id || f.doctorId)] = true; });
        setFavorites(favMap);
        setFavoriteDoctors(list.map(f => f.doctorId).filter(Boolean));
      }
    } catch {}
  };

  useEffect(() => { loadFavorites(); }, []);

  useEffect(() => {
    if (filterTab === 'Favorites') loadFavorites();
  }, [filterTab]);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      setActiveCampaignIdx(prev => {
        const next = (prev + 1) % campaigns.length;
        try {
          campaignScrollRef.current?.scrollTo({ x: next * (campaignCardW + 16), animated: true });
        } catch {}
        return next;
      });
    }, rotationInterval * 1000);
    return () => clearInterval(timer);
  }, [campaigns, rotationInterval]);

  const toggleFavorite = async (id) => {
    if (!(await ensureAuth(navigation))) return;
    const isFav = !!favorites[String(id)];
    const newFavs = { ...favorites };
    if (isFav) delete newFavs[String(id)];
    else newFavs[String(id)] = true;
    setFavorites(newFavs);
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      if (isFav) {
        await axios.delete(`${API_BASE_URL}/api/favorites/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_BASE_URL}/api/favorites/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      }
      await loadFavorites();
    } catch {}
  };

  const filteredDoctors = filterTab === 'Favorites'
    ? favoriteDoctors
    : filterDoctors(doctors, filterTab, favorites, patientCoords, tierThresholds);

  // Greeting + first name for the header.
  const firstName = (profile?.fullName || '').trim().split(/\s+/)[0] || '';
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={isWeb ? ['top'] : []}>
      {/* White status-bar icons so the bar blends with the blue header (edge-to-edge) */}
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}

      {/* The page's only <h1>. Must sit OUTSIDE the {!isWeb && …} header below —
          that block is mobile-only, so an <h1> in there never reaches the web
          DOM, which is exactly where crawlers need it. Renders null on native.
          On wide web the same wording is shown visibly above the search bar, so
          this stays screen-reader-only there to avoid announcing it twice. */}
      {!(isWeb && isWide) && <H1>Find &amp; book the best dentists in Pakistan</H1>}

      {/* ── BLUE HEADER ── */}
      {/* Static header — mobile only (web uses WebTopNav).
          paddingTop includes the status-bar inset so the blue + glyphs fill behind it. */}
      {!isWeb && (
      <View style={[styles.blueHeader, { paddingTop: insets.top + 4 }]}>
        {/* Decorative accent blobs for depth */}
        <View pointerEvents="none" style={styles.headerBlobA} />
        <View pointerEvents="none" style={styles.headerBlobB} />
        {/* Faint dental glyphs scattered in the background */}
        <View pointerEvents="none" style={styles.headerGlyphs}>
          <Ionicons name="medical-outline"   size={64} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', top: -8,  right: 60 }} />
          <Ionicons name="happy-outline"      size={40} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: 54,  right: 8 }} />
          <Ionicons name="sparkles-outline"   size={28} color="rgba(255,255,255,0.10)" style={{ position: 'absolute', top: 22,  left: 6 }} />
          <Ionicons name="shield-checkmark-outline" size={34} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', bottom: 4, left: 80 }} />
          <Ionicons name="pulse-outline"      size={30} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', bottom: 10, right: 110 }} />
        </View>
        <View style={styles.headerRow1}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.headerLogoBadge}>
              <Image source={require('../../assets/logo-mark-sm.png')} style={styles.headerLogo} resizeMode="contain" />
            </View>
            <Text style={styles.headerTitle}>My <Text style={{ color: '#BFD7FF' }}>Dentist</Text></Text>
          </View>
          <View style={styles.headerRight}>
            <PressableScale
              style={styles.bellWrapper}
              hitSlop={8}
              onPress={() => navigation.navigate('SavedDoctors')}
            >
              <Ionicons name="heart-outline" size={21} color="#FFFFFF" />
            </PressableScale>
            <PressableScale
              style={styles.bellWrapper}
              hitSlop={8}
              onPress={() => navigation.navigate('PatientInbox')}
            >
              <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
              {unreadChatCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text>
                </View>
              )}
            </PressableScale>
            <PressableScale
              style={styles.bellWrapper}
              hitSlop={8}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </PressableScale>
            <PressableScale
              style={styles.profilePhotoWrapper}
              scaleTo={0.9}
              onPress={() => navigation.navigate('Profile')}
            >
              {profile?.profileImage ? (
                <Image
                  source={{ uri: imgUrl(profile.profileImage) }}
                  style={styles.profilePhoto}
                />
              ) : (
                <Ionicons name="person" size={22} color="#FFFFFF" />
              )}
            </PressableScale>
          </View>
        </View>

        {/* Personalized greeting */}
        <View>
          <Text style={styles.headerGreeting}>{greeting()}{firstName ? ',' : ''}</Text>
          {!!firstName && <Text style={styles.headerName}>{firstName}</Text>}
          <Text style={styles.headerTagline}>Find the right dentist near you</Text>
        </View>
      </View>
      )}

      {/* ── SCROLLABLE BODY ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          isWide && { width: '100%', maxWidth: 1100, alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── ADMIN CAMPAIGNS (horizontal scroll + auto-rotate) ── */}
        {campaigns.length > 0 && (
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <ScrollView
              ref={campaignScrollRef}
              horizontal
              snapToInterval={campaignCardW + 16}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (campaignCardW + 16));
                setActiveCampaignIdx(idx);
              }}
            >
              {campaigns.map((c, i) => {
                const colors = ['#7C3AED', '#0052FF', '#0D9488', '#D97706', '#DC2626'];
                const bg = colors[i % colors.length];
                // The home banner uses the wide bannerImage; detailImage is only
                // for the campaign detail page. Fall back the other way if unset.
                const img = c.bannerImage || c.detailImage;
                const imgUri = img ? imgUrl(img) : null;
                return (
                  <TouchableOpacity
                    key={c._id || i}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('Promo', { campaign: c })}
                    style={{
                      width: campaignCardW, height: 118, marginRight: campaigns.length > 1 ? 16 : 0,
                      backgroundColor: bg, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end',
                      shadowColor: bg, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
                    }}
                  >
                    {imgUri && (
                      <Image source={{ uri: imgUri }} style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                    {/* Dark scrim so text is always readable (over image or solid color) */}
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: imgUri ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.06)' }} />

                    {/* Decorative megaphone watermark when no image */}
                    {!imgUri && (
                      <Ionicons name="megaphone" size={88} color="rgba(255,255,255,0.12)" style={{ position: 'absolute', top: -8, right: -6 }} />
                    )}

                    {/* Text block at the bottom */}
                    <View style={{ padding: 14 }}>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 17, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 }} numberOfLines={1}>
                        {c.title || 'Special Offer'}
                      </Text>
                      {!!(c.bannerText || c.body) && (
                        <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 }} numberOfLines={1}>
                          {c.bannerText || c.body}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ color: bg, fontWeight: '800', fontSize: 12 }}>{ctaLabel(c.ctaLabel, 'View Offer')}</Text>
                        <Ionicons name="arrow-forward" size={13} color={bg} style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {campaigns.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                {campaigns.map((_, i) => (
                  <View key={i} style={{ width: i === activeCampaignIdx ? 16 : 6, height: 5, borderRadius: 3, backgroundColor: i === activeCampaignIdx ? '#0052FF' : '#CBD5E1' }} />
                ))}
              </View>
            )}
          </View>
        )}


        {/* ── PAGE HEADLINE (wide web only) ──
            The static hero paints this headline before React mounts; without it
            here the text vanished the moment the app took over, which read as
            landing on a different page. Mobile keeps the personalised greeting
            in the blue header instead, so this would only duplicate it. */}
        {isWeb && isWide && (
          <View style={styles.webHeadline}>
            {/* Rendered as a real <h1>, so this IS the page heading here — the
                screen-reader-only one above is suppressed at this width. */}
            <H1 visible style={{
              // The raw <h1> is outside react-native-web's styling, so it falls
              // back to the browser default (a serif) unless the family is set
              // explicitly. Mirrors the static hero's stack exactly.
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
              fontSize: '34px',
              lineHeight: '42px',
              fontWeight: 800,
              color: '#0A1551',
              letterSpacing: '-0.8px',
              margin: 0,
              maxWidth: '19ch',
            }}>
              Find &amp; book the best dentists in Pakistan
            </H1>
            <Text style={styles.webHeadlineSub}>
              Compare verified PMDC dentists by specialty, experience and clinic — then book online in seconds.
            </Text>
            {/* Real counts from the listing, not decoration: the reason to trust
                the directory before any card has loaded. */}
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                {/* A filled dot rather than an icon font glyph. Both
                    shield-checkmark and checkmark-circle rendered blank here on
                    web even though the same names work elsewhere in the app, so
                    this avoids depending on the icon font loading at all. */}
                <View style={styles.trustTick}>
                  <Text style={styles.trustTickMark}>✓</Text>
                </View>
                <Text style={styles.trustText}>PMDC verified</Text>
              </View>
              <View style={styles.trustDot} />
              <View style={styles.trustItem}>
                <Ionicons name="calendar-outline" size={15} color="#0052FF" />
                <Text style={styles.trustText}>Free to book</Text>
              </View>
              <View style={styles.trustDot} />
              <View style={styles.trustItem}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                {/* Deliberately not a city list: `doctors` is fetched filtered by
                    the selected city, so it can only ever name that one city and
                    would misrepresent the directory's actual coverage. */}
                <Text style={styles.trustText}>Real patient reviews</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── SEARCH BAR ── */}
        <TouchableOpacity
          // On wide web a 50px pill stretched the full column width reads as a
          // giant lozenge; a squarer field with a capped width looks like a
          // search input. Mobile keeps the pill.
          style={[styles.searchBar, isWeb && isWide && styles.searchBarWide]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search Dentist / Clinic / Treatment
          </Text>
          <View style={styles.searchActions}>
            <TouchableOpacity style={styles.searchActionBtn} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="mic-outline" size={18} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchActionBtn} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="options-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* LOCATION ROW — tap to toggle city picker */}
        <TouchableOpacity style={[styles.locationRowBody, isWeb && isWide && styles.locationRowWide]} activeOpacity={0.8} onPress={() => setShowCityPicker(v => !v)}>
          <Ionicons name="location" size={16} color={isNearby ? '#94A3B8' : '#0052FF'} />
          {/* Nearby searches every city, so showing a single city here would
              contradict the results below it. */}
          <Text style={[styles.locationTextBody, isNearby && styles.locationTextMuted]}>
            {isNearby ? 'All cities' : `${selectedCity}, Pakistan`}
          </Text>
          <Ionicons name={showCityPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
        </TouchableOpacity>

        {/* Inline City Picker */}
        {showCityPicker && (
          <View style={styles.cityPickerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="location" size={16} color="#0052FF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Select Your City</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PK_CITIES.map(city => {
                const active = city === selectedCity;
                return (
                  <TouchableOpacity
                    key={city}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#0052FF' : '#F1F5F9', borderWidth: 1, borderColor: active ? '#0052FF' : '#E2E8F0' }}
                    onPress={() => {
                      setSelectedCity(city);
                      setShowCityPicker(false);
                      // Nearby ignores the city, so leaving it active would make
                      // the choice look like it did nothing. Clear the filter
                      // rather than swapping in a different one.
                      if (isNearby) setFilterTab(null);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : '#334155' }}>{city}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── FILTER TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContainer}
          style={styles.filterTabsScroll}
        >
          {visibleFilterTabs.map(tab => {
            const active = filterTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setFilterTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={active ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── SECTION HEADER ── */}
        <View style={styles.sectionHeader}>
          <View>
            {/* The heading states what the list actually is. Claiming "near you"
                without coordinates was the visible half of the bug — for a
                signed-out visitor nothing was ever sorted by distance. */}
            <Text style={styles.sectionTitle}>
              {isNearby && patientCoords ? 'Nearby Doctors' : 'Dentists'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {locating
                ? 'Finding dentists near you…'
                : isNearby
                  ? (patientCoords
                    ? 'Sorted by distance from you'
                    : 'All cities · turn on location to sort by distance')
                  : `In ${selectedCity}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.seeMapBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Map', { doctors, patientCoords })}
          >
            <Ionicons name="map-outline" size={14} color="#2563EB" />
            <Text style={styles.seeMapText}>See Map</Text>
          </TouchableOpacity>
        </View>

        {/* ── DOCTOR LIST ── */}
        {loading ? (
          // Match the loaded layout: grid on wide screens, list on phones.
          isWide ? (
            <View style={styles.doctorGrid}>
              {Array.from({ length: columns * 2 }).map((_, i) => (
                <View key={i} style={[styles.doctorGridCell, { width: `${100 / columns}%` }]}>
                  <SkeletonCard />
                </View>
              ))}
            </View>
          ) : (
            <SkeletonList count={4} />
          )
        ) : doctorsError ? (
          // A failed request must not masquerade as an empty result set.
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{doctorsError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setDoctorsReloadKey(k => k + 1)}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnTxt}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDoctors.length === 0 ? (
          // An empty screen is an invitation to act. Two different causes need
          // two different answers: no dentists in this CITY at all (the filter
          // is irrelevant — offer cities that do have some), versus a clinic-type
          // filter that excluded them (offer to clear it).
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={40} color="#CBD5E1" />
            {filterTab === 'Favorites' ? (
              <>
                <Text style={styles.emptyTitle}>No saved dentists yet</Text>
                <Text style={styles.emptyText}>Tap the heart on any dentist to save them here.</Text>
              </>
            ) : doctors.length === 0 ? (
              <>
                <Text style={styles.emptyTitle}>No dentists in {selectedCity} yet</Text>
                <Text style={styles.emptyText}>
                  We're adding clinics city by city. Try one of these instead:
                </Text>
                <View style={styles.emptyCities}>
                  {['Islamabad', 'Rawalpindi'].filter(c => c !== selectedCity).map(c => (
                    <TouchableOpacity key={c} style={styles.emptyCityBtn} onPress={() => setSelectedCity(c)}>
                      <Ionicons name="location" size={14} color="#0052FF" />
                      <Text style={styles.emptyCityTxt}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  No {(filterTab || '').toLowerCase()} clinics in {selectedCity}
                </Text>
                <Text style={styles.emptyText}>
                  {doctors.length} other dentist{doctors.length === 1 ? '' : 's'} available here.
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setFilterTab('Nearby')}>
                  <Text style={styles.emptyBtnTxt}>Show all dentists</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={isWide ? styles.doctorGrid : null}>
            {filteredDoctors.map(doc => (
              <View
                key={doc._id}
                style={isWide ? [styles.doctorGridCell, { width: `${100 / columns}%` }] : null}
              >
                <DoctorCard
                  doc={doc}
                  isFavorite={!!favorites[doc._id]}
                  onToggleFavorite={toggleFavorite}
                  onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc._id, doctor: doc })}
                  style={isWide ? { marginHorizontal: 0 } : null}
                  patientCoords={patientCoords}
                />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0052FF',
  },

  // Blue header
  blueHeader: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  headerBlobA: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerBlobB: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  headerGlyphs: {
    ...StyleSheet.absoluteFillObject,
  },
  headerLogoBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  headerLogo: { width: 24, height: 24 },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerGreeting: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerTagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10.5,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrapper: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0052FF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  profilePhotoWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 2,
  },
  locationRowWide: { maxWidth: 1100, alignSelf: 'center', width: '100%' },
  locationRowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationTextBody: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  cityPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Scrollable body
  body: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  bodyContent: {
    paddingBottom: 90,
  },

  // My Appointments Card
  myApptsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  myApptsIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myApptsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0A1551',
    marginBottom: 2,
  },
  myApptsSub: {
    fontSize: 12,
    color: '#64748B',
  },

  // Quick action tiles
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Search bar
  // Wide-web page headline. Values mirror the static hero in inject-seo.js so
  // the text does not shift or restyle when React replaces the hero.
  webHeadline: {
    marginTop: 28,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  webHeadlineSub: {
    fontSize: 16.5,
    lineHeight: 27,
    color: '#475569',
    marginTop: 12,
    maxWidth: 620,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 13.5,
    fontWeight: '650',
    color: '#334155',
  },
  trustTick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTickMark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // Was a heavy drop shadow (0.1 / 12px) that read as a grey haze around the
    // bar. A hairline border plus a whisper of shadow lifts it off the page
    // without the smudge.
    borderWidth: 1,
    borderColor: '#E7EDF5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchBarWide: {
    // Match the doctor grid's column (1100) — a narrower cap left the field
    // looking stranded above full-width content.
    borderRadius: 14,
    paddingVertical: 14,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
    marginTop: 4,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filter tabs
  filterTabsScroll: {
    marginBottom: 14,
  },
  filterTabsContainer: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#0052FF',
    borderColor: '#0052FF',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  // Reads as a button rather than stray blue text — it opens a whole screen.
  seeMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  seeMapText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },

  // Responsive grid for doctor cards (wide web only)
  doctorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  doctorGridCell: {
    paddingHorizontal: 8,
  },

  // Doctor card
  doctorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  doctorCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  photoWrapper: {
    marginRight: 12,
  },
  doctorPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  doctorPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  doctorInfo: {
    flex: 1,
    paddingBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  doctorSpecialty: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
    gap: 3,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reviewCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    flexShrink: 1,
  },
  heartButton: {
    padding: 4,
    marginLeft: 4,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },

  // Doctor card bottom
  doctorCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bottomInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },

  // View Profile button
  viewProfileBtn: {
    backgroundColor: '#0052FF',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  viewProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Loading / Empty states
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    color: '#0A1551',
    fontSize: 16,
    fontWeight: '750',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  emptyCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  emptyCityTxt: {
    color: '#0052FF',
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0052FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
