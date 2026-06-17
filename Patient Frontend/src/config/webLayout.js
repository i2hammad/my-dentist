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

// Two-column form helpers (web only). `webFieldGrid` on the wrapping container
// + `webHalf` on each field makes fields sit side-by-side on wide web; both are
// null on native so the mobile single-column layout is preserved.
export const webFieldGrid = isWeb
  ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }
  : null;
export const webHalf = isWeb ? { width: '48%' } : null;
export const webFull = isWeb ? { width: '100%' } : null;

export { isWeb };
export default webContent;
