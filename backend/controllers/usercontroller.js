import { 
  uploadToCloudinary, 
  deleteFromCloudinary, 
  uploadPresets 
} from '../config/cloudinary.js';
import prisma from '../config/prisma.js';

// Update profile information
export const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { firstName, lastName, phone } = req.body;

  try {
    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate phone if provided
    if (phone && phone !== user.phone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format',
        });
      }

      // Check if phone is already taken
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone,
          NOT: { id: userId },
        },
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already in use',
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Remove sensitive data
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = updatedUser;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Upload/Update avatar
export const updateAvatar = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed',
      });
    }

    // Validate file size (5MB max)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB',
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar) {
      await deleteFromCloudinary(user.avatar);
    }

    // Upload new avatar to Cloudinary using preset
    const result = await uploadToCloudinary(req.file.buffer, uploadPresets.avatar);

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: result.secure_url,
      },
    });

    // Remove sensitive data
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = updatedUser;

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      user: userWithoutSensitiveData,
      avatarUrl: result.secure_url,
    });

  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete avatar
export const deleteAvatar = async (req, res) => {
  const userId = req.user.userId;

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

    if (!user.avatar) {
      return res.status(400).json({
        success: false,
        message: 'No avatar to delete',
      });
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(user.avatar);

    // Update user to remove avatar
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: null,
      },
    });

    // Remove sensitive data
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = updatedUser;

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};