import express from 'express';
import { body, validationResult } from 'express-validator';
import Detection from '../models/Detection.js';
import { cyberbullyingDetector } from '../services/CyberbullyingDetector.js';
import { AppError, ValidationError } from '../middleware/errorHandler.js';

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

// Detect cyberbullying in text
router.post('/detect', [
  body('text')
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Text must be between 1 and 5000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('context.platform')
    .optional()
    .isIn(['web', 'whatsapp', 'instagram', 'twitter', 'facebook', 'api'])
    .withMessage('Invalid platform'),
  body('context.source')
    .optional()
    .isString()
    .withMessage('Source must be a string'),
  body('isRealTime')
    .optional()
    .isBoolean()
    .withMessage('isRealTime must be a boolean')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { text, context = {}, isRealTime = false } = req.body;
    const startTime = Date.now();

    // Check if ML model is loaded
    if (!cyberbullyingDetector.isModelLoaded()) {
      throw new AppError('ML model not loaded', 503);
    }

    // Perform detection
    const result = cyberbullyingDetector.detect(text);
    const processingTime = Date.now() - startTime;

    // Save detection to database
    const detection = new Detection({
      userId: req.user._id,
      text,
      result,
      context: {
        platform: context.platform || 'web',
        source: context.source || 'api',
        ...context
      },
      processingTime,
      modelVersion: cyberbullyingDetector.getModelInfo()?.version || 'unknown',
      isRealTime,
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await detection.save();

    // Update user statistics
    req.user.stats.totalDetections += 1;
    if (result.label === 'Bullying') {
      req.user.stats.bullyingDetections += 1;
    }
    await req.user.save();

    res.json({
      message: 'Detection completed successfully',
      result: {
        ...result,
        processingTime,
        modelVersion: cyberbullyingDetector.getModelInfo()?.version
      },
      saved: true
    });
  } catch (error) {
    next(error);
  }
});

// Batch detection for multiple texts
router.post('/batch-detect', [
  body('texts')
    .isArray({ min: 1, max: 100 })
    .withMessage('Texts must be an array with 1-100 items'),
  body('texts.*.text')
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Each text must be between 1 and 5000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('isRealTime')
    .optional()
    .isBoolean()
    .withMessage('isRealTime must be a boolean')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { texts, context = {}, isRealTime = false } = req.body;
    const startTime = Date.now();

    if (!cyberbullyingDetector.isModelLoaded()) {
      throw new AppError('ML model not loaded', 503);
    }

    const results = [];
    const savedDetections = [];

    for (const item of texts) {
      const itemStart = Date.now();
      const result = cyberbullyingDetector.detect(item.text);
      const processingTime = Date.now() - itemStart;

      // Save detection
      const detection = new Detection({
        userId: req.user._id,
        text: item.text,
        result,
        context: {
          platform: context.platform || 'web',
          source: context.source || 'batch',
          ...context
        },
        processingTime,
        modelVersion: cyberbullyingDetector.getModelInfo()?.version || 'unknown',
        isRealTime
      });

      await detection.save();
      savedDetections.push(detection);
      
      results.push({
        text: item.text,
        result: {
          ...result,
          processingTime
        },
        id: detection._id
      });
    }

    // Update user statistics
    const bullyingCount = results.filter(r => r.result.label === 'Bullying').length;
    req.user.stats.totalDetections += texts.length;
    req.user.stats.bullyingDetections += bullyingCount;
    await req.user.save();

    const totalProcessingTime = Date.now() - startTime;

    res.json({
      message: 'Batch detection completed successfully',
      results,
      summary: {
        total: texts.length,
        bullying: bullyingCount,
        nonBullying: texts.length - bullyingCount,
        totalProcessingTime,
        averageProcessingTime: totalProcessingTime / texts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get detection history
router.get('/history', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    
    // Apply filters
    if (req.query.label) {
      filter['result.label'] = req.query.label;
    }
    
    if (req.query.severity) {
      filter['result.severity'] = req.query.severity;
    }
    
    if (req.query.platform) {
      filter['context.platform'] = req.query.platform;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const detections = await Detection.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-text -metadata.ipAddress') // Exclude sensitive data
      .lean();

    const total = await Detection.countDocuments(filter);

    res.json({
      detections,
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

// Get single detection
router.get('/:id', async (req, res, next) => {
  try {
    const detection = await Detection.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).lean();

    if (!detection) {
      throw new NotFoundError('Detection not found');
    }

    res.json({ detection });
  } catch (error) {
    next(error);
  }
});

// Update detection feedback
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

    const detection = await Detection.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!detection) {
      throw new NotFoundError('Detection not found');
    }

    detection.actions.userAction = userAction;
    if (feedback) {
      detection.actions.feedback = feedback;
    }

    await detection.save();

    res.json({
      message: 'Feedback updated successfully',
      detection: {
        _id: detection._id,
        actions: detection.actions
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get detection statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30; // days
    const stats = await Detection.getUserStats(req.user._id, timeRange);

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

// Get trending words
router.get('/stats/trending', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 7; // days
    const trendingWords = await Detection.getTrendingWords(req.user._id, timeRange);

    res.json({ trendingWords });
  } catch (error) {
    next(error);
  }
});

// Export detection data
router.get('/export/csv', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    const detections = await Detection.find({
      userId: req.user._id,
      createdAt: { $gte: startDate }
    })
    .select('text result.label result.confidence result.severity createdAt context.platform')
    .sort({ createdAt: -1 })
    .lean();

    // Convert to CSV format
    const csvHeaders = 'Text,Label,Confidence,Severity,Date,Platform\n';
    const csvData = detections.map(d => 
      `"${d.text.replace(/"/g, '""')}","${d.result.label}",${d.result.confidence},"${d.result.severity}","${d.createdAt.toISOString()}","${d.context.platform}"`
    ).join('\n');

    const csvContent = csvHeaders + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="detections-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

export default router;