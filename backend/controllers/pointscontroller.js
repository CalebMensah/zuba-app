import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';



const POINTS_TO_CEDIS_RATE = 0.10;

export const getRedeemableProducts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50 } = req.query;

    const limitNum = Math.min(parseInt(limit), 100);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const userPoints = user.points;
    const userCedisEquivalent = userPoints * POINTS_TO_CEDIS_RATE;

    if (userCedisEquivalent <= 0) {
      return res.status(200).json({
        success: true,
        message: 'You do not have enough points to redeem any products.',
        data: { products: [], userPoints, userCedisEquivalent }
      });
    }

    const cacheKey = `user:${userId}:redeemable:products:limit:${limitNum}`;

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    const rawQuery = `
      SELECT "id", "storeId", "name", "description", "price", "stock", "images", "category", "tags", "sizes", "color", "weight", "sellerNote", "moq", "quantityBought", "url", "isActive", "createdAt", "updatedAt"
      FROM "Product"
      WHERE "isActive" = true
        AND "price" <= $1
        AND "stock" > 0
      ORDER BY RANDOM()
      LIMIT $2;
    `;

    let rawProducts = [];
    try {
      rawProducts = await prisma.$queryRawUnsafe(rawQuery, userCedisEquivalent, limitNum);
    } catch (queryError) {
      console.error('Error executing raw SQL query for redeemable products:', queryError);
      throw queryError;
    }

    const products = rawProducts.map(product => ({
      ...product,
      price: parseFloat(product.price),
      store: null
    }));

    const resultData = {
      products,
      userPoints,
      userCedisEquivalent,
      conversionRate: POINTS_TO_CEDIS_RATE
    };

    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching redeemable products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const redeemPointsForProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;
    const { quantity = 1, deliveryInfo } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number.'
      });
    }

    if (!deliveryInfo || !deliveryInfo.recipient || !deliveryInfo.phone || 
        !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.region) {
      return res.status(400).json({
        success: false,
        message: 'Delivery info must include recipient, phone, address, city, and region.'
      });
    }

    const [user, product] = await Promise.all([
      prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { points: true, firstName: true, email: true }
      }),
      prisma.product.findUnique({
        where: { id: productId, isActive: true },
        include: { 
          store: { 
            select: { 
              id: true,
              userId: true, 
              name: true,
              user: {
                select: {
                  email: true,
                  firstName: true
                }
              }
            } 
          } 
        }
      })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found, not active, or out of stock.'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Requested: ${quantity}, Available: ${product.stock}`
      });
    }

    const userPoints = user.points;
    const productTotalCost = product.price * quantity;
    const requiredPoints = Math.ceil(productTotalCost / POINTS_TO_CEDIS_RATE);

    if (userPoints < requiredPoints) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points. Required: ${requiredPoints}, Available: ${userPoints}`
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          buyerId: userId,
          storeId: product.storeId,
          status: 'CONFIRMED',
          totalAmount: productTotalCost,
          subtotal: productTotalCost,
          deliveryFee: 0,
          taxAmount: 0,
          discount: 0,
          currency: 'GHS',
          paymentStatus: 'SUCCESS',
          paymentMethod: 'POINTS',
          items: {
            create: [{
              productId: productId,
              quantity: quantity,
              price: product.price,
              total: productTotalCost
            }]
          },
          deliveryInfo: {
            create: {
              recipient: deliveryInfo.recipient,
              phone: deliveryInfo.phone,
              email: deliveryInfo.email || null,
              address: deliveryInfo.address,
              city: deliveryInfo.city,
              region: deliveryInfo.region,
              country: deliveryInfo.country || "Ghana",
              postalCode: deliveryInfo.postalCode || null,
              deliveryType: deliveryInfo.deliveryType || "STANDARD",
              deliveryFee: 0,
              deliveryInstructions: deliveryInfo.deliveryInstructions || null,
              preferredDeliveryDate: deliveryInfo.preferredDeliveryDate 
                ? new Date(deliveryInfo.preferredDeliveryDate) 
                : null,
              preferredDeliveryTime: deliveryInfo.preferredDeliveryTime || null,
              notes: deliveryInfo.notes || null
            }
          },
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'CONFIRMED',
              changedBy: userId,
              reason: 'Points redemption - Order auto-confirmed'
            }
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          deliveryInfo: true,
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
              url: true
            }
          }
        }
      });

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: requiredPoints } }
      });

      await tx.product.update({
        where: { id: productId },
        data: { 
          stock: { decrement: quantity },
          quantityBought: { increment: quantity }
        }
      });

      return newOrder;
    });

    try {
      const sellerId = product.store.userId;
      const sellerName = product.store.user.firstName;
      const buyerName = user.firstName;
      const storeName = product.store.name;
      const orderId = order.id;

      await sendNotification(
        sellerId,
        'New Points Redemption Order',
        `${buyerName} redeemed ${requiredPoints} points for ${quantity}x ${product.name} (Order #${orderId}).`,
        'ORDER_NEW',
        { orderId, buyerId: userId, buyerName, pointsRedeemed: requiredPoints }
      );

      await sendEmailNotification({
        to: product.store.user.email,
        toName: sellerName,
        subject: `New Points Redemption Order (#${orderId})`,
        template: 'generic',
        templateData: {
          title: 'Points Redemption Order Received!',
          message: `${buyerName} has redeemed ${requiredPoints} points for ${quantity}x ${product.name}. The order has been automatically confirmed. Please prepare it for shipment.`,
          ctaText: 'View Order',
          ctaUrl: `${process.env.FRONTEND_URL}/seller/orders/${orderId}`
        }
      });

      await sendNotification(
        userId,
        'Points Redeemed Successfully',
        `You've successfully redeemed ${requiredPoints} points for ${quantity}x ${product.name}. Order #${orderId} has been confirmed.`,
        'POINTS_REDEEMED',
        { orderId, productId, pointsRedeemed: requiredPoints, newBalance: userPoints - requiredPoints }
      );

      await sendEmailNotification({
        to: user.email,
        toName: buyerName,
        subject: `Points Redeemed Successfully - Order #${orderId}`,
        template: 'order_confirmation',
        templateData: {
          orderId,
          items: [{
            name: product.name,
            quantity,
            price: `${requiredPoints} points`
          }],
          total: `${requiredPoints} points (${productTotalCost} GHS value)`,
          orderUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`,
          estimatedDelivery: '3-5 business days'
        }
      });
    } catch (notificationError) {
      console.error('Error sending notification/email for points redemption:', notificationError);
    }

    await cache.del(`user:${userId}:points`);
    await cache.del(`user:${userId}:orders`);
    await cache.del(`product:url:${product.url}`);
    await cache.del(`store:${product.storeId}:orders`);
    await cache.del(`store:slug:${product.store.url}`);
    await cache.del(`user:${userId}:redeemable:products:*`);

    res.status(201).json({
      success: true,
      message: `Successfully redeemed ${requiredPoints} points for ${quantity}x ${product.name}.`,
      data: {
        order,
        redeemedPoints: requiredPoints,
        newPointBalance: userPoints - requiredPoints
      }
    });

  } catch (error) {
    console.error('Error redeeming points for product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserPointsBalance = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cacheKey = `user:${userId}:points`;

    const cachedPoints = await cache.get(cacheKey);
    if (cachedPoints !== null) {
      return res.status(200).json({
        success: true,
        data: { 
          points: parseInt(cachedPoints), 
          cedisEquivalent: parseInt(cachedPoints) * POINTS_TO_CEDIS_RATE 
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const points = user.points;
    const cedisEquivalent = points * POINTS_TO_CEDIS_RATE;

    await cache.set(cacheKey, points, 300);

    res.status(200).json({
      success: true,
      data: { points, cedisEquivalent, conversionRate: POINTS_TO_CEDIS_RATE }
    });

  } catch (error) {
    console.error('Error fetching user points balance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getPointsHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `user:${userId}:points:history:page:${pageNum}:limit:${limitNum}`;

    const cachedHistory = await cache.get(cacheKey);
    if (cachedHistory) {
      return res.status(200).json({
        success: true,
        data: cachedHistory,
        cached: true
      });
    }

    const [orders, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          buyerId: userId,
          paymentMethod: 'POINTS'
        },
        include: {
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
          },
          store: {
            select: {
              id: true,
              name: true,
              url: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.order.count({
        where: {
          buyerId: userId,
          paymentMethod: 'POINTS'
        }
      })
    ]);

    const totalPointsRedeemed = orders.reduce((sum, order) => {
      return sum + Math.ceil(order.totalAmount / POINTS_TO_CEDIS_RATE);
    }, 0);

    const resultData = {
      orders,
      summary: {
        totalRedemptions: totalOrders,
        totalPointsRedeemed,
        conversionRate: POINTS_TO_CEDIS_RATE
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / limitNum),
        hasNextPage: pageNum < Math.ceil(totalOrders / limitNum),
        hasPrevPage: pageNum > 1
      }
    };

    await cache.set(cacheKey, resultData, 600);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching points history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};