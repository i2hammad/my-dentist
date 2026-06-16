const express = require('express');
const { body, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const {
  getMyGallery,
  getDoctorGallery,
  addGalleryItem,
  deleteGalleryItem,
} = require('../controllers/gallery.controller');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validate');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/gallery/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter — only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Upload fields for before/after or single image
const galleryUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 },
]);

// @route   GET /api/gallery/my
// @access  Private (Doctor)
router.get(
  '/my',
  protect,
  authorize('doctor'),
  getMyGallery
);

// @route   GET /api/gallery/doctor/:doctorId
// @access  Public
router.get(
  '/doctor/:doctorId',
  [
    param('doctorId')
      .isMongoId()
      .withMessage('Invalid doctor ID format'),
  ],
  validate,
  getDoctorGallery
);

// @route   POST /api/gallery
// @access  Private (Doctor)
router.post(
  '/',
  protect,
  authorize('doctor'),
  galleryUpload,
  [
    body('category')
      .notEmpty()
      .withMessage('Category is required')
      .isIn(['clinic_photos', 'before_after', 'certificates'])
      .withMessage('Category must be one of: clinic_photos, before_after, certificates'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Title must be at most 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be at most 1000 characters'),
  ],
  validate,
  addGalleryItem
);

// @route   DELETE /api/gallery/:id
// @access  Private (Doctor)
router.delete(
  '/:id',
  protect,
  authorize('doctor'),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid gallery item ID'),
  ],
  validate,
  deleteGalleryItem
);

module.exports = router;
