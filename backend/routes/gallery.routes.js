const express = require('express');
const { body, param } = require('express-validator');
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
const { memoryUpload: upload } = require('../config/upload');

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
      .notEmpty()
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
      .notEmpty()
      .withMessage('Invalid gallery item ID'),
  ],
  validate,
  deleteGalleryItem
);

module.exports = router;
