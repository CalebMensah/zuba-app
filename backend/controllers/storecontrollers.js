import slugify from 'slugify';
import { uploadToCloudinary, deleteFromCloudinary, uploadPresets } from '../config/cloudinary.js';
import { cache } from '../config/redis.js';
import prisma from '../config/prisma.js';

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Store controller error:', error);
    
    // Handle specific errors
    if (error.message === 'STORE_EXISTS') {
      return res.status(400).json({
        success: false,
        message: 'You already have a store.'
      });
    }
    
    if (error.message === 'STORE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Store not found.'
      });
    }
    
    if (error.message === 'UNAUTHORIZED') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }
    
    if (error.message === 'CANNOT_UPDATE_VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update store details while verification is pending or approved. Contact support if changes are needed.'
      });
    }
    
    if (error.message === 'CANNOT_DELETE_VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete store while verification is pending or approved. Contact support.'
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

// Generate unique slug
const generateUniqueSlug = async (name, excludeStoreId = null) => {
  const baseSlug = slugify(name, { 
    lower: true, 
    strict: true,
    remove: /[*+~.()'"!:@]/g // Remove special characters
  });

  let finalSlug = baseSlug;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await prisma.store.findFirst({
      where: {
        url: finalSlug,
        ...(excludeStoreId && { NOT: { id: excludeStoreId } })
      }
    });

    if (!existing) {
      return finalSlug;
    }

    // Add random suffix
    finalSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    attempts++;
  }

  // Fallback with timestamp if all attempts fail
  return `${baseSlug}-${Date.now()}`;
};

// Sanitize store data for response
const sanitizeStoreData = (store, includeVerification = false) => {
  const sanitized = {
    id: store.id,
    name: store.name,
    description: store.description,
    location: store.location,
    category: store.category,
    region: store.region,
    url: store.url,
    logo: store.logo,
    isActive: store.isActive,
    viewCount: store.viewCount || 0,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    user: store.user ? {
      id: store.user.id,
      firstName: store.user.firstName,
      // Don't expose email unless it's the owner viewing
    } : null
  };

  if (includeVerification && store.verification) {
    sanitized.verification = {
      status: store.verification.status,
      ...(store.verification.status === 'rejected' && {
        rejectionReason: store.verification.rejectionReason
      })
    };
  }

  return sanitized;
};

export const createStore = asyncHandler(async (req, res) => {
  const { name, description, location, category, region } = req.body;
  const userId = req.user.userId;

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Check if user already has a store
    const existingStore = await tx.store.findUnique({
      where: { userId },
      include: {
        verification: true
      }
    });

    if (existingStore) {
      throw new Error('STORE_EXISTS');
    }

    // Generate unique slug
    const finalSlug = await generateUniqueSlug(name);

    let logoUrl = null;

    // Upload logo to Cloudinary if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          {
            ...uploadPresets.storeLogo,
            type: 'authenticated',
            access_mode: 'authenticated'
          }
        );
        logoUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Logo upload error:', uploadError);
        throw new Error('Failed to upload logo. Please try again.');
      }
    }

    // Create store
    const store = await tx.store.create({
      data: {
        userId,
        name,
        description: description || null,
        location,
        category,
        region: region || null,
        url: finalSlug,
        isActive: false, // Remains false until verification
        logo: logoUrl
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true
          }
        }
      }
    });

    return store;
  });

  // Invalidate cache
  await cache.del(`user:${userId}:store`);

  res.status(201).json({
    success: true,
    message: 'Store created successfully. Please submit verification documents.',
    data: sanitizeStoreData(result, true)
  });
});

export const updateStore = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { name, description, location, category, region } = req.body;
  const userId = req.user.userId;

  const result = await prisma.$transaction(async (tx) => {
    // Check if store exists and belongs to user
    const existingStore = await tx.store.findUnique({
      where: { id: storeId },
      include: {
        verification: true
      }
    });

    if (!existingStore) {
      throw new Error('STORE_NOT_FOUND');
    }

    // Verify ownership
    if (existingStore.userId !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    // Check verification status
    const verification = existingStore.verification;
    if (verification && (verification.status === 'pending' || verification.status === 'verified')) {
      throw new Error('CANNOT_UPDATE_VERIFIED');
    }

    let logoUrl = existingStore.logo;

    // Upload new logo if provided
    if (req.file) {
      try {
        // Delete old logo from Cloudinary if it exists
        if (existingStore.logo) {
          await deleteFromCloudinary(existingStore.logo).catch(err => 
            console.error('Error deleting old logo:', err)
          );
        }

        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          {
            ...uploadPresets.storeLogo,
            type: 'authenticated',
            access_mode: 'authenticated'
          }
        );
        logoUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Logo upload error:', uploadError);
        throw new Error('Failed to upload logo. Please try again.');
      }
    }

    // Handle slug update if name changes
    let updatedUrl = existingStore.url;
    if (name && name !== existingStore.name) {
      updatedUrl = await generateUniqueSlug(name, storeId);
    }

    // Update store
    const updatedStore = await tx.store.update({
      where: { id: storeId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location && { location }),
        ...(category && { category }),
        ...(region !== undefined && { region }),
        url: updatedUrl,
        logo: logoUrl,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true
          }
        },
        verification: {
          select: {
            status: true,
            rejectionReason: true
          }
        }
      }
    });

    return { updatedStore, oldUrl: existingStore.url };
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`store:slug:${result.oldUrl}`),
    cache.del(`store:slug:${result.updatedStore.url}`),
    cache.del(`user:${userId}:store`),
    cache.del(`store:public:id:${storeId}`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Store updated successfully',
    data: sanitizeStoreData(result.updatedStore, true)
  });
});

