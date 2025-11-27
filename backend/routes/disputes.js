import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import {
  requestRefund,
  resolveDispute,
  getDisputeDetails,
  getUserDisputes,
  getAllDisputes,
  updateDispute,
  cancelDispute
} from '../controllers/disputescontroller.js';

const router = express.Router();

router.post('/refund/:orderId', authenticateToken, requestRefund);
router.post('/:disputeId/resolve', authenticateToken, authorizeRoles(['ADMIN']), resolveDispute);
router.get('/:disputeId', authenticateToken, getDisputeDetails);
router.get('/user/all', authenticateToken, getUserDisputes);
router.get('/admin/all', authenticateToken, authorizeRoles(['ADMIN']), getAllDisputes);
router.patch('/:disputeId', authenticateToken, updateDispute);
router.post('/:disputeId/cancel', authenticateToken, cancelDispute);

export default router;