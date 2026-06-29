const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validate');

const {
  getDoctorReviews,
  getDoctorReviewStats,
  createReview,
  toggleHelpful,
  deleteReview,
  replyToReview,
  getMyReviews
} = require('../controllers/review.controller');

// --- Protected: patient's own reviews ---

// @route   GET /api/reviews/my
// @desc    Reviews written by the logged-in patient (with doctor info)
router.get('/my', protect, authorize('patient'), getMyReviews);

// --- Public routes ---

// @route   GET /api/reviews/doctor/:doctorId
// @desc    Get reviews for a specific doctor (paginated)
router.get(
  '/doctor/:doctorId',
  [
    param('doctorId').isMongoId().withMessage('Invalid doctor ID'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  getDoctorReviews
);

// @route   GET /api/reviews/doctor/:doctorId/stats
// @desc    Get review statistics for a doctor
router.get(
  '/doctor/:doctorId/stats',
  [
    param('doctorId').isMongoId().withMessage('Invalid doctor ID')
  ],
  validate,
  getDoctorReviewStats
);

// --- Protected routes ---

// @route   POST /api/reviews
// @desc    Create a review (patient only)
router.post(
  '/',
  protect,
  authorize('patient'),
  [
    body('doctorId')
      .notEmpty().withMessage('Doctor ID is required')
      .isMongoId().withMessage('Invalid doctor ID'),
    body('rating')
      .notEmpty().withMessage('Rating is required')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment')
      .optional()
      .trim()
      .isLength({ min: 5, max: 1000 }).withMessage('Comment must be between 5 and 1000 characters')
  ],
  validate,
  createReview
);

// @route   PUT /api/reviews/:id/helpful
// @desc    Toggle helpful on a review
router.put(
  '/:id/helpful',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid review ID')
  ],
  validate,
  toggleHelpful
);

// @route   PUT /api/reviews/:id/reply
// @desc    Doctor replies to a review on their profile
router.put(
  '/:id/reply',
  protect,
  authorize('doctor'),
  [param('id').isMongoId().withMessage('Invalid review ID')],
  validate,
  replyToReview
);

// @route   DELETE /api/reviews/:id
// @desc    Delete a review (author only)
router.delete(
  '/:id',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid review ID')
  ],
  validate,
  deleteReview
);

module.exports = router;
