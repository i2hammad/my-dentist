const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  getConversations,
  getMessages,
  sendMessage,
  markMessageAsRead,
} = require('../controllers/chat.controller');

const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes are protected
router.use(protect);

// @route   GET /api/chat/conversations
// @access  Private
router.get('/conversations', getConversations);

// @route   GET /api/chat/messages/:userId
// @access  Private
router.get(
  '/messages/:userId',
  [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
  ],
  validate,
  getMessages
);

// @route   POST /api/chat/messages
// @access  Private
router.post(
  '/messages',
  [
    body('receiverId')
      .notEmpty()
      .withMessage('Receiver ID is required')
      .isMongoId()
      .withMessage('Invalid receiver ID format'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be between 1 and 5000 characters'),
  ],
  validate,
  sendMessage
);

// @route   PUT /api/chat/messages/:id/read
// @access  Private
router.put(
  '/messages/:id/read',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID'),
  ],
  validate,
  markMessageAsRead
);

module.exports = router;
