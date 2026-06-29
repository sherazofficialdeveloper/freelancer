import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Bid from '../models/Bid.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { createNotification } from '../utils/notification.helper.js';

/**
 * 1. GET /api/chat/:jobId
 * Retrieves all chat messages for a specific job space.
 * Enforces security: Only job-related users can access.
 * Automatically marks messages as read for the current user.
 */
export const getJobChatHistory = async (req, res) => {
  const { jobId } = req.params;
  const currentUserId = req.user.id;
  const userRole = req.user.role;
  const withUserId = req.query.withUserId;

  console.log(`📥 [Chat History Fetch] Job ID: "${jobId}", Current User ID: "${currentUserId}", Partner User ID: "${withUserId}"`);

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      // Compatibility fallback: if parameter is not a job but a user ID, fallback to classic user-to-user chat
      const isUserid = await User.exists({ _id: jobId });
      if (isUserid) {
        console.log(`ℹ️ [Chat History Fetch] jobId parameter "${jobId}" is a user ID. Redirecting to direct chat getChatsForUser.`);
        return getChatsForUser(req, res);
      }
      return sendError(res, 'Target job space not found.', 404);
    }

    // Role security check:
    let isAuthorized = false;
    if (userRole === 'admin') {
      isAuthorized = true;
    } else if (job.client === currentUserId) {
      isAuthorized = true;
    } else if (job.hiredFreelancer === currentUserId) {
      isAuthorized = true;
    } else {
      const hasBid = await Bid.findOne({ job: jobId, freelancer: currentUserId });
      if (hasBid) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn(`🔒 [Chat History Security Block] Unauthorized fetch attempt for Job: "${jobId}" by User: "${currentUserId}"`);
      return sendError(res, 'Security block. You are not authorized to view this job-related chat space.', 403);
    }

    // Helper for robust String / ObjectId compatibility
    let currentObjId = null;
    let withObjId = null;
    try {
      if (mongoose.Types.ObjectId.isValid(currentUserId)) {
        currentObjId = new mongoose.Types.ObjectId(currentUserId);
      }
      if (withUserId && mongoose.Types.ObjectId.isValid(withUserId)) {
        withObjId = new mongoose.Types.ObjectId(withUserId);
      }
    } catch (e) {}

    // Build conversation query
    const query = { jobId };
    if (withUserId) {
      const searchCriteria = [
        { senderId: currentUserId, receiverId: withUserId },
        { senderId: withUserId, receiverId: currentUserId },
        { sender: currentUserId, receiver: withUserId },
        { sender: withUserId, receiver: currentUserId }
      ];

      if (currentObjId && withObjId) {
        searchCriteria.push(
          { senderId: currentObjId, receiverId: withObjId },
          { senderId: withObjId, receiverId: currentObjId },
          { sender: currentObjId, receiver: withObjId },
          { sender: withObjId, receiver: currentObjId }
        );
      }

      query.$or = searchCriteria;

      // Mark matching messages as read
      const markReadCriteria = [
        { receiverId: currentUserId, senderId: withUserId },
        { receiver: currentUserId, sender: withUserId }
      ];
      if (currentObjId && withObjId) {
        markReadCriteria.push(
          { receiverId: currentObjId, senderId: withObjId },
          { receiver: currentObjId, sender: withObjId }
        );
      }

      await Chat.updateMany(
        { 
          jobId, 
          $or: markReadCriteria,
          isRead: false 
        },
        { $set: { isRead: true } }
      );
    } else {
      const searchCriteria = [
        { senderId: currentUserId },
        { receiverId: currentUserId },
        { sender: currentUserId },
        { receiver: currentUserId }
      ];
      if (currentObjId) {
        searchCriteria.push(
          { senderId: currentObjId },
          { receiverId: currentObjId },
          { sender: currentObjId },
          { receiver: currentObjId }
        );
      }
      query.$or = searchCriteria;
    }

    const messages = await Chat.find(query).sort({ timestamp: 1 });
    console.log(`📥 [Chat History Fetch] Loaded ${messages.length} messages for Job: "${jobId}"`);

    return sendSuccess(res, 'Job messages history retrieved successfully.', {
      job: {
        id: job._id,
        title: job.title,
        status: job.status,
        client: job.client,
        hiredFreelancer: job.hiredFreelancer
      },
      chats: messages
    });

  } catch (err) {
    console.error(`❌ [Chat History Fetch Error]: ${err.message}`);
    return sendError(res, `Internal server error retrieving job chat history: ${err.message}`, 500);
  }
};

