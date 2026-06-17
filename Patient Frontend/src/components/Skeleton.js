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

const styles = StyleSheet.create({
  block: { backgroundColor: '#E2E8F0' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
