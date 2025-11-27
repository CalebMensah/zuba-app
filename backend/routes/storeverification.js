import express from 'express';
import { 
  submitStoreVerification, 
  getMyStoreVerificationStatus,
  updateVerificationStatus,
  getVerificationDetails,
  getPendingVerifications,
  getAllVerifications,
  deleteVerification,
  getVerificationStats
} from '../controllers/verificationcontroller.js';
import { uploadVerificationDocs, handleMulterError } from '../config/storemulter.js';
import { authorizeRoles, authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

router.post(
  '/submit',
  authenticateToken,
  uploadVerificationDocs,
  handleMulterError,
  submitStoreVerification
);

router.get(
  '/my-status',
  authenticateToken,
  getMyStoreVerificationStatus
);

router.get(
  '/stats',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getVerificationStats
);

router.get(
  '/pending',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getPendingVerifications
);

router.get(
  '/all',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getAllVerifications
);

router.get(
  '/:verificationId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getVerificationDetails
);

router.patch(
  '/:verificationId/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  updateVerificationStatus
);

router.delete(
  '/:verificationId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  deleteVerification
);

export default router;