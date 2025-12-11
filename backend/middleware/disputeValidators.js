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

// Valid dispute types
const VALID_DISPUTE_TYPES = [
  'REFUND_REQUEST',
  'ITEM_NOT_AS_DESCRIBED',
  'ITEM_NOT_RECEIVED',
  'WRONG_ITEM_SENT',
  'DAMAGED_ITEM',
  'OTHER'
];

// Valid dispute statuses
const VALID_DISPUTE_STATUSES = ['PENDING', 'RESOLVED', 'CANCELLED'];

// Valid resolution statuses
const VALID_RESOLUTION_STATUSES = ['RESOLVED', 'CANCELLED'];

// Sanitization helper
const sanitizeString = (value) => {
  if (!value) return value;
  return value.trim().replace(/[<>]/g, '');
};

// Validation rules for requestRefund
export const requestRefundValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Refund reason is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Reason must be between 10 and 2000 characters')
    .customSanitizer(sanitizeString),

  body('type')
    .optional()
    .trim()
    .isIn(VALID_DISPUTE_TYPES)
    .withMessage(`Invalid dispute type. Must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`),

  validate
];

// Validation rules for resolveDispute
export const resolveDisputeValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(VALID_RESOLUTION_STATUSES)
    .withMessage(`Status must be one of: ${VALID_RESOLUTION_STATUSES.join(', ')}`),

  body('resolution')
    .trim()
    .notEmpty()
    .withMessage('Resolution details are required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Resolution must be between 10 and 2000 characters')
    .customSanitizer(sanitizeString),

  body('refundAmount')
    .optional({ nullable: true })
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be a positive number')
    .toFloat(),

  validate
];

// Validation rules for getDisputeDetails
export const getDisputeDetailsValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  validate
];

// Validation rules for getUserDisputes
export const getUserDisputesValidation = [
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

  query('status')
    .optional()
    .trim()
    .isIn(VALID_DISPUTE_STATUSES)
    .withMessage(`Invalid status. Must be one of: ${VALID_DISPUTE_STATUSES.join(', ')}`),

  query('type')
    .optional()
    .trim()
    .isIn(VALID_DISPUTE_TYPES)
    .withMessage(`Invalid type. Must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`),

  validate
];

// Validation rules for getAllDisputes (admin)
export const getAllDisputesValidation = [
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

  query('status')
    .optional()
    .trim()
    .isIn(VALID_DISPUTE_STATUSES)
    .withMessage(`Invalid status. Must be one of: ${VALID_DISPUTE_STATUSES.join(', ')}`),

  query('type')
    .optional()
    .trim()
    .isIn(VALID_DISPUTE_TYPES)
    .withMessage(`Invalid type. Must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`),

  validate
];

// Validation rules for updateDispute
export const updateDisputeValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  body('additionalInfo')
    .trim()
    .notEmpty()
    .withMessage('Additional information is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Additional information must be between 10 and 2000 characters')
    .customSanitizer(sanitizeString),

  validate
];

// Validation rules for cancelDispute
export const cancelDisputeValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  body('reason')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Reason must not exceed 1000 characters')
    .customSanitizer(sanitizeString),

  validate
];