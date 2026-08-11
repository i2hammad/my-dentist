/**
 * What a signed-out visitor is shown.
 *
 * Guests can browse the directory — that is the point of the pre-rendered pages
 * and the reason search traffic arrives at all — but the details that make a
 * listing directly actionable are held back until they have an account:
 *
 *   - Exact street address. City and area still show, so a guest can tell
 *     whether a clinic is convenient; the door number needs signup.
 *   - Phone numbers, gated server-side (the API used to return every doctor's
 *     personal mobile to anyone who asked).
 *
 * The pre-rendered pages deliberately keep full detail. They are what Google
 * indexes and rank the site, and stripping them would cost the traffic this
 * gate exists to convert.
 */

/**
 * Address trimmed to something a guest can act on without giving away the
 * exact location: the last one or two comma-separated parts, which in these
 * records is the area and city ("Satellite Town, Rawalpindi").
 */
export const publicAddress = (doctor) => {
  const city = String(doctor?.city || '').trim();
  const full = String(doctor?.address || '').trim();
  if (!full) return city;

  const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
  // Already short enough to be an area rather than a doorstep.
  if (parts.length <= 1) return city || full;

  const tail = parts[parts.length - 1];
  // The last part is usually the city; pair it with the area before it.
  const area = parts.length >= 2 ? parts[parts.length - 2] : '';
  const joined = [area, tail].filter(Boolean).join(', ');
  return joined || city || full;
};

/**
 * The address to render. Signed-in users get the real one; guests get the area.
 * `isGuest` comes from useIsGuest() so it re-checks on focus and flips as soon
 * as someone signs in.
 */
export const addressFor = (doctor, isGuest) => {
  const full = [doctor?.address, doctor?.city].filter(Boolean).join(', ').trim();
  if (!isGuest) return full;
  return publicAddress(doctor);
};

/** Copy for the prompt shown where a gated detail would have been. */
export const GATED_HINT = 'Sign up to see the full address and contact details';
