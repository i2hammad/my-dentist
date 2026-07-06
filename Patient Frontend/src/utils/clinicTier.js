// Clinic facility grading — single source of truth.
//   Standard Clinic : 1–15 facilities
//   Modern Clinic   : 16–30 facilities
//   Elite Clinic    : 31+ facilities
export const TIER_THRESHOLDS = { modern: 16, elite: 31 };

export function getClinicTier(facilityScore = 0, thresholds) {
  const s = facilityScore || 0;
  const elite = Number(thresholds?.elite) || 31;
  const modern = Number(thresholds?.modern) || 16;
  if (s >= elite) return { label: 'Elite Clinic', color: '#F59E0B', tier: 'elite' };
  if (s >= modern) return { label: 'Modern Clinic', color: '#0052FF', tier: 'modern' };
  if (s >= 1) return { label: 'Standard Clinic', color: '#64748B', tier: 'standard' };
  return { label: 'Unrated', color: '#94A3B8', tier: 'standard' };
}

// For filtering doctor lists by tier from a facilityScore.
// Pass admin-configured `thresholds` ({ modern, elite }) to keep filters in sync
// with the Facilities settings; falls back to the built-in defaults.
export function matchesTier(facilityScore, tier, thresholds) {
  const s = facilityScore || 0;
  const elite = Number(thresholds?.elite) || 31;
  const modern = Number(thresholds?.modern) || 16;
  if (tier === 'elite') return s >= elite;
  if (tier === 'modern') return s >= modern && s < elite;
  if (tier === 'standard') return s >= 1 && s < modern;
  return true;
}
