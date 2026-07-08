// The marketing site uses the public (read-only) backend for live dentist
// search + the top-rated carousel. Actions that need an account (book, favorite,
// log in) hand off to the app — see APP_URL / APP_LOGIN.
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.mydentistpk.com';
export const BRAND = 'My Dentist';

// The patient/doctor web app. "Book" / "Get the App" / "Favorite" link here.
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.mydentistpk.com';
// "Log in" target — opens the app's login screen directly (the app reads the
// ?login=1 param on load). Override with VITE_APP_LOGIN_URL if needed.
export const APP_LOGIN = import.meta.env.VITE_APP_LOGIN_URL || `${APP_URL}/?login=1`;

// Deep-link to a specific dentist's profile in the app (opens for guests too).
export const doctorUrl = (id) => `${APP_URL}/?doctor=${encodeURIComponent(id)}`;

export async function getDoctors(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/doctors${qs ? `?${qs}` : ''}`);
  const json = await res.json();
  return json.data || [];
}

// Resolve relative /uploads paths against the API; absolute/data URLs pass through.
export const imgUrl = (src) => {
  if (!src) return '';
  if (/^(https?:|data:)/.test(src)) return src;
  return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
};
