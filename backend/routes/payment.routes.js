const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPaymentHistory,
} = require('../controllers/payment.controller');

const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes are protected
router.use(protect);

// @route   GET /api/payments/methods
// @access  Private
router.get('/methods', getPaymentMethods);

// @route   POST /api/payments/methods
// @access  Private
router.post(
  '/methods',
  [
    body('type')
      .notEmpty()
      .withMessage('Payment type is required')
      .isIn(['visa', 'mastercard', 'easypaisa', 'jazzcash', 'bank'])
      .withMessage('Invalid payment type. Must be one of: visa, mastercard, easypaisa, jazzcash, bank'),
    body('lastFourDigits')
      .optional()
      .isLength({ min: 4, max: 4 })
      .withMessage('Last four digits must be exactly 4 characters')
      .isNumeric()
      .withMessage('Last four digits must be numeric'),
    body('expiryDate')
      .optional()
      .matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
      .withMessage('Expiry date must be in MM/YY format'),
    body('accountNumber')
      .optional()
      .isLength({ min: 5 })
      .withMessage('Account number must be at least 5 characters'),
    body('bankName')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Bank name is too long'),
    body('iban')
      .optional()
      .isString()
      .isLength({ max: 40 })
      .withMessage('IBAN is too long'),
  ],
  validate,
  addPaymentMethod
);

// @route   DELETE /api/payments/methods/:id
// @access  Private
router.delete(
  '/methods/:id',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid payment method ID'),
  ],
  validate,
  deletePaymentMethod
);

// @route   PUT /api/payments/methods/:id/default
// @access  Private
router.put(
  '/methods/:id/default',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid payment method ID'),
  ],
  validate,
  setDefaultPaymentMethod
);

// @route   GET /api/payments/history
// @access  Private
router.get('/history', getPaymentHistory);

module.exports = router;
