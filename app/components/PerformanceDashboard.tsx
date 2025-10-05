'use client';

import { useState, useEffect } from 'react';
import { performanceMonitor, trackPerformance } from '@/lib/performanceMonitoring';
import { bundleSizeTracker, trackBundleSize } from '@/lib/bundleSizeTracker';

interface PerformanceDashboardProps {
  className?: string;
}

export default function PerformanceDashboard({ className = '' }: PerformanceDashboardProps) {
  const [report, setReport] = useState(performanceMonitor.generateReport());
  const [bundleHistory, setBundleHistory] = useState(bundleSizeTracker.generateHistoryReport());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Update report every 5 seconds
    const interval = setInterval(() => {
      setReport(performanceMonitor.generateReport());
      setBundleHistory(bundleSizeTracker.generateHistoryReport());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">Performance Dashboard</h3>
            <div className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(report.score)}`}>
              Score: {report.score}/100
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {formatBytes(report.metrics.bundleSize)}
          </div>
          <div className="text-sm text-gray-500">Bundle Size</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(report.metrics.loadTime)}
          </div>
          <div className="text-sm text-gray-500">Load Time</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {formatBytes(report.metrics.memoryUsage)}
          </div>
          <div className="text-sm text-gray-500">Memory</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {report.metrics.networkLatency}ms
          </div>
          <div className="text-sm text-gray-500">Latency</div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Alerts */}
          {report.alerts.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Alerts</h4>
              <div className="space-y-2">
                {report.alerts.map((alert, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm mt-1">{alert.recommendation}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bundle Analysis */}
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Bundle Analysis</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {formatBytes(report.bundleAnalysis.totalSize)}
                </div>
                <div className="text-xs text-gray-500">Total Size</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {Object.keys(report.bundleAnalysis.chunkSizes).length}
                </div>
                <div className="text-xs text-gray-500">Chunks</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {Object.keys(report.bundleAnalysis.dependencies).length}
                </div>
                <div className="text-xs text-gray-500">Dependencies</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {(report.bundleAnalysis.treeShakingEfficiency * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Tree Shaking</div>
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Thresholds</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Bundle Size</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (report.metrics.bundleSize / report.thresholds.bundleSize.warning) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatBytes(report.metrics.bundleSize)} / {formatBytes(report.thresholds.bundleSize.warning)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Load Time</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (report.metrics.loadTime / report.thresholds.loadTime.warning) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(report.metrics.loadTime)} / {formatTime(report.thresholds.loadTime.warning)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Optimization Recommendations</h4>
              <div className="space-y-2">
                {report.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-gray-600">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Last updated: {new Date(report.timestamp).toLocaleTimeString()}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    performanceMonitor.clearAlerts();
                    bundleSizeTracker.clearAlerts();
                    setReport(performanceMonitor.generateReport());
                    setBundleHistory(bundleSizeTracker.generateHistoryReport());
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Clear Alerts
                </button>
                <button
                  onClick={() => {
                    setReport(performanceMonitor.generateReport());
                    setBundleHistory(bundleSizeTracker.generateHistoryReport());
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
