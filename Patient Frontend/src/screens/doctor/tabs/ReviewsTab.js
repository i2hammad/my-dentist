import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Dimensions, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import { actionMenu } from '../../../utils/confirmAlert';
import storage from '../../../config/storage';
import { getClinicTier } from '../../../utils/clinicTier';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

export default function ReviewsTab({ profile }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [loading, setLoading] = useState(true);

  // Editable facilities & services (persisted to the doctor profile).
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState('');
  const [savingServices, setSavingServices] = useState(false);

  // Reply modal state.
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  useEffect(() => {
    const list = (profile?.services && profile.services.length > 0)
      ? profile.services.map(s => (typeof s === 'string' ? s : s.name))
      : [];
    setServices(list);
  }, [profile?._id]);

  const persistServices = async (list) => {
    setSavingServices(true);
    try {
      const token = await storage.getItem('userToken');
      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, { services: list }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      Alert.alert('Error', 'Could not save services. Please try again.');
    } finally {
      setSavingServices(false);
    }
  };

  const addService = () => {
    const v = newService.trim();
    if (!v) return;
    if (services.includes(v)) { setNewService(''); return; }
    const list = [...services, v];
    setServices(list); setNewService('');
    persistServices(list);
  };

  const removeService = (name) => {
    const list = services.filter(s => s !== name);
    setServices(list);
    persistServices(list);
  };

  const submitReply = async () => {
    if (!replyText.trim() || !replyTarget) return;
    setPostingReply(true);
    try {
      const token = await storage.getItem('userToken');
      await axios.put(`${API_BASE_URL}/api/reviews/${replyTarget._id}/reply`, { text: replyText.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setReplyTarget(null); setReplyText('');
      fetchReviews();
      Alert.alert('Reply posted', 'Your reply is now visible on this review.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not post reply.');
    } finally {
      setPostingReply(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [profile]);

  const fetchReviews = async () => {
    try {
      if (profile?._id) {
        const res = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${profile._id}`);
        if (res.data?.success) {
          setReviews(res.data.data || []);
        } else {
          setReviews([]);
        }
        const statsRes = await axios.get(`${API_BASE_URL}/api/reviews/doctor/${profile._id}/stats`);
        if (statsRes.data?.success) {
          setStats(statsRes.data.data || { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
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

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#0052FF" /></View>;
  }

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return `1 week ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Real facility score → grade (Standard 1-15 / Modern 16-30 / Elite 31+)
  const facilityScore = profile?.facilityScore || 0;
  const grade = getClinicTier(facilityScore); // { label, color, tier }
  const gradeIcon = grade.tier === 'elite' ? 'ribbon' : grade.tier === 'modern' ? 'business' : 'shield-checkmark';
  const gradeBlurb = grade.tier === 'elite'
    ? 'This clinic offers excellent facilities and premium care.'
    : grade.tier === 'modern'
    ? 'This clinic offers modern facilities and quality care.'
    : 'This clinic offers standard facilities and reliable care.';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={styles.layout}>
          
          {/* Left Side: Services & Reviews */}
          <View style={styles.leftCol}>
            
            {/* Facilities & Services (add / remove) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Facilities & Services</Text>
              <Text style={styles.cardSubtitle}>Add or remove facilities & services available at your clinic{savingServices ? '  • saving…' : ''}</Text>

              {services.length > 0 ? (
                <View style={styles.servicesGrid}>
                  {services.map((label, idx) => (
                    <View key={idx} style={styles.serviceItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#0052FF" />
                      <Text style={styles.serviceText} numberOfLines={1}>{label}</Text>
                      <TouchableOpacity onPress={() => removeService(label)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' }}>
                  No services listed yet. Add your first facility / service below.
                </Text>
              )}

              <View style={styles.addServiceRow}>
                <TextInput
                  style={styles.addServiceInput}
                  value={newService}
                  onChangeText={setNewService}
                  placeholder="e.g. Teeth Whitening, X-Ray, Parking"
                  placeholderTextColor="#94A3B8"
                  onSubmitEditing={addService}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addServiceBtn} onPress={addService}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Patient Reviews */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Patient Reviews</Text>
              <Text style={styles.cardSubtitle}>Real experiences from our happy patients</Text>
              
              <View style={styles.ratingSummaryRow}>
                {/* Big Rating */}
                <View style={styles.avgRatingCol}>
                  <Text style={styles.bigRatingText}>{stats.average?.toFixed(1) || '4.9'}</Text>
                  <View style={styles.starsRowBig}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons key={i} name={i < Math.round(stats.average) ? 'star' : 'star-outline'} size={18} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.reviewsCountText}>({stats.count} Reviews)</Text>
                </View>

                {/* Progress Bars */}
                <View style={styles.distCol}>
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = stats.distribution?.[stars] || 0;
                    const total = stats.count || 1;
                    const pct = Math.round((count / total) * 100);
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
                  <TouchableOpacity onPress={() => Alert.alert('Reviews', `Showing all ${reviews.length} reviews.`)}>
                    <Text style={styles.viewAllReviewsText}>View all Reviews ></Text>
                  </TouchableOpacity>
                </View>

                {/* Recommendation */}
                <View style={styles.recommendCol}>
                  <Text style={styles.recommendPctText}>{stats.average >= 4 ? '98%' : '100%'}</Text>
                  <Text style={styles.recommendText}>Patients Recommend</Text>
                  <Ionicons name="thumbs-up" size={24} color="#0052FF" style={{marginTop: 8}} />
                </View>
              </View>

              {/* Reviews List */}
              <View style={styles.reviewsList}>
                {reviews.length > 0 ? (
                  reviews.map((review, idx) => (
                    <View key={review._id || idx} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Image source={{uri: `https://ui-avatars.com/api/?name=${review.patientId?.fullName?.replace(' ', '+') || 'Patient'}&background=F1F5F9&color=0052FF`}} style={styles.reviewerAvatar} />
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
                          onPress={() => {
                            actionMenu({
                              title: 'Review Options',
                              message: `Reviewer: ${review.patientId?.fullName || 'Patient'}\nRating: ${review.rating} Stars`,
                              options: [
                                { text: review.doctorReply?.text ? 'Edit Reply' : 'Reply to Review', onPress: () => { setReplyTarget(review); setReplyText(review.doctorReply?.text || ''); } },
                                { text: 'Close', style: 'cancel' }
                              ]
                            });
                          }}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.commentText}>{review.comment}</Text>

                      {/* Doctor's reply (if any) */}
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
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={40} color="#94A3B8" />
                    <Text style={styles.emptyStateText}>No reviews yet. Reviews from your patients will appear here.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Right Side: Clinic Grade Badge (computed from facility score) */}
          <View style={styles.rightCol}>

            {/* Grade Badge Card */}
            <View style={[styles.card, { alignItems: 'center', borderColor: grade.color, borderWidth: 2 }]}>
              <View style={styles.badgeImagePlaceholder}>
                <Ionicons name={gradeIcon} size={60} color={grade.color} />
                <View style={[styles.badgeEliteTag, { backgroundColor: grade.color }]}><Text style={styles.badgeEliteText}>{grade.label.replace(' Clinic', '').toUpperCase()}</Text></View>
              </View>
              <Text style={styles.eliteTitle}>{grade.label}</Text>
              <Text style={styles.eliteSubtitle}>{gradeBlurb}</Text>

              <View style={styles.verifiedHighlightsBox}>
                <Text style={styles.verifiedHighlightsTitle}>VERIFIED HIGHLIGHTS</Text>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Verified Services</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>High Patient Satisfaction</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Advanced Technology</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Hygiene & Safety</Text></View>
              </View>
            </View>

            {/* Score Card */}
            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.facilityScoreTitle}>FACILITY SCORE</Text>
              <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
                <Text style={styles.scoreNumber}>{facilityScore}</Text>
                <Text style={styles.scoreText}>POINTS</Text>
              </View>
            </View>

            {/* Legends — Standard 1-15 / Modern 16-30 / Elite 31+ */}
            <View style={styles.legendsList}>
              <View style={[styles.legendRow, {backgroundColor: '#FFFBEB', borderColor: '#FDE68A'}, grade.tier === 'elite' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, {backgroundColor: '#D97706'}]}><Ionicons name="ribbon" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Elite Clinic</Text>
                <Text style={styles.legendRange}>31+ Points</Text>
              </View>
              <View style={[styles.legendRow, {backgroundColor: '#EFF6FF', borderColor: '#BFDBFE'}, grade.tier === 'modern' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, {backgroundColor: '#0052FF'}]}><Ionicons name="business" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Modern Clinic</Text>
                <Text style={styles.legendRange}>16 - 30 Points</Text>
              </View>
              <View style={[styles.legendRow, {backgroundColor: '#F8FAFC', borderColor: '#E2E8F0'}, grade.tier === 'standard' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, {backgroundColor: '#64748B'}]}><Ionicons name="shield-checkmark" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Standard Clinic</Text>
                <Text style={styles.legendRange}>1 - 15 Points</Text>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Reply modal */}
      <Modal visible={!!replyTarget} transparent animationType="slide" onRequestClose={() => setReplyTarget(null)}>
        <View style={styles.replyOverlay}>
          <View style={styles.replyModal}>
            <View style={styles.replyModalHead}>
              <Text style={styles.replyModalTitle}>Reply to {replyTarget?.patientId?.fullName || 'Patient'}</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            {!!replyTarget?.comment && <Text style={styles.replyQuote}>“{replyTarget.comment}”</Text>}
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  layout: { flexDirection: isWide ? 'row' : 'column', gap: 20 },
  leftCol: { flex: isWide ? 2.5 : undefined },
  rightCol: { flex: isWide ? 1 : undefined, width: isWide ? undefined : '100%' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  
  /* Services Grid */
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', width: isWide ? '31%' : '47%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFF' },
  serviceText: { fontSize: 11, color: '#0A1551', fontWeight: '500', marginLeft: 8, flex: 1 },
  
  /* Ratings Summary */
  ratingSummaryRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avgRatingCol: { alignItems: 'center', minWidth: 100 },
  bigRatingText: { fontSize: 42, fontWeight: '900', color: '#0A1551' },
  starsRowBig: { flexDirection: 'row', gap: 2, marginVertical: 6 },
  reviewsCountText: { fontSize: 12, color: '#0A1551', fontWeight: '600' },
  distCol: { flex: 1, justifyContent: 'center', minWidth: 200 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  distStarsText: { fontSize: 12, color: '#0A1551', fontWeight: '600', width: 24 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0052FF', borderRadius: 3 },
  distCountText: { fontSize: 12, color: '#0A1551', fontWeight: '600', width: 30, textAlign: 'right' },
  viewAllReviewsText: { fontSize: 12, color: '#0052FF', fontWeight: '600', textAlign: 'center', marginTop: 8 },
  recommendCol: { alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  recommendPctText: { fontSize: 24, fontWeight: 'bold', color: '#0052FF' },
  recommendText: { fontSize: 11, color: '#0A1551', fontWeight: '600', textAlign: 'center' },
  
  /* Reviews List */
  reviewsList: { gap: 16 },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500'
  },
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
  
  /* Elite Card */
  badgeImagePlaceholder: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#D97706', position: 'relative' },
  badgeEliteTag: { position: 'absolute', bottom: -10, backgroundColor: '#D97706', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  badgeEliteText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  eliteTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  eliteSubtitle: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, marginHorizontal: 10 },
  verifiedHighlightsBox: { width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, marginTop: 20 },
  verifiedHighlightsTitle: { fontSize: 11, fontWeight: 'bold', color: '#0A1551', marginBottom: 12, letterSpacing: 0.5 },
  vhRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  vhText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  /* Score Card */
  facilityScoreTitle: { fontSize: 12, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 6, borderColor: '#0052FF', justifyContent: 'center', alignItems: 'center' },
  scoreNumber: { fontSize: 32, fontWeight: '900', color: '#0A1551' },
  scoreText: { fontSize: 10, fontWeight: 'bold', color: '#0A1551' },

  legendsList: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12 },
  legendIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  legendName: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', flex: 1 },
  legendRange: { fontSize: 11, color: '#64748B' },

  /* Footer */
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  bookBtn: { backgroundColor: '#0052FF', height: 40, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  bookBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' },

  /* Add service */
  addServiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  addServiceInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: '#0F172A' },
  addServiceBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0052FF', justifyContent: 'center', alignItems: 'center' },

  /* Doctor reply */
  replyBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#0052FF' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  replyAuthor: { fontSize: 12, fontWeight: '700', color: '#0052FF' },
  replyText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  replyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  replyModal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  replyModalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  replyModalTitle: { fontSize: 17, fontWeight: '700', color: '#0A1551' },
  replyQuote: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 12 },
  replyInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 14, color: '#0F172A' },
  replySubmit: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  replySubmitText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
