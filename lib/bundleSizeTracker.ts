// Bundle size tracking and regression detection system

export interface BundleSizeMetrics {
  timestamp: number;
  buildId: string;
  totalSize: number;
  gzippedSize: number;
  chunks: Record<string, number>;
  assets: Record<string, number>;
  dependencies: Record<string, number>;
  unusedDependencies: string[];
  treeShakingEfficiency: number;
  compressionRatio: number;
}

export interface BundleSizeHistory {
  metrics: BundleSizeMetrics[];
  trends: {
    totalSize: 'increasing' | 'decreasing' | 'stable';
    gzippedSize: 'increasing' | 'decreasing' | 'stable';
    chunkCount: 'increasing' | 'decreasing' | 'stable';
    dependencyCount: 'increasing' | 'decreasing' | 'stable';
  };
  alerts: BundleSizeAlert[];
  recommendations: string[];
}

export interface BundleSizeAlert {
  type: 'size_increase' | 'size_decrease' | 'dependency_increase' | 'unused_dependencies' | 'compression_ratio';
  severity: 'info' | 'warning' | 'error';
  message: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  threshold?: number;
  recommendation: string;
  timestamp: number;
}

export interface BundleSizeThresholds {
  totalSize: {
    warning: number;
    error: number;
    critical: number;
  };
  gzippedSize: {
    warning: number;
    error: number;
    critical: number;
  };
  chunkSize: {
    warning: number;
    error: number;
    critical: number;
  };
  dependencyCount: {
    warning: number;
    error: number;
    critical: number;
  };
}

export class BundleSizeTracker {
  private metrics: BundleSizeMetrics[] = [];
  private thresholds: BundleSizeThresholds;
  private alerts: BundleSizeAlert[] = [];

  constructor(initialThresholds?: Partial<BundleSizeThresholds>) {
    this.thresholds = {
      totalSize: {
        warning: 400000,   // 400KB
        error: 500000,     // 500KB
        critical: 750000,  // 750KB
      },
      gzippedSize: {
        warning: 100000,   // 100KB
        error: 150000,     // 150KB
        critical: 200000,  // 200KB
      },
      chunkSize: {
        warning: 100000,   // 100KB per chunk
        error: 150000,    // 150KB per chunk
        critical: 200000, // 200KB per chunk
      },
      dependencyCount: {
        warning: 50,       // 50 dependencies
        error: 75,         // 75 dependencies
        critical: 100,    // 100 dependencies
      },
      ...initialThresholds,
    };
  }

  // Record bundle size metrics
  recordMetrics(metrics: BundleSizeMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 50 builds for memory efficiency
    if (this.metrics.length > 50) {
      this.metrics = this.metrics.slice(-50);
    }

    // Analyze trends
    this.analyzeTrends();
    
    // Check for regressions
    this.checkRegressions(metrics);
    
    // Generate recommendations
    this.generateRecommendations();
  }

  // Analyze bundle size trends
  private analyzeTrends(): void {
    if (this.metrics.length < 2) return;

    const current = this.metrics[this.metrics.length - 1];
    const previous = this.metrics[this.metrics.length - 2];

    // Analyze total size trend
    const totalSizeChange = current.totalSize - previous.totalSize;
    const totalSizeTrend = totalSizeChange > 0 ? 'increasing' : 
                          totalSizeChange < 0 ? 'decreasing' : 'stable';

    // Analyze gzipped size trend
    const gzippedSizeChange = current.gzippedSize - previous.gzippedSize;
    const gzippedSizeTrend = gzippedSizeChange > 0 ? 'increasing' : 
                            gzippedSizeChange < 0 ? 'decreasing' : 'stable';

    // Analyze chunk count trend
    const currentChunkCount = Object.keys(current.chunks).length;
    const previousChunkCount = Object.keys(previous.chunks).length;
    const chunkCountChange = currentChunkCount - previousChunkCount;
    const chunkCountTrend = chunkCountChange > 0 ? 'increasing' : 
                           chunkCountChange < 0 ? 'decreasing' : 'stable';

    // Analyze dependency count trend
    const currentDependencyCount = Object.keys(current.dependencies).length;
    const previousDependencyCount = Object.keys(previous.dependencies).length;
    const dependencyCountChange = currentDependencyCount - previousDependencyCount;
    const dependencyCountTrend = dependencyCountChange > 0 ? 'increasing' : 
                                 dependencyCountChange < 0 ? 'decreasing' : 'stable';

    // Store trends (would be stored in a trends property)
    console.log('Bundle size trends:', {
      totalSize: totalSizeTrend,
      gzippedSize: gzippedSizeTrend,
      chunkCount: chunkCountTrend,
      dependencyCount: dependencyCountTrend,
    });
  }

