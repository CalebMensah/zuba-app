import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;


export type DisputeType =
  | 'REFUND_REQUEST'
  | 'ITEM_NOT_AS_DESCRIBED'
  | 'ITEM_NOT_RECEIVED'
  | 'WRONG_ITEM_SENT'
  | 'DAMAGED_ITEM'
  | 'OTHER';

type DisputeStatus = 'PENDING' | 'RESOLVED' | 'CANCELLED';

export interface Dispute {
  id: string;
  orderId: string;
  paymentId: string;
  buyerId: string;
  sellerId: string;
  type: DisputeType;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  outcome?: 'BUYER_WON' | 'SELLER_WON';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    status: string;
    totalAmount: number;
    currency?: string;
    buyer?: {
      id: string;
      firstName: string;
      email: string;
    };
    store?: {
      id: string;
      name: string;
      user?: {
        id: string;
        firstName: string;
        email: string;
      };
    };
payment?: {
  id: string;
  amount: number;
  status: string;
  currency: string;
  createdAt: string;
}[];
    escrow?: {
      id: string;
      releaseStatus: string;
    };
  };
}

export interface OpenDisputeData {
  reason: string;
  type: DisputeType;
}

export interface ResolveDisputeData {
  outcome: 'BUYER_WON' | 'SELLER_WON';
  resolution: string;
  refundAmount?: number;
}

export interface DisputesResponse {
  disputes: Dispute[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}


export const useDisputes = () => {
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
        Authorization: `Bearer ${token}`,
      };

      const config: RequestInit = { method, headers };

      if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
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

  const openDispute = useCallback(async (
    orderId: string,
    disputeData: OpenDisputeData
  ): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${orderId}/open`,
        'POST',
        disputeData
      );

      if (response.success && response.data) return response.data;
      throw new Error(response.message || 'Failed to open dispute');
    } catch (err: any) {
      setError(err.message);
      console.error('Open dispute error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveDispute = useCallback(async (
    disputeId: string,
    resolutionData: ResolveDisputeData
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<void>(`/disputes/${disputeId}/resolve`, 'POST', resolutionData);

      if (response.success) return true;
      throw new Error(response.message || 'Failed to resolve dispute');
    } catch (err: any) {
      setError(err.message);
      console.error('Resolve dispute error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDisputeById = useCallback(async (
    disputeId: string
  ): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${disputeId}`,
        'GET'
      );

      if (response.success && response.data) return response.data;
      throw new Error(response.message || 'Failed to fetch dispute');
    } catch (err: any) {
      setError(err.message);
      console.error('Get dispute by ID error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMyDisputes = useCallback(async (
    page: number = 1,
    limit: number = 10,
    status?: DisputeStatus,
    type?: DisputeType
  ): Promise<DisputesResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
        ...(type && { type }),
      });

      const response = await makeRequest<DisputesResponse>(
        `/disputes/me?${queryParams}`,
        'GET'
      );

      if (response.success && response.data) {
        if (!response.data.pagination) {
          response.data.pagination = {
            total: response.data.disputes.length || 0,
            page,
            limit,
            totalPages: 1,
          };
        }
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch disputes');
    } catch (err: any) {
      setError(err.message);
      console.error('Get my disputes error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelDispute = useCallback(async (
    disputeId: string,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<void>(`/disputes/${disputeId}/cancel`, 'PATCH');

      if (response.success) return true;
      throw new Error(response.message || 'Failed to cancel dispute');
    } catch (err: any) {
      setError(err.message);
      console.error('Cancel dispute error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    clearError,
    // Buyer
    openDispute,
    cancelDispute,
    // Shared
    getDisputeById,
    getMyDisputes,
    // Admin
    resolveDispute,
  };
};

export default useDisputes;