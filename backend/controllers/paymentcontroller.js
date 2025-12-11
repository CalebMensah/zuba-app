// controllers/paymentController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import paystack from '../config/paystack.js';
import crypto from 'crypto';
import { processRefund } from '../utils/refundUtils.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

// Constants
const MAX_ORDERS_PER_CHECKOUT = 50;
const ESCROW_HOLD_DAYS = 4;
const POINTS_PER_CURRENCY_UNIT = 10;
const ALLOWED_CALLBACK_DOMAINS = [
  process.env.FRONTEND_URL,
  'https://yourdomain.com'
].filter(Boolean);

// CORRECT - Separate collection and transfer fees
const PAYSTACK_COLLECTION_PERCENT = 1.95;  // 1.95% when buyer pays platform
const PAYSTACK_TRANSFER_MOBILE_MONEY = 1.00;  // GHS 1 when platform pays seller
const PAYSTACK_TRANSFER_BANK = 8.00;  // GHS 8 when platform pays seller via bank

// Utility: Timing-safe string comparison
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

// Utility: Validate callback URL
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

// CORRECT - Collection fee (buyer pays this)
function calculatePaystackCollectionFee(amount) {
  const percentFee = amount * (PAYSTACK_COLLECTION_PERCENT / 100);
  return parseFloat(percentFee.toFixed(2));
}

// CORRECT - Transfer fee (platform pays this later)
function getTransferFee(payoutMethod = 'mobile_money') {
  return payoutMethod === 'bank' ? PAYSTACK_TRANSFER_BANK : PAYSTACK_TRANSFER_MOBILE_MONEY;
}

// Utility: Calculate order total from items
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

// Utility: Calculate seller payout and commission for order items
async function calculateSellerPayouts(order) {
  const items = order.items || [];
  const commissionRate = order.commissionRate || 0.03;
  
  const results = [];
  let totalCommission = 0;
  let totalGrossPayout = 0;

  for (const item of items) {
    const itemSubtotal = item.price * item.quantity;
    const commission = parseFloat((itemSubtotal * commissionRate).toFixed(2));
    const grossSellerPayout = parseFloat((itemSubtotal - commission).toFixed(2));
    
    totalCommission += commission;
    totalGrossPayout += grossSellerPayout;
    
    results.push({
      itemId: item.id,
      grossSellerPayout,
      commission
    });
  }

  // Get transfer fee
  const transferFee = order.transferFee || getTransferFee(order.sellerPayoutPreference);
  const netSellerPayout = parseFloat((totalGrossPayout - transferFee).toFixed(2));

  return {
    items: results,
    totalCommission: parseFloat(totalCommission.toFixed(2)),
    grossSellerPayout: totalGrossPayout,
    transferFee,
    netSellerPayout
  };
}

