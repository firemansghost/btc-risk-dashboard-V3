// Chunk loading error handler for dynamic imports
// This handles cases where chunks fail to load due to cache clearing or network issues

class ChunkErrorHandler {
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  // Handle chunk loading errors with retry logic
  async handleChunkError(error: Error, chunkName?: string): Promise<boolean> {
    console.warn(`Chunk loading error for ${chunkName || 'unknown'}:`, error);
    
    if (this.retryCount >= this.maxRetries) {
      console.error(`Max retries exceeded for chunk ${chunkName || 'unknown'}`);
      return false;
    }

    this.retryCount++;
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryCount));
    
    // Clear any cached chunks that might be causing issues
    await this.clearChunkCache();
    
    return true;
  }

  // Clear chunk cache to force fresh loading
  async clearChunkCache(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          // Clear only chunk-related caches
          const cacheNames = await caches.keys();
          const chunkCaches = cacheNames.filter(name => 
            name.includes('chunk') || 
            name.includes('static') || 
            name.includes('nextjs')
          );
          
          await Promise.all(
            chunkCaches.map(cacheName => caches.delete(cacheName))
          );
        }
      }
    } catch (error) {
      console.warn('Failed to clear chunk cache:', error);
    }
  }

  // Reset retry count
  reset(): void {
    this.retryCount = 0;
  }

  // Get current retry count
  getRetryCount(): number {
    return this.retryCount;
  }
}

// Global chunk error handler instance
export const chunkErrorHandler = new ChunkErrorHandler();

// Enhanced dynamic import with error handling
export function createChunkSafeDynamicImport<T = any>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: () => React.ReactElement;
    fallback?: () => React.ReactElement;
    chunkName?: string;
  } = {}
) {
  const { loading, fallback, chunkName } = options;
  
  return async () => {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const module = await importFn();
        return module;
      } catch (error) {
        console.warn(`Chunk loading failed for ${chunkName || 'unknown'} (attempt ${retryCount + 1}):`, error);
        
        if (retryCount === maxRetries - 1) {
          // Last attempt failed, return fallback or throw
          if (fallback) {
            return { default: fallback };
          }
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        
        // Clear chunk cache
        await chunkErrorHandler.clearChunkCache();
        
        retryCount++;
      }
    }
    
    throw new Error(`Failed to load chunk after ${maxRetries} attempts`);
  };
}

// Global error handler for chunk loading failures
export function setupChunkErrorHandling(): void {
  if (typeof window === 'undefined') return;

  // Listen for chunk loading errors
  window.addEventListener('error', (event) => {
    if (event.message?.includes('Loading chunk') || event.message?.includes('chunk')) {
      console.warn('Chunk loading error detected:', event.message);
      
      // Try to recover by clearing cache
      chunkErrorHandler.clearChunkCache();
    }
  });

  // Listen for unhandled promise rejections (common with dynamic imports)
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('Loading chunk') || 
        event.reason?.message?.includes('chunk')) {
      console.warn('Chunk loading promise rejection:', event.reason);
      
      // Try to recover by clearing cache
      chunkErrorHandler.clearChunkCache();
    }
  });
}

// Initialize chunk error handling
if (typeof window !== 'undefined') {
  setupChunkErrorHandling();
}
