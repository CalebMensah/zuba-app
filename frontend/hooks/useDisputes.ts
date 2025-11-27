// hooks/useDisputes.ts
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Types
export type DisputeType = 
  | 'REFUND_REQUEST'
  | 'ITEM_NOT_AS_DESCRIBED'
  | 'ITEM_NOT_RECEIVED'
  | 'WRONG_ITEM_SENT'
  | 'DAMAGED_ITEM'
  | 'OTHER';

export type DisputeStatus = 'PENDING' | 'RESOLVED' | 'CANCELLED';

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
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
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
      gatewayRef?: string;
    };
    escrow?: {
      id: string;
      releaseStatus: string;
    };
  };
}

export interface CreateDisputeData {
  reason: string;
  type?: DisputeType;
}

export interface ResolveDisputeData {
  status: 'RESOLVED' | 'CANCELLED';
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
  requiresManualRefund?: boolean;
}

export const useDisputes = () => {
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

  // Request a refund (create dispute)
  const requestRefund = useCallback(async (
    orderId: string,
    disputeData: CreateDisputeData
  ): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/refund/${orderId}`,
        'POST',
        disputeData
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to request refund');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Request refund error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve a dispute (admin only)
  const resolveDispute = useCallback(async (
    disputeId: string,
    resolutionData: ResolveDisputeData
  ): Promise<{ dispute?: Dispute; requiresManualRefund?: boolean } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${disputeId}/resolve`,
        'POST',
        resolutionData
      );
      
      if (response.success) {
        return {
          dispute: response.data,
          requiresManualRefund: response.requiresManualRefund || false
        };
      } else {
        throw new Error(response.message || 'Failed to resolve dispute');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Resolve dispute error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get dispute details by ID
  const getDisputeById = useCallback(async (disputeId: string): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${disputeId}`,
        'GET'
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch dispute');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get dispute by ID error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user's disputes (buyer or seller)
  const getUserDisputes = useCallback(async (
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
        `/disputes/user/all?${queryParams.toString()}`,
        'GET'
      );

      if (response.success && response.data) {
        // Defensive check for pagination
        if (!response.data.pagination) {
          response.data.pagination = {
            total: response.data.disputes.length || 0,
            page,
            limit,
            totalPages: 1,
          };
        }
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch disputes');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get user disputes error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [])

  // Get all disputes (admin only)
  const getAllDisputes = useCallback(async (
    page: number = 1,
    limit: number = 20,
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
        `/disputes/admin/all?${queryParams.toString()}`,
        'GET'
      );

      if (response.success && response.data) {
        // Defensive check for pagination
        if (!response.data.pagination) {
          response.data.pagination = {
            total: response.data.disputes.length || 0,
            page,
            limit,
            totalPages: 1
          };
        }
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch all disputes');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Get all disputes error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [])

  // Update a dispute with additional information
  const updateDispute = useCallback(async (
    disputeId: string,
    additionalInfo: string
  ): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${disputeId}`,
        'PATCH',
        { additionalInfo }
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update dispute');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Update dispute error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel a dispute
  const cancelDispute = useCallback(async (
    disputeId: string,
    reason?: string
  ): Promise<Dispute | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<Dispute>(
        `/disputes/${disputeId}/cancel`,
        'POST',
        { reason }
      );
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to cancel dispute');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Cancel dispute error:', err);
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
    requestRefund,
    resolveDispute,
    getDisputeById,
    getUserDisputes,
    getAllDisputes,
    updateDispute,
    cancelDispute,
    clearError,
  };
};

export default useDisputes;