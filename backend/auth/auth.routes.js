import { Router } from 'express';
import { 
  register, 
  login, 
  verifyEmail,
  resendVerificationOtp,
  getMe, 
  logout, 
  getProfile, 
  updateProfile, 
  getFreelancers, 
  getUserById,
  forgotPassword,
  verifyOtp,
  resetPassword,
  toggleSaveJob,
  toggleSaveFreelancer,
  addPortfolioItem,
  deletePortfolioItem,
  addReview,
  getGoogleAuthUrl,
  handleGoogleCallback,
  getFacebookAuthUrl,
  handleFacebookCallback,
  enable2FA,
  verify2FASetup,
  disable2FA,
  verify2FALogin,
  submitKyc,
  refreshUserSession
} from './auth.controller.js';
import { verifyToken } from './auth.middleware.js';

const router = Router();

// ========================
// PUBLIC ROUTES
// ========================
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationOtp);
router.post('/refresh', refreshUserSession);
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.get('/facebook/url', getFacebookAuthUrl);
router.get('/facebook/callback', handleFacebookCallback);
router.get('/freelancers', getFreelancers);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// ========================
// PROTECTED ROUTES
// ========================
router.get('/me', verifyToken, getMe);
router.get('/user/:id', verifyToken, getUserById);
router.post('/logout', verifyToken, logout);

// Compatibility fallback endpoints (original design matching)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.post('/kyc', verifyToken, submitKyc);

// Core SaaS extensions
router.post('/save-job', verifyToken, toggleSaveJob);
router.post('/save-freelancer', verifyToken, toggleSaveFreelancer);
router.post('/portfolio', verifyToken, addPortfolioItem);
router.delete('/portfolio/:id', verifyToken, deletePortfolioItem);
router.post('/review', verifyToken, addReview);

export default router;
