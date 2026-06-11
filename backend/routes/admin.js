import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authmiddleware.js';


import {
  getAllUsers,
  getUserById,
  suspendUser,
  reactivateUser,
  deleteUser,
  getAllStores,
  suspendStore,
  deleteStore,
  getAllOrdersForAdmin,
  deleteUserOrdersAndPayments,
  deleteAllOrdersAndPayments
} from '../controllers/admincontrollers.js';
import { updateOrderStatus } from '../controllers/ordercontrollers.js';
import { getCommissionStats, getCommissionTrend } from '../controllers/admindashboardcontrollers.js';

const router = express.Router();

router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.delete('/cleanup/all', deleteAllOrdersAndPayments);
router.delete('/cleanup/user', deleteUserOrdersAndPayments);
router.get('/orders',getAllOrdersForAdmin )
// All admin routes must pass authentication + admin role check
router.use(authenticateToken, authorizeRoles('ADMIN'));


router.put('/users/:userId/suspend', suspendUser);
router.put('/users/:userId/reactivate', reactivateUser);
router.delete('/users/:userId', deleteUser);
router.get('/stores', getAllStores);
router.put('/:storeId/suspend', suspendStore);
router.delete('/:storeId', deleteStore);
router.put('/orders/:orderId/status', updateOrderStatus)
router.get("/commission-stats", getCommissionStats);
router.get("/commission-trend", getCommissionTrend);






export default router;
