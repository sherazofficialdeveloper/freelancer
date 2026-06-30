import authService from './auth.service.js';
import User from '../models/User.js';
import config from '../config/dotenv.config.js';
import { sendSuccess, sendError } from '../utils/response.js';
import bcrypt from 'bcryptjs';
import { 
  getMailerTransporter, 
  sendVerificationEmail, 
  sendWelcomeEmail, 
  sendForgotPasswordEmail, 
  sendPasswordChangedEmail, 
  sendLoginAlertEmail, 
  sendAdminBroadcastEmail 
} from '../utils/mailer.js';
import jwt from 'jsonwebtoken';
import { generateBase32Secret, verifyTOTP } from '../utils/totp.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  const { firstName, lastName, name, email, password, confirmPassword, role } = req.body;

  // Validate required fields
  const finalFirstName = firstName || '';
  const finalLastName = lastName || '';
  
  if (!email || !password || !role) {
    return sendError(res, 'Required fields (email, password, role) are missing.', 400);
  }

  if (password !== confirmPassword) {
    return sendError(res, 'Password and confirmation password do not match.', 400);
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendError(res, 'Invalid email address structure format provided.', 400);
  }

  // Password strength validation: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return sendError(res, 'Password strength verification failed. Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. @$!%*?&).', 400);
  }

  // Role whitelist validation
  if (!['buyer', 'freelancer', 'admin'].includes(role)) {
    return sendError(res, 'Invalid user role selected.', 400);
  }

  try {
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return sendError(res, 'Registration failed. This email is already registered.', 400);
    }

    // Heralds custom username seed
    const fullName = name || `${finalFirstName} ${finalLastName}`.trim() || email.split('@')[0];
    const usernameSeed = req.body.username || fullName || email.split('@')[0];
    const username = usernameSeed.trim().toLowerCase().replace(/\s+/g, '_');

    // Double check unique username
    const existingUsername = await User.findOne({ username });
    let finalUsername = username;
    if (existingUsername) {
      finalUsername = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Generate 6-digit random verification OTP code
    const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationOtpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // Create the brand new user (starts as unverified!)
    const newUser = await authService.createUser({
      name: fullName,
      username: finalUsername,
      email,
      password,
      role,
      isEmailVerified: false, // Must verify first
      verificationOtp,
      verificationOtpExpires,
      status: 'pending' // Pending email verification
    });

    // Send high-fidelity Resend OTP & verify link email
    await sendVerificationEmail(email, fullName, verificationOtp);

    return sendSuccess(res, 'Registration details submitted successfully! A security verification OTP and direct confirmation link have been sent to your email.', {
      email: newUser.email,
      username: newUser.username,
      isEmailVerified: false,
      status: 'pending'
    }, 201);

  } catch (err) {
    console.error('❌ [Register Error]:', err);
    return sendError(res, `Signup server exception: ${err.message}`, 500);
  }
};

/**
 * Verify a user's email address with OTP
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return sendError(res, 'Email address and 6-digit OTP code are required for verification.', 400);
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendError(res, 'Account lookup failed. User not found.', 404);
    }

    if (user.isEmailVerified) {
      return sendError(res, 'This account is already verified. You can log in directly.', 400);
    }

    // Validate OTP and expiration
    if (!user.verificationOtp || user.verificationOtp !== otp.trim()) {
      return sendError(res, 'Invalid verification code. Please check your OTP and try again.', 400);
    }

    if (!user.verificationOtpExpires || user.verificationOtpExpires < new Date()) {
      return sendError(res, 'Verification code has expired. Please request a new OTP code.', 400);
    }

    // Verify and activate account
    user.isEmailVerified = true;
    user.status = 'active';
    user.verificationOtp = '';
    user.verificationOtpExpires = null;
    await user.save();

    // Send Welcome Email instantly
    await sendWelcomeEmail(user.email, user.name, user.username, user.role);

    // Generate JWT Session instantly
    const token = authService.generateToken(user);

    // Save token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';

    return sendSuccess(res, 'Email verified and account activated successfully!', {
      token,
      user: userObj,
      redirectUrl
    }, 200);

  } catch (err) {
    console.error('❌ [Verify Email Error]:', err);
    return sendError(res, `Email verification transaction failed: ${err.message}`, 500);
  }
};

/**
 * Resend Email Verification OTP
 * POST /api/auth/resend-verification
 */
