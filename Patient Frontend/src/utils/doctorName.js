// Format a doctor's display name with a single "Dr." prefix.
// Some saved profiles already include "Dr"/"Dr." in fullName, which caused
// "Dr. Dr. Ahmed". This strips any existing leading title before prepending.
export function drName(fullName, fallback = 'Doctor') {
  const raw = (fullName || '').trim();
  if (!raw) return `Dr. ${fallback}`;
  // Remove a leading "Dr", "Dr.", "Doctor" (case-insensitive) + following punctuation/space.
  const stripped = raw.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  return `Dr. ${stripped || raw}`;
}

export default drName;
