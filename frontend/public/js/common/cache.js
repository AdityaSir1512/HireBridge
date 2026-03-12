// Cache manager to prevent API rate limiting
const CacheManager = {
  set(key, data, ttlMinutes = 5) {
    const item = {
      data: data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache storage failed:', e);
    }
  },
  
  get(key) {
    try {
      const item = localStorage.getItem(`cache_${key}`);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - parsed.timestamp > parsed.ttl) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return parsed.data;
    } catch (e) {
      return null;
    }
  },
  
  clear(key) {
    if (key) {
      localStorage.removeItem(`cache_${key}`);
    } else {
      // Clear all cache items
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cache_')) {
          localStorage.removeItem(k);
        }
      });
    }
  },
  
  // Clear cache for specific user
  clearUser(userId) {
    Object.keys(localStorage).forEach(k => {
      if (k.includes(`user_${userId}`) || k.includes(`applications_${userId}`)) {
        localStorage.removeItem(k);
      }
    });
  },
  
  // Clear all data caches (keep settings)
  clearData() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('cache_')) {
        localStorage.removeItem(k);
      }
    });
  }
};

// Fetch with cache wrapper
async function cachedFetch(url, options = {}, cacheKey = null, ttlMinutes = 5) {
  // Generate cache key from URL if not provided
  const key = cacheKey || `fetch_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  // Check cache first
  const cached = CacheManager.get(key);
  if (cached) {
    console.log(`✓ Using cached data for: ${url}`);
    return { ok: true, json: async () => cached, fromCache: true };
  }
  
  // Make the actual request with error handling
  try {
    const response = await fetch(url, options);
    
    // Handle rate limiting with retry
    if (response.status === 429) {
      console.warn('Rate limited. Retrying after delay...');
      const retryAfter = response.headers.get('Retry-After') || 5;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return cachedFetch(url, options, cacheKey, ttlMinutes);
    }
    
    if (response.ok) {
      const data = await response.json();
      // Cache the successful response
      CacheManager.set(key, data, ttlMinutes);
      return { ok: true, json: async () => data, fromCache: false };
    }
    
    return response;
  } catch (error) {
    // If network fails but we have expired cache, use it
    const expiredCache = localStorage.getItem(`cache_${key}`);
    if (expiredCache) {
      console.warn('Using expired cache due to network error');
      const parsed = JSON.parse(expiredCache);
      return { ok: true, json: async () => parsed.data, fromCache: true, expired: true };
    }
    throw error;
  }
}

// Expose globally
window.HB = window.HB || {};
window.HB.cache = CacheManager;
window.HB.cachedFetch = cachedFetch;

console.log('✓ Cache manager loaded');
