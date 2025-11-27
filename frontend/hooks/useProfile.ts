// hooks/useUserProfile.ts
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { UserRole } from '../types/navigation';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isVerified: boolean;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  user?: T;
  avatarUrl?: string;
  error?: string;
}

export const useUserProfile = () => {
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get token from AsyncStorage
  const getToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error retrieving token:', err);
      return null;
    }
  };

  // Helper function to make authenticated API requests
  const makeRequest = async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    isFormData: boolean = false
  ): Promise<ApiResponse<T>> => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
      };

      // Only add Content-Type for JSON requests
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      const config: RequestInit = {
        method,
        headers,
      };

      if (body) {
        if (isFormData) {
          config.body = body; // FormData object
        } else if (method !== 'GET') {
          config.body = JSON.stringify(body);
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err: any) {
      throw new Error(err.message || 'An error occurred while making the request');
    }
  };

  // Update profile information
  const updateProfile = useCallback(async (
    profileData: UpdateProfileData
  ): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      // Validate phone format if provided
      if (profileData.phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(profileData.phone)) {
          throw new Error('Invalid phone number format');
        }
      }

      const response = await makeRequest<User>(
        '/users/profile',
        'PATCH',
        profileData
      );
      
      if (response.success && response.user) {
        return response.user;
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Update profile error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload/Update avatar from device
  const updateAvatar = useCallback(async (
    imageUri: string
  ): Promise<{ user: User; avatarUrl: string } | null> => {
    setUploadingAvatar(true);
    setError(null);

    try {
      // Create FormData
      const formData = new FormData();
      
      // Extract file extension from URI
      const uriParts = imageUri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      // Append image to FormData
      formData.append('avatar', {
        uri: imageUri,
        name: `avatar.${fileType}`,
        type: `image/${fileType}`,
      } as any);

      const response = await makeRequest<User>(
        '/users/profile/avatar',
        'PATCH',
        formData,
        true // isFormData
      );
      
      if (response.success && response.user && response.avatarUrl) {
        return {
          user: response.user,
          avatarUrl: response.avatarUrl,
        };
      } else {
        throw new Error(response.message || 'Failed to update avatar');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Update avatar error:', err);
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  // Pick image from library and upload
  const pickAndUploadAvatar = useCallback(async (): Promise<{ user: User; avatarUrl: string } | null> => {
    setError(null);

    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        throw new Error('Permission to access camera roll is required');
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;
      
      // Validate file size (5MB max)
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Image size too large. Maximum size is 5MB');
      }

      // Upload the selected image
      return await updateAvatar(imageUri);
    } catch (err: any) {
      setError(err.message);
      console.error('Pick and upload avatar error:', err);
      return null;
    }
  }, [updateAvatar]);

  // Take photo with camera and upload
  const takePhotoAndUploadAvatar = useCallback(async (): Promise<{ user: User; avatarUrl: string } | null> => {
    setError(null);

    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        throw new Error('Permission to access camera is required');
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;
      
      // Validate file size (5MB max)
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Image size too large. Maximum size is 5MB');
      }

      // Upload the photo
      return await updateAvatar(imageUri);
    } catch (err: any) {
      setError(err.message);
      console.error('Take photo and upload avatar error:', err);
      return null;
    }
  }, [updateAvatar]);

  // Delete avatar
  const deleteAvatar = useCallback(async (): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await makeRequest<User>(
        '/users/profile/avatar',
        'DELETE'
      );
      
      if (response.success && response.user) {
        return response.user;
      } else {
        throw new Error(response.message || 'Failed to delete avatar');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Delete avatar error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    uploadingAvatar,
    error,
    updateProfile,
    updateAvatar,
    pickAndUploadAvatar,
    takePhotoAndUploadAvatar,
    deleteAvatar,
    clearError,
  };
};

export default useUserProfile;