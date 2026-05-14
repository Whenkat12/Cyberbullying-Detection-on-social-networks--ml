import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 500 },
    dateOfBirth: Date,
    country: String,
    language: { type: String, default: 'en' }
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    privacy: {
      profileVisibility: { 
        type: String, 
        enum: ['public', 'private', 'friends'], 
        default: 'private' 
      },
      showDetectionHistory: { type: Boolean, default: true }
    },
    detection: {
      sensitivity: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
      },
      autoBlock: { type: Boolean, default: false },
      blockThreshold: { type: Number, default: 3 }
    }
  },
  subscription: {
    plan: { 
      type: String, 
      enum: ['free', 'basic', 'premium'], 
      default: 'free' 
    },
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'cancelled'], 
      default: 'active' 
    },
    expiresAt: Date,
    features: [String]
  },
  socialMedia: {
    connectedPlatforms: [{
      platform: { 
        type: String, 
        enum: ['whatsapp', 'instagram', 'twitter', 'facebook'] 
      },
      connectedAt: { type: Date, default: Date.now },
      lastSync: Date,
      settings: mongoose.Schema.Types.Mixed
    }],
    monitoringEnabled: { type: Boolean, default: false }
  },
  stats: {
    totalDetections: { type: Number, default: 0 },
    bullyingDetections: { type: Number, default: 0 },
    blockedUsers: { type: Number, default: 0 },
    reportsSubmitted: { type: Number, default: 0 }
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  emailVerified: { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    profile: {
      firstName: this.profile.firstName,
      lastName: this.profile.lastName,
      avatar: this.profile.avatar,
      bio: this.profile.bio
    },
    stats: this.stats,
    createdAt: this.createdAt
  };
};

// Static method to find by email or username
userSchema.statics.findByEmailOrUsername = function(emailOrUsername) {
  return this.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername }
    ]
  });
};

export default mongoose.model('User', userSchema);