/**
 * 2. POST /api/chat/message
 * Handles sending/publishing a message to a job-related chat space.
 */
export const postMessage = async (req, res) => {
  const { jobId, message, receiverId, fileUrl, fileName, fileSize } = req.body;
  const senderId = req.user.id;

  let finalMessage = message ? message.trim() : '';
  if (fileUrl && !finalMessage) {
    finalMessage = `Shared a file: ${fileName || 'Attachment'}`;
  }

  if (!jobId || (!finalMessage && !fileUrl)) {
    return sendError(res, 'Required parameters (jobId, message/file) are missing.', 400);
  }

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 'Target job space not found.', 404);
    }

    // Enforce authorization
    let isAuthorized = false;
    if (req.user.role === 'admin') {
      isAuthorized = true;
    } else if (job.client === senderId) {
      isAuthorized = true;
    } else if (job.hiredFreelancer === senderId) {
      isAuthorized = true;
    } else {
      const hasBid = await Bid.findOne({ job: jobId, freelancer: senderId });
      if (hasBid) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn(`🔒 [Security Block] Send message rejected for user "${senderId}" on Job: "${jobId}"`);
      return sendError(res, 'Security block. You are not authorized to send messages in this job space.', 403);
    }

    // Resolve details for the receiver
    let solvedReceiverId = receiverId;

    if (!solvedReceiverId) {
      if (senderId === job.client) {
        if (job.hiredFreelancer) {
          solvedReceiverId = job.hiredFreelancer;
        } else {
          const firstBid = await Bid.findOne({ job: jobId }).sort({ createdAt: -1 });
          if (firstBid) {
            solvedReceiverId = firstBid.freelancer;
          } else {
            return sendError(res, 'Receiver account could not be resolved automatically. Please specify receiverId.', 400);
          }
        }
      } else {
        solvedReceiverId = job.client;
      }
    }

    const receiverExists = await User.exists({ _id: solvedReceiverId });
    if (!receiverExists) {
      return sendError(res, 'Receiver account does not exist or has been deleted.', 404);
    }

    // Generate symmetrical chatId: sorted users
    const sorted = [senderId.toString(), solvedReceiverId.toString()].sort();
    const keyJobId = (jobId && jobId !== 'general' && jobId !== 'direct') ? jobId : 'direct';
    const chatId = `${keyJobId}_${sorted[0]}_${sorted[1]}`;

    // Log conversation detection/creation
    console.log(`💬 [Conversation Resolved/Created] ID: "${chatId}" for Job: "${jobId}"`);

    const newChat = await Chat.create({
      chatId,
      jobId,
      senderId,
      receiverId: solvedReceiverId,
      sender: senderId,
      receiver: solvedReceiverId,
      message: finalMessage,
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      fileSize: fileSize || 0,
      timestamp: new Date(),
      isRead: false
    });

    console.log(`💬 [Message Created] ID: "${newChat._id}" on Thread: "${chatId}". Content: "${message.trim()}"`);

    // Create notification
    try {
      await createNotification(
        solvedReceiverId,
        'message_received',
        'New Message Received',
        `@${req.user.username} sent you a message: "${message.trim().slice(0, 60)}${message.length > 60 ? '...' : ''}"`
      );
      console.log(`🔔 [Notification Created] Type: "message_received" for Recipient: "${solvedReceiverId}"`);
    } catch (nErr) {
      console.error(`❌ [Message Notification Fail]: ${nErr.message}`);
    }

    return sendSuccess(res, 'Message sent and stored successfully.', { chat: newChat }, 201);

  } catch (err) {
    console.error(`❌ [Post Message Fail]: ${err.message}`);
    return sendError(res, `Failed sending job message: ${err.message}`, 500);
  }
};

