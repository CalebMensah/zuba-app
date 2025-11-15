// routes/storeRoutes.js (Updated)
import express from 'express';
import { 
  createStore, 
  updateStore, 
  deleteStore, 
  getStoreBySlug, 
  updateStoreVerification,
  getUserStore,
  getSellerStoreForPublicUse
} from '../controllers/storecontrollers.js';
import { upload, handleMulterError } from '../config/multer.js';
import { authorizeRoles, authenticateToken, optionalAuth } from '../middleware/authmiddleware.js';

const router = express.Router();


router.post('/', authenticateToken, upload.single('logo'), handleMulterError, createStore);
router.put('/:storeId', authenticateToken, upload.single('logo'), handleMulterError, updateStore);
router.delete('/:storeId', authenticateToken, deleteStore);
router.get('/s/:slug', getStoreBySlug);
router.get('/my-store', authenticateToken, getUserStore);

router.get('/:id', optionalAuth, getSellerStoreForPublicUse);

// Admin route for direct status update (if still needed)
router.patch('/admin/:storeId', authenticateToken, authorizeRoles(['ADMIN']), updateStoreVerification);

export default router;