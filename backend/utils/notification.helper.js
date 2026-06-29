import Notification from '../models/Notification.js';

/**
 * Creates a notification in the database and broadcasts it over Socket.io if the user is online.
 * 
 * @param {string} userId - Target recipient User ID
 * @param {string} type - Notification class ('job_posted', 'bid_received', etc.)
 * @param {string} title - Heading/Category line
 * @param {string} message - Description message
 * @returns {Promise<Object|null>} - Created database notification or null
 */
export const createNotification = async (userId, type, title, message) => {
  try {
    if (!userId) return null;
    
    const notification = await Notification.create({
      userId: userId.toString(),
      type,
      title,
      message
    });

    // Check if global websocket server is available
    if (global.io) {
      global.io.to(`user:${userId}`).emit('new_notification', {
        _id: notification._id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt
      });
      // Also emit a general notification update count event
      global.io.to(`user:${userId}`).emit('unread_count_update');
    }

    return notification;
  } catch (err) {
    console.error(`[Notification Helper Error]: Failed initiating notification schema: ${err.message}`);
    return null;
  }
};
