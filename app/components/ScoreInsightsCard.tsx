'use client';

import { useState, useEffect } from 'react';
import { calculateContribution, getFactorStaleness, sortFactorsByContribution, getFactorTTL } from '@/lib/factorUtils';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';

interface ScoreInsightsCardProps {
  latest: any;
  className?: string;
}

interface FactorExplanation {
  key: string;
  label: string;
  score: number;
  contribution: number;
  status: string;
  explanation: string;
  trend: string;
  context: string;
  recommendation: string;
}

interface ScoreExplanation {
  totalScore: number;
  bandLabel: string;
  overallExplanation: string;
  keyDrivers: FactorExplanation[];
  concerns: FactorExplanation[];
  insights: string[];
  recommendations: string[];
}

export default function ScoreInsightsCard({ latest, className = '' }: ScoreInsightsCardProps) {
  const [explanation, setExplanation] = useState<ScoreExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [historicalData, setHistoricalData] = useState<any>(null);

  // Load historical data for score comparison
  const loadHistoricalData = async () => {
    try {
      const response = await fetch('/api/history?range=30d', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistoricalData(data);
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  };

  // Get score changes from historical data
  const getScoreChanges = () => {
    if (!explanation || !historicalData?.points || historicalData.points.length < 2) return null;
    
    const currentScore = explanation.totalScore;
    const yesterday = historicalData.points[historicalData.points.length - 2];
    const lastWeek = historicalData.points[Math.max(0, historicalData.points.length - 8)];
    
    const yesterdayChange = currentScore - yesterday.composite;
    const lastWeekChange = currentScore - lastWeek.composite;
    
    return {
      yesterday: {
        change: yesterdayChange,
        direction: yesterdayChange > 0 ? 'up' : yesterdayChange < 0 ? 'down' : 'stable'
      },
      lastWeek: {
        change: lastWeekChange,
        direction: lastWeekChange > 0 ? 'up' : lastWeekChange < 0 ? 'down' : 'stable'
      }
    };
  };

  // Get overall score trend direction
  const getScoreTrendDirection = () => {
    const changes = getScoreChanges();
    if (!changes) return 'stable';

    // Determine trend based on both yesterday and last week changes
    const yesterdayDirection = changes.yesterday.direction;
    const lastWeekDirection = changes.lastWeek.direction;
    
    // If both point in same direction, use that direction
    if (yesterdayDirection === lastWeekDirection) {
      return yesterdayDirection;
    }
    
    // If yesterday is more significant, use yesterday
    if (Math.abs(changes.yesterday.change) > Math.abs(changes.lastWeek.change) * 0.5) {
      return yesterdayDirection;
    }
    
    // Otherwise use last week direction (longer term trend)
    return lastWeekDirection;
  };

  // Get factor momentum over time
  const getFactorMomentum = () => {
    if (!explanation || !historicalData?.points || historicalData.points.length < 2) {
      return null;
    }

    const currentFactors = explanation.keyDrivers;
    const points = historicalData.points;
    const previousPoint = points[points.length - 2]; // Yesterday's data
    
    // Calculate factor changes
    const factorMomentum = currentFactors.map(factor => {
      const currentScore = factor.score;
      const previousScore = previousPoint[factor.key] || 0;
      const change = currentScore - previousScore;
      
      let momentum = 'stable';
      if (change > 0.5) momentum = 'improving';
      else if (change < -0.5) momentum = 'declining';
      
      let context = '';
      if (momentum === 'improving') {
        context = `${factor.label} is strengthening, contributing more to risk reduction`;
      } else if (momentum === 'declining') {
        context = `${factor.label} is weakening, contributing more to risk increase`;
      } else {
        context = `${factor.label} remains stable with minimal change`;
      }
      
      return {
        key: factor.key,
        label: factor.label,
        change,
        momentum,
        context
      };
    }).filter(factor => Math.abs(factor.change) > 0.1); // Only show factors with meaningful changes
    
    // Sort by absolute change (most significant first)
    return factorMomentum.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  };

  // Get relative positioning in historical range
  const getRelativePosition = () => {
    if (!explanation || !historicalData?.points || historicalData.points.length < 1) {
      return null;
    }
    
    const currentScore = explanation.totalScore;
    const allScores = historicalData.points.map((d: any) => d.composite).filter((score: any) => !isNaN(score));
    
    if (allScores.length === 0) {
      return null;
    }
    
    // If we only have 1 data point, we can't calculate relative position
    if (allScores.length === 1) {
      return {
        percentile: 50, // Default to middle
        position: 'Average',
        positionColor: 'text-blue-600',
        minScore: currentScore,
        maxScore: currentScore,
        scoreRange: 0
      };
    }
    
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    const scoreRange = maxScore - minScore;
    const percentile = scoreRange > 0 ? ((currentScore - minScore) / scoreRange) * 100 : 50;
    
    // Determine position category
    let position = '';
    let positionColor = '';
    if (percentile >= 80) {
      position = 'High';
      positionColor = 'text-red-600';
    } else if (percentile >= 60) {
      position = 'Above Average';
      positionColor = 'text-orange-600';
    } else if (percentile >= 40) {
      position = 'Average';
      positionColor = 'text-blue-600';
    } else if (percentile >= 20) {
      position = 'Below Average';
      positionColor = 'text-green-600';
    } else {
      position = 'Low';
      positionColor = 'text-green-600';
    }
    
    return {
      percentile: Math.round(percentile),
      position,
      positionColor,
      minScore,
      maxScore,
      scoreRange
    };
  };

  // Helper function to generate factor explanations
  const generateFactorExplanation = (factor: any): FactorExplanation => {
    const contribution = calculateContribution(factor.score, factor.weight_pct) || 0;
    const isHighScore = factor.score > 60;
    const isLowScore = factor.score < 40;
    
    let explanation = '';
    let trend = '';
    let context = '';
    let recommendation = '';

    // Generate explanation based on factor type and score
    switch (factor.key) {
      case 'trend_valuation':
        if (isHighScore) {
          explanation = 'Bitcoin appears overvalued relative to historical trends';
          trend = 'declining';
          context = 'Price may be ahead of fundamentals';
          recommendation = 'Consider waiting for better entry points';
        } else if (isLowScore) {
          explanation = 'Bitcoin appears undervalued with strong momentum';
          trend = 'improving';
          context = 'Favorable risk/reward ratio';
          recommendation = 'Good opportunity for accumulation';
        } else {
          explanation = 'Bitcoin valuation is in neutral territory';
          trend = 'stable';
          context = 'Balanced risk/reward profile';
          recommendation = 'Monitor for directional signals';
        }
        break;
        
      case 'term_structure':
        if (isHighScore) {
          explanation = 'Futures markets show excessive leverage and speculation';
          trend = 'declining';
          context = 'High leverage increases volatility risk';
          recommendation = 'Reduce position size or use protective strategies';
        } else if (isLowScore) {
          explanation = 'Futures markets show healthy leverage levels';
          trend = 'improving';
          context = 'Lower speculation reduces crash risk';
          recommendation = 'Favorable conditions for building positions';
        } else {
          explanation = 'Futures markets show moderate leverage';
          trend = 'stable';
          context = 'Balanced leverage environment';
          recommendation = 'Monitor for leverage extremes';
        }
        break;
        
      case 'etf_flows':
        if (isHighScore) {
          explanation = 'ETF flows show strong institutional demand';
          trend = 'improving';
          context = 'Institutional adoption driving price support';
          recommendation = 'Positive momentum - consider trend continuation';
        } else if (isLowScore) {
          explanation = 'ETF flows show weak or negative institutional interest';
          trend = 'declining';
          context = 'Lack of institutional support';
          recommendation = 'Wait for institutional re-engagement';
        } else {
          explanation = 'ETF flows show normal institutional activity';
          trend = 'stable';
          context = 'Steady institutional participation';
          recommendation = 'Monitor for flow acceleration';
        }
        break;
        
      case 'onchain':
        if (isHighScore) {
          explanation = 'On-chain activity shows strong network usage';
          trend = 'improving';
          context = 'High network activity indicates adoption';
          recommendation = 'Network fundamentals are strong';
        } else if (isLowScore) {
          explanation = 'On-chain activity shows weak network usage';
          trend = 'declining';
          context = 'Low activity may indicate disinterest';
          recommendation = 'Monitor for network activity recovery';
        } else {
          explanation = 'On-chain activity shows normal network usage';
          trend = 'stable';
          context = 'Steady network fundamentals';
          recommendation = 'Network health is balanced';
        }
        break;
        
      case 'macro':
        if (isHighScore) {
          explanation = 'Macro conditions favor risk assets';
          trend = 'improving';
          context = 'Favorable monetary and economic environment';
          recommendation = 'Macro tailwinds support Bitcoin';
        } else if (isLowScore) {
          explanation = 'Macro conditions are challenging for risk assets';
          trend = 'declining';
          context = 'Unfavorable monetary or economic environment';
          recommendation = 'Macro headwinds may pressure Bitcoin';
        } else {
          explanation = 'Macro conditions are neutral for risk assets';
          trend = 'stable';
          context = 'Mixed macro signals';
          recommendation = 'Monitor macro developments';
        }
        break;
        
      default:
        explanation = `Factor shows ${isHighScore ? 'high' : isLowScore ? 'low' : 'moderate'} risk levels`;
        trend = isHighScore ? 'declining' : isLowScore ? 'improving' : 'stable';
        context = 'Factor contributing to overall risk assessment';
        recommendation = 'Monitor factor for changes';
    }

    return {
      key: factor.key,
      label: factor.label,
      score: factor.score,
      contribution,
      status: factor.status,
      explanation,
      trend,
      context,
      recommendation
    };
  };

  useEffect(() => {
    if (!latest?.factors) {
      setLoading(false);
      return;
    }

    // Load historical data for score comparison
    loadHistoricalData();

    try {
      const factors = latest.factors || [];
      const activeFactors = factors.filter((f: any) => f.status === 'fresh');
      const excludedFactors = factors.filter((f: any) => f.status !== 'fresh');
      
      // Generate explanations for all factors
      const factorExplanations = factors.map(generateFactorExplanation);
      
      // Sort by contribution to find key drivers
      const sortedByContribution = factorExplanations.sort((a: FactorExplanation, b: FactorExplanation) => b.contribution - a.contribution);
      const keyDrivers = sortedByContribution.slice(0, 3);
      
      // Find concerns (high scores or excluded factors)
      const concerns = factorExplanations.filter((f: FactorExplanation) => f.score > 60 || f.status !== 'fresh');
      
      // Generate overall explanation
      const bandLabel = latest.band?.label || 'Unknown';
      const totalScore = latest.composite_score;
      
      let overallExplanation = '';
      if (totalScore < 40) {
        overallExplanation = `Your G-Score of ${totalScore} indicates lower risk conditions. This suggests Bitcoin may be undervalued with favorable fundamentals.`;
      } else if (totalScore > 60) {
        overallExplanation = `Your G-Score of ${totalScore} indicates higher risk conditions. This suggests Bitcoin may be overvalued or facing headwinds.`;
      } else {
        overallExplanation = `Your G-Score of ${totalScore} indicates moderate risk conditions. This suggests Bitcoin is in a balanced state with mixed signals.`;
      }
      
      // Generate insights
      const insights = [
        `${activeFactors.length} of ${factors.length} factors are active`,
        excludedFactors.length > 0 ? `${excludedFactors.length} factors excluded due to staleness` : 'All factors are fresh',
        `Currently in "${bandLabel}" risk band`
      ];
      
      // Generate recommendations
      const recommendations = [
        totalScore < 40 ? 'Consider accumulating on weakness' : 
        totalScore > 60 ? 'Consider reducing position size' : 
        'Monitor for directional signals',
        concerns.length > 0 ? 'Watch for factor improvements' : 'All factors are healthy',
        'Review alerts for specific factor changes'
      ];
      
      const scoreExplanation: ScoreExplanation = {
        totalScore,
        bandLabel,
        overallExplanation,
        keyDrivers,
        concerns,
        insights,
        recommendations
      };

      setExplanation(scoreExplanation);
    } catch (error) {
      console.error('Error calculating score explanation:', error);
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

  if (!explanation) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Score Insights</h3>
        <p className="text-sm text-gray-500">Unable to load insights</p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 40) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score < 40) return 'bg-green-50 border-green-200';
    if (score < 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getFactorIcon = (factorKey: string) => {
    switch (factorKey) {
      case 'trend_valuation': return '📈';
      case 'term_structure': return '⚖️';
      case 'etf_flows': return '🏦';
      case 'onchain': return '⛓️';
      case 'macro': return '🌍';
      case 'stablecoins': return '🪙';
      case 'net_liquidity': return '💧';
      case 'social_interest': return '👥';
      default: return '📊';
    }
  };

  const getContributionColor = (contribution: number) => {
    if (contribution > 5) return 'bg-green-500';
    if (contribution > 2) return 'bg-blue-500';
    if (contribution > 0) return 'bg-yellow-500';
    return 'bg-gray-400';
  };


  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Score Insights</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? 'Show Less' : 'Show More'}
        </button>
      </div>

      {/* Score Visualization */}
      <div className={`mb-4 p-3 rounded-lg border ${getScoreBgColor(explanation.totalScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-sm font-medium text-gray-700">G-Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getScoreColor(explanation.totalScore)}`}>
              {explanation.totalScore}
            </span>
            <span className="text-xs text-gray-500">/ 100</span>
          </div>
        </div>
        
        {/* Score Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              explanation.totalScore < 40 ? 'bg-green-500' : 
              explanation.totalScore < 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${explanation.totalScore}%` }}
          ></div>
        </div>
        
        {/* Risk Band Indicator */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Risk Level</span>
          <span className={`font-medium ${getScoreColor(explanation.totalScore)}`}>
            {explanation.bandLabel}
          </span>
        </div>
        
        {/* Relative Position Indicator */}
        {getRelativePosition() ? (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Historical Position</span>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${getRelativePosition()!.positionColor}`}>
                  {getRelativePosition()!.position}
                </span>
                <span className="text-gray-500">
                  ({getRelativePosition()!.percentile}th percentile)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Historical Position</span>
              <span className="text-gray-400">Loading...</span>
            </div>
          </div>
        )}
        
        {/* Score Change Indicators */}
        {getScoreChanges() && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">vs Yesterday</span>
                <div className="flex items-center gap-1">
                  {getScoreChanges()!.yesterday.direction === 'up' ? (
                    <span className="text-red-500">📈 +{getScoreChanges()!.yesterday.change.toFixed(1)}</span>
                  ) : getScoreChanges()!.yesterday.direction === 'down' ? (
                    <span className="text-green-500">📉 {getScoreChanges()!.yesterday.change.toFixed(1)}</span>
                  ) : (
                    <span className="text-gray-500">➡️ 0.0</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">vs Last Week</span>
                <div className="flex items-center gap-1">
                  {getScoreChanges()!.lastWeek.direction === 'up' ? (
                    <span className="text-red-500">📈 +{getScoreChanges()!.lastWeek.change.toFixed(1)}</span>
                  ) : getScoreChanges()!.lastWeek.direction === 'down' ? (
                    <span className="text-green-500">📉 {getScoreChanges()!.lastWeek.change.toFixed(1)}</span>
                  ) : (
                    <span className="text-gray-500">➡️ 0.0</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Trend Indicators */}
        {getScoreChanges() && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
              <span>📈</span>
              <span>Score Trend</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <span className="text-sm font-medium text-gray-700">Trajectory</span>
              </div>
              <div className="flex items-center gap-2">
                {getScoreTrendDirection() === 'up' ? (
                  <span className="text-red-600 text-sm font-semibold flex items-center gap-1">
                    <span>📈</span>
                    <span>Rising</span>
                  </span>
                ) : getScoreTrendDirection() === 'down' ? (
                  <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                    <span>📉</span>
                    <span>Falling</span>
                  </span>
                ) : (
                  <span className="text-gray-600 text-sm font-semibold flex items-center gap-1">
                    <span>➡️</span>
                    <span>Stable</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overall Explanation */}
      <div className="mb-4">
        <div className="text-sm text-gray-700 leading-relaxed">
          {explanation.overallExplanation}
        </div>
      </div>

      {/* Factor Momentum */}
      {getFactorMomentum() && (
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-600 mb-3 flex items-center gap-2">
            <span>📊</span>
            <span>Factor Momentum</span>
          </div>
          <div className="space-y-3">
            {getFactorMomentum()!.slice(0, expanded ? undefined : 3).map((factor, idx) => (
              <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFactorIcon(factor.key)}</span>
                    <span className="text-sm font-medium text-gray-900">{factor.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${factor.momentum === 'improving' ? 'text-green-600' : factor.momentum === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                      {factor.momentum === 'improving' ? '📈' : factor.momentum === 'declining' ? '📉' : '➡️'} {factor.momentum}
                    </span>
                    <span className="text-xs text-gray-500">
                      {factor.change > 0 ? '+' : ''}{factor.change.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                {/* Momentum Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Change</span>
                    <span>{factor.change > 0 ? '+' : ''}{factor.change.toFixed(1)} points</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${factor.momentum === 'improving' ? 'bg-green-500' : factor.momentum === 'declining' ? 'bg-red-500' : 'bg-gray-400'}`}
                      style={{ width: `${Math.min(100, Math.abs(factor.change) * 10)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600">
                  {factor.context}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Drivers */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Key Drivers</div>
        <div className="space-y-2">
          {explanation.keyDrivers.slice(0, expanded ? undefined : 2).map((driver, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFactorIcon(driver.key)}</span>
                  <span className="text-sm font-medium text-gray-900">{driver.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">
                    +{driver.contribution.toFixed(1)}
                  </span>
                  <span className={`text-xs ${getTrendColor(driver.trend)}`}>
                    {getTrendIcon(driver.trend)}
                  </span>
                </div>
              </div>
              
              {/* Contribution Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Contribution</span>
                  <span>{driver.contribution.toFixed(1)} points</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${getContributionColor(driver.contribution)}`}
                    style={{ width: `${Math.min(driver.contribution * 10, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="text-xs text-gray-600 mb-1">{driver.explanation}</div>
              <div className="text-xs text-blue-600 italic">{driver.context}</div>
            </div>
          ))}
          {!expanded && explanation.keyDrivers.length > 2 && (
            <div className="text-xs text-gray-500 text-center py-1">
              +{explanation.keyDrivers.length - 2} more drivers
            </div>
          )}
        </div>
      </div>


      {/* Concerns */}
      {explanation.concerns.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-600 mb-2">Areas of Concern</div>
          <div className="space-y-2">
            {explanation.concerns.slice(0, expanded ? undefined : 2).map((concern, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFactorIcon(concern.key)}</span>
                    <span className="text-sm font-medium text-gray-900">{concern.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getScoreColor(concern.score)}`}>
                      {concern.score}
                    </span>
                    {concern.status !== 'fresh' && (
                      <span className="text-xs text-red-500" title="Data is stale">⚠️</span>
                    )}
                    <span className={`text-xs ${getTrendColor(concern.trend)}`}>
                      {getTrendIcon(concern.trend)}
                    </span>
                  </div>
                </div>
                
                {/* Score Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Risk Level</span>
                    <span>{concern.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${
                        concern.score < 40 ? 'bg-green-500' : 
                        concern.score < 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${concern.score}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-1">{concern.explanation}</div>
                <div className="text-xs text-red-600 italic">{concern.recommendation}</div>
              </div>
            ))}
            {!expanded && explanation.concerns.length > 2 && (
              <div className="text-xs text-gray-500 text-center py-1">
                +{explanation.concerns.length - 2} more concerns
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Current Status</div>
        <div className="space-y-2">
          {explanation.insights.map((insight, idx) => (
            <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="text-xs text-gray-700 flex items-center gap-2">
                <span className="text-blue-500">📊</span>
                <span>{insight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs font-medium text-gray-600 mb-2">Recommendations</div>
        <div className="space-y-2">
          {explanation.recommendations.map((rec, idx) => (
            <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-2">
              <div className="text-xs text-green-700 flex items-center gap-2">
                <span className="text-green-500">💡</span>
                <span>{rec}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
