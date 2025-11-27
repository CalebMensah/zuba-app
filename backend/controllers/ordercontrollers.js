import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js'; 
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

export const createOrder = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { 
      storeId, 
      items, 
      deliveryInfo,
      billingInfo,
      totalAmount,
      subtotal,
      deliveryFee = 0,
      taxAmount = 0,
      discount = 0,
      currency = "GHS",
      paymentMethod,
      paymentProvider,
      promoCode,
      buyerEmail,
      buyerPhone,
      sameAsDelivery = true,
      checkoutSession // NEW: Checkout session identifier
    } = req.body;

    if (!storeId || !Array.isArray(items) || items.length === 0 || !totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'storeId, items (non-empty array), and totalAmount are required.'
      });
    }

    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'subtotal is required and must be greater than 0.'
      });
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0 || !item.price || item.price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have productId, quantity (positive), and price (non-negative).'
        });
      }
    }

    if (!deliveryInfo || !deliveryInfo.recipient || !deliveryInfo.phone || 
        !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.region) {
      return res.status(400).json({
        success: false,
        message: 'Delivery info must include recipient, phone, address, city, and region.'
      });
    }

    if (!sameAsDelivery && billingInfo) {
      if (!billingInfo.fullName || !billingInfo.email || !billingInfo.phone || 
          !billingInfo.address || !billingInfo.city || !billingInfo.region) {
        return res.status(400).json({
          success: false,
          message: 'Billing info must include fullName, email, phone, address, city, and region.'
        });
      }
    }

    const productDetails = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.productId} not found.`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${product.name}". Requested: ${item.quantity}, Available: ${product.stock}`
        });
      }

      productDetails.push({ product, quantity: item.quantity });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { user: { select: { id: true, email: true, firstName: true } } }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found.'
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          buyerId,
          storeId,
          totalAmount,
          subtotal,
          deliveryFee,
          taxAmount,
          discount,
          currency,
          paymentMethod: paymentMethod || null,
          paymentProvider: paymentProvider || null,
          promoCode: promoCode || null,
          buyerEmail: buyerEmail || null,
          buyerPhone: buyerPhone || null,
          checkoutSession: checkoutSession || null, // NEW: Store checkout session
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.quantity * item.price
            }))
          },
          deliveryInfo: {
            create: {
              recipient: deliveryInfo.recipient,
              phone: deliveryInfo.phone,
              email: deliveryInfo.email || null,
              address: deliveryInfo.address,
              city: deliveryInfo.city,
              region: deliveryInfo.region,
              country: deliveryInfo.country || "Ghana",
              postalCode: deliveryInfo.postalCode || null,
              deliveryType: deliveryInfo.deliveryType || "STANDARD",
              deliveryFee: deliveryFee,
              deliveryInstructions: deliveryInfo.deliveryInstructions || null,
              preferredDeliveryDate: deliveryInfo.preferredDeliveryDate 
                ? new Date(deliveryInfo.preferredDeliveryDate) 
                : null,
              preferredDeliveryTime: deliveryInfo.preferredDeliveryTime || null,
              notes: deliveryInfo.notes || null
            }
          },
          billingInfo: !sameAsDelivery && billingInfo ? {
            create: {
              fullName: billingInfo.fullName,
              email: billingInfo.email,
              phone: billingInfo.phone,
              address: billingInfo.address,
              city: billingInfo.city,
              region: billingInfo.region,
              country: billingInfo.country || "Ghana",
              postalCode: billingInfo.postalCode || null
            }
          } : undefined,
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'PENDING',
              changedBy: buyerId,
              reason: 'Order created'
            }
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          deliveryInfo: true,
          billingInfo: true,
          buyer: {
            select: {
              id: true,
              firstName: true,
              email: true
            }
          },
          store: {
            select: {
              id: true,
              name: true,
              url: true
            }
          }
        }
      });

      for (const { product, quantity } of productDetails) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: quantity
            },
            quantityBought: {
              increment: quantity
            }
          }
        });
      }

      return newOrder;
    });

    try {
      const sellerId = store.user.id;
      const sellerName = store.user.firstName;
      const buyerName = order.buyer.firstName;
      const storeName = order.store.name;
      const orderId = order.id;

      await sendNotification(
        sellerId,
        'New Order Received',
        `You have a new order (#${orderId}) from ${buyerName} for ${storeName}.`,
        'ORDER_CREATED',
        { orderId, buyerId, buyerName }
      );

      await sendEmailNotification({
        to: store.user.email,
        toName: sellerName,
        subject: `New Order Received (#${orderId}) from ${buyerName}`,
        template: 'generic',
        templateData: {
          title: 'New Order Alert!',
          message: `You have a new order (#${orderId}) from ${buyerName}. Please check your dashboard to review and process it.`,
          ctaText: 'View Order',
          ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}` 
        }
      });
    } catch (notificationError) {
      console.error('Error sending notification/email for new order:', notificationError);
    }
  
    await cache.del(`user:${buyerId}:orders`); 
    await cache.del(`store:${storeId}:orders`);
    
    for (const item of items) {
      await cache.del(`product:url:${item.productId}`);
    }
    await cache.del(`store:slug:${order.store.url}`);

    res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId; 

    const cacheKey = `order:${orderId}:user:${userId}`; 

    const cachedOrder = await cache.get(cacheKey);
    if (cachedOrder) {
      return res.status(200).json({
        success: true,
        data: cachedOrder,
        cached: true
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        deliveryInfo: true,
        billingInfo: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' }
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            userId: true
          }
        }
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
        message: 'Unauthorized to view this order.'
      });
    }

    await cache.set(cacheKey, order, 300);

    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getBuyerOrders = async (req, res) => {
  try {
    const buyerId = req.user.userId; 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status;

    const whereClause = { buyerId };
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const cacheKey = `user:${buyerId}:orders:page:${page}:limit:${limit}:status:${statusFilter || 'all'}`;

    const cachedOrders = await cache.get(cacheKey);
    if (cachedOrders) {
      return res.status(200).json({
        success: true,
        data: cachedOrders,
        cached: true
      });
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true }
            }
          }
        },
        deliveryInfo: {
          select: { status: true, trackingNumber: true, deliveryType: true }
        },
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true
          }
        }
      }
    });

    const total = await prisma.order.count({ where: whereClause });

    const resultData = {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cache.set(cacheKey, resultData, 600);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status;

    const sellerStore = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true }
    });

    if (!sellerStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = sellerStore.id;

    const whereClause = { storeId };
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const cacheKey = `store:${storeId}:orders:page:${page}:limit:${limit}:status:${statusFilter || 'all'}`;

    const cachedOrders = await cache.get(cacheKey);
    if (cachedOrders) {
      return res.status(200).json({
        success: true,
        data: cachedOrders,
        cached: true
      });
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true }
            }
          }
        },
        deliveryInfo: {
          select: { status: true, trackingNumber: true, deliveryType: true }
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            email: true
          }
        }
      }
    });

    const total = await prisma.order.count({ where: whereClause });

    const resultData = {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cache.set(cacheKey, resultData, 600);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// NEW: Get order by checkout session
export const getOrderByCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout session ID is required.'
      });
    }

    const cacheKey = `checkout:${sessionId}:user:${userId}`;

    const cachedOrder = await cache.get(cacheKey);
    if (cachedOrder) {
      return res.status(200).json({
        success: true,
        data: cachedOrder,
        cached: true
      });
    }

    const order = await prisma.order.findFirst({
      where: { 
        checkoutSession: sessionId,
        buyerId: userId // Ensure user can only access their own orders
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true, price: true }
            }
          }
        },
        deliveryInfo: true,
        billingInfo: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' }
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found for this checkout session.'
      });
    }

    await cache.set(cacheKey, order, 600);

    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order by checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// NEW: Update order with checkout session (useful for payment webhooks)
export const updateCheckoutSession = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { checkoutSession, paymentStatus, paymentRef } = req.body;

    if (!checkoutSession) {
      return res.status(400).json({
        success: false,
        message: 'Checkout session is required.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true, url: true } }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const updateData = { checkoutSession };
    
    if (paymentStatus && ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'].includes(paymentStatus)) {
      updateData.paymentStatus = paymentStatus;
    }
    
    if (paymentRef) {
      updateData.paymentRef = paymentRef;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    // Invalidate relevant caches
    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);
    await cache.del(`store:slug:${order.store.url}`);
    
    if (checkoutSession) {
      await cache.del(`checkout:${checkoutSession}:user:${order.buyerId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Order checkout session updated successfully.',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error updating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.userId;

    if (!status || !['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status is required and must be one of 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'."
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
        deliveryInfo: {
          select: { trackingNumber: true, trackingUrl: true, estimatedDelivery: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
  

    if (order.store.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this order status.'
      });
    }

    const validTransitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['OUT_FOR_DELIVERY'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}.`
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(status === 'DELIVERED' && { deliveredAt: new Date() })
        }
      });

      await tx.statusChange.create({
        data: {
          orderId,
          oldStatus: order.status,
          newStatus: status,
          changedBy: userId,
          reason: reason || null
        }
      });

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId }
        });
        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              quantityBought: { decrement: item.quantity }
            }
          });
        }
      }

      return updated;
    });

    try {
      const buyerId = order.buyerId;
      const buyerName = order.buyer.firstName;
      const sellerName = order.store.user.firstName;
      const storeName = order.store.name;
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

      if (status === 'CONFIRMED') {
        await sendNotification(
          buyerId,
          'Order Confirmed',
          `Your order #${orderId} from ${storeName} has been confirmed.`,
          'ORDER_CONFIRMED',
          { orderId, storeId: order.storeId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Your Order (#${orderId}) has been Confirmed`,
          template: 'generic',
          templateData: {
            title: 'Order Confirmed!',
            message: `Your order #${orderId} from ${storeName} has been confirmed. It will be processed and shipped soon.`,
            ctaText: 'View Order',
            ctaUrl: orderUrl
          }
        });
      } else if (status === 'SHIPPED') {
        await sendNotification(
          buyerId,
          'Order Shipped',
          `Your order #${orderId} from ${storeName} has been shipped.`,
          'ORDER_SHIPPED',
          { orderId, storeId: order.storeId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Your Order (#${orderId}) has been Shipped!`,
          template: 'order_shipped',
          templateData: {
            orderId,
            trackingNumber: order.deliveryInfo?.trackingNumber || 'Not available yet',
            trackingUrl: order.deliveryInfo?.trackingUrl || orderUrl,
            estimatedDelivery: order.deliveryInfo?.estimatedDelivery || '2-3 business days'
          }
        });

        await sendNotification(
          order.store.userId,
          'Order Status Updated',
          `Order #${orderId} status updated to Shipped.`,
          'ORDER_STATUS_UPDATE',
          { orderId, newStatus: status }
        );
      } else if (status === 'DELIVERED') {
        await sendNotification(
          buyerId,
          'Order Delivered',
          `Your order #${orderId} from ${storeName} has been delivered. Please confirm receipt.`,
          'ORDER_DELIVERED',
          { orderId, storeId: order.storeId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Your Order (#${orderId}) has been Delivered`,
          template: 'generic',
          templateData: {
            title: 'Order Delivered!',
            message: `Your order #${orderId} from ${storeName} has been delivered. Please confirm receipt on the platform.`,
            ctaText: 'Confirm Delivery',
            ctaUrl: orderUrl
          }
        });

        await sendNotification(
          order.store.userId,
          'Order Delivered',
          `Order #${orderId} delivered. Awaiting buyer confirmation for payment release.`,
          'ORDER_DELIVERED_SELLER',
          { orderId, buyerId }
        );

        await sendEmailNotification({
          to: order.store.user.email,
          toName: sellerName,
          subject: `Order (#${orderId}) Delivered - Awaiting Confirmation`,
          template: 'generic',
          templateData: {
            title: 'Order Delivered!',
            message: `Order #${orderId} has been delivered. Payment will be released after buyer confirmation.`,
            ctaText: 'View Order',
            ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}`
          }
        });
      } else if (status === 'COMPLETED') {
        await sendNotification(
          buyerId,
          'Order Completed',
          `Your order #${orderId} from ${storeName} is now completed.`,
          'ORDER_COMPLETED',
          { orderId, storeId: order.storeId }
        );

        await sendEmailNotification({
          to: order.buyer.email,
          toName: buyerName,
          subject: `Your Order (#${orderId}) is Complete`,
          template: 'generic',
          templateData: {
            title: 'Order Completed!',
            message: `Your order #${orderId} from ${storeName} is complete. Thank you for shopping!`,
            ctaText: 'View Order',
            ctaUrl: orderUrl
          }
        });

        await sendNotification(
          order.store.userId,
          'Order Completed',
          `Order #${orderId} completed. Payment has been released.`,
          'ORDER_COMPLETED_SELLER',
          { orderId, buyerId }
        );

        await sendEmailNotification({
          to: order.store.user.email,
          toName: sellerName,
          subject: `Order (#${orderId}) Completed - Payment Released`,
          template: 'generic',
          templateData: {
            title: 'Order Completed!',
            message: `Order #${orderId} is complete. Payment has been released to your account.`,
            ctaText: 'View Orders',
            ctaUrl: `${process.env.FRONTEND_URL}/seller/orders`
          }
        });
      }
    } catch (notificationError) {
      console.error('Error sending notification/email during status update:', notificationError);
    }

    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    if (status === 'CANCELLED') {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId }
      });
      for (const item of orderItems) {
        await cache.del(`product:url:${item.productId}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, paymentRef, refundAmount, refundReason } = req.body;

    if (!paymentStatus || !['SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "paymentStatus is required and must be 'SUCCESS', 'FAILED', 'REFUNDED', or 'PARTIALLY_REFUNDED'."
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true } }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const validPaymentTransitions = {
      PENDING: ['SUCCESS', 'FAILED', 'PROCESSING'],
      PROCESSING: ['SUCCESS', 'FAILED'],
      SUCCESS: ['REFUNDED', 'PARTIALLY_REFUNDED'],
      FAILED: [],
      REFUNDED: [],
      PARTIALLY_REFUNDED: ['REFUNDED']
    };

    if (!validPaymentTransitions[order.paymentStatus]?.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status transition from ${order.paymentStatus} to ${paymentStatus}.`
      });
    }

    const updateData = { paymentStatus };
    if (paymentRef) updateData.paymentRef = paymentRef;
    if (refundAmount !== undefined) updateData.refundAmount = refundAmount;
    if (refundReason) updateData.refundReason = refundReason;

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully.',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: {
          select: {
            userId: true,
            name: true,
            url: true,
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
        message: 'Order not found.'
      });
    }

    let canCancel = false;
    let cancelledBy = null;
    let cancelledByName = '';
    let cancelledForId = null;
    let cancelledForName = '';
    let cancelledForEmail = '';

    if (order.buyerId === userId) {
      if (order.status === 'PENDING') {
        canCancel = true;
        cancelledBy = 'buyer';
        cancelledByName = order.buyer.firstName;
        cancelledForId = order.store.userId;
        cancelledForName = order.store.user.firstName;
        cancelledForEmail = order.store.user.email;
      }
    } else if (order.store.userId === userId) {
      if (['PENDING', 'CONFIRMED'].includes(order.status)) {
        canCancel = true;
        cancelledBy = 'seller';
        cancelledByName = order.store.user.firstName;
        cancelledForId = order.buyerId;
        cancelledForName = order.buyer.firstName;
        cancelledForEmail = order.buyer.email;
      }
    }

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to cancel this order in its current status (${order.status}).`
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: cancelledBy
        }
      });

      await tx.statusChange.create({
        data: {
          orderId,
          oldStatus: order.status,
          newStatus: 'CANCELLED',
          changedBy: userId,
          reason: reason || `Cancelled by ${cancelledBy}`
        }
      });

      const orderItems = await tx.orderItem.findMany({
        where: { orderId }
      });

      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            quantityBought: { decrement: item.quantity }
          }
        });
      }

      return updated;
    });

    try {
      await sendNotification(
        cancelledForId,
        'Order Cancelled',
        `Order #${orderId} has been cancelled by the ${cancelledBy}.`,
        'ORDER_CANCELLED',
        { orderId, cancelledBy, reason: reason || '' }
      );

      await sendEmailNotification({
        to: cancelledForEmail,
        toName: cancelledForName,
        subject: `Order (#${orderId}) has been Cancelled`,
        template: 'generic',
        templateData: {
          title: 'Order Cancelled',
          message: `Order #${orderId} has been cancelled by the ${cancelledBy}. ${reason ? `Reason: ${reason}` : ''}`,
          ctaText: 'View Order History',
          ctaUrl: `${process.env.FRONTEND_URL}/orders`
        }
      });
    } catch (notificationError) {
      console.error('Error sending notification/email for order cancellation:', notificationError);
    }

    // Invalidate caches
    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);
    await cache.del(`store:slug:${order.store.url}`);

    // NEW: Invalidate checkout session cache if exists
    if (order.checkoutSession) {
      await cache.del(`checkout:${order.checkoutSession}:user:${order.buyerId}`);
    }

    const orderItems = await prisma.orderItem.findMany({
      where: { orderId }
    });
    for (const item of orderItems) {
      await cache.del(`product:url:${item.productId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUnpaidOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      storeId // Optional: filter by specific store
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construct cache key
    const cacheKey = `user:${userId}:unpaid-orders:page:${pageNum}:limit:${limitNum}:store:${storeId || 'all'}:sort:${sortBy}:${sortOrder}`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Build where clause
    const whereClause = {
      buyerId: userId,
      status: 'PENDING',
      paymentStatus: 'PENDING'
    };

    // Filter by store if provided
    if (storeId) {
      whereClause.storeId = storeId;
    }

    // Validate sort field
    const validSortFields = ['createdAt', 'totalAmount', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    // Fetch unpaid orders
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true,
              logo: true,
              location: true,
              region: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  price: true,
                  url: true
                }
              }
            }
          },
          payment: {
            select: {
              id: true,
              status: true,
              gatewayRef: true,
              createdAt: true
            }
          }
        },
        orderBy: { [sortField]: order },
        skip,
        take: limitNum
      }),
      prisma.order.count({ where: whereClause })
    ]);

    // Calculate summary statistics
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0);
    const uniqueStores = [...new Set(orders.map(order => order.storeId))].length;

    // Group orders by store for easier multi-store checkout
    const ordersByStore = orders.reduce((acc, order) => {
      if (!acc[order.storeId]) {
        acc[order.storeId] = {
          store: order.store,
          orders: [],
          storeTotal: 0
        };
      }
      acc[order.storeId].orders.push(order);
      acc[order.storeId].storeTotal += order.totalAmount;
      return acc;
    }, {});

    const resultData = {
      orders,
      ordersByStore: Object.values(ordersByStore),
      summary: {
        totalUnpaidOrders: total,
        totalAmount,
        totalItems,
        uniqueStores,
        currency: orders.length > 0 ? orders[0].currency : 'GHS'
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    };

    // Cache for 5 minutes (shorter cache since payment status can change)
    await cache.set(cacheKey, resultData, 300);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching unpaid orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid orders',
      error: error.message
    });
  }
};

export const getUnpaidOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    // Construct cache key
    const cacheKey = `order:${orderId}:unpaid:user:${userId}`;

    // Try to get from cache
    const cachedOrder = await cache.get(cacheKey);
    if (cachedOrder) {
      return res.status(200).json({
        success: true,
        data: cachedOrder,
        cached: true
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        buyerId: userId,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            location: true,
            region: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
                url: true,
                stock: true
              }
            }
          }
        },
        payment: {
          select: {
            id: true,
            status: true,
            gatewayRef: true,
            metadata: true,
            createdAt: true
          }
        },
        shippingAddress: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Unpaid order not found or already paid.'
      });
    }

    // Check if products are still available
    const unavailableItems = order.items.filter(item => 
      !item.product || item.product.stock < item.quantity
    );

    const orderData = {
      ...order,
      hasUnavailableItems: unavailableItems.length > 0,
      unavailableItems: unavailableItems.map(item => ({
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        requestedQuantity: item.quantity,
        availableStock: item.product?.stock || 0
      }))
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, orderData, 300);

    res.status(200).json({
      success: true,
      data: orderData
    });

  } catch (error) {
    console.error('Error fetching unpaid order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid order',
      error: error.message
    });
  }
};

export const getUnpaidOrdersSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Construct cache key
    const cacheKey = `user:${userId}:unpaid-orders:summary`;

    // Try to get from cache
    const cachedSummary = await cache.get(cacheKey);
    if (cachedSummary) {
      return res.status(200).json({
        success: true,
        data: cachedSummary,
        cached: true
      });
    }

    // Get all unpaid orders
    const unpaidOrders = await prisma.order.findMany({
      where: {
        buyerId: userId,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      },
      select: {
        id: true,
        totalAmount: true,
        currency: true,
        storeId: true,
        items: {
          select: {
            quantity: true
          }
        },
        createdAt: true
      }
    });

    const totalAmount = unpaidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalItems = unpaidOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const uniqueStores = [...new Set(unpaidOrders.map(order => order.storeId))].length;

    // Get oldest unpaid order
    const oldestOrder = unpaidOrders.length > 0 
      ? unpaidOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
      : null;

    const summaryData = {
      totalUnpaidOrders: unpaidOrders.length,
      totalAmount,
      totalItems,
      uniqueStores,
      currency: unpaidOrders.length > 0 ? unpaidOrders[0].currency : 'GHS',
      oldestUnpaidOrder: oldestOrder ? {
        id: oldestOrder.id,
        createdAt: oldestOrder.createdAt,
        amount: oldestOrder.totalAmount
      } : null,
      hasUnpaidOrders: unpaidOrders.length > 0
    };

    // Cache for 3 minutes
    await cache.set(cacheKey, summaryData, 180);

    res.status(200).json({
      success: true,
      data: summaryData
    });

  } catch (error) {
    console.error('Error fetching unpaid orders summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid orders summary',
      error: error.message
    });
  }
};

export const getUnpaidOrdersByStore = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Construct cache key
    const cacheKey = `user:${userId}:unpaid-orders:by-store`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    const unpaidOrders = await prisma.order.findMany({
      where: {
        buyerId: userId,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            location: true,
            region: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group orders by store
    const storeGroups = unpaidOrders.reduce((acc, order) => {
      const storeId = order.storeId;
      
      if (!acc[storeId]) {
        acc[storeId] = {
          store: order.store,
          orders: [],
          orderCount: 0,
          totalAmount: 0,
          totalItems: 0,
          currency: order.currency
        };
      }

      acc[storeId].orders.push(order);
      acc[storeId].orderCount++;
      acc[storeId].totalAmount += order.totalAmount;
      acc[storeId].totalItems += order.items.length;

      return acc;
    }, {});

    const resultData = {
      storeGroups: Object.values(storeGroups),
      summary: {
        totalStores: Object.keys(storeGroups).length,
        totalOrders: unpaidOrders.length,
        grandTotal: unpaidOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        currency: unpaidOrders.length > 0 ? unpaidOrders[0].currency : 'GHS'
      }
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, resultData, 300);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching unpaid orders by store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid orders by store',
      error: error.message
    });
  }
};

export const cancelUnpaidOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        buyerId: userId,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      },
      include: {
        items: true,
        payment: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Unpaid order not found or cannot be cancelled.'
      });
    }

    // Restore product stock
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity
          }
        }
      });
    }

    // Delete payment record if exists
    if (order.payment) {
      await prisma.payment.delete({
        where: { id: order.payment.id }
      });
    }

    // Delete order items
    await prisma.orderItem.deleteMany({
      where: { orderId }
    });

    // Delete the order
    await prisma.order.delete({
      where: { id: orderId }
    });

    // Invalidate caches
    await cache.del(`user:${userId}:unpaid-orders:*`);
    await cache.del(`order:${orderId}:unpaid:user:${userId}`);
    await cache.del(`user:${userId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully. Product stock has been restored.'
    });

  } catch (error) {
    console.error('Error cancelling unpaid order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel unpaid order',
      error: error.message
    });
  }
};