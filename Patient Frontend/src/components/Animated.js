import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

// Lightweight animation primitives built on React Native's Animated API.
// No extra native dependency — works on device + web.

/**
 * FadeSlide — fades + slides its children in on mount.
 *  - `from`: 'top' | 'bottom' | 'left' | 'right' (default 'bottom')
 *  - `distance`: px to travel (default 16)
 *  - `delay`: ms before starting (use for staggered lists)
 *  - `duration`: ms (default 380)
 */
export function FadeSlide({
  children, from = 'bottom', distance = 16, delay = 0, duration = 380, style,
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  const axis = from === 'left' || from === 'right' ? 'translateX' : 'translateY';
  const sign = from === 'top' || from === 'left' ? -1 : 1;
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [sign * distance, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ [axis]: offset }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Stagger — wraps a list of children, fading each in with an incremental delay.
 *  - `step`: ms between each child (default 60)
 *  - `initialDelay`: ms before the first child (default 0)
 * Pass-through props (from/distance/duration) go to each FadeSlide.
 */
export function Stagger({ children, step = 60, initialDelay = 0, ...rest }) {
  const items = React.Children.toArray(children);
  return items.map((child, i) => (
    <FadeSlide key={i} delay={initialDelay + i * step} {...rest}>
      {child}
    </FadeSlide>
  ));
}

/**
 * PressableScale — Pressable that springs down slightly while pressed.
 * Drop-in replacement for TouchableOpacity for buttons/cards.
 *  - `scaleTo`: pressed scale (default 0.96)
 *  - `dimTo`: pressed opacity (default 1 — set <1 to also fade)
 */
export function PressableScale({
  children, style, onPress, scaleTo = 0.96, dimTo = 1, disabled, hitSlop, ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (s, o) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.timing(opacity, { toValue: o, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(scaleTo, dimTo)}
      onPressOut={() => animateTo(1, 1)}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * AnimatedHeader — a toolbar/header container that drops in + fades on mount.
 * Use it in place of the outer <View> of a screen header. Children that are
 * icon buttons should be wrapped in <PressableScale> for press feedback.
 */
export function AnimatedHeader({ children, style }) {
  return (
    <FadeSlide from="top" distance={14} duration={420} style={style}>
      {children}
    </FadeSlide>
  );
}

export default { FadeSlide, Stagger, PressableScale, AnimatedHeader };
