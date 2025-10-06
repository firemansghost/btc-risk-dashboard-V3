// Service Worker for Bitcoin Risk Dashboard
// Provides offline support and caching for better performance

const CACHE_NAME = 'btc-risk-dashboard-v2';
const STATIC_CACHE = 'btc-static-v2';
const DYNAMIC_CACHE = 'btc-dynamic-v2';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/methodology',
  '/etf-predictions',
  '/alerts',
  '/data-sources',
  '/disclaimer',
  '/brand',
  '/sats',
  '/xau',
  '/what-is-risk',
  '/strategy-analysis',
  '/alerts/types'
];

// API routes to cache
const API_ROUTES = [
  '/api/config',
  '/api/data/latest',
  '/api/history',
  '/api/health',
  '/api/etf-predictions'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
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
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && 
                     cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE;
            })
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle different types of requests
  if (isStaticFile(request)) {
    event.respondWith(handleStaticFile(request));
  } else if (isAPIRoute(request)) {
    event.respondWith(handleAPIRoute(request));
  } else {
    event.respondWith(handleDynamicRoute(request));
  }
});

// Check if request is for a static file
function isStaticFile(request) {
  const url = new URL(request.url);
  return STATIC_FILES.includes(url.pathname) || 
         url.pathname.endsWith('.js') || 
         url.pathname.endsWith('.css') || 
         url.pathname.endsWith('.png') || 
         url.pathname.endsWith('.svg');
}

// Check if request is for an API route
function isAPIRoute(request) {
  const url = new URL(request.url);
  return API_ROUTES.some(route => url.pathname.startsWith(route));
}

// Handle static files - network first strategy for pages, cache first for assets
async function handleStaticFile(request) {
  const url = new URL(request.url);
  const isPage = url.pathname === '/' || 
                 url.pathname.startsWith('/methodology') || 
                 url.pathname.startsWith('/etf-predictions') || 
                 url.pathname.startsWith('/strategy-analysis') ||
                 url.pathname.startsWith('/alerts') ||
                 url.pathname.startsWith('/data-sources') ||
                 url.pathname.startsWith('/disclaimer') ||
                 url.pathname.startsWith('/brand') ||
                 url.pathname.startsWith('/sats') ||
                 url.pathname.startsWith('/xau') ||
                 url.pathname.startsWith('/what-is-risk');
  
  try {
    // For pages, use network first strategy to ensure fresh content
    if (isPage) {
      try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        }
      } catch (error) {
        console.log('Service Worker: Network failed for page, trying cache');
      }
      
      // Fallback to cache for pages
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    } else {
      // For assets (JS, CSS, images), use cache first strategy
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    }
  } catch (error) {
    console.error('Service Worker: Failed to handle static file', error);
    return new Response('Offline - Static file not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Handle API routes - network first, cache fallback
async function handleAPIRoute(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for API route');
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - API not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Handle dynamic routes - network first, cache fallback
async function handleDynamicRoute(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for dynamic route');
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Bitcoin Risk Dashboard</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #f3f4f6; 
              color: #374151; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              text-align: center; 
              padding: 40px 20px; 
            }
            h1 { color: #1f2937; margin-bottom: 16px; }
            p { color: #6b7280; margin-bottom: 24px; }
            .retry-btn { 
              background: #3b82f6; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 8px; 
              cursor: pointer; 
              font-size: 16px; 
            }
            .retry-btn:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Offline</h1>
            <p>The Bitcoin Risk Dashboard is not available offline. Please check your internet connection and try again.</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  // For example, sync offline data when connection is restored
  console.log('Service Worker: Performing background sync');
}

// Push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'btc-risk-notification',
      requireInteraction: true
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});