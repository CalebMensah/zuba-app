import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  verifyEmail,
  resendVerificationCode,
  login,
  logout,
  getCurrentUser,
  requestAccountDeletion,
  confirmAccountDeletion,
  cancelAccountDeletion,
  refreshToken,
} from '../controllers/authcontroller.js';
import {
  validateSignup,
  validateEmailVerification,
  validateResendVerification,
  validateLogin,
  validateAccountDeletionRequest,
  validateConfirmAccountDeletion,
  sanitizeInputs,
} from '../middleware/authValidation.js';
import { authenticateToken } from '../middleware/authmiddleware.js';


const router = express.Router();

// Rate limiters for different endpoints
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many signup attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendCodeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 requests per window
  message: {
    success: false,
    message: 'Too many resend requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const accountDeletionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    success: false,
    message: 'Too many deletion requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post(
  '/signup',
  signupLimiter,
  sanitizeInputs,
  validateSignup,
  signup
);

router.post(
  '/verify-email',
  verificationLimiter,
  sanitizeInputs,
  validateEmailVerification,
  verifyEmail
);

router.post(
  '/resend-verification',
  resendCodeLimiter,
  sanitizeInputs,
  validateResendVerification,
  resendVerificationCode
);

router.post(
  '/login',
  loginLimiter,
  sanitizeInputs,
  validateLogin,
  login
);

router.post(
  '/refresh',
  sanitizeInputs,
  refreshToken
);

// Protected routes (require authentication)
router.post(
  '/logout',
  authenticateToken,
  logout
);

router.get(
  '/me',
  authenticateToken,
  getCurrentUser
);

router.post(
  '/request-deletion',
  authenticateToken,
  accountDeletionLimiter,
  sanitizeInputs,
  validateAccountDeletionRequest,
  requestAccountDeletion
);

router.post(
  '/confirm-deletion',
  authenticateToken,
  verificationLimiter,
  sanitizeInputs,
  validateConfirmAccountDeletion,
  confirmAccountDeletion
);

router.post(
  '/cancel-deletion',
  authenticateToken,
  cancelAccountDeletion
);

export default router;