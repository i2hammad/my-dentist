import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import { actionMenu } from '../../../utils/confirmAlert';
import storage from '../../../config/storage';

export default function ReviewsTab({ profile }) {
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [profile]);

  const fetchReviews = async () => {
    try {
      if (profile?._id) {
        const res = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${profile._id}`);
        if (res.data?.success) setReviews(res.data.data || []);
        else setReviews([]);

        const statsRes = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${profile._id}/stats`);
        if (statsRes.data?.success) {
          const s = statsRes.data.data || {};
          setStats({
            average: s.avgRating || 0,
            count: s.totalReviews || 0,
            distribution: s.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            recommend: s.recommendPercentage || 0,
          });
        }
      } else {
        setReviews([]);
        setStats({ average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
      }
    } catch (error) {
      console.log('Error fetching reviews:', error);
      setReviews([]);
      setStats({ average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
    } finally {
      setLoading(false);
    }
  };

  const submitReply = async () => {
    if (!replyText.trim() || !replyTarget) return;
    setPostingReply(true);
    try {
      const token = await storage.getItem('userToken');
      await axios.put(`${API_BASE_URL}/api/reviews/${replyTarget._id}/reply`, { text: replyText.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setReplyTarget(null);
      setReplyText('');
      fetchReviews();
      Alert.alert('Reply posted', 'Your reply is now visible on this review.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not post reply.');
    } finally {
      setPostingReply(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0052FF" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Reviews</Text>
          <Text style={styles.cardSubtitle}>Real experiences from our happy patients</Text>

          {/* Rating summary */}
          <View style={styles.ratingSummaryRow}>
            <View style={styles.avgRatingCol}>
              <Text style={styles.bigRatingText}>{(stats.average || 0).toFixed(1)}</Text>
              <View style={styles.starsRowBig}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name={i < Math.round(stats.average) ? 'star' : 'star-outline'} size={18} color="#F59E0B" />
                ))}
              </View>
              <Text style={styles.reviewsCountText}>({stats.count} Reviews)</Text>
            </View>

            <View style={styles.distCol}>
              {[5, 4, 3, 2, 1].map(stars => {
                const count = stats.distribution?.[stars] || 0;
                const pct = Math.round((count / (stats.count || 1)) * 100);
                return (
                  <View key={stars} style={styles.distRow}>
                    <Text style={styles.distStarsText}>{stars} <Ionicons name="star" size={10} color="#F59E0B" /></Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.distCountText}>{count}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.recommendCol}>
              <Ionicons name="thumbs-up" size={20} color="#0052FF" />
              <Text style={styles.recommendPctText}>{stats.count > 0 ? `${stats.recommend}%` : '0%'}</Text>
              <Text style={styles.recommendText}>Patients Recommend</Text>
            </View>
          </View>

          {/* Reviews list */}
          <View style={styles.reviewsList}>
            {reviews.length > 0 ? reviews.map((review, idx) => (
              <View key={review._id || idx} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Image
                    source={{ uri: `https://ui-avatars.com/api/?name=${review.patientId?.fullName?.replace(' ', '+') || 'Patient'}&background=F1F5F9&color=0052FF` }}
                    style={styles.reviewerAvatar}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.reviewerMeta}>
                      <Text style={styles.reviewerName}>{review.patientId?.fullName || 'Patient'}</Text>
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>Verified Patient</Text>
                      </View>
                    </View>
                    <View style={styles.starsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.timeText}>{formatTimeAgo(review.createdAt)}</Text>
                  <TouchableOpacity
                    style={{ padding: 4, marginLeft: 8 }}
                    onPress={() => actionMenu({
                      title: 'Review Options',
                      message: `Reviewer: ${review.patientId?.fullName || 'Patient'}\nRating: ${review.rating} Stars`,
                      options: [
                        { text: review.doctorReply?.text ? 'Edit Reply' : 'Reply to Review', onPress: () => { setReplyTarget(review); setReplyText(review.doctorReply?.text || ''); } },
                        { text: 'Close', style: 'cancel' }
                      ]
                    })}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.commentText}>{review.comment}</Text>

                {review.doctorReply?.text ? (
                  <View style={styles.replyBox}>
                    <View style={styles.replyHeader}>
                      <Ionicons name="arrow-undo" size={13} color="#0052FF" />
                      <Text style={styles.replyAuthor}>Your reply</Text>
                    </View>
                    <Text style={styles.replyText}>{review.doctorReply.text}</Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                  <TouchableOpacity style={styles.helpfulBtn}>
                    <Ionicons name="thumbs-up-outline" size={14} color="#64748B" />
                    <Text style={styles.helpfulBtnText}>Helpful ({review.helpfulCount || 0})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.helpfulBtn} onPress={() => { setReplyTarget(review); setReplyText(review.doctorReply?.text || ''); }}>
                    <Ionicons name="chatbubble-outline" size={14} color="#0052FF" />
                    <Text style={[styles.helpfulBtnText, { color: '#0052FF' }]}>{review.doctorReply?.text ? 'Edit Reply' : 'Reply'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyStateText}>No reviews yet. Reviews from your patients will appear here.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Reply modal */}
      <Modal visible={!!replyTarget} transparent animationType="slide" onRequestClose={() => setReplyTarget(null)}>
        <View style={styles.replyOverlay}>
          <View style={[styles.replyModal, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.replyModalHead}>
              <Text style={styles.replyModalTitle}>Reply to {replyTarget?.patientId?.fullName || 'Patient'}</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            {!!replyTarget?.comment && <Text style={styles.replyQuote}>"{replyTarget.comment}"</Text>}
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write a professional reply…"
              placeholderTextColor="#94A3B8"
              multiline
            />
            <TouchableOpacity style={[styles.replySubmit, postingReply && { opacity: 0.6 }]} onPress={submitReply} disabled={postingReply}>
              {postingReply ? <ActivityIndicator color="#FFF" /> : <Text style={styles.replySubmitText}>Post Reply</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },

  ratingSummaryRow: { flexDirection: 'row', columnGap: 16, rowGap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avgRatingCol: { alignItems: 'center', width: 110 },
  bigRatingText: { fontSize: 42, fontWeight: '900', color: '#0A1551' },
  starsRowBig: { flexDirection: 'row', gap: 2, marginVertical: 6 },
  reviewsCountText: { fontSize: 12, color: '#0A1551', fontWeight: '600' },
  distCol: { flex: 1, justifyContent: 'center', minWidth: 160 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  distStarsText: { fontSize: 12, color: '#0A1551', fontWeight: '600', width: 24 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0052FF', borderRadius: 3 },
  distCountText: { fontSize: 12, color: '#0A1551', fontWeight: '600', width: 30, textAlign: 'right' },
  recommendCol: { alignItems: 'center', justifyContent: 'center', width: '100%', flexDirection: 'row', gap: 8, marginTop: 4 },
  recommendPctText: { fontSize: 22, fontWeight: 'bold', color: '#0052FF' },
  recommendText: { fontSize: 12, color: '#0A1551', fontWeight: '600' },

  reviewsList: { gap: 16 },
  emptyState: { padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', marginVertical: 12 },
  emptyStateText: { fontSize: 13, color: '#64748B', marginTop: 8, textAlign: 'center', fontWeight: '500' },
  reviewCard: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewerName: { fontSize: 14, fontWeight: 'bold', color: '#0A1551' },
  verifiedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  verifiedText: { fontSize: 9, color: '#16A34A', fontWeight: 'bold' },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  timeText: { fontSize: 11, color: '#64748B', marginTop: 4 },
  commentText: { fontSize: 13, color: '#475569', lineHeight: 20, marginVertical: 12 },
  helpfulBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpfulBtnText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  replyBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#0052FF' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  replyAuthor: { fontSize: 12, fontWeight: '700', color: '#0052FF' },
  replyText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  replyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  replyModal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  replyModalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  replyModalTitle: { fontSize: 17, fontWeight: '700', color: '#0A1551' },
  replyQuote: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 12 },
  replyInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 14, color: '#0F172A' },
  replySubmit: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  replySubmitText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
