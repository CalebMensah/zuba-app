// hooks/useChat.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socketServices';
import ChatApiService from '../services/chatApiServices';
import {
  ChatRoom,
  ChatMessage,
  SendMessageParams,
  TypingData,
  UserStatusData,
  PaginationParams
} from '../types/chat';

interface UseChatOptions {
  apiUrl: string;
  socketUrl?: string;  // Optional: separate URL for Socket.IO
  autoConnect?: boolean;
}

interface UseChatReturn {
  // State
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  chatRooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  messages: ChatMessage[];
  typingUsers: Set<string>;
  onlineUsers: Set<string>;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Chat Rooms
  fetchChatRooms: (params?: PaginationParams) => Promise<void>;
  createOrderChatRoom: (orderId: string) => Promise<ChatRoom | null>;
  createProductChatRoom: (productId: string) => Promise<ChatRoom | null>;
  joinRoom: (chatRoomId: string) => void;
  leaveRoom: (chatRoomId: string) => void;
  archiveRoom: (chatRoomId: string) => Promise<void>;
  
  // Messages
  fetchMessages: (chatRoomId: string, params?: PaginationParams) => Promise<void>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (chatRoomId: string, messageIds?: string[]) => Promise<void>;
  
  // Typing
  sendTypingIndicator: (chatRoomId: string, isTyping: boolean) => void;
  
  // Pagination
  hasMoreMessages: boolean;
  loadMoreMessages: () => Promise<void>;
}

