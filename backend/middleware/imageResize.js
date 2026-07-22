const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let sharp = null;
try { sharp = require('sharp'); } catch { /* sharp not installed → passthrough */ }

const UPLOADS = path.join(__dirname, '..', 'uploads');
const CACHE = path.join(UPLOADS, '.cache');
const ALLOWED_W = [80, 160, 320, 640]; // snap to these to bound cache size
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

  const key = crypto.createHash('sha1').update(rel + '|' + w).digest('hex');
  const cached = path.join(CACHE, `${key}.webp`);

  const serve = (file) => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(file).pipe(res);
  };

  if (fs.existsSync(cached)) return serve(cached);

  fs.mkdirSync(CACHE, { recursive: true });
  sharp(src)
    .rotate()                                // honour EXIF orientation
    .resize(w, w, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()
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

  const key = crypto.createHash('sha1').update(rel + '|' + w).digest('hex');
  const cached = path.join(CACHE, `${key}.webp`);
  const send = (buf) => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
  };
  if (fs.existsSync(cached)) return fs.readFile(cached, (e, b) => (e ? res.status(500).end() : send(b)));

  fs.mkdirSync(CACHE, { recursive: true });
  sharp(src).rotate().resize(w, w, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
    .then((buf) => { fs.writeFile(cached, buf, () => {}); send(buf); })
    .catch(() => res.status(500).end());
}

module.exports = imageResize;
module.exports.route = imageResizeRoute;
