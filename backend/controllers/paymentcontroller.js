// controllers/paymentController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import paystack from '../config/paystack.js';
import crypto from 'crypto';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

// Constants
const AMOUNT_TOLERANCE = 0.10;
const MAX_ORDERS_PER_CHECKOUT = 50;
const ESCROW_HOLD_DAYS = 4;
const POINTS_PER_CURRENCY_UNIT = 10;
const ALLOWED_CALLBACK_DOMAINS = [
  process.env.FRONTEND_URL,
  'https://zubamobile.com'
].filter(Boolean);

import { PLATFORM_FEE_PERCENT, PAYSTACK_COLLECTION_PERCENT } from '../utils/fees.js';

function timingSafeCompare(a, b) {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function validateCallbackUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ALLOWED_CALLBACK_DOMAINS.some(domain => {
      const allowedUrl = new URL(domain);
      return parsed.hostname === allowedUrl.hostname;
    });
  } catch {
    return false;
  }
}

function calculateFees(subtotal) {
  const platformFee = subtotal * PLATFORM_FEE_PERCENT;
  const taxableAmount = subtotal + platformFee;
  const paystackFee = taxableAmount * (PAYSTACK_COLLECTION_PERCENT / 100);
  const buyerTotal = subtotal + platformFee + paystackFee;
  const netSellerPayout = subtotal * (1 - PLATFORM_FEE_PERCENT);  // Seller gets exactly 97%, platform absorbs transfer fees
  
  return {
    platformFee: parseFloat(platformFee.toFixed(2)),
    paystackFee: parseFloat(paystackFee.toFixed(2)),
    buyerTotal: parseFloat(buyerTotal.toFixed(2)),
    netSellerPayout: parseFloat(netSellerPayout.toFixed(2))
  };
}

async function calculateOrderTotal(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  });

  if (!order) return null;

  const calculatedTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return {
    storedTotal: order.totalAmount,
    calculatedTotal,
    isValid: Math.abs(calculatedTotal - order.totalAmount) < 0.01
  };
}

async function calculateSellerPayouts(order) {
  const items = order.items || [];
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const commissionRate = order.commissionRate || PLATFORM_FEE_PERCENT;
  
  const results = [];
  let totalCommission = 0;

  for (const item of items) {
    const itemSubtotal = item.price * item.quantity;
    const commission = parseFloat((itemSubtotal * commissionRate).toFixed(2));
    const sellerPayout = parseFloat((itemSubtotal - commission).toFixed(2));
    
    totalCommission += commission;
    
    results.push({
      itemId: item.id,
      sellerPayout,
      commission
    });
  }

  const netSellerPayout = subtotal * (1 - commissionRate);  // Exact 97%

  return {
    items: results,
    totalCommission: parseFloat(totalCommission.toFixed(2)),
    netSellerPayout
  };
}

function sanitizeMetadata(metadata) {
  const sanitized = {};
  const allowedKeys = ['checkoutSessionId', 'orderIds', 'buyerId', 'sellerId', 'storeIds', 'orderCount'];

  for (const key of allowedKeys) {
    if (metadata[key] !== undefined) {
      const value = metadata[key];
      sanitized[key] = Array.isArray(value) ? value.slice(0, MAX_ORDERS_PER_CHECKOUT) : String(value).slice(0, 255);
    }
  }

  return sanitized;
}

