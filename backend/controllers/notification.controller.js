import Notification from '../models/Notification.js';
import { createNotification } from '../utils/notification.helper.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/notifications
 * Retrieves all notifications for the currently logged-in user, sorted by newest first.
 * Supports filtering by isRead state: ?filter=unread or ?filter=read
 */
export const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { filter } = req.query;

  try {
    let query = { userId };
    
    if (filter === 'unread') {
      query.isRead = false;
    } else if (filter === 'read') {
      query.isRead = true;
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    return sendSuccess(res, 'Notifications loaded successfully.', { notifications });
  } catch (err) {
    return sendError(res, `Failed retrieving notifications: ${err.message}`, 500);
  }
};

/**
 * POST /api/notifications/create
 * Allows custom manual notification creation (great for debugging or custom alerts).
 */
export const createNotificationApi = async (req, res) => {
  const { userId, type, title, message } = req.body;

  if (!userId || !type || !title || !message) {
    return sendError(res, 'Missing parameters. userId, type, title, and message are required.', 400);
  }

  try {
    const created = await createNotification(userId, type, title, message);
    if (!created) {
      return sendError(res, 'Failed to create notification. Check server logs.', 500);
    }
    return sendSuccess(res, 'Notification registered and dispatched successfully.', { notification: created }, 201);
  } catch (err) {
    return sendError(res, `Failed creating manual notification: ${err.message}`, 500);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Marks a specific notification as read.
 */
export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      console.warn(`⚠️ [Notification Marked Read Blocked] Notification "${id}" not found or not owned by User: "${userId}"`);
      return sendError(res, 'Notification not found or access denied.', 404);
    }

    notification.isRead = true;
    await notification.save();

    console.log(`🔔 [Notification Marked Read] ID: "${id}" for User: "${userId}"`);

    // Trigger update count event
    if (global.io) {
      global.io.to(`user:${userId}`).emit('unread_count_update');
    }

    return sendSuccess(res, 'Notification marked as read.', { notification });
  } catch (err) {
    console.error(`❌ [Notification Marked Read Fail]: ${err.message}`);
    return sendError(res, `Failed marking notification as read: ${err.message}`, 500);
  }
};

/**
 * PUT /api/notifications/read-all
 * Marks all notifications of the logged-in user as read.
 */
export const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    console.log(`🔔 [Notification Read All] Marked all unread notifications as read for User: "${userId}". Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    // Trigger update count event
    if (global.io) {
      global.io.to(`user:${userId}`).emit('unread_count_update');
    }

    return sendSuccess(res, 'All notifications marked as read.', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error(`❌ [Notification Read All Fail]: ${err.message}`);
    return sendError(res, `Failed marking all notifications as read: ${err.message}`, 500);
  }
};

/**
 * DELETE /api/notifications/:id
 * Removes a specific notification.
 */
export const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      console.warn(`⚠️ [Notification Deletion Blocked] Notification "${id}" not found or not owned by User: "${userId}"`);
      return sendError(res, 'Notification not found or access denied.', 404);
    }

    console.log(`🔔 [Notification Deleted] ID: "${id}" for User: "${userId}"`);

    // Trigger update count event
    if (global.io) {
      global.io.to(`user:${userId}`).emit('unread_count_update');
    }

    return sendSuccess(res, 'Notification removed successfully.');
  } catch (err) {
    console.error(`❌ [Notification Deletion Fail]: ${err.message}`);
    return sendError(res, `Failed deleting notification record: ${err.message}`, 500);
  }
};
