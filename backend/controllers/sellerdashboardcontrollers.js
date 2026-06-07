import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';
import { PLATFORM_FEE_PERCENT} from '../utils/fees.js';

async function getStoreForSeller(sellerId) {
  const store = await prisma.store.findFirst({
    where: { userId: sellerId },
    select: { id: true }
  });
  return store;
}

async function getSellerStore(sellerId) {
  const store = await prisma.store.findFirst({
    where: { userId: sellerId },
    select: { id: true }
  });
  return store;
}

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
        where: { storeId, status: 'PENDING_PAYMENT' }
      }),
      prisma.order.count({
        where: { storeId, status: 'COMPLETED' }
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

// ─── 1. Payment Overview Summary ────────────────────────────────────────────
// GET /api/analytics/payments/summary
// Total collected, pending payouts, failed txns, chargebacks, fees paid

export const getPaymentSummary = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:payment:summary:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const [
      successPayments,
      failedCount,
      pendingCount,
      refundedPayments,
      pendingEscrow,
      releasedEscrow,
      pendingPayouts,
      completedPayouts,
      failedPayouts
    ] = await Promise.all([
      // Total successfully collected (buyer paid amount)
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'SUCCESS', order: { storeId } }
      }),
      // Failed transactions count
      prisma.payment.count({
        where: { status: 'FAILED', order: { storeId } }
      }),
      // Pending transactions count
      prisma.payment.count({
        where: { status: 'PENDING', order: { storeId } }
      }),
      // Refunded
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'REFUNDED', order: { storeId } }
      }),
      // Escrow: funds held (not yet released to seller)
      prisma.escrow.aggregate({
        _sum: { amountHeld: true },
        _count: { id: true },
        where: { releaseStatus: 'HELD', order: { storeId } }
      }),
      // Escrow: funds released
      prisma.escrow.aggregate({
        _sum: { amountHeld: true },
        _count: { id: true },
        where: { releaseStatus: 'RELEASED', order: { storeId } }
      }),
      // Pending payouts (not yet transferred to seller)
      prisma.payout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'PENDING', order: { storeId } }
      }),
      // Completed payouts
      prisma.payout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'COMPLETED', order: { storeId } }
      }),
      // Failed payouts
      prisma.payout.count({
        where: { status: 'FAILED', order: { storeId } }
      })
    ]);

    const totalCollected = successPayments._sum.amount || 0;
    // Gross seller revenue = total collected minus platform fee
    const estimatedPlatformFees = totalCollected * PLATFORM_FEE_PERCENT;
    // Paystack fees are stored per-order; sum from order metadata
    const paystackFeesResult = await prisma.order.aggregate({
      _sum: { paystackFee: true },
      where: { storeId, paymentStatus: 'SUCCESS' }
    });
    const totalPaystackFees = paystackFeesResult._sum.paystackFee || 0;

    const transactionSuccessRate =
      successPayments._count.id + failedCount > 0
        ? parseFloat(
            ((successPayments._count.id / (successPayments._count.id + failedCount)) * 100).toFixed(2)
          )
        : 0;

    const data = {
      totalCollected,                                         // Total buyer-paid amounts (incl. all fees)
      totalNetRevenue: releasedEscrow._sum.amountHeld || 0,  // Actually received by seller
      pendingEscrowAmount: pendingEscrow._sum.amountHeld || 0,
      pendingEscrowCount: pendingEscrow._count.id || 0,
      pendingPayoutAmount: pendingPayouts._sum.amount || 0,
      pendingPayoutCount: pendingPayouts._count.id || 0,
      completedPayoutAmount: completedPayouts._sum.amount || 0,
      completedPayoutCount: completedPayouts._count.id || 0,
      totalPlatformFeesPaid: parseFloat(estimatedPlatformFees.toFixed(2)),
      totalPaystackFeesPaid: parseFloat(totalPaystackFees.toFixed(2)),
      failedTransactions: failedCount,
      failedPayouts: failedPayouts,
      pendingTransactions: pendingCount,
      refundedAmount: refundedPayments._sum.amount || 0,
      refundedCount: refundedPayments._count.id || 0,
      transactionSuccessRate,
      successfulTransactions: successPayments._count.id || 0
    };

    await cache.set(cacheKey, data, 900); // 15 min cache

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 2. Payment Method Breakdown ────────────────────────────────────────────
// GET /api/analytics/payments/methods
// Pie chart data: breakdown by gateway and currency

export const getPaymentMethodBreakdown = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:payment:methods:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const [byGateway, byCurrency, byStatus] = await Promise.all([
      prisma.payment.groupBy({
        by: ['gateway'],
        where: { order: { storeId } },
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['currency'],
        where: { order: { storeId } },
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where: { order: { storeId } },
        _count: { id: true },
        _sum: { amount: true }
      })
    ]);

    const totalTransactions = byStatus.reduce((sum, s) => sum + s._count.id, 0);

    const data = {
      byGateway: byGateway.map(g => ({
        gateway: g.gateway,
        count: g._count.id,
        totalAmount: g._sum.amount || 0,
        percentage: totalTransactions > 0
          ? parseFloat(((g._count.id / totalTransactions) * 100).toFixed(2))
          : 0
      })),
      byCurrency: byCurrency.map(c => ({
        currency: c.currency,
        count: c._count.id,
        totalAmount: c._sum.amount || 0
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.id,
        totalAmount: s._sum.amount || 0,
        percentage: totalTransactions > 0
          ? parseFloat(((s._count.id / totalTransactions) * 100).toFixed(2))
          : 0
      })),
      totalTransactions
    };

    await cache.set(cacheKey, data, 1800); // 30 min cache

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment method breakdown:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 3. Payout History Timeline ─────────────────────────────────────────────
// GET /api/analytics/payments/payouts?period=30d&page=1&limit=20
// Paginated payout history with timeline data for charting

