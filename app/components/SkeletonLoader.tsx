'use client';

import { ReactNode } from 'react';

interface SkeletonLoaderProps {
  children?: ReactNode;
  isLoading: boolean;
  skeleton?: ReactNode;
  className?: string;
  delay?: number;
}

interface SkeletonCardProps {
  type?: 'metric' | 'factor' | 'insight' | 'chart' | 'button';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface SkeletonDashboardProps {
  className?: string;
}

export function SkeletonCard({ type = 'metric', size = 'md', className = '' }: SkeletonCardProps) {
  const baseClasses = 'skeleton-card';
  const sizeClasses = {
    sm: 'skeleton-card-sm',
    md: 'skeleton-card',
    lg: 'skeleton-card-lg'
  };
  
  const typeClasses = {
    metric: 'skeleton-card-metric',
    factor: 'skeleton-card-factor',
    insight: 'skeleton-card-insight',
    chart: 'skeleton-chart',
    button: 'skeleton-button'
  };

  return (
    <div className={`${baseClasses} ${sizeClasses[size]} ${typeClasses[type]} ${className}`}>
      <div className="space-y-3">
        <div className="skeleton-title"></div>
        <div className="skeleton-text"></div>
        <div className="skeleton-text-sm"></div>
        {type === 'metric' && (
          <div className="flex justify-between items-center">
            <div className="skeleton-text-sm w-1/3"></div>
            <div className="skeleton-button-sm"></div>
          </div>
        )}
        {type === 'factor' && (
          <div className="space-y-2">
            <div className="skeleton-text-sm"></div>
            <div className="skeleton-text-sm w-2/3"></div>
          </div>
        )}
        {type === 'chart' && (
          <div className="skeleton-chart"></div>
        )}
      </div>
    </div>
  );
}

export function SkeletonDashboard({ className = '' }: SkeletonDashboardProps) {
  return (
    <div className={`skeleton-dashboard ${className}`}>
      {/* Header */}
      <div className="skeleton-dashboard-header">
        <div className="skeleton-title w-1/3"></div>
        <div className="skeleton-text w-1/2"></div>
      </div>
      
      {/* Metrics Grid */}
      <div className="skeleton-dashboard-metrics">
        <SkeletonCard type="metric" />
        <SkeletonCard type="metric" />
      </div>
      
      {/* Factors Grid */}
      <div className="skeleton-dashboard-factors">
        <SkeletonCard type="factor" />
        <SkeletonCard type="factor" />
        <SkeletonCard type="factor" />
        <SkeletonCard type="factor" />
      </div>
      
      {/* Chart */}
      <SkeletonCard type="chart" size="lg" />
    </div>
  );
}

export function SkeletonText({ 
  lines = 1, 
  className = '' 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index}
          className={`skeleton-text ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonButton({ 
  size = 'md',
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'skeleton-button-sm',
    md: 'skeleton-button',
    lg: 'skeleton-button-lg'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`} />
  );
}

export function SkeletonAvatar({ 
  size = 'md',
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'skeleton-avatar-sm',
    md: 'skeleton-avatar',
    lg: 'skeleton-avatar-lg'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`} />
  );
}

export function SkeletonChart({ 
  height = 'md',
  className = '' 
}: { 
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const heightClasses = {
    sm: 'skeleton-chart-sm',
    md: 'skeleton-chart',
    lg: 'skeleton-chart-lg'
  };

  return (
    <div className={`${heightClasses[height]} ${className}`}>
      <div className="skeleton-chart"></div>
    </div>
  );
}

export default function SkeletonLoader({ 
  children, 
  isLoading, 
  skeleton, 
  className = '',
  delay = 0
}: SkeletonLoaderProps) {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={`skeleton-loader ${className}`}>
      {skeleton || (
        <div className="space-y-4">
          <div className="skeleton-title"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-text-sm"></div>
        </div>
      )}
    </div>
  );
}
