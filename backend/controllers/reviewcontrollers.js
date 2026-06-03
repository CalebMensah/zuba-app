import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { uploadMultipleToCloudinary, deleteFromCloudinary, uploadPresets } from '../config/cloudinary.js';
import { sendNotification } from '../utils/sendnotification.js';

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Review controller error:', error);
    
    // Handle specific errors
    const errorMap = {
      'INVALID_ORDER': { status: 400, message: 'Invalid order or product not in order.' },
      'ORDER_NOT_ELIGIBLE': { status: 400, message: 'Order must be DELIVERED or COMPLETED to leave a review.' },
      'REVIEW_EXISTS': { status: 409, message: 'You have already reviewed this product for this order.' },
      'PRODUCT_NOT_FOUND': { status: 404, message: 'Product not found.' },
      'REVIEW_NOT_FOUND': { status: 404, message: 'Review not found.' },
      'UNAUTHORIZED': { status: 403, message: 'You are not authorized to perform this action.' },
      'UPLOAD_FAILED': { status: 500, message: 'Failed to upload media. Please try again.' },
    };

    const errorInfo = errorMap[error.message];
    if (errorInfo) {
      return res.status(errorInfo.status).json({
        success: false,
        message: errorInfo.message
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

// Sanitize review data
const sanitizeReview = (review, includePrivate = false) => {
  const sanitized = {
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    media: review.media || [],
    isVerified: review.isVerified,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };

  if (review.user) {
    sanitized.user = {
      id: review.user.id,
      firstName: review.user.firstName,
      lastName: review.user.lastName?.[0] + '.' || '', // Partial last name
      avatar: review.user.avatar
    };
  }

  if (review.product) {
    sanitized.product = {
      id: review.product.id,
      name: review.product.name,
      images: review.product.images?.[0] || null, // Only first image
      url: review.product.url
    };
  }

  if (review.sellerResponse) {
    sanitized.sellerResponse = review.sellerResponse;
  }

  if (review._count?.likes !== undefined) {
    sanitized.likesCount = review._count.likes;
  }

  if (includePrivate && review.order) {
    sanitized.order = {
      id: review.order.id,
      createdAt: review.order.createdAt
    };
  }

  return sanitized;
};

// Calculate and update product rating
const updateProductRating = async (productId, tx = prisma) => {
  const reviews = await tx.review.findMany({
    where: { productId },
    select: { rating: true }
  });

  const newRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  await tx.product.update({
    where: { id: productId },
    data: { rating: newRating }
  });

  return newRating;
};

export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { orderId, productId, rating, title, comment } = req.body;

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Verify order eligibility
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        buyerId: userId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        paymentStatus: 'SUCCESS'
      },
      include: {
        items: {
          where: { productId }
        }
      }
    });

    if (!order || order.items.length === 0) {
      throw new Error('INVALID_ORDER');
    }

    // Verify product exists and is active
    const product = await tx.product.findUnique({
      where: { id: productId, isActive: true },
      select: { id: true, name: true, url: true, storeId: true }
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    // Check for existing review (prevent duplicates)
    const existingReview = await tx.review.findFirst({
      where: {
        userId,
        orderId,
        productId
      }
    });

    if (existingReview) {
      throw new Error('REVIEW_EXISTS');
    }

    // Upload media if provided
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadResults = await uploadMultipleToCloudinary(
          req.files.map(file => file.buffer),
          {
            ...uploadPresets.review,
            folder: 'reviews',
            type: 'authenticated',
            access_mode: 'authenticated'
          }
        );
        mediaUrls = uploadResults.map(result => result.secure_url);
      } catch (uploadError) {
        console.error('Media upload error:', uploadError);
        throw new Error('UPLOAD_FAILED');
      }
    }

    // Create review
    const review = await tx.review.create({
      data: {
        userId,
        productId,
        orderId,
        rating,
        title: title || null,
        comment: comment || null,
        media: mediaUrls,
        isVerified: true // Verified because linked to order
      }
    });

    // Update product rating
    await updateProductRating(productId, tx);

    // Award points to user
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: 50 } }
    });

    // Get seller for notification
    const seller = await tx.store.findUnique({
      where: { id: product.storeId },
      select: { userId: true }
    });

    return { review, product, updatedUser, seller };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`product:url:${result.product.url}`),
    cache.del(`user:${userId}:points`),
    cache.del(`user:${userId}:reviews`),
    cache.del(`product:${result.product.id}:reviews`),
    cache.del(`product:${result.product.id}:review:summary`),
    cache.del(`store:${result.product.storeId}:reviews`)
  ]);

  // Send notification (non-blocking)
  if (result.seller) {
    sendNotification(
      result.seller.userId,
      'New Product Review',
      `Your product "${result.product.name}" has received a new review.`,
      'review_received',
      { reviewId: result.review.id, productId: result.product.id, orderId: result.review.orderId }
    ).catch(err => console.error('Notification error:', err));
  }

  res.status(201).json({
    success: true,
    message: 'Review created successfully. 50 points awarded.',
    data: {
      review: sanitizeReview(result.review, true),
      awardedPoints: 50,
      newTotalPoints: result.updatedUser.points
    }
  });
});

