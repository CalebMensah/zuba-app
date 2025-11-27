import express from 'express';
import { authenticateToken, authorizeRoles} from '../middleware/authmiddleware.js';
import {
  confirmOrderReceived,
  getEscrowDetails,
  getOrderEscrowStatus,
  getPendingEscrows
} from '../controllers/escrowcontroller.js';

const router = express.Router();

router.post('/:orderId/confirm', authenticateToken, confirmOrderReceived);
router.get('/:escrowId', authenticateToken, getEscrowDetails);
router.get('/order/:orderId', authenticateToken, getOrderEscrowStatus);
router.get('/pending', authenticateToken, authorizeRoles(["ADMIN"]), getPendingEscrows);

export default router;