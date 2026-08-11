import { Platform } from 'react-native';

/**
 * Microsoft Clarity helpers.
 *
 * The tag in the page <head> starts recording on its own — clicks, scrolls,
 * rage-taps and heatmaps need no wiring. What it cannot see is this app's
 * navigation: every screen after the first is a state change, not a page load,
 * so a whole session would otherwise collapse into one "page" in the dashboard.
 *
 * Web only. `clarity` does not exist in the native builds and every function
 * here is a no-op there rather than throwing.
 */

const isWeb = Platform.OS === 'web';

const call = (...args) => {
  if (!isWeb || typeof window === 'undefined' || typeof window.clarity !== 'function') return;
  try {
    window.clarity(...args);
  } catch {
    // Analytics must never break a booking. A blocked script, an ad blocker or
    // a failed network fetch should be invisible to the user.
  }
};

/**
 * Names the current screen so replays and heatmaps are grouped by screen rather
 * than lumped under "/". Clarity treats this as a virtual page view.
 */
export const clarityScreen = (name) => {
  const n = String(name || '').trim();
  if (!n) return;
  call('set', 'screen', n);
};

/**
 * Tags a session with a custom dimension — filterable in the dashboard, e.g.
 * every session that reached the booking form.
 */
export const claritySet = (key, value) => {
  if (!key || value === undefined || value === null) return;
  call('set', String(key), String(value));
};

/**
 * Marks a moment worth finding later. Clarity surfaces these as filterable
 * events, which is how you find the replay of a booking that was abandoned.
 */
export const clarityEvent = (name) => {
  const n = String(name || '').trim();
  if (!n) return;
  call('event', n);
};

/**
 * Flags the session as important so Clarity prioritises keeping the replay —
 * recordings are sampled, and the ones worth watching are the conversions and
 * the failures.
 */
export const clarityUpgrade = (reason) => {
  call('upgrade', String(reason || 'important'));
};

/**
 * Associates the session with a signed-in user. Pass an opaque id, never an
 * email or phone number — Clarity replays are viewable by anyone with dashboard
 * access, and personal data does not belong in them.
 */
export const clarityIdentify = (opaqueId) => {
  const id = String(opaqueId || '').trim();
  if (!id) return;
  call('identify', id);
};
