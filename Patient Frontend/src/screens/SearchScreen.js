import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import storage from '../config/storage';
import { SkeletonList } from '../components/Skeleton';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { useNotifications } from '../context/NotificationContext';
import useResponsive from '../hooks/useResponsive';
import PromoCard from '../components/PromoCard';

// Haversine formula — returns distance in km between two lat/lng points
const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fmtKm = (km) => km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;

export default function SearchScreen({ navigation, route }) {
  const { isWide, columns, isWeb } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Nearby');
  const [profile, setProfile] = useState(null);
  const [patientCoords, setPatientCoords] = useState(null);
  const [favorites, setFavorites] = useState({});
  const [favoriteDoctors, setFavoriteDoctors] = useState([]);
  const { unreadCount } = useNotifications();

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

  useEffect(() => {
    fetchDoctors();
    fetchProfile();
    loadFavorites();
  }, []);

  useEffect(() => {
    if (activeFilter === 'Favorites') loadFavorites();
  }, [activeFilter]);

  const toggleFavorite = async (id) => {
    const key = String(id);
    const isFav = !!favorites[key];
    const newFavs = { ...favorites };
    if (isFav) delete newFavs[key]; else newFavs[key] = true;
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

  const fetchProfile = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && res.data?.data?.profile) {
        const p = res.data.data.profile;
        setProfile(p);
        if (p.coordinates) {
          const parts = String(p.coordinates).split(',').map(Number);
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            setPatientCoords({ lat: parts[0], lng: parts[1] });
          }
        }
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (route.params?.specialty) {
      setSearchQuery(route.params.specialty);
    }
  }, [route.params?.specialty]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/doctors`, { params: { limit: 100 } });
      setDoctors(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = (activeFilter === 'Favorites' ? favoriteDoctors : doctors).filter(d => {
    const haystack = [d.fullName, d.specialization, d.clinicName, d.city]
      .filter(Boolean).join(' ').toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = searchQuery.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    const matchesQuery = !words.length || words.every(w => haystack.includes(w));

    if (activeFilter === 'Favorites') {
      return matchesQuery;
    }
    if (activeFilter === 'Elite Clinic') {
      return matchesQuery && (d.clinicTier === 'elite' || d.clinicTier === 'Elite Clinic');
    }
    if (activeFilter === 'Modern Clinic') {
      return matchesQuery && (d.clinicTier === 'modern' || d.clinicTier === 'Modern Clinic');
    }
    if (activeFilter === 'Standard Clinic') {
      return matchesQuery && (d.clinicTier === 'standard' || d.clinicTier === 'Standard Clinic');
    }

    return matchesQuery;
  });

  // Nearby filter: sort by distance from the patient (nearest first).
  if (activeFilter === 'Nearby' && patientCoords) {
    const distOf = (d) => {
      if (!d.coordinates) return Infinity;
      const dc = String(d.coordinates).split(',').map(Number);
      if (dc.length < 2 || isNaN(dc[0]) || isNaN(dc[1])) return Infinity;
      const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
      return km == null ? Infinity : km;
    };
    filteredDoctors.sort((a, b) => distOf(a) - distOf(b));
  }

  const filters = [
    { id: 'Nearby', label: 'Nearby', icon: 'navigate' },
    { id: 'Favorites', label: 'Favorites', icon: 'heart' },
    { id: 'Elite Clinic', label: 'Elite Clinic', icon: 'star' },
    { id: 'Modern Clinic', label: 'Modern Clinic', icon: 'star-half' },
    { id: 'Standard Clinic', label: 'Standard Clinic', icon: 'shield-checkmark' },
  ];

  const renderDoctor = ({ item }) => (
    <View style={[styles.card, isWide && styles.cardGrid]}>
      <View style={styles.cardTop}>
        <View style={styles.doctorImageContainer}>
          <Image 
            source={{ uri: item.photo ? imgUrl(item.photo, { w: 160 }) : item.photoUrl || 'https://via.placeholder.com/150' }}
            style={styles.doctorImage} 
          />
        </View>
        
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.fullName}</Text>
            {item.pmdcVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#0066FF" style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.specialty}>{item.specialization || 'Dentist'}</Text>
          
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.avgRating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.reviewsText}>({item.totalReviews || 0} Reviews)</Text>
          </View>

          <Text style={styles.clinic}>{item.clinicName}</Text>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#64748B" />
            <Text style={styles.distanceText}>
              {(() => {
                if (!patientCoords) return item.city || 'Nearby';
                const dc = item.coordinates ? String(item.coordinates).split(',').map(Number) : null;
                if (!dc || dc.length < 2 || isNaN(dc[0])) return item.city || 'Nearby';
                const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
                return km !== null ? fmtKm(km) : (item.city || 'Nearby');
              })()}
            </Text>
          </View>
        </View>

        <View style={styles.rightActions}>
          <View style={[styles.statusBadge, { backgroundColor: item.onlineStatus === 'online' ? '#DCFCE7' : '#FEF3C7' }]}>
            <Text style={[styles.statusText, { color: item.onlineStatus === 'online' ? '#16A34A' : '#D97706' }]}>
              {item.onlineStatus === 'online' ? 'Online' : 'Busy'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.heartButton}
            onPress={() => toggleFavorite(item._id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={favorites[String(item._id)] ? 'heart' : 'heart-outline'}
              size={24}
              color={favorites[String(item._id)] ? '#EF4444' : '#0066FF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Experience</Text>
          <Text style={styles.statValue}>{item.experience || 0}+ Years</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Available</Text>
          <Text style={styles.statValue}>Today</Text>
        </View>
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity 
          style={styles.outlineBtn}
          onPress={() => navigation.navigate('DoctorProfile', { doctor: item })}
        >
          <Text style={styles.outlineBtnTxt}>View Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.solidBtn}
          onPress={() => navigation.navigate('Booking', { doctor: item })}
        >
          <Text style={styles.solidBtnTxt}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.blueHeader}>
        {/* Toolbar — native only; on web the root WebTopNav already provides it. */}
        {!isWeb && (
        <AnimatedHeader style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <PressableScale style={{ marginRight: 12, marginTop: 2 }} hitSlop={10} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </PressableScale>
            <View>
              <Text style={styles.headerTitle}>My Dentist</Text>
              <PressableScale style={styles.locationDropdown} scaleTo={0.96}>
                <Ionicons name="location" size={14} color="#FFFFFF" />
                <Text style={styles.locationText}>Islamabad, Pakistan</Text>
                <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </PressableScale>
            </View>
          </View>
          <View style={styles.headerRight}>
            <PressableScale
              style={styles.bellBtn}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}><Text style={styles.bellBadgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
              )}
            </PressableScale>
            <PressableScale style={styles.userAvatar} scaleTo={0.9} onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}>
              {profile?.profileImage ? (
                <Image source={{ uri: imgUrl(profile.profileImage) }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, { backgroundColor: '#4A7DFF', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.avatarOnlineIndicator} />
            </PressableScale>
          </View>
        </AnimatedHeader>
        )}

        <View style={[{ flexDirection: 'row', alignItems: 'center' }, isWide && styles.centeredWide]}>
          {/* Web back button — the native toolbar (with its back arrow) is hidden on web. */}
          {isWeb && navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.webBackBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={[styles.searchBar, { flex: 1 }]}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Dentist / Clinic / Treatment"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons name="mic-outline" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
            <View style={styles.searchDivider} />
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options" size={20} color="#0066FF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <PromoCard style={isWide ? styles.centeredWide : undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, isWide && styles.centeredWide]} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {filters.map((f, i) => (
            <TouchableOpacity 
              key={f.id} 
              style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.id)}
            >
              <Ionicons 
                name={f.icon} 
                size={16} 
                color={activeFilter === f.id ? '#FFFFFF' : (i===1 ? '#F59E0B' : i===2 ? '#3B82F6' : '#64748B')} 
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.filterChipText, activeFilter === f.id && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.listHeader, isWide && styles.centeredWide]}>
          <View>
            <Text style={styles.listTitle}>Nearby Doctors</Text>
            <Text style={styles.listSubtitle}>Top dentists near you</Text>
          </View>
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => navigation.navigate('Map', { doctors: filteredDoctors, patientCoords })}
          >
            <Text style={styles.mapBtnTxt}>See Map</Text>
            <Ionicons name="map-outline" size={16} color="#0066FF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <FlatList
            key={`cols-${columns}`}
            data={filteredDoctors}
            keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || String(index)}
            renderItem={renderDoctor}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
            contentContainerStyle={[
              styles.listContent,
              isWide && styles.listContentWide,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0052FF',
  },
  blueHeader: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  locationDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  bellBtn: {
    marginRight: 16,
    position: 'relative',
    zIndex: 10,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0052FF',
  },
  webBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  filterBtn: {
    padding: 4,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -1,
    overflow: 'hidden',
  },
  filterScroll: {
    maxHeight: 50,
    minHeight: 50,
    marginTop: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    height: 36,
  },
  filterChipActive: {
    backgroundColor: '#0052FF',
    borderColor: '#0052FF',
  },
  filterChipText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  listSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapBtnTxt: {
    color: '#0052FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listContentWide: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  // Centered max-width column for wide screens — keeps the search bar, filter
  // chips, list header, and card grid all aligned to the same column.
  centeredWide: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  columnWrapper: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardGrid: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
  },
  doctorImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginRight: 16,
  },
  doctorImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  specialty: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  clinic: {
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  rightActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  heartButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0052FF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  outlineBtnTxt: {
    color: '#0052FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  solidBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0052FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  solidBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
