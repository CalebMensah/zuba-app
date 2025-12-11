import express from 'express';
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  getNotificationById,
  deleteNotification,
  deleteAllReadNotifications
} from '../controllers/notificationcontroller.js';
import {
  createNotificationValidation,
  getUserNotificationsValidation,
  markNotificationAsReadValidation,
  getNotificationByIdValidation
} from '../middleware/notificationValidators.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limiting configurations
const standardRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
});

const strictRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // 50 requests per window for write operations
});

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  strictRateLimit,
  createNotificationValidation,
  createNotification
);

router.get(
  '/',
  authenticateToken,
  standardRateLimit,
  getUserNotificationsValidation,
  getUserNotifications
);

router.get(
  '/unread/count',
  authenticateToken,
  standardRateLimit,
  getUnreadNotificationCount
);

router.get(
  '/:notificationId',
  authenticateToken,
  standardRateLimit,
  getNotificationByIdValidation,
  getNotificationById
);

router.patch(
  '/:notificationId/read',
  authenticateToken,
  strictRateLimit,
  markNotificationAsReadValidation,
  markNotificationAsRead
);

router.patch(
  '/read-all',
  authenticateToken,
  strictRateLimit,
  markAllNotificationsAsRead
);

router.delete(
  '/:notificationId',
  authenticateToken,
  strictRateLimit,
  markNotificationAsReadValidation,
  deleteNotification
);

router.delete(
  '/read/all',
  authenticateToken,
  strictRateLimit,
  deleteAllReadNotifications
);

export default router;