import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendNotification } from '../utils/sendnotification.js';

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Controller error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'You are already following this store.'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Follow relationship not found.'
      });
    }
    
    // Generic error
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  });
};

export const followStore = asyncHandler(async (req, res) => {
  const followerId = req.user.userId;
  const { storeId } = req.body;

  // Find and validate store
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { 
      id: true, 
      userId: true, 
      name: true,
    }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  // Prevent self-follow
  if (store.userId === followerId) {
    return res.status(400).json({
      success: false,
      message: 'You cannot follow your own store.'
    });
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Check if already following (race condition protection)
    const existing = await tx.storeFollower.findUnique({
      where: {
        userId_storeId: {
          userId: followerId,
          storeId
        }
      }
    });

    if (existing) {
      throw new Error('ALREADY_FOLLOWING');
    }

    // Create follow record
    const followRecord = await tx.storeFollower.create({
      data: {
        userId: followerId,
        storeId
      }
    });

    return followRecord;
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`user:${followerId}:following`),
    cache.del(`store:${storeId}:followers:count`),
    cache.del(`store:${storeId}:followers`),
    cache.del(`follow-count:${followerId}`)
  ]);

  // Send notification (non-blocking)
  const follower = await prisma.user.findUnique({
    where: { id: followerId },
    select: { firstName: true }
  });

  sendNotification(
    store.userId,
    'New Follower',
    `${follower?.firstName || 'Someone'} started following your store "${store.name}"`,
    'STORE_FOLLOW',
    { storeId, followerId, storeName: store.name }
  ).catch(err => console.error('Notification error:', err));

  res.status(201).json({
    success: true,
    message: 'Store followed successfully.',
    data: { followedAt: result.createdAt }
  });
});

export const unfollowStore = asyncHandler(async (req, res) => {
  const followerId = req.user.userId;
  const { storeId } = req.body;

  // Delete follow record
  await prisma.storeFollower.delete({
    where: {
      userId_storeId: {
        userId: followerId,
        storeId
      }
    }
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`user:${followerId}:following`),
    cache.del(`store:${storeId}:followers:count`),
    cache.del(`store:${storeId}:followers`),
    cache.del(`follow-count:${followerId}`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Store unfollowed successfully.'
  });
});

export const getMyFollowing = asyncHandler(async (req, res) => {
  const followerId = req.user.userId;
  const cacheKey = `user:${followerId}:following`;

  // Check cache
  const cachedFollowing = await cache.get(cacheKey);
  if (cachedFollowing) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedFollowing),
      cached: true
    });
  }

  // Fetch from database
  const following = await prisma.storeFollower.findMany({
    where: { userId: followerId },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          url: true,
          logo: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Filter out inactive stores for security
  const activeStores = following
    .filter(f => f.store.isActive)
    .map(f => ({
      id: f.store.id,
      name: f.store.name,
      url: f.store.url,
      logo: f.store.logo,
      followedAt: f.createdAt
    }));

  const resultData = {
    stores: activeStores,
    count: activeStores.length
  };

  // Cache for 30 minutes
  await cache.set(cacheKey, 1800, JSON.stringify(resultData));

  res.status(200).json({
    success: true,
    data: resultData
  });
});

