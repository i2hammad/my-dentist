import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import useResponsive from '../hooks/useResponsive';

// ─── Filter tab config ──────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'Nearby',   label: 'Nearby',           icon: 'navigate-outline' },
  { key: 'Elite',    label: 'Elite Clinic',      icon: 'ribbon-outline' },
  { key: 'Modern',   label: 'Modern Clinic',     icon: 'diamond-outline' },
  { key: 'Standard', label: 'Standard Clinic',   icon: 'shield-outline' },
];

function filterDoctors(doctors, tab) {
  if (tab === 'Nearby')   return doctors;
  if (tab === 'Elite')    return doctors.filter(d => (d.facilityScore || 0) >= 26);
  if (tab === 'Modern')   return doctors.filter(d => {
    const s = d.facilityScore || 0;
    return s >= 11 && s <= 25;
  });
  if (tab === 'Standard') return doctors.filter(d => {
    const s = d.facilityScore || 0;
    return s >= 1 && s <= 10;
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
function DoctorCard({ doc, onPress, isFavorite, onToggleFavorite, style }) {
  const photoUri = doc.photo
    ? `${API_BASE_URL}${doc.photo}`
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

          {/* Specialty */}
          <Text style={styles.doctorSpecialty} numberOfLines={1}>
            {doc.specialization || 'Dentist'}
          </Text>

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

          {/* Location */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicCity || doc.address || 'Islamabad, Pakistan'}
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
  const [doctors, setDoctors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterTab, setFilterTab]     = useState('Nearby');
  const [favorites, setFavorites]     = useState({});
  const isFocused = useIsFocused();
  const { unreadCount, unreadChatCount } = useNotifications();
  const { isWide, columns } = useResponsive();

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
            setProfile(res.data.data.profile);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);


  useFocusEffect(
    useCallback(() => {
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

  const filteredDoctors = filterDoctors(doctors, filterTab);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── BLUE HEADER ── */}
      <View style={styles.blueHeader}>
        {/* Row 1 */}
        <View style={styles.headerRow1}>
          <Text style={styles.headerTitle}>My Dentist</Text>
          <View style={styles.headerRight}>
            {/* Appointments Icon */}
            <TouchableOpacity 
              style={styles.bellWrapper}
              onPress={() => navigation.navigate('Appointments')}
            >
              <Ionicons name="calendar-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            {/* Chat Inbox Icon */}
            <TouchableOpacity 
              style={styles.bellWrapper}
              onPress={() => navigation.navigate('PatientInbox')}
            >
              <Ionicons name="chatbubbles-outline" size={26} color="#FFFFFF" />
              {unreadChatCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Notification bell */}
            <TouchableOpacity 
              style={styles.bellWrapper}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={28} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Profile photo */}
            <TouchableOpacity
              style={styles.profilePhotoWrapper}
              onPress={() => navigation.navigate('Profile')}
            >
              {profile?.profileImage ? (
                <Image
                  source={{ uri: `${API_BASE_URL}${profile.profileImage}` }}
                  style={styles.profilePhoto}
                />
              ) : (
                <Ionicons name="person-circle-outline" size={40} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Location */}
        <TouchableOpacity style={styles.locationRow} activeOpacity={0.7}>
          <Ionicons name="location-outline" size={16} color="#FFFFFF" />
          <Text style={styles.locationText}>Islamabad, Pakistan</Text>
          <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

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

        {/* MY APPOINTMENTS BANNER */}
        <TouchableOpacity
          style={styles.myApptsCard}
          onPress={() => navigation.navigate('Appointments')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.myApptsIconBg}>
              <Ionicons name="calendar" size={22} color="#0052FF" />
            </View>
            <View>
              <Text style={styles.myApptsTitle}>My Appointments</Text>
              <Text style={styles.myApptsSub}>View upcoming & past visits</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

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
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0052FF" />
            <Text style={styles.loadingText}>Loading doctors…</Text>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 40,
    height: 40,
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