  // Check for bundle size regressions
  private checkRegressions(metrics: BundleSizeMetrics): void {
    const alerts: BundleSizeAlert[] = [];

    // Check total size regressions
    if (metrics.totalSize > this.thresholds.totalSize.critical) {
      alerts.push({
        type: 'size_increase',
        severity: 'error',
        message: `Bundle size exceeded critical threshold: ${this.formatBytes(metrics.totalSize)}`,
        current: metrics.totalSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0,
        change: metrics.totalSize - (this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0),
        changePercent: this.metrics.length > 1 ? 
          ((metrics.totalSize - this.metrics[this.metrics.length - 2].totalSize) / this.metrics[this.metrics.length - 2].totalSize) * 100 : 0,
        threshold: this.thresholds.totalSize.critical,
        recommendation: 'Critical: Implement aggressive code splitting and remove unused dependencies',
        timestamp: Date.now(),
      });
    } else if (metrics.totalSize > this.thresholds.totalSize.error) {
      alerts.push({
        type: 'size_increase',
        severity: 'error',
        message: `Bundle size exceeded error threshold: ${this.formatBytes(metrics.totalSize)}`,
        current: metrics.totalSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0,
        change: metrics.totalSize - (this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0),
        changePercent: this.metrics.length > 1 ? 
          ((metrics.totalSize - this.metrics[this.metrics.length - 2].totalSize) / this.metrics[this.metrics.length - 2].totalSize) * 100 : 0,
        threshold: this.thresholds.totalSize.error,
        recommendation: 'Error: Review bundle composition and implement optimizations',
        timestamp: Date.now(),
      });
    } else if (metrics.totalSize > this.thresholds.totalSize.warning) {
      alerts.push({
        type: 'size_increase',
        severity: 'warning',
        message: `Bundle size exceeded warning threshold: ${this.formatBytes(metrics.totalSize)}`,
        current: metrics.totalSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0,
        change: metrics.totalSize - (this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].totalSize : 0),
        changePercent: this.metrics.length > 1 ? 
          ((metrics.totalSize - this.metrics[this.metrics.length - 2].totalSize) / this.metrics[this.metrics.length - 2].totalSize) * 100 : 0,
        threshold: this.thresholds.totalSize.warning,
        recommendation: 'Warning: Monitor bundle size and consider optimization',
        timestamp: Date.now(),
      });
    }

