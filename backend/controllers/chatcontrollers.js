import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import { sendNotification } from '../utils/sendnotification.js';
import { uploadMultipleToCloudinary, uploadPresets, deleteFromCloudinary } from '../config/cloudinary.js';
import { emitNewMessage, emitMessageRead, emitMessageDeleted, emitMessageEdited } from '../services/socketService.js';


export const getOrCreateOrderChatRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    // Verify the order exists and user is involved
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          include: {
            seller: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Check if user is buyer or seller
    const isBuyer = order.buyerId === userId;
    const isSeller = order.product.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this chat.'
      });
    }

    // Check if chat room already exists for this order
    let chatRoom = await prisma.chatRoom.findFirst({
      where: {
        orderId: orderId,
        type: 'ORDER'
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                email: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!chatRoom) {
      // Create new chat room
      chatRoom = await prisma.chatRoom.create({
        data: {
          name: `Order #${order.id.slice(-8)} Chat`,
          type: 'ORDER',
          orderId: orderId,
          participants: {
            create: [
              { userId: order.buyerId },
              { userId: order.product.sellerId }
            ]
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  email: true,
                  avatar: true
                }
              }
            }
          },
          messages: true
        }
      });

      // Create notification for the other party
      const otherUserId = isBuyer ? order.product.sellerId : order.buyerId;
      await sendNotification(
        otherUserId,
        'New Chat Room',
        `A new chat has been created for Order #${order.id.slice(-8)}`,
        'chat_room_created',
        { chatRoomId: chatRoom.id, orderId }
      );
    }

    res.status(200).json({
      success: true,
      data: chatRoom
    });

  } catch (error) {
    console.error('Error getting/creating order chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getOrCreateProductChatRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    // Verify the product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        store: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Prevent seller from creating chat with themselves
    if (product.store.userId === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot create a chat with yourself.'
      });
    }

    // Check if chat room already exists between user and seller for this product
    let chatRoom = await prisma.chatRoom.findFirst({
      where: {
        productId: productId,
        type: 'PRODUCT_INQUIRY',
        participants: {
          every: {
            OR: [
              { userId: userId },
              { userId: product.store.userId }
            ]
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                email: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                avatar: true
              }
            }
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            price: true
          }
        }
      }
    });

    if (!chatRoom) {
      // Create new chat room
      chatRoom = await prisma.chatRoom.create({
        data: {
          name: `Inquiry: ${product.name}`,
          type: 'PRODUCT_INQUIRY',
          productId: productId,
          participants: {
            create: [
              { userId: userId },
              { userId: product.store.userId }
            ]
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  email: true,
                  avatar: true
                }
              }
            }
          },
          messages: true,
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              price: true
            }
          }
        }
      });

      // Notify the seller
      await sendNotification(
        product.store.userId,
        'New Product Inquiry',
        `Someone is interested in your product: ${product.name}`,
        'product_inquiry',
        { chatRoomId: chatRoom.id, productId }
      );
    }

    res.status(200).json({
      success: true,
      data: chatRoom
    });

  } catch (error) {
    console.error('Error getting/creating product chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      participants: {
        some: {
          userId: userId,
          leftAt: null
        }
      },
      isArchived: false
    };

    if (type) {
      whereClause.type = type;
    }

    const [chatRooms, total] = await Promise.all([
      prisma.chatRoom.findMany({
        where: whereClause,
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  email: true,
                  avatar: true
                }
              }
            }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  avatar: true
                }
              }
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              price: true
            }
          },
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.chatRoom.count({ where: whereClause })
    ]);

    // Get unread message count for each room
    const roomsWithUnread = await Promise.all(
      chatRooms.map(async (room) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            chatRoomId: room.id,
            senderId: { not: userId },
            isRead: false
          }
        });

        return {
          ...room,
          unreadCount,
          lastMessage: room.messages[0] || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: roomsWithUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching user chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getRoomMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verify user is a participant
    const participant = await prisma.chatRoomParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId
        }
      }
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat room.'
      });
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { chatRoomId },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              avatar: true
            }
          },
          repliedTo: {
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  avatar: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.chatMessage.count({ where: { chatRoomId } })
    ]);

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatRoomId } = req.params;
    const { content, repliedToId } = req.body;

    // Log if sender is unexpectedly included in the request body
    if (req.body.sender) {
      console.warn(`Warning: Unexpected sender field in request body, removing before prisma call.`);
      delete req.body.sender;
    }

    // Verify the user is a participant
    const roomParticipant = await prisma.chatRoomParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId
        }
      }
    });

    if (!roomParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat room.'
      });
    }

    // Validate content or media
    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Message content or media is required.'
      });
    }

    let mediaUrls = [];
    // Upload media files if provided
    if (req.files && req.files.length > 0) {
      try {
        const uploadResults = await uploadMultipleToCloudinary(
          req.files.map(file => file.buffer),
          { ...uploadPresets.review, folder: 'chat-media' }
        );
        mediaUrls = uploadResults.map(result => result.secure_url);
      } catch (uploadError) {
        console.error('Error uploading chat media:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading media.',
          error: uploadError.message
        });
      }
    }

    // Prepare the message data
    const messageData = {
      sender: {
        connect: { id: userId }
      },
      content: content || '',
      chatRoom: {
        connect: { id: chatRoomId }
      }
    };

    if (mediaUrls.length > 0) {
      messageData.media = mediaUrls;
    }

    // Validate replied-to message
    if (repliedToId) {
      const originalMessage = await prisma.chatMessage.findFirst({
        where: { id: repliedToId, chatRoomId }
      });
      if (!originalMessage) {
        return res.status(400).json({
          success: false,
          message: 'Replied-to message not found in this room.'
        });
      }
      messageData.repliedToId = repliedToId;
    }

    // Create the message
    const message = await prisma.chatMessage.create({
      data: messageData,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            avatar: true
          }
        },
        repliedTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    // Update the chat room's updatedAt timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() }
    });

    // Emit Socket.IO event to the room
    const ioMessageData = {
      id: message.id,
      chatRoomId: message.chatRoomId,
      sender: message.sender,
      content: message.content,
      media: message.media,
      repliedTo: message.repliedTo || null,
      createdAt: message.createdAt,
      isRead: false
    };

    emitNewMessage(chatRoomId, ioMessageData);

    // Send notifications to other participants
    const otherParticipants = await prisma.chatRoomParticipant.findMany({
      where: {
        chatRoomId: chatRoomId,
        userId: { not: userId },
        leftAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            email: true
          }
        }
      }
    });

    for (const participant of otherParticipants) {
      const userPref = await prisma.userChatPreference.findUnique({
        where: { userId: participant.userId }
      });

      const shouldNotify = !userPref || 
        (userPref.notifyOnNewMessage && 
         (!userPref.muteNotificationsUntil || userPref.muteNotificationsUntil < new Date()));

      if (shouldNotify && !participant.isMuted) {
        await sendNotification(
          participant.userId,
          'New Message',
          `${message.sender.name}: ${content ? content.substring(0, 50) : 'Sent media'}`,
          'chat_new_message',
          { 
            chatRoomId, 
            messageId: message.id, 
            senderId: userId, 
            senderName: message.sender.firstName 
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: message
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatRoomId } = req.params;
    const { messageIds } = req.body; // Optional: array of specific message IDs

    // Verify the user is a participant
    const roomParticipant = await prisma.chatRoomParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId
        }
      }
    });

    if (!roomParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat room.'
      });
    }

    let updateResult;
    let updatedMessageIds = [];

    if (messageIds && messageIds.length > 0) {
      // Mark specific messages as read
      updateResult = await prisma.chatMessage.updateMany({
        where: {
          id: { in: messageIds },
          chatRoomId,
          senderId: { not: userId },
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
      updatedMessageIds = messageIds;
    } else {
      // Mark all unread messages in the room as read
      const unreadMessages = await prisma.chatMessage.findMany({
        where: {
          chatRoomId,
          senderId: { not: userId },
          isRead: false
        },
        select: { id: true }
      });

      if (unreadMessages.length > 0) {
        updatedMessageIds = unreadMessages.map(m => m.id);
        
        updateResult = await prisma.chatMessage.updateMany({
          where: {
            id: { in: updatedMessageIds }
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
      } else {
        updateResult = { count: 0 };
      }
    }

    // Emit Socket.IO event
    if (updatedMessageIds.length > 0) {
      const ioReadData = {
        chatRoomId,
        messageIds: updatedMessageIds,
        readBy: userId,
        readAt: new Date()
      };

      emitMessageRead(chatRoomId, ioReadData);
    }

    res.status(200).json({
      success: true,
      message: `Marked ${updateResult.count} message(s) as read.`,
      data: {
        count: updateResult.count,
        messageIds: updatedMessageIds
      }
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const editMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Content is required.'
      });
    }

    // Find the message and verify ownership
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            avatar: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages.'
      });
    }

    // Check if message is too old to edit (e.g., 24 hours)
    const hoursSinceCreation = (new Date() - new Date(message.createdAt)) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit messages older than 24 hours.'
      });
    }

    // Update the message
    const updatedMessage = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content,
        updatedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            avatar: true
          }
        },
        repliedTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    // Emit Socket.IO event
    emitMessageEdited(message.chatRoomId, {
      id: updatedMessage.id,
      chatRoomId: updatedMessage.chatRoomId,
      content: updatedMessage.content,
      updatedAt: updatedMessage.updatedAt
    });

    res.status(200).json({
      success: true,
      message: 'Message updated successfully.',
      data: updatedMessage
    });

  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    // Find the message and verify ownership
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages.'
      });
    }

    // Delete media from Cloudinary if exists
    if (message.media && message.media.length > 0) {
      try {
        for (const mediaUrl of message.media) {
          await deleteFromCloudinary(mediaUrl);
        }
      } catch (cloudinaryError) {
        console.error('Error deleting media from Cloudinary:', cloudinaryError);
      }
    }

    // Delete the message
    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    // Emit Socket.IO event
    emitMessageDeleted(message.chatRoomId, messageId);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const archiveChatRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatRoomId } = req.params;

    // Verify user is a participant
    const participant = await prisma.chatRoomParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId
        }
      }
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat room.'
      });
    }

    // Archive the room
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { isArchived: true }
    });

    res.status(200).json({
      success: true,
      message: 'Chat room archived successfully.'
    });

  } catch (error) {
    console.error('Error archiving chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateChatPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notifyOnNewMessage, muteNotificationsUntil } = req.body;

    const preferences = await prisma.userChatPreference.upsert({
      where: { userId },
      update: {
        notifyOnNewMessage: notifyOnNewMessage !== undefined ? notifyOnNewMessage : undefined,
        muteNotificationsUntil: muteNotificationsUntil || null
      },
      create: {
        userId,
        notifyOnNewMessage: notifyOnNewMessage !== undefined ? notifyOnNewMessage : true,
        muteNotificationsUntil: muteNotificationsUntil || null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Chat preferences updated successfully.',
      data: preferences
    });

  } catch (error) {
    console.error('Error updating chat preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export default {
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
};