import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';



export const likeProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required.'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not active.'
      });
    }

    try {
      const likeRecord = await prisma.productLike.create({
        data: {
          userId,
          productId
        }
      });

      await cache.del(`user:${userId}:liked:products`);
      await cache.del(`product:${productId}:likes:count`);
      await cache.del(`product:url:${product.url}`);
      await cache.del(`store:${product.storeId}:products`);

      res.status(201).json({
        success: true,
        message: 'Product liked successfully.',
        data: likeRecord
      });

    } catch (prismaError) {
      if (prismaError.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'You have already liked this product.'
        });
      }
      throw prismaError;
    }

  } catch (error) {
    console.error('Error liking product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const unlikeProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required.'
      });
    }

    const deletedLikeRecord = await prisma.productLike.delete({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    await cache.del(`user:${userId}:liked:products`);
    await cache.del(`product:${productId}:likes:count`);

    const product = await prisma.product.findUnique({
      where: { id: deletedLikeRecord.productId },
      select: { storeId: true, url: true }
    });

    if (product) {
      await cache.del(`product:url:${product.url}`);
      await cache.del(`store:${product.storeId}:products`);
    }

    res.status(200).json({
      success: true,
      message: 'Product unliked successfully.',
      data: deletedLikeRecord
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'You have not liked this product.'
      });
    }
    console.error('Error unliking product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getMyLikedProducts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `user:${userId}:liked:products`;

    const cachedLikedProducts = await cache.get(cacheKey);
    if (cachedLikedProducts) {
      return res.status(200).json({
        success: true,
        data: cachedLikedProducts,
        cached: true
      });
    }

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

    const resultData = {
      products: likedProducts.map(lp => lp.product)
    };

    await cache.set(cacheKey, resultData, 1800);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching user liked products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getProductLikeCount = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not active.'
      });
    }

    const cacheKey = `product:${productId}:likes:count`;

    const cachedCount = await cache.get(cacheKey);
    if (cachedCount !== null) {
      return res.status(200).json({
        success: true,
        data: { count: cachedCount }
      });
    }

    const count = await prisma.productLike.count({
      where: { productId }
    });

    await cache.set(cacheKey, count, 900);

    res.status(200).json({
      success: true,
      data: { count }
    });

  } catch (error) {
    console.error('Error fetching product like count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const checkIfLiked = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not active.'
      });
    }

    const isLiked = await prisma.productLike.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    res.status(200).json({
      success: true,
      data: { isLiked: !!isLiked }
    });

  } catch (error) {
    console.error('Error checking if liked product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};