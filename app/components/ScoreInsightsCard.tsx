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
      const concerns = factorExplanations.filter(f => f.score > 60 || f.status !== 'fresh');
      
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

      {/* Overall Explanation */}
      <div className="mb-4">
        <div className="text-sm text-gray-700 leading-relaxed">
          {explanation.overallExplanation}
        </div>
      </div>

      {/* Key Drivers */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Key Drivers</div>
        <div className="space-y-2">
          {explanation.keyDrivers.slice(0, expanded ? undefined : 2).map((driver, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">{driver.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">
                    +{driver.contribution.toFixed(1)}
                  </span>
                  <span className={`text-xs ${getTrendColor(driver.trend)}`}>
                    {getTrendIcon(driver.trend)}
                  </span>
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
              <div key={idx} className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{concern.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-600">
                      {concern.score}
                    </span>
                    {concern.status !== 'fresh' && (
                      <span className="text-xs text-red-500">❌</span>
                    )}
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
        <div className="space-y-1">
          {explanation.insights.map((insight, idx) => (
            <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
              <span className="text-blue-500">•</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs font-medium text-gray-600 mb-2">Recommendations</div>
        <div className="space-y-1">
          {explanation.recommendations.map((rec, idx) => (
            <div key={idx} className="text-xs text-green-600 flex items-center gap-2">
              <span className="text-green-500">💡</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
