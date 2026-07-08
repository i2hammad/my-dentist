const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notification.controller');

const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes are protected
router.use(protect);

// @route   GET /api/notifications
// @access  Private
router.get('/', getNotifications);

// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', getUnreadCount);

// @route   PUT /api/notifications/read-all
// @access  Private
// NOTE: This must come BEFORE /:id/read to avoid route conflict
router.put('/read-all', markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @access  Private
router.put(
  '/:id/read',
  [
    param('id')
      .notEmpty()
      .withMessage('Invalid notification ID'),
  ],
  validate,
  markAsRead
);

module.exports = router;