/**
 * 3. GET /api/chat/inbox
 * Returns a Fiverr-level structured inbox with active conversations for the current logged-in user.
 */
export const getInbox = async (req, res) => {
  const currentUserId = req.user.id;
  console.log(`📥 [Inbox Fetch] Fetching inbox threads for User: "${currentUserId}"`);

  try {
    let currentObjId = null;
    try {
      if (mongoose.Types.ObjectId.isValid(currentUserId)) {
        currentObjId = new mongoose.Types.ObjectId(currentUserId);
      }
    } catch (e) {}

    // Find queries matching either the String or ObjectId representation of currentUserId robustly
    const searchConditions = [
      { senderId: currentUserId },
      { receiverId: currentUserId },
      { sender: currentUserId },
      { receiver: currentUserId }
    ];
    if (currentObjId) {
      searchConditions.push(
        { senderId: currentObjId },
        { receiverId: currentObjId },
        { sender: currentObjId },
        { receiver: currentObjId }
      );
    }

    // 1. Fetch all message logs involving the user
    const chats = await Chat.find({
      $or: searchConditions
    }).sort({ timestamp: -1 });

    console.log(`📥 [Inbox Fetch] Found ${chats.length} total messages for User: "${currentUserId}"`);

    // 2. Group messages by symmetrical chatId
    const conversationGroups = {};

    for (const chat of chats) {
      const u1 = chat.senderId || chat.sender;
      const u2 = chat.receiverId || chat.receiver;
      if (!u1 || !u2) continue;

      const sorted = [u1.toString(), u2.toString()].sort();
      const keyJobId = (chat.jobId && chat.jobId !== 'general' && chat.jobId !== 'direct') ? chat.jobId : 'direct';
      const solvedChatId = `${keyJobId}_${sorted[0]}_${sorted[1]}`;

      if (!conversationGroups[solvedChatId]) {
        conversationGroups[solvedChatId] = {
          chatId: solvedChatId,
          jobId: chat.jobId && chat.jobId !== 'direct' ? chat.jobId : null,
          messages: [],
          latestMessage: chat
        };
      }
      conversationGroups[solvedChatId].messages.push(chat);
    }

    // 3. Hydrate details for each unique conversation thread
    const inboxList = [];

    for (const cid in conversationGroups) {
      const group = conversationGroups[cid];
      const latestMsg = group.latestMessage;
      
      const latestSender = latestMsg.senderId || latestMsg.sender;
      const latestReceiver = latestMsg.receiverId || latestMsg.receiver;
      
      if (!latestSender || !latestReceiver) {
        console.warn(`⚠️ [Inbox Fetch] Missing sender/receiver in latest chat document ID: ${latestMsg._id}`);
        continue;
      }

      // Safe String comparisons to fully bypass Object reference checks
      const otherUserId = latestSender.toString() === currentUserId.toString() 
        ? latestReceiver.toString() 
        : latestSender.toString();

      const [otherUser, job] = await Promise.all([
        User.findById(otherUserId).select('_id username name role profile status'),
        group.jobId ? Job.findById(group.jobId).select('_id title budget status') : null
      ]);

      if (!otherUser) {
        console.warn(`⚠️ [Inbox Fetch] Conversation partner User account ID "${otherUserId}" not found for Thread: "${group.chatId}". Omitting.`);
        continue;
      }

      // Calculate unread count for current user in this thread
      const unreadCount = group.messages.filter(msg => {
        const rId = msg.receiverId || msg.receiver;
        return rId && rId.toString() === currentUserId.toString() && !msg.isRead;
      }).length;

      inboxList.push({
        chatId: group.chatId,
        unreadCount,
        job: job ? {
          id: job._id,
          title: job.title,
          budget: job.budget,
          status: job.status
        } : {
          id: 'general',
          title: 'Direct Message',
          status: 'active'
        },
        otherUser: {
          id: otherUser._id,
          username: otherUser.username,
          name: otherUser.name || otherUser.username,
          role: otherUser.role,
          avatarUrl: otherUser.profile?.avatar || '',
          status: otherUser.status
        },
        lastMessage: {
          text: latestMsg.message,
          timestamp: latestMsg.timestamp || latestMsg.createdAt,
          senderId: latestSender.toString()
        }
      });
    }

    // Sort inbox list so newest interactions are at the top
    inboxList.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
    console.log(`📥 [Inbox Fetch Cache Status] Compiled ${inboxList.length} distinct threads for User: "${currentUserId}"`);

    return sendSuccess(res, 'Fiverr inbox successfully loaded.', { inbox: inboxList });

  } catch (err) {
    console.error(`❌ [Inbox Fetch Failing]: ${err.message}`);
    return sendError(res, `Failed loading secure user inbox: ${err.message}`, 500);
  }
};

