// context/ChatContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useChat } from '../hooks/useChat';

// Infer the return type directly from useChat so it never goes stale
type ChatContextType = ReturnType<typeof useChat>;

const ChatContext = createContext<ChatContextType | null>(null);

interface ChatProviderProps {
  currentUserId: string;
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  currentUserId,
  children
}) => {
  const chat = useChat({
    apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
    autoConnect: true,
    currentUserId
  });

  return (
    <ChatContext.Provider value={chat}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};