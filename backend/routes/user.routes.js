const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getMe,
  updateMe,
  createPatientProfile,
  updatePatientProfile,
  uploadAvatar,
  uploadFile,
  upload,
  updateDoctorProfile,
  getReferral,
  applyReferral,
  getDoctorReferral,
  applyDoctorReferral
} = require('../controllers/user.controller');

const AppSettings = require('../models/AppSettings');

const router = express.Router();

// Referral program (patient)
router.get('/referral', protect, getReferral);
router.post('/referral/apply', protect, applyReferral);

// Referral program (doctor) — one code, two independently-tracked sections
router.get('/doctor-referral', protect, authorize('doctor'), getDoctorReferral);
router.post('/doctor-referral/apply', protect, authorize('doctor'), applyDoctorReferral);

// All routes below require authentication
router.use(protect);

// @route   GET /api/users/me
router.get('/me', getMe);

// @route   GET /api/users/platform-settings
// @desc    Return public platform payment accounts (set by admin) to any logged-in user
router.get('/platform-settings', async (req, res) => {
  try {
    let s = await AppSettings.findOne({ key: 'global' });
    if (!s) s = await AppSettings.create({ key: 'global' });
    res.json({
      success: true,
      data: {
        payments: {
          bankAccount:      s.payments?.bankAccount      || '',
          bankName:         s.payments?.bankName         || '',
          bankTitle:        s.payments?.bankTitle        || '',
          easypaisaNumber:  s.payments?.easypaisaNumber  || '',
          easypaisaTitle:   s.payments?.easypaisaTitle   || '',
          jazzcashNumber:   s.payments?.jazzcashNumber   || '',
          jazzcashTitle:    s.payments?.jazzcashTitle    || '',
        },
        enabledPaymentMethods: (s.enabledPaymentMethods && s.enabledPaymentMethods.length)
          ? s.enabledPaymentMethods
          : ['visa', 'mastercard', 'easypaisa', 'jazzcash', 'bank'],
        commissionRate: s.commissionRate ?? 10,
        popularPointsThreshold: s.popularPointsThreshold ?? 20000,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// @route   PUT /api/users/me
router.put(
  '/me',
  [
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('role')
      .optional()
      .isIn(['patient', 'doctor'])
      .withMessage('Role must be either patient or doctor')
  ],
  validate,
  updateMe
);

// @route   POST /api/users/patient-profile
router.post(
  '/patient-profile',
  [
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('mobileNumber')
      .trim()
      .notEmpty()
      .withMessage('Mobile number is required')
      .matches(/^\+?[\d\s-]{7,15}$/)
      .withMessage('Please provide a valid mobile number'),
    body('dateOfBirth')
      .notEmpty()
      .withMessage('Date of birth is required')
      .isISO8601()
      .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
      .toDate(),
    body('gender')
      .notEmpty()
      .withMessage('Gender is required')
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    body('city')
      .trim()
      .notEmpty()
      .withMessage('City is required')
      .isLength({ max: 100 })
      .withMessage('City name cannot exceed 100 characters'),
    body('location')
      .optional()
      .isObject()
      .withMessage('Location must be an object'),
    body('location.type')
      .optional()
      .equals('Point')
      .withMessage('Location type must be Point'),
    body('location.coordinates')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location coordinates must be an array of [longitude, latitude]')
  ],
  validate,
  createPatientProfile
);

// @route   PUT /api/users/patient-profile
router.put(
  '/patient-profile',
  [
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('mobileNumber')
      .optional()
      .trim()
      .matches(/^\+?[\d\s-]{7,15}$/)
      .withMessage('Please provide a valid mobile number'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
      .toDate(),
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    body('city')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('City name cannot exceed 100 characters'),
    body('location')
      .optional()
      .isObject()
      .withMessage('Location must be an object'),
    body('location.type')
      .optional()
      .equals('Point')
      .withMessage('Location type must be Point'),
    body('location.coordinates')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location coordinates must be an array of [longitude, latitude]')
  ],
  validate,
  updatePatientProfile
);

// @route   POST /api/users/upload-avatar
// Multer handles the file upload; errors are caught in error-handling middleware
router.post(
  '/upload-avatar',
  (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size cannot exceed 5MB'
          });
        }
        if (err.message) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Error uploading file'
        });
      }
      next();
    });
  },
  uploadAvatar
);

// @route   POST /api/users/upload
// @desc    General upload for files / documents / certificates / gallery photos
router.post(
  '/upload',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size cannot exceed 5MB'
          });
        }
        if (err.message) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Error uploading file'
        });
      }
      next();
    });
  },
  uploadFile
);

// @route   PUT /api/users/doctor-profile
// @desc    Update doctor profile
router.put(
  '/doctor-profile',
  authorize('doctor'),
  updateDoctorProfile
);

module.exports = router;
