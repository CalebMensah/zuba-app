// routes/productRoutes.js
import express from 'express';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerProductByIdForPublicUse,
  getAllSellerProductsForPublicUse,
  getUserProducts,
  getAllProducts, 
  getTopSellingProducts,
  getRecommendedProducts,
  getProductsYouMayLike,
  getTrendingProducts,
  softDeleteProduct,
  restoreProduct,
  listDeletedProducts
} from '../controllers/productcontroller.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import { uploadProductImages, handleMulterError } from '../config/multerproduct.js';

const router = express.Router();

// Public Routes (No Authentication Required)
router.get('/product/:productUrl', getSellerProductByIdForPublicUse)
router.get('/', getAllProducts); 
router.get('/store/:storeUrl', getAllSellerProductsForPublicUse);


// Create a new product (seller only)
router.post('/', authenticateToken, uploadProductImages, handleMulterError, createProduct);
router.get('/my-products', authenticateToken, getUserProducts); 
router.put('/:productId', authenticateToken, uploadProductImages, handleMulterError, updateProduct);
router.delete('/:productId', authenticateToken, deleteProduct);
router.get('/top-selling', getTopSellingProducts);
router.get('/recommended/:productUrl', getRecommendedProducts);
router.get('/you-may-like', getProductsYouMayLike);
router.get('/trending', getTrendingProducts);
router.delete('/:productId/soft-delete', authenticateToken, authorizeRoles('SELLER'),softDeleteProduct);
router.patch('/productId/restore', authenticateToken, authorizeRoles('SELLER'),restoreProduct);
router.get('/seller/deleted',authenticateToken, authorizeRoles('SELLER'),listDeletedProducts);

export default router;