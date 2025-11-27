// routes/cartRoutes.js
import express from 'express';
import {
  getUserCart,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  clearCart
} from '../controllers/cartcontrollers.js';
import { authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

// All routes require authentication
router.get('/', authenticateToken, getUserCart);
router.post('/items', authenticateToken, addItemToCart);
router.patch('/items/:cartItemId', authenticateToken, updateCartItemQuantity);
router.delete('/items/:cartItemId', authenticateToken, removeItemFromCart);
router.delete('/', authenticateToken, clearCart);

export default router;