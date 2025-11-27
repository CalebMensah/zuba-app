// controllers/escrowController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import { transferFundsToSeller } from '../utils/transferUtils.js';


export const processEscrowRelease = async () => {
  try {
    const now = new Date();

    // Find escrows where the release date has passed and status is still PENDING
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
                    user: true
                  }
                },
                buyer: true
              }
            }
          }
        }
      }
    });

    console.log(`Found ${escrowsToRelease.length} escrows to process for release.`);

    for (const escrow of escrowsToRelease) {
      const order = escrow.payment.order;
      const seller = order.store.user;

      try {
        // Check if the order status is DELIVERED or COMPLETED
        const isDelivered = ['DELIVERED', 'COMPLETED'].includes(order.status);
        const releaseReason = isDelivered ? 'buyer_confirmed' : 'auto_timer_expired';
        const releasedBy = isDelivered ? 'buyer_confirmation' : 'auto_timer';

        // Get seller's payment account details
        const sellerPaymentAccount = await prisma.paymentAccount.findUnique({
          where: { storeId: order.storeId }
        });

        if (!sellerPaymentAccount) {
          console.error(`No payment account found for store ${order.storeId} during escrow release for order ${order.id}.`);
          
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: 'No seller payment account found',
              updatedAt: new Date()
            }
          });
          continue;
        }

        // Initiate fund transfer to seller
        const transferResult = await transferFundsToSeller({
          amount: escrow.amountHeld,
          currency: escrow.currency,
          recipientCode: sellerPaymentAccount.paystackRecipientCode,
          orderId: order.id,
          reason: `Order #${order.id} Escrow Release - ${releaseReason}`
        });

        if (transferResult.success) {
          // Update escrow status to RELEASED
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releasedAt: new Date(),
              releasedTo: releasedBy,
              releaseStatus: 'RELEASED',
              releaseReason,
              updatedAt: new Date()
            }
          });

          // Update order status if necessary
          if (order.status === 'DELIVERED') {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'COMPLETED' }
            });
          }

          // Send notification to seller
          await sendNotification(
            seller.id,
            'Funds Released',
            `Funds for order #${order.id} have been released to your account.`,
            'payment_update',
            { orderId: order.id }
          );

          await sendEmailNotification({
            to: seller.email,
            toName: seller.name,
            subject: 'Funds Released',
            template: 'generic',
            templateData: {
              title: 'Funds Released',
              message: `Funds for order #${order.id} (${escrow.amountHeld} ${escrow.currency}) have been released to your account.`
            }
          });

          // Invalidate caches
          await cache.del(`order:${order.id}:user:${order.buyerId}`);
          await cache.del(`order:${order.id}:user:${seller.id}`);

          console.log(`Escrow released for order ${order.id} (Reason: ${releaseReason}).`);
        } else {
          // Handle transfer failure
          console.error(`Failed to transfer funds for escrow ${escrow.id} (order ${order.id}).`);
          
          await prisma.escrow.update({
            where: { id: escrow.id },
            data: {
              releaseStatus: 'FAILED',
              releaseReason: `Transfer failed - ${transferResult.error}`,
              updatedAt: new Date()
            }
          });

          // Notify admin about the failure
          // TODO: Implement admin notification system
        }

      } catch (transferError) {
        console.error(`Error releasing escrow for order ${order.id} (escrow ${escrow.id}):`, transferError);
        
        await prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releaseStatus: 'FAILED',
            releaseReason: `Internal error during release - ${transferError.message}`,
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`Processed ${escrowsToRelease.length} escrows for potential release.`);
    return { processed: escrowsToRelease.length };

  } catch (error) {
    console.error('Error in processEscrowRelease background job:', error);
    throw error;
  }
};

