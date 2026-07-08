import React, { useState, useCallback } from 'react';
import { useRequireLogin } from "../utils/authGuard";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';

export default function SavedDoctorsScreen({ navigation }) {
  useRequireLogin();
  const [savedDoctors, setSavedDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [])
  );

  // Favorites are the single source of truth on the backend (same as the heart
  // on the Home / Search cards). No local storage.
  const loadSaved = async () => {
    setLoading(true);
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setSavedDoctors([]); return; }
      const res = await axios.get(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } });
      const list = res.data?.success ? (res.data.data || []) : [];
      // Each favorite has a populated DoctorProfile under doctorId.
      setSavedDoctors(list.map(f => f.doctorId).filter(Boolean));
    } catch (e) {
      console.log('SavedDoctors error:', e?.message);
      setSavedDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const removeSaved = async (doctor) => {
    const id = String(doctor._id || '');
    setSavedDoctors(prev => prev.filter(d => String(d._id) !== id)); // optimistic
    try {
      const token = await storage.getItem('userToken');
      await axios.delete(`${API_BASE_URL}/api/favorites/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      loadSaved(); // resync on failure
    }
  };

  const renderDoctor = ({ item, index }) => {
    const rating = item.avgRating ? Number(item.avgRating).toFixed(1) : '—';
    const photoUri = item.photo ? imgUrl(item.photo) : null;

    return (
      <TouchableOpacity
        style={[styles.card, { marginTop: index === 0 ? 0 : 12 }]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('DoctorProfile', { doctorId: item._id, doctor: item })}
      >
        {/* Left: Avatar + Online dot */}
        <View style={styles.avatarWrapper}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={28} color="#0052FF" />
            </View>
          )}
          <View style={[styles.onlineDot, { backgroundColor: item.onlineStatus === 'online' ? '#10B981' : '#94A3B8' }]} />
        </View>

        {/* Middle: info */}
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.name} numberOfLines={1}>{item.fullName || 'Doctor'}</Text>
            {item.pmdcVerified && (
              <Ionicons name="checkmark-circle" size={14} color="#0052FF" />
            )}
          </View>
          <Text style={styles.spec} numberOfLines={1}>{item.specialization || 'Dentist'}</Text>
          <Text style={styles.clinic} numberOfLines={1}>{item.clinicName || ''}</Text>
          <View style={styles.metaRow}>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
            <Text style={styles.reviewCount}>({item.totalReviews || 0} reviews)</Text>
            {item.experience > 0 && (
              <Text style={styles.expBadge}>{item.experience}yr exp</Text>
            )}
          </View>
        </View>

        {/* Right: heart button */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => removeSaved(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="heart" size={22} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0A1551" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Saved Doctors</Text>
          {!loading && savedDoctors.length > 0 && (
            <Text style={styles.headerSub}>{savedDoctors.length} doctor{savedDoctors.length !== 1 ? 's' : ''} saved</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
          <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14 }}>Loading your saved doctors…</Text>
        </View>
      ) : savedDoctors.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconRing}>
            <Ionicons name="heart-outline" size={44} color="#0052FF" />
          </View>
          <Text style={styles.emptyTitle}>No Saved Doctors</Text>
          <Text style={styles.emptySub}>
            Tap the{' '}
            <Ionicons name="heart-outline" size={13} color="#64748B" />
            {' '}heart icon on any doctor's card to save them here for quick access.
          </Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="search-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.browseBtnText}>Browse Doctors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={savedDoctors}
          keyExtractor={item => String(item._id)}
          renderItem={renderDoctor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#0052FF', fontWeight: '600', marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  emptyIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF4FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0A1551', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0052FF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#0052FF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  browseBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16, paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#0052FF',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EFFF',
  },
  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatar: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#EFF4FF' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#0A1551' },
  spec: { fontSize: 12, color: '#0052FF', fontWeight: '600', marginTop: 2 },
  clinic: { fontSize: 11, color: '#64748B', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  ratingText: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  reviewCount: { fontSize: 11, color: '#94A3B8' },
  expBadge: { fontSize: 11, color: '#0052FF', fontWeight: '600', backgroundColor: '#EFF4FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  heartBtn: { padding: 8 },
});
