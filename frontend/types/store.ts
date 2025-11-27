export interface Store {
  id: string;
  userId: string;
  name: string;
  description?: string;
  location: string;
  category: string;
  region: string;
  url: string;
  slug: string;
  isActive: boolean;
  logo?: string;
  rating: number;
  totalReviews: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  verification?: StoreVerification;
  isSuspended: boolean;
}

export interface StoreVerification {
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
}

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

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
