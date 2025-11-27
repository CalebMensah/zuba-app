import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';


export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, data } = req.body;

    // Validate required fields
    if (!userId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, message, and type are required.'
      });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data || null, // Store data as JSON if provided
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

    // Invalidate user's notification cache (if you cache them)
    await cache.del(`notifications:user:${userId}:all`);
    await cache.del(`notifications:user:${userId}:unread`);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const readFilter = req.query.read; // 'true', 'false', or undefined

    let whereClause = { userId };
    if (readFilter !== undefined) {
      whereClause.read = readFilter === 'true';
    }

    const cacheKey = `notifications:user:${userId}:page:${page}:limit:${limit}:read:${readFilter}`;

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }, // Newest first
      skip: offset,
      take: limit,
    });

    const total = await prisma.notification.count({ where: whereClause });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

    // If you implement caching later, set the cache here
    // await cache.set(cacheKey, resultData, 300); // Cache for 5 minutes

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId: userId // Security check
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or does not belong to user.'
      });
    }

    // Invalidate user's notification cache
    await cache.del(`notifications:user:${userId}:all`);
    await cache.del(`notifications:user:${userId}:unread`);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false // Only update unread ones
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    // Invalidate user's notification cache
    await cache.del(`notifications:user:${userId}:all`);
    await cache.del(`notifications:user:${userId}:unread`);

    res.status(200).json({
      success: true,
      message: `${result.count} notifications marked as read.`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const cacheKey = `notifications:user:${userId}:unread:count`;

    // Try to get count from cache first
    const cachedCount = await cache.get(cacheKey);
    if (cachedCount !== null) { // Check for null explicitly as 0 is a valid count
      return res.status(200).json({
        success: true,
        data: { count: cachedCount }
      });
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        read: false
      }
    });

    // Cache for 5 minutes
    await cache.set(cacheKey, count, 300);

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
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
      include: {
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

    // Cache the result for 10 minutes
    await cache.set(cacheKey, JSON.stringify(notification), 600);

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error fetching notification by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};