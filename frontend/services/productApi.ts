// src/services/productAPI.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'token';

// Types
export interface Store {
  id: string;
  name: string;
  url: string;
  logo?: string;
  region?: string;
  location?: string;
  userId?: string;
}

export interface Product {
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
  moq?: number;
  url: string;
  isActive: boolean;
  quantityBought: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  store?: Store;
  deletedAt?: string;
}

export interface CreateProductData {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  tags?: string[];
  sizes?: string[];
  color?: string[];
  moq?: number;
  images?: ImagePicker.ImagePickerAsset[];
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  tags?: string[];
  sizes?: string[];
  color?: string[];
  moq?: number;
  isActive?: boolean;
  images?: ImagePicker.ImagePickerAsset[];
}

export interface ProductFilters {
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

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ProductListResponse {
  products: Product[];
  pagination: PaginationData;
  filters: any;
}

export interface TopSellingFilters {
  limit?: number;
  category?: string;
  storeUrl?: string;
}

export interface RecommendedFilters {
  limit?: number;
}

export interface YouMayLikeFilters {
  limit?: number;
  category?: string;
  excludeProductId?: string;
}

export interface TrendingFilters {
  limit?: number;
  category?: string;
  days?: number;
}

export interface TopSellingResponse {
  products: Product[];
  count: number;
}

export interface RecommendedResponse {
  products: Product[];
  count: number;
  basedOn: {
    category?: string;
    tags: string[];
  };
}

export interface YouMayLikeResponse {
  products: Product[];
  count: number;
  mix: {
    popular: number;
    random: number;
  };
}

export interface TrendingResponse {
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

// Helper functions
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

// API Functions
export const productAPI = {
  // Create product
  createProduct: async (productData: CreateProductData): Promise<Product> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Update product
  updateProduct: async (productId: string, updateData: UpdateProductData): Promise<Product> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Delete product (hard delete)
  deleteProduct: async (productId: string): Promise<void> => {
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
  },

  // Soft delete product
  softDeleteProduct: async (productId: string): Promise<void> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/products/${productId}/soft-delete`, {
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
  },

  // Restore product
  restoreProduct: async (productId: string): Promise<Product> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/products/${productId}/restore`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result: ApiResponse<{ product: Product }> = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to restore product');
    }

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data.product;
  },

  // Get product by URL
  getProductByUrl: async (productUrl: string): Promise<Product> => {
    const response = await fetch(`${API_BASE_URL}/products/product/${productUrl}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result: ApiResponse<Product> = await response.json();
    console.log('getProductByUrl response:', result);

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Product not found');
    }

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get store products
  getStoreProducts: async (storeUrl: string, filters?: ProductFilters): Promise<ProductListResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get user products
  getUserProducts: async (page: number = 1, limit: number = 10): Promise<ProductListResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get all products
  getAllProducts: async (filters?: ProductFilters): Promise<ProductListResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get deleted products
  getDeletedProducts: async (): Promise<Product[]> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/products/seller/deleted`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result: ApiResponse<{ products: Product[] }> = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch deleted products');
    }

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data.products;
  },

  // Get top selling products
  getTopSellingProducts: async (filters?: TopSellingFilters): Promise<TopSellingResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get recommended products
  getRecommendedProducts: async (productUrl: string, filters?: RecommendedFilters): Promise<RecommendedResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get products you may like
  getProductsYouMayLike: async (filters?: YouMayLikeFilters): Promise<YouMayLikeResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },

  // Get trending products
  getTrendingProducts: async (filters?: TrendingFilters): Promise<TrendingResponse> => {
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

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  },
};