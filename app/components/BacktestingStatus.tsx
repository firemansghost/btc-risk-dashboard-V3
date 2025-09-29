'use client';

import React, { useState, useEffect } from 'react';

interface BacktestingData {
  timestamp: string;
  lastUpdated: string;
  dataRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  metadata: {
    generatedBy: string;
    version: string;
    dataSource: string;
    analysisType: string;
  };
  summary: {
    totalDataPoints: number;
    riskBasedReturn: number;
    dcaReturn: number;
    outperformance: number;
  };
}

export default function BacktestingStatus() {
  const [backtestingData, setBacktestingData] = useState<BacktestingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBacktestingData = async () => {
      try {
        const response = await fetch('/data/weekly_backtesting_report.json');
        if (response.ok) {
          const data = await response.json();
          setBacktestingData(data);
        } else {
          setError('Backtesting data not available');
        }
      } catch (err) {
        setError('Failed to load backtesting data');
      } finally {
        setLoading(false);
      }
    };

    loadBacktestingData();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getDataAge = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else {
        return 'Just now';
      }
    } catch {
      return 'Unknown';
    }
  };

  const getStatusColor = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) return 'text-green-600 bg-green-50 border-green-200';
      if (diffDays <= 7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      return 'text-red-600 bg-red-50 border-red-200';
    } catch {
      return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading backtesting status...</span>
        </div>
      </div>
    );
  }

  if (error || !backtestingData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-sm text-red-600">Backtesting data unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Backtesting Status</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(backtestingData.lastUpdated)}`}>
          {getDataAge(backtestingData.lastUpdated)}
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Last Updated:</span>
          <span className="font-medium">{formatDate(backtestingData.lastUpdated)}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Data Range:</span>
          <span className="font-medium">
            {backtestingData.dataRange.startDate} to {backtestingData.dataRange.endDate}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Data Points:</span>
          <span className="font-medium">{backtestingData.summary.totalDataPoints.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Risk-Based Return:</span>
          <span className="font-medium text-green-600">
            {backtestingData.summary.riskBasedReturn.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>DCA Return:</span>
          <span className="font-medium text-blue-600">
            {backtestingData.summary.dcaReturn.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Outperformance:</span>
          <span className={`font-medium ${backtestingData.summary.outperformance > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {backtestingData.summary.outperformance > 0 ? '+' : ''}{backtestingData.summary.outperformance.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Updated weekly on Sundays at 11:30 UTC</span>
        </div>
      </div>
    </div>
  );
}
