import axios from 'axios';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Helper function to make Paystack API requests
const paystackRequest = async (method, endpoint, data = null) => {
  try {
    const response = await axios({
      method,
      url: `${PAYSTACK_BASE_URL}${endpoint}`,
      data,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const transferFundsToSeller = async ({
  amount,
  currency,
  recipientCode,
  orderId,
  reason
}) => {
  try {
    // Validate required parameters
    if (!amount || !recipientCode || !orderId) {
      throw new Error('Missing required parameters for fund transfer');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }

    console.log(`Initiating transfer of ${amount} ${currency} to recipient ${recipientCode} for order ${orderId}`);

    // Call Paystack Transfer API directly
    const transferResponse = await paystackRequest('POST', '/transfer', {
      source: 'balance',
      amount: Math.round(amount * 100), // Convert to kobo/pesewas
      recipient: recipientCode,
      reason: reason || `Payment for order #${orderId}`,
      currency: currency || 'GHS',
      reference: `transfer_${orderId}_${Date.now()}`
    });

    if (!transferResponse.status || !transferResponse.data) {
      throw new Error('Paystack transfer request failed');
    }

    console.log(`Transfer initiated successfully. Transfer code: ${transferResponse.data.transfer_code}`);

    return {
      success: true,
      transferData: transferResponse.data,
      transferCode: transferResponse.data.transfer_code,
      transferReference: transferResponse.data.reference,
      message: 'Transfer initiated successfully'
    };
  } catch (error) {
    console.error('Error transferring funds to seller:', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const verifyTransfer = async (transferCodeOrReference) => {
  try {
    if (!transferCodeOrReference) {
      throw new Error('Transfer code or reference is required');
    }

    const verificationResponse = await paystackRequest(
      'GET',
      `/transfer/verify/${transferCodeOrReference}`
    );

    if (!verificationResponse.status || !verificationResponse.data) {
      throw new Error('Transfer verification failed');
    }

    const transferData = verificationResponse.data;

    return {
      success: true,
      status: transferData.status, // 'pending', 'success', 'failed', 'reversed'
      amount: transferData.amount / 100, // Convert from kobo to main currency
      currency: transferData.currency,
      recipient: transferData.recipient,
      reason: transferData.reason,
      transferCode: transferData.transfer_code,
      reference: transferData.reference,
      createdAt: transferData.createdAt,
      updatedAt: transferData.updatedAt,
      transferData
    };

  } catch (error) {
    console.error('Error verifying transfer:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const createTransferRecipient = async ({
  type,
  name,
  accountNumber,
  bankCode,
  currency = 'GHS',
  email
}) => {
  try {
    // Validate required parameters
    if (!type || !name || !accountNumber || !bankCode) {
      throw new Error('Missing required parameters for recipient creation');
    }

    console.log(`Creating transfer recipient: ${name} (${accountNumber})`);

    const recipientData = {
      type,
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency
    };

    if (email) {
      recipientData.email = email;
    }

    // Call Paystack Create Transfer Recipient API
    const response = await paystackRequest('POST', '/transferrecipient', recipientData);

    if (!response.status || !response.data) {
      throw new Error('Failed to create transfer recipient');
    }

    console.log(`Recipient created successfully. Recipient code: ${response.data.recipient_code}`);

    return {
      success: true,
      recipientCode: response.data.recipient_code,
      recipientData: response.data,
      message: 'Transfer recipient created successfully'
    };

  } catch (error) {
    console.error('Error creating transfer recipient:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const updateTransferRecipient = async (recipientCodeOrId, updates) => {
  try {
    if (!recipientCodeOrId) {
      throw new Error('Recipient code or ID is required');
    }

    console.log(`Updating transfer recipient: ${recipientCodeOrId}`);

    const response = await paystackRequest(
      'PUT',
      `/transferrecipient/${recipientCodeOrId}`,
      updates
    );

    if (!response.status || !response.data) {
      throw new Error('Failed to update transfer recipient');
    }

    return {
      success: true,
      recipientData: response.data,
      message: 'Transfer recipient updated successfully'
    };

  } catch (error) {
    console.error('Error updating transfer recipient:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const listTransferRecipients = async ({ page = 1, perPage = 50 } = {}) => {
  try {
    const response = await paystackRequest(
      'GET',
      `/transferrecipient?page=${page}&perPage=${perPage}`
    );

    if (!response.status || !response.data) {
      throw new Error('Failed to list transfer recipients');
    }

    return {
      success: true,
      recipients: response.data,
      meta: response.meta,
      message: 'Recipients retrieved successfully'
    };

  } catch (error) {
    console.error('Error listing transfer recipients:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const deleteTransferRecipient = async (recipientCodeOrId) => {
  try {
    if (!recipientCodeOrId) {
      throw new Error('Recipient code or ID is required');
    }

    console.log(`Deleting transfer recipient: ${recipientCodeOrId}`);

    const response = await paystackRequest(
      'DELETE',
      `/transferrecipient/${recipientCodeOrId}`
    );

    if (!response.status) {
      throw new Error('Failed to delete transfer recipient');
    }

    return {
      success: true,
      message: 'Transfer recipient deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting transfer recipient:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const getSupportedBanks = async (country = 'ghana', currency = 'GHS') => {
  try {
    const response = await paystackRequest(
      'GET',
      `/bank?country=${country}&currency=${currency}`
    );

    if (!response.status || !response.data) {
      throw new Error('Failed to fetch supported banks');
    }

    return {
      success: true,
      banks: response.data,
      message: 'Banks retrieved successfully'
    };

  } catch (error) {
    console.error('Error fetching supported banks:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};

export const validateBankAccount = async ({ accountNumber, bankCode }) => {
  try {
    if (!accountNumber || !bankCode) {
      throw new Error('Account number and bank code are required');
    }

    const response = await paystackRequest(
      'GET',
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );

    if (!response.status || !response.data) {
      throw new Error('Account validation failed');
    }

    return {
      success: true,
      accountName: response.data.account_name,
      accountNumber: response.data.account_number,
      bankId: response.data.bank_id,
      message: 'Account validated successfully'
    };

  } catch (error) {
    console.error('Error validating bank account:', error);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
};