import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface BankAccount {
  accountType: 'bank';
  bankName: string;
  accountNumber: string;
  accountName: string;
  provider?: never;
  mobileNumber?: never;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface MobileMoneyAccount {
  accountType: 'mobile_money';
  provider: string;
  mobileNumber: string;
  bankName?: never;
  accountNumber?: never;
  accountName?: never;
  isPrimary?: boolean;
  isActive?: boolean;
}

export type PaymentAccountInput = BankAccount | MobileMoneyAccount;

export interface PaymentAccount {
  id: string;
  storeId: string;
  accountType: 'bank' | 'mobile_money';
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  provider?: string | null;
  mobileNumber?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  paymentAccount?: T;
  error?: string;
}

interface UsePaymentAccountReturn {
  loading: boolean;
  error: string | null;
  paymentAccount: PaymentAccount | null;
  upsertPaymentAccount: (data: PaymentAccountInput) => Promise<PaymentAccount | null>;
  getMyPaymentAccount: () => Promise<PaymentAccount | null>;
  getPaymentAccountByStoreUrl: (storeUrl: string) => Promise<PaymentAccount | null>;
  deletePaymentAccount: () => Promise<boolean>;
  clearError: () => void;
}

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const usePaymentAccount = (): UsePaymentAccountReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(null);

  // Get token from AsyncStorage
  const getToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error getting token from AsyncStorage:', err);
      return null;
    }
  };

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Upsert payment account
  const upsertPaymentAccount = useCallback(
    async (data: PaymentAccountInput): Promise<PaymentAccount | null> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication token not found. Please login again.');
        }

        const response = await fetch(`${API_BASE_URL}/payment-accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        const result: ApiResponse<PaymentAccount> = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Failed to save payment account');
        }

        if (result.success && result.paymentAccount) {
          setPaymentAccount(result.paymentAccount);
          return result.paymentAccount;
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error upserting payment account:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get user's payment account
  const getMyPaymentAccount = useCallback(async (): Promise<PaymentAccount | null> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      const response = await fetch(`${API_BASE_URL}/payment-accounts/my-account`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: ApiResponse<PaymentAccount> = await response.json();

      if (response.status === 404) {
        // No payment account found - this is not an error
        setPaymentAccount(null);
        return null;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch payment account');
      }

      if (result.success && result.paymentAccount) {
        setPaymentAccount(result.paymentAccount);
        return result.paymentAccount;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching payment account:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get payment account by store URL (public)
  const getPaymentAccountByStoreUrl = useCallback(
    async (storeUrl: string): Promise<PaymentAccount | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/payment-accounts/store/${storeUrl}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<PaymentAccount> = await response.json();

        if (response.status === 404) {
          setError('Payment account not found for this store');
          return null;
        }

        if (!response.ok) {
          throw new Error(result.message || 'Failed to fetch payment account');
        }

        if (result.success && result.paymentAccount) {
          return result.paymentAccount;
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error fetching payment account by store URL:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Delete payment account
  const deletePaymentAccount = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      const response = await fetch(`${API_BASE_URL}/payment-accounts/my-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: ApiResponse<never> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete payment account');
      }

      if (result.success) {
        setPaymentAccount(null);
        return true;
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error deleting payment account:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    paymentAccount,
    upsertPaymentAccount,
    getMyPaymentAccount,
    getPaymentAccountByStoreUrl,
    deletePaymentAccount,
    clearError,
  };
};