// Utility: Sanitize metadata
function sanitizeMetadata(metadata) {
  const sanitized = {};
  const allowedKeys = ['checkoutSessionId', 'orderIds', 'buyerId', 'sellerId', 'storeIds', 'orderCount'];  // ✅ Removed 'paymentMethod'
  
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
    const { orderIds, email, callbackUrl } = req.body;  // ✅ Removed paymentMethod
    const userId = req.user.userId;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Order IDs array is required and must not be empty.' });
    }
    if (orderIds.length > MAX_ORDERS_PER_CHECKOUT) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_ORDERS_PER_CHECKOUT} orders allowed per checkout.` });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }
    if (callbackUrl && !validateCallbackUrl(callbackUrl)) {
      return res.status(400).json({ success: false, message: 'Invalid callback URL. Must be from an allowed domain.' });
    }

    const result = await prisma.$transaction(async (tx) => {
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

      if (orders.length !== orderIds.length) throw new Error('One or more orders not found or unauthorized.');

      const invalidOrders = [];
      for (const order of orders) {
        if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') invalidOrders.push(order.id);
        const totalCheck = await calculateOrderTotal(order.id);
        if (!totalCheck || !totalCheck.isValid) invalidOrders.push(order.id);
      }
      if (invalidOrders.length > 0) throw new Error(`Invalid orders: ${invalidOrders.join(', ')}`);

      const existingPayments = await tx.payment.findMany({ where: { orderId: { in: orderIds }, status: 'PENDING' } });
      if (existingPayments.length > 0) throw new Error('One or more orders already have pending payments.');

      const subtotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const paystackCollectionFee = calculatePaystackCollectionFee(subtotal);  // ✅ Use subtotal
      const buyerTotalAmount = parseFloat((subtotal + paystackCollectionFee).toFixed(2));  // ✅ Use paystackCollectionFee

      const checkoutSessionId = `cs_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const metadata = sanitizeMetadata({
        checkoutSessionId,
        orderIds,
        buyerId: userId,
        storeIds: [...new Set(orders.map(o => o.storeId))],
        orderCount: orders.length
      });

      const response = await paystack.transaction.initialize({
        email,
        amount: Math.round(buyerTotalAmount * 100),
        currency: orders[0].currency || 'GHS',
        reference: `zuba_multi_${checkoutSessionId}`,
        callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment/success?session=${checkoutSessionId}`,
        metadata
      });

      if (!response.data) throw new Error('Failed to initialize Paystack transaction');

      const payments = await Promise.all(orders.map(async (order) => {
        const transferFee = getTransferFee(order.store.user.payoutPreference);  // ✅ Inside loop
        
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: buyerTotalAmount,
            currency: order.currency || 'GHS',
            gateway: 'paystack',
            gatewayRef: response.data.reference,
            gatewayStatus: 'pending',
            status: 'PENDING',
            metadata: { 
              ...metadata, 
              authorizationUrl: response.data.authorization_url, 
              multiStore: true,
              paystackCollectionFee,
              orderSubtotal: order.totalAmount,
              transferFee
            }
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { 
            paymentId: payment.id, 
            checkoutSession: checkoutSessionId, 
            paystackFee: paystackCollectionFee, 
            sellerPayoutPreference: order.store.user.payoutPreference, 
            transferFee  
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
        paystackCollectionFee, 
        orders, 
        payments 
      };
    });

    for (const order of result.orders) {
      await cache.del(`order:${order.id}:user:${userId}`);
      await cache.del(`order:${order.id}:user:${order.store.userId}`);
      await cache.del(`user:${userId}:orders`);
      await cache.del(`store:${order.storeId}:orders`);
    }

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully.',
      data: {
        checkoutSessionId: result.checkoutSessionId,
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        orderSubtotal: result.subtotal,
        paystackCollectionFee: result.paystackCollectionFee,  // ✅ Correct property name
        totalAmount: result.totalAmount,
        orderCount: result.orders.length,
        breakdown: {
          subtotal: result.subtotal,
          collectionFee: result.paystackCollectionFee,
          buyerTotal: result.totalAmount
        },
        orders: result.orders.map(o => ({ 
          orderId: o.id, 
          storeId: o.storeId, 
          storeName: o.store.name, 
          amount: o.totalAmount 
        })),
        payments: result.payments.map(p => ({ paymentId: p.id, orderId: p.orderId }))
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const message = ['Invalid orders', 'not found', 'pending payments'].some(msg => error.message.includes(msg)) ? error.message : 'Failed to create checkout session';
    res.status(500).json({ success: false, message });
  }
};

export const initiatePayment = async (req, res) => {
  try {
    const { orderId, email, amount, currency = 'GHS' } = req.body; 
    const userId = req.user.userId;

    if (!orderId || !email || !amount) return res.status(400).json({ success: false, message: 'Order ID, email, and amount are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Valid email is required.' });
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

      const paystackCollectionFee = calculatePaystackCollectionFee(order.totalAmount);
      const buyerTotalAmount = parseFloat((order.totalAmount + paystackCollectionFee).toFixed(2));  // ✅ Define buyerTotalAmount
      const transferFee = getTransferFee(order.store.user.payoutPreference);

      const checkoutSessionId = `cs_single_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const metadata = sanitizeMetadata({ 
        orderId, 
        buyerId: userId, 
        sellerId: order.store.userId, 
        checkoutSessionId
      });

      const response = await paystack.transaction.initialize({
        email,
        amount: Math.round(buyerTotalAmount * 100),
        currency,
        reference: `zuba_${orderId}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/success?session=${checkoutSessionId}&orderId=${orderId}`,
        metadata
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
            paystackCollectionFee,
            orderSubtotal: order.totalAmount,
            transferFee
          }
        }
      });

      await tx.order.update({ 
        where: { id: orderId }, 
        data: { 
          paymentId: payment.id, 
          checkoutSession: checkoutSessionId, 
          paystackFee: paystackCollectionFee,
          sellerPayoutPreference: order.store.user.payoutPreference,  // ✅ Add seller payout preference
          transferFee
        } 
      });

      return { 
        payment, 
        order, 
        checkoutSessionId, 
        authorizationUrl: response.data.authorization_url, 
        reference: response.data.reference,
        paystackCollectionFee,
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
        paystackCollectionFee: result.paystackCollectionFee,  // ✅ Correct property name
        totalAmount: result.buyerTotalAmount,
        breakdown: {
          subtotal: result.order.totalAmount,
          collectionFee: result.paystackCollectionFee,
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

  const isMultiStore = orderIds && Array.isArray(orderIds);

  if (isMultiStore) {
    await handleMultiStorePayment(reference, gatewayAmountKobo, orderIds, checkoutSessionId, data);
  } else {
    await handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, data);
  }
}

