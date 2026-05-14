import express from 'express';
import User from '../models/User.js';
import Detection from '../models/Detection.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { adminMiddleware } from '../middleware/auth.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(adminMiddleware);

// Get system statistics
router.get('/stats', async (req, res, next) => {
  try {
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          premiumUsers: {
            $sum: { $cond: [{ $eq: ['$subscription.plan', 'premium'] }, 1, 0] }
          },
          emailVerifiedUsers: {
            $sum: { $cond: ['$emailVerified', 1, 0] }
          }
        }
      }
    ]);

    const detectionStats = await Detection.aggregate([
      {
        $group: {
          _id: null,
          totalDetections: { $sum: 1 },
          bullyingDetections: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$result.confidence' },
          avgProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    const chatStats = await Chat.aggregate([
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          activeChats: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          blockedChats: {
            $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
          }
        }
      }
    ]);

    const messageStats = await Message.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          bullyingMessages: {
            $sum: { $cond: [{ $eq: ['$detection.label', 'Bullying'] }, 1, 0] }
          },
          blockedMessages: {
            $sum: { $cond: ['$actions.blocked', 1, 0] }
          }
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await Detection.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username email')
      .select('-text -metadata.ipAddress')
      .lean();

    res.json({
      users: userStats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        premiumUsers: 0,
        emailVerifiedUsers: 0
      },
      detections: detectionStats[0] || {
        totalDetections: 0,
        bullyingDetections: 0,
        avgConfidence: 0,
        avgProcessingTime: 0
      },
      chats: chatStats[0] || {
        totalChats: 0,
        activeChats: 0,
        blockedChats: 0
      },
      messages: messageStats[0] || {
        totalMessages: 0,
        bullyingMessages: 0,
        blockedMessages: 0
      },
      recentActivity
    });
  } catch (error) {
    next(error);
  }
});

// Get all users with pagination
router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const role = req.query.role;
    const isActive = req.query.isActive;
    const subscription = req.query.subscription;

    let filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (subscription) filter['subscription.plan'] = subscription;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(filter);

    res.json({
      users,
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

// Get single user
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get user statistics
    const detectionStats = await Detection.getUserStats(user._id, 30);
    const chatStats = await Chat.getChatStats(user._id);

    res.json({
      user: {
        ...user,
        stats: {
          ...user.stats,
          detectionStats,
          chatStats
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be user, moderator, or admin'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// Toggle user active status
router.patch('/users/:id/toggle-active', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete user and all associated data
    await User.findByIdAndDelete(req.params.id);
    await Detection.deleteMany({ userId: req.params.id });
    await Chat.deleteMany({ userId: req.params.id });
    await Message.deleteMany({ userId: req.params.id });

    res.json({
      message: 'User and all associated data deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get platform analytics
router.get('/analytics/platform', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    // Platform usage statistics
    const platformStats = await Detection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$context.platform',
          totalDetections: { $sum: 1 },
          bullyingDetections: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$result.confidence' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          platform: '$_id',
          _id: 0,
          totalDetections: 1,
          bullyingDetections: 1,
          bullyingRate: { $divide: ['$bullyingDetections', '$totalDetections'] },
          avgConfidence: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Severity distribution across platforms
    const severityDistribution = await Detection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            platform: '$context.platform',
            severity: '$result.severity'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.platform',
          severities: {
            $push: {
              severity: '$_id.severity',
              count: '$count'
            }
          }
        }
      }
    ]);

    // Time-based activity
    const hourlyActivity = await Detection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $hour: '$createdAt'
          },
          total: { $sum: 1 },
          bullying: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          hour: '$_id',
          total: 1,
          bullying: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      platformStats,
      severityDistribution,
      hourlyActivity
    });
  } catch (error) {
    next(error);
  }
});

// Get system health
router.get('/health', async (req, res, next) => {
  try {
    // Check database connection
    const dbHealth = await checkDBHealth();
    
    // Check ML model status
    const mlModel = cyberbullyingDetector.getModelInfo();
    
    // Get system resources
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      database: dbHealth,
      mlModel: {
        loaded: !!mlModel,
        version: mlModel?.version || null,
        lastUpdated: mlModel?.lastUpdated || null
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Export system data
router.get('/export', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const timeRange = parseInt(req.query.timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    if (format === 'csv') {
      // Export user data as CSV
      const users = await User.find({ createdAt: { $gte: startDate } })
        .select('username email role isActive createdAt stats')
        .lean();

      const csvHeaders = 'Username,Email,Role,IsActive,CreatedAt,TotalDetections,BullyingDetections,BlockedUsers\n';
      const csvData = users.map(user => 
        `"${user.username}","${user.email}","${user.role}",${user.isActive},"${user.createdAt.toISOString()}",${user.stats.totalDetections},${user.stats.bullyingDetections},${user.stats.blockedUsers}`
      ).join('\n');

      const csvContent = csvHeaders + csvData;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Export as JSON
      const users = await User.find({ createdAt: { $gte: startDate } })
        .select('-password')
        .lean();

      const detections = await Detection.find({ createdAt: { $gte: startDate } })
        .select('-text -metadata.ipAddress')
        .lean();

      res.json({
        exportDate: new Date().toISOString(),
        timeRange,
        users: users.length,
        detections: detections.length,
        data: {
          users,
          detections
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;