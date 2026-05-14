import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platformMessageId: String, // Original platform message ID
  text: {
    type: String,
    required: true,
    maxlength: 5000
  },
  sender: {
    type: String,
    enum: ['user', 'contact'],
    required: true
  },
  detection: {
    label: {
      type: String,
      enum: ['Bullying', 'Non-Bullying'],
      default: 'Non-Bullying'
    },
    confidence: {
      type: Number,
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
    details: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'blocked', 'deleted'],
    default: 'sent'
  },
  actions: {
    blocked: { type: Boolean, default: false },
    blockedReason: String,
    userAction: {
      type: String,
      enum: ['agree', 'disagree', 'ignore'],
      default: 'ignore'
    },
    feedback: String
  },
  metadata: {
    platform: {
      type: String,
      enum: ['whatsapp', 'instagram', 'twitter', 'facebook'],
      required: true
    },
    timestamp: Date, // Original platform timestamp
    edited: { type: Boolean, default: false },
    editedAt: Date,
    replyTo: String, // Message ID this is replying to
    attachments: [{
      type: String,
      url: String,
      size: Number,
      mimeType: String
    }],
    reactions: [{
      emoji: String,
      userId: String
    }]
  },
  processing: {
    processed: { type: Boolean, default: false },
    processedAt: Date,
    processingTime: Number, // milliseconds
    modelVersion: String,
    cacheHit: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ 'detection.label': 1, createdAt: -1 });
messageSchema.index({ 'detection.severity': 1 });
messageSchema.index({ platformMessageId: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ 'processing.processed': 1 });

// Compound indexes
messageSchema.index({ chatId: 1, 'detection.label': 1, createdAt: -1 });
messageSchema.index({ userId: 1, 'detection.label': 1, createdAt: -1 });

// Text index for message search
messageSchema.index({ text: 'text' });

// Virtual for chat relationship
messageSchema.virtual('chat', {
  ref: 'Chat',
  localField: 'chatId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to process message
messageSchema.pre('save', async function(next) {
  if (this.isNew && !this.metadata.timestamp) {
    this.metadata.timestamp = new Date();
  }
  next();
});

// Method to mark as processed
messageSchema.methods.markAsProcessed = function(detection, processingTime, modelVersion) {
  this.processing.processed = true;
  this.processing.processedAt = new Date();
  this.processing.processingTime = processingTime;
  this.processing.modelVersion = modelVersion;
  
  if (detection) {
    this.detection = detection;
    
    // Update chat statistics
    if (detection.label === 'Bullying') {
      this.model('Chat').findByIdAndUpdate(this.chatId, {
        $inc: { 
          'statistics.bullyingDetections': 1,
          'statistics.lastDetection': new Date()
        }
      }).exec();
    }
  }
  
  return this.save();
};

// Method to block message
messageSchema.methods.block = function(reason = 'Bullying content detected') {
  this.status = 'blocked';
  this.actions.blocked = true;
  this.actions.blockedReason = reason;
  
  // Update chat blocked messages count
  this.model('Chat').findByIdAndUpdate(this.chatId, {
    $inc: { 'statistics.blockedMessages': 1 }
  }).exec();
  
  return this.save();
};

// Static method to get recent messages
messageSchema.statics.getRecentMessages = function(chatId, limit = 50) {
  return this.find({ chatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('chat', 'contactInfo status')
    .lean();
};

// Static method to get messages requiring review
messageSchema.statics.getMessagesForReview = function(userId, options = {}) {
  const query = {
    userId: mongoose.Types.ObjectId.createFromHexString(userId),
    'detection.label': 'Bullying',
    'actions.userAction': 'ignore'
  };

  if (options.severity) {
    query['detection.severity'] = options.severity;
  }

  if (options.platform) {
    query['metadata.platform'] = options.platform;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .populate('chat', 'contactInfo status')
    .lean();
};

// Static method to get analytics
messageSchema.statics.getMessageAnalytics = async function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const analytics = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId.createFromHexString(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        bullyingMessages: {
          $sum: { $cond: [{ $eq: ['$detection.label', 'Bullying'] }, 1, 0] }
        },
        blockedMessages: {
          $sum: { $cond: ['$actions.blocked', 1, 0] }
        },
        avgProcessingTime: { $avg: '$processing.processingTime' },
        avgConfidence: { $avg: '$detection.confidence' }
      }
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        bullyingMessages: 1,
        blockedMessages: 1,
        avgProcessingTime: 1,
        avgConfidence: 1,
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

  return analytics[0] || {
    totalMessages: 0,
    bullyingMessages: 0,
    blockedMessages: 0,
    avgProcessingTime: 0,
    avgConfidence: 0,
    bullyingRate: 0
  };
};

export default mongoose.model('Message', messageSchema);