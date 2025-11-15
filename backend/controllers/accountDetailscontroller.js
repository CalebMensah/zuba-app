import { cache } from '../config/redis.js'; 
import prisma from '../config/prisma.js';

export const upsertPaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch the user's store ID
    const userStore = await prisma.store.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id;

    const {
      accountType,
      bankName,
      accountNumber,
      accountName,
      provider,
      mobileNumber,
      isPrimary = true, // Default to true if not provided
      isActive = true   // Default to true if not provided
    } = req.body;

    // Validate required fields based on accountType
    if (accountType === 'bank') {
      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({
          success: false,
          message: 'For bank accounts, bankName, accountNumber, and accountName are required.'
        });
      }
      // Ensure mobile money fields are not provided for bank accounts
      if (provider || mobileNumber) {
         return res.status(400).json({
          success: false,
          message: 'Provider and mobileNumber should not be provided for bank accounts.'
        });
      }
    } else if (accountType === 'mobile_money') {
      if (!provider || !mobileNumber) {
        return res.status(400).json({
          success: false,
          message: 'For mobile money accounts, provider and mobileNumber are required.'
        });
      }
      // Ensure bank fields are not provided for mobile money accounts
      if (bankName || accountNumber || accountName) {
         return res.status(400).json({
          success: false,
          message: 'Bank name, account number, and account name should not be provided for mobile money accounts.'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "accountType must be 'bank' or 'mobile_money'."
      });
    }

    // Prepare data object for Prisma upsert
    const data = {
      accountType,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      accountName: accountName || null,
      provider: provider || null,
      mobileNumber: mobileNumber || null,
      isPrimary,
      isActive,
      store: { connect: { id: storeId } } // Connect to the user's store
    };

    // Upsert: Create if not exists, update if exists (based on storeId)
    const paymentAccount = await prisma.paymentAccount.upsert({
      where: { storeId }, // This is the unique field ensuring one account per store
      update: data,
      create: data
    });

    // Invalidate related caches (e.g., user's store details which might include payment info)
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${userStore.url}`); // Assuming you have the store URL

    res.status(200).json({
      success: true,
      message: 'Payment account created/updated successfully.',
       paymentAccount
    });

  } catch (error) {
    console.error('Error upserting payment account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserPaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId; 

    // Fetch the user's store ID
    const userStore = await prisma.store.findFirst({
      where: { userId },
      select: { id: true }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id;

    const paymentAccount = await prisma.paymentAccount.findUnique({
      where: { storeId } // Find by the unique storeId
    });

    if (!paymentAccount) {
      return res.status(404).json({
        success: false,
        message: 'Payment account not found for this store.'
      });
    }

    res.status(200).json({
      success: true,
       paymentAccount
    });

  } catch (error) {
    console.error('Error fetching user payment account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getPaymentAccountByStoreUrl = async (req, res) => {
  try {
    const { storeUrl } = req.params;

    // Find the store ID first
    const store = await prisma.store.findFirst({
      where: { url: storeUrl, isActive: true }, // Ensure store exists and is active
      select: { id: true }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    const storeId = store.id;

    // Fetch the associated payment account
    const paymentAccount = await prisma.paymentAccount.findUnique({
      where: { storeId }
    });

    if (!paymentAccount) {
      return res.status(404).json({
        success: false,
        message: 'Payment account not found for this store.'
      });
    }
    res.status(200).json({
      success: true,
       paymentAccount
    });

  } catch (error) {
    console.error('Error fetching payment account by store URL:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deletePaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch the user's store ID
    const userStore = await prisma.store.findFirst({
      where: { userId },
      select: { id: true }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id;

    // Find the existing payment account
    const existingAccount = await prisma.paymentAccount.findUnique({
      where: { storeId }
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Payment account not found for this store.'
      });
    }

    // Delete the payment account
    await prisma.paymentAccount.delete({
      where: { storeId }
    });

    // Invalidate related caches
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${userStore.url}`);

    res.status(200).json({
      success: true,
      message: 'Payment account deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting payment account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};