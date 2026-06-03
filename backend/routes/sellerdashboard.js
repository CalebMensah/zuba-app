// routes/sellerDashboardRoutes.js
import express from 'express';
import {
  getDashboardSummary,
  getSalesAnalytics,
  getTopSellingProducts,
  getOrderAnalytics,
  getStorePerformance,
  getPaymentSummary,
  getFeesAnalytics,
  getEscrowOverview,
  getFailedTransactions,
  getTransactionSuccessRate,
  getPayoutHistory,
  getPaymentMethodBreakdown,
  getProductSnapshot,
  getStockMovement,
  getCategoryPerformance,
  getRevenuePerProduct,
  getDeadStock,
  getStockAlerts,
  getProductPerformance,
  getCustomerSnapshot,
  getCustomerTrend,
  getTopCustomers,
  getCustomerLifetimeValue,
  getInactiveCustomers,
  getPurchaseFrequency,
  getAverageOrderValueTrend
} from '../controllers/sellerdashboardcontrollers.js';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';

const router = express.Router();

// All routes require authentication (seller access)
router.get('/summary', authenticateToken, authorizeRoles("SELLER"),getDashboardSummary);
router.get('/sales-analytics', authenticateToken, authorizeRoles("SELLER"),getSalesAnalytics);
router.get('/top-products', authenticateToken, authorizeRoles("SELLER"),getTopSellingProducts);
router.get('/order-analytics', authenticateToken, authorizeRoles("SELLER"),getOrderAnalytics); 
router.get('/store-performance', authenticateToken,getStorePerformance); 
router.get('/analytics/payments/summary', authenticateToken, authorizeRoles("SELLER"),getPaymentSummary);
router.get('/analytics/payments/methods', authenticateToken, authorizeRoles("SELLER"),getPaymentMethodBreakdown);
router.get('/analytics/payments/payouts', authenticateToken, authorizeRoles("SELLER"),getPayoutHistory);
router.get('/analytics/payments/transaction-rate', authenticateToken, authorizeRoles("SELLER"),getTransactionSuccessRate);
router.get('/analytics/payments/failed', authenticateToken, authorizeRoles("SELLER"),getFailedTransactions);
router.get('/analytics/payments/escrow', authenticateToken, authorizeRoles("SELLER"),getEscrowOverview);
router.get('/analytics/payments/fees', authenticateToken, authorizeRoles("SELLER"),getFeesAnalytics);
router.get('/analytics/products/snapshot', authenticateToken, authorizeRoles("SELLER"),getProductSnapshot);
router.get('/analytics/products/performance', authenticateToken, authorizeRoles("SELLER"),getProductPerformance);
router.get('/analytics/products/stock-alerts', authenticateToken, authorizeRoles("SELLER"),getStockAlerts);
router.get('/analytics/products/dead-stock', authenticateToken, authorizeRoles("SELLER"),getDeadStock);
router.get('/analytics/products/revenue', authenticateToken, authorizeRoles("SELLER"),getRevenuePerProduct);
router.get('/analytics/products/categories', authenticateToken, authorizeRoles("SELLER"),getCategoryPerformance);
router.get('/analytics/products/stock-movement', authenticateToken, authorizeRoles("SELLER"),getStockMovement);
router.get('/analytics/customers/snapshot', authenticateToken, authorizeRoles("SELLER"),getCustomerSnapshot);
router.get('/analytics/customers/trend', authenticateToken, authorizeRoles("SELLER"),getCustomerTrend);
router.get('/analytics/customers/top', authenticateToken, authorizeRoles("SELLER"),getTopCustomers);
router.get('/analytics/customers/clv', authenticateToken, authorizeRoles("SELLER"),getCustomerLifetimeValue);
router.get('/analytics/customers/inactive', authenticateToken, authorizeRoles("SELLER"),getInactiveCustomers);
router.get('/analytics/customers/frequency', authenticateToken, authorizeRoles("SELLER"),getPurchaseFrequency);
router.get('/analytics/customers/aov', authenticateToken, authorizeRoles("SELLER"),getAverageOrderValueTrend);


export default router;