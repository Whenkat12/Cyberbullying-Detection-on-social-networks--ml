import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'instagram', 'twitter', 'facebook'],
    required: true
  },
  contactId: {
    type: String,
    required: true
  },
  contactInfo: {
    name: { type: String, required: true },
    username: String,
    avatar: String,
    phone: String,
    email: String
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'archived', 'deleted'],
    default: 'active'
  },
  settings: {
    autoBlock: { type: Boolean, default: false },
    blockThreshold: { type: Number, default: 3 },
    notifications: { type: Boolean, default: true },
    monitoringEnabled: { type: Boolean, default: true }
  },
  statistics: {
    totalMessages: { type: Number, default: 0 },
    bullyingDetections: { type: Number, default: 0 },
    blockedMessages: { type: Number, default: 0 },
    lastActivity: Date,
    lastDetection: Date
  },
  strikeCount: { type: Number, default: 0 },
  blockedAt: Date,
  blockedReason: String,
  metadata: {
    platformThreadId: String,
    platformChatId: String,
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'pending'
    },
    lastSyncAttempt: Date,
    syncError: String
  }
}, {
  timestamps: true
});

// Indexes
chatSchema.index({ userId: 1, platform: 1 });
chatSchema.index({ userId: 1, contactId: 1, platform: 1 }, { unique: true });
chatSchema.index({ status: 1 });
chatSchema.index({ 'statistics.lastActivity': -1 });
chatSchema.index({ 'statistics.bullyingDetections': -1 });

// Virtual for messages
chatSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chatId'
});

// Method to increment strike count
chatSchema.methods.incrementStrike = async function() {
  this.strikeCount += 1;
  this.statistics.bullyingDetections += 1;
  this.statistics.lastDetection = new Date();
  
  if (this.strikeCount >= this.settings.blockThreshold && this.settings.autoBlock) {
    this.status = 'blocked';
    this.blockedAt = new Date();
    this.blockedReason = 'Automatic block due to repeated bullying';
  }
  
  return this.save();
};

// Method to block chat
chatSchema.methods.block = async function(reason = 'Manual block') {
  this.status = 'blocked';
  this.blockedAt = new Date();
  this.blockedReason = reason;
  return this.save();
};

// Method to unblock chat
chatSchema.methods.unblock = async function() {
  this.status = 'active';
  this.strikeCount = 0;
  this.blockedAt = null;
  this.blockedReason = null;
  return this.save();
};

// Static method to get active chats
chatSchema.statics.getActiveChats = function(userId) {
  return this.find({ 
    userId, 
    status: 'active',
    'settings.monitoringEnabled': true 
  }).sort({ 'statistics.lastActivity': -1 });
};

// Static method to get blocked chats
chatSchema.statics.getBlockedChats = function(userId) {
  return this.find({ 
    userId, 
    status: 'blocked' 
  }).sort({ blockedAt: -1 });
};

// Static method to get chat statistics
chatSchema.statics.getChatStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId.createFromHexString(userId) } },
    {
      $group: {
        _id: null,
        totalChats: { $sum: 1 },
        activeChats: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        blockedChats: {
          $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
        },
        totalMessages: { $sum: '$statistics.totalMessages' },
        totalDetections: { $sum: '$statistics.bullyingDetections' },
        totalBlockedMessages: { $sum: '$statistics.blockedMessages' }
      }
    },
    {
      $project: {
        _id: 0,
        totalChats: 1,
        activeChats: 1,
        blockedChats: 1,
        totalMessages: 1,
        totalDetections: 1,
        totalBlockedMessages: 1,
        averageDetectionsPerChat: {
          $cond: [
            { $gt: ['$totalChats', 0] },
            { $divide: ['$totalDetections', '$totalChats'] },
            0
          ]
        }
      }
    }
  ]);

  return stats[0] || {
    totalChats: 0,
    activeChats: 0,
    blockedChats: 0,
    totalMessages: 0,
    totalDetections: 0,
    totalBlockedMessages: 0,
    averageDetectionsPerChat: 0
  };
};

export default mongoose.model('Chat', chatSchema);