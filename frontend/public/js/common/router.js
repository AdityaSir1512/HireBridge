(function(){
  function navigateTo(url){ window.location.href = url; }
  function setTheme(theme){ 
    document.documentElement.setAttribute('data-theme', theme); 
    localStorage.setItem('hb_theme', theme); 
    updateThemeIcon(theme);
  }
  function updateThemeIcon(theme){
    const icons = document.querySelectorAll('.theme-icon');
    const isDark = theme === 'dark';
    icons.forEach(icon => {
      icon.textContent = isDark ? '☀️' : '🌙';
    });
  }
  function initTheme(){ 
    const t = localStorage.getItem('hb_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); 
    setTheme(t); 
  }
  function toggleTheme(){ 
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; 
    setTheme(current); 
  }
  
  // Notification functions
  function showNotifications(){
    // Use the new notification system if available
    if (window.HB && window.HB.notifications) {
      window.HB.notifications.togglePanel();
    } else {
      alert('Notifications feature - Coming soon!\n\nThis will show:\n• Application status updates\n• New job matches\n• Messages from employers/candidates\n• Interview invitations');
    }
  }
  
  function updateNotificationBadge(count){
    const badge = document.getElementById('notificationBadge');
    if(badge){
      if(count > 0){
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }
  
  function fetchNotificationCount(){
    // Use the new notification system if available
    if (window.HB && window.HB.notifications) {
      window.HB.notifications.fetchUnreadCount();
    }
  }
  
  function logout(){
    // Clear authentication token
    if(window.HB && window.HB.auth){
      window.HB.auth.clearToken();
    }
    // Redirect to landing page
    navigateTo('/frontend/public/index.html');
  }
  
  window.HB = window.HB || {};
  window.HB.navigateTo = navigateTo;
  window.HB.setTheme = setTheme;
  window.HB.toggleTheme = toggleTheme;
  window.HB.showNotifications = showNotifications;
  window.HB.updateNotificationBadge = updateNotificationBadge;
  window.HB.fetchNotificationCount = fetchNotificationCount;
  window.HB.logout = logout;
  window.addEventListener('DOMContentLoaded', initTheme);
})();
