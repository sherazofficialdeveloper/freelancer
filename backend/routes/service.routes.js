import { Router } from 'express';
import { createService, getServices, getServiceById, updateService, deleteService, buyService } from '../controllers/service.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleCheck from '../middleware/role.middleware.js';

const router = Router();

// Public routes
router.get('/', getServices);
router.get('/:id', getServiceById);

// Protected routes
router.post('/', authMiddleware, roleCheck(['freelancer']), createService);
router.put('/:id', authMiddleware, updateService);
router.delete('/:id', authMiddleware, deleteService);
router.post('/buy/:id', authMiddleware, roleCheck(['buyer']), buyService);

export default router;
