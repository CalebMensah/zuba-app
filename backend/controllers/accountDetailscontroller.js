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
        account_number: mobileNumber,   // REQUIRED
        bank_code: provider,            // MTN, VOD, TGO
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

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true, url: true },
    });

    if (!store)
      return res.status(400).json({ success: false, message: "Store not found." });

    const storeId = store.id;

    const {
      accountType,
      bankName,
      accountNumber,
      accountName,
      provider,
      mobileNumber,
      isPrimary = true,
      isActive = true
    } = req.body;

    // Validate type
    if (!["bank", "mobile_money"].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "accountType must be 'bank' or 'mobile_money'."
      });
    }

    // Validation: Bank
    if (accountType === "bank") {
      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({
          success: false,
          message: "For bank accounts, bankName, accountNumber, and accountName are required."
        });
      }
    }

    // Validation: Mobile Money
    if (accountType === "mobile_money") {
      if (!provider || !mobileNumber) {
        return res.status(400).json({
          success: false,
          message: "For mobile money accounts, provider and mobileNumber are required."
        });
      }
    }

    /* -----------------------------------------
        CREATE PAYSTACK RECIPIENT IF MISSING
    ------------------------------------------ */
    let recipientCode;

    const existing = await prisma.paymentAccount.findUnique({
      where: { storeId },
    });

    if (!existing || !existing.paystackRecipientCode) {
      recipientCode = await createPaystackRecipient({
        accountType,
        bankName,
        accountNumber,
        accountName,
        provider,
        mobileNumber
      });
    }

    /* -----------------------------------------
        UPSERT DATABASE RECORD
    ------------------------------------------ */
    const data = {
      accountType,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      accountName: accountName || null,
      provider: provider || null,
      mobileNumber: mobileNumber || null,
      isPrimary,
      isActive,
      paystackRecipientCode: recipientCode || existing?.paystackRecipientCode || null,
      store: { connect: { id: storeId } }
    };

    const paymentAccount = await prisma.paymentAccount.upsert({
      where: { storeId },
      create: data,
      update: data
    });

    // Clear cache
    await cache.del(`user:${userId}:store`);
    await cache.del(`store:slug:${store.url}`);

    console.log("Upserted Payment Account:", paymentAccount);

    res.json({
      success: true,
      message: "Payment account saved successfully.",
      paymentAccount
    });

  } catch (error) {
    console.error("Error in upsertPaymentAccount:", error);
    res.status(500).json({ success: false, message: error.message });
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
