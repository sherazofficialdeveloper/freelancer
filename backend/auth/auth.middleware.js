import jwt from 'jsonwebtoken';
import config from '../config/dotenv.config.js';

/**
 * JWT Verification Middleware - Guarantees identity validation
 */
export const verifyToken = (req, res, next) => {
  let token = null;

  // 1. Try Authorization header (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // 2. Fallback to cookies for traditional form navigation post-authentications
  else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const parts = c.trim().split('=');
      if (parts[0]) acc[parts[0]] = parts[1];
      return acc;
    }, {});
    token = cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Secure session token is missing.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // Attaches properties: id, name, username, email, role
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Secure session token is invalid or expired.'
    });
  }
};

/**
 * Role-Based Access Control Middleware - Prevents unauthorized access
 */
export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Authentication credentials missing.'
      });
    }

    // Dynamic Admin Email Safeguard Enforcement
    const isAdminChecked = allowedRoles.includes('admin');
    const isOwnerAdminEmail = req.user.email && (
      req.user.email.trim().toLowerCase() === 'maqboolusama9@gmail.com' || 
      req.user.email.trim().toLowerCase() === 'usamamaqboolassiii@gmail.com' ||
      req.user.role === 'admin'
    );

    if (isAdminChecked) {
      if (isOwnerAdminEmail) {
        req.user.role = 'admin'; // Override role dynamically just to be safe
        return next();
      } else {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. High clearance administrator keys required.'
        });
      }
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(401).json({
        success: false,
        message: `Unauthorized. Restricted area. Required role: [${allowedRoles.join(' or ')}] but found [${req.user.role}].`
      });
    }

    next();
  };
};

/**
 * Strict single-admin email verify middleware
 */
export const isAdminEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Authentication credentials missing.'
    });
  }
  const email = req.user.email ? req.user.email.trim().toLowerCase() : '';
  const isAllowedAdmin = email === 'maqboolusama9@gmail.com' || email === 'usamamaqboolassiii@gmail.com' || req.user.role === 'admin';
  if (!isAllowedAdmin) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  req.user.role = 'admin'; // Override role dynamically just to be safe
  next();
};

export default {
  verifyToken,
  authorizeRoles,
  isAdminEmail
};
