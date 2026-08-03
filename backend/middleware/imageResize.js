const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let sharp = null;
try { sharp = require('sharp'); } catch { /* sharp not installed → passthrough */ }

const UPLOADS = path.join(__dirname, '..', 'uploads');
const CACHE = path.join(UPLOADS, '.cache');
const ALLOWED_W = [80, 160, 320, 640]; // snap to these to bound cache size

// Baked-in watermark. CSS overlays are sharper and free, and the apps use those —
// but they disappear the moment someone saves or screenshots the photo, which is
// exactly when attribution matters. These pixels survive that.
//
// Only 320px and up: at 80/160px the URL renders as an illegible smudge that
// dirties the thumbnail without communicating anything.
const WATERMARK_MIN_W = 320;
const SITE_LABEL = 'mydentistpk.com';

/**
 * SVG overlay sized to the image: a bottom scrim with the site URL, plus a
 * "POPULAR" pill when the doctor holds that placement.
 */
function watermarkSvg(w, popular) {
  const pad = Math.round(w * 0.025);
  const fs_ = Math.max(11, Math.round(w * 0.045));      // URL text
  const scrim = Math.round(fs_ * 2.6);
  const pillH = Math.max(16, Math.round(w * 0.062));
  const pillFs = Math.max(9, Math.round(w * 0.036));
  const pillW = Math.round(pillFs * 5.4);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(2,6,23,0)"/><stop offset="100%" stop-color="rgba(2,6,23,0.66)"/>
  </linearGradient></defs>
  <rect x="0" y="${w - scrim}" width="${w}" height="${scrim}" fill="url(#g)"/>
  <text x="${w / 2}" y="${w - pad}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="${fs_}" font-weight="700" fill="#ffffff" opacity="0.92">${esc(SITE_LABEL)}</text>
  ${popular ? `<g>
    <rect x="${pad}" y="${pad}" rx="${pillH / 2}" ry="${pillH / 2}" width="${pillW}" height="${pillH}" fill="#1D4ED8"/>
    <text x="${pad + pillW / 2}" y="${pad + pillH * 0.72}" text-anchor="middle"
          font-family="Helvetica,Arial,sans-serif" font-size="${pillFs}" font-weight="700"
          fill="#ffffff" letter-spacing="0.4">POPULAR</text>
  </g>` : ''}
</svg>`);
}
const EXT_RE = /\.(png|jpe?g|webp)$/i;

/**
 * On-demand image resizing for /uploads.
 *
 * A request like  /uploads/x/y.jpg?w=160  returns a 160px-wide WebP (resized,
 * re-encoded, cached to disk). Requests with no ?w= (or non-image paths) fall
 * through to the normal express.static handler untouched — existing links keep
 * working. Requested widths snap to a small allow-list so the cache can't be
 * ballooned by arbitrary ?w= values.
 *
 * Mount BEFORE express.static('/uploads').
 */
function imageResize(req, res, next) {
  if (!sharp) return next();                 // no sharp → serve originals
  const wRaw = parseInt(req.query.w, 10);
  if (!wRaw || !EXT_RE.test(req.path)) return next(); // not a resize request

  // Snap to the nearest allowed width (>= requested, else the largest).
  const w = ALLOWED_W.find((x) => x >= wRaw) || ALLOWED_W[ALLOWED_W.length - 1];

  // Resolve the source file safely inside UPLOADS (block path traversal).
  const rel = decodeURIComponent(req.path.replace(/^\/+/, ''));
  const src = path.join(UPLOADS, rel);
  if (!src.startsWith(UPLOADS + path.sep)) return res.status(400).end();
  if (!fs.existsSync(src)) return next();    // let static return its 404

  const popular = req.query.popular === '1';
  const mark = w >= WATERMARK_MIN_W;
  const key = crypto.createHash('sha1').update(`${rel}|${w}|${mark ? 'wm' : 'raw'}|${popular ? 'pop' : ''}`).digest('hex');
  const cached = path.join(CACHE, `${key}.webp`);

  const serve = (file) => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(file).pipe(res);
  };

  if (fs.existsSync(cached)) return serve(cached);

  fs.mkdirSync(CACHE, { recursive: true });
  // Same two-step as the route handler: the overlay must match the ACTUAL output
  // size, which `withoutEnlargement` may cap below the requested width.
  sharp(src)
    .rotate()                                // honour EXIF orientation
    .resize(w, w, { fit: 'cover', withoutEnlargement: true })
    .toBuffer()
    .then(async (resized) => {
      if (!mark) return sharp(resized).webp({ quality: 72 }).toBuffer();
      const { width } = await sharp(resized).metadata();
      return sharp(resized)
        .composite([{ input: watermarkSvg(width, popular), top: 0, left: 0 }])
        .webp({ quality: 72 }).toBuffer();
    })
    .then((buf) => {
      fs.writeFile(cached, buf, () => {});   // cache best-effort
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(buf);
    })
    .catch(() => next());                     // on any error, fall back to original
}

/**
 * Route-style handler: GET /api/img?src=/uploads/x/y.jpg&w=160
 *
 * Same resizing as the middleware, but lives under /api/ which CloudLinux
 * Passenger always routes to Node (LiteSpeed serves real /uploads/*.png files
 * statically before Node sees them, so ?w= on /uploads is bypassed — this path
 * isn't a real file, so it always reaches us).
 */
function imageResizeRoute(req, res) {
  if (!sharp) return res.status(501).end();
  const wRaw = parseInt(req.query.w, 10);
  const srcParam = String(req.query.src || '');
  if (!wRaw || !EXT_RE.test(srcParam)) return res.status(400).end();
  const w = ALLOWED_W.find((x) => x >= wRaw) || ALLOWED_W[ALLOWED_W.length - 1];

  const rel = decodeURIComponent(srcParam.replace(/^\/?uploads\/?/, '').replace(/^\/+/, ''));
  const src = path.join(UPLOADS, rel);
  if (!src.startsWith(UPLOADS + path.sep)) return res.status(400).end();
  if (!fs.existsSync(src)) return res.status(404).end();

  // ?popular=1 draws the promoted pill. The caller supplies it because this
  // route resizes a file path and has no doctor record to look it up from.
  const popular = req.query.popular === '1';
  const mark = w >= WATERMARK_MIN_W;
  // The flags are part of the cache key: without them a previously cached
  // un-watermarked render would be served forever.
  const key = crypto.createHash('sha1').update(`${rel}|${w}|${mark ? 'wm' : 'raw'}|${popular ? 'pop' : ''}`).digest('hex');
  const cached = path.join(CACHE, `${key}.webp`);
  const send = (buf) => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
  };
  if (fs.existsSync(cached)) return fs.readFile(cached, (e, b) => (e ? res.status(500).end() : send(b)));

  fs.mkdirSync(CACHE, { recursive: true });
  // Resize first, then read the real output size. `withoutEnlargement` caps the
  // result at the source's own dimensions, so a 512px photo asked for at w=640
  // comes back 512 — and compositing a 640px overlay onto it throws
  // "Image to composite must have same dimensions or smaller". Sizing the
  // overlay to the requested width silently lost every watermark on any photo
  // smaller than the requested size.
  sharp(src).rotate().resize(w, w, { fit: 'cover', withoutEnlargement: true }).toBuffer()
    .then(async (resized) => {
      if (!mark) return sharp(resized).webp({ quality: 72 }).toBuffer();
      const { width } = await sharp(resized).metadata();
      return sharp(resized)
        .composite([{ input: watermarkSvg(width, popular), top: 0, left: 0 }])
        .webp({ quality: 72 }).toBuffer();
    })
    .then((buf) => { fs.writeFile(cached, buf, () => {}); send(buf); })
    // Never fail an image because the watermark failed — retry clean.
    .catch(() => sharp(src).rotate().resize(w, w, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 72 }).toBuffer().then(send).catch(() => res.status(500).end()));
}

module.exports = imageResize;
module.exports.route = imageResizeRoute;
