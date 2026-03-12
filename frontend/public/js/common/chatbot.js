(function() {
  let chatWidget = null;
  let chatHistory = [];
  let isOpen = false;
  let userId = null;
  let userType = null;

  // Initialize chatbot
  function initChatbot() {
    // Get user info if logged in
    const token = window.HB?.auth?.getToken?.();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.userId || payload.id;
        userType = payload.userType;
      } catch (e) {
        console.log('Could not parse token for chatbot');
      }
    }

    createChatWidget();
    loadChatHistory();
  }

  // Create chat widget HTML
  function createChatWidget() {
    const widgetHTML = `
      <div id="chatbot-widget" class="chatbot-widget">
        <!-- Chat Toggle Button -->
        <button id="chat-toggle" class="chat-toggle" title="Need help? Chat with us!">
          <span class="chat-icon">💬</span>
          <span class="chat-notification" id="chat-notification">!</span>
        </button>

        <!-- Chat Window -->
        <div id="chat-window" class="chat-window">
          <div class="chat-header">
            <div class="chat-header-info">
              <div class="chat-avatar">🤖</div>
              <div>
                <div class="chat-title">HireBridge Assistant</div>
                <div class="chat-status">Online • Here to help</div>
              </div>
            </div>
            <div class="chat-controls">
              <button id="chat-minimize" class="chat-btn" title="Minimize">−</button>
              <button id="chat-close" class="chat-btn" title="Close">×</button>
            </div>
          </div>

          <div id="chat-messages" class="chat-messages">
            <div class="message bot-message">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="message-text">Hi! I'm your HireBridge assistant. How can I help you navigate our platform today?</div>
                <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
            </div>
          </div>

          <div class="chat-input-container">
            <div class="quick-suggestions" id="quick-suggestions">
              ${getQuickSuggestions()}
            </div>
            <div class="chat-input-wrapper">
              <input type="text" id="chat-input" class="chat-input" placeholder="Type your question..." maxlength="500">
              <button id="chat-send" class="chat-send" title="Send message">
                <span>➤</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    chatWidget = document.getElementById('chatbot-widget');
    attachEventListeners();
    addChatbotStyles();
  }

  // Get context-appropriate quick suggestions
  function getQuickSuggestions() {
    const suggestions = {
      guest: [
        { text: "How to register?", query: "how do I register" },
        { text: "Job search", query: "how to search for jobs" },
        { text: "About HireBridge", query: "what is HireBridge" }
      ],
      job_seeker: [
        { text: "Upload CV", query: "how to upload my CV" },
        { text: "Find jobs", query: "where can I find jobs" },
        { text: "My applications", query: "where are my applications" },
        { text: "Profile help", query: "how to edit my profile" }
      ],
      employer: [
        { text: "Post a job", query: "how to post a job" },
        { text: "View applications", query: "where are job applications" },
        { text: "Find candidates", query: "how to find candidates" },
        { text: "Company profile", query: "edit company profile" }
      ]
    };

    const currentSuggestions = suggestions[userType] || suggestions.guest;
    return currentSuggestions.map(s => 
      `<button class="suggestion-btn" data-query="${s.query}">${s.text}</button>`
    ).join('');
  }

  // Attach event listeners
  function attachEventListeners() {
    const toggle = document.getElementById('chat-toggle');
    const minimize = document.getElementById('chat-minimize'); 
    const close = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const suggestions = document.getElementById('quick-suggestions');

    toggle.addEventListener('click', toggleChat);
    minimize.addEventListener('click', minimizeChat);
    close.addEventListener('click', closeChat);
    send.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Quick suggestion clicks
    suggestions.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        const query = e.target.getAttribute('data-query');
        input.value = query;
        sendMessage();
      }
    });

    // Auto-focus input when chat opens
    input.addEventListener('focus', () => {
      document.getElementById('chat-notification').style.display = 'none';
    });
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const window = document.getElementById('chat-window');
    const toggle = document.getElementById('chat-toggle');
    
    if (isOpen) {
      window.classList.add('open');
      toggle.classList.add('active');
      document.getElementById('chat-input').focus();
      document.getElementById('chat-notification').style.display = 'none';
    } else {
      window.classList.remove('open');
      toggle.classList.remove('active');
    }
  }

  function minimizeChat() {
    isOpen = false;
    document.getElementById('chat-window').classList.remove('open');
    document.getElementById('chat-toggle').classList.remove('active');
  }

  function closeChat() {
    minimizeChat();
  }

  // Send message to chatbot
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    try {
      // Call chatbot API
      const response = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(window.HB?.auth?.getToken?.() ? { 'Authorization': `Bearer ${window.HB.auth.getToken()}` } : {})
        },
        body: JSON.stringify({
          message: message,
          userId: userId || 'guest',
          userType: userType || 'guest'
        })
      });

      hideTypingIndicator();

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.reply) {
          addMessage(data.reply.text, 'bot', data.reply.link);
        } else {
          // Fallback response if API doesn't return expected format
          const fallbackResponse = getFallbackResponse(message, userType);
          addMessage(fallbackResponse.text, 'bot', fallbackResponse.link);
        }
      } else {
        // API returned error status
        const fallbackResponse = getFallbackResponse(message, userType);
        addMessage(fallbackResponse.text, 'bot', fallbackResponse.link);
      }
    } catch (error) {
      console.log('Chatbot API error:', error);
      hideTypingIndicator();
      // Provide offline fallback response
      const fallbackResponse = getFallbackResponse(message, userType);
      addMessage(fallbackResponse.text, 'bot', fallbackResponse.link);
    }
  }

  // Add message to chat
  function addMessage(text, sender, link = null) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const messageHTML = `
      <div class="message ${sender}-message">
        <div class="message-avatar">${sender === 'bot' ? '🤖' : '👤'}</div>
        <div class="message-content">
          <div class="message-text">${text}</div>
          ${link ? `<div class="message-action"><a href="${link}" class="action-link">Go there →</a></div>` : ''}
          <div class="message-time">${messageTime}</div>
        </div>
      </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update chat history
    chatHistory.push({ text, sender, time: messageTime, link });
  }

  // Show typing indicator
  function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingHTML = `
      <div id="typing-indicator" class="message bot-message typing">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  // Fallback responses when API is unavailable
  function getFallbackResponse(message, userType) {
    const text = message.toLowerCase();
    
    // Basic pattern matching for offline responses
    if (/(register|sign up)/.test(text)) {
      return { text: "You can register by clicking the 'Register' link in the top navigation or going to the register page.", link: '/frontend/public/register.html' };
    }
    if (/(login|sign in)/.test(text)) {
      return { text: "You can login by clicking the 'Login' link in the top navigation.", link: '/frontend/public/login.html' };
    }
    if (/(job|work|position)/.test(text)) {
      if (userType === 'job_seeker') {
        return { text: "You can browse jobs on the Jobs page.", link: '/frontend/pages/job-seeker/jobs.html' };
      } else if (userType === 'employer') {
        return { text: "You can post jobs on the Post Job page.", link: '/frontend/pages/employer/post-job.html' };
      } else {
        return { text: "You can browse available jobs on our platform. Please register to apply!", link: '/frontend/public/register.html' };
      }
    }
    if (/(profile|cv|resume)/.test(text)) {
      if (userType === 'job_seeker') {
        return { text: "You can manage your profile and upload your CV on the Profile page.", link: '/frontend/pages/job-seeker/profile.html' };
      } else if (userType === 'employer') {
        return { text: "You can manage your company profile here.", link: '/frontend/pages/employer/company-profile.html' };
      } else {
        return { text: "Please register and login to create your profile.", link: '/frontend/public/register.html' };
      }
    }
    if (/(application|apply)/.test(text)) {
      if (userType === 'job_seeker') {
        return { text: "You can track your applications on the Applications page.", link: '/frontend/pages/job-seeker/applications.html' };
      } else if (userType === 'employer') {
        return { text: "You can view applications on the Applications page.", link: '/frontend/pages/employer/applications.html' };
      } else {
        return { text: "Please register as a job seeker to apply for jobs.", link: '/frontend/public/register.html' };
      }
    }
    if (/(dashboard|home)/.test(text)) {
      if (userType === 'job_seeker') {
        return { text: "Your dashboard shows job recommendations and activity.", link: '/frontend/pages/job-seeker/dashboard.html' };
      } else if (userType === 'employer') {
        return { text: "Your dashboard shows hiring analytics and activity.", link: '/frontend/pages/employer/dashboard.html' };
      } else {
        return { text: "Welcome to HireBridge! Please login to access your dashboard.", link: '/frontend/public/login.html' };
      }
    }
    
    // Default responses by user type
    if (userType === 'guest') {
      return { text: "I'm here to help you navigate HireBridge! You can register to get started, browse jobs, or learn more about our platform.", link: '/frontend/public/register.html' };
    } else if (userType === 'job_seeker') {
      return { text: "I can help you with job searching, profile management, applications, and more. What would you like help with?", link: '/frontend/pages/job-seeker/dashboard.html' };
    } else if (userType === 'employer') {
      return { text: "I can help you with posting jobs, viewing applications, finding candidates, and managing your company profile.", link: '/frontend/pages/employer/dashboard.html' };
    }
    
    return { text: "How can I help you navigate HireBridge today?", link: null };
  }

  // Load chat history
  async function loadChatHistory() {
    if (!userId) return;

    try {
      const response = await fetch(`/api/chatbot/history/${userId}`, {
        headers: {
          ...(window.HB?.auth?.getToken?.() ? { 'Authorization': `Bearer ${window.HB.auth.getToken()}` } : {})
        }
      });
      const data = await response.json();
      
      if (data.success && data.history.length > 0) {
        // Load last few messages
        const recentHistory = data.history.slice(-6);
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = ''; // Clear welcome message
        
        recentHistory.forEach(msg => {
          addMessage(msg.message, msg.role, msg.link);
        });
      }
    } catch (error) {
      console.log('Could not load chat history');
    }
  }

  // Add chatbot styles
  function addChatbotStyles() {
    if (document.getElementById('chatbot-styles')) return;

    const styles = `
      <style id="chatbot-styles">
        .chatbot-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chat-toggle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
          position: relative;
          color: white;
          font-size: 24px;
        }

        .chat-toggle:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(0,0,0,0.2);
        }

        .chat-toggle.active {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .chat-notification {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff4757;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .chat-window {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 350px;
          height: 450px;
          background: var(--surface-color, #ffffff);
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          border: 1px solid var(--border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          transform: translateY(20px) scale(0.95);
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }

        .chat-window.open {
          transform: translateY(0) scale(1);
          opacity: 1;
          visibility: visible;
        }

        .chat-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          font-size: 20px;
        }

        .chat-title {
          font-weight: 600;
          font-size: 14px;
        }

        .chat-status {
          font-size: 12px;
          opacity: 0.9;
        }

        .chat-controls {
          display: flex;
          gap: 8px;
        }

        .chat-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: background 0.2s ease;
        }

        .chat-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          scroll-behavior: smooth;
        }

        .message {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .message-avatar {
          font-size: 16px;
          flex-shrink: 0;
        }

        .message-content {
          flex: 1;
        }

        .message-text {
          background: var(--background-color, #f3f4f6);
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
          color: var(--text-color, #374151);
        }

        .bot-message .message-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .user-message {
          flex-direction: row-reverse;
        }

        .user-message .message-text {
          background: var(--primary-color, #3b82f6);
          color: white;
        }

        .message-time {
          font-size: 11px;
          color: var(--text-secondary, #6b7280);
          margin-top: 4px;
        }

        .message-action {
          margin-top: 8px;
        }

        .action-link {
          color: #fbbf24;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
        }

        .action-link:hover {
          text-decoration: underline;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
          background: var(--background-color, #f3f4f6);
          border-radius: 12px;
          width: fit-content;
        }

        .typing-dots span {
          width: 6px;
          height: 6px;
          background: var(--text-secondary, #6b7280);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }

        .chat-input-container {
          border-top: 1px solid var(--border-color, #e5e7eb);
        }

        .quick-suggestions {
          padding: 12px 16px 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .suggestion-btn {
          background: var(--background-color, #f3f4f6);
          border: 1px solid var(--border-color, #e5e7eb);
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-color, #374151);
        }

        .suggestion-btn:hover {
          background: var(--primary-color, #3b82f6);
          color: white;
          border-color: var(--primary-color, #3b82f6);
        }

        .chat-input-wrapper {
          padding: 16px;
          display: flex;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 14px;
          outline: none;
          background: var(--background-color, #ffffff);
          color: var(--text-color, #374151);
        }

        .chat-input:focus {
          border-color: var(--primary-color, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .chat-send {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .chat-send:hover {
          transform: scale(1.1);
        }

        .chat-send:active {
          transform: scale(0.95);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .chatbot-widget {
            bottom: 10px;
            right: 10px;
          }
          
          .chat-window {
            width: calc(100vw - 40px);
            height: 400px;
            right: -10px;
          }
        }

        /* Dark theme support */
        [data-theme="dark"] .chat-window {
          background: var(--surface-color);
          border-color: var(--border-color);
        }

        [data-theme="dark"] .message-text {
          background: var(--background-color);
          color: var(--text-color);
        }

        [data-theme="dark"] .chat-input {
          background: var(--background-color);
          color: var(--text-color);
          border-color: var(--border-color);
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Public API
  window.HB = window.HB || {};
  window.HB.chatbot = {
    init: initChatbot,
    toggle: toggleChat,
    open: () => { if (!isOpen) toggleChat(); },
    close: closeChat
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }

  // Show notification for new visitors
  setTimeout(() => {
    if (!userId && !localStorage.getItem('chatbot_greeted')) {
      document.getElementById('chat-notification').style.display = 'flex';
      localStorage.setItem('chatbot_greeted', 'true');
    }
  }, 3000);

})();