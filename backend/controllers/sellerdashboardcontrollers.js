import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';


export const getDashboardSummary = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = store.id;
    const cacheKey = `dashboard:summary:seller:${sellerId}:store:${storeId}`;

    const cachedSummary = await cache.get(cacheKey);
    if (cachedSummary) {
      return res.status(200).json({
        success: true,
        data: cachedSummary,
        cached: true
      });
    }

    const [
      totalOrders,
      totalRevenue,
      totalProducts,
      activeProducts,
      pendingOrders,
      deliveredOrders
    ] = await Promise.all([
      prisma.order.count({
        where: { storeId }
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { storeId, paymentStatus: 'SUCCESS' }
      }),
      prisma.product.count({
        where: { storeId }
      }),
      prisma.product.count({
        where: { storeId, isActive: true }
      }),
      prisma.order.count({
        where: { storeId, status: 'PENDING' }
      }),
      prisma.order.count({
        where: { storeId, status: 'DELIVERED' }
      })
    ]);

    const summary = {
      totalOrders: totalOrders || 0,
      totalRevenue: (totalRevenue._sum.totalAmount || 0),
      totalProducts: totalProducts || 0,
      activeProducts: activeProducts || 0,
      pendingOrders: pendingOrders || 0,
      deliveredOrders: deliveredOrders || 0
    };

    await cache.set(cacheKey, summary, 900);

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSalesAnalytics = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '7d' } = req.query;

    const store = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = store.id;
    const cacheKey = `dashboard:sales:analytics:seller:${sellerId}:store:${storeId}:period:${period}`;

    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '90d':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid period. Use '7d', '30d', '90d', or '1y'."
        });
    }

    let groupBy = 'day';
    if (period === '90d') groupBy = 'week';
    if (period === '1y') groupBy = 'month';

    const orders = await prisma.order.findMany({
      where: {
        storeId,
        paymentStatus: 'SUCCESS',
        createdAt: { gte: startDate }
      },
      select: {
        totalAmount: true,
        createdAt: true
      }
    });

    const salesData = [];
    const dateMap = new Map();

    for (const order of orders) {
      let dateKey;
      if (groupBy === 'day') {
        dateKey = order.createdAt.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const d = new Date(order.createdAt);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        dateKey = d.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        dateKey = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, revenue: 0, orders: 0 });
      }
      dateMap.get(dateKey).revenue += order.totalAmount;
      dateMap.get(dateKey).orders += 1;
    }

    salesData.push(...dateMap.values());
    salesData.sort((a, b) => new Date(a.date) - new Date(b.date));

    const result = {
      period,
      salesData
    };

    await cache.set(cacheKey, result, 1800);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getTopSellingProducts = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { limit = 10 } = req.query;

    const store = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = store.id;
    const cacheKey = `dashboard:top:products:seller:${sellerId}:store:${storeId}:limit:${limit}`;

    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const topProducts = await prisma.product.findMany({
      where: { storeId },
      orderBy: { quantityBought: 'desc' },
      take: parseInt(limit),
      select: {
        id: true,
        name: true,
        images: true,
        price: true,
        quantityBought: true,
        stock: true
      }
    });

    const result = {
      topProducts
    };

    await cache.set(cacheKey, result, 3600);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching top selling products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getOrderAnalytics = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = store.id;
    const cacheKey = `dashboard:order:analytics:seller:${sellerId}:store:${storeId}`;

    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true
    });

    const paymentStatusCounts = await prisma.order.groupBy({
      by: ['paymentStatus'],
      where: { storeId },
      _count: true
    });

    const result = {
      statusDistribution: statusCounts.map(item => ({ status: item.status, count: item._count })),
      paymentStatusDistribution: paymentStatusCounts.map(item => ({ status: item.paymentStatus, count: item._count }))
    };

    await cache.set(cacheKey, result, 900);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getStorePerformance = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await prisma.store.findFirst({
      where: { userId: sellerId },
      select: { id: true, viewCount: true }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found for this seller.'
      });
    }

    const storeId = store.id;
    const cacheKey = `dashboard:store:performance:seller:${sellerId}:store:${storeId}`;

    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const totalOrders = await prisma.order.count({ where: { storeId } });
    const totalViews = store.viewCount || 0;
    const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

    const result = {
      totalViews,
      totalOrders,
      conversionRate: parseFloat(conversionRate.toFixed(2))
    };

    await cache.set(cacheKey, result, 1800);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching store performance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};