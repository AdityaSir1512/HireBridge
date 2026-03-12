# 💬 Real-Time Messaging Service

Complete real-time messaging system for HireBridge with Socket.io integration.

## ✨ Features Implemented

### Backend (Messaging Service)
- ✅ **Real-time Socket.io Integration**
  - Instant message delivery
  - Online/offline status tracking
  - Typing indicators
  - Read receipts
  - Message notifications

- ✅ **Enhanced Data Models**
  - Conversation model with participant details
  - Message model with attachments support
  - Unread count tracking
  - Last message caching

- ✅ **REST API Endpoints**
  - `POST /api/messages/conversations` - Create/get conversation
  - `GET /api/messages/conversations/:userId` - Get user conversations
  - `GET /api/messages/conversation/:conversationId` - Get messages
  - `POST /api/messages/send` - Send message (HTTP fallback)
  - `POST /api/messages/attachment` - Upload file
  - `PUT /api/messages/:messageId/read` - Mark message as read
  - `PUT /api/messages/conversation/:conversationId/read` - Mark all as read
  - `GET /api/messages/unread/:userId` - Get unread count
  - `GET /api/messages/search` - Search messages
  - `DELETE /api/messages/:messageId` - Delete message

- ✅ **Socket.io Events**
  - `user:online` - User comes online
  - `conversation:join` - Join conversation room
  - `message:send` - Send real-time message
  - `message:new` - Receive new message
  - `typing:start/stop` - Typing indicators
  - `message:read` - Read receipt
  - `user:status` - User online/offline status

### Frontend

#### Job Seeker Messages (`/frontend/pages/job-seeker/messages.html`)
- ✅ Full real-time messaging interface
- ✅ Conversation list with unread badges
- ✅ Live message updates
- ✅ Typing indicators
- ✅ Online/offline status
- ✅ File attachments
- ✅ Search conversations
- ✅ Auto-scroll to new messages
- ✅ Mobile responsive

#### Employer Messages (`/frontend/pages/employer/messages.html`)
- ✅ Same features as job seeker version
- ✅ Employer-specific styling
- ✅ Integrated with employer navigation

## 🚀 How to Use

### 1. Start the Services
```bash
cd HireBridge1
docker compose up -d --build messaging-service
```

### 2. Access Messaging
- **Job Seekers**: `/frontend/pages/job-seeker/messages.html`
- **Employers**: `/frontend/pages/employer/messages.html`

### 3. Socket.io Connection
The frontend automatically connects to the messaging service on port 3009:
```javascript
socket = io('http://localhost:3009');
```

## 📡 Socket.io Events Reference

### Client → Server

```javascript
// Connect as user
socket.emit('user:online', userId);

// Join conversation
socket.emit('conversation:join', conversationId);

// Send message
socket.emit('message:send', {
  conversationId,
  senderId,
  recipientId,
  text,
  attachmentUrl
});

// Typing indicators
socket.emit('typing:start', { conversationId, userId });
socket.emit('typing:stop', { conversationId, userId });

// Mark as read
socket.emit('message:read', { messageId, conversationId });
```

### Server → Client

```javascript
// New message received
socket.on('message:new', (message) => {});

// User status changed
socket.on('user:status', ({ userId, status }) => {});

// Someone is typing
socket.on('typing:user', ({ userId, isTyping }) => {});

// Message was read
socket.on('message:read', ({ messageId }) => {});

// Message notification
socket.on('message:notification', (data) => {});
```

## 🔧 Configuration

### Environment Variables
```env
PORT=3009
MONGODB_URI=mongodb://mongodb:27017/hirebridge
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://rabbitmq:5672
USER_SERVICE_URL=http://user-service:3001
FRONTEND_URL=http://localhost:8080
MESSAGE_UPLOAD_DIR=/app/uploads
```

## 📦 Dependencies

### Backend
- `socket.io` - Real-time bidirectional communication
- `axios` - HTTP requests to user service
- `multer` - File upload handling
- `express` - Web framework
- `mongoose` - MongoDB ODM

### Frontend
- Socket.io client (CDN)
- Modern browser with WebSocket support

## 🎯 Features Overview

### ✅ Completed
- Real-time message delivery
- Online/offline presence
- Typing indicators
- Read receipts
- File attachments
- Conversation search
- Unread message counts
- Mobile responsive UI
- Clean, modern interface
- No default conversations (starts empty)

### 🎨 UI/UX Highlights
- Two-panel layout (conversations + chat)
- Gradient message bubbles
- Smooth animations
- Auto-scrolling
- Emoji support
- Time formatting (Just now, 5m ago, etc.)
- Online status indicators
- Unread badges
- File attachment previews

## 📱 Mobile Support
- Responsive grid layout
- Touch-friendly interface
- Mobile-optimized inputs
- Smooth transitions

## 🔐 Security
- JWT authentication required
- User authorization checks
- File type validation
- File size limits (10MB)
- XSS protection via Helmet

## 🧪 Testing

### Test Real-time Messaging
1. Open two browser windows
2. Login as different users (job seeker + employer)
3. Navigate to messages page
4. Start a conversation
5. See real-time updates

### Test Features
- ✅ Send messages
- ✅ Receive instant updates
- ✅ File uploads
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Online status

## 📈 Performance
- Efficient Socket.io rooms
- Redis caching for user data
- Paginated message loading
- Optimized database queries
- Connection pooling

## 🔄 Integration Points
- User Service (for user details)
- Notification Service (RabbitMQ events)
- File Storage (local uploads directory)
- API Gateway (routing)

## 🎉 Ready to Use!
The messaging system is fully functional and ready for production use. No default data is created - users start with a clean slate and can create conversations naturally through the application flow.
