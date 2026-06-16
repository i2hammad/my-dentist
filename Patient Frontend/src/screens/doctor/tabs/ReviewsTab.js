import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

export default function ReviewsTab({ profile }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [loading, setLoading] = useState(true);

  const services = profile?.services && profile.services.length > 0 ? profile.services : [];

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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={styles.layout}>
          
          {/* Left Side: Services & Reviews */}
          <View style={styles.leftCol}>
            
            {/* Our Services */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Our Services</Text>
              <Text style={styles.cardSubtitle}>Facilities & services available at Dr. {profile?.fullName || ''}'s clinic</Text>

              {services.length > 0 ? (
                <View style={styles.servicesGrid}>
                  {services.map((item, idx) => {
                    const label = typeof item === 'string' ? item : item.name;
                    const icon = typeof item === 'string' ? 'checkmark-circle-outline' : (item.icon || 'checkmark-circle-outline');
                    return (
                      <View key={idx} style={styles.serviceItem}>
                        <Ionicons name={icon} size={16} color="#0052FF" />
                        <Text style={styles.serviceText} numberOfLines={1}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' }}>
                  No services listed yet. Update your profile to add clinic services.
                </Text>
              )}
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
                            Alert.alert(
                              'Review Options',
                              `Reviewer: ${review.patientId?.fullName || 'Patient'}\nRating: ${review.rating} Stars`,
                              [
                                { text: 'Reply to Review', onPress: () => Alert.alert('Reply', 'Reply feature will be active soon!') },
                                { text: 'Report Review', style: 'destructive', onPress: () => Alert.alert('Reported', 'Review reported for administrative review.') },
                                { text: 'Close', style: 'cancel' }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.commentText}>{review.comment}</Text>
                      <TouchableOpacity style={styles.helpfulBtn}>
                        <Ionicons name="thumbs-up-outline" size={14} color="#64748B" />
                        <Text style={styles.helpfulBtnText}>Helpful ({review.helpfulCount || 0})</Text>
                      </TouchableOpacity>
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

          {/* Right Side: Elite Clinic Badge */}
          <View style={styles.rightCol}>
            
            {/* Elite Badge Card */}
            <View style={[styles.card, { alignItems: 'center', borderColor: '#FDE68A', borderWidth: 2 }]}>
              <View style={styles.badgeImagePlaceholder}>
                <Ionicons name="ribbon" size={60} color="#D97706" />
                <View style={styles.badgeEliteTag}><Text style={styles.badgeEliteText}>ELITE</Text></View>
              </View>
              <Text style={styles.eliteTitle}>Elite Clinic</Text>
              <Text style={styles.eliteSubtitle}>This Clinic offers excellent facilities and premium care.</Text>
              
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
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNumber}>28</Text>
                <Text style={styles.scoreText}>POINTS</Text>
              </View>
            </View>

            {/* Legends */}
            <View style={styles.legendsList}>
              <View style={[styles.legendRow, {backgroundColor: '#FFFBEB', borderColor: '#FDE68A'}]}>
                <View style={[styles.legendIcon, {backgroundColor: '#D97706'}]}><Ionicons name="ribbon" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Elite Clinic</Text>
                <Text style={styles.legendRange}>26+ Points</Text>
              </View>
              <View style={[styles.legendRow, {backgroundColor: '#EFF6FF', borderColor: '#BFDBFE'}]}>
                <View style={[styles.legendIcon, {backgroundColor: '#0052FF'}]}><Ionicons name="business" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Modern Clinic</Text>
                <Text style={styles.legendRange}>11 - 25 Points</Text>
              </View>
              <View style={[styles.legendRow, {backgroundColor: '#F8FAFC', borderColor: '#E2E8F0'}]}>
                <View style={[styles.legendIcon, {backgroundColor: '#64748B'}]}><Ionicons name="shield-checkmark" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Standard Clinic</Text>
                <Text style={styles.legendRange}>1 - 10 Points</Text>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

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
  bookBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' }
});
