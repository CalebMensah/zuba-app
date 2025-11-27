import paystack from '../config/paystack.js';
import prisma from '../config/prisma.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';


export const processRefund = async ({
  orderId,
  paymentId,
  amount,
  currency,
  reason,
  gatewayRef
}) => {
  try {
    // Validate required parameters
    if (!orderId || !paymentId || !amount || !gatewayRef) {
      throw new Error('Missing required parameters for refund processing');
    }

    // Fetch order and payment details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        buyer: true,
        store: { include: { user: true } }
      }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.paymentId !== paymentId) {
      throw new Error('Payment ID does not match order payment');
    }

    // Check if already refunded
    if (order.payment.status === 'REFUNDED') {
      return {
        success: false,
        error: 'Payment has already been refunded',
        alreadyRefunded: true
      };
    }

    // Validate refund amount doesn't exceed payment amount
    if (amount > order.payment.amount) {
      throw new Error(`Refund amount (${amount}) exceeds payment amount (${order.payment.amount})`);
    }

    // Call Paystack refund API
    console.log(`Initiating refund for transaction ${gatewayRef}, amount: ${amount} ${currency}`);
    
    const refundResponse = await paystack.refund.create({
      transaction: gatewayRef,
      amount: Math.round(amount * 100), // Convert to kobo
      currency,
      merchant_note: reason || 'Order refund'
    });

    if (!refundResponse.status || !refundResponse.data) {
      throw new Error('Paystack refund request failed');
    }

    console.log(`Refund initiated successfully: ${refundResponse.data.transaction.reference}`);

    // Update Payment record
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...order.payment.metadata,
          refund_data: refundResponse.data,
          refund_initiated_at: new Date().toISOString()
        }
      }
    });

    // Update Order record
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'REFUNDED',
        refundAmount: amount,
        refundReason: reason,
        status: 'CANCELLED'
      }
    });

    // Send notifications to buyer
    await sendNotification(
      order.buyerId,
      'Refund Processed',
      `Your refund of ${amount} ${currency} for order #${orderId} has been processed.`,
      'payment_update',
      { orderId }
    );

    await sendEmailNotification({
      to: order.buyer.email,
      toName: order.buyer.name,
      subject: 'Refund Processed',
      template: 'generic',
      templateData: {
        title: 'Refund Processed',
        message: `Your refund of ${amount} ${currency} for order #${orderId} has been processed. It should appear in your account within 5-10 business days.`
      }
    });

    // Send notification to seller
    await sendNotification(
      order.store.userId,
      'Refund Issued',
      `A refund of ${amount} ${currency} has been issued for order #${orderId}.`,
      'payment_update',
      { orderId }
    );

    await sendEmailNotification({
      to: order.store.user.email,
      toName: order.store.user.name,
      subject: 'Refund Issued',
      template: 'generic',
      templateData: {
        title: 'Refund Issued',
        message: `A refund of ${amount} ${currency} has been issued for order #${orderId}. Reason: ${reason}`
      }
    });

    return {
      success: true,
      refundData: refundResponse.data,
      message: 'Refund processed successfully'
    };

  } catch (error) {
    console.error('Error processing refund:', error);

    // Log the failed refund attempt
    try {
      await prisma.refundLog.create({
        data: {
          orderId,
          paymentId,
          amount,
          currency,
          reason,
          gatewayRef,
          status: 'FAILED',
          errorMessage: error.message,
          attemptedAt: new Date()
        }
      });
    } catch (logError) {
      console.error('Error logging failed refund:', logError);
    }

    return {
      success: false,
      error: error.message
    };
  }
};

export const processPartialRefund = async ({
  orderId,
  paymentId,
  amount,
  currency,
  reason,
  gatewayRef
}) => {
  try {
    // Fetch order to validate partial refund amount
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Check if partial refund is within limits
    const alreadyRefunded = order.refundAmount || 0;
    const totalRefund = alreadyRefunded + amount;

    if (totalRefund > order.payment.amount) {
      throw new Error(`Total refund amount (${totalRefund}) would exceed payment amount (${order.payment.amount})`);
    }

    // Process the refund
    const result = await processRefund({
      orderId,
      paymentId,
      amount,
      currency,
      reason: `Partial refund: ${reason}`,
      gatewayRef
    });

    if (result.success) {
      // Update order with cumulative refund amount
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundAmount: totalRefund,
          // Don't mark as fully refunded if partial
          paymentStatus: totalRefund >= order.payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
        }
      });
    }

    return result;

  } catch (error) {
    console.error('Error processing partial refund:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const checkRefundEligibility = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        escrow: true
      }
    });

    if (!order) {
      return {
        eligible: false,
        reason: 'Order not found'
      };
    }

    if (!order.payment || order.payment.status !== 'SUCCESS') {
      return {
        eligible: false,
        reason: 'Payment was not successful'
      };
    }

    if (order.payment.status === 'REFUNDED') {
      return {
        eligible: false,
        reason: 'Order has already been refunded'
      };
    }

    if (order.escrow && order.escrow.releaseStatus === 'RELEASED') {
      return {
        eligible: false,
        reason: 'Funds have already been released to seller',
        requiresManualIntervention: true
      };
    }

    // Check if order is within refund window (e.g., 30 days)
    const orderDate = new Date(order.createdAt);
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    const refundWindowDays = 30;

    if (daysSinceOrder > refundWindowDays) {
      return {
        eligible: false,
        reason: `Refund window of ${refundWindowDays} days has expired`,
        daysSinceOrder
      };
    }

    return {
      eligible: true,
      maxRefundAmount: order.payment.amount - (order.refundAmount || 0),
      currency: order.currency,
      paymentGatewayRef: order.payment.gatewayRef
    };

  } catch (error) {
    console.error('Error checking refund eligibility:', error);
    return {
      eligible: false,
      reason: 'Error checking eligibility',
      error: error.message
    };
  }
};

export const getRefundStatus = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        refundAmount: true,
        refundReason: true,
        totalAmount: true,
        currency: true,
        payment: {
          select: {
            status: true,
            gatewayRef: true,
            metadata: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      refundAmount: order.refundAmount || 0,
      refundReason: order.refundReason,
      totalAmount: order.totalAmount,
      currency: order.currency,
      isFullyRefunded: order.paymentStatus === 'REFUNDED',
      isPartiallyRefunded: order.refundAmount > 0 && order.refundAmount < order.totalAmount,
      refundMetadata: order.payment?.metadata?.refund_data || null
    };

  } catch (error) {
    console.error('Error getting refund status:', error);
    throw error;
  }
};