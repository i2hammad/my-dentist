/**
 * Local image upload — writes files to the on-disk `uploads/` folder (served by
 * server.js at `/uploads`) and returns a relative URL. Replaces Cloudinary.
 *
 * Note: local disk is fine for a normal server/VPS. On ephemeral/serverless
 * hosts (e.g. Vercel) the filesystem is wiped between invocations, so use a
 * persistent volume or an object store there.
 */
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// In-memory storage: multer keeps the file as a Buffer (req.file.buffer).
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
  },
});

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const extFor = (file) => {
  if (file?.mimetype && EXT_BY_MIME[file.mimetype]) return EXT_BY_MIME[file.mimetype];
  const e = (file?.originalname || '').split('.').pop();
  return e && e.length >= 2 && e.length <= 5 ? e.toLowerCase() : 'jpg';
};

/**
 * Save an uploaded image locally and return its relative URL (e.g.
 * `/uploads/mydentist/avatars/1712-ab12.jpg`). Accepts a multer file object
 * (preferred — gives us the extension) or a raw Buffer.
 */
async function saveUpload(file, folder = 'mydentist') {
  const buffer = Buffer.isBuffer(file) ? file : file.buffer;
  const ext = Buffer.isBuffer(file) ? 'jpg' : extFor(file);
  const dir = path.join(UPLOADS_ROOT, folder);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await fs.promises.writeFile(path.join(dir, name), buffer);
  return `/uploads/${folder}/${name}`;
}

module.exports = { memoryUpload, saveUpload };
