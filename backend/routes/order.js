// routes/orderRoutes.js
import express from 'express';
import {
  createOrder,
  getOrderById,
  getBuyerOrders,
  getSellerOrders,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  updateCheckoutSession,
  getUnpaidOrders,
  getUnpaidOrdersSummary,
  getUnpaidOrdersByStore,
  getUnpaidOrderById,
  cancelUnpaidOrder,
  rejectOrder,
  acceptOrder
} from '../controllers/ordercontrollers.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles("BUYER"),createOrder);
router.get('/my-orders', authenticateToken, authorizeRoles("BUYER"),getBuyerOrders);

router.get('/seller/seller-orders', authenticateToken,getSellerOrders);

// UNPAID-SPECIFIC ROUTES (MUST BE BEFORE GENERIC /:orderId)
router.get('/user/unpaid', authenticateToken, getUnpaidOrders);
router.get('/unpaid/summary', authenticateToken, getUnpaidOrdersSummary);
router.get('/unpaid/by-store', authenticateToken, getUnpaidOrdersByStore);
router.get('/unpaid/:orderId', authenticateToken, getUnpaidOrderById);
router.delete('/unpaid/:orderId', authenticateToken, cancelUnpaidOrder);

// GENERIC ROUTES (AFTER SPECIFIC ROUTES)
router.get('/:orderId', authenticateToken, getOrderById); 
router.delete('/:orderId', authenticateToken, cancelOrder); 

router.patch('/:orderId/status', authenticateToken, authorizeRoles("SELLER"),updateOrderStatus);
router.put('/:orderId/checkout', authenticateToken,updateCheckoutSession)
router.put('/:orderId/reject', authenticateToken, authorizeRoles("SELLER"), rejectOrder);
router.put('/:orderId/accept', authenticateToken, authorizeRoles("SELLER"), acceptOrder);

export default router;