export const deleteStore = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const userId = req.user.userId;

  await prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: storeId },
      include: {
        verification: true
      }
    });

    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    // Verify ownership
    if (store.userId !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    // Check verification status
    const verification = store.verification;
    if (verification && (verification.status === 'pending' || verification.status === 'verified')) {
      throw new Error('CANNOT_DELETE_VERIFIED');
    }

    // Delete logo from Cloudinary if it exists (background operation)
    if (store.logo) {
      deleteFromCloudinary(store.logo).catch(err => 
        console.error('Error deleting logo:', err)
      );
    }

    // Delete the store (cascade deletes verification)
    await tx.store.delete({
      where: { id: storeId }
    });

    // Invalidate caches
    await Promise.all([
      cache.del(`store:slug:${store.url}`),
      cache.del(`user:${userId}:store`),
      cache.del(`store:public:id:${storeId}`)
    ]);
  });

  res.status(200).json({
    success: true,
    message: 'Store deleted successfully'
  });
});

export const getStoreBySlug = asyncHandler(async (req, res) => {
  const { url } = req.params;
  const cacheKey = `store:slug:${url}`;

  // Check cache
  const cachedStore = await cache.get(cacheKey);
  if (cachedStore) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedStore),
      cached: true
    });
  }

  // Query database
  const store = await prisma.store.findFirst({
    where: {
      url,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true
        }
      }
    }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found'
    });
  }

  const sanitized = sanitizeStoreData(store);

  // Cache for 1 hour
  await cache.set(cacheKey, 3600, JSON.stringify(sanitized));

  res.status(200).json({
    success: true,
    data: sanitized
  });
});

export const getUserStore = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = `user:${userId}:store`;

  // Check cache
  const cachedStore = await cache.get(cacheKey);
  if (cachedStore) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedStore),
      cached: true
    });
  }

  const store = await prisma.store.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true
        }
      },
      verification: {
        select: {
          status: true,
          rejectionReason: true,
          verifiedAt: true,
          createdAt: true
        }
      }
    }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found'
    });
  }

  const sanitized = sanitizeStoreData(store, true);

  // Cache for 30 minutes
  await cache.set(cacheKey, 1800, JSON.stringify(sanitized));

  res.status(200).json({
    success: true,
    data: sanitized
  });
});

export const getSellerStoreForPublicUse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `store:public:id:${id}`;
  const currentUserId = req.user?.userId;

  // Check cache (only for non-owner views)
  if (!currentUserId || currentUserId !== id) {
    const cachedStore = await cache.get(cacheKey);
    if (cachedStore) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedStore),
        cached: true
      });
    }
  }

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true
        }
      }
    }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found'
    });
  }

  // Increment view count (only for authenticated non-owners)
  const shouldIncrementView = currentUserId && currentUserId !== store.userId;
  
  if (shouldIncrementView) {
    const hasRecentView = await checkRecentView(store.id, currentUserId);
    
    if (!hasRecentView) {
      await incrementStoreView(store.id, currentUserId);
      
      // Get updated store
      const updatedStore = await prisma.store.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true
            }
          }
        }
      });

      const sanitized = sanitizeStoreData(updatedStore);
      
      // Invalidate cache
      await cache.del(cacheKey);
      
      return res.status(200).json({
        success: true,
        data: sanitized,
        cached: false
      });
    }
  }

  const sanitized = sanitizeStoreData(store);

  // Cache for 1 hour (only for public views)
  if (!currentUserId || currentUserId !== store.userId) {
    await cache.set(cacheKey, 3600, JSON.stringify(sanitized));
  }

  res.status(200).json({
    success: true,
    data: sanitized,
    cached: false
  });
});

// Admin function - direct active status update
export const updateStoreVerification = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { isActive } = req.body;

  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!store) {
    throw new Error('STORE_NOT_FOUND');
  }

  const updatedStore = await prisma.store.update({
    where: { id: storeId },
    data: { isActive }
  });

  // Invalidate caches
  await Promise.all([
    cache.del(`store:slug:${updatedStore.url}`),
    cache.del(`user:${updatedStore.userId}:store`),
    cache.del(`store:public:id:${storeId}`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Store active status updated (admin override).',
    data: sanitizeStoreData(updatedStore)
  });
});

// Helper functions
const checkRecentView = async (storeId, userId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentView = await prisma.storeView.findFirst({
    where: {
      storeId,
      userId,
      viewedAt: {
        gte: thirtyDaysAgo
      }
    }
  });

  return !!recentView;
};

const incrementStoreView = async (storeId, userId) => {
  await prisma.$transaction(async (tx) => {
    await tx.storeView.create({
      data: {
        storeId,
        userId
      }
    });

    await tx.store.update({
      where: { id: storeId },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });
  });
};