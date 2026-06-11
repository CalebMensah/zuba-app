import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js'; 
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { processRefund, checkRefundEligibility } from '../utils/refundUtils.js';

// Import shared fee calculator (must match paymentcontroller)
import { PLATFORM_FEE_PERCENT, PAYSTACK_COLLECTION_PERCENT } from '../utils/fees.js';

// Buyer pays subtotal + 3% platform + 1.95% paystack
function calculateOrderFees(subtotal) {
  const platformFee = subtotal * PLATFORM_FEE_PERCENT;
  const taxable = subtotal + platformFee;
  const paystackFee = taxable * (PAYSTACK_COLLECTION_PERCENT / 100);
  return {
    platformFee: parseFloat(platformFee.toFixed(2)),
    paystackFee: parseFloat(paystackFee.toFixed(2)),
    buyerTotal: parseFloat((subtotal + platformFee + paystackFee).toFixed(2)),
    netSeller: parseFloat((subtotal * 0.97).toFixed(2))
  };
}

export const createOrder = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { 
      items, 
      deliveryInfo,
      billingInfo,
      deliveryFee = 0,
      taxAmount = 0,
      discount = 0,
      currency = "GHS",
      paymentProvider,
      promoCode,
      buyerEmail,
      buyerPhone,
      sameAsDelivery = true,
      checkoutSession
    } = req.body;

    // --- VALIDATION ---
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items (non-empty array) are required.' });
    }
    if (!deliveryInfo || !deliveryInfo.recipient || !deliveryInfo.phone || !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.region) {
      return res.status(400).json({ success: false, message: 'Delivery info must include recipient, phone, address, city, and region.' });
    }
    if (!sameAsDelivery && billingInfo) {
      if (!billingInfo.fullName || !billingInfo.email || !billingInfo.phone || !billingInfo.address || !billingInfo.city || !billingInfo.region) {
        return res.status(400).json({ success: false, message: 'Billing info must include fullName, email, phone, address, city, and region.' });
      }
    }

    // Validation - each item should have color and size if product has variants
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        return res.status(400).json({ 
          success: false, 
          message: 'Each item must have productId, quantity, and price.' 
        });
      }
    }

    // --- FETCH PRODUCTS & GROUP BY SELLER ---
    const products = await prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) } },
      include: { 
        store: { 
          select: { 
            id: true, 
            userId: true,
            user: {
              select: {
                payoutPreference: true
              }
            }
          } 
        } 
      }
    });

    const sellerItemsMap = {};
    const commissionRate = 0.03; // 3% commission

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) return res.status(400).json({ success: false, message: `Product with ID ${item.productId} not found.` });
      if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `Insufficient stock for product "${product.name}".` });

      const sellerId = product.store.userId;
      if (!sellerItemsMap[sellerId]) {
        sellerItemsMap[sellerId] = {
          items: [],
          payoutPreference: product.store.user?.payoutPreference || 'mobile_money'
        };
      }
      
      const total = item.quantity * item.price;
      const commission = parseFloat((total * commissionRate).toFixed(2));
      const sellerPayout = parseFloat((total - commission).toFixed(2));

      sellerItemsMap[sellerId].items.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total,
        commission,
        sellerPayout,
        storeId: product.store.id
      });
    }

    const orders = [];
    const sellerPayouts = [];

    await prisma.$transaction(async (tx) => {
      for (const [sellerId, sellerData] of Object.entries(sellerItemsMap)) {
        const sellerItems = sellerData.items;
        const payoutPreference = sellerData.payoutPreference;
        
        const sellerSubtotal = sellerItems.reduce((sum, i) => sum + i.total, 0);
        const commissionTotal = sellerSubtotal * 0.03;
        const netSellerPayout = sellerSubtotal * 0.97;
        const storeId = sellerItems[0].storeId;

        // --- Compute fees ---
        const orderSubtotal = sellerSubtotal + deliveryFee + taxAmount - discount;
        const fees = calculateOrderFees(orderSubtotal);

        console.log('deliveryInfo.email received:', deliveryInfo?.email);

        
        // --- CREATE ORDER ---
        const order = await tx.order.create({
          data: {
            buyerId,
            storeId,
            totalAmount: orderSubtotal,
            subtotal: sellerSubtotal,
            deliveryFee,
            taxAmount,
            discount,
            currency,
            paymentProvider: paymentProvider || null,
            promoCode: promoCode || null,
            buyerEmail: buyerEmail || null,
            buyerPhone: buyerPhone || null,
            checkoutSession: checkoutSession || null,
            commissionTotal,
            paystackFee: fees.paystackFee,
            platformFee: fees.platformFee,
            commissionRate: 0.03,
            sellerPayoutPreference: payoutPreference,
            items: { 
              create: sellerItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                total: item.total,
                price: item.price,
                commission: item.commission,
                sellerPayout: item.sellerPayout,
                color: item.color || null,
                size: item.size || null,
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
                newStatus: 'PENDING_PAYMENT',
                changedBy: buyerId,
                reason: 'Order created'
              }
            }
          },
          include: { items: true, store: true }
        });

        orders.push(order);



        // --- UPDATE STOCK ---
        for (const item of sellerItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              quantityBought: { increment: item.quantity }
            }
          });
        }
      }
    });

    // --- NOTIFICATIONS & CACHE CLEAR ---
    for (const order of orders) {
      try {
        const sellerId = order.store.userId;
        
        await sendNotification(
          sellerId,
          'New Order Received',
          `You have a new order (#${order.id}) from ${req.user.firstName}.`,
          'order_created',
          { orderId: order.id, buyerId, buyerName: req.user.firstName }
        );

        await sendNotification(
          buyerId,
          'Order Confirmed',
          `Your order #${order.id} has been placed successfully.`,
          'order_confirmation',
          { orderId: order.id, totalAmount: order.totalAmount }
        );

        const storeUser = await prisma.user.findUnique({ 
          where: { id: sellerId },
          select: { email: true, firstName: true }
        });

        if (storeUser) {
          await sendEmailNotification({
            to: storeUser.email,
            toName: storeUser.firstName,
            subject: `New Order (#${order.id}) Received`,
            template: 'generic',
            sender: 'orders',
            templateData: {
              title: 'New Order Alert!',
              message: `You have a new order (#${order.id}) from ${req.user.firstName}. Please check your dashboard to process it.`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${order.id}`
            }
          });
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    }

    // --- CLEAR CACHE ---
    await cache.del(`user:${buyerId}:orders`);
    for (const sellerData of Object.values(sellerItemsMap)) {
      for (const item of sellerData.items) await cache.del(`product:url:${item.productId}`);
      await cache.del(`store:slug:${sellerData.items[0].storeId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Orders created successfully. Proceed to payment.',
      data: {
        orders: orders.map(order => ({
          ...order,
buyerTotalAmount: order.totalAmount + (order.platformFee || 0) + (order.paystackFee || 0),
          breakdown: {
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            taxAmount: order.taxAmount,
            discount: order.discount,
            orderSubtotal: order.totalAmount,
            paystackCollectionFee: order.paystackFee,
            platformFee: order.platformFee || 0,
            buyerTotal: order.totalAmount + (order.platformFee || 0) + (order.paystackFee || 0),
            commissionTotal: order.commissionTotal,
            transferFee: order.transferFee,
            grossSellerPayout: order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0),
            netSellerPayout: order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0) - order.transferFee
          }
        })),
        sellerPayouts
      }
    });

  } catch (error) {
    console.error('Error creating multi-seller order:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
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
        },
        payment: true,
        escrow: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

      console.log('order payment status:', order.payment);
      console.log('order payment status:', order.payment.status);

    if (order.buyerId !== userId && order.store.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this order.'
      });
    }

    const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
    const netSellerPayout = grossSellerPayout - (order.transferFee || 0);

    // Add payment breakdown
    const orderWithBreakdown = {
      ...order,
      buyerTotalAmount: order.totalAmount + (order.platformFee || 0) + (order.paystackFee || 0),
      breakdown: {
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee || 0,
        taxAmount: order.taxAmount || 0,
        discount: order.discount || 0,
        platformFee: order.platformFee || 0,
        paystackFee: order.paystackFee || 0,
        orderSubtotal: order.totalAmount,
        buyerTotal: order.totalAmount + (order.platformFee || 0) + (order.paystackFee || 0),
        commissionTotal: order.commissionTotal || 0,
        transferFee: order.transferFee || 0,
        grossSellerPayout,
        netSellerPayout
      }
    };

    await cache.set(cacheKey, orderWithBreakdown, 300);

    res.status(200).json({
      success: true,
      data: orderWithBreakdown
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
    if (statusFilter) whereClause.status = statusFilter;

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
            product: { select: { id: true, name: true, images: true, price: true } }
          }
        },
        deliveryInfo: { select: { status: true, trackingNumber: true, deliveryType: true } },
        store: { select: { id: true, name: true, url: true, logo: true } },
        payment: true,
        escrow: true
      }
    });

    // Include payment breakdown for each order
    const ordersWithBreakdown = orders.map(order => {
      const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
      const netSellerPayout = grossSellerPayout - (order.transferFee || 0);
      
      return {
        ...order,
        buyerTotalAmount: order.totalAmount + (order.paystackFee || 0),
        breakdown: {
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee || 0,
          taxAmount: order.taxAmount || 0,
          discount: order.discount || 0,
          orderSubtotal: order.totalAmount,
          paystackCollectionFee: order.paystackFee || 0,
          buyerTotal: order.totalAmount + (order.paystackFee || 0),
          commissionTotal: order.commissionTotal || 0,
          transferFee: order.transferFee || 0,
          grossSellerPayout,
          netSellerPayout
        }
      };
    });

    const total = await prisma.order.count({ where: whereClause });

    const resultData = {
      orders: ordersWithBreakdown,
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
    const paymentStatusFilter = req.query.paymentStatus;

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
    if (statusFilter) whereClause.status = statusFilter;
    if (paymentStatusFilter) whereClause.paymentStatus = paymentStatusFilter;

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
            product: { select: { id: true, name: true, images: true, price: true } }
          }
        },
        deliveryInfo: { select: { status: true, trackingNumber: true } },
        buyer: { select: { id: true, firstName: true, email: true } },
        payment: true,
        escrow: true
      }
    });

    // Add breakdown including seller-specific info
    const ordersWithBreakdown = orders.map(order => {
      const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
      const netSellerPayout = grossSellerPayout - (order.transferFee || 0);
      
      return {
        ...order,
        buyerTotalAmount: order.totalAmount + (order.paystackFee || 0),
        breakdown: {
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee || 0,
          taxAmount: order.taxAmount || 0,
          discount: order.discount || 0,
          orderSubtotal: order.totalAmount,
          paystackCollectionFee: order.paystackFee || 0,
          buyerTotal: order.totalAmount + (order.paystackFee || 0),
          commissionTotal: order.commissionTotal || 0,
          transferFee: order.transferFee || 0,
          grossSellerPayout,
          netSellerPayout
        }
      };
    });

    const total = await prisma.order.count({ where: whereClause });

    const resultData = {
      orders: ordersWithBreakdown,
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
        buyerId: userId
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
        },
        payment: true,
        escrow: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found for this checkout session.'
      });
    }

    // ADD THESE TWO LINES
    const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
    const netSellerPayout = grossSellerPayout - (order.transferFee || 0);

    const orderWithBreakdown = {
      ...order,
      buyerTotalAmount: order.totalAmount + (order.paystackFee || 0),
      breakdown: {
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee || 0,
        taxAmount: order.taxAmount || 0,
        discount: order.discount || 0,
        orderSubtotal: order.totalAmount,
        platformFee: order.platformFee || 0,
        paystackFee: order.paystackFee || 0,
        buyerTotal: order.totalAmount + (order.paystackFee || 0),
        commissionTotal: order.commissionTotal || 0,
        transferFee: order.transferFee || 0,
        grossSellerPayout,
        netSellerPayout
      }
    };

    await cache.set(cacheKey, orderWithBreakdown, 600);

    res.status(200).json({
      success: true,
      data: orderWithBreakdown
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
        },
        payment: true,
        escrow: true,
        items: true
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
        },
        include: { items: true }
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
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              quantityBought: { decrement: item.quantity }
            }
          });
        }
      }

      if (status === 'DELIVERED' && !order.escrow) {
        const sellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
        await tx.escrow.create({
          data: {
            orderId,
            paymentId: order.payment?.id,
            amountHeld: sellerPayout,
            releaseDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
            releaseStatus: 'PENDING'
          }
        });
      }

      if (status === 'COMPLETED' && order.escrow) {
        await tx.escrow.update({
          where: { id: order.escrow.id },
          data: { releasedAt: new Date(), releasedTo: order.store.userId, releaseStatus: 'COMPLETED' }
        });

        const sellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { 
            status: 'COMPLETED', 
            metadata: { 
              ...order.payment.metadata, 
              sellerPayout, 
              commissionAmount: order.commissionTotal 
            }
          }
        });
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
          sender: 'orders',
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
      for (const item of order.items) {
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
    const { reason } = req.body || {};

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
          select: { id: true, firstName: true, email: true }
        },
        payment: true,
        escrow: true,
        items: true
      }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    let canCancel = false;
    let cancelledBy = null;
    let cancelledByName = '';
    let cancelledForId = null;
    let cancelledForName = '';
    let cancelledForEmail = '';

    if (order.buyerId === userId && order.status === 'PENDING') {
      canCancel = true;
      cancelledBy = 'buyer';
      cancelledByName = order.buyer.firstName;
      cancelledForId = order.store.userId;
      cancelledForName = order.store.user.firstName;
      cancelledForEmail = order.store.user.email;
    } else if (order.store.userId === userId && ['PENDING', 'CONFIRMED'].includes(order.status)) {
      canCancel = true;
      cancelledBy = 'seller';
      cancelledByName = order.store.user.firstName;
      cancelledForId = order.buyerId;
      cancelledForName = order.buyer.firstName;
      cancelledForEmail = order.buyer.email;
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
          cancelledBy
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

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            quantityBought: { decrement: item.quantity }
          }
        });
      }

      if (order.escrow && order.escrow.releaseStatus === 'PENDING') {
        await tx.escrow.update({
          where: { id: order.escrow.id },
          data: { releaseStatus: 'CANCELLED', releaseReason: 'Order cancelled' }
        });

        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: 'CANCELLED' }
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
        sender: 'orders',
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

    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);
    await cache.del(`store:slug:${order.store.url}`);

    if (order.checkoutSession) {
      await cache.del(`checkout:${order.checkoutSession}:user:${order.buyerId}`);
    }

    for (const item of order.items) {
      await cache.del(`product:url:${item.productId}`);
    }

    // Emit socket event for real-time update
    const { emitOrderCancelled } = await import('../services/socketService.js');
    emitOrderCancelled(order.buyerId, orderId, 'buyer');
    emitOrderCancelled(order.store.userId, orderId, 'seller');

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
      storeId
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `user:${userId}:unpaid-orders:page:${pageNum}:limit:${limitNum}:store:${storeId || 'all'}:sort:${sortBy}:${sortOrder}`;

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    const whereClause = {
      buyerId: userId,
      status: 'PENDING',
      paymentStatus: 'PENDING'
    };

    if (storeId) {
      whereClause.storeId = storeId;
    }

    const validSortFields = ['createdAt', 'totalAmount', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

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

    const ordersWithBreakdown = orders.map(order => {
      const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
      const netSellerPayout = grossSellerPayout - (order.transferFee || 0);
      
      return {
        ...order,
        buyerTotalAmount: order.totalAmount + (order.paystackFee || 0),
        breakdown: {
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee || 0,
          taxAmount: order.taxAmount || 0,
          discount: order.discount || 0,
          orderSubtotal: order.totalAmount,
          paystackCollectionFee: order.paystackFee || 0,
          buyerTotal: order.totalAmount + (order.paystackFee || 0),
          commissionTotal: order.commissionTotal || 0,
          transferFee: order.transferFee || 0,
          grossSellerPayout,
          netSellerPayout
        }
      };
    });

    const totalAmount = ordersWithBreakdown.reduce((sum, order) => sum + order.buyerTotalAmount, 0);
    const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0);
    const uniqueStores = [...new Set(orders.map(order => order.storeId))].length;

    const ordersByStore = ordersWithBreakdown.reduce((acc, order) => {
      if (!acc[order.storeId]) {
        acc[order.storeId] = {
          store: order.store,
          orders: [],
          storeTotal: 0
        };
      }
      acc[order.storeId].orders.push(order);
      acc[order.storeId].storeTotal += order.buyerTotalAmount;
      return acc;
    }, {});

    const resultData = {
      orders: ordersWithBreakdown,
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

    const cacheKey = `order:${orderId}:unpaid:user:${userId}`;

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
        deliveryInfo: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Unpaid order not found or already paid.'
      });
    }

    const unavailableItems = order.items.filter(item => 
      !item.product || item.product.stock < item.quantity
    );

    const grossSellerPayout = order.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0);
    const netSellerPayout = grossSellerPayout - (order.transferFee || 0);

    const orderData = {
      ...order,
      buyerTotalAmount: order.totalAmount + (order.paystackFee || 0),
        breakdown: {
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee || 0,
          taxAmount: order.taxAmount || 0,
          discount: order.discount || 0,
          orderSubtotal: order.totalAmount,
          paystackCollectionFee: order.paystackFee || 0,
          buyerTotal: order.totalAmount + (order.paystackFee || 0),
          commissionTotal: order.commissionTotal || 0,
          transferFee: order.transferFee || 0,
          grossSellerPayout,
          netSellerPayout
        },
      hasUnavailableItems: unavailableItems.length > 0,
      unavailableItems: unavailableItems.map(item => ({
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        requestedQuantity: item.quantity,
        availableStock: item.product?.stock || 0
      }))
    };

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

    const cacheKey = `user:${userId}:unpaid-orders:summary`;

    const cachedSummary = await cache.get(cacheKey);
    if (cachedSummary) {
      return res.status(200).json({
        success: true,
        data: cachedSummary,
        cached: true
      });
    }

    const unpaidOrders = await prisma.order.findMany({
      where: {
        buyerId: userId,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      },
      select: {
        id: true,
        totalAmount: true,
        paystackFee: true,
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

    const totalAmount = unpaidOrders.reduce((sum, order) => 
      sum + order.totalAmount + (order.paystackFee || 0), 0
    );
    const totalItems = unpaidOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const uniqueStores = [...new Set(unpaidOrders.map(order => order.storeId))].length;

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
        amount: oldestOrder.totalAmount + (oldestOrder.paystackFee || 0)
      } : null,
      hasUnpaidOrders: unpaidOrders.length > 0
    };

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

    const cacheKey = `user:${userId}:unpaid-orders:by-store`;

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

    const storeGroups = unpaidOrders.reduce((acc, order) => {
      const storeId = order.storeId;
      const buyerTotal = order.totalAmount + (order.paystackFee || 0);
      
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

      acc[storeId].orders.push({
        ...order,
        buyerTotalAmount: buyerTotal,
        breakdown: {
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee || 0,
          orderSubtotal: order.totalAmount,
          paystackFee: order.paystackFee || 0,
          buyerTotal
        }
      });
      acc[storeId].orderCount++;
      acc[storeId].totalAmount += buyerTotal;
      acc[storeId].totalItems += order.items.length;

      return acc;
    }, {});

    const resultData = {
      storeGroups: Object.values(storeGroups),
      summary: {
        totalStores: Object.keys(storeGroups).length,
        totalOrders: unpaidOrders.length,
        grandTotal: unpaidOrders.reduce((sum, order) => 
          sum + order.totalAmount + (order.paystackFee || 0), 0
        ),
        currency: unpaidOrders.length > 0 ? unpaidOrders[0].currency : 'GHS'
      }
    };

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

    if (order.payment && order.payment.id) {
      await prisma.payment.delete({
        where: { id: order.payment.id }
      });
    }

    await prisma.orderItem.deleteMany({
      where: { orderId }
    });

    await prisma.order.delete({
      where: { id: orderId }
    });

    await cache.del(`user:${userId}:unpaid-orders:*`);
    await cache.del(`order:${orderId}:unpaid:user:${userId}`);
    await cache.del(`user:${userId}:orders`);

    // Emit socket event for real-time update
    const { emitOrderCancelled } = await import('../services/socketService.js');
    emitOrderCancelled(userId, orderId, 'buyer');

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

export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    // Fetch the order with necessary relations
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
          select: { 
            id: true,
            email: true, 
            firstName: true 
          }
        },
        items: {
          include: {
            product: { select: { id: true, name: true } }
          }
        }
      }
    });

    // Validation checks
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Check if the user is the seller
    if (order.store.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only the seller can accept this order.'
      });
    }

    // Check if order is in a valid status to be accepted
    if (!['PAID'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be accepted in current status: ${order.status}. Only PAID or CONFIRMED orders can be accepted.`
      });
    }

    // Check if payment is successful
    if (order.paymentStatus !== 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Order payment must be successful before accepting.'
      });
    }

    // Update order status to PROCESSING
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING'
        },
        include: { 
          items: true,
          store: true,
          buyer: true
        }
      });

      // Create status history record
      await tx.statusChange.create({
        data: {
          orderId,
          oldStatus: order.status,
          newStatus: 'PROCESSING',
          changedBy: userId,
          reason: 'Order accepted by seller and is now being processed'
        }
      });

      return updated;
    });

    // Send notifications
    try {
      const buyerId = order.buyer.id;
      const buyerName = order.buyer.firstName;
      const storeName = order.store.name;
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

      // Notify buyer
      await sendNotification(
        buyerId,
        'Order Being Processed',
        `Your order #${orderId} from ${storeName} has been accepted and is now being processed.`,
        'ORDER_PROCESSING',
        { orderId, storeId: order.storeId }
      );

      await sendEmailNotification({
        to: order.buyer.email,
        toName: buyerName,
        subject: `Your Order (#${orderId}) is Being Processed`,
        template: 'generic',
        sender: 'orders',
        templateData: {
          title: 'Order Being Processed!',
          message: `Good news! Your order #${orderId} from ${storeName} has been accepted by the seller and is now being processed.`,
          ctaText: 'View Order',
          ctaUrl: orderUrl
        }
      });

      // Notify seller (confirmation)
      await sendNotification(
        userId,
        'Order Accepted',
        `You have accepted order #${orderId}. Please process it promptly.`,
        'ORDER_ACCEPTED_SELLER',
        { orderId, buyerId }
      );

    } catch (notificationError) {
      console.error('Error sending notification/email for order acceptance:', notificationError);
      // Don't fail the request if notifications fail
    }

    // Clear relevant caches
    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully and marked as PROCESSING.',
      data: {
        ...updatedOrder,
        buyerTotalAmount: updatedOrder.totalAmount + (updatedOrder.paystackFee || 0),
        breakdown: {
          subtotal: updatedOrder.subtotal,
          deliveryFee: updatedOrder.deliveryFee || 0,
          taxAmount: updatedOrder.taxAmount || 0,
          discount: updatedOrder.discount || 0,
          orderSubtotal: updatedOrder.totalAmount,
          paystackCollectionFee: updatedOrder.paystackFee || 0,
          buyerTotal: updatedOrder.totalAmount + (updatedOrder.paystackFee || 0),
          commissionTotal: updatedOrder.commissionTotal || 0,
          transferFee: updatedOrder.transferFee || 0,
          grossSellerPayout: updatedOrder.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0),
          netSellerPayout: updatedOrder.items.reduce((sum, item) => sum + (item.sellerPayout || 0), 0) - (updatedOrder.transferFee || 0)
        }
      }
    });

  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    // Validate rejection reason
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required.'
      });
    }

    // Fetch the order with necessary relations
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
          select: { 
            id: true,
            email: true, 
            firstName: true 
          }
        },
        payment: true,
        escrow: true,
        items: {
          include: {
            product: { select: { id: true, name: true } }
          }
        }
      }
    });

    // Validation checks
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Check if the user is the seller
    if (order.store.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only the seller can reject this order.'
      });
    }

    // Check if order can be rejected
    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be rejected in current status: ${order.status}. Only PENDING, CONFIRMED, or PROCESSING orders can be rejected.`
      });
    }

    // Check if already cancelled or refunded
    if (order.status === 'CANCELLED' || order.paymentStatus === 'REFUNDED') {
      return res.status(400).json({
        success: false,
        message: 'Order has already been cancelled or refunded.'
      });
    }

    // Check if payment exists and is successful
    if (!order.payment || order.payment.status !== 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Cannot process refund. Payment was not successful or does not exist.'
      });
    }

    // Check refund eligibility
    const eligibility = await checkRefundEligibility(orderId);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: `Refund not eligible: ${eligibility.reason}`,
        requiresManualIntervention: eligibility.requiresManualIntervention || false
      });
    }

    // Process the refund
    const refundAmount = order.totalAmount + (order.paystackFee || 0); // Full refund including Paystack fee
    const refundResult = await processRefund({
      orderId: order.id,
      paymentId: order.payment.id,
      amount: refundAmount,
      currency: order.currency,
      reason: `Order rejected by seller: ${reason}`,
      gatewayRef: order.payment.gatewayRef
    });

    if (!refundResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to process refund.',
        error: refundResult.error
      });
    }

    // Update order, restore stock, and handle escrow in a transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'REFUNDED',
          refundAmount,
          refundReason: `Order rejected by seller: ${reason}`,
          cancelledAt: new Date(),
          cancelledBy: 'seller'
        },
        include: { 
          items: true,
          store: true,
          buyer: true,
          payment: true,
          escrow: true
        }
      });

      // Create status history record
      await tx.statusChange.create({
        data: {
          orderId,
          oldStatus: order.status,
          newStatus: 'CANCELLED',
          changedBy: userId,
          reason: `Order rejected by seller: ${reason}`
        }
      });

      // Restore product stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            quantityBought: { decrement: item.quantity }
          }
        });
      }

      // Handle escrow if exists
      if (order.escrow) {
        if (order.escrow.releaseStatus === 'PENDING') {
          // Cancel escrow if funds haven't been released
          await tx.escrow.update({
            where: { id: order.escrow.id },
            data: {
              releaseStatus: 'CANCELLED',
              releaseReason: `Order rejected by seller: ${reason}`,
              cancelledAt: new Date()
            }
          });
        } else if (order.escrow.releaseStatus === 'RELEASED') {
          // This shouldn't happen based on eligibility check, but handle it
          console.error(`WARNING: Attempting to refund order ${orderId} with released escrow`);
        }
      }

      // Update payment status
      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'REFUNDED',
          metadata: {
            ...order.payment.metadata,
            refund_data: refundResult.refundData,
            refund_reason: `Order rejected by seller: ${reason}`,
            refunded_at: new Date().toISOString()
          }
        }
      });

      return updated;
    });

    // Send notifications
    try {
      const buyerId = order.buyer.id;
      const buyerName = order.buyer.firstName;
      const storeName = order.store.name;
      const orderUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;

      // Notify buyer about rejection and refund
      await sendNotification(
        buyerId,
        'Order Rejected - Refund Processed',
        `Your order #${orderId} from ${storeName} has been rejected. A full refund of ${refundAmount} ${order.currency} has been processed.`,
        'ORDER_REJECTED',
        { orderId, storeId: order.storeId, refundAmount }
      );

      await sendEmailNotification({
        to: order.buyer.email,
        toName: buyerName,
        subject: `Order (#${orderId}) Rejected - Refund Processed`,
        sender: 'orders',
        template: 'generic',
        templateData: {
          title: 'Order Rejected',
          message: `We're sorry, but your order #${orderId} from ${storeName} has been rejected by the seller. 
          
Reason: ${reason}

A full refund of ${refundAmount} ${order.currency} has been processed and should appear in your account within 5-10 business days.`,
          ctaText: 'View Order',
          ctaUrl: orderUrl
        }
      });

      // Notify seller (confirmation)
      await sendNotification(
        userId,
        'Order Rejected',
        `You have rejected order #${orderId}. The buyer has been refunded.`,
        'ORDER_REJECTED_SELLER',
        { orderId, buyerId, refundAmount }
      );

      await sendEmailNotification({
        to: order.store.user.email,
        toName: order.store.user.firstName,
        subject: `Order (#${orderId}) Rejected - Buyer Refunded`,
        template: 'generic',
        templateData: {
          title: 'Order Rejected',
          message: `You have rejected order #${orderId}. The buyer has been notified and a full refund of ${refundAmount} ${order.currency} has been processed.
          
Rejection reason: ${reason}`,
          ctaText: 'View Orders',
          ctaUrl: `${process.env.FRONTEND_URL}/seller/orders`
        }
      });

    } catch (notificationError) {
      console.error('Error sending notification/email for order rejection:', notificationError);
      // Don't fail the request if notifications fail
    }

    // Clear relevant caches
    await cache.del(`order:${orderId}:user:${order.buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${order.buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);
    
    if (order.checkoutSession) {
      await cache.del(`checkout:${order.checkoutSession}:user:${order.buyerId}`);
    }

    // Clear product caches since stock was restored
    for (const item of order.items) {
      await cache.del(`product:url:${item.productId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Order rejected successfully. Buyer has been refunded.',
      data: {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        refundAmount,
        refundReason: updatedOrder.refundReason,
        refundProcessed: true,
        refundData: refundResult.refundData
      }
    });

  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while rejecting order.',
      error: error.message
    });
  }
};