import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import imgUrl from '../config/imgUrl';

/**
 * The doctor listing card, shared by HomeScreen and SearchScreen.
 *
 * These two screens each had their own copy for months and drifted apart every
 * time one was touched: the guest-distance fix landed on Home and missed Search,
 * the popular-first sort had to be fixed twice, and the card styling and mobile
 * sizing were each reported as bugs. One component makes that class of bug
 * structurally impossible.
 *
 * This is Search's layout (the one to keep) with Home's Popular badge folded in —
 * Home was the only screen showing paid/earned placement, and dropping it would
 * undo the promoted-placement work.
 */

// Haversine distance in km between two lat/lng points.
export const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// Distance from the patient to a doctor, or null when either side lacks usable
// coordinates. 0,0 is treated as missing — it is the null-island default, not a
// real clinic in Pakistan.
const distanceKm = (doc, coords) => {
  if (!coords || !doc?.coordinates) return null;
  const dc = String(doc.coordinates).split(',').map(Number);
  if (dc.length < 2 || isNaN(dc[0]) || isNaN(dc[1])) return null;
  if (Math.abs(dc[0]) < 0.001 && Math.abs(dc[1]) < 0.001) return null;
  return haversineKm(coords.lat, coords.lng, dc[0], dc[1]);
};

export default function DoctorCard({ doctor, isWide, patientCoords, isFavorite, onToggleFavorite, onPress, onBook }) {
  const item = doctor;
  const km = distanceKm(item, patientCoords);

  return (
    <View style={[styles.card, isWide && styles.cardGrid]}>
      <View style={styles.cardTop}>
        <View style={styles.doctorImageContainer}>
          <Image
            source={{ uri: item.photo ? imgUrl(item.photo, { w: 160, popular: !!item.isPopular, name: item.fullName, spec: item.specialization, clinic: item.clinicName, city: item.city }) : item.photoUrl || 'https://via.placeholder.com/150' }}
            style={styles.doctorImage}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
            {item.pmdcVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#0066FF" style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.specialty}>{item.specialization || 'Dentist'}</Text>

          {/* Paid placement is blue, earned (reward points) is green. Carried over
              from HomeScreen — Search never showed it. */}
          {item.isPopular && (
            <View style={[styles.popularBadge, { backgroundColor: item.popularType === 'paid' ? '#DBEAFE' : '#DCFCE7' }]}>
              <Ionicons name="star" size={11} color={item.popularType === 'paid' ? '#1D4ED8' : '#15803D'} />
              <Text style={[styles.popularBadgeText, { color: item.popularType === 'paid' ? '#1D4ED8' : '#15803D' }]}>Popular</Text>
            </View>
          )}

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.avgRating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.reviewsText}>({item.totalReviews || 0} Reviews)</Text>
          </View>

          <Text style={styles.clinic} numberOfLines={1}>{item.clinicName}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#64748B" />
            <Text style={styles.distanceText} numberOfLines={1}>{item.city || 'Pakistan'}</Text>
            {km !== null && (
              <View style={styles.distPill}>
                <Ionicons name="navigate" size={10} color="#2563EB" />
                <Text style={styles.distPillTxt}>{fmtKm(km)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.rightActions}>
          {/* Only a genuine 'online' earns a badge. Rendering anything else as
              "Busy" made 28 of 29 dentists look unavailable when they had simply
              not opened the app. */}
          {item.onlineStatus === 'online' && (
            <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.statusText, { color: '#16A34A' }]}>Online</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.heartButton}
            onPress={() => onToggleFavorite && onToggleFavorite(item._id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#EF4444' : '#0066FF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Absorbs leftover vertical space so the divider, stats and buttons sit at
          the bottom of a stretched card instead of floating mid-way. */}
      <View style={{ flex: 1 }} />

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="briefcase-outline" size={13} color="#64748B" />
          <Text style={styles.statValue}>{item.experience || 0}+ yrs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={13} color="#16A34A" />
          <Text style={[styles.statValue, { color: '#16A34A' }]}>Available today</Text>
        </View>
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => onPress && onPress(item)}>
          <Text style={styles.outlineBtnTxt}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.solidBtn} onPress={() => onBook && onBook(item)}>
          <Text style={styles.solidBtnTxt}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    // Column layout + the spacer below lets the action row sit flush at the
    // bottom, so buttons line up across a row even when the cards above them
    // hold different amounts of text.
    flexDirection: 'column',
  },
  cardGrid: {
    flex: 1,
    // Fill the stretched grid cell so every card in a row is the same height.
    height: '100%',
  },
  cardTop: {
    flexDirection: 'row',
  },
  doctorImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginRight: 12,
  },
  doctorImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  specialty: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  clinic: {
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6,
  },
  distPillTxt: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  rightActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  heartButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlineBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0052FF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  outlineBtnTxt: {
    color: '#0052FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  solidBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0052FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  solidBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
