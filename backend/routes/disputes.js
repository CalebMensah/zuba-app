import express from 'express';
import {
  openDispute,
  resolveDispute,
  getDispute,
  getMyDisputes,
  cancelDispute
} from '../controllers/disputescontroller.js';
import {
  openDisputeValidation,
  resolveDisputeValidation,
  cancelDisputeValidation
} from '../middleware/disputeValidators.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const standardRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const strictRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20
});

router.post(
  '/:orderId/open',
  authenticateToken,
  authorizeRoles('BUYER'),
  strictRateLimit,
  openDisputeValidation,
  openDispute
);

router.patch(
  '/:disputeId/cancel',
  authenticateToken,
  authorizeRoles('BUYER'),
  strictRateLimit,
  cancelDisputeValidation,
  cancelDispute
);

router.get(
  '/:disputeId',
  authenticateToken,
  standardRateLimit,
  getDispute
);

router.get(
  '/user/all',
  authenticateToken,
  standardRateLimit,
  getMyDisputes
);

// Resolve a dispute (admin only)
router.patch(
  '/:disputeId/resolve',
  authenticateToken,
  authorizeRoles('ADMIN'),
  strictRateLimit,
  resolveDisputeValidation,
  resolveDispute
);

export default router;