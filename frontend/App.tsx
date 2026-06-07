import React, { useEffect } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';
import RootNavigator from './navigation/RootNavigator';
import { forceNavigateToLogin } from './utils/handleAuthRedirect';
import { QueryProvider } from './src/providers/QueryProviders';
import { StoreProvider } from './context/StoreContext';

const navigationRef = React.createRef<NavigationContainerRef<any>>();


const AppContent: React.FC = () => {
  const { user } = useAuth();
  return (
    <StoreProvider>
      <CartProvider>
        <ChatProvider currentUserId={user?.id || ''}>
          <StatusBar style="auto" />
          <RootNavigator />
        </ChatProvider>
      </CartProvider>
    </StoreProvider>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter_18pt-Regular.ttf'),
    'Inter-Medium': require('./assets/fonts/Inter_18pt-Medium.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter_18pt-SemiBold.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter_18pt-Bold.ttf'),
    'Inter-ExtraBold': require('./assets/fonts/Inter_18pt-ExtraBold.ttf'),
  });

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  const handleNotificationNavigation = (data: any) => {
    if (!navigationRef.current) return;

    if (data?.screen) {
      try {
        switch (data.screen) {
          case 'Chat':
            navigationRef.current.navigate('Chat', {
              chatRoomId: data.chatRoomId, 
              otherUserName: data.otherUserName,
              otherUserAvatar: data.otherUserAvatar || null,
              otherUserType: data.otherUserType,
              storeName: data.storeName,
              storeLogo: data.storeLogo,
            });
            break;
          case 'OrderDetail':
            navigationRef.current.navigate('OrderDetail', { orderId: data.orderId });
            break;
          case 'Notifications':
            navigationRef.current.navigate('Notifications');
            break;
          default:
            navigationRef.current.navigate('Home');
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    } else {
      navigationRef.current.navigate('Home');
    }
  };

  if (!fontsLoaded) return null;

  return (
    <QueryProvider>
      <NavigationContainer ref={navigationRef}>
        <AuthProvider
          onForceNavigateToLogin={() => forceNavigateToLogin(navigationRef)}
        >
          <AppContent />
        </AuthProvider>
      </NavigationContainer>
    </QueryProvider>
  );
}