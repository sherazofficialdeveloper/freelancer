import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/dotenv.config.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendEmail } from '../utils/email.js';

export const register = async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return sendError(res, 'All fields (username, email, password, role) are required.', 400);
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'Email address is already in use.', 400);
    }

    const existingName = await User.findOne({ username });
    if (existingName) {
      return sendError(res, 'Username is already taken.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Default buyer starts with $2000 to post jobs! Freelancer starts with $0.
    let userRole = role;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    if (cleanEmail === 'raisheraz7181@gmail.com' || cleanEmail === 'ficerdigitalagency@gmail.com') {
      userRole = 'admin';
    }
    const startingBalance = userRole === 'buyer' ? 2000 : (userRole === 'admin' ? 100000 : 100);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role: userRole,
      balance: startingBalance,
      profile: {
        title: role === 'freelancer' ? 'Expert Creative Professional' : 'Innovative Employer',
        bio: 'Welcome to my Farelancer profile page!',
        skills: role === 'freelancer' ? ['HTML', 'CSS', 'JavaScript'] : [],
        hourlyRate: role === 'freelancer' ? 25 : 0
      }
    });

    // Notify registered user
    sendEmail(email, 'Welcome to Farelancer!', `Hey ${username}, welcome to Farelancer! Start your freelancing or hiring journey today.`);

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'User registered successfully!', { user: userObj }, 201);
  } catch (err) {
    return sendError(res, `Onboarding error: ${err.message}`, 500);
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required credentials.', 400);
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 'Invalid credentials provided.', 401);
    }

    if (user.status === 'banned') {
      return sendError(res, 'Access denied. This account has been banned by the administrator.', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials provided.', 401);
    }

    // Force Admin promotion for the authorized email
    const cleanEmailLog = user.email ? user.email.trim().toLowerCase() : '';
    if ((cleanEmailLog === 'raisheraz7181@gmail.com' || cleanEmailLog === 'ficerdigitalagency@gmail.com') && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    // Set secure cookie for frictionless authorization
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return sendSuccess(res, 'Logged in successfully!', { token, user: userObj });
  } catch (err) {
    return sendError(res, `Login verification error: ${err.message}`, 500);
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, 'User record not found.', 404);
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'Profile retrieved successfully.', { user: userObj });
  } catch (err) {
    return sendError(res, `Profile fetching error: ${err.message}`, 500);
  }
};

export const updateProfile = async (req, res) => {
  const { title, bio, skills, hourlyRate, avatar, coverImage, socialLinks, experience } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, 'User profile record not found.', 404);
    }

    const currentProfile = user.profile || {};
    const updatedProfile = {
      title: title !== undefined ? title : currentProfile.title,
      bio: bio !== undefined ? bio : currentProfile.bio,
      skills: skills !== undefined ? (Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim())) : currentProfile.skills,
      hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : currentProfile.hourlyRate,
      avatar: avatar !== undefined ? avatar : currentProfile.avatar,
      coverImage: coverImage !== undefined ? coverImage : currentProfile.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      socialLinks: socialLinks !== undefined ? socialLinks : currentProfile.socialLinks || { github: '', linkedin: '', twitter: '' },
      experience: experience !== undefined ? experience : currentProfile.experience || ''
    };

    user.profile = updatedProfile;
    await user.save();

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'Profile updated successfully!', { user: userObj });
  } catch (err) {
    return sendError(res, `Profile updating error: ${err.message}`, 500);
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

export const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer' });
    const sanitized = freelancers.map(f => {
      const copy = f.toObject ? f.toObject() : { ...f };
      delete copy.password;
      return copy;
    });
    return sendSuccess(res, 'Freelancer catalog loaded.', { freelancers: sanitized });
  } catch (err) {
    return sendError(res, `Freelancer loading error: ${err.message}`, 500);
  }
};
