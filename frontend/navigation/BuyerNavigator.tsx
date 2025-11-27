// navigation/BuyerNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BuyerStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Import your buyer screens
import BuyerHomeScreen from '../screens/buyer/MarketPlaceScreen';
import BuyerProfileScreen from '../screens/buyer/BuyerProfileScreen';
import SellerPublicStoreScreen from '../screens/seller/SellerPublicStoreScreen';
import SellerPublicProductsScreen from '../screens/seller/SellerPublicProductsScreen';
import SellerPublicProductDetailsScreen from '../screens/seller/SellerPublicProductDetailsScreen';
import CartScreen from '../screens/buyer/CartScreen';
import CheckoutScreen from '../screens/buyer/CheckoutScreen';
import PaymentScreen from '../screens/buyer/PyaymentScreen';
import OrderDetailsScreen from '../screens/buyer/OrderDetailsScreen';
import ChatScreen from '../screens/shared/MainChatScreen';
import MyLikedProductsScreen from '../screens/buyer/MyLikkedProductsScreen';
import MyFollowedStoresScreen from '../screens/buyer/MyFollowedStoreScreen';
import AddAddressScreen from '../screens/buyer/AddAddress';
import EditAddressScreen from '../screens/buyer/EditAddressScreens';
import ManageAddressesScreen from '../screens/buyer/ManageAddressScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import MarketplaceScreen from '../screens/buyer/MarketPlaceScreen';
import BuyerOrderManagement from '../screens/buyer/BuyerOrderManagement';
import DisputesScreen from '../screens/buyer/DisputeScreen';
import CreateDisputeScreen from '../screens/buyer/CreateDisputeScreen';
import DisputeDetailsScreen from '../screens/buyer/DisputeDetailsScreen';
import EditProfile from '../screens/buyer/EditProfile';
import Chat from '../screens/shared/ChatScreen';
import PointsScreen from '../screens/buyer/RedeemPointsScreen';
import PointsHistoryScreen from '../screens/buyer/PointsHistory';
import DeliveryDetailsScreen from '../screens/buyer/DeliveryDetails';
import ProductReviewsScreen from '../screens/buyer/ProductReviewScreen';
import UnpaidOrdersScreen from '../screens/buyer/UnPaidOrders';
import ManageReviewScreen from '../screens/buyer/ManageReview';


const Tab = createBottomTabNavigator<BuyerStackParamList>();
const Stack = createNativeStackNavigator<BuyerStackParamList>();

const BuyerTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'BuyerHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'CartScreen') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'MainChatScreen') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'BuyerProfile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="BuyerHome"
        component={BuyerHomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="CartScreen"
        component={CartScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="MainChatScreen"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="BuyerProfile"
        component={BuyerProfileScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
};

const BuyerNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={BuyerTabNavigator} />
      <Stack.Screen name="SellerPublicStore" component={SellerPublicStoreScreen} />
      <Stack.Screen name="SellerPublicProductsScreen" component={SellerPublicProductsScreen} />
      <Stack.Screen name="SellerPublicProductDetails" component={SellerPublicProductDetailsScreen} />
      <Stack.Screen name="MyFollowedStores" component={MyFollowedStoresScreen} />
      <Stack.Screen name="LikedProducts" component={MyLikedProductsScreen} />
      <Stack.Screen name="ManageAddresses" component={ManageAddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="BuyerHome" component={MarketplaceScreen} />
      <Stack.Screen name="BuyerOrders" component={BuyerOrderManagement} />
      <Stack.Screen name="Disputes" component={DisputesScreen} />
      <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} />
      <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="Points" component={PointsScreen} />
      <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
      <Stack.Screen name="CartScreen" component={CartScreen} />
      <Stack.Screen name="DeliveryDetails" component={DeliveryDetailsScreen} />
      <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} />
      <Stack.Screen name="UnpaidOrders" component={UnpaidOrdersScreen} />
      <Stack.Screen name="ManageReview" component={ManageReviewScreen} />

    </Stack.Navigator>
  );
};

export default BuyerNavigator;