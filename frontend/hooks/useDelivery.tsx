import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DeliveryInfo,
  DeliveryStatus,
  DeliveryProofType
} from '../types/order';

// ── Param Types ───────────────────────────────────────────────────────────────

interface ShipOrderParams {
  courierService: string;
  trackingNumber?: string;
  estimatedDeliveryDays?: number;
  dispatchNote?: string;
}

interface UpdateDeliveryParams {
  orderId: string;
  courierService?: string;
  trackingNumber?: string;
  estimatedDeliveryDays?: number;
  dispatchNote?: string;
  status?: DeliveryStatus;
}

interface AddDeliveryProofParams {
  orderId: string;
  type: DeliveryProofType;
  imageUris: string[];
  note?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  status?: string;
}

// ── Response Types ────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

interface PaginatedDeliveryResponse {
  deliveries: (DeliveryInfo & {
    order: {
      id: string;
      orderNumber?: string;
      status: string;
      totalAmount: number;
      createdAt: string;
      buyer?: any;
      store: any;
    };
  })[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface DeliveryStats {
  total: number;
  PENDING: number;
  PROCESSING: number;
  DISPATCHED: number;
  DELIVERED: number;
  FAILED: number;
  RETURNED: number;
}

interface ShipOrderResult {
  orderId: string;
  orderStatus: string;
  deliveryStatus: DeliveryStatus;
  courierService: string;
  trackingNumber?: string | null;
  estimatedDeliveryDays?: number | null;
  dispatchedAt: string;
  proofs: string[];
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const useDelivery = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error retrieving token:', err);
      return null;
    }
  };

  const apiCall = async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<ApiResponse<T>> => {
    try {
      const token = await getToken();

      if (!token) {
        throw new Error('Authentication token not found. Please log in.');
      }

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const config: RequestInit = { method, headers };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
      }

      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Network error occurred');
    }
  };

  const getDeliveryInfo = useCallback(async (
    orderId: string
  ): Promise<DeliveryInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<DeliveryInfo>(
        `/delivery/order/${orderId}`,
        'GET'
      );

      if (response.success && response.data) return response.data;
      throw new Error(response.message || 'Failed to fetch delivery info');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch delivery info');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const shipOrder = useCallback(async (
    orderId: string,
    params: ShipOrderParams,
    imageUris: string[]
  ): Promise<ShipOrderResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not found. Please log in.');

      const formData = new FormData();

      formData.append('courierService', params.courierService);
      if (params.trackingNumber) formData.append('trackingNumber', params.trackingNumber);
      if (params.estimatedDeliveryDays !== undefined) {
        formData.append('estimatedDeliveryDays', String(params.estimatedDeliveryDays));
      }
      if (params.dispatchNote) formData.append('dispatchNote', params.dispatchNote);

      imageUris.forEach((uri, index) => {
        formData.append('proofs', {
          uri,
          type: 'image/jpeg',
          name: `proof_${Date.now()}_${index}.jpg`
        } as any);
      });

      const response = await fetch(`${API_BASE_URL}/delivery/ship/${orderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to ship order');
      }

      return data.data;
    } catch (err: any) {
      setError(err.message || 'Failed to ship order');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDeliveryInfo = useCallback(async (
    params: UpdateDeliveryParams
  ): Promise<DeliveryInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const { orderId, ...body } = params;
      const response = await apiCall<DeliveryInfo>(
        `/delivery/order/${orderId}`,
        'PATCH',
        body
      );

      if (response.success && response.data) return response.data;
      throw new Error(response.message || 'Failed to update delivery info');
    } catch (err: any) {
      setError(err.message || 'Failed to update delivery info');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addDeliveryProof = useCallback(async (
    params: AddDeliveryProofParams
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not found. Please log in.');

      const formData = new FormData();
      formData.append('type', params.type);
      if (params.note) formData.append('note', params.note);

      params.imageUris.forEach((uri, index) => {
        formData.append('proofs', {
          uri,
          type: 'image/jpeg',
          name: `proof_${Date.now()}_${index}.jpg`
        } as any);
      });

      const response = await fetch(
        `${API_BASE_URL}/delivery/order/${params.orderId}/proof`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload proof');
      }

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to upload proof');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllSellerDeliveries = useCallback(async (
    params?: PaginationParams
  ): Promise<PaginatedDeliveryResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiCall<{ data: any[]; pagination: any }>(
        `/delivery/seller/all?${queryParams.toString()}`,
        'GET'
      );

      if (response.success && response.data) {
        return {
          deliveries: response.data.data,
          pagination: response.data.pagination
        };
      }

      throw new Error(response.message || 'Failed to fetch deliveries');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deliveries');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

 
  const getBuyerDeliveries = useCallback(async (
    params?: PaginationParams
  ): Promise<PaginatedDeliveryResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiCall<{ data: any[]; pagination: any }>(
        `/delivery/buyer/all?${queryParams.toString()}`,
        'GET'
      );

      if (response.success && response.data) {
        return {
          deliveries: response.data.data,
          pagination: response.data.pagination
        };
      }

      throw new Error(response.message || 'Failed to fetch deliveries');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deliveries');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSellerDeliveryStats = useCallback(async (): Promise<DeliveryStats | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<DeliveryStats>(
        '/delivery/seller/stats',
        'GET'
      );

      if (response.success && response.data) return response.data;
      throw new Error(response.message || 'Failed to fetch delivery stats');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch delivery stats');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    clearError,
    // Shared
    getDeliveryInfo,
    addDeliveryProof,
    // Seller
    shipOrder,
    updateDeliveryInfo,
    getAllSellerDeliveries,
    getSellerDeliveryStats,
    // Buyer
    getBuyerDeliveries
  };
};