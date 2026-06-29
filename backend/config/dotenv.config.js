import dotenv from 'dotenv';
import path from 'path';

// Initialise dotenv configuration
dotenv.config({ path: path.join(process.cwd(), '.env') });

const config = {
  // Application settings
  appName: process.env.APP_NAME || 'Farelancer',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,

  // Database settings
  mongoURI: process.env.MONGODB_URI || '',

  // JWT settings
  jwtSecret: process.env.JWT_SECRET || 'farelancer_secret_key_2026_purple_gradient_fiverr',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'farelancer_refresh_secret_key_2026_emerald_gradient_upwork',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',

  // Facebook OAuth
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',

  // Resend Email API
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '"Farelancer" <onboarding@resend.dev>',

  // Socket.IO URLs
  socketServerUrl: process.env.SOCKET_SERVER_URL || '',
  socketClientUrl: process.env.SOCKET_CLIENT_URL || '',

  // Client URL
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Redis Url
  redisUrl: process.env.REDIS_URL || '',

  // File Storage settings
  uploadPath: process.env.UPLOAD_PATH || 'backend/data/uploads',

  // Security settings
  sessionSecret: process.env.SESSION_SECRET || 'farelancer_session_secret_2026',
  cookieSecret: process.env.COOKIE_SECRET || 'farelancer_cookie_secret_2026'
};

export default config;
