// Global error handler for API requests
const ErrorHandler = {
  // Show user-friendly error messages
  show(message, type = 'error', duration = 5000) {
    // Remove any existing error messages
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `error-toast error-${type}`;
    toast.innerHTML = `
      <div class="error-content">
        <span class="error-icon">${this.getIcon(type)}</span>
        <span class="error-message">${message}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },
  
  getIcon(type) {
    const icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅'
    };
    return icons[type] || icons.info;
  },
  
  // Handle specific error types
  handle(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    if (error.status === 429) {
      this.show('Too many requests. Please wait a moment and try again.', 'warning', 7000);
      return;
    }
    
    if (error.status === 401) {
      this.show('Session expired. Please log in again.', 'error');
      setTimeout(() => {
        window.location.href = '/frontend/public/login.html';
      }, 2000);
      return;
    }
    
    if (error.status === 403) {
      this.show('You don\'t have permission to perform this action.', 'error');
      return;
    }
    
    if (error.status === 404) {
      this.show('The requested resource was not found.', 'error');
      return;
    }
    
    if (error.status >= 500) {
      this.show('Server error. Our team has been notified. Please try again later.', 'error');
      return;
    }
    
    if (!navigator.onLine) {
      this.show('No internet connection. Please check your network.', 'warning');
      return;
    }
    
    // Generic error
    this.show(error.message || 'An unexpected error occurred. Please try again.', 'error');
  }
};

// Add CSS for error toast
const style = document.createElement('style');
style.textContent = `
  .error-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    min-width: 300px;
    max-width: 500px;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .error-toast.fade-out {
    animation: slideOut 0.3s ease-in;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  .error-error {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    border-left: 4px solid #dc2626;
    color: #991b1b;
  }
  
  .error-warning {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    border-left: 4px solid #f59e0b;
    color: #92400e;
  }
  
  .error-info {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    border-left: 4px solid #3b82f6;
    color: #1e40af;
  }
  
  .error-success {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    border-left: 4px solid #10b981;
    color: #065f46;
  }
  
  .error-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .error-message {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
  }
  
  .error-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
    color: inherit;
    opacity: 0.6;
  }
  
  .error-close:hover {
    opacity: 1;
    background: rgba(0,0,0,0.1);
  }
`;
document.head.appendChild(style);

// Expose globally
window.HB = window.HB || {};
window.HB.error = ErrorHandler;

console.log('✓ Error handler loaded');
