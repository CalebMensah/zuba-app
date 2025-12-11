import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getUserCart,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  clearCart,
  cleanupAbandonedCarts
} from '../controllers/cartcontrollers.js';
import {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveFromCart,
  sanitizeCartInputs
} from '../middleware/cartValidation.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// Rate limiter for cart operations
const cartOperationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many cart operations. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aggressive rate limiter for add to cart (prevent rapid clicking)
const addToCartLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 add operations per minute
  message: {
    success: false,
    message: 'Too many items added. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


router.use(authenticateToken);


router.get(
  '/',
  cartOperationLimiter,
  getUserCart
);

router.post(
  '/items',
  addToCartLimiter,
  sanitizeCartInputs,
  validateAddToCart,
  addItemToCart
);

router.patch(
  '/items/:cartItemId',
  cartOperationLimiter,
  sanitizeCartInputs,
  validateUpdateCartItem,
  updateCartItemQuantity
);

router.delete(
  '/items/:cartItemId',
  cartOperationLimiter,
  validateRemoveFromCart,
  removeItemFromCart
);

router.delete(
  '/',
  cartOperationLimiter,
  clearCart
);

// Admin only: Cleanup abandoned carts
router.post(
  '/admin/cleanup',
  authorizeRoles('ADMIN'),
  cleanupAbandonedCarts
);

export default router;