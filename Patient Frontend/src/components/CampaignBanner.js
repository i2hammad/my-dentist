import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

// Hide only on auth/onboarding flows and doctor-role screens. The banner is a
// PATIENT marketing surface, so it shows on every patient screen — including
// the doctor-details (DoctorProfile), Search, Booking, Appointments, etc.
const HIDDEN_ON = new Set([
  'Splash', 'Notice', 'RoleSelection', 'Login', 'Register', 'PatientSetup',
  'DoctorRegister', 'ClinicSetup', 'DoctorTabs', 'DoctorHome',
  'Patients', 'Inbox',
]);

const COLORS = ['#7C3AED', '#0052FF', '#0D9488', '#D97706', '#DC2626'];

export default function CampaignBanner({ navRef, navInfo }) {
  const [campaigns, setCampaigns] = useState([]);
  const [rotationInterval, setRotationInterval] = useState(10);
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const rootRoute = navInfo?.root;
  const isDoctorContext = rootRoute === 'DoctorTabs';

  useEffect(() => {
    if (!rootRoute || HIDDEN_ON.has(rootRoute) || isDoctorContext) return;
    const load = async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) {
          const d = res.data.data;
          const list = Array.isArray(d) ? d : (d?.campaigns || (d ? [d] : []));
          const interval = d?.rotationInterval ?? 10;
          setCampaigns(list);
          setRotationInterval(interval);
          setIdx(0);
        }
      } catch {}
    };
    load();
  }, [rootRoute]);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setIdx(i => (i + 1) % campaigns.length);
    }, rotationInterval * 1000);
    return () => clearInterval(timer);
  }, [campaigns, rotationInterval]);

  if (!rootRoute || HIDDEN_ON.has(rootRoute) || isDoctorContext || !campaigns.length) return null;

  const c = campaigns[idx] || campaigns[0];
  const bg = COLORS[idx % COLORS.length];

  const navigate = (...args) => { try { navRef?.navigate?.(...args); } catch {} };

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.inner}
        activeOpacity={0.85}
        onPress={() => navigate('Promo', { campaign: c })}
      >
        <Ionicons name="megaphone-outline" size={15} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.title} numberOfLines={1}>{c.title || 'Special Offer'}</Text>
        {c.bannerText ? <Text style={styles.sub} numberOfLines={1}> — {c.bannerText}</Text> : null}
      </TouchableOpacity>
      {campaigns.length > 1 && (
        <View style={styles.dots}>
          {campaigns.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {}),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { color: '#FFF', fontWeight: '700', fontSize: 13, flex: 1 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, flexShrink: 1 },
  promoTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  promoText: { color: '#FFF', fontWeight: '700', fontSize: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 14, backgroundColor: '#FFF' },
});
