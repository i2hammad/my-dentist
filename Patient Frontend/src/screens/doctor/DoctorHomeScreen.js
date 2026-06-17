import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import storage from '../../config/storage';
import confirmAlert from '../../utils/confirmAlert';
import PromoBanner from '../../components/PromoBanner';
import API_BASE_URL from '../../config/api';
import imgUrl from '../../config/imgUrl';
import { useNotifications } from '../../context/NotificationContext';

// Tab Components
import AboutTab from './tabs/AboutTab';
import TreatmentsTab from './tabs/TreatmentsTab';
import GalleryTab from './tabs/GalleryTab';
import ReviewsTab from './tabs/ReviewsTab';
import AppointmentsTab from './tabs/AppointmentsTab';
import BillsTab from './tabs/BillsTab';
import RewardsTab from './tabs/RewardsTab';

const { width } = Dimensions.get('window');

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'bills', label: 'Bills & Bill History' },
  { id: 'rewards', label: 'Rewards & Payments' }
];

const getMissingProfileFields = (p) => {
  if (!p) return ['Profile not found'];
  const missing = [];
  if (!p.fullName || p.fullName === 'New Doctor' || p.fullName.trim() === '') missing.push('Full Name');
  if (!p.photo) missing.push('Profile Picture');
  if (!p.specialization) missing.push('Specialization');
  if (!p.experience && p.experience !== 0) missing.push('Years of Experience');
  if (!p.clinicName) missing.push('Clinic Name');
  if (!p.address) missing.push('Clinic Address');
  if (!p.city) missing.push('City');
  if (!p.about) missing.push('Professional Biography (About)');
  if (!p.licenseCert) missing.push('Medical License Certificate');
  if (!p.idFront) missing.push('National ID / PMDC Front Image');
  if (!p.idBack) missing.push('National ID / PMDC Back Image');
  return missing;
};

