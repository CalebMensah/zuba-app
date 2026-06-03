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

const VALID_DELIVERY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'DISPATCHED',
  'DELIVERED',
  'FAILED',
  'RETURNED'
];

const VALID_PROOF_TYPES = [
  'HANDOVER_PHOTO',
  'WAYBILL',
  'DISPATCH_RECEIPT',
  'DELIVERY_PHOTO',
  'BUYER_SIGNATURE',
  'OTP_CONFIRMATION'
];

export const shipOrderValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('courierService')
    .trim()
    .notEmpty()
    .withMessage('Courier service is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Courier service must be between 2 and 100 characters')
    .customSanitizer(sanitizeString),

  body('trackingNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tracking number must be between 3 and 100 characters')
    .matches(/^[A-Z0-9\-]+$/i)
    .withMessage('Tracking number can only contain alphanumeric characters and hyphens')
    .customSanitizer(sanitizeString),

  body('estimatedDeliveryDays')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 365 })
    .withMessage('Estimated delivery days must be a positive integer between 1 and 365')
    .toInt(),

  body('dispatchNote')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Dispatch note must not exceed 1000 characters')
    .customSanitizer(sanitizeString),

  validate
];

export const getDeliveryInfoValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  validate
];

export const updateDeliveryInfoValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('courierService')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Courier service must be between 2 and 100 characters')
    .customSanitizer(sanitizeString),

  body('trackingNumber')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tracking number must be between 3 and 100 characters')
    .matches(/^[A-Z0-9\-]+$/i)
    .withMessage('Tracking number can only contain alphanumeric characters and hyphens')
    .customSanitizer(sanitizeString),

  body('estimatedDeliveryDays')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 365 })
    .withMessage('Estimated delivery days must be a positive integer between 1 and 365')
    .toInt(),

  body('dispatchNote')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Dispatch note must not exceed 1000 characters')
    .customSanitizer(sanitizeString),

  body('status')
    .optional()
    .trim()
    .isIn(VALID_DELIVERY_STATUSES)
    .withMessage(`Invalid status. Must be one of: ${VALID_DELIVERY_STATUSES.join(', ')}`),

  validate
];

export const addDeliveryProofValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('type')
    .trim()
    .notEmpty()
    .withMessage('Proof type is required')
    .isIn(VALID_PROOF_TYPES)
    .withMessage(`Type must be one of: ${VALID_PROOF_TYPES.join(', ')}`),

  body('note')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters')
    .customSanitizer(sanitizeString),

  validate
];


export const getAllSellerDeliveriesValidation = [
  query('status')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value !== 'ALL' && !VALID_DELIVERY_STATUSES.includes(value)) {
        throw new Error(`Invalid status. Must be 'ALL' or one of: ${VALID_DELIVERY_STATUSES.join(', ')}`);
      }
      return true;
    }),

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

  validate
];

export const getBuyerDeliveriesValidation = [
  query('status')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value !== 'ALL' && !VALID_DELIVERY_STATUSES.includes(value)) {
        throw new Error(`Invalid status. Must be 'ALL' or one of: ${VALID_DELIVERY_STATUSES.join(', ')}`);
      }
      return true;
    }),

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

  validate
];

export const getSellerDeliveryStatsValidation = [
  validate
];