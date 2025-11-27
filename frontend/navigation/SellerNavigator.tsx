// navigation/SellerNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SellerStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Import your seller screens
import SellerHomeScreen from '../screens/seller/SellerDashBoard';
import SellerProductsScreen from '../screens/seller/ManageProductsScreen';
import SellerProfileScreen from '../screens/seller/SellerProfileScreen';
import CreateStoreScreen from '../screens/seller/CreateStoreScreen';
import MyStoreScreen from '../screens/seller/MyStoreScreen';
import EditStoreScreen from '../screens/seller/EditStoreScreen';
import AddProductScreen from '../screens/seller/AddProductScreen';
import EditProductScreen from '../screens/seller/EditProductScreen';
import SellerProductDetailScreen from '../screens/seller/SellerProductDetailsScreen';
import SellerPublicProductsScreen from '../screens/seller/SellerPublicProductsScreen';
import AccountDetails from '../screens/seller/AccountDetails';
import AddAccount from '../screens/seller/AddAccount'
import EditAccount from '../screens/seller/EditAccount';
import OrdersScreen from '../screens/seller/SellerOrderManagement';
import SellerDashboardScreen from '../screens/seller/SellerDashBoard';
import ManageProductsScreen from '../screens/seller/ManageProductsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen'
import MainChatScreen from '../screens/shared/MainChatScreen';
import AddDeliveryCourierInfo  from '../screens/seller/AddDeliveryCourierInfo'
import ManageDeliveryInfo from '../screens/seller/ManageDeliveryInfo'
import Chat from '../screens/shared/ChatScreen';
import TermsScreen from '../screens/auth/TermsConditionsScreen'
import PrivacyScreen from '../screens/auth/PrivacyPolicyScreen'
import ManagePayoutAccounts from '../screens/seller/ManagePayout';
import MyStoreReviews from '../screens/seller/MyStoreReviews';
import SellerOrderDetails from '../screens/seller/SellerOrderDetails';
import EditProfileScreen from '../screens/buyer/EditProfile';

const Stack = createNativeStackNavigator<SellerStackParamList>();
const Tab = createBottomTabNavigator<SellerStackParamList>();

const SellerTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'SellerHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'SellerProducts') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if(route.name === 'MainChatScreen') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }
          else if (route.name === 'SellerProfile') {
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
        options={{ title: 'Dashboard', headerShown: false }}
      />
      <Tab.Screen
        name="SellerProducts"
        component={SellerProductsScreen}
        options={{ headerShown: false}}
      />
            <Tab.Screen
              name="MainChatScreen"
              component={MainChatScreen}
              options={{ title: 'Chat', headerShown: false }}
            />
      <Tab.Screen
        name="SellerProfile"
        component={SellerProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

const SellerNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={SellerTabNavigator} />
      <Stack.Screen name="CreateStore" component={CreateStoreScreen} />
      <Stack.Screen name="MyStore" component={MyStoreScreen} />
      <Stack.Screen name="EditStore" component={EditStoreScreen} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} />
       <Stack.Screen name="EditProduct" component={EditProductScreen} />
       <Stack.Screen name="SellerProductDetails" component={SellerProductDetailScreen} />
       <Stack.Screen name="SellerPublicProductsScreen" component={SellerPublicProductsScreen} />
        <Stack.Screen name="AccountDetails" component={AccountDetails} />
        <Stack.Screen name="AddAccount" component={AddAccount} />
        <Stack.Screen name="EditAccount" component={EditAccount} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
        <Stack.Screen name="ManageProducts" component={ManageProductsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
         <Stack.Screen name="AddDeliveryInfo" component={AddDeliveryCourierInfo} />
          <Stack.Screen name="ManageDeliveryInfo" component={ManageDeliveryInfo} />
        <Stack.Screen name="ManagePayoutAccount" component={ManagePayoutAccounts} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="Policy" component={PrivacyScreen} />
          <Stack.Screen name="Chat" component={Chat} />
          <Stack.Screen name="MyStoreReviews" component={MyStoreReviews} />
          <Stack.Screen name="SellerOrderDetails" component={SellerOrderDetails} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
};

export default SellerNavigator;