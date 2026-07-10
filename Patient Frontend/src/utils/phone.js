// Normalize a phone number to digits only, capped at 11 (Pakistani mobile
// format, e.g. 03XXXXXXXXX). Strips spaces, dashes, +, letters, etc.
export const sanitizePhone = (v) => String(v || '').replace(/\D/g, '').slice(0, 11);

export const PHONE_MAX = 11;