export const resendVerificationOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 'Email address is required to resend verification OTP.', 400);
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendError(res, 'Account lookup failed. User not found.', 404);
    }

    if (user.isEmailVerified) {
      return sendError(res, 'This account is already verified. You can log in directly.', 400);
    }

    // Rate limiting: 1 minute check
    if (user.lastOtpRequestedAt && (Date.now() - new Date(user.lastOtpRequestedAt).getTime() < 60000)) {
      const secondsLeft = Math.ceil((60000 - (Date.now() - new Date(user.lastOtpRequestedAt).getTime())) / 1000);
      return sendError(res, `Please wait ${secondsLeft} seconds before requesting another verification code.`, 429);
    }

    // Regenerate OTP
    const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationOtpExpires = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationOtp = verificationOtp;
    user.verificationOtpExpires = verificationOtpExpires;
    user.lastOtpRequestedAt = new Date();
    await user.save();

    // Send Verification Email
    await sendVerificationEmail(user.email, user.name, verificationOtp);

    return sendSuccess(res, 'A new verification OTP code and direct link have been sent to your email inbox.', { email: user.email }, 200);

  } catch (err) {
    console.error('❌ [Resend OTP Error]:', err);
    return sendError(res, `Resending verification OTP failed: ${err.message}`, 500);
  }
};

/**
 * Login an existing user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password credentials are required.', 400);
  }

  try {
    const user = await authService.findUserByEmail(email);
    if (!user) {
      return sendError(res, 'Authentication failed. Invalid email or password credentials.', 401);
    }

    if (user.status === 'banned') {
      return sendError(res, 'Account disabled. Access blocked by administrator moderation.', 403);
    }

    // Brute Force Lockout check
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingTime = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000);
      return sendError(res, `This account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingTime} minutes.`, 423);
    }

    // Setup helper variables for detection
    const userAgent = req.headers['user-agent'] || '';
    let browser = 'Unknown Browser';
    let device = 'Desktop';

    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge';
    } else if (userAgent.includes('Opera')) {
      browser = 'Opera';
    }

    if (userAgent.includes('Mobi') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      device = 'Mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      device = 'Tablet';
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';

    const passwordsMatch = await authService.comparePassword(password, user.password);
    if (!passwordsMatch) {
      // Log failed login
      user.loginHistory.push({
        ipAddress,
        browser,
        device,
        loginTime: new Date(),
        status: 'failed'
      });
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Locked for 15 minutes
        await user.save();
        return sendError(res, 'Authentication failed. Your account has been temporarily locked for 15 minutes due to 5 consecutive failed attempts.', 423);
      }
      
      await user.save();
      return sendError(res, `Authentication failed. Invalid email or password credentials. Attempt ${user.failedLoginAttempts}/5`, 401);
    }

    // Email verification check
    if (!user.isEmailVerified) {
      return sendError(res, 'Email address has not been verified yet. Please complete your email verification.', 403, { requireVerification: true, email: user.email });
    }

    // Successful login - Reset brute force counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    user.loginHistory.push({
      ipAddress,
      browser,
      device,
      loginTime: new Date(),
      status: 'success'
    });
    await user.save();

    // Send security Login Alert Email
    try {
      await sendLoginAlertEmail(user.email, user.name, browser, device, ipAddress, user.lastLogin);
    } catch (err) {
      console.error('❌ Failed to dispatch Login Alert Email:', err.message);
    }

    // Check if 2FA is enabled for user
    if (user.twoFactorEnabled) {
      const tempToken = authService.generateTemp2faToken(user);
      return sendSuccess(res, 'Two-factor authentication is required to complete sign-in.', {
        require2FA: true,
        tempToken
      }, 200);
    }

    // Generate JWT
    const token = authService.generateToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    // Based on role redirect
    const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';

    return sendSuccess(res, 'Log in verified. Welcome back!', {
      token,
      user: userObj,
      redirectUrl
    }, 200);

  } catch (err) {
    return sendError(res, `Authentication process error: ${err.message}`, 500);
  }
};

/**
 * Fetch current logon user state
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) {
      return sendError(res, 'Query failed. Current user context is not found.', 404);
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'User session data resolved successfully.', { user: userObj });
  } catch (err) {
    return sendError(res, `Get user metadata failure: ${err.message}`, 500);
  }
};

/**
 * Clear user session cookies and logout
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    res.clearCookie('token');
    return sendSuccess(res, 'Successfully logged out user session.', {});
  } catch (err) {
    return sendError(res, `Logout process failure: ${err.message}`, 500);
  }
};

/**
 * Original getProfile compatibility interface
 * GET /api/auth/profile
 */
