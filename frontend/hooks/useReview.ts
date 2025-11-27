import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Review {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  comment?: string;
  media: string[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  product?: {
    id: string;
    name: string;
    images: string[];
    url: string;
  };
  order?: {
    id: string;
    createdAt: string;
  };
  sellerResponse?: ReviewResponse;
  likes?: Array<{ userId: string }>;
  _count?: {
    likes: number;
  };
}

export interface ReviewResponse {
  id: string;
  reviewId: string;
  sellerId: string;
  response: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
}

export interface CreateReviewData {
  orderId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  media?: Array<{
    uri: string;
    type: string;
    name: string;
  }>;
}

export interface UpdateReviewData {
  rating?: number;
  title?: string;
  comment?: string;
}

export interface ReportReviewData {
  reason: string;
  description?: string;
}

interface PaginatedReviews {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const useReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth token
  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error getting token:', err);
      return null;
    }
  };

  // Helper to create headers
  const createHeaders = async (isMultipart: boolean = false): Promise<HeadersInit> => {
    const token = await getAuthToken();
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  };

  // Helper to handle API calls
  const apiCall = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Request failed');
      }

      return data.data as T;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Create review
  const createReview = useCallback(async (reviewData: CreateReviewData) => {
    const formData = new FormData();
    formData.append('orderId', reviewData.orderId);
    formData.append('productId', reviewData.productId);
    formData.append('rating', reviewData.rating.toString());

    if (reviewData.title) {
      formData.append('title', reviewData.title);
    }

    if (reviewData.comment) {
      formData.append('comment', reviewData.comment);
    }

    if (reviewData.media && reviewData.media.length > 0) {
      reviewData.media.forEach((mediaItem, index) => {
        // For React Native, append the file with uri, type, and name
        formData.append('media', {
          uri: mediaItem.uri,
          type: mediaItem.type,
          name: mediaItem.name,
        } as any);
      });
    }

    const headers = await createHeaders(true);

    return apiCall<{
      review: Review;
      awardedPoints: number;
      newTotalPoints: number;
    }>('/reviews', {
      method: 'POST',
      headers,
      body: formData,
    });
  }, []);

  // Get product reviews
  const getProductReviews = useCallback(async (
    productId: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      verifiedOnly?: boolean;
    }
  ) => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options?.verifiedOnly) params.append('verifiedOnly', 'true');

    const queryString = params.toString();
    const endpoint = `/reviews/product/${productId}${queryString ? `?${queryString}` : ''}`;

    return apiCall<PaginatedReviews>(endpoint, {
      method: 'GET',
    });
  }, []);

  // Get product review summary
  const getProductReviewSummary = useCallback(async (productId: string) => {
    return apiCall<ReviewSummary>(`/reviews/product/${productId}/summary`, {
      method: 'GET',
    });
  }, []);

  // Get my reviews
  const getMyReviews = useCallback(async () => {
    const headers = await createHeaders();

    return apiCall<Review[]>('/reviews/user/me', {
      method: 'GET',
      headers,
    });
  }, []);

  // Get review by ID
  const getReviewById = useCallback(async (reviewId: string) => {
    return apiCall<Review>(`/reviews/${reviewId}`, {
      method: 'GET',
    });
  }, []);

  // Update review
  const updateReview = useCallback(async (
    reviewId: string,
    updateData: UpdateReviewData
  ) => {
    const headers = await createHeaders();

    return apiCall<Review>(`/reviews/${reviewId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });
  }, []);

  // Delete review
  const deleteReview = useCallback(async (reviewId: string) => {
    const headers = await createHeaders();

    return apiCall<void>(`/reviews/${reviewId}`, {
      method: 'DELETE',
      headers,
    });
  }, []);

  // Like review
  const likeReview = useCallback(async (reviewId: string) => {
    const headers = await createHeaders();

    return apiCall<{ likeCount: number }>(`/reviews/${reviewId}/like`, {
      method: 'POST',
      headers,
    });
  }, []);

  // Unlike review
  const unlikeReview = useCallback(async (reviewId: string) => {
    const headers = await createHeaders();

    return apiCall<{ likeCount: number }>(`/reviews/${reviewId}/like`, {
      method: 'DELETE',
      headers,
    });
  }, []);

  // Report review
  const reportReview = useCallback(async (
    reviewId: string,
    reportData: ReportReviewData
  ) => {
    const headers = await createHeaders();

    return apiCall<any>(`/reviews/${reviewId}/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify(reportData),
    });
  }, []);

  // Get seller store reviews
  const getSellerStoreReviews = useCallback(async (options?: {
    page?: number;
    limit?: number;
    productId?: string;
  }) => {
    const headers = await createHeaders();
    const params = new URLSearchParams();
    
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.productId) params.append('productId', options.productId);

    const queryString = params.toString();
    const endpoint = `/reviews/review/seller/store${queryString ? `?${queryString}` : ''}`;

    return apiCall<PaginatedReviews>(endpoint, {
      method: 'GET',
      headers,
    });
  }, []);

  // Add seller response
  const addReviewResponse = useCallback(async (
    reviewId: string,
    response: string
  ) => {
    const headers = await createHeaders();

    return apiCall<ReviewResponse>(`/reviews/${reviewId}/response`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ response }),
    });
  }, []);

  // Update seller response
  const updateReviewResponse = useCallback(async (
    reviewId: string,
    response: string
  ) => {
    const headers = await createHeaders();

    return apiCall<ReviewResponse>(`/reviews/${reviewId}/response`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ response }),
    });
  }, []);

  // Delete seller response
  const deleteReviewResponse = useCallback(async (reviewId: string) => {
    const headers = await createHeaders();

    return apiCall<void>(`/reviews/${reviewId}/response`, {
      method: 'DELETE',
      headers,
    });
  }, []);

  // Get public store reviews (no auth)
const getPublicStoreReviews = useCallback(async (
  storeId: string,
  options?: {
    page?: number;
    limit?: number;
    productId?: string;
  }
) => {
  const params = new URLSearchParams();

  if (options?.page) params.append("page", String(options.page));
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.productId) params.append("productId", options.productId);

  const query = params.toString();
  const endpoint = `/reviews/public/stores/${storeId}/reviews${query ? `?${query}` : ""}`;

  return apiCall<PaginatedReviews>(endpoint, {
    method: "GET",
  });
}, []);


  return {
    loading,
    error,
    createReview,
    getProductReviews,
    getProductReviewSummary,
    getMyReviews,
    getReviewById,
    updateReview,
    deleteReview,
    likeReview,
    unlikeReview,
    reportReview,
    getSellerStoreReviews,
    addReviewResponse,
    updateReviewResponse,
    deleteReviewResponse,
    getPublicStoreReviews,

  };
};

export default useReviews;

