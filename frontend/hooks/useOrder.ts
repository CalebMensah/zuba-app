// hooks/useOrders.ts
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Types
export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface DeliveryInfo {
  recipient: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  country?: string;
  postalCode?: string;
  deliveryFee?: number;
  notes?: string;
}

export interface CreateOrderData {
  storeId: string;
  items: OrderItem[];
  deliveryInfo?: DeliveryInfo;
  totalAmount: number;
  subtotal: number;
  deliveryFee?: number;
  taxAmount?: number;
  discount?: number;
  currency?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  promoCode?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  checkoutSession?: string; // NEW: Checkout session
  sameAsDelivery?: boolean;
  billingInfo?: any;
}

export interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discount: number;
  currency: string;
  checkoutSession?: string; // NEW: Checkout session
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  items: any[];
  deliveryInfo?: any;
  billingInfo?: any;
  buyer?: any;
  store?: any;
  statusHistory?: any[];
  cancelledBy?: String;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface UnpaidOrdersSummary {
  totalUnpaidOrders: number;
  totalAmount: number;
  totalItems: number;
  uniqueStores: number;
  currency: string;
  oldestUnpaidOrder: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
  hasUnpaidOrders: boolean;
}

export interface UnpaidOrdersResponse {
  orders: Order[];
  ordersByStore: {
    store: any;
    orders: Order[];
    storeTotal: number;
  }[];
  summary: {
    totalUnpaidOrders: number;
    totalAmount: number;
    totalItems: number;
    uniqueStores: number;
    currency: string;
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

export interface UnpaidOrderDetails extends Order {
  hasUnavailableItems: boolean;
  unavailableItems: {
    productId: string;
    productName: string;
    requestedQuantity: number;
    availableStock: number;
  }[];
}

export interface StoreGroup {
  store: any;
  orders: Order[];
  orderCount: number;
  totalAmount: number;
  totalItems: number;
  currency: string;
}

export interface UnpaidOrdersByStoreResponse {
  storeGroups: StoreGroup[];
  summary: {
    totalStores: number;
    totalOrders: number;
    grandTotal: number;
    currency: string;
  };
}

export const useOrders = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get token from AsyncStorage
  const getToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error retrieving token:', err);
      return null;
    }
  };

  // Helper function to make authenticated API requests
  const makeRequest = async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<ApiResponse<T>> => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const config: RequestInit = {
        method,
        headers,
      };

      if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err: any) {
      throw new Error(err.message || 'An error occurred while making the request');
    }
  };

  // Create a new order
  const createOrder = useCallback(async (orderData: CreateOrderData): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>('/orders', 'POST', orderData);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to create order');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Create order error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get buyer's orders
  const getBuyerOrders = useCallback(async (
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<OrdersResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
      });

      const response = await makeRequest<OrdersResponse>(
        `/orders/my-orders?${queryParams.toString()}`,
        'GET'
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch orders');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get buyer orders error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get seller's orders
  const getSellerOrders = useCallback(async (
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<OrdersResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
      });

      const response = await makeRequest<OrdersResponse>(
        `/orders/seller/seller-orders?${queryParams.toString()}`,
        'GET'
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch seller orders');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get seller orders error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get order by ID
  const getOrderById = useCallback(async (orderId: string): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>(`/orders/${orderId}`, 'GET');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch order');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get order by ID error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // NEW: Get order by checkout session
  const getOrderByCheckoutSession = useCallback(async (sessionId: string): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>(`/orders/checkout/${sessionId}`, 'GET');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch order by checkout session');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get order by checkout session error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update order status (seller only)
  const updateOrderStatus = useCallback(async (
    orderId: string,
    status: string,
    reason?: string
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>(
        `/orders/${orderId}/status`,
        'PATCH',
        { status, reason }
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update order status');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Update order status error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // NEW: Update checkout session (useful for payment webhooks/callbacks)
  const updateCheckoutSession = useCallback(async (
    orderId: string,
    checkoutSession: string,
    paymentStatus?: string,
    paymentRef?: string
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>(
        `/orders/${orderId}/checkout`,
        'PUT',
        { 
          checkoutSession,
          ...(paymentStatus && { paymentStatus }),
          ...(paymentRef && { paymentRef })
        }
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update checkout session');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Update checkout session error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel order
  const cancelOrder = useCallback(async (
    orderId: string,
    reason?: string
  ): Promise<Order | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Order>(
        `/orders/${orderId}`,
        'DELETE',
        { reason }
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to cancel order');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Cancel order error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get all unpaid orders with filtering and pagination
const getUnpaidOrders = useCallback(async (
  page: number = 1,
  limit: number = 10,
  sortBy: 'createdAt' | 'totalAmount' | 'updatedAt' = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc',
  storeId?: string
): Promise<UnpaidOrdersResponse | null> => {
  setLoading(true);
  setError(null);

  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
      ...(storeId && { storeId }),
    });

    const response = await makeRequest<UnpaidOrdersResponse>(
      `/orders/unpaid?${queryParams.toString()}`,
      'GET'
    );
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch unpaid orders');
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Get unpaid orders error:', err);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Get summary of all unpaid orders
const getUnpaidOrdersSummary = useCallback(async (): Promise<UnpaidOrdersSummary | null> => {
  setLoading(true);
  setError(null);

  try {
    const response = await makeRequest<UnpaidOrdersSummary>(
      '/orders/unpaid/summary',
      'GET'
    );
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch unpaid orders summary');
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Get unpaid orders summary error:', err);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Get unpaid orders grouped by store
const getUnpaidOrdersByStore = useCallback(async (): Promise<UnpaidOrdersByStoreResponse | null> => {
  setLoading(true);
  setError(null);

  try {
    const response = await makeRequest<UnpaidOrdersByStoreResponse>(
      '/orders/unpaid/by-store',
      'GET'
    );
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch unpaid orders by store');
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Get unpaid orders by store error:', err);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Get a specific unpaid order by ID
const getUnpaidOrderById = useCallback(async (orderId: string): Promise<UnpaidOrderDetails | null> => {
  setLoading(true);
  setError(null);

  try {
    const response = await makeRequest<UnpaidOrderDetails>(
      `/orders/unpaid/${orderId}`,
      'GET'
    );
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch unpaid order');
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Get unpaid order by ID error:', err);
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Cancel an unpaid order and restore stock
const cancelUnpaidOrder = useCallback(async (orderId: string): Promise<boolean> => {
  setLoading(true);
  setError(null);

  try {
    const response = await makeRequest<void>(
      `/orders/unpaid/${orderId}`,
      'DELETE'
    );
    
    if (response.success) {
      return true;
    } else {
      throw new Error(response.message || 'Failed to cancel unpaid order');
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Cancel unpaid order error:', err);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

  return {
    loading,
    error,
    createOrder,
    getBuyerOrders,
    getSellerOrders,
    getOrderById,
    getOrderByCheckoutSession, // NEW
    updateOrderStatus,
    updateCheckoutSession, // NEW
    cancelOrder,

    getUnpaidOrders,
  getUnpaidOrdersSummary,
  getUnpaidOrdersByStore,
  getUnpaidOrderById,
  cancelUnpaidOrder,
  };
};

export default useOrders;