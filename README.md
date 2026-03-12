# HireBridge

A comprehensive microservices-based job recruitment platform connecting job seekers with employers.

## 🚀 Overview

HireBridge is a full-featured hiring platform that streamlines the recruitment process through intelligent matching, automated CV processing, real-time messaging, interview scheduling, and comprehensive analytics.

## ✨ Features

### For Job Seekers
- **Smart Job Matching**: AI-powered job recommendations based on skills and preferences
- **CV Upload & Processing**: Automated CV parsing and profile generation
- **Application Tracking**: Monitor all your job applications in one place
- **Real-time Messaging**: Direct communication with employers
- **Interview Scheduling**: Easy scheduling and management of interviews
- **Saved Jobs**: Bookmark interesting opportunities
- **Career Resources**: Access to career development materials

### For Employers
- **Job Posting Management**: Create and manage job listings
- **Candidate Discovery**: Search and filter qualified candidates
- **Application Management**: Review and process applications efficiently
- **Analytics Dashboard**: Track hiring metrics and performance
- **Smart Matching**: AI-powered candidate recommendations
- **Messaging System**: Direct communication with applicants
- **Company Profile**: Showcase your organization
- **Review & Ratings**: Build your employer brand

### Platform Features
- **Chatbot Assistant**: AI-powered help and guidance
- **Notification System**: Real-time updates via email, SMS, and push notifications
- **Payment & Billing**: Subscription management for premium features
- **Review System**: Candidate and employer ratings
- **Admin Dashboard**: Platform management and monitoring

## 🏗️ Architecture

HireBridge follows a microservices architecture with the following components:

### Frontend
- Static web application served via Nginx
- Responsive design for desktop and mobile
- Separate portals for job seekers and employers

### Backend Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Main entry point, routing, and authentication |
| User Service | 3001 | User authentication and profile management |
| Job Service | 3002 | Job posting and search functionality |
| Matching Service | 3003 | AI-powered job-candidate matching |
| Application Service | 3004 | Application submission and tracking |
| Notification Service | 3005 | Multi-channel notifications (email, SMS, push) |
| CV Processing Service | 3006 | Resume parsing and analysis |
| Chatbot Service | 3007 | AI assistant for platform guidance |
| Messaging Service | 3009 | Real-time chat between users |
| Interview Scheduling Service | 3011 | Calendar and interview management |
| Review & Rating Service | 3013 | User feedback and ratings |
| Payment & Billing Service | 3014 | Subscription and payment processing |
| Analytics Service | 3015 | Data analytics and reporting |
| Admin Service | 3016 | Platform administration |

### Infrastructure
- **MongoDB**: Primary database for all services
- **Redis**: Caching and session management
- **RabbitMQ**: Message queue for inter-service communication
- **Docker**: Containerization and orchestration

## 📋 Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)
- At least 4GB of available RAM
- Ports 3000, 8080, 27017, 6379, 5672, and 15672 available

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd HireBridge1
```

### 2. Environment Configuration

Create `.env` files for each service if needed, or use the default environment variables defined in `docker-compose.yml`.

**Important**: Change the `JWT_SECRET` in production!

### 3. Start the Application

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### 4. Access the Application

- **Frontend**: http://localhost:8080
- **API Gateway**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (default credentials: guest/guest)

### 5. Stop the Application

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## 🛠️ Development

### Running Individual Services

To run a specific service during development:

```bash
# Example: Run only the user service
cd services/user-service
npm install
npm run dev
```

### Service Scripts

Each service includes the following npm scripts:
- `npm start`: Start the service in production mode
- `npm run dev`: Start with hot-reload (if configured)
- `npm test`: Run tests

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f user-service

# View API Gateway logs
docker-compose logs -f api-gateway
```

## 📁 Project Structure

```
HireBridge1/
├── docker-compose.yml          # Container orchestration
├── frontend/                   # Frontend application
│   ├── pages/                  # HTML pages
│   │   ├── employer/          # Employer portal pages
│   │   └── job-seeker/        # Job seeker portal pages
│   ├── public/                # Public pages and assets
│   │   ├── css/               # Stylesheets
│   │   ├── js/                # JavaScript files
│   │   └── assets/            # Images and other assets
│   └── nginx.conf             # Nginx configuration
├── services/                   # Backend microservices
│   ├── api-gateway/           # API Gateway service
│   ├── user-service/          # User management
│   ├── job-service/           # Job management
│   ├── matching-service/      # AI matching
│   ├── application-service/   # Application tracking
│   ├── notification-service/  # Notifications
│   ├── cv-processing-service/ # CV parsing
│   ├── chatbot-service/       # AI chatbot
│   ├── messaging-service/     # Real-time messaging
│   ├── interview-scheduling-service/  # Interview management
│   ├── review-rating-service/ # Reviews and ratings
│   ├── payment-billing-service/  # Payments
│   ├── analytics-service/     # Analytics
│   └── admin-service/         # Admin functions
└── shared/                     # Shared utilities and models
    ├── config/                # Shared configuration
    ├── models/                # Shared data models
    └── utils/                 # Shared utilities
```

## 🔐 Security

- Change all default secrets and passwords before deploying to production
- Use environment variables for sensitive configuration
- Implement rate limiting and input validation
- Keep dependencies updated
- Use HTTPS in production

## 🧪 Testing

```bash
# Run tests for all services
docker-compose exec user-service npm test
docker-compose exec job-service npm test
# ... repeat for other services
```

## 📊 Monitoring

- **RabbitMQ Management UI**: http://localhost:15672
- **Service Health**: Check logs via `docker-compose logs`
- Consider adding monitoring tools like Prometheus and Grafana for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 API Documentation

API documentation for each service can be found in their respective directories. The API Gateway routes all requests to the appropriate microservices.

### Base URLs
- **Development**: http://localhost:3000
- **Frontend**: http://localhost:8080

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🐛 Troubleshooting

### Services won't start
- Ensure all required ports are available
- Check Docker has sufficient resources allocated
- Verify MongoDB, Redis, and RabbitMQ health checks pass

### Database connection errors
- Wait for MongoDB to fully initialize (check health status)
- Verify network connectivity between containers

### Message queue issues
- Check RabbitMQ is running: `docker-compose ps rabbitmq`
- View RabbitMQ management UI for queue status

## 📄 License

[Add your license information here]

## 👥 Team

[Add team information here]

## 📧 Contact

For questions or support, please contact [your-email@example.com]

---

Built with ❤️ using Node.js, MongoDB, Redis, RabbitMQ, and Docker
