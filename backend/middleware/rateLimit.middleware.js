import { sendError } from '../utils/response.js';

const rateLimitStore = {};

export const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60000; // 1 minute window
  const max = options.max || 60; // 60 requests per minute by default
  const message = options.message || 'Too many requests, please try again later.';

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = [];
    }

    // Filter out requests older than the window
    rateLimitStore[ip] = rateLimitStore[ip].filter(timestamp => now - timestamp < windowMs);

    if (rateLimitStore[ip].length >= max) {
      return sendError(res, message, 429);
    }

    rateLimitStore[ip].push(now);
    next();
  };
};

export default rateLimiter;
