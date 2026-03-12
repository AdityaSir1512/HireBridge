function detectIntent(message) {
  const text = String(message || '').toLowerCase();
  
  // Authentication related
  if (/(register|sign up|create account)/.test(text)) return 'register';
  if (/(login|sign in|log in)/.test(text)) return 'login';
  if (/(logout|sign out|log out)/.test(text)) return 'logout';
  
  // Job seeker specific
  if (/(upload|add).*(cv|resume)/.test(text)) return 'upload_cv';
  if (/(find|search|browse|look).*(job|work|position)/.test(text)) return 'job_search';
  if (/(my |check |view ).*(application|apply)/.test(text)) return 'applications';
  if (/(save|bookmark).*(job)/.test(text)) return 'saved_jobs';
  if (/(profile|edit.*profile|update.*profile)/.test(text)) return 'profile_page';
  
  // Employer specific
  if (/(post|create|add).*(job|position)/.test(text)) return 'post_job';
  if (/(manage|edit).*(job|posting)/.test(text)) return 'manage_jobs';
  if (/(view|check|see).*(application|candidate)/.test(text)) return 'view_applications';
  if (/(find|search).*(candidate|talent|people)/.test(text)) return 'find_candidates';
  if (/(company|business).*(profile|page)/.test(text)) return 'company_profile';
  
  // General navigation
  if (/(dashboard|home|main)/.test(text)) return 'dashboard';
  if (/(setting|preference|account)/.test(text)) return 'settings';
  if (/(theme|dark|light|color)/.test(text)) return 'theme';
  
  // Platform info
  if (/(what|about|explain).*(hirebridge|platform|website)/.test(text)) return 'about_platform';
  if (/(how.*work|how.*use|tutorial|guide)/.test(text)) return 'how_to_use';
  if (/(feature|what.*can|capabilities)/.test(text)) return 'features';
  
  // Support
  if (/(help|support|stuck|problem|issue)/.test(text)) return 'help';
  if (/(contact|email|phone|reach)/.test(text)) return 'contact';
  
  return 'smalltalk';
}

function buildResponse(intent, userType = 'guest') {
  const isGuest = userType === 'guest';
  const baseUrl = '/frontend/pages';
  
  // Authentication responses for guests
  const guestResponses = {
    register: { text: 'Ready to join HireBridge? Click here to create your account!', link: '/frontend/public/register.html' },
    login: { text: 'Welcome back! Click here to sign in to your account.', link: '/frontend/public/login.html' },
    job_search: { text: 'You can browse jobs without an account, but sign up to apply!', link: '/frontend/public/index.html' },
    about_platform: { text: 'HireBridge connects talented job seekers with great employers. Learn more about us!', link: '/frontend/public/about-us.html' },
    how_to_use: { text: 'New here? Let me show you around! Start by exploring our features.', link: '/frontend/public/index.html' },
    features: { text: 'HireBridge offers job matching, CV analysis, messaging, and more! Sign up to access all features.', link: '/frontend/public/register.html' }
  };
  
  // Job seeker responses
  const jobSeekerResponses = {
    upload_cv: { text: 'Upload your CV in Profile → CV Upload section to get personalized job matches!', link: `${baseUrl}/job-seeker/profile.html` },
    profile_page: { text: 'Manage your profile, skills, and experience here.', link: `${baseUrl}/job-seeker/profile.html` },
    job_search: { text: 'Browse and filter jobs based on your preferences here.', link: `${baseUrl}/job-seeker/jobs.html` },
    applications: { text: 'Track all your job applications and their status here.', link: `${baseUrl}/job-seeker/applications.html` },
    saved_jobs: { text: 'View and manage your saved jobs here.', link: `${baseUrl}/job-seeker/saved.html` },
    dashboard: { text: 'Your personal dashboard with recommendations and stats.', link: `${baseUrl}/job-seeker/dashboard.html` },
    settings: { text: 'Update your account preferences and settings here.', link: `${baseUrl}/job-seeker/settings.html` }
  };
  
  // Employer responses
  const employerResponses = {
    post_job: { text: 'Create and publish new job postings here.', link: `${baseUrl}/employer/post-job.html` },
    manage_jobs: { text: 'Edit and manage your existing job postings.', link: `${baseUrl}/employer/manage-jobs.html` },
    view_applications: { text: 'Review applications from candidates here.', link: `${baseUrl}/employer/applications.html` },
    find_candidates: { text: 'Search and discover talented candidates here.', link: `${baseUrl}/employer/candidates.html` },
    company_profile: { text: 'Manage your company profile and branding.', link: `${baseUrl}/employer/company-profile.html` },
    dashboard: { text: 'Your employer dashboard with analytics and insights.', link: `${baseUrl}/employer/dashboard.html` },
    settings: { text: 'Update your company account settings here.', link: `${baseUrl}/employer/settings.html` }
  };
  
  // Common responses for all users
  const commonResponses = {
    logout: { text: 'You can logout using the logout button in the top navigation bar.', link: null },
    theme: { text: 'Toggle between dark and light theme using the theme button (🌙/☀️) in the navigation.', link: null },
    contact: { text: 'Need more help? You can reach our support team through the contact form.', link: '/frontend/public/about-us.html' },
    help: { text: isGuest ? 'I can help you navigate HireBridge! Try asking about registration, features, or how to get started.' : 'I can help you navigate the platform! Ask me about any feature or page you need.', link: null },
    smalltalk: { text: isGuest ? 'Hi! I\'m here to help you explore HireBridge. Are you looking to find jobs or hire talent?' : 'How can I assist you today? I can help you navigate to any part of the platform.', link: null }
  };
  
  // Route-specific responses based on user type
  let responses = commonResponses;
  if (isGuest) {
    responses = { ...commonResponses, ...guestResponses };
  } else if (userType === 'job_seeker') {
    responses = { ...commonResponses, ...jobSeekerResponses };
  } else if (userType === 'employer') {
    responses = { ...commonResponses, ...employerResponses };
  }
  
  return responses[intent] || commonResponses.smalltalk;
}

module.exports = { detectIntent, buildResponse };