export const getProfile = getMe;

/**
 * Original updateProfile compatibility interface
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res) => {
  const { name, title, bio, skills, hourlyRate, avatar } = req.body;

  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) {
      return sendError(res, 'Target user profile is unavailable.', 404);
    }

    if (name) {
      user.name = name.trim();
    }

    const currentProfile = user.profile || {};
    const updatedProfile = {
      title: title !== undefined ? title : currentProfile.title,
      bio: bio !== undefined ? bio : currentProfile.bio,
      skills: skills !== undefined ? (Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim())) : currentProfile.skills,
      hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : currentProfile.hourlyRate,
      avatar: avatar !== undefined ? avatar : currentProfile.avatar
    };

    user.profile = updatedProfile;
    await user.save();

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'User profile configured and updated successfully.', { user: userObj });
  } catch (err) {
    return sendError(res, `Profile configuration failure: ${err.message}`, 500);
  }
};

/**
 * Fetch generic basic user details by ID for chats/bids
 * GET /api/auth/user/:id
 */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('_id username name role profile status');
    if (!user) {
      return sendError(res, 'Target credentials not found.', 404);
    }
    return sendSuccess(res, 'User identity resolved.', { user });
  } catch (err) {
    return sendError(res, `Failed resolving user metadata: ${err.message}`, 500);
  }
};

/**
 * Original getFreelancers compatibility info
 * GET /api/auth/freelancers
 */
