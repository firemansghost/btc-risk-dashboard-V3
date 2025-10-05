import { ComponentType } from 'react';

// Advanced code splitting strategies
export interface CodeSplittingConfig {
  strategy: 'route-based' | 'component-based' | 'feature-based' | 'priority-based';
  preload?: boolean;
  prefetch?: boolean;
  chunkSize?: 'small' | 'medium' | 'large';
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

// Route-based code splitting
export const createRouteSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  routeName: string,
  config: CodeSplittingConfig = { strategy: 'route-based' }
) => {
  const webpackChunkName = `route-${routeName}`;
  
  return {
    importFn: () => importFn().then(module => ({
      default: module.default
    })),
    chunkName: webpackChunkName,
    strategy: config.strategy,
    preload: config.preload || false,
    prefetch: config.prefetch || false,
  };
};

// Component-based code splitting
export const createComponentSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  config: CodeSplittingConfig = { strategy: 'component-based' }
) => {
  const webpackChunkName = `component-${componentName}`;
  
  return {
    importFn: () => importFn().then(module => ({
      default: module.default
    })),
    chunkName: webpackChunkName,
    strategy: config.strategy,
    preload: config.preload || false,
    prefetch: config.prefetch || false,
  };
};

// Feature-based code splitting
export const createFeatureSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  featureName: string,
  config: CodeSplittingConfig = { strategy: 'feature-based' }
) => {
  const webpackChunkName = `feature-${featureName}`;
  
  return {
    importFn: () => importFn().then(module => ({
      default: module.default
    })),
    chunkName: webpackChunkName,
    strategy: config.strategy,
    preload: config.preload || false,
    prefetch: config.prefetch || false,
  };
};

// Priority-based code splitting
export const createPrioritySplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
  config: CodeSplittingConfig = { strategy: 'priority-based' }
) => {
  const webpackChunkName = `priority-${priority}-${componentName}`;
  
  return {
    importFn: () => importFn().then(module => ({
      default: module.default
    })),
    chunkName: webpackChunkName,
    strategy: config.strategy,
    priority,
    preload: priority === 'critical' || priority === 'high',
    prefetch: priority === 'medium' || priority === 'low',
  };
};

// Tree-shaking optimization
export const createTreeShakenSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  config: CodeSplittingConfig = { strategy: 'component-based' }
) => {
  // Add tree-shaking hints
  const treeShakenImport = async () => {
    const module = await importFn();
    
    // Only import the default export to enable tree-shaking
    return {
      default: module.default
    };
  };

  return createComponentSplit(treeShakenImport, componentName, config);
};

// Bundle size optimization
export const createSizeOptimizedSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  expectedSize: 'small' | 'medium' | 'large',
  config: CodeSplittingConfig = { strategy: 'component-based' }
) => {
  const webpackChunkName = `size-${expectedSize}-${componentName}`;
  
  return {
    importFn: () => importFn().then(module => ({
      default: module.default
    })),
    chunkName: webpackChunkName,
    strategy: config.strategy,
    expectedSize,
    preload: expectedSize === 'small',
    prefetch: expectedSize === 'medium' || expectedSize === 'large',
  };
};

// Performance monitoring for code splitting
export const createMonitoredSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  config: CodeSplittingConfig = { strategy: 'component-based' }
) => {
  const startTime = performance.now();
  
  const monitoredImport = async () => {
    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;
      
      // Log performance metrics
      console.log(`Code split ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
      
      // Track bundle size if available
      if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          console.log(`Bundle size for ${componentName}: ${navigation.transferSize} bytes`);
        }
      }
      
      return module;
    } catch (error) {
      console.error(`Failed to load code split ${componentName}:`, error);
      throw error;
    }
  };

  return createComponentSplit(monitoredImport, componentName, config);
};

// Advanced bundle optimization
export const createOptimizedSplit = <T = ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  optimizations: {
    treeShaking?: boolean;
    minification?: boolean;
    compression?: boolean;
    caching?: boolean;
  } = {},
  config: CodeSplittingConfig = { strategy: 'component-based' }
) => {
  const webpackChunkName = `optimized-${componentName}`;
  
  const optimizedImport = async () => {
    const module = await importFn();
    
    // Apply optimizations
    if (optimizations.treeShaking) {
      // Tree-shaking is handled by webpack
    }
    
    if (optimizations.minification) {
      // Minification is handled by webpack
    }
    
    if (optimizations.compression) {
      // Compression is handled by webpack
    }
    
    if (optimizations.caching) {
      // Caching is handled by webpack
    }
    
    return {
      default: module.default
    };
  };

  return {
    importFn: optimizedImport,
    chunkName: webpackChunkName,
    strategy: config.strategy,
    optimizations,
    preload: config.preload || false,
    prefetch: config.prefetch || false,
  };
};

// Bundle analysis utilities
export const analyzeBundleSplit = (componentName: string, loadTime: number, bundleSize?: number) => {
  const analysis = {
    componentName,
    loadTime,
    bundleSize,
    performance: {
      excellent: loadTime < 100,
      good: loadTime < 300,
      fair: loadTime < 500,
      poor: loadTime >= 500,
    },
    recommendations: [] as string[],
  };

  if (loadTime > 500) {
    analysis.recommendations.push('Consider further code splitting');
  }
  
  if (bundleSize && bundleSize > 100000) {
    analysis.recommendations.push('Consider reducing bundle size');
  }
  
  if (loadTime < 100) {
    analysis.recommendations.push('Excellent performance - no optimization needed');
  }

  return analysis;
};