export const getPayoutHistory = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d', page = 1, limit = 20 } = req.query;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ success: false, message: 'Invalid pagination parameters.' });
    }

    const cacheKey = `analytics:payment:payouts:store:${storeId}:period:${period}:page:${pageNum}:limit:${limitNum}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const skip = (pageNum - 1) * limitNum;

    const [payouts, total, aggregates] = await Promise.all([
      prisma.payout.findMany({
        where: {
          order: { storeId },
          createdAt: { gte: startDate }
        },
        include: {
          order: {
            select: {
              id: true,
              totalAmount: true,
              platformFee: true,
              paystackFee: true,
              paidAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.payout.count({
        where: { order: { storeId }, createdAt: { gte: startDate } }
      }),
      prisma.payout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          order: { storeId },
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        }
      })
    ]);

    // Build timeline: group completed payouts by day for charting
    const completedPayouts = await prisma.payout.findMany({
      where: {
        order: { storeId },
        status: 'COMPLETED',
        transferredAt: { gte: startDate }
      },
      select: { amount: true, transferredAt: true }
    });

    const timelineMap = new Map();
    for (const payout of completedPayouts) {
      const dateKey = payout.transferredAt.toISOString().split('T')[0];
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { date: dateKey, amount: 0, count: 0 });
      }
      timelineMap.get(dateKey).amount += payout.amount;
      timelineMap.get(dateKey).count += 1;
    }

    const timeline = Array.from(timelineMap.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const data = {
      period,
      payouts,
      timeline,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        totalPaidOut: aggregates._sum.amount || 0,
        completedPayoutCount: aggregates._count.id || 0
      }
    };

    await cache.set(cacheKey, data, 900);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payout history:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 4. Transaction Success Rate ────────────────────────────────────────────
// GET /api/analytics/payments/transaction-rate?period=30d
// Success vs failure rate over time — line/area chart data

export const getTransactionSuccessRate = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d' } = req.query;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:payment:txn-rate:store:${storeId}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const payments = await prisma.payment.findMany({
      where: {
        order: { storeId },
        createdAt: { gte: startDate }
      },
      select: {
        status: true,
        amount: true,
        createdAt: true
      }
    });

    // Group by day
    const dailyMap = new Map();
    for (const payment of payments) {
      const dateKey = payment.createdAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, success: 0, failed: 0, pending: 0, refunded: 0, total: 0 });
      }
      const day = dailyMap.get(dateKey);
      day.total += 1;
      if (payment.status === 'SUCCESS') day.success += 1;
      else if (payment.status === 'FAILED') day.failed += 1;
      else if (payment.status === 'PENDING') day.pending += 1;
      else if (payment.status === 'REFUNDED') day.refunded += 1;
    }

    const dailyRates = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => ({
        ...day,
        successRate: day.total > 0 ? parseFloat(((day.success / day.total) * 100).toFixed(2)) : 0,
        failureRate: day.total > 0 ? parseFloat(((day.failed / day.total) * 100).toFixed(2)) : 0
      }));

    // Overall for the period
    const totalSuccess = payments.filter(p => p.status === 'SUCCESS').length;
    const totalFailed = payments.filter(p => p.status === 'FAILED').length;
    const totalAll = payments.length;

    const data = {
      period,
      overall: {
        successRate: totalAll > 0 ? parseFloat(((totalSuccess / totalAll) * 100).toFixed(2)) : 0,
        failureRate: totalAll > 0 ? parseFloat(((totalFailed / totalAll) * 100).toFixed(2)) : 0,
        totalTransactions: totalAll,
        successCount: totalSuccess,
        failedCount: totalFailed
      },
      dailyRates
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching transaction success rate:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 5. Failed & Declined Transactions ──────────────────────────────────────
// GET /api/analytics/payments/failed?page=1&limit=20
// Paginated list of failed payments with reason from metadata

export const getFailedTransactions = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { page = 1, limit = 20, period = '30d' } = req.query;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ success: false, message: 'Invalid pagination parameters.' });
    }

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const skip = (pageNum - 1) * limitNum;

    const where = {
      status: 'FAILED',
      order: { storeId },
      createdAt: { gte: startDate }
    };

    const [failedPayments, total, totalLostRevenue] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              totalAmount: true,
              buyer: { select: { id: true, firstName: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where
      })
    ]);

    // Sanitize: strip raw gateway_response but surface the failure reason
    const sanitized = failedPayments.map(p => ({
      id: p.id,
      orderId: p.orderId,
      amount: p.amount,
      currency: p.currency,
      gateway: p.gateway,
      gatewayRef: p.gatewayRef,
      createdAt: p.createdAt,
      failureReason: p.metadata?.error || p.metadata?.gateway_response?.gateway_response?.message || 'Unknown',
      cancelledBy: p.metadata?.cancelledBy || null,
      orderAmount: p.order?.totalAmount,
      buyer: p.order?.buyer
    }));

    const data = {
      period,
      failedTransactions: sanitized,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        totalFailed: total,
        estimatedLostRevenue: totalLostRevenue._sum.amount || 0
      }
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching failed transactions:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 6. Escrow Status Overview ───────────────────────────────────────────────
// GET /api/analytics/payments/escrow
// How much money is held, releasing soon, and already released

export const getEscrowOverview = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:payment:escrow:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const [
      pendingEscrow,
      releasingIn48h,
      completedEscrow,
      recentReleases
    ] = await Promise.all([
      prisma.escrow.aggregate({
        _sum: { amountHeld: true },
        _count: { id: true },
        where: { releaseStatus: 'HELD', order: { storeId } }
      }),
      // Releasing within 48 hours
      prisma.escrow.aggregate({
        _sum: { amountHeld: true },
        _count: { id: true },
        where: {
          releaseStatus: 'HELD',
          order: { storeId },
          releaseDate: { lte: in48Hours }
        }
      }),
      prisma.escrow.aggregate({
        _sum: { amountHeld: true },
        _count: { id: true },
        where: { releaseStatus: 'RELEASED', order: { storeId } }
      }),
      // Last 5 released escrows for the "recent activity" feed
      prisma.escrow.findMany({
where: { releaseStatus: 'RELEASED', order: { storeId } },
        include: {
          order: { select: { id: true, totalAmount: true } }
        },
        orderBy: { releasedAt: 'desc' },
        take: 5
      })
    ]);

    const data = {
      held: {
        amount: pendingEscrow._sum.amountHeld || 0,
        count: pendingEscrow._count.id || 0
      },
      releasingSoon: {
        amount: releasingIn48h._sum.amountHeld || 0,
        count: releasingIn48h._count.id || 0,
        within: '48h'
      },
      released: {
        amount: completedEscrow._sum.amountHeld || 0,
        count: completedEscrow._count.id || 0
      },
      recentReleases: recentReleases.map(e => ({
        escrowId: e.id,
        orderId: e.orderId,
        amountReleased: e.amountHeld,
        releasedAt: e.releasedAt,
        orderAmount: e.order?.totalAmount
      }))
    };

    await cache.set(cacheKey, data, 600); // 10 min cache — escrow changes more frequently

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching escrow overview:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 7. Platform & Paystack Fees Paid ───────────────────────────────────────
// GET /api/analytics/payments/fees?period=30d
// How much the seller has paid in platform fees and Paystack fees over time

export const getFeesAnalytics = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d' } = req.query;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found for this seller.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:payment:fees:store:${storeId}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const orders = await prisma.order.findMany({
      where: {
        storeId,
        paymentStatus: 'SUCCESS',
        paidAt: { gte: startDate }
      },
      select: {
        id: true,
        totalAmount: true,
        platformFee: true,
        paystackFee: true,
        paidAt: true
      }
    });

    // Timeline grouping by day
    const dailyMap = new Map();
    let totalPlatformFees = 0;
    let totalPaystackFees = 0;
    let totalGrossRevenue = 0;

    for (const order of orders) {
      const dateKey = order.paidAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, platformFee: 0, paystackFee: 0, grossRevenue: 0, netRevenue: 0 });
      }
      const day = dailyMap.get(dateKey);
      const platform = order.platformFee || order.totalAmount * PLATFORM_FEE_PERCENT;
      const paystack = order.paystackFee || 0;

      day.platformFee += platform;
      day.paystackFee += paystack;
      day.grossRevenue += order.totalAmount;
      day.netRevenue += order.totalAmount - platform;

      totalPlatformFees += platform;
      totalPaystackFees += paystack;
      totalGrossRevenue += order.totalAmount;
    }

    const timeline = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({
        ...d,
        platformFee: parseFloat(d.platformFee.toFixed(2)),
        paystackFee: parseFloat(d.paystackFee.toFixed(2)),
        grossRevenue: parseFloat(d.grossRevenue.toFixed(2)),
        netRevenue: parseFloat(d.netRevenue.toFixed(2))
      }));

    const data = {
      period,
      summary: {
        totalPlatformFees: parseFloat(totalPlatformFees.toFixed(2)),
        totalPaystackFees: parseFloat(totalPaystackFees.toFixed(2)),
        totalFeesAllIn: parseFloat((totalPlatformFees + totalPaystackFees).toFixed(2)),
        grossRevenue: parseFloat(totalGrossRevenue.toFixed(2)),
        netRevenue: parseFloat((totalGrossRevenue - totalPlatformFees).toFixed(2)),
        effectiveFeeRate: totalGrossRevenue > 0
          ? parseFloat((((totalPlatformFees + totalPaystackFees) / totalGrossRevenue) * 100).toFixed(2))
          : 0
      },
      timeline
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching fees analytics:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ─── 1. Product Activity Snapshot ────────────────────────────────────────────
// GET /api/analytics/products/snapshot
// KPI cards: active, inactive, out of stock, low stock, deleted, total

export const getProductSnapshot = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getStoreForSeller(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:products:snapshot:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const LOW_STOCK_THRESHOLD = 5;

    const [
      total,
      active,
      inactive,
      outOfStock,
      lowStock,
      deleted,
      neverSold
    ] = await Promise.all([
      prisma.product.count({ where: { storeId, isDeleted: false } }),
      prisma.product.count({ where: { storeId, isActive: true, isDeleted: false } }),
      prisma.product.count({ where: { storeId, isActive: false, isDeleted: false } }),
      prisma.product.count({ where: { storeId, stock: 0, isDeleted: false } }),
      prisma.product.count({
        where: { storeId, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD }, isDeleted: false }
      }),
      prisma.product.count({ where: { storeId, isDeleted: true } }),
      prisma.product.count({
        where: { storeId, quantityBought: 0, isActive: true, isDeleted: false }
      })
    ]);

    const data = {
      total,
      active,
      inactive,
      outOfStock,
      lowStock,             // stock > 0 but <= threshold
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      deleted,
      neverSold             // active products with 0 sales ever
    };

    await cache.set(cacheKey, data, 600); // 10 min

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching product snapshot:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 2. Per-Product Performance (Views → Conversion) ─────────────────────────
// GET /api/analytics/products/performance?page=1&limit=20&sortBy=conversionRate&sortOrder=desc
// Each product: views, units sold, revenue, conversion rate

export const getProductPerformance = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      sortBy = 'revenue',     // revenue | conversionRate | quantityBought | viewCount
      sortOrder = 'desc'
    } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `analytics:products:performance:store:${storeId}:page:${pageNum}:limit:${limitNum}:sort:${sortBy}:${sortOrder}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    // Pull products with their order items for real revenue figures
    const products = await prisma.product.findMany({
      where: { storeId, isDeleted: false },
      select: {
        id: true,
        name: true,
        images: true,
        price: true,
        stock: true,
        isActive: true,
        quantityBought: true,
        viewCount: true,
        category: true,
        createdAt: true,
        orderItems: {
          where: {
            order: { paymentStatus: 'SUCCESS' }
          },
          select: {
            quantity: true,
            price: true
          }
        }
      }
    });

    // Compute derived metrics per product
    const enriched = products.map(p => {
      const actualUnitsSold = p.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const revenue = p.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const views = p.viewCount || 0;
      const conversionRate = views > 0
        ? parseFloat(((actualUnitsSold / views) * 100).toFixed(2))
        : 0;

      return {
        id: p.id,
        name: p.name,
        images: p.images,
        price: p.price,
        stock: p.stock,
        isActive: p.isActive,
        category: p.category,
        createdAt: p.createdAt,
        viewCount: views,
        unitsSold: actualUnitsSold,
        quantityBoughtField: p.quantityBought, // the stored field, for comparison
        revenue: parseFloat(revenue.toFixed(2)),
        conversionRate,
        revenuePerView: views > 0 ? parseFloat((revenue / views).toFixed(4)) : 0
      };
    });

    // Sort in JS since conversion rate is computed
    const validSortFields = ['revenue', 'conversionRate', 'unitsSold', 'viewCount', 'price', 'stock'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'revenue';
    const direction = sortOrder === 'asc' ? 1 : -1;

    enriched.sort((a, b) => direction * (a[field] - b[field]));

    const total = enriched.length;
    const paginated = enriched.slice(skip, skip + limitNum);

    const data = {
      products: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };

    await cache.set(cacheKey, data, 900);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching product performance:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 3. Low Stock & Out-of-Stock Alerts ──────────────────────────────────────
// GET /api/analytics/products/stock-alerts?threshold=5
// Returns out-of-stock and low-stock products separately for alert UI

export const getStockAlerts = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { threshold = 5 } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const thresholdNum = Math.max(1, parseInt(threshold));
    const cacheKey = `analytics:products:stock-alerts:store:${storeId}:threshold:${thresholdNum}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const [outOfStock, lowStock] = await Promise.all([
      prisma.product.findMany({
        where: { storeId, stock: 0, isActive: true, isDeleted: false },
        select: {
          id: true, name: true, images: true, price: true,
          stock: true, category: true, quantityBought: true, url: true
        },
        orderBy: { quantityBought: 'desc' } // most sold first — highest urgency to restock
      }),
      prisma.product.findMany({
        where: {
          storeId,
          stock: { gt: 0, lte: thresholdNum },
          isActive: true,
          isDeleted: false
        },
        select: {
          id: true, name: true, images: true, price: true,
          stock: true, category: true, quantityBought: true, url: true
        },
        orderBy: { stock: 'asc' } // lowest stock first
      })
    ]);

    const data = {
      threshold: thresholdNum,
      outOfStock: {
        count: outOfStock.length,
        products: outOfStock
      },
      lowStock: {
        count: lowStock.length,
        products: lowStock
      },
      totalAlerts: outOfStock.length + lowStock.length
    };

    await cache.set(cacheKey, data, 300); // 5 min — stock changes frequently

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 4. Dead Stock / Slow Movers ─────────────────────────────────────────────
// GET /api/analytics/products/dead-stock?daysSinceLastSale=30
// Active products that haven't sold within N days (or ever)

export const getDeadStock = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { daysSinceLastSale = 30, page = 1, limit = 20 } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const daysNum = parseInt(daysSinceLastSale);
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `analytics:products:dead-stock:store:${storeId}:days:${daysNum}:page:${pageNum}:limit:${limitNum}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Products with stock > 0 that are active
    const activeProducts = await prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        isDeleted: false,
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        images: true,
        price: true,
        stock: true,
        category: true,
        quantityBought: true,
        createdAt: true,
        url: true,
        orderItems: {
          where: {
            order: {
              paymentStatus: 'SUCCESS',
              paidAt: { gte: cutoffDate }
            }
          },
          select: { id: true }
        }
      }
    });

    // Dead stock = no successful order items in the last N days
    const deadStock = activeProducts
      .filter(p => p.orderItems.length === 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        images: p.images,
        price: p.price,
        stock: p.stock,
        category: p.category,
        totalEverSold: p.quantityBought,
        neverSold: p.quantityBought === 0,
        createdAt: p.createdAt,
        url: p.url,
        capitalTied: parseFloat((p.price * p.stock).toFixed(2)) // estimated inventory value
      }))
      .sort((a, b) => b.capitalTied - a.capitalTied); // highest tied capital first

    const total = deadStock.length;
    const paginated = deadStock.slice(skip, skip + limitNum);
    const totalCapitalTied = deadStock.reduce((sum, p) => sum + p.capitalTied, 0);

    const data = {
      daysSinceLastSale: daysNum,
      deadStock: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        totalDeadStockProducts: total,
        neverSoldCount: deadStock.filter(p => p.neverSold).length,
        estimatedCapitalTied: parseFloat(totalCapitalTied.toFixed(2))
      }
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching dead stock:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 5. Revenue Per Product (from OrderItems) ────────────────────────────────
// GET /api/analytics/products/revenue?period=30d&limit=10
// Actual revenue per product from paid order items — more accurate than quantityBought

