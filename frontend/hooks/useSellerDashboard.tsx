import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'

// Types
interface DashboardSummary {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
}

interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface SalesAnalytics {
  period: string;
  salesData: SalesDataPoint[];
}

interface TopProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  quantityBought: number;
  stock: number;
}

interface TopSellingProducts {
  topProducts: TopProduct[];
}

interface StatusCount {
  status: string;
  count: number;
}

interface OrderAnalytics {
  statusDistribution: StatusCount[];
  paymentStatusDistribution: StatusCount[];
}

interface StorePerformance {
  totalViews: number;
  totalOrders: number;
  conversionRate: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached?: boolean;
  message?: string;
}

interface UseSellerDashboardReturn {
  summary: DashboardSummary | null;
  salesAnalytics: SalesAnalytics | null;
  topProducts: TopSellingProducts | null;
  orderAnalytics: OrderAnalytics | null;
  storePerformance: StorePerformance | null;
  loading: boolean;
  error: string | null;
  fetchSummary: () => Promise<void>;
  fetchSalesAnalytics: (period?: string) => Promise<void>;
  fetchTopProducts: (limit?: number) => Promise<void>;
  fetchOrderAnalytics: () => Promise<void>;
  fetchStorePerformance: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL

export const useSellerDashboard = (): UseSellerDashboardReturn => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [topProducts, setTopProducts] = useState<TopSellingProducts | null>(null);
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(null);
  const [storePerformance, setStorePerformance] = useState<StorePerformance | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error getting token from AsyncStorage:', err);
      return null;
    }
  };

  const makeAuthenticatedRequest = async <T,>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> => {
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/seller-dashboard${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Request failed');
    }

    return response.json();
  };

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await makeAuthenticatedRequest<DashboardSummary>('/summary');
      setSummary(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch summary';
      setError(errorMessage);
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSalesAnalytics = useCallback(async (period: string = '7d') => {
    try {
      setLoading(true);
      setError(null);
      const data = await makeAuthenticatedRequest<SalesAnalytics>(
        `/sales-analytics?period=${period}`
      );
      setSalesAnalytics(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sales analytics';
      setError(errorMessage);
      console.error('Error fetching sales analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTopProducts = useCallback(async (limit: number = 10) => {
    try {
      setLoading(true);
      setError(null);
      const data = await makeAuthenticatedRequest<TopSellingProducts>(
        `/top-products?limit=${limit}`
      );
      setTopProducts(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch top products';
      setError(errorMessage);
      console.error('Error fetching top products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrderAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await makeAuthenticatedRequest<OrderAnalytics>('/order-analytics');
      setOrderAnalytics(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch order analytics';
      setError(errorMessage);
      console.error('Error fetching order analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStorePerformance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await makeAuthenticatedRequest<StorePerformance>('/store-performance');
      setStorePerformance(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch store performance';
      setError(errorMessage);
      console.error('Error fetching store performance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        fetchSummary(),
        fetchSalesAnalytics(),
        fetchTopProducts(),
        fetchOrderAnalytics(),
        fetchStorePerformance(),
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard';
      setError(errorMessage);
      console.error('Error refreshing dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchSalesAnalytics, fetchTopProducts, fetchOrderAnalytics, fetchStorePerformance]);

  return {
    summary,
    salesAnalytics,
    topProducts,
    orderAnalytics,
    storePerformance,
    loading,
    error,
    fetchSummary,
    fetchSalesAnalytics,
    fetchTopProducts,
    fetchOrderAnalytics,
    fetchStorePerformance,
    refreshAll,
  };
};