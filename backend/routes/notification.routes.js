import { Router } from 'express';
import {
  getNotifications,
  createNotificationApi,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notification.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Secure all endpoints with session JWT gate
router.use(authMiddleware);

router.get('/', getNotifications);
router.post('/create', createNotificationApi);
router.put('/read-all', markAllAsRead);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
