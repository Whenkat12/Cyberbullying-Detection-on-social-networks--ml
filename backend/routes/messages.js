import express from 'express';
import { body, validationResult } from 'express-validator';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { cyberbullyingDetector } from '../services/CyberbullyingDetector.js';
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

// Get messages for a chat
router.get('/chat/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    // Verify chat belongs to user
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Message.countDocuments({ chatId });

    res.json({
      messages,
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

// Send a message (with detection)
router.post('/', [
  body('chatId')
    .isMongoId()
    .withMessage('Valid chat ID is required'),
  body('text')
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message text must be between 1 and 5000 characters'),
  body('sender')
    .isIn(['user', 'contact'])
    .withMessage('Sender must be user or contact'),
  body('platformMessageId')
    .optional()
    .isString()
    .withMessage('Platform message ID must be a string'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { chatId, text, sender, platformMessageId, metadata = {} } = req.body;

    // Verify chat belongs to user
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    if (chat.status === 'blocked') {
      return res.status(403).json({
        error: 'Chat is blocked',
        message: 'Cannot send messages in a blocked chat'
      });
    }

    const startTime = Date.now();
    
    // Perform detection if ML model is loaded
    let detection = null;
    let processingTime = 0;
    
    if (cyberbullyingDetector.isModelLoaded()) {
      detection = cyberbullyingDetector.detect(text);
      processingTime = Date.now() - startTime;
    }

    // Create message
    const message = new Message({
      chatId,
      userId: req.user._id,
      platformMessageId,
      text,
      sender,
      detection,
      metadata: {
        platform: chat.platform,
        ...metadata
      },
      processing: {
        processed: detection !== null,
        processedAt: detection ? new Date() : null,
        processingTime,
        modelVersion: cyberbullyingDetector.getModelInfo()?.version || 'unknown'
      }
    });

    await message.save();

    // Update chat statistics
    chat.statistics.totalMessages += 1;
    chat.statistics.lastActivity = new Date();
    
    if (detection && detection.label === 'Bullying') {
      chat.statistics.bullyingDetections += 1;
      chat.statistics.lastDetection = new Date();
      
      // Increment strike count
      await chat.incrementStrike();
      
      // Block message if auto-block is enabled and threshold reached
      if (chat.settings.autoBlock && chat.strikeCount >= chat.settings.blockThreshold) {
        await message.block('Automatic block due to repeated bullying');
      }
    }

    await chat.save();

    res.status(201).json({
      message: 'Message sent successfully',
      data: {
        message: {
          _id: message._id,
          text: message.text,
          sender: message.sender,
          detection: message.detection,
          status: message.status,
          createdAt: message.createdAt
        },
        chat: {
          _id: chat._id,
          status: chat.status,
          strikeCount: chat.strikeCount,
          statistics: chat.statistics
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single message
router.get('/:id', async (req, res, next) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('chatId', 'contactInfo platform');

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    res.json({ message });
  } catch (error) {
    next(error);
  }
});

// Update message feedback
router.patch('/:id/feedback', [
  body('userAction')
    .isIn(['agree', 'disagree', 'ignore'])
    .withMessage('userAction must be agree, disagree, or ignore'),
  body('feedback')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Feedback must be less than 500 characters')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { userAction, feedback } = req.body;

    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    message.actions.userAction = userAction;
    if (feedback) {
      message.actions.feedback = feedback;
    }

    await message.save();

    res.json({
      message: 'Message feedback updated successfully',
      actions: message.actions
    });
  } catch (error) {
    next(error);
  }
});

// Block message
router.post('/:id/block', [
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { reason } = req.body;

    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    await message.block(reason || 'Manual block');

    res.json({
      message: 'Message blocked successfully',
      data: {
        message: {
          _id: message._id,
          status: message.status,
          actions: message.actions
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get messages requiring review
router.get('/review/pending', async (req, res, next) => {
  try {
    const severity = req.query.severity;
    const platform = req.query.platform;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const messages = await Message.getMessagesForReview(req.user._id, {
      severity,
      platform,
      limit
    });

    res.json({
      messages,
      count: messages.length
    });
  } catch (error) {
    next(error);
  }
});

// Batch process messages for detection
router.post('/batch-process', [
  body('messages')
    .isArray({ min: 1, max: 100 })
    .withMessage('Messages must be an array with 1-100 items'),
  body('messages.*.text')
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Each message text must be between 1 and 5000 characters'),
  body('messages.*.sender')
    .isIn(['user', 'contact'])
    .withMessage('Each sender must be user or contact')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!cyberbullyingDetector.isModelLoaded()) {
      throw new AppError('ML model not loaded', 503);
    }

    const results = [];
    const startTime = Date.now();

    for (const msg of messages) {
      const detection = cyberbullyingDetector.detect(msg.text);
      const processingTime = Date.now() - startTime;

      results.push({
        text: msg.text,
        sender: msg.sender,
        detection: {
          ...detection,
          processingTime
        }
      });
    }

    const totalProcessingTime = Date.now() - startTime;

    res.json({
      message: 'Batch processing completed',
      results,
      summary: {
        total: messages.length,
        bullying: results.filter(r => r.detection.label === 'Bullying').length,
        nonBullying: results.filter(r => r.detection.label === 'Non-Bullying').length,
        totalProcessingTime,
        averageProcessingTime: totalProcessingTime / messages.length
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;