import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface PointsBalance {
  points: number;
  cedisEquivalent: number;
  conversionRate: number;
}

interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category: string;
  tags: string[];
  sizes?: string[];
  color?: string[];
  weight?: number;
  sellerNote?: string;
  moq?: number;
  quantityBought: number;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RedeemableProductsData {
  products: Product[];
  userPoints: number;
  userCedisEquivalent: number;
  conversionRate: number;
}

interface DeliveryInfo {
  recipient: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  region: string;
  country?: string;
  postalCode?: string;
  deliveryType?: 'STANDARD' | 'EXPRESS' | 'PICKUP';
  deliveryInstructions?: string;
  preferredDeliveryDate?: string;
  preferredDeliveryTime?: string;
  notes?: string;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  total: number;
  product: {
    id: string;
    name: string;
    images: string[];
  };
}

interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discount: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  store: {
    id: string;
    name: string;
    url: string;
  };
}

interface RedeemResponse {
  order: Order;
  redeemedPoints: number;
  newPointBalance: number;
}

interface PointsHistoryData {
  orders: Order[];
  summary: {
    totalRedemptions: number;
    totalPointsRedeemed: number;
    conversionRate: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  cached?: boolean;
}

export const usePoints = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
    } catch (err) {
      throw new Error('Failed to get authentication token');
    }
  };

  const handleApiError = (err: any): string => {
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.message) {
      return err.message;
    }
    return 'An unexpected error occurred';
  };

  const getPointsBalance = useCallback(async (): Promise<PointsBalance | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/points/balance`, {
        method: 'GET',
        headers,
      });

      const result: ApiResponse<PointsBalance> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch points balance');
      }

      return result.data || null;
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRedeemableProducts = useCallback(async (
    limit: number = 50
  ): Promise<RedeemableProductsData | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/points/redeemable-products?limit=${limit}`,
        {
          method: 'GET',
          headers,
        }
      );

      const result: ApiResponse<RedeemableProductsData> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch redeemable products');
      }

      return result.data || null;
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const redeemPoints = useCallback(async (
    productId: string,
    quantity: number,
    deliveryInfo: DeliveryInfo
  ): Promise<RedeemResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/points/redeem/${productId}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ quantity, deliveryInfo }),
        }
      );

      const result: ApiResponse<RedeemResponse> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to redeem points');
      }

      return result.data || null;
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPointsHistory = useCallback(async (
    page: number = 1,
    limit: number = 20
  ): Promise<PointsHistoryData | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/points/history?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers,
        }
      );

      const result: ApiResponse<PointsHistoryData> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch points history');
      }

      return result.data || null;
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    getPointsBalance,
    getRedeemableProducts,
    redeemPoints,
    getPointsHistory,
  };
};

export type {
  PointsBalance,
  Product,
  RedeemableProductsData,
  DeliveryInfo,
  Order,
  OrderItem,
  RedeemResponse,
  PointsHistoryData,
};