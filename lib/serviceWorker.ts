// Service Worker Registration and Management
// Handles registration, updates, and cache management

import { useState, useEffect } from 'react';

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig;

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = config;
  }

  // Register service worker
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service Worker: Not supported in this environment');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      this.registration = registration;

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Service Worker: New version available');
              this.config.onUpdate?.(registration);
            }
          });
        }
      });

      // Handle successful registration
      if (registration.active) {
        console.log('Service Worker: Active and ready');
        this.config.onSuccess?.(registration);
      }

      // Handle offline ready
      if (registration.waiting) {
        console.log('Service Worker: Waiting to activate');
        this.config.onOfflineReady?.();
      }

      return registration;
    } catch (error) {
      console.error('Service Worker: Registration failed', error);
      return null;
    }
  }

  // Update service worker
  async update(): Promise<void> {
    if (!this.registration) {
      console.log('Service Worker: No registration found');
      return;
    }

    try {
      await this.registration.update();
      console.log('Service Worker: Update check completed');
    } catch (error) {
      console.error('Service Worker: Update failed', error);
    }
  }

  // Skip waiting and activate new service worker
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) {
      console.log('Service Worker: No waiting service worker found');
      return;
    }

    try {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      console.log('Service Worker: Skip waiting message sent');
    } catch (error) {
      console.error('Service Worker: Skip waiting failed', error);
    }
  }

  // Clear all caches
  async clearCaches(): Promise<void> {
    if (!this.registration?.active) {
      console.log('Service Worker: No active service worker found');
      return;
    }

    try {
      this.registration.active.postMessage({ type: 'CACHE_CLEAR' });
      console.log('Service Worker: Cache clear message sent');
    } catch (error) {
      console.error('Service Worker: Cache clear failed', error);
    }
  }

  // Check if service worker is supported
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator;
  }

  // Get registration status
  getStatus(): 'unsupported' | 'unregistered' | 'registered' | 'updated' {
    if (!this.isSupported()) return 'unsupported';
    if (!this.registration) return 'unregistered';
    if (this.registration.waiting) return 'updated';
    return 'registered';
  }
}

// Hook for React components
export function useServiceWorker(config: ServiceWorkerConfig = {}) {
  const [swManager] = useState(() => new ServiceWorkerManager(config));
  const [status, setStatus] = useState<'unsupported' | 'unregistered' | 'registered' | 'updated'>('unregistered');

  useEffect(() => {
    if (swManager.isSupported()) {
      swManager.register().then(() => {
        setStatus(swManager.getStatus());
      });
    } else {
      setStatus('unsupported');
    }
  }, [swManager]);

  return {
    status,
    update: () => swManager.update(),
    skipWaiting: () => swManager.skipWaiting(),
    clearCaches: () => swManager.clearCaches(),
    isSupported: swManager.isSupported()
  };
}

// Utility functions
export const serviceWorkerUtils = {
  // Check if app is running offline
  isOffline(): boolean {
    return !navigator.onLine;
  },

  // Get cache size estimate
  async getCacheSize(): Promise<number> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return 0;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      console.error('Service Worker: Failed to get cache size', error);
      return 0;
    }
  },

  // Request persistent storage
  async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
      return false;
    }

    try {
      return await navigator.storage.persist();
    } catch (error) {
      console.error('Service Worker: Failed to request persistent storage', error);
      return false;
    }
  }
};

export default ServiceWorkerManager;
