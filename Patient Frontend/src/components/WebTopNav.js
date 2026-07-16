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
  { name: 'Home', label: 'Home', icon: 'home', tabsRoute: 'MainTabs', guest: true },
  { name: 'Rewards', label: 'Rewards', icon: 'gift', tabsRoute: 'MainTabs' },
  { name: 'Campaigns', label: 'Appointments', icon: 'calendar', tabsRoute: 'MainTabs' },
  { name: 'MyReviews', label: 'My Reviews', icon: 'star', tabsRoute: 'MainTabs' },
  { name: 'BillsHistory', label: 'Bills', icon: 'receipt', tabsRoute: 'MainTabs' },
];
// Guests can browse without an account — give them the public discovery tabs
// (account tabs like Rewards/Appointments/Bills require login and are hidden).
const GUEST_TABS = [
  { name: 'Home', label: 'Home', icon: 'home', tabsRoute: 'MainTabs' },
  { name: 'Cosmetic', label: 'Cosmetic', icon: 'happy', tabsRoute: 'MainTabs' },
  { name: 'Orthodontics', label: 'Orthodontics', icon: 'options', tabsRoute: 'MainTabs' },
  { name: 'Implants', label: 'Implants', icon: 'medkit', tabsRoute: 'MainTabs' },
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
  const [isGuest, setIsGuest] = useState(false);
  const rootRoute = navInfo?.root;

  useEffect(() => {
    if (!rootRoute || HIDDEN_ON.has(rootRoute)) { setUserPhoto(null); return; }
    const loadUser = async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) { setUserPhoto(null); setUserRole(null); setIsGuest(true); return; }
        setIsGuest(false);
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
  // NOTE: `DoctorProfile` is the screen for VIEWING a dentist (patient/guest
  // context) — NOT the doctor's own dashboard — so it must not count as doctor
  // context, or guests browsing a dentist would get the doctor nav + Logout.
  const isDoctorContext = userRole
    ? userRole === 'doctor'
    : (rootRoute === 'DoctorTabs' || rootRoute === 'ClinicSetup');
  const isPatient = !isDoctorContext;
  const tabs = isPatient ? (isGuest ? GUEST_TABS : PATIENT_TABS) : DOCTOR_TABS;
  const profileTabsRoute = isPatient ? 'MainTabs' : 'DoctorTabs';

  // Active highlight: the focused tab if we're on the tabs route, else the root.
  const activeName = navInfo.tab || rootRoute;

  const goTab = (t) => navigate(t.tabsRoute, { screen: t.name });
  const goStack = (name) => navigate(name);
  const goProfile = () => navigate(profileTabsRoute, { screen: 'Profile' });

  const handleLogout = async () => {
    try { await storage.removeItem('userToken'); } catch {}
    try { navRef?.reset?.({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] }); } catch {}
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

        {/* RIGHT: Guest — Log in + Sign up */}
        {isPatient && isGuest && (
          <View style={styles.iconGroup}>
            <Pressable style={styles.loginGhost} onPress={() => navigate('Login', { role: 'patient' })}>
              <Text style={styles.loginGhostLabel}>Log in</Text>
            </Pressable>
            <Pressable style={styles.loginPill} onPress={() => navigate('Register', { role: 'patient' })}>
              <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />
              <Text style={styles.loginLabel}>Sign up</Text>
            </Pressable>
          </View>
        )}

        {/* RIGHT: Patient icons */}
        {isPatient && !isGuest && (
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

              {showLinks && <View style={styles.vDivider} />}

              {/* Profile */}
              <Pressable style={[styles.profilePill, isActive('Profile') && styles.profilePillActive, !showLinks && styles.profilePillBare]} onPress={goProfile}>
                {userPhoto
                  ? <Image source={{ uri: userPhoto }} style={styles.profileAvatar} />
                  : <View style={[styles.iconCircle, { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="person-outline" size={18} color="#0052FF" />
                    </View>
                }
                {showLinks && <Text style={[styles.profilePillText, isActive('Profile') && { color: '#0052FF' }]}>Profile</Text>}
              </Pressable>

              {/* Logout */}
              <Pressable style={[styles.logoutPill, !showLinks && styles.logoutPillBare]} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
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

            {showLinks && <View style={styles.vDivider} />}

            {/* Profile (with photo) */}
            <Pressable style={[styles.profilePill, isActive('Profile') && styles.profilePillActive, !showLinks && styles.profilePillBare]} onPress={goProfile}>
              {userPhoto
                ? <Image source={{ uri: userPhoto }} style={styles.profileAvatar} />
                : <View style={[styles.iconCircle, { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="person-outline" size={18} color="#0052FF" />
                  </View>
              }
              {showLinks && <Text style={[styles.profilePillText, isActive('Profile') && { color: '#0052FF' }]}>Profile</Text>}
            </Pressable>

            <Pressable style={[styles.logoutPill, !showLinks && styles.logoutPillBare]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
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
    borderBottomColor: '#EEF2F7',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 1px 0 rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.04)' } : {}),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 66,
    paddingHorizontal: 32,
    width: '100%',
    // No maxWidth cap: the brand should hug the LEFT edge of the window and the
    // actions the RIGHT edge, like a normal app bar — not float inset in a
    // centered 1320px column.
    alignSelf: 'stretch',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  logo: { width: 36, height: 36 },
  brandText: { fontSize: 19, fontWeight: '900', color: '#0A1551', letterSpacing: -0.3 },
  brandAccent: { color: '#60A5FA' },

  // Center nav — a soft segmented group.
  links: { flexDirection: 'row', alignItems: 'center', gap: 2, flexGrow: 1, justifyContent: 'center', marginHorizontal: 16 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
    ...(typeof document !== 'undefined' ? { transitionProperty: 'background-color, color', transitionDuration: '150ms', cursor: 'pointer' } : {}),
  },
  linkActive: { backgroundColor: '#EFF4FF' },
  linkText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  linkTextActive: { color: '#0052FF' },

  iconGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Vertical divider between action icons and the profile/logout cluster.
  vDivider: { width: 1, height: 26, backgroundColor: '#EEF2F7', marginHorizontal: 8 },
  iconPill: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F5F8FF',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
    ...(typeof document !== 'undefined' ? { cursor: 'pointer' } : {}),
  },
  profilePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 5, paddingRight: 12, paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 1, borderColor: '#EEF2F7',
    backgroundColor: '#F8FAFC',
    ...(typeof document !== 'undefined' ? { cursor: 'pointer' } : {}),
  },
  profilePillActive: { borderColor: '#BFD4FF', backgroundColor: '#EFF4FF' },
  profilePillBare: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, paddingLeft: 0, paddingRight: 0 },
  profilePillText: { fontSize: 13.5, fontWeight: '800', color: '#334155' },
  profileAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
  logoutPill: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FEF2F2',
    ...(typeof document !== 'undefined' ? { cursor: 'pointer' } : {}),
  },
  logoutPillBare: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2' },
  logoutLabel: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  loginPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    backgroundColor: '#0052FF',
    ...(typeof document !== 'undefined' ? { cursor: 'pointer' } : {}),
  },
  loginLabel: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  loginGhost: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#F5F8FF',
    ...(typeof document !== 'undefined' ? { cursor: 'pointer' } : {}),
  },
  loginGhostLabel: { fontSize: 14, fontWeight: '800', color: '#0052FF' },

  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#EF4444',
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});
