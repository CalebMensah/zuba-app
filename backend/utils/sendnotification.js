import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js'; 


export const sendNotification = async (userId, title, message, type, data = null) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data || null,
      }
    });

    // Invalidate user's notification cache
    await cache.del(`notifications:user:${userId}:all`);
    await cache.del(`notifications:user:${userId}:unread`);

    // Here you could potentially emit a Socket.IO event to the user
    // if real-time notifications are desired.
    // io.to(userId).emit('newNotification', notification);

    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};