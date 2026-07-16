import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import storage from '../config/storage';
import { isWeb } from '../config/webLayout';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    let isCancelled = false;

    // Web deep-link params (from the marketing site): ?doctor=<id> opens that
    // dentist's profile, ?login=1 opens the login screen directly.
    let deepDoctorId = null;
    let wantLogin = false;
    let wantSignup = false;

    // Which inner tab each root navigator legitimately owns. Used to restore the
    // exact tab from the URL path on web reload (so refreshing /DoctorTabs/DoctorBills
    // keeps you on Bills instead of bouncing to the default Home tab).
    const TABS_BY_ROOT = {
      DoctorTabs: ['DoctorHome', 'Appointments', 'Patients', 'DoctorBills', 'Inbox', 'Profile', 'DoctorAppointmentDetail'],
      MainTabs: ['Home', 'Rewards', 'MyReviews', 'Campaigns', 'BillsHistory', 'Profile', 'Cosmetic', 'Implants', 'Orthodontics'],
    };
    // Read {root, screen} from the current web URL path, if it names a known
    // tab navigator + a valid inner screen. Returns null otherwise.
    const readPathTarget = () => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
      const parts = (window.location.pathname || '').split('/').filter(Boolean);
      const root = parts[0];
      const screen = parts[1];
      if (TABS_BY_ROOT[root] && screen && TABS_BY_ROOT[root].includes(screen)) {
        return { route: root, params: { screen } };
      }
      return null;
    };

    const checkLoginStatus = async () => {
      // Web-only param bootstrap: impersonation token + deep-link params.
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
        const params = new URLSearchParams(window.location.search);
        deepDoctorId = params.get('doctor');
        wantLogin = params.get('login') === '1' || params.get('screen') === 'login';
        wantSignup = params.get('signup') === '1';

        const impersonateToken = params.get('impersonate');
        if (impersonateToken) {
          await storage.setItem('userToken', impersonateToken);
          await storage.setItem('impersonating', '1');
          // Strip the param from the URL so the token isn't left lying around.
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // No splash on web — route immediately. Native keeps its 3s branded splash.
      const delay = new Promise(resolve => setTimeout(resolve, Platform.OS === 'web' ? 0 : 3000));

      const checkStatus = async () => {
        try {
          const token = await storage.getItem('userToken');
          // Web: let guests browse — land on Home (patient tabs) instead of the
          // login wall. Native keeps Role Selection.
          if (!token) {
            return Platform.OS === 'web'
              ? { route: 'MainTabs', params: { screen: 'Home' } }
              : { route: 'Login' };
          }

          // Fetch user details from the backend to verify the token and get the role/profile
          const axios = require('axios');
          const API_BASE_URL = require('../config/api').default;

          const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.data?.success && res.data.data?.user) {
            const user = res.data.data.user;
            const profile = res.data.data.profile || {};
            const isNewUser = profile.fullName === 'New Doctor' || profile.fullName === 'New Patient';

            if (user.role === 'doctor') {
              if (isNewUser) {
                return { route: 'DoctorRegister' };
              } else {
                return { route: 'DoctorTabs', params: { screen: 'DoctorHome' } };
              }
            } else {
              if (isNewUser) {
                return { route: 'PatientSetup' };
              } else {
                return { route: 'MainTabs', params: { screen: 'Home' } };
              }
            }
          }

          // If token verification fails (expired/invalid), clean up and redirect to Login
          await storage.removeItem('userToken');
          return { route: 'Login' };
        } catch (err) {
          // Suspended account → log out cleanly so they can't proceed.
          if (err?.response?.status === 403 && err?.response?.data?.blocked) {
            await storage.removeItem('userToken');
            return { route: 'Login' };
          }
          console.log('Error checking status in splash:', err);
          return { route: 'Login' }; // Default fallback on connection issue/error
        }
      };

      // Run delay and status check concurrently, but wait for BOTH to finish
      const [_, navData] = await Promise.all([delay, checkStatus()]);

      if (isCancelled) return;

      // Web reload: if the URL path names a valid tab and it belongs to the SAME
      // root the role resolved to (doctor→DoctorTabs, patient→MainTabs), restore
      // that exact tab instead of the default landing tab. Guards against a stale
      // cross-role URL (e.g. a doctor path while logged in as a patient).
      const pathTarget = readPathTarget();
      if (pathTarget && pathTarget.route === navData.route) {
        navData.params = pathTarget.params;
      }

      // Route straight to the resolved destination — the one-time consent Notice
      // screen has been removed (was previously shown to first-time native users).
      if (navData.params) navigation.replace(navData.route, navData.params);
      else navigation.replace(navData.route);

      // Web deep-links: open the requested screen on top of the base route so
      // Back returns to Home. Login takes priority over a doctor link.
      if (Platform.OS === 'web') {
        if (wantSignup) navigation.navigate('Register', { role: 'patient' });
        else if (wantLogin) navigation.navigate('Login', { role: 'patient' });
        else if (deepDoctorId) navigation.navigate('DoctorProfile', { doctorId: deepDoctorId });
      }
    };

    checkLoginStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ── Web: no splash — route immediately. Render a plain blank while the
  //    (instant) auth check resolves, so there's no branded splash flash.
  if (isWeb) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  // ── Phone splash — minimal, white, polished ──
  return (
    <View style={styles.container}>
      {/* Soft brand accents — barely-there, keep the white feel */}
      <View pointerEvents="none" style={[styles.softBlob, styles.softBlobA]} />
      <View pointerEvents="none" style={[styles.softBlob, styles.softBlobB]} />

      <View style={styles.brandWrap}>
        <View style={styles.logoBadgePhone}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}><Text style={{ color: '#0052FF' }}>My</Text> <Text style={{ color: '#60A5FA' }}>Dentist</Text></Text>
        <View style={styles.brandRule} />
        <Text style={styles.brandTagline}>Find &amp; book trusted dentists across Pakistan</Text>
      </View>

      <View style={styles.loaderRow}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={styles.loaderText}>Getting things ready…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // Faint off-white/blue blobs for subtle depth without losing the white feel.
  softBlob: { position: 'absolute', borderRadius: 9999 },
  softBlobA: { width: 360, height: 360, backgroundColor: '#F2F7FF', top: -140, right: -110 },
  softBlobB: { width: 300, height: 300, backgroundColor: '#F5F9FF', bottom: -120, left: -90 },

  brandWrap: { alignItems: 'center', paddingHorizontal: 32 },
  logoBadgePhone: {
    width: 132,
    height: 132,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    shadowColor: '#0052FF',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logo: { width: 96, height: 96 },
  brandName: { fontSize: 26, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  brandRule: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#0052FF', marginTop: 10, marginBottom: 12 },
  brandTagline: { fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  loaderRow: { position: 'absolute', bottom: 56, flexDirection: 'row', alignItems: 'center' },
  loaderText: { marginLeft: 8, fontSize: 13, color: '#94A3B8', fontWeight: '600' },

  // ── Web / large-screen animated splash ──
  webContainer: {
    flex: 1,
    backgroundColor: '#EAF1FC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.55 },
  blobA: { width: 460, height: 460, backgroundColor: '#DBEAFE', top: -140, right: -120 },
  blobB: { width: 360, height: 360, backgroundColor: '#C7E0FF', bottom: -110, left: -90 },
  blobC: { width: 240, height: 240, backgroundColor: '#E9D5FF', top: '55%', right: '18%', opacity: 0.35 },
  webCard: {
    width: 440,
    maxWidth: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 52,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 28 },
    borderWidth: 1,
    borderColor: '#E8EEF8',
  },
  logoWrap: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  pulseRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: '#60A5FA',
  },
  orbit: { position: 'absolute', width: 168, height: 168, borderRadius: 84 },
  orbitDot: { position: 'absolute', width: 11, height: 11, borderRadius: 6, left: '50%', marginLeft: -5.5 },
  orbitDotTop: { top: -1, backgroundColor: '#2563EB' },
  orbitDotBottom: { bottom: -1, backgroundColor: '#93C5FD' },
  logoBadge: {
    width: 132,
    height: 132,
    borderRadius: 32,
    backgroundColor: '#F4F7FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webLogo: { width: 96, height: 96 },
  webBrand: { fontSize: 30, fontWeight: '800', color: '#0B1F4D', letterSpacing: -0.5 },
  webTagline: { fontSize: 15, color: '#5A6B8C', marginTop: 8, textAlign: 'center', maxWidth: 300 },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E6EEF9',
    overflow: 'hidden',
    marginTop: 34,
  },
  progressFill: { width: 96, height: 6, borderRadius: 3, backgroundColor: '#2563EB' },
  webLoaderText: { color: '#64748B', fontSize: 13.5, marginTop: 14 },
  webFooter: { position: 'absolute', bottom: 28, color: '#94A3B8', fontSize: 13 },
});