export const getStoreFollowers = asyncHandler(async (req, res) => {
  const { storeUrl } = req.params;
  const requesterId = req.user?.userId;

  // Find store
  const store = await prisma.store.findFirst({
    where: { 
      url: storeUrl,
    },
    select: { id: true, userId: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  const storeId = store.id;
  
  // Only store owner or admin can see full follower list
  // Regular users can only see count (privacy protection)
  const canViewFullList = requesterId === store.userId || req.user?.role === 'ADMIN';
  
  if (!canViewFullList) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to view this store\'s followers. Use the count endpoint instead.'
    });
  }

  const cacheKey = `store:${storeId}:followers`;

  // Check cache
  const cachedFollowers = await cache.get(cacheKey);
  if (cachedFollowers) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedFollowers),
      cached: true
    });
  }

  // Fetch followers
  const followers = await prisma.storeFollower.findMany({
    where: { storeId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          // Don't expose email or phone for privacy
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const resultData = {
    followers: followers.map(f => ({
      id: f.user.id,
      firstName: f.user.firstName,
      followedAt: f.createdAt
    })),
    count: followers.length
  };

  // Cache for 30 minutes
  await cache.set(cacheKey, 1800, JSON.stringify(resultData));

  res.status(200).json({
    success: true,
    data: resultData
  });
});

export const getStoreFollowerCount = asyncHandler(async (req, res) => {
  const { storeUrl } = req.params;

  // Find store (no need to check isActive for counts)
  const store = await prisma.store.findFirst({
    where: { url: storeUrl },
    select: { id: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  const storeId = store.id;
  const cacheKey = `store:${storeId}:followers:count`;

  // Check cache
  const cachedCount = await cache.get(cacheKey);
  if (cachedCount !== null) {
    return res.status(200).json({
      success: true,
      data: { count: parseInt(cachedCount) },
      cached: true
    });
  }

  // Get count from database
  const count = await prisma.storeFollower.count({
    where: { storeId }
  });

  // Cache for 15 minutes
  await cache.set(cacheKey, 900, count.toString());

  res.status(200).json({
    success: true,
    data: { count }
  });
});

export const checkIfFollowing = asyncHandler(async (req, res) => {
  const followerId = req.user.userId;
  const { storeUrl } = req.params;

  // Find store
  const store = await prisma.store.findFirst({
    where: { url: storeUrl },
    select: { id: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  const storeId = store.id;

  // Check if following
  const isFollowing = await prisma.storeFollower.findUnique({
    where: {
      userId_storeId: {
        userId: followerId,
        storeId
      }
    }
  });

  res.status(200).json({
    success: true,
    data: { 
      isFollowing: !!isFollowing,
      ...(isFollowing && { followedAt: isFollowing.createdAt })
    }
  });
});

export const getMyStoreFollowerCount = asyncHandler(async (req, res) => {
  const sellerId = req.user.userId;

  // Find the seller's store
  const store = await prisma.store.findFirst({
    where: { 
      userId: sellerId,
    },
    select: { id: true, name: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'You do not have an active store.'
    });
  }

  const storeId = store.id;
  const cacheKey = `store:${storeId}:followers:count`;

  // Check cache
  const cachedCount = await cache.get(cacheKey);
  if (cachedCount !== null) {
    return res.status(200).json({
      success: true,
      data: { 
        count: parseInt(cachedCount),
        storeName: store.name 
      },
      cached: true
    });
  }

  // Get follower count from database
  const count = await prisma.storeFollower.count({
    where: { storeId }
  });

  // Cache for 15 minutes
  await cache.set(cacheKey, 900, count.toString());

  res.status(200).json({
    success: true,
    data: { 
      count,
      storeName: store.name
    }
  });
});

// Bulk check following status for multiple stores (useful for listings)
export const bulkCheckFollowing = asyncHandler(async (req, res) => {
  const followerId = req.user.userId;
  const { storeIds } = req.body;

  // Validate input
  if (!Array.isArray(storeIds) || storeIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'storeIds must be a non-empty array'
    });
  }

  // Limit to 50 stores at a time
  if (storeIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Cannot check more than 50 stores at once'
    });
  }

  // Validate all are CUIDs
  const cuidRegex = /^c[a-z0-9]{24}$/;
  const allValid = storeIds.every(id => cuidRegex.test(id));
  
  if (!allValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid store ID format'
    });
  }

  // Get all follow relationships
  const following = await prisma.storeFollower.findMany({
    where: {
      userId: followerId,
      storeId: { in: storeIds }
    },
    select: {
      storeId: true,
      createdAt: true
    }
  });

  // Create map of storeId -> isFollowing
  const followingMap = {};
  storeIds.forEach(storeId => {
    const followRecord = following.find(f => f.storeId === storeId);
    followingMap[storeId] = {
      isFollowing: !!followRecord,
      ...(followRecord && { followedAt: followRecord.createdAt })
    };
  });

  res.status(200).json({
    success: true,
    data: followingMap
  });
});