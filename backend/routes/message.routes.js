import { Router } from 'express';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { createNotification } from '../utils/notification.helper.js';

const router = Router();

// Protect message routes using user authentication token
router.use(authMiddleware);

/**
 * POST /api/messages/send
 * Sends a direct quick message to a freelancer or buyer
 */
router.post('/send', async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  const currentUserId = req.user.id;

  // Security validation: ensure traveler of request matches auth token
  const activeSender = senderId || currentUserId;
  if (activeSender !== currentUserId) {
    return sendError(res, 'Unpermitted forgery. Cannot send message on behalf of another user.', 403);
  }

  if (!receiverId || !message || message.trim() === '') {
    return sendError(res, 'Receiver ID key and non-empty message body are essential.', 400);
  }

  try {
    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return sendError(res, 'Target receiver account not found.', 404);
    }

    // Standardize direct chatId as: direct_userId1_userId2 (sorted)
    const sorted = [activeSender, receiverId].sort();
    const chatId = `direct_${sorted[0]}_${sorted[1]}`;

    // Create secure Chat message ledger entry
    const newMsg = await Chat.create({
      chatId,
      jobId: 'direct', // Standalone direct system message
      senderId: activeSender,
      receiverId,
      sender: activeSender,
      receiver: receiverId,
      message: message.trim(),
      timestamp: new Date()
    });

    // Trigger Notification for the message recipient
    try {
      const senderUser = await User.findById(activeSender);
      const senderName = senderUser ? senderUser.name : 'A Farelanceru User';
      const senderUsername = senderUser ? senderUser.username : 'user';
      
      await createNotification(
        receiverId,
        'new_message',
        `New Message from @${senderUsername}`,
        `"${message.trim().substring(0, 60)}${message.length > 60 ? '...' : ''}"`
      );
    } catch (notifErr) {
      console.error(`[Message Notif Error]: ${notifErr.message}`);
    }

    return sendSuccess(res, 'Direct message safely routed and archived.', {
      chat: newMsg
    }, 201);
  } catch (err) {
    return sendError(res, `Failed serving secure quick chat route: ${err.message}`, 500);
  }
});

/**
 * GET /api/messages/:conversationId
 * Retrieves historical chat records for a specific conversation ID
 */
router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const currentUserId = req.user.id;

  try {
    // Basic route security: the conversation ID must contain the current user's ID
    if (!conversationId.includes(currentUserId)) {
      return sendError(res, 'Access locked. You are not a component in this direct conversation thread.', 403);
    }

    const messages = await Chat.find({ chatId: conversationId }).sort({ timestamp: 1 });
    return sendSuccess(res, 'Direct conversation logs decrypted successfully.', {
      messages
    });
  } catch (err) {
    return sendError(res, `Error fetching conversation details: ${err.message}`, 500);
  }
});

export default router;
