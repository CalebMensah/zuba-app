import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

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

interface CreateProductData {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  tags?: string[];
  sizes?: string[];
  color?: string[];
  weight?: number;
  sellerNote?: string;
  moq?: number;
  images?: ImagePicker.ImagePickerAsset[];
}

interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  tags?: string[];
  sizes?: string[];
  color?: string[];
  weight?: number;
  sellerNote?: string;
  moq?: number;
  isActive?: boolean;
  images?: ImagePicker.ImagePickerAsset[];
}

interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  sizes?: string[];
  color?: string[];
  sortBy?: 'name' | 'price' | 'createdAt' | 'quantityBought' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ProductListResponse {
  products: Product[];
  pagination: PaginationData;
  filters: any;
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
const TOKEN_KEY = 'token';

export const useProduct = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [topSellingProducts, setTopSellingProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [youMayLikeProducts, setYouMayLikeProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (err) {
      console.error('Error getting auth token:', err);
      return null;
    }
  };

  const createFormData = (
    data: CreateProductData | UpdateProductData,
    images?: ImagePicker.ImagePickerAsset[]
  ) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'images') {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            formData.append(`${key}[]`, item.toString());
          });
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    if (images && images.length > 0) {
      images.forEach((image, index) => {
        const imageFile: any = {
          uri: image.uri,
          type: image.type === 'image' ? 'image/jpeg' : image.mimeType || 'image/jpeg',
          name: image.fileName || `product_image_${index}_${Date.now()}.jpg`,
        };
        formData.append('images', imageFile);
      });
    }

    return formData;
  };

  const createProduct = useCallback(
    async (productData: CreateProductData): Promise<Product | null> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const formData = createFormData(productData, productData.images);

        const response = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const result: ApiResponse<Product> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to create product');
        }

        if (result.data) {
          setProduct(result.data);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while creating the product';
        setError(errorMessage);
        console.error('Create product error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProduct = useCallback(
    async (productId: string, updateData: UpdateProductData): Promise<Product | null> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const formData = createFormData(updateData, updateData.images);

        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const result: ApiResponse<Product> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to update product');
        }

        if (result.data) {
          setProduct(result.data);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while updating the product';
        setError(errorMessage);
        console.error('Update product error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete product');
      }

      setProduct(null);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while deleting the product';
      setError(errorMessage);
      console.error('Delete product error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProductByUrl = useCallback(async (productUrl: string): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/products/product/${productUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<Product> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Product not found');
      }

      if (result.data) {
        setProduct(result.data);
        return result.data;
      }

      return null;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while fetching the product';
      setError(errorMessage);
      console.error('Get product by URL error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStoreProducts = useCallback(
    async (storeUrl: string, filters?: ProductFilters): Promise<ProductListResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (filters) {
          if (filters.page) queryParams.append('page', filters.page.toString());
          if (filters.limit) queryParams.append('limit', filters.limit.toString());
          if (filters.search) queryParams.append('search', filters.search);
          if (filters.category) queryParams.append('category', filters.category);
          if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
          if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
          if (filters.tags && filters.tags.length > 0) 
            queryParams.append('tags', filters.tags.join(','));
          if (filters.sizes && filters.sizes.length > 0) 
            queryParams.append('sizes', filters.sizes.join(','));
          if (filters.color && filters.color.length > 0) 
            queryParams.append('color', filters.color.join(','));
          if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
          if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
        }

        const response = await fetch(
          `${API_BASE_URL}/products/store/${storeUrl}?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<ProductListResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch store products');
        }

        if (result.data) {
          setProducts(result.data.products);
          setPagination(result.data.pagination);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching store products';
        setError(errorMessage);
        console.error('Get store products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getUserProducts = useCallback(
    async (page: number = 1, limit: number = 10): Promise<ProductListResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await fetch(
          `${API_BASE_URL}/products/my-products?page=${page}&limit=${limit}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<ProductListResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch your products');
        }

        if (result.data) {
          setProducts(result.data.products);
          console.log('user products:', result.data.products)
          setPagination(result.data.pagination);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching your products';
        setError(errorMessage);
        console.error('Get user products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getAllProducts = useCallback(
    async (filters?: ProductFilters): Promise<ProductListResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        
        if (filters) {
          if (filters.page) queryParams.append('page', filters.page.toString());
          if (filters.limit) queryParams.append('limit', filters.limit.toString());
          if (filters.search) queryParams.append('search', filters.search);
          if (filters.category) queryParams.append('category', filters.category);
          if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
          if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
          if (filters.tags && filters.tags.length > 0) 
            queryParams.append('tags', filters.tags.join(','));
          if (filters.sizes && filters.sizes.length > 0) 
            queryParams.append('sizes', filters.sizes.join(','));
          if (filters.color && filters.color.length > 0) 
            queryParams.append('color', filters.color.join(','));
          if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
          if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
        }

        const response = await fetch(
          `${API_BASE_URL}/products?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result: ApiResponse<ProductListResponse> = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch products');
        }

        if (result.data) {
          setProducts(result.data.products);
          setPagination(result.data.pagination);
          return result.data;
        }

        return null;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while fetching products';
        setError(errorMessage);
        console.error('Get all products error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );


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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearProduct = useCallback(() => {
    setProduct(null);
  }, []);

  const clearProducts = useCallback(() => {
    setProducts([]);
    setPagination(null);
  }, []);

  return {
    product,
    products,
    pagination,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductByUrl,
    getStoreProducts,
    getUserProducts,
    getAllProducts,
    clearError,
    clearProduct,
    clearProducts,
    getTopSellingProducts,
    getRecommendedProducts,
    getProductsYouMayLike,
    getTrendingProducts,
    topSellingProducts,
    recommendedProducts,
    youMayLikeProducts,
    trendingProducts,
    clearRecommendations,
    clearTopSelling,
    clearRecommended,
    clearYouMayLike,
    clearTrending,
  };
};