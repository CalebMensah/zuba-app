import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { processRefund } from '../utils/refundUtils.js';

// Helper function to sanitize error messages in production
const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', error);
    return 'Internal server error';
  }
  return error.message;
};

// Helper function to invalidate dispute-related caches
const invalidateDisputeCaches = async (orderId, buyerId, sellerId) => {
  const cacheKeys = [
    `order:${orderId}:user:${buyerId}`,
    `order:${orderId}:user:${sellerId}`,
    `user:${buyerId}:disputes`,
    `user:${sellerId}:disputes`
  ];

  await Promise.allSettled(cacheKeys.map(key => cache.del(key)));
};

export const requestRefund = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;
    const { reason, type = 'REFUND_REQUEST' } = req.body;

    // Find the order and its payment/escrow details
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
            email: true, 
            firstName: true 
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

    // Verify buyer authorization
    if (order.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to create a dispute for this order.'
      });
    }

    // Validate payment exists and is successful
    if (!order.payment || order.payment.status !== 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Refund not eligible: Payment was not successful.'
      });
    }

    // Check if escrow funds have already been released
    if (order.escrow && order.escrow.releaseStatus === 'RELEASED') {
      return res.status(400).json({
        success: false,
        message: 'Funds have already been released to the seller. Please contact support for assistance.'
      });
    }

    // Check if order is in a valid state for disputes
    const validOrderStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (!validOrderStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot create dispute for order in status: ${order.status}.`
      });
    }

    // Check if a dispute already exists for this order
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'RESOLVED'] }
      }
    });

    if (existingDispute) {
      return res.status(409).json({
        success: false,
        message: 'A dispute already exists for this order.',
        data: existingDispute
      });
    }

    // Create dispute in a transaction
    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        paymentId: order.paymentId,
        buyerId,
        sellerId: order.store.userId,
        type,
        description: reason,
        status: 'PENDING'
      }
    });

    // Send notifications (non-blocking)
    setImmediate(async () => {
      try {
        const storeName = order.store.name || 'Store';
        const sellerName = order.store.user.firstName || 'Seller';
        const buyerName = order.buyer.firstName || 'Buyer';

        await Promise.allSettled([
          sendNotification(
            order.store.userId,
            'Dispute Opened',
            `A ${type.toLowerCase().replace(/_/g, ' ')} has been filed for order #${orderId}.`,
            'DISPUTE_CREATED',
            { disputeId: dispute.id, orderId }
          ),
          sendEmailNotification({
            to: order.store.user.email,
            toName: sellerName,
            subject: 'Dispute Opened',
            template: 'generic',
            templateData: {
              title: 'Dispute Opened',
              message: `A dispute has been filed for order #${orderId}. Reason: ${reason}. Please respond within 48 hours.`,
              ctaText: 'View Dispute',
              ctaUrl: `${process.env.FRONTEND_URL}/disputes/${dispute.id}`
            }
          }),
          sendNotification(
            buyerId,
            'Dispute Submitted',
            `Your dispute for order #${orderId} has been submitted and is under review.`,
            'DISPUTE_CREATED',
            { disputeId: dispute.id, orderId }
          ),
          sendEmailNotification({
            to: order.buyer.email,
            toName: buyerName,
            subject: 'Dispute Submitted',
            template: 'generic',
            templateData: {
              title: 'Dispute Submitted',
              message: `Your dispute for order #${orderId} has been submitted and is under review. You will be notified of any updates.`,
              ctaText: 'View Dispute',
              ctaUrl: `${process.env.FRONTEND_URL}/disputes/${dispute.id}`
            }
          })
        ]);
      } catch (notificationError) {
        console.error('Error sending dispute notifications:', notificationError);
      }
    });

    // Invalidate caches
    await invalidateDisputeCaches(orderId, buyerId, order.store.userId);

    res.status(201).json({
      success: true,
      message: 'Dispute submitted successfully. Awaiting seller/admin response.',
      data: dispute
    });

  } catch (error) {
    console.error('Error requesting refund:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, resolution, refundAmount } = req.body;
    const adminId = req.user.userId;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            payment: true,
            escrow: true,
            buyer: { 
              select: { 
                id: true, 
                email: true, 
                firstName: true 
              } 
            },
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
            }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found.'
      });
    }

    // Validate dispute is still pending
    if (dispute.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Dispute has already been resolved or cancelled.'
      });
    }

    const order = dispute.order;
    const escrow = order.escrow;

    // If resolving in favor of the buyer, process refund
    if (status === 'RESOLVED') {
      // Validate refund amount doesn't exceed order total
      if (refundAmount && refundAmount > order.totalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount cannot exceed order total.'
        });
      }

      // Check if funds are still in escrow
      if (escrow && escrow.releaseStatus === 'PENDING') {
        const amountToRefund = refundAmount || order.totalAmount;

        // Process refund
        const refundResult = await processRefund({
          orderId: order.id,
          paymentId: order.paymentId,
          amount: amountToRefund,
          currency: order.currency,
          reason: resolution,
          gatewayRef: order.payment.gatewayRef
        });

        if (!refundResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to process refund. Please try again.',
            error: refundResult.error
          });
        }

        // Update Escrow status to REFUNDED in transaction
        await prisma.$transaction([
          prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'REFUNDED',
              releaseReason: `Dispute resolved - ${resolution}`,
              updatedAt: new Date()
            }
          }),
          prisma.dispute.update({
            where: { id: disputeId },
            data: {
              status: 'RESOLVED',
              resolution,
              resolvedAt: new Date(),
              resolvedBy: adminId
            }
          })
        ]);

      } else if (escrow && escrow.releaseStatus === 'RELEASED') {
        // Funds already released - requires manual intervention
        console.warn(`Dispute ${disputeId} resolved for order ${order.id}, but funds were already released. Manual action required.`);
        
        await prisma.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution: `${resolution} [NOTE: Funds already released - manual refund required]`,
            resolvedAt: new Date(),
            resolvedBy: adminId
          }
        });

        return res.status(200).json({
          success: true,
          message: 'Dispute marked as resolved. NOTE: Funds were already released to seller. Manual refund processing required.',
          data: { requiresManualRefund: true }
        });
      }
    } else {
      // Status is CANCELLED
      await prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'CANCELLED',
          resolution,
          resolvedAt: new Date(),
          resolvedBy: adminId
        }
      });
    }

    // Send notifications (non-blocking)
    setImmediate(async () => {
      try {
        const buyerName = order.buyer.firstName || 'Customer';
        const sellerName = order.store.user.firstName || 'Seller';

        await Promise.allSettled([
          sendNotification(
            dispute.buyerId,
            'Dispute Resolved',
            `Your dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
            'DISPUTE_RESOLVED',
            { disputeId, orderId: order.id }
          ),
          sendEmailNotification({
            to: order.buyer.email,
            toName: buyerName,
            subject: 'Dispute Resolved',
            template: 'generic',
            templateData: {
              title: 'Dispute Resolved',
              message: `Your dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
            }
          }),
          sendNotification(
            dispute.sellerId,
            'Dispute Resolved',
            `The dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
            'DISPUTE_RESOLVED',
            { disputeId, orderId: order.id }
          ),
          sendEmailNotification({
            to: order.store.user.email,
            toName: sellerName,
            subject: 'Dispute Resolved',
            template: 'generic',
            templateData: {
              title: 'Dispute Resolved',
              message: `The dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
            }
          })
        ]);
      } catch (notificationError) {
        console.error('Error sending dispute resolution notifications:', notificationError);
      }
    });

    // Invalidate caches
    await invalidateDisputeCaches(dispute.orderId, dispute.buyerId, dispute.sellerId);

    const updatedDispute = await prisma.dispute.findUnique({
      where: { id: disputeId }
    });

    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully.',
      data: updatedDispute
    });

  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                status: true,
                gatewayRef: true
              }
            },
            escrow: {
              select: {
                id: true,
                releaseStatus: true,
                releaseReason: true
              }
            },
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

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found.'
      });
    }

    // Check authorization (buyer, seller, or admin)
    const isAuthorized = 
      dispute.buyerId === userId || 
      dispute.sellerId === userId ||
      userRole === 'ADMIN';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this dispute.'
      });
    }

    res.status(200).json({
      success: true,
      data: dispute
    });

  } catch (error) {
    console.error('Error fetching dispute details:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getUserDisputes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      OR: [
        { buyerId: userId },
        { sellerId: userId }
      ]
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              currency: true,
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.dispute.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        disputes,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const getAllDisputes = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              currency: true,
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
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              gatewayRef: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.dispute.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        disputes,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching all disputes:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const updateDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.user.userId;
    const { additionalInfo } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
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
            }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found.'
      });
    }

    // Check authorization
    const isAuthorized = 
      dispute.buyerId === userId || 
      dispute.sellerId === userId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this dispute.'
      });
    }

    // Can't update resolved or cancelled disputes
    if (dispute.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a dispute that has been resolved or cancelled.'
      });
    }

    // Determine who is updating
    const updaterRole = userId === dispute.buyerId ? 'Buyer' : 'Seller';
    const timestamp = new Date().toISOString();

    // Update dispute with additional information
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        description: `${dispute.description}\n\n[UPDATE from ${updaterRole} at ${timestamp}]: ${additionalInfo}`,
        updatedAt: new Date()
      }
    });

    // Notify the other party (non-blocking)
    setImmediate(async () => {
      try {
        const notifyUserId = userId === dispute.buyerId ? dispute.sellerId : dispute.buyerId;
        const notifyUser = userId === dispute.buyerId ? dispute.order.store.user : dispute.order.buyer;

        await Promise.allSettled([
          sendNotification(
            notifyUserId,
            'Dispute Updated',
            `New information has been added to the dispute for order #${dispute.orderId}.`,
            'DISPUTE_UPDATED',
            { disputeId, orderId: dispute.orderId }
          ),
          sendEmailNotification({
            to: notifyUser.email,
            toName: notifyUser.firstName,
            subject: 'Dispute Updated',
            template: 'generic',
            templateData: {
              title: 'Dispute Updated',
              message: `New information has been added to the dispute for order #${dispute.orderId}. Please review and respond.`,
              ctaText: 'View Dispute',
              ctaUrl: `${process.env.FRONTEND_URL}/disputes/${disputeId}`
            }
          })
        ]);
      } catch (notificationError) {
        console.error('Error sending dispute update notifications:', notificationError);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Dispute updated successfully.',
      data: updatedDispute
    });

  } catch (error) {
    console.error('Error updating dispute:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};

export const cancelDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
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
            }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found.'
      });
    }

    // Check authorization - only buyer can cancel their own dispute
    if (dispute.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer who created the dispute can cancel it.'
      });
    }

    // Can't cancel already resolved or cancelled disputes
    if (dispute.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a dispute that has been resolved or already cancelled.'
      });
    }

    // Update dispute status
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'CANCELLED',
        resolution: reason || 'Cancelled by buyer',
        resolvedAt: new Date()
      }
    });

    // Notify the seller (non-blocking)
    setImmediate(async () => {
      try {
        await Promise.allSettled([
          sendNotification(
            dispute.sellerId,
            'Dispute Cancelled',
            `The dispute for order #${dispute.orderId} has been cancelled by the buyer.`,
            'DISPUTE_CANCELLED',
            { disputeId, orderId: dispute.orderId }
          ),
          sendEmailNotification({
            to: dispute.order.store.user.email,
            toName: dispute.order.store.user.firstName,
            subject: 'Dispute Cancelled',
            template: 'generic',
            templateData: {
              title: 'Dispute Cancelled',
              message: `The dispute for order #${dispute.orderId} has been cancelled by the buyer.`,
              ctaText: 'View Order',
              ctaUrl: `${process.env.FRONTEND_URL}/orders/${dispute.orderId}`
            }
          })
        ]);
      } catch (notificationError) {
        console.error('Error sending dispute cancellation notifications:', notificationError);
      }
    });

    // Invalidate caches
    await invalidateDisputeCaches(dispute.orderId, dispute.buyerId, dispute.sellerId);

    res.status(200).json({
      success: true,
      message: 'Dispute cancelled successfully.',
      data: updatedDispute
    });

  } catch (error) {
    console.error('Error cancelling dispute:', error);
    res.status(500).json({
      success: false,
      message: sanitizeError(error)
    });
  }
};