export const createCheckoutSession = async (req, res) => {
  try {
    const { orderIds, callbackUrl } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user || !user.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'User email not found. Please update your profile.' 
      });
    }
    const realEmail = user.email.toLowerCase().trim();

    console.log('👤 Using real buyer email:', realEmail);

    // Validation
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order IDs array is required and must not be empty.' 
      });
    }
    if (orderIds.length > MAX_ORDERS_PER_CHECKOUT) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum ${MAX_ORDERS_PER_CHECKOUT} orders allowed per checkout.` 
      });
    }
    if (!realEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(realEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid email is required.' 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch orders
      const orders = await tx.order.findMany({
        where: { id: { in: orderIds }, buyerId: userId },
        include: { 
          store: { 
            include: { 
              user: { 
                select: { 
                  id: true, 
                  email: true, 
                  firstName: true,
                  payoutPreference: true 
                } 
              } 
            } 
          }, 
          buyer: true, 
          items: { include: { product: true } } 
        }
      });

      if (orders.length !== orderIds.length) {
        throw new Error('One or more orders not found or unauthorized.');
      }

      // Validate orders
      const invalidOrders = [];
      for (const order of orders) {
        if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') {
          invalidOrders.push(order.id);
        }
        const totalCheck = await calculateOrderTotal(order.id);
        if (!totalCheck || !totalCheck.isValid) {
          invalidOrders.push(order.id);
        }
      }
      if (invalidOrders.length > 0) {
        throw new Error(`Invalid orders: ${invalidOrders.join(', ')}`);
      }

      // Check for existing pending payments
      const existingPayments = await tx.payment.findMany({ 
        where: { orderId: { in: orderIds }, status: 'PENDING' } 
      });
      if (existingPayments.length > 0) {
        throw new Error('One or more orders already have pending payments.');
      }

      // Calculate fees: subtotal + 3% platform + 1.95% paystack on (subtotal+platform)
      const subtotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const fees = calculateFees(subtotal);
      const buyerTotalAmount = fees.buyerTotal;

      // Generate checkout session ID
      const checkoutSessionId = `cs_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Prepare metadata
      const metadata = sanitizeMetadata({
        checkoutSessionId,
        orderIds,
        buyerId: userId,
        storeIds: [...new Set(orders.map(o => o.storeId))],
        orderCount: orders.length
      });

      const finalCallbackUrl = `zuba://payment/success?session=${checkoutSessionId}`;

      console.log(' Initializing Paystack transaction:', {
        email: realEmail,
        amount: buyerTotalAmount,
        amountInKobo: Math.round(buyerTotalAmount * 100),
        orderCount: orders.length,
        checkoutSessionId,
        callbackUrl: finalCallbackUrl
      });

      const response = await paystack.transaction.initialize({
        email: realEmail, 
        amount: Math.round(buyerTotalAmount * 100),
        currency: 'GHS',
        callback_url: finalCallbackUrl,
        metadata: {
          ...metadata,
          buyerEmail: realEmail
        }
      });

      if (!response.data) {
        throw new Error('Failed to initialize Paystack transaction');
      }

      console.log('Paystack transaction initialized:', {
        reference: response.data.reference,
        authorizationUrl: response.data.authorization_url
      });

      const payments = await Promise.all(orders.map(async (order) => {
        const orderProportion = order.totalAmount / subtotal;
        const orderFees = {
          platformFee: fees.platformFee * orderProportion,
          paystackFee: fees.paystackFee * orderProportion,
          buyerTotal: fees.buyerTotal * orderProportion,
          netSeller: fees.netSellerPayout * orderProportion
        };

        console.log(`Creating payment for order ${order.id}:`, {
          orderAmount: order.totalAmount,
          platformFee: orderFees.platformFee,
          paystackFee: orderFees.paystackFee,
          buyerTotal: orderFees.buyerTotal,
          netSellerPayout: orderFees.netSeller
        });

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: orderFees.buyerTotal,
            currency: order.currency || 'GHS',
            gateway: 'paystack',
            gatewayRef: response.data.reference,
            gatewayStatus: 'pending',
            status: 'PENDING',
            metadata: {
              ...metadata,
              authorizationUrl: response.data.authorization_url,
              multiStore: orders.length > 1,
              fees: orderFees,
              orderSubtotal: order.totalAmount,
              totalBuyerAmount: buyerTotalAmount,
              orderProportion
            }
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { 
            paymentId: payment.id, 
            checkoutSession: checkoutSessionId, 
            paystackFee: orderFees.paystackFee,
            platformFee: orderFees.platformFee,
            sellerPayoutPreference: order.store.user.payoutPreference
          }
        });

        return payment;
      }));

      return { 
        checkoutSessionId, 
        authorizationUrl: response.data.authorization_url, 
        reference: response.data.reference, 
        totalAmount: buyerTotalAmount,
        subtotal,
        paystackFee: fees.paystackFee, 
        orders, 
        payments 
      };
    });

    // Clear cache
    for (const order of result.orders) {
      await cache.del(`order:${order.id}:user:${userId}`);
      await cache.del(`order:${order.id}:user:${order.store.userId}`);
      await cache.del(`user:${userId}:orders`);
      await cache.del(`store:${order.storeId}:orders`);
    }

    console.log('Checkout session created successfully:', {
      reference: result.reference,
      totalAmount: result.totalAmount,
      orderCount: result.orders.length
    });

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully.',
      data: {
        checkoutSessionId: result.checkoutSessionId,
        authorizationUrl: result.authorizationUrl,
        reference: result.reference, 
        orderSubtotal: result.subtotal,
        paystackFee: result.paystackFee,  
        totalAmount: result.totalAmount,
        orderCount: result.orders.length,
        breakdown: {
          subtotal: result.subtotal,
          collectionFee: result.paystackFee,
          buyerTotal: result.totalAmount
        },
        orders: result.orders.map(o => ({ 
          orderId: o.id, 
          storeId: o.storeId, 
          storeName: o.store.name, 
          amount: o.totalAmount 
        })),
        payments: result.payments.map(p => ({ 
          paymentId: p.id, 
          orderId: p.orderId,
          amount: p.amount,
          gatewayRef: p.gatewayRef
        }))
      }
    });
  } catch (error) {
    console.error(' Error creating checkout session:', error);
    const message = ['Invalid orders', 'not found', 'pending payments'].some(msg => 
      error.message.includes(msg)
    ) ? error.message : 'Failed to create checkout session';
    
    res.status(500).json({ 
      success: false, 
      message,
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


export const initiatePayment = async (req, res) => {
  try {
    const { orderId, amount, currency = 'GHS' } = req.body;
  const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user || !user.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'User email not found. Please update your profile.' 
      });
    }
    const realEmail = user.email.toLowerCase().trim();

    if (!orderId || !realEmail || !amount) return res.status(400).json({ success: false, message: 'Order ID, email, and amount are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(realEmail)) return res.status(400).json({ success: false, message: 'Valid email is required.' });
    if (amount <= 0 || amount > 10000000) return res.status(400).json({ success: false, message: 'Invalid payment amount.' });

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ 
        where: { id: orderId }, 
        include: { 
          store: { 
            include: { 
              user: { 
                select: { 
                  id: true, 
                  email: true, 
                  firstName: true,
                  payoutPreference: true 
                } 
              } 
            } 
          }, 
          buyer: true, 
          items: { include: { product: true } } 
        } 
      });
      
      if (!order) throw new Error('Order not found.');
      if (order.buyerId !== userId) throw new Error('Unauthorized to initiate payment for this order.');
      if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') throw new Error('Invalid order status or payment already processed.');

      const totalCheck = await calculateOrderTotal(orderId);
      if (!totalCheck || !totalCheck.isValid) throw new Error('Order total validation failed.');

      if (Math.abs(amount - order.totalAmount) > 0.01) throw new Error('Payment amount does not match order total.');

      const existingPayment = await tx.payment.findFirst({ where: { orderId, status: 'PENDING' } });
      if (existingPayment) throw new Error('A pending payment already exists for this order.');

      const fees = calculateFees(order.totalAmount);
      const buyerTotalAmount = fees.buyerTotal;

      const checkoutSessionId = `cs_single_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const metadata = sanitizeMetadata({
        orderId,
        buyerId: userId,
        sellerId: order.store.userId,
        checkoutSessionId,
        platformFee: fees.platformFee,
        netSellerPayout: fees.netSellerPayout
      });

      const response = await paystack.transaction.initialize({
        email: realEmail,
        amount: Math.round(buyerTotalAmount * 100),
        currency,
        callback_url: `zuba://payment/success?session=${checkoutSessionId}&orderId=${orderId}`,
        metadata: {
          ...metadata,
          buyerEmail: realEmail
        }
      });

      if (!response.data) throw new Error('Failed to initialize Paystack transaction');

      const payment = await tx.payment.create({
        data: {
          orderId,
          amount: buyerTotalAmount,
          currency,
          gateway: 'paystack',
          gatewayRef: response.data.reference,
          gatewayStatus: 'pending',
          status: 'PENDING',
          metadata: {
            ...metadata,
            authorizationUrl: response.data.authorization_url,
            createdAt: new Date().toISOString(),
            paystackFee: fees.paystackFee,
            orderSubtotal: order.totalAmount,
          }
        }
      });

      await tx.order.update({ 
        where: { id: orderId }, 
        data: { 
          paymentId: payment.id, 
          checkoutSession: checkoutSessionId, 
          paystackFee: fees.paystackFee,
          sellerPayoutPreference: order.store.user.payoutPreference, 
        } 
      });

      return { 
        payment, 
        order, 
        checkoutSessionId, 
        authorizationUrl: response.data.authorization_url, 
        reference: response.data.reference,
        paystackFee: fees.paystackFee,
        buyerTotalAmount
      };
    });

    await cache.del(`order:${orderId}:user:${userId}`);
    await cache.del(`order:${orderId}:user:${result.order.store.userId}`);

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully.',
      data: {
        checkoutSessionId: result.checkoutSessionId,
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        paymentId: result.payment.id,
        orderSubtotal: result.order.totalAmount,
        paystackFee: result.paystackFee,
        totalAmount: result.buyerTotalAmount,
        breakdown: {
          subtotal: result.order.totalAmount,
          collectionFee: result.paystackFee,
          buyerTotal: result.buyerTotalAmount
        }
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    const message = ['Order not found', 'Unauthorized', 'Invalid order status', 'validation failed', 'does not match', 'already exists'].some(msg => error.message.includes(msg)) ? error.message : 'Failed to initiate payment';
    res.status(500).json({ success: false, message });
  }
};

