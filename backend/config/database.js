import mongoose from 'mongoose';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'CyberGuard-db' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/CyberGuard';
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    };

    await mongoose.connect(mongoURI, options);
    
    logger.info('✅ MongoDB connected successfully');
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      logger.info('📡 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🔌 Mongoose disconnected from MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 Mongoose reconnected to MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 SIGINT received, closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 SIGTERM received, closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    // Continue running without DB (for local/demo mode)
    return false;
  }
};

// Database health check
export const checkDBHealth = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return { status: 'healthy', latency: await getDBLatency() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};

// Get database latency
export const getDBLatency = async () => {
  const start = Date.now();
  await mongoose.connection.db.admin().ping();
  return Date.now() - start;
};

// Get database stats
export const getDBStats = async () => {
  try {
    const stats = await mongoose.connection.db.stats();
    return {
      database: stats.db,
      collections: stats.collections,
      dataSize: stats.dataSize,
      indexSize: stats.indexSize,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize
    };
  } catch (error) {
    logger.error('❌ Failed to get database stats:', error);
    return null;
  }
};

export default mongoose;