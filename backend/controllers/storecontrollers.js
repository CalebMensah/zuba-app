// controllers/storeController.js (Updated)
import slugify from 'slugify';
// Import Cloudinary and Multer functions
import { uploadToCloudinary, deleteFromCloudinary, uploadPresets } from '../config/cloudinary.js';
import { upload } from '../config/multer.js';
import { cache } from '../config/redis.js';
import prisma from '../config/prisma.js';


// Create a new store - Updated to check for existing verification
export const createStore = async (req, res) => {
  try {
    const { name, description, location, category, region } = req.body;
    const userId = req.user.userId;

    // Check if user already has a store
        const existingStore = await prisma.store.findUnique({
          where: { userId}
        });

        if (existingStore) {
          // User already has a store
          return res.status(400).json({
            success: false,
            message: 'User already has a store.'
          });
        }

    if (existingStore) {
      // Also check if verification exists and is pending/rejected
      const existingVerification = await prisma.storeVerification.findUnique({
        where: { storeId: existingStore.id }
      });

      if (existingVerification && existingVerification.status !== 'rejected') {
          return res.status(400).json({
            success: false,
            message: 'A store already exists for this user. Verification status: ' + existingVerification.status
          });
      } else if (existingVerification && existingVerification.status === 'rejected') {
          // Allow creation if previous verification was rejected, but ideally, update the existing one
          // This logic might need adjustment based on your exact flow
          // For now, prevent recreation if any store exists
           return res.status(400).json({
            success: false,
            message: 'A store already exists for this user. Please manage the existing one.'
          });
      } else {
         return res.status(400).json({
            success: false,
            message: 'User already has a store.'
          });
      }
    }

    // Generate URL slug from store name
    const slug = slugify(name, { lower: true, strict: true });

    // Check if slug already exists
    const existingSlug = await prisma.store.findFirst({
      where: { url: slug }
    });

    // If slug exists, append a random number
    const finalSlug = existingSlug ? `${slug}-${Math.floor(1000 + Math.random() * 9000)}` : slug;

    let logoUrl = null;

    // Upload logo to Cloudinary if provided
    if (req.file) {
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        uploadPresets.storeLogo
      );
      logoUrl = uploadResult.secure_url;
    }

    const store = await prisma.store.create({
      data: {
        userId,
        name,
        description: description || null,
        location,
        category,
        region,
        url: finalSlug, // Using the generated slug as the URL
        isActive: false, // Remains false until verification is approved
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

    // Invalidate user store cache (though it might not exist yet)
    await cache.del(`user:${userId}:store`);

    res.status(201).json({
      success: true,
      message: 'Store created successfully. Please submit verification documents.',
      data: store
    });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update store - Updated with cache invalidation
export const updateStore = [
  upload.single('logo'),
  async (req, res) => {
    try {
      const { storeId } = req.params;
      const { name, description, location, category } = req.body;
      const userId = req.user.userId;

      // Check if store exists and belongs to user
      const existingStore = await prisma.store.findFirst({
        where: {
          id: storeId,
          userId
        }
      });

      if (!existingStore) {
        return res.status(404).json({
          success: false,
          message: 'Store not found or unauthorized'
        });
      }

      // Prevent updates if verification is pending or approved
      const verification = await prisma.storeVerification.findUnique({
        where: { storeId: storeId }
      });

      if (verification && (verification.status === 'pending' || verification.status === 'verified')) {
         return res.status(400).json({
          success: false,
          message: 'Cannot update store details while verification is pending or approved. Contact support if changes are needed.'
        });
      }


      let logoUrl = existingStore.logo; // Keep existing logo if no new file is uploaded

      // Upload new logo if provided
      if (req.file) {
        // Delete old logo from Cloudinary if it exists
        if (existingStore.logo) {
          await deleteFromCloudinary(existingStore.logo);
        }

        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          uploadPresets.storeLogo
        );
        logoUrl = uploadResult.secure_url;
      }

      // Handle slug update if name changes (only if not verified)
      let updatedUrl = existingStore.url;
      if (name && name !== existingStore.name) {
        const newSlug = slugify(name, { lower: true, strict: true });

        // Check if new slug already exists (excluding current store)
        const existingSlug = await prisma.store.findFirst({
          where: {
            url: newSlug,
            NOT: { id: storeId }
          }
        });

        updatedUrl = existingSlug ? `${newSlug}-${Math.floor(1000 + Math.random() * 9000)}` : newSlug;
      }

      const updatedStore = await prisma.store.update({
        where: { id: storeId },
        data: {
          name: name || existingStore.name,
          description: description !== undefined ? description : existingStore.description,
          location: location || existingStore.location,
          category: category || existingStore.category,
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
          }
        }
      });

      // Invalidate cache after update
      await cache.del(`store:slug:${updatedStore.url}`);
      await cache.del(`user:${userId}:store`);

      res.status(200).json({
        success: true,
        message: 'Store updated successfully',
        data: updatedStore
      });
    } catch (error) {
      console.error('Error updating store:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
];

// Delete store - Updated with Cloudinary cleanup and cache invalidation
export const deleteStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.userId;

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        userId
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or unauthorized'
      });
    }

    // Prevent deletion if verification is pending or approved
    const verification = await prisma.storeVerification.findUnique({
      where: { storeId: storeId }
    });

    if (verification && (verification.status === 'pending' || verification.status === 'verified')) {
       return res.status(400).json({
        success: false,
        message: 'Cannot delete store while verification is pending or approved. Contact support.'
      });
    }

    // Delete logo from Cloudinary if it exists
    if (store.logo) {
      await deleteFromCloudinary(store.logo);
    }

    // Delete the store (this will cascade delete the verification record if it exists)
    await prisma.store.delete({
      where: { id: storeId }
    });

    // Invalidate cache after deletion
    await cache.del(`store:slug:${store.url}`);
    await cache.del(`user:${userId}:store`);

    res.status(200).json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get store by slug - Cache integration remains the same
export const getStoreBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `store:slug:${slug}`;

    // Try to get from cache first
    const cachedStore = await cache.get(cacheKey);
    if (cachedStore) {
      return res.status(200).json({
        success: true,
        data: cachedStore,
        cached: true
      });
    }

    // Query using 'url' field, not 'name'
    const store = await prisma.store.findFirst({
      where: {
        url: slug,
        isActive: true // Only return active stores
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

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Cache for 1 hour
    await cache.set(cacheKey, store, 3600);

    res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's store - Cache integration remains the same
export const getUserStore = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `user:${userId}:store`;

    // Try to get from cache first
    const cachedStore = await cache.get(cacheKey);
    if (cachedStore) {
      return res.status(200).json({
        success: true,
        data: cachedStore,
        cached: true
      });
    }

    const store = await prisma.store.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true
          }
        },
        verification: { // Include verification status
          select: {
            status: true,
            rejectionReason: true
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

    // Cache for 30 minutes
    await cache.set(cacheKey, store, 1800);

    res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Error fetching user store:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update store verification status (for admin use) - Updated with cache invalidation
export const updateStoreVerification = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { isActive } = req.body;

    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Only allow direct isActive update if no verification record exists,
    // or force it (not recommended for standard flow).
    // The preferred flow is through the verification process.
    // This function might become redundant or need logic adjustment.
    // Let's assume this is only used in specific admin scenarios.
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { isActive }
    });

    // Invalidate related caches
    await cache.del(`store:slug:${updatedStore.url}`);
    await cache.del(`user:${updatedStore.userId}:store`);

    res.status(200).json({
      success: true,
      message: 'Store active status updated directly (admin override). Prefer using verification process.',
      data: updatedStore
    });
  } catch (error) {
    console.error('Error updating store active status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getSellerStoreForPublicUse = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `store:public:id:${id}`;
    const currentUserId = req.user?.userId;

    const cachedStore = await cache.get(cacheKey);
    if (cachedStore) {
      return res.status(200).json({
        success: true,
        data: cachedStore,
        cached: true
      });
    }

    const store = await prisma.store.findFirst({
      where: {
        id
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
        message: 'Store not found or not active'
      });
    }

    const shouldIncrementView = currentUserId && currentUserId !== store.userId;
    
    if (shouldIncrementView) {
      const hasRecentView = await checkRecentView(store.id, currentUserId);
      
      if (!hasRecentView) {
        await incrementStoreView(store.id, currentUserId);
        await cache.del(cacheKey);
        
        const updatedStore = await prisma.store.findFirst({
          where: {
            id,
            isActive: true
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

        return res.status(200).json({
          success: true,
          data: updatedStore,
          cached: false
        });
      }
    }

    await cache.set(cacheKey, store, 3600);

    return res.status(200).json({
      success: true,
      data: store,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching public store view:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

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