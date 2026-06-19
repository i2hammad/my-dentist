import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';

export default function SavedDoctorsScreen({ navigation }) {
  const [savedDoctors, setSavedDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [])
  );

  const loadSaved = async () => {
    setLoading(true);
    try {
      const [favsRaw, savedRaw, res] = await Promise.all([
        storage.getItem('patient_favorites'),
        storage.getItem('patient_saved'),
        axios.get(`${API_BASE_URL}/api/doctors?limit=200`),
      ]);
      const favIds = favsRaw ? Object.keys(JSON.parse(favsRaw)) : [];
      const savedIds = savedRaw ? Object.keys(JSON.parse(savedRaw)) : [];
      const allIds = [...new Set([...favIds, ...savedIds])];
      if (!res.data?.success || allIds.length === 0) { setSavedDoctors([]); return; }
      const all = res.data.data || [];
      const filtered = all.filter(d =>
        allIds.includes(d._id) ||
        allIds.includes(d.userId) ||
        allIds.includes(String(d._id))
      );
      setSavedDoctors(filtered);
    } catch (e) {
      setSavedDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const removeSaved = async (doctor) => {
    const id = doctor._id || doctor.userId;
    const favsRaw = await storage.getItem('patient_favorites');
    const savedRaw = await storage.getItem('patient_saved');
    const favObj = favsRaw ? JSON.parse(favsRaw) : {};
    const savedObj = savedRaw ? JSON.parse(savedRaw) : {};
    delete favObj[id];
    delete savedObj[id];
    await storage.setItem('patient_favorites', JSON.stringify(favObj));
    await storage.setItem('patient_saved', JSON.stringify(savedObj));
    setSavedDoctors(prev => prev.filter(d => d._id !== id && d.userId !== id));
  };

  const renderDoctor = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('DoctorProfile', { doctorId: item._id, doctor: item })}
    >
      <Image
        source={{ uri: imgUrl(item.photo) }}
        style={styles.avatar}
        defaultSource={require('../assets/icon.png')}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
        <Text style={styles.spec} numberOfLines={1}>{item.specialization || 'Dentist'}</Text>
        <Text style={styles.clinic} numberOfLines={1}>{item.clinicName || ''}</Text>
        <View style={styles.meta}>
          <Ionicons name="star" size={13} color="#F59E0B" />
          <Text style={styles.rating}>{item.avgRating?.toFixed(1) || '—'}</Text>
          <Text style={styles.reviews}>({item.totalReviews || 0})</Text>
          {item.experience > 0 && (
            <Text style={styles.exp}> · {item.experience}yr exp</Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.removeBtn} onPress={() => removeSaved(item)}>
        <Ionicons name="heart" size={22} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Doctors</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : savedDoctors.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Saved Doctors</Text>
          <Text style={styles.emptySub}>Tap the heart icon on any doctor's profile to save them here.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.browseBtnText}>Browse Doctors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={savedDoctors}
          keyExtractor={item => item._id}
          renderItem={renderDoctor}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: '#0052FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  browseBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, shadowColor: '#0052FF', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#EFF6FF', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#0A1551', marginBottom: 2 },
  spec: { fontSize: 12, color: '#0052FF', fontWeight: '600', marginBottom: 2 },
  clinic: { fontSize: 11, color: '#64748B', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  rating: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginLeft: 3 },
  reviews: { fontSize: 11, color: '#94A3B8', marginLeft: 2 },
  exp: { fontSize: 11, color: '#94A3B8' },
  removeBtn: { padding: 8 },
});
