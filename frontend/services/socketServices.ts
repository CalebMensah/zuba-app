// services/socketService.ts
import { io, Socket } from 'socket.io-client';
import {
  ChatMessage,
  MessageReadData,
  TypingData,
  UserStatusData,
  MessageDeletedData,
  MessageEditedData,
  UserJoinedRoomData,
  UserLeftRoomData
} from '../types/chat';

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketEventCallback> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Normalize Socket URL by removing trailing slashes and /api suffix
   * Socket.IO should connect to the root server URL, not the API endpoint
   */
  private normalizeSocketUrl(socketUrl: string): string {
    console.log('Original socket URL:', socketUrl);
    
    // Remove trailing slashes
    let normalized = socketUrl.replace(/\/+$/, '');
    
    // Remove /api suffix if present (Socket.IO connects to root)
    if (normalized.endsWith('/api')) {
      normalized = normalized.slice(0, -4);
      console.log('Removed /api suffix');
    }
    
    console.log('Normalized socket URL:', normalized);
    return normalized;
  }

  /**
   * Connect to Socket.IO server
   * @param token - Authentication token
   * @param socketUrl - Socket server URL (should be root server URL, not API URL)
   */
  connect(token: string, socketUrl: string): void {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    try {
      const normalizedUrl = this.normalizeSocketUrl(socketUrl);
      console.log('Connecting to Socket.IO server:', normalizedUrl);

      // Connect to default namespace "/"
      this.socket = io(normalizedUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000,
        // Ensure we're connecting to the root namespace
        path: '/socket.io/',
        // Extra headers for ngrok
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      this.setupEventListeners();
      console.log('Socket.IO connection initialized');
    } catch (error) {
      console.error('Error initializing socket connection:', error);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Join all user's rooms on connection
      this.socket?.emit('join-rooms');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected, reconnect manually
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('rooms-joined', (data: { success: boolean; roomCount: number }) => {
      console.log('Joined rooms:', data);
    });

    this.socket.on('room-joined', (data: { success: boolean; chatRoomId: string }) => {
      console.log('Joined room:', data.chatRoomId);
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
    });
  }

  joinRoom(chatRoomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', chatRoomId);
      console.log('Joining room:', chatRoomId);
    } else {
      console.warn('Socket not connected, cannot join room');
    }
  }

  leaveRoom(chatRoomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', chatRoomId);
      console.log('Leaving room:', chatRoomId);
    }
  }

  sendTyping(chatRoomId: string, isTyping: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('typing', { chatRoomId, isTyping });
    }
  }

  markMessagesRead(chatRoomId: string, messageIds: string[]): void {
    if (this.socket?.connected) {
      this.socket.emit('messages-read', { chatRoomId, messageIds });
    }
  }

  onNewMessage(callback: (message: ChatMessage) => void): void {
    if (this.socket) {
      this.socket.on('new-message', callback);
      this.listeners.set('new-message', callback);
    }
  }

  onMessageRead(callback: (data: MessageReadData) => void): void {
    if (this.socket) {
      this.socket.on('message-read', callback);
      this.listeners.set('message-read', callback);
    }
  }

  onUserTyping(callback: (data: TypingData) => void): void {
    if (this.socket) {
      this.socket.on('user-typing', callback);
      this.listeners.set('user-typing', callback);
    }
  }

  onUserStatus(callback: (data: UserStatusData) => void): void {
    if (this.socket) {
      this.socket.on('user-status', callback);
      this.listeners.set('user-status', callback);
    }
  }

  onMessageDeleted(callback: (data: MessageDeletedData) => void): void {
    if (this.socket) {
      this.socket.on('message-deleted', callback);
      this.listeners.set('message-deleted', callback);
    }
  }

  onMessageEdited(callback: (data: MessageEditedData) => void): void {
    if (this.socket) {
      this.socket.on('message-edited', callback);
      this.listeners.set('message-edited', callback);
    }
  }

  onUserJoinedRoom(callback: (data: UserJoinedRoomData) => void): void {
    if (this.socket) {
      this.socket.on('user-joined-room', callback);
      this.listeners.set('user-joined-room', callback);
    }
  }

  onUserLeftRoom(callback: (data: UserLeftRoomData) => void): void {
    if (this.socket) {
      this.socket.on('user-left-room', callback);
      this.listeners.set('user-left-room', callback);
    }
  }

  onMessagesReadByUser(callback: (data: MessageReadData & { userId: string }) => void): void {
    if (this.socket) {
      this.socket.on('messages-read-by-user', callback);
      this.listeners.set('messages-read-by-user', callback);
    }
  }

  off(event: string): void {
    if (this.socket && this.listeners.has(event)) {
      const callback = this.listeners.get(event);
      if (callback) {
        this.socket.off(event, callback);
      }
      this.listeners.delete(event);
    }
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.listeners.forEach((callback, event) => {
        this.socket?.off(event, callback);
      });
      this.listeners.clear();
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
      console.log('Socket disconnected and cleaned up');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }
}

// Export singleton instance
export default new SocketService();