export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder || 'desc';
  const verifiedOnly = req.query.verifiedOnly === true;

  const cacheKey = `product:${productId}:reviews:${page}:${limit}:${sortBy}:${sortOrder}:${verifiedOnly}`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  const whereClause = { productId };
  if (verifiedOnly) {
    whereClause.isVerified = true;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        sellerResponse: true,
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    }),
    prisma.review.count({ where: whereClause })
  ]);

  const resultData = {
    reviews: reviews.map(r => sanitizeReview(r)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 30 minutes
  await cache.set(cacheKey, 1800, JSON.stringify(resultData));

  res.status(200).json({
    success: true,
    data: resultData
  });
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = `user:${userId}:reviews`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  const reviews = await prisma.review.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          url: true
        }
      },
      order: {
        select: { 
          id: true, 
          createdAt: true 
        }
      },
      sellerResponse: true,
      _count: {
        select: { likes: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const sanitized = reviews.map(r => sanitizeReview(r, true));

  // Cache for 15 minutes
  await cache.setex(cacheKey, 900, JSON.stringify(sanitized));

  res.status(200).json({
    success: true,
    data: sanitized
  });
});

export const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { reviewId } = req.params;
  const { rating, title, comment } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    // Verify ownership
    const existingReview = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        product: {
          select: {
            id: true,
            url: true,
            storeId: true
          }
        }
      }
    });

    if (!existingReview) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    if (existingReview.userId !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    // Build update data
    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (title !== undefined) updateData.title = title;
    if (comment !== undefined) updateData.comment = comment;

    if (Object.keys(updateData).length === 0) {
      throw new Error('NO_UPDATES');
    }

    // Update review
    const updatedReview = await tx.review.update({
      where: { id: reviewId },
      data: updateData
    });

    // Update product rating if rating changed
    if (rating !== undefined) {
      await updateProductRating(existingReview.product.id, tx);
    }

    return { updatedReview, product: existingReview.product };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`product:url:${result.product.url}`),
    cache.del(`user:${userId}:reviews`),
    cache.del(`product:${result.product.id}:reviews`),
    cache.del(`product:${result.product.id}:review:summary`),
    cache.del(`store:${result.product.storeId}:reviews`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Review updated successfully.',
    data: sanitizeReview(result.updatedReview, true)
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { reviewId } = req.params;

  await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        product: { 
          select: { 
            id: true, 
            url: true,
            storeId: true
          } 
        }
      }
    });

    if (!review) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    if (review.userId !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    // Delete media from Cloudinary (background)
    if (review.media && review.media.length > 0) {
      Promise.all(
        review.media.map(url => deleteFromCloudinary(url).catch(err => 
          console.error('Media deletion error:', err)
        ))
      );
    }

    // Delete review
    await tx.review.delete({
      where: { id: reviewId }
    });

    // Update product rating
    await updateProductRating(review.product.id, tx);

    // Invalidate caches
    await Promise.all([
      cache.del(`product:url:${review.product.url}`),
      cache.del(`user:${userId}:reviews`),
      cache.del(`product:${review.product.id}:reviews`),
      cache.del(`product:${review.product.id}:review:summary`),
      cache.del(`store:${review.product.storeId}:reviews`)
    ]);
  });

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully.'
  });
});

