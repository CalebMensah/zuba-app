// routes/addressRoutes.js
import express from 'express';
import {
  createAddress,
  getUserAddresses,
  getUserAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../controllers/addresscontroller.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// All routes require authentication
router.post('/', authenticateToken, authorizeRoles("BUYER"),createAddress);
router.get('/', authenticateToken, getUserAddresses);
router.get('/:addressId', authenticateToken, getUserAddressById);
router.put('/:addressId', authenticateToken, updateAddress);
router.delete('/:addressId', authenticateToken, deleteAddress); 
router.patch('/:addressId/set-default', authenticateToken, setDefaultAddress);

export default router;