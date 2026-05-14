import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Detection from '../models/Detection.js';
import Chat from '../models/Chat.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Get current user profile
router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        settings: user.settings,
        subscription: user.subscription,
        socialMedia: user.socialMedia,
        stats: user.stats,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.patch('/profile', [
  body('profile.firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters')
    .trim()
    .escape(),
  body('profile.lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters')
    .trim()
    .escape(),
  body('profile.bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
    .trim()
    .escape(),
  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('profile.country')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters')
    .trim()
    .escape(),
  body('profile.language')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Language must be less than 10 characters')
    .trim()
    .escape()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { profile } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update profile fields
    if (profile) {
      Object.keys(profile).forEach(key => {
        if (profile[key] !== undefined) {
          user.profile[key] = profile[key];
        }
      });
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user settings
router.patch('/settings', [
  body('settings.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('settings.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('settings.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notifications must be a boolean'),
  body('settings.privacy.profileVisibility')
    .optional()
    .isIn(['public', 'private', 'friends'])
    .withMessage('Profile visibility must be public, private, or friends'),
  body('settings.privacy.showDetectionHistory')
    .optional()
    .isBoolean()
    .withMessage('Show detection history must be a boolean'),
  body('settings.detection.sensitivity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Detection sensitivity must be low, medium, or high'),
  body('settings.detection.autoBlock')
    .optional()
    .isBoolean()
    .withMessage('Auto block must be a boolean'),
  body('settings.detection.blockThreshold')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Block threshold must be between 1 and 10')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { settings } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update settings fields
    if (settings) {
      Object.keys(settings).forEach(category => {
        if (settings[category] && typeof settings[category] === 'object') {
          Object.keys(settings[category]).forEach(key => {
            if (settings[category][key] !== undefined) {
              user.settings[category][key] = settings[category][key];
            }
          });
        }
      });
    }

    await user.save();

    res.json({
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.patch('/password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get user statistics
router.get('/stats', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30; // days
    
    // Get detection stats
    const detectionStats = await Detection.getUserStats(req.user._id, timeRange);
    
    // Get chat stats
    const chatStats = await Chat.getChatStats(req.user._id);
    
    // Get platform breakdown
    const platformStats = await Detection.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: '$context.platform',
          total: { $sum: 1 },
          bullying: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$result.confidence' }
        }
      },
      {
        $project: {
          platform: '$_id',
          _id: 0,
          total: 1,
          bullying: 1,
          bullyingRate: { $divide: ['$bullying', '$total'] },
          avgConfidence: 1
        }
      }
    ]);

    // Get trending words
    const trendingWords = await Detection.getTrendingWords(req.user._id, timeRange);

    res.json({
      stats: {
        detections: detectionStats,
        chats: chatStats,
        platformBreakdown: platformStats,
        trendingWords: trendingWords.slice(0, 10)
      },
      timeRange
    });
  } catch (error) {
    next(error);
  }
});

// Get user activity timeline
router.get('/activity', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // Get recent detections with chat info
    const detections = await Detection.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-text -metadata.ipAddress')
      .populate('chatId', 'contactInfo.name contactInfo.avatar')
      .lean();

    // Get recent chat activities
    const chats = await Chat.find({ userId: req.user._id })
      .sort({ 'statistics.lastActivity': -1 })
      .limit(10)
      .select('contactInfo status statistics.lastActivity')
      .lean();

    const total = await Detection.countDocuments({ userId: req.user._id });

    res.json({
      activities: {
        detections,
        recentChats: chats
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete account
router.delete('/account', [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),
  body('confirm')
    .isBoolean()
    .custom(value => value === true)
    .withMessage('You must confirm account deletion')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { password } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ValidationError('Incorrect password');
    }

    // Delete user data (cascade delete will handle related data)
    await User.findByIdAndDelete(req.user._id);
    
    // Delete user-related data
    await Detection.deleteMany({ userId: req.user._id });
    await Chat.deleteMany({ userId: req.user._id });

    res.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;