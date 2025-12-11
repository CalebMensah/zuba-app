import express from 'express';
import {
  assignCourier,
  getDeliveryInfoByOrderId,
  editAssignedDeliveryCourierInfo,
  deleteAssignedDeliveryCourierInfo,
  setDeliveryStatus,
  getAllSellerDeliveries,
  getSellerDeliveryStats
} from '../controllers/deliverycontrollers.js';
import {
  assignCourierValidation,
  getDeliveryInfoValidation,
  editDeliveryCourierValidation,
  deleteDeliveryCourierValidation,
  setDeliveryStatusValidation,
  getAllSellerDeliveriesValidation,
  getSellerDeliveryStatsValidation
} from '../middleware/deliveryValidation.js';
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
  max: 30 // 30 requests per window for write operations
});

router.get(
  '/seller/all',
  authenticateToken,
  authorizeRoles("SELLER"),
  standardRateLimit,
  getAllSellerDeliveriesValidation,
  getAllSellerDeliveries
);

router.get(
  '/seller/stats',
  authenticateToken,
  authorizeRoles("SELLER"),
  standardRateLimit,
  getSellerDeliveryStatsValidation,
  getSellerDeliveryStats
);

router.post(
  '/assign-courier/:orderId',
  authenticateToken,
  authorizeRoles("SELLER"),
  strictRateLimit,
  assignCourierValidation,
  assignCourier
);

router.get(
  '/order/:orderId',
  authenticateToken,
  standardRateLimit,
  getDeliveryInfoValidation,
  getDeliveryInfoByOrderId
);

router.patch(
  '/order/:orderId',
  authenticateToken,
  authorizeRoles("SELLER"),
  strictRateLimit,
  editDeliveryCourierValidation,
  editAssignedDeliveryCourierInfo
);


router.delete(
  '/order/:orderId',
  authenticateToken,
  authorizeRoles("SELLER"),
  strictRateLimit,
  deleteDeliveryCourierValidation,
  deleteAssignedDeliveryCourierInfo
);


router.patch(
  '/order/:orderId/status',
  authenticateToken,
  authorizeRoles("SELLER"),
  strictRateLimit,
  setDeliveryStatusValidation,
  setDeliveryStatus
);

export default router;