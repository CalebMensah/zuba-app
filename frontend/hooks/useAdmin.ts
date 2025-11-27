import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string | null;
  role: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  store?: any;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsersResponse {
  success: boolean;
  message: string;
  pagination: PaginationInfo;
  users: User[];
}

interface UserResponse {
  success: boolean;
  message: string;
  user?: User;
  userId?: string;
}

interface ErrorResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface StoreVerification {
  id: string;
  isVerified: boolean;
  verifiedAt: string | null;
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    isSuspended: boolean;
  };
  verification: StoreVerification | null;
}

interface StoresResponse {
  success: boolean;
  message: string;
  data: Store[];
}

interface StoreActionResponse {
  success: boolean;
  message: string;
  storeId?: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
  };
}

interface DeliveryInfo {
  status: string;
  trackingNumber: string | null;
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  deliveryInfo: DeliveryInfo | null;
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  store: {
    id: string;
    name: string;
    url: string;
  };
}

interface OrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  buyerId?: string;
  sellerId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'totalAmount' | 'status' | 'paymentStatus';
  sortOrder?: 'asc' | 'desc';
}

interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OrdersFilters {
  status: string | null;
  paymentStatus: string | null;
  buyerId: string | null;
  sellerId: string | null;
  startDate: string | null;
  endDate: string | null;
  sortBy: string;
  sortOrder: string;
}

interface OrdersResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: OrdersPagination;
    filters: OrdersFilters;
  };
}

interface SingleOrderResponse {
  success: boolean;
  data: {
    order: Order;
  };
}

interface OrderUpdateResponse {
  success: boolean;
  message: string;
  order?: Order;
}

// Configure your API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const useAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get token from AsyncStorage
  const getToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error getting token:', err);
      return null;
    }
  };

  // Helper function to make authenticated requests
  const makeRequest = async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> => {
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  };

  // Get all users with pagination and filters
  const getAllUsers = useCallback(async (params?: PaginationParams): Promise<UsersResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.role) queryParams.append('role', params.role);

      const queryString = queryParams.toString();
      const endpoint = `/admin/users${queryString ? `?${queryString}` : ''}`;

      const data = await makeRequest<UsersResponse>(endpoint);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single user by ID
  const getUserById = useCallback(async (userId: string): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await makeRequest<UserResponse>(`/admin/users/${userId}`);
      return data.user || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Suspend user
  const suspendUser = useCallback(async (userId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await makeRequest<UserResponse>(`/admin/users/${userId}/suspend`, 'PUT');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to suspend user';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reactivate user
  const reactivateUser = useCallback(async (userId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await makeRequest<UserResponse>(`/admin/users/${userId}/reactivate`, 'PUT');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reactivate user';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await makeRequest<UserResponse>(`/admin/users/${userId}`, 'DELETE');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get all stores
  const getAllStores = useCallback(async (): Promise<Store[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await makeRequest<StoresResponse>('/admin/stores');
      return data.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stores';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Suspend store
  const suspendStore = useCallback(async (storeId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await makeRequest<StoreActionResponse>(`/admin/stores/${storeId}/suspend`, 'PUT');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to suspend store';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reactivate store
  const reactivateStore = useCallback(async (storeId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await makeRequest<StoreActionResponse>(`/admin/stores/${storeId}/reactivate`, 'PUT');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reactivate store';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteStore = useCallback(async (storeId: string): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    await makeRequest<StoreActionResponse>(`/admin/stores/${storeId}`, 'DELETE');
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete store';
    setError(errorMessage);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

const getAllOrders = useCallback(async (params?: OrdersParams): Promise<OrdersResponse | null> => {
  setLoading(true);
  setError(null);

  try {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.paymentStatus) queryParams.append('paymentStatus', params.paymentStatus);
    if (params?.buyerId) queryParams.append('buyerId', params.buyerId);
    if (params?.sellerId) queryParams.append('sellerId', params.sellerId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/admin/orders${queryString ? `?${queryString}` : ''}`;

    const data = await makeRequest<OrdersResponse>(endpoint);
    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
    setError(errorMessage);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Get single order by ID
const getOrderById = useCallback(async (orderId: string): Promise<Order | null> => {
  setLoading(true);
  setError(null);

  try {
    const data = await makeRequest<SingleOrderResponse>(`/admin/orders/${orderId}`);
    return data.data.order || null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch order';
    setError(errorMessage);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Update order status
const updateOrderStatus = useCallback(async (
  orderId: string, 
  status: string
): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    await makeRequest<OrderUpdateResponse>(
      `/admin/orders/${orderId}/status`, 
      'PUT',
      { status }
    );
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update order status';
    setError(errorMessage);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

// Update payment status
const updatePaymentStatus = useCallback(async (
  orderId: string, 
  paymentStatus: string
): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    await makeRequest<OrderUpdateResponse>(
      `/admin/orders/${orderId}/payment-status`, 
      'PUT',
      { paymentStatus }
    );
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update payment status';
    setError(errorMessage);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

// Cancel order
const cancelOrder = useCallback(async (
  orderId: string,
  reason?: string
): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    await makeRequest<OrderUpdateResponse>(
      `/admin/orders/${orderId}/cancel`, 
      'PUT',
      { reason }
    );
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order';
    setError(errorMessage);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

// Refund order
const refundOrder = useCallback(async (
  orderId: string,
  amount?: number,
  reason?: string
): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    await makeRequest<OrderUpdateResponse>(
      `/admin/orders/${orderId}/refund`, 
      'POST',
      { amount, reason }
    );
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to refund order';
    setError(errorMessage);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

  return {
    loading,
    error,
    getAllUsers,
    getUserById,
    suspendUser,
    reactivateUser,
    deleteUser,
    getAllStores,
    suspendStore,
    reactivateStore,
    clearError,
    deleteStore,
    getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  refundOrder,
  };
};