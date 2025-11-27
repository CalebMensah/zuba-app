import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

// Types
export interface VerificationDocument {
  ghanaCardFront: string;
  ghanaCardBack: string;
  selfie: string;
  businessDoc?: string;
}

export interface Store {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

export interface StoreUser {
  id: string;
  firstName: string;
  email: string;
  phone?: string;
  createdAt?: string;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Verification {
  id: string;
  storeId: string;
  ghanaCardFront: string;
  ghanaCardBack: string;
  selfie: string;
  businessDoc?: string | null;
  status: VerificationStatus;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  store?: Store & {
    user?: StoreUser;
  };
}

export interface VerificationStats {
  totalPending: number;
  totalVerified: number;
  totalRejected: number;
  total: number;
  recentVerifications: Verification[];
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VerificationFilters {
  page?: number;
  limit?: number;
  status?: VerificationStatus;
  storeId?: string;
  search?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: PaginationData;
}

interface VerificationState {
  verification: Verification | null;
  verifications: Verification[];
  stats: VerificationStats | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationData | null;
}

export const useVerification = () => {
  const [state, setState] = useState<VerificationState>({
    verification: null,
    verifications: [],
    stats: null,
    loading: false,
    error: null,
    pagination: null,
  });

  // Helper to get auth token from AsyncStorage
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (error) {
      console.error('Error getting token from AsyncStorage:', error);
      return null;
    }
  }, []);

  // Helper to get auth headers
  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAuthToken]);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  // Set error state
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Handle API errors
  const handleApiError = useCallback((error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse<never>>;
      return axiosError.response?.data?.message || axiosError.message || 'An error occurred';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }, []);

  // Submit store verification
  const submitVerification = useCallback(async (
    files: {
      ghanaCardFront: File | { uri: string; name: string; type: string };
      ghanaCardBack: File | { uri: string; name: string; type: string };
      selfie: File | { uri: string; name: string; type: string };
      businessDoc?: File | { uri: string; name: string; type: string };
    },
    rejectionReason?: string
  ): Promise<{ success: boolean; message?: string; data?: Verification }> => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Handle React Native file format
      formData.append('ghanaCardFront', files.ghanaCardFront as any);
      formData.append('ghanaCardBack', files.ghanaCardBack as any);
      formData.append('selfie', files.selfie as any);
      
      if (files.businessDoc) {
        formData.append('businessDoc', files.businessDoc as any);
      }

      if (rejectionReason) {
        formData.append('rejectionReason', rejectionReason);
      }

      const headers = await getAuthHeaders();
      const response = await axios.post<ApiResponse<Verification>>(
        `${API_URL}/verification/submit`,
        formData,
        {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          verification: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          message: response.data.message,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to submit verification');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Get my store verification status
  const getMyVerificationStatus = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
    data?: Verification;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<ApiResponse<Verification>>(
        `${API_URL}/verification/my-status`,
        { headers }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          verification: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch verification status');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Get verification stats (Admin only)
  const getVerificationStats = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
    data?: VerificationStats;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<ApiResponse<VerificationStats>>(
        `${API_URL}/verification/stats`,
        { headers }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          stats: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch verification stats');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Get pending verifications (Admin only)
  const getPendingVerifications = useCallback(async (
    page: number = 1,
    limit: number = 10
  ): Promise<{
    success: boolean;
    message?: string;
    data?: Verification[];
    pagination?: PaginationData;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<ApiResponse<Verification[]>>(
        `${API_URL}/verification/pending`,
        {
          params: { page, limit },
          headers,
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          verifications: response.data.data!,
          pagination: response.data.pagination || null,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
          pagination: response.data.pagination,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch pending verifications');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Get all verifications (Admin only)
  const getAllVerifications = useCallback(async (
    filters: VerificationFilters = {}
  ): Promise<{
    success: boolean;
    message?: string;
    data?: Verification[];
    pagination?: PaginationData;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<ApiResponse<Verification[]>>(
        `${API_URL}/verification/all`,
        {
          params: filters,
          headers,
        }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          verifications: response.data.data!,
          pagination: response.data.pagination || null,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
          pagination: response.data.pagination,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch verifications');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Get verification details (Admin only)
  const getVerificationDetails = useCallback(async (
    verificationId: string
  ): Promise<{
    success: boolean;
    message?: string;
    data?: Verification;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<ApiResponse<Verification>>(
        `${API_URL}/verification/${verificationId}`,
        { headers }
      );

      if (response.data.success && response.data.data) {
        setState(prev => ({
          ...prev,
          verification: response.data.data!,
          loading: false,
        }));

        return {
          success: true,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to fetch verification details');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Update verification status (Admin only)
  const updateVerificationStatus = useCallback(async (
    verificationId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ): Promise<{
    success: boolean;
    message?: string;
    data?: Verification;
  }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.patch<ApiResponse<Verification>>(
        `${API_URL}/verification/${verificationId}/status`,
        { status, rejectionReason },
        { headers }
      );

      if (response.data.success && response.data.data) {
        // Update the verification in state
        setState(prev => ({
          ...prev,
          verification: response.data.data!,
          verifications: prev.verifications.map(v =>
            v.id === verificationId ? response.data.data! : v
          ),
          loading: false,
        }));

        return {
          success: true,
          message: response.data.message,
          data: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to update verification status');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Delete verification (Admin only)
  const deleteVerification = useCallback(async (
    verificationId: string
  ): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.delete<ApiResponse<never>>(
        `${API_URL}/verification/${verificationId}`,
        { headers }
      );

      if (response.data.success) {
        // Remove the verification from state
        setState(prev => ({
          ...prev,
          verifications: prev.verifications.filter(v => v.id !== verificationId),
          verification: prev.verification?.id === verificationId ? null : prev.verification,
          loading: false,
        }));

        return {
          success: true,
          message: response.data.message,
        };
      }

      throw new Error(response.data.message || 'Failed to delete verification');
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  }, [getAuthHeaders, handleApiError]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setState({
      verification: null,
      verifications: [],
      stats: null,
      loading: false,
      error: null,
      pagination: null,
    });
  }, []);

  return {
    // State
    verification: state.verification,
    verifications: state.verifications,
    stats: state.stats,
    loading: state.loading,
    error: state.error,
    pagination: state.pagination,

    // Actions
    submitVerification,
    getMyVerificationStatus,
    getVerificationStats,
    getPendingVerifications,
    getAllVerifications,
    getVerificationDetails,
    updateVerificationStatus,
    deleteVerification,
    clearError,
    resetState,
  };
};

export default useVerification;