export const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer', status: 'active' });
    const sanitized = freelancers.map(f => {
      const copy = f.toObject ? f.toObject() : { ...f };
      delete copy.password;
      return copy;
    });
    return sendSuccess(res, 'Freelancer data successfully compiled.', { freelancers: sanitized });
  } catch (err) {
    return sendError(res, `Failed loading catalog: ${err.message}`, 500);
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return sendError(res, 'Email query field is required.', 400);
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.warn(`[Forgot Password OTP] User lookup failed. No account found for email: "${normalizedEmail}"`);
      return sendError(res, 'No account found with this email address.', 404);
    }

    console.log(`[Forgot Password OTP] User found for email: "${normalizedEmail}". ID: ${user._id}`);

    // Rate Limit Security: enforce 60 seconds throttle
    if (user.lastOtpRequestedAt && (Date.now() - new Date(user.lastOtpRequestedAt).getTime() < 60000)) {
      const secondsLeft = Math.ceil((60000 - (Date.now() - new Date(user.lastOtpRequestedAt).getTime())) / 1000);
      console.warn(`[Forgot Password OTP] Rate limited for email: "${normalizedEmail}". Needs ${secondsLeft}s more.`);
      return sendError(res, `Rate limit. Please wait ${secondsLeft} seconds before requesting a new OTP verification code.`, 429);
    }

    // Generate secure 6-digit pin
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = pin;
    user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // Strict 10-minutes expiry as requested
    user.lastOtpRequestedAt = new Date();
    await user.save();

    console.log(`🔑 [Password Reset OTP for ${normalizedEmail}] OTP generated: ${pin}`);

    // Send via Resend Mailer
    await sendForgotPasswordEmail(normalizedEmail, user.name, pin);

    return sendSuccess(res, 'Secure verification code (OTP) sent to your registered email address.', {
      message: 'OTP has been dispatched. Please check your inbox (and spam folder) or developer logs!',
      testPin: pin // Retain for testing convenience
    }, 200);

  } catch (err) {
    console.error(`❌ [Password Reset OTP] Error in forgotPassword route: ${err.message}`);
    return sendError(res, `Failed initiating forgot password request: ${err.message}`, 500);
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return sendError(res, 'Both email address and 6-digit verification OTP code are required.', 400);
  }
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[OTP Verification] Initiated for: "${normalizedEmail}" with code: "${otp}"`);
  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.warn(`[OTP Verification] User not found for email: "${normalizedEmail}"`);
      return sendError(res, 'No account found with this email address.', 404);
    }

    if (!user.resetCode || user.resetCode !== otp.trim()) {
      console.warn(`[OTP Verification] Invalid OTP for email: "${normalizedEmail}". Expected: "${user.resetCode}", Got: "${otp}"`);
      return sendError(res, 'Invalid 6-digit verification code. Please check and try again.', 400);
    }

    if (user.resetCodeExpires < new Date()) {
      console.warn(`[OTP Verification] Expired OTP for email: "${normalizedEmail}". Expiry: ${user.resetCodeExpires}`);
      return sendError(res, 'Verification code has expired. Please request a new OTP.', 400);
    }

    console.log(`✨ [OTP Verification] Successfully verified OTP for email: "${normalizedEmail}"`);
    return sendSuccess(res, 'OTP verified successfully. You may now reset your password.', { email: normalizedEmail, tempCode: otp }, 200);
  } catch (err) {
    console.error(`❌ [OTP Verification] Error in verifyOtp: ${err.message}`);
    return sendError(res, `Verifying OTP transaction failed: ${err.message}`, 500);
  }
};

export const resetPassword = async (req, res) => {
  const { email, resetCode, newPassword } = req.body;
  if (!email || !resetCode || !newPassword) {
    return sendError(res, 'Email, verified OTP code, and new password are required.', 400);
  }
  if (newPassword.length < 8) {
    return sendError(res, 'New password must contain at least 8 characters.', 400);
  }
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[Reset Password] Initiated for: "${normalizedEmail}"`);
  try {
    const user = await User.findOne({ 
      email: normalizedEmail,
      resetCode,
      resetCodeExpires: { $gt: new Date() }
    });
    if (!user) {
      console.warn(`[Reset Password] Lookup failed. Invalid/expired OTP or email: "${normalizedEmail}"`);
      return sendError(res, 'Invalid, expired, or non-matching password reset credentials / OTP.', 400);
    }

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Save password and clear reset tracking to prevent double use
    user.password = hashedPassword;
    user.resetCode = '';
    user.resetCodeExpires = null;
    await user.save();

    console.log(`✨ [Reset Password] Successfully updated password for user: "${normalizedEmail}"`);
    
    // Send Password Changed confirmation email
    await sendPasswordChangedEmail(user.email, user.name);

    return sendSuccess(res, 'Your secure password was updated successfully. Welcome back!', {}, 200);
  } catch (err) {
    console.error(`❌ [Reset Password] Error in resetPassword: ${err.message}`);
    return sendError(res, `Reset password process failed: ${err.message}`, 500);
  }
};

