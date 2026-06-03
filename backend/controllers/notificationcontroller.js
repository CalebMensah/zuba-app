import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';

// Helper function to sanitize error messages in production
const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', error);
    return 'Internal server error';
  }
  return error.message;
};

// Helper function to invalidate notification caches
const invalidateNotificationCaches = async (userId) => {
  const cacheKeys = [
    `notifications:user:${userId}:all`,
    `notifications:user:${userId}:unread`,
    `notifications:user:${userId}:unread:count`
  ];

  // Also invalidate paginated cache keys (delete pattern)
  // Note: This is a simple approach. For production, consider using Redis SCAN
  for (let page = 1; page <= 10; page++) {
    for (const readFilter of ['true', 'false', 'undefined']) {
      cacheKeys.push(`notifications:user:${userId}:page:${page}:limit:10:read:${readFilter}`);
      cacheKeys.push(`notifications:user:${userId}:page:${page}:limit:20:read:${readFilter}`);
    }
  }

  await Promise.allSettled(cacheKeys.map(key => cache.del(key)));
};

export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, data } = req.body;

    // Verify user exists (security check)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
          }
        }
      }
    });

    // Invalidate user's notification cache
    await invalidateNotificationCaches(userId);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      data: notification
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100
    const offset = (page - 1) * limit;
    const readFilter = req.query.read;

    // Build where clause
    let whereClause = { userId };
    if (readFilter !== undefined) {
      whereClause.read = readFilter === 'true';
    }

    const cacheKey = `notifications:user:${userId}:page:${page}:limit:${limit}:read:${readFilter}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    // Fetch from database
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          data: true,
          read: true,
          readAt: true,
          createdAt: true
        }
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    const resultData = {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache for 2 minutes
    await cache.set(cacheKey, JSON.stringify(resultData), 120);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // First check if notification exists and belongs to user
    const existingNotification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or does not belong to you.'
      });
    }

    // Check if already read
    if (existingNotification.read) {
      return res.status(200).json({
        success: true,
        message: 'Notification was already marked as read.',
        data: existingNotification
      });
    }

    // Update notification
    const notification = await prisma.notification.update({
      where: {
        id: notificationId
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    // Invalidate user's notification cache
    await invalidateNotificationCaches(userId);

    // Also invalidate specific notification cache
    await cache.del(`notification:${notificationId}:user:${userId}`);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Update all unread notifications for the user
    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    // Invalidate user's notification cache
    await invalidateNotificationCaches(userId);

    res.status(200).json({
      success: true,
      message: `${result.count} notification(s) marked as read.`,
      updatedCount: result.count
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    // FIXED: Use req.user.userId (consistent with other endpoints)
    const userId = req.user.userId;

    const cacheKey = `notifications:user:${userId}:unread:count`;

    // Try to get count from cache first
    const cachedCount = await cache.get(cacheKey);
    if (cachedCount !== null && cachedCount !== undefined) {
      // Parse if it's a string
      const count = typeof cachedCount === 'string' ? parseInt(cachedCount, 10) : cachedCount;
      return res.status(200).json({
        success: true,
        data: { count }
      });
    }

    // Fetch unread count from database
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false
      }
    });

    // Cache for 2 minutes (shorter than other caches for real-time feel)
    await cache.set(cacheKey, count, 120);

    res.status(200).json({
      success: true,
      data: { count }
    });

  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // Check cache first
    const cacheKey = `notification:${notificationId}:user:${userId}`;
    const cachedNotification = await cache.get(cacheKey);
    
    if (cachedNotification) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedNotification)
      });
    }

    // Fetch from database
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId // Security: ensure notification belongs to user
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        data: true,
        read: true,
        readAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Check if notification exists
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you do not have access to it.'
      });
    }

    // Cache the result for 5 minutes
    await cache.set(cacheKey, JSON.stringify(notification), 300);

    res.status(200).json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Error fetching notification by ID:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or does not belong to you.'
      });
    }

    // Delete notification
    await prisma.notification.delete({
      where: {
        id: notificationId
      }
    });

    // Invalidate caches
    await invalidateNotificationCaches(userId);
    await cache.del(`notification:${notificationId}:user:${userId}`);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const deleteAllReadNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete all read notifications for the user
    const result = await prisma.notification.deleteMany({
      where: {
        userId: userId,
        read: true
      }
    });

    // Invalidate caches
    await invalidateNotificationCaches(userId);

    res.status(200).json({
      success: true,
      message: `${result.count} read notification(s) deleted successfully.`,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

