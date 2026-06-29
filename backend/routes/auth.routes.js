import { Router } from 'express';
import { register, login, getProfile, updateProfile, getFreelancers, submitKyc } from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/freelancers', getFreelancers);

// Protected routes (requires valid login)
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/kyc', authMiddleware, submitKyc);

export default router;
