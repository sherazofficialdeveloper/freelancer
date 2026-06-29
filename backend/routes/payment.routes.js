import { Router } from 'express';
import { 
  getWallet, 
  createMockPayment, 
  releaseMockPayment, 
  getMyTransactions, 
  adminUpdateTransaction,
  depositMockFunds,
  withdrawMockFunds
} from '../controllers/payment.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Guard all payment metrics with default auth
router.use(authMiddleware);

router.get('/wallet', getWallet);
router.post('/create', createMockPayment);
router.post('/release', releaseMockPayment);
router.get('/transactions', getMyTransactions);
router.post('/deposit', depositMockFunds);
router.post('/withdraw', withdrawMockFunds);

// Admin exclusive manually override status
router.post('/admin/update-status', adminUpdateTransaction);

export default router;
