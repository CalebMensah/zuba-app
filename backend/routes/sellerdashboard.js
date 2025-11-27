// routes/sellerDashboardRoutes.js
import express from 'express';
import {
  getDashboardSummary,
  getSalesAnalytics,
  getTopSellingProducts,
  getOrderAnalytics,
  getStorePerformance
} from '../controllers/sellerdashboardcontrollers.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// All routes require authentication (seller access)
router.get('/summary', authenticateToken, authorizeRoles("SELLER"),getDashboardSummary);
router.get('/sales-analytics', authenticateToken, authorizeRoles("SELLER"),getSalesAnalytics);
router.get('/top-products', authenticateToken, authorizeRoles("SELLER"),getTopSellingProducts);
router.get('/order-analytics', authenticateToken, authorizeRoles("SELLER"),getOrderAnalytics); 
router.get('/store-performance', authenticateToken,getStorePerformance); 

// Add other specific analytics routes here if needed, e.g.:
// router.get('/customer-demographics', authenticateToken, getCustomerDemographics);
// router.get('/inventory-alerts', authenticateToken, getInventoryAlerts);
// router.get('/refund-analytics', authenticateToken, getRefundAnalytics);
// router.get('/delivery-performance', authenticateToken, getDeliveryPerformance);

export default router;