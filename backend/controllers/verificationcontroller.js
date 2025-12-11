import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { cache } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';
import crypto from 'crypto';

// Sanitize output - remove sensitive data
const sanitizeVerificationForUser = (verification) => {
  const { ghanaCardFront, ghanaCardBack, selfie, businessDoc, ...safe } = verification;
  return safe;
};

const sanitizeVerificationForAdmin = (verification) => {
  // Admins get full access but we can still add signed URLs in the future
  return verification;
};

// Generate signed URLs for documents (implement this based on your Cloudinary setup)
const generateSignedDocumentUrls = async (verification) => {
  // This is a placeholder - implement actual Cloudinary signed URL generation
  return {
    ghanaCardFront: verification.ghanaCardFront,
    ghanaCardBack: verification.ghanaCardBack,
    selfie: verification.selfie,
    businessDoc: verification.businessDoc
  };
};

export const submitStoreVerification = async (req, res) => {
  // Start transaction for atomicity
  const transaction = await prisma.$transaction(async (tx) => {
    try {
      const { rejectionReason } = req.body;
      const userId = req.user.userId;

      // Find the user's store with transaction
      const store = await tx.store.findFirst({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              email: true
            }
          }
        }
      });

      if (!store) {
        throw new Error('STORE_NOT_FOUND');
      }

      // Verify ownership (additional security layer)
      if (store.userId !== userId) {
        throw new Error('UNAUTHORIZED_STORE_ACCESS');
      }

      // Check if verification already exists
      const existingVerification = await tx.storeVerification.findUnique({
        where: { storeId: store.id }
      });

      if (existingVerification && existingVerification.status === 'verified') {
        throw new Error('ALREADY_VERIFIED');
      }

      // Check for recent submissions to prevent spam
      if (existingVerification && existingVerification.status === 'pending') {
        const hoursSinceSubmission = 
          (Date.now() - existingVerification.createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceSubmission < 24) {
          throw new Error('PENDING_VERIFICATION_EXISTS');
        }
      }

      const { ghanaCardFront, ghanaCardBack, selfie, businessDoc } = req.files;

      // Upload documents to Cloudinary with authenticated access
      let uploadedUrls = [];
      let ghanaCardFrontUrl, ghanaCardBackUrl, selfieUrl, businessDocUrl = null;

      try {
        // Upload with authenticated access and transformations
        const frontRes = await uploadToCloudinary(
          ghanaCardFront[0].buffer, 
          { 
            folder: 'store-verifications/ghana-card',
            resource_type: 'image',
            type: 'authenticated', // Important: authenticated access
            access_mode: 'authenticated',
            invalidate: true,
            transformation: [
              { width: 800, height: 600, crop: 'limit', quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          }
        );
        ghanaCardFrontUrl = frontRes.secure_url;
        uploadedUrls.push(ghanaCardFrontUrl);

        const backRes = await uploadToCloudinary(
          ghanaCardBack[0].buffer, 
          { 
            folder: 'store-verifications/ghana-card',
            resource_type: 'image',
            type: 'authenticated',
            access_mode: 'authenticated',
            invalidate: true,
            transformation: [
              { width: 800, height: 600, crop: 'limit', quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          }
        );
        ghanaCardBackUrl = backRes.secure_url;
        uploadedUrls.push(ghanaCardBackUrl);

        const selfieRes = await uploadToCloudinary(
          selfie[0].buffer, 
          { 
            folder: 'store-verifications/selfie',
            resource_type: 'image',
            type: 'authenticated',
            access_mode: 'authenticated',
            invalidate: true,
            transformation: [
              { width: 500, height: 500, crop: 'limit', quality: 'auto', gravity: 'face' },
              { fetch_format: 'auto' }
            ]
          }
        );
        selfieUrl = selfieRes.secure_url;
        uploadedUrls.push(selfieUrl);

        // Upload optional business document
        if (businessDoc && businessDoc.length > 0) {
          const businessDocRes = await uploadToCloudinary(
            businessDoc[0].buffer, 
            { 
              folder: 'store-verifications/business-docs',
              resource_type: 'image',
              type: 'authenticated',
              access_mode: 'authenticated',
              invalidate: true,
              transformation: [
                { width: 1000, height: 1000, crop: 'limit', quality: 'auto' },
                { fetch_format: 'auto' }
              ]
            }
          );
          businessDocUrl = businessDocRes.secure_url;
          uploadedUrls.push(businessDocUrl);
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        
        // Cleanup uploaded files
        for (const url of uploadedUrls) {
          try {
            await deleteFromCloudinary(url);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }
        
        throw new Error('UPLOAD_FAILED');
      }

      const verificationData = {
        ghanaCardFront: ghanaCardFrontUrl,
        ghanaCardBack: ghanaCardBackUrl,
        selfie: selfieUrl,
        businessDoc: businessDocUrl,
        status: 'pending',
        rejectionReason: null,
        verifiedAt: null,
      };

      let verification;
      const isResubmission = !!existingVerification;

      if (existingVerification) {
        // Delete old documents
        const oldUrls = [
          existingVerification.ghanaCardFront,
          existingVerification.ghanaCardBack,
          existingVerification.selfie,
          existingVerification.businessDoc
        ].filter(Boolean);

        // Delete in background (don't block the response)
        Promise.all(oldUrls.map(url => 
          deleteFromCloudinary(url).catch(err => 
            console.error('Background deletion error:', err)
          )
        ));

        // Update existing verification
        verification = await tx.storeVerification.update({
          where: { storeId: store.id },
          data: verificationData,
        });

        // Reset store active status
        await tx.store.update({
          where: { id: store.id },
          data: { isActive: false }
        });
      } else {
        // Create new verification
        verification = await tx.storeVerification.create({
          data: {
            ...verificationData,
            storeId: store.id,
          },
        });
      }

      // Create audit log
      await tx.verificationAuditLog.create({
        data: {
          verificationId: verification.id,
          action: isResubmission ? 'RESUBMITTED' : 'SUBMITTED',
          performedBy: userId,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            filesUploaded: {
              ghanaCardFront: !!ghanaCardFrontUrl,
              ghanaCardBack: !!ghanaCardBackUrl,
              selfie: !!selfieUrl,
              businessDoc: !!businessDocUrl
            }
          }
        }
      });

      return { verification, store, isResubmission };
    } catch (error) {
      throw error;
    }
  });

  const { verification, store, isResubmission } = transaction;

  // Invalidate cache (outside transaction)
  await Promise.all([
    cache.del(`store:slug:${store.url}`),
    cache.del(`user:${req.user.userId}:store`),
    cache.del(`store:${store.id}:verification`)
  ]);

  // Send notifications (outside transaction, non-blocking)
  Promise.all([
    sendNotification(
      req.user.userId,
      'Verification Submitted',
      isResubmission 
        ? `Your updated verification documents for "${store.name}" are under review.`
        : `Your verification documents for "${store.name}" have been submitted successfully.`,
      'store_verification',
      { 
        storeId: store.id, 
        verificationId: verification.id,
        status: 'pending'
      }
    ).catch(err => console.error('Notification error:', err)),

    sendEmailNotification({
      to: store.user.email,
      toName: store.user.firstName,
      subject: isResubmission 
        ? 'Verification Documents Resubmitted'
        : 'Store Verification Submitted - Under Review',
      template: 'generic',
      templateData: {
        title: isResubmission ? 'Documents Resubmitted ✓' : 'Verification Submitted ✓',
        message: isResubmission
          ? `Your updated verification documents for <strong>${store.name}</strong> are under review.`
          : `Thank you for submitting your verification documents for <strong>${store.name}</strong>. Review within 24-48 hours.`,
        ctaText: 'Check Status',
        ctaUrl: `${process.env.FRONTEND_URL}/dashboard/store/verification`
      }
    }).catch(err => console.error('Email error:', err))
  ]);

  res.status(201).json({
    success: true,
    message: 'Store verification submitted successfully. Awaiting review.',
    data: sanitizeVerificationForUser(verification)
  });
};

// Error handler wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Controller error:', error);

    // Handle specific errors
    if (error.message === 'STORE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Store not found. Please create a store first.'
      });
    }

    if (error.message === 'UNAUTHORIZED_STORE_ACCESS') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this store.'
      });
    }

    if (error.message === 'ALREADY_VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'Store is already verified.'
      });
    }

    if (error.message === 'PENDING_VERIFICATION_EXISTS') {
      return res.status(400).json({
        success: false,
        message: 'A verification request is already pending. Please wait 24 hours before resubmitting.'
      });
    }

    if (error.message === 'UPLOAD_FAILED') {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload verification documents. Please try again.'
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

export const getMyStoreVerificationStatus = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Check cache first
  const cacheKey = `user:${userId}:verification-status`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached)
    });
  }

  const store = await prisma.store.findFirst({
    where: { userId }
  });

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found.'
    });
  }

  const verification = await prisma.storeVerification.findUnique({
    where: { storeId: store.id },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          url: true,
          isActive: true
        }
      }
    }
  });

  if (!verification) {
    return res.status(404).json({
      success: false,
      message: 'Verification not submitted yet.'
    });
  }

  // Don't expose document URLs to user
  const sanitized = sanitizeVerificationForUser(verification);

  // Cache for 5 minutes
  await cache.set(cacheKey, 300, JSON.stringify(sanitized));

  res.status(200).json({
    success: true,
    data: sanitized
  });
});

