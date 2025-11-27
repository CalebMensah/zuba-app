// routes/chatRoutes.js
import express from 'express';
import {
  getOrCreateOrderChatRoom,
  getOrCreateProductChatRoom,
  getUserChatRooms,
  getRoomMessages,
  sendMessage,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  archiveChatRoom,
  updateChatPreferences
} from '../controllers/chatcontrollers.js';
import { authenticateToken } from '../middleware/authmiddleware.js';
import { uploadChatMedia, handleMulterError } from '../config/chatUpload.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/rooms', getUserChatRooms);
router.post('/rooms/order/:orderId', getOrCreateOrderChatRoom);
router.post('/rooms/product/:productId', getOrCreateProductChatRoom);
router.get('/rooms/:chatRoomId/messages', getRoomMessages);
router.post(
  '/rooms/:chatRoomId/messages',
  uploadChatMedia,
  handleMulterError,
  sendMessage
);
router.patch('/rooms/:chatRoomId/read', markMessagesAsRead);
router.patch('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);
router.patch('/rooms/:chatRoomId/archive', archiveChatRoom);
router.patch('/preferences', updateChatPreferences);

export default router;