import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

// CUID validation helper
const isCuid = (value) => {
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return cuidRegex.test(value);
};

// Store URL/slug validation helper
const isValidStoreUrl = (value) => {
  // Allow alphanumeric, hyphens (3-50 chars), lowercase
  const urlRegex = /^[a-z0-9-]{3,50}$/;
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
export const storeCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 store creation attempts per hour
  message: {
    success: false,
    message: 'Too many store creation attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `store-create-${req.user?.userId || req.ip}`;
  }
});

export const storeUpdateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 updates per minute
  message: {
    success: false,
    message: 'Too many update requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const storeQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
export const createStoreValidators = [
  body('name')
    .notEmpty()
    .withMessage('Store name is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Store name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&'.]+$/)
    .withMessage('Store name contains invalid characters')
    .escape(),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .escape(),
  
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters')
    .escape(),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-&]+$/)
    .withMessage('Category contains invalid characters')
    .escape(),
  
  body('region')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Region must not exceed 50 characters')
    .escape(),
];

export const updateStoreValidators = [
  param('storeId')
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
  
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Store name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&'.]+$/)
    .withMessage('Store name contains invalid characters')
    .escape(),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .escape(),
  
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters')
    .escape(),
  
  body('category')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-&]+$/)
    .withMessage('Category contains invalid characters')
    .escape(),
];

export const storeIdValidator = [
  param('storeId')
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
];

export const storeUrlValidator = [
  param('url')
    .notEmpty()
    .withMessage('Store URL is required')
    .custom(isValidStoreUrl)
    .withMessage('Invalid store URL format')
    .trim(),
];

export const storeIdParamValidator = [
  param('id')
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
];

export const updateVerificationValidator = [
  param('storeId')
    .custom(isCuid)
    .withMessage('Invalid store ID format'),
  
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

// Validate logo file after multer processing
export const validateLogoFile = (req, res, next) => {
  if (!req.file) {
    return next(); // Logo is optional
  }

  const file = req.file;

  // Size check (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: 'Logo file exceeds maximum size of 5MB'
    });
  }

  // Mimetype check
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Logo must be a valid image (JPEG, PNG, or WebP)'
    });
  }

  // Buffer check
  if (!file.buffer || file.buffer.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Logo file is empty or corrupted'
    });
  }

  // Check for minimum file size (prevent fake files)
  if (file.size < 1024) { // Less than 1KB
    return res.status(400).json({
      success: false,
      message: 'Logo file is too small. Please upload a valid image'
    });
  }

  next();
};