import { useState, useCallback } from 'react';

interface Store {
  id: string;
  name: string;
  url: string;
  logo?: string;
  region?: string;
  location?: string;
}

interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  tags: string[];
  sizes: string[];
  color: string[];
  weight?: number;
  sellerNote?: string;
  moq?: number;
  url: string;
  isActive: boolean;
  quantityBought: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  store?: Store;
}

interface TopSellingFilters {
  limit?: number;
  category?: string;
  storeUrl?: string;
}

interface RecommendedFilters {
  limit?: number;
}

interface YouMayLikeFilters {
  limit?: number;
  category?: string;
  excludeProductId?: string;
}

interface TrendingFilters {
  limit?: number;
  category?: string;
  days?: number;
}

interface TopSellingResponse {
  products: Product[];
  count: number;
}

interface RecommendedResponse {
  products: Product[];
  count: number;
  basedOn: {
    category?: string;
    tags: string[];
  };
}

interface YouMayLikeResponse {
  products: Product[];
  count: number;
  mix: {
    popular: number;
    random: number;
  };
}

interface TrendingResponse {
  products: Product[];
  count: number;
  period: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const useProductRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topSellingProducts, setTopSellingProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [youMayLikeProducts, setYouMayLikeProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);

  // Get top selling products
  const getTopSellingProducts = useCallback(
    async (filters?: TopSellingFilters): Promise<TopSellingResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (filters) {
          if (filters.limit) queryParams.append('limit', filters.limit.toString());
          if (filters.category) queryParams.append('category', filters.category);
          if (filters.storeUrl) queryParams.append('storeUrl', filters.storeUrl);
        }

        const response = await fetch(
          `${API_BASE_URL}/products/top-selling?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<TopSellingResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch top selling products');
        }

        if (result.data) {
          setTopSellingProducts(result.data.products);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching top selling products';
        setError(errorMessage);
        console.error('Get top selling products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get recommended products based on a specific product
  const getRecommendedProducts = useCallback(
    async (productUrl: string, filters?: RecommendedFilters): Promise<RecommendedResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (filters?.limit) {
          queryParams.append('limit', filters.limit.toString());
        }

        const response = await fetch(
          `${API_BASE_URL}/products/recommended/${productUrl}?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<RecommendedResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch recommended products');
        }

        if (result.data) {
          setRecommendedProducts(result.data.products);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching recommended products';
        setError(errorMessage);
        console.error('Get recommended products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get products you may like
  const getProductsYouMayLike = useCallback(
    async (filters?: YouMayLikeFilters): Promise<YouMayLikeResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (filters) {
          if (filters.limit) queryParams.append('limit', filters.limit.toString());
          if (filters.category) queryParams.append('category', filters.category);
          if (filters.excludeProductId) 
            queryParams.append('excludeProductId', filters.excludeProductId);
        }

        const response = await fetch(
          `${API_BASE_URL}/products/you-may-like?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<YouMayLikeResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch products you may like');
        }

        if (result.data) {
          setYouMayLikeProducts(result.data.products);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching products you may like';
        setError(errorMessage);
        console.error('Get products you may like error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get trending products
  const getTrendingProducts = useCallback(
    async (filters?: TrendingFilters): Promise<TrendingResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (filters) {
          if (filters.limit) queryParams.append('limit', filters.limit.toString());
          if (filters.category) queryParams.append('category', filters.category);
          if (filters.days) queryParams.append('days', filters.days.toString());
        }

        const response = await fetch(
          `${API_BASE_URL}/products/trending?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<TrendingResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch trending products');
        }

        if (result.data) {
          setTrendingProducts(result.data.products);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching trending products';
        setError(errorMessage);
        console.error('Get trending products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear all recommendation data
  const clearRecommendations = useCallback(() => {
    setTopSellingProducts([]);
    setRecommendedProducts([]);
    setYouMayLikeProducts([]);
    setTrendingProducts([]);
  }, []);

  // Clear specific recommendation types
  const clearTopSelling = useCallback(() => {
    setTopSellingProducts([]);
  }, []);

  const clearRecommended = useCallback(() => {
    setRecommendedProducts([]);
  }, []);

  const clearYouMayLike = useCallback(() => {
    setYouMayLikeProducts([]);
  }, []);

  const clearTrending = useCallback(() => {
    setTrendingProducts([]);
  }, []);

  return {
    // State
    loading,
    error,
    topSellingProducts,
    recommendedProducts,
    youMayLikeProducts,
    trendingProducts,

    // Methods
    getTopSellingProducts,
    getRecommendedProducts,
    getProductsYouMayLike,
    getTrendingProducts,

    // Clear methods
    clearError,
    clearRecommendations,
    clearTopSelling,
    clearRecommended,
    clearYouMayLike,
    clearTrending,
  };
};