export const confirmOrderReceived = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { orderId } = req.params;

    // Find the order, ensure it belongs to the buyer, and check status
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
        message: 'Unauthorized to confirm this order.'
      });
    }

    if (order.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Order must be marked as DELIVERED before you can confirm receipt.'
      });
    }

    if (!order.escrow || order.escrow.releaseStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Escrow release is not pending for this order.'
      });
    }

    // ===== DEBUG: Log order and escrow data =====
    console.log('=== DEBUG: Order Confirmation Data ===');
    console.log('Order ID:', order.id);
    console.log('Store ID:', order.storeId);
    console.log('Escrow:', {
      id: order.escrow?.id,
      amountHeld: order.escrow?.amountHeld,
      currency: order.escrow?.currency,
      releaseStatus: order.escrow?.releaseStatus
    });

    // Get seller's payment account
    const sellerPaymentAccount = await prisma.paymentAccount.findUnique({
      where: { storeId: order.storeId }
    });

    console.log('Seller Payment Account:', {
      exists: !!sellerPaymentAccount,
      storeId: sellerPaymentAccount?.storeId,
      paystackRecipientCode: sellerPaymentAccount?.paystackRecipientCode,
      accountNumber: sellerPaymentAccount?.accountNumber
    });
    console.log('=== END DEBUG ===');
    // ===== END DEBUG =====

    if (!sellerPaymentAccount) {
      console.error(`No payment account found for store ${order.storeId} during buyer confirmation for order ${order.id}.`);
      
      return res.status(500).json({
        success: false,
        message: 'Seller payment account not found. Please contact support.'
      });
    }

    // ===== VALIDATE ALL REQUIRED FIELDS BEFORE TRANSFER =====
    const validationErrors = [];

    if (!order.escrow.amountHeld || order.escrow.amountHeld <= 0) {
      validationErrors.push('Invalid escrow amount');
    }

    if (!sellerPaymentAccount.paystackRecipientCode) {
      validationErrors.push('Seller has not completed bank account setup (missing recipient code)');
    }

    if (!order.id) {
      validationErrors.push('Order ID is missing');
    }

    if (validationErrors.length > 0) {
      console.error(`Validation failed for order ${orderId}:`, validationErrors);
      
      return res.status(400).json({
        success: false,
        message: 'Cannot process transfer due to missing required information',
        errors: validationErrors
      });
    }
    // ===== END VALIDATION =====

    // Initiate fund transfer to seller
    const transferResult = await transferFundsToSeller({
      amount: order.escrow.amountHeld,
      currency: order.escrow.currency,
      recipientCode: sellerPaymentAccount.paystackRecipientCode,
      orderId: order.id,
      reason: `Order #${order.id} Confirmed by Buyer`
    });

    if (!transferResult.success) {
      console.error(`Failed to transfer funds after buyer confirmation for order ${order.id}.`);
      console.error('Transfer error details:', transferResult.error, transferResult.details);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process fund transfer. Please contact support.',
        error: transferResult.error
      });
    }

    // Update order status to COMPLETED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' }
    });

    // Update escrow status to RELEASED
    const now = new Date();
    const updatedEscrow = await prisma.escrow.update({
      where: { id: order.escrow.id },
      data: {
        releasedAt: now,
        releasedTo: 'buyer_confirmation',
        releaseStatus: 'RELEASED',
        releaseReason: 'buyer_confirmed',
        updatedAt: now
      }
    });

    // Send notification to seller
    await sendNotification(
      order.store.userId,
      'Funds Released - Order Confirmed',
      `Funds for order #${order.id} have been released after buyer confirmation.`,
      'payment_update',
      { orderId: order.id }
    );

    await sendEmailNotification({
      to: order.store.user.email,
      toName: order.store.user.name,
      subject: 'Funds Released - Order Confirmed',
      template: 'generic',
      templateData: {
        title: 'Funds Released',
        message: `Funds for order #${order.id} (${updatedEscrow.amountHeld} ${updatedEscrow.currency}) have been released to your account after buyer confirmation.`
      }
    });

    // Invalidate caches
    await cache.del(`order:${orderId}:user:${buyerId}`);
    await cache.del(`order:${orderId}:user:${order.store.userId}`);
    await cache.del(`user:${buyerId}:orders`);
    await cache.del(`store:${order.storeId}:orders`);

    res.status(200).json({
      success: true,
      message: 'Order confirmed. Funds have been released to the seller.',
      data: {
        order: updatedOrder,
        escrow: updatedEscrow,
        transfer: {
          code: transferResult.transferCode,
          reference: transferResult.transferReference
        }
      }
    });

  } catch (error) {
    console.error('Error confirming order received:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm order receipt',
      error: error.message
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
        payment: true,
        order: {
          include: {
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

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow record not found.'
      });
    }

    // Check authorization
    const isAuthorized = 
      escrow.order.buyerId === userId || 
      escrow.order.store.userId === userId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this escrow record.'
      });
    }

    res.status(200).json({
      success: true,
      data: escrow
    });

  } catch (error) {
    console.error('Error fetching escrow details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escrow details',
      error: error.message
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
    const isAuthorized = 
      order.buyerId === userId || 
      order.store.userId === userId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this order\'s escrow status.'
      });
    }

    if (!order.escrow) {
      return res.status(404).json({
        success: false,
        message: 'No escrow record found for this order.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        escrow: order.escrow,
        canConfirmReceipt: order.buyerId === userId && 
                          order.status === 'DELIVERED' && 
                          order.escrow.releaseStatus === 'PENDING'
      }
    });

  } catch (error) {
    console.error('Error fetching order escrow status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escrow status',
      error: error.message
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
              status: true,
              buyerId: true,
              storeId: true,
              buyer: { select: { firstName: true, email: true } },
              store: { select: { name: true } }
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
      message: 'Failed to fetch pending escrows',
      error: error.message
    });
  }
};