    // Check gzipped size regressions
    if (metrics.gzippedSize > this.thresholds.gzippedSize.critical) {
      alerts.push({
        type: 'size_increase',
        severity: 'error',
        message: `Gzipped size exceeded critical threshold: ${this.formatBytes(metrics.gzippedSize)}`,
        current: metrics.gzippedSize,
        previous: this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].gzippedSize : 0,
        change: metrics.gzippedSize - (this.metrics.length > 1 ? this.metrics[this.metrics.length - 2].gzippedSize : 0),
        changePercent: this.metrics.length > 1 ? 
          ((metrics.gzippedSize - this.metrics[this.metrics.length - 2].gzippedSize) / this.metrics[this.metrics.length - 2].gzippedSize) * 100 : 0,
        threshold: this.thresholds.gzippedSize.critical,
        recommendation: 'Critical: Optimize compression and remove redundant code',
        timestamp: Date.now(),
      });
    }

    // Check chunk size regressions
    Object.entries(metrics.chunks).forEach(([chunkName, size]) => {
      if (size > this.thresholds.chunkSize.critical) {
        alerts.push({
          type: 'size_increase',
          severity: 'error',
          message: `Chunk ${chunkName} exceeded critical size: ${this.formatBytes(size)}`,
          current: size,
          previous: 0,
          change: size,
          changePercent: 0,
          threshold: this.thresholds.chunkSize.critical,
          recommendation: `Critical: Split chunk ${chunkName} into smaller pieces`,
          timestamp: Date.now(),
        });
      }
    });

    // Check dependency count regressions
    const dependencyCount = Object.keys(metrics.dependencies).length;
    if (dependencyCount > this.thresholds.dependencyCount.critical) {
      alerts.push({
        type: 'dependency_increase',
        severity: 'error',
        message: `Dependency count exceeded critical threshold: ${dependencyCount}`,
        current: dependencyCount,
        previous: this.metrics.length > 1 ? Object.keys(this.metrics[this.metrics.length - 2].dependencies).length : 0,
        change: dependencyCount - (this.metrics.length > 1 ? Object.keys(this.metrics[this.metrics.length - 2].dependencies).length : 0),
        changePercent: this.metrics.length > 1 ? 
          ((dependencyCount - Object.keys(this.metrics[this.metrics.length - 2].dependencies).length) / Object.keys(this.metrics[this.metrics.length - 2].dependencies).length) * 100 : 0,
        threshold: this.thresholds.dependencyCount.critical,
        recommendation: 'Critical: Review and remove unused dependencies',
        timestamp: Date.now(),
      });
    }

    // Check for unused dependencies
    if (metrics.unusedDependencies.length > 0) {
      alerts.push({
        type: 'unused_dependencies',
        severity: 'warning',
        message: `Found ${metrics.unusedDependencies.length} unused dependencies`,
        current: metrics.unusedDependencies.length,
        previous: 0,
        change: metrics.unusedDependencies.length,
        changePercent: 0,
        recommendation: `Remove unused dependencies: ${metrics.unusedDependencies.join(', ')}`,
        timestamp: Date.now(),
      });
    }

    // Check compression ratio
    if (metrics.compressionRatio < 0.5) {
      alerts.push({
        type: 'compression_ratio',
        severity: 'warning',
        message: `Low compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`,
        current: metrics.compressionRatio,
        previous: 0,
        change: metrics.compressionRatio,
        changePercent: 0,
        recommendation: 'Optimize code for better compression',
        timestamp: Date.now(),
      });
    }

    this.alerts = [...this.alerts, ...alerts];
  }

  // Generate optimization recommendations
  private generateRecommendations(): string[] {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return [];

    const recommendations: string[] = [];

    // Bundle size recommendations
    if (latest.totalSize > this.thresholds.totalSize.warning) {
      recommendations.push('Consider implementing more aggressive code splitting');
      recommendations.push('Review and remove unused dependencies');
      recommendations.push('Optimize images and assets');
      recommendations.push('Implement lazy loading for non-critical components');
    }

    // Dependency recommendations
    if (Object.keys(latest.dependencies).length > this.thresholds.dependencyCount.warning) {
      recommendations.push('Audit dependencies for unused packages');
      recommendations.push('Consider lighter alternatives for heavy dependencies');
      recommendations.push('Implement tree-shaking for better dead code elimination');
    }

    // Compression recommendations
    if (latest.compressionRatio < 0.7) {
      recommendations.push('Optimize code structure for better compression');
      recommendations.push('Remove redundant code and comments');
      recommendations.push('Use shorter variable names in production builds');
    }

    // Store recommendations (would be stored in a recommendations property)
    console.log('Bundle optimization recommendations:', recommendations);
    
    return recommendations;
  }

  // Generate bundle size history report
  generateHistoryReport(): BundleSizeHistory {
    const trends = this.analyzeTrends();
    const recommendations = this.generateRecommendations();

    return {
      metrics: [...this.metrics],
      trends: {
        totalSize: 'stable', // Would be calculated from actual trends
        gzippedSize: 'stable',
        chunkCount: 'stable',
        dependencyCount: 'stable',
      },
      alerts: [...this.alerts],
      recommendations,
    };
  }

  // Get current alerts
  getAlerts(): BundleSizeAlert[] {
    return [...this.alerts];
  }

  // Clear alerts
  clearAlerts(): void {
    this.alerts = [];
  }

  // Get metrics history
  getHistory(): BundleSizeMetrics[] {
    return [...this.metrics];
  }

  // Get current thresholds
  getThresholds(): BundleSizeThresholds {
    return { ...this.thresholds };
  }

  // Utility methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }


}

// Global bundle size tracker instance
export const bundleSizeTracker = new BundleSizeTracker();

// Bundle size tracking utilities
export const trackBundleSize = {
  // Record bundle size metrics
  record: (metrics: BundleSizeMetrics) => {
    bundleSizeTracker.recordMetrics(metrics);
  },

  // Get current alerts
  getAlerts: () => bundleSizeTracker.getAlerts(),

  // Clear alerts
  clearAlerts: () => bundleSizeTracker.clearAlerts(),

  // Get history report
  getHistory: () => bundleSizeTracker.generateHistoryReport(),

  // Get thresholds
  getThresholds: () => bundleSizeTracker.getThresholds(),
};
