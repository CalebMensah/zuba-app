import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Store {
  id: string;
  name: string;
  url: string;
  logo: string | null;
}

interface Follower {
  id: string;
  name: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
}

export const useStoreFollowing = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  const followStore = useCallback(async (storeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/store-following/follow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ storeId }),
      });

      const data: ApiResponse<any> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to follow store');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const unfollowStore = useCallback(async (storeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/store-following/unfollow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ storeId }),
      });

      const data: ApiResponse<any> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unfollow store');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMyFollowing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/store-following/my-following`, {
        method: 'GET',
        headers,
      });

      const data: ApiResponse<{ stores: Store[] }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch following list');
      }

      return data.data?.stores || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStoreFollowerCount = useCallback(async (storeUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/store-following/store/${storeUrl}/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: ApiResponse<{ count: number }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch follower count');
      }

      return data.data?.count || 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIfFollowing = useCallback(async (storeUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/store-following/check/${storeUrl}`, {
        method: 'GET',
        headers,
      });

      const data: ApiResponse<{ isFollowing: boolean }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check following status');
      }

      return data.data?.isFollowing || false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFollow = useCallback(async (storeId: string, storeUrl: string) => {
    const isFollowing = await checkIfFollowing(storeUrl);
    if (isFollowing) {
      return await unfollowStore(storeId);
    } else {
      return await followStore(storeId);
    }
  }, [checkIfFollowing, followStore, unfollowStore]);

  return {
    loading,
    error,
    followStore,
    unfollowStore,
    getMyFollowing,
    getStoreFollowerCount,
    checkIfFollowing,
    toggleFollow,
  };
};