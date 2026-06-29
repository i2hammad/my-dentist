import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import PromoCard from '../components/PromoCard';
import PatientHeader from '../components/PatientHeader';
import webContent, { isWeb } from '../config/webLayout';

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

function Stars({ rating, size = 15 }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={size}
          color={n <= rating ? '#F59E0B' : '#CBD5E1'}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review, onPressDoctor, onDelete }) {
  const doc = review.doctorId || {};
  const photoUri = doc.photo ? imgUrl(doc.photo) : null;
  return (
    <View style={styles.card}>
      {/* Doctor header */}
      <TouchableOpacity style={styles.docRow} activeOpacity={0.8} onPress={() => onPressDoctor(doc)}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.docPhoto} />
        ) : (
          <View style={[styles.docPhoto, styles.docPhotoFallback]}>
            <Ionicons name="person" size={24} color="#94A3B8" />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.docName} numberOfLines={1}>{doc.fullName || 'Doctor'}</Text>
          </View>
          <Text style={styles.docSpec} numberOfLines={1}>{doc.specialization || 'Dentist'}</Text>
          {!!doc.clinicName && <Text style={styles.docClinic} numberOfLines={1}>{doc.clinicName}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* The review */}
      <View style={styles.reviewMeta}>
        <Stars rating={review.rating} />
        <Text style={styles.date}>{fmtDate(review.createdAt)}</Text>
      </View>
      {!!review.comment && <Text style={styles.comment}>{review.comment}</Text>}

      {/* Doctor reply, if any */}
      {review.doctorReply?.text ? (
        <View style={styles.replyBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Ionicons name="chatbubble-ellipses" size={13} color="#0052FF" />
            <Text style={styles.replyLabel}>Reply from {doc.fullName || 'Doctor'}</Text>
          </View>
          <Text style={styles.replyText}>{review.doctorReply.text}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.deleteRow} onPress={() => onDelete(review)} hitSlop={8}>
        <Ionicons name="trash-outline" size={15} color="#DC2626" />
        <Text style={styles.deleteTxt}>Delete review</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MyReviewsScreen({ navigation }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setLoading(false); return; }
      const res = await axios.get(`${API_BASE_URL}/api/reviews/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setReviews(res.data.data || []);
    } catch (e) {
      // ignore — empty state will show
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isWeb) setStatusBarStyle('light');
    fetchReviews();
  }, [fetchReviews]));

  const goToDoctor = (doc) => {
    if (doc?._id) navigation.navigate('DoctorProfile', { doctorId: doc._id, doctor: doc });
  };

  const handleDelete = (review) => {
    const doDelete = async () => {
      try {
        const token = await storage.getItem('userToken');
        await axios.delete(`${API_BASE_URL}/api/reviews/${review._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReviews((prev) => prev.filter((r) => r._id !== review._id));
      } catch {
        if (!isWeb) Alert.alert('Error', 'Could not delete the review. Please try again.');
      }
    };
    if (isWeb) { doDelete(); return; }
    Alert.alert('Delete review', 'Are you sure you want to delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={isWeb ? ['top'] : []}>
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}
      <PatientHeader greeting="Your Reviews" subtitle="Ratings you've shared with doctors" />

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, webContent]}
        showsVerticalScrollIndicator={false}
      >
        <PromoCard />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0052FF" /></View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>Reviews you write for doctors will appear here.</Text>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.viewAllBtnText}>Find Doctors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.countLabel}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</Text>
            {reviews.map((r) => (
              <ReviewCard key={r._id} review={r} onPressDoctor={goToDoctor} onDelete={handleDelete} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0052FF' },
  blueHeader: { backgroundColor: '#0052FF', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1, backgroundColor: '#F4F6FA' },
  // No horizontal padding here — PromoCard is full-bleed and adds its own.
  // Inner content (cards, labels, empty state) supplies its own horizontal margin.
  bodyContent: { paddingBottom: 32 },

  center: { paddingVertical: 60, alignItems: 'center' },
  countLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 6, marginBottom: 10, marginHorizontal: 18 },

  card: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  docPhoto: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E2E8F0' },
  docPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15.5, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  docSpec: { fontSize: 12.5, color: '#64748B', marginTop: 1 },
  docClinic: { fontSize: 11.5, color: '#94A3B8', marginTop: 1 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 11 },

  reviewMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 12, color: '#94A3B8' },
  comment: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 8 },

  replyBox: { backgroundColor: '#F0F5FF', borderRadius: 10, padding: 10, marginTop: 10 },
  replyLabel: { fontSize: 11.5, fontWeight: '700', color: '#0052FF', marginLeft: 5 },
  replyText: { fontSize: 13, color: '#475569', lineHeight: 18 },

  deleteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start' },
  deleteTxt: { fontSize: 12.5, color: '#DC2626', fontWeight: '600', marginLeft: 5 },

  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 14 },
  emptyText: { fontSize: 13.5, color: '#94A3B8', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  viewAllBtn: { marginTop: 18, backgroundColor: '#0052FF', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24 },
  viewAllBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
