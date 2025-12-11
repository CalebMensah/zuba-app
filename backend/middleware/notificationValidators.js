import { body, param, query, validationResult } from 'express-validator';

// Validation middleware to check results
export const validate = (req, res, next) => {
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

// CUID validation regex
const CUID_REGEX = /^c[a-z0-9]{24}$/;

// Sanitization helper
const sanitizeString = (value) => {
  if (!value) return value;
  return value.trim().replace(/[<>]/g, '');
};

// Validation rules for createNotification
export const createNotificationValidation = [
  body('userId')
    .matches(CUID_REGEX)
    .withMessage('Invalid user ID format'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .customSanitizer(sanitizeString),

  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Message must be between 5 and 1000 characters')
    .customSanitizer(sanitizeString),

  body('type')
    .trim()
    .notEmpty()
    .withMessage('Type is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Type must be between 2 and 50 characters')
    .matches(/^[a-z_]+$/)
    .withMessage('Type must be lowercase letters and underscores only (e.g., order_placed)')
    .customSanitizer(sanitizeString),

  body('data')
    .optional({ nullable: true })
    .custom((value) => {
      if (value !== null && value !== undefined) {
        // Ensure it's a valid object
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Data must be a valid JSON object');
        }
        // Check size (stringify and check length)
        const jsonString = JSON.stringify(value);
        if (jsonString.length > 5000) {
          throw new Error('Data object is too large (max 5000 characters when stringified)');
        }
      }
      return true;
    }),

  validate
];

// Validation rules for getUserNotifications
export const getUserNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('read')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Read filter must be "true" or "false"'),

  validate
];

// Validation rules for markNotificationAsRead
export const markNotificationAsReadValidation = [
  param('notificationId')
    .matches(CUID_REGEX)
    .withMessage('Invalid notification ID format'),

  validate
];

// Validation rules for getNotificationById
export const getNotificationByIdValidation = [
  param('notificationId')
    .matches(CUID_REGEX)
    .withMessage('Invalid notification ID format'),

  validate
];