/**
 * One definition of what a valid signup looks like, shared by the full Register
 * screen and the account sheet at the end of booking.
 *
 * These had drifted: Register demanded 8 characters with upper, lower, a digit
 * and a symbol, while the booking sheet accepted 6 characters with a digit —
 * which is all the API enforces. The same person could be refused in one place
 * and accepted in the other, and someone who signed up mid-booking ended up
 * with a weaker password than someone who used the signup screen.
 *
 * Both now use the API's own rule, so nothing is refused on the client that
 * the server would have accepted.
 */

// No composition rules. Nothing about upper case, symbols or character classes:
// those are four ways to fail a form people fill in once, on a phone, often
// mid-booking, and they push people toward "Passw0rd!" patterns that are easy
// to guess and hard to remember.
//
// The floor here is not a policy choice — it is exactly what the API enforces
// (auth.routes.js: 6+ characters, at least one digit). Allowing less on the
// client would not make signup easier; it would just move the rejection to the
// server, where it arrives as a raw validation error after the form is
// submitted. Same restriction either way; this one is at least explained.
export const PASSWORD_MIN = 6;

export const PASSWORD_RULES = [
  { key: 'length', label: `At least ${PASSWORD_MIN} characters`, test: (p) => p.length >= PASSWORD_MIN },
  { key: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

/** Short form for a placeholder or hint line. */
export const PASSWORD_HINT = 'At least 6 characters, including a number';

export const isValidPassword = (p) => PASSWORD_RULES.every((r) => r.test(String(p || '')));

/** The rules a password is currently failing — for a checklist or an error. */
export const failedPasswordRules = (p) =>
  PASSWORD_RULES.filter((r) => !r.test(String(p || ''))).map((r) => r.label);

export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

/** Pakistani mobile, e.g. 03001234567. */
export const isValidPhone = (p) => /^03\d{9}$/.test(String(p || '').trim());
export const PHONE_HINT = 'Enter an 11-digit number starting with 03';

export const isValidName = (n) => String(n || '').trim().length >= 2;

/** Field order, so both surfaces ask for the same things in the same sequence. */
export const SIGNUP_FIELDS = ['fullName', 'phone', 'email', 'password'];
