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

// Validation rules for confirmOrderReceived
export const confirmOrderReceivedValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  validate
];

// Validation rules for getEscrowDetails
export const getEscrowDetailsValidation = [
  param('escrowId')
    .matches(CUID_REGEX)
    .withMessage('Invalid escrow ID format'),

  validate
];

// Validation rules for getOrderEscrowStatus
export const getOrderEscrowStatusValidation = [
  param('orderId')
    .matches(CUID_REGEX)
    .withMessage('Invalid order ID format'),

  validate
];

// Validation rules for getPendingEscrows (admin)
export const getPendingEscrowsValidation = [
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