// config/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js'
import { setSocketIO } from '../services/socketService.js';

// Store active users and their socket IDs
const activeUsers = new Map(); // userId -> Set of socketIds

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Set the Socket.IO instance in the service
  setSocketIO(io);

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      console.log('Socket authentication attempt');
      console.log('Token received:', token ? 'Yes' : 'No');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      
      // Your JWT uses 'userId' field (from login endpoint)
      const userId = decoded.userId || decoded.id || decoded.sub || decoded.user?.id;
      
      if (!userId) {
        console.error('No user ID found in token. Token structure:', Object.keys(decoded));
        return next(new Error('Authentication error: Invalid token structure'));
      }
      
      console.log('Extracted userId:', userId);
      
      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true
        }
      });

      if (!user) {
        console.error('User not found in database:', userId);
        return next(new Error('Authentication error: User not found'));
      }

      // Create full name
      const fullName = `${user.firstName} ${user.lastName}`.trim();

      socket.userId = user.id;
      socket.user = {
        id: user.id,
        name: fullName,
        email: user.email,
        avatar: user.avatar
      };
      
      console.log('User authenticated:', socket.user.name);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      if (error.name === 'JsonWebTokenError') {
        next(new Error('Authentication error: Invalid token'));
      } else if (error.name === 'TokenExpiredError') {
        next(new Error('Authentication error: Token expired'));
      } else {
        next(new Error('Authentication error'));
      }
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.userId})`);

    // Track active user
    if (!activeUsers.has(socket.userId)) {
      activeUsers.set(socket.userId, new Set());
    }
    activeUsers.get(socket.userId).add(socket.id);

    // Emit user online status to all clients
    io.emit('user-status', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });

    // Join user to their chat rooms
    socket.on('join-rooms', async (data) => {
      try {
        const userRooms = await prisma.chatRoomParticipant.findMany({
          where: {
            userId: socket.userId,
            leftAt: null
          },
          select: {
            chatRoomId: true
          }
        });

        // Join all user's chat rooms
        userRooms.forEach(room => {
          socket.join(room.chatRoomId);
        });

        console.log(`User ${socket.userId} joined ${userRooms.length} rooms`);
        
        socket.emit('rooms-joined', {
          success: true,
          roomCount: userRooms.length
        });
      } catch (error) {
        console.error('Error joining rooms:', error);
        socket.emit('error', { message: 'Failed to join rooms' });
      }
    });

    // Join a specific room
    socket.on('join-room', async (chatRoomId) => {
      try {
        // Verify user is a participant
        const participant = await prisma.chatRoomParticipant.findUnique({
          where: {
            chatRoomId_userId: {
              chatRoomId,
              userId: socket.userId
            }
          }
        });

        if (participant) {
          socket.join(chatRoomId);
          console.log(`User ${socket.userId} joined room ${chatRoomId}`);
          
          socket.emit('room-joined', {
            success: true,
            chatRoomId
          });

          // Notify others in the room
          socket.to(chatRoomId).emit('user-joined-room', {
            userId: socket.userId,
            userName: socket.user.name,
            chatRoomId
          });
        } else {
          socket.emit('error', { message: 'Not authorized to join this room' });
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave a room
    socket.on('leave-room', (chatRoomId) => {
      socket.leave(chatRoomId);
      console.log(`User ${socket.userId} left room ${chatRoomId}`);
      
      socket.to(chatRoomId).emit('user-left-room', {
        userId: socket.userId,
        userName: socket.user.name,
        chatRoomId
      });
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { chatRoomId, isTyping } = data;
      socket.to(chatRoomId).emit('user-typing', {
        userId: socket.userId,
        userName: socket.user.name,
        chatRoomId,
        isTyping
      });
    });

    // Mark messages as read (real-time)
    socket.on('messages-read', async (data) => {
      const { chatRoomId, messageIds } = data;
      
      // Broadcast to room that messages were read
      socket.to(chatRoomId).emit('messages-read-by-user', {
        userId: socket.userId,
        chatRoomId,
        messageIds,
        readAt: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.userId})`);
      
      const userSockets = activeUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If user has no more active connections, mark as offline
        if (userSockets.size === 0) {
          activeUsers.delete(socket.userId);
          
          // Update last seen and emit offline status
          io.emit('user-status', {
            userId: socket.userId,
            status: 'offline',
            lastSeen: new Date()
          });
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Helper function to check if user is online
  io.isUserOnline = (userId) => {
    return activeUsers.has(userId);
  };

  // Helper function to get user's socket IDs
  io.getUserSockets = (userId) => {
    return Array.from(activeUsers.get(userId) || []);
  };

  console.log('Socket.IO initialized successfully');
  
  return io;
};

export default initializeSocket;