export const handlePaystackWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log('Webhook received:', { event, reference: data?.reference, metadata: data?.metadata });

    function verifyPaystackSignature(req) {
      const signature = req.headers['x-paystack-signature'];
      if (!signature) return false;

      const payload = req.rawBody || JSON.stringify(req.body);

      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

      return timingSafeCompare(hash, signature);
    }

    if (!verifyPaystackSignature(req)) {
      console.error('Webhook signature verification failed');
      return res.status(401).send('Unauthorized');
    }

    if (event === 'charge.success') {
      await handleSuccessfulCharge(data);
    } else if (event === 'charge.failed') {
      await handleFailedCharge(data);
    } else if (event === 'transfer.success') {
      await handleSuccessfulTransfer(data);
    } else if (event === 'transfer.failed') {
      await handleFailedTransfer(data);
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

  // Find payments using the helper function that checks both custom and Paystack refs
  const payments = await findPaymentsByPaystackRef(reference);

  if (payments.length === 0) {
    console.log(`Webhook: Payment not found for reference ${reference}`);
    return;
  }

  const isMultiStore = payments.length > 1 || (orderIds && Array.isArray(orderIds));

  if (isMultiStore) {
    await handleMultiStorePayment(reference, gatewayAmountKobo, orderIds, checkoutSessionId, data);
  } else {
    await handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, data);
  }
}

// Helper function to find payments by Paystack reference
async function findPaymentsByPaystackRef(paystackRef) {
  return await prisma.payment.findMany({
    where: { gatewayRef: paystackRef }, // Now using Paystack reference directly
    include: {
      order: {
        include: {
          store: { include: { user: true } },
          buyer: true,
          items: { include: { product: true } }
        }
      }
    }
  });
}

