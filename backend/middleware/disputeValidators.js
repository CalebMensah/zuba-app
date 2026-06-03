import { body, param, validationResult } from 'express-validator';

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

// Valid resolution outcomes
const VALID_OUTCOMES = ['BUYER_WON', 'SELLER_WON'];

// Sanitization helper
const sanitizeString = (value) => {
  if (!value) return value;
  return value.trim().replace(/[<>]/g, '');
};

// ── POST /:orderId/open ───────────────────────────────────────────────────────
export const openDisputeValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Reason must be between 10 and 2000 characters')
    .customSanitizer(sanitizeString),

  body('type')
    .trim()
    .notEmpty()
    .withMessage('Dispute type is required')
    .isIn(VALID_DISPUTE_TYPES)
    .withMessage(`Type must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`),

  validate
];

// ── PATCH /:disputeId/resolve ─────────────────────────────────────────────────
export const resolveDisputeValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  body('outcome')
    .trim()
    .notEmpty()
    .withMessage('Outcome is required')
    .isIn(VALID_OUTCOMES)
    .withMessage(`Outcome must be one of: ${VALID_OUTCOMES.join(', ')}`),

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

// ── GET /:disputeId ───────────────────────────────────────────────────────────
export const getDisputeValidation = [
  param('disputeId')
    .matches(CUID_REGEX)
    .withMessage('Invalid dispute ID format'),

  validate
];

// ── PATCH /:disputeId/cancel ──────────────────────────────────────────────────
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