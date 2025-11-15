// routes/notificationRoutes.js
import express from 'express';
import {
  createNotification, // Potentially for admin/internal use
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount
} from '../controllers/notificationcontroller.js';
import { authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/', authenticateToken, getUserNotifications);
router.get('/unread/count', authenticateToken, getUnreadNotificationCount);
router.patch('/:notificationId/read', authenticateToken, markNotificationAsRead);
router.patch('/read-all', authenticateToken, markAllNotificationsAsRead);

export default router;