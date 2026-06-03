// controllers/payoutController.js
import prisma from "../config/prisma.js";
import { cache } from "../config/redis.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const createPaystackRecipient = async ({ accountType, bankName, accountNumber, accountName, provider, mobileNumber }) => {
  try {
    let payload = {};

    if (accountType === "bank") {
      payload = {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankName,
        currency: "GHS",
      };
    }

    if (accountType === "mobile_money") {
      payload = {
        type: "mobile_money",
        name: accountName || "Mobile Money User",
        account_number: mobileNumber,
        bank_code: provider,            
        currency: "GHS",
      };
    }

    const response = await axios.post(
      "https://api.paystack.co/transferrecipient",
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.recipient_code;

  } catch (error) {
    console.error("PAYSTACK RECIPIENT CREATION ERROR:", error.response?.data || error);
    throw new Error("Failed to create Paystack transfer recipient");
  }
};


export const upsertPaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Verify user owns a store
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true, url: true },
    });
    if (!store) {
      return res.status(400).json({ success: false, message: "Store not found." });
    }

    const {
      accountType,
      bankName,
      accountNumber,
      accountName,
      provider,
      mobileNumber,
      isPrimary = true,
      isActive = true,
    } = req.body;

    // Validate account type
    if (!["bank", "mobile_money"].includes(accountType)) {
      return res.status(400).json({ success: false, message: "Invalid account type." });
    }

    // Validate required fields
    if (accountType === "bank" && (!bankName || !accountNumber || !accountName)) {
      return res.status(400).json({ success: false, message: "Bank details incomplete." });
    }
    if (accountType === "mobile_money" && (!provider || !mobileNumber)) {
      return res.status(400).json({ success: false, message: "Mobile money details incomplete." });
    }

    // Check existing record
    const existing = await prisma.paymentAccount.findUnique({
      where: { storeId: store.id },
    });

    let recipientCode = existing?.paystackRecipientCode;

    // Only create new recipient if details changed
    const detailsChanged =
      !existing ||
      (accountType === "bank" &&
        (existing.bankName !== bankName || existing.accountNumber !== accountNumber)) ||
      (accountType === "mobile_money" &&
        (existing.provider !== provider || existing.mobileNumber !== mobileNumber));

    if (detailsChanged) {
      recipientCode = await createPaystackRecipient({
        accountType,
        bankName,
        accountNumber,
        accountName,
        provider,
        mobileNumber,
      });
    }

    // Save to DB
    const data = {
      accountType,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      accountName: accountName || null,
      provider: provider || null,
      mobileNumber: mobileNumber || null,
      isPrimary,
      isActive,
      paystackRecipientCode: recipientCode,
      store: { connect: { id: store.id } },
    };

    const paymentAccount = await prisma.paymentAccount.upsert({
      where: { storeId: store.id },
      create: data,
      update: data,
    });

    // If this is the first payment account, set user's payout preference automatically
    if (!existing) {
      await prisma.user.update({
        where: { id: userId },
        data: { payoutPreference: accountType }
      });
    }

    // Clear caches
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${store.url}`);

    // Return SAFE data
    const safeResponse = {
      id: paymentAccount.id,
      accountType: paymentAccount.accountType,
      bankName: paymentAccount.bankName,
      accountNumber: paymentAccount.accountNumber,
      accountName: paymentAccount.accountName,
      provider: paymentAccount.provider,
      isPrimary: paymentAccount.isPrimary,
      isActive: paymentAccount.isActive,
    };

    res.json({ 
      success: true, 
      message: "Payment account saved.", 
      paymentAccount: safeResponse,
      payoutPreferenceSet: !existing
    });
  } catch (error) {
    console.error("PAYOUT ERROR:", error);
    res.status(500).json({ success: false, message: "Could not save payment details." });
  }
};

export const getUserPaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!store)
      return res.status(400).json({ success: false, message: "Store not found." });

    const payment = await prisma.paymentAccount.findUnique({
      where: { storeId: store.id }
    });

    if (!payment)
      return res.status(404).json({ success: false, message: "No payment account found." });

    res.json({ success: true, paymentAccount: payment });

  } catch (error) {
    console.error("Error getUserPaymentAccount:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPaymentAccountByStoreUrl = async (req, res) => {
  try {
    const { storeUrl } = req.params;

    const store = await prisma.store.findFirst({
      where: { url: storeUrl, isActive: true },
      select: { id: true }
    });

    if (!store)
      return res.status(404).json({ success: false, message: "Store not found." });

    const payment = await prisma.paymentAccount.findUnique({
      where: { storeId: store.id }
    });

    if (!payment)
      return res.status(404).json({ success: false, message: "Payment account not found." });

    res.json({ success: true, paymentAccount: payment });

  } catch (error) {
    console.error("Error getPaymentAccountByStoreUrl:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePaymentAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true, url: true }
    });

    if (!store)
      return res.status(400).json({ success: false, message: "Store not found." });

    await prisma.paymentAccount.delete({
      where: { storeId: store.id }
    });

    // Clear cache
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${store.url}`);

    res.json({ success: true, message: "Payment account deleted." });

  } catch (error) {
    console.error("Error deletePaymentAccount:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePayoutPreference = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { payoutPreference } = req.body;

    // Validate
    if (!['mobile_money', 'bank'].includes(payoutPreference)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid payout preference. Must be 'mobile_money' or 'bank'." 
      });
    }

    // Verify user has a store (sellers only)
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true, url: true }
    });

    if (!store) {
      return res.status(400).json({ 
        success: false, 
        message: "Only sellers can set payout preferences." 
      });
    }

    // Update preference
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { payoutPreference },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        payoutPreference: true
      }
    });
    
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${store.url}`);

    res.json({ 
      success: true, 
      message: "Payout preference updated successfully.",
      data: updatedUser
    });

  } catch (error) {
    console.error("Error updating payout preference:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update payout preference." 
    });
  }
};

