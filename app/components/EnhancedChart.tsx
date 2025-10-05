'use client';

import { useState, useEffect } from 'react';

interface ChartData {
  date: string;
  value: number;
  label?: string;
}

interface EnhancedChartProps {
  data: ChartData[];
  title: string;
  type?: 'line' | 'bar' | 'area';
  height?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  showLegend?: boolean;
  animated?: boolean;
  gradient?: boolean;
}

export default function EnhancedChart({
  data,
  title,
  type = 'line',
  height = 'medium',
  showTooltip = true,
  showLegend = true,
  animated = true,
  gradient = true
}: EnhancedChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const getHeightClass = () => {
    switch (height) {
      case 'small': return 'chart-small';
      case 'large': return 'chart-large';
      default: return 'chart-responsive';
    }
  };

  const getAnimationClass = () => {
    if (!animated) return '';
    return 'chart-fade-in chart-slide-up';
  };

  if (isLoading) {
    return (
      <div className={`chart-container ${getHeightClass()} ${getAnimationClass()}`}>
        <div className="chart-loading">
          <div className="p-4">
            <div className="chart-skeleton-title mb-4"></div>
            <div className="space-y-2">
              <div className="chart-skeleton-line"></div>
              <div className="chart-skeleton-line"></div>
              <div className="chart-skeleton-line"></div>
              <div className="chart-skeleton-line"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;

  const getBarColor = (value: number) => {
    const percentage = (value - minValue) / range;
    if (percentage > 0.8) return 'chart-bar-danger';
    if (percentage > 0.6) return 'chart-bar-warning';
    if (percentage > 0.4) return 'chart-bar-success';
    return 'chart-bar-primary';
  };

  const getLineColor = () => {
    const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const percentage = (avgValue - minValue) / range;
    if (percentage > 0.8) return 'chart-line-accent';
    if (percentage > 0.6) return 'chart-line-secondary';
    return 'chart-line-primary';
  };

  return (
    <div className={`chart-container ${getHeightClass()} ${getAnimationClass()}`}>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        
        <div className="relative">
          {/* Chart Content */}
          <div className="relative h-48 sm:h-64 lg:h-80">
            {type === 'line' && (
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {/* Grid Lines */}
                <defs>
                  {gradient && (
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.1"/>
                    </linearGradient>
                  )}
                </defs>
                
                {/* Grid */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={40 + i * 32}
                    x2="400"
                    y2={40 + i * 32}
                    className="chart-grid"
                  />
                ))}
                
                {/* Area Fill */}
                {gradient && (
                  <path
                    d={`M 0,${200 - ((data[0]?.value - minValue) / range) * 160} ${data.map((d, i) => 
                      `L ${(i / (data.length - 1)) * 400},${200 - ((d.value - minValue) / range) * 160}`
                    ).join(' ')} L 400,200 L 0,200 Z`}
                    fill="url(#lineGradient)"
                    className="chart-area chart-area-primary"
                  />
                )}
                
                {/* Line */}
                <path
                  d={`M 0,${200 - ((data[0]?.value - minValue) / range) * 160} ${data.map((d, i) => 
                    `L ${(i / (data.length - 1)) * 400},${200 - ((d.value - minValue) / range) * 160}`
                  ).join(' ')}`}
                  className={`chart-line ${getLineColor()}`}
                  fill="none"
                />
                
                {/* Data Points */}
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={(i / (data.length - 1)) * 400}
                    cy={200 - ((d.value - minValue) / range) * 160}
                    r="4"
                    className={`data-point ${hoveredPoint === i ? 'data-point-active' : ''} ${getLineColor().replace('chart-line-', 'fill-')}`}
                    onMouseEnter={(e) => {
                      setHoveredPoint(i);
                      setTooltipPosition({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>
            )}

            {type === 'bar' && (
              <div className="flex items-end justify-between h-full gap-1">
                {data.map((d, i) => (
                  <div
                    key={i}
                    className={`chart-bar ${getBarColor(d.value)} flex-1 rounded-t transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${((d.value - minValue) / range) * 100}%` }}
                    onMouseEnter={(e) => {
                      setHoveredPoint(i);
                      setTooltipPosition({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </div>
            )}

            {type === 'area' && (
              <svg className="w-full h-full" viewBox="0 0 400 200">
                <defs>
                  {gradient && (
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.1"/>
                    </linearGradient>
                  )}
                </defs>
                
                <path
                  d={`M 0,${200 - ((data[0]?.value - minValue) / range) * 160} ${data.map((d, i) => 
                    `L ${(i / (data.length - 1)) * 400},${200 - ((d.value - minValue) / range) * 160}`
                  ).join(' ')} L 400,200 L 0,200 Z`}
                  fill={gradient ? "url(#areaGradient)" : "#10b981"}
                  className="chart-area chart-area-primary"
                />
              </svg>
            )}
          </div>

          {/* Tooltip */}
          {showTooltip && hoveredPoint !== null && (
            <div
              className="tooltip tooltip-top"
              style={{
                left: tooltipPosition.x,
                top: tooltipPosition.y - 10,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="font-medium">{data[hoveredPoint].label || data[hoveredPoint].date}</div>
              <div className="text-xs opacity-80">Value: {data[hoveredPoint].value}</div>
            </div>
          )}

          {/* Legend */}
          {showLegend && (
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color bg-emerald-500"></div>
                <span className="legend-label">Current</span>
                <span className="legend-value">{data[data.length - 1]?.value}</span>
              </div>
              <div className="legend-item">
                <div className="legend-color bg-gray-400"></div>
                <span className="legend-label">Average</span>
                <span className="legend-value">{Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length)}</span>
              </div>
              <div className="legend-item">
                <div className="legend-color bg-violet-500"></div>
                <span className="legend-label">Peak</span>
                <span className="legend-value">{maxValue}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
