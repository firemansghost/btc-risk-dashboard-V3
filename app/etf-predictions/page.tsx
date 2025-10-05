'use client';

import React, { useState, useEffect } from 'react';

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

interface WeeklyPrediction {
  thisWeek: number;
  nextWeek: number;
  confidence: number;
}

interface PredictionData {
  individual: ETFPrediction[];
  daily: DailyPrediction[];
  weekly: WeeklyPrediction;
  insights?: string[];
  lastUpdated?: string;
}

// Simplified helper functions (keeping only essential ones for the simplified page)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
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

// Simplified Loading Card
const LoadingCard: React.FC = () => (
  <div className="bg-white rounded-lg shadow-lg p-4 animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

// Simplified Error Card
const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
    <p className="font-medium">Error: {message}</p>
    <button onClick={onRetry} className="text-sm underline mt-2">Retry</button>
  </div>
);

// Simplified Forecast Card
const ForecastCard: React.FC<{
  title: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
}> = ({ title, value, description, trend }) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-blue-600';
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-2xl font-bold flex items-center gap-2">
        {value} <span className={trendColor}>{trendIcon}</span>
      </p>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  );
};

export default function ETFPredictionsPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        // Basic validation
        if (!result || typeof result !== 'object' || !result.weekly) {
          throw new Error('Invalid API response format or missing weekly data');
        }

        setData(result);
      } catch (err) {
        console.error('Error fetching ETF predictions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const nextTradingDay = getNextTradingDayWithHolidays();
  const nextTradingDayStr = nextTradingDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">ETF Flow Predictions</h1>
        <p className="text-gray-700 mb-8">
          Simplified trend-based forecasting for Bitcoin ETF flows.
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LoadingCard /><LoadingCard /><LoadingCard />
          </div>
        ) : error ? (
          <ErrorCard message={error} onRetry={handleRetry} />
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ForecastCard
              title={`Next Trading Day (${nextTradingDayStr})`}
              value={`$${data.daily[0]?.flow?.toFixed(1) || 0}M`}
              description="Predicted flow for the next market open."
              trend={data.daily[0]?.trend || 'stable'}
            />
            <ForecastCard
              title="This Week's Total"
              value={`$${data.weekly.thisWeek.toFixed(1)}M`}
              description="Aggregated flow for the current trading week."
              trend={data.weekly.thisWeek > 0 ? 'up' : data.weekly.thisWeek < 0 ? 'down' : 'stable'}
            />
            <ForecastCard
              title="Next Week's Total"
              value={`$${data.weekly.nextWeek.toFixed(1)}M`}
              description="Aggregated flow for the upcoming trading week."
              trend={data.weekly.nextWeek > 0 ? 'up' : data.weekly.nextWeek < 0 ? 'down' : 'stable'}
            />
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
            No prediction data available. Please check back later.
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-100 rounded-lg text-blue-800 text-sm">
          <p><strong>Disclaimer:</strong> Predictions are for informational purposes only and not financial advice.</p>
          <p className="mt-1">Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}