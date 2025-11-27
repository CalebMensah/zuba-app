import express from 'express';
import { authenticateToken } from '../middleware/authmiddleware.js';
import { upload } from '../config/reviewmulter.js';
import {
  createReview,
  getProductReviews,
  getMyReviews,
  getSellerStoreReviews,
  getProductReviewSummary,
  updateReview,
  deleteReview,
  addReviewResponse,
  updateReviewResponse,
  deleteReviewResponse,
  likeReview,
  unlikeReview,
  reportReview,
  getReviewById,
  getPublicStoreReviews
} from '../controllers/reviewcontrollers.js';

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);
router.get('/product/:productId/summary', getProductReviewSummary);
router.get('/:reviewId', getReviewById);
router.get("/public/stores/:storeId/reviews", getPublicStoreReviews);

// Protected routes - require authentication
router.use(authenticateToken);

// User review management
router.post('/', upload.array('media', 5), createReview);
router.get('/user/me', getMyReviews);
router.patch('/:reviewId', updateReview);
router.delete('/:reviewId', deleteReview);

// Review interactions
router.post('/:reviewId/like', likeReview);
router.delete('/:reviewId/like', unlikeReview);
router.post('/:reviewId/report', reportReview);

// Seller/Store routes
router.get('/review/seller/store', getSellerStoreReviews);
router.post('/:reviewId/response', addReviewResponse);
router.patch('/:reviewId/response', updateReviewResponse);
router.delete('/:reviewId/response', deleteReviewResponse);

export default router;