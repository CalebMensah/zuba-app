import express from 'express';
import {
  getDeliveryInfoByOrderId,
  shipOrder,
  updateDeliveryInfo,
  addDeliveryProof,
  getAllSellerDeliveries,
  getBuyerDeliveries,
  getSellerDeliveryStats
} from '../controllers/deliverycontrollers.js';
import {
  getDeliveryInfoValidation,
  shipOrderValidation,
  updateDeliveryInfoValidation,
  addDeliveryProofValidation,
  getAllSellerDeliveriesValidation,
  getBuyerDeliveriesValidation,
  getSellerDeliveryStatsValidation
} from '../middleware/deliveryValidation.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { deliveryProofUpload } from '../middleware/upload.js';

const router = express.Router();

const standardRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const strictRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30
});


router.get(
  '/seller/all',
  authenticateToken,
  authorizeRoles('SELLER'),
  standardRateLimit,
  getAllSellerDeliveriesValidation,
  getAllSellerDeliveries
);

router.get(
  '/seller/stats',
  authenticateToken,
  authorizeRoles('SELLER'),
  standardRateLimit,
  getSellerDeliveryStatsValidation,
  getSellerDeliveryStats
);

router.post(
  '/ship/:orderId',
  authenticateToken,
  authorizeRoles('SELLER'),
  strictRateLimit,
  deliveryProofUpload.array('proofs', 5),
  shipOrderValidation,
  shipOrder
);

router.patch(
  '/order/:orderId',
  authenticateToken,
  authorizeRoles('SELLER'),
  strictRateLimit,
  updateDeliveryInfoValidation,
  updateDeliveryInfo
);

router.get(
  '/buyer/all',
  authenticateToken,
  authorizeRoles('BUYER'),
  standardRateLimit,
  getBuyerDeliveriesValidation,
  getBuyerDeliveries
);

router.get(
  '/order/:orderId',
  authenticateToken,
  standardRateLimit,
  getDeliveryInfoValidation,
  getDeliveryInfoByOrderId
);

router.post(
  '/order/:orderId/proof',
  authenticateToken,
  strictRateLimit,
  deliveryProofUpload.array('proofs', 5),
  addDeliveryProofValidation,
  addDeliveryProof
);

export default router;