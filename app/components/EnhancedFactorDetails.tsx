'use client';

import React, { useState, useEffect } from 'react';

interface FactorAnalysisData {
  volatility: {
    [key: string]: {
      currentScore: number;
      stdDev: number;
      range: number;
      min: number;
      max: number;
      mean: number;
      coefficientOfVariation: number;
      volatilityLevel: string;
      stabilityLevel: string;
      riskScore: number;
      trend: number;
    };
  };
  correlation: {
    [key: string]: {
      [key: string]: number;
    };
  };
  attribution: {
    [key: string]: {
      totalContribution: number;
      avgContribution: number;
      impactScore: number;
      positiveDays: number;
      negativeDays: number;
      contributionFrequency: string;
    };
  };
}

interface EnhancedFactorDetailsProps {
  factorKey: string;
  factorLabel: string;
  currentScore: number;
  factorWeight?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function EnhancedFactorDetails({ 
  factorKey, 
  factorLabel, 
  currentScore, 
  factorWeight,
  isOpen, 
  onClose 
}: EnhancedFactorDetailsProps) {
  const [analysisData, setAnalysisData] = useState<FactorAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchAnalysisData() {
      setLoading(true);
      setError(null);

      try {
        const [volatilityRes, correlationRes, attributionRes] = await Promise.all([
          fetch('/data/factor_volatility_metrics.json', { cache: 'no-store' }),
          fetch('/data/factor_correlation_analysis.json', { cache: 'no-store' }),
          fetch('/data/factor_performance_attribution.json', { cache: 'no-store' })
        ]);

        if (!volatilityRes.ok || !correlationRes.ok || !attributionRes.ok) {
          throw new Error(`Failed to fetch analysis data: ${volatilityRes.status} ${correlationRes.status} ${attributionRes.status}`);
        }

        const [volatility, correlation, attribution] = await Promise.all([
          volatilityRes.json(),
          correlationRes.json(),
          attributionRes.json()
        ]);

        // Check if the data structure is correct
        if (!volatility.factors || !correlation.correlationMatrix) {
          throw new Error('Invalid data structure in analysis files');
        }

        setAnalysisData({
          volatility: volatility.factors,
          correlation: correlation.correlationMatrix,
          attribution: attribution.factors || {} // Handle missing attribution data
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analysis data');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysisData();
  }, [isOpen, factorKey]);

  if (!isOpen) return null;

  const factorData = analysisData?.volatility?.[factorKey];
  const correlationData = analysisData?.correlation?.[factorKey];
  const attributionData = analysisData?.attribution?.[factorKey];

  const getVolatilityColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStabilityColor = (level: string) => {
    switch (level) {
      case 'Very Stable': return 'text-green-600 bg-green-50 border-green-200';
      case 'Moderately Stable': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Less Stable': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendDirection = (trend: number) => {
    if (trend > 5) return { direction: '↗️ Rising', color: 'text-red-600' };
    if (trend < -5) return { direction: '↘️ Falling', color: 'text-green-600' };
    return { direction: '→ Stable', color: 'text-gray-600' };
  };

  const getCorrelationStrength = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return { strength: 'Strong', color: 'text-red-600' };
    if (abs >= 0.5) return { strength: 'Moderate', color: 'text-yellow-600' };
    if (abs >= 0.3) return { strength: 'Weak', color: 'text-blue-600' };
    return { strength: 'None', color: 'text-gray-600' };
  };

  const getTopCorrelations = () => {
    if (!correlationData) return [];
    
    const correlations = Object.entries(correlationData)
      .filter(([key, value]) => key !== factorKey && typeof value === 'number')
      .map(([key, value]) => ({ factor: key, correlation: value }))
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 3);

    return correlations;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading enhanced factor details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topCorrelations = getTopCorrelations();
  const trendInfo = factorData ? getTrendDirection(factorData.trend) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Enhanced Factor Analysis</h2>
              <p className="text-gray-600">{factorLabel} - Current Score: {currentScore}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* Factor Weight */}
          {factorWeight !== undefined && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-3">⚖️ Factor Weight in G-Score</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold mb-2">{factorWeight.toFixed(1)}%</div>
                  <div className="text-blue-100 text-sm">Weight in Composite Score</div>
                </div>
                <div>
                  <div className="text-lg font-semibold mb-2">Impact Calculation</div>
                  <div className="text-blue-100 text-sm">
                    This factor contributes {factorWeight.toFixed(1)}% to the overall Bitcoin G-Score calculation
                  </div>
                </div>
              </div>
              <div className="mt-4 bg-white/20 rounded-lg p-4">
                <div className="text-sm font-medium mb-2">Weight Context:</div>
                <div className="text-sm text-blue-100">
                  {factorWeight >= 20 ? 'High Impact' : 
                   factorWeight >= 10 ? 'Medium Impact' : 
                   'Lower Impact'} - {factorWeight >= 20 ? 'This is a major driver of the G-Score' :
                   factorWeight >= 10 ? 'This factor has moderate influence' :
                   'This factor has smaller but still meaningful influence'}
                </div>
              </div>
            </div>
          )}
          
          {/* Volatility & Risk Metrics */}
          {factorData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">📊 Volatility Analysis</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${getVolatilityColor(factorData.volatilityLevel)}`}>
                    <div className="text-sm font-medium">Volatility Level</div>
                    <div className="text-lg font-bold">{factorData.volatilityLevel}</div>
                    <div className="text-xs">StdDev: {factorData.stdDev.toFixed(1)}</div>
                  </div>
                  
                  <div className={`p-4 rounded-lg border ${getStabilityColor(factorData.stabilityLevel)}`}>
                    <div className="text-sm font-medium">Stability</div>
                    <div className="text-lg font-bold">{factorData.stabilityLevel}</div>
                    <div className="text-xs">CoV: {factorData.coefficientOfVariation.toFixed(3)}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Risk Score</div>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{factorData.riskScore}/100</div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${factorData.riskScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">📈 Trend Analysis</h3>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">30-Day Trend</div>
                  <div className={`text-lg font-bold ${trendInfo?.color}`}>
                    {trendInfo?.direction}
                  </div>
                  <div className="text-xs text-gray-600">
                    Change: {factorData.trend > 0 ? '+' : ''}{factorData.trend.toFixed(1)} points
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm font-medium text-blue-800">Range</div>
                    <div className="text-lg font-bold text-blue-900">{factorData.range} points</div>
                    <div className="text-xs text-blue-700">
                      {factorData.min} - {factorData.max}
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm font-medium text-purple-800">Data Points</div>
                    <div className="text-lg font-bold text-purple-900">30 days</div>
                    <div className="text-xs text-purple-700">Historical baseline</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Data Not Available</h3>
              <p className="text-yellow-700">
                Enhanced factor analysis data is not available for {factorLabel}. 
                This may be because the analysis scripts haven't been run yet or the data is still being generated.
              </p>
            </div>
          )}

          {/* Correlation Analysis */}
          {topCorrelations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Factor Correlations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topCorrelations.map((corr, index) => {
                  const strength = getCorrelationStrength(corr.correlation);
                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        {corr.factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className={`text-lg font-bold ${strength.color}`}>
                        {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(3)}
                      </div>
                      <div className="text-xs text-gray-600">{strength.strength}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Performance Attribution */}
          {attributionData && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Performance Attribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm font-medium text-green-800 mb-2">Total Contribution</div>
                  <div className="text-2xl font-bold text-green-900">
                    {attributionData.totalContribution > 0 ? '+' : ''}{attributionData.totalContribution.toFixed(1)}
                  </div>
                  <div className="text-xs text-green-700">G-Score points</div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-medium text-blue-800 mb-2">Impact Score</div>
                  <div className="text-2xl font-bold text-blue-900">{attributionData.impactScore.toFixed(1)}</div>
                  <div className="text-xs text-blue-700">Relative influence</div>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Positive Days</div>
                  <div className="text-lg font-bold text-green-600">{attributionData.positiveDays}</div>
                  <div className="text-xs text-gray-600">Days with positive impact</div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Negative Days</div>
                  <div className="text-lg font-bold text-red-600">{attributionData.negativeDays}</div>
                  <div className="text-xs text-gray-600">Days with negative impact</div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Frequency</div>
                  <div className="text-lg font-bold text-blue-600">{attributionData.contributionFrequency}</div>
                  <div className="text-xs text-gray-600">Active contribution rate</div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Key Insights</h3>
            <div className="space-y-2 text-sm text-blue-800">
              {factorData && (
                <>
                  <p>• <strong>Volatility:</strong> {factorData.volatilityLevel.toLowerCase()} with {factorData.stabilityLevel.toLowerCase()} behavior</p>
                  <p>• <strong>Trend:</strong> {trendInfo?.direction} over the past 30 days</p>
                  <p>• <strong>Risk Level:</strong> {factorData.riskScore}/100 risk score based on historical volatility</p>
                </>
              )}
              {topCorrelations.length > 0 && (
                <p>• <strong>Correlations:</strong> Most correlated with {topCorrelations[0].factor.replace(/_/g, ' ')} ({topCorrelations[0].correlation > 0 ? '+' : ''}{topCorrelations[0].correlation.toFixed(3)})</p>
              )}
              {attributionData && (
                <p>• <strong>Impact:</strong> {attributionData.contributionFrequency} active contribution rate with {attributionData.impactScore.toFixed(1)} impact score</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
