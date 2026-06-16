import React from 'react';
import { View, StyleSheet } from 'react-native';
import useResponsive from '../hooks/useResponsive';

/**
 * Centers app content in a constrained, app-like column on wide screens.
 * On phones it renders children untouched (no wrapper cost).
 *
 * Wrap individual screen content with this so a single screen looks
 * intentional on desktop. For app-wide framing prefer wiring it at the
 * navigator level, but this is safe to use per-screen too.
 */
export default function ResponsiveShell({ children, maxWidth, style }) {
  const { isWide, CONTENT_MAX_WIDTH } = useResponsive();

  if (!isWide) return children;

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.column,
          { maxWidth: maxWidth || CONTENT_MAX_WIDTH },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#EEF2F7',
  },
  column: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    // Subtle elevation so the column reads as the "app" against the backdrop
    ...(typeof document !== 'undefined'
      ? { boxShadow: '0 0 24px rgba(15, 23, 42, 0.08)' }
      : {}),
  },
});
