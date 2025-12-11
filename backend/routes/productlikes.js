import express from 'express';
import {
  likeProduct,
  unlikeProduct,
  getMyLikedProducts,
  getProductLikeCount,
  checkIfLiked,
  bulkCheckLiked
} from '../controllers/productLikecontroller.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import {
  likeProductValidators,
  unlikeProductValidators,
  productIdValidator,
  handleValidationErrors,
  likeActionLimiter,
  likeQueryLimiter,
  preventLikeSpam
} from '../middleware/productLikeValidators.js';

const router = express.Router();

// Like a product (BUYER only)
router.post(
  '/like',
  likeActionLimiter, // Rate limit: 30 actions per minute
  authenticateToken,
  authorizeRoles('BUYER'), // Only buyers can like products
  likeProductValidators,
  handleValidationErrors,
  preventLikeSpam, // Prevent liking more than 10,000 products
  likeProduct
);

router.post(
  '/unlike',
  likeActionLimiter, // Rate limit: 30 actions per minute
  authenticateToken,
  authorizeRoles('BUYER'),
  unlikeProductValidators,
  handleValidationErrors,
  unlikeProduct
);

router.get(
  '/my-liked',
  likeQueryLimiter, // Rate limit: 60 requests per minute
  authenticateToken,
  getMyLikedProducts
);

router.get(
  '/product/:productId/count',
  likeQueryLimiter,
  productIdValidator,
  handleValidationErrors,
  getProductLikeCount
);

router.get(
  '/check/:productId',
  likeQueryLimiter,
  authenticateToken,
  productIdValidator,
  handleValidationErrors,
  checkIfLiked
);

router.post(
  '/bulk-check',
  likeQueryLimiter,
  authenticateToken,
  bulkCheckLiked
);

export default router;