/**
 * 4. POST /api/chat/send
 * Backward compatibility sending direct / custom messages
 */
export const sendMessage = async (req, res) => {
  const { receiverId, message, jobId, fileUrl, fileName, fileSize } = req.body;
  const senderId = req.user.id;

  let finalMessage = message ? message.trim() : '';
  if (fileUrl && !finalMessage) {
    finalMessage = `Shared a file: ${fileName || 'Attachment'}`;
  }

  if (!receiverId || (!finalMessage && !fileUrl)) {
    return sendError(res, 'Receiver user ID and message or file are required.', 400);
  }

  try {
    const solvedJobId = jobId || 'direct';
    const sorted = [senderId.toString(), receiverId.toString()].sort();
    const chatId = `${solvedJobId}_${sorted[0]}_${sorted[1]}`;

    console.log(`💬 [Conversation Resolved/Created - Direct] ID: "${chatId}"`);

    const chat = await Chat.create({
      chatId,
      jobId: solvedJobId,
      senderId,
      receiverId,
      sender: senderId,
      receiver: receiverId,
      message: finalMessage,
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      fileSize: fileSize || 0,
      timestamp: new Date(),
      isRead: false
    });

    console.log(`💬 [Message Created - Direct] ID: "${chat._id}" on Thread: "${chatId}". Content: "${message.trim()}"`);

    // Trigger Notification for the message recipient
    try {
      await createNotification(
        receiverId,
        'message_received',
        'New Message Received',
        `@${req.user.username} sent you a message: "${message.trim().slice(0, 60)}${message.length > 60 ? '...' : ''}"`
      );
      console.log(`🔔 [Notification Created] Type: "message_received" for Recipient: "${receiverId}"`);
    } catch (notifErr) {
      console.error(`❌ [Message Notification Error]: ${notifErr.message}`);
    }

    return sendSuccess(res, 'Message sent successfully!', { chat }, 201);
  } catch (err) {
    console.error(`❌ [Send Message Transaction Fail]: ${err.message}`);
    return sendError(res, `Failed sending chat message: ${err.message}`, 500);
  }
};

/**
 * 5. GET /api/chat/history/:withUserId
 * Retrieves historical chat records for a specific conversation ID with a partner.
 * Automatically marks retrieve messages as read.
 */
