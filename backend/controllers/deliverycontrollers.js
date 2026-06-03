import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { uploadMultipleToCloudinary } from '../config/cloudinary.js';


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
      where: { orderId },
      include: {
        deliveryProofs: true
      }
    });

    if (!deliveryInfo) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information not found for this order.'
      });
    }

    await cache.set(cacheKey, deliveryInfo, 300);

    return res.status(200).json({
      success: true,
      data: deliveryInfo
    });

  } catch (error) {
    console.error('Error fetching delivery info:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const shipOrder = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;

    const {
      courierService,
      trackingNumber,
      estimatedDeliveryDays,
      dispatchNote
    } = req.body;

    if (!courierService) {
      return res.status(400).json({
        success: false,
        message: 'courierService is required.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one delivery proof image is required.'
      });
    }

    if (estimatedDeliveryDays !== undefined && isNaN(parseInt(estimatedDeliveryDays))) {
      return res.status(400).json({
        success: false,
        message: 'estimatedDeliveryDays must be a number.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true, name: true } },
        buyer: { select: { id: true, email: true, firstName: true } },
        deliveryInfo: true
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to ship this order.'
      });
    }

    const delivery = order.deliveryInfo;
    if (!delivery) {
      return res.status(400).json({
        success: false,
        message: 'Delivery info not found for this order.'
      });
    }

    if (delivery.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot ship order. Delivery status must be PENDING, currently ${delivery.status}.`
      });
    }

    // Upload proof images to Cloudinary first
    const buffers = req.files.map(file => file.buffer);
    const uploads = await uploadMultipleToCloudinary(buffers, {
      folder: 'delivery-proofs',
      resource_type: 'image'
    });
    const proofUrls = uploads.map(file => file.secure_url);

    // Atomic transaction: update delivery + create proofs + update order
    const result = await prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.deliveryInfo.update({
        where: { orderId },
        data: {
          courierService,
          trackingNumber: trackingNumber || null,
          estimatedDeliveryDays: estimatedDeliveryDays ? parseInt(estimatedDeliveryDays) : null,
          dispatchNote: dispatchNote || null,
          status: 'DISPATCHED',
          dispatchedAt: new Date()
        }
      });

      await Promise.all(
        proofUrls.map(url =>
          tx.deliveryProof.create({
            data: {
              deliveryId: updatedDelivery.id,
              type: 'DISPATCH_RECEIPT',
              fileUrl: url,
              uploadedById: sellerId,
              uploadedRole: 'SELLER'
            }
          })
        )
      );

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'SHIPPED' }
      });

      return { updatedDelivery, updatedOrder };
    });

    // Notifications (non-blocking)
    try {
      await sendNotification(
        order.buyer.id,
        'Order Shipped',
        `Your order #${orderId} from ${order.store.name} has been shipped via ${courierService}.`,
        'ORDER_SHIPPED',
        { orderId, trackingNumber }
      );

      await sendEmailNotification({
        to: order.buyer.email,
        toName: order.buyer.firstName,
        subject: `Your Order (#${orderId}) Has Been Shipped!`,
        template: 'order_shipped',
        templateData: {
          orderId,
          courierService,
          trackingNumber: trackingNumber || 'N/A',
          estimatedDeliveryDays: estimatedDeliveryDays || 'N/A',
          orderUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`
        }
      });
    } catch (e) {
      console.error('Notification error:', e);
    }

    // Cache invalidation
    await Promise.all([
      cache.del(`order:${orderId}:user:${order.buyer.id}`),
      cache.del(`order:${orderId}:user:${sellerId}`),
      cache.del(`delivery:${orderId}:user:${order.buyer.id}`),
      cache.del(`delivery:${orderId}:user:${sellerId}`),
      cache.del(`user:${order.buyer.id}:orders`),
      cache.del(`store:${order.storeId}:orders`)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Order shipped successfully.',
      data: {
        orderId: result.updatedOrder.id,
        orderStatus: result.updatedOrder.status,
        deliveryStatus: result.updatedDelivery.status,
        courierService,
        trackingNumber: trackingNumber || null,
        estimatedDeliveryDays: result.updatedDelivery.estimatedDeliveryDays,
        dispatchedAt: result.updatedDelivery.dispatchedAt,
        proofs: proofUrls
      }
    });

  } catch (error) {
    console.error('Ship order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to ship order'
    });
  }
};


export const updateDeliveryInfo = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { orderId } = req.params;

    const {
      courierService,
      trackingNumber,
      estimatedDeliveryDays,
      dispatchNote,
      status
    } = req.body;

    const ALLOWED_STATUSES = ['PENDING', 'PROCESSING', 'DISPATCHED', 'FAILED', 'RETURNED'];

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    if (estimatedDeliveryDays !== undefined && isNaN(parseInt(estimatedDeliveryDays))) {
      return res.status(400).json({
        success: false,
        message: 'estimatedDeliveryDays must be a number.'
      });
    }

    const existingDelivery = await prisma.deliveryInfo.findUnique({
      where: { orderId }
    });

    if (!existingDelivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery information not found for this order.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true, name: true } },
        buyer: { select: { id: true, email: true, firstName: true } }
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
        message: 'Unauthorized to update delivery info for this order.'
      });
    }

    const updateData = {};
    if (courierService !== undefined) updateData.courierService = courierService;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null;
    if (estimatedDeliveryDays !== undefined) updateData.estimatedDeliveryDays = parseInt(estimatedDeliveryDays);
    if (dispatchNote !== undefined) updateData.dispatchNote = dispatchNote || null;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update.'
      });
    }

    const updatedDelivery = await prisma.deliveryInfo.update({
      where: { orderId },
      data: updateData
    });

    // Notify buyer if tracking number changed
    try {
      if (trackingNumber && trackingNumber !== existingDelivery.trackingNumber) {
        await sendNotification(
          order.buyer.id,
          'Tracking Updated',
          `Tracking information updated for order #${orderId} from ${order.store.name}.`,
          'TRACKING_UPDATED',
          { orderId, trackingNumber }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: order.buyer.firstName,
          subject: `Tracking Updated for Order #${orderId}`,
          template: 'generic',
          templateData: {
            title: 'Tracking Information Updated',
            message: `Your order #${orderId} now has tracking number: ${trackingNumber}`,
            ctaText: 'View Order',
            ctaUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`
          }
        });
      }
    } catch (notificationError) {
      console.error('Error sending delivery update notification:', notificationError);
    }

    // Cache invalidation
    await Promise.all([
      cache.del(`order:${orderId}:user:${order.buyer.id}`),
      cache.del(`order:${orderId}:user:${sellerId}`),
      cache.del(`delivery:${orderId}:user:${order.buyer.id}`),
      cache.del(`delivery:${orderId}:user:${sellerId}`),
      cache.del(`user:${order.buyer.id}:orders`),
      cache.del(`store:${order.storeId}:orders`)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Delivery information updated successfully.',
      data: updatedDelivery
    });

  } catch (error) {
    console.error('Error updating delivery info:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const addDeliveryProof = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;
    const { type, note } = req.body;

    const VALID_PROOF_TYPES = [
      'HANDOVER_PHOTO',
      'WAYBILL',
      'DISPATCH_RECEIPT',
      'DELIVERY_PHOTO',
      'BUYER_SIGNATURE',
      'OTP_CONFIRMATION'
    ];

    if (!type || !VALID_PROOF_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Proof type is required. Allowed: ${VALID_PROOF_TYPES.join(', ')}`
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one proof image is required.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true } },
        deliveryInfo: true
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const isSeller = order.store.userId === userId;
    const isBuyer = order.buyerId === userId;

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to upload proof for this order.'
      });
    }

    const delivery = order.deliveryInfo;
    if (!delivery) {
      return res.status(400).json({
        success: false,
        message: 'Delivery info not found for this order.'
      });
    }

    // Upload to Cloudinary
    const buffers = req.files.map(file => file.buffer);
    const uploads = await uploadMultipleToCloudinary(buffers, {
      folder: 'delivery-proofs',
      resource_type: 'image'
    });
    const proofUrls = uploads.map(file => file.secure_url);

    const createdProofs = await Promise.all(
      proofUrls.map(url =>
        prisma.deliveryProof.create({
          data: {
            deliveryId: delivery.id,
            type,
            fileUrl: url,
            note: note || null,
            uploadedById: userId,
            uploadedRole: isSeller ? 'SELLER' : 'BUYER'
          }
        })
      )
    );

    // Invalidate delivery cache for both parties
    await Promise.all([
      cache.del(`delivery:${orderId}:user:${order.buyerId}`),
      cache.del(`delivery:${orderId}:user:${order.store.userId}`)
    ]);

    return res.status(201).json({
      success: true,
      message: 'Delivery proof added successfully.',
      data: createdProofs
    });

  } catch (error) {
    console.error('Add delivery proof error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};



export const getAllSellerDeliveries = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { status, page = 1, limit = 50 } = req.query;

    const VALID_STATUSES = ['PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'RETURNED'];

    if (status && status !== 'ALL' && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Allowed: ALL, ${VALID_STATUSES.join(', ')}`
      });
    }

    const where = {
      store: { userId: sellerId }
    };

    if (status && status !== 'ALL') {
      where.deliveryInfo = { status };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          deliveryInfo: {
            include: { deliveryProofs: true }
          },
          store: { select: { id: true, name: true, userId: true } },
          buyer: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.order.count({ where })
    ]);

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

    return res.status(200).json({
      success: true,
      data: deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / take),
        hasMore: parseInt(page) < Math.ceil(totalCount / take)
      }
    });

  } catch (error) {
    console.error('Error fetching seller deliveries:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



export const getBuyerDeliveries = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { status, page = 1, limit = 50 } = req.query;

    const VALID_STATUSES = ['PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'RETURNED'];

    if (status && status !== 'ALL' && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Allowed: ALL, ${VALID_STATUSES.join(', ')}`
      });
    }

    const where = {
      buyerId
    };

    if (status && status !== 'ALL') {
      where.deliveryInfo = { status };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          deliveryInfo: {
            include: { deliveryProofs: true }
          },
          store: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.order.count({ where })
    ]);

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
          store: order.store
        }
      }));

    return res.status(200).json({
      success: true,
      data: deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / take),
        hasMore: parseInt(page) < Math.ceil(totalCount / take)
      }
    });

  } catch (error) {
    console.error('Error fetching buyer deliveries:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSellerDeliveryStats = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const statusCounts = await prisma.deliveryInfo.groupBy({
      by: ['status'],
      where: {
        order: {
          store: { userId: sellerId }
        }
      },
      _count: { status: true }
    });

    const stats = {
      total: 0,
      PENDING: 0,
      PROCESSING: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
      FAILED: 0,
      RETURNED: 0
    };

    statusCounts.forEach(({ status, _count }) => {
      stats[status] = _count.status;
      stats.total += _count.status;
    });

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};