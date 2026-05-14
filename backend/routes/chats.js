import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

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

// Get all chats for user
router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const platform = req.query.platform;
    
    let filter = { userId: req.user._id };
    
    if (status !== 'all') {
      filter.status = status;
    }
    
    if (platform) {
      filter.platform = platform;
    }

    const chats = await Chat.find(filter)
      .sort({ 'statistics.lastActivity': -1 })
      .lean();

    res.json({
      chats,
      count: chats.length
    });
  } catch (error) {
    next(error);
  }
});

// Get single chat
router.get('/:id', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).lean();

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    res.json({ chat });
  } catch (error) {
    next(error);
  }
});

// Create new chat
router.post('/', [
  body('platform')
    .isIn(['whatsapp', 'instagram', 'twitter', 'facebook'])
    .withMessage('Platform must be whatsapp, instagram, twitter, or facebook'),
  body('contactId')
    .isString()
    .notEmpty()
    .withMessage('Contact ID is required'),
  body('contactInfo.name')
    .isString()
    .notEmpty()
    .withMessage('Contact name is required'),
  body('contactInfo.username')
    .optional()
    .isString()
    .withMessage('Username must be a string'),
  body('contactInfo.avatar')
    .optional()
    .isString()
    .withMessage('Avatar must be a string'),
  body('contactInfo.phone')
    .optional()
    .isString()
    .withMessage('Phone must be a string'),
  body('contactInfo.email')
    .optional()
    .isEmail()
    .withMessage('Email must be valid')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { platform, contactId, contactInfo } = req.body;

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      userId: req.user._id,
      platform,
      contactId
    });

    if (existingChat) {
      return res.status(409).json({
        error: 'Chat already exists',
        chat: existingChat
      });
    }

    // Create new chat
    const chat = new Chat({
      userId: req.user._id,
      platform,
      contactId,
      contactInfo,
      statistics: {
        lastActivity: new Date()
      }
    });

    await chat.save();

    res.status(201).json({
      message: 'Chat created successfully',
      chat
    });
  } catch (error) {
    next(error);
  }
});

// Update chat settings
router.patch('/:id/settings', [
  body('autoBlock')
    .optional()
    .isBoolean()
    .withMessage('Auto block must be a boolean'),
  body('blockThreshold')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Block threshold must be between 1 and 10'),
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be a boolean'),
  body('monitoringEnabled')
    .optional()
    .isBoolean()
    .withMessage('Monitoring enabled must be a boolean')
], handleValidationErrors, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    const { autoBlock, blockThreshold, notifications, monitoringEnabled } = req.body;

    // Update settings
    if (autoBlock !== undefined) chat.settings.autoBlock = autoBlock;
    if (blockThreshold !== undefined) chat.settings.blockThreshold = blockThreshold;
    if (notifications !== undefined) chat.settings.notifications = notifications;
    if (monitoringEnabled !== undefined) chat.settings.monitoringEnabled = monitoringEnabled;

    await chat.save();

    res.json({
      message: 'Chat settings updated successfully',
      settings: chat.settings
    });
  } catch (error) {
    next(error);
  }
});

// Block chat
router.post('/:id/block', [
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], handleValidationErrors, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    const { reason } = req.body;
    await chat.block(reason || 'Manual block');

    res.json({
      message: 'Chat blocked successfully',
      chat: {
        _id: chat._id,
        status: chat.status,
        blockedAt: chat.blockedAt,
        blockedReason: chat.blockedReason
      }
    });
  } catch (error) {
    next(error);
  }
});

// Unblock chat
router.post('/:id/unblock', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    if (chat.status !== 'blocked') {
      return res.status(400).json({
        error: 'Chat is not blocked'
      });
    }

    await chat.unblock();

    res.json({
      message: 'Chat unblocked successfully',
      chat: {
        _id: chat._id,
        status: chat.status,
        strikeCount: chat.strikeCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete chat
router.delete('/:id', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Delete associated messages
    await Message.deleteMany({ chatId: chat._id });
    
    // Delete chat
    await Chat.findByIdAndDelete(chat._id);

    res.json({
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get chat statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Get message statistics
    const messageStats = await Message.aggregate([
      {
        $match: { chatId: chat._id }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          userMessages: {
            $sum: { $cond: [{ $eq: ['$sender', 'user'] }, 1, 0] }
          },
          contactMessages: {
            $sum: { $cond: [{ $eq: ['$sender', 'contact'] }, 1, 0] }
          },
          bullyingMessages: {
            $sum: { $cond: [{ $eq: ['$detection.label', 'Bullying'] }, 1, 0] }
          },
          blockedMessages: {
            $sum: { $cond: ['$actions.blocked', 1, 0] }
          },
          avgProcessingTime: { $avg: '$processing.processingTime' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMessages: 1,
          userMessages: 1,
          contactMessages: 1,
          bullyingMessages: 1,
          blockedMessages: 1,
          avgProcessingTime: 1,
          bullyingRate: {
            $cond: [
              { $gt: ['$totalMessages', 0] },
              { $divide: ['$bullyingMessages', '$totalMessages'] },
              0
            ]
          }
        }
      }
    ]);

    // Get severity breakdown
    const severityBreakdown = await Message.aggregate([
      {
        $match: { 
          chatId: chat._id,
          'detection.label': 'Bullying'
        }
      },
      {
        $group: {
          _id: '$detection.severity',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          severity: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await Message.find({ chatId: chat._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('text detection.label detection.severity createdAt sender')
      .lean();

    res.json({
      chat: {
        _id: chat._id,
        contactInfo: chat.contactInfo,
        status: chat.status,
        statistics: chat.statistics,
        strikeCount: chat.strikeCount,
        settings: chat.settings
      },
      messageStats: messageStats[0] || {
        totalMessages: 0,
        userMessages: 0,
        contactMessages: 0,
        bullyingMessages: 0,
        blockedMessages: 0,
        avgProcessingTime: 0,
        bullyingRate: 0
      },
      severityBreakdown,
      recentActivity
    });
  } catch (error) {
    next(error);
  }
});

export default router;