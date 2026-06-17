import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

// Lightweight shimmer skeleton for React Native loading states.
function Shimmer({ style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

export function SkeletonLine({ width = '100%', height = 12, style }) {
  return <Shimmer style={[{ width, height, borderRadius: 6 }, style]} />;
}

export function SkeletonCircle({ size = 48 }) {
  return <Shimmer style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

// A doctor/list card skeleton (avatar + lines + button).
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonCircle size={56} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLine width="60%" height={14} />
          <SkeletonLine width="40%" height={11} style={{ marginTop: 8 }} />
          <SkeletonLine width="50%" height={11} style={{ marginTop: 8 }} />
        </View>
      </View>
      <SkeletonLine width="100%" height={36} style={{ marginTop: 14, borderRadius: 10 }} />
    </View>
  );
}

// N stacked card skeletons.
export function SkeletonList({ count = 4 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

// A treatment-screen doctor card skeleton: 80px square photo + info + bottom row.
// Matches the DoctorCard layout used in Cosmetic/Implants/Orthodontics screens.
export function SkeletonTreatmentCard() {
  return (
    <View style={styles.tCard}>
      <View style={styles.tRow}>
        <Shimmer style={{ width: 80, height: 80, borderRadius: 12 }} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLine width="62%" height={15} />
          <SkeletonLine width="44%" height={11} style={{ marginTop: 9 }} />
          <SkeletonLine width="52%" height={11} style={{ marginTop: 8 }} />
          <SkeletonLine width="34%" height={11} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.tDivider} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
        <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
      </View>
    </View>
  );
}

// N stacked treatment-card skeletons.
export function SkeletonTreatmentList({ count = 5 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => <SkeletonTreatmentCard key={i} />)}
    </View>
  );
}

// Patient profile / edit-profile screen skeleton: avatar + titles + form card.
export function SkeletonProfile({ fields = 5 }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <SkeletonCircle size={84} />
      </View>
      {/* Title + subtitle */}
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <SkeletonLine width={180} height={16} />
        <SkeletonLine width={220} height={11} style={{ marginTop: 10 }} />
      </View>
      {/* Form card */}
      <View style={pStyles.formCard}>
        <View style={[styles.row, { marginBottom: 18 }]}>
          <SkeletonCircle size={40} />
          <View style={{ marginLeft: 12 }}>
            <SkeletonLine width={150} height={13} />
            <SkeletonLine width={110} height={10} style={{ marginTop: 7 }} />
          </View>
        </View>
        {Array.from({ length: fields }).map((_, i) => (
          <View key={i} style={{ marginBottom: 16 }}>
            <SkeletonLine width="32%" height={11} />
            <SkeletonLine width="100%" height={46} style={{ marginTop: 8, borderRadius: 12 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Doctor-details screen skeleton (cover + floating card + tabs + content).
export function SkeletonDoctorDetail({ topInset = 0 }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Banner bleeds under the status bar (edge-to-edge): height absorbs the inset */}
      <Shimmer style={{ width: '100%', height: 180 + topInset, borderRadius: 0 }} />
      <View style={dStyles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonCircle size={68} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <SkeletonLine width="65%" height={16} />
            <SkeletonLine width="45%" height={12} style={{ marginTop: 8 }} />
            <SkeletonLine width="35%" height={12} style={{ marginTop: 8 }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <SkeletonLine width="32%" height={40} style={{ borderRadius: 12 }} />
          <SkeletonLine width="32%" height={40} style={{ borderRadius: 12 }} />
          <SkeletonLine width="32%" height={40} style={{ borderRadius: 12 }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginTop: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonLine key={i} width={56} height={44} style={{ borderRadius: 10 }} />)}
      </View>
      <View style={{ padding: 16, marginTop: 8 }}>
        <SkeletonLine width="40%" height={16} />
        <SkeletonLine width="100%" height={12} style={{ marginTop: 14 }} />
        <SkeletonLine width="92%" height={12} style={{ marginTop: 8 }} />
        <SkeletonLine width="96%" height={12} style={{ marginTop: 8 }} />
        <SkeletonLine width="70%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const dStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, marginHorizontal: 16, marginTop: -40 },
});

const pStyles = StyleSheet.create({
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 18, marginTop: 22 },
});

const styles = StyleSheet.create({
  block: { backgroundColor: '#E2E8F0' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  tRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  tDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
});
