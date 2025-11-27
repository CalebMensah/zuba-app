// routes/deliveryRoutes.js
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
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// Seller routes - get all deliveries
router.get('/seller/all', authenticateToken, authorizeRoles("SELLER"), getAllSellerDeliveries);
router.get('/seller/stats', authenticateToken, authorizeRoles("SELLER"), getSellerDeliveryStats);

// Individual order delivery routes
router.post('/assign-courier/:orderId', authenticateToken, authorizeRoles("SELLER"), assignCourier);
router.get('/order/:orderId', authenticateToken, getDeliveryInfoByOrderId); 
router.patch('/order/:orderId', authenticateToken, authorizeRoles("SELLER"), editAssignedDeliveryCourierInfo); 
router.delete('/order/:orderId', authenticateToken, authorizeRoles("SELLER"), deleteAssignedDeliveryCourierInfo);
router.patch('/order/:orderId/status', authenticateToken, authorizeRoles("SELLER"), setDeliveryStatus);

export default router;