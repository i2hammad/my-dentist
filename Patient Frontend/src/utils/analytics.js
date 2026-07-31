import { Platform } from 'react-native';

/**
 * Meta Pixel events fired from inside the app.
 *
 * The pixel snippet in the page <head> only fires PageView on the initial load.
 * This is a single-page app, so every screen after that — a dentist profile, the
 * booking form, signup — happens without a page load and is invisible to the
 * pixel unless reported explicitly.
 *
 * Web only. `fbq` does not exist in the native builds, and every function here
 * is a no-op there rather than throwing.
 */

const isWeb = Platform.OS === 'web';

const fbq = (...args) => {
  if (!isWeb || typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try {
    window.fbq(...args);
  } catch {
    // Analytics must never break a booking. A blocked pixel, an ad blocker, or a
    // failed network fetch should be invisible to the user.
  }
};

/** Standard Meta event. Use `track` for events Meta defines. */
export const track = (event, params) => fbq('track', event, params);

/** Custom event, for anything outside Meta's standard set. */
export const trackCustom = (event, params) => fbq('trackCustom', event, params);

// ── Named events ────────────────────────────────────────────────────────────
// Wrapped rather than called inline so the parameter shape stays consistent
// across screens and the event names live in one place.

/** A dentist profile opened inside the app. */
export const trackViewDoctor = (doc) => {
  if (!doc) return;
  track('ViewContent', {
    content_name: String(doc.fullName || 'Dentist').trim(),
    content_category: doc.specialization || 'Dentist',
    content_ids: [String(doc._id || doc.id || '')],
    content_type: 'product',
  });
};

/**
 * The booking form opened for a dentist — intent, not a completed booking.
 * Meta's InitiateCheckout is the closest standard equivalent.
 */
export const trackBookingStarted = (doc) => {
  track('InitiateCheckout', {
    content_name: String(doc?.fullName || 'Dentist').trim(),
    content_category: doc?.specialization || 'Dentist',
    content_ids: [String(doc?._id || doc?.id || '')],
    content_type: 'product',
    // The consultation fee, not the treatment cost, which is quoted at the visit.
    value: Number(doc?.consultationFee) || 0,
    currency: 'PKR',
  });
};

/**
 * An appointment actually created — the conversion worth optimising ads
 * against. Fired only after the API confirms it, never on submit.
 */
export const trackBookingCompleted = ({ doctor, treatment, date }) => {
  track('Schedule', {
    content_name: String(doctor?.fullName || 'Dentist').trim(),
    content_category: treatment || doctor?.specialization || 'Dentist',
    content_ids: [String(doctor?._id || doctor?.id || '')],
    value: Number(doctor?.consultationFee) || 0,
    currency: 'PKR',
    appointment_date: date || undefined,
  });
};

/** Account created. `role` separates patient signups from dentist signups. */
export const trackSignup = (role) => {
  track('CompleteRegistration', {
    content_name: role === 'doctor' ? 'Dentist signup' : 'Patient signup',
    status: true,
  });
};

/**
 * A message thread opened with a dentist. Custom rather than standard: Meta has
 * a `Contact` event, but that is closer to "contacted the business" — this is
 * in-app chat, which is a distinct funnel step worth separating from booking.
 */
export const trackContactDoctor = (doc) => {
  trackCustom('ContactDentist', {
    content_name: String(doc?.fullName || 'Dentist').trim(),
    content_ids: [String(doc?._id || doc?.id || '')],
    content_category: doc?.specialization || 'Dentist',
  });
};

/**
 * A review submitted. Only three of the listed dentists have any reviews, so
 * this is the signal to watch when judging whether review prompts are working.
 */
export const trackReviewSubmitted = ({ doctor, rating }) => {
  trackCustom('SubmitReview', {
    content_name: String(doctor?.fullName || 'Dentist').trim(),
    content_ids: [String(doctor?._id || doctor?.id || '')],
    value: Number(rating) || 0,
  });
};

/** Signed in. Separate from CompleteRegistration — a return visit, not a new one. */
export const trackLogin = (role) => {
  trackCustom('Login', { role: role || 'patient' });
};

/**
 * A treatment or specialty page opened inside the app — the same intent the
 * pre-rendered pages report, but for in-app navigation the pixel cannot see.
 */
export const trackViewCategory = ({ name, type }) => {
  track('ViewContent', {
    content_name: String(name || '').trim(),
    content_category: type || 'Category',
    content_type: 'product_group',
  });
};

/** A patient completed their profile — the point they can actually book. */
export const trackProfileCompleted = () => {
  trackCustom('CompleteProfile', { status: true });
};

/** A search run in the app. */
export const trackSearch = (query) => {
  const q = String(query || '').trim();
  if (!q) return;
  track('Search', { search_string: q });
};

/** A dentist saved to favourites. */
export const trackSaveDoctor = (doc) => {
  track('AddToWishlist', {
    content_name: String(doc?.fullName || 'Dentist').trim(),
    content_ids: [String(doc?._id || doc?.id || '')],
    content_type: 'product',
  });
};
