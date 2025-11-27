import prisma from '../config/prisma.js'
import { cache } from '../config/redis.js';
import { uploadMultipleToCloudinary, uploadPresets } from '../config/cloudinary.js';
import { sendNotification } from '../utils/sendnotification.js';


export const createReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId, productId, rating: ratingStr, title, comment } = req.body;
    const rating = parseInt(ratingStr, 10);

    if (!orderId || !productId || isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'orderId, productId, and a rating between 1 and 5 are required.'
      });
    }

    const order = await prisma.order.findFirst({
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
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID, product not in order, or order not eligible for review.'
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

    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        orderId,
        productId
      }
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product for this order.'
      });
    }

    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadResults = await uploadMultipleToCloudinary(
          req.files.map(file => file.buffer),
          { ...uploadPresets.review, folder: 'reviews' }
        );
        mediaUrls = uploadResults.map(result => result.secure_url);
      } catch (uploadError) {
        console.error('Error uploading review media:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading review media.',
          error: uploadError.message
        });
      }
    }

    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        orderId,
        rating,
        title: title || null,
        comment: comment || null,
        media: mediaUrls,
        isVerified: true
      }
    });

    const productReviews = await prisma.review.findMany({
      where: { productId }
    });
    const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverageRating = totalRating / productReviews.length;

    await prisma.product.update({
      where: { id: productId },
      data: { rating: newAverageRating }
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: 50 } }
    });

    const seller = await prisma.store.findFirst({
      where: { id: product.storeId },
      select: { userId: true }
    });

    if (seller) {
      await sendNotification(
        seller.userId,
        'New Product Review',
        `Your product "${product.name}" has received a new review.`,
        'REVIEW',
        { reviewId: review.id, productId, orderId }
      );
    }

    await cache.del(`product:url:${product.url}`);
    await cache.del(`user:${userId}:points`);
    await cache.del(`product:${productId}:reviews`);
    await cache.del(`store:${product.storeId}:reviews`);

    res.status(201).json({
      success: true,
      message: 'Review created successfully. 50 points awarded.',
      data: {
        review,
        awardedPoints: 50,
        newTotalPoints: updatedUser.points
      }
    });

  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const verifiedOnly = req.query.verifiedOnly === 'true';

    const whereClause = { productId };
    if (verifiedOnly) {
      whereClause.isVerified = true;
    }

    const cacheKey = `product:${productId}:reviews:page:${page}:limit:${limit}:sort:${sortBy}:${sortOrder}:verified:${verifiedOnly}`;

    const cachedReviews = await cache.get(cacheKey);
    if (cachedReviews) {
      return res.status(200).json({
        success: true,
        data: cachedReviews,
        cached: true
      });
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    });

    const total = await prisma.review.count({ where: whereClause });

    const resultData = {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cache.set(cacheKey, resultData, 1800);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cacheKey = `user:${userId}:reviews`;

    const cachedReviews = await cache.get(cacheKey);
    if (cachedReviews) {
      return res.status(200).json({
        success: true,
        data: cachedReviews,
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
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    await cache.set(cacheKey, reviews, 900);

    res.status(200).json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSellerStoreReviews = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const productId = req.query.productId;

    const cacheKey = `store:${sellerId}:reviews:page:${page}:limit:${limit}:product:${productId || 'all'}`;

    const cachedReviews = await cache.get(cacheKey);
    if (cachedReviews) {
      return res.status(200).json({
        success: true,
        data: cachedReviews,
        cached: true
      });
    }

    const store = await prisma.store.findFirst({
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.review.count({ where: whereClause })
    ]);

    const resultData = {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching seller store reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getProductReviewSummary = async (req, res) => {
  try {
    const { productId } = req.params;

    const cacheKey = `product:${productId}:review:summary`;

    const cachedSummary = await cache.get(cacheKey);
    if (cachedSummary) {
      return res.status(200).json({
        success: true,
        data: cachedSummary,
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

    if (count === 0) {
      return res.status(200).json({
        success: true,
        data: { averageRating: 0, reviewCount: 0 }
      });
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / count;

    const summary = {
      averageRating: parseFloat(averageRating.toFixed(2)),
      reviewCount: count
    };

    await cache.set(cacheKey, summary, 3600);

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching product review summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;
    const { rating: ratingStr, title, comment } = req.body;
    const rating = ratingStr !== undefined ? parseInt(ratingStr, 10) : undefined;

    const existingReview = await prisma.review.findFirst({
      where: {
        id: reviewId,
        userId
      },
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
      return res.status(404).json({
        success: false,
        message: 'Review not found or does not belong to you.'
      });
    }

    const updateData = {};
    if (rating !== undefined && !isNaN(rating) && rating >= 1 && rating <= 5) {
      updateData.rating = rating;
    }
    if (title !== undefined) updateData.title = title;
    if (comment !== undefined) updateData.comment = comment;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update provided.'
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: updateData
    });

    const productReviews = await prisma.review.findMany({
      where: { productId: existingReview.product.id }
    });
    const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverageRating = totalRating / productReviews.length;

    await prisma.product.update({
      where: { id: existingReview.product.id },
      data: { rating: newAverageRating }
    });

    await cache.del(`product:url:${existingReview.product.url}`);
    await cache.del(`user:${userId}:reviews`);
    await cache.del(`product:${existingReview.product.id}:reviews`);
    await cache.del(`store:${existingReview.product.storeId}:reviews`);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully.',
      data: updatedReview
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;

    const reviewToDelete = await prisma.review.findFirst({
      where: {
        id: reviewId,
        userId
      },
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

    if (!reviewToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or does not belong to you.'
      });
    }

    await prisma.review.delete({
      where: { id: reviewId }
    });

    const productReviews = await prisma.review.findMany({
      where: { productId: reviewToDelete.product.id }
    });
    const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverageRating = productReviews.length > 0 
      ? totalRating / productReviews.length 
      : 0;

    await prisma.product.update({
      where: { id: reviewToDelete.product.id },
      data: { rating: newAverageRating }
    });

    await cache.del(`product:url:${reviewToDelete.product.url}`);
    await cache.del(`user:${userId}:reviews`);
    await cache.del(`product:${reviewToDelete.product.id}:reviews`);
    await cache.del(`store:${reviewToDelete.product.storeId}:reviews`);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add these controllers to your review.controller.js file

export const getReviewById = async (req, res) => {
  try {
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
        likes: {
          select: {
            userId: true
          }
        },
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
      data: review
    });

  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const addReviewResponse = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { reviewId } = req.params;
    const { response } = req.body;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required.'
      });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        product: {
          include: {
            store: {
              select: { userId: true }
            }
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

    if (review.product.store.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to respond to this review.'
      });
    }

    const existingResponse = await prisma.reviewResponse.findUnique({
      where: { reviewId }
    });

    if (existingResponse) {
      return res.status(409).json({
        success: false,
        message: 'A response already exists for this review. Use PATCH to update.'
      });
    }

    const reviewResponse = await prisma.reviewResponse.create({
      data: {
        reviewId,
        sellerId,
        response: response.trim()
      }
    });

    await sendNotification(
      review.userId,
      'Seller Responded to Your Review',
      `The seller has responded to your review for "${review.product.name}".`,
      'REVIEW_RESPONSE',
      { reviewId, productId: review.productId }
    );

    await cache.del(`product:${review.productId}:reviews`);
    await cache.del(`store:${review.product.storeId}:reviews`);

    res.status(201).json({
      success: true,
      message: 'Response added successfully.',
      data: reviewResponse
    });

  } catch (error) {
    console.error('Error adding review response:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateReviewResponse = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { reviewId } = req.params;
    const { response } = req.body;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required.'
      });
    }

    const reviewResponse = await prisma.reviewResponse.findUnique({
      where: { reviewId },
      include: {
        review: {
          include: {
            product: {
              select: { storeId: true }
            }
          }
        }
      }
    });

    if (!reviewResponse) {
      return res.status(404).json({
        success: false,
        message: 'Review response not found.'
      });
    }

    if (reviewResponse.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this response.'
      });
    }

    const updatedResponse = await prisma.reviewResponse.update({
      where: { reviewId },
      data: { response: response.trim() }
    });

    await cache.del(`product:${reviewResponse.review.productId}:reviews`);
    await cache.del(`store:${reviewResponse.review.product.storeId}:reviews`);

    res.status(200).json({
      success: true,
      message: 'Response updated successfully.',
      data: updatedResponse
    });

  } catch (error) {
    console.error('Error updating review response:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteReviewResponse = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const { reviewId } = req.params;

    const reviewResponse = await prisma.reviewResponse.findUnique({
      where: { reviewId },
      include: {
        review: {
          include: {
            product: {
              select: { storeId: true }
            }
          }
        }
      }
    });

    if (!reviewResponse) {
      return res.status(404).json({
        success: false,
        message: 'Review response not found.'
      });
    }

    if (reviewResponse.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this response.'
      });
    }

    await prisma.reviewResponse.delete({
      where: { reviewId }
    });

    await cache.del(`product:${reviewResponse.review.productId}:reviews`);
    await cache.del(`store:${reviewResponse.review.product.storeId}:reviews`);

    res.status(200).json({
      success: true,
      message: 'Response deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting review response:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const likeReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

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

    await prisma.reviewLike.create({
      data: {
        userId,
        reviewId
      }
    });

    const likeCount = await prisma.reviewLike.count({
      where: { reviewId }
    });

    res.status(201).json({
      success: true,
      message: 'Review liked successfully.',
      data: { likeCount }
    });

  } catch (error) {
    console.error('Error liking review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const unlikeReview = async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Error unliking review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const reportReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;
    const { reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required to report a review.'
      });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

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
      data: report
    });

  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getPublicStoreReviews = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const productId = req.query.productId;

    const cacheKey = `public:store:${storeId}:reviews:page:${page}:limit:${limit}:product:${productId || 'all'}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // 1. Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found."
      });
    }

    // 2. Build query
    const whereClause = {
      product: { storeId: storeId }
    };

    if (productId) {
      whereClause.productId = productId;
    }

    // 3. Fetch reviews + count
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatar: true }
          },
          product: {
            select: { id: true, name: true, images: true, url: true }
          },
          order: {
            select: { id: true, createdAt: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit
      }),
      prisma.review.count({ where: whereClause })
    ]);

    const result = {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // 4. Cache results (15 mins)
    await cache.set(cacheKey, result, 900);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error fetching public store reviews:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
