import { Router } from 'express';
import { placeBid, getBidsForJob, getMyBids, acceptBid } from '../controllers/bid.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleCheck from '../middleware/role.middleware.js';

const router = Router();

router.use(authMiddleware);

// Freelancers place bids
router.post('/place', roleCheck(['freelancer']), placeBid);
router.get('/my-bids', roleCheck(['freelancer']), getMyBids);

// Buyers accept proposals
router.get('/job/:jobId', getBidsForJob);
router.post('/accept/:bidId', roleCheck(['buyer']), acceptBid);

export default router;
