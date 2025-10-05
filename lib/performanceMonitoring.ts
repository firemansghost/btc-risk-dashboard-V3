// Performance monitoring utilities for bundle size tracking and regression detection

export interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  timestamp: number;
}

export interface BundleAnalysis {
  totalSize: number;
  chunkSizes: Record<string, number>;
  dependencies: Record<string, number>;
  unusedCode: number;
  treeShakingEfficiency: number;
  compressionRatio: number;
}

export interface PerformanceThresholds {
  bundleSize: {
    warning: number;
    error: number;
    critical: number;
    target: number;
    ideal: number;
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
    changePercent: number;
  };
  loadTime: {
    warning: number;
    error: number;
    critical: number;
    target: number;
    ideal: number;
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
    changePercent: number;
  };
  memoryUsage: {
    warning: number;
    error: number;
    critical: number;
    target: number;
    ideal: number;
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
    changePercent: number;
  };
}

export interface RegressionAlert {
  type: 'bundle_size' | 'load_time' | 'memory_usage' | 'performance';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  current: number;
  previous: number;
  threshold: number;
  recommendation: string;
  timestamp: number;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetrics;
  bundleAnalysis: BundleAnalysis;
  thresholds: PerformanceThresholds;
  alerts: RegressionAlert[];
  recommendations: string[];
  score: number; // 0-100 performance score
}

