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
  getAllOrdersForAdmin
} from '../controllers/admincontrollers.js';
import { updateOrderStatus } from '../controllers/ordercontrollers.js';

const router = express.Router();

// All admin routes must pass authentication + admin role check
router.use(authenticateToken, authorizeRoles('ADMIN'));
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.put('/users/:userId/suspend', suspendUser);
router.put('/users/:userId/reactivate', reactivateUser);
router.delete('/users/:userId', deleteUser);
router.get('/stores', getAllStores);
router.put('/:storeId/suspend', suspendStore);
router.delete('/:storeId', deleteStore);
router.get('/orders',getAllOrdersForAdmin )
router.put('/orders/:orderId/status', updateOrderStatus)





export default router;
