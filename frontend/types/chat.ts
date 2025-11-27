// types/chat.types.ts

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ChatRoomParticipant {
  id: string;
  chatRoomId: string;
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  isMuted: boolean;
  user: User;
}

export interface Product {
  id: string;
  name: string;
  images: string[];
  price: number;
}

export interface Order {
  id: string;
  status: string;
  totalAmount: number;
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  media?: string[];
  isRead: boolean;
  readAt?: Date;
  repliedToId?: string;
  repliedTo?: ChatMessage;
  createdAt: Date;
  updatedAt: Date;
  sender: User;
}

export enum ChatRoomType {
  ORDER = 'ORDER',
  PRODUCT_INQUIRY = 'PRODUCT_INQUIRY',
  GENERAL = 'GENERAL',
  SYSTEM = 'SYSTEM'
}

export interface ChatRoom {
  id: string;
  name?: string;
  type: ChatRoomType;
  participants: ChatRoomParticipant[];
  messages: ChatMessage[];
  orderId?: string;
  productId?: string;
  isGroup: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  order?: Order;
  product?: Product;
  unreadCount?: number;
  lastMessage?: ChatMessage;
}

export interface MessageReadData {
  chatRoomId: string;
  messageIds: string[];
  readBy: string;
  readAt: Date;
}

export interface TypingData {
  userId: string;
  userName: string;
  chatRoomId: string;
  isTyping: boolean;
}

export interface UserStatusData {
  userId: string;
  status: 'online' | 'offline';
  lastSeen: Date;
}

export interface MessageDeletedData {
  messageId: string;
  chatRoomId: string;
}

export interface MessageEditedData {
  id: string;
  chatRoomId: string;
  content: string;
  updatedAt: Date;
}

export interface UserJoinedRoomData {
  userId: string;
  userName: string;
  chatRoomId: string;
}

export interface UserLeftRoomData {
  userId: string;
  userName: string;
  chatRoomId: string;
}

export interface SendMessageParams {
  chatRoomId: string;
  content?: string;
  media?: Array<{
    uri: string;
    type: string;
    name: string;
  }>;
  repliedToId?: string;
}

export interface ChatPreferences {
  notifyOnNewMessage: boolean;
  muteNotificationsUntil?: Date || null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}