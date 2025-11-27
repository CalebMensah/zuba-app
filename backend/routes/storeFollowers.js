import express from 'express';
import {
  followStore,
  unfollowStore,
  getMyFollowing,
  getStoreFollowers,
  getStoreFollowerCount,
  checkIfFollowing
} from '../controllers/storefollow.js';
import { authorizeRoles, authenticateToken } from '../middleware/authmiddleware.js';

const router = express.Router();

// Following/Unfollowing routes (require authentication)
router.post('/follow', authenticateToken, authorizeRoles("BUYER"),followStore);
router.post('/unfollow', authenticateToken, authorizeRoles("BUYER"),unfollowStore);
router.get('/my-following', authenticateToken, getMyFollowing);

router.get('/store/:storeUrl/followers', authenticateToken, getStoreFollowers);

router.get('/store/:storeUrl/count', getStoreFollowerCount); 
router.get('/check/:storeUrl', authenticateToken, checkIfFollowing); 
export default router;