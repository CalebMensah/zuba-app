import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

export const assignCourier = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;

    const {
      courierService,
      driverName,
      driverPhone,
      driverVehicleNumber,
      trackingNumber,
      trackingUrl,
      estimatedDelivery,
      notes
    } = req.body;

    if (!courierService || !driverName || !driverVehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Courier service name, driver name, and driver vehicle number are required.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { 
          select: { 
            userId: true,
            name: true,
            user: { select: { email: true, firstName: true } }
          } 
        },
        buyer: {
          select: { email: true, firstName: true }
        },
        deliveryInfo: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to assign courier for this order.'
      });
    }

    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign courier for order in status: ${order.status}. Expected 'CONFIRMED' or 'PROCESSING'.`
      });
    }

    if (order.deliveryInfo && (order.deliveryInfo.courierService || order.deliveryInfo.driverName)) {
      return res.status(409).json({
        success: false,
        message: 'Courier information already assigned for this order. Use the edit endpoint to update.'
      });
    }

    let updatedDeliveryInfo;

    if (order.deliveryInfo) {
      updatedDeliveryInfo = await prisma.deliveryInfo.update({
        where: { orderId },
        data: {
          courierService,
          driverName,
          driverPhone: driverPhone || null,
          driverVehicleNumber,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
          notes: notes || order.deliveryInfo.notes,
          status: 'PROCESSING'
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Delivery information not found. It should have been created during order creation.'
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' }
    });

    try {
      const buyerId = order.buyerId;
      const buyerName = order.buyer.firstName;
      const storeName = order.store.name;
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

      await sendNotification(
        buyerId,
        'Courier Assigned',
        `A courier has been assigned for your order #${orderId} from ${storeName}.`,
        'COURIER_ASSIGNED',
        { orderId, courierService, driverName }
      );

      await sendEmailNotification({
        to: order.buyer.email,
        toName: buyerName,
        subject: `Courier Assigned for Order #${orderId}`,
        template: 'generic',
        templateData: {
          title: 'Courier Assigned!',
          message: `Your order #${orderId} from ${storeName} has been assigned to ${courierService}. Driver: ${driverName}. ${trackingNumber ? `Tracking: ${trackingNumber}` : ''}`,
          ctaText: 'Track Order',
          ctaUrl: orderUrl
        }
      });
    } catch (notificationError) {
      console.error('Error sending courier assignment notification:', notificationError);
    }

    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(201).json({
      success: true,
      message: 'Courier assigned successfully.',
      data: updatedDeliveryInfo
    });

  } catch (error) {
    console.error('Error assigning courier:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getDeliveryInfoByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const cacheKey = `delivery:${orderId}:user:${userId}`;

    const cachedDelivery = await cache.get(cacheKey);
    if (cachedDelivery) {
      return res.status(200).json({
        success: true,
        data: cachedDelivery,
        cached: true
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { 
        buyerId: true, 
        store: { select: { userId: true } } 
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.buyerId !== userId && order.store.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view delivery info for this order.'
      });
    }

    const deliveryInfo = await prisma.deliveryInfo.findUnique({
      where: { orderId: orderId }
    });

    if (!deliveryInfo) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information not found for this order.'
      });
    }

    await cache.set(cacheKey, deliveryInfo, 300);

    res.status(200).json({
      success: true,
      data: deliveryInfo
    });

  } catch (error) {
    console.error('Error fetching delivery info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const editAssignedDeliveryCourierInfo = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;

    const {
      courierService,
      driverName,
      driverPhone,
      driverVehicleNumber,
      trackingNumber,
      trackingUrl,
      estimatedDelivery,
      notes,
      status
    } = req.body;

    const existingDeliveryInfo = await prisma.deliveryInfo.findUnique({
      where: { orderId: orderId }
    });

    if (!existingDeliveryInfo) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information record not found for this order.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: existingDeliveryInfo.orderId },
      include: { 
        store: { 
          select: { 
            userId: true,
            name: true,
            user: { select: { email: true, firstName: true } }
          } 
        },
        buyer: {
          select: { email: true, firstName: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Associated order not found.'
      });
    }

    if (order.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit delivery info for this order.'
      });
    }

    const updateData = {};
    if (courierService !== undefined) updateData.courierService = courierService;
    if (driverName !== undefined) updateData.driverName = driverName;
    if (driverPhone !== undefined) updateData.driverPhone = driverPhone || null;
    if (driverVehicleNumber !== undefined) updateData.driverVehicleNumber = driverVehicleNumber;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl || null;
    if (estimatedDelivery !== undefined) updateData.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided for update.'
      });
    }

    const updatedDeliveryInfo = await prisma.deliveryInfo.update({
      where: { orderId: orderId },
      data: updateData
    });

    try {
      if (trackingNumber && trackingNumber !== existingDeliveryInfo.trackingNumber) {
        const buyerId = order.buyerId;
        const buyerName = order.buyer.firstName;
        const storeName = order.store.name;
        const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

        await sendNotification(
          buyerId,
          'Tracking Updated',
          `Tracking information updated for order #${orderId} from ${storeName}.`,
          'TRACKING_UPDATED',
          { orderId, trackingNumber }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Tracking Updated for Order #${orderId}`,
          template: 'generic',
          templateData: {
            title: 'Tracking Information Updated',
            message: `Your order #${orderId} from ${storeName} now has tracking information: ${trackingNumber}`,
            ctaText: 'Track Order',
            ctaUrl: trackingUrl || orderUrl
          }
        });
      }
    } catch (notificationError) {
      console.error('Error sending delivery update notification:', notificationError);
    }

    await cache.del(`order:${order.id}:user:${order.buyerId}`);
    await cache.del(`order:${order.id}:user:${order.store.userId}`);
    await cache.del(`delivery:${orderId}:user:${order.buyerId}`);
    await cache.del(`delivery:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Delivery information updated successfully.',
      data: updatedDeliveryInfo
    });

  } catch (error) {
    console.error('Error editing delivery courier info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteAssignedDeliveryCourierInfo = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;

    const deliveryInfoToDelete = await prisma.deliveryInfo.findUnique({
      where: { orderId: orderId }
    });

    if (!deliveryInfoToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information record not found for this order.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: deliveryInfoToDelete.orderId },
      include: { store: { select: { userId: true } } }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Associated order not found.'
      });
    }

    if (order.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete delivery info for this order.'
      });
    }

    if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete delivery info for order in status: ${order.status}.`
      });
    }

    await prisma.deliveryInfo.update({
      where: { orderId: orderId },
      data: {
        courierService: null,
        driverName: null,
        driverPhone: null,
        driverVehicleNumber: null,
        trackingNumber: null,
        trackingUrl: null,
        estimatedDelivery: null,
        status: 'PENDING'
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' }
    });

    await cache.del(`order:${order.id}:user:${order.buyerId}`);
    await cache.del(`order:${order.id}:user:${order.store.userId}`);
    await cache.del(`delivery:${orderId}:user:${order.buyerId}`);
    await cache.del(`delivery:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Courier assignment removed successfully.'
    });

  } catch (error) {
    console.error('Error deleting delivery courier info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const setDeliveryStatus = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'];
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid delivery status. Must be one of: ${validStatuses.join(', ')}.`
      });
    }

    const deliveryInfo = await prisma.deliveryInfo.findUnique({
      where: { orderId: orderId }
    });

    if (!deliveryInfo) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information record not found for this order.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: deliveryInfo.orderId },
      include: { 
        store: { 
          select: { 
            userId: true,
            name: true,
            user: { select: { email: true, firstName: true } }
          } 
        },
        buyer: {
          select: { email: true, firstName: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Associated order not found.'
      });
    }

    if (order.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update delivery status for this order.'
      });
    }

    const updatedDeliveryInfo = await prisma.deliveryInfo.update({
      where: { orderId: orderId },
      data: { 
        status,
        ...(status === 'DELIVERED' && { actualDelivery: new Date() })
      }
    });

    if (status === 'OUT_FOR_DELIVERY') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'OUT_FOR_DELIVERY' }
      });
    } else if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' }
      });
    }

    try {
      const buyerId = order.buyerId;
      const buyerName = order.buyer.firstName;
      const storeName = order.store.name;
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

      if (status === 'OUT_FOR_DELIVERY') {
        await sendNotification(
          buyerId,
          'Out for Delivery',
          `Your order #${orderId} from ${storeName} is out for delivery.`,
          'OUT_FOR_DELIVERY',
          { orderId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Order #${orderId} is Out for Delivery`,
          template: 'generic',
          templateData: {
            title: 'Out for Delivery!',
            message: `Your order #${orderId} from ${storeName} is out for delivery and will arrive soon.`,
            ctaText: 'Track Order',
            ctaUrl: orderUrl
          }
        });
      } else if (status === 'DELIVERED') {
        await sendNotification(
          buyerId,
          'Order Delivered',
          `Your order #${orderId} from ${storeName} has been delivered.`,
          'ORDER_DELIVERED',
          { orderId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Order #${orderId} Delivered`,
          template: 'generic',
          templateData: {
            title: 'Order Delivered!',
            message: `Your order #${orderId} from ${storeName} has been delivered. Please confirm receipt.`,
            ctaText: 'Confirm Delivery',
            ctaUrl: orderUrl
          }
        });
      }
    } catch (notificationError) {
      console.error('Error sending delivery status notification:', notificationError);
    }

    await cache.del(`order:${order.id}:user:${order.buyerId}`);
    await cache.del(`order:${order.id}:user:${order.store.userId}`);
    await cache.del(`delivery:${orderId}:user:${order.buyerId}`);
    await cache.del(`delivery:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status}.`,
      data: updatedDeliveryInfo
    });

  } catch (error) {
    console.error('Error setting delivery status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add this to your deliverycontrollers.js file

export const getAllSellerDeliveries = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { status, page = 1, limit = 50 } = req.query;

    // Build filter conditions
    const where = {
      store: {
        userId: sellerId
      }
    };

    // Add status filter if provided
    if (status && status !== 'ALL') {
      where.deliveryInfo = {
        status: status
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Fetch orders with delivery info for the seller
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          deliveryInfo: true,
          store: {
            select: {
              id: true,
              name: true,
              userId: true
            }
          },
          buyer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.order.count({ where })
    ]);

    // Filter out orders without delivery info and map to delivery info
    const deliveries = orders
      .filter(order => order.deliveryInfo !== null)
      .map(order => ({
        ...order.deliveryInfo,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          buyer: order.buyer,
          store: order.store
        }
      }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / take);
    const hasMore = page < totalPages;

    res.status(200).json({
      success: true,
      data: deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages,
        hasMore
      }
    });

  } catch (error) {
    console.error('Error fetching seller deliveries:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSellerDeliveryStats = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    // Get all orders for the seller with delivery info
    const orders = await prisma.order.findMany({
      where: {
        store: {
          userId: sellerId
        },
        deliveryInfo: {
          isNot: null
        }
      },
      include: {
        deliveryInfo: true
      }
    });

    // Calculate statistics
    const stats = {
      total: orders.length,
      pending: 0,
      processing: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      if (order.deliveryInfo) {
        const status = order.deliveryInfo.status.toLowerCase();
        switch (status) {
          case 'pending':
            stats.pending++;
            break;
          case 'processing':
            stats.processing++;
            break;
          case 'shipped':
            stats.shipped++;
            break;
          case 'out_for_delivery':
            stats.outForDelivery++;
            break;
          case 'delivered':
            stats.delivered++;
            break;
          case 'returned':
            stats.returned++;
            break;
          case 'cancelled':
            stats.cancelled++;
            break;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};