async function handleSingleOrderPayment(reference, gatewayAmountKobo, orderId, gatewayData) {
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
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

      if (!payment) {
        console.log(`Webhook: Payment not found for reference ${reference}`);
        return;
      }

      if (payment.status === 'SUCCESS') {
        console.log(`Webhook: Duplicate success event for reference ${reference}`);
        return;
      }

      // Verify amount (buyer pays subtotal + Paystack collection fee)
      const gatewayAmount = gatewayAmountKobo / 100;
      const paystackCollectionFee = payment.metadata?.paystackCollectionFee || payment.order.paystackFee || 0;
      const expectedTotal = parseFloat((payment.order.totalAmount + paystackCollectionFee).toFixed(2));

      if (Math.abs(gatewayAmount - expectedTotal) > 0.01) {
        console.error(`Amount mismatch for order ${orderId}. Expected: ${expectedTotal}, Got: ${gatewayAmount}`);
        
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
        return;
      }

      // Calculate seller payouts and commission
      const payoutCalculation = await calculateSellerPayouts(payment.order);

      // Update payment status
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

      // Update order with commission total and paidAt
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'SUCCESS',
          commissionTotal: payoutCalculation.totalCommission,
          paidAt: new Date()
        }
      });

  
      for (const itemCalc of payoutCalculation.items) {
        await tx.orderItem.update({
          where: { id: itemCalc.itemId },
          data: {
            sellerPayout: itemCalc.grossSellerPayout 
          }
        });
      }

      // Create escrow with NET payout (after transfer fee)
      const escrowReleaseDate = new Date();
      escrowReleaseDate.setDate(escrowReleaseDate.getDate() + ESCROW_HOLD_DAYS);

      const escrow = await tx.escrow.create({
        data: {
          paymentId: payment.id,
          orderId,
          amountHeld: payoutCalculation.netSellerPayout, 
          currency: payment.currency,
          releaseDate: escrowReleaseDate,
          releaseStatus: 'PENDING'
        }
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { escrowId: escrow.id }
      });

      await tx.order.update({
        where: { id: orderId },
        data: { escrowId: escrow.id }
      });

      // Award points based on subtotal only (not including Paystack fee)
      const pointsToAward = Math.floor(payment.order.totalAmount / POINTS_PER_CURRENCY_UNIT);
      if (pointsToAward > 0) {
        await tx.user.update({
          where: { id: payment.order.buyerId },
          data: {
            points: { increment: pointsToAward }
          }
        });
      }

      // Send notifications (non-blocking)
      setImmediate(async () => {
        try {
          await sendNotification(
            payment.order.buyerId,
            'Payment Successful',
            `Your payment for order #${orderId} was successful.`,
            'payment',
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
            'order_confirmed',
            { orderId }
          );

          await sendEmailNotification({
            to: payment.order.store.user.email,
            toName: payment.order.store.user.firstName,
            subject: 'New Order Confirmed',
            template: 'generic',
            templateData: {
              title: 'New Order Confirmed',
              message: `You have a new confirmed order #${orderId}. Net payout: ${payoutCalculation.netSellerPayout.toFixed(2)} ${payment.currency}`,
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
        console.log(`Webhook: No payments found for reference ${reference}`);
        return;
      }

      const successfulPayments = payments.filter(p => p.status === 'SUCCESS');
      if (successfulPayments.length === payments.length) {
        console.log(`Webhook: All payments already processed for reference ${reference}`);
        return;
      }

      // Verify total amount (buyer pays subtotal + Paystack collection fee)
      const gatewayAmount = gatewayAmountKobo / 100;
      const paystackCollectionFee = payments[0].metadata?.paystackCollectionFee || 0;  // ✅ Get from first payment
      const orderSubtotals = payments.reduce((sum, p) => sum + p.order.totalAmount, 0);  // ✅ Sum all orders
      const expectedTotal = parseFloat((orderSubtotals + paystackCollectionFee).toFixed(2));  // ✅ Correct calculation

      if (Math.abs(gatewayAmount - expectedTotal) > 0.01) {
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
          // Calculate seller payouts and commission for this order
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

          // Update order with commission total
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: 'CONFIRMED',
              paymentStatus: 'SUCCESS',
              commissionTotal: payoutCalculation.totalCommission,
              paidAt: new Date()
            }
          });

          // Update each order item with GROSS seller payout
          for (const itemCalc of payoutCalculation.items) {
            await tx.orderItem.update({
              where: { id: itemCalc.itemId },
              data: {
                sellerPayout: itemCalc.grossSellerPayout  
              }
            });
          }

          // Create escrow with NET payout
          const escrowReleaseDate = new Date();
          escrowReleaseDate.setDate(escrowReleaseDate.getDate() + ESCROW_HOLD_DAYS);

          const escrow = await tx.escrow.create({
            data: {
              paymentId: payment.id,
              orderId: payment.orderId,
              amountHeld: payoutCalculation.netSellerPayout,  // ✅ Net amount
              currency: payment.currency,
              releaseDate: escrowReleaseDate,
              releaseStatus: 'PENDING'
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

          // Accumulate subtotal for points (not including fees)
          newlyProcessedSubtotal += payment.order.totalAmount;
          buyerId = payment.order.buyerId;

          // Send seller notifications (non-blocking)
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

      // Award points once for the buyer based on subtotals only (not including Paystack fee)
      if (buyerId && newlyProcessedSubtotal > 0) {
        const pointsToAward = Math.floor(newlyProcessedSubtotal / POINTS_PER_CURRENCY_UNIT);
        if (pointsToAward > 0) {
          await tx.user.update({
            where: { id: buyerId },
            data: {
              points: { increment: pointsToAward }
            }
          });
        }
      }

      // Send consolidated buyer notification (non-blocking)
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
              templateData: {
                title: 'Payment Successful',
                message: `Your payment for ${payments.length} order(s) was successful. Subtotal: ${orderSubtotals.toFixed(2)} ${payments[0].currency} + Fee: ${paystackCollectionFee.toFixed(2)} ${payments[0].currency}`,  // ✅ Fixed variable name
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
  try {
    const { reference } = req.params;
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

    const isAuthorized = payments.some(p => p.order.buyerId === userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this payment.'
      });
    }

    const sanitizedGatewayData = {
      status: verification.data.status,
      amount: verification.data.amount,
      currency: verification.data.currency,
      reference: verification.data.reference,
      paid_at: verification.data.paid_at,
    };

    res.status(200).json({
      success: true,
      data: {
        payments: payments.map(p => ({
          ...p,
          metadata: {
            ...p.metadata,
            gateway_response: undefined
          }
        })),
        gatewayData: sanitizedGatewayData,
        isMultiStore: payments.length > 1
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