import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

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

// File validation middleware - checks file properties after multer processes them
export const validateVerificationFiles = (req, res, next) => {
  const { ghanaCardFront, ghanaCardBack, selfie, businessDoc } = req.files || {};
  
  // Check required files
  if (!ghanaCardFront || !ghanaCardBack || !selfie) {
    return res.status(400).json({
      success: false,
      message: 'Ghana Card Front, Ghana Card Back, and Selfie are required'
    });
  }

  const filesToValidate = [
    { file: ghanaCardFront[0], name: 'Ghana Card Front' },
    { file: ghanaCardBack[0], name: 'Ghana Card Back' },
    { file: selfie[0], name: 'Selfie' },
  ];

  // Add optional business doc if present
  if (businessDoc && businessDoc[0]) {
    filesToValidate.push({ file: businessDoc[0], name: 'Business Document' });
  }

  // Validate each file
  for (const { file, name } of filesToValidate) {
    // Size check (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: `${name} exceeds maximum size of 5MB`
      });
    }

    // Mimetype check
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `${name} must be a valid image (JPEG, PNG, or WebP)`
      });
    }

    // Buffer check
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${name} is empty or corrupted`
      });
    }

    // Check for minimum file size (to prevent empty/fake files)
    if (file.size < 1024) { // Less than 1KB
      return res.status(400).json({
        success: false,
        message: `${name} is too small. Please upload a valid image`
      });
    }
  }

  next();
};

// Rate limiters
export const verificationSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 submissions per hour per IP
  message: {
    success: false,
    message: 'Too many verification submissions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Rate limit by both IP and user ID for better protection
    return `${req.ip}-${req.user?.userId || 'anonymous'}`;
  }
});

export const verificationStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 actions per minute
  message: {
    success: false,
    message: 'Too many admin actions. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
export const submitVerificationValidators = [
  body('rejectionReason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rejection reason must not exceed 500 characters')
    .escape(),
];

// CUID validation helper
const isCuid = (value) => {
  // CUID format: starts with 'c', followed by timestamp and random string
  // Example: cl9x8abcd1234567890
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return cuidRegex.test(value);
};

export const updateStatusValidators = [
  param('verificationId')
    .custom(isCuid)
    .withMessage('Invalid verification ID format'),
  body('status')
    .isIn(['verified', 'rejected'])
    .withMessage('Status must be either "verified" or "rejected"'),
  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting')
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters')
    .escape(),
];

export const verificationIdValidator = [
  param('verificationId')
    .custom(isCuid)
    .withMessage('Invalid verification ID format'),
];

export const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer and not exceed 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

export const getAllVerificationsValidators = [
  ...paginationValidators,
  query('status')
    .optional()
    .isIn(['pending', 'verified', 'rejected'])
    .withMessage('Invalid status. Must be pending, verified, or rejected'),
  query('storeId')
    .optional()
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
    // Sanitize to prevent injection attacks
    .matches(/^[a-zA-Z0-9\s@._-]+$/)
    .withMessage('Search contains invalid characters')
    .escape(),
];