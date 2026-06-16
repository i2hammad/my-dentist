/**
 * Cloudinary configuration + helpers.
 *
 * Uploads go straight to Cloudinary instead of the local disk, so they
 * persist on serverless hosts (Vercel) where the filesystem is ephemeral.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
const { v2: cloudinary } = require('cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Have the Cloudinary credentials actually been set?
const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

// In-memory storage: multer keeps the file as a Buffer (req.file.buffer)
// instead of writing to disk. Reused by both avatar and gallery uploads.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
    }
  },
});

/**
 * Stream a file buffer to Cloudinary and resolve with the secure HTTPS URL.
 * @param {Buffer} buffer  - file bytes (from multer memory storage)
 * @param {string} folder  - Cloudinary folder, e.g. 'mydentist/avatars'
 * @returns {Promise<string>} the uploaded image's secure_url
 */
const uploadToCloudinary = (buffer, folder = 'mydentist') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });

module.exports = {
  cloudinary,
  memoryUpload,
  uploadToCloudinary,
  isCloudinaryConfigured,
};
