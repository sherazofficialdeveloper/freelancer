import { sendError } from '../utils/response.js';

export const csrfProtection = (req, res, next) => {
  // Safe methods do not require CSRF verification
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Bypass CSRF checks in non-production environments to ensure seamless sandbox/preview experiences
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host || '';

  // Allowed domain checks
  const appUrl = process.env.APP_URL || '';

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostName = host.split(':')[0];
      const originHostName = originUrl.hostname;

      // Allow known studio and cloud run preview domains
      const isStudioDomain = originHostName.endsWith('.studioservices.google') || 
                            originHostName.endsWith('.studioservices.dev') || 
                            originHostName.endsWith('.run.app') ||
                            originHostName === 'localhost' ||
                            originHostName === '127.0.0.1';

      if (originHostName !== hostName && !isStudioDomain && (!appUrl || !appUrl.includes(originUrl.hostname))) {
        return sendError(res, 'CSRF Security Violation: Access rejected from untrusted origin.', 403);
      }
    } catch (e) {
      // Gracefully continue if URL parsing fails
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      const hostName = host.split(':')[0];
      const refererHostName = refererUrl.hostname;

      // Allow known studio and cloud run preview domains
      const isStudioDomain = refererHostName.endsWith('.studioservices.google') || 
                            refererHostName.endsWith('.studioservices.dev') || 
                            refererHostName.endsWith('.run.app') ||
                            refererHostName === 'localhost' ||
                            refererHostName === '127.0.0.1';

      if (refererHostName !== hostName && !isStudioDomain && (!appUrl || !appUrl.includes(refererUrl.hostname))) {
        return sendError(res, 'CSRF Security Violation: Access rejected from untrusted referer.', 403);
      }
    } catch (e) {
      // Gracefully continue if URL parsing fails
    }
  }

  next();
};

export default csrfProtection;
