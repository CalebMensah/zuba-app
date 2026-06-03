import { body, param } from 'express-validator';

// Password validation regex: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Phone number validation (Ghana local format - 10 digits starting with 0)
const phoneRegex = /^0\d{9}$/;

// Validation rules for signup
export const validateSignup = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
.matches(phoneRegex)
    .withMessage('Phone number must be a valid Ghana local number (e.g., 0241234567)')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(passwordRegex)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  
  body('role')
    .optional()
    .isIn(['BUYER', 'SELLER', 'ADMIN'])
    .withMessage('Role must be BUYER, SELLER, or ADMIN'),
];

// Validation rules for email verification
export const validateEmailVerification = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
];

// Validation rules for resending verification code
export const validateResendVerification = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
];

// Validation rules for login
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Invalid password'),
];

// Validation rules for account deletion request
export const validateAccountDeletionRequest = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Invalid password'),
];

// Validation rules for confirming account deletion
export const validateConfirmAccountDeletion = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Confirmation code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Confirmation code must be 6 digits')
    .isNumeric()
    .withMessage('Confirmation code must contain only numbers'),
];

// Sanitization middleware to prevent XSS
export const sanitizeInputs = (req, res, next) => {
  // Remove any HTML tags from string inputs
  const sanitizeString = (str) => {
    if (typeof str === 'string') {
      return str.replace(/<[^>]*>/g, '');
    }
    return str;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (key !== 'password') { // Don't sanitize password
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  next();
};