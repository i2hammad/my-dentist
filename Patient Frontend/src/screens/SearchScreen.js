import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ensureAuth, useIsGuest } from '../utils/authGuard';
import { getCoords } from '../utils/geo';
import { trackSearch } from '../utils/analytics';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import storage from '../config/storage';
import { SkeletonList } from '../components/Skeleton';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { useNotifications } from '../context/NotificationContext';
import useResponsive from '../hooks/useResponsive';
import PromoCard from '../components/PromoCard';
import { REQUEST_TIMEOUT } from '../config/net';

// Haversine formula — returns distance in km between two lat/lng points
const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// No " away" suffix — this now renders inside a pill beside the city, where the
// icon already conveys distance. Matches HomeScreen's format.
const fmtKm = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export default function SearchScreen({ navigation, route }) {
  const { isWide, columns, isWeb } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Nearby');
  // The chip row is always visible on wide screens; on a phone it costs 50px of
  // vertical space, so the toolbar button collapses it.
  const [showFilters, setShowFilters] = useState(true);
  // City is the axis patients actually narrow on, alongside specialty. The chip
  // row previously offered only clinic-tier grades, which is a facilities score
  // most people don't think in. Null means every city.
  const [cityFilter, setCityFilter] = useState(null);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const isGuest = useIsGuest();
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

  // Ask the device for a location when Nearby is active and the signed-in
  // profile didn't supply one. Without this, patientCoords stayed null for
  // signed-out visitors, so the Nearby sort was skipped and every card fell
  // back to showing its city instead of a distance. HomeScreen already does
  // this; Search was missed.
  const askedForLocation = useRef(false);
  useEffect(() => {
    if (activeFilter !== 'Nearby' || patientCoords || askedForLocation.current) return;
    askedForLocation.current = true;
    let active = true;
    (async () => {
      const c = await getCoords();
      if (active && c) setPatientCoords(c);
    })();
    return () => { active = false; };
  }, [activeFilter, patientCoords]);

  const toggleFavorite = async (id) => {
    // Saving needs an account. Previously the heart filled in optimistically and
    // then returned silently for a guest, so it looked saved but vanished on the
    // next load. Send them to login before touching the UI.
    if (!(await ensureAuth(navigation))) return;
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

  // Report the query once the user stops typing, not on every keystroke — a
  // 12-character search would otherwise fire 12 Search events.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) return;
    const t = setTimeout(() => trackSearch(q), 900);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // `specialty` comes from the category chips; `q` is a query handed over from
  // Home when its paged list could not cover the whole directory.
  useEffect(() => {
    const incoming = route.params?.q || route.params?.specialty;
    if (incoming) setSearchQuery(incoming);
  }, [route.params?.specialty, route.params?.q]);

  // Search filters the whole directory client-side (name, specialty, clinic,
  // city), so it needs every doctor rather than a page. The API caps `limit` at
  // 100, so a single request silently stopped at 100 once the directory grew
  // past that — the missing doctors were simply unsearchable, with nothing to
  // indicate it. Page through until the reported total is reached.
  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const PER = 100;
      let all = [];
      let page = 1;
      let total = Infinity;
      // Bounded so a bad `total` can't spin forever.
      while (all.length < total && page <= 50) {
        const res = await axios.get(`${API_BASE_URL}/api/doctors`, {
          params: { limit: PER, page },
          timeout: REQUEST_TIMEOUT,
        });
        const batch = res.data?.data || [];
        total = res.data?.total ?? batch.length;
        all = all.concat(batch);
        if (batch.length < PER) break; // last page
        page += 1;
      }
      setDoctors(all);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cities that actually have dentists, so the row can't offer an empty filter.
  const cities = [...new Set(doctors.map(d => (d.city || '').trim()).filter(Boolean))].sort();

  const filteredDoctors = (activeFilter === 'Favorites' ? favoriteDoctors : doctors).filter(d => {
    const haystack = [d.fullName, d.specialization, d.clinicName, d.city]
      .filter(Boolean).join(' ').toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = searchQuery.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    const matchesQuery = !words.length || words.every(w => haystack.includes(w));
    // City narrows every tab except Favorites, where the saved list is the point.
    if (cityFilter && activeFilter !== 'Favorites'
        && (d.city || '').trim().toLowerCase() !== cityFilter.toLowerCase()) return false;

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
    // Popular first, then distance — same rule as HomeScreen's Nearby tab. Sorting
    // purely by distance discarded the promoted placement the API returns.
    const popRank = (d) => (d.popularType === 'paid' ? 2 : d.popularType === 'earned' ? 1 : 0);
    filteredDoctors.sort((a, b) => popRank(b) - popRank(a) || distOf(a) - distOf(b));
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
          
          {/* City, plus a distance pill when we can compute one — matching how
              Home presents distance, rather than plain grey text. */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#64748B" />
            <Text style={styles.distanceText}>{item.city || 'Pakistan'}</Text>
            {(() => {
              if (!patientCoords || !item.coordinates) return null;
              const dc = String(item.coordinates).split(',').map(Number);
              if (dc.length < 2 || isNaN(dc[0]) || isNaN(dc[1])) return null;
              if (Math.abs(dc[0]) < 0.001 && Math.abs(dc[1]) < 0.001) return null; // skip 0,0
              const km = haversineKm(patientCoords.lat, patientCoords.lng, dc[0], dc[1]);
              if (km === null) return null;
              return (
                <View style={styles.distPill}>
                  <Ionicons name="navigate" size={10} color="#2563EB" />
                  <Text style={styles.distPillTxt}>{fmtKm(km)}</Text>
                </View>
              );
            })()}
          </View>
        </View>

        <View style={styles.rightActions}>
          {/* Shown only when the dentist is actually online. `onlineStatus` is
              'offline' for 28 of 29 dentists, and the badge previously rendered
              anything that wasn't 'online' as "Busy" — so nearly every card
              claimed the dentist was busy when they had simply not opened the
              app. It also contradicted the "Available today" line below it.
              Offline is not a state worth a badge; it says nothing about
              whether an appointment can be booked. */}
          {item.onlineStatus === 'online' && (
            <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.statusText, { color: '#16A34A' }]}>Online</Text>
            </View>
          )}
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

      {/* Inline rather than stacked label-over-value. The stacked form cost 56px
          plus margins for two short facts, which on a phone meant barely two
          cards fitted on screen. */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="briefcase-outline" size={13} color="#64748B" />
          <Text style={styles.statValue}>{item.experience || 0}+ Years</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={13} color="#16A34A" />
          <Text style={[styles.statValue, { color: '#16A34A' }]}>Available today</Text>
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
          onPress={async () => {
            // Guests reach Booking; the account is collected at confirm.
            navigation.navigate('Booking', { doctor: item });
          }}
        >
          <Text style={styles.solidBtnTxt}>Book Appointment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, isWeb && styles.safeAreaWeb]}>
      {/* On web the blue band sat directly under the white WebTopNav as a
          full-bleed slab of colour. The bar belongs to the mobile header; on
          web it becomes a plain white strip so the page reads as one surface. */}
      <View style={[styles.blueHeader, isWeb && styles.headerWeb]}>
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
              {/* Ink, not white — the web header is white now. */}
              <Ionicons name="arrow-back" size={22} color="#0A1551" />
            </TouchableOpacity>
          )}
          <View style={[styles.searchBar, { flex: 1 }, isWeb && styles.searchBarWeb]}>
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
            {/* No filter sheet exists yet, so this scrolls to the filter chips
                rather than sitting dead. A control that does nothing when
                tapped is worse than no control. */}
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowFilters((v) => !v)}
              accessibilityLabel="Filter results"
            >
              <Ionicons name="options" size={20} color={showFilters ? '#0052FF' : '#94A3B8'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <PromoCard style={isWide ? styles.centeredWide : undefined} />
        <View style={styles.cityMenuAnchor}>
        {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, isWide && styles.centeredWide]} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {/* City sits with the other filters as a dropdown rather than its own
              row of chips: one control that states its current value, and the
              list grows with the number of cities instead of the row getting
              longer. */}
          {cities.length > 1 && (
            <TouchableOpacity
              style={[styles.filterChip, !!cityFilter && styles.filterChipActive]}
              onPress={() => setShowCityMenu(v => !v)}
            >
              <Ionicons
                name="location"
                size={16}
                color={cityFilter ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.filterChipText, !!cityFilter && styles.filterChipTextActive]}>
                {cityFilter || 'All cities'}
              </Text>
              <Ionicons
                name={showCityMenu ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={cityFilter ? '#FFFFFF' : '#94A3B8'}
                style={{ marginLeft: 5 }}
              />
            </TouchableOpacity>
          )}
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
        )}

        {showCityMenu && cities.length > 1 && (
          <View style={[styles.cityMenu, isWide && styles.centeredWide]}>
            {[null, ...cities].map((c) => {
              const on = cityFilter === c;
              return (
                <TouchableOpacity
                  key={c || 'all'}
                  style={[styles.cityMenuItem, on && styles.cityMenuItemOn]}
                  onPress={() => { setCityFilter(c); setShowCityMenu(false); }}
                >
                  <Text style={[styles.cityMenuTxt, on && styles.cityMenuTxtOn]}>
                    {c || 'All cities'}
                  </Text>
                  {on && <Ionicons name="checkmark" size={16} color="#0052FF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </View>

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
          <SkeletonList count={columns * 2} columns={columns} maxWidth={isWide ? 1100 : undefined} />
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
            ListEmptyComponent={
              // The list rendered nothing at all when empty. A guest tapping
              // Favorites got a blank screen with no hint that saving needs an
              // account.
              <View style={styles.emptyWrap}>
                <Ionicons
                  name={activeFilter === 'Favorites' ? 'heart-outline' : 'search-outline'}
                  size={40}
                  color="#CBD5E1"
                />
                {activeFilter === 'Favorites' ? (
                  <>
                    <Text style={styles.emptyTitle}>
                      {isGuest ? 'Log in to save dentists' : 'No saved dentists yet'}
                    </Text>
                    <Text style={styles.emptyText}>
                      {isGuest
                        ? 'Saved dentists are kept with your account.'
                        : 'Tap the heart on any dentist to save them here.'}
                    </Text>
                    {isGuest && (
                      <TouchableOpacity
                        style={styles.emptyBtn}
                        onPress={() => navigation.navigate('Login', { role: 'patient' })}
                      >
                        <Text style={styles.emptyBtnTxt}>Log in</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : searchQuery ? (
                  <>
                    <Text style={styles.emptyTitle}>No matches for “{searchQuery}”</Text>
                    <Text style={styles.emptyText}>Try a dentist, clinic or treatment name.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>
                      No {activeFilter.toLowerCase()}{cityFilter ? ` in ${cityFilter}` : ''}
                    </Text>
                    <Text style={styles.emptyText}>
                      {cityFilter ? 'Try another city, or clear the filter.' : 'Try a different filter.'}
                    </Text>
                    {!!cityFilter && (
                      <TouchableOpacity style={styles.emptyBtn} onPress={() => setCityFilter(null)}>
                        <Text style={styles.emptyBtnTxt}>Show all cities</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            }
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
  safeAreaWeb: {
    backgroundColor: '#F8FAFC',
  },
  blueHeader: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerWeb: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingTop: 16,
    paddingBottom: 16,
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
    // Was rgba(255,255,255,.18) for the blue header — invisible now the web
    // header is white.
    backgroundColor: '#F1F5F9',
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
  // On the white web header a white input has no edge, so give it one.
  searchBarWeb: {
    borderWidth: 1,
    borderColor: '#E7EDF5',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  searchRowWeb: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
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
  cityMenu: {
    // Overlays the list rather than shifting it. In normal flow every card moved
    // down by the height of the menu whenever it opened.
    position: 'absolute',
    top: '100%', left: 20, right: 20, zIndex: 50, elevation: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: '#E7EDF5', overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20,
  },
  cityMenuAnchor: { position: 'relative', zIndex: 50 },
  cityMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F5F7FA',
  },
  cityMenuItemOn: { backgroundColor: '#F8FAFF' },
  cityMenuTxt: { fontSize: 14, fontWeight: '600', color: '#334155' },
  cityMenuTxtOn: { color: '#0052FF', fontWeight: '750' },
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
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '750', color: '#0A1551', marginTop: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  emptyBtn: { marginTop: 16, backgroundColor: '#0052FF', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  emptyBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  cardGrid: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
  },
  doctorImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginRight: 12,
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
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6,
  },
  distPillTxt: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
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
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlineBtn: {
    flex: 1,
    height: 42,
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
    height: 42,
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
