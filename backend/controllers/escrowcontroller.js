import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { transferFundsToSeller } from '../utils/transferUtils.js';

// Helper function to sanitize error messages in production
const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', error);
    return 'Internal server error';
  }
  return error.message;
};

// Helper function to invalidate escrow-related caches
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

export const processEscrowRelease = async () => {
  try {
    const now = new Date();

    // Find all escrows pending release where release date has passed
    const escrowsToRelease = await prisma.escrow.findMany({
      where: {
        releaseDate: { lte: now },
        releaseStatus: 'PENDING'
      },
      include: {
        payment: {
          include: {
            order: {
              include: {
                store: { 
                  include: { 
                    user: { 
                      select: { 
                        id: true, 
                        email: true, 
                        firstName: true 
                      } 
                    } 
                  } 
                },
                buyer: { 
                  select: { 
                    id: true, 
                    firstName: true 
                  } 
                }
              }
            }
          }
        }
      }
    });

    console.log(`[Escrow Release] Found ${escrowsToRelease.length} escrows pending release.`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const escrow of escrowsToRelease) {
      const order = escrow.payment.order;
      const seller = order.store.user;

      results.processed++;

      try {
        // Validate order status
        const validStatuses = ['DELIVERED', 'COMPLETED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
        if (!validStatuses.includes(order.status)) {
          console.warn(`[Escrow Release] Order ${order.id} has invalid status: ${order.status}. Skipping.`);
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: `Invalid order status: ${order.status}`,
              updatedAt: new Date()
            }
          });
          results.failed++;
          continue;
        }

        // Determine release type
        const isDelivered = ['DELIVERED', 'COMPLETED'].includes(order.status);
        const releaseReason = isDelivered ? 'buyer_confirmed' : 'auto_timer_expired';
        const releasedBy = isDelivered ? 'buyer_confirmation' : 'auto_timer';

        // Get seller payment account
        const sellerPaymentAccount = await prisma.paymentAccount.findUnique({
          where: { storeId: order.storeId }
        });

        if (!sellerPaymentAccount || !sellerPaymentAccount.paystackRecipientCode) {
          console.error(`[Escrow Release] No payment account for store ${order.storeId} (escrow ${escrow.id})`);
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: 'No seller payment account configured',
              updatedAt: new Date()
            }
          });
          results.failed++;
          results.errors.push({ escrowId: escrow.id, orderId: order.id, error: 'No payment account' });
          continue;
        }

        // Validate amounts
        const commission = order.commissionTotal || 0;
        const amountToTransfer = escrow.amountHeld - commission;

        if (amountToTransfer <= 0) {
          console.error(`[Escrow Release] Invalid amount: escrow=${escrow.amountHeld}, commission=${commission} for order ${order.id}`);
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: 'Invalid amount after commission deduction',
              updatedAt: new Date()
            }
          });
          results.failed++;
          results.errors.push({ escrowId: escrow.id, orderId: order.id, error: 'Invalid amount' });
          continue;
        }

        // Security: Verify escrow amount matches payment amount
        if (Math.abs(escrow.amountHeld - escrow.payment.amount) > 0.01) {
          console.error(`[Escrow Release] Amount mismatch: escrow=${escrow.amountHeld}, payment=${escrow.payment.amount} for order ${order.id}`);
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: 'Escrow/payment amount mismatch - manual review required',
              updatedAt: new Date()
            }
          });
          results.failed++;
          results.errors.push({ escrowId: escrow.id, orderId: order.id, error: 'Amount mismatch' });
          continue;
        }

        // Transfer funds to seller
        const transferResult = await transferFundsToSeller({
          amount: amountToTransfer,
          currency: escrow.currency,
          recipientCode: sellerPaymentAccount.paystackRecipientCode,
          orderId: order.id,
          reason: `Order #${order.id} Escrow Release - ${releaseReason}`
        });

        if (transferResult.success) {
          const nowDate = new Date();

          // Update escrow and order in transaction
          await prisma.$transaction([
            prisma.escrow.update({
              where: { id: escrow.id },
              data: {
                releasedAt: nowDate,
                releasedTo: releasedBy,
                releaseStatus: 'RELEASED',
                releaseReason,
                updatedAt: nowDate
              }
            }),
            // Only update to COMPLETED if currently DELIVERED
            ...(order.status === 'DELIVERED' ? [
              prisma.order.update({
                where: { id: order.id },
                data: { status: 'COMPLETED' }
              })
            ] : [])
          ]);

          // Send notifications (non-blocking)
          setImmediate(async () => {
            try {
              const sellerName = seller.firstName || 'Seller';
              await Promise.allSettled([
                sendNotification(
                  seller.id,
                  'Funds Released',
                  `Funds for order #${order.id} (${amountToTransfer} ${escrow.currency}) have been released to your account.`,
                  'ESCROW_RELEASED',
                  { orderId: order.id, amount: amountToTransfer }
                ),
                sendEmailNotification({
                  to: seller.email,
                  toName: sellerName,
                  subject: 'Funds Released',
                  template: 'generic',
                  templateData: {
                    title: 'Funds Released',
                    message: `Funds for order #${order.id} (${amountToTransfer} ${escrow.currency}) have been released to your account. Commission deducted: ${commission} ${escrow.currency}.`,
                    ctaText: 'View Order',
                    ctaUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
                  }
                })
              ]);
            } catch (notificationError) {
              console.error(`[Escrow Release] Notification error for order ${order.id}:`, notificationError);
            }
          });

          // Invalidate caches
          await invalidateEscrowCaches(order.id, order.buyerId, seller.id, order.storeId);

          results.succeeded++;
          console.log(`[Escrow Release] Successfully released escrow for order ${order.id} (${releaseReason})`);
        } else {
          console.error(`[Escrow Release] Transfer failed for escrow ${escrow.id} (order ${order.id}):`, transferResult.error);
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: `Transfer failed - ${transferResult.error}`,
              updatedAt: new Date()
            }
          });
          results.failed++;
          results.errors.push({ escrowId: escrow.id, orderId: order.id, error: transferResult.error });
        }

      } catch (escrowError) {
        console.error(`[Escrow Release] Error processing escrow ${escrow.id} for order ${order.id}:`, escrowError);
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releaseStatus: 'FAILED',
            releaseReason: `Internal error - ${escrowError.message}`,
            updatedAt: new Date()
          }
        });
        results.failed++;
        results.errors.push({ escrowId: escrow.id, orderId: order.id, error: escrowError.message });
      }
    }

    console.log(`[Escrow Release] Completed: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.processed} processed`);
    return results;

  } catch (error) {
    console.error('[Escrow Release] Fatal error in processEscrowRelease:', error);
    throw error;
  }
};

