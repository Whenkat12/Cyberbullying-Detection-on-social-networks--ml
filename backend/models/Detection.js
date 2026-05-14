import mongoose from 'mongoose';

const detectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 5000
  },
  result: {
    label: {
      type: String,
      enum: ['Bullying', 'Non-Bullying'],
      required: true
    },
    detailedCategory: {
      type: String,
      enum: ['Threatening', 'Hate_Speech', 'Sexual_Harassment', 'Toxic_Profanity', 'Non_Bullying'],
      default: 'Non_Bullying'
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low'
    },
    flaggedWords: [{
      word: String,
      weight: Number
    }],
    details: {
      detailedCategory: String,
      combinedScore: Number,
      keywordScore: Number,
      phraseScore: Number,
      mlScore: Number,
      mlConfidence: Number,
      mlMethod: String,
      mlTopWords: [{
        word: String,
        weight: Number
      }],
      targetedAtPerson: Boolean,
      capsRatio: Number,
      exclamationCount: Number,
      intensifierBoost: Number
    }
  },
  context: {
    platform: {
      type: String,
      enum: ['web', 'whatsapp', 'instagram', 'twitter', 'facebook', 'api'],
      default: 'web'
    },
    source: String, // e.g., 'chat', 'comment', 'post', 'message'
    conversationId: String,
    messageId: String,
    sender: {
      type: String,
      enum: ['user', 'contact', 'unknown'],
      default: 'user'
    }
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    deviceInfo: {
      type: String,
      os: String,
      browser: String
    }
  },
  actions: {
    blocked: { type: Boolean, default: false },
    reported: { type: Boolean, default: false },
    userAction: {
      type: String,
      enum: ['agree', 'disagree', 'ignore'],
      default: 'ignore'
    },
    feedback: String
  },
  processingTime: Number, // milliseconds
  modelVersion: String,
  isRealTime: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes for performance
detectionSchema.index({ userId: 1, createdAt: -1 });
detectionSchema.index({ 'result.label': 1, createdAt: -1 });
detectionSchema.index({ 'result.severity': 1 });
detectionSchema.index({ 'context.platform': 1 });
detectionSchema.index({ createdAt: -1 });
detectionSchema.index({ 'actions.blocked': 1 });
detectionSchema.index({ 'actions.reported': 1 });

// Compound indexes for analytics
detectionSchema.index({ userId: 1, 'result.label': 1, createdAt: -1 });
detectionSchema.index({ userId: 1, 'result.severity': 1, createdAt: -1 });
detectionSchema.index({ 'context.platform': 1, 'result.label': 1, createdAt: -1 });

// Text index for search
detectionSchema.index({ text: 'text' });

// Virtual for user relationship
detectionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Static methods for analytics
detectionSchema.statics.getUserStats = async function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const stats = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId.createFromHexString(userId),
        createdAt: { $gte: startDate }
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
        },
        reportedCount: {
          $sum: { $cond: ['$actions.reported', 1, 0] }
        },
        severityBreakdown: {
          $push: '$result.severity'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalDetections: 1,
        bullyingDetections: 1,
        bullyingRate: {
          $divide: ['$bullyingDetections', '$totalDetections']
        },
        avgConfidence: 1,
        blockedCount: 1,
        reportedCount: 1,
        severityBreakdown: {
          Low: {
            $size: {
              $filter: {
                input: '$severityBreakdown',
                cond: { $eq: ['$$this', 'Low'] }
              }
            }
          },
          Medium: {
            $size: {
              $filter: {
                input: '$severityBreakdown',
                cond: { $eq: ['$$this', 'Medium'] }
              }
            }
          },
          High: {
            $size: {
              $filter: {
                input: '$severityBreakdown',
                cond: { $eq: ['$$this', 'High'] }
              }
            }
          },
          Critical: {
            $size: {
              $filter: {
                input: '$severityBreakdown',
                cond: { $eq: ['$$this', 'Critical'] }
              }
            }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalDetections: 0,
    bullyingDetections: 0,
    bullyingRate: 0,
    avgConfidence: 0,
    blockedCount: 0,
    reportedCount: 0,
    severityBreakdown: { Low: 0, Medium: 0, High: 0, Critical: 0 }
  };
};

// Get trending patterns
detectionSchema.statics.getTrendingWords = async function(userId, timeRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const results = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId.createFromHexString(userId),
        'result.label': 'Bullying',
        createdAt: { $gte: startDate }
      }
    },
    { $unwind: '$result.flaggedWords' },
    {
      $group: {
        _id: '$result.flaggedWords.word',
        count: { $sum: 1 },
        avgWeight: { $avg: '$result.flaggedWords.weight' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  return results;
};

// Get platform analytics
detectionSchema.statics.getPlatformStats = async function(timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  return this.aggregate([
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
        avgConfidence: { $avg: '$result.confidence' }
      }
    },
    {
      $project: {
        platform: '$_id',
        _id: 0,
        totalDetections: 1,
        bullyingDetections: 1,
        bullyingRate: {
          $divide: ['$bullyingDetections', '$totalDetections']
        },
        avgConfidence: 1
      }
    }
  ]);
};

export default mongoose.model('Detection', detectionSchema);