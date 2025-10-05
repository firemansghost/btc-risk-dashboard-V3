'use client';

import { useState, useEffect } from 'react';
import { useServiceWorker, serviceWorkerUtils } from '@/lib/serviceWorker';

interface ServiceWorkerStatusProps {
  className?: string;
  showDetails?: boolean;
}

export default function ServiceWorkerStatus({ 
  className = '', 
  showDetails = false 
}: ServiceWorkerStatusProps) {
  const { status, update, skipWaiting, clearCaches, isSupported } = useServiceWorker({
    onUpdate: () => {
      console.log('Service Worker: Update available');
    },
    onSuccess: () => {
      console.log('Service Worker: Successfully registered');
    },
    onOfflineReady: () => {
      console.log('Service Worker: Offline ready');
    }
  });

  const [isOffline, setIsOffline] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOffline(serviceWorkerUtils.isOffline());

    // Get cache size
    serviceWorkerUtils.getCacheSize().then(setCacheSize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'registered': return 'text-green-600';
      case 'updated': return 'text-yellow-600';
      case 'unregistered': return 'text-gray-500';
      case 'unsupported': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'registered': return 'Active';
      case 'updated': return 'Update Available';
      case 'unregistered': return 'Not Registered';
      case 'unsupported': return 'Not Supported';
      default: return 'Unknown';
    }
  };

  const formatCacheSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isSupported) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Service Worker not supported
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'registered' ? 'bg-green-500' : 
            status === 'updated' ? 'bg-yellow-500' : 
            'bg-gray-400'
          }`}></div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {isOffline && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
              Offline
            </span>
          )}
        </div>
        
        {status === 'updated' && (
          <button
            onClick={skipWaiting}
            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
          >
            Update
          </button>
        )}
      </div>

      {showDetails && (
        <div className="text-xs text-gray-600 space-y-1">
          <div>Cache Size: {formatCacheSize(cacheSize)}</div>
          <div>Status: {status}</div>
          <div>Online: {isOffline ? 'No' : 'Yes'}</div>
          
          <div className="flex space-x-2 pt-2">
            <button
              onClick={update}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              Check Update
            </button>
            <button
              onClick={clearCaches}
              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
