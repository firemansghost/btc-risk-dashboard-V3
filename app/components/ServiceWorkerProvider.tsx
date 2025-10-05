'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/lib/serviceWorker';

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export default function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const { status, update, skipWaiting } = useServiceWorker({
    onUpdate: (registration) => {
      console.log('Service Worker: Update available');
      // Store update time
      localStorage.setItem('sw-last-update', new Date().toISOString());
      
      // Show update notification (optional)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('App Update Available', {
            body: 'A new version of the app is available. Click to update.',
            icon: '/favicon.ico',
            tag: 'sw-update'
          });
        }
      }
    },
    onSuccess: (registration) => {
      console.log('Service Worker: Successfully registered');
    },
    onOfflineReady: () => {
      console.log('Service Worker: Offline ready');
    }
  });

  useEffect(() => {
    // Auto-update service worker if available
    if (status === 'updated') {
      // You can add logic here to automatically update or show a notification
      console.log('Service Worker: Update available, consider updating');
    }
  }, [status]);

  return <>{children}</>;
}
