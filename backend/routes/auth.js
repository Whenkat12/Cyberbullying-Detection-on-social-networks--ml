import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
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

// Register new user
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .trim()
    .escape(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters')
    .trim()
    .escape(),
  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters')
    .trim()
    .escape()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictError('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictError('Username already taken');
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      profile: {
        firstName,
        lastName
      }
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        role: user.role,
        createdAt: user.createdAt
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', [
  body('emailOrUsername')
    .notEmpty()
    .withMessage('Email or username is required')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername }
      ]
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        role: user.role,
        settings: user.settings,
        subscription: user.subscription,
        stats: user.stats,
        lastLogin: user.lastLogin
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        role: user.role,
        settings: user.settings,
        subscription: user.subscription,
        stats: user.stats,
        socialMedia: user.socialMedia,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }
    next(error);
  }
});

// Logout (optional - mainly for client-side token removal)
router.post('/logout', (req, res) => {
  // In a stateless JWT system, logout is mainly handled client-side
  // But we can still provide this endpoint for consistency
  res.json({
    message: 'Logout successful'
  });
});

// Password reset request
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal whether user exists
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // TODO: Implement password reset email sending
    // For now, just return success message
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;