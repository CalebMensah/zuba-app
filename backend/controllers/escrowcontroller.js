import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { transferFundsToSeller } from '../utils/transferUtils.js';
import { PLATFORM_FEE_PERCENT } from '../utils/fees.js';

const AMOUNT_TOLERANCE = 0.10;

const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    return 'Internal server error';
  }
  return error.message;
};

const invalidateEscrowCaches = async (orderId, buyerId, sellerId, storeId) => {
  const cacheKeys = [
    `order:${orderId}:user:${buyerId}`,
    `order:${orderId}:user:${sellerId}`,
    `user:${buyerId}:orders`,
    `store:${storeId}:orders`,
    `store:${storeId}:balance`,
    `escrow:${orderId}`
  ];
  await Promise.allSettled(cacheKeys.map(key => cache.del(key)));
};

const validateEscrowIntegrity = (escrowAmountHeld, paymentAmount) => {
  const expectedEscrow = parseFloat((paymentAmount * (1 - PLATFORM_FEE_PERCENT)).toFixed(2));
  return Math.abs(escrowAmountHeld - expectedEscrow) <= AMOUNT_TOLERANCE;
};

export const processEscrowRelease = async () => {
  const now = new Date();

  const escrowsToRelease = await prisma.escrow.findMany({
    where: {
      releaseDate: { lte: now },
      releaseStatus: 'HELD'
    },
    include: {
      payment: {
        include: {
          order: {
            include: {
              store: {
                include: {
                  user: { select: { id: true, email: true, firstName: true } }
                }
              },
              buyer: { select: { id: true, firstName: true } },
              deliveryInfo: {
                include: { deliveryProofs: true }
              }
            }
          }
        }
      }
    }
  });

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  };

  for (const escrow of escrowsToRelease) {
    const order = escrow.payment.order;

    results.processed++;

    try {
      // Block if active dispute exists
      const activeDispute = await prisma.dispute.findFirst({
        where: { orderId: order.id, status: 'PENDING' }
      });

      if (activeDispute) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { releaseStatus: 'DISPUTED', releaseReason: 'Active dispute exists' }
        });
        results.failed++;
        continue;
      }

      // Delivery record must exist
      if (!order.deliveryInfo) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { releaseStatus: 'FAILED', releaseReason: 'Missing delivery record' }
        });
        results.failed++;
        continue;
      }

      // At least one delivery proof required unless order is already COMPLETED
      const hasDeliveryProof = order.deliveryInfo.deliveryProofs?.length > 0;
      if (!hasDeliveryProof && !['DELIVERED', 'COMPLETED'].includes(order.status)) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { releaseStatus: 'FAILED', releaseReason: 'No delivery proof for auto release' }
        });
        results.failed++;
        continue;
      }

      // Order must be in a valid state for release
      const validStatuses = ['DELIVERED', 'COMPLETED', 'SHIPPED'];
      if (!validStatuses.includes(order.status)) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releaseStatus: 'FAILED',
            releaseReason: `Invalid order status for release: ${order.status}`
          }
        });
        results.failed++;
        continue;
      }

      // Seller payment account required
      const sellerPaymentAccount = await prisma.paymentAccount.findUnique({
        where: { storeId: order.storeId }
      });

      if (!sellerPaymentAccount?.paystackRecipientCode) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { releaseStatus: 'FAILED', releaseReason: 'No seller payment account configured' }
        });
        results.failed++;
        continue;
      }

        const expectedEscrow = parseFloat((order.totalAmount * (1 - PLATFORM_FEE_PERCENT)).toFixed(2));
        if (Math.abs(escrow.amountHeld - expectedEscrow) > AMOUNT_TOLERANCE) {
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: { releaseStatus: 'FAILED', releaseReason: 'Escrow integrity check failed' }
          });
          results.failed++;
          continue;
        }

      const amountToTransfer = escrow.amountHeld;

      if (amountToTransfer <= 0) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { releaseStatus: 'FAILED', releaseReason: 'Invalid transfer amount' }
        });
        results.failed++;
        continue;
      }

      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(order.status);
      const releaseReason = isDelivered ? 'buyer_confirmed' : 'auto_timer_expired';
      const releasedBy = isDelivered ? 'buyer_confirmation' : 'auto_timer';

      const transferResult = await transferFundsToSeller({
        amount: amountToTransfer,
        currency: escrow.currency,
        recipientCode: sellerPaymentAccount.paystackRecipientCode,
        orderId: order.id,
        reason: `Order #${order.id} Escrow Release - ${releaseReason}`
      });

      if (!transferResult.success) {
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releaseStatus: 'FAILED',
            releaseReason: `Transfer failed: ${transferResult.error}`
          }
        });
        results.failed++;
        continue;
      }

      const releaseNow = new Date();

      await prisma.$transaction([
        prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releasedAt: releaseNow,
            releasedTo: releasedBy,
            releaseStatus: 'RELEASED',
            releaseReason,
            updatedAt: releaseNow
          }
        }),
        prisma.deliveryInfo.update({
          where: { orderId: order.id },
          data: {
            status: 'DELIVERED',
            deliveredAt: releaseNow,
            autoReleasedAt: releaseNow
          }
        }),
        ...(order.status === 'DELIVERED'
          ? [prisma.order.update({
              where: { id: order.id },
              data: { status: 'COMPLETED' }
            })]
          : [])
      ]);

      results.succeeded++;

      // Notify seller (non-blocking, non-critical)
      setImmediate(async () => {
        try {
          await Promise.allSettled([
            sendNotification(
              order.store.user.id,
              'Funds Released',
              `Funds for order #${order.id} have been released to your account.`,
              'ESCROW_RELEASED',
              { orderId: order.id, amount: amountToTransfer }
            ),
            sendEmailNotification({
              to: order.store.user.email,
              toName: order.store.user.firstName,
              subject: 'Funds Released',
              template: 'generic',
              sender: 'escrow',
              templateData: {
                title: 'Funds Released',
                message: `GHS ${amountToTransfer.toFixed(2)} for order #${order.id} has been released to your account.`,
                ctaText: 'View Payouts',
                ctaUrl: `${process.env.FRONTEND_URL}/seller/payouts`
              }
            })
          ]);
        } catch (_) {
          // Notification failure must not affect release result
        }
      });

    } catch (err) {
      await prisma.escrow.update({
        where: { id: escrow.id },
        data: {
          releaseStatus: 'FAILED',
          releaseReason: 'Internal processing error'
        }
      });
      results.failed++;
      results.errors.push({
        escrowId: escrow.id,
        orderId: order.id,
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message
      });
    }
  }

  return results;
};

