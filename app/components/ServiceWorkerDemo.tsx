'use client';

import { useState, useEffect } from 'react';
import ServiceWorkerStatus from './ServiceWorkerStatus';
import { serviceWorkerUtils } from '@/lib/serviceWorker';

export default function ServiceWorkerDemo() {
  const [isOffline, setIsOffline] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOffline(serviceWorkerUtils.isOffline());

    // Get cache size
    serviceWorkerUtils.getCacheSize().then(setCacheSize);

    // Get last update time
    const lastUpdateTime = localStorage.getItem('sw-last-update');
    if (lastUpdateTime) {
      setLastUpdate(new Date(lastUpdateTime).toLocaleString());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTestCache = async () => {
    try {
      // Test caching by fetching a resource
      const response = await fetch('/data/latest.json');
      if (response.ok) {
        console.log('Cache test: Resource fetched successfully');
        // Update cache size
        const newSize = await serviceWorkerUtils.getCacheSize();
        setCacheSize(newSize);
      }
    } catch (error) {
      console.error('Cache test failed:', error);
    }
  };

  const handleRequestPersistentStorage = async () => {
    try {
      const granted = await serviceWorkerUtils.requestPersistentStorage();
      if (granted) {
        console.log('Persistent storage granted');
        alert('Persistent storage has been granted!');
      } else {
        console.log('Persistent storage denied');
        alert('Persistent storage was denied.');
      }
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
    }
  };

  const formatCacheSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Service Worker Demo</h3>
      
      <div className="space-y-6">
        {/* Service Worker Status */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Service Worker Status</h4>
          <ServiceWorkerStatus showDetails={true} />
        </div>

        {/* Connection Status */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Connection Status</h4>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="text-sm">{isOffline ? 'Offline' : 'Online'}</span>
            </div>
            <div className="text-sm text-gray-600">
              Cache Size: {formatCacheSize(cacheSize)}
            </div>
          </div>
        </div>

        {/* Cache Management */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Cache Management</h4>
          <div className="space-y-3">
            <button
              onClick={handleTestCache}
              className="btn btn-outline btn-sm"
            >
              Test Cache
            </button>
            <button
              onClick={handleRequestPersistentStorage}
              className="btn btn-outline btn-sm"
            >
              Request Persistent Storage
            </button>
          </div>
        </div>

        {/* Service Worker Benefits */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Service Worker Benefits</h4>
          <div className="text-sm text-gray-600 space-y-2">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Offline Support:</strong> App works without internet connection
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Faster Loading:</strong> Cached resources load instantly
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Background Sync:</strong> Data syncs when connection is restored
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Smart Caching:</strong> Different strategies for different content types
              </div>
            </div>
          </div>
        </div>

        {/* Cache Strategies */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Cache Strategies</h4>
          <div className="text-sm text-gray-600 space-y-2">
            <div>
              <strong>Static Assets:</strong> Cache First (JS, CSS, images) - 7 days
            </div>
            <div>
              <strong>API Data:</strong> Network First with fallback - 5 minutes
            </div>
            <div>
              <strong>Pages:</strong> Stale While Revalidate - 24 hours
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