async function handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, gatewayData) {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock the payment row to prevent race conditions
      const payment = await tx.$queryRaw`
        SELECT * FROM "Payment" 
        WHERE "gatewayRef" = ${reference} 
        FOR UPDATE
      `;

      if (!payment || payment.length === 0) {
        console.log(`Webhook: Payment not found for reference ${reference}`);
        return;
      }

      const paymentRecord = payment[0];
    
    if (paymentRecord.status === 'SUCCESS') {
      console.log(`Webhook: Duplicate success - skipping`);
      return;
    }
    
    if (paymentRecord.status === 'FAILED') {
      console.log(` WEBHOOK RETRY: Recovering FAILED payment`);
    }

      // Fetch full payment with relations
      const fullPayment = await tx.payment.findFirst({
        where: { gatewayRef: reference },
        include: { 
          order: { 
            include: { 
              store: { include: { user: true } },
              buyer: true,
              items: { include: { product: true } }
            } 
          } 
        }
      });

      if (!fullPayment) return;
      const gatewayAmount = parseFloat((gatewayAmountKobo / 100).toFixed(2))
      
        const expectedTotal = fullPayment.amount;
      if (Math.abs(gatewayAmount - expectedTotal) > AMOUNT_TOLERANCE) {
        if (paymentRecord.status === 'FAILED') {
          console.log(`WEBHOOK OVERRIDE: Recovering FAILED payment `);
        } else {
          await tx.payment.update({
            where: { id: fullPayment.id },
            data: {
              gatewayStatus: 'failed',
              status: 'FAILED',
              metadata: { 
                ...fullPayment.metadata, 
                error: 'Amount mismatch',
                expected: expectedTotal,
                received: gatewayAmount,
                tolerance: AMOUNT_TOLERANCE
              }
            }
          });
          console.log(` Payment marked FAILED due to amount mismatch`);
          return;
        }
      } else {
        console.log(`Amount validation PASSED`);
      }

      const payoutCalculation = await calculateSellerPayouts(fullPayment.order);

      // Update payment status
      await tx.payment.update({
        where: { id: fullPayment.id },
        data: {
          gatewayStatus: 'success',
          status: 'SUCCESS',
          metadata: { 
            ...fullPayment.metadata, 
            gateway_response: gatewayData,
            processedAt: new Date().toISOString()
          }
        }
      });

      // Update order
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paymentStatus: 'SUCCESS',
          commissionTotal: payoutCalculation.totalCommission,
          paidAt: new Date()
        }
      });

      // Update order items with seller payout
      for (const itemCalc of payoutCalculation.items) {
        await tx.orderItem.update({
          where: { id: itemCalc.itemId },
          data: {
            sellerPayout: itemCalc.sellerPayout
          }
        });
      }

      // Create escrow
      const escrowReleaseDate = new Date();
      escrowReleaseDate.setDate(escrowReleaseDate.getDate() + ESCROW_HOLD_DAYS);

      const escrow = await tx.escrow.create({
        data: {
          paymentId: fullPayment.id,
          orderId,
          amountHeld: payoutCalculation.netSellerPayout,
          currency: fullPayment.currency,
          releaseDate: escrowReleaseDate,
          releaseStatus: 'HELD'
        }
      });

      await tx.payment.update({
        where: { id: fullPayment.id },
        data: { escrowId: escrow.id }
      });

      await tx.order.update({
        where: { id: orderId },
        data: { escrowId: escrow.id }
      });


      // Award points
      const pointsToAward = Math.floor(fullPayment.order.totalAmount / POINTS_PER_CURRENCY_UNIT);
      
      if (pointsToAward > 0) {
        try {
          await tx.user.update({
            where: { id: fullPayment.order.buyerId },
            data: {
              points: { increment: pointsToAward }
            }
          });
          
          // Invalidate points cache
          await cache.del(`user:${fullPayment.order.buyerId}:points`);
        } catch (pointsError) {
          console.error(`Failed to award points to user ${fullPayment.order.buyerId}:`, pointsError);
        }
      } else {
        console.log(`No points to award for order ${orderId} (amount: ${fullPayment.order.totalAmount})`);
      }

      // Send notifications (non-blocking)
      setImmediate(async () => {
        try {
          await sendNotification(
            fullPayment.order.buyerId,
            'Payment Successful',
            `Your payment for order #${orderId} was successful.`,
            'payment',
            { orderId }
          );

          await sendEmailNotification({
            to: fullPayment.order.buyer.email,
            toName: fullPayment.order.buyer.firstName,
            subject: 'Payment Successful',
            template: 'generic',
            sender: 'payment',
            templateData: {
              title: 'Payment Successful',
              message: `Your payment for order #${orderId} was successful.`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`
            }
          });

          await sendNotification(
            fullPayment.order.store.userId,
            'New Order Confirmed',
            `You have a new confirmed order #${orderId}.`,
            'order_confirmed',
            { orderId }
          );

          await sendEmailNotification({
            to: fullPayment.order.store.user.email,
            toName: fullPayment.order.store.user.firstName,
            subject: 'New Order Confirmed',
            template: 'generic',
            sender: 'order',
            templateData: {
              title: 'New Order Confirmed',
              message: `You have a new confirmed order #${orderId}. Net payout: ${payoutCalculation.netSellerPayout.toFixed(2)} ${fullPayment.currency}`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}`
            }
          });
        } catch (notifError) {
          console.error('Error sending notifications:', notifError);
        }
      });
    }, {
      maxWait: 5000,
      timeout: 10000
    });

    // Invalidate caches
    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: reference },
      select: { 
        order: { 
          select: { 
            id: true, 
            buyerId: true, 
            storeId: true, 
            checkoutSession: true,
            store: { select: { userId: true } }
          } 
        } 
      }
    });

    if (payment) {
      await cache.del(`order:${orderId}:user:${payment.order.buyerId}`);
      await cache.del(`order:${orderId}:user:${payment.order.store.userId}`);
      await cache.del(`user:${payment.order.buyerId}:orders`);
      await cache.del(`store:${payment.order.storeId}:orders`);
      
      if (payment.order.checkoutSession) {
        await cache.del(`checkout:${payment.order.checkoutSession}:user:${payment.order.buyerId}`);
      }
    }

  } catch (error) {
    console.error('Error in handleSingleOrderPayment:', error);
  }
}

async function handleMultiStorePayment(reference, gatewayAmountKobo, orderIds, checkoutSessionId, gatewayData) {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock all payment rows to prevent race conditions
      await tx.$executeRaw`
        SELECT * FROM "Payment" 
        WHERE "gatewayRef" = ${reference} 
        AND "orderId" = ANY(${orderIds}::text[])
        FOR UPDATE
      `;

      const payments = await tx.payment.findMany({
        where: { 
          gatewayRef: reference,
          orderId: { in: orderIds }
        },
        include: { 
          order: { 
            include: { 
              store: { include: { user: true } },
              buyer: true,
              items: { include: { product: true } }
            } 
          } 
        }
      });

      if (payments.length === 0) {
        console.log(`Webhook: No payments found for reference `);
        return;
      }

      const successfulPayments = payments.filter(p => p.status === 'SUCCESS');
      if (successfulPayments.length === payments.length) {
        console.log(`Webhook: All payments already processed for reference `);
        return;
      }

      // Verify total amount
      const gatewayAmount = gatewayAmountKobo / 100;
      const paystackFee = payments[0].metadata?.paystackFee || 0;
      const orderSubtotals = payments.reduce((sum, p) => sum + p.order.totalAmount, 0);
                const expectedTotal = parseFloat(
            payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
              );

      if (Math.abs(gatewayAmount - expectedTotal) > AMOUNT_TOLERANCE) {
        console.error(`Amount mismatch for checkout session ${checkoutSessionId}. Expected: ${expectedTotal}, Got: ${gatewayAmount}`);
        
        for (const payment of payments) {
          if (payment.status !== 'FAILED') {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                gatewayStatus: 'failed',
                status: 'FAILED',
                metadata: { 
                  ...payment.metadata, 
                  error: 'Amount mismatch',
                  expected: expectedTotal,
                  received: gatewayAmount
                }
              }
            });
          }
        }
        return;
      }

      // Process each order
      let newlyProcessedSubtotal = 0;
      let buyerId = null;

      for (const payment of payments) {
        if (payment.status !== 'SUCCESS') {
          // Calculate seller payouts
          const payoutCalculation = await calculateSellerPayouts(payment.order);

          // Update payment
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              gatewayStatus: 'success',
              status: 'SUCCESS',
              metadata: { 
                ...payment.metadata, 
                gateway_response: gatewayData,
                processedAt: new Date().toISOString()
              }
            }
          });

          // Update order
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: 'PAID',
              paymentStatus: 'SUCCESS',
              commissionTotal: payoutCalculation.totalCommission,
              paidAt: new Date()
            }
          });

          // Update order items
          for (const itemCalc of payoutCalculation.items) {
            await tx.orderItem.update({
              where: { id: itemCalc.itemId },
              data: {
                sellerPayout: itemCalc.sellerPayout
              }
});
          }

          // Create escrow
          const escrowReleaseDate = new Date();
          escrowReleaseDate.setDate(escrowReleaseDate.getDate() + ESCROW_HOLD_DAYS);

          const escrow = await tx.escrow.create({
            data: {
              paymentId: payment.id,
              orderId: payment.orderId,
              amountHeld: payoutCalculation.netSellerPayout,
              currency: payment.currency,
              releaseDate: escrowReleaseDate,
              releaseStatus: 'HELD'
            }
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { escrowId: escrow.id }
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: { escrowId: escrow.id }
          });

          newlyProcessedSubtotal += payment.order.totalAmount;
          buyerId = payment.order.buyerId;

          // Send seller notifications
          setImmediate(async () => {
            try {
              await sendNotification(
                payment.order.store.userId,
                'New Order Confirmed',
                `You have a new confirmed order #${payment.orderId}.`,
                'order_confirmed',
                { orderId: payment.orderId }
              );

              await sendEmailNotification({
                to: payment.order.store.user.email,
                toName: payment.order.store.user.firstName,
                subject: 'New Order Confirmed',
                template: 'generic',
                sender: 'order',
                templateData: {
                  title: 'New Order Confirmed',
                  message: `You have a new confirmed order #${payment.orderId}. Net payout: ${payoutCalculation.netSellerPayout.toFixed(2)} ${payment.currency}`,
                  ctaText: 'View Order',
                  ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${payment.orderId}`
                }
              });
            } catch (notifError) {
              console.error('Error sending seller notification:', notifError);
            }
          });
        } else {
          buyerId = payment.order.buyerId;
        }
      }


      // Award points
      if (buyerId && newlyProcessedSubtotal > 0) {
        const pointsToAward = Math.floor(newlyProcessedSubtotal / POINTS_PER_CURRENCY_UNIT);
        console.log(`Awarding ${pointsToAward} points to buyer ${buyerId} for multi-store payment (subtotal: ${newlyProcessedSubtotal})`);
        
        if (pointsToAward > 0) {
          try {
            await tx.user.update({
              where: { id: buyerId },
              data: {
                points: { increment: pointsToAward }
              }
            });
            console.log(`Successfully awarded ${pointsToAward} points to user ${buyerId} for multi-store payment`);
            
            // Invalidate points cache
            await cache.del(`user:${buyerId}:points`);
            console.log(`Invalidated points cache for user ${buyerId}`);
          } catch (pointsError) {
            console.error(`Failed to award points to user ${buyerId}:`, pointsError);
            // Don't fail the entire transaction for points error
          }
        } else {
          console.log(`No points to award for multi-store payment (subtotal: ${newlyProcessedSubtotal})`);
        }
      }

      // Send buyer notification
      if (buyerId) {
        const buyerPayment = payments[0];
        setImmediate(async () => {
          try {
            await sendNotification(
              buyerId,
              'Payment Successful',
              `Your payment for ${payments.length} order(s) was successful.`,
              'payment',
              { checkoutSessionId, orderCount: payments.length }
            );

            await sendEmailNotification({
              to: buyerPayment.order.buyer.email,
              toName: buyerPayment.order.buyer.firstName,
              subject: 'Payment Successful',
              template: 'generic',
              sender: 'payment',
              templateData: {
                title: 'Payment Successful',
                message: `Your payment for ${payments.length} order(s) was successful. Subtotal: ${orderSubtotals.toFixed(2)} ${payments[0].currency} + Fee: ${paystackFee.toFixed(2)} ${payments[0].currency}`,
                ctaText: 'View Orders',
                ctaUrl: `${process.env.FRONTEND_URL}/orders`
              }
            });
          } catch (notifError) {
            console.error('Error sending buyer notification:', notifError);
          }
        });
      }
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Invalidate caches
    const payments = await prisma.payment.findMany({
      where: { 
        gatewayRef: reference,
        orderId: { in: orderIds }
      },
      select: { 
        orderId: true,
        order: { 
          select: { 
            buyerId: true, 
            storeId: true,
            checkoutSession: true,
            store: { select: { userId: true } }
          } 
        } 
      }
    });

    if (payments.length > 0) {
      const buyerId = payments[0].order.buyerId;
      
      for (const payment of payments) {
        await cache.del(`order:${payment.orderId}:user:${buyerId}`);
        await cache.del(`order:${payment.orderId}:user:${payment.order.store.userId}`);
        await cache.del(`store:${payment.order.storeId}:orders`);
      }

      await cache.del(`user:${buyerId}:orders`);
      
      if (checkoutSessionId) {
        await cache.del(`checkout:${checkoutSessionId}:user:${buyerId}`);
      }
    }

  } catch (error) {
    console.error('Error in handleMultiStorePayment:', error);
  }
}

async function handleFailedCharge(data) {
  const { reference, metadata } = data;
  const { orderId, orderIds, checkoutSessionId } = metadata;

  try {
    await prisma.$transaction(async (tx) => {
      const isMultiStore = orderIds && Array.isArray(orderIds);
      const targetOrderIds = isMultiStore ? orderIds : [orderId];

      const payments = await tx.payment.findMany({
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
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              gatewayStatus: 'failed',
              status: 'FAILED',
              metadata: { 
                ...payment.metadata, 
                gateway_response: data,
                failedAt: new Date().toISOString()
              }
            }
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: 'FAILED' }
          });
        }
      }

      // Send notification to buyer (non-blocking)
      const buyerId = payments[0].order.buyerId;
      const buyerEmail = payments[0].order.buyer.email;
      const buyerName = payments[0].order.buyer.firstName;

      setImmediate(async () => {
        try {
          await sendNotification(
            buyerId,
            'Payment Failed',
            `Your payment for ${payments.length} order(s) failed. Please try again.`,
            'payment_failed',
            { checkoutSessionId: checkoutSessionId || null }
          );

          await sendEmailNotification({
            to: buyerEmail,
            toName: buyerName,
            subject: 'Payment Failed',
            template: 'generic',
            sender: 'payment',
            templateData: {
              title: 'Payment Failed',
              message: `Your payment for ${payments.length} order(s) failed. Please try again.`,
              ctaText: 'Retry Payment',
              ctaUrl: `${process.env.FRONTEND_URL}/checkout`
            }
          });
        } catch (notifError) {
          console.error('Error sending failure notification:', notifError);
        }
      });
    });

    // Invalidate caches
    const payments = await prisma.payment.findMany({
      where: { gatewayRef: reference },
      select: { 
        orderId: true,
        order: { select: { buyerId: true, checkoutSession: true } }
      }
    });

    if (payments.length > 0) {
      const buyerId = payments[0].order.buyerId;
      
      for (const payment of payments) {
        await cache.del(`order:${payment.orderId}:user:${buyerId}`);
      }

      if (checkoutSessionId) {
        await cache.del(`checkout:${checkoutSessionId}:user:${buyerId}`);
      }
    }

  } catch (error) {
    console.error('Error in handleFailedCharge:', error);
  }
}

async function handleSuccessfulTransfer(data) {
  const reference = data.reference;

  try {
    const payout = await prisma.payout.findFirst({
      where: { transferReference: reference },
      include: {
        order: {
          include: {
            store: { include: { user: true } },
            escrow: true
          }
        }
      }
    });

    if (!payout) {
      console.log(`No payout found for transfer reference: ${reference}`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          transferredAt: new Date(),
          transferStatus: 'SUCCESS'
        }
      });

      if (payout.order.escrow) {
        await tx.escrow.update({
          where: { id: payout.order.escrow.id },
          data: {
            releaseStatus: 'COMPLETED',
            releasedAt: new Date(),
            releasedTo: payout.order.store.userId
          }
        });
      }
    });

    // Notify seller
    setImmediate(async () => {
      try {
        await sendNotification(
          payout.order.store.userId,
          'Payment Received',
          `GHS ${payout.amount.toFixed(2)} has been transferred to your account.`,
          'PAYOUT_SUCCESS',
          { orderId: payout.orderId, amount: payout.amount }
        );

        await sendEmailNotification({
          to: payout.order.store.user.email,
          toName: payout.order.store.user.firstName,
          subject: `Payment Transfer Successful`,
          template: 'generic',
          sender: 'payment',
          templateData: {
            title: 'Payment Received!',
            message: `GHS ${payout.amount.toFixed(2)} has been successfully transferred to your account for order #${payout.orderId}.`,
            ctaText: 'View Payouts',
            ctaUrl: `${process.env.FRONTEND_URL}/seller/payouts`
          }
        });
      } catch (notifError) {
        console.error('Transfer success notification error:', notifError);
      }
    });

    console.log(`Transfer successful: ${reference}`);
  } catch (error) {
    console.error('Error handling successful transfer:', error);
  }
}

async function handleFailedTransfer(data) {
  const reference = data.reference;

  try {
    const payout = await prisma.payout.findFirst({
      where: { transferReference: reference },
      include: {
        order: {
          include: {
            store: { include: { user: true } }
          }
        }
      }
    });

    if (!payout) return;

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        transferStatus: 'FAILED',
        failureReason: data.message || 'Transfer failed'
      }
    });

    // Notify seller
    setImmediate(async () => {
      try {
        await sendNotification(
          payout.order.store.userId,
          'Payment Transfer Failed',
          `Transfer of GHS ${payout.amount.toFixed(2)} failed. We'll retry soon.`,
          'PAYOUT_FAILED',
          { orderId: payout.orderId }
        );
      } catch (notifError) {
        console.error('Transfer failure notification error:', notifError);
      }
    });

    console.log(`Transfer failed: ${reference}`);
  } catch (error) {
    console.error('Error handling failed transfer:', error);
  }
}

