'use client';

import { useEffect } from 'react';
import { CACHE_BUST_VERSION } from '@/lib/cacheBusting';
import { setupChunkErrorHandling } from '@/lib/chunkErrorHandler';

interface CacheBusterProps {
  enabled?: boolean;
  version?: string;
}

export default function CacheBuster({ 
  enabled = true, 
  version = CACHE_BUST_VERSION 
}: CacheBusterProps) {
  useEffect(() => {
    if (!enabled) return;
    
    // Setup chunk error handling to prevent chunk loading failures
    setupChunkErrorHandling();
    
    // Only check version on initial load, don't force refresh aggressively
    const storedVersion = localStorage.getItem('app-version');
    if (storedVersion !== version) {
      localStorage.setItem('app-version', version);
      // Don't force refresh immediately, let the user continue
      console.log('App version updated to', version);
    }
    
    // Add a version meta tag to help with debugging
    const metaVersion = document.querySelector('meta[name="app-version"]');
    if (metaVersion) {
      metaVersion.setAttribute('content', version);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'app-version';
      meta.content = version;
      document.head.appendChild(meta);
    }
  }, [enabled, version]);
  
  // This component doesn't render anything
  return null;
}
