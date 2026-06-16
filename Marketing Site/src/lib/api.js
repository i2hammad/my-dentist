// Public read-only calls to the My Dentist PK backend.
export const API_URL = import.meta.env.VITE_API_URL || 'https://my-dentist-sigma.vercel.app';
export const APP_URL = import.meta.env.VITE_APP_URL || '#';
export const BRAND = 'My Dentist PK';

export async function getDoctors(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/doctors${qs ? `?${qs}` : ''}`);
  const json = await res.json();
  return json.data || [];
}

// Resolve relative /uploads paths; Cloudinary/absolute URLs pass through.
export const imgUrl = (src) => {
  if (!src) return '';
  if (/^(https?:|data:)/.test(src)) return src;
  return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
};
