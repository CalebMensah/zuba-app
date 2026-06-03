// routes/paymentAccountRoutes.js
import express from 'express';
import {
  upsertPaymentAccount,
  getUserPaymentAccount,
  getPaymentAccountByStoreUrl, // Potentially public or admin
  deletePaymentAccount,
  updatePayoutPreference
} from '../controllers/accountDetailscontroller.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// Seller routes (require authentication)
router.post('/', authenticateToken, authorizeRoles("SELLER"),upsertPaymentAccount); 
router.get('/my-account', authenticateToken, authorizeRoles("SELLER"),getUserPaymentAccount); 
router.delete('/my-account', authenticateToken, authorizeRoles("SELLER"),deletePaymentAccount);
router.patch('/payout-preference', authenticateToken, authorizeRoles('SELLER'),updatePayoutPreference);

export default router;