export const toggleSaveJob = async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return sendError(res, 'jobId is required', 400);
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User session not found', 404);

    const savedJobs = user.savedJobs || [];
    const index = savedJobs.map(item => item.type).indexOf(jobId);
    let action = 'saved';
    if (index > -1) {
      savedJobs.splice(index, 1);
      action = 'unsaved';
    } else {
      savedJobs.push({ type: jobId });
    }
    user.savedJobs = savedJobs;
    await user.save();
    return sendSuccess(res, `Job successfully ${action}!`, { savedJobs, action });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const toggleSaveFreelancer = async (req, res) => {
  const { freelancerId } = req.body;
  if (!freelancerId) return sendError(res, 'freelancerId is required', 400);
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User session not found', 404);

    const savedFreelancers = user.savedFreelancers || [];
    const index = savedFreelancers.map(item => item.type).indexOf(freelancerId);
    let action = 'saved';
    if (index > -1) {
      savedFreelancers.splice(index, 1);
      action = 'unsaved';
    } else {
      savedFreelancers.push({ type: freelancerId });
    }
    user.savedFreelancers = savedFreelancers;
    await user.save();
    return sendSuccess(res, `Freelancer successfully ${action}!`, { savedFreelancers, action });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const addPortfolioItem = async (req, res) => {
  const { title, description, projectUrl, imageUrl } = req.body;
  if (!title) return sendError(res, 'Portfolio title is required', 400);
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User session not found', 404);

    user.portfolio = user.portfolio || [];
    user.portfolio.push({ title, description, projectUrl, imageUrl });
    await user.save();
    
    return sendSuccess(res, 'Portfolio project registered successfully!', { portfolio: user.portfolio });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deletePortfolioItem = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User session not found', 404);

    user.portfolio = (user.portfolio || []).filter(p => p._id.toString() !== id);
    await user.save();
    return sendSuccess(res, 'Portfolio project cleared from profile.', { portfolio: user.portfolio });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const addReview = async (req, res) => {
  const { userId, rating, comment, jobTitle } = req.body;
  if (!userId || !rating) return sendError(res, 'userId and rating score are required', 400);
  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) return sendError(res, 'Target user not found', 404);

    targetUser.reviews = targetUser.reviews || [];
    targetUser.reviews.push({
      reviewerId: req.user.id,
      reviewerName: req.user.username,
      reviewerRole: req.user.role,
      rating: Number(rating),
      comment: comment || '',
      jobTitle: jobTitle || 'Direct Marketplace Gigs'
    });

    // Update aggregate rating average
    const totalRating = targetUser.reviews.reduce((acc, curr) => acc + curr.rating, 0);
    targetUser.rating = Number((totalRating / targetUser.reviews.length).toFixed(1));
    await targetUser.save();

    return sendSuccess(res, 'Milestone feedback rating successfully recorded!', { rating: targetUser.rating, reviews: targetUser.reviews });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Generate Google OAuth authorize URL
 * GET /api/auth/google/url
 */
export const getGoogleAuthUrl = async (req, res) => {
  const redirectUri = `${process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'}`;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return sendError(res, 'Google OAuth Client ID is not configured on the server. Please define GOOGLE_CLIENT_ID in your environment variables.', 500);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  return sendSuccess(res, 'Google OAuth URL generated.', { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
};

/**
 * Handle Google OAuth Redirect callback
 * GET /api/auth/google/callback
 */
export const handleGoogleCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return sendError(res, 'Authentication code from Google is missing.', 400);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return sendError(res, 'Google OAuth credentials are not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 500);
  }

  try {
    let email, name, role, avatar;
    // Real production OAuth flow
    const redirectUri = `${process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'}`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed exchanging auth code for google access token.');
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();
    email = userData.email;
    name = userData.name || userData.given_name || email.split('@')[0];
    avatar = userData.picture;
    role = 'freelancer'; // Default to freelancer for real logins

    // Find or create the user in database
    let user = await User.findOne({ email });
    if (!user) {
      const usernameSeed = email.split('@')[0];
      const username = usernameSeed.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const existingUsername = await User.findOne({ username });
      let finalUsername = username;
      if (existingUsername) {
        finalUsername = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await User.create({
        name,
        username: finalUsername,
        email,
        password: bcrypt.hashSync(Math.random().toString(36).substring(2, 11), 10),
        role: role || 'freelancer',
        isVerified: true
      });
    }

    const token = authService.generateToken(user);
    
    // Save token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    // Send postMessage and script response exactly as outlined in our oauth-integration skill guide!
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Authentication Success</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h3>Google Authentication Successful!</h3>
          <p>Please wait, establishing your workspace credentials...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                token: '${token}',
                user: ${JSON.stringify(userObj)}
              }, '*');
              window.close();
            } else {
              localStorage.setItem('token', '${token}');
              localStorage.setItem('user', JSON.stringify(${JSON.stringify(userObj)}));
              window.location.href = '/dashboard';
            }
          </script>
        </body>
      </html>
    `);

  } catch (err) {
    return sendError(res, `Google OAuth complete error: ${err.message}`, 500);
  }
};

/**
 * Generate Facebook OAuth authorize URL
 * GET /api/auth/facebook/url
 */
export const getFacebookAuthUrl = async (req, res) => {
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/facebook/callback`;
  const appId = process.env.FACEBOOK_APP_ID;

  if (!appId) {
    return sendError(res, 'Facebook App ID is not configured on the server. Please define FACEBOOK_APP_ID in your environment variables.', 500);
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile'
  });
  return sendSuccess(res, 'Facebook OAuth URL generated.', { url: `https://www.facebook.com/v12.0/dialog/oauth?${params}` });
};

/**
 * Handle Facebook OAuth Redirect callback
 * GET /api/auth/facebook/callback
 */
export const handleFacebookCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return sendError(res, 'Authentication code from Facebook is missing.', 400);

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return sendError(res, 'Facebook OAuth credentials are not configured on the server. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.', 500);
  }

  try {
    let email, name, role, avatar;
    // Real Facebook OAuth flow
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/facebook/callback`;
    const tokenResponse = await fetch('https://graph.facebook.com/v12.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed exchanging auth code for facebook access token.');
    }

    const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`);
    const userData = await userResponse.json();
    email = userData.email || `${userData.id}@facebook.com`;
    name = userData.name || email.split('@')[0];
    avatar = userData.picture?.data?.url;
    role = 'freelancer'; // Default

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      const usernameSeed = email.split('@')[0];
      const username = usernameSeed.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const existingUsername = await User.findOne({ username });
      let finalUsername = username;
      if (existingUsername) {
        finalUsername = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await User.create({
        name,
        username: finalUsername,
        email,
        password: bcrypt.hashSync(Math.random().toString(36).substring(2, 11), 10),
        role: role || 'freelancer',
        isVerified: true
      });
    }

    const token = authService.generateToken(user);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facebook Authentication Success</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h3>Facebook Authentication Successful!</h3>
          <p>Please wait, establishing your workspace credentials...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                token: '${token}',
                user: ${JSON.stringify(userObj)}
              }, '*');
              window.close();
            } else {
              localStorage.setItem('token', '${token}');
              localStorage.setItem('user', JSON.stringify(${JSON.stringify(userObj)}));
              window.location.href = '/dashboard';
            }
          </script>
        </body>
      </html>
    `);

  } catch (err) {
    return sendError(res, `Facebook OAuth complete error: ${err.message}`, 500);
  }
};

/**
 * Initialize 2FA setup for authenticated user
 * POST /api/auth/2fa/enable
 */
export const enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User record not found.', 404);

    const secret = generateBase32Secret();
    const otpauthUrl = `otpauth://totp/Farelancer:${user.email}?secret=${secret}&issuer=Farelancer`;
    
    // Generate 8 secure backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }

    // Save temporary secret and backup codes on user document, but do not enable 2FA yet
    user.twoFactorSecret = secret;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    return sendSuccess(res, 'Two-factor authentication secret generated successfully.', {
      secret,
      otpauthUrl,
      backupCodes
    });
  } catch (err) {
    return sendError(res, `Enable 2FA initialization failed: ${err.message}`, 500);
  }
};

