import { authorizeRoles } from '../auth/auth.middleware.js';

export const roleCheck = authorizeRoles;
export default roleCheck;
