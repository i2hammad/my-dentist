// Shared helpers for promo/campaign display so banners and the detail screen
// stay consistent.

// Weak/placeholder CTA labels an admin might enter — replaced with a clear default.
const WEAK_CTA = new Set(['press', 'click', 'tap', 'go', 'ok', 'submit', 'button', 'cta', 'view']);

// Returns a usable CTA label, falling back to `fallback` when the admin value is
// empty or a weak placeholder like "Press".
export function ctaLabel(raw, fallback = 'Learn More') {
  const v = (raw || '').trim();
  if (!v || WEAK_CTA.has(v.toLowerCase())) return fallback;
  return v;
}

// Campaign titles are sometimes empty or just punctuation (e.g. a stray "•").
// Clean it and fall back to the company / a generic label.
export function promoTitle(campaign) {
  const raw = (campaign?.title || '').trim();
  const hasReal = raw.replace(/[•\-–—.\s]/g, '').length > 0;
  return hasReal ? raw : (campaign?.company || campaign?.medicineName || 'Special Offer');
}