export default function DoctorHomeScreen({ route, navigation }) {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'about');
  const [reviewStats, setReviewStats] = useState({ avgRating: 0, totalReviews: 0 });
  const isFocused = useIsFocused();
  const { unreadCount } = useNotifications();

  const missingFields = profile ? getMissingProfileFields(profile) : [];
  const isProfileComplete = profile ? missingFields.length === 0 : true;

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  useFocusEffect(
    React.useCallback(() => {
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

  const fetchData = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return navigation.replace('Login');

      const profileRes = await axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      let profileData = null;
      if (profileRes.data?.success) {
        profileData = profileRes.data.data.profile;
        setProfile(profileData);
      }

      const apptRes = await axios.get(`${API_BASE_URL}/api/appointments/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (apptRes.data?.success) setAppointments(apptRes.data.data);

      try {
        const billsRes = await axios.get(`${API_BASE_URL}/api/bills/my`, { headers: { Authorization: `Bearer ${token}` } });
        if (billsRes.data?.success) setBills(billsRes.data.data);
      } catch (err) { console.log('Error fetching bills:', err); }

      if (profileData?._id) {
        try {
          const statsRes = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${profileData._id}/stats`);
          if (statsRes.data?.success) setReviewStats(statsRes.data.data);
        } catch (err) { console.log('Error fetching review stats:', err); }
      }
    } catch (error) {
      console.log('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    confirmAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: async () => {
        await storage.removeItem('userToken');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  const reviewsCount = reviewStats?.totalReviews || 0;
  const ratingStars = reviewStats?.avgRating ? reviewStats.avgRating.toFixed(1) : '0.0';
  const photoUri = profile?.photo ? { uri: imgUrl(profile.photo) } : require('../../../assets/icon.png'); // fallback to generic app icon if possible or handle missing image in JSX

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <View style={{flex: 1}} />
        <TouchableOpacity 
          style={styles.navIconBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#0A1551" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navIconBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#0A1551" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navAvatarContainer} onPress={() => navigation.navigate('DoctorTabs', { screen: 'Profile' })}>
          {profile?.photo ? (
            <Image source={photoUri} style={styles.navAvatar} />
          ) : (
            <View style={[styles.navAvatar, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
          <View style={styles.navOnlineDot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PromoBanner />
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLargeContainer}>
            {profile?.photo ? (
              <Image source={photoUri} style={styles.avatarLarge} />
            ) : (
              <View style={[styles.avatarLarge, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={40} color="#94A3B8" />
              </View>
            )}
            <View style={styles.onlineBadgeTop}>
              <View style={[styles.onlineDot, { backgroundColor: profile?.onlineStatus === 'online' ? '#16A34A' : '#94A3B8' }]} />
              <Text style={styles.onlineText}>{profile?.onlineStatus === 'online' ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.doctorName}>Dr. {profile?.fullName || 'Not specified'}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#0052FF" style={{marginLeft: 4}} />
            </View>
            <Text style={styles.specialtyText}>{profile?.specialization || 'General'}</Text>
            {profile?.qualification ? <Text style={styles.qualificationText}>{profile.qualification}</Text> : null}

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {ratingStars} <Text style={{color: '#64748B'}}>({reviewsCount} Reviews)</Text>
              </Text>
            </View>

            <View style={styles.tagsRow}>
              {profile?.clinicName ? (
                <View style={styles.clinicTag}>
                  <Ionicons name="medical-outline" size={12} color="#0052FF" style={{marginRight: 4}} />
                  <Text style={styles.clinicText}>{profile.clinicName}</Text>
                </View>
              ) : null}
              {profile?.experience ? (
                <View style={styles.expTag}>
                  <Ionicons name="time-outline" size={12} color="#64748B" style={{marginRight: 4}} />
                  <Text style={styles.expText}>{profile.experience}+ Years Experience</Text>
                </View>
              ) : null}
            </View>

            {profile?.address ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={styles.locationText} numberOfLines={1}>{profile.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Warning Banner if profile is incomplete */}
        {!loading && !isProfileComplete && (
          <View style={styles.warningBanner}>
            <View style={styles.warningHeader}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.warningTitle}>Profile Setup Incomplete</Text>
            </View>
            <Text style={styles.warningDesc}>
              Please complete all mandatory profile fields and verification documents to unlock professional features (appointments, consultations, and billing).
            </Text>
            <View style={styles.missingGrid}>
              {missingFields.map((field, idx) => (
                <View key={idx} style={styles.missingItemRow}>
                  <Ionicons name="close-circle" size={14} color="#EF4444" />
                  <Text style={styles.missingItemText}>{field}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity 
              style={styles.completeBtn}
              onPress={() => navigation.navigate('DoctorTabs', { screen: 'Profile' })}
            >
              <Text style={styles.completeBtnText}>Complete Profile Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Horizontal Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {TABS.map((tab) => (
              <TouchableOpacity 
                key={tab.id} 
                style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.id)}>
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Active Tab Panel */}
        <View style={{ flex: 1 }}>
          {activeTab === 'about' && <AboutTab profile={profile} appointments={appointments} bills={bills} reviewStats={reviewStats} navigation={navigation} setActiveTab={setActiveTab} isProfileComplete={isProfileComplete} missingFields={missingFields} />}
          {activeTab === 'treatments' && <TreatmentsTab profile={profile} />}
          {activeTab === 'gallery' && <GalleryTab profile={profile} />}
          {activeTab === 'reviews' && <ReviewsTab profile={profile} />}
          {activeTab === 'appointments' && <AppointmentsTab appointments={appointments} onRefresh={fetchData} navigation={navigation} setActiveTab={setActiveTab} isProfileComplete={isProfileComplete} missingFields={missingFields} />}
          {activeTab === 'bills' && <BillsTab profile={profile} appointments={appointments} isProfileComplete={isProfileComplete} missingFields={missingFields} />}
          {activeTab === 'rewards' && <RewardsTab profile={profile} bills={bills} setActiveTab={setActiveTab} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  /* Navbar */
  navbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF' },
  navBackBtn: { padding: 4 },
  navIconBtn: { padding: 6, marginLeft: 8, position: 'relative' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  navAvatarContainer: { position: 'relative', marginLeft: 12 },
  navAvatar: { width: 32, height: 32, borderRadius: 16 },
  navOnlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#FFF' },

  /* Profile Header */
  profileHeader: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  avatarLargeContainer: { position: 'relative', marginRight: 16 },
  avatarLarge: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#EFF6FF' },
  onlineBadgeTop: { position: 'absolute', bottom: -10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FFF' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  onlineText: { fontSize: 10, fontWeight: 'bold', color: '#16A34A' },

  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  doctorName: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  specialtyText: { fontSize: 13, color: '#0A1551', marginTop: 4, fontWeight: '500' },
  qualificationText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#0A1551', marginLeft: 4 },
  
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  clinicTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  clinicText: { fontSize: 11, color: '#0052FF', fontWeight: '500' },
  expTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  expText: { fontSize: 11, color: '#475569', fontWeight: '500' },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  locationText: { fontSize: 12, color: '#64748B', marginLeft: 4, flex: 1 },

  /* Tabs */
  tabsContainer: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabsContent: { paddingHorizontal: 20, paddingBottom: 0 },
  tabItem: { paddingVertical: 12, marginRight: 24 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#0052FF' },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  tabTextActive: { color: '#0052FF', fontWeight: 'bold' },

  // Setup warning banner
  warningBanner: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: '#FCA5A5' },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B' },
  warningDesc: { fontSize: 12, color: '#7F1D1D', lineHeight: 18, marginBottom: 12 },
  missingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  missingItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FEE2E2', gap: 6 },
  missingItemText: { fontSize: 11, fontWeight: '600', color: '#991B1B' },
  completeBtn: { backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  completeBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
