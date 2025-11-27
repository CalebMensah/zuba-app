import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface DeliveryInfo {
  id: string;
  orderId: string;
  courierService: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverVehicleNumber: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  notes: string | null;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

type DeliveryStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'SHIPPED' 
  | 'OUT_FOR_DELIVERY' 
  | 'DELIVERED' 
  | 'RETURNED' 
  | 'CANCELLED';

interface AssignCourierParams {
  orderId: string;
  courierService: string;
  driverName: string;
  driverVehicleNumber: string;
  driverPhone?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  notes?: string;
}

interface EditDeliveryParams {
  orderId: string;
  courierService?: string;
  driverName?: string;
  driverVehicleNumber?: string;
  driverPhone?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  notes?: string;
  status?: DeliveryStatus;
}

interface SetDeliveryStatusParams {
  orderId: string;
  status: DeliveryStatus;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  status?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
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
  pending: number;
  processing: number;
  shipped: number;
  outForDelivery: number;
  delivered: number;
  returned: number;
  cancelled: number;
}

interface GetDeliveriesResponse {
  deliveries: DeliveryInfo[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const useDelivery = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get token
  const getToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error retrieving token:', err);
      return null;
    }
  };

  // Helper function for API calls
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
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const config: RequestInit = {
        method,
        headers,
      };

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

  // Assign courier to an order
  const assignCourier = useCallback(async (
    params: AssignCourierParams
  ): Promise<DeliveryInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const { orderId, ...body } = params;
      const response = await apiCall<DeliveryInfo>(
        `/delivery/assign-courier/${orderId}`,
        'POST',
        body
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to assign courier');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to assign courier';
      setError(errorMessage);
      console.error('Error assigning courier:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get delivery info by order ID
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

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch delivery info');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch delivery info';
      setError(errorMessage);
      console.error('Error fetching delivery info:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Edit delivery courier info
  const editDeliveryInfo = useCallback(async (
    params: EditDeliveryParams
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

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to update delivery info');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update delivery info';
      setError(errorMessage);
      console.error('Error updating delivery info:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete assigned courier info
  const deleteDeliveryInfo = useCallback(async (
    orderId: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<void>(
        `/delivery/order/${orderId}`,
        'DELETE'
      );

      if (response.success) {
        return true;
      }

      throw new Error(response.message || 'Failed to delete delivery info');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete delivery info';
      setError(errorMessage);
      console.error('Error deleting delivery info:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Set delivery status
  const setDeliveryStatus = useCallback(async (
    params: SetDeliveryStatusParams
  ): Promise<DeliveryInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const { orderId, status } = params;
      const response = await apiCall<DeliveryInfo>(
        `/delivery/order/${orderId}/status`,
        'PATCH',
        { status }
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to update delivery status');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update delivery status';
      setError(errorMessage);
      console.error('Error updating delivery status:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);


  // Get seller delivery statistics
  const getSellerDeliveryStats = useCallback(async (): Promise<DeliveryStats | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<DeliveryStats>(
        `/delivery/seller/stats`,
        'GET'
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch delivery stats');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch delivery stats';
      setError(errorMessage);
      console.error('Error fetching delivery stats:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

   // Get all seller deliveries
  const getAllSellerDeliveries = useCallback(async (
    params?: PaginationParams
  ): Promise<{ deliveries: DeliveryInfo[]; pagination: any } | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiCall<PaginatedResponse<DeliveryInfo>>(
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
      const errorMessage = err.message || 'Failed to fetch deliveries';
      setError(errorMessage);
      console.error('Error fetching seller deliveries:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    assignCourier,
    getDeliveryInfo,
    editDeliveryInfo,
    deleteDeliveryInfo,
    getAllSellerDeliveries,
      getSellerDeliveryStats,
    setDeliveryStatus,
    clearError,
  };
};