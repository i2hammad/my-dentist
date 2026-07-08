const express = require('express');
const { query, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const {
  getDoctors,
  getNearbyDoctors,
  searchDoctors,
  getDoctorById,
  getDoctorServices,
  getDoctorStats
} = require('../controllers/doctor.controller');

const router = express.Router();

// @route   GET /api/doctors
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('specialization')
      .optional()
      .trim()
      .isString()
      .withMessage('Specialization must be a string'),
    query('clinicTier')
      .optional()
      .trim()
      .isString()
      .withMessage('Clinic tier must be a string'),
    query('pmdcVerified')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('pmdcVerified must be true or false')
  ],
  validate,
  getDoctors
);

// @route   GET /api/doctors/nearby
router.get(
  '/nearby',
  [
    query('lat')
      .notEmpty()
      .withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    query('lng')
      .notEmpty()
      .withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    query('radius')
      .optional()
      .isFloat({ min: 0.1, max: 500 })
      .withMessage('Radius must be between 0.1 and 500 km')
  ],
  validate,
  getNearbyDoctors
);

// @route   GET /api/doctors/search
router.get(
  '/search',
  [
    query('q')
      .trim()
      .notEmpty()
      .withMessage('Search query (q) is required')
      .isLength({ min: 1, max: 200 })
      .withMessage('Search query must be between 1 and 200 characters'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validate,
  searchDoctors
);

// @route   GET /api/doctors/:id
router.get(
  '/:id',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid doctor ID format')
  ],
  validate,
  getDoctorById
);

// @route   GET /api/doctors/:id/services
router.get(
  '/:id/services',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid doctor ID format')
  ],
  validate,
  getDoctorServices
);

// @route   GET /api/doctors/:id/stats
router.get(
  '/:id/stats',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid doctor ID format')
  ],
  validate,
  getDoctorStats
);

module.exports = router;
