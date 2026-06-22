import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import storage from '../config/storage';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';

// Root-level top navigation bar for the WEB build. Rendered once ABOVE the stack
// navigator so it stays fixed on every logged-in screen (home, treatment tabs,
// doctor profile, chat, booking, etc.). Native never renders this — phones keep
// the bottom tabs.

// Tab definitions per role. `tab` routes navigate into the role's tab navigator;
// `stack` routes are pushed on the root stack.
const PATIENT_TABS = [
  { name: 'Home', label: 'Home', icon: 'home', tabsRoute: 'MainTabs' },
  { name: 'Implants', label: 'Implants', icon: 'medkit', tabsRoute: 'MainTabs' },
  { name: 'Cosmetic', label: 'Cosmetic', icon: 'happy', tabsRoute: 'MainTabs' },
  { name: 'Orthodontics', label: 'Orthodontics', icon: 'options', tabsRoute: 'MainTabs' },
];
const DOCTOR_TABS = [
  { name: 'DoctorHome', label: 'Home', icon: 'home', tabsRoute: 'DoctorTabs' },
  { name: 'Appointments', label: 'Appointments', icon: 'calendar', tabsRoute: 'DoctorTabs' },
  { name: 'Patients', label: 'Patients', icon: 'people', tabsRoute: 'DoctorTabs' },
  { name: 'Inbox', label: 'Inbox', icon: 'chatbubbles', tabsRoute: 'DoctorTabs' },
];

// Routes where the navbar should NOT appear (auth / onboarding flow).
const HIDDEN_ON = new Set([
  'Splash', 'Notice', 'RoleSelection', 'Login', 'Register', 'PatientSetup',
  'DoctorRegister', 'ClinicSetup',
]);

// Driven by props from AppNavigator (which owns the navigation ref) so this can
// render OUTSIDE the navigator context without crashing.
export default function WebTopNav({ navRef, navInfo }) {
  const { unreadChatCount = 0, unreadCount = 0 } = useNotifications() || {};
  const [patientPhoto, setPatientPhoto] = useState(null);
  const rootRoute = navInfo?.root;

  useEffect(() => {
    if (!rootRoute || HIDDEN_ON.has(rootRoute)) { setPatientPhoto(null); return; }
    const loadPhoto = async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) { setPatientPhoto(null); return; }
        const res = await axios.get(`${API_BASE_URL}/api/patients/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data.data?.profileImage) {
          setPatientPhoto(imgUrl(res.data.data.profileImage));
        } else {
          setPatientPhoto(null);
        }
      } catch { setPatientPhoto(null); }
    };
    loadPhoto();
  }, [rootRoute]);

  if (!rootRoute || HIDDEN_ON.has(rootRoute)) return null;
  const navigate = (...args) => { try { navRef?.navigate?.(...args); } catch {} };

  // Determine role. Doctor context = under DoctorTabs or on a doctor-only stack.
  const isDoctorContext = rootRoute === 'DoctorTabs' || rootRoute === 'ClinicSetup';
  const isPatient = !isDoctorContext;
  const tabs = isPatient ? PATIENT_TABS : DOCTOR_TABS;
  const profileTabsRoute = isPatient ? 'MainTabs' : 'DoctorTabs';

  // Active highlight: the focused tab if we're on the tabs route, else the root.
  const activeName = navInfo.tab || rootRoute;

  const goTab = (t) => navigate(t.tabsRoute, { screen: t.name });
  const goStack = (name) => navigate(name);
  const goProfile = () => navigate(profileTabsRoute, { screen: 'Profile' });

  const handleLogout = async () => {
    try { await storage.removeItem('userToken'); } catch {}
    try { navRef?.reset?.({ index: 0, routes: [{ name: 'RoleSelection' }] }); } catch {}
  };

  const isActive = (name) => activeName === name;

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        {/* LEFT: Brand + quick-action icons */}
        <View style={styles.leftCluster}>
          <Pressable style={styles.brand} onPress={() => goTab(tabs[0])}>
            <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>My Dentist <Text style={styles.brandAccent}>PK</Text></Text>
          </Pressable>

          {/* Patient icons — chat, bell, profile, logout — right after brand */}
          {isPatient && (
            <>
              <Pressable style={styles.iconBtn} onPress={() => goStack('PatientInbox')}>
                <Ionicons name="chatbubbles-outline" size={22} color="#334155" />
                {unreadChatCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text></View>
                )}
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => goStack('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color="#334155" />
                {unreadCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
                )}
              </Pressable>
              <Pressable
                onPress={goProfile}
                style={[styles.profileBtn, isActive('Profile') && styles.profileBtnActive]}
              >
                {patientPhoto
                  ? <Image source={{ uri: patientPhoto }} style={styles.profileAvatar} />
                  : <Ionicons name="person-circle-outline" size={24} color={isActive('Profile') ? '#0052FF' : '#334155'} />
                }
                <Text style={[styles.profileText, isActive('Profile') && styles.linkTextActive]}>Profile</Text>
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#DC2626" />
              </Pressable>
            </>
          )}

          {/* Doctor profile + logout */}
          {!isPatient && (
            <>
              <Pressable
                onPress={goProfile}
                style={[styles.profileBtn, isActive('Profile') && styles.profileBtnActive]}
              >
                <Ionicons name="person-circle-outline" size={24} color={isActive('Profile') ? '#0052FF' : '#334155'} />
                <Text style={[styles.profileText, isActive('Profile') && styles.linkTextActive]}>Profile</Text>
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#DC2626" />
              </Pressable>
            </>
          )}
        </View>

        {/* Tab links removed as per user request */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 2px 12px rgba(15,23,42,0.05)' } : {}),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 40,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    gap: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brandText: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  brandAccent: { color: '#0052FF' },

  leftCluster: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1, justifyContent: 'flex-end' },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  linkActive: { backgroundColor: '#EFF4FF' },
  linkText: { fontSize: 14.5, fontWeight: '600', color: '#64748B' },
  linkTextActive: { color: '#0052FF' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { position: 'relative', padding: 8, borderRadius: 10 },
  logoutBtn: { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', marginLeft: 2 },
  profileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  profileBtnActive: { borderColor: '#0052FF', backgroundColor: '#EFF4FF' },
  profileText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  profileAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1' },

  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444',
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