/**
 * Verify first TOTP token to activate 2FA
 * POST /api/auth/2fa/verify-setup
 */
export const verify2FASetup = async (req, res) => {
  const { code } = req.body;
  if (!code) return sendError(res, 'Security verification code is required.', 400);

  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User record not found.', 404);

    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      return sendError(res, 'Verification failed. The 6-digit Authenticator code is incorrect or expired.', 400);
    }

    user.twoFactorEnabled = true;
    await user.save();

    return sendSuccess(res, 'Two-factor authentication has been successfully enabled on your account!', {
      user: {
        id: user._id,
        email: user.email,
        twoFactorEnabled: true
      }
    });
  } catch (err) {
    return sendError(res, `2FA Setup verification failed: ${err.message}`, 500);
  }
};

/**
 * Disable 2FA on authenticated user account
 * POST /api/auth/2fa/disable
 */
export const disable2FA = async (req, res) => {
  const { password } = req.body;
  if (!password) return sendError(res, 'Password confirmation is required to disable 2FA.', 400);

  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User record not found.', 404);

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return sendError(res, 'Incorrect password confirmation.', 401);
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = '';
    user.twoFactorBackupCodes = [];
    await user.save();

    return sendSuccess(res, 'Two-factor authentication has been disabled successfully.', {
      twoFactorEnabled: false
    });
  } catch (err) {
    return sendError(res, `Failed to disable 2FA: ${err.message}`, 500);
  }
};

