import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

const POINTS_TO_CEDIS_RATE = 0.10; // 1 point = GH₵ 0.10
const CACHE_TTL = {
  BALANCE: 300,        // 5 min
  HISTORY: 600,        // 10 min
  REDEEMABLE: 900,     // 15 min
};

const invalidateUserPointsCache = async (userId) => {
  try {
    const patterns = [
      `user:${userId}:points`,
      `user:${userId}:points:history:*`,
      `user:${userId}:redeemable:products:*`,
    ];

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await cache.keys(pattern);
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => cache.del(k)));
        }
      } else {
        await cache.del(pattern);
      }
    }
  } catch (err) {
    console.error('[Cache] Failed to invalidate points cache:', err);
  }
};


const writeLedgerEntry = (tx, { userId, orderId = null, type, points, balanceAfter, note }) => {
  return tx.pointsLedger.create({
    data: {
      userId,
      orderId,
      type,         // 'EARN' | 'REDEEM' | 'REFUND' | 'EXPIRE'
      points,       // positive = earn/refund, negative = redeem
      balanceAfter,
      note: note ?? null,
    },
  });
};


export const getUserPointsBalance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `user:${userId}:points`;

    const cached = await cache.get(cacheKey);
    if (cached !== null && cached !== undefined) {
      const points = parseInt(cached, 10);
      return res.status(200).json({
        success: true,
        data: {
          points,
          cedisEquivalent: +(points * POINTS_TO_CEDIS_RATE).toFixed(2),
          conversionRate: POINTS_TO_CEDIS_RATE,
        },
        cached: true,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await cache.set(cacheKey, user.points, CACHE_TTL.BALANCE);

    return res.status(200).json({
      success: true,
      data: {
        points: user.points,
        cedisEquivalent: +(user.points * POINTS_TO_CEDIS_RATE).toFixed(2),
        conversionRate: POINTS_TO_CEDIS_RATE,
      },
    });
  } catch (error) {
    console.error('[Points] getUserPointsBalance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const getRedeemableProducts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const userCedisEquivalent = +(user.points * POINTS_TO_CEDIS_RATE).toFixed(2);

    if (userCedisEquivalent <= 0) {
      return res.status(200).json({
        success: true,
        message: 'You do not have enough points to redeem any products.',
        data: {
          products: [],
          userPoints: user.points,
          userCedisEquivalent,
          conversionRate: POINTS_TO_CEDIS_RATE,
        },
      });
    }

    const cacheKey = `user:${userId}:redeemable:products:limit:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, cached: true });
    }

    const rawProducts = await prisma.$queryRawUnsafe(
      `SELECT "id", "storeId", "name", "description", "price", "stock",
              "images", "category", "tags", "sizes", "color", "moq",
              "quantityBought", "url", "isActive", "createdAt", "updatedAt"
       FROM "Product"
       WHERE "isActive" = true
         AND "isDeleted" = false
         AND "price" <= $1
         AND "stock" > 0
       ORDER BY RANDOM()
       LIMIT $2`,
      userCedisEquivalent,
      limit
    );

    const products = rawProducts.map((p) => ({
      ...p,
      price: parseFloat(p.price),
      requiredPoints: Math.ceil(parseFloat(p.price) / POINTS_TO_CEDIS_RATE),
    }));

    const resultData = {
      products,
      userPoints: user.points,
      userCedisEquivalent,
      conversionRate: POINTS_TO_CEDIS_RATE,
    };

    await cache.set(cacheKey, resultData, CACHE_TTL.REDEEMABLE);

    return res.status(200).json({ success: true, data: resultData });
  } catch (error) {
    console.error('[Points] getRedeemableProducts error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const redeemPointsForProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;
    const { quantity = 1, deliveryInfo } = req.body;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer.',
      });
    }

    const requiredFields = ['recipient', 'phone', 'address', 'city', 'region'];
    const missingFields = requiredFields.filter((f) => !deliveryInfo?.[f]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing delivery fields: ${missingFields.join(', ')}.`,
      });
    }

    const [user, product] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { points: true, firstName: true, email: true },
      }),
      prisma.product.findUnique({
        where: { id: productId, isActive: true, isDeleted: false },
        include: {
          store: {
            select: {
              id: true,
              userId: true,
              name: true,
              url: true,
              user: { select: { email: true, firstName: true } },
            },
          },
        },
      }),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or no longer available.',
      });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} unit(s) in stock. Requested: ${quantity}.`,
      });
    }

    const productPrice = parseFloat(product.price.toString());
    const totalCost = +(productPrice * quantity).toFixed(2);
    const requiredPoints = Math.ceil(totalCost / POINTS_TO_CEDIS_RATE);

    if (user.points < requiredPoints) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points. Required: ${requiredPoints.toLocaleString()}, available: ${user.points.toLocaleString()}.`,
        data: {
          required: requiredPoints,
          available: user.points,
          shortfall: requiredPoints - user.points,
        },
      });
    }

    const balanceAfter = user.points - requiredPoints;

    const order = await prisma.$transaction(async (tx) => {

      const newOrder = await tx.order.create({
        data: {
          buyerId: userId,
          storeId: product.storeId,
          status: 'PROCESSING',
          paymentStatus: 'SUCCESS',
          paymentMethod: 'POINTS',
          totalAmount: totalCost,
          subtotal: totalCost,
          deliveryFee: 0,
          taxAmount: 0,
          discount: 0,
          platformFee: 0,
          paystackFee: 0,
          currency: 'GHS',
          items: {
            create: [{
              productId,
              quantity,
              price: productPrice,
              total: totalCost,
              storeId: product.storeId,
            }],
          },
          deliveryInfo: {
            create: {
              recipient: deliveryInfo.recipient,
              phone: deliveryInfo.phone,
              email: deliveryInfo.email ?? '',
              address: deliveryInfo.address,
              city: deliveryInfo.city,
              region: deliveryInfo.region,
              country: deliveryInfo.country ?? 'Ghana',
              postalCode: deliveryInfo.postalCode ?? null,
              deliveryFee: 0,
            },
          },
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'PROCESSING',
              changedBy: userId,
              reason: 'Points redemption — order auto-confirmed, no payment required.',
            },
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, images: true } } } },
          deliveryInfo: true,
          buyer: { select: { id: true, firstName: true, email: true } },
          store: { select: { id: true, name: true, url: true } },
        },
      });

      // 2. Deduct points from user
      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: requiredPoints } },
      });

      // 3. Decrement stock and increment quantityBought
      await tx.product.update({
        where: { id: productId },
        data: {
          stock: { decrement: quantity },
          quantityBought: { increment: quantity },
        },
      });

      // 4. Write ledger entry (audit trail)
      await writeLedgerEntry(tx, {
        userId,
        orderId: newOrder.id,
        type: 'REDEEM',
        points: -requiredPoints,          // negative = points spent
        balanceAfter,
        note: `Redeemed ${requiredPoints.toLocaleString()} pts for ${quantity}x "${product.name}" (Order #${newOrder.id})`,
      });

      return newOrder;
    });

    await invalidateUserPointsCache(userId);
    await Promise.all([
      cache.del(`product:url:${product.url}`),
      cache.del(`store:${product.storeId}:orders`),
      cache.del(`store:slug:${product.store.url}`),
      cache.del(`user:${userId}:orders`),
    ]);

    // Notifications (non-blocking)
    const sellerId = product.store.userId;
    const sellerName = product.store.user.firstName;
    const buyerName = user.firstName;
    const storeName = product.store.name;
    const orderId = order.id;

    Promise.allSettled([
      sendNotification(
        sellerId,
        'New Points Redemption Order',
        `${buyerName} redeemed ${requiredPoints.toLocaleString()} points for ${quantity}× ${product.name} (Order #${orderId}).`,
        'ORDER_NEW',
        { orderId, buyerId: userId, buyerName, pointsRedeemed: requiredPoints }
      ),
      sendNotification(
        userId,
        'Points Redeemed Successfully! 🎉',
        `You redeemed ${requiredPoints.toLocaleString()} pts for ${quantity}× ${product.name}. New balance: ${balanceAfter.toLocaleString()} pts.`,
        'POINTS_REDEEMED',
        { orderId, productId, pointsRedeemed: requiredPoints, newBalance: balanceAfter }
      ),
      sendEmailNotification({
        to: product.store.user.email,
        toName: sellerName,
        subject: `New Points Redemption Order (#${orderId})`,
        template: 'generic',
        sender: 'order',
        templateData: {
          title: 'Points Redemption Order Received!',
          message: `${buyerName} has redeemed ${requiredPoints.toLocaleString()} points for ${quantity}× ${product.name}. Please prepare it for shipment.`,
          ctaText: 'View Order',
          ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}`,
        },
      }),
      sendEmailNotification({
        to: user.email,
        toName: buyerName,
        subject: `Points Redeemed — Order #${orderId}`,
        template: 'order_confirmation',
        sender: 'order',
        templateData: {
          orderId,
          items: [{ name: product.name, quantity, price: `${requiredPoints.toLocaleString()} points` }],
          total: `${requiredPoints.toLocaleString()} points (GH₵${totalCost.toFixed(2)} value)`,
          orderUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`,
          estimatedDelivery: '3–5 business days',
        },
      }),
    ]).catch((err) => console.error('[Points] Notification error (non-fatal):', err));

    return res.status(201).json({
      success: true,
      message: `Successfully redeemed ${requiredPoints.toLocaleString()} points for ${quantity}× ${product.name}.`,
      data: {
        order,
        redeemedPoints: requiredPoints,
        previousBalance: user.points,
        newPointBalance: balanceAfter,
        cedisValue: totalCost,
      },
    });
  } catch (error) {
    console.error('[Points] redeemPointsForProduct error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


export const refundPointsForOrder = async (orderId, cancelledByUserId = null) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        totalAmount: true,
        paymentMethod: true,
        status: true,
        items: {
          select: { quantity: true, product: { select: { name: true } } },
        },
      },
    });

    if (!order) throw new Error(`Order ${orderId} not found.`);
    if (order.paymentMethod !== 'POINTS') {
      // Not a points order — nothing to refund here
      return { refunded: false, reason: 'Not a points order.' };
    }

    // Check for an existing refund ledger entry to prevent double-refunds
    const existingRefund = await prisma.pointsLedger.findFirst({
      where: { orderId, type: 'REFUND' },
    });
    if (existingRefund) {
      return { refunded: false, reason: 'Points already refunded for this order.' };
    }

    const pointsToRefund = Math.ceil(order.totalAmount / POINTS_TO_CEDIS_RATE);
    const itemNames = order.items.map((i) => `${i.quantity}× ${i.product?.name ?? 'item'}`).join(', ');

    const user = await prisma.user.findUnique({
      where: { id: order.buyerId },
      select: { points: true, firstName: true, email: true },
    });

    if (!user) throw new Error(`Buyer ${order.buyerId} not found.`);

    const balanceAfter = user.points + pointsToRefund;

    await prisma.$transaction(async (tx) => {
      // Restore points
      await tx.user.update({
        where: { id: order.buyerId },
        data: { points: { increment: pointsToRefund } },
      });

      // Ledger entry
      await writeLedgerEntry(tx, {
        userId: order.buyerId,
        orderId,
        type: 'REFUND',
        points: pointsToRefund,        // positive = points returned
        balanceAfter,
        note: `Points refund for cancelled order #${orderId} (${itemNames})`,
      });
    });

    // Invalidate cache
    await invalidateUserPointsCache(order.buyerId);

    // Notify buyer (non-blocking)
    Promise.allSettled([
      sendNotification(
        order.buyerId,
        'Points Refunded',
        `${pointsToRefund.toLocaleString()} points have been returned to your account for cancelled order #${orderId}.`,
        'POINTS_REFUNDED',
        { orderId, pointsRefunded: pointsToRefund, newBalance: balanceAfter }
      ),
      sendEmailNotification({
        to: user.email,
        toName: user.firstName,
        subject: `Points Refunded — Order #${orderId}`,
        template: 'generic',
        sender: 'order',
        templateData: {
          title: 'Points Refunded',
          message: `${pointsToRefund.toLocaleString()} points have been returned to your account following the cancellation of order #${orderId}. Your new balance is ${balanceAfter.toLocaleString()} points.`,
          ctaText: 'View Points',
          ctaUrl: `${process.env.FRONTEND_URL}/points`,
        },
      }),
    ]).catch((err) => console.error('[Points] Refund notification error (non-fatal):', err));

    return {
      refunded: true,
      pointsRefunded: pointsToRefund,
      newBalance: balanceAfter,
    };
  } catch (error) {
    console.error('[Points] refundPointsForOrder error:', error);
    throw error; // Re-throw so the caller (cancel handler) can handle it
  }
};


