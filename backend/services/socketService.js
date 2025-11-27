// services/socketService.js
let ioInstance = null;

export const setSocketIO = (io) => {
  ioInstance = io;
  console.log('Socket.IO instance has been set');
};

export const getSocketIO = () => {
  if (!ioInstance) {
    console.warn('Socket.IO instance not initialized');
  }
  return ioInstance;
};

// Emit new message to a chat room
export const emitNewMessage = (chatRoomId, messageData) => {
  if (ioInstance) {
    ioInstance.to(chatRoomId).emit('new-message', messageData);
    console.log(`Emitted 'new-message' to room ${chatRoomId}`);
  } else {
    console.warn('Socket.IO instance not set for emitting new message');
  }
};

// Emit message read status
export const emitMessageRead = (chatRoomId, readData) => {
  if (ioInstance) {
    ioInstance.to(chatRoomId).emit('message-read', readData);
    console.log(`Emitted 'message-read' to room ${chatRoomId}`);
  } else {
    console.warn('Socket.IO instance not set for emitting message read');
  }
};

// Emit typing indicator
export const emitTyping = (chatRoomId, typingData) => {
  if (ioInstance) {
    ioInstance.to(chatRoomId).emit('user-typing', typingData);
  }
};

// Emit user online status
export const emitUserStatus = (userId, status) => {
  if (ioInstance) {
    ioInstance.emit('user-status', { userId, status });
  }
};

// Emit message deleted
export const emitMessageDeleted = (chatRoomId, messageId) => {
  if (ioInstance) {
    ioInstance.to(chatRoomId).emit('message-deleted', { messageId, chatRoomId });
  }
};

// Emit message edited
export const emitMessageEdited = (chatRoomId, messageData) => {
  if (ioInstance) {
    ioInstance.to(chatRoomId).emit('message-edited', messageData);
  }
};

export default {
  setSocketIO,
  getSocketIO,
  emitNewMessage,
  emitMessageRead,
  emitTyping,
  emitUserStatus,
  emitMessageDeleted,
  emitMessageEdited
};