const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  socialLogin,
  forgotPassword,
  resetPassword,
  refreshToken,
  agreePrivacy
} = require('../controllers/auth.controller');

const router = express.Router();

// @route   POST /api/auth/register
router.post(
  '/register',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/\d/)
      .withMessage('Password must contain at least one number'),
    body('role')
      .optional()
      .isIn(['patient', 'doctor'])
      .withMessage('Role must be either patient or doctor')
  ],
  validate,
  register
);

// @route   POST /api/auth/login
router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  validate,
  login
);

// @route   POST /api/auth/social-login
router.post(
  '/social-login',
  [
    body('provider')
      .notEmpty()
      .withMessage('Provider is required')
      .isIn(['google', 'facebook', 'apple'])
      .withMessage('Provider must be google, facebook, or apple'),
    body('socialId')
      .notEmpty()
      .withMessage('Social ID is required')
      .isString()
      .withMessage('Social ID must be a string'),
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
  socialLogin
);

// @route   POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],
  validate,
  forgotPassword
);

// @route   POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
  ],
  validate,
  resetPassword
);

// @route   POST /api/auth/refresh-token
router.post(
  '/refresh-token',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isString()
      .withMessage('Refresh token must be a string')
  ],
  validate,
  refreshToken
);

// @route   PUT /api/auth/agree-privacy
router.put(
  '/agree-privacy',
  protect,
  agreePrivacy
);

module.exports = router;