export const confirmOrderReceived = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        escrow: true,
        deliveryInfo: {
          include: { deliveryProofs: true }
        },
        store: {
          include: {
            user: { select: { id: true, email: true, firstName: true } }
          }
        },
        buyer: { select: { id: true, firstName: true, email: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized action.' });
    }

    // Block if active dispute
    const activeDispute = await prisma.dispute.findFirst({
      where: { orderId: order.id, status: 'PENDING' }
    });

    if (activeDispute) {
      return res.status(409).json({
        success: false,
        message: 'Order has an active dispute. Confirmation is blocked.'
      });
    }

    if (!order.escrow) {
      return res.status(404).json({ success: false, message: 'No escrow record found for this order.' });
    }

    if (order.escrow.releaseStatus !== 'HELD') {
      return res.status(400).json({
        success: false,
        message: 'Escrow is not in a releasable state.'
      });
    }

    if (order.escrow.releasedAt) {
      return res.status(409).json({ success: false, message: 'Escrow already released.' });
    }

    const successfulPayment = order.payment?.find(p => p.status === 'SUCCESS');
    if (!successfulPayment) {
      return res.status(400).json({ success: false, message: 'No successful payment found for this order.' });
    }
      const expectedEscrow = parseFloat((order.totalAmount * (1 - PLATFORM_FEE_PERCENT)).toFixed(2));
      if (Math.abs(order.escrow.amountHeld - expectedEscrow) > AMOUNT_TOLERANCE) {
        return res.status(500).json({ success: false, message: 'Escrow integrity check failed.' });
      }

      const sellerPaymentAccount = await prisma.paymentAccount.findUnique({
        where: { storeId: order.storeId }
      });

    if (!sellerPaymentAccount?.paystackRecipientCode) {
      return res.status(500).json({
        success: false,
        message: 'Seller payment account not configured.'
      });
    }

    const amountToTransfer = order.escrow.amountHeld;

    if (amountToTransfer <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount.' });
    }

    const transferResult = await transferFundsToSeller({
      amount: amountToTransfer,
      currency: order.escrow.currency,
      recipientCode: sellerPaymentAccount.paystackRecipientCode,
      orderId: order.id,
      reason: `Order #${order.id} Confirmed by Buyer`
    });

    if (!transferResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Transfer failed. Please try again.',
        error: process.env.NODE_ENV === 'production' ? undefined : transferResult.error
      });
    }

    const now = new Date();

    const [updatedOrder, updatedEscrow] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      }),
      prisma.escrow.update({
        where: { id: order.escrow.id },
        data: {
          releasedAt: now,
          releasedTo: 'buyer_confirmation',
          releaseStatus: 'RELEASED',
          releaseReason: 'buyer_confirmed',
          updatedAt: now
        }
      }),
      prisma.deliveryInfo.update({
        where: { orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
          buyerConfirmedAt: now
        }
      })
    ]);

    setImmediate(async () => {
      try {
        await Promise.allSettled([
          sendNotification(
            order.store.user.id,
            'Funds Released',
            `Funds for order #${order.id} have been released to your account.`,
            'ESCROW_RELEASED',
            { orderId: order.id, amount: amountToTransfer }
          ),
          sendEmailNotification({
            to: order.store.user.email,
            toName: order.store.user.firstName,
            subject: 'Funds Released',
            template: 'generic',
            sender: 'escrow',
            templateData: {
              title: 'Funds Released',
              message: `GHS ${amountToTransfer.toFixed(2)} for order #${order.id} has been released to your account.`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${order.id}`
            }
          }),
          sendNotification(
            buyerId,
            'Order Completed',
            `Your order #${order.id} has been marked as completed.`,
            'order_confirmed',
            { orderId: order.id }
          )
        ]);
      } catch (_) {
      }
    });

    await invalidateEscrowCaches(orderId, buyerId, order.store.user.id, order.storeId);

    return res.status(200).json({
      success: true,
      message: 'Order confirmed and funds released.',
      data: {
        order: updatedOrder,
        escrow: updatedEscrow,
        transfer: {
          reference: transferResult.transferReference,
          amount: amountToTransfer,
          currency: order.escrow.currency
        }
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};

export const getEscrowDetails = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user.userId;

    if (!escrowId || typeof escrowId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid escrow ID.' });
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        payment: {
          select: { id: true, amount: true, status: true, gatewayRef: true }
        },
        order: {
          include: {
            buyer: { select: { id: true, firstName: true, email: true } },
            store: {
              select: {
                id: true,
                name: true,
                user: { select: { id: true, firstName: true, email: true } }
              }
            }
          }
        }
      }
    });

    if (!escrow) {
      return res.status(404).json({ success: false, message: 'Escrow record not found.' });
    }

    const isBuyer = escrow.order.buyerId === userId;
    const isSeller = escrow.order.store.user.id === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this escrow record.' });
    }

    const commission = escrow.order.commissionTotal || 0;

    return res.status(200).json({
      success: true,
      data: {
        id: escrow.id,
        currency: escrow.currency,
        releaseStatus: escrow.releaseStatus,
        releaseReason: escrow.releaseReason,
        releasedAt: escrow.releasedAt,
        releaseDate: escrow.releaseDate,
        orderId: escrow.orderId,
        totalHeld: escrow.amountHeld,
        ...(isSeller && {
          amountToSeller: escrow.amountHeld,
          commission
        })
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};

export const getOrderEscrowStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        escrow: true,
        buyer: { select: { id: true } },
        store: { select: { userId: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const isBuyer = order.buyerId === userId;
    const isSeller = order.store.userId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this order escrow status.' });
    }

    if (!order.escrow) {
      return res.status(404).json({ success: false, message: 'No escrow record found for this order.' });
    }

    const commission = order.commissionTotal || 0;

    return res.status(200).json({
      success: true,
      data: {
        escrow: {
          id: order.escrow.id,
          currency: order.escrow.currency,
          releaseStatus: order.escrow.releaseStatus,
          releaseReason: order.escrow.releaseReason,
          releasedAt: order.escrow.releasedAt,
          releaseDate: order.escrow.releaseDate,
          totalHeld: order.escrow.amountHeld,
          ...(isSeller && {
            amountToSeller: order.escrow.amountHeld,
            commission
          })
        },
        canConfirmReceipt:
          isBuyer &&
          ['SHIPPED', 'DELIVERED'].includes(order.status) &&
          order.escrow.releaseStatus === 'HELD'
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: sanitizeError(error) });
  }
};

// ── GET /escrow/pending (admin only)

export const getPendingEscrows = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Admin guard
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where: { releaseStatus: 'HELD' },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              buyerId: true,
              storeId: true,
              commissionTotal: true,
              buyer: { select: { id: true, firstName: true, email: true } },
              store: { select: { id: true, name: true } }
            }
          },
          payment: {
            select: { id: true, amount: true, currency: true, status: true }
          }
        },
        orderBy: { releaseDate: 'asc' },
        skip,
        take: limit
      }),
      prisma.escrow.count({ where: { releaseStatus: 'HELD' } })
    ]);

    return res.status(200).json({
      success: true,
      data: escrows,
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