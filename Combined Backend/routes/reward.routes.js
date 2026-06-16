const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getMyRewards,
  getEarnRules,
  redeemPoints,
  applyCode,
  generateReferral,
} = require('../controllers/reward.controller');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validate');

// @route   GET /api/rewards/earn-rules
// @access  Public
router.get('/earn-rules', getEarnRules);

// @route   GET /api/rewards/my
// @access  Private (Patient)
router.get('/my', protect, authorize('patient'), getMyRewards);

// @route   POST /api/rewards/redeem
// @access  Private (Patient)
router.post(
  '/redeem',
  protect,
  authorize('patient'),
  [
    body('points')
      .notEmpty()
      .withMessage('Points are required')
      .isInt({ min: 1 })
      .withMessage('Points must be a positive integer'),
  ],
  validate,
  redeemPoints
);

// @route   POST /api/rewards/apply-code
// @access  Private (Doctor)
router.post(
  '/apply-code',
  protect,
  authorize('doctor'),
  [
    body('code')
      .notEmpty()
      .withMessage('Reward code is required')
      .isLength({ min: 8, max: 8 })
      .withMessage('Code must be 8 characters'),
    body('billId')
      .notEmpty()
      .withMessage('Bill ID is required')
      .isMongoId()
      .withMessage('Invalid bill ID format'),
  ],
  validate,
  applyCode
);

// @route   POST /api/rewards/refer
// @access  Private (Patient)
router.post('/refer', protect, authorize('patient'), generateReferral);

module.exports = router;
