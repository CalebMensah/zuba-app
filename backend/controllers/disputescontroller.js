// controllers/disputeController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { processRefund } from '../utils/refundUtils.js';


export const requestRefund = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;
    const { reason, type = 'REFUND_REQUEST' } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Refund reason is required.'
      });
    }

    // Validate dispute type
    const validTypes = [
      'REFUND_REQUEST',
      'ITEM_NOT_AS_DESCRIBED',
      'ITEM_NOT_RECEIVED',
      'WRONG_ITEM_SENT',
      'DAMAGED_ITEM',
      'OTHER'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dispute type.'
      });
    }

    // Find the order and its payment/escrow details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        escrow: true,
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

    if (order.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to create a dispute for this order.'
      });
    }

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

    // Check if a dispute already exists for this order
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'RESOLVED'] }
      }
    });

    if (existingDispute) {
      return res.status(400).json({
        success: false,
        message: 'A dispute already exists for this order.',
        data: existingDispute
      });
    }

    // Create a Dispute
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

    // Send notification to seller
    await sendNotification(
      order.store.userId,
      'Dispute Opened',
      `A ${type.toLowerCase().replace(/_/g, ' ')} has been filed for order #${order.id}.`,
      'dispute',
      { disputeId: dispute.id, orderId }
    );

    await sendEmailNotification({
      to: order.store.user.email,
      toName: order.store.user.name,
      subject: 'Dispute Opened',
      template: 'generic',
      templateData: {
        title: 'Dispute Opened',
        message: `A dispute has been filed for order #${order.id}. Reason: ${reason}. Please respond within 48 hours.`
      }
    });

    // Send confirmation to buyer
    await sendNotification(
      buyerId,
      'Dispute Submitted',
      `Your dispute for order #${order.id} has been submitted and is under review.`,
      'dispute',
      { disputeId: dispute.id, orderId }
    );

    // Invalidate caches
    await cache.del(`order:${orderId}:user:${buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);

    res.status(201).json({
      success: true,
      message: 'Dispute submitted successfully. Awaiting seller/admin response.',
      data: dispute
    });

  } catch (error) {
    console.error('Error requesting refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit dispute',
      error: error.message
    });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, resolution, refundAmount } = req.body;
    const adminId = req.user.userId;

    if (!['RESOLVED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'RESOLVED' or 'CANCELLED'."
      });
    }

    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: 'Resolution details are required.'
      });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            payment: true,
            escrow: true,
            buyer: true,
            store: { include: { user: true } }
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

        // Update Escrow status to REFUNDED
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releaseStatus: 'REFUNDED',
            releaseReason: `Dispute resolved - ${resolution}`,
            updatedAt: new Date()
          }
        });

      } else if (escrow && escrow.releaseStatus === 'RELEASED') {
        // Funds already released - requires manual intervention
        console.warn(`Dispute ${disputeId} resolved for order ${order.id}, but funds were already released. Manual action required.`);
        
        // Still mark dispute as resolved but flag for admin review
        await prisma.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution: `${resolution} [NOTE: Funds already released - manual refund required]`,
            resolvedAt: new Date()
          }
        });

        return res.status(200).json({
          success: true,
          message: 'Dispute marked as resolved. NOTE: Funds were already released to seller. Manual refund processing required.',
          data: { requiresManualRefund: true }
        });
      }
    }

    // Update dispute status
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        resolvedAt: new Date()
      }
    });

    // Send notifications to buyer and seller
    await sendNotification(
      dispute.buyerId,
      'Dispute Resolved',
      `Your dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
      'dispute',
      { disputeId, orderId: order.id }
    );

    await sendEmailNotification({
      to: order.buyer.email,
      toName: order.buyer.name,
      subject: 'Dispute Resolved',
      template: 'generic',
      templateData: {
        title: 'Dispute Resolved',
        message: `Your dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`
      }
    });

    await sendNotification(
      dispute.sellerId,
      'Dispute Resolved',
      `The dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`,
      'dispute',
      { disputeId, orderId: order.id }
    );

    await sendEmailNotification({
      to: order.store.user.email,
      toName: order.store.user.name,
      subject: 'Dispute Resolved',
      template: 'generic',
      templateData: {
        title: 'Dispute Resolved',
        message: `The dispute for order #${dispute.orderId} has been ${status.toLowerCase()}. Resolution: ${resolution}`
      }
    });

    // Invalidate caches
    await cache.del(`order:${dispute.orderId}:user:${dispute.buyerId}`);
    await cache.del(`order:${dispute.orderId}:user:${dispute.sellerId}`);

    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully.',
      data: updatedDispute
    });

  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve dispute',
      error: error.message
    });
  }
};

