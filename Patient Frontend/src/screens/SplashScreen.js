import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import storage from '../config/storage';
import useResponsive from '../hooks/useResponsive';

export default function SplashScreen({ navigation }) {
  const { isWide } = useResponsive();
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

      // Branded splash delay on native; near-instant on web (users expect a fast site).
      const delay = new Promise(resolve => setTimeout(resolve, Platform.OS === 'web' ? 0 : 3000));
      
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

  // ── Web / large-screen splash: branded, centered card on a gradient ──
  if (isWide) {
    return (
      <View style={styles.webContainer}>
        {/* decorative soft blobs */}
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />

        <View style={styles.webCard}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.webLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.webBrand}><Text style={{ color: '#0052FF' }}>My</Text> <Text style={{ color: '#60A5FA' }}>Dentist</Text></Text>
          <Text style={styles.webTagline}>Find &amp; book trusted dentists across Pakistan</Text>

          <View style={styles.webLoaderRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.webLoaderText}>Getting things ready…</Text>
          </View>
        </View>

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
  skipButton: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Web / large-screen splash ──
  webContainer: {
    flex: 1,
    backgroundColor: '#EAF1FC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.5 },
  blobA: { width: 420, height: 420, backgroundColor: '#DBEAFE', top: -120, right: -100 },
  blobB: { width: 320, height: 320, backgroundColor: '#C7E0FF', bottom: -90, left: -80 },
  webCard: {
    width: 420,
    maxWidth: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 48,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
    borderWidth: 1,
    borderColor: '#E8EEF8',
  },
  logoBadge: {
    width: 132,
    height: 132,
    borderRadius: 32,
    backgroundColor: '#F4F7FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  webLogo: { width: 96, height: 96 },
  webBrand: { fontSize: 28, fontWeight: '800', color: '#0B1F4D', letterSpacing: -0.5 },
  webTagline: { fontSize: 15, color: '#5A6B8C', marginTop: 8, textAlign: 'center', maxWidth: 280 },
  webLoaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32 },
  webLoaderText: { color: '#64748B', fontSize: 14 },
  webSkipButton: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: '#2563EB',
    borderRadius: 999,
  },
  webSkipText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  webFooter: { position: 'absolute', bottom: 28, color: '#94A3B8', fontSize: 13 },
});
