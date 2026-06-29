import mongooseInstance from '../config/db.js';

const UserSchema = new mongooseInstance.Schema({
  name: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['freelancer', 'buyer', 'admin'],
    default: 'freelancer'
  },
  profile: {
    title: { type: String, default: '' },
    bio: { type: String, default: '' },
    skills: { type: Array, default: [] }, // Array of strings
    hourlyRate: { type: Number, default: 0 },
    avatar: { type: String, default: '' }, // Base64 or URL
    coverImage: { type: String, default: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
    experience: { type: String, default: '' },
    socialLinks: {
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' }
    }
  },
  portfolio: [{
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    projectUrl: { type: String, default: '' },
    imageUrl: { type: String, default: '' }
  }],
  savedJobs: [{
    type: String
  }],
  savedFreelancers: [{
    type: String
  }],
  reviews: [{
    reviewerId: { type: String, required: true },
    reviewerName: { type: String, required: true },
    reviewerRole: { type: String, required: true },
    rating: { type: Number, default: 5 },
    comment: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  balance: {
    type: Number,
    default: 1000 // Give new users $1000 starter balance for demo/testing!
  },
  rating: {
    type: Number,
    default: 5.0
  },
  completedCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active'
  },
  isKycVerified: {
    type: Boolean,
    default: false
  },
  kycDetails: {
    status: { type: String, enum: ['unsubmitted', 'pending', 'verified', 'rejected'], default: 'unsubmitted' },
    identityType: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null }
  },
  badges: {
    type: [String],
    default: []
  },
  resetCode: {
    type: String,
    default: ''
  },
  resetCodeExpires: {
    type: Date,
    default: null
  },
  verificationOtp: {
    type: String,
    default: ''
  },
  verificationOtpExpires: {
    type: Date,
    default: null
  },
  lastOtpRequestedAt: {
    type: Date,
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: ''
  },
  twoFactorBackupCodes: {
    type: [String],
    default: []
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginHistory: [{
    ipAddress: { type: String, default: '' },
    browser: { type: String, default: '' },
    device: { type: String, default: '' },
    loginTime: { type: Date, default: Date.now },
    status: { type: String, default: 'success' }
  }],
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const User = mongooseInstance.model('User', UserSchema);
export default User;
