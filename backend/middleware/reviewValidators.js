import { body, param, query, validationResult } from 'express-validator';
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
export const reviewCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reviews per hour
  message: {
    success: false,
    message: 'Too many reviews created. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `review-create-${req.user?.userId || req.ip}`,
});

export const reviewUpdateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 updates per minute
  message: {
    success: false,
    message: 'Too many review updates. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reviewInteractionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 likes/unlikes per minute
  message: {
    success: false,
    message: 'Too many actions. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reviewQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reviewReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reports per hour
  message: {
    success: false,
    message: 'Too many reports. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
export const createReviewValidators = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .custom(isCuid)
    .withMessage('Invalid order ID format'),
  
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(isCuid)
    .withMessage('Invalid product ID format'),
  
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
    .toInt(),
  
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters')
    .matches(/^[a-zA-Z0-9\s\-.,!?'"()]+$/)
    .withMessage('Title contains invalid characters')
    .escape(),
  
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Comment must not exceed 2000 characters')
    .escape(),
];

export const updateReviewValidators = [
  param('reviewId')
    .custom(isCuid)
    .withMessage('Invalid review ID format'),
  
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
    .toInt(),
  
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters')
    .matches(/^[a-zA-Z0-9\s\-.,!?'"()]+$/)
    .withMessage('Title contains invalid characters')
    .escape(),
  
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Comment must not exceed 2000 characters')
    .escape(),
];

export const reviewIdValidator = [
  param('reviewId')
    .custom(isCuid)
    .withMessage('Invalid review ID format'),
];

export const productIdValidator = [
  param('productId')
    .custom(isCuid)
    .withMessage('Invalid product ID format'),
];

export const storeIdValidator = [
  param('storeId')
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
];

export const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

export const reviewQueryValidators = [
  ...productIdValidator,
  ...paginationValidators,
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'rating', 'updatedAt'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  query('verifiedOnly')
    .optional()
    .isBoolean()
    .withMessage('verifiedOnly must be a boolean')
    .toBoolean(),
];

export const storeReviewsQueryValidators = [
  ...storeIdValidator,
  ...paginationValidators,
  
  query('productId')
    .optional()
    .custom(isCuid)
    .withMessage('Invalid product ID format'),
];

export const sellerStoreReviewsValidators = [
  ...paginationValidators,
  
  query('productId')
    .optional()
    .custom(isCuid)
    .withMessage('Invalid product ID format'),
];

export const reviewResponseValidators = [
  param('reviewId')
    .custom(isCuid)
    .withMessage('Invalid review ID format'),
  
  body('response')
    .notEmpty()
    .withMessage('Response is required')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Response must be between 10 and 1000 characters')
    .escape(),
];

export const reportReviewValidators = [
  param('reviewId')
    .custom(isCuid)
    .withMessage('Invalid review ID format'),
  
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn([
      'spam',
      'inappropriate',
      'offensive',
      'fake',
      'misleading',
      'harassment',
      'other'
    ])
    .withMessage('Invalid reason'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .escape(),
];

// Validate review media files
export const validateReviewMedia = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(); // Media is optional
  }

  // Max 5 files
  if (req.files.length > 5) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 5 media files allowed'
    });
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  for (const file of req.files) {
    // Size check
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} exceeds maximum size of 5MB`
      });
    }

    // Type check
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} has invalid type. Only JPEG, PNG, and WebP allowed`
      });
    }

    // Buffer check
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} is empty or corrupted`
      });
    }

    // Minimum size check (prevent fake files)
    if (file.size < 1024) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} is too small. Please upload valid images`
      });
    }
  }

  next();
};

// Prevent review spam by limiting reviews per product
export const preventReviewSpam = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    // Check how many reviews user has created in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentReviews = await prisma.review.count({
      where: {
        userId,
        createdAt: {
          gte: oneHourAgo
        }
      }
    });

    if (recentReviews >= 10) {
      return res.status(429).json({
        success: false,
        message: 'You have reached the maximum number of reviews per hour (10).'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking review spam:', error);
    next(); // Don't block on error
  }
};