import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { useIsFocused } from '@react-navigation/native';

function StatusBadge({ status }) {
  const map = {
    online: { color: '#16A34A', bg: '#DCFCE7', label: 'Online' },
    busy:   { color: '#D97706', bg: '#FEF3C7', label: 'Busy' },
    offline:{ color: '#6B7280', bg: '#F3F4F6', label: 'Offline' },
  };
  const s = map[status] || map.offline;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function DoctorCard({ doc, onPress, isFavorite, onToggleFavorite }) {
  const photoUri = doc.profileImage
    ? imgUrl(doc.profileImage)
    : null;

  const status = doc.isOnline === true || doc.onlineStatus === 'online'
    ? 'online'
    : doc.isOnline === false || doc.onlineStatus === 'busy'
    ? 'busy'
    : 'offline';

  return (
    <View style={styles.doctorCard}>
      <View style={styles.doctorCardTop}>
        <View style={styles.photoWrapper}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.doctorPhoto} />
          ) : (
            <View style={styles.doctorPhotoPlaceholder}>
              <Ionicons name="person" size={36} color="#94A3B8" />
            </View>
          )}
          <View style={styles.statusBadgeOverlay}>
            <StatusBadge status={status} />
          </View>
        </View>

        <View style={styles.doctorInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {doc.fullName || 'Doctor'}
            </Text>
            {doc.pmdcVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={{ marginLeft: 4 }} />
            )}
          </View>

          <Text style={styles.doctorSpecialty} numberOfLines={1}>
            {doc.specialization || 'Dentist'}
          </Text>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {doc.rating || doc.avgRating || '4.9'}
            </Text>
            <Text style={styles.reviewCount}>
              ({doc.reviewCount || doc.totalReviews || '256'} Reviews)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicName || 'Private Clinic'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {doc.clinicCity || doc.address || 'Islamabad, Pakistan'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.heartButton}
          onPress={() => onToggleFavorite(doc._id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? '#EF4444' : '#94A3B8'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.doctorCardBottom}>
        <View style={styles.bottomInfoItem}>
          <Ionicons name="time-outline" size={14} color="#2563EB" />
          <Text style={styles.bottomInfoText}>
            Experience: {doc.experience ? `${doc.experience}+ Years` : '5+ Years'}
          </Text>
        </View>
        <View style={styles.bottomInfoItem}>
          <Ionicons name="calendar-outline" size={14} color="#16A34A" />
          <Text style={[styles.bottomInfoText, { color: '#16A34A' }]}>
            Available: Today
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.viewProfileBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.viewProfileBtnText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CosmeticScreen({ navigation }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState({});
  const isFocused = useIsFocused();

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/doctors`);
      if (res.data?.success) {
        // Filter doctors specialized in Cosmetic Dentistry
        const filtered = (res.data.data || []).filter(doc => 
          doc.specialization?.toLowerCase().includes('cosmetic') ||
          doc.specialization?.toLowerCase().includes('aesthetic') ||
          doc.about?.toLowerCase().includes('cosmetic') ||
          doc.about?.toLowerCase().includes('whitening') ||
          doc.about?.toLowerCase().includes('veneer')
        );
        setDoctors(filtered);
      }
    } catch (e) {
      console.log('Error fetching cosmetic doctors:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) fetchDoctors();
  }, [isFocused]);

  const toggleFavorite = (id) => {
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.blueHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cosmetic Dentistry</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Ionicons name="sparkles" size={24} color="#0052FF" />
          <Text style={styles.introText}>
            Find top cosmetic dental specialists for teeth whitening, dental veneers, smile makeovers, and aesthetic restorations.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0052FF" />
            <Text style={styles.loadingText}>Loading cosmetic specialists…</Text>
          </View>
        ) : doctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="sad-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No cosmetic specialists found right now.</Text>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.viewAllBtnText}>View All Doctors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          doctors.map(doc => (
            <DoctorCard
              key={doc._id}
              doc={doc}
              isFavorite={!!favorites[doc._id]}
              onToggleFavorite={toggleFavorite}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc._id })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0052FF',
  },
  blueHeader: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  bodyContent: {
    paddingBottom: 32,
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0052FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  introText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  viewAllBtn: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  viewAllBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  doctorCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  photoWrapper: {
    marginRight: 12,
  },
  doctorPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  doctorPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  doctorInfo: {
    flex: 1,
    paddingBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  doctorSpecialty: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reviewCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
  },
  heartButton: {
    padding: 4,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  doctorCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bottomInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  viewProfileBtn: {
    backgroundColor: '#0052FF',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  viewProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
