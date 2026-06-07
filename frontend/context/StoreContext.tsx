import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Store, User, StoreVerification } from '../types/store';

interface CreateStoreData {
  name: string;
  description?: string;
  location: string;
  category: string;
  region: string;
  logo?: ImagePicker.ImagePickerAsset;
}

interface UpdateStoreData {
  name?: string;
  description?: string;
  location?: string;
  category?: string;
  logo?: ImagePicker.ImagePickerAsset;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  cached?: boolean;
  error?: string;
}

interface StoreContextValue {
  store: Store | null;
  loading: boolean;
  error: string | null;
  createStore: (data: CreateStoreData) => Promise<Store | null>;
  updateStore: (storeId: string, data: UpdateStoreData) => Promise<Store | null>;
  deleteStore: (storeId: string) => Promise<boolean>;
  getStoreBySlug: (slug: string) => Promise<Store | null>;
  getUserStore: () => Promise<Store | null>;
  getStoreById: (id: string) => Promise<Store | null>;
  clearError: () => void;
  clearStore: () => void;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (err) {
      console.error('Error getting auth token:', err);
      return null;
    }
  };

  const createFormData = (data: any, imageField: string, image?: ImagePicker.ImagePickerAsset) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && key !== imageField) {
        formData.append(key, data[key]);
      }
    });
    if (image) {
      const imageFile: any = {
        uri: image.uri,
        type: image.type === 'image' ? 'image/jpeg' : image.mimeType || 'image/jpeg',
        name: image.fileName || `${imageField}_${Date.now()}.jpg`,
      };
      formData.append(imageField, imageFile);
    }
    return formData;
  };

  const createStore = useCallback(async (storeData: CreateStoreData): Promise<Store | null> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const formData = createFormData(
        {
          name: storeData.name,
          description: storeData.description,
          location: storeData.location,
          category: storeData.category,
          region: storeData.region,
        },
        'logo',
        storeData.logo
      );

      const response = await fetch(`${API_BASE_URL}/stores`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result: ApiResponse<Store> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create store');

      if (result.data) {
        setStore(result.data);
        return result.data;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the store');
      console.error('Create store error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStore = useCallback(async (storeId: string, updateData: UpdateStoreData): Promise<Store | null> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const formData = createFormData(
        {
          name: updateData.name,
          description: updateData.description,
          location: updateData.location,
          category: updateData.category,
        },
        'logo',
        updateData.logo
      );

      const response = await fetch(`${API_BASE_URL}/stores/${storeId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result: ApiResponse<Store> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to update store');

      if (result.data) {
        setStore(result.data);
        return result.data;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the store');
      console.error('Update store error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteStore = useCallback(async (storeId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/stores/${storeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const result: ApiResponse<null> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to delete store');

      setStore(null);
      return true;
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the store');
      console.error('Delete store error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStoreBySlug = useCallback(async (slug: string): Promise<Store | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/stores/s/${slug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const result: ApiResponse<Store> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Store not found');

      if (result.data) {
        setStore(result.data);
        return result.data;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the store');
      console.error('Get store by slug error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserStore = useCallback(async (): Promise<Store | null> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/stores/my-store`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const result: ApiResponse<Store> = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setStore(null);
          return null;
        }
        throw new Error(result.message || 'Failed to fetch store');
      }

      if (result.data) {
        setStore(result.data);
        return result.data;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching your store');
      console.error('Get user store error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStoreById = useCallback(async (id: string): Promise<Store | null> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/stores/${id}`, {
        method: 'GET',
        headers,
      });

      const result: ApiResponse<Store> = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Store not found');

      if (result.data) {
        setStore(result.data);
        return result.data;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the store');
      console.error('Get store by ID error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearStore = useCallback(() => setStore(null), []);

  return (
    <StoreContext.Provider value={{
      store,
      loading,
      error,
      createStore,
      updateStore,
      deleteStore,
      getStoreBySlug,
      getUserStore,
      getStoreById,
      clearError,
      clearStore,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextValue => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};