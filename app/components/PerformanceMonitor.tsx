'use client';

import { useState, useEffect } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  networkLatency?: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  showIndicator?: boolean;
  className?: string;
}

export default function PerformanceMonitor({
  componentName,
  onMetricsUpdate,
  showIndicator = false,
  className = ''
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const startTime = performance.now();
    
    // Measure component render time
    const measureRenderTime = () => {
      const renderTime = performance.now() - startTime;
      
      // Get memory usage if available
      const memoryUsage = (performance as any).memory?.usedJSHeapSize;
      
      // Get network timing if available
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const networkLatency = navigation ? navigation.responseEnd - navigation.requestStart : undefined;
      
      const newMetrics: PerformanceMetrics = {
        loadTime: renderTime,
        renderTime,
        memoryUsage,
        networkLatency
      };
      
      setMetrics(newMetrics);
      onMetricsUpdate?.(newMetrics);
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(measureRenderTime);
  }, [componentName, onMetricsUpdate]);

  const getPerformanceClass = () => {
    if (metrics.loadTime < 100) return 'performance-indicator-fast';
    if (metrics.loadTime < 300) return 'performance-indicator-medium';
    return 'performance-indicator-slow';
  };

  const getPerformanceLabel = () => {
    if (metrics.loadTime < 100) return 'Fast';
    if (metrics.loadTime < 300) return 'Medium';
    return 'Slow';
  };

  if (!showIndicator) return null;

  return (
    <div className={`performance-monitor ${className}`}>
      <div className={`performance-indicator ${getPerformanceClass()}`}>
        {getPerformanceLabel()} ({Math.round(metrics.loadTime)}ms)
      </div>
    </div>
  );
}
