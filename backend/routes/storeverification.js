import express from 'express';
import { 
  submitStoreVerification, 
  getMyStoreVerificationStatus,
  updateVerificationStatus,
  getVerificationDetails,
  getPendingVerifications,
  getAllVerifications,
  deleteVerification,
  getVerificationStats,
  asyncHandler
} from '../controllers/verificationcontroller.js';
import { uploadVerificationDocs, handleMulterError } from '../config/storemulter.js';
import { authorizeRoles, authenticateToken } from '../middleware/authmiddleware.js';
import {
  submitVerificationValidators,
  updateStatusValidators,
  verificationIdValidator,
  paginationValidators,
  getAllVerificationsValidators,
  handleValidationErrors,
  validateVerificationFiles,
  verificationSubmitLimiter,
  verificationStatusLimiter,
  adminActionLimiter
} from '../middleware/verificationValidators.js';

const router = express.Router();

// User Routes
router.post(
  '/submit',
  verificationSubmitLimiter,
  authenticateToken,
  uploadVerificationDocs, 
  handleMulterError, 
  validateVerificationFiles, 
  submitVerificationValidators, 
  handleValidationErrors, 
  asyncHandler(submitStoreVerification)
);

router.get(
  '/my-status',
  verificationStatusLimiter, // Rate limit: 10 requests per minute
  authenticateToken,
  asyncHandler(getMyStoreVerificationStatus)
);

// Admin Routes - All require admin role and rate limiting
router.get(
  '/stats',
  adminActionLimiter, // Rate limit: 30 requests per minute
  authenticateToken,
  authorizeRoles('ADMIN'),
  asyncHandler(getVerificationStats)
);

router.get(
  '/pending',
  adminActionLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  paginationValidators,
  handleValidationErrors,
  asyncHandler(getPendingVerifications)
);

router.get(
  '/all',
  adminActionLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  getAllVerificationsValidators,
  handleValidationErrors,
  asyncHandler(getAllVerifications)
);

router.get(
  '/:verificationId',
  adminActionLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  verificationIdValidator,
  handleValidationErrors,
  asyncHandler(getVerificationDetails)
);

router.patch(
  '/:verificationId/status',
  adminActionLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  updateStatusValidators,
  handleValidationErrors,
  asyncHandler(updateVerificationStatus)
);

router.delete(
  '/:verificationId',
  adminActionLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  verificationIdValidator,
  handleValidationErrors,
  asyncHandler(deleteVerification)
);

export default router;