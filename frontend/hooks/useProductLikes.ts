import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  url: string;
  isActive: boolean;
  store?: {
    id: string;
    name: string;
    url: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
}

export const useProductLike = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  const likeProduct = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/product-likes/like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId }),
      });

      const data: ApiResponse<any> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to like product');
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

  const unlikeProduct = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/product-likes/unlike`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId }),
      });

      const data: ApiResponse<any> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unlike product');
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

  const getMyLikedProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/product-likes/my-liked`, {
        method: 'GET',
        headers,
      });

      const data: ApiResponse<{ products: Product[] }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch liked products');
      }

      return data.data?.products || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProductLikeCount = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/product-likes/product/${productId}/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: ApiResponse<{ count: number }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch like count');
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

  const checkIfLiked = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/product-likes/check/${productId}`, {
        method: 'GET',
        headers,
      });

      const data: ApiResponse<{ isLiked: boolean }> = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check like status');
      }

      return data.data?.isLiked || false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleLike = useCallback(async (productId: string) => {
    const isLiked = await checkIfLiked(productId);
    if (isLiked) {
      return await unlikeProduct(productId);
    } else {
      return await likeProduct(productId);
    }
  }, [checkIfLiked, likeProduct, unlikeProduct]);

  return {
    loading,
    error,
    likeProduct,
    unlikeProduct,
    getMyLikedProducts,
    getProductLikeCount,
    checkIfLiked,
    toggleLike,
  };
};