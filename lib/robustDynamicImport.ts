import React from 'react';
import dynamic from 'next/dynamic';

// Simplified dynamic import with basic error handling
export function createRobustDynamicImport(
  importFn: () => Promise<any>,
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
    ssr: ssr
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
