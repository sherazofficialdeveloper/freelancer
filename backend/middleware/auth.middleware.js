import { verifyToken } from '../auth/auth.middleware.js';

export const authMiddleware = verifyToken;
export default authMiddleware;
