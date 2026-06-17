import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import storage from '../config/storage';
import useResponsive from '../hooks/useResponsive';

export default function SplashScreen({ navigation }) {
  const { isWide } = useResponsive();
  useEffect(() => {
    let isCancelled = false;

    const checkLoginStatus = async () => {
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
              source={require('../../assets/app-logo.png')}
              style={styles.webLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.webBrand}>My Dentist PK</Text>
          <Text style={styles.webTagline}>Find &amp; book trusted dentists across Pakistan</Text>

          <View style={styles.webLoaderRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.webLoaderText}>Getting things ready…</Text>
          </View>
        </View>

        <Text style={styles.webFooter}>© 2026 My Dentist PK</Text>
      </View>
    );
  }

  // ── Phone splash (unchanged) ──
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/app-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color="#2563EB" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: Dimensions.get('window').width * 0.7,
    height: Dimensions.get('window').width * 0.7,
  },
  loader: {
    position: 'absolute',
    bottom: 100,
  },
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
