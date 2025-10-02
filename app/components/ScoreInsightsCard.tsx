'use client';

import { useState, useEffect } from 'react';
import { calculateContribution, getFactorStaleness, sortFactorsByContribution, getFactorTTL } from '@/lib/factorUtils';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';

interface ScoreInsightsCardProps {
  latest: any;
  className?: string;
}

interface FactorInsight {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  status: string;
  reason: string;
  change?: number;
  trend?: string;
}

interface ScoreInsight {
  totalScore: number;
  activeFactors: number;
  excludedFactors: number;
  topContributor: FactorInsight;
  biggestChange: FactorInsight;
  stalenessIssues: FactorInsight[];
  trend: string;
  bandDuration?: number;
}

export default function ScoreInsightsCard({ latest, className = '' }: ScoreInsightsCardProps) {
  const [insights, setInsights] = useState<ScoreInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!latest?.factors) {
      setLoading(false);
      return;
    }

    try {
      // Calculate factor insights
      const factors = latest.factors || [];
      const activeFactors = factors.filter((f: any) => f.status === 'fresh');
      const excludedFactors = factors.filter((f: any) => f.status !== 'fresh');
      
      // Calculate contributions
      const factorInsights: FactorInsight[] = factors.map((factor: any) => {
        const contribution = calculateContribution(factor.score, factor.weight_pct);
        return {
          key: factor.key,
          label: factor.label,
          score: factor.score,
          weight: factor.weight_pct,
          contribution,
          status: factor.status,
          reason: factor.reason
        };
      });

      // Sort by contribution
      const sortedFactors = factorInsights.sort((a, b) => b.contribution - a.contribution);
      
      // Find top contributor
      const topContributor = sortedFactors[0];
      
      // Find biggest change (would need historical data for this)
      const biggestChange = sortedFactors.find(f => f.status === 'fresh') || sortedFactors[0];
      
      // Find staleness issues
      const stalenessIssues = factorInsights.filter(f => f.status !== 'fresh');
      
      // Determine overall trend (simplified)
      const trend = latest.composite_score > 50 ? 'Higher Risk' : 'Lower Risk';
      
      const scoreInsight: ScoreInsight = {
        totalScore: latest.composite_score,
        activeFactors: activeFactors.length,
        excludedFactors: excludedFactors.length,
        topContributor,
        biggestChange,
        stalenessIssues,
        trend
      };

      setInsights(scoreInsight);
    } catch (error) {
      console.error('Error calculating score insights:', error);
    } finally {
      setLoading(false);
    }
  }, [latest]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Score Insights</h3>
        <p className="text-sm text-gray-500">Unable to load insights</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'text-green-600';
      case 'stale': return 'text-yellow-600';
      case 'stale_beyond_ttl': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fresh': return '✅';
      case 'stale': return '⚠️';
      case 'stale_beyond_ttl': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Score Insights</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? 'Show Less' : 'Show More'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{insights.totalScore}</div>
          <div className="text-xs text-gray-500">Current Score</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{insights.activeFactors}</div>
          <div className="text-xs text-gray-500">Active Factors</div>
        </div>
      </div>

      {/* Top Contributor */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Top Contributor</div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">{insights.topContributor.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-600">
              +{insights.topContributor.contribution.toFixed(1)}
            </span>
            <span className={`text-xs ${getStatusColor(insights.topContributor.status)}`}>
              {getStatusIcon(insights.topContributor.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Staleness Issues */}
      {insights.stalenessIssues.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Excluded Factors</div>
          <div className="space-y-1">
            {insights.stalenessIssues.slice(0, expanded ? undefined : 2).map((factor, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{factor.label}</span>
                <span className="text-red-500">{factor.reason}</span>
              </div>
            ))}
            {!expanded && insights.stalenessIssues.length > 2 && (
              <div className="text-xs text-gray-500">
                +{insights.stalenessIssues.length - 2} more excluded
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Factor Breakdown</div>
            {insights.topContributor && (
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-700">{insights.topContributor.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{insights.topContributor.score}</span>
                    <span className="text-blue-600">+{insights.topContributor.contribution.toFixed(1)}</span>
                    <span className="text-gray-500">({insights.topContributor.weight}%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend Indicator */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Overall Trend</span>
          <span className={`font-medium ${insights.trend === 'Higher Risk' ? 'text-red-600' : 'text-green-600'}`}>
            {insights.trend === 'Higher Risk' ? '📈 Higher Risk' : '📉 Lower Risk'}
          </span>
        </div>
      </div>
    </div>
  );
}
