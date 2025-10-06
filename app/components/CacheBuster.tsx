'use client';

import { useEffect } from 'react';
import { checkAndForceRefresh, CACHE_BUST_VERSION } from '@/lib/cacheBusting';

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
    
    // Check if we need to force a refresh
    checkAndForceRefresh();
    
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
