import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import storage from '../config/storage';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import useResponsive from '../hooks/useResponsive';

// Root-level top navigation bar for the WEB build. Rendered once ABOVE the stack
// navigator so it stays fixed on every logged-in screen (home, treatment tabs,
// doctor profile, chat, booking, etc.). Native never renders this — phones keep
// the bottom tabs.

// Tab definitions per role. `tab` routes navigate into the role's tab navigator;
// `stack` routes are pushed on the root stack.
const PATIENT_TABS = [
  { name: 'Home', label: 'Home', icon: 'home', tabsRoute: 'MainTabs' },
  { name: 'Campaigns', label: 'Appointments', icon: 'calendar', tabsRoute: 'MainTabs' },
  { name: 'MyReviews', label: 'My Reviews', icon: 'star', tabsRoute: 'MainTabs' },
  { name: 'Cosmetic', label: 'Cosmetic', icon: 'happy', tabsRoute: 'MainTabs' },
  { name: 'Orthodontics', label: 'Orthodontics', icon: 'options', tabsRoute: 'MainTabs' },
];
const DOCTOR_TABS = [
  { name: 'DoctorHome', label: 'Home', icon: 'home', tabsRoute: 'DoctorTabs' },
  { name: 'Appointments', label: 'Appointments', icon: 'calendar', tabsRoute: 'DoctorTabs' },
  { name: 'Patients', label: 'Patients', icon: 'people', tabsRoute: 'DoctorTabs' },
  { name: 'DoctorBills', label: 'Bills', icon: 'receipt', tabsRoute: 'DoctorTabs' },
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
  const { width } = useResponsive();
  // Center nav links only fit alongside the brand + icon cluster on wide screens.
  const showLinks = width >= 1024;
  const [userPhoto, setUserPhoto] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const rootRoute = navInfo?.root;

  useEffect(() => {
    if (!rootRoute || HIDDEN_ON.has(rootRoute)) { setUserPhoto(null); return; }
    const loadUser = async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) { setUserPhoto(null); setUserRole(null); return; }
        const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const p = res.data?.data?.profile || {};
        // Patients store the avatar in `profileImage`, doctors in `photo`.
        const img = p.profileImage || p.photo;
        setUserPhoto(img ? imgUrl(img) : null);
        setUserRole(res.data?.data?.user?.role || res.data?.data?.role || null);
      } catch { setUserPhoto(null); }
    };
    loadUser();
  }, [rootRoute]);

  if (!rootRoute || HIDDEN_ON.has(rootRoute)) return null;
  const navigate = (...args) => { try { navRef?.navigate?.(...args); } catch {} };

  // Determine role from the logged-in USER (authoritative). Shared stack screens
  // like Notifications/Chat have a non-tab rootRoute, so route-based detection
  // alone wrongly fell back to patient — the user's role fixes that. Route check
  // is only a fallback while the role loads.
  const isDoctorContext = userRole
    ? userRole === 'doctor'
    : (rootRoute === 'DoctorTabs' || rootRoute === 'ClinicSetup' || rootRoute === 'DoctorProfile');
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
        {/* LEFT: Brand */}
        <Pressable style={styles.brand} onPress={() => goTab(tabs[0])}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}><Text style={{ color: '#0052FF' }}>My</Text> <Text style={styles.brandAccent}>Dentist</Text></Text>
        </Pressable>

        {/* CENTER: primary nav links (wide screens only) */}
        {showLinks ? (
          <View style={styles.links}>
            {tabs.map((t) => (
              <Pressable key={t.name} style={[styles.link, isActive(t.name) && styles.linkActive]} onPress={() => goTab(t)}>
                <Ionicons name={(t.icon || 'ellipse') + '-outline'} size={17} color={isActive(t.name) ? '#0052FF' : '#64748B'} />
                <Text style={[styles.linkText, isActive(t.name) && styles.linkTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* RIGHT: Patient icons */}
        {isPatient && (
            <View style={styles.iconGroup}>
              {/* Chat */}
              <Pressable style={styles.iconPill} onPress={() => goStack('PatientInbox')}>
                <View style={styles.iconCircle}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0052FF" />
                  {unreadChatCount > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text></View>
                  )}
                </View>
              </Pressable>

              {/* Notifications */}
              <Pressable style={styles.iconPill} onPress={() => navigate('Notifications', { role: 'patient' })}>
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications-outline" size={18} color="#7C3AED" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
                  )}
                </View>
              </Pressable>

              {/* Profile */}
              <Pressable style={[styles.profilePill, isActive('Profile') && styles.profilePillActive, !showLinks && styles.profilePillBare]} onPress={goProfile}>
                {userPhoto
                  ? <Image source={{ uri: userPhoto }} style={styles.profileAvatar} />
                  : <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="person-outline" size={18} color="#0052FF" />
                    </View>
                }
                {showLinks && <Text style={[styles.profilePillText, isActive('Profile') && { color: '#0052FF' }]}>Profile</Text>}
              </Pressable>

              {/* Logout */}
              <Pressable style={[styles.logoutPill, !showLinks && styles.logoutPillBare]} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                {showLinks && <Text style={styles.logoutLabel}>Logout</Text>}
              </Pressable>
            </View>
          )}

        {/* RIGHT: Doctor icons */}
        {!isPatient && (
          <View style={styles.iconGroup}>
            {/* Notifications */}
            <Pressable style={styles.iconPill} onPress={() => navigate('Notifications', { role: 'doctor' })}>
              <View style={styles.iconCircle}>
                <Ionicons name="notifications-outline" size={18} color="#7C3AED" />
                {unreadCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
                )}
              </View>
            </Pressable>

            {/* Profile (with photo) */}
            <Pressable style={[styles.profilePill, isActive('Profile') && styles.profilePillActive, !showLinks && styles.profilePillBare]} onPress={goProfile}>
              {userPhoto
                ? <Image source={{ uri: userPhoto }} style={styles.profileAvatar} />
                : <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="person-outline" size={18} color="#0052FF" />
                  </View>
              }
              {showLinks && <Text style={[styles.profilePillText, isActive('Profile') && { color: '#0052FF' }]}>Profile</Text>}
            </Pressable>

            <Pressable style={[styles.logoutPill, !showLinks && styles.logoutPillBare]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              {showLinks && <Text style={styles.logoutLabel}>Logout</Text>}
            </Pressable>
          </View>
        )}

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
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 40,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brandText: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  brandAccent: { color: '#60A5FA' },

  leftCluster: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1, justifyContent: 'center', marginHorizontal: 16 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  linkActive: { backgroundColor: '#EFF4FF' },
  linkText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  linkTextActive: { color: '#0052FF' },

  iconGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  iconPill: {
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  iconLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginTop: 2 },
  profilePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  profilePillActive: { borderColor: '#0052FF', backgroundColor: '#EFF4FF' },
  // Icon-only (mobile web): strip the rounded-rect chrome so just the round avatar shows.
  profilePillBare: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 },
  profilePillText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  profileAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#0052FF' },
  logoutPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  // Icon-only (mobile web): a round red-tinted button so it matches the bell/avatar circles.
  logoutPillBare: { width: 36, height: 36, borderRadius: 18, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center', alignItems: 'center', borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  logoutLabel: { fontSize: 13, fontWeight: '700', color: '#DC2626' },

  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444',
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
