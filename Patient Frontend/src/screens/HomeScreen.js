import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { SkeletonList } from '../components/Skeleton';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import useResponsive from '../hooks/useResponsive';

// ─── Filter tab config ──────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'Nearby',    label: 'Nearby',           icon: 'navigate-outline' },
  { key: 'Favorites', label: 'Favorites',        icon: 'heart' },
  { key: 'Elite',     label: 'Elite Clinic',     icon: 'ribbon-outline' },
  { key: 'Modern',    label: 'Modern Clinic',    icon: 'diamond-outline' },
  { key: 'Standard',  label: 'Standard Clinic',  icon: 'shield-outline' },
];

// Facility grades: Standard 1–15 · Modern 16–30 · Elite 31+
function filterDoctors(doctors, tab, favorites) {
  if (tab === 'Nearby')    return doctors;
  if (tab === 'Favorites') return doctors.filter(d => favorites && (favorites[String(d._id)] || favorites[String(d.userId)]));
  if (tab === 'Elite')     return doctors.filter(d => (d.facilityScore || 0) >= 31);
  if (tab === 'Modern')    return doctors.filter(d => {
    const s = d.facilityScore || 0;
    return s >= 16 && s <= 30;
  });
  if (tab === 'Standard')  return doctors.filter(d => {
    const s = d.facilityScore || 0;
    return s >= 1 && s <= 15;
  });
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
    ? imgUrl(doc.photo)
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
              if (!patientCoords) return null;
              const dc = doc.coordinates ? String(doc.coordinates).split(',').map(Number) : null;
              if (!dc || dc.length < 2 || isNaN(dc[0])) return null;
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

          {/* Location + Distance */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicCity || doc.address || 'Islamabad'}
              {(() => {
                if (!patientCoords) return '';
                const dc = doc.coordinates ? String(doc.coordinates).split(',').map(Number) : null;
                if (!dc || dc.length < 2 || isNaN(dc[0])) return '';
                const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
                return km !== null ? ` · ${fmtKm(km)} away` : '';
              })()}
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
  const [selectedCity, setSelectedCity]   = useState('Islamabad');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [doctors, setDoctors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterTab, setFilterTab]     = useState('Nearby');
  const [favorites, setFavorites]     = useState({});
  const [campaigns, setCampaigns]     = useState([]);
  const isFocused = useIsFocused();
  const { unreadCount, unreadChatCount } = useNotifications();
  const { isWide, columns } = useResponsive();
  const insets = useSafeAreaInsets();

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

      // Fetch doctors
      try {
        const res = await axios.get(`${API_BASE_URL}/api/doctors?limit=20`);
        if (res.data?.success) {
          setDoctors(res.data.data || []);
        }
      } catch (e) {
        console.log('Doctors fetch error:', e?.message);
      }

      // Fetch patient campaign banner
      try {
        const token = await storage.getItem('userToken');
        if (token) {
          const res = await axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.data?.success) {
            const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data ? [res.data.data] : []);
            setCampaigns(list);
          }
        }
      } catch (e) { /* non-critical */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);


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

  // Load favorites from storage
  useEffect(() => {
    const loadFavs = async () => {
      try {
        const favs = await storage.getItem('patient_favorites');
        if (favs) setFavorites(JSON.parse(favs));
      } catch (e) { /* ignore */ }
    };
    loadFavs();
  }, []);

  const toggleFavorite = async (id) => {
    const newFavs = { ...favorites, [id]: !favorites[id] };
    if (!newFavs[id]) delete newFavs[id];
    setFavorites(newFavs);
    try {
      await storage.setItem('patient_favorites', JSON.stringify(newFavs));
    } catch (e) { /* ignore */ }
  };

  const filteredDoctors = filterDoctors(doctors, filterTab, favorites);

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
              <Ionicons name="medical" size={18} color="#0052FF" />
            </View>
            <Text style={styles.headerTitle}>My Dentist PK</Text>
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

        {/* ── ADMIN CAMPAIGNS (dynamic, from admin panel) ── */}
        {campaigns.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12, marginTop: 24 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {campaigns.map((c, idx) => {
              const colors = ['#7C3AED', '#0052FF', '#0D9488', '#D97706', '#DC2626'];
              const bg = colors[idx % colors.length];
              return (
                <TouchableOpacity
                  key={c._id || idx}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Promo', { campaign: c })}
                  style={{ width: 300, backgroundColor: bg, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center' }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="megaphone-outline" size={22} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{c.title || 'Special Offer'}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }} numberOfLines={2}>{c.bannerText || c.body || ''}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginLeft: 8 }}>
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 10 }}>PROMO</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* LOCATION ROW — tap to toggle city picker */}
        <TouchableOpacity style={styles.locationRowBody} activeOpacity={0.8} onPress={() => setShowCityPicker(v => !v)}>
          <Ionicons name="location" size={16} color="#0052FF" />
          <Text style={styles.locationTextBody}>{selectedCity}, Pakistan</Text>
          <Ionicons name={showCityPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
        </TouchableOpacity>

        {/* Inline City Picker — works on web + native */}
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
                    onPress={() => { setSelectedCity(city); setShowCityPicker(false); }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : '#334155' }}>{city}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── SEARCH BAR ── */}
        <TouchableOpacity
          style={styles.searchBar}
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

        {/* ── FILTER TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContainer}
          style={styles.filterTabsScroll}
        >
          {FILTER_TABS.map(tab => {
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
            <Text style={styles.sectionTitle}>Nearby Doctors</Text>
            <Text style={styles.sectionSubtitle}>Top dentists near you</Text>
          </View>
          <TouchableOpacity style={styles.seeMapBtn} activeOpacity={0.7}>
            <Text style={styles.seeMapText}>See Map</Text>
            <Ionicons name="map-outline" size={14} color="#2563EB" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* ── DOCTOR LIST ── */}
        {loading ? (
          <SkeletonList count={4} />
        ) : filteredDoctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="sad-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No doctors found for this filter.</Text>
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
                  onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc._id })}
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
  },
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
  locationRowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
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
    marginBottom: 16,
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
  seeMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
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
    color: '#64748B',
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
    color: '#64748B',
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
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
});
