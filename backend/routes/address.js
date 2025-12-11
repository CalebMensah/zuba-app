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
import { addressLimiter, readLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { validateAddressInput } from '../utils/addressValidation.js';
import { validateAddressId } from '../middleware/paramValidation.js';

const router = express.Router();

const buyerAuth = [authenticateToken, authorizeRoles("BUYER")];

router.post(
  '/',
  authenticateToken,
  authorizeRoles("BUYER"),
  addressLimiter,
  validateAddressInput(false), // false = create mode (all fields required)
  createAddress
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles("BUYER"),
  readLimiter,
  getUserAddresses
);


router.get(
  '/:addressId',
  authenticateToken,
  authorizeRoles("BUYER"),
  readLimiter,
  validateAddressId,
  getUserAddressById
);

router.put(
  '/:addressId',
  authenticateToken,
  authorizeRoles("BUYER"),
  addressLimiter,
  validateAddressId,
  validateAddressInput(true), // true = update mode (partial fields allowed)
  updateAddress
);

router.delete(
  '/:addressId',
  authenticateToken,
  authorizeRoles("BUYER"),
  addressLimiter,
  validateAddressId,
  deleteAddress
);


router.patch(
  '/:addressId/set-default',
  authenticateToken,
  authorizeRoles("BUYER"),
  strictLimiter, // More restrictive for this critical operation
  validateAddressId,
  setDefaultAddress
);

export default router;