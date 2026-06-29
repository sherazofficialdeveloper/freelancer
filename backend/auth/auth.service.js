import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/dotenv.config.js';

/**
 * Encrypt passwords using bcrypt
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare plain password with stored hash
 */
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate a JWT token for the user session (short-lived access token)
 */
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      name: user.name || user.username,
      username: user.username,
      email: user.email,
      role: user.role,
      type: 'access'
    },
    config.jwtSecret,
    { expiresIn: '1d' } // Access token valid for 1 day
  );
};

/**
 * Generate a secure refresh token for the session
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      type: 'refresh'
    },
    config.jwtSecret,
    { expiresIn: '7d' } // Refresh token valid for 7 days
  );
};

/**
 * Generate a temporary JWT token for 2FA-pending verification
 */
export const generateTemp2faToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      is2faPending: true
    },
    config.jwtSecret,
    { expiresIn: '5m' }
  );
};

/**
 * Fetch user by unique email address
 */
export const findUserByEmail = async (email) => {
  return await User.findOne({ email: email.toLowerCase().trim() });
};

/**
 * Fetch user by identifier
 */
export const findUserById = async (id) => {
  return await User.findById(id);
};

/**
 * Instantiate a new user profile with standard starting configuration
 */
export const createUser = async ({ name, username, email, password, role }) => {
  const hashedPassword = await hashPassword(password);
  
  // Clean names
  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = (username || name || cleanEmail.split('@')[0]).trim().replace(/\s+/g, '_');
  const cleanName = (name || cleanUsername).trim();

  // Role-based start balance: Buyer starts with $2000 to hire, Freelancer starts with $100, Admin starts with $0
  const startingBalance = role === 'buyer' ? 2000 : (role === 'admin' ? 0 : 100);

  const newUser = await User.create({
    name: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    role: role || 'freelancer',
    balance: startingBalance,
    status: 'active',
    profile: {
      title: role === 'freelancer' ? 'Expert Creative Professional' : 'Innovative Employer',
      bio: 'Welcome to my Farelancer profile page!',
      skills: role === 'freelancer' ? ['HTML', 'CSS', 'JavaScript'] : [],
      hourlyRate: role === 'freelancer' ? 25 : 0
    }
  });

  return newUser;
};

export default {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  generateTemp2faToken,
  findUserByEmail,
  findUserById,
  createUser
};