export const getRevenuePerProduct = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d', limit = 10 } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const limitNum = Math.min(parseInt(limit), 50);
    const cacheKey = `analytics:products:revenue:store:${storeId}:period:${period}:limit:${limitNum}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    // Aggregate from OrderItem directly — the source of truth
    const orderItemAgg = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          storeId,
          paymentStatus: 'SUCCESS',
          paidAt: { gte: startDate }
        }
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    });

    if (orderItemAgg.length === 0) {
      return res.status(200).json({
        success: true,
        data: { period, products: [], totalRevenue: 0 }
      });
    }

    // Fetch product details for matched IDs
    const productIds = orderItemAgg.map(a => a.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, images: true, price: true, category: true, url: true }
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Compute revenue per product
    const enriched = orderItemAgg
      .map(agg => {
        const product = productMap.get(agg.productId);
        if (!product) return null;
        const unitsSold = agg._sum.quantity || 0;
        const revenue = parseFloat((unitsSold * product.price).toFixed(2));
        return {
          productId: agg.productId,
          name: product.name,
          images: product.images,
          price: product.price,
          category: product.category,
          url: product.url,
          unitsSold,
          orderCount: agg._count.id,
          revenue
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limitNum);

    const totalRevenue = enriched.reduce((sum, p) => sum + p.revenue, 0);

    const data = {
      period,
      products: enriched,
      totalRevenue: parseFloat(totalRevenue.toFixed(2))
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching revenue per product:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 6. Category Performance ─────────────────────────────────────────────────
// GET /api/analytics/products/categories?period=30d
// Revenue, units sold, and product count grouped by category for this seller's store

export const getCategoryPerformance = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d' } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:products:categories:store:${storeId}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    // All products in this store with their sales in the period
    const products = await prisma.product.findMany({
      where: { storeId, isDeleted: false },
      select: {
        id: true,
        category: true,
        price: true,
        isActive: true,
        orderItems: {
          where: {
            order: {
              paymentStatus: 'SUCCESS',
              paidAt: { gte: startDate }
            }
          },
          select: { quantity: true, price: true }
        }
      }
    });

    // Group by category
    const categoryMap = new Map();

    for (const product of products) {
      const cat = product.category || 'Uncategorised';

      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          category: cat,
          productCount: 0,
          activeProductCount: 0,
          unitsSold: 0,
          revenue: 0,
          orderItemCount: 0
        });
      }

      const entry = categoryMap.get(cat);
      entry.productCount += 1;
      if (product.isActive) entry.activeProductCount += 1;

      for (const item of product.orderItems) {
        entry.unitsSold += item.quantity;
        entry.revenue += item.price * item.quantity;
        entry.orderItemCount += 1;
      }
    }

    const categories = Array.from(categoryMap.values())
      .map(c => ({ ...c, revenue: parseFloat(c.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);

    // Add revenue share %
    const enriched = categories.map(c => ({
      ...c,
      revenueShare: totalRevenue > 0
        ? parseFloat(((c.revenue / totalRevenue) * 100).toFixed(2))
        : 0
    }));

    const data = {
      period,
      categories: enriched,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCategories: enriched.length
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching category performance:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// ─── 7. Stock Movement (Derived from OrderItems) ─────────────────────────────
// GET /api/analytics/products/stock-movement?period=30d&productId=optional
// How stock has moved over time, derived from paid order items

export const getStockMovement = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d', productId } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:products:stock-movement:store:${storeId}:period:${period}:product:${productId || 'all'}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const orderItemWhere = {
      order: {
        storeId,
        paymentStatus: 'SUCCESS',
        paidAt: { gte: startDate }
      }
    };

    if (productId) {
      // Verify the product belongs to this store
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId },
        select: { id: true }
      });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found in your store.' });
      }
      orderItemWhere.productId = productId;
    }

    const orderItems = await prisma.orderItem.findMany({
      where: orderItemWhere,
      select: {
        productId: true,
        quantity: true,
        price: true,
        order: { select: { paidAt: true } },
        product: { select: { name: true, stock: true } }
      },
      orderBy: { order: { paidAt: 'asc' } }
    });

    // Group by day
    const dailyMap = new Map();

    for (const item of orderItems) {
      const dateKey = item.order.paidAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, unitsSold: 0, revenue: 0, orderLines: 0 });
      }
      const day = dailyMap.get(dateKey);
      day.unitsSold += item.quantity;
      day.revenue += item.price * item.quantity;
      day.orderLines += 1;
    }

    const timeline = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({ ...d, revenue: parseFloat(d.revenue.toFixed(2)) }));

    const totalUnitsSold = timeline.reduce((sum, d) => sum + d.unitsSold, 0);
    const totalRevenue = timeline.reduce((sum, d) => sum + d.revenue, 0);

    const data = {
      period,
      productId: productId || null,
      timeline,
      summary: {
        totalUnitsSold,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        averageDailySales: timeline.length > 0
          ? parseFloat((totalUnitsSold / timeline.length).toFixed(2))
          : 0
      }
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching stock movement:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// GET /api/analytics/customers/snapshot
// Total customers, new vs returning split, repeat purchase rate

export const getCustomerSnapshot = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:customers:snapshot:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    // All successful orders for this store grouped by buyer
    const buyerOrderCounts = await prisma.order.groupBy({
      by: ['buyerId'],
      where: { storeId, paymentStatus: 'SUCCESS' },
      _count: { id: true },
      _sum: { totalAmount: true }
    });

    const totalCustomers = buyerOrderCounts.length;
    const returningCustomers = buyerOrderCounts.filter(b => b._count.id > 1).length;
    const newCustomers = totalCustomers - returningCustomers;
    const repeatPurchaseRate = totalCustomers > 0
      ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(2))
      : 0;

    const totalRevenue = buyerOrderCounts.reduce((sum, b) => sum + (b._sum.totalAmount || 0), 0);
    const averageLifetimeValue = totalCustomers > 0
      ? parseFloat((totalRevenue / totalCustomers).toFixed(2))
      : 0;
    const averageOrdersPerCustomer = totalCustomers > 0
      ? parseFloat((buyerOrderCounts.reduce((sum, b) => sum + b._count.id, 0) / totalCustomers).toFixed(2))
      : 0;

    const data = {
      totalCustomers,
      newCustomers,
      returningCustomers,
      repeatPurchaseRate,
      averageLifetimeValue,
      averageOrdersPerCustomer
    };

    await cache.set(cacheKey, data, 900);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer snapshot:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// GET /api/analytics/customers/trend?period=30d
// Daily new vs returning customer trend for charting

export const getCustomerTrend = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d' } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:customers:trend:store:${storeId}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    // All successful orders in the period
    const ordersInPeriod = await prisma.order.findMany({
      where: {
        storeId,
        paymentStatus: 'SUCCESS',
        paidAt: { gte: startDate }
      },
      select: { buyerId: true, paidAt: true },
      orderBy: { paidAt: 'asc' }
    });

    // Find each buyer's very first order date for this store (all time, not just period)
    const buyerIds = [...new Set(ordersInPeriod.map(o => o.buyerId))];

    const firstOrders = await prisma.order.groupBy({
      by: ['buyerId'],
      where: {
        storeId,
        paymentStatus: 'SUCCESS',
        buyerId: { in: buyerIds }
      },
      _min: { paidAt: true }
    });

    const firstOrderMap = new Map(
      firstOrders.map(f => [f.buyerId, f._min.paidAt])
    );

    // Group by day, classify new vs returning
    const dailyMap = new Map();

    for (const order of ordersInPeriod) {
      const dateKey = order.paidAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, newCustomers: 0, returningCustomers: 0, total: 0 });
      }

      const day = dailyMap.get(dateKey);
      day.total += 1;

      // A customer is "new" on a given day if their first-ever order was on that day
      const firstOrderDate = firstOrderMap.get(order.buyerId);
      const isNewToday = firstOrderDate &&
        firstOrderDate.toISOString().split('T')[0] === dateKey;

      if (isNewToday) {
        day.newCustomers += 1;
      } else {
        day.returningCustomers += 1;
      }
    }

    const timeline = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const data = { period, timeline };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer trend:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// GET /api/analytics/customers/top?limit=10&period=30d
// Ranked list of highest-value buyers with order history

export const getTopCustomers = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { limit = 10, period = 'all' } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const limitNum = Math.min(parseInt(limit), 50);
    const cacheKey = `analytics:customers:top:store:${storeId}:limit:${limitNum}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const orderWhere = { storeId, paymentStatus: 'SUCCESS' };

    if (period !== 'all') {
      const now = new Date();
      let startDate = new Date(now);
      switch (period) {
        case '7d':  startDate.setDate(startDate.getDate() - 7); break;
        case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
        case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
        case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
        default:
          return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', '1y', or 'all'." });
      }
      orderWhere.paidAt = { gte: startDate };
    }

    const buyerAggregates = await prisma.order.groupBy({
      by: ['buyerId'],
      where: orderWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
      _max: { paidAt: true },
      _min: { paidAt: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limitNum
    });

    if (buyerAggregates.length === 0) {
      return res.status(200).json({ success: true, data: { period, customers: [] } });
    }

    // Fetch buyer profiles
    const buyerIds = buyerAggregates.map(b => b.buyerId);
    const buyers = await prisma.user.findMany({
      where: { id: { in: buyerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        points: true,
        createdAt: true
      }
    });

    const buyerMap = new Map(buyers.map(b => [b.id, b]));

    const customers = buyerAggregates.map(agg => {
      const buyer = buyerMap.get(agg.buyerId);
      return {
        buyerId: agg.buyerId,
        firstName: buyer?.firstName || 'Unknown',
        lastName: buyer?.lastName || '',
        email: buyer?.email || '',
        avatar: buyer?.avatar || null,
        loyaltyPoints: buyer?.points || 0,
        totalSpend: parseFloat((agg._sum.totalAmount || 0).toFixed(2)),
        orderCount: agg._count.id,
        averageOrderValue: agg._count.id > 0
          ? parseFloat(((agg._sum.totalAmount || 0) / agg._count.id).toFixed(2))
          : 0,
        firstOrderAt: agg._min.paidAt,
        lastOrderAt: agg._max.paidAt
      };
    });

    const data = { period, customers };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};


// GET /api/analytics/customers/clv
// Average CLV, CLV distribution buckets, and trend

export const getCustomerLifetimeValue = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:customers:clv:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const buyerTotals = await prisma.order.groupBy({
      by: ['buyerId'],
      where: { storeId, paymentStatus: 'SUCCESS' },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    if (buyerTotals.length === 0) {
      return res.status(200).json({
        success: true,
        data: { averageCLV: 0, medianCLV: 0, buckets: [], totalCustomers: 0 }
      });
    }

    const clvValues = buyerTotals
      .map(b => b._sum.totalAmount || 0)
      .sort((a, b) => a - b);

    const totalCustomers = clvValues.length;
    const averageCLV = parseFloat((clvValues.reduce((s, v) => s + v, 0) / totalCustomers).toFixed(2));

    // Median
    const mid = Math.floor(totalCustomers / 2);
    const medianCLV = parseFloat((
      totalCustomers % 2 !== 0
        ? clvValues[mid]
        : (clvValues[mid - 1] + clvValues[mid]) / 2
    ).toFixed(2));

    // CLV distribution buckets — useful for bar chart
    const max = clvValues[clvValues.length - 1];
    const bucketSize = max <= 100 ? 20 : max <= 500 ? 100 : max <= 2000 ? 500 : 1000;

    const bucketMap = new Map();
    for (const val of clvValues) {
      const bucketStart = Math.floor(val / bucketSize) * bucketSize;
      const label = `${bucketStart}–${bucketStart + bucketSize}`;
      bucketMap.set(label, (bucketMap.get(label) || 0) + 1);
    }

    const buckets = Array.from(bucketMap.entries()).map(([range, count]) => ({ range, count }));

    // Simple CLV segments
    const highValue = clvValues.filter(v => v >= averageCLV * 1.5).length;
    const midValue  = clvValues.filter(v => v >= averageCLV * 0.5 && v < averageCLV * 1.5).length;
    const lowValue  = clvValues.filter(v => v < averageCLV * 0.5).length;

    const data = {
      totalCustomers,
      averageCLV,
      medianCLV,
      buckets,
      segments: {
        highValue: { count: highValue, threshold: parseFloat((averageCLV * 1.5).toFixed(2)) },
        midValue:  { count: midValue },
        lowValue:  { count: lowValue, threshold: parseFloat((averageCLV * 0.5).toFixed(2)) }
      }
    };

    await cache.set(cacheKey, data, 3600);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching CLV:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// GET /api/analytics/customers/inactive?daysSinceLastOrder=60&page=1&limit=20
// Buyers who haven't ordered in N days — approximation of churn

export const getInactiveCustomers = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { daysSinceLastOrder = 60, page = 1, limit = 20 } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const daysNum = parseInt(daysSinceLastOrder);
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `analytics:customers:inactive:store:${storeId}:days:${daysNum}:page:${pageNum}:limit:${limitNum}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);

    // Last order date per buyer
    const buyerLastOrders = await prisma.order.groupBy({
      by: ['buyerId'],
      where: { storeId, paymentStatus: 'SUCCESS' },
      _max: { paidAt: true },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    // Filter: last order before cutoff
    const inactive = buyerLastOrders
      .filter(b => b._max.paidAt && b._max.paidAt < cutoff)
      .sort((a, b) => new Date(b._max.paidAt) - new Date(a._max.paidAt)); // most recently lapsed first

    const total = inactive.length;
    const paginated = inactive.slice(skip, skip + limitNum);

    if (paginated.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          daysSinceLastOrder: daysNum,
          customers: [],
          pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
          summary: { totalInactive: 0, estimatedLostRevenue: 0 }
        }
      });
    }

    // Fetch buyer profiles for the paginated slice
    const buyerIds = paginated.map(b => b.buyerId);
    const buyers = await prisma.user.findMany({
      where: { id: { in: buyerIds } },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true
      }
    });

    const buyerMap = new Map(buyers.map(b => [b.id, b]));

    const customers = paginated.map(b => {
      const buyer = buyerMap.get(b.buyerId);
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(b._max.paidAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        buyerId: b.buyerId,
        firstName: buyer?.firstName || 'Unknown',
        lastName: buyer?.lastName || '',
        email: buyer?.email || '',
        avatar: buyer?.avatar || null,
        lastOrderAt: b._max.paidAt,
        daysSinceLastOrder: daysSinceLast,
        totalSpend: parseFloat((b._sum.totalAmount || 0).toFixed(2)),
        orderCount: b._count.id,
        averageOrderValue: b._count.id > 0
          ? parseFloat(((b._sum.totalAmount || 0) / b._count.id).toFixed(2))
          : 0
      };
    });

    // Estimated lost revenue = average order value of inactive customers
    // (what you'd expect if they'd placed one more order)
    const estimatedLostRevenue = parseFloat(
      inactive
        .reduce((sum, b) => {
          const avg = b._count.id > 0 ? (b._sum.totalAmount || 0) / b._count.id : 0;
          return sum + avg;
        }, 0)
        .toFixed(2)
    );

    const data = {
      daysSinceLastOrder: daysNum,
      customers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        totalInactive: total,
        estimatedLostRevenue
      }
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching inactive customers:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// GET /api/analytics/customers/frequency
// How many customers ordered 1x, 2x, 3x, 4x, 5x+ — bar chart data

export const getPurchaseFrequency = async (req, res) => {
  try {
    const sellerId = req.user.userId;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:customers:frequency:store:${storeId}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const buyerOrderCounts = await prisma.order.groupBy({
      by: ['buyerId'],
      where: { storeId, paymentStatus: 'SUCCESS' },
      _count: { id: true }
    });

    // Build frequency buckets: 1, 2, 3, 4, 5+
    const frequencyMap = { 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };

    for (const buyer of buyerOrderCounts) {
      const count = buyer._count.id;
      if (count >= 5) frequencyMap['5+'] += 1;
      else frequencyMap[count] = (frequencyMap[count] || 0) + 1;
    }

    const totalCustomers = buyerOrderCounts.length;
    const distribution = Object.entries(frequencyMap).map(([orders, customers]) => ({
      orders,
      customers,
      percentage: totalCustomers > 0
        ? parseFloat(((customers / totalCustomers) * 100).toFixed(2))
        : 0
    }));

    const totalOrders = buyerOrderCounts.reduce((sum, b) => sum + b._count.id, 0);

    const data = {
      distribution,
      totalCustomers,
      totalOrders,
      averageOrdersPerCustomer: totalCustomers > 0
        ? parseFloat((totalOrders / totalCustomers).toFixed(2))
        : 0
    };

    await cache.set(cacheKey, data, 3600);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching purchase frequency:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// GET /api/analytics/customers/aov?period=30d
// AOV over time — tells you if customers are spending more or less per order

export const getAverageOrderValueTrend = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { period = '30d' } = req.query;

    const store = await getSellerStore(sellerId);
    if (!store) {
      return res.status(400).json({ success: false, message: 'Store not found.' });
    }

    const storeId = store.id;
    const cacheKey = `analytics:customers:aov:store:${storeId}:period:${period}`;

    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case '7d':  startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setMonth(startDate.getMonth() - 1); break;
      case '90d': startDate.setMonth(startDate.getMonth() - 3); break;
      case '1y':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:
        return res.status(400).json({ success: false, message: "Invalid period. Use '7d', '30d', '90d', or '1y'." });
    }

    const orders = await prisma.order.findMany({
      where: {
        storeId,
        paymentStatus: 'SUCCESS',
        paidAt: { gte: startDate }
      },
      select: { totalAmount: true, paidAt: true, buyerId: true }
    });

    // Group by day
    const dailyMap = new Map();
    for (const order of orders) {
      const dateKey = order.paidAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, totalRevenue: 0, orderCount: 0, uniqueBuyers: new Set() });
      }
      const day = dailyMap.get(dateKey);
      day.totalRevenue += order.totalAmount;
      day.orderCount += 1;
      day.uniqueBuyers.add(order.buyerId);
    }

    const timeline = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({
        date: d.date,
        aov: d.orderCount > 0 ? parseFloat((d.totalRevenue / d.orderCount).toFixed(2)) : 0,
        orderCount: d.orderCount,
        uniqueBuyers: d.uniqueBuyers.size,
        totalRevenue: parseFloat(d.totalRevenue.toFixed(2))
      }));

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const overallAOV = totalOrders > 0
      ? parseFloat((totalRevenue / totalOrders).toFixed(2))
      : 0;

    const data = {
      period,
      overallAOV,
      totalOrders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      timeline
    };

    await cache.set(cacheKey, data, 1800);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching AOV trend:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

