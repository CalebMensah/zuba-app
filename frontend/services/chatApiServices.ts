// services/chatApiService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChatRoom,
  ChatMessage,
  SendMessageParams,
  ChatPreferences,
  PaginationParams,
  PaginatedResponse,
  ApiResponse
} from '../types/chat';

class ChatApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.api = axios.create({
      baseURL: `${baseURL}/chat`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting token from AsyncStorage:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          await AsyncStorage.removeItem('token');
          // Navigate to login screen - handled by the app
        }
        return Promise.reject(error);
      }
    );
  }

  async getUserChatRooms(
    params?: PaginationParams & { type?: string }
  ): Promise<PaginatedResponse<ChatRoom[]>> {
    const response = await this.api.get('/rooms', { params });
    return response.data;
  }

  async getOrCreateOrderChatRoom(orderId: string): Promise<ApiResponse<ChatRoom>> {
    const response = await this.api.post(`/rooms/order/${orderId}`);
    return response.data;
  }

  async getOrCreateProductChatRoom(productId: string): Promise<ApiResponse<ChatRoom>> {
    const response = await this.api.post(`/rooms/product/${productId}`);
    return response.data;
  }

  async getRoomMessages(
    chatRoomId: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<ChatMessage[]>> {
    const response = await this.api.get(`/rooms/${chatRoomId}/messages`, { params });
    return response.data;
  }

  async sendMessage(params: SendMessageParams): Promise<ApiResponse<ChatMessage>> {
    const { chatRoomId, content, media, repliedToId } = params;

    const formData = new FormData();

    if (content) {
      formData.append('content', content);
    }

    if (repliedToId) {
      formData.append('repliedToId', repliedToId);
    }

    if (media && media.length > 0) {
      media.forEach((file) => {
        formData.append('media', {
          uri: file.uri,
          type: file.type,
          name: file.name
        } as any);
      });
    }

    const response = await this.api.post(`/rooms/${chatRoomId}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  async markMessagesAsRead(
    chatRoomId: string,
    messageIds?: string[]
  ): Promise<ApiResponse<{ count: number; messageIds: string[] }>> {
    const response = await this.api.patch(`/rooms/${chatRoomId}/read`, {
      messageIds
    });
    return response.data;
  }

  async editMessage(messageId: string, content: string): Promise<ApiResponse<ChatMessage>> {
    const response = await this.api.patch(`/messages/${messageId}`, { content });
    return response.data;
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/messages/${messageId}`);
    return response.data;
  }

  async archiveChatRoom(chatRoomId: string): Promise<ApiResponse<void>> {
    const response = await this.api.patch(`/rooms/${chatRoomId}/archive`);
    return response.data;
  }

  async updateChatPreferences(preferences: Partial<ChatPreferences>): Promise<ApiResponse<ChatPreferences>> {
    const response = await this.api.patch('/preferences', preferences);
    return response.data;
  }
}

export default ChatApiService;