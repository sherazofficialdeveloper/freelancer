import { Router } from 'express';
import { 
  getJobChatHistory, 
  postMessage, 
  getInbox, 
  sendMessage, 
  getChatsForUser, 
  getActiveChats 
} from '../controllers/chat.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// ==========================================
// TARGET REQUIRED ENDPOINTS
// ==========================================
router.get('/inbox', getInbox);
router.post('/message', postMessage);
router.get('/:jobId', getJobChatHistory);

// ==========================================
// COMPATIBILITY ENDPOINTS (Backward support)
// ==========================================
router.post('/send', sendMessage);
router.get('/history/:withUserId', getChatsForUser);
router.get('/contacts', getActiveChats);

export default router;
