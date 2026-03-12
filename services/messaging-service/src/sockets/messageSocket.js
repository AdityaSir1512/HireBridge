const Message = require('../models/Message.model');
const Conversation = require('../models/Conversation.model');
const { publishEvent } = require('../config/rabbitmq');

// Store online users: userId -> socketId
const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    // User joins with their userId
    socket.on('user:online', (userId) => {
      if (userId) {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        socket.join(`user:${userId}`);
        
        // Broadcast to all that this user is online
        socket.broadcast.emit('user:status', { userId, status: 'online' });
        
        console.log(`User ${userId} is online (${onlineUsers.size} users total)`);
      }
    });

    // Join a conversation room
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Send a message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, senderId, recipientId, text, attachmentUrl } = data;

        // Create message in database
        const message = await Message.create({
          conversationId,
          senderId,
          recipientId,
          text: text || '',
          attachmentUrl: attachmentUrl || ''
        });

        // Update conversation last message time
        await Conversation.findByIdAndUpdate(conversationId, { 
          lastMessageAt: new Date() 
        });

        // Populate sender info (simplified - in production, fetch from user service)
        const messageData = message.toObject();

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('message:new', messageData);
        
        // Also emit directly to recipient if they're online
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('message:notification', {
            conversationId,
            senderId,
            text: text?.substring(0, 100) || 'Sent an attachment',
            timestamp: message.createdAt
          });
        }

        // Publish event
        await publishEvent('message.sent', {
          conversationId,
          messageId: message._id,
          senderId,
          recipientId
        });

        // Send confirmation back to sender
        socket.emit('message:sent', { 
          tempId: data.tempId, 
          message: messageData 
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message:error', { 
          tempId: data.tempId,
          error: 'Failed to send message' 
        });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data) => {
      const { conversationId, userId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user', { 
        userId, 
        isTyping: true 
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId, userId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user', { 
        userId, 
        isTyping: false 
      });
    });

    // Mark message as read
    socket.on('message:read', async (data) => {
      try {
        const { messageId, conversationId } = data;
        
        await Message.findByIdAndUpdate(messageId, { read: true });
        
        // Notify sender that message was read
        io.to(`conversation:${conversationId}`).emit('message:read', { messageId });

      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Mark all messages in conversation as read
    socket.on('conversation:read', async (data) => {
      try {
        const { conversationId, userId } = data;
        
        await Message.updateMany(
          { conversationId, recipientId: userId, read: false },
          { read: true }
        );
        
        io.to(`conversation:${conversationId}`).emit('conversation:read', { 
          conversationId, 
          userId 
        });

      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        
        // Broadcast to all that this user is offline
        socket.broadcast.emit('user:status', { 
          userId: socket.userId, 
          status: 'offline' 
        });
        
        console.log(`User ${socket.userId} disconnected (${onlineUsers.size} users remaining)`);
      }
      console.log('Socket disconnected:', socket.id);
    });

    // Get online status of a user
    socket.on('user:check-status', (userId) => {
      const isOnline = onlineUsers.has(userId);
      socket.emit('user:status', { userId, status: isOnline ? 'online' : 'offline' });
    });
  });

  // Expose function to get online users
  io.getOnlineUsers = () => Array.from(onlineUsers.keys());
};
