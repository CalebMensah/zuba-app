import express from 'express';
import {signup,verifyEmail,resendVerificationCode,login,logout,getCurrentUser,  requestAccountDeletion,confirmAccountDeletion,
cancelAccountDeletion,} from '../controllers/authcontroller.js';
import { authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', login);
router.post('/logout', logout);


// Protected routes (authentication required)
router.get('/me', authenticateToken, getCurrentUser);

// Account deletion routes (authentication required)
router.post('/delete-account/request', authenticateToken, requestAccountDeletion);
router.post('/delete-account/confirm', authenticateToken, confirmAccountDeletion);
router.post('/delete-account/cancel', authenticateToken, cancelAccountDeletion);

export default router;