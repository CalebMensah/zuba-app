// controllers/addressController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';


export const createAddress = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      recipient,
      phone,
      addressLine1,
      addressLine2,
      city,
      region,
      country = "Ghana",
      postalCode,
      isDefault = false
    } = req.body;

    if (!recipient || !phone || !addressLine1 || !city || !region) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, phone, addressLine1, city, and region are required.'
      });
    }

    const validRegions = [
      "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
      "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"
    ];
    
    if (!validRegions.includes(region)) {
      return res.status(400).json({
        success: false,
        message: `Region must be one of the valid Ghana regions. Received: ${region}`
      });
    }

    let shouldBeDefault = isDefault;

    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          userId,
          isDefault: true
        },
        data: { isDefault: false }
      });
    } else {
      const userAddresses = await prisma.address.count({
        where: { userId }
      });
      if (userAddresses === 0) {
        shouldBeDefault = true;
      }
    }

    const address = await prisma.address.create({
      data: {
        userId,
        recipient,
        phone,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        region,
        country,
        postalCode: postalCode || null,
        isDefault: shouldBeDefault
      }
    });

    await cache.del(`user:${userId}:addresses`);

    res.status(201).json({
      success: true,
      message: 'Address created successfully.',
      data: address
    });

  } catch (error) {
    console.error('Error creating address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `user:${userId}:addresses`;

    const cachedAddresses = await cache.get(cacheKey);
    if (cachedAddresses) {
      return res.status(200).json({
        success: true,
        data: cachedAddresses,
        cached: true
      });
    }

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    await cache.set(cacheKey, addresses, 3600);

    res.status(200).json({
      success: true,
      data: addresses
    });

  } catch (error) {
    console.error('Error fetching user addresses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserAddressById = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.userId;

    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to the user.'
      });
    }

    res.status(200).json({
      success: true,
      data: address
    });

  } catch (error) {
    console.error('Error fetching user address by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.userId;

    const {
      recipient,
      phone,
      addressLine1,
      addressLine2,
      city,
      region,
      country,
      postalCode,
      isDefault
    } = req.body;

    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to the user.'
      });
    }

    const updateData = {};
    if (recipient !== undefined) updateData.recipient = recipient;
    if (phone !== undefined) updateData.phone = phone;
    if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 || null;
    if (city !== undefined) updateData.city = city;
    if (region !== undefined) {
      const validRegions = [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
        "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"
      ];
      if (!validRegions.includes(region)) {
        return res.status(400).json({
          success: false,
          message: `Region must be one of the valid Ghana regions. Received: ${region}`
        });
      }
      updateData.region = region;
    }
    if (country !== undefined) updateData.country = country;
    if (postalCode !== undefined) updateData.postalCode = postalCode || null;
    if (isDefault !== undefined) {
      updateData.isDefault = isDefault;
      if (isDefault) {
        await prisma.address.updateMany({
          where: {
            userId,
            isDefault: true,
            NOT: { id: addressId }
          },
          data: { isDefault: false }
        });
      }
    }

    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: updateData
    });

    await cache.del(`user:${userId}:addresses`);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully.',
      data: updatedAddress
    });

  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.userId;

    const addressToDelete = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!addressToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to the user.'
      });
    }

    if (addressToDelete.isDefault) {
      const otherAddresses = await prisma.address.count({
        where: {
          userId,
          NOT: { id: addressId }
        }
      });
      if (otherAddresses === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only default address. Please add another address and set it as default first.'
        });
      }
    }

    await prisma.address.delete({
      where: { id: addressId }
    });

    await cache.del(`user:${userId}:addresses`);

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.userId;

    const addressToSetDefault = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!addressToSetDefault) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to the user.'
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: {
          userId,
          isDefault: true
        },
        data: { isDefault: false }
      });

      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
    });

    await cache.del(`user:${userId}:addresses`);

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully.'
    });

  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};