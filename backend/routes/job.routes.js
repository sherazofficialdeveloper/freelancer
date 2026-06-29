import { Router } from 'express';
import { createJob, getJobs, getJobById, submitWork, approveWorkAndRelease, getMyJobs, updateJob, deleteJob } from '../controllers/job.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleCheck from '../middleware/role.middleware.js';

const router = Router();

// Publicly browse active jobs
router.get('/', getJobs);
router.get('/info/:id', getJobById);

// Protected routes
router.post('/post', authMiddleware, roleCheck(['buyer']), createJob);
router.put('/:id', authMiddleware, updateJob);
router.delete('/:id', authMiddleware, deleteJob);
router.get('/my-jobs', authMiddleware, getMyJobs);
router.post('/submit/:id', authMiddleware, roleCheck(['freelancer']), submitWork);
router.post('/approve/:id', authMiddleware, roleCheck(['buyer']), approveWorkAndRelease);

export default router;
