const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');

// @desc    Get list of conversations for current user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Mark received-but-undelivered as delivered.
    await prisma.chatMessage.updateMany({
      where: { receiverId: userId, isDelivered: false },
      data: { isDelivered: true },
    });

    // All messages involving the user, newest first.
    const messages = await prisma.chatMessage.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
    });

    // Group by the other participant.
    const byOther = new Map();
    for (const m of messages) {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      let conv = byOther.get(otherId);
      if (!conv) {
        conv = {
          otherId,
          lastMessage: m.message,
          lastMessageAt: m.createdAt,
          lastMessageSenderId: m.senderId,
          unreadCount: 0,
        };
        byOther.set(otherId, conv);
      }
      if (m.receiverId === userId && !m.isRead) conv.unreadCount += 1;
    }

    const otherIds = [...byOther.keys()];
    const [users, doctorProfiles, patientProfiles] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, email: true, role: true } }),
      prisma.doctorProfile.findMany({ where: { userId: { in: otherIds } }, select: { userId: true, fullName: true, photo: true } }),
      prisma.patientProfile.findMany({ where: { userId: { in: otherIds } }, select: { userId: true, fullName: true, profileImage: true } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const docMap = new Map(doctorProfiles.map((d) => [d.userId, d]));
    const patMap = new Map(patientProfiles.map((p) => [p.userId, p]));

    const conversations = [...byOther.values()]
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .map((c) => {
        const u = userMap.get(c.otherId);
        const doc = docMap.get(c.otherId);
        const pat = patMap.get(c.otherId);
        return {
          otherUser: {
            _id: c.otherId,
            email: u?.email,
            role: u?.role,
            fullName: doc?.fullName || pat?.fullName || u?.email,
            photo: doc?.photo || pat?.profileImage || null,
          },
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt,
          lastMessageSenderId: c.lastMessageSenderId,
          unreadCount: c.unreadCount,
        };
      });

    res.status(200).json({ success: true, count: conversations.length, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: error.message });
  }
};

// @desc    Get messages between current user and another user
// @route   GET /api/chat/messages/:userId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const where = {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    };

    const [total, messages] = await Promise.all([
      prisma.chatMessage.count({ where }),
      prisma.chatMessage.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * limit, take: limit }),
    ]);

    // Mark unread/undelivered from the other user as read+delivered.
    await prisma.chatMessage.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: currentUserId,
        OR: [{ isRead: false }, { isDelivered: false }],
      },
      data: { isRead: true, isDelivered: true, readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(messages),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
  }
};

// @desc    Send a new message
// @route   POST /api/chat/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return res.status(404).json({ success: false, message: 'Receiver not found' });
    if (receiverId === req.user._id) {
      return res.status(400).json({ success: false, message: 'Cannot send message to yourself' });
    }

    const chatMessage = await prisma.chatMessage.create({
      data: { senderId: req.user._id, receiverId, message },
    });

    // Sender display name.
    let senderName = req.user.email;
    if (req.user.role === 'doctor') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id }, select: { fullName: true } });
      if (docProfile?.fullName) senderName = `Dr. ${docProfile.fullName}`;
    } else if (req.user.role === 'patient') {
      const patProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id }, select: { fullName: true } });
      if (patProfile?.fullName) senderName = patProfile.fullName;
    }

    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'chat',
          title: `New Message from ${senderName}`,
          message,
          relatedId: req.user._id,
          data: { senderId: req.user._id, chatMessageId: chatMessage.id },
        },
      });
    } catch (_) { /* notification is best-effort */ }

    res.status(201).json({ success: true, data: serialize(chatMessage), message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
};

// @desc    Mark single message as read
// @route   PUT /api/chat/messages/:id/read
// @access  Private
const markMessageAsRead = async (req, res) => {
  try {
    const chatMessage = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
    if (!chatMessage) return res.status(404).json({ success: false, message: 'Message not found' });
    if (chatMessage.receiverId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to mark this message as read' });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: req.params.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.status(200).json({ success: true, data: serialize(updated), message: 'Message marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark message as read', error: error.message });
  }
};

module.exports = { getConversations, getMessages, sendMessage, markMessageAsRead };