export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.userId;

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid payment ID is required.'
      });
    }

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

    const sanitizedPayment = {
      ...payment,
      metadata: {
        ...payment.metadata,
        gateway_response: undefined
      }
    };

    res.status(200).json({
      success: true,
      data: sanitizedPayment
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};

export const getPaymentsByCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid session ID is required.'
      });
    }

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
        orders: orders.map(order => ({
          ...order,
          payment: order.payment ? {
            ...order.payment,
            metadata: {
              ...order.payment.metadata,
              gateway_response: undefined
            }
          } : null
        })),
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
      message: 'Failed to fetch payments'
    });
  }
};

export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters.'
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const where = {
      order: {
        OR: [
          { buyerId: userId },
          { store: { userId } }
        ]
      }
    };

    if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) {
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
        take: limitNum
      }),
      prisma.payment.count({ where })
    ]);

    const sanitizedPayments = payments.map(payment => ({
      ...payment,
      metadata: {
        ...payment.metadata,
        gateway_response: undefined
      }
    }));

    res.status(200).json({
      success: true,
      data: sanitizedPayments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
};

export const verifyPayment = async (req, res) => {
  const { reference } = req.params;
  
  try {
    const userId = req.user.userId;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid reference is required.'
      });
    }
    const verification = await paystack.transaction.verify(reference);

    if (!verification.data) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed.'
      });
    }
    let payments = await prisma.payment.findMany({
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

    // If not found with the given reference, try searching by checkout session
    if (payments.length === 0 && verification.data.metadata?.checkoutSessionId) {
      console.log('No payment found with reference, searching by checkoutSessionId:', 
        verification.data.metadata.checkoutSessionId);
      
      const orders = await prisma.order.findMany({
        where: { 
          checkoutSession: verification.data.metadata.checkoutSessionId 
        }
      });
      
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        payments = await prisma.payment.findMany({
          where: { orderId: { in: orderIds } },
          include: {
            order: {
              include: {
                buyer: true,
                store: { include: { user: true } }
              }
            }
          }
        });
        
        //Update the gatewayRef to Paystack's reference
        if (payments.length > 0) {
          await prisma.payment.updateMany({
            where: { id: { in: payments.map(p => p.id) } },
            data: { gatewayRef: verification.data.reference }
          });
        }
      }
    }

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
        debug: {
          searchedReference: reference,
          paystackReference: verification.data.reference,
          paystackStatus: verification.data.status,
          metadata: verification.data.metadata
        }
      });
    }

    // Step 3: Authorization check
    const isAuthorized = payments.some(p => p.order.buyerId === userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this payment.'
      });
    }

    // Step 4: Process payment based on Paystack status
    const paystackStatus = verification.data.status;
    const needsUpdate = payments.some(p => p.status === 'PENDING');

    if (needsUpdate) {
      if (paystackStatus === 'success') {
        await handleSuccessfulCharge(verification.data);
      } else if (paystackStatus === 'failed' || paystackStatus === 'abandoned') {
        await handleFailedCharge(verification.data);
      } else {
        await handleFailedCharge(verification.data);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(' Payment already processed. Current status:', payments[0].status);
    }

    // Step 5: Fetch updated payment records
    const updatedPayments = await prisma.payment.findMany({
      where: { 
        OR: [
          { gatewayRef: reference },
          { gatewayRef: verification.data.reference }
        ]
      },
      include: {
        order: {
          include: {
            buyer: {
              select: {
                id: true,
                firstName: true,
                email: true
              }
            },
            store: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    email: true
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
                    images: true
                  }
                }
              }
            }
          }
        },
        escrow: true
      }
    });

       // Step 6: Send notifications based on final status
    const finalStatus = updatedPayments[0]?.status;
    
    if (finalStatus === 'SUCCESS') {
      for (const payment of updatedPayments) {
          setImmediate(async () => {
            try {
              await sendNotification(
                payment.order.buyerId,
                'Payment Successful',
                updatedPayments.length > 1
                  ? `Your payment for ${updatedPayments.length} orders was successful.`
                  : `Your payment for order #${payment.orderId} was successful.`,
                'payment',
                { orderId: payment.orderId }
              );

              await sendEmailNotification({
                to: payment.order.buyer.email,
                toName: payment.order.buyer.firstName,
                subject: 'Payment Successful',
                template: 'generic',
                sender: 'payment',
                templateData: {
                  title: 'Payment Successful',
                  message: updatedPayments.length > 1
                    ? `Your payment for ${updatedPayments.length} orders was successful.`
                    : `Your payment for order #${payment.orderId} was successful.`,
                  ctaText: 'View Order',
                  ctaUrl: `${process.env.FRONTEND_URL}/orders/${payment.orderId}`
                }
              });

              // Seller new order notification
              await sendNotification(
                payment.order.store.userId,
                'New Order Confirmed',
                `You have a new confirmed order #${payment.orderId}.`,
                'order_confirmed',
                { orderId: payment.orderId }
              );

              await sendEmailNotification({
                to: payment.order.store.user.email,
                toName: payment.order.store.user.firstName,
                subject: 'New Order Confirmed',
                template: 'generic',
                sender: 'order',
                templateData: {
                  title: 'New Order Confirmed',
                  message: `You have a new confirmed order #${payment.orderId}.`,
                  ctaText: 'View Order',
                  ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${payment.orderId}`
                }
              });
            } catch (error) {
              console.error('Error sending success notifications:', error);
            }
          });
        }
    } else if (finalStatus === 'FAILED') {
      // Failure notifications
      for (const payment of updatedPayments) {
        setImmediate(async () => {
          try {
            await sendNotification(
              payment.order.buyerId,
              'Payment Failed',
              `Your payment for order #${payment.orderId} failed. Please try again.`,
              'payment_failed',
              { orderId: payment.orderId }
            );
            await sendEmailNotification({
              to: payment.order.buyer.email,
              toName: payment.order.buyer.firstName,
              subject: 'Payment Failed',
              template: 'generic',
              sender: 'payment',
              templateData: {
                title: 'Payment Failed',
                message: `Your payment for order #${payment.orderId} failed. Please try again.`,
                ctaText: 'Retry Payment',
                ctaUrl: `${process.env.FRONTEND_URL}/checkout`
              }
            });
          } catch (error) {
            console.error('Error sending failure notifications:', error);
          }
        });
      }
    }

    // Step 7: Sanitize and return data
    const sanitizedGatewayData = {
      status: verification.data.status,
      amount: verification.data.amount,
      currency: verification.data.currency,
      reference: verification.data.reference,
      paid_at: verification.data.paid_at,
    };

    console.log(`VERIFY COMPLETE [${reference}]: Final status=${updatedPayments[0]?.status}, payments=${updatedPayments.length}`);
    
    res.status(200).json({
      success: true,
      data: {
        payments: updatedPayments.map(p => ({
          ...p,
          metadata: {
            ...p.metadata,
            gateway_response: undefined
          }
        })),
        gatewayData: {
          status: verification.data.status,
          amount: verification.data.amount,
          currency: verification.data.currency,
          reference: verification.data.reference,
          paid_at: verification.data.paid_at,
        },
        isMultiStore: updatedPayments.length > 1
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      gateway,
      gatewayStatus,
      currency,
      storeId,
      buyerId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Admin access required.'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters.'
      });
    }

    const allowedSortFields = ['createdAt', 'amount', 'status', 'gateway'];
    const allowedSortOrders = ['asc', 'desc'];

    if (!allowedSortFields.includes(sortBy) || !allowedSortOrders.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort parameters.'
      });
    }

    const where = {};

    if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) {
      where.status = status;
    }

    if (gateway && ['paystack', 'stripe'].includes(gateway)) {
      where.gateway = gateway;
    }

    if (gatewayStatus) {
      where.gatewayStatus = gatewayStatus;
    }

    if (currency) {
      where.currency = currency;
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) {
        const min = parseFloat(minAmount);
        if (isNaN(min) || min < 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid minAmount parameter.'
          });
        }
        where.amount.gte = min;
      }
      if (maxAmount) {
        const max = parseFloat(maxAmount);
        if (isNaN(max) || max < 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid maxAmount parameter.'
          });
        }
        where.amount.lte = max;
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        try {
          where.createdAt.gte = new Date(startDate);
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format.'
          });
        }
      }
      if (endDate) {
        try {
          where.createdAt.lte = new Date(endDate);
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format.'
          });
        }
      }
    }

    if (storeId || buyerId) {
      where.order = {};
      if (storeId) where.order.storeId = storeId;
      if (buyerId) where.order.buyerId = buyerId;
    }

    if (search) {
      const sanitizedSearch = search.trim().slice(0, 100);
      where.OR = [
        { gatewayRef: { contains: sanitizedSearch, mode: 'insensitive' } },
        { order: { 
          OR: [
            { id: { contains: sanitizedSearch, mode: 'insensitive' } },
            { buyer: { 
              OR: [
                { email: { contains: sanitizedSearch, mode: 'insensitive' } },
                { firstName: { contains: sanitizedSearch, mode: 'insensitive' } },
                { lastName: { contains: sanitizedSearch, mode: 'insensitive' } }
              ]
            }}
          ]
        }}
      ];
    }

    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [payments, total, stats] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              checkoutSession: true,
              createdAt: true,
              buyer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePicture: true
                }
              },
              store: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  userId: true
                }
              },
              items: {
                select: {
                  id: true,
                  quantity: true,
                  price: true,
                  sellerPayout: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: true
                    }
                  }
                }
              }
            }
          },
          escrow: {
            select: {
              id: true,
              status: true,
              amountHeld: true,
              releaseDate: true,
              releasedAt: true
            }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _avg: { amount: true },
        _count: { id: true }
      })
    ]);

    const [statusBreakdown, gatewayBreakdown, currencyBreakdown] = await Promise.all([
      prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['gateway'],
        where,
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['currency'],
        where,
        _count: { id: true },
        _sum: { amount: true }
      })
    ]);

    const sanitizedPayments = payments.map(payment => ({
      ...payment,
      metadata: {
        checkoutSessionId: payment.metadata?.checkoutSessionId,
        multiStore: payment.metadata?.multiStore,
        totalOrders: payment.metadata?.totalOrders,
        createdAt: payment.metadata?.createdAt,
        processedAt: payment.metadata?.processedAt,
        paystackFee: payment.metadata?.paystackFee,
        orderSubtotal: payment.metadata?.orderSubtotal
      }
    }));

    res.status(200).json({
      success: true,
      data: sanitizedPayments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + take < total
      },
      statistics: {
        totalAmount: stats._sum.amount || 0,
        averageAmount: stats._avg.amount || 0,
        totalPayments: stats._count.id || 0,
        byStatus: statusBreakdown.map(s => ({
          status: s.status,
          count: s._count.id,
          totalAmount: s._sum.amount || 0
        })),
        byGateway: gatewayBreakdown.map(g => ({
          gateway: g.gateway,
          count: g._count.id,
          totalAmount: g._sum.amount || 0
        })),
        byCurrency: currencyBreakdown.map(c => ({
          currency: c.currency,
          count: c._count.id,
          totalAmount: c._sum.amount || 0
        }))
      },
      filters: {
        status,
        gateway,
        gatewayStatus,
        currency,
        storeId,
        buyerId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search
      }
    });

  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
};

