// navigation/BuyerNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BuyerStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Import your buyer screens
import BuyerHomeScreen from '../screens/buyer/BuyerHomeScreen';
import BuyerProfileScreen from '../screens/buyer/BuyerProfileScreen';

const Tab = createBottomTabNavigator<BuyerStackParamList>();

const BuyerNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'BuyerHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'BuyerProfile') {
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
        name="BuyerHome"
        component={BuyerHomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="BuyerProfile"
        component={BuyerProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default BuyerNavigator;