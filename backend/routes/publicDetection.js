import express from 'express';
import { body, validationResult } from 'express-validator';
import { cyberbullyingDetector } from '../services/CyberbullyingDetector.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

router.post('/detect', [
  body('text').isString().isLength({ min: 1, max: 5000 }).withMessage('Text must be between 1 and 5000 characters')
], handleValidationErrors, (req, res) => {
  if (!cyberbullyingDetector.isModelLoaded()) {
    return res.status(503).json({ error: 'ML model not loaded' });
  }

  const { text } = req.body;
  const result = cyberbullyingDetector.detect(text);
  res.json({ text, result });
});

router.post('/batch-detect', [
  body('texts').isArray({ min: 1, max: 100 }).withMessage('Texts must be an array with 1-100 items'),
  body('texts.*.text').isString().isLength({ min: 1, max: 5000 }).withMessage('Each text must be between 1 and 5000 characters'),
], handleValidationErrors, (req, res) => {
  if (!cyberbullyingDetector.isModelLoaded()) {
    return res.status(503).json({ error: 'ML model not loaded' });
  }

  const results = req.body.texts.map((item) => ({
    text: item.text,
    result: cyberbullyingDetector.detect(item.text)
  }));

  res.json({ results });
});

export default router;