export const markPaymentAsFailed = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.userId;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid reference is required.'
      });
    }

    const payments = await prisma.payment.findMany({
      where: { gatewayRef: reference },
      include: {
        order: {
          select: {
            buyerId: true,
            storeId: true,
            status: true
          }
        }
      }
    });

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.'
      });
    }

    // Verify user authorization
    const isAuthorized = payments.some(p => p.order.buyerId === userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this payment.'
      });
    }

    // Update all payments with this reference to FAILED
    await prisma.$transaction(async (tx) => {
      for (const payment of payments) {
        if (payment.status === 'PENDING') {
          // Update payment status
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              gatewayStatus: 'cancelled',
              metadata: {
                ...payment.metadata,
                cancelledAt: new Date().toISOString(),
                cancelledBy: 'user'
              }
            }
          });

          // Update order payment status and order status
          await tx.order.update({
            where: { id: payment.orderId },
            data: { 
              paymentStatus: 'FAILED',
              status: 'PENDING_PAYMENT'
            }
          });
        }
      }
    });

    // Clear caches
    for (const payment of payments) {
      await cache.del(`order:${payment.orderId}:user:${userId}`);
      await cache.del(`user:${userId}:orders`);
    }

    res.status(200).json({
      success: true,
      message: 'Payment marked as failed successfully.'
    });
  } catch (error) {
    console.error('Error marking payment as failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
};