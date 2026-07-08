// The marketing site uses the public (read-only) backend for live dentist
// search + the top-rated carousel. Actions that need an account (book, favorite,
// log in) hand off to the app — see APP_URL / APP_LOGIN.
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.mydentistpk.com';
export const BRAND = 'My Dentist';

// The patient/doctor web app. "Book" / "Get the App" / "Favorite" link here.
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.mydentistpk.com';
// "Log in" target — the app entry (shows login for logged-out users). Override
// with VITE_APP_LOGIN_URL if a dedicated login URL exists later.
export const APP_LOGIN = import.meta.env.VITE_APP_LOGIN_URL || APP_URL;

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
