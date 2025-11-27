// routes/productLikeRoutes.js
import express from 'express';
import {
  likeProduct,
  unlikeProduct,
  getMyLikedProducts,
  getProductLikeCount,
  checkIfLiked
} from '../controllers/productLikecontroller.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

router.post('/like', authenticateToken, authorizeRoles("BUYER"),likeProduct); 
router.post('/unlike', authenticateToken, authorizeRoles("BUYER"),unlikeProduct); 
router.get('/my-liked', authenticateToken, getMyLikedProducts); 
router.get('/product/:productId/count', getProductLikeCount); 
router.get('/check/:productId', authenticateToken, checkIfLiked); 

export default router;