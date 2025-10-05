// Service Worker for BTC Risk Dashboard
// Version: 1.0.0
// Caching strategies for different content types

const CACHE_NAME = 'btc-risk-dashboard-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';
const API_CACHE = 'api-v1.0.0';

// Cache strategies
const CACHE_STRATEGIES = {
  // Static assets (JS, CSS, images) - Cache First
  static: {
    strategy: 'cacheFirst',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 100
  },
  // API data - Network First with fallback
  api: {
    strategy: 'networkFirst',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50
  },
  // HTML pages - Stale While Revalidate
  pages: {
    strategy: 'staleWhileRevalidate',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 20
  }
};

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/methodology',
  '/etf-predictions',
  '/manifest.json',
  '/favicon.ico',
  '/og-default.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine cache strategy based on request type
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isPageRequest(request)) {
    event.respondWith(handlePageRequest(request));
  } else {
    event.respondWith(handleDefaultRequest(request));
  }
});

// Helper functions to determine request types
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         url.pathname.startsWith('/data/') ||
         url.pathname.includes('latest.json') ||
         url.pathname.includes('historical');
}

function isPageRequest(request) {
  const url = new URL(request.url);
  return url.pathname === '/' || 
         url.pathname.startsWith('/methodology') ||
         url.pathname.startsWith('/etf-predictions') ||
         url.pathname.startsWith('/alerts');
}

// Cache First strategy for static assets
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving static asset from cache', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Error handling static asset', error);
    return new Response('Offline - Static asset not available', { status: 503 });
  }
}

// Network First strategy for API requests
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for API request', request.url);
    
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving API data from cache', request.url);
      return cachedResponse;
    }
    
    // Return offline fallback for API requests
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'Data not available offline',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate strategy for pages
async function handlePageRequest(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Fetch fresh content in background
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => {
      // Network failed, will use cached version if available
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
      console.log('Service Worker: Serving page from cache', request.url);
      return cachedResponse;
    }
    
    // Wait for network if no cached version
    return await fetchPromise;
  } catch (error) {
    console.error('Service Worker: Error handling page request', error);
    return new Response('Offline - Page not available', { status: 503 });
  }
}

// Default strategy for other requests
async function handleDefaultRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Error handling default request', error);
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

// Background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Attempt to fetch latest data
    const response = await fetch('/data/latest.json');
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put('/data/latest.json', response);
      console.log('Service Worker: Background sync completed');
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(clearAllCaches());
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('Service Worker: All caches cleared');
}