export const useChat = (options: UseChatOptions): UseChatReturn => {
  const { apiUrl, socketUrl, autoConnect = true } = options;
  
  // Initialize API service with apiUrl (for REST endpoints)
  const apiServiceRef = useRef(new ChatApiService(apiUrl));
  const apiService = apiServiceRef.current;
  
  // Use socketUrl if provided, otherwise fall back to apiUrl
  // This allows separate URLs for Socket.IO and REST API
  const socketConnectionUrl = socketUrl || apiUrl;
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messagesPerPage = 50;

  /**
   * Connect to Socket.IO server
   */
  const connect = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // Connect to Socket.IO using socketConnectionUrl
      socketService.connect(token, socketConnectionUrl);
      setIsConnected(true);
      setError(null);
      
      console.log('Connected to Socket.IO:', socketConnectionUrl);
    } catch (err) {
      setError('Failed to connect to chat server');
      console.error('Connection error:', err);
    }
  }, [socketConnectionUrl]);

  /**
   * Disconnect from Socket.IO server
   */
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
  }, []);

  /**
   * Fetch all chat rooms
   */
  const fetchChatRooms = useCallback(async (params?: PaginationParams) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getUserChatRooms(params);
      
      if (response.success) {
        setChatRooms(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch chat rooms');
      console.error('Fetch chat rooms error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  /**
   * Create or get order chat room
   */
  const createOrderChatRoom = useCallback(async (orderId: string): Promise<ChatRoom | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getOrCreateOrderChatRoom(orderId);
      
      if (response.success && response.data) {
        setCurrentRoom(response.data);
        return response.data;
      }
      return null;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create order chat room');
      console.error('Create order chat room error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  /**
   * Create or get product inquiry chat room
   */
  const createProductChatRoom = useCallback(async (productId: string): Promise<ChatRoom | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getOrCreateProductChatRoom(productId);
      
      if (response.success && response.data) {
        setCurrentRoom(response.data);
        return response.data;
      }
      return null;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create product chat room');
      console.error('Create product chat room error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  /**
   * Join a chat room
   */
  const joinRoom = useCallback((chatRoomId: string) => {
    socketService.joinRoom(chatRoomId);
    setCurrentPage(1);
    setHasMoreMessages(true);
  }, []);

  /**
   * Leave a chat room
   */
  const leaveRoom = useCallback((chatRoomId: string) => {
    socketService.leaveRoom(chatRoomId);
    setCurrentRoom(null);
    setMessages([]);
    setTypingUsers(new Set());
  }, []);

  /**
   * Archive a chat room
   */
  const archiveRoom = useCallback(async (chatRoomId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await apiService.archiveChatRoom(chatRoomId);
      
      // Remove from local state
      setChatRooms(prev => prev.filter(room => room.id !== chatRoomId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive chat room');
      console.error('Archive room error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  /**
   * Fetch messages for a chat room
   */
  const fetchMessages = useCallback(async (
    chatRoomId: string,
    params?: PaginationParams
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getRoomMessages(chatRoomId, params);
      
      if (response.success) {
        setMessages(response.data);
        
        // Check if there are more messages
        if (response.pagination) {
          setHasMoreMessages(
            response.pagination.page < response.pagination.totalPages
          );
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch messages');
      console.error('Fetch messages error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(async () => {
    if (!currentRoom || !hasMoreMessages || isLoading) return;
    
    try {
      const nextPage = currentPage + 1;
      
      const response = await apiService.getRoomMessages(currentRoom.id, {
        page: nextPage,
        limit: messagesPerPage
      });
      
      if (response.success) {
        setMessages(prev => [...response.data, ...prev]);
        setCurrentPage(nextPage);
        
        if (response.pagination) {
          setHasMoreMessages(
            response.pagination.page < response.pagination.totalPages
          );
        }
      }
    } catch (err: any) {
      console.error('Load more messages error:', err);
    }
  }, [currentRoom, currentPage, hasMoreMessages, isLoading, apiService]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (params: SendMessageParams) => {
    try {
      setError(null);
      
      const response = await apiService.sendMessage(params);
      
      if (!response.success) {
        setError(response.message || 'Failed to send message');
      }
      // Message will be added via socket event
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
      console.error('Send message error:', err);
    }
  }, [apiService]);

  /**
   * Edit a message
   */
  const editMessage = useCallback(async (messageId: string, content: string) => {
    try {
      setError(null);
      
      await apiService.editMessage(messageId, content);
      // Message will be updated via socket event
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to edit message');
      console.error('Edit message error:', err);
    }
  }, [apiService]);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      
      await apiService.deleteMessage(messageId);
      // Message will be removed via socket event
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete message');
      console.error('Delete message error:', err);
    }
  }, [apiService]);

  /**
   * Mark messages as read
   */
  const markAsRead = useCallback(async (
    chatRoomId: string,
    messageIds?: string[]
  ) => {
    try {
      await apiService.markMessagesAsRead(chatRoomId, messageIds);
      
      if (messageIds) {
        socketService.markMessagesRead(chatRoomId, messageIds);
      }
    } catch (err: any) {
      console.error('Mark as read error:', err);
    }
  }, [apiService]);

  /**
   * Send typing indicator
   */
  const sendTypingIndicator = useCallback((chatRoomId: string, isTyping: boolean) => {
    socketService.sendTyping(chatRoomId, isTyping);
  }, []);

  /**
   * Setup socket event listeners
   */
  useEffect(() => {
    if (!isConnected) return;

    // New message received
    socketService.onNewMessage((message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      
      // Update last message in chat rooms
      setChatRooms(prev =>
        prev.map(room =>
          room.id === message.chatRoomId
            ? { ...room, lastMessage: message, updatedAt: message.createdAt }
            : room
        )
      );
    });

    // Message read
    socketService.onMessageRead((data) => {
      setMessages(prev =>
        prev.map(msg =>
          data.messageIds.includes(msg.id)
            ? { ...msg, isRead: true, readAt: data.readAt }
            : msg
        )
      );
    });

    // User typing
    socketService.onUserTyping((data: TypingData) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.userName);
        } else {
          newSet.delete(data.userName);
        }
        return newSet;
      });
    });

    // User status
    socketService.onUserStatus((data: UserStatusData) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.status === 'online') {
          newSet.add(data.userId);
        } else {
          newSet.delete(data.userId);
        }
        return newSet;
      });
    });

    // Message deleted
    socketService.onMessageDeleted((data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    // Message edited
    socketService.onMessageEdited((data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.id
            ? { ...msg, content: data.content, updatedAt: data.updatedAt }
            : msg
        )
      );
    });

    return () => {
      socketService.off('new-message');
      socketService.off('message-read');
      socketService.off('user-typing');
      socketService.off('user-status');
      socketService.off('message-deleted');
      socketService.off('message-edited');
    };
  }, [isConnected]);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // State
    isConnected,
    isLoading,
    error,
    chatRooms,
    currentRoom,
    messages,
    typingUsers,
    onlineUsers,
    
    // Actions
    connect,
    disconnect,
    
    // Chat Rooms
    fetchChatRooms,
    createOrderChatRoom,
    createProductChatRoom,
    joinRoom,
    leaveRoom,
    archiveRoom,
    
    // Messages
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    
    // Typing
    sendTypingIndicator,
    
    // Pagination
    hasMoreMessages,
    loadMoreMessages
  };
};