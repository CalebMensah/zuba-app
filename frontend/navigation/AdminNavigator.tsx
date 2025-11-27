// navigation/AdminNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Import your admin screens
import AdminHomeScreen from '../screens/admin/Dashboard';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsSCreen';
import StoresScreen from '../screens/admin/StoresScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserDetailsScreen from '../screens/admin/UserDetailsScreen';
import StoreDetailsScreen from '../screens/admin/StoreDetailsScreen';
import DisputesScreen from '../screens/buyer/DisputeScreen';
import DisputeDetailsScreen from '../screens/buyer/DisputeDetailsScreen';
import OrderManagement from '../screens/admin/OrderManagement';
import AllPendingStoreVerificationsScreen from '../screens/admin/PendingStoreVerificationsScreen';
import VerificationDetailsScreen from '../screens/admin/VerificationDetails';
import SellerPublicProductsScreen from '../screens/seller/SellerPublicProductsScreen';
import AdminEscrowScreen from '../screens/admin/AdminEscrowScreen'

const Tab = createBottomTabNavigator<AdminStackParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

const AdminTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'AdminHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AdminUsers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'AdminSettings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'AdminStores') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminHomeScreen}
        options={{ title: 'Dashboard', headerShown: false }}
      />
      <Tab.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ title: 'Users', headerShown: false }}
      />
      <Tab.Screen
        name="AdminSettings"
        component={AdminSettingsScreen}
        options={{ title: 'Settings', headerShown: false }}
      />
      <Tab.Screen
        name="AdminStores"
        component={StoresScreen}
        options={{ title: 'Stores', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

const AdminNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={AdminTabNavigator} />
      <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
      <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <Stack.Screen name="Disputes" component={DisputesScreen} />
      <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} />
      <Stack.Screen name="OrderManagement" component={OrderManagement} />
      <Stack.Screen name="PendingVerifications" component={AllPendingStoreVerificationsScreen} />
      <Stack.Screen name="VerificationDetails" component={VerificationDetailsScreen} />
      <Stack.Screen name="SellerPublicProducts" component={SellerPublicProductsScreen} />
      <Stack.Screen name="AdminEscrow" component={AdminEscrowScreen} />

      {/* Add more admin-related screens here if needed */}
    </Stack.Navigator>
  );
}

export default AdminNavigator;