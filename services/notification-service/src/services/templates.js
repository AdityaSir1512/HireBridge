/**
 * Email Templates for Notifications
 */

const baseStyle = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .button:hover { background: #7c3aed; }
    h1 { margin: 0; font-size: 24px; }
    p { margin: 16px 0; }
  </style>
`;

function getBaseTemplate(title, content, actionUrl = '', actionText = '') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyle}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌉 HireBridge</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          ${content}
          ${actionUrl ? `<a href="${actionUrl}" class="button">${actionText || 'View Details'}</a>` : ''}
        </div>
        <div class="footer">
          <p>© 2025 HireBridge - Bridging Talent with Opportunity</p>
          <p>You're receiving this because you have an account with HireBridge.</p>
          <p><a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings/notifications" style="color: #8b5cf6;">Manage Notification Preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const templates = {
  application_created: (data) => ({
    subject: 'New Application Received',
    html: getBaseTemplate(
      'New Application Received',
      `<p>Great news! You've received a new application for your job posting.</p>
       <p><strong>Job:</strong> ${data.jobTitle || 'Your job posting'}</p>
       <p><strong>Applicant:</strong> ${data.applicantName || 'A candidate'}</p>
       <p>Review their profile and CV to see if they're a good fit.</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/employer/applications`,
      'View Application'
    )
  }),

  application_status: (data) => ({
    subject: `Application Status: ${data.status || 'Updated'}`,
    html: getBaseTemplate(
      'Application Status Updated',
      `<p>Your application status has been updated.</p>
       <p><strong>Job:</strong> ${data.jobTitle || 'Job posting'}</p>
       <p><strong>New Status:</strong> ${data.status || 'Updated'}</p>
       ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/applications`,
      'View Application'
    )
  }),

  match_found: (data) => ({
    subject: 'New Job Match Found!',
    html: getBaseTemplate(
      'We Found a Job Match for You!',
      `<p>Good news! We've found a job that matches your skills and preferences.</p>
       <p><strong>Job:</strong> ${data.jobTitle || 'Great opportunity'}</p>
       <p><strong>Company:</strong> ${data.companyName || 'Top employer'}</p>
       <p><strong>Match Score:</strong> ${data.matchScore || 'High'}%</p>
       <p>Apply now before spots fill up!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/jobs/${data.jobId || ''}`,
      'View Job'
    )
  }),

  interview_scheduled: (data) => ({
    subject: 'Interview Scheduled',
    html: getBaseTemplate(
      'Your Interview Has Been Scheduled',
      `<p>Great news! Your interview has been scheduled.</p>
       <p><strong>Job:</strong> ${data.jobTitle || 'Position'}</p>
       <p><strong>Company:</strong> ${data.companyName || 'Employer'}</p>
       <p><strong>Date & Time:</strong> ${data.startTime || 'TBD'}</p>
       <p><strong>Type:</strong> ${data.type || 'Video call'}</p>
       ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
       ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
       <p>Make sure to prepare and be ready on time. Good luck!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/interviews`,
      'View Interview Details'
    )
  }),

  interview_reminder: (data) => ({
    subject: '⏰ Interview Reminder',
    html: getBaseTemplate(
      'Interview Reminder',
      `<p>This is a reminder about your upcoming interview.</p>
       <p><strong>Job:</strong> ${data.jobTitle || 'Position'}</p>
       <p><strong>Date & Time:</strong> ${data.startTime || 'Soon'}</p>
       <p><strong>Type:</strong> ${data.type || 'Video call'}</p>
       ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
       <p>Make sure you're prepared and join on time. Good luck!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/interviews`,
      'View Interview Details'
    )
  }),

  cv_processed: (data) => ({
    subject: 'Your CV Has Been Processed',
    html: getBaseTemplate(
      'CV Processed Successfully',
      `<p>Great! Your CV has been analyzed and processed.</p>
       <p>We've extracted your skills, experience, and qualifications to help match you with the best opportunities.</p>
       <p><strong>Skills Found:</strong> ${data.skillsCount || 'Several'} skills</p>
       <p><strong>Experience:</strong> ${data.experienceYears || 'Multiple'} positions</p>
       <p>Check out your profile to see the details.</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/profile`,
      'View Profile'
    )
  }),

  cv_suggestions: (data) => ({
    subject: `${data.count || 'New'} Job Suggestions Based on Your CV`,
    html: getBaseTemplate(
      'Job Suggestions Ready!',
      `<p>Based on your CV analysis, we've found ${data.count || 'several'} jobs that match your skills and experience.</p>
       <p>These opportunities align well with your background and could be a great fit for you.</p>
       <p>Don't miss out - apply today!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/job-seeker/jobs?recommended=true`,
      'View Suggestions'
    )
  }),

  payment_processed: (data) => ({
    subject: 'Payment Confirmation',
    html: getBaseTemplate(
      'Payment Successful',
      `<p>Your payment has been processed successfully.</p>
       <p><strong>Amount:</strong> ${data.currency || '$'}${data.amount || '0.00'}</p>
       <p><strong>Payment Method:</strong> ${data.paymentMethod || 'Card'}</p>
       <p><strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}</p>
       <p>Thank you for your payment!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings/billing`,
      'View Receipt'
    )
  }),

  subscription_created: (data) => ({
    subject: `Welcome to ${data.plan || 'Premium'}!`,
    html: getBaseTemplate(
      'Subscription Activated',
      `<p>Welcome to HireBridge ${data.plan || 'Premium'}!</p>
       <p>Your subscription is now active and you have access to all premium features.</p>
       <p><strong>Plan:</strong> ${data.plan || 'Premium'}</p>
       <p><strong>Billing Cycle:</strong> ${data.billingCycle || 'Monthly'}</p>
       <p>Enjoy your enhanced experience!</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings/billing`,
      'Manage Subscription'
    )
  }),

  message_received: (data) => ({
    subject: `New message from ${data.senderName || 'a user'}`,
    html: getBaseTemplate(
      'New Message',
      `<p>You have a new message from ${data.senderName || 'a user'}.</p>
       ${data.preview ? `<p><em>"${data.preview}"</em></p>` : ''}
       <p>Reply to continue the conversation.</p>`,
      `${process.env.FRONTEND_URL || 'http://localhost:8080'}/messages/${data.conversationId || ''}`,
      'View Message'
    )
  }),

  system: (data) => ({
    subject: data.subject || 'System Notification',
    html: getBaseTemplate(
      data.title || 'System Notification',
      `<p>${data.message || 'You have a system notification.'}</p>
       ${data.details ? `<p>${data.details}</p>` : ''}`,
      data.actionUrl || '',
      data.actionText || 'View Details'
    )
  })
};

function getEmailTemplate(type, data = {}) {
  const template = templates[type];
  if (!template) {
    return templates.system(data);
  }
  return template(data);
}

module.exports = {
  getEmailTemplate,
  templates
};
