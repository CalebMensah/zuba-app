import prisma from "../config/prisma.js"


export const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, search = "", role } = req.query;

  try {
    const skip = (Number(page) - 1) * Number(limit);

    // Build filters
    const filters = {
      AND: [
        role ? { role } : {},

        search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    // Fetch users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.user.count({ where: filters }),
    ]);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development"
        ? error.message
        : undefined,
    });
  }
};

export const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        store: true, // optional if you want store info
      },
    });
    console.log('Fetched user:', user.accessToken);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive data
    const {
      password: _,
      verificationCode: __,
      verificationExpiry: ___,
      ...userWithoutSensitiveData
    } = user;

    res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const suspendUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'User is already suspended',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: true },
    });

    res.status(200).json({
      success: true,
      message: 'User suspended successfully',
      userId: updatedUser.id,
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const reactivateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'User is not suspended',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false },
    });

    res.status(200).json({
      success: true,
      message: 'User reactivated successfully',
      userId: updatedUser.id,
    });

  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete avatar if exists
    if (user.avatar) {
      await deleteFromCloudinary(user.avatar);
    }

    // Delete user from DB
    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      userId,
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getAllStores = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isSuspended: true
          }
        },
        verification: true,
      }
    });

    res.status(200).json({
      success: true,
      message: 'Stores fetched successfully',
      data: stores,
    });

  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const suspendStore = async (req, res) => {
  const { storeId } = req.params;

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    if (store.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'Store is already suspended',
      });
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: { isSuspended: true },
    });

    res.status(200).json({
      success: true,
      message: 'Store suspended successfully',
      storeId: updated.id,
    });

  } catch (error) {
    console.error('Suspend store error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const reactivateStore = async (req, res) => {
  const { storeId } = req.params;

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    if (!store.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'Store is not suspended',
      });
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: { isSuspended: false },
    });

    res.status(200).json({
      success: true,
      message: 'Store reactivated successfully',
      storeId: updated.id,
    });

  } catch (error) {
    console.error('Reactivate store error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export const deleteStore = async (req, res) => {
  const { storeId } = req.params;

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { verification: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    // Delete logo if exists
    if (store.logo) {
      await deleteFromCloudinary(store.logo);
    }

    // Delete verification record
    if (store.verification) {
      await prisma.storeVerification.delete({
        where: { id: store.verification.id },
      });
    }

    // Delete store
    await prisma.store.delete({
      where: { id: storeId },
    });

    res.status(200).json({
      success: true,
      message: 'Store deleted successfully',
      storeId,
    });

  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getAllOrdersForAdmin = async (req, res) => {
  try {
    // Admin authorization is handled by middleware (e.g., authorizeAdmin)
    const {
      page = 1,
      limit = 20,
      status,            // e.g., 'PENDING', 'CONFIRMED'
      paymentStatus,     // e.g., 'SUCCESS', 'FAILED'
      buyerId,           // Filter by specific buyer ID
      sellerId,          // Filter by specific seller ID (store owner)
      startDate,         // ISO string for date range filtering
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    // Build the where clause dynamically
    const whereClause = {};

    // Apply status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Apply payment status filter if provided
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }

    // Apply buyer ID filter if provided
    if (buyerId) {
      whereClause.buyerId = buyerId;
    }

    // Apply seller ID filter (find stores where userId matches sellerId)
    if (sellerId) {
      whereClause.store = {
        userId: sellerId
      };
    }

    // Apply date range filter if provided
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate);
      }
    }

    // Validate sort field
    const validSortFields = ['createdAt', 'totalAmount', 'status', 'paymentStatus'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}.`
      });
    }

    // Fetch orders with filters, pagination, and sorting
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: offset,
        take: limitNum,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true }
              }
            }
          },
          deliveryInfo: {
            select: { status: true, trackingNumber: true }
          },
          buyer: {
            select: { id: true, firstName: true, email: true }
          },
          store: {
            select: { id: true, name: true, url: true }
          }
        }
      }),
      prisma.order.count({ where: whereClause })
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: {
          status,
          paymentStatus,
          buyerId,
          sellerId,
          startDate,
          endDate,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all orders for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const deleteAllOrdersAndPayments = async (req, res) => {
  try {
    console.log('🗑️ Starting deletion of all orders and payments...');

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all escrows first (foreign key constraint)
      const deletedEscrows = await tx.escrow.deleteMany({});
      console.log(`✅ Deleted ${deletedEscrows.count} escrows`);

      // 2. Delete all payouts
      const deletedPayouts = await tx.payout.deleteMany({});
      console.log(`✅ Deleted ${deletedPayouts.count} payouts`);

      // 3. Delete all payments
      const deletedPayments = await tx.payment.deleteMany({});
      console.log(`✅ Deleted ${deletedPayments.count} payments`);

      // 4. Delete all order items
      const deletedOrderItems = await tx.orderItem.deleteMany({});
      console.log(`✅ Deleted ${deletedOrderItems.count} order items`);

      // 5. Delete all orders
      const deletedOrders = await tx.order.deleteMany({});
      console.log(`✅ Deleted ${deletedOrders.count} orders`);

      return {
        escrows: deletedEscrows.count,
        payouts: deletedPayouts.count,
        payments: deletedPayments.count,
        orderItems: deletedOrderItems.count,
        orders: deletedOrders.count
      };
    });

    // Clear all related caches
    console.log('🧹 Clearing Redis cache...');
    try {
      const keys = await cache.keys('*order*');
      const paymentKeys = await cache.keys('*payment*');
      const checkoutKeys = await cache.keys('*checkout*');
      
      const allKeys = [...keys, ...paymentKeys, ...checkoutKeys];
      
      if (allKeys.length > 0) {
        await Promise.all(allKeys.map(key => cache.del(key)));
        console.log(`✅ Cleared ${allKeys.length} cache keys`);
      }
    } catch (cacheError) {
      console.error('⚠️ Error clearing cache:', cacheError);
    }

    console.log('✅ All orders and payments deleted successfully');

    res.status(200).json({
      success: true,
      message: 'All orders and payments deleted successfully',
      deleted: result
    });

  } catch (error) {
    console.error('❌ Error deleting orders and payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete orders and payments',
      error: error.message
    });
  }
};

export const deleteUserOrdersAndPayments = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    console.log(`🗑️ Deleting orders and payments for user: ${userId}`);

    const result = await prisma.$transaction(async (tx) => {
      // Find all orders for this user (as buyer)
      const userOrders = await tx.order.findMany({
        where: { buyerId: userId },
        select: { id: true }
      });

      const orderIds = userOrders.map(o => o.id);

      if (orderIds.length === 0) {
        return {
          escrows: 0,
          payouts: 0,
          payments: 0,
          orderItems: 0,
          orders: 0
        };
      }

      // Delete related records
      const deletedEscrows = await tx.escrow.deleteMany({
        where: { orderId: { in: orderIds } }
      });

      const deletedPayouts = await tx.payout.deleteMany({
        where: { orderId: { in: orderIds } }
      });

      const deletedPayments = await tx.payment.deleteMany({
        where: { orderId: { in: orderIds } }
      });

      const deletedOrderItems = await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } }
      });

      const deletedOrders = await tx.order.deleteMany({
        where: { id: { in: orderIds } }
      });

      return {
        escrows: deletedEscrows.count,
        payouts: deletedPayouts.count,
        payments: deletedPayments.count,
        orderItems: deletedOrderItems.count,
        orders: deletedOrders.count
      };
    });

    // Clear user-specific caches
    await cache.del(`user:${userId}:orders`);
    for (const orderId of result.orders) {
      await cache.del(`order:${orderId}:user:${userId}`);
    }

    res.status(200).json({
      success: true,
      message: `Deleted all orders and payments for user ${userId}`,
      deleted: result
    });

  } catch (error) {
    console.error('❌ Error deleting user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user orders and payments',
      error: error.message
    });
  }
};