/**
 * Verify 2FA token/code during login process
 * POST /api/auth/2fa/verify-login
 */
export const verify2FALogin = async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return sendError(res, 'Required session credentials or security code is missing.', 400);
  }

  try {
    // Verify temporary 2FA pending token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch (e) {
      return sendError(res, 'Invalid or expired temporary session. Please sign in again.', 401);
    }

    if (!decoded.is2faPending) {
      return sendError(res, 'Authentication mismatch. Invalid token type.', 400);
    }

    const user = await User.findById(decoded.id);
    if (!user) return sendError(res, 'User record not found.', 404);

    let isAuthorized = false;
    let usedBackupCode = false;

    // Check if code matches backup codes first
    if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.includes(code.trim().toUpperCase())) {
      isAuthorized = true;
      usedBackupCode = true;
      // Remove used backup code
      user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(c => c !== code.trim().toUpperCase());
      await user.save();
    } else {
      // Otherwise verify standard TOTP
      isAuthorized = verifyTOTP(user.twoFactorSecret, code);
    }

    if (!isAuthorized) {
      return sendError(res, 'Verification failed. The code is incorrect or expired.', 401);
    }

    // Generate final JWT token
    const token = authService.generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';

    return sendSuccess(res, 'Two-factor verification passed successfully. Welcome back!', {
      token,
      user: userObj,
      redirectUrl,
      usedBackupCode
    });
  } catch (err) {
    return sendError(res, `2FA login verification process failed: ${err.message}`, 500);
  }
};

export const submitKyc = async (req, res) => {
  const { identityType, documentUrl } = req.body;
  if (!identityType || !documentUrl) {
    return sendError(res, 'Identity Type and Document URL are required to submit KYC.', 400);
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User not found.', 404);

    user.kycDetails = {
      status: 'pending',
      identityType,
      documentUrl,
      submittedAt: new Date(),
      verifiedAt: null
    };

    await user.save();
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'KYC Verification request submitted successfully. Admins will review it soon!', { user: userObj });
  } catch (err) {
    return sendError(res, `KYC Submission failed: ${err.message}`, 500);
  }
};

/**
 * Refresh user access token using the HttpOnly refresh token
 * POST /api/auth/refresh
 */
export const refreshUserSession = async (req, res) => {
  const cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split('; ').map(c => c.split('='))) : {};
  const refreshToken = cookies.refreshToken;

  if (!refreshToken) {
    return sendError(res, 'Refresh token is missing from browser cookies.', 401);
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    if (decoded.type !== 'refresh') {
      return sendError(res, 'Invalid token authorization type.', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 'Associated user account not found.', 401);
    }

    if (user.status === 'banned') {
      return sendError(res, 'Account is currently disabled.', 403);
    }

    // Generate new Access and Refresh tokens
    const newAccessToken = authService.generateToken(user);
    const newRefreshToken = authService.generateRefreshToken(user);

    // Set secure cookies
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day access token
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days refresh token
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'Workspace access credentials refreshed successfully.', {
      token: newAccessToken,
      user: userObj
    });
  } catch (err) {
    return sendError(res, 'Session credentials expired. Please sign in again.', 401);
  }
};

export default {
  register,
  login,
  getMe,
  logout,
  getProfile,
  updateProfile,
  getFreelancers,
  getUserById,
  forgotPassword,
  resetPassword,
  toggleSaveJob,
  toggleSaveFreelancer,
  addPortfolioItem,
  deletePortfolioItem,
  addReview,
  getGoogleAuthUrl,
  handleGoogleCallback,
  getFacebookAuthUrl,
  handleFacebookCallback,
  enable2FA,
  verify2FASetup,
  disable2FA,
  verify2FALogin,
  submitKyc,
  refreshUserSession
};
