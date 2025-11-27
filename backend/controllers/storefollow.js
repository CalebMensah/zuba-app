import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';
import { sendNotification } from '../utils/sendnotification.js';


export const followStore = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'storeId is required.'
      });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId},
      select: { id: true, userId: true, name: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    if (store.userId === followerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow your own store.'
      });
    }

    try {
      const followRecord = await prisma.storeFollower.create({
        data: {
          userId: followerId,
          storeId
        }
      });

      await cache.del(`user:${followerId}:following`);
      await cache.del(`store:${storeId}:followers:count`);
      await cache.del(`store:${storeId}:followers`);

      const follower = await prisma.user.findUnique({
        where: { id: followerId },
        select: { firstName: true }
      });

      await sendNotification(
        store.userId,
        'New Follower',
        `${follower?.firstName || 'Someone'} started following your store "${store.name}"`,
        'STORE_FOLLOW',
        { storeId, followerId, storeName: store.name }
      );

      res.status(201).json({
        success: true,
        message: 'Store followed successfully.',
        data: followRecord
      });

    } catch (prismaError) {
      if (prismaError.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'You are already following this store.'
        });
      }
      throw prismaError;
    }

  } catch (error) {
    console.error('Error following store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const unfollowStore = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'storeId is required.'
      });
    }

    const deletedFollowRecord = await prisma.storeFollower.delete({
      where: {
        userId_storeId: {
          userId: followerId,
          storeId
        }
      }
    });

    await cache.del(`user:${followerId}:following`);
    await cache.del(`store:${storeId}:followers:count`);
    await cache.del(`store:${storeId}:followers`);

    res.status(200).json({
      success: true,
      message: 'Store unfollowed successfully.',
      data: deletedFollowRecord
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'You are not following this store.'
      });
    }
    console.error('Error unfollowing store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getMyFollowing = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const cacheKey = `user:${followerId}:following`;

    const cachedFollowing = await cache.get(cacheKey);
    if (cachedFollowing) {
      return res.status(200).json({
        success: true,
        data: cachedFollowing,
        cached: true
      });
    }

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

    const resultData = {
      stores: following.map(f => f.store)
    };

    await cache.set(cacheKey, resultData, 1800);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching user following list:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getStoreFollowers = async (req, res) => {
  try {
    const { storeUrl } = req.params;

    const store = await prisma.store.findFirst({
      where: { url: storeUrl, isActive: true },
      select: { id: true, userId: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    const storeId = store.id;
    const cacheKey = `store:${storeId}:followers`;

    const cachedFollowers = await cache.get(cacheKey);
    if (cachedFollowers) {
      return res.status(200).json({
        success: true,
        data: cachedFollowers,
        cached: true
      });
    }

    const followers = await prisma.storeFollower.findMany({
      where: { storeId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const resultData = {
      followers: followers.map(f => f.user)
    };

    await cache.set(cacheKey, resultData, 1800);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching store followers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getStoreFollowerCount = async (req, res) => {
  try {
    const { storeUrl } = req.params;

    const store = await prisma.store.findFirst({
      where: { url: storeUrl },
      select: { id: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    const storeId = store.id;
    const cacheKey = `store:${storeId}:followers:count`;

    const cachedCount = await cache.get(cacheKey);
    if (cachedCount !== null) {
      return res.status(200).json({
        success: true,
        data: { count: cachedCount }
      });
    }

    const count = await prisma.storeFollower.count({
      where: { storeId }
    });

    await cache.set(cacheKey, count, 900);

    res.status(200).json({
      success: true,
      data: { count }
    });

  } catch (error) {
    console.error('Error fetching store follower count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const checkIfFollowing = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const { storeUrl } = req.params;

    const store = await prisma.store.findFirst({
      where: { url: storeUrl },
      select: { id: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    const storeId = store.id;

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
      data: { isFollowing: !!isFollowing }
    });

  } catch (error) {
    console.error('Error checking if following store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};