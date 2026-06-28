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


interface CreateCheckoutSessionData {
  orderIds: string[];
  email: string;
  callbackUrl?: string;
}

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
    checkoutSessionId: string;
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
    checkoutSession?: string;
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
    checkoutSession?: string;
    buyer: {
      firstName: string;
      email: string;
    };
    store: {
      name: string;
    };
  };
}

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
    payments: PaymentDetails[];
    gatewayData: any;
    isMultiStore: boolean;
  };
}

// NEW: Admin payments interfaces
interface AdminPaymentData {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayRef: string;
  gatewayStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    totalAmount: number;
    checkoutSession: string | null;
    createdAt: string;
    buyer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      profilePicture: string | null;
    };
    store: {
      id: string;
      name: string;
      logo: string | null;
      userId: string;
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
  };
  escrow: {
    id: string;
    status: string;
    amountHeld: number;
    releaseDate: string;
    releasedAt: string | null;
  } | null;
}

interface AdminPaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface AdminStatistics {
  totalAmount: number;
  averageAmount: number;
  totalPayments: number;
  byStatus: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
  byGateway: Array<{
    gateway: string;
    count: number;
    totalAmount: number;
  }>;
  byCurrency: Array<{
    currency: string;
    count: number;
    totalAmount: number;
  }>;
}

interface AdminPaymentsResponse {
  success: boolean;
  data: AdminPaymentData[];
  pagination: AdminPaginationData;
  statistics: AdminStatistics;
  filters: {
    status?: string;
    gateway?: string;
    gatewayStatus?: string;
    currency?: string;
    storeId?: string;
    buyerId?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: string;
    maxAmount?: string;
    search?: string;
  };
}

interface AdminPaymentsFilters {
  page?: number;
  limit?: number;
  status?: string;
  gateway?: string;
  gatewayStatus?: string;
  currency?: string;
  storeId?: string;
  buyerId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
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
  const [checkoutSessionData, setCheckoutSessionData] = useState<CheckoutSessionPaymentsResponse['data'] | null>(null);
  
  // NEW: Admin-specific state
  const [adminPayments, setAdminPayments] = useState<AdminPaymentData[]>([]);
  const [adminStatistics, setAdminStatistics] = useState<AdminStatistics | null>(null);
  const [adminPagination, setAdminPagination] = useState<AdminPaginationData | null>(null);

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


