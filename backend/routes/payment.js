import express from 'express';
import { authenticateToken } from '../middleware/authmiddleware.js';
import {
  initiatePayment,
  handlePaystackWebhook,
  getPaymentDetails,
  getUserPayments,
  verifyPayment,
  createCheckoutSession,
  getPaymentsByCheckoutSession
} from '../controllers/paymentcontroller.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/checkout-session',strictLimiter,authenticateToken,createCheckoutSession); // NEW: Checkout session route
router.post('/initiate', authenticateToken, initiatePayment);
router.post('/webhook', handlePaystackWebhook); 
router.get('/:paymentId', authenticateToken, getPaymentDetails);
router.get('/user/all', authenticateToken, getUserPayments);
router.get('/verify/:reference', authenticateToken, verifyPayment);
router.get('checkout-session/:sessionId', authenticateToken,getPaymentsByCheckoutSession)

export default router;