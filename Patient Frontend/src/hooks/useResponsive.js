import { Platform, useWindowDimensions } from 'react-native';

// Breakpoints (px). Phone-first: anything below TABLET behaves like the
// original mobile layout. Web only — native always reports phone-sized.
const TABLET = 700;
const DESKTOP = 1024;

// Max width of the centered content column on wide screens. Keeps line
// length and card sizing sane instead of stretching edge-to-edge.
const CONTENT_MAX_WIDTH = 1100;

/**
 * Responsive layout info derived from the live window size.
 *
 *   const { isWide, isDesktop, contentWidth, columns } = useResponsive();
 *
 * On phones every flag is false and `columns` is 1, so existing mobile
 * layouts are untouched.
 */
export default function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  // Treat native as phone regardless of tablet size, to avoid changing the
  // shipped mobile UI. Responsive behavior is web-only for now.
  const isTablet = isWeb && width >= TABLET;
  const isDesktop = isWeb && width >= DESKTOP;
  const isWide = isTablet; // anything tablet-and-up gets the wide treatment

  // Column count for card grids (doctor lists, galleries, etc.)
  let columns = 1;
  if (isDesktop) columns = 3;
  else if (isTablet) columns = 2;

  const contentWidth = isWide ? Math.min(width, CONTENT_MAX_WIDTH) : width;

  return {
    width,
    height,
    isWeb,
    isTablet,
    isDesktop,
    isWide,
    columns,
    contentWidth,
    CONTENT_MAX_WIDTH,
  };
}
