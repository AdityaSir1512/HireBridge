# Notification Service

The Notification Service is a comprehensive notification management system for HireBridge that handles in-app notifications, emails, SMS, and push notifications across multiple event types.

## Features

### ✅ Multi-Channel Notifications
- **In-App Notifications**: Real-time browser notifications
- **Email Notifications**: HTML-formatted emails with templates
- **SMS Notifications**: Text message support (stub - ready for Twilio/AWS SNS integration)
- **Push Notifications**: Mobile push notifications (stub - ready for Firebase/OneSignal integration)

### ✅ Notification Types
- Application events (created, status changes)
- Job events (created, updated, matches)
- Interview events (scheduled, reminders, rescheduled, cancelled)
- CV processing events (processed, suggestions)
- Messaging events (new messages)
- Payment events (processed, subscriptions)
- System notifications

### ✅ User Preferences
- Per-notification-type channel preferences
- Global mute option
- Quiet hours configuration
- Granular control over each notification channel

### ✅ Advanced Features
- **Caching**: Redis caching for preferences and notification lists
- **Real-time Delivery**: WebSocket support (stub implementation)
- **Batch Operations**: Create multiple notifications at once
- **Email Templates**: Beautiful HTML email templates
- **Pagination**: Efficient notification listing with pagination
- **Filtering**: Filter notifications by type and read status
- **Priority Levels**: Low, normal, high, and urgent priorities
- **Auto-expiration**: Notifications can have expiry dates
- **Unread Count**: Quick unread notification count endpoint

## API Endpoints

### Notifications

#### Create Notification
```http
POST /api/notifications
Content-Type: application/json

{
  "userId": "user_id",
  "type": "application_created",
  "title": "New Application",
  "message": "You have a new application",
  "meta": {},
  "priority": "normal"
}
```

#### Batch Create Notifications
```http
POST /api/notifications/batch
Content-Type: application/json

{
  "notifications": [
    {
      "userId": "user_id",
      "type": "match_found",
      "title": "New Match",
      "message": "We found a match for you"
    }
  ]
}
```

#### Get User Notifications
```http
GET /api/notifications/:userId?page=1&limit=20&type=application_created&read=false
Authorization: Bearer <token>
```

#### Get Unread Count
```http
GET /api/notifications/:userId/count/unread
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /api/notifications/:notificationId/read
Authorization: Bearer <token>
```

#### Mark All as Read
```http
PUT /api/notifications/:userId/read-all
Authorization: Bearer <token>
```

#### Delete Notification
```http
DELETE /api/notifications/:notificationId
Authorization: Bearer <token>
```

#### Clear Read Notifications
```http
DELETE /api/notifications/:userId/clear-read
Authorization: Bearer <token>
```

### Notification Preferences

#### Get User Preferences
```http
GET /api/notification-preferences/:userId
Authorization: Bearer <token>
```

#### Update Preferences
```http
PUT /api/notification-preferences/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "globalMute": false,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "preferences": {
    "application_created": {
      "inApp": true,
      "email": true,
      "sms": false,
      "push": true
    }
  }
}
```

#### Update Specific Notification Type
```http
PUT /api/notification-preferences/:userId/type/:notificationType
Authorization: Bearer <token>
Content-Type: application/json

{
  "inApp": true,
  "email": true,
  "sms": false,
  "push": false
}
```

#### Reset to Default
```http
POST /api/notification-preferences/:userId/reset
Authorization: Bearer <token>
```

## RabbitMQ Events

The service listens to the following RabbitMQ events:

### Application Events
- `application.created` → Notify employer
- `application.status.changed` → Notify applicant

### Job Events
- `job.created` → Process for matching
- `job.updated` → Notify applicants

### Matching Events
- `match.found` → Notify job seeker
- `recommendation.generated` → Notify job seeker

### CV Events
- `cv.processed` → Notify job seeker
- `cv.suggestions.generated` → Notify job seeker

### Interview Events
- `interview.scheduled` → Notify candidate
- `interview.reminder` → Notify candidate
- `interview.rescheduled` → Notify candidate
- `interview.cancelled` → Notify candidate

### Payment Events
- `payment.processed` → Notify user
- `subscription.created` → Notify user
- `subscription.cancelled` → Notify user

### Messaging Events
- `message.sent` → Notify recipient

## Environment Variables

```env
PORT=3005
DB_URL=mongodb://mongodb:27017/hirebridge_notifications
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://rabbitmq:5672

# Email Configuration (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
EMAIL_FROM=HireBridge <noreply@hirebridge.com>

# External Services
USER_SERVICE_URL=http://user-service:3001
FRONTEND_URL=http://localhost:8080

# JWT
JWT_SECRET=changeme
```

## Notification Model

```javascript
{
  userId: ObjectId,
  type: String (enum),
  title: String,
  message: String,
  meta: Object,
  read: Boolean,
  priority: String (low|normal|high|urgent),
  actionUrl: String,
  actionText: String,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Preference Model

```javascript
{
  userId: ObjectId,
  preferences: {
    [notificationType]: {
      inApp: Boolean,
      email: Boolean,
      sms: Boolean,
      push: Boolean
    }
  },
  globalMute: Boolean,
  quietHoursEnabled: Boolean,
  quietHoursStart: String,
  quietHoursEnd: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Email Templates

The service includes beautiful HTML email templates for all notification types:
- Application notifications
- Job match notifications
- Interview notifications
- CV processing notifications
- Payment notifications
- System notifications

Templates are responsive and include:
- Professional branding
- Call-to-action buttons
- Relevant metadata
- Preference management links

## Caching Strategy

- **Notification Lists**: 5 minutes
- **Unread Count**: 2 minutes
- **User Preferences**: 1 hour

Cache is automatically invalidated when:
- New notifications are created
- Notifications are marked as read
- Preferences are updated

## Future Enhancements

### WebSocket Integration
Currently stubbed. To implement:
```javascript
const io = require('socket.io')(server);
// See src/services/websocket.js for implementation guide
```

### SMS Integration (Twilio)
```javascript
const twilio = require('twilio');
const client = twilio(accountSid, authToken);
```

### Push Notifications (Firebase)
```javascript
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
```

## Testing

### Health Check
```bash
curl http://localhost:3005/health
```

### Create Test Notification
```bash
curl -X POST http://localhost:3005/api/notifications \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "user_id",
    "type": "system",
    "title": "Test Notification",
    "message": "This is a test",
    "priority": "normal"
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 API Gateway                      │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          Notification Service                    │
│                                                  │
│  ┌─────────────┐  ┌──────────────┐             │
│  │   Routes    │  │  Controllers │             │
│  └─────────────┘  └──────────────┘             │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │         Notification Engine             │   │
│  │  • Multi-channel delivery               │   │
│  │  • Preference checking                  │   │
│  │  • Template rendering                   │   │
│  │  • Quiet hours handling                 │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌──────┐  ┌────────┐  ┌────────┐  ┌────────┐│
│  │In-App│  │ Email  │  │  SMS   │  │  Push  ││
│  └──────┘  └────────┘  └────────┘  └────────┘│
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│MongoDB │  │  Redis   │  │ RabbitMQ │
└────────┘  └──────────┘  └──────────┘
```

## License

Part of HireBridge platform - All rights reserved
