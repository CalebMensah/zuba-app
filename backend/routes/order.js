// routes/orderRoutes.js
import express from 'express';
import {
  createOrder,
  getOrderById,
  getBuyerOrders,
  getSellerOrders,
  updateOrderStatus,
  updatePaymentStatus, // Might need different auth (webhook)
  cancelOrder,
  updateCheckoutSession,
  getUnpaidOrders,
  getUnpaidOrdersSummary,
  getUnpaidOrdersByStore,
  getUnpaidOrderById,
  cancelUnpaidOrder
  // Add other specific order update routes as needed
} from '../controllers/ordercontrollers.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles("BUYER"),createOrder);
router.get('/my-orders', authenticateToken, authorizeRoles("BUYER"),getBuyerOrders);
router.get('/:orderId', authenticateToken, getOrderById); 
router.delete('/:orderId', authenticateToken, cancelOrder); 

router.get('/seller/seller-orders', authenticateToken,getSellerOrders);
router.patch('/:orderId/status', authenticateToken, authorizeRoles("SELLER"),updateOrderStatus);
router.put('/:orderId/checkout', authenticateToken,updateCheckoutSession)


router.get('/unpaid', authenticateToken, getUnpaidOrders);
router.get('/unpaid/summary', authenticateToken, getUnpaidOrdersSummary);
router.get('/unpaid/by-store', authenticateToken, getUnpaidOrdersByStore);
router.get('/unpaid/:orderId', authenticateToken, getUnpaidOrderById);
router.delete('/unpaid/:orderId', authenticateToken, cancelUnpaidOrder);

export default router;