export const getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.user.userId;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            payment: true,
            escrow: true,
            buyer: { select: { id: true, name: true, email: true } },
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
      return res.status(404).json({
        success: false,
        message: 'Dispute not found.'
      });
    }

    // Check authorization (buyer, seller, or admin)
    const isAuthorized = 
      dispute.buyerId === userId || 
      dispute.sellerId === userId;

    if (!isAuthorized && req.user.role !== 'admin') {
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
      message: 'Failed to fetch dispute details',
      error: error.message
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
              buyer: { select: { firstName: true } },
              store: { select: { name: true } }
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
      message: 'Failed to fetch disputes',
      error: error.message
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
              buyer: { select: { id: true, firstName: true, email: true } },
              store: { 
                select: { 
                  id: true,
                  name: true,
                  user: { select: { id: true, firstName: true, email: true } }
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
      message: 'Failed to fetch disputes',
      error: error.message
    });
  }
};

export const updateDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.user.userId;
    const { additionalInfo } = req.body;

    if (!additionalInfo) {
      return res.status(400).json({
        success: false,
        message: 'Additional information is required.'
      });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            buyer: true,
            store: { include: { user: true } }
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

    if (dispute.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a dispute that has been resolved or cancelled.'
      });
    }

    // Update dispute with additional information
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        description: `${dispute.description}\n\n[UPDATE from ${userId === dispute.buyerId ? 'Buyer' : 'Seller'}]: ${additionalInfo}`,
        updatedAt: new Date()
      }
    });

    // Notify the other party
    const notifyUserId = userId === dispute.buyerId ? dispute.sellerId : dispute.buyerId;
    const notifyUser = userId === dispute.buyerId ? dispute.order.store.user : dispute.order.buyer;

    await sendNotification(
      notifyUserId,
      'Dispute Updated',
      `New information has been added to the dispute for order #${dispute.orderId}.`,
      'dispute',
      { disputeId, orderId: dispute.orderId }
    );

    await sendEmailNotification({
      to: notifyUser.email,
      toName: notifyUser.name,
      subject: 'Dispute Updated',
      template: 'generic',
      templateData: {
        title: 'Dispute Updated',
        message: `New information has been added to the dispute for order #${dispute.orderId}. Please review and respond.`
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
      message: 'Failed to update dispute',
      error: error.message
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
            buyer: true,
            store: { include: { user: true } }
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
        message: 'Unauthorized to cancel this dispute.'
      });
    }

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
        resolution: reason || `Cancelled by ${userId === dispute.buyerId ? 'buyer' : 'seller'}`,
        resolvedAt: new Date()
      }
    });

    // Notify the other party
    const notifyUserId = userId === dispute.buyerId ? dispute.sellerId : dispute.buyerId;
    const notifyUser = userId === dispute.buyerId ? dispute.order.store.user : dispute.order.buyer;

    await sendNotification(
      notifyUserId,
      'Dispute Cancelled',
      `The dispute for order #${dispute.orderId} has been cancelled.`,
      'dispute',
      { disputeId, orderId: dispute.orderId }
    );

    await sendEmailNotification({
      to: notifyUser.email,
      toName: notifyUser.name,
      subject: 'Dispute Cancelled',
      template: 'generic',
      templateData: {
        title: 'Dispute Cancelled',
        message: `The dispute for order #${dispute.orderId} has been cancelled.`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Dispute cancelled successfully.',
      data: updatedDispute
    });

  } catch (error) {
    console.error('Error cancelling dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel dispute',
      error: error.message
    });
  }
};