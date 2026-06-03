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
  socketUrl?: string;
  autoConnect?: boolean;
  currentUserId: string;
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
  currentUserId: string;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;

  // Chat Rooms
  fetchChatRooms: (params?: PaginationParams) => Promise<void>;
  startDirectChat: (otherUserId: string) => Promise<ChatRoom | null>;
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
  const { apiUrl, socketUrl, autoConnect = true, currentUserId } = options;

  const apiServiceRef = useRef(new ChatApiService(apiUrl));
  const apiService = apiServiceRef.current;

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

      socketService.connect(token, socketConnectionUrl);
      setIsConnected(true);
      setError(null);
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
   * Fetch all chat rooms for the current user
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

 
  const startDirectChat = useCallback(async (otherUserId: string): Promise<ChatRoom | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getOrCreateDirectChat(otherUserId);

      if (response.success && response.data) {
        setCurrentRoom(response.data);

        // Add to chatRooms list if not already present
        setChatRooms(prev => {
          const exists = prev.some(room => room.id === response.data!.id);
          return exists ? prev : [response.data!, ...prev];
        });

        return response.data;
      }
      return null;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start direct chat');
      console.error('Start direct chat error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  const joinRoom = useCallback((chatRoomId: string) => {
    socketService.joinRoom(chatRoomId);
    setCurrentPage(1);
    setHasMoreMessages(true);
  }, []);

  const leaveRoom = useCallback((chatRoomId: string) => {
    socketService.leaveRoom(chatRoomId);
    setCurrentRoom(null);
    setMessages([]);
    setTypingUsers(new Set());
    setCurrentPage(1);
    setHasMoreMessages(true);
  }, []);

  const archiveRoom = useCallback(async (chatRoomId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiService.archiveChatRoom(chatRoomId);

      setChatRooms(prev => prev.filter(room => room.id !== chatRoomId));

      if (currentRoom?.id === chatRoomId) {
        setCurrentRoom(null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive chat room');
      console.error('Archive room error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiService, currentRoom]);

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
        setCurrentPage(1);

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

  const loadMoreMessages = useCallback(async () => {
    if (!currentRoom || !hasMoreMessages || isLoading) return;

    try {
      const nextPage = currentPage + 1;

      const response = await apiService.getRoomMessages(currentRoom.id, {
        page: nextPage,
        limit: messagesPerPage
      });

      if (response.success) {
        // Prepend older messages to the top
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

  const sendMessage = useCallback(async (params: SendMessageParams) => {
    try {
      setError(null);

      const response = await apiService.sendMessage(params);

      if (!response.success) {
        setError(response.message || 'Failed to send message');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
      console.error('Send message error:', err);
    }
  }, [apiService]);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    try {
      setError(null);
      await apiService.editMessage(messageId, content);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to edit message');
      console.error('Edit message error:', err);
    }
  }, [apiService]);


  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      await apiService.deleteMessage(messageId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete message');
      console.error('Delete message error:', err);
    }
  }, [apiService]);

 
  const markAsRead = useCallback(async (
    chatRoomId: string,
    messageIds?: string[]
  ) => {
    try {
      await apiService.markMessagesAsRead(chatRoomId, messageIds);
    } catch (err: any) {
      console.error('Mark as read error:', err);
    }
  }, [apiService]);

  const sendTypingIndicator = useCallback((chatRoomId: string, isTyping: boolean) => {
    socketService.sendTyping(chatRoomId, isTyping);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    // New message received from server
    socketService.onNewMessage((message: ChatMessage) => {
      setMessages(prev => [...prev, message]);

      // Update last message preview and sort room to top
      setChatRooms(prev =>
        prev
          .map(room =>
            room.id === message.chatRoomId
              ? {
                  ...room,
                  lastMessage: message,
                  updatedAt: message.createdAt,
                  // Increment unread count only for messages from the other user
                  unreadCount: message.senderId !== currentUserId
                    ? (room.unreadCount ?? 0) + 1
                    : room.unreadCount
                }
              : room
          )
          // Keep most recently updated room at the top
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    });

    // Read receipt received
    socketService.onMessageRead((data) => {
      setMessages(prev =>
        prev.map(msg =>
          data.messageIds.includes(msg.id)
            ? { ...msg, isRead: true, readAt: data.readAt }
            : msg
        )
      );

      // Reset unread count for the room
      setChatRooms(prev =>
        prev.map(room =>
          room.id === data.chatRoomId
            ? { ...room, unreadCount: 0 }
            : room
        )
      );
    });

    // Typing indicator received
    socketService.onUserTyping((data: TypingData) => {
      // Only show typing indicator for the other user, not current user
      if (data.userId === currentUserId) return;

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

    // Online/offline status received
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
  }, [isConnected, currentUserId]);

  /**
   * Auto-connect on mount if enabled, disconnect on unmount
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
    currentUserId,

    // Actions
    connect,
    disconnect,

    // Chat Rooms
    fetchChatRooms,
    startDirectChat,
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