import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Types
interface InitiatePaymentData {
  orderId: string;
  email: string;
  amount: number;
  currency?: string;
}

// NEW: Multi-store checkout session data
interface CreateCheckoutSessionData {
  orderIds: string[];
  email: string;
  callbackUrl?: string;
}

// NEW: Checkout session response
interface CheckoutSessionResponse {
  success: boolean;
  message: string;
  data: {
    checkoutSessionId: string;
    authorizationUrl: string;
    reference: string;
    totalAmount: number;
    orderCount: number;
    orders: Array<{
      orderId: string;
      storeId: string;
      storeName: string;
      amount: number;
    }>;
    payments: Array<{
      paymentId: string;
      orderId: string;
    }>;
  };
}

interface PaymentInitiationResponse {
  success: boolean;
  message: string;
  data: {
    checkoutSessionId: string; // NEW
    authorizationUrl: string;
    reference: string;
    paymentId: string;
  };
}

interface PaymentDetails {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayRef: string;
  gatewayStatus: string;
  status: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    totalAmount: number;
    checkoutSession?: string; // NEW
    buyer: {
      id: string;
      firstName: string;
      email: string;
    };
    store: {
      user: {
        id: string;
        firstName: string;
        email: string;
      };
    };
  };
  escrow?: {
    id: string;
    amountHeld: number;
    currency: string;
    status: string;
    releaseDate: string;
  };
}

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayRef: string;
  gatewayStatus: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    status: string;
    totalAmount: number;
    buyerId: string;
    storeId: string;
    checkoutSession?: string; // NEW
    buyer: {
      firstName: string;
      email: string;
    };
    store: {
      name: string;
    };
  };
}

// NEW: Checkout session payments response
interface CheckoutSessionPaymentsResponse {
  success: boolean;
  data: {
    checkoutSession: string;
    orders: Array<{
      id: string;
      status: string;
      paymentStatus: string;
      totalAmount: number;
      storeId: string;
      payment: PaymentDetails;
      store: {
        id: string;
        name: string;
        logo: string;
      };
      items: Array<{
        id: string;
        quantity: number;
        price: number;
        product: {
          id: string;
          name: string;
          images: string[];
        };
      }>;
    }>;
    summary: {
      totalOrders: number;
      totalAmount: number;
      allPaymentsSuccessful: boolean;
      currency: string;
    };
  };
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserPaymentsResponse {
  success: boolean;
  data: Payment[];
  pagination: PaginationData;
}

interface PaymentVerificationResponse {
  success: boolean;
  data: {
    payments: PaymentDetails[]; // Changed to array for multi-store support
    gatewayData: any;
    isMultiStore: boolean; // NEW
  };
}

interface ApiErrorResponse {
  success: boolean;
  message: string;
  error?: string;
}

export const usePayment = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [checkoutSessionData, setCheckoutSessionData] = useState<CheckoutSessionPaymentsResponse['data'] | null>(null); // NEW

  // Get authentication token from AsyncStorage
  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error getting auth token:', err);
      return null;
    }
  };

  // Configure axios headers with authentication
  const getConfig = async () => {
    const token = await getAuthToken();
    return {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
  };

  // NEW: Create checkout session for multiple orders (multi-store)
  const createCheckoutSession = async (
    sessionData: CreateCheckoutSessionData
  ): Promise<CheckoutSessionResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const response = await axios.post<CheckoutSessionResponse>(
        `${API_URL}/payments/checkout-session`,
        sessionData,
        config
      );
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to create checkout session';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Initiate payment (single order - legacy support)
  const initiatePayment = async (
    paymentData: InitiatePaymentData
  ): Promise<PaymentInitiationResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const response = await axios.post<PaymentInitiationResponse>(
        `${API_URL}/payments/initiate`,
        paymentData,
        config
      );
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to initiate payment';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get payment details by ID
  const getPaymentDetails = async (paymentId: string): Promise<PaymentDetails | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const response = await axios.get<{ success: boolean; data: PaymentDetails }>(
        `${API_URL}/payments/${paymentId}`,
        config
      );
      setPaymentDetails(response.data.data);
      return response.data.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to fetch payment details';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // NEW: Get payments by checkout session
  const getPaymentsByCheckoutSession = async (
    sessionId: string
  ): Promise<CheckoutSessionPaymentsResponse['data'] | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const response = await axios.get<CheckoutSessionPaymentsResponse>(
        `${API_URL}/payments/checkout-session/${sessionId}`,
        config
      );
      setCheckoutSessionData(response.data.data);
      return response.data.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to fetch checkout session payments';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get user's payments with pagination
  const getUserPayments = async (
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<UserPaymentsResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const params: any = { page, limit };
      if (status) params.status = status;

      const response = await axios.get<UserPaymentsResponse>(
        `${API_URL}/payments/user/all`,
        { ...config, params }
      );
      
      setPayments(response.data.data);
      setPagination(response.data.pagination);
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to fetch payments';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Verify payment by reference
  const verifyPayment = async (reference: string): Promise<PaymentVerificationResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const response = await axios.get<PaymentVerificationResponse>(
        `${API_URL}/payments/verify/${reference}`,
        config
      );
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to verify payment';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Clear payment details
  const clearPaymentDetails = () => {
    setPaymentDetails(null);
  };

  // Clear payments list
  const clearPayments = () => {
    setPayments([]);
    setPagination(null);
  };

  // NEW: Clear checkout session data
  const clearCheckoutSession = () => {
    setCheckoutSessionData(null);
  };

  return {
    loading,
    error,
    paymentDetails,
    payments,
    pagination,
    checkoutSessionData, // NEW
    createCheckoutSession, // NEW
    initiatePayment,
    getPaymentDetails,
    getPaymentsByCheckoutSession, // NEW
    getUserPayments,
    verifyPayment,
    clearError,
    clearPaymentDetails,
    clearPayments,
    clearCheckoutSession // NEW
  };
};