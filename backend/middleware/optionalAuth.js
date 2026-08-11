const jwt = require('jsonwebtoken');

/**
 * Identifies the caller when a token is present, but never rejects.
 *
 * `protect` is the wrong tool for public endpoints: the doctor directory has to
 * stay open to signed-out visitors and to crawlers, but it should not hand out
 * personal contact details to anyone who asks. This sets `req.isAuthed` so a
 * controller can decide what to include, without turning a public route into a
 * private one.
 *
 * Deliberately does not load the user from the database — the only question is
 * "is this a real signed-in session?", and skipping the query keeps the
 * directory's hot path fast.
 */
module.exports = function optionalAuth(req, _res, next) {
  req.isAuthed = false;

  // Build-time key for the static site generator. gen-seo-pages.js calls this
  // API unauthenticated to build the pre-rendered pages, and those pages are
  // meant to carry full detail — they are what Google indexes. Without this the
  // generator would be treated as a guest and quietly publish coarsened
  // addresses with no contact details, costing the search traffic the guest
  // gate exists to convert. Unset by default, so it is off unless configured.
  const buildKey = process.env.BUILD_API_KEY;
  if (buildKey && req.headers['x-build-key'] === buildKey) {
    req.isAuthed = true;
    return next();
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();

  const token = header.slice(7).trim();
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.id) {
      req.isAuthed = true;
      req.authUserId = decoded.id;
    }
  } catch {
    // Expired or forged token: treat as a guest rather than erroring. A stale
    // token in an old tab should degrade to the public view, not a 401 on a
    // page that is meant to be public.
  }
  return next();
};
