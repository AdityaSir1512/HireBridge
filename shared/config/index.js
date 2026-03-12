// Shared configuration constants

const SERVICES = Object.freeze({
  API_GATEWAY: 'api-gateway',
  USER: 'user-service',
  JOB: 'job-service',
  MATCHING: 'matching-service',
  APPLICATION: 'application-service',
  NOTIFICATION: 'notification-service',
  CV: 'cv-processing-service',
  CHATBOT: 'chatbot-service',
  MESSAGING: 'messaging-service',
  INTERVIEW: 'interview-scheduling-service',
  REVIEW: 'review-rating-service',
  PAYMENT: 'payment-billing-service',
  ANALYTICS: 'analytics-service',
  ADMIN: 'admin-service'
});

const EXCHANGES = Object.freeze({
  USER: 'user_events',
  JOB: 'job_events',
  APPLICATION: 'application_events',
  MATCHING: 'matching_events',
  CV: 'cv_events',
  CHATBOT: 'chatbot_events',
  MESSAGING: 'messaging_events',
  INTERVIEW: 'interview_events',
  PAYMENT: 'payment_events',
  REVIEW: 'review_events',
  ADMIN: 'admin_events'
});

const ROUTES = Object.freeze({
  USERS: '/api/users',
  JOBS: '/api/jobs',
  MATCHING: '/api/matching',
  APPLICATIONS: '/api/applications',
  NOTIFICATIONS: '/api/notifications',
  CV: '/api/cv',
  CHATBOT: '/api/chatbot',
  MESSAGING: '/api/messages',
  INTERVIEWS: '/api/interviews',
  REVIEWS: '/api/reviews',
  PAYMENTS: '/api/payments',
  ANALYTICS: '/api/analytics',
  ADMIN: '/api/admin'
});

module.exports = { SERVICES, EXCHANGES, ROUTES };