// Performance monitoring class
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private alerts: RegressionAlert[] = [];

  constructor(initialThresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      bundleSize: {
        warning: 400000, // 400KB
        error: 500000,   // 500KB
        critical: 750000, // 750KB
        target: 300000,  // 300KB
        ideal: 200000,   // 200KB
        current: 0,
        trend: 'stable',
        change: 0,
        changePercent: 0,
      },
      loadTime: {
        warning: 3000,   // 3s
        error: 5000,     // 5s
        critical: 8000,  // 8s
        target: 2000,    // 2s
        ideal: 1000,     // 1s
        current: 0,
        trend: 'stable',
        change: 0,
        changePercent: 0,
      },
      memoryUsage: {
        warning: 100000000, // 100MB
        error: 200000000,   // 200MB
        critical: 300000000, // 300MB
        target: 50000000,    // 50MB
        ideal: 25000000,     // 25MB
        current: 0,
        trend: 'stable',
        change: 0,
        changePercent: 0,
      },
      ...initialThresholds,
    };
  }

  // Record performance metrics
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 100 metrics for memory efficiency
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Update thresholds with current values
    this.updateThresholds(metrics);
    
    // Check for regressions
    this.checkRegressions(metrics);
  }

  // Update performance thresholds based on current metrics
  private updateThresholds(metrics: PerformanceMetrics): void {
    // Update bundle size trends
    if (this.metrics.length >= 2) {
      const previous = this.metrics[this.metrics.length - 2];
      const current = metrics;
      
      const bundleChange = current.bundleSize - previous.bundleSize;
      const bundleChangePercent = (bundleChange / previous.bundleSize) * 100;
      
      this.thresholds.bundleSize.current = current.bundleSize;
      this.thresholds.bundleSize.change = bundleChange;
      this.thresholds.bundleSize.changePercent = bundleChangePercent;
      
      // Determine trend
      if (bundleChangePercent > 5) {
        this.thresholds.bundleSize.trend = 'degrading';
      } else if (bundleChangePercent < -5) {
        this.thresholds.bundleSize.trend = 'improving';
      } else {
        this.thresholds.bundleSize.trend = 'stable';
      }
    }
  }

  // Check for performance regressions
  private checkRegressions(metrics: PerformanceMetrics): void {
    const alerts: RegressionAlert[] = [];

    // Bundle size regression
    if (metrics.bundleSize > this.thresholds.bundleSize.error) {
      alerts.push({
        type: 'bundle_size',
        severity: 'error',
        message: `Bundle size exceeded error threshold: ${this.formatBytes(metrics.bundleSize)}`,
        current: metrics.bundleSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].bundleSize : 0,
        threshold: this.thresholds.bundleSize.error,
        recommendation: 'Consider code splitting or removing unused dependencies',
        timestamp: Date.now(),
      });
    } else if (metrics.bundleSize > this.thresholds.bundleSize.warning) {
      alerts.push({
        type: 'bundle_size',
        severity: 'warning',
        message: `Bundle size exceeded warning threshold: ${this.formatBytes(metrics.bundleSize)}`,
        current: metrics.bundleSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].bundleSize : 0,
        threshold: this.thresholds.bundleSize.warning,
        recommendation: 'Monitor bundle size and consider optimization',
        timestamp: Date.now(),
      });
    }

    // Load time regression
    if (metrics.loadTime > this.thresholds.loadTime.error) {
      alerts.push({
        type: 'load_time',
        severity: 'error',
        message: `Load time exceeded error threshold: ${metrics.loadTime}ms`,
        current: metrics.loadTime,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].loadTime : 0,
        threshold: this.thresholds.loadTime.error,
        recommendation: 'Optimize bundle size and implement lazy loading',
        timestamp: Date.now(),
      });
    }

    // Memory usage regression
    if (metrics.memoryUsage > this.thresholds.memoryUsage.error) {
      alerts.push({
        type: 'memory_usage',
        severity: 'error',
        message: `Memory usage exceeded error threshold: ${this.formatBytes(metrics.memoryUsage)}`,
        current: metrics.memoryUsage,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].memoryUsage : 0,
        threshold: this.thresholds.memoryUsage.error,
        recommendation: 'Review memory leaks and optimize component rendering',
        timestamp: Date.now(),
      });
    }

    this.alerts = [...this.alerts, ...alerts];
  }

  // Generate performance report
  generateReport(): PerformanceReport {
    const latest = this.metrics[this.metrics.length - 1];
    const bundleAnalysis = this.analyzeBundle();
    const recommendations = this.generateRecommendations();
    const score = this.calculatePerformanceScore();

    return {
      timestamp: Date.now(),
      metrics: latest || this.getDefaultMetrics(),
      bundleAnalysis,
      thresholds: this.thresholds,
      alerts: this.alerts,
      recommendations,
      score,
    };
  }

  // Analyze bundle composition
  private analyzeBundle(): BundleAnalysis {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) {
      return this.getDefaultBundleAnalysis();
    }

    return {
      totalSize: latest.bundleSize,
      chunkSizes: {}, // Would be populated by webpack stats
      dependencies: {}, // Would be populated by dependency analysis
      unusedCode: 0, // Would be calculated by tree-shaking analysis
      treeShakingEfficiency: 0.85, // Would be calculated
      compressionRatio: 0.7, // Would be calculated
    };
  }

  // Generate optimization recommendations
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const latest = this.metrics[this.metrics.length - 1];

    if (!latest) return recommendations;

    // Bundle size recommendations
    if (latest.bundleSize > this.thresholds.bundleSize.target) {
      recommendations.push('Consider implementing more aggressive code splitting');
      recommendations.push('Review and remove unused dependencies');
      recommendations.push('Optimize images and assets');
    }

    // Load time recommendations
    if (latest.loadTime > this.thresholds.loadTime.target) {
      recommendations.push('Implement lazy loading for non-critical components');
      recommendations.push('Optimize critical rendering path');
      recommendations.push('Consider server-side rendering for initial load');
    }

    // Memory usage recommendations
    if (latest.memoryUsage > this.thresholds.memoryUsage.target) {
      recommendations.push('Review component lifecycle and cleanup');
      recommendations.push('Implement virtual scrolling for large lists');
      recommendations.push('Optimize state management');
    }

    return recommendations;
  }

  // Calculate performance score (0-100)
  private calculatePerformanceScore(): number {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return 0;

    let score = 100;

    // Bundle size score (40% weight)
    const bundleScore = Math.max(0, 100 - (latest.bundleSize / this.thresholds.bundleSize.target) * 100);
    score = score * 0.4 + bundleScore * 0.4;

    // Load time score (30% weight)
    const loadScore = Math.max(0, 100 - (latest.loadTime / this.thresholds.loadTime.target) * 100);
    score = score * 0.6 + loadScore * 0.3;

    // Memory usage score (20% weight)
    const memoryScore = Math.max(0, 100 - (latest.memoryUsage / this.thresholds.memoryUsage.target) * 100);
    score = score * 0.7 + memoryScore * 0.2;

    // Network latency score (10% weight)
    const networkScore = Math.max(0, 100 - (latest.networkLatency / 1000) * 100);
    score = score * 0.8 + networkScore * 0.1;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // Utility methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      bundleSize: 0,
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      timestamp: Date.now(),
    };
  }

  private getDefaultBundleAnalysis(): BundleAnalysis {
    return {
      totalSize: 0,
      chunkSizes: {},
      dependencies: {},
      unusedCode: 0,
      treeShakingEfficiency: 0,
      compressionRatio: 0,
    };
  }

  // Get current alerts
  getAlerts(): RegressionAlert[] {
    return this.alerts;
  }

  // Clear alerts
  clearAlerts(): void {
    this.alerts = [];
  }

  // Get performance history
  getHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Get current thresholds
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Performance tracking utilities
export const trackPerformance = {
  // Track bundle size
  trackBundleSize: (size: number) => {
    const metrics = performanceMonitor.getHistory().slice(-1)[0] || performanceMonitor['getDefaultMetrics']();
    metrics.bundleSize = size;
    performanceMonitor.recordMetrics(metrics);
  },

  // Track load time
  trackLoadTime: (loadTime: number) => {
    const metrics = performanceMonitor.getHistory().slice(-1)[0] || performanceMonitor['getDefaultMetrics']();
    metrics.loadTime = loadTime;
    performanceMonitor.recordMetrics(metrics);
  },

  // Track memory usage
  trackMemoryUsage: (memoryUsage: number) => {
    const metrics = performanceMonitor.getHistory().slice(-1)[0] || performanceMonitor['getDefaultMetrics']();
    metrics.memoryUsage = memoryUsage;
    performanceMonitor.recordMetrics(metrics);
  },

  // Track network latency
  trackNetworkLatency: (latency: number) => {
    const metrics = performanceMonitor.getHistory().slice(-1)[0] || performanceMonitor['getDefaultMetrics']();
    metrics.networkLatency = latency;
    performanceMonitor.recordMetrics(metrics);
  },

  // Get performance report
  getReport: () => performanceMonitor.generateReport(),

  // Get alerts
  getAlerts: () => performanceMonitor.getAlerts(),

  // Clear alerts
  clearAlerts: () => performanceMonitor.clearAlerts(),
};
