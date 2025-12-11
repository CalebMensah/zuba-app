import express from 'express';
import {
  requestRefund,
  resolveDispute,
  getDisputeDetails,
  getUserDisputes,
  getAllDisputes,
  updateDispute,
  cancelDispute
} from '../controllers/disputescontroller.js';
import {
  requestRefundValidation,
  resolveDisputeValidation,
  getDisputeDetailsValidation,
  getUserDisputesValidation,
  getAllDisputesValidation,
  updateDisputeValidation,
  cancelDisputeValidation
} from '../middleware/disputeValidators.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limiting configurations
const standardRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
});

const strictRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20 // 20 requests per window for write operations
});

router.post(
  '/refund/:orderId',
  authenticateToken,
  authorizeRoles('BUYER'),
  strictRateLimit,
  requestRefundValidation,
  requestRefund
);

router.patch(
  '/:disputeId/resolve',
  authenticateToken,
  authorizeRoles('ADMIN'),
  strictRateLimit,
  resolveDisputeValidation,
  resolveDispute
);

router.get(
  '/:disputeId',
  authenticateToken,
  standardRateLimit,
  getDisputeDetailsValidation,
  getDisputeDetails
);

router.get(
  '/user/all',
  authenticateToken,
  standardRateLimit,
  getUserDisputesValidation,
  getUserDisputes
);

router.get(
  '/admin/all',
  authenticateToken,
  authorizeRoles('ADMIN'),
  standardRateLimit,
  getAllDisputesValidation,
  getAllDisputes
);

router.patch(
  '/:disputeId',
  authenticateToken,
  strictRateLimit,
  updateDisputeValidation,
  updateDispute
);

router.patch(
  '/:disputeId/cancel',
  authenticateToken,
  strictRateLimit,
  cancelDisputeValidation,
  cancelDispute
);

export default router;