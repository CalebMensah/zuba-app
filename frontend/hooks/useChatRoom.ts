// hooks/useChatRoom.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from './useChat';
import { SendMessageParams } from '../types/chat';

interface UseChatRoomOptions {
  chatRoomId: string;
  autoJoin?: boolean;
  autoMarkAsRead?: boolean;
}

interface UseChatRoomReturn {
  // State from main hook
  messages: ReturnType<typeof useChat>['messages'];
  typingUsers: ReturnType<typeof useChat>['typingUsers'];
  onlineUsers: ReturnType<typeof useChat>['onlineUsers'];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, media?: SendMessageParams['media']) => Promise<void>;
  replyToMessage: (messageId: string, content: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
}

export const useChatRoom = (
  options: UseChatRoomOptions
): UseChatRoomReturn => {
  const { chatRoomId, autoJoin = true, autoMarkAsRead = true } = options;
  
  const chat = useChat({
    apiUrl: process.env.EXPO_PUBLIC_API_URL,      // For REST API: https://...ngrok.../api
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL, // For Socket.IO: https://...ngrok...
    autoConnect: true
  });

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoJoin && chatRoomId && chat.isConnected) {
      chat.joinRoom(chatRoomId);
      chat.fetchMessages(chatRoomId);
    }

    return () => {
      if (chatRoomId) {
        chat.leaveRoom(chatRoomId);
      }
    };
  }, [chatRoomId, autoJoin, chat.isConnected]);

  useEffect(() => {
    if (autoMarkAsRead && chatRoomId && chat.messages.length > 0) {
      const unreadMessageIds = chat.messages
        .filter(msg => !msg.isRead && msg.senderId !== chat.currentRoom?.participants[0]?.userId)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        chat.markAsRead(chatRoomId, unreadMessageIds);
      }
    }
  }, [chat.messages, chatRoomId, autoMarkAsRead]);

  const sendMessage = useCallback(async (
    content: string,
    media?: SendMessageParams['media']
  ) => {
    await chat.sendMessage({
      chatRoomId,
      content,
      media
    });
  }, [chat, chatRoomId]);

  /**
   * Reply to a message
   */
  const replyToMessage = useCallback(async (
    messageId: string,
    content: string
  ) => {
    await chat.sendMessage({
      chatRoomId,
      content,
      repliedToId: messageId
    });
  }, [chat, chatRoomId]);

  /**
   * Edit a message
   */
  const editMessage = useCallback(async (
    messageId: string,
    content: string
  ) => {
    await chat.editMessage(messageId, content);
  }, [chat]);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    await chat.deleteMessage(messageId);
  }, [chat]);

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      chat.sendTypingIndicator(chatRoomId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping, chat, chatRoomId]);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      chat.sendTypingIndicator(chatRoomId, false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, chat, chatRoomId]);

  /**
   * Load more messages
   */
  const loadMoreMessages = useCallback(async () => {
    await chat.loadMoreMessages();
  }, [chat]);

  return {
    messages: chat.messages,
    typingUsers: chat.typingUsers,
    onlineUsers: chat.onlineUsers,
    isLoading: chat.isLoading,
    error: chat.error,
    sendMessage,
    replyToMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    loadMoreMessages,
    hasMoreMessages: chat.hasMoreMessages
  };
};