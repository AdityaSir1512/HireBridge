/**
 * HireBridge Notification System
 * Integrates with the notification-service backend
 */
(function(){
  const NOTIFICATION_TYPES = {
    APPLICATION_CREATED: 'application_created',
    APPLICATION_STATUS: 'application_status_changed',
    MATCH_FOUND: 'match_found',
    INTERVIEW_SCHEDULED: 'interview_scheduled',
    INTERVIEW_REMINDER: 'interview_reminder',
    CV_PROCESSED: 'cv_processed',
    MESSAGE_RECEIVED: 'message_received',
    PAYMENT_PROCESSED: 'payment_processed',
    SUBSCRIPTION_CREATED: 'subscription_created'
  };

  const NOTIFICATION_ICONS = {
    application_created: '📝',
    application_status_changed: '✅',
    match_found: '🎯',
    match_recommendation: '💡',
    interview_scheduled: '📅',
    interview_reminder: '⏰',
    interview_rescheduled: '🔄',
    interview_cancelled: '❌',
    cv_processed: '📄',
    cv_suggestions: '💼',
    message_received: '💬',
    payment_processed: '💳',
    subscription_created: '⭐',
    subscription_cancelled: '🔕',
    job_created: '🆕',
    job_updated: '📢',
    default: '🔔'
  };

  let notificationPanel = null;
  let notifications = [];
  let unreadCount = 0;
  let currentPage = 1;
  let hasMore = true;
  let isLoading = false;

  /**
   * Initialize notification system
   */
  function init(){
    createNotificationPanel();
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    setInterval(fetchUnreadCount, 30000);
    
    // Listen for custom notification events
    window.addEventListener('hb:notification:new', handleNewNotification);
  }

  /**
   * Create notification dropdown panel
   */
  function createNotificationPanel(){
    const panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel hidden';
    panel.innerHTML = `
      <div class="notification-header">
        <h3>Notifications</h3>
        <div class="notification-actions">
          <button class="btn-icon" onclick="HB.notifications.markAllRead()" title="Mark all as read">
            ✓
          </button>
          <button class="btn-icon" onclick="HB.notifications.viewPreferences()" title="Preferences">
            ⚙️
          </button>
        </div>
      </div>
      <div class="notification-list" id="notificationList">
        <div class="notification-loading">
          <div class="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
      <div class="notification-footer">
        <button class="btn-text" onclick="HB.notifications.loadMore()">Load more</button>
      </div>
    `;
    document.body.appendChild(panel);
    notificationPanel = panel;

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !e.target.closest('.notification-bell')) {
        closePanel();
      }
    });
  }

  /**
   * Fetch unread notification count
   */
  async function fetchUnreadCount(){
    try {
      const token = HB?.auth?.getToken?.();
      if (!token) {
        unreadCount = 0;
        updateBadge();
        return;
      }

      const data = await HB.api.getUnreadNotificationCount();
      unreadCount = data.count || 0;
      updateBadge();
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
      // Don't show error to user, just keep badge hidden
      unreadCount = 0;
      updateBadge();
    }
  }

  /**
   * Fetch notifications with pagination
   */
  async function fetchNotifications(page = 1, limit = 20){
    if (isLoading) return;
    
    try {
      isLoading = true;
      
      const token = HB?.auth?.getToken?.();
      if (!token) {
        // User not logged in, show empty state
        notifications = [];
        renderNotifications();
        return;
      }

      const data = await HB.api.getNotifications({ page, limit, unreadOnly: false });
      
      if (page === 1) {
        notifications = data.notifications || [];
      } else {
        notifications = [...notifications, ...(data.notifications || [])];
      }
      
      currentPage = page;
      hasMore = data.pagination?.hasNextPage || false;
      renderNotifications();
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      
      // Show empty state instead of loading forever
      if (page === 1) {
        notifications = [];
      }
      renderNotifications();
      
      // Only show error if it's not an auth issue
      if (error.status !== 401 && error.status !== 403) {
        showError('Failed to load notifications');
      }
    } finally {
      isLoading = false;
    }
  }

  /**
   * Render notifications in the panel
   */
  function renderNotifications(){
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <span style="font-size: 48px;">📭</span>
          <p>No notifications yet</p>
          <small>We'll notify you when something happens</small>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications.map(notif => createNotificationItem(notif)).join('');
  }

  /**
   * Create HTML for a single notification item
   */
  function createNotificationItem(notif){
    const icon = NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS.default;
    const isUnread = !notif.read;
    const timeAgo = formatTimeAgo(new Date(notif.createdAt));
    const priorityClass = notif.priority === 'urgent' ? 'priority-urgent' : 
                         notif.priority === 'high' ? 'priority-high' : '';
    
    return `
      <div class="notification-item ${isUnread ? 'unread' : ''} ${priorityClass}" 
           data-id="${notif._id}"
           onclick="HB.notifications.handleClick('${notif._id}', '${notif.actionUrl || ''}')">
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
          <div class="notification-title">${escapeHtml(notif.title)}</div>
          <div class="notification-message">${escapeHtml(notif.message)}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        ${isUnread ? '<div class="notification-dot"></div>' : ''}
      </div>
    `;
  }

  /**
   * Toggle notification panel visibility
   */
  function togglePanel(){
    if (!notificationPanel) return;

    const isHidden = notificationPanel.classList.contains('hidden');
    if (isHidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  /**
   * Open notification panel
   */
  function openPanel(){
    if (!notificationPanel) return;
    
    notificationPanel.classList.remove('hidden');
    
    // Load notifications if not already loaded
    if (notifications.length === 0) {
      fetchNotifications(1);
    }
  }

  /**
   * Close notification panel
   */
  function closePanel(){
    if (!notificationPanel) return;
    notificationPanel.classList.add('hidden');
  }

  /**
   * Handle notification click
   */
  async function handleClick(notificationId, actionUrl){
    try {
      // Mark as read
      await HB.api.markNotificationRead(notificationId);
      
      // Update local state
      const notif = notifications.find(n => n._id === notificationId);
      if (notif && !notif.read) {
        notif.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
        renderNotifications();
      }

      // Navigate if action URL exists
      if (actionUrl && actionUrl !== 'undefined' && actionUrl !== 'null') {
        closePanel();
        window.location.href = actionUrl;
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async function markAllRead(){
    try {
      await HB.api.markAllNotificationsRead();
      
      // Update local state
      notifications.forEach(n => n.read = true);
      unreadCount = 0;
      updateBadge();
      renderNotifications();
      
      showSuccess('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      showError('Failed to mark all as read');
    }
  }

  /**
   * Load more notifications
   */
  function loadMore(){
    if (!hasMore || isLoading) return;
    fetchNotifications(currentPage + 1);
  }

  /**
   * Update notification badge
   */
  function updateBadge(){
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /**
   * Handle new notification event
   */
  function handleNewNotification(event){
    const notification = event.detail;
    
    // Add to beginning of list
    notifications.unshift(notification);
    
    // Increment unread count
    if (!notification.read) {
      unreadCount++;
      updateBadge();
    }
    
    // Re-render if panel is open
    if (!notificationPanel.classList.contains('hidden')) {
      renderNotifications();
    }
    
    // Show toast notification
    showToast(notification);
  }

  /**
   * Show toast notification
   */
  function showToast(notification){
    // Accept both notification objects and simple objects with title/message
    const title = notification.title || 'Notification';
    const message = notification.message || '';
    const icon = notification.icon || NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /**
   * View notification preferences
   */
  function viewPreferences(){
    closePanel();
    // TODO: Navigate to preferences page when implemented
    alert('Notification Preferences\n\nComing soon! You\'ll be able to:\n• Choose notification channels (email, SMS, push)\n• Set quiet hours\n• Customize per notification type');
  }

  /**
   * Utility: Format time ago
   */
  function formatTimeAgo(date){
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Utility: Escape HTML
   */
  function escapeHtml(text){
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: Show error message
   */
  function showError(message){
    console.error(message);
    // Could integrate with a toast system
  }

  /**
   * Utility: Show success message
   */
  function showSuccess(message){
    console.log(message);
    // Could integrate with a toast system
  }

  // Export notification API
  window.HB = window.HB || {};
  window.HB.notifications = {
    init,
    togglePanel,
    openPanel,
    closePanel,
    handleClick,
    markAllRead,
    loadMore,
    viewPreferences,
    fetchUnreadCount,
    showToast,
    NOTIFICATION_TYPES
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
