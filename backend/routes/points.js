import express from 'express';
import {
  getRedeemableProducts,
  redeemPointsForProduct,
  getUserPointsBalance,
  getPointsHistory
} from '../controllers/pointscontroller.js';
import { authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/balance', authenticateToken, getUserPointsBalance);
router.get('/redeemable-products', authenticateToken, getRedeemableProducts);
router.post('/redeem/:productId', authenticateToken, redeemPointsForProduct);
router.get('/history', authenticateToken, getPointsHistory);

export default router;