export const confirmOrderReceived = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;

    // Fetch order with all necessary relations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        escrow: true,
        store: { 
          include: { 
            user: { 
              select: { 
                id: true, 
                email: true, 
                firstName: true 
              } 
            } 
          } 
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

    // Validate order exists
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found.' 
      });
    }

    // Verify buyer authorization
    if (order.buyerId !== buyerId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to confirm this order.' 
      });
    }

    // Validate order status
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order must be in DELIVERED status to confirm receipt.' 
      });
    }

    // Validate escrow exists and is pending
    if (!order.escrow) {
      return res.status(404).json({ 
        success: false, 
        message: 'No escrow record found for this order.' 
      });
    }

    if (order.escrow.releaseStatus !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: `Escrow is not pending. Current status: ${order.escrow.releaseStatus}` 
      });
    }

    // Validate payment was successful
    if (!order.payment || order.payment.status !== 'SUCCESS') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment was not successful for this order.' 
      });
    }

    // Get seller payment account
    const sellerPaymentAccount = await prisma.paymentAccount.findUnique({ 
      where: { storeId: order.storeId } 
    });

    if (!sellerPaymentAccount || !sellerPaymentAccount.paystackRecipientCode) {
      return res.status(500).json({ 
        success: false, 
        message: 'Seller payment account is not configured. Please contact support.' 
      });
    }

    // Calculate transfer amount
    const commission = order.commissionTotal || 0;
    const amountToTransfer = order.escrow.amountHeld - commission;

    if (amountToTransfer <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount after commission deduction.' 
      });
    }

    // Security: Verify escrow amount matches payment amount
    if (Math.abs(order.escrow.amountHeld - order.payment.amount) > 0.01) {
      console.error(`Amount mismatch for order ${orderId}: escrow=${order.escrow.amountHeld}, payment=${order.payment.amount}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Escrow amount mismatch detected. Please contact support.' 
      });
    }

    // Transfer funds to seller
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
        message: 'Failed to transfer funds. Please try again later.', 
        error: process.env.NODE_ENV === 'production' ? undefined : transferResult.error 
      });
    }

    const nowDate = new Date();

    // Update order and escrow in transaction
    const [updatedOrder, updatedEscrow] = await prisma.$transaction([
      prisma.order.update({ 
        where: { id: orderId }, 
        data: { status: 'COMPLETED' } 
      }),
      prisma.escrow.update({
        where: { id: order.escrow.id },
        data: {
          releasedAt: nowDate,
          releasedTo: 'buyer_confirmation',
          releaseStatus: 'RELEASED',
          releaseReason: 'buyer_confirmed',
          updatedAt: nowDate
        }
      })
    ]);

    // Send notifications (non-blocking)
    setImmediate(async () => {
      try {
        const sellerName = order.store.user.firstName || 'Seller';
        await Promise.allSettled([
          sendNotification(
            order.store.userId,
            'Funds Released - Order Confirmed',
            `Funds for order #${order.id} (${amountToTransfer} ${order.escrow.currency}) have been released after buyer confirmation.`,
            'ESCROW_RELEASED',
            { orderId: order.id, amount: amountToTransfer }
          ),
          sendEmailNotification({
            to: order.store.user.email,
            toName: sellerName,
            subject: 'Funds Released - Order Confirmed',
            template: 'generic',
            templateData: {
              title: 'Funds Released',
              message: `Funds for order #${order.id} (${amountToTransfer} ${order.escrow.currency}) have been released to your account after buyer confirmation. Commission deducted: ${commission} ${order.escrow.currency}.`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
            }
          })
        ]);
      } catch (notificationError) {
        console.error('Error sending escrow release notifications:', notificationError);
      }
    });

    // Invalidate caches
    await invalidateEscrowCaches(orderId, buyerId, order.store.userId, order.storeId);

    res.status(200).json({
      success: true,
      message: 'Order confirmed and funds released to seller.',
      data: { 
        order: updatedOrder, 
        escrow: updatedEscrow, 
        transfer: { 
          code: transferResult.transferCode, 
          reference: transferResult.transferReference,
          amount: amountToTransfer,
          currency: order.escrow.currency
        } 
      }
    });

  } catch (error) {
    console.error('Error confirming order received:', error);
    res.status(500).json({ 
      success: false, 
      message: sanitizeError(error)
    });
  }
};

