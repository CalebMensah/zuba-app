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

// Valid delivery statuses
const VALID_DELIVERY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED'
];

// URL validation regex
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// Phone number validation (international format)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

// Sanitization helper
const sanitizeString = (value) => {
  if (!value) return value;
  return value.trim().replace(/[<>]/g, '');
};

// Vehicle number validation (alphanumeric with hyphens/spaces)
const VEHICLE_NUMBER_REGEX = /^[A-Z0-9\s\-]{3,20}$/i;

// CUID validation regex (starts with 'c', followed by timestamp and random string)
const CUID_REGEX = /^c[a-z0-9]{24}$/;

// Validation rules for assignCourier
export const assignCourierValidation = [
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

  body('driverName')
    .trim()
    .notEmpty()
    .withMessage('Driver name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Driver name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Driver name contains invalid characters')
    .customSanitizer(sanitizeString),

  body('driverPhone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Invalid phone number format. Use international format (e.g., +1234567890)'),

  body('driverVehicleNumber')
    .trim()
    .notEmpty()
    .withMessage('Driver vehicle number is required')
    .matches(VEHICLE_NUMBER_REGEX)
    .withMessage('Invalid vehicle number format')
    .customSanitizer(value => value.toUpperCase()),

  body('trackingNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tracking number must be between 3 and 100 characters')
    .matches(/^[A-Z0-9\-]+$/i)
    .withMessage('Tracking number can only contain alphanumeric characters and hyphens')
    .customSanitizer(sanitizeString),

  body('trackingUrl')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(URL_REGEX)
    .withMessage('Invalid tracking URL format')
    .isLength({ max: 500 })
    .withMessage('Tracking URL is too long'),

  body('estimatedDelivery')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format for estimated delivery')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date < now) {
        throw new Error('Estimated delivery must be in the future');
      }
      return true;
    }),

  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
    .customSanitizer(sanitizeString),

  validate
];

// Validation rules for getDeliveryInfoByOrderId
export const getDeliveryInfoValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  validate
];

// Validation rules for editAssignedDeliveryCourierInfo
export const editDeliveryCourierValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('courierService')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Courier service must be between 2 and 100 characters')
    .customSanitizer(sanitizeString),

  body('driverName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Driver name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Driver name contains invalid characters')
    .customSanitizer(sanitizeString),

  body('driverPhone')
    .optional({ nullable: true })
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Invalid phone number format'),

  body('driverVehicleNumber')
    .optional()
    .trim()
    .matches(VEHICLE_NUMBER_REGEX)
    .withMessage('Invalid vehicle number format')
    .customSanitizer(value => value.toUpperCase()),

  body('trackingNumber')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tracking number must be between 3 and 100 characters')
    .matches(/^[A-Z0-9\-]+$/i)
    .withMessage('Tracking number can only contain alphanumeric characters and hyphens')
    .customSanitizer(sanitizeString),

  body('trackingUrl')
    .optional({ nullable: true })
    .trim()
    .matches(URL_REGEX)
    .withMessage('Invalid tracking URL format')
    .isLength({ max: 500 })
    .withMessage('Tracking URL is too long'),

  body('estimatedDelivery')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Invalid date format for estimated delivery'),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
    .customSanitizer(sanitizeString),

  // SECURITY: Explicitly reject status field in edit endpoint
  body('status')
    .not()
    .exists()
    .withMessage('Status cannot be updated through this endpoint. Use the setDeliveryStatus endpoint instead.'),

  validate
];

// Validation rules for deleteAssignedDeliveryCourierInfo
export const deleteDeliveryCourierValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  validate
];

// Validation rules for setDeliveryStatus
export const setDeliveryStatusValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(VALID_DELIVERY_STATUSES)
    .withMessage(`Invalid delivery status. Must be one of: ${VALID_DELIVERY_STATUSES.join(', ')}`),

  validate
];

// Validation rules for getAllSellerDeliveries
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

// Validation rules for getSellerDeliveryStats
export const getSellerDeliveryStatsValidation = [
  validate
];