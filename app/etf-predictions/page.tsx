'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports with proper error boundaries
const IndividualETFPredictions = dynamic(() => import('../components/IndividualETFPredictions'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>,
  ssr: false
});

const PredictionChart = dynamic(() => import('../components/PredictionChart'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>,
  ssr: false
});

const ModelPerformance = dynamic(() => import('../components/ModelPerformance'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>,
  ssr: false
});

const PredictionSettings = dynamic(() => import('../components/PredictionSettings'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>,
  ssr: false
});

// Trading day utilities
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function getNextTradingDay(date: Date = new Date()): Date {
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  
  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

function getTradingDaysInWeek(startDate: Date): Date[] {
  const tradingDays: Date[] = [];
  const currentDate = new Date(startDate);
  
  // Find the start of the week (Monday)
  const dayOfWeek = currentDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentDate.setDate(currentDate.getDate() - daysToMonday);
  
  // Get all 5 trading days in the week
  for (let i = 0; i < 5; i++) {
    tradingDays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return tradingDays;
}

function getTradingWeekInfo(startDate: Date): { 
  weekName: string; 
  tradingDays: string[]; 
  totalDays: number;
  description: string;
} {
  const tradingDays = getTradingDaysInWeek(startDate);
  const dayNames = tradingDays.map(day => day.toLocaleDateString('en-US', { weekday: 'short' }));
  
  const today = new Date();
  const isCurrentWeek = tradingDays.some(day => day.toDateString() === today.toDateString());
  
  let weekName = isCurrentWeek ? 'This Week' : 'Next Week';
  let description = `${tradingDays.length} trading days (${dayNames.join(', ')})`;
  
  return {
    weekName,
    tradingDays: dayNames,
    totalDays: tradingDays.length,
    description
  };
}

function isMarketHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Simplified list of holidays for demonstration
  if (month === 0 && day === 1) return true; // New Year's Day
  if (month === 6 && day === 4) return true; // Independence Day
  if (month === 11 && day === 25) return true; // Christmas Day
  
  return false;
}

function isTradingDay(date: Date): boolean {
  return isBusinessDay(date) && !isMarketHoliday(date);
}

function getNextTradingDayWithHolidays(date: Date = new Date()): Date {
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  
  while (!isTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

function getCurrentDayContext(): string {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  if (isWeekend(today)) {
    return `Weekend (${dayName}) - No ETF trading`;
  } else if (dayName === 'Friday') {
    return 'Friday - Last trading day of the week';
  } else {
    return `${dayName} - Trading day`;
  }
}

// Types for our data
interface ETFPrediction {
  symbol: string;
  name: string;
  current: number;
  predicted: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  marketShare: number;
}

interface DailyPrediction {
  date: string;
  flow: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

interface PredictionData {
  individual: ETFPrediction[];
  daily: DailyPrediction[];
  weekly: {
    thisWeek: number;
    nextWeek: number;
    confidence: number;
  };
  insights?: string[];
  lastUpdated?: string;
}

// Loading component
function LoadingCard() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-gray-300 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-32"></div>
        <div className="w-8 h-8 bg-gray-200 rounded"></div>
      </div>
      <div className="mb-4">
        <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
    </div>
  );
}

// Error component
function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-center">
        <div className="text-red-600 mr-3">⚠️</div>
        <div>
          <h3 className="text-sm font-medium text-red-800">Unable to load predictions</h3>
          <p className="text-sm text-red-600 mt-1">{message}</p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="mt-2 text-sm text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced ForecastCard with real data
function ForecastCard({ 
  title, 
  prediction, 
  confidence, 
  trend, 
  description,
  lastUpdated,
  dataPoints 
}: {
  title: string;
  prediction: string;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  description?: string;
  lastUpdated?: string;
  dataPoints?: number;
}) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '→';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = () => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl">{getTrendIcon()}</span>
      </div>
      
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 mb-1">{prediction}</div>
        <div className={`text-sm font-medium ${getConfidenceColor()}`}>
          {confidence}% confidence
        </div>
        {dataPoints && (
          <div className="text-xs text-gray-500 mt-1">
            Based on {dataPoints} ETFs tracked
          </div>
        )}
      </div>
      
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      
      <div className="mt-4 flex items-center justify-between">
        <div className={`text-sm font-medium ${getTrendColor()}`}>
          {trend === 'up' && 'Increasing'}
          {trend === 'down' && 'Decreasing'}
          {trend === 'stable' && 'Stable'}
        </div>
        <div className="text-xs text-gray-500">
          {lastUpdated ? `Updated ${formatLastUpdated(lastUpdated)}` : 'Unknown'}
        </div>
      </div>
    </div>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ETF Predictions Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Component Error</h3>
              <p className="text-sm text-red-600 mt-1">There was an error loading this component.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main page component with comprehensive features
export default function ETFPredictionsPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch prediction data from API
  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/etf-predictions');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('ETF Predictions API Response:', result);
        
        // Validate the response structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid API response format');
        }
        
        // Ensure we have the expected structure
        const validatedData = {
          daily: result.daily || [],
          individual: result.individual || [],
          weekly: result.weekly || { thisWeek: 0, nextWeek: 0, confidence: 0 },
          insights: result.insights || [],
          lastUpdated: result.lastUpdated || new Date().toISOString()
        };
        
        setData(validatedData);
      } catch (err) {
        console.error('Error fetching ETF predictions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Trigger re-fetch by updating a dependency
    window.location.reload();
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ETF Predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Bitcoin ETF Flow Predictions</h1>
          <p className="text-lg lg:text-xl text-blue-100">
            Comprehensive analysis and forecasting for Bitcoin ETF flows with detailed breakdowns
          </p>
          <p className="text-base lg:text-lg text-blue-200 mt-2">
            Real-time data analysis, individual ETF tracking, and trend-based predictions
          </p>
          {data?.lastUpdated && (
            <p className="text-sm text-blue-300 mt-2">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Forecasts */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Forecasts</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>
          ) : error ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <ErrorCard message={error} onRetry={handleRetry} />
              <ErrorCard message={error} onRetry={handleRetry} />
              <ErrorCard message={error} onRetry={handleRetry} />
            </div>
          ) : data && (data.daily?.length > 0 || data.individual?.length > 0) ? (
            <div className="space-y-6">
              {/* Enhanced Trading Day Context */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 text-lg">📅</span>
                  <span className="text-sm font-medium text-blue-900">Trading Day Status</span>
                </div>
                <div className="text-sm text-blue-800 mb-2">
                  {getCurrentDayContext()}
                </div>
                <div className="text-xs text-blue-600">
                  Markets open Monday-Friday, 9:30 AM - 4:00 PM ET
                </div>
              </div>
              
              {/* Smart Forecast Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {(() => {
                  const nextTradingDay = getNextTradingDayWithHolidays();
                  const nextTradingInfo = getTradingWeekInfo(nextTradingDay);
                  
                  // Calculate trading day predictions (exclude weekends and holidays)
                  const tradingDayPredictions = data.daily?.filter((_, index) => {
                    const predictionDate = new Date(data.daily[index].date);
                    return isTradingDay(predictionDate);
                  }) || [];
                  
                  return (
                    <>
                      <ForecastCard 
                        title={`Next Trading Day`}
                        prediction={`$${tradingDayPredictions[0]?.flow?.toFixed(1) || 0}M`}
                        confidence={tradingDayPredictions[0]?.confidence || 0}
                        trend={tradingDayPredictions[0]?.trend || 'stable'}
                        description={`${nextTradingInfo.description}`}
                        lastUpdated={data.lastUpdated}
                        dataPoints={data.individual?.length || 0}
                      />
                      <ForecastCard 
                        title="This Week's Total"
                        prediction={`$${data.weekly.thisWeek.toFixed(1)}M`}
                        confidence={data.weekly?.confidence || 0}
                        trend="stable"
                        description="Aggregated flow for current trading week"
                        lastUpdated={data.lastUpdated}
                        dataPoints={data.individual?.length || 0}
                      />
                      <ForecastCard 
                        title="Next Week's Total"
                        prediction={`$${data.weekly.nextWeek.toFixed(1)}M`}
                        confidence={data.weekly?.confidence || 0}
                        trend="stable"
                        description="Aggregated flow for upcoming trading week"
                        lastUpdated={data.lastUpdated}
                        dataPoints={data.individual?.length || 0}
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">⚠️</div>
                  <div className="text-sm text-yellow-800">No prediction data available</div>
                  <div className="text-xs text-yellow-600 mt-1">Check back later for updated forecasts</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">📊</div>
                  <div className="text-sm text-yellow-800">Data processing</div>
                  <div className="text-xs text-yellow-600 mt-1">ETF flow data is being analyzed</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">🔄</div>
                  <div className="text-sm text-yellow-800">Updates daily</div>
                  <div className="text-xs text-yellow-600 mt-1">Fresh predictions at 11:00 UTC</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Individual ETF Predictions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Individual ETF Analysis</h3>
            <ErrorBoundary>
              <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>}>
                <IndividualETFPredictions />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Prediction Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Flow Trends & Predictions</h3>
            <ErrorBoundary>
              <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
                <PredictionChart />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

        {/* Model Performance & Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Model Performance */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Model Performance</h3>
            <ErrorBoundary>
              <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
                <ModelPerformance />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Prediction Settings */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Prediction Settings</h3>
            <ErrorBoundary>
              <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
                <PredictionSettings />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

        {/* Data Insights */}
        {data?.insights && data.insights.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Key Insights</h3>
            <div className="space-y-2">
              {data.insights.map((insight, index) => (
                <div key={index} className="flex items-start">
                  <div className="text-blue-600 mr-2">💡</div>
                  <div className="text-sm text-gray-700">{insight}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-blue-100 rounded-lg text-blue-800 text-sm">
          <p><strong>Disclaimer:</strong> Predictions are for informational purposes only and not financial advice.</p>
          <p className="mt-1">Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}