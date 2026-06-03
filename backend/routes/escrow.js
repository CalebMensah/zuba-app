import express from 'express';
import {
  confirmOrderReceived,
  getEscrowDetails,
  getOrderEscrowStatus,
  getPendingEscrows
} from '../controllers/escrowcontroller.js';
import {
  confirmOrderReceivedValidation,
  getEscrowDetailsValidation,
  getOrderEscrowStatusValidation,
  getPendingEscrowsValidation
} from '../middleware/escrowValidators.js';
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
  max: 10 // 10 requests per window for critical financial operations
});

router.post(
  '/:orderId/confirm-order-received',
  authenticateToken,
  authorizeRoles('BUYER'),
  strictRateLimit,
  confirmOrderReceivedValidation,
  confirmOrderReceived
);

router.get(
  '/:escrowId',
  authenticateToken,
  standardRateLimit,
  getEscrowDetailsValidation,
  getEscrowDetails
);

router.get(
  '/order/:orderId',
  authenticateToken,
  standardRateLimit,
  getOrderEscrowStatusValidation,
  getOrderEscrowStatus
);

router.get(
  '/pending',
  authenticateToken,
  authorizeRoles('ADMIN'),
  standardRateLimit,
  getPendingEscrowsValidation,
  getPendingEscrows
);

export default router;