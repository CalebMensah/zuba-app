// controllers/paymentController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import paystack from '../config/paystack.js';
import crypto from 'crypto';
import { processRefund } from '../utils/refundUtils.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';


export const createCheckoutSession = async (req, res) => {
  try {
    const { orderIds, email, callbackUrl } = req.body;
    const userId = req.user.userId;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required and must not be empty.'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    // Fetch all orders
    const orders = await prisma.order.findMany({
      where: { 
        id: { in: orderIds },
        buyerId: userId
      },
      include: { 
        store: { include: { user: true } },
        buyer: true,
        items: { include: { product: true } }
      }
    });

    if (orders.length !== orderIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more orders not found or unauthorized.'
      });
    }

    // Validate all orders are pending
    const invalidOrders = orders.filter(
      order => order.status !== 'PENDING' || order.paymentStatus !== 'PENDING'
    );

    if (invalidOrders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All orders must be in PENDING status with PENDING payment.',
        invalidOrderIds: invalidOrders.map(o => o.id)
      });
    }

    // Calculate total amount
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Generate unique checkout session ID
    const checkoutSessionId = `cs_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create Paystack transaction
    const response = await paystack.transaction.initialize({
      email,
      amount: Math.round(totalAmount * 100), // Paystack expects amount in Kobo
      currency: orders[0].currency || 'GHS',
      reference: `zuba_multi_${checkoutSessionId}`,
      callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment/success?session=${checkoutSessionId}`,
      metadata: {
        checkoutSessionId,
        orderIds,
        buyerId: userId,
        storeIds: [...new Set(orders.map(o => o.storeId))],
        orderCount: orders.length
      }
    });

    if (!response.data) {
      throw new Error('Failed to initialize Paystack transaction');
    }

    // Create payment records for each order and update with checkout session
    const paymentPromises = orders.map(async (order) => {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          currency: order.currency || 'GHS',
          gateway: 'paystack',
          gatewayRef: response.data.reference,
          gatewayStatus: 'pending',
          status: 'PENDING',
          metadata: {
            checkoutSessionId,
            authorizationUrl: response.data.authorization_url,
            multiStore: true,
            totalOrders: orders.length
          }
        }
      });

      // Update order with payment ID and checkout session
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          paymentId: payment.id,
          checkoutSession: checkoutSessionId
        }
      });

      return payment;
    });

    const payments = await Promise.all(paymentPromises);

    // Invalidate caches
    for (const order of orders) {
      await cache.del(`order:${order.id}:user:${userId}`);
      await cache.del(`order:${order.id}:user:${order.store.userId}`);
      await cache.del(`user:${userId}:orders`);
      await cache.del(`store:${order.storeId}:orders`);
    }

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully.',
      data: {
        checkoutSessionId,
        authorizationUrl: response.data.authorization_url,
        reference: response.data.reference,
        totalAmount,
        orderCount: orders.length,
        orders: orders.map(o => ({
          orderId: o.id,
          storeId: o.storeId,
          storeName: o.store.name,
          amount: o.totalAmount
        })),
        payments: payments.map(p => ({ paymentId: p.id, orderId: p.orderId }))
      }
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
};

// UPDATED: Single order payment initiation (legacy support)
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, email, amount, currency = "GHS" } = req.body;
    const userId = req.user.userId;

    if (!orderId || !email || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, email, and amount are required.'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        store: { include: { user: true } },
        buyer: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to initiate payment for this order.'
      });
    }

    if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status or payment already processed.'
      });
    }

    if (Math.abs(amount - order.totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match order total.'
      });
    }

    // Generate checkout session for single order
    const checkoutSessionId = `cs_single_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const response = await paystack.transaction.initialize({
      email,
      amount: Math.round(amount * 100),
      currency,
      reference: `zuba_${orderId}_${Date.now()}`,
      callback_url: `${process.env.FRONTEND_URL}/payment/success?session=${checkoutSessionId}&orderId=${orderId}`,
      metadata: {
        orderId,
        buyerId: userId,
        sellerId: order.store.userId,
        checkoutSessionId
      }
    });

    if (!response.data) {
      throw new Error('Failed to initialize Paystack transaction');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        currency,
        gateway: 'paystack',
        gatewayRef: response.data.reference,
        gatewayStatus: 'pending',
        status: 'PENDING',
        metadata: {
          checkoutSessionId,
          authorizationUrl: response.data.authorization_url
        }
      }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { 
        paymentId: payment.id,
        checkoutSession: checkoutSessionId
      }
    });

    await cache.del(`order:${orderId}:user:${userId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully.',
      data: {
        checkoutSessionId,
        authorizationUrl: response.data.authorization_url,
        reference: response.data.reference,
        paymentId: payment.id
      }
    });

  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

