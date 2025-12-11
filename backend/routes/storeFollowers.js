import express from 'express';
import {
  followStore,
  unfollowStore,
  getMyFollowing,
  getStoreFollowers,
  getStoreFollowerCount,
  checkIfFollowing,
  getMyStoreFollowerCount,
  bulkCheckFollowing
} from '../controllers/storefollow.js';
import { authorizeRoles, authenticateToken } from '../middleware/authmiddleware.js';
import {
  followStoreValidators,
  unfollowStoreValidators,
  storeUrlValidator,
  handleValidationErrors,
  followActionLimiter,
  followQueryLimiter,
  preventSpamFollowing
} from '../middleware/followValidators.js';

const router = express.Router();

// Follow a store
router.post(
  '/follow',
  followActionLimiter, 
  authenticateToken,
  authorizeRoles('BUYER'), 
  followStoreValidators,
  handleValidationErrors,
  preventSpamFollowing, 
  followStore
);


router.post(
  '/unfollow',
  followActionLimiter, 
  authenticateToken,
  authorizeRoles('BUYER'),
  unfollowStoreValidators,
  handleValidationErrors,
  unfollowStore
);


router.get(
  '/my-following',
  followQueryLimiter,
  authenticateToken,
  getMyFollowing
);

router.get(
  '/store/:storeUrl/followers',
  followQueryLimiter,
  authenticateToken, 
  storeUrlValidator,
  handleValidationErrors,
  getStoreFollowers
);

router.get(
  '/store/:storeUrl/count',
  followQueryLimiter,
  storeUrlValidator,
  handleValidationErrors,
  getStoreFollowerCount
);

router.get(
  '/check/:storeUrl',
  followQueryLimiter,
  authenticateToken,
  storeUrlValidator,
  handleValidationErrors,
  checkIfFollowing
);

router.get(
  '/my-store/count',
  followQueryLimiter,
  authenticateToken,
  getMyStoreFollowerCount
);

router.post(
  '/bulk-check',
  followQueryLimiter,
  authenticateToken,
  bulkCheckFollowing
);

export default router;