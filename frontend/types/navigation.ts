
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  VerifyEmail: { email: string };
};

export type BuyerStackParamList = {
  BuyerHome: undefined;
  BuyerProfile: undefined;
  // Add more buyer-specific screens
};

export type SellerStackParamList = {
  SellerHome: undefined;
  SellerProfile: undefined;
  SellerProducts: undefined;
  // Add more seller-specific screens
};

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminUsers: undefined;
  AdminSettings: undefined;
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
  phone: string;
  role: UserRole;
  points?: number;
  isVerified: boolean;
  verificationStatus: string;
}