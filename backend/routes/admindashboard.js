// routes/adminAnalyticsRoutes.js
import express from 'express';
import {
  getAdminDashboardSummary,
  getSalesAndRevenueAnalytics,
  getTopPerformingStores,
  getPendingStoreVerifications,
  getPendingDisputes,
  getUserGrowthAnalytics
  // Add other admin analytics controller imports here
} from '../controllers/admindashboardcontrollers.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.get('/summary', authenticateToken, authorizeRoles("ADMIN"), getAdminDashboardSummary);
router.get('/sales-revenue', authenticateToken, authorizeRoles("ADMIN"), getSalesAndRevenueAnalytics);
router.get('/top-stores', authenticateToken, authorizeRoles("ADMIN"), getTopPerformingStores);
router.get('/pending-verifications', authenticateToken, authorizeRoles("ADMIN"), getPendingStoreVerifications);
router.get('/pending-disputes', authenticateToken, authorizeRoles("ADMIN"), getPendingDisputes);
router.get('/user-growth', authenticateToken, authorizeRoles("ADMIN"), getUserGrowthAnalytics);

export default router;