export const handlePaystackWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;

    function verifyPaystackSignature(req) {
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      return hash === req.headers['x-paystack-signature'];
    }

    if (!verifyPaystackSignature(req)) {
      return res.status(401).send('Unauthorized');
    }

    if (event === 'charge.success') {
      await handleSuccessfulCharge(data);
    } else if (event === 'charge.failed') {
      await handleFailedCharge(data);
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('Error handling Paystack webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

async function handleSuccessfulCharge(data) {
  const { reference, amount: gatewayAmountKobo, metadata } = data;
  const { orderId, checkoutSessionId, orderIds } = metadata;

  // Check if this is a multi-store payment
  const isMultiStore = orderIds && Array.isArray(orderIds);

  if (isMultiStore) {
    // Handle multi-store payment
    await handleMultiStorePayment(reference, gatewayAmountKobo, orderIds, checkoutSessionId, data);
  } else {
    // Handle single order payment
    await handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, data);
  }
}

async function handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, gatewayData) {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef: reference },
    include: { 
      order: { 
        include: { 
          store: { include: { user: true } },
          buyer: true
        } 
      } 
    }
  });

  if (!payment) {
    console.log(`Webhook: Payment not found for reference ${reference}`);
    return;
  }

  if (payment.status === 'SUCCESS') {
    console.log(`Webhook: Duplicate success event for reference ${reference}`);
    return;
  }

  const expectedAmount = payment.order.totalAmount;
  const gatewayAmount = gatewayAmountKobo / 100;

  if (Math.abs(gatewayAmount - expectedAmount) > 0.01) {
    console.error(`Amount mismatch for order ${orderId}. Expected: ${expectedAmount}, Got: ${gatewayAmount}`);
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      gatewayStatus: 'success',
      status: 'SUCCESS',
      metadata: { ...payment.metadata, gateway_response: gatewayData }
    }
  });

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS'
    }
  });

  const escrowReleaseDate = new Date();
  escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 4);

  const escrow = await prisma.escrow.create({
    data: {
      paymentId: payment.id,
      orderId,
      amountHeld: payment.amount,
      currency: payment.currency,
      releaseDate: escrowReleaseDate
    }
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { escrowId: escrow.id }
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { escrowId: escrow.id }
  });

  // Send notifications
  await sendNotification(
    payment.order.buyerId,
    'Payment Successful',
    `Your payment for order #${orderId} was successful.`,
    'ORDER_PAYMENT_SUCCESS',
    { orderId }
  );

  await sendEmailNotification({
    to: payment.order.buyer.email,
    toName: payment.order.buyer.firstName,
    subject: 'Payment Successful',
    template: 'generic',
    templateData: {
      title: 'Payment Successful',
      message: `Your payment for order #${orderId} was successful.`,
      ctaText: 'View Order',
      ctaUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`
    }
  });

  await sendNotification(
    payment.order.store.userId,
    'New Order Confirmed',
    `You have a new confirmed order #${orderId}.`,
    'ORDER_CONFIRMED',
    { orderId }
  );

  await sendEmailNotification({
    to: payment.order.store.user.email,
    toName: payment.order.store.user.firstName,
    subject: 'New Order Confirmed',
    template: 'generic',
    templateData: {
      title: 'New Order Confirmed',
      message: `You have a new confirmed order #${orderId}.`,
      ctaText: 'View Order',
      ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}`
    }
  });

  // Invalidate caches
  await cache.del(`order:${orderId}:user:${payment.order.buyerId}`);
  await cache.del(`order:${orderId}:user:${payment.order.store.userId}`);
  await cache.del(`user:${payment.order.buyerId}:orders`);
  await cache.del(`store:${payment.order.storeId}:orders`);
  
  if (payment.order.checkoutSession) {
    await cache.del(`checkout:${payment.order.checkoutSession}:user:${payment.order.buyerId}`);
  }
}

async function handleMultiStorePayment(reference, gatewayAmountKobo, orderIds, checkoutSessionId, gatewayData) {
  // Find all payments for this checkout session
  const payments = await prisma.payment.findMany({
    where: { 
      gatewayRef: reference,
      orderId: { in: orderIds }
    },
    include: { 
      order: { 
        include: { 
          store: { include: { user: true } },
          buyer: true
        } 
      } 
    }
  });

  if (payments.length === 0) {
    console.log(`Webhook: No payments found for reference ${reference}`);
    return;
  }

  // Check for duplicates
  const successfulPayments = payments.filter(p => p.status === 'SUCCESS');
  if (successfulPayments.length === payments.length) {
    console.log(`Webhook: All payments already processed for reference ${reference}`);
    return;
  }

  // Verify total amount
  const expectedTotal = payments.reduce((sum, p) => sum + p.order.totalAmount, 0);
  const gatewayAmount = gatewayAmountKobo / 100;

  if (Math.abs(gatewayAmount - expectedTotal) > 0.01) {
    console.error(`Amount mismatch for checkout session ${checkoutSessionId}. Expected: ${expectedTotal}, Got: ${gatewayAmount}`);
    return;
  }

  // Update all payments and orders
  for (const payment of payments) {
    if (payment.status !== 'SUCCESS') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayStatus: 'success',
          status: 'SUCCESS',
          metadata: { ...payment.metadata, gateway_response: gatewayData }
        }
      });

      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'SUCCESS'
        }
      });

      // Create escrow for each order
      const escrowReleaseDate = new Date();
      escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 4);

      const escrow = await prisma.escrow.create({
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          amountHeld: payment.amount,
          currency: payment.currency,
          releaseDate: escrowReleaseDate
        }
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { escrowId: escrow.id }
      });

      await prisma.order.update({
        where: { id: payment.orderId },
        data: { escrowId: escrow.id }
      });

      // Send notifications
      await sendNotification(
        payment.order.store.userId,
        'New Order Confirmed',
        `You have a new confirmed order #${payment.orderId}.`,
        'ORDER_CONFIRMED',
        { orderId: payment.orderId }
      );

      await sendEmailNotification({
        to: payment.order.store.user.email,
        toName: payment.order.store.user.firstName,
        subject: 'New Order Confirmed',
        template: 'generic',
        templateData: {
          title: 'New Order Confirmed',
          message: `You have a new confirmed order #${payment.orderId}.`,
          ctaText: 'View Order',
          ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${payment.orderId}`
        }
      });

      // Invalidate caches
      await cache.del(`order:${payment.orderId}:user:${payment.order.buyerId}`);
      await cache.del(`order:${payment.orderId}:user:${payment.order.store.userId}`);
      await cache.del(`store:${payment.order.storeId}:orders`);
    }
  }

  // Send consolidated notification to buyer
  const buyerId = payments[0].order.buyerId;
  const buyerEmail = payments[0].order.buyer.email;
  const buyerName = payments[0].order.buyer.firstName;

  await sendNotification(
    buyerId,
    'Payment Successful',
    `Your payment for ${payments.length} order(s) was successful.`,
    'ORDER_PAYMENT_SUCCESS',
    { checkoutSessionId, orderCount: payments.length }
  );

  await sendEmailNotification({
    to: buyerEmail,
    toName: buyerName,
    subject: 'Payment Successful',
    template: 'generic',
    templateData: {
      title: 'Payment Successful',
      message: `Your payment for ${payments.length} order(s) was successful. Total: ${gatewayAmount.toFixed(2)} ${payments[0].currency}`,
      ctaText: 'View Orders',
      ctaUrl: `${process.env.FRONTEND_URL}/orders`
    }
  });

  await cache.del(`user:${buyerId}:orders`);
  await cache.del(`checkout:${checkoutSessionId}:user:${buyerId}`);
}

async function handleFailedCharge(data) {
  const { reference, metadata } = data;
  const { orderId, orderIds, checkoutSessionId } = metadata;

  const isMultiStore = orderIds && Array.isArray(orderIds);
  const targetOrderIds = isMultiStore ? orderIds : [orderId];

  const payments = await prisma.payment.findMany({
    where: { 
      gatewayRef: reference,
      orderId: { in: targetOrderIds }
    },
    include: { order: { include: { buyer: true } } }
  });

  if (payments.length === 0) {
    console.log(`Webhook: No payments found for reference ${reference}`);
    return;
  }

  for (const payment of payments) {
    if (payment.status !== 'FAILED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayStatus: 'failed',
          status: 'FAILED',
          metadata: { ...payment.metadata, gateway_response: data }
        }
      });

      await prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'FAILED' }
      });

      await cache.del(`order:${payment.orderId}:user:${payment.order.buyerId}`);
    }
  }

  // Send notification to buyer
  const buyerId = payments[0].order.buyerId;
  const buyerEmail = payments[0].order.buyer.email;
  const buyerName = payments[0].order.buyer.firstName;

  await sendNotification(
    buyerId,
    'Payment Failed',
    `Your payment for ${payments.length} order(s) failed. Please try again.`,
    'ORDER_PAYMENT_FAILED',
    { checkoutSessionId: checkoutSessionId || null }
  );

  await sendEmailNotification({
    to: buyerEmail,
    toName: buyerName,
    subject: 'Payment Failed',
    template: 'generic',
    templateData: {
      title: 'Payment Failed',
      message: `Your payment for ${payments.length} order(s) failed. Please try again.`,
      ctaText: 'Retry Payment',
      ctaUrl: `${process.env.FRONTEND_URL}/checkout`
    }
  });

  if (checkoutSessionId) {
    await cache.del(`checkout:${checkoutSessionId}:user:${buyerId}`);
  }
}

export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.userId;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            buyer: { select: { id: true, firstName: true, email: true } },
            store: { 
              include: { 
                user: { select: { id: true, firstName: true, email: true } } 
              } 
            }
          }
        },
        escrow: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.'
      });
    }

    const isAuthorized = 
      payment.order.buyerId === userId || 
      payment.order.store.userId === userId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this payment.'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

// NEW: Get payments by checkout session
export const getPaymentsByCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const orders = await prisma.order.findMany({
      where: { 
        checkoutSession: sessionId,
        buyerId: userId
      },
      include: {
        payment: {
          include: {
            escrow: true
          }
        },
        store: { select: { id: true, name: true, logo: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } }
          }
        }
      }
    });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No orders found for this checkout session.'
      });
    }

    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const allPaymentsSuccessful = orders.every(order => order.payment?.status === 'SUCCESS');

    res.status(200).json({
      success: true,
      data: {
        checkoutSession: sessionId,
        orders,
        summary: {
          totalOrders: orders.length,
          totalAmount,
          allPaymentsSuccessful,
          currency: orders[0]?.currency || 'GHS'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching payments by checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      order: {
        OR: [
          { buyerId: userId },
          { store: { userId } }
        ]
      }
    };

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              buyerId: true,
              storeId: true,
              checkoutSession: true,
              buyer: { select: { firstName: true, email: true } },
              store: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.payment.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.userId;

    const verification = await paystack.transaction.verify(reference);

    if (!verification.data) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed.'
      });
    }

    const payments = await prisma.payment.findMany({
      where: { gatewayRef: reference },
      include: {
        order: {
          include: {
            buyer: true,
            store: { include: { user: true } }
          }
        }
      }
    });

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.'
      });
    }

    // Check authorization (buyer of any order)
    const isAuthorized = payments.some(p => p.order.buyerId === userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this payment.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        payments,
        gatewayData: verification.data,
        isMultiStore: payments.length > 1
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};