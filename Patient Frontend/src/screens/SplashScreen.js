import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Animated, Easing, Text, Platform } from 'react-native';
import storage from '../config/storage';
import { isWeb } from '../config/webLayout';

export default function SplashScreen({ navigation }) {
  // ── Animated web splash values ──────────────────────────────
  const card = useRef(new Animated.Value(0)).current;     // whole-card fade/scale in
  const pulse = useRef(new Animated.Value(0)).current;    // radar ring behind logo
  const bar = useRef(new Animated.Value(0)).current;      // indeterminate progress
  const driftA = useRef(new Animated.Value(0)).current;   // background blob drift
  const driftB = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;    // dots circling the logo
  const float = useRef(new Animated.Value(0)).current;    // logo "breathing"
  // Staggered reveal for logo → brand → tagline → progress.
  const reveal = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!isWeb) return;
    const yoyo = (v, d) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: d, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0, duration: d, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );

    // Entrance: card in, then inner elements cascade.
    Animated.timing(card, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.stagger(
      130,
      reveal.map((v) => Animated.timing(v, { toValue: 1, duration: 560, delay: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }))
    ).start();

    // Continuous loops.
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: false })).start();
    Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 3800, easing: Easing.linear, useNativeDriver: false })).start();
    yoyo(float, 2200).start();
    yoyo(driftA, 6000).start();
    yoyo(driftB, 7500).start();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const checkLoginStatus = async () => {
      // Web-only impersonation bootstrap: if an "impersonate" param is present in the
      // URL, adopt it as the userToken before the normal login-status check reads it.
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
        const impersonateToken = new URLSearchParams(window.location.search).get('impersonate');
        if (impersonateToken) {
          await storage.setItem('userToken', impersonateToken);
          await storage.setItem('impersonating', '1');
          // Strip the param from the URL so the token isn't left lying around.
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // Branded splash: full 3s on native; a short, tasteful 1.2s on web so the
      // animated intro is actually seen without making the site feel slow.
      const delay = new Promise(resolve => setTimeout(resolve, Platform.OS === 'web' ? 1200 : 3000));

      const checkStatus = async () => {
        try {
          const token = await storage.getItem('userToken');
          if (!token) return { route: 'RoleSelection' };

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

          // If token verification fails (expired/invalid), clean up and redirect to RoleSelection
          await storage.removeItem('userToken');
          return { route: 'RoleSelection' };
        } catch (err) {
          console.log('Error checking status in splash:', err);
          return { route: 'RoleSelection' }; // Default fallback on connection issue/error
        }
      };

      // Run delay and status check concurrently, but wait for BOTH to finish
      const [_, navData] = await Promise.all([delay, checkStatus()]);

      if (isCancelled) return;

      // Skip the one-time consent notice for returning users who already agreed.
      const agreed = await storage.getItem('hasAgreedNotice');
      if (agreed === 'true') {
        if (navData.params) navigation.replace(navData.route, navData.params);
        else navigation.replace(navData.route);
      } else {
        navigation.replace('Notice', { nextRoute: navData.route, nextParams: navData.params });
      }
    };

    checkLoginStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ── Web splash — animated, "living" brand intro ─────────────
  if (isWeb) {
    const cardStyle = {
      opacity: card,
      transform: [
        { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
        { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
      ],
    };
    // Each inner element rises + fades on its own stagger step.
    const rise = (i) => ({
      opacity: reveal[i],
      transform: [{ translateY: reveal[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    });
    const ringStyle = {
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 2.3] }) }],
    };
    const floatStyle = { transform: [{ scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] };
    const orbitStyle = { transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
    const barStyle = { transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-96, 232] }) }] };
    const drift = (v, ax, ay) => ({
      transform: [
        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-ax, ax] }) },
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [ay, -ay] }) },
      ],
    });

    return (
      <View style={styles.webContainer}>
        {/* Slowly drifting background blobs — a living backdrop */}
        <Animated.View style={[styles.blob, styles.blobA, drift(driftA, 22, 18)]} />
        <Animated.View style={[styles.blob, styles.blobB, drift(driftB, 20, 24)]} />
        <Animated.View style={[styles.blob, styles.blobC, drift(driftA, 14, -16)]} />

        <Animated.View style={[styles.webCard, cardStyle]}>
          <Animated.View style={[styles.logoWrap, rise(0)]}>
            {/* radar pulse expanding out from behind the logo */}
            <Animated.View style={[styles.pulseRing, ringStyle]} pointerEvents="none" />
            {/* dots orbiting the logo */}
            <Animated.View style={[styles.orbit, orbitStyle]} pointerEvents="none">
              <View style={[styles.orbitDot, styles.orbitDotTop]} />
              <View style={[styles.orbitDot, styles.orbitDotBottom]} />
            </Animated.View>
            <Animated.View style={[styles.logoBadge, floatStyle]}>
              <Image source={require('../../assets/logo-mark.png')} style={styles.webLogo} resizeMode="contain" />
            </Animated.View>
          </Animated.View>

          <Animated.Text style={[styles.webBrand, rise(1)]}>
            <Text style={{ color: '#0052FF' }}>My</Text> <Text style={{ color: '#60A5FA' }}>Dentist</Text>
          </Animated.Text>
          <Animated.Text style={[styles.webTagline, rise(2)]}>Find &amp; book trusted dentists across Pakistan</Animated.Text>

          {/* Indeterminate shimmer progress bar */}
          <Animated.View style={rise(3)}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, barStyle]} />
            </View>
            <Text style={styles.webLoaderText}>Getting things ready…</Text>
          </Animated.View>
        </Animated.View>

        <Text style={styles.webFooter}>© 2026 My Dentist</Text>
      </View>
    );
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
