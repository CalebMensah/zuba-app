// services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../utils/apiClient';

// Get API URL from environment variable with fallback
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Optional: Enable logging in development
if (process.env.EXPO_PUBLIC_ENABLE_API_LOGGING === 'true') {
  apiClient.interceptors.request.use(
    (request: any) => {
      console.log('🚀 API Request:', request.method?.toUpperCase(), request.url);
      console.log('📦 Data:', request.data);
      return request;
    },
    (error: any) => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    }
  );

  apiClient.interceptors.response.use(
    (response: any) => {
      console.log('✅ API Response:', response.status, response.config.url);
      return response;
    },
    (error: any) => {
      console.error('❌ Response Error:', error.response?.status, error.config?.url);
      return Promise.reject(error);
    }
  );
}

export interface SignupData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface VerifyEmailData {
  email: string;
  code: string;
}

export const authAPI = {
  signup: async (data: SignupData) => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: LoginData) => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  verifyEmail: async (data: VerifyEmailData) => {
    const response = await apiClient.post('/auth/verify-email', data);
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await apiClient.post('/auth/resend-verification', { email });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  },
};

export default apiClient;
