import express from 'express';
import Detection from '../models/Detection.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { AuthorizationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get user analytics overview
router.get('/overview', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30; // days
    const userId = req.user._id;

    // Get detection statistics
    const detectionStats = await Detection.getUserStats(userId, timeRange);
    
    // Get chat statistics
    const chatStats = await Chat.getChatStats(userId);
    
    // Get message statistics
    const messageStats = await Message.getMessageAnalytics(userId, timeRange);
    
    // Get platform breakdown
    const platformBreakdown = await Detection.aggregate([
      {
        $match: {
          userId: userId,
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
    const trendingWords = await Detection.getTrendingWords(userId, timeRange);
    
    // Get time-based analytics
    const timeAnalytics = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
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
          date: '$_id',
          total: 1,
          bullying: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      summary: {
        timeRange,
        detectionStats,
        chatStats,
        messageStats
      },
      platformBreakdown,
      trendingWords: trendingWords.slice(0, 10),
      timeAnalytics
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed analytics
router.get('/detailed', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30;
    const userId = req.user._id;

    // Get severity distribution
    const severityDistribution = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: '$result.severity',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$result.confidence' }
        }
      },
      {
        $project: {
          severity: '$_id',
          count: 1,
          avgConfidence: 1,
          _id: 0
        }
      }
    ]);

    // Get hourly activity
    const hourlyActivity = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
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

    // Get confidence distribution
    const confidenceDistribution = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $bucket: {
          groupBy: '$result.confidence',
          boundaries: [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
          default: 'other',
          output: {
            count: { $sum: 1 },
            bullying: {
              $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
            }
          }
        }
      }
    ]);

    // Get user actions distribution
    const actionsDistribution = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: '$actions.userAction',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          action: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      severityDistribution,
      hourlyActivity,
      confidenceDistribution,
      actionsDistribution
    });
  } catch (error) {
    next(error);
  }
});

// Get comparative analytics (user vs platform average)
router.get('/comparative', async (req, res, next) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 30;
    const userId = req.user._id;

    // Get user stats
    const userStats = await Detection.getUserStats(userId, timeRange);
    
    // Get platform average stats (anonymized)
    const platformAvg = await Detection.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalDetections: { $sum: 1 },
          bullyingDetections: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$result.confidence' },
          blockedCount: {
            $sum: { $cond: ['$actions.blocked', 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalDetections: 1,
          bullyingDetections: 1,
          avgConfidence: 1,
          blockedCount: 1,
          bullyingRate: {
            $divide: ['$bullyingDetections', '$totalDetections']
          }
        }
      }
    ]);

    res.json({
      userStats,
      platformAverage: platformAvg[0] || {
        totalDetections: 0,
        bullyingDetections: 0,
        avgConfidence: 0,
        blockedCount: 0,
        bullyingRate: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get predictive analytics
router.get('/predictive', async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get recent trend (last 7 days vs previous 7 days)
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(last7Days.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentTrend = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: previous7Days }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $gte: ['$createdAt', last7Days] },
              'recent',
              'previous'
            ]
          },
          total: { $sum: 1 },
          bullying: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$result.confidence' }
        }
      }
    ]);

    // Get most active platforms
    const activePlatforms = await Detection.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$context.platform',
          total: { $sum: 1 },
          bullying: {
            $sum: { $cond: [{ $eq: ['$result.label', 'Bullying'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Get risk level based on recent activity
    const recentActivity = await Detection.find({
      userId: userId,
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      'result.label': 'Bullying'
    }).sort({ createdAt: -1 }).limit(10);

    const highSeverityCount = recentActivity.filter(d => 
      ['High', 'Critical'].includes(d.result.severity)
    ).length;

    let riskLevel = 'Low';
    if (highSeverityCount >= 5) riskLevel = 'High';
    else if (highSeverityCount >= 2) riskLevel = 'Medium';

    res.json({
      trend: recentTrend,
      activePlatforms,
      riskLevel,
      recommendations: generateRecommendations(recentActivity, riskLevel)
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate recommendations
function generateRecommendations(recentActivity, riskLevel) {
  const recommendations = [];

  if (riskLevel === 'High') {
    recommendations.push(
      'Consider enabling auto-block for high-severity detections',
      'Review your privacy settings on social media platforms',
      'Report persistent harassers to platform administrators'
    );
  }

  if (riskLevel === 'Medium') {
    recommendations.push(
      'Monitor conversations more closely',
      'Consider adjusting detection sensitivity',
      'Document incidents for future reference'
    );
  }

  // Platform-specific recommendations
  const platforms = [...new Set(recentActivity.map(d => d.context.platform))];
  if (platforms.includes('twitter')) {
    recommendations.push('Consider making your Twitter account private');
  }
  if (platforms.includes('instagram')) {
    recommendations.push('Review your Instagram story and post privacy settings');
  }

  return recommendations;
}

export default router;