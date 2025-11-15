import { uploadToCloudinary, deleteFromCloudinary, uploadPresets } from '../config/cloudinary.js';
import { cache } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';
import { sendNotification } from '../utils/sendnotification.js';

export const submitStoreVerification = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const userId = req.user.userId;

    // Find the user's store
    const store = await prisma.store.findFirst({
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
      return res.status(404).json({
        success: false,
        message: 'Store not found. You must create a store first.'
      });
    }

    // Check if verification already exists and is pending/verified
    let existingVerification = await prisma.storeVerification.findUnique({
      where: { storeId: store.id }
    });

    if (existingVerification && existingVerification.status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Store is already verified.'
      });
    }

    // Validate required files are present
    const { ghanaCardFront, ghanaCardBack, selfie, businessDoc } = req.files || {};
    
    if (!ghanaCardFront || !ghanaCardBack || !selfie) {
      return res.status(400).json({
        success: false,
        message: 'Ghana Card Front, Back, and Selfie are required.'
      });
    }

    // Upload documents to Cloudinary
    let ghanaCardFrontUrl, ghanaCardBackUrl, selfieUrl, businessDocUrl = null;
    const uploadedUrls = []; // Track successfully uploaded URLs for cleanup

    try {
      // Upload required documents
      const frontRes = await uploadToCloudinary(
        ghanaCardFront[0].buffer, 
        { 
          folder: 'store-verifications/ghana-card', 
          width: 800, 
          height: 600, 
          crop: 'fill',
          gravity: 'center'
        }
      );
      ghanaCardFrontUrl = frontRes.secure_url;
      uploadedUrls.push(ghanaCardFrontUrl);

      const backRes = await uploadToCloudinary(
        ghanaCardBack[0].buffer, 
        { 
          folder: 'store-verifications/ghana-card', 
          width: 800, 
          height: 600, 
          crop: 'fill',
          gravity: 'center'
        }
      );
      ghanaCardBackUrl = backRes.secure_url;
      uploadedUrls.push(ghanaCardBackUrl);

      const selfieRes = await uploadToCloudinary(
        selfie[0].buffer, 
        { 
          folder: 'store-verifications/selfie',
          width: 500,
          height: 500,
          crop: 'fill',
          gravity: 'face'
        }
      );
      selfieUrl = selfieRes.secure_url;
      uploadedUrls.push(selfieUrl);

      // Upload optional business document if provided
      if (businessDoc && businessDoc.length > 0) {
        const businessDocRes = await uploadToCloudinary(
          businessDoc[0].buffer, 
          { 
            folder: 'store-verifications/business-docs', 
            width: 1000, 
            height: 1000, 
            crop: 'fill',
            gravity: 'center'
          }
        );
        businessDocUrl = businessDocRes.secure_url;
        uploadedUrls.push(businessDocUrl);
      }
    } catch (uploadError) {
      console.error('Error uploading verification documents to Cloudinary:', uploadError);
      
      // Clean up any successfully uploaded files
      for (const url of uploadedUrls) {
        try {
          await deleteFromCloudinary(url);
        } catch (deleteError) {
          console.error('Error cleaning up uploaded file:', deleteError);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error uploading verification documents.',
        error: uploadError.message
      });
    }

    const verificationData = {
      ghanaCardFront: ghanaCardFrontUrl,
      ghanaCardBack: ghanaCardBackUrl,
      selfie: selfieUrl,
      businessDoc: businessDocUrl,
      status: 'pending',
      rejectionReason: rejectionReason || null,
      verifiedAt: null,
    };

    let verification;
    const isResubmission = !!existingVerification;

    if (existingVerification) {
      // Delete old documents if they exist
      const oldUrls = [
        existingVerification.ghanaCardFront,
        existingVerification.ghanaCardBack,
        existingVerification.selfie,
        existingVerification.businessDoc
      ].filter(Boolean);

      for (const url of oldUrls) {
        try {
          await deleteFromCloudinary(url);
        } catch (deleteError) {
          console.error('Error deleting old verification document:', deleteError);
        }
      }

      // Update existing verification record
      verification = await prisma.storeVerification.update({
        where: { storeId: store.id },
        data: verificationData,
      });

      // Reset store's active status if resubmitting
      await prisma.store.update({
        where: { id: store.id },
        data: { isActive: false }
      });
    } else {
      // Create new verification record
      verification = await prisma.storeVerification.create({
        data: {
          ...verificationData,
          storeId: store.id,
        },
      });
    }

    // Invalidate cache
    await cache.del(`store:slug:${store.url}`);
    await cache.del(`user:${userId}:store`);

    // Send in-app notification
    await sendNotification(
      userId,
      'Verification Submitted',
      isResubmission 
        ? `Your updated verification documents for "${store.name}" have been submitted and are under review.`
        : `Your verification documents for "${store.name}" have been submitted successfully. We'll review them shortly.`,
      'store_verification',
      { 
        storeId: store.id, 
        verificationId: verification.id,
        status: 'pending'
      }
    );

    // Send confirmation email
    try {
      await sendEmailNotification({
        to: store.user.email,
        toName: store.user.firstName,
        subject: isResubmission 
          ? 'Verification Documents Resubmitted'
          : 'Store Verification Submitted - Under Review',
        template: 'generic',
        templateData: {
          title: isResubmission ? 'Documents Resubmitted ✓' : 'Verification Submitted ✓',
          message: isResubmission
            ? `Your updated verification documents for <strong>${store.name}</strong> have been received and are currently under review. We'll notify you once the review is complete.`
            : `Thank you for submitting your verification documents for <strong>${store.name}</strong>. Our team is reviewing your submission and will get back to you within 24-48 hours.`,
          ctaText: 'Check Status',
          ctaUrl: `${process.env.FRONTEND_URL}/dashboard/store/verification`
        }
      });
    } catch (emailError) {
      console.error('Error sending verification submission email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Store verification submitted successfully. Awaiting review.',
      data: verification
    });

  } catch (error) {
    console.error('Error submitting store verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getMyStoreVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

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

    res.status(200).json({
      success: true,
      data: verification
    });

  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

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
        skip: skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'asc' }
      }),
      prisma.storeVerification.count({
        where: { status: 'pending' }
      })
    ]);

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getAllVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, storeId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status && ['pending', 'verified', 'rejected'].includes(status)) {
      where.status = status;
    }
    
    if (storeId) {
      where.storeId = storeId;
    }

    if (search) {
      where.store = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { 
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }}
        ]
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
        skip: skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.storeVerification.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching all verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getVerificationDetails = async (req, res) => {
  try {
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

    res.status(200).json({
      success: true,
      data: verification
    });

  } catch (error) {
    console.error('Error fetching verification details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, rejectionReason } = req.body;

    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'verified' or 'rejected'."
      });
    }

    // Require rejection reason when rejecting
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting verification.'
      });
    }

    // Fetch the verification record
    const verification = await prisma.storeVerification.findUnique({
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
      return res.status(404).json({
        success: false,
        message: 'Verification record not found.'
      });
    }

    // Check if already in the same status
    if (verification.status === status) {
      return res.status(400).json({
        success: false,
        message: `Verification is already ${status}.`
      });
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

    // Update the verification record
    const updatedVerification = await prisma.storeVerification.update({
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

    // Update the associated store's active status
    const store = updatedVerification.store;
    await prisma.store.update({
      where: { id: store.id },
      data: { isActive: status === 'verified' }
    });

    // Invalidate relevant caches
    await cache.del(`store:slug:${store.url}`);
    await cache.del(`user:${store.userId}:store`);
    await cache.del(`store:${store.id}:verification`);

    // Send in-app notification to store owner
    const notificationTitle = status === 'verified' 
      ? 'Store Verified! 🎉' 
      : 'Verification Needs Attention';
    
    const notificationMessage = status === 'verified'
      ? `Congratulations! Your store "${store.name}" has been verified and is now live on Zuba.`
      : `Your verification for "${store.name}" requires some updates. ${rejectionReason}`;

    await sendNotification(
      store.userId,
      notificationTitle,
      notificationMessage,
      'store_verification',
      { 
        storeId: store.id, 
        verificationId: updatedVerification.id,
        status: status,
        rejectionReason: status === 'rejected' ? rejectionReason : null
      }
    );

    // Send email notification to store owner
    try {
      await sendEmailNotification({
        to: store.user.email,
        toName: store.user.name,
        subject: status === 'verified' 
          ? `${store.name} - Store Verified!` 
          : `${store.name} - Verification Update Required`,
        template: 'verification_status',
        templateData: {
          storeName: store.name,
          status: status,
          reason: rejectionReason,
          storeUrl: status === 'verified' 
            ? `${process.env.FRONTEND_URL}/store/${store.url}`
            : `${process.env.FRONTEND_URL}/dashboard/store/verification`
        }
      });

      console.log(`Verification ${status} email sent to ${store.user.email}`);
    } catch (emailError) {
      console.error('Error sending verification status email:', emailError);
      // Log but don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: `Store verification status updated to ${status}.`,
      data: updatedVerification
    });

  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;

    // Fetch the verification record
    const verification = await prisma.storeVerification.findUnique({
      where: { id: verificationId },
      include: {
        store: true
      }
    });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verification record not found.'
      });
    }

    // Delete documents from Cloudinary
    const documentUrls = [
      verification.ghanaCardFront,
      verification.ghanaCardBack,
      verification.selfie,
      verification.businessDoc
    ].filter(Boolean);

    for (const url of documentUrls) {
      try {
        await deleteFromCloudinary(url);
      } catch (deleteError) {
        console.error('Error deleting document from Cloudinary:', deleteError);
      }
    }

    // Delete verification record from database
    await prisma.storeVerification.delete({
      where: { id: verificationId }
    });

    // Update store status to inactive
    await prisma.store.update({
      where: { id: verification.storeId },
      data: { isActive: false }
    });

    // Invalidate caches
    await cache.del(`store:slug:${verification.store.url}`);
    await cache.del(`user:${verification.store.userId}:store`);
    await cache.del(`store:${verification.storeId}:verification`);

    res.status(200).json({
      success: true,
      message: 'Verification record deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getVerificationStats = async (req, res) => {
  try {
    const [totalPending, totalVerified, totalRejected, recentVerifications] = await Promise.all([
      prisma.storeVerification.count({
        where: { status: 'pending' }
      }),
      prisma.storeVerification.count({
        where: { status: 'verified' }
      }),
      prisma.storeVerification.count({
        where: { status: 'rejected' }
      }),
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

    res.status(200).json({
      success: true,
      data: {
        totalPending,
        totalVerified,
        totalRejected,
        total: totalPending + totalVerified + totalRejected,
        recentVerifications
      }
    });

  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};