export const getPointsHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
    const skip = (page - 1) * limit;

    const cacheKey = `user:${userId}:points:history:page:${page}:limit:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, cached: true });
    }

    const [entries, total] = await Promise.all([
      prisma.pointsLedger.findMany({
        where: { userId },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              store: { select: { name: true } },
              items: {
                select: {
                  quantity: true,
                  product: { select: { name: true, images: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pointsLedger.count({ where: { userId } }),
    ]);

    // Summary aggregates
    const [earnedAgg, redeemedAgg, refundedAgg] = await Promise.all([
      prisma.pointsLedger.aggregate({
        where: { userId, type: 'EARN' },
        _sum: { points: true },
      }),
      prisma.pointsLedger.aggregate({
        where: { userId, type: 'REDEEM' },
        _sum: { points: true },
      }),
      prisma.pointsLedger.aggregate({
        where: { userId, type: 'REFUND' },
        _sum: { points: true },
      }),
    ]);

    const summary = {
      totalEarned: earnedAgg._sum.points ?? 0,
      totalRedeemed: Math.abs(redeemedAgg._sum.points ?? 0),
      totalRefunded: refundedAgg._sum.points ?? 0,
      conversionRate: POINTS_TO_CEDIS_RATE,
    };

    const resultData = {
      entries,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };

    await cache.set(cacheKey, resultData, CACHE_TTL.HISTORY);

    return res.status(200).json({ success: true, data: resultData });
  } catch (error) {
    console.error('[Points] getPointsHistory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


const EARN_RATE = 1; 

export const awardPointsForOrder = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        subtotal: true,
        paymentMethod: true,
        status: true,
      },
    });

    if (!order) throw new Error(`Order ${orderId} not found.`);

    // Don't award points on points orders (circular) or non-COMPLETED orders
    if (order.paymentMethod === 'POINTS') {
      return { awarded: false, reason: 'Points orders do not earn points.' };
    }
    if (order.status !== 'COMPLETED') {
      return { awarded: false, reason: 'Order not yet completed.' };
    }

    // Prevent double-awarding
    const existingEarn = await prisma.pointsLedger.findFirst({
      where: { orderId, type: 'EARN' },
    });
    if (existingEarn) {
      return { awarded: false, reason: 'Points already awarded for this order.' };
    }

    const pointsToAward = Math.floor(order.subtotal * EARN_RATE);
    if (pointsToAward <= 0) {
      return { awarded: false, reason: 'Order value too low to earn points.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: order.buyerId },
      select: { points: true, firstName: true, email: true },
    });

    if (!user) throw new Error(`Buyer ${order.buyerId} not found.`);

    const balanceAfter = user.points + pointsToAward;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: order.buyerId },
        data: { points: { increment: pointsToAward } },
      });

      await writeLedgerEntry(tx, {
        userId: order.buyerId,
        orderId,
        type: 'EARN',
        points: pointsToAward,
        balanceAfter,
        note: `Earned ${pointsToAward} pts for completing order #${orderId}`,
      });
    });

    await invalidateUserPointsCache(order.buyerId);

    // Non-blocking notification
    Promise.allSettled([
      sendNotification(
        order.buyerId,
        `You earned ${pointsToAward.toLocaleString()} points! 🎉`,
        `Points added for completing order #${orderId}. Balance: ${balanceAfter.toLocaleString()} pts.`,
        'POINTS_EARNED',
        { orderId, pointsEarned: pointsToAward, newBalance: balanceAfter }
      ),
    ]).catch((err) => console.error('[Points] Earn notification error (non-fatal):', err));

    return { awarded: true, pointsAwarded: pointsToAward, newBalance: balanceAfter };
  } catch (error) {
    console.error('[Points] awardPointsForOrder error:', error);
    throw error;
  }
};