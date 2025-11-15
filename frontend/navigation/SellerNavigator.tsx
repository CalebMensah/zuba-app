// navigation/SellerNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SellerStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Import your seller screens
import SellerHomeScreen from '../screens/seller/SellerDashBoard';
import SellerProductsScreen from '../screens/seller/ManageProductsCreen';
import SellerProfileScreen from '../screens/seller/SellerProfileSCreen';

const Tab = createBottomTabNavigator<SellerStackParamList>();

const SellerNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'SellerHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'SellerProducts') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'SellerProfile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="SellerHome"
        component={SellerHomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="SellerProducts"
        component={SellerProductsScreen}
        options={{ title: 'Products' }}
      />
      <Tab.Screen
        name="SellerProfile"
        component={SellerProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default SellerNavigator;