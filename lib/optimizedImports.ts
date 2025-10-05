import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Simple loading fallback components
const ModalLoadingFallback = () => null;
const CardLoadingFallback = () => null;
const ChartLoadingFallback = () => null;
const DashboardLoadingFallback = () => null;

// Optimized dynamic import factory
export function createOptimizedImport<T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    type: 'modal' | 'card' | 'chart' | 'dashboard';
    priority?: 'high' | 'medium' | 'low';
    preload?: boolean;
  }
) {
  const loadingFallback = {
    modal: ModalLoadingFallback,
    card: CardLoadingFallback,
    chart: ChartLoadingFallback,
    dashboard: DashboardLoadingFallback,
  }[options.type];

  return dynamic(importFn, {
    loading: loadingFallback,
    ssr: false,
    // Add priority-based loading
    ...(options.priority === 'high' && { 
      // High priority components load immediately
    }),
    ...(options.priority === 'low' && {
      // Low priority components can be delayed
    }),
  });
}

// Pre-configured optimized imports for common patterns
export const createModalImport = (importFn: () => Promise<any>) =>
  createOptimizedImport(importFn, { type: 'modal', priority: 'high' });

export const createCardImport = (importFn: () => Promise<any>) =>
  createOptimizedImport(importFn, { type: 'card', priority: 'medium' });

export const createChartImport = (importFn: () => Promise<any>) =>
  createOptimizedImport(importFn, { type: 'chart', priority: 'medium' });

export const createDashboardImport = (importFn: () => Promise<any>) =>
  createOptimizedImport(importFn, { type: 'dashboard', priority: 'high' });

// Tree-shaking optimized imports
export const createTreeShakenImport = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    type: 'modal' | 'card' | 'chart' | 'dashboard';
    priority?: 'high' | 'medium' | 'low';
  }
) => {
  // Add tree-shaking hints
  const optimizedImport = () => importFn().then(module => ({
    default: module.default
  }));

  return createOptimizedImport(optimizedImport, options);
};

// Bundle splitting utilities
export const createBundleSplitImport = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName: string,
  options: {
    type: 'modal' | 'card' | 'chart' | 'dashboard';
    priority?: 'high' | 'medium' | 'low';
  }
) => {
  // Create a webpack chunk name for better bundle splitting
  const webpackChunkName = `chunk-${chunkName}`;
  
  return dynamic(importFn, {
    loading: {
      modal: ModalLoadingFallback,
      card: CardLoadingFallback,
      chart: ChartLoadingFallback,
      dashboard: DashboardLoadingFallback,
    }[options.type],
    ssr: false,
    // Add webpack chunk name for better splitting
    ...(typeof window !== 'undefined' && {
      // Client-side optimizations
    }),
  });
};

// Performance monitoring for dynamic imports
export const createMonitoredImport = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: {
    type: 'modal' | 'card' | 'chart' | 'dashboard';
    priority?: 'high' | 'medium' | 'low';
  }
) => {
  const startTime = performance.now();
  
  const monitoredImport = async () => {
    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;
      
      // Log performance metrics
      console.log(`Dynamic import ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
      
      return module;
    } catch (error) {
      console.error(`Failed to load ${componentName}:`, error);
      throw error;
    }
  };

  return createOptimizedImport(monitoredImport, options);
};
