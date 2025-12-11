import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Product like controller error:', error);
    
    // Handle specific errors
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    
    if (error.message === 'ALREADY_LIKED') {
      return res.status(409).json({
        success: false,
        message: 'You have already liked this product.'
      });
    }
    
    if (error.message === 'NOT_LIKED') {
      return res.status(404).json({
        success: false,
        message: 'You have not liked this product.'
      });
    }
    
    // Generic error
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  });
};

// Sanitize product data
const sanitizeProduct = (product) => {
  if (!product) return null;
  
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    images: product.images,
    url: product.url,
    rating: product.rating,
    isActive: product.isActive,
    createdAt: product.createdAt,
    store: product.store ? {
      id: product.store.id,
      name: product.store.name,
      url: product.store.url
    } : null
  };
};

export const likeProduct = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Verify product exists and is active
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { 
        id: true, 
        isActive: true, 
        url: true, 
        storeId: true 
      }
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (!product.isActive) {
      throw new Error('PRODUCT_NOT_FOUND'); // Don't reveal inactive products
    }

    // Check if already liked (race condition protection)
    const existingLike = await tx.productLike.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (existingLike) {
      throw new Error('ALREADY_LIKED');
    }

    // Create like record
    const likeRecord = await tx.productLike.create({
      data: {
        userId,
        productId
      }
    });

    return { likeRecord, product };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`user:${userId}:liked:products`),
    cache.del(`product:${productId}:likes:count`),
    cache.del(`product:url:${result.product.url}`),
    cache.del(`store:${result.product.storeId}:products`)
  ]);

  res.status(201).json({
    success: true,
    message: 'Product liked successfully.',
    data: {
      likedAt: result.likeRecord.createdAt
    }
  });
});

export const unlikeProduct = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;

  // Delete like record
  let product;
  
  try {
    const deletedLike = await prisma.productLike.delete({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    // Get product info for cache invalidation
    product = await prisma.product.findUnique({
      where: { id: productId },
      select: { storeId: true, url: true }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new Error('NOT_LIKED');
    }
    throw error;
  }

  // Invalidate caches
  const cacheDeletes = [
    cache.del(`user:${userId}:liked:products`),
    cache.del(`product:${productId}:likes:count`)
  ];

  if (product) {
    cacheDeletes.push(
      cache.del(`product:url:${product.url}`),
      cache.del(`store:${product.storeId}:products`)
    );
  }

  await Promise.all(cacheDeletes);

  res.status(200).json({
    success: true,
    message: 'Product unliked successfully.'
  });
});

export const getMyLikedProducts = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = `user:${userId}:liked:products`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  // Fetch liked products
  const likedProducts = await prisma.productLike.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Filter out inactive products and sanitize
  const activeProducts = likedProducts
    .filter(lp => lp.product && lp.product.isActive)
    .map(lp => ({
      ...sanitizeProduct(lp.product),
      likedAt: lp.createdAt
    }));

  const resultData = {
    products: activeProducts,
    count: activeProducts.length
  };

  // Cache for 30 minutes
  await cache.set(cacheKey, 1800, JSON.stringify(resultData));

  res.status(200).json({
    success: true,
    data: resultData
  });
});

export const getProductLikeCount = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cacheKey = `product:${productId}:likes:count`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached !== null) {
    return res.status(200).json({
      success: true,
      data: { count: parseInt(cached) },
      cached: true
    });
  }

  // Verify product exists (but don't require it to be active for count)
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true }
  });

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND');
  }

  // Get like count
  const count = await prisma.productLike.count({
    where: { productId }
  });

  // Cache for 15 minutes
  await cache.set(cacheKey, 900, count.toString());

  res.status(200).json({
    success: true,
    data: { count }
  });
});

export const checkIfLiked = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.params;

  // Verify product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true }
  });

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND');
  }

  if (!product.isActive) {
    throw new Error('PRODUCT_NOT_FOUND'); // Don't reveal inactive products
  }

  // Check if liked
  const like = await prisma.productLike.findUnique({
    where: {
      userId_productId: {
        userId,
        productId
      }
    }
  });

  res.status(200).json({
    success: true,
    data: { 
      isLiked: !!like,
      ...(like && { likedAt: like.createdAt })
    }
  });
});

// Bulk check liked status for multiple products (useful for product listings)
export const bulkCheckLiked = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { productIds } = req.body;

  // Validate input
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'productIds must be a non-empty array'
    });
  }

  // Limit to 100 products at a time
  if (productIds.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Cannot check more than 100 products at once'
    });
  }

  // Validate all are CUIDs
  const cuidRegex = /^c[a-z0-9]{24}$/;
  const allValid = productIds.every(id => cuidRegex.test(id));
  
  if (!allValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid product ID format'
    });
  }

  // Get all like relationships
  const likes = await prisma.productLike.findMany({
    where: {
      userId,
      productId: { in: productIds }
    },
    select: {
      productId: true,
      createdAt: true
    }
  });

  // Create map of productId -> isLiked
  const likedMap = {};
  productIds.forEach(productId => {
    const like = likes.find(l => l.productId === productId);
    likedMap[productId] = {
      isLiked: !!like,
      ...(like && { likedAt: like.createdAt })
    };
  });

  res.status(200).json({
    success: true,
    data: likedMap
  });
});