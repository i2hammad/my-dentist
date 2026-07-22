import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import confirmAlert from '../utils/confirmAlert';
import { useNotifications } from '../context/NotificationContext';

const isWeb = Platform.OS === 'web';

// Shared branded top bar for the doctor tabs (Home / Appointments / Patients /
// Inbox). Edge-to-edge behind the status bar; light bar with faint dental
// glyphs, the two-tone "My Dentist" wordmark, and bell / logout / avatar.
// Optional `title` + `subtitle` render a second line under the brand row.
//
// Web renders nothing — the root WebTopNav already provides the doctor nav.
export default function DoctorHeader({ title, subtitle, right }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { unreadCount, unreadChatCount = 0 } = useNotifications();
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
        const p = res.data?.data?.profile;
        if (active && p?.photo) setPhoto(imgUrl(p.photo));
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

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

  if (isWeb) return null;

  return (
    <>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
        {/* Subtle corner accent — one soft tinted blob for depth, nothing busy. */}
        <View pointerEvents="none" style={styles.cornerBlob} />

        <View style={styles.row}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image source={require('../../assets/logo-mark-sm.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.brandName}><Text style={{ color: '#0052FF' }}>My</Text> <Text style={{ color: '#60A5FA' }}>Dentist</Text></Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('DoctorTabs', { screen: 'Inbox' })}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0A1551" />
              {unreadChatCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications', { role: 'doctor' })}>
              <Ionicons name="notifications-outline" size={22} color="#0A1551" />
              {unreadCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => navigation.navigate('DoctorTabs', { screen: 'Profile' })}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color="#64748B" />
                </View>
              )}
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Optional per-screen title line */}
        {(!!title || !!right) && (
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              {!!title && <Text style={styles.title}>{title}</Text>}
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {right}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EEF7',
    position: 'relative', overflow: 'hidden',
    // soft shadow under the bar for a floating-toolbar feel
    shadowColor: '#0A1551', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4, zIndex: 10,
  },
  cornerBlob: { position: 'absolute', top: -60, right: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,82,255,0.04)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoImg: { width: 30, height: 30 },
  brandName: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF3FF', borderWidth: 1, borderColor: '#D6E2FB', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FBD5D5', justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 8.5, fontWeight: 'bold' },
  avatarContainer: { position: 'relative', marginLeft: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#E6ECF8' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#FFF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#0A1551', letterSpacing: 0.2 },
  subtitle: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
});