export const getEscrowDetails = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user.userId;

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            gatewayRef: true
          }
        },
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
              select: {
                id: true,
                name: true,
                user: { 
                  select: { 
                    id: true, 
                    firstName: true, 
                    email: true 
                  } 
                } 
              }
            }
          }
        }
      }
    });

    if (!escrow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Escrow record not found.' 
      });
    }

    // Check authorization
    const isBuyer = escrow.order.buyerId === userId;
    const isSeller = escrow.order.store.user.id === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to view this escrow record.' 
      });
    }

    // Prepare response data (hide sensitive info from buyers)
    const commission = escrow.order.commissionTotal || 0;
    const responseData = {
      id: escrow.id,
      currency: escrow.currency,
      releaseStatus: escrow.releaseStatus,
      releaseReason: escrow.releaseReason,
      releasedAt: escrow.releasedAt,
      releaseDate: escrow.releaseDate,
      orderId: escrow.orderId,
      totalHeld: escrow.amountHeld,
      // Only show breakdown to seller
      ...(isSeller && {
        amountToSeller: escrow.amountHeld - commission,
        commission: commission
      })
    };

    res.status(200).json({ 
      success: true, 
      data: responseData 
    });

  } catch (error) {
    console.error('Error fetching escrow details:', error);
    res.status(500).json({ 
      success: false, 
      message: sanitizeError(error)
    });
  }
};

export const getOrderEscrowStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        escrow: true, 
        buyer: { select: { id: true } }, 
        store: { select: { userId: true } } 
      }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found.' 
      });
    }

    // Check authorization
    const isBuyer = order.buyerId === userId;
    const isSeller = order.store.userId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to view this order escrow status.' 
      });
    }

    if (!order.escrow) {
      return res.status(404).json({ 
        success: false, 
        message: 'No escrow record found for this order.' 
      });
    }

    const commission = order.commissionTotal || 0;
    const responseData = {
      escrow: {
        id: order.escrow.id,
        currency: order.escrow.currency,
        releaseStatus: order.escrow.releaseStatus,
        releaseReason: order.escrow.releaseReason,
        releasedAt: order.escrow.releasedAt,
        releaseDate: order.escrow.releaseDate,
        totalHeld: order.escrow.amountHeld,
        // Only show breakdown to seller
        ...(isSeller && {
          amountToSeller: order.escrow.amountHeld - commission,
          commission: commission
        })
      },
      canConfirmReceipt: isBuyer && order.status === 'DELIVERED' && order.escrow.releaseStatus === 'PENDING'
    };

    res.status(200).json({ 
      success: true, 
      data: responseData 
    });

  } catch (error) {
    console.error('Error fetching order escrow status:', error);
    res.status(500).json({ 
      success: false, 
      message: sanitizeError(error)
    });
  }
};

export const getPendingEscrows = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where: {
          releaseStatus: 'PENDING'
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              buyerId: true,
              storeId: true,
              commissionTotal: true,
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
                  name: true 
                } 
              }
            }
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true
            }
          }
        },
        orderBy: { releaseDate: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.escrow.count({ where: { releaseStatus: 'PENDING' } })
    ]);

    res.status(200).json({
      success: true,
      data: escrows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching pending escrows:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};