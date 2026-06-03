// services/orderApi.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Order,
  OrderWithBreakdown,
  OrdersResponse,
  CreateOrderData,
  CreateOrderResponse,
  UnpaidOrdersResponse,
  UnpaidOrdersSummary,
  UnpaidOrdersByStoreResponse,
  UnpaidOrderDetails,
  RejectOrderResponse,
  OrderFilters,
} from '../types/order';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Helper to get auth token
const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('token');
  } catch (err) {
    console.error('Error retrieving token:', err);
    return null;
  }
};

// Helper to make authenticated requests
const makeRequest = async <T,>(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T> => {
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

  if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data: ApiResponse<T> = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  if (!data.success || !data.data) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data;
};

export const orderAPI = {
  // Create order
  createOrder: (orderData: CreateOrderData) =>
    makeRequest<CreateOrderResponse>('/orders', 'POST', orderData),

  // Get buyer's orders
  getBuyerOrders: (filters?: OrderFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);

    return makeRequest<OrdersResponse>(
      `/orders/my-orders?${params.toString()}`
    );
  },

  // Get seller's orders
  getSellerOrders: (filters?: OrderFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.paymentStatus) params.append('paymentStatus', filters.paymentStatus);

    return makeRequest<OrdersResponse>(
      `/orders/seller/seller-orders?${params.toString()}`
    );
  },

  // Get order by ID
  getOrderById: (orderId: string) =>
    makeRequest<OrderWithBreakdown>(`/orders/${orderId}`),

  // Get order by checkout session
  getOrderByCheckoutSession: (sessionId: string) =>
    makeRequest<OrderWithBreakdown>(`/orders/checkout/${sessionId}`),

  // Update order status
  updateOrderStatus: (orderId: string, status: string, reason?: string) =>
    makeRequest<Order>(`/orders/${orderId}/status`, 'PATCH', { status, reason }),

  // Update checkout session
  updateCheckoutSession: (
    orderId: string,
    checkoutSession: string,
    paymentStatus?: string,
    paymentRef?: string
  ) =>
    makeRequest<Order>(`/orders/${orderId}/checkout`, 'PUT', {
      checkoutSession,
      ...(paymentStatus && { paymentStatus }),
      ...(paymentRef && { paymentRef }),
    }),

  // Cancel order
  cancelOrder: (orderId: string, reason?: string) =>
    makeRequest<Order>(`/orders/${orderId}`, 'DELETE', { reason }),

  // Accept order (seller)
  acceptOrder: (orderId: string) =>
    makeRequest<OrderWithBreakdown>(`/orders/${orderId}/accept`, 'PUT'),

  // Reject order (seller)
  rejectOrder: (orderId: string, reason: string) => {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    return makeRequest<RejectOrderResponse>(`/orders/${orderId}/reject`, 'PUT', { reason });
  },

  // Get unpaid orders
  getUnpaidOrders: (filters?: OrderFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.storeId) params.append('storeId', filters.storeId);

    return makeRequest<UnpaidOrdersResponse>(
      `/orders/user/unpaid?${params.toString()}`
    );
  },

  // Get unpaid orders summary
  getUnpaidOrdersSummary: () =>
    makeRequest<UnpaidOrdersSummary>('/orders/unpaid/summary'),

  // Get unpaid orders by store
  getUnpaidOrdersByStore: () =>
    makeRequest<UnpaidOrdersByStoreResponse>('/orders/unpaid/by-store'),

  // Get unpaid order by ID
  getUnpaidOrderById: (orderId: string) =>
    makeRequest<UnpaidOrderDetails>(`/orders/unpaid/${orderId}`),

  // Cancel unpaid order
  cancelUnpaidOrder: (orderId: string) =>
    makeRequest<void>(`/orders/unpaid/${orderId}`, 'DELETE'),
};