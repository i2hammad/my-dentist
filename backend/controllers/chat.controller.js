const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Get list of conversations for current user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // Mark all unread messages received by current user as delivered
    await ChatMessage.updateMany(
      { receiverId: userId, isDelivered: false },
      { $set: { isDelivered: true } }
    );

    // Find all distinct users the current user has chatted with
    const conversations = await ChatMessage.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        // Determine the other user in each message
        $addFields: {
          otherUserId: {
            $cond: {
              if: { $eq: ['$senderId', userId] },
              then: '$receiverId',
              else: '$senderId',
            },
          },
        },
      },
      {
        // Sort by latest message first
        $sort: { createdAt: -1 },
      },
      {
        // Group by the other user
        $group: {
          _id: '$otherUserId',
          lastMessage: { $first: '$message' },
          lastMessageAt: { $first: '$createdAt' },
          lastMessageSenderId: { $first: '$senderId' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', userId] },
                    { $eq: ['$isRead', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        // Sort conversations by most recent message
        $sort: { lastMessageAt: -1 },
      },
      {
        // Look up the other user's info
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        // Also look up doctor profile if exists
        $lookup: {
          from: 'doctorprofiles',
          localField: '_id',
          foreignField: 'userId',
          as: 'doctorProfile',
        },
      },
      {
        // Also look up patient profile if exists
        $lookup: {
          from: 'patientprofiles',
          localField: '_id',
          foreignField: 'userId',
          as: 'patientProfile',
        },
      },
      {
        $project: {
          otherUser: {
            _id: '$_id',
            email: '$userInfo.email',
            role: '$userInfo.role',
            fullName: {
              $ifNull: [
                { $arrayElemAt: ['$doctorProfile.fullName', 0] },
                { $arrayElemAt: ['$patientProfile.fullName', 0] },
                '$userInfo.email',
              ],
            },
            photo: {
              $ifNull: [
                { $arrayElemAt: ['$doctorProfile.photo', 0] },
                { $arrayElemAt: ['$patientProfile.photo', 0] },
                null,
              ],
            },
          },
          lastMessage: 1,
          lastMessageAt: 1,
          lastMessageSenderId: 1,
          unreadCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message,
    });
  }
};

// @desc    Get messages between current user and another user
// @route   GET /api/chat/messages/:userId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = new mongoose.Types.ObjectId(req.params.userId);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    };

    const total = await ChatMessage.countDocuments(query);

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark unread messages from the other user as read and delivered
    await ChatMessage.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        $or: [{ isRead: false }, { isDelivered: false }],
      },
      { $set: { isRead: true, isDelivered: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message,
    });
  }
};

// @desc    Send a new message
// @route   POST /api/chat/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Prevent sending to self
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself',
      });
    }

    const chatMessage = await ChatMessage.create({
      senderId: req.user._id,
      receiverId,
      message,
    });

    // Determine sender's display name
    let senderName = req.user.email;
    if (req.user.role === 'doctor') {
      const DoctorProfile = require('../models/DoctorProfile');
      const docProfile = await DoctorProfile.findOne({ userId: req.user._id });
      if (docProfile && docProfile.fullName) {
        senderName = `Dr. ${docProfile.fullName}`;
      }
    } else if (req.user.role === 'patient') {
      const PatientProfile = require('../models/PatientProfile');
      const patProfile = await PatientProfile.findOne({ userId: req.user._id });
      if (patProfile && patProfile.fullName) {
        senderName = patProfile.fullName;
      }
    }

    // Create notification for receiver
    await Notification.create({
      userId: receiverId,
      type: 'chat',
      title: `New Message from ${senderName}`,
      message: message,
      relatedId: req.user._id,
      data: {
        senderId: req.user._id,
        chatMessageId: chatMessage._id,
      },
    });

    res.status(201).json({
      success: true,
      data: chatMessage,
      message: 'Message sent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
};

// @desc    Mark single message as read
// @route   PUT /api/chat/messages/:id/read
// @access  Private
const markMessageAsRead = async (req, res) => {
  try {
    const chatMessage = await ChatMessage.findById(req.params.id);

    if (!chatMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Only the receiver can mark a message as read
    if (chatMessage.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read',
      });
    }

    chatMessage.isRead = true;
    chatMessage.readAt = new Date();
    await chatMessage.save();

    res.status(200).json({
      success: true,
      data: chatMessage,
      message: 'Message marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message,
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markMessageAsRead,
};
