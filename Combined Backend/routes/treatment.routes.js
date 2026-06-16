const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getMyTreatments,
  getDoctorTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment
} = require('../controllers/treatment.controller');

const router = express.Router();

// @route   GET /api/treatments/my
router.get(
  '/my',
  protect,
  authorize('doctor'),
  getMyTreatments
);

// @route   GET /api/treatments/doctor/:doctorId
router.get(
  '/doctor/:doctorId',
  [
    param('doctorId')
      .isMongoId()
      .withMessage('Invalid doctor ID format'),
    query('active')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('Active filter must be true or false'),
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
  getDoctorTreatments
);

// @route   POST /api/treatments
router.post(
  '/',
  protect,
  authorize('doctor'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Treatment name is required')
      .isLength({ min: 2, max: 200 })
      .withMessage('Treatment name must be between 2 and 200 characters'),
    body('priceMin')
      .notEmpty()
      .withMessage('Minimum price is required')
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a non-negative number'),
    body('priceMax')
      .notEmpty()
      .withMessage('Maximum price is required')
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a non-negative number')
  ],
  validate,
  createTreatment
);

// @route   PUT /api/treatments/:id
router.put(
  '/:id',
  protect,
  authorize('doctor'),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid treatment ID format'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Treatment name must be between 2 and 200 characters'),
    body('priceMin')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a non-negative number'),
    body('priceMax')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a non-negative number'),
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean value')
  ],
  validate,
  updateTreatment
);

// @route   DELETE /api/treatments/:id
router.delete(
  '/:id',
  protect,
  authorize('doctor'),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid treatment ID format')
  ],
  validate,
  deleteTreatment
);

module.exports = router;
