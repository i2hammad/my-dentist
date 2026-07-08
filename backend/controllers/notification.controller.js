const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');

// @desc    Get user's notifications (paginated)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const where = { userId: req.user._id };

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(notifications),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user._id, isRead: false } });
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
  }
};

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this notification' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.status(200).json({ success: true, data: serialize(updated), message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notification as read', error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user._id, isRead: false },
      data: { isRead: true },
    });
    res.status(200).json({
      success: true,
      message: `${result.count} notifications marked as read`,
      data: { modifiedCount: result.count },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read', error: error.message });
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
