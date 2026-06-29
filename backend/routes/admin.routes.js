import { Router } from 'express';
import { 
  getMetrics, 
  getAllUsers, 
  getUserById,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  adjustBalanceByAdmin, 
  banUserByAdmin,
  getAllJobsByAdmin,
  getJobByIdByAdmin,
  updateJobByAdmin,
  deleteJobByAdmin,
  moderateJob,
  getAllBidsByAdmin,
  getAllPaymentsByAdmin,
  releasePaymentAdmin,
  getAllReportsByAdmin,
  createReportPublic,
  resolveReportByAdmin,
  getAllTicketsByAdmin,
  createTicketPublic,
  replyToTicketByAdmin,
  updateTicketStatusByAdmin,
  seedDummyPlatformData,
  getAllGigsByAdmin,
  updateGigByAdmin,
  deleteGigByAdmin,
  getAllCategoriesByAdmin,
  createCategoryByAdmin,
  updateCategoryByAdmin,
  deleteCategoryByAdmin,
  getSettings,
  saveSettings,
  getAuditLogs,
  createAuditLog,
  updateUserKyc,
  updateUserBadges,
  sendAdminEmail
} from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleCheck from '../middleware/role.middleware.js';
import { isAdminEmail } from '../auth/auth.middleware.js';

const router = Router();

// Secure session checking for ALL subroutes below
router.use(authMiddleware);

// USER & FREELANCER FACING ROUTES (Any log-in authenticated role can file)
router.post('/public-reports', createReportPublic);
router.post('/public-tickets', createTicketPublic);
router.get('/public-categories', getAllCategoriesByAdmin);

// CORE ADMIN OPERATIONAL LIMITS (Requires high privilege status and matches admin email)
router.use(isAdminEmail);

// Seeding endpoint
router.post('/seed', seedDummyPlatformData);

// Analytics
router.get('/metrics', getMetrics);

// Users CRM
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUserByAdmin);
router.put('/users/:id', updateUserByAdmin);
router.delete('/users/:id', deleteUserByAdmin);
router.post('/balance', adjustBalanceByAdmin);
router.post('/users/ban/:id', banUserByAdmin);

// Jobs board moderation CRM
router.get('/jobs', getAllJobsByAdmin);
router.get('/jobs/:id', getJobByIdByAdmin);
router.put('/jobs/:id', updateJobByAdmin);
router.delete('/jobs/:id', deleteJobByAdmin);
router.post('/moderate-job/:id', moderateJob);

// Bids oversight
router.get('/bids', getAllBidsByAdmin);

// Payments & escrow auditing
router.get('/payments', getAllPaymentsByAdmin);
router.post('/payments/release/:id', releasePaymentAdmin);

// Reports CRM
router.get('/reports', getAllReportsByAdmin);
router.post('/reports/resolve/:id', resolveReportByAdmin);

// Helpdesk ticketing
router.get('/tickets', getAllTicketsByAdmin);
router.post('/tickets/reply/:id', replyToTicketByAdmin);
router.post('/tickets/status/:id', updateTicketStatusByAdmin);

// Gigs / Services management
router.get('/gigs', getAllGigsByAdmin);
router.put('/gigs/:id', updateGigByAdmin);
router.delete('/gigs/:id', deleteGigByAdmin);

// Category management
router.get('/categories', getAllCategoriesByAdmin);
router.post('/categories', createCategoryByAdmin);
router.put('/categories/:id', updateCategoryByAdmin);
router.delete('/categories/:id', deleteCategoryByAdmin);

// System Settings
router.get('/settings', getSettings);
router.post('/settings', saveSettings);

// Audit logs
router.get('/audit-logs', getAuditLogs);
router.post('/audit-logs', createAuditLog);

// User KYC and Badges
router.put('/users/:id/kyc', updateUserKyc);
router.put('/users/:id/badges', updateUserBadges);

// Admin Broadcast Email Route
router.post('/send-email', sendAdminEmail);

export default router;
