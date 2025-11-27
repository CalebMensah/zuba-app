import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface Address {
  id: string;
  userId: string;
  recipient: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateAddressData {
  recipient: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
}

interface UpdateAddressData extends Partial<CreateAddressData> {}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

export const useAddress = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error getting token from storage:', err);
      return null;
    }
  };

  const makeRequest = async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<ApiResponse<T>> => {
    try {
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token found');
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

      const response = await fetch(`${API_BASE_URL}/addresses${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  const createAddress = useCallback(async (addressData: CreateAddressData): Promise<Address | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeRequest<Address>('/', 'POST', addressData);
      return response.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create address';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserAddresses = useCallback(async (): Promise<Address[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeRequest<Address[]>('/', 'GET');
      return response.data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch addresses';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserAddressById = useCallback(async (addressId: string): Promise<Address | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeRequest<Address>(`/${addressId}`, 'GET');
      return response.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch address';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAddress = useCallback(async (
    addressId: string,
    updateData: UpdateAddressData
  ): Promise<Address | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeRequest<Address>(`/${addressId}`, 'PUT', updateData);
      return response.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update address';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAddress = useCallback(async (addressId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await makeRequest(`/${addressId}`, 'DELETE');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete address';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const setDefaultAddress = useCallback(async (addressId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await makeRequest(`/${addressId}/set-default`, 'PATCH');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default address';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createAddress,
    getUserAddresses,
    getUserAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
};