export const getChatsForUser = async (req, res) => {
  const { withUserId } = req.params;
  const currentUserId = req.user.id;

  console.log(`📥 [Get Chat History For User] User ID: "${currentUserId}" with User ID: "${withUserId}"`);

  try {
    let currentObjId = null;
    let withObjId = null;
    try {
      if (mongoose.Types.ObjectId.isValid(currentUserId)) {
        currentObjId = new mongoose.Types.ObjectId(currentUserId);
      }
      if (mongoose.Types.ObjectId.isValid(withUserId)) {
        withObjId = new mongoose.Types.ObjectId(withUserId);
      }
    } catch (e) {}

    // Automatically mark direct chats as read
    const markReadCriteria = [
      { receiverId: currentUserId, senderId: withUserId },
      { receiver: currentUserId, sender: withUserId }
    ];
    if (currentObjId && withObjId) {
      markReadCriteria.push(
        { receiverId: currentObjId, senderId: withObjId },
        { receiver: currentObjId, sender: withObjId }
      );
    }

    await Chat.updateMany(
      { 
        jobId: { $in: [null, 'general', 'direct'] }, 
        $or: markReadCriteria,
        isRead: false 
      },
      { $set: { isRead: true } }
    );

    const searchConditions = [
      { senderId: currentUserId, receiverId: withUserId },
      { senderId: withUserId, receiverId: currentUserId },
      { sender: currentUserId, receiver: withUserId },
      { sender: withUserId, receiver: currentUserId }
    ];
    if (currentObjId && withObjId) {
      searchConditions.push(
        { senderId: currentObjId, receiverId: withObjId },
        { senderId: withObjId, receiverId: currentObjId },
        { sender: currentObjId, receiver: withObjId },
        { sender: withObjId, receiver: currentObjId }
      );
    }

    const chatHistory = await Chat.find({
      $or: searchConditions
    }).sort({ timestamp: 1 });

    console.log(`📥 [Get Chat History For User] Loaded ${chatHistory.length} chats for User "${currentUserId}" with "${withUserId}"`);
    return sendSuccess(res, 'Chat history loaded.', { chats: chatHistory });
  } catch (err) {
    console.error(`❌ [Get Chat History For User Failed]: ${err.message}`);
    return sendError(res, `Failed retrieving chat logs: ${err.message}`, 500);
  }
};

/**
 * 6. GET /api/chat/contacts
 * Returns list of active chatter contacts
 */
export const getActiveChats = async (req, res) => {
  const currentUserId = req.user.id;
  console.log(`📥 [Get Active Chats] Initiated for User: "${currentUserId}"`);
  try {
    let currentObjId = null;
    try {
      if (mongoose.Types.ObjectId.isValid(currentUserId)) {
        currentObjId = new mongoose.Types.ObjectId(currentUserId);
      }
    } catch (e) {}

    const searchConditions = [
      { senderId: currentUserId },
      { receiverId: currentUserId },
      { sender: currentUserId },
      { receiver: currentUserId }
    ];
    if (currentObjId) {
      searchConditions.push(
        { senderId: currentObjId },
        { receiverId: currentObjId },
        { sender: currentObjId },
        { receiver: currentObjId }
      );
    }

    const chats = await Chat.find({
      $or: searchConditions
    });

    const chatterIds = new Set();
    chats.forEach(chat => {
      const s = chat.senderId || chat.sender;
      const r = chat.receiverId || chat.receiver;
      if (s && s.toString() !== currentUserId.toString()) chatterIds.add(s.toString());
      if (r && r.toString() !== currentUserId.toString()) chatterIds.add(r.toString());
    });

    const activeChatters = [];
    for (const uid of chatterIds) {
      if (uid === 'direct') continue;
      const u = await User.findById(uid);
      if (u) {
        const uCopy = u.toObject ? u.toObject() : { ...u };
        delete uCopy.password;
        activeChatters.push(uCopy);
      }
    }

    console.log(`📥 [Get Active Chats] Found ${activeChatters.length} active contacts.`);
    return sendSuccess(res, 'Active chatter contacts compiled.', { contacts: activeChatters });
  } catch (err) {
    console.error(`❌ [Get Active Chats Failed]: ${err.message}`);
    return sendError(res, `Failed compiling chat threads: ${err.message}`, 500);
  }
};

export default {
  getJobChatHistory,
  postMessage,
  getInbox,
  sendMessage,
  getChatsForUser,
  getActiveChats
};
