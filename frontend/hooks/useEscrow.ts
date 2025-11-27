import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface Escrow {
  id: string;
  amountHeld: number;
  currency: string;
  releaseDate: string;
  releaseStatus: 'PENDING' | 'RELEASED' | 'FAILED';
  releaseReason?: string;
  releasedAt?: string;
  releasedTo?: string;
  createdAt: string;
  updatedAt: string;
}

interface Order {
  id: string;
  status: string;
  buyerId: string;
  storeId: string;
  buyer?: {
    id: string;
    name?: string;
    firstName?: string;
    email: string;
  };
  store?: {
    name: string;
    userId: string;
    user?: {
      id: string;
      firstName: string;
      email: string;
    };
  };
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface EscrowDetails extends Escrow {
  payment?: Payment;
  order?: Order;
}

interface EscrowStatusResponse {
  escrow: Escrow;
  canConfirmReceipt: boolean;
}

interface PendingEscrow extends Escrow {
  order: {
    id: string;
    status: string;
    buyerId: string;
    storeId: string;
    buyer: { firstName: string; email: string };
    store: { name: string };
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  };
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface UseEscrowReturn {
  loading: boolean;
  error: string | null;
  confirmOrderReceived: (orderId: string) => Promise<ApiResponse<{ order: Order; escrow: Escrow }>>;
  getEscrowDetails: (escrowId: string) => Promise<ApiResponse<EscrowDetails>>;
  getOrderEscrowStatus: (orderId: string) => Promise<ApiResponse<EscrowStatusResponse>>;
  getPendingEscrows: (params?: PaginationParams) => Promise<ApiResponse<PendingEscrow[]>>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const useEscrow = (): UseEscrowReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error retrieving token:', err);
      return null;
    }
  };

  const makeRequest = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/escrow${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const confirmOrderReceived = useCallback(
    async (orderId: string): Promise<ApiResponse<{ order: Order; escrow: Escrow }>> => {
      return makeRequest<{ order: Order; escrow: Escrow }>(
        `/${orderId}/confirm`,
        { method: 'POST' }
      );
    },
    []
  );

  const getEscrowDetails = useCallback(
    async (escrowId: string): Promise<ApiResponse<EscrowDetails>> => {
      return makeRequest<EscrowDetails>(`/${escrowId}`);
    },
    []
  );

  const getOrderEscrowStatus = useCallback(
    async (orderId: string): Promise<ApiResponse<EscrowStatusResponse>> => {
      return makeRequest<EscrowStatusResponse>(`/order/${orderId}`);
    },
    []
  );

  const getPendingEscrows = useCallback(
    async (params: PaginationParams = {}): Promise<ApiResponse<PendingEscrow[]>> => {
      const { page = 1, limit = 20 } = params;
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      return makeRequest<PendingEscrow[]>(`/pending?${queryParams}`);
    },
    []
  );

  return {
    loading,
    error,
    confirmOrderReceived,
    getEscrowDetails,
    getOrderEscrowStatus,
    getPendingEscrows,
  };
};