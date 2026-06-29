import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { PressableScale } from './Animated';
import { useNotifications } from '../context/NotificationContext';

const isWeb = Platform.OS === 'web';

// Shared blue patient header used by Home / Reviews / Appointments / Bills.
// Each screen passes its own `greeting` + `subtitle` for the lower detail lines;
// the logo, action icons (saved / inbox / notifications / profile) and styling
// stay identical across tabs.
//
// Props:
//   greeting   - small line, e.g. "Good afternoon," or "Your Reviews"
//   name       - bold line under the greeting (optional; Home uses the user's name)
//   subtitle   - faint tagline, e.g. "Find the right dentist near you"
//   showName   - if false, hides the name line (defaults to !!name)
export default function PatientHeader({ greeting, name, subtitle, showName }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { unreadCount, unreadChatCount } = useNotifications();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (active && res.data?.success) setProfile(res.data.data?.profile || null);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  // Web uses the WebTopNav instead of this header.
  if (isWeb) return null;

  const wantName = showName === undefined ? !!name : showName;

  return (
    <View style={[styles.blueHeader, { paddingTop: insets.top + 4 }]}>
      {/* Decorative accent blobs */}
      <View pointerEvents="none" style={styles.headerBlobA} />
      <View pointerEvents="none" style={styles.headerBlobB} />
      {/* Faint dental glyphs */}
      <View pointerEvents="none" style={styles.headerGlyphs}>
        <Ionicons name="medical-outline" size={64} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', top: -8, right: 60 }} />
        <Ionicons name="happy-outline" size={40} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: 54, right: 8 }} />
        <Ionicons name="sparkles-outline" size={28} color="rgba(255,255,255,0.10)" style={{ position: 'absolute', top: 22, left: 6 }} />
        <Ionicons name="shield-checkmark-outline" size={34} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', bottom: 4, left: 80 }} />
        <Ionicons name="pulse-outline" size={30} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', bottom: 10, right: 110 }} />
      </View>

      <View style={styles.headerRow1}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerLogoBadge}>
            <Image source={require('../../assets/logo-mark.png')} style={styles.headerLogo} resizeMode="contain" />
          </View>
          <Text style={styles.headerTitle}>My <Text style={{ color: '#BFD7FF' }}>Dentist</Text></Text>
        </View>
        <View style={styles.headerRight}>
          <PressableScale style={styles.bellWrapper} hitSlop={8} onPress={() => navigation.navigate('SavedDoctors')}>
            <Ionicons name="heart-outline" size={21} color="#FFFFFF" />
          </PressableScale>
          <PressableScale style={styles.bellWrapper} hitSlop={8} onPress={() => navigation.navigate('PatientInbox')}>
            <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
            {unreadChatCount > 0 && (
              <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text></View>
            )}
          </PressableScale>
          <PressableScale style={styles.bellWrapper} hitSlop={8} onPress={() => navigation.navigate('Notifications', { role: 'patient' })}>
            <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
            )}
          </PressableScale>
          <PressableScale style={styles.profilePhotoWrapper} scaleTo={0.9} onPress={() => navigation.navigate('Profile')}>
            {profile?.profileImage ? (
              <Image source={{ uri: imgUrl(profile.profileImage) }} style={styles.profilePhoto} />
            ) : (
              <Ionicons name="person" size={22} color="#FFFFFF" />
            )}
          </PressableScale>
        </View>
      </View>

      {/* Lower detail lines — customized per screen */}
      <View>
        {!!greeting && <Text style={styles.headerGreeting}>{greeting}</Text>}
        {wantName && !!name && <Text style={styles.headerName}>{name}</Text>}
        {!!subtitle && <Text style={styles.headerTagline}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blueHeader: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  headerBlobA: { position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' },
  headerBlobB: { position: 'absolute', bottom: -60, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(56,189,248,0.18)' },
  headerGlyphs: { ...StyleSheet.absoluteFillObject },
  headerLogoBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' },
  headerLogo: { width: 24, height: 24 },
  headerRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 0.3 },
  headerGreeting: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  headerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  headerTagline: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrapper: { position: 'relative' },
  notifBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0052FF' },
  notifBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  profilePhotoWrapper: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  profilePhoto: { width: '100%', height: '100%', borderRadius: 20 },
});
