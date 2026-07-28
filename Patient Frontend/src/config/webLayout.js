import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Max content width for centered web layouts. Keeps cards/forms from stretching
// edge-to-edge on ultra-wide screens. No effect on native (returns null).
export const WEB_CONTENT_MAX_WIDTH = 1080;

// Spread into a ScrollView/FlatList `contentContainerStyle` (or a wrapping View
// style) to center + cap content width on web. Returns null on native so mobile
// layouts are untouched.
export const webContent = isWeb
  ? { width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' }
  : null;

// Narrower cap for forms (login, profile, setup) — reads better than the wide
// content width for single-column forms.
export const WEB_FORM_MAX_WIDTH = 720;
export const webForm = isWeb
  ? { width: '100%', maxWidth: WEB_FORM_MAX_WIDTH, alignSelf: 'center' }
  : null;

// Two-column form helpers. These are WIDTH-aware, not just platform-aware: a
// phone browser is `Platform.OS === 'web'` too, so keying only off `isWeb` forced
// two cramped 48% columns onto a ~360px screen (fields were unusable — a name
// input barely fit "Muhammad Hamma"). Below this breakpoint we fall back to the
// single-column mobile layout; at/above it we go side-by-side.
export const WEB_TWO_COL_MIN_WIDTH = 720;

// Callers pass the current window width (see useWindowDimensions) so the layout
// re-flows on resize/rotate. Omitting it assumes a narrow screen — the safe
// default, since single-column is readable at every width.
export const isWideWeb = (width) => isWeb && (width ?? 0) >= WEB_TWO_COL_MIN_WIDTH;

export const fieldGridFor = (width) =>
  (isWideWeb(width) ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' } : null);
export const halfFor = (width) => (isWideWeb(width) ? { width: '48%' } : null);
export const fullFor = (width) => (isWideWeb(width) ? { width: '100%' } : null);

// Back-compat: the original always-on constants. Prefer the *For(width) helpers
// above in new code — these assume a wide screen and will cram on phones.
export const webFieldGrid = isWeb
  ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }
  : null;
export const webHalf = isWeb ? { width: '48%' } : null;
export const webFull = isWeb ? { width: '100%' } : null;

export { isWeb };
export default webContent;
