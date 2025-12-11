import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

// CUID validation helper
const isCuid = (value) => {
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return cuidRegex.test(value);
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
export const likeActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 like/unlike actions per minute
  message: {
    success: false,
    message: 'Too many like/unlike actions. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `like-action-${req.user?.userId || req.ip}`;
  }
});

export const likeQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 queries per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
export const likeProductValidators = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isCuid)
    .withMessage('Invalid product ID format')
    .trim(),
];

export const unlikeProductValidators = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isCuid)
    .withMessage('Invalid product ID format')
    .trim(),
];

export const productIdValidator = [
  param('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isCuid)
    .withMessage('Invalid product ID format'),
];

// Prevent like spam
export const preventLikeSpam = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    // Check how many products user has liked in total
    const totalLikes = await prisma.productLike.count({
      where: { userId }
    });
    
    // Limit to 10,000 liked products per user
    if (totalLikes >= 10000) {
      return res.status(429).json({
        success: false,
        message: 'You have reached the maximum number of liked products (10,000).'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking like limit:', error);
    next(); // Don't block on error
  }
};