  // Create checkout session for multiple orders (multi-store)
  const createCheckoutSession = async (
    sessionData: CreateCheckoutSessionData
  ): Promise<CheckoutSessionResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate input data
      if (!sessionData.orderIds || !Array.isArray(sessionData.orderIds) || sessionData.orderIds.length === 0) {
        const errorMsg = 'Order IDs array is required and must not be empty';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!sessionData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sessionData.email)) {
        const errorMsg = 'Valid email is required';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const config = await getConfig();
      
      // Debug logging
      console.log('Creating checkout session with data:', {
        orderIds: sessionData.orderIds,
        email: sessionData.email,
        callbackUrl: sessionData.callbackUrl,
        apiUrl: `${API_URL}/payments/checkout-session`
      });

      const response = await axios.post<CheckoutSessionResponse>(
        `${API_URL}/payments/checkout-session`,
        sessionData,
        config
      );
      
      console.log('Checkout session created successfully:', response.data);
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      
      // Enhanced error logging
      console.error('Checkout session error:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message,
        code: axiosError.code
      });

      let errorMessage = 'Failed to create checkout session';
      
      if (axiosError.response) {
        switch (axiosError.response.status) {
          case 400:
            errorMessage = axiosError.response.data?.message || 'Invalid request data. Please check your information and try again.';
            break;
          case 401:
            errorMessage = 'Authentication required. Please log in again.';
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            break;
          case 429:
            errorMessage = 'Too many payment attempts. Please wait a few minutes before trying again.';
            break;
          case 500:
            errorMessage = 'Payment service temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = axiosError.response.data?.message || `Server error (${axiosError.response.status}). Please try again.`;
        }
      } else if (axiosError.request) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else {
        errorMessage = axiosError.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
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

  // Get payments by checkout session
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

  // Verify payment by reference - WITH DETAILED LOGGING
  const verifyPayment = async (reference: string): Promise<PaymentVerificationResponse | null> => {
    console.log(`FRONTEND: Starting verifyPayment(${reference})`);
    setLoading(true);
    setError(null);
    
    try {
      const config = await getConfig();
      console.log(`Calling backend /verify-payment/${reference}`);
      
      const response = await axios.get<PaymentVerificationResponse>(
        `${API_URL}/payments/verify-payment/${reference}`,
        config
      );
      
      console.log(` FRONTEND VERIFY SUCCESS [${reference}]`, {
        success: response.data.success,
        paymentsCount: response.data.data.payments?.length || 0,
        statuses: response.data.data.payments?.map(p => p.status),
        gatewayStatus: response.data.data.gatewayData?.status
      });
      
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      console.error(`FRONTEND VERIFY FAILED [${reference}]`, {
        status: axiosError.response?.status,
        message: axiosError.response?.data?.message,
      });
      
      const errorMessage = axiosError.response?.data?.message || 'Failed to verify payment';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      console.log(`FRONTEND: verifyPayment(${reference}) complete`);
    }
  };

  // NEW: Get all payments (Admin only)
  const getAllPayments = async (
    filters?: AdminPaymentsFilters
  ): Promise<AdminPaymentsResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const config = await getConfig();
      const params: any = {
        page: filters?.page || 1,
        limit: filters?.limit || 20,
        sortBy: filters?.sortBy || 'createdAt',
        sortOrder: filters?.sortOrder || 'desc'
      };

      // Add optional filters
      if (filters?.status) params.status = filters.status;
      if (filters?.gateway) params.gateway = filters.gateway;
      if (filters?.gatewayStatus) params.gatewayStatus = filters.gatewayStatus;
      if (filters?.currency) params.currency = filters.currency;
      if (filters?.storeId) params.storeId = filters.storeId;
      if (filters?.buyerId) params.buyerId = filters.buyerId;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.minAmount !== undefined) params.minAmount = filters.minAmount;
      if (filters?.maxAmount !== undefined) params.maxAmount = filters.maxAmount;
      if (filters?.search) params.search = filters.search;

      const response = await axios.get<AdminPaymentsResponse>(
        `${API_URL}/payments/admin/all`,
        { ...config, params }
      );
      
      setAdminPayments(response.data.data);
      setAdminStatistics(response.data.statistics);
      setAdminPagination(response.data.pagination);
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to fetch admin payments';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markPaymentAsFailed = async (reference: string): Promise<void> => {
  try {
    const config = await getConfig();
    await axios.patch(
      `${API_URL}/payments/mark-failed/${reference}`,
      {},
      config
    );
  } catch (err) {
    console.error('Error marking payment as failed:', err);
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

  // Clear checkout session data
  const clearCheckoutSession = () => {
    setCheckoutSessionData(null);
  };

  // NEW: Clear admin payments data
  const clearAdminPayments = () => {
    setAdminPayments([]);
    setAdminStatistics(null);
    setAdminPagination(null);
  };

  return {
    // State
    loading,
    error,
    paymentDetails,
    payments,
    pagination,
    checkoutSessionData,
    adminPayments,
    adminStatistics,
    adminPagination,
    
    // Actions
    createCheckoutSession,
    initiatePayment,
    getPaymentDetails,
    getPaymentsByCheckoutSession,
    getUserPayments,
    verifyPayment,
    getAllPayments,
    markPaymentAsFailed,
    
    // Clear functions
    clearError,
    clearPaymentDetails,
    clearPayments,
    clearCheckoutSession,
    clearAdminPayments
  };
};