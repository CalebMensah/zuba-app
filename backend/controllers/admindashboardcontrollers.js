import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';

const CACHE_TTL = {
  DASHBOARD_SUMMARY: 300,
  SALES_ANALYTICS: 600,
  TOP_STORES: 600,
  USER_GROWTH: 3600,
  VERIFICATIONS: 180,
  DISPUTES: 180,
};

const getCacheKey = (prefix, params = {}) => {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');
  return paramString ? `${prefix}:${paramString}` : prefix;
};

const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  
  if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100.');
  }
  
  return { page: pageNum, limit: limitNum };
};

const validatePeriod = (period) => {
  const validPeriods = ['7d', '30d', '90d', '365d'];
  if (!validPeriods.includes(period)) {
    throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
  }
  
  const now = new Date();
  const startDate = new Date(now);
  
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '365d':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  
  return { startDate, endDate: now };
};

const groupByDate = (items, dateField = 'createdAt', valueField = null) => {
  const grouped = {};
  
  for (const item of items) {
    const date = new Date(item[dateField]);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = valueField ? 0 : [];
    }
    
    if (valueField) {
      grouped[dateKey] += Number(item[valueField]) || 0;
    } else {
      grouped[dateKey].push(item);
    }
  }
  
  return grouped;
};

export const getAdminDashboardSummary = async (req, res) => {
  try {
    const cacheKey = getCacheKey('admin:dashboard:summary');
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const previous30Days = new Date(last30Days);
    previous30Days.setDate(previous30Days.getDate() - 30);

    const [
      totalUsers,
      usersLast30Days,
      usersPrevious30Days,
      totalStores,
      storesLast30Days,
      totalActiveStores,
      totalProducts,
      totalActiveProducts,
      totalOrders,
      ordersLast30Days,
      totalSuccessfulOrders,
      revenueData,
      revenueLast30Days,
      totalPendingVerifications,
      totalPendingDisputes,
      totalReviews,
      averageRating
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: last30Days } }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: previous30Days,
            lt: last30Days
          }
        }
      }),
      prisma.store.count(),
      prisma.store.count({
        where: { createdAt: { gte: last30Days } }
      }),
      prisma.store.count({
        where: { isActive: true }
      }),
      prisma.product.count(),
      prisma.product.count({
        where: { isActive: true }
      }),
      prisma.order.count(),
      prisma.order.count({
        where: { createdAt: { gte: last30Days } }
      }),
      prisma.order.count({
        where: { paymentStatus: 'SUCCESS' }
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'SUCCESS' }
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'SUCCESS',
          createdAt: { gte: last30Days }
        }
      }),
      prisma.storeVerification.count({
        where: { status: 'pending' }
      }),
      prisma.dispute.count({
        where: { status: 'PENDING' }
      }),
      prisma.review.count(),
      prisma.review.aggregate({
        _avg: { rating: true }
      })
    ]);

    const userGrowth = usersPrevious30Days > 0
      ? ((usersLast30Days - usersPrevious30Days) / usersPrevious30Days * 100).toFixed(1)
      : 0;

    const summary = {
      users: {
        total: totalUsers || 0,
        last30Days: usersLast30Days || 0,
        growth: parseFloat(userGrowth)
      },
      stores: {
        total: totalStores || 0,
        active: totalActiveStores || 0,
        last30Days: storesLast30Days || 0,
        inactive: (totalStores - totalActiveStores) || 0
      },
      products: {
        total: totalProducts || 0,
        active: totalActiveProducts || 0,
        inactive: (totalProducts - totalActiveProducts) || 0
      },
      orders: {
        total: totalOrders || 0,
        successful: totalSuccessfulOrders || 0,
        last30Days: ordersLast30Days || 0,
        successRate: totalOrders > 0 
          ? ((totalSuccessfulOrders / totalOrders) * 100).toFixed(1)
          : 0
      },
      revenue: {
        total: parseFloat((revenueData._sum.totalAmount || 0).toFixed(2)),
        last30Days: parseFloat((revenueLast30Days._sum.totalAmount || 0).toFixed(2)),
        averageOrderValue: totalSuccessfulOrders > 0
          ? parseFloat(((revenueData._sum.totalAmount || 0) / totalSuccessfulOrders).toFixed(2))
          : 0
      },
      reviews: {
        total: totalReviews || 0,
        averageRating: parseFloat((averageRating._avg.rating || 0).toFixed(2))
      },
      pending: {
        verifications: totalPendingVerifications || 0,
        disputes: totalPendingDisputes || 0
      },
      timestamp: new Date().toISOString()
    };

    await cache.set(cacheKey, JSON.stringify(summary), CACHE_TTL.DASHBOARD_SUMMARY);

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching admin dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getSalesAndRevenueAnalytics = async (req, res) => {
  try {
    const period = req.query.period || '30d';
    
    const { startDate, endDate } = validatePeriod(period);
    
    const cacheKey = getCacheKey('admin:analytics:sales', { period });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'SUCCESS',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        totalAmount: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const salesByDate = {};
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          revenue: 0,
          orders: 0
        };
      }
      
      salesByDate[dateKey].revenue += Number(order.totalAmount);
      salesByDate[dateKey].orders += 1;
    }

    const result = Object.values(salesByDate)
      .map(day => ({
        ...day,
        revenue: parseFloat(day.revenue.toFixed(2)),
        averageOrderValue: parseFloat((day.revenue / day.orders).toFixed(2))
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate totals
    const totals = {
      totalRevenue: parseFloat(result.reduce((sum, day) => sum + day.revenue, 0).toFixed(2)),
      totalOrders: result.reduce((sum, day) => sum + day.orders, 0),
      averageOrderValue: 0,
      daysWithSales: result.length
    };
    
    totals.averageOrderValue = totals.totalOrders > 0
      ? parseFloat((totals.totalRevenue / totals.totalOrders).toFixed(2))
      : 0;

    const responseData = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: result,
      totals
    };

    await cache.set(cacheKey, CACHE_TTL.SALES_ANALYTICS, JSON.stringify(responseData));

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching sales and revenue analytics:', error);
    
    if (error.message.includes('Invalid period')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getTopPerformingStores = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'revenue';
    const period = req.query.period || '30d';

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    if (!['revenue', 'orders'].includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: "sortBy must be 'revenue' or 'orders'"
      });
    }

    const { startDate } = validatePeriod(period);
    
    const cacheKey = getCacheKey('admin:analytics:top-stores', { limit, sortBy, period });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const storePerformance = await prisma.order.groupBy({
      by: ['storeId'],
      where: {
        paymentStatus: 'SUCCESS',
        createdAt: { gte: startDate }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      },
      orderBy: sortBy === 'revenue' 
        ? { _sum: { totalAmount: 'desc' } }
        : { _count: { id: 'desc' } },
      take: limit
    });

    const storeIds = storePerformance.map(s => s.storeId);
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: {
        id: true,
        name: true,
        url: true,
        category: true,
        rating: true,
        user: {
          select: {
            id: true,
            firstName: true,
            email: true
          }
        }
      }
    });

    const storeMap = new Map(stores.map(s => [s.id, s]));

    const topStores = storePerformance
      .map(perf => {
        const store = storeMap.get(perf.storeId);
        if (!store) return null;

        return {
          id: store.id,
          name: store.name,
          url: store.url,
          category: store.category,
          rating: parseFloat((store.rating || 0).toFixed(2)),
          seller: {
            id: store.user?.id,
            name: store.user?.firstName || 'Unknown',
            email: store.user?.email
          },
          performance: {
            totalOrders: perf._count.id,
            totalRevenue: parseFloat((perf._sum.totalAmount || 0).toFixed(2)),
            averageOrderValue: parseFloat(
              ((perf._sum.totalAmount || 0) / perf._count.id).toFixed(2)
            )
          }
        };
      })
      .filter(Boolean);

    const responseData = {
      period,
      sortBy,
      limit,
      stores: topStores
    };

    await cache.set(cacheKey, JSON.stringify(responseData), CACHE_TTL.TOP_STORES);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching top performing stores:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top stores',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getUserGrowthAnalytics = async (req, res) => {
  try {
    const period = req.query.period || '30d';
    
    const { startDate, endDate } = validatePeriod(period);
    
    const cacheKey = getCacheKey('admin:analytics:user-growth', { period });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        createdAt: true,
        role: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const growthByDate = {};
    for (const user of users) {
      const dateKey = user.createdAt.toISOString().split('T')[0];
      
      if (!growthByDate[dateKey]) {
        growthByDate[dateKey] = {
          date: dateKey,
          newUsers: 0,
          buyers: 0,
          sellers: 0
        };
      }
      
      growthByDate[dateKey].newUsers += 1;
      
      if (user.role === 'BUYER') {
        growthByDate[dateKey].buyers += 1;
      } else if (user.role === 'SELLER') {
        growthByDate[dateKey].sellers += 1;
      }
    }

    const result = Object.values(growthByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let cumulativeTotal = 0;
    result.forEach(day => {
      cumulativeTotal += day.newUsers;
      day.cumulativeTotal = cumulativeTotal;
    });

    const responseData = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: result,
      summary: {
        totalNewUsers: users.length,
        totalBuyers: users.filter(u => u.role === 'BUYER').length,
        totalSellers: users.filter(u => u.role === 'SELLER').length,
        averagePerDay: result.length > 0 
          ? parseFloat((users.length / result.length).toFixed(2))
          : 0
      }
    };

    await cache.set(cacheKey, JSON.stringify(responseData), CACHE_TTL.USER_GROWTH);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching user growth analytics:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getPendingStoreVerifications = async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const skip = (page - 1) * limit;

    const cacheKey = getCacheKey('admin:pending-verifications', { page, limit });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const [verifications, total] = await Promise.all([
      prisma.storeVerification.findMany({
        where: { status: 'pending' },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true,
              category: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
      }),
      prisma.storeVerification.count({ where: { status: 'pending' } })
    ]);

    const responseData = {
      verifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };

    await cache.set(cacheKey, JSON.stringify(responseData), CACHE_TTL.VERIFICATIONS);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending verifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getPendingDisputes = async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const skip = (page - 1) * limit;

    const cacheKey = getCacheKey('admin:pending-disputes', { page, limit });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: { status: 'PENDING' },
        include: {
          order: {
            select: {
              id: true,
              totalAmount: true,
              status: true,
              createdAt: true
            }
          },
          buyer: {
            select: {
              id: true,
              firstName: true,
              email: true
            }
          },
          sellerId: {
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
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
      }),
      prisma.dispute.count({ where: { status: 'PENDING' } })
    ]);

    const responseData = {
      disputes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };

    await cache.set(cacheKey, JSON.stringify(responseData), CACHE_TTL.DISPUTES);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching pending disputes:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending disputes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getCategoryPerformance = async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const { startDate } = validatePeriod(period);

    const cacheKey = getCacheKey('admin:analytics:categories', { period });
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const categoryData = await prisma.store.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    const categoryPerformance = await Promise.all(
      categoryData.map(async (cat) => {
        const stores = await prisma.store.findMany({
          where: { category: cat.category, isActive: true },
          select: { id: true }
        });

        const storeIds = stores.map(s => s.id);

        const [orderStats, revenueStats] = await Promise.all([
          prisma.order.count({
            where: {
              storeId: { in: storeIds },
              paymentStatus: 'SUCCESS',
              createdAt: { gte: startDate }
            }
          }),
          prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: {
              storeId: { in: storeIds },
              paymentStatus: 'SUCCESS',
              createdAt: { gte: startDate }
            }
          })
        ]);

        return {
          category: cat.category,
          totalStores: cat._count.id,
          totalOrders: orderStats,
          totalRevenue: parseFloat((revenueStats._sum.totalAmount || 0).toFixed(2)),
          averageRevenuePerStore: cat._count.id > 0
            ? parseFloat(((revenueStats._sum.totalAmount || 0) / cat._count.id).toFixed(2))
            : 0
        };
      })
    );

    // Sort by revenue
    categoryPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const responseData = {
      period,
      categories: categoryPerformance,
      summary: {
        totalCategories: categoryPerformance.length,
        totalRevenue: parseFloat(
          categoryPerformance.reduce((sum, cat) => sum + cat.totalRevenue, 0).toFixed(2)
        ),
        totalOrders: categoryPerformance.reduce((sum, cat) => sum + cat.totalOrders, 0)
      }
    };

    // Cache the result
    await cache.set(cacheKey, JSON.stringify(responseData), CACHE_TTL.SALES_ANALYTICS);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching category performance:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


