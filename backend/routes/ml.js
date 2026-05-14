import express from 'express';
import { cyberbullyingDetector } from '../services/CyberbullyingDetector.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get ML model information
router.get('/model', async (req, res, next) => {
  try {
    const modelInfo = cyberbullyingDetector.getModelInfo();
    
    if (!modelInfo) {
      throw new AppError('ML model not loaded', 503);
    }

    res.json({
      model: {
        version: modelInfo.version,
        lastUpdated: modelInfo.lastUpdated,
        totalDocs: modelInfo.totalDocs,
        vocabSize: modelInfo.vocabSize,
        totalBully: modelInfo.totalBully,
        totalNonBully: modelInfo.totalNonBully,
        accuracy: modelInfo.accuracy,
        precision: modelInfo.precision,
        recall: modelInfo.recall,
        f1Score: modelInfo.f1Score
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get model vocabulary statistics
router.get('/vocabulary', async (req, res, next) => {
  try {
    const modelInfo = cyberbullyingDetector.getModelInfo();
    
    if (!modelInfo) {
      throw new AppError('ML model not loaded', 503);
    }

    const { vocabulary } = modelInfo;
    const vocabArray = Array.from(vocabulary.entries()).map(([word, stats]) => ({
      word,
      ...stats
    }));

    // Sort by TF-IDF score for bullying
    vocabArray.sort((a, b) => b.tfidfBully - a.tfidfBully);

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const skip = (page - 1) * limit;

    const paginatedVocab = vocabArray.slice(skip, skip + limit);

    res.json({
      vocabulary: paginatedVocab,
      pagination: {
        page,
        limit,
        total: vocabArray.length,
        pages: Math.ceil(vocabArray.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search vocabulary
router.get('/vocabulary/search', async (req, res, next) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters long'
      });
    }

    const modelInfo = cyberbullyingDetector.getModelInfo();
    
    if (!modelInfo) {
      throw new AppError('ML model not loaded', 503);
    }

    const { vocabulary } = modelInfo;
    const results = [];

    for (const [word, stats] of vocabulary.entries()) {
      if (word.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          word,
          ...stats
        });
      }
    }

    // Sort by relevance (TF-IDF score)
    results.sort((a, b) => b.tfidfBully - a.tfidfBully);

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const paginatedResults = results.slice(0, limit);

    res.json({
      results: paginatedResults,
      query,
      total: results.length
    });
  } catch (error) {
    next(error);
  }
});

// Get top bullying words
router.get('/vocabulary/top-bullying', async (req, res, next) => {
  try {
    const modelInfo = cyberbullyingDetector.getModelInfo();
    
    if (!modelInfo) {
      throw new AppError('ML model not loaded', 503);
    }

    const { vocabulary } = modelInfo;
    const topWords = [];

    for (const [word, stats] of vocabulary.entries()) {
      if (stats.bullyCount > 0) {
        topWords.push({
          word,
          bullyCount: stats.bullyCount,
          nonBullyCount: stats.nonBullyCount,
          bullyFreq: stats.bullyFreq,
          tfidfBully: stats.tfidfBully
        });
      }
    }

    // Sort by bullying frequency
    topWords.sort((a, b) => b.tfidfBully - a.tfidfBully);

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const results = topWords.slice(0, limit);

    res.json({
      topBullyingWords: results,
      total: topWords.length
    });
  } catch (error) {
    next(error);
  }
});

// Retrain model (admin only)
router.post('/retrain', async (req, res, next) => {
  try {
    console.log('🚀 Starting model retraining...');
    
    const startTime = Date.now();
    await cyberbullyingDetector.trainModel();
    const trainingTime = Date.now() - startTime;

    res.json({
      message: 'Model retrained successfully',
      trainingTime: `${trainingTime}ms`,
      model: cyberbullyingDetector.getModelInfo()
    });
  } catch (error) {
    next(error);
  }
});

// Update model with new data
router.post('/update', async (req, res, next) => {
  try {
    const { trainingData } = req.body;
    
    if (!trainingData || !Array.isArray(trainingData)) {
      return res.status(400).json({
        error: 'Training data is required and must be an array'
      });
    }

    if (trainingData.length === 0) {
      return res.status(400).json({
        error: 'Training data cannot be empty'
      });
    }

    // Validate training data format
    const validData = trainingData.every(item => 
      item && 
      typeof item.text === 'string' && 
      typeof item.label === 'number' && 
      (item.label === -1 || item.label === 0)
    );

    if (!validData) {
      return res.status(400).json({
        error: 'Invalid training data format. Each item must have text (string) and label (-1 or 0)'
      });
    }

    console.log(`🔄 Updating model with ${trainingData.length} new samples...`);
    
    const startTime = Date.now();
    await cyberbullyingDetector.updateModel(trainingData);
    const updateTime = Date.now() - startTime;

    res.json({
      message: 'Model updated successfully',
      updateTime: `${updateTime}ms`,
      samplesAdded: trainingData.length,
      model: cyberbullyingDetector.getModelInfo()
    });
  } catch (error) {
    next(error);
  }
});

// Test detection
router.post('/test', async (req, res, next) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Text is required and must be a string'
      });
    }

    if (!cyberbullyingDetector.isModelLoaded()) {
      throw new AppError('ML model not loaded', 503);
    }

    const startTime = Date.now();
    const result = cyberbullyingDetector.detect(text);
    const processingTime = Date.now() - startTime;

    res.json({
      text,
      result: {
        ...result,
        processingTime
      },
      modelVersion: cyberbullyingDetector.getModelInfo()?.version
    });
  } catch (error) {
    next(error);
  }
});

// Get model performance metrics
router.get('/performance', async (req, res, next) => {
  try {
    const modelInfo = cyberbullyingDetector.getModelInfo();
    
    if (!modelInfo) {
      throw new AppError('ML model not loaded', 503);
    }

    // Calculate additional metrics
    const { vocabulary, totalBully, totalNonBully } = modelInfo;
    
    let totalWords = 0;
    let bullyWords = 0;
    let avgTfidfBully = 0;
    let maxTfidfBully = 0;
    let minTfidfBully = Infinity;

    for (const [word, stats] of vocabulary.entries()) {
      totalWords++;
      if (stats.bullyCount > 0) bullyWords++;
      avgTfidfBully += stats.tfidfBully;
      maxTfidfBully = Math.max(maxTfidfBully, stats.tfidfBully);
      minTfidfBully = Math.min(minTfidfBully, stats.tfidfBully);
    }

    avgTfidfBully /= totalWords;

    res.json({
      performance: {
        totalWords,
        bullyWords,
        bullyWordsPercentage: (bullyWords / totalWords) * 100,
        avgTfidfBully,
        maxTfidfBully,
        minTfidfBully: minTfidfBully === Infinity ? 0 : minTfidfBully,
        vocabularyUtilization: (bullyWords / totalWords) * 100
      },
      dataset: {
        totalSamples: totalBully + totalNonBully,
        bullySamples: totalBully,
        nonBullySamples: totalNonBully,
        bullyPercentage: (totalBully / (totalBully + totalNonBully)) * 100
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;