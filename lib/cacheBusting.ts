// Cache busting utilities for ensuring fresh content
// This helps prevent caching issues where old versions of pages are served

export const CACHE_BUST_VERSION = 'v2.0.0';

// Generate a cache-busting timestamp
export function getCacheBustTimestamp(): string {
  return Date.now().toString();
}

// Generate a cache-busting query parameter
export function getCacheBustQuery(): string {
  return `?v=${CACHE_BUST_VERSION}&t=${getCacheBustTimestamp()}`;
}

// Add cache-busting to a URL
export function addCacheBusting(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${CACHE_BUST_VERSION}&t=${getCacheBustTimestamp()}`;
}

// Force a hard refresh of the current page
export function forceHardRefresh(): void {
  if (typeof window !== 'undefined') {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    // Force reload with cache bypass
    window.location.reload();
  }
}

// Check if we need to force a refresh based on stored version
export function checkAndForceRefresh(): void {
  if (typeof window !== 'undefined') {
    const storedVersion = localStorage.getItem('app-version');
    
    if (storedVersion !== CACHE_BUST_VERSION) {
      localStorage.setItem('app-version', CACHE_BUST_VERSION);
      forceHardRefresh();
    }
  }
}

// Clear all browser storage
export function clearAllStorage(): void {
  if (typeof window !== 'undefined') {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear IndexedDB (if used)
    if ('indexedDB' in window) {
      indexedDB.databases?.().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
  }
}

// Service Worker cache clearing
export async function clearServiceWorkerCache(): Promise<void> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        // Unregister the service worker
        await registration.unregister();
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
    } catch (error) {
      console.error('Failed to clear service worker cache:', error);
    }
  }
}

// Complete cache clearing (nuclear option)
export async function clearAllCaches(): Promise<void> {
  clearAllStorage();
  await clearServiceWorkerCache();
  
  if (typeof window !== 'undefined') {
    // Force a hard refresh
    window.location.reload();
  }
}
