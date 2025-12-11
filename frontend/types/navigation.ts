// types/navigation.ts
import { Store } from './store';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  VerifyEmail: { email: string };
  Terms: undefined;
  Privacy:undefined;
};

export type BuyerStackParamList = {
  MarketPlace: undefined;
  Me: undefined;
  Main: undefined;
  SellerPublicStore: {storeId: string};
  SellerPublicProductsScreen: { storeUrl: string, storeName: string};
  SellerPublicProductDetails: { productUrl: string, storeUrl: string }
  LikedProducts: undefined;
  Cart: undefined;
  CartScreen: undefined;
  OrderDetails: { orderId: string };
  MyFollowedStores: undefined;
  EditAddress: undefined;
  Chat: undefined;
  Notifications: undefined;
  BuyerOrders: undefined;
  UnpaidOrders: undefined;
    Checkout: {
    orders: Array<{
      storeId: string;
      storeName: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
        color?: string;
        size?: string;
      }>;
      subtotal: number;
      checkoutSession: string;
    }>;
  };
  Payment: {
    orders: Array<{
      orderId: string;
      storeName: string;
      amount: number;
      checkoutSession: string;
    }>;
    totalAmount: number;
    totalOrders: number;
  };
  ManageAddresses: {
    fromCheckout?: boolean;
  };
  AddAddress: {
    fromCheckout?: boolean;
  };
  ChatScreen: { chatRoomId: string; otherUserName?: string; otherUserAvatar?: string; otherUserType?: 'buyer' | 'seller'; storeName?: string; storeLogo?: string };
  Orders: undefined;
  Disputes: { OredrId?: string };
  CreateDispute: { orderId: string; paymentId: string };
  DisputeDetails: { disputeId: string };
  EditProfile: undefined;
  Points: undefined;
  PointsHistory: undefined;
  DeliveryDetails: { orderId: string };
  ProductReviews: { productId: string };
  ManageReview: { orderId: string; productId: string; productName: string; productImage: string };
  PaymentsScreen: undefined;
  PaymentDetails: { paymentId: string };
  About: undefined;
  ContactUs: undefined;
  Terms: undefined;
  Policy: undefined;
  RequestRefund: { orderId: string; productId: string; productName: string };
  SellerStoreReviews: { storeId: string };
  ReviewDetails: { reviewId: string };

  // Add more buyer-specific screens
};

export type SellerStackParamList = {
  Main: undefined;
  SellerHome: undefined;
  SellerProfile: undefined;
  SellerProducts: undefined;
  EditStore: { store: Store };
  CreateStore: undefined;
  MyStore: undefined;
  AddProduct: undefined;
  EditProduct: { productId: string; initialProduct?: any };
  SellerProductDetails: { productUrl: string };
  SellerPublicProductsScreen: { storeUrl: string, storeName: string}
  AccountDetails: undefined;
  AddAccount: undefined;
  EditAccount: { accountId: string };
  Orders: undefined;
  SellerDashboard: undefined;
  ManageProducts: undefined;
  Notifications: undefined;
  MainChatScreen: undefined;
  AddDeliveryInfo: { orderId: string, isEdit:true}
  ManageDeliveryInfo: undefined;
   Chat: { chatRoomId: string; otherUserName: string; otherUserAvatar?: string };
   Terms: undefined;
   Policy: undefined;
   ManagePayoutAccount: undefined;
    MyStoreReviews: undefined;
    SellerOrderDetails: { orderId: string };
    EditProfile: undefined;
    PaymentsScreen: undefined;
    PaymentDetails: { paymentId: string };
    SellerEscrow: undefined;
    About: undefined;
    ContactUs: undefined;
  // Add more seller-specific screens
};

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminUsers: undefined;
  AdminSettings: undefined;
  AdminStores: undefined;
  Main: undefined;
  UserDetails: { userId: string };
  StoreDetails: { storeId: string };
  Disputes: undefined;
  DisputeDetails: { disputeId: string };
  OrderManagement: undefined;
  PendingVerifications: undefined;
  VerificationDetails: { verificationId: string };
  SellerPublicProducts: { storeUrl: string, storeName: string};
  AdminEscrow: undefined;
  PaymentsScreen: undefined;
  PaymentDetails: { paymentId: string };
  // Add more admin-specific screens
};

export type SharedStackParamList = {
  Settings: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  // Add more shared screens
};

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  role: UserRole;
  points?: number;
  isVerified: boolean;
  verificationStatus: string;
  store?: Store;
}
