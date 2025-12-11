import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

// CUID validation helper
const isCuid = (value) => {
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return cuidRegex.test(value);
};

// Store URL validation helper
const isValidStoreUrl = (value) => {
  // Allow alphanumeric, hyphens, and underscores (3-50 chars)
  const urlRegex = /^[a-z0-9_-]{3,50}$/i;
  return urlRegex.test(value);
};

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Rate limiters
export const followActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 follow/unfollow actions per hour
  message: {
    success: false,
    message: 'Too many follow/unfollow actions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `follow-action-${req.user?.userId || req.ip}`;
  }
});

export const followQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
export const followStoreValidators = [
  body('storeId')
    .notEmpty()
    .withMessage('Store ID is required')
    .custom(isCuid)
    .withMessage('Invalid store ID format')
    .trim(),
];

export const unfollowStoreValidators = [
  body('storeId')
    .notEmpty()
    .withMessage('Store ID is required')
    .custom(isCuid)
    .withMessage('Invalid store ID format')
    .trim(),
];

export const storeUrlValidator = [
  param('storeUrl')
    .notEmpty()
    .withMessage('Store URL is required')
    .custom(isValidStoreUrl)
    .withMessage('Invalid store URL format. Must be 3-50 characters, alphanumeric with hyphens/underscores')
    .trim()
    .escape(),
];

// Prevent excessive following (user trying to follow too many stores)
export const preventSpamFollowing = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `follow-count:${userId}`;
    
    // Get follow count from cache or database
    let followCount = await cache.get(cacheKey);
    
    if (followCount === null) {
      followCount = await prisma.storeFollower.count({
        where: { userId }
      });
      await cache.set(cacheKey, followCount, 3600); // Cache for 1 hour
    }
    
    // Limit to 1000 followed stores per user
    if (followCount >= 1000) {
      return res.status(429).json({
        success: false,
        message: 'You have reached the maximum number of stores you can follow (1000).'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking follow limit:', error);
    next(); // Don't block request on error
  }
};