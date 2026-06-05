import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { User } from '../types/navigation';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  hasSeenOnboarding: boolean;
  isRefreshing: boolean;
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://d317-197-251-240-29.ngrok-free.app';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onForceNavigateToLogin?: () => void;
}> = ({ children, onForceNavigateToLogin }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboardingState] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPushToken, setCurrentPushToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Register FCM token when user logs in
  useEffect(() => {
    if (user && token) {
      registerFCMToken();
    }
  }, [user, token]);

  // Set up token refresh listener with deduplication
  useEffect(() => {
    if (!user || !token) return;

    let isRegistering = false;

    const subscription = Notifications.addPushTokenListener((pushToken) => {
      console.log('[AuthContext] FCM token refreshed:', pushToken.data);

      if (isRegistering) {
        console.log('[AuthContext] Token registration already in progress, skipping');
        return;
      }

      if (user && token) {
        isRegistering = true;
        registerFCMToken()
          .finally(() => {
            isRegistering = false;
          });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, token]);

 const registerFCMToken = async () => {
  try {
    console.log('[AuthContext] Starting FCM token registration...');

    if (!Device.isDevice) {
      console.log('[AuthContext] Push notifications only work on physical devices');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[AuthContext] Push notification permissions not granted');
      return;
    }

    // ✅ Get native FCM token instead of Expo token
    const pushTokenData = await Notifications.getDevicePushTokenAsync();
    const fcmToken = pushTokenData.data;
    
    setCurrentPushToken(fcmToken);
    await AsyncStorage.setItem('pushToken', fcmToken);

    if (!fcmToken) {
      throw new Error('Failed to get push token');
    }

    const devicePlatform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

    console.log(`[AuthContext] Got FCM token: ${fcmToken.substring(0, 20)}...`);

    const requestBody = {
      userId: user?.id,
      fcmToken,
      // tokenType will be auto-detected by backend
      platform: devicePlatform,
      deviceId: Device.osInternalBuildId,
      deviceModel: Device.modelName || 'Unknown',
      osVersion: Device.osVersion,
      appVersion: '1.0.0',
    };

    console.log('[AuthContext] Sending token registration request...');

    const response = await fetch(`${API_BASE_URL}/register-fcm-token-firebase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[AuthContext] Backend registration failed:', {
        status: response.status,
        error: responseData
      });
      throw new Error(`Failed to register token: ${response.status}`);
    }

    console.log('[AuthContext] ✅ FCM token registered successfully');
    
  } catch (error: any) {
    console.error('[AuthContext] ❌ Error registering FCM token:', error.message);
  }
};

  const unregisterFCMToken = async () => {
    try {
      if (!currentPushToken) return;

      await fetch(`${API_BASE_URL}/unregister-fcm-token-firebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fcmToken: currentPushToken })
      });
      
      console.log('[AuthContext] ✅ Token unregistered');
    } catch (error) {
      console.error('[AuthContext] Error unregistering FCM token:', error);
    }

    setCurrentPushToken(null);
    await AsyncStorage.removeItem('pushToken');
  };

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedRefreshToken, storedUser, onboardingStatus, storedIsGuest] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('refreshToken'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('hasSeenOnboarding'),
        AsyncStorage.getItem('isGuest'),
      ]);

      if (storedToken && storedRefreshToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && typeof parsedUser === 'object') {
            setToken(storedToken.toString());
            setRefreshToken(storedRefreshToken.toString());
            setUser(parsedUser);
          }
        } catch (parseError) {
          console.error('Error parsing stored user data:', parseError);
          await Promise.all([
            AsyncStorage.removeItem('token'),
            AsyncStorage.removeItem('refreshToken'),
            AsyncStorage.removeItem('user'),
          ]);
        }
      }

      // Load guest state
      setIsGuest(storedIsGuest === 'true');
      setHasSeenOnboardingState(onboardingStatus === 'true');
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (accessToken: string, refreshToken: string, newUser: User) => {
    try {
      if (!accessToken || !refreshToken || !newUser) {
        throw new Error('Invalid login parameters');
      }

      // Clear guest state when logging in
      await AsyncStorage.removeItem('isGuest');
      setIsGuest(false);

      await Promise.all([
        AsyncStorage.setItem('token', accessToken.toString()),
        AsyncStorage.setItem('refreshToken', refreshToken.toString()),
        AsyncStorage.setItem('user', JSON.stringify(newUser)),
      ]);
      setToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(newUser);
    } catch (error) {
      console.error('Error saving auth:', error);
      throw error;
    }
  };

  const loginAsGuest = async () => {
    try {
      await AsyncStorage.setItem('isGuest', 'true');
      setIsGuest(true);
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error setting guest mode:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await unregisterFCMToken();

      await Promise.all([
        AsyncStorage.removeItem('token'),
        AsyncStorage.removeItem('refreshToken'),
        AsyncStorage.removeItem('user'),
        AsyncStorage.removeItem('isGuest'),
      ]);
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      setIsGuest(false);

      // Immediate navigation reset to Auth using App's navigationRef
      onForceNavigateToLogin?.();
    } catch (error) {
      console.error('Error clearing auth:', error);
      onForceNavigateToLogin?.();
    }
  };

  const updateUser = async (updatedUser: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const setHasSeenOnboarding = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', value.toString());
      setHasSeenOnboardingState(value);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      throw error;
    }
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken || isRefreshing) {
      return null;
    }

    setIsRefreshing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: refreshToken.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        await logout();
        return null;
      }

      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      if (!newAccessToken || !newRefreshToken) {
        throw new Error('Invalid tokens received from refresh endpoint');
      }

      await Promise.all([
        AsyncStorage.setItem('token', newAccessToken.toString()),
        AsyncStorage.setItem('refreshToken', newRefreshToken.toString()),
      ]);

      setToken(newAccessToken);
      setRefreshToken(newRefreshToken);

      return newAccessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        isAuthenticated: !!token && !!user,
        isGuest,
        hasSeenOnboarding,
        isRefreshing,
        login,
        loginAsGuest,
        logout,
        updateUser,
        setHasSeenOnboarding,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};