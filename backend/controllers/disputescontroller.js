import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendNotification } from '../utils/sendnotification.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { processRefund } from '../utils/refundUtils.js';
import { transferFundsToSeller } from '../utils/transferUtils.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_DISPUTE_OUTCOMES = ['BUYER_WON', 'SELLER_WON'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    return 'Internal server error';
  }
  return error.message;
};

const invalidateDisputeCaches = async (orderId, buyerId, sellerId) => {
  await Promise.allSettled([
    cache.del(`order:${orderId}:user:${buyerId}`),
    cache.del(`order:${orderId}:user:${sellerId}`)
  ]);
};

// ── POST /orders/:orderId/disputes ────────────────────────────────────────────

export const openDispute = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;
    const { reason, type } = req.body;

    if (!reason || !type) {
      return res.status(400).json({
        success: false,
        message: 'Reason and dispute type are required.'
      });
    }

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        escrow: true,
        payment: true,
        buyer: { select: { id: true, email: true, firstName: true } },
        store: {
          include: {
            user: { select: { id: true, email: true, firstName: true } }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Payment must be successful
    const successfulPayment = order.payment?.find(p => p.status === 'SUCCESS');
    if (!successfulPayment) {
      return res.status(400).json({ success: false, message: 'Order payment not successful.' });
    }

    // Escrow already released — nothing to dispute
    if (order.escrow?.releaseStatus === 'RELEASED') {
      return res.status(400).json({ success: false, message: 'Escrow already released. Cannot open dispute.' });
    }

    // Prevent duplicate dispute
    const existing = await prisma.dispute.findFirst({
      where: { orderId, status: 'PENDING' }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'An open dispute already exists for this order.' });
    }

    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          orderId,
          paymentId: successfulPayment.id,
          buyerId,
          sellerId: order.store.userId,
          type,
          description: reason,
          status: 'PENDING'
        }
      });

      // Freeze escrow
      if (order.escrow) {
        await tx.escrow.update({
          where: { id: order.escrow.id },
          data: { releaseStatus: 'DISPUTED' }
        });
      }

      // Mark order as disputed
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' }
      });

      return created;
    });

    // Notify seller (non-blocking)
    setImmediate(async () => {
      try {
        await Promise.allSettled([
          sendNotification(
            order.store.userId,
            'New Dispute Opened',
            `A buyer opened a dispute for order #${orderId}.`,
            'DISPUTE_OPENED',
            { orderId, disputeId: dispute.id }
          ),
          sendEmailNotification({
            to: order.store.user.email,
            toName: order.store.user.firstName,
            subject: 'New Dispute Opened',
            template: 'generic',
            templateData: {
              title: 'Dispute Opened',
              message: `A buyer opened a dispute for order #${orderId}.`,
              ctaText: 'View Dispute',
              ctaUrl: `${process.env.FRONTEND_URL}/seller/disputes/${dispute.id}`
            }
          })
        ]);
      } catch (_) {
        // Notification failure must not affect response
      }
    });

    await invalidateDisputeCaches(orderId, buyerId, order.store.userId);

    return res.status(201).json({
      success: true,
      message: 'Dispute opened successfully.',
      data: dispute
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};

// ── POST /disputes/:disputeId/resolve (admin only) ────────────────────────────

export const resolveDispute = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const { disputeId } = req.params;
    const { outcome, resolution, refundAmount } = req.body;

    // Admin guard
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    // Outcome validation
    if (!VALID_DISPUTE_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        success: false,
        message: `Invalid outcome. Must be one of: ${VALID_DISPUTE_OUTCOMES.join(', ')}.`
      });
    }

    if (!resolution || typeof resolution !== 'string') {
      return res.status(400).json({ success: false, message: 'Resolution note is required.' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            escrow: true,
            payment: true,
            buyer: { select: { id: true, email: true, firstName: true } },
            store: {
              include: {
                user: { select: { id: true, email: true, firstName: true } },
                paymentDetails: true
              }
            }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    if (dispute.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Dispute already resolved.' });
    }

    const order = dispute.order;

    const successfulPayment = order.payment?.find(p => p.status === 'SUCCESS');
    if (!successfulPayment) {
      return res.status(400).json({ success: false, message: 'No successful payment found for this order.' });
    }

    if (!order.escrow) {
      return res.status(400).json({ success: false, message: 'No escrow record found for this order.' });
    }

    // ── BUYER WON → refund buyer ──────────────────────────────────────────────
    if (outcome === 'BUYER_WON') {
      const amount = refundAmount
        ? parseFloat(refundAmount)
        : order.totalAmount;

      if (isNaN(amount) || amount <= 0 || amount > order.totalAmount) {
        return res.status(400).json({ success: false, message: 'Invalid refund amount.' });
      }

      const refund = await processRefund({
        paymentId: successfulPayment.id,
        amount,
        gatewayRef: successfulPayment.gatewayRef,
        reason: resolution
      });

      if (!refund.success) {
        return res.status(500).json({ success: false, message: 'Refund processing failed.' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution,
            resolvedAt: new Date()
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' }
        });

        await tx.escrow.update({
          where: { id: order.escrow.id },
          data: { releaseStatus: 'REFUNDED' }
        });

        await tx.payment.update({
          where: { id: successfulPayment.id },
          data: { status: 'REFUNDED' }
        });
      });
    }

    // ── SELLER WON → release escrow and transfer funds ────────────────────────
    if (outcome === 'SELLER_WON') {
      const sellerPaymentAccount = order.store.paymentDetails;

      if (!sellerPaymentAccount?.paystackRecipientCode) {
        return res.status(500).json({
          success: false,
          message: 'Seller payment account not configured.'
        });
      }

      const amountToTransfer = order.escrow.amountHeld;

      if (amountToTransfer <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid transfer amount.' });
      }

      const transferResult = await transferFundsToSeller({
        amount: amountToTransfer,
        currency: order.escrow.currency,
        recipientCode: sellerPaymentAccount.paystackRecipientCode,
        orderId: order.id,
        reason: `Dispute #${disputeId} resolved in seller's favour`
      });

      if (!transferResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Transfer failed.',
          error: process.env.NODE_ENV === 'production' ? undefined : transferResult.error
        });
      }

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution,
            resolvedAt: now
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' }
        });

        await tx.escrow.update({
          where: { id: order.escrow.id },
          data: {
            releaseStatus: 'RELEASED',
            releasedAt: now,
            releasedTo: 'seller_dispute_resolution'
          }
        });
      });
    }

    // Notify both parties (non-blocking)
    setImmediate(async () => {
      try {
        const buyerMessage = outcome === 'BUYER_WON'
          ? `Your dispute for order #${order.id} was resolved in your favour. A refund has been initiated.`
          : `Your dispute for order #${order.id} has been resolved.`;

        const sellerMessage = outcome === 'SELLER_WON'
          ? `The dispute for order #${order.id} was resolved in your favour. Funds have been released.`
          : `The dispute for order #${order.id} has been resolved.`;

        await Promise.allSettled([
          sendNotification(
            order.buyerId,
            'Dispute Resolved',
            buyerMessage,
            'DISPUTE_RESOLVED',
            { orderId: order.id, disputeId, outcome }
          ),
          sendNotification(
            order.store.userId,
            'Dispute Resolved',
            sellerMessage,
            'DISPUTE_RESOLVED',
            { orderId: order.id, disputeId, outcome }
          ),
          sendEmailNotification({
            to: order.buyer.email,
            toName: order.buyer.firstName,
            subject: 'Dispute Resolved',
            template: 'generic',
            templateData: {
              title: 'Dispute Resolved',
              message: buyerMessage,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
            }
          }),
          sendEmailNotification({
            to: order.store.user.email,
            toName: order.store.user.firstName,
            subject: 'Dispute Resolved',
            template: 'generic',
            templateData: {
              title: 'Dispute Resolved',
              message: sellerMessage,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${order.id}`
            }
          })
        ]);
      } catch (_) {
        // Notification failure must not affect response
      }
    });

    await invalidateDisputeCaches(order.id, order.buyerId, order.store.userId);

    return res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully.'
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};


export const getDispute = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { disputeId } = req.params;

    if (!disputeId || typeof disputeId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid dispute ID.' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            payment: true,
            escrow: true,
            deliveryInfo: true,
            buyer: { select: { id: true, firstName: true, email: true } },
            store: {
              include: {
                user: { select: { id: true, firstName: true, email: true } }
              }
            }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    const authorized =
      dispute.buyerId === userId ||
      dispute.sellerId === userId ||
      userRole === 'ADMIN';

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Strip sensitive payment metadata from non-admins
    const sanitizedDispute = {
      ...dispute,
      order: {
        ...dispute.order,
        payment: userRole === 'ADMIN'
          ? dispute.order.payment
          : dispute.order.payment?.map(p => ({
              id: p.id,
              amount: p.amount,
              status: p.status,
              currency: p.currency,
              createdAt: p.createdAt
            }))
      }
    };

    return res.status(200).json({ success: true, data: sanitizedDispute });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};


export const getMyDisputes = async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ buyerId: userId }, { sellerId: userId }]
    };

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.dispute.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      data: disputes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};


export const cancelDispute = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { disputeId } = req.params;

    if (!disputeId || typeof disputeId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid dispute ID.' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: { escrow: true }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    if (dispute.buyerId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (dispute.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending disputes can be cancelled.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'CANCELLED' }
      });

      await tx.order.update({
        where: { id: dispute.orderId },
        data: { status: 'PROCESSING' }
      });
      if (dispute.order.escrow) {
        await tx.escrow.update({
          where: { id: dispute.order.escrow.id },
          data: { releaseStatus: 'HELD' }
        });
      }
    });

    await invalidateDisputeCaches(dispute.orderId, userId, dispute.sellerId);

    return res.status(200).json({
      success: true,
      message: 'Dispute cancelled successfully.'
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};