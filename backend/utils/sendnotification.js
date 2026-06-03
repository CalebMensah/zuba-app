import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import admin from '../config/firebase.js';
import { TokenManager } from './tokenManager.js';

export const sendNotification = async (userId, title, message, type, data = null) => {
  try {
    // Validate inputs
    if (!userId || !title || !message || !type) {
      throw new Error('Missing required notification parameters');
    }

    // Save to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data || null,
      }
    });

    // Invalidate cache
    await Promise.all([
      cache.del(`notifications:user:${userId}:all`),
      cache.del(`notifications:user:${userId}:unread`)
    ]);

    //BUILD NAVIGATION DATA based on notification type
    const navigationData = buildNavigationData(type, data);

    // Send push notifications to all active devices
    try {
      await sendPushNotifications(userId, {
        title,
        body: message,
        data: {
          notificationId: notification.id,
          type,
          ...navigationData,
          ...data // Keep original data too
        }
      });
    } catch (pushError) {
      console.error(`Push notification failed for user ${userId}:`, pushError.message);
      // Don't throw - push failure shouldn't break the flow
    }

    return notification;

  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Build navigation data based on notification type
function buildNavigationData(type, data) {
  switch (type) {
    case 'order_created':
    case 'order_confirmation':
    case 'order_shipped':
    case 'order_delivered':
    case 'order_cancelled':
      return {
        screen: 'OrderDetail',
        orderId: data?.orderId
      };

    case 'message':
    case 'new_message':
      return {
        screen: 'MessageDetail',
        messageId: data?.messageId,
        conversationId: data?.conversationId
      };

    case 'chat':
    case 'new_chat':
      return {
        screen: 'Chat',
        chatId: data?.chatId,
        userId: data?.senderId || data?.userId
      };

    case 'product_review':
      return {
        screen: 'ProductDetail',
        productId: data?.productId
      };

    case 'store_follower':
      return {
        screen: 'StoreProfile',
        storeId: data?.storeId
      };

    default:
      // Generic notifications go to notifications screen
      return {
        screen: 'Notifications'
      };
  }
}

export const sendPushNotifications = async (userId, payload) => {
  try {
    // Get all active tokens grouped by provider
    const { fcm, expo, web } = await TokenManager.getGroupedTokens(userId);
    
    const results = {
      fcm: { success: 0, failed: 0 },
      expo: { success: 0, failed: 0 },
      web: { success: 0, failed: 0 }
    };

    // Send FCM notifications
    if (fcm.length > 0) {
      const fcmTokens = fcm.map(t => t.token);
      const fcmResults = await sendFCMBatch(fcmTokens, payload);
      results.fcm = fcmResults;
    }

    // Send Expo notifications
    if (expo.length > 0) {
      const expoTokens = expo.map(t => t.token);
      const expoResults = await sendExpoBatch(expoTokens, payload);
      results.expo = expoResults;
    }

    // Send Web Push notifications
    if (web.length > 0) {
      const webTokens = web.map(t => t.token);
      const webResults = await sendWebPushBatch(webTokens, payload);
      results.web = webResults;
    }

    console.log(`Push sent to user ${userId}:`, results);
    return results;

  } catch (error) {
    console.error('Error sending push notifications:', error);
    throw error;
  }
};

async function sendFCMBatch(tokens, payload) {
  const results = { success: 0, failed: 0 };

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: convertDataToStrings(payload.data || {}),
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          defaultVibrateTimings: true,
          visibility: 'public',
          // ✅ This makes it show in foreground
          notificationPriority: 'PRIORITY_HIGH',
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            sound: 'default',
            contentAvailable: true,
          }
        }
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Process results
    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        results.success++;
        TokenManager.touch(tokens[idx]).catch(console.error);
      } else {
        results.failed++;
        const errorCode = resp.error?.code;
        
        TokenManager.markFailed(tokens[idx], errorCode).catch(console.error);
        
        console.warn(`FCM failed for token ${tokens[idx].substring(0, 20)}...: ${errorCode}`);
      }
    });

  } catch (error) {
    console.error('FCM batch send error:', error);
    results.failed = tokens.length;
  }

  return results;
}

async function sendExpoBatch(tokens, payload) {
  const results = { success: 0, failed: 0 };

  try {
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {}, // Expo accepts any JSON-serializable data
      priority: 'high',
      channelId: 'default'
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages)
    });

    const data = await response.json();

    console.log('📤 Expo API Response:', JSON.stringify(data, null, 2));

    // Process Expo results
    data.data?.forEach((result, idx) => {
      if (result.status === 'ok') {
        results.success++;
        TokenManager.touch(tokens[idx]).catch(console.error);
      } else {
        results.failed++;
        console.error(`❌ Expo push failed: ${result.message}`);
        TokenManager.markFailed(tokens[idx], result.message).catch(console.error);
      }
    });

  } catch (error) {
    console.error('Expo batch send error:', error);
    results.failed = tokens.length;
  }

  return results;
}

async function sendWebPushBatch(tokens, payload) {
  const results = { success: 0, failed: 0 };

  // TODO: Implement web push using web-push library
  console.log('Web push not yet implemented');
  
  return results;
}

//Helper: Convert data object to strings (FCM requirement)
function convertDataToStrings(data) {
  const stringData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      stringData[key] = String(value);
    }
  }
  return stringData;
}

export const registerFCMToken = async (userId, fcmToken) => {
  console.warn('registerFCMToken is deprecated. Use TokenManager.register() instead');
  
  try {
    if (!fcmToken || typeof fcmToken !== 'string') {
      throw new Error('Invalid FCM token');
    }

    // Legacy support - update old fcmToken field
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken }
    });

    return { success: true };
  } catch (error) {
    console.error('Error registering FCM token:', error);
    throw error;
  }
};

export const unregisterFCMToken = async (userId) => {
  console.warn('unregisterFCMToken is deprecated. Use TokenManager.revokeAllForUser() instead');
  
  try {
    // Legacy support - clear old fcmToken field
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null }
    });

    return { success: true };
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    throw error;
  }
};