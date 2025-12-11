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
import {
  createStoreValidators,
  updateStoreValidators,
  storeIdValidator,
  storeUrlValidator,
  storeIdParamValidator,
  updateVerificationValidator,
  validateLogoFile,
  handleValidationErrors,
  storeCreationLimiter,
  storeUpdateLimiter,
  storeQueryLimiter
} from '../middleware/storeValidators.js';

const router = express.Router();

router.post(
  '/',
  storeCreationLimiter,
  authenticateToken,
  authorizeRoles('SELLER'),
  upload.single('logo'),
  handleMulterError,
  validateLogoFile, 
  createStoreValidators,
  handleValidationErrors,
  createStore
);

router.put(
  '/:storeId',
  storeUpdateLimiter,
  authenticateToken,
  upload.single('logo'),
  handleMulterError,
  validateLogoFile,
  updateStoreValidators,
  handleValidationErrors,
  updateStore
);

router.delete(
  '/:storeId',
  storeUpdateLimiter,
  authenticateToken,
  storeIdValidator,
  handleValidationErrors,
  deleteStore
);

router.get(
  '/s/:url',
  storeQueryLimiter, 
  storeUrlValidator,
  handleValidationErrors,
  getStoreBySlug
);

router.get(
  '/my-store',
  storeQueryLimiter,
  authenticateToken,
  getUserStore
);


router.get(
  '/:id',
  storeQueryLimiter,
  optionalAuth,
  storeIdParamValidator,
  handleValidationErrors,
  getSellerStoreForPublicUse
)

router.patch(
  '/admin/:storeId',
  storeUpdateLimiter,
  authenticateToken,
  authorizeRoles('ADMIN'),
  updateVerificationValidator,
  handleValidationErrors,
  updateStoreVerification
);

export default router;