export const getPendingVerifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const [verifications, total] = await Promise.all([
    prisma.storeVerification.findMany({
      where: { status: 'pending' },
      include: {
        store: {
          include: {
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
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' }
    }),
    prisma.storeVerification.count({
      where: { status: 'pending' }
    })
  ]);

  res.status(200).json({
    success: true,
    data: verifications.map(sanitizeVerificationForAdmin),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

export const getAllVerifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, storeId, search } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  
  if (status) {
    where.status = status;
  }
  
  if (storeId) {
    where.storeId = storeId;
  }

  // Secure search implementation
  if (search) {
    where.store = {
      name: { 
        contains: search, 
        mode: 'insensitive' 
      }
    };
  }

  const [verifications, total] = await Promise.all([
    prisma.storeVerification.findMany({
      where,
      include: {
        store: {
          include: {
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
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.storeVerification.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: verifications.map(sanitizeVerificationForAdmin),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

export const getVerificationDetails = asyncHandler(async (req, res) => {
  const { verificationId } = req.params;

  const verification = await prisma.storeVerification.findUnique({
    where: { id: verificationId },
    include: {
      store: {
        include: {
          user: {
            select: { 
              id: true, 
              firstName: true, 
              email: true,
              phone: true,
              createdAt: true
            }
          }
        }
      }
    }
  });

  if (!verification) {
    return res.status(404).json({
      success: false,
      message: 'Verification record not found.'
    });
  }

  // Generate signed URLs for document access
  const documentUrls = await generateSignedDocumentUrls(verification);

  res.status(200).json({
    success: true,
    data: {
      ...sanitizeVerificationForAdmin(verification),
      documents: documentUrls
    }
  });
});

export const updateVerificationStatus = asyncHandler(async (req, res) => {
  const { verificationId } = req.params;
  const { status, rejectionReason } = req.body;
  const adminId = req.user.userId;

  const result = await prisma.$transaction(async (tx) => {
    const verification = await tx.storeVerification.findUnique({
      where: { id: verificationId },
      include: {
        store: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!verification) {
      throw new Error('VERIFICATION_NOT_FOUND');
    }

    if (verification.status === status) {
      throw new Error('SAME_STATUS');
    }

    // Prepare update data
    const updateData = { status };
    if (status === 'verified') {
      updateData.verifiedAt = new Date();
      updateData.rejectionReason = null;
    } else if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
      updateData.verifiedAt = null;
    }

    // Update verification
    const updatedVerification = await tx.storeVerification.update({
      where: { id: verificationId },
      data: updateData,
      include: {
        store: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Update store active status
    await tx.store.update({
      where: { id: verification.store.id },
      data: { isActive: status === 'verified' }
    });

    // Create audit log
    await tx.verificationAuditLog.create({
      data: {
        verificationId,
        action: status === 'verified' ? 'APPROVED' : 'REJECTED',
        performedBy: adminId,
        metadata: {
          rejectionReason: status === 'rejected' ? rejectionReason : null,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      }
    });

    return updatedVerification;
  });

  const store = result.store;

  // Invalidate caches
  await Promise.all([
    cache.del(`store:slug:${store.url}`),
    cache.del(`user:${store.userId}:store`),
    cache.del(`store:${store.id}:verification`),
    cache.del(`user:${store.userId}:verification-status`)
  ]);

  // Send notifications
  const notificationTitle = status === 'verified' 
    ? 'Store Verified! 🎉' 
    : 'Verification Needs Attention';
  
  const notificationMessage = status === 'verified'
    ? `Congratulations! Your store "${store.name}" has been verified and is now live.`
    : `Your verification for "${store.name}" requires updates. ${rejectionReason}`;

  Promise.all([
    sendNotification(
      store.userId,
      notificationTitle,
      notificationMessage,
      'store_verification',
      { 
        storeId: store.id, 
        verificationId: result.id,
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : null
      }
    ).catch(err => console.error('Notification error:', err)),

    sendEmailNotification({
      to: store.user.email,
      toName: store.user.firstName,
      subject: status === 'verified' 
        ? `${store.name} - Store Verified!` 
        : `${store.name} - Verification Update Required`,
      template: 'verification_status',
      templateData: {
        storeName: store.name,
        status,
        reason: rejectionReason,
        storeUrl: status === 'verified' 
          ? `${process.env.FRONTEND_URL}/store/${store.url}`
          : `${process.env.FRONTEND_URL}/dashboard/store/verification`
      }
    }).catch(err => console.error('Email error:', err))
  ]);

  res.status(200).json({
    success: true,
    message: `Store verification ${status} successfully.`,
    data: sanitizeVerificationForAdmin(result)
  });
});

export const deleteVerification = asyncHandler(async (req, res) => {
  const { verificationId } = req.params;
  const adminId = req.user.userId;

  const verification = await prisma.storeVerification.findUnique({
    where: { id: verificationId },
    include: { store: true }
  });

  if (!verification) {
    return res.status(404).json({
      success: false,
      message: 'Verification record not found.'
    });
  }

  // Delete from database first
  await prisma.$transaction([
    prisma.verificationAuditLog.create({
      data: {
        verificationId,
        action: 'DELETED',
        performedBy: adminId,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      }
    }),
    prisma.storeVerification.delete({
      where: { id: verificationId }
    }),
    prisma.store.update({
      where: { id: verification.storeId },
      data: { isActive: false }
    })
  ]);

  // Delete files in background
  const documentUrls = [
    verification.ghanaCardFront,
    verification.ghanaCardBack,
    verification.selfie,
    verification.businessDoc
  ].filter(Boolean);

  Promise.all(documentUrls.map(url => 
    deleteFromCloudinary(url).catch(err => 
      console.error('File deletion error:', err)
    )
  ));

  // Invalidate caches
  await Promise.all([
    cache.del(`store:slug:${verification.store.url}`),
    cache.del(`user:${verification.store.userId}:store`),
    cache.del(`store:${verification.storeId}:verification`)
  ]);

  res.status(200).json({
    success: true,
    message: 'Verification record deleted successfully.'
  });
});

export const getVerificationStats = asyncHandler(async (req, res) => {
  const cacheKey = 'verification:stats';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cached)
    });
  }

  const [totalPending, totalVerified, totalRejected, recentVerifications] = await Promise.all([
    prisma.storeVerification.count({ where: { status: 'pending' } }),
    prisma.storeVerification.count({ where: { status: 'verified' } }),
    prisma.storeVerification.count({ where: { status: 'rejected' } }),
    prisma.storeVerification.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'asc' },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                firstName: true,
                email: true
              }
            }
          }
        }
      }
    })
  ]);

  const stats = {
    totalPending,
    totalVerified,
    totalRejected,
    total: totalPending + totalVerified + totalRejected,
    recentVerifications: recentVerifications.map(v => sanitizeVerificationForAdmin(v))
  };

  // Cache for 2 minutes
  await cache.set(cacheKey, 120, JSON.stringify(stats));

  res.status(200).json({
    success: true,
    data: stats
  });
});