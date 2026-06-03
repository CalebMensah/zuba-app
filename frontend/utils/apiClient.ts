import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;


// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request queue for handling concurrent requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

// Process queued requests
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });

  failedQueue = [];
};

// Safe AsyncStorage operations
const safeAsyncStorageSet = async (key: string, value: string) => {
  if (value === null || value === undefined) {
    throw new Error(`Cannot store null/undefined value for key: ${key}`);
  }
  await AsyncStorage.setItem(key, value.toString());
};

const safeAsyncStorageMultiSet = async (items: [string, string][]) => {
  const validItems = items.filter(([_, value]) => value !== null && value !== undefined);
  if (validItems.length === 0) {
    throw new Error('No valid items to store');
  }
  const stringItems: [string, string][] = validItems.map(([key, value]) => [key, value.toString()]);
  await AsyncStorage.multiSet(stringItems);
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If refresh is already in progress, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) {
          // No refresh token available => force logout.
          await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
          processQueue(error, null);
          isRefreshing = false;
          return Promise.reject(error);
        }


        // Attempt to refresh token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: refreshToken.toString(),
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Validate tokens before storing
        if (!newAccessToken || !newRefreshToken) {
          throw new Error('Invalid tokens received from refresh endpoint');
        }

        // Update stored tokens
        await safeAsyncStorageMultiSet([
          ['token', newAccessToken.toString()],
          ['refreshToken', newRefreshToken.toString()],
        ]);

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        // Process queued requests
        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        processQueue(refreshError, null);
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

