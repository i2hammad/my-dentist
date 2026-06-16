const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const {
  getFavorites,
  addFavorite,
  removeFavorite,
} = require('../controllers/favorite.controller');

const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes are protected
router.use(protect);

// @route   GET /api/favorites
// @access  Private
router.get('/', getFavorites);

// @route   POST /api/favorites/:doctorId
// @access  Private
router.post(
  '/:doctorId',
  [
    param('doctorId')
      .isMongoId()
      .withMessage('Invalid doctor ID format'),
  ],
  validate,
  addFavorite
);

// @route   DELETE /api/favorites/:doctorId
// @access  Private
router.delete(
  '/:doctorId',
  [
    param('doctorId')
      .isMongoId()
      .withMessage('Invalid doctor ID format'),
  ],
  validate,
  removeFavorite
);

module.exports = router;
