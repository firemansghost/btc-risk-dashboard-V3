import React from 'react';
import dynamic from 'next/dynamic';

// Enhanced dynamic import with chunk error handling
export function createRobustDynamicImport<T = any>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: () => React.ReactElement;
    fallback?: () => React.ReactElement;
    chunkName?: string;
    ssr?: boolean;
  } = {}
) {
  const { loading, fallback, chunkName, ssr = false } = options;
  
  return dynamic(importFn, {
    loading: loading || (() => React.createElement('div', { 
      className: 'animate-pulse bg-gray-200 rounded-lg h-32' 
    })),
    ssr,
    // Add error boundary for chunk loading failures
    onError: (error) => {
      console.warn('Dynamic import error:', error);
      // Don't throw, let the fallback handle it
    }
  });
}

// Pre-configured robust dynamic imports for common patterns
export const createRobustModalImport = (importFn: () => Promise<any>, chunkName?: string) => {
  return createRobustDynamicImport(importFn, {
    loading: () => React.createElement('div', { 
      className: 'animate-pulse bg-gray-200 rounded-lg h-64' 
    }),
    fallback: () => React.createElement('div', { 
      className: 'text-center p-4 text-gray-500' 
    }, 'Modal failed to load'),
    chunkName,
    ssr: false
  });
};

export const createRobustCardImport = (importFn: () => Promise<any>, chunkName?: string) => {
  return createRobustDynamicImport(importFn, {
    loading: () => React.createElement('div', { 
      className: 'animate-pulse bg-gray-200 rounded-lg h-32' 
    }),
    fallback: () => React.createElement('div', { 
      className: 'text-center p-4 text-gray-500' 
    }, 'Card failed to load'),
    chunkName,
    ssr: false
  });
};

export const createRobustChartImport = (importFn: () => Promise<any>, chunkName?: string) => {
  return createRobustDynamicImport(importFn, {
    loading: () => React.createElement('div', { 
      className: 'animate-pulse bg-gray-200 rounded-lg h-64' 
    }),
    fallback: () => React.createElement('div', { 
      className: 'text-center p-4 text-gray-500' 
    }, 'Chart failed to load'),
    chunkName,
    ssr: false
  });
};
