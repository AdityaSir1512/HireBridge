(function(){
  // Prefer same-origin API unless overridden to avoid CORS issues in dev
  const DEFAULT_BASE = (function(){
    if (typeof location !== 'undefined' && /^https?:/i.test(location.origin)){
      // When served via frontend Nginx on :8080 in docker-compose, route directly to gateway to avoid proxy 504s
      if (location.hostname === 'localhost' && location.port === '8080') return 'http://localhost:3000/api';
      return `${location.origin}/api`;
    }
    return 'http://localhost:3000/api';
  })();
  // Allow override but sanitize known-bad values
  const storedBase = (typeof localStorage !== 'undefined' ? localStorage.getItem('hb_api_base') : null) || '';
  const BASE = /localhost:8080\/api/.test(storedBase) ? 'http://localhost:3000/api' : (storedBase || DEFAULT_BASE);
  async function request(path, { method = 'GET', body, headers = {}, timeoutMs = 15000 } = {}){
    const token = HB?.auth?.getToken?.();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal
    });
    } catch (fetchErr) {
      // Network/timeout: try smart fallback between direct gateway and same-origin /api
      const isAbort = fetchErr && fetchErr.name === 'AbortError';
      const primaryError = isAbort ? 'Request timed out' : (fetchErr && fetchErr.message ? fetchErr.message : 'Network error');
      try {
        if (typeof location !== 'undefined') {
          const fallbackBase = `${location.origin}/api`;
          if (BASE !== fallbackBase) {
            const r2 = await fetch(`${fallbackBase}${path}`, {
              method,
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...headers
              },
              body: body ? JSON.stringify(body) : undefined,
              credentials: 'include'
            });
            if (!r2.ok) {
              const ct2 = r2.headers.get('content-type') || '';
              const d2 = ct2.includes('application/json') ? await r2.json() : await r2.text();
              let msg = `HTTP ${r2.status}`;
              if (d2 && typeof d2 === 'object' && d2.message) msg = d2.message;
              const e2 = new Error(msg);
              e2.status = r2.status;
              e2.data = d2;
              throw e2;
            }
            // Persist working base for next time
            try { localStorage.setItem('hb_api_base', fallbackBase); } catch(_){}
            clearTimeout(timeoutId);
            const ctOk = r2.headers.get('content-type') || '';
            return ctOk.includes('application/json') ? await r2.json() : await r2.text();
          }
        }
      } catch (fallbackErr) {
        const error = new Error(primaryError);
        error.status = 0;
        throw error;
      }
      const error = new Error(primaryError);
      error.status = 0;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if(!res.ok){
      let message = `HTTP ${res.status}`;
      if (data) {
        if (typeof data === 'string') message = data;
        if (typeof data === 'object') {
          if (data.message) message = data.message;
          // Express-validator format
          if (!data.message && Array.isArray(data.errors) && data.errors.length) {
            message = data.errors.map(e => e.msg || e.message || `${e.param}: ${e.msg}`).join('\n');
          }
        }
      }
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  const api = {
    register: (payload) => request('/users/register', { method: 'POST', body: payload }),
    login: (payload) => request('/users/login', { method: 'POST', body: payload }),
    logout: () => { HB?.auth?.clearToken?.(); return Promise.resolve(); },
    listJobs: (query='') => request(`/jobs${query}`),
    getJob: (id) => request(`/jobs/${id}`),
    postJob: (payload) => request('/jobs', { method: 'POST', body: payload }),
    applyJob: (payload) => request('/applications', { method: 'POST', body: payload }),
    
    // Notifications
    getNotifications: (params = {}) => {
      const { page = 1, limit = 20, unreadOnly = false, type = '' } = params;
      let query = `?page=${page}&limit=${limit}`;
      if (unreadOnly) query += '&unreadOnly=true';
      if (type) query += `&type=${type}`;
      return request(`/notifications${query}`);
    },
    getUnreadNotificationCount: () => request('/notifications/unread/count'),
    markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
    deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
    clearReadNotifications: () => request('/notifications/clear-read', { method: 'DELETE' }),
    
    // Notification Preferences
    getNotificationPreferences: () => request('/notification-preferences'),
    updateNotificationPreferences: (payload) => request('/notification-preferences', { method: 'PUT', body: payload }),
    updateNotificationTypePreference: (type, payload) => request(`/notification-preferences/${type}`, { method: 'PUT', body: payload }),
    resetNotificationPreferences: () => request('/notification-preferences/reset', { method: 'POST' }),
    
    // Diagnostics
    base: BASE,
    gatewayHealth: async (timeoutMs = 5000) => {
      const origin = BASE.replace(/\/api\/?$/, '');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try{
        const res = await fetch(`${origin}/health`, { signal: controller.signal });
        const ok = res.ok;
        const data = await res.json().catch(()=>({}));
        return { ok, status: res.status, data };
      } catch(err){
        return { ok: false, error: err && err.message ? err.message : 'network' };
      } finally {
        clearTimeout(timer);
      }
    }
  };
  window.HB = window.HB || {};
  window.HB.api = api;
})();
