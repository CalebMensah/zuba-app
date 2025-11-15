import express from 'express';
import {
  updateProfile,
  updateAvatar,
  deleteAvatar,
} from '../controllers/usercontroller.js';
import { authenticateToken } from '../middleware/authmiddleware.js';
import { upload, handleMulterError } from '../config/multer.js';

const router = express.Router();

// Profile management routes
router.patch('/profile', authenticateToken, updateProfile);
router.patch('/profile/avatar', authenticateToken, upload.single('avatar'), handleMulterError, updateAvatar);
router.delete('/profile/avatar', authenticateToken, deleteAvatar);

export default router;