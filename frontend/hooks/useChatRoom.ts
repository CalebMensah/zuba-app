// hooks/useChatRoom.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatContext } from '../context/ChatContext';
import { SendMessageParams } from '../types/chat';

interface UseChatRoomOptions {
  chatRoomId: string;
  autoJoin?: boolean;
  autoMarkAsRead?: boolean;
  currentUserId?: string;
}

interface UseChatRoomReturn {
  messages: ReturnType<typeof useChatContext>['messages'];
  typingUsers: ReturnType<typeof useChatContext>['typingUsers'];
  onlineUsers: ReturnType<typeof useChatContext>['onlineUsers'];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, media?: SendMessageParams['media']) => Promise<void>;
  replyToMessage: (messageId: string, content: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  fetchMessages: (chatRoomId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
}

export const useChatRoom = (options: UseChatRoomOptions): UseChatRoomReturn => {
  const { chatRoomId, autoJoin = true, autoMarkAsRead = true } = options;

  // ✅ consume shared context instead of creating a new useChat instance
  const chat = useChatContext();

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Join room on mount, leave on unmount
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

  // Auto mark messages as read using currentUserId from context
  useEffect(() => {
    if (autoMarkAsRead && chatRoomId && chat.messages.length > 0) {
      const unreadMessageIds = chat.messages
        .filter(msg => !msg.isRead && msg.senderId !== chat.currentUserId) // ✅ correct user check
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
    await chat.sendMessage({ chatRoomId, content, media });
  }, [chat, chatRoomId]);

  const replyToMessage = useCallback(async (
    messageId: string,
    content: string
  ) => {
    await chat.sendMessage({ chatRoomId, content, repliedToId: messageId });
  }, [chat, chatRoomId]);

  const editMessage = useCallback(async (
    messageId: string,
    content: string
  ) => {
    await chat.editMessage(messageId, content);
  }, [chat]);

  const deleteMessage = useCallback(async (messageId: string) => {
    await chat.deleteMessage(messageId);
  }, [chat]);

  /**
   * Typing indicator with 3-second auto-stop debounce
   */
  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      chat.sendTypingIndicator(chatRoomId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping, chat, chatRoomId]);

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
    fetchMessages: (id: string) => chat.fetchMessages(id),
    hasMoreMessages: chat.hasMoreMessages
  };
};