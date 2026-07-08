import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing, Image } from 'react-native';

// Shimmer skeleton for React Native loading states.
// A light "sheen" band sweeps left→right across each placeholder block for a
// modern loading feel — no native gradient dependency required.
function Shimmer({ style }) {
  const [w, setW] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // Sweep the sheen from just off the left edge to just off the right edge.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-w * 0.6, w * 1.6],
  });

  return (
    <View
      style={[styles.block, style, { overflow: 'hidden' }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: w * 0.5,
            backgroundColor: 'rgba(255,255,255,0.55)',
            transform: [{ translateX }, { skewX: '-20deg' }],
          }}
        />
      )}
    </View>
  );
}

/**
 * ShimmerImage — an Image that shows a shimmer placeholder until it finishes
 * loading (or errors). Drop-in replacement for <Image> with a remote uri.
 * Pass the same `style` you'd give the Image (it sizes both layers).
 */
export function ShimmerImage({ source, style, resizeMode = 'cover', ...rest }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[style, { overflow: 'hidden', position: 'relative' }]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoaded(true)}
        {...rest}
      />
      {!loaded && <Shimmer style={[StyleSheet.absoluteFill, { borderRadius: 0 }]} />}
    </View>
  );
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

// A list-row skeleton: circular avatar + name/time row + subtitle line.
// Matches conversation rows (Inbox) and notification rows.
export function SkeletonRow() {
  return (
    <View style={styles.listRow}>
      <SkeletonCircle size={52} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonLine width="46%" height={13} />
          <SkeletonLine width={40} height={10} />
        </View>
        <SkeletonLine width="80%" height={11} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

// N stacked list-row skeletons.
export function SkeletonRowList({ count = 7 }) {
  return (
    <View style={{ paddingTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
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

// Patient profile / edit-profile screen skeleton — mirrors the real hero
// (centered avatar + badge, name, subtitle, account chip) and the form card
// (section header + labelled fields) so the load state matches the screen.
export function SkeletonProfile({ fields = 5 }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {/* Avatar with camera badge */}
      <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
        <View style={{ position: 'relative' }}>
          <Shimmer style={{ width: 92, height: 92, borderRadius: 46 }} />
          <View style={pStyles.badgeMask}>
            <Shimmer style={{ width: 24, height: 24, borderRadius: 12 }} />
          </View>
        </View>
      </View>
      {/* Name + subtitle + account chip — all centered */}
      <View style={{ alignItems: 'center' }}>
        <SkeletonLine width={200} height={20} style={{ borderRadius: 8 }} />
        <SkeletonLine width={170} height={12} style={{ marginTop: 8 }} />
        <SkeletonLine width={130} height={26} style={{ marginTop: 12, borderRadius: 13 }} />
      </View>
      {/* Form card */}
      <View style={pStyles.formCard}>
        {/* Section header: icon tile + title + subtitle */}
        <View style={[styles.row, { marginBottom: 20 }]}>
          <Shimmer style={{ width: 40, height: 40, borderRadius: 12 }} />
          <View style={{ marginLeft: 12 }}>
            <SkeletonLine width={160} height={14} />
            <SkeletonLine width={120} height={10} style={{ marginTop: 7 }} />
          </View>
        </View>
        {Array.from({ length: fields }).map((_, i) => (
          <View key={i} style={{ marginBottom: 16 }}>
            <SkeletonLine width={`${28 + (i % 3) * 8}%`} height={11} />
            <SkeletonLine width="100%" height={48} style={{ marginTop: 8, borderRadius: 12 }} />
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
      {/* Header bar — matches new design (no cover photo) */}
      <View style={{ backgroundColor: '#FFFFFF', paddingTop: topInset + 6, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Shimmer style={{ width: 80, height: 30, borderRadius: 20 }} />
          <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
        </View>
      </View>

      {/* Doctor card */}
      <View style={dStyles.card}>
        {/* Avatar + name row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Shimmer style={{ width: 72, height: 72, borderRadius: 16 }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <SkeletonLine width="70%" height={16} />
            <SkeletonLine width="50%" height={12} style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <Shimmer style={{ width: 14, height: 14, borderRadius: 7 }} />
              <SkeletonLine width="30%" height={12} />
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

        {/* Clinic + location rows */}
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Shimmer style={{ width: 28, height: 28, borderRadius: 8 }} />
            <SkeletonLine width={`${50 + i * 10}%`} height={12} />
          </View>
        ))}
      </View>

      {/* Action buttons row */}
      <View style={{ flexDirection: 'row', marginHorizontal: 14, marginTop: 10, gap: 8 }}>
        <Shimmer style={{ flex: 2, height: 48, borderRadius: 14 }} />
        <Shimmer style={{ width: 48, height: 48, borderRadius: 14 }} />
        <Shimmer style={{ width: 48, height: 48, borderRadius: 14 }} />
      </View>

      {/* Tabs row */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <Shimmer key={i} style={{ width: 70, height: 40, borderRadius: 10 }} />
        ))}
      </View>

      {/* Content lines */}
      <View style={{ padding: 16, marginTop: 8 }}>
        <SkeletonLine width="40%" height={15} />
        {[100, 92, 96, 75, 85].map((w, i) => (
          <SkeletonLine key={i} width={`${w}%`} height={12} style={{ marginTop: i === 0 ? 14 : 8 }} />
        ))}
      </View>
    </View>
  );
}

const dStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EFF6FF', padding: 18, marginHorizontal: 14, marginTop: 6, shadowColor: '#0052FF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
});

const pStyles = StyleSheet.create({
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', padding: 18, marginTop: 22 },
  // White ring around the camera badge so it reads as a separate chip on the avatar.
  badgeMask: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: '#FFFFFF', borderRadius: 15, padding: 3,
  },
});

const styles = StyleSheet.create({
  block: { backgroundColor: '#E6EBF2' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  tRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  tDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F7FA' },
});
