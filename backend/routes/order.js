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

// (Unpaid-specific routes removed - use buyer orders endpoint with status=PENDING_PAYMENT) 


// GENERIC ROUTES (AFTER SPECIFIC ROUTES)
router.get('/:orderId', authenticateToken, getOrderById); 
router.delete('/:orderId', authenticateToken, cancelOrder); 

router.patch('/:orderId/status', authenticateToken, authorizeRoles("SELLER"),updateOrderStatus);
router.put('/:orderId/checkout', authenticateToken,updateCheckoutSession)
router.put('/:orderId/reject', authenticateToken, authorizeRoles("SELLER"), rejectOrder);
router.put('/:orderId/accept', authenticateToken, authorizeRoles("SELLER"), acceptOrder);

export default router;