export const getSellerStoreReviews = asyncHandler(async (req, res) => {
  const sellerId = req.user.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const productId = req.query.productId;

  const cacheKey = `seller:${sellerId}:reviews:${page}:${limit}:${productId || 'all'}`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  // Verify seller has a store
  const store = await prisma.store.findUnique({
    where: { userId: sellerId },
    select: { id: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found for this seller.'
    });
  }

  const whereClause = {
    product: {
      storeId: store.id
    }
  };

  if (productId) {
    whereClause.productId = productId;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            url: true
          }
        },
        order: {
          select: {
            id: true,
            createdAt: true
          }
        },
        sellerResponse: true,
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.review.count({ where: whereClause })
  ]);

  const resultData = {
    reviews: reviews.map(r => sanitizeReview(r, true)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 15 minutes
  await cache.set(cacheKey, 900, JSON.stringify(resultData));

  res.status(200).json({
    success: true,
    data: resultData
  });
});

export const getProductReviewSummary = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cacheKey = `product:${productId}:review:summary`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  const [reviews, count] = await Promise.all([
    prisma.review.findMany({
      where: { productId },
      select: { rating: true }
    }),
    prisma.review.count({ where: { productId } })
  ]);

  const summary = {
    averageRating: 0,
    reviewCount: count
  };

  if (count > 0) {
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    summary.averageRating = parseFloat((totalRating / count).toFixed(2));
  }

  // Cache for 1 hour
  await cache.set(cacheKey, 3600, JSON.stringify(summary));

  res.status(200).json({
    success: true,
    data: summary
  });
});

export const getReviewById = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true
        }
      },
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          url: true
        }
      },
      sellerResponse: true,
      _count: {
        select: {
          likes: true
        }
      }
    }
  });

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found.'
    });
  }

  res.status(200).json({
    success: true,
    data: sanitizeReview(review)
  });
});

export const addReviewResponse = asyncHandler(async (req, res) => {
  const sellerId = req.user.userId;
  const { reviewId } = req.params;
  const { response } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    // Verify review exists
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        product: {
          include: {
            store: {
              select: { userId: true, id: true }
            }
          }
        }
      }
    });

    if (!review) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    // Verify seller owns the store
    if (review.product.store.userId !== sellerId) {
      throw new Error('UNAUTHORIZED');
    }

    // Check if response already exists
    const existingResponse = await tx.reviewResponse.findUnique({
      where: { reviewId }
    });

    if (existingResponse) {
      const error = new Error('Response already exists');
      error.code = 'RESPONSE_EXISTS';
      throw error;
    }

    // Create response
    const reviewResponse = await tx.reviewResponse.create({
      data: {
        reviewId,
        sellerId,
        response: response.trim()
      }
    });

    return { reviewResponse, review };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`product:${result.review.productId}:reviews`),
    cache.del(`store:${result.review.product.storeId}:reviews`)
  ]);

  // Send notification (non-blocking)
  sendNotification(
    result.review.userId,
    'Seller Responded to Your Review',
    `The seller has responded to your review for "${result.review.product.name}".`,
    'review',
    { reviewId, productId: result.review.productId }
  ).catch(err => console.error('Notification error:', err));

  res.status(201).json({
    success: true,
    message: 'Response added successfully.',
    data: result.reviewResponse
  });
});

export const updateReviewResponse = asyncHandler(async (req, res) => {
  const sellerId = req.user.userId;
  const { reviewId } = req.params;
  const { response } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const reviewResponse = await tx.reviewResponse.findUnique({
      where: { reviewId },
      include: {
        review: {
          include: {
            product: {
              select: { storeId: true, id: true }
            }
          }
        }
      }
    });

    if (!reviewResponse) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    if (reviewResponse.sellerId !== sellerId) {
      throw new Error('UNAUTHORIZED');
    }

    const updatedResponse = await tx.reviewResponse.update({
      where: { reviewId },
      data: { response: response.trim() }
    });

    return { updatedResponse, reviewResponse };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`product:${result.reviewResponse.review.productId}:reviews`),
    cache.del(`store:${result.reviewResponse.review.product.storeId}:reviews`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Response updated successfully.',
    data: result.updatedResponse
  });
});

export const deleteReviewResponse = asyncHandler(async (req, res) => {
  const sellerId = req.user.userId;
  const { reviewId } = req.params;

  await prisma.$transaction(async (tx) => {
    const reviewResponse = await tx.reviewResponse.findUnique({
      where: { reviewId },
      include: {
        review: {
          include: {
            product: {
              select: { storeId: true, id: true }
            }
          }
        }
      }
    });

    if (!reviewResponse) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    if (reviewResponse.sellerId !== sellerId) {
      throw new Error('UNAUTHORIZED');
    }

    await tx.reviewResponse.delete({
      where: { reviewId }
    });

    // Invalidate caches
    await Promise.all([
      cache.del(`product:${reviewResponse.review.productId}:reviews`),
      cache.del(`store:${reviewResponse.review.product.storeId}:reviews`)
    ]);
  });

  res.status(200).json({
    success: true,
    message: 'Response deleted successfully.'
  });
});

export const likeReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { reviewId } = req.params;

  // Verify review exists
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true }
  });

  if (!review) {
    throw new Error('REVIEW_NOT_FOUND');
  }

  // Check if already liked
  const existingLike = await prisma.reviewLike.findUnique({
    where: {
      userId_reviewId: {
        userId,
        reviewId
      }
    }
  });

  if (existingLike) {
    return res.status(409).json({
      success: false,
      message: 'You have already liked this review.'
    });
  }

  // Create like
  await prisma.reviewLike.create({
    data: {
      userId,
      reviewId
    }
  });

  // Get updated like count
  const likeCount = await prisma.reviewLike.count({
    where: { reviewId }
  });

  res.status(201).json({
    success: true,
    message: 'Review liked successfully.',
    data: { likeCount }
  });
});

export const unlikeReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { reviewId } = req.params;

  const existingLike = await prisma.reviewLike.findUnique({
    where: {
      userId_reviewId: {
        userId,
        reviewId
      }
    }
  });

  if (!existingLike) {
    return res.status(404).json({
      success: false,
      message: 'You have not liked this review.'
    });
  }

  await prisma.reviewLike.delete({
    where: {
      userId_reviewId: {
        userId,
        reviewId
      }
    }
  });

  const likeCount = await prisma.reviewLike.count({
    where: { reviewId }
  });

  res.status(200).json({
    success: true,
    message: 'Review unliked successfully.',
    data: { likeCount }
  });
});

export const reportReview = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { reviewId } = req.params;
  const { reason, description } = req.body;

  // Verify review exists
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true }
  });

  if (!review) {
    throw new Error('REVIEW_NOT_FOUND');
  }

  // Check if already reported
  const existingReport = await prisma.reviewReport.findFirst({
    where: {
      userId,
      reviewId
    }
  });

  if (existingReport) {
    return res.status(409).json({
      success: false,
      message: 'You have already reported this review.'
    });
  }

  // Create report
  const report = await prisma.reviewReport.create({
    data: {
      userId,
      reviewId,
      reason,
      description: description || null
    }
  });

  res.status(201).json({
    success: true,
    message: 'Review reported successfully. Our team will review it.',
    data: { reportId: report.id }
  });
});

export const getPublicStoreReviews = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const productId = req.query.productId;

  const cacheKey = `public:store:${storeId}:reviews:${page}:${limit}:${productId || 'all'}`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached),
      cached: true
    });
  }

  // Verify store exists
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  // Build query
  const whereClause = {
    product: { storeId }
  };

  if (productId) {
    whereClause.productId = productId;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereClause,
      include: {
        user: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            avatar: true 
          }
        },
        product: {
          select: { 
            id: true, 
            name: true, 
            images: true, 
            url: true 
          }
        },
        sellerResponse: true,
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    prisma.review.count({ where: whereClause })
  ]);

  const result = {
    reviews: reviews.map(r => sanitizeReview(r)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 15 minutes
  await cache.set(cacheKey, JSON.stringify(result),900);

  res.status(200).json({
    success: true,
    data: result
  });
});
