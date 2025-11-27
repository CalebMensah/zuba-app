import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface DashboardSummary {
  users: {
    total: number;
    last30Days: number;
    growth: number;
  };
  stores: {
    total: number;
    active: number;
    last30Days: number;
    inactive: number;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
  };
  orders: {
    total: number;
    successful: number;
    last30Days: number;
    successRate: string;
  };
  revenue: {
    total: number;
    last30Days: number;
    averageOrderValue: number;
  };
  reviews: {
    total: number;
    averageRating: number;
  };
  pending: {
    verifications: number;
    disputes: number;
  };
  timestamp: string;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface SalesAnalytics {
  period: string;
  startDate: string;
  endDate: string;
  data: SalesDataPoint[];
  totals: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    daysWithSales: number;
  };
}

export interface TopStore {
  id: string;
  name: string;
  url: string;
  category: string;
  rating: number;
  seller: {
    id: string;
    name: string;
    email: string;
  };
  performance: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
}

export interface TopStoresData {
  period: string;
  sortBy: string;
  limit: number;
  stores: TopStore[];
}

export interface UserGrowthDataPoint {
  date: string;
  newUsers: number;
  buyers: number;
  sellers: number;
  cumulativeTotal: number;
}

export interface UserGrowthAnalytics {
  period: string;
  startDate: string;
  endDate: string;
  data: UserGrowthDataPoint[];
  summary: {
    totalNewUsers: number;
    totalBuyers: number;
    totalSellers: number;
    averagePerDay: number;
  };
}

export interface Verification {
  id: string;
  storeId: string;
  ghanaCardFront: string;
  ghanaCardBack: string;
  selfie: string;
  businessDoc?: string | null;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  store: {
    id: string;
    name: string;
    url: string;
    category: string;
    user: {
      id: string;
      firstName: string;
      email: string;
      phone?: string;
    };
  };
}

export interface PendingVerifications {
  verifications: Verification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface Dispute {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  storeId: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  };
  buyer: {
    id: string;
    firstName: string;
    email: string;
  };
  seller: {
    id: string;
    firstName: string;
    email: string;
  };
  store: {
    id: string;
    name: string;
    url: string;
  };
}

export interface PendingDisputes {
  disputes: Dispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CategoryPerformance {
  category: string;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  averageRevenuePerStore: number;
}

export interface CategoryPerformanceData {
  period: string;
  categories: CategoryPerformance[];
  summary: {
    totalCategories: number;
    totalRevenue: number;
    totalOrders: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  cached?: boolean;
}

interface AnalyticsState {
  dashboardSummary: DashboardSummary | null;
  salesAnalytics: SalesAnalytics | null;
  topStores: TopStoresData | null;
  userGrowth: UserGrowthAnalytics | null;
  pendingVerifications: PendingVerifications | null;
  pendingDisputes: PendingDisputes | null;
  categoryPerformance: CategoryPerformanceData | null;
  loading: boolean;
  error: string | null;
}

export const useAdminAnalytics = () => {
  const [state, setState] = useState<AnalyticsState>({
    dashboardSummary: null,
    salesAnalytics: null,
    topStores: null,
    userGrowth: null,
    pendingVerifications: null,
    pendingDisputes: null,
    categoryPerformance: null,
    loading: false,
    error: null,
  });

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAuthToken]);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const handleApiError = useCallback((error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse<never>>;
      return axiosError.response?.data?.message || axiosError.message || 'An error occurred';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }, []);

  const getDashboardSummary = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
    data?: DashboardSummary;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<DashboardSummary>>(
        `${API_URL}/admin/analytics/summary`,
        { headers: await getAuthHeaders() }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          dashboardSummary: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch dashboard summary');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getSalesAnalytics = useCallback(async (
    period: '7d' | '30d' | '90d' | '365d' = '30d'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: SalesAnalytics;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<SalesAnalytics>>(
        `${API_URL}/admin/analytics/sales-revenue`,
        {
          params: { period },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          salesAnalytics: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch sales analytics');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getTopStores = useCallback(async (
    options: {
      limit?: number;
      sortBy?: 'revenue' | 'orders';
      period?: '7d' | '30d' | '90d' | '365d';
    } = {}
  ): Promise<{
    success: boolean;
    message?: string;
    data?: TopStoresData;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<TopStoresData>>(
        `${API_URL}/admin/analytics/top-stores`,
        {
          params: {
            limit: options.limit || 10,
            sortBy: options.sortBy || 'revenue',
            period: options.period || '30d',
          },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          topStores: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch top stores');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getUserGrowth = useCallback(async (
    period: '7d' | '30d' | '90d' | '365d' = '30d'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: UserGrowthAnalytics;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<UserGrowthAnalytics>>(
        `${API_URL}/admin/analytics/user-growth`,
        {
          params: { period },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          userGrowth: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch user growth');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getPendingVerifications = useCallback(async (
    page: number = 1,
    limit: number = 10
  ): Promise<{
    success: boolean;
    message?: string;
    data?: PendingVerifications;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<PendingVerifications>>(
        `${API_URL}/admin/analytics/pending-verifications`,
        {
          params: { page, limit },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          pendingVerifications: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch pending verifications');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getPendingDisputes = useCallback(async (
    page: number = 1,
    limit: number = 10
  ): Promise<{
    success: boolean;
    message?: string;
    data?: PendingDisputes;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<PendingDisputes>>(
        `${API_URL}/admin/analytics/pending-disputes`,
        {
          params: { page, limit },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          pendingDisputes: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch pending disputes');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const getCategoryPerformance = useCallback(async (
    period: '7d' | '30d' | '90d' | '365d' = '30d'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: CategoryPerformanceData;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse<CategoryPerformanceData>>(
        `${API_URL}/admin/analytics/category-performance`,
        {
          params: { period },
          headers: await getAuthHeaders(),
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          categoryPerformance: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch category performance');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetState = useCallback(() => {
    setState({
      dashboardSummary: null,
      salesAnalytics: null,
      topStores: null,
      userGrowth: null,
      pendingVerifications: null,
      pendingDisputes: null,
      categoryPerformance: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    dashboardSummary: state.dashboardSummary,
    salesAnalytics: state.salesAnalytics,
    topStores: state.topStores,
    userGrowth: state.userGrowth,
    pendingVerifications: state.pendingVerifications,
    pendingDisputes: state.pendingDisputes,
    categoryPerformance: state.categoryPerformance,
    loading: state.loading,
    error: state.error,
    getDashboardSummary,
    getSalesAnalytics,
    getTopStores,
    getUserGrowth,
    getPendingVerifications,
    getPendingDisputes,
    getCategoryPerformance,
    clearError,
    resetState,
  };
};

export default useAdminAnalytics;