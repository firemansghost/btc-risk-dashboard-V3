'use client';

import { useState, useEffect } from 'react';
import { calculateContribution, getFactorStaleness, sortFactorsByContribution, getFactorTTL } from '@/lib/factorUtils';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import MobileCollapsible from './MobileCollapsible';
import SkeletonLoader, { SkeletonCard } from './SkeletonLoader';

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
  keyDrivers: FactorExplanation[];
  /** All factors sorted by contribution (desc); used for "Current read" and diagnostics */
  factorsByContribution: FactorExplanation[];
}

/** Compact, factor-grounded copy for Pass 1 merged narrative (no scoring math). */
function buildCurrentReadLines(ex: ScoreExplanation): {
  driverLine: string;
  stabilizerLine: string;
  contextLine: string;
  stanceLine: string;
} {
  const freshSorted = ex.factorsByContribution.filter((f) => f.status === 'fresh');
  const topDrivers = freshSorted.slice(0, 2);
  const driverLine =
    topDrivers.length > 0
      ? `Top contributors: ${topDrivers.map((d) => `${d.label} (${Math.round(d.score)})`).join(' · ')}`
      : 'No fresh factors to rank by contribution.';

  const mitigating = [...freshSorted].sort((a, b) => a.score - b.score);
  const stabilizerLine =
    mitigating.length > 0
      ? `Offset: ${mitigating[0].label} (${Math.round(mitigating[0].score)}) — lowest score among fresh factors.`
      : '—';

  const contextLine = `${ex.bandLabel} · composite ${ex.totalScore}/100`;

  const s = ex.totalScore;
  let stanceLine = '';
  if (s >= 65) {
    stanceLine = 'Elevated risk — ease new exposure until headline drivers cool.';
  } else if (s >= 50) {
    stanceLine = 'Hold core; stay selective — avoid chasing strength without a plan.';
  } else if (s >= 35) {
    stanceLine = 'Moderate risk — add size mainly on planned pullbacks.';
  } else {
    stanceLine = 'Lower-risk band historically — still keep sizing disciplined.';
  }

  return { driverLine, stabilizerLine, contextLine, stanceLine };
}

export default function ScoreInsightsCard({ latest, className = '' }: ScoreInsightsCardProps) {
  const [explanation, setExplanation] = useState<ScoreExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState({
    factorVolatility: false,
    factorMomentum: false,
    factorCorrelations: false,
    riskConcentration: true,
    dataConfidence: true,
  });

  // Toggle individual section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  // Load factor analysis data
  const [factorAnalysisData, setFactorAnalysisData] = useState<any>(null);
  
  const loadFactorAnalysisData = async () => {
    try {
      const [volatilityRes, correlationRes] = await Promise.all([
        fetch('/data/factor_volatility_metrics.json', { cache: 'no-store' }),
        fetch('/data/factor_correlation_analysis.json', { cache: 'no-store' })
      ]);
      
      if (volatilityRes.ok && correlationRes.ok) {
        const [volatility, correlation] = await Promise.all([
          volatilityRes.json(),
          correlationRes.json()
        ]);
        
        setFactorAnalysisData({
          volatility: volatility.factors,
          correlation: correlation.correlationMatrix
        });
      }
    } catch (error) {
      console.error('Error loading factor analysis data:', error);
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

  // Get data confidence analysis
  const getDataConfidence = () => {
    if (!explanation || !explanation.keyDrivers || explanation.keyDrivers.length === 0) {
      console.log('getDataConfidence: Insufficient data', {
        hasExplanation: !!explanation,
        keyDriversLength: explanation?.keyDrivers?.length || 0
      });
      return null;
    }

    const factors = explanation.keyDrivers;
    
    // Calculate confidence for each factor
    const factorConfidences = factors.map(factor => {
      // Determine data staleness
      let stalenessLevel = 'fresh';
      let stalenessHours = 0;
      let stalenessIcon = '🟢';
      let stalenessColor = 'green';
      let stalenessText = 'Fresh';
      
      if (factor.status === 'stale') {
        stalenessLevel = 'stale';
        stalenessHours = 6; // Assume 6 hours for stale
        stalenessIcon = '🟡';
        stalenessColor = 'yellow';
        stalenessText = 'Stale';
      } else if (factor.status === 'very_stale') {
        stalenessLevel = 'very_stale';
        stalenessHours = 24; // Assume 24 hours for very stale
        stalenessIcon = '🔴';
        stalenessColor = 'red';
        stalenessText = 'Very Stale';
      }
      
      // Calculate confidence level based on staleness and other factors
      let confidenceLevel = 'high';
      let confidenceIcon = '🟢';
      let confidenceColor = 'green';
      let confidenceText = 'High';
      let confidenceScore = 90;
      
      if (stalenessLevel === 'stale') {
        confidenceLevel = 'medium';
        confidenceIcon = '🟡';
        confidenceColor = 'yellow';
        confidenceText = 'Medium';
        confidenceScore = 70;
      } else if (stalenessLevel === 'very_stale') {
        confidenceLevel = 'low';
        confidenceIcon = '🔴';
        confidenceColor = 'red';
        confidenceText = 'Low';
        confidenceScore = 40;
      }
      
      // Generate confidence context
      let confidenceContext = '';
      if (confidenceLevel === 'high') {
        confidenceContext = 'Data is fresh and reliable';
      } else if (confidenceLevel === 'medium') {
        confidenceContext = 'Data is somewhat stale but still usable';
      } else {
        confidenceContext = 'Data is very stale and may not reflect current conditions';
      }
      
      return {
        key: factor.key,
        label: factor.label,
        stalenessLevel,
        stalenessHours,
        stalenessIcon,
        stalenessColor,
        stalenessText,
        confidenceLevel,
        confidenceIcon,
        confidenceColor,
        confidenceText,
        confidenceScore,
        confidenceContext
      };
    });
    
    // Calculate overall confidence
    const totalConfidenceScore = factorConfidences.reduce((sum, factor) => sum + factor.confidenceScore, 0);
    const averageConfidenceScore = totalConfidenceScore / factorConfidences.length;
    
    let overallConfidenceLevel = 'high';
    let overallConfidenceIcon = '🟢';
    let overallConfidenceColor = 'green';
    let overallConfidenceText = 'High';
    
    if (averageConfidenceScore < 60) {
      overallConfidenceLevel = 'low';
      overallConfidenceIcon = '🔴';
      overallConfidenceColor = 'red';
      overallConfidenceText = 'Low';
    } else if (averageConfidenceScore < 80) {
      overallConfidenceLevel = 'medium';
      overallConfidenceIcon = '🟡';
      overallConfidenceColor = 'yellow';
      overallConfidenceText = 'Medium';
    }
    
    // Generate overall confidence insight
    const staleFactors = factorConfidences.filter(f => f.stalenessLevel !== 'fresh');
    const lowConfidenceFactors = factorConfidences.filter(f => f.confidenceLevel === 'low');
    
    let overallInsight = '';
    let overallRecommendation = '';
    
    if (staleFactors.length === 0) {
      overallInsight = 'All data sources are fresh and reliable';
      overallRecommendation = 'Data quality is excellent - proceed with confidence';
    } else if (staleFactors.length === 1) {
      overallInsight = `1 factor has stale data: ${staleFactors[0].label}`;
      overallRecommendation = `Monitor ${staleFactors[0].label} for updates`;
    } else {
      overallInsight = `${staleFactors.length} factors have stale data: ${staleFactors.map(f => f.label).join(', ')}`;
      overallRecommendation = `Monitor ${staleFactors.map(f => f.label).join(', ')} for updates`;
    }
    
    console.log('getDataConfidence: Analysis complete', {
      averageConfidenceScore,
      overallConfidenceLevel,
      staleFactorsCount: staleFactors.length,
      lowConfidenceFactorsCount: lowConfidenceFactors.length
    });
    
    return {
      overallConfidenceLevel,
      overallConfidenceIcon,
      overallConfidenceColor,
      overallConfidenceText,
      averageConfidenceScore,
      factorConfidences,
      staleFactors,
      lowConfidenceFactors,
      overallInsight,
      overallRecommendation
    };
  };

  // Get risk concentration analysis
  const getRiskConcentration = () => {
    if (!explanation || !explanation.keyDrivers || explanation.keyDrivers.length === 0) {
      console.log('getRiskConcentration: Insufficient data', {
        hasExplanation: !!explanation,
        keyDriversLength: explanation?.keyDrivers?.length || 0
      });
      return null;
    }

    const factors = explanation.keyDrivers;
    
    // Calculate total contribution from all factors
    const totalContribution = factors.reduce((sum, factor) => sum + Math.abs(factor.contribution), 0);
    
    if (totalContribution === 0) {
      console.log('getRiskConcentration: No contributions found');
      return null;
    }
    
    // Calculate each factor's percentage of total risk
    const factorContributions = factors.map(factor => ({
      key: factor.key,
      label: factor.label,
      contribution: factor.contribution,
      absoluteContribution: Math.abs(factor.contribution),
      percentage: (Math.abs(factor.contribution) / totalContribution) * 100,
      trend: factor.trend
    }));
    
    // Sort by absolute contribution (highest first)
    const sortedContributions = factorContributions.sort((a, b) => b.absoluteContribution - a.absoluteContribution);
    
    // Calculate concentration metrics
    const top2Percentage = sortedContributions.slice(0, 2).reduce((sum, factor) => sum + factor.percentage, 0);
    const top3Percentage = sortedContributions.slice(0, 3).reduce((sum, factor) => sum + factor.percentage, 0);
    
    // Determine concentration level
    let concentrationLevel = 'low';
    let concentrationColor = 'green';
    let concentrationIcon = '🟢';
    let concentrationText = 'Low';
    
    if (top2Percentage >= 70) {
      concentrationLevel = 'high';
      concentrationColor = 'red';
      concentrationIcon = '🔴';
      concentrationText = 'High';
    } else if (top2Percentage >= 50) {
      concentrationLevel = 'medium';
      concentrationColor = 'yellow';
      concentrationIcon = '🟡';
      concentrationText = 'Medium';
    }
    
    // Get top 2 factors for context
    const top2Factors = sortedContributions.slice(0, 2);
    const top2FactorNames = top2Factors.map(f => f.label).join(' and ');
    
    // Generate concentration insights
    let concentrationInsight = '';
    let recommendation = '';
    
    if (concentrationLevel === 'high') {
      concentrationInsight = `Risk is highly concentrated - ${top2Percentage.toFixed(0)}% comes from ${top2FactorNames}`;
      recommendation = `Monitor ${top2FactorNames} closely as they drive most of the risk`;
    } else if (concentrationLevel === 'medium') {
      concentrationInsight = `Risk is moderately concentrated - ${top2Percentage.toFixed(0)}% comes from ${top2FactorNames}`;
      recommendation = `Risk is reasonably distributed but keep an eye on ${top2FactorNames}`;
    } else {
      concentrationInsight = `Risk is well distributed - ${top2Percentage.toFixed(0)}% from ${top2FactorNames}`;
      recommendation = 'Good diversification - risk is spread across multiple factors';
    }
    
    console.log('getRiskConcentration: Analysis complete', {
      totalContribution,
      top2Percentage,
      top3Percentage,
      concentrationLevel,
      factorCount: factors.length
    });
    
    return {
      concentrationLevel,
      concentrationColor,
      concentrationIcon,
      concentrationText,
      top2Percentage,
      top3Percentage,
      totalContribution,
      factorContributions: sortedContributions,
      concentrationInsight,
      recommendation
    };
  };

  // Get factor correlation analysis
  const getFactorCorrelations = () => {
    if (!factorAnalysisData?.correlation) {
      console.log('getFactorCorrelations: No correlation data available');
      return null;
    }

    const correlationMatrix = factorAnalysisData.correlation;
    const currentFactors = explanation?.keyDrivers || [];
    
    // Calculate correlations between all factor pairs
    const correlations = [];
    
    for (let i = 0; i < currentFactors.length; i++) {
      for (let j = i + 1; j < currentFactors.length; j++) {
        const factorA = currentFactors[i];
        const factorB = currentFactors[j];
        
        // Get correlation from the matrix
        const correlation = correlationMatrix[factorA.key]?.[factorB.key];
        
        if (correlation === undefined || correlation === null) {
          continue; // No correlation data for this pair
        }
        
        // Determine correlation strength and direction
        let strength = 'weak';
        let direction = 'neutral';
        let icon = '➡️';
        let color = 'gray';
        
        if (Math.abs(correlation) >= 0.7) {
          strength = 'strong';
        } else if (Math.abs(correlation) >= 0.4) {
          strength = 'moderate';
        }
        
        if (correlation > 0.3) {
          direction = 'positive';
          icon = '📈📈';
          color = 'green';
        } else if (correlation < -0.3) {
          direction = 'negative';
          icon = '📉📈';
          color = 'red';
        }
        
        let context = '';
        if (direction === 'positive') {
          context = `${factorA.label} and ${factorB.label} move together - when one rises, the other tends to rise`;
        } else if (direction === 'negative') {
          context = `${factorA.label} and ${factorB.label} move opposite - when one rises, the other tends to fall`;
        } else {
          context = `${factorA.label} and ${factorB.label} show little relationship`;
        }
        
        correlations.push({
          factorA: factorA.key,
          factorALabel: factorA.label,
          factorB: factorB.key,
          factorBLabel: factorB.label,
          correlation,
          strength,
          direction,
          icon,
          color,
          context
        });
      }
    }
    
    // Sort by absolute correlation strength (highest first)
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  };

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]) => {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Get factor volatility analysis
  const getFactorVolatility = () => {
    if (!factorAnalysisData?.volatility) {
      console.log('getFactorVolatility: No volatility data available');
      return null;
    }

    const volatilityData = factorAnalysisData.volatility;
    const currentFactors = explanation?.keyDrivers || [];
    
    // Map current factors to volatility data
    const factorVolatility = currentFactors.map(factor => {
      const volData = volatilityData[factor.key];
      
      if (!volData) {
        return null; // No volatility data for this factor
      }
      
      // Map volatility level to our format
      let volatilityLevel = 'low';
      if (volData.volatilityLevel === 'High') volatilityLevel = 'high';
      else if (volData.volatilityLevel === 'Medium') volatilityLevel = 'medium';
      
      let context = '';
      if (volatilityLevel === 'high') {
        context = `${factor.label} shows high volatility (${volData.stdDev.toFixed(1)}σ), contributing significant risk to the overall score`;
      } else if (volatilityLevel === 'medium') {
        context = `${factor.label} shows moderate volatility (${volData.stdDev.toFixed(1)}σ) with some risk contribution`;
      } else {
        context = `${factor.label} shows low volatility (${volData.stdDev.toFixed(1)}σ), providing stable risk assessment`;
      }
      
      return {
        key: factor.key,
        label: factor.label,
        volatility: volData.stdDev,
        volatilityLevel,
        context
      };
    }).filter(factor => factor !== null); // Remove factors with no data
    
    // Sort by volatility (highest first)
    return factorVolatility.sort((a, b) => b.volatility - a.volatility);
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
    
    // Load factor analysis data
    loadFactorAnalysisData();

    try {
      const factors = latest.factors || [];

      // Generate explanations for all factors
      const factorExplanations = factors.map(generateFactorExplanation);
      
      // Sort by contribution (desc) — full list for "Current read"; top 3 for legacy sections / diagnostics
      const sortedByContribution = [...factorExplanations].sort(
        (a: FactorExplanation, b: FactorExplanation) => b.contribution - a.contribution
      );
      const keyDrivers = sortedByContribution.slice(0, 3);

      const bandLabel = latest.band?.label || 'Unknown';
      const totalScore = latest.composite_score;

      const scoreExplanation: ScoreExplanation = {
        totalScore,
        bandLabel,
        keyDrivers,
        factorsByContribution: sortedByContribution,
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
      <div className={`mobile-card ${className}`}>
        <SkeletonLoader isLoading={true}>
          <SkeletonCard type="insight" size="lg" />
        </SkeletonLoader>
      </div>
    );
  }

  if (!explanation) {
  return (
    <div className={`mobile-card ${className}`}>
        <h3 className="text-caption mb-2">Score Insights</h3>
        <p className="text-body-small text-gray-500">Unable to load insights</p>
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

  const currentRead = buildCurrentReadLines(explanation);

  const volList = getFactorVolatility();
  const momList = getFactorMomentum();
  const corrList = getFactorCorrelations();
  const maxDiagnosticListRows = Math.max(
    volList?.length ?? 0,
    momList?.length ?? 0,
    corrList?.length ?? 0
  );
  const showDiagnosticListToggle = maxDiagnosticListRows > 3;

  return (
    <div className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-blue-100 p-2 rounded-lg shrink-0">
            <span className="text-2xl">🧠</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-heading-2">Score Insights</h3>
            <p className="text-body-small text-gray-600">Comprehensive analysis of Bitcoin's risk landscape</p>
          </div>
        </div>
        {showDiagnosticListToggle && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 bg-white rounded-md px-2.5 py-1.5"
            aria-expanded={expanded}
            title="Advanced diagnostics lists: show every row or the first three in each list"
          >
            {expanded ? 'Top 3 only' : 'All rows'}
          </button>
        )}
      </div>

      {/* Score Visualization */}
      <div className={`mb-4 p-3 rounded-lg border ${getScoreBgColor(explanation.totalScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-body-small font-medium text-gray-700">G-Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-metric ${getScoreColor(explanation.totalScore)}`}>
              {explanation.totalScore}
            </span>
            <span className="text-body-small text-gray-500">/ 100</span>
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

      {/* Risk Breakdown Section */}
      <MobileCollapsible 
        title="Risk Breakdown" 
        icon="📊" 
        defaultOpen={true}
        className="mb-5"
      >
        <div className="mobile-grid-3 gap-3 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {explanation.totalScore}
            </div>
            <div className="text-gray-500">G-Score</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${getScoreColor(explanation.totalScore)}`}>
              {explanation.bandLabel}
            </div>
            <div className="text-gray-500">Risk Level</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {(() => {
                // Determine market context based on score and factors
                const highRiskFactors = explanation.keyDrivers.filter(f => f.score > 60).length;
                const lowRiskFactors = explanation.keyDrivers.filter(f => f.score < 40).length;
                
                if (explanation.totalScore > 60 && highRiskFactors >= 2) {
                  return 'Elevated Risk';
                } else if (explanation.totalScore < 40 && lowRiskFactors >= 2) {
                  return 'Lower Risk';
                } else if (explanation.totalScore >= 50 && explanation.totalScore <= 60) {
                  return 'Balanced Risk';
                } else {
                  return 'Mixed Signals';
                }
              })()}
            </div>
            <div className="text-gray-500">Current Context</div>
          </div>
        </div>
      </MobileCollapsible>

      {/* Risk Contributors Section */}
      <MobileCollapsible 
        title="Risk Contributors" 
        icon="🔴" 
        badge={explanation.keyDrivers.length}
        defaultOpen={true}
        className="mb-5"
      >
        
        <div className="space-y-2">
          {(() => {
            // Get top 3 high-risk factors (score > 45 for more inclusive)
            const highRiskFactors = explanation.keyDrivers
              .filter(f => f.score > 45)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            
            if (highRiskFactors.length === 0) {
              return (
                <div className="text-sm text-green-600 text-center py-2">
                  ✅ No high-risk factors detected (scores: {explanation.keyDrivers.map(f => `${f.label}:${f.score}`).join(', ')})
                </div>
              );
            }
            
            return highRiskFactors.map((factor, idx) => (
              <div key={idx} className="card-danger">
                {/* Header with Risk Level Indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <span className="text-lg">{getFactorIcon(factor.key)}</span>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900">{factor.label}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          factor.score > 80 ? 'bg-red-100 text-red-800' : 
                          factor.score > 60 ? 'bg-orange-100 text-orange-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {factor.score > 80 ? '🔴 Critical Risk' : 
                           factor.score > 60 ? '🟠 High Risk' : 
                           '🟡 Elevated Risk'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">
                      {factor.score}
                    </div>
                    <div className="text-xs text-gray-500">/ 100</div>
                  </div>
                </div>

                {/* Risk Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Risk Level</span>
                    <span>{factor.score > 80 ? 'Critical' : factor.score > 60 ? 'High' : 'Elevated'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        factor.score > 80 ? 'bg-red-500' : 
                        factor.score > 60 ? 'bg-orange-500' : 
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(factor.score, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Contextual Explanation */}
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <div className="text-xs text-red-800 font-medium mb-1">⚠️ Risk Context</div>
                  <div className="text-xs text-red-700">
                    {(() => {
                      // Generate contextual explanations based on factor and score
                      const factorKey = factor.key;
                      const score = factor.score;
                      
                      if (factorKey === 'onchain' && score > 80) {
                        return 'At ATHs, on-chain metrics often show distribution signals from whales and institutions taking profits';
                      } else if (factorKey === 'etf_flows' && score > 60) {
                        return 'High concentration risk as institutions take profits and reduce exposure';
                      } else if (factorKey === 'trend_valuation' && score > 50) {
                        return 'Price above historical norms (Mayer Multiple 1.17) indicating potential overvaluation';
                      } else if (factorKey === 'social_interest' && score > 70) {
                        return 'Excessive social media hype and FOMO sentiment creating bubble conditions';
                      } else if (factorKey === 'term_leverage' && score > 60) {
                        return 'High leverage and funding rate pressure indicating speculative positioning';
                      } else if (factorKey === 'stablecoins' && score > 60) {
                        return 'Stablecoin supply contraction indicating selling pressure and reduced liquidity';
                      } else if (factorKey === 'macro_overlay' && score > 60) {
                        return 'Macro headwinds and liquidity concerns affecting market sentiment';
                      } else if (factorKey === 'net_liquidity' && score > 60) {
                        return 'Liquidity contraction and monetary tightening reducing market support';
                      } else {
                        return 'Elevated risk indicators detected requiring close monitoring';
                      }
                    })()}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </MobileCollapsible>

      {/* Risk Mitigators Section */}
      <MobileCollapsible 
        title="Risk Mitigators" 
        icon="🟢" 
        badge={explanation.keyDrivers.filter(f => f.score < 50).length}
        defaultOpen={true}
        className="mb-5"
      >
        
        <div className="space-y-2">
          {(() => {
            // Get top 3 low-risk factors (score < 50)
            const lowRiskFactors = explanation.keyDrivers
              .filter(f => f.score < 50)
              .sort((a, b) => a.score - b.score)
              .slice(0, 3);
            
            if (lowRiskFactors.length === 0) {
              return (
                <div className="text-sm text-red-600 text-center py-2">
                  ⚠️ No low-risk factors detected (scores: {explanation.keyDrivers.map(f => `${f.label}:${f.score}`).join(', ')})
                </div>
              );
            }
            
            return lowRiskFactors.map((factor, idx) => (
              <div key={idx} className="card-success">
                {/* Header with Risk Level Indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <span className="text-lg">{getFactorIcon(factor.key)}</span>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900">{factor.label}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          factor.score < 30 ? 'bg-green-100 text-green-800' : 
                          factor.score < 40 ? 'bg-blue-100 text-blue-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {factor.score < 30 ? '🟢 Low Risk' : 
                           factor.score < 40 ? '🔵 Very Low Risk' : 
                           '🟡 Moderate Risk'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {factor.score}
                    </div>
                    <div className="text-xs text-gray-500">/ 100</div>
                  </div>
                </div>

                {/* Risk Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Risk Level</span>
                    <span>{factor.score < 30 ? 'Low' : factor.score < 40 ? 'Very Low' : 'Moderate'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        factor.score < 30 ? 'bg-green-500' : 
                        factor.score < 40 ? 'bg-blue-500' : 
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(factor.score, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Contextual Explanation */}
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="text-xs text-green-800 font-medium mb-1">✅ Stability Context</div>
                  <div className="text-xs text-green-700">
                    {(() => {
                      // Generate contextual explanations based on factor and score
                      const factorKey = factor.key;
                      const score = factor.score;
                      
                      if (factorKey === 'stablecoins' && score < 40) {
                        return 'Healthy stablecoin dynamics with no panic selling detected, indicating stable market conditions';
                      } else if (factorKey === 'social_interest' && score < 45) {
                        return 'Low social media hype avoiding FOMO sentiment, reducing bubble risk';
                      } else if (factorKey === 'term_leverage' && score < 50) {
                        return 'Reasonable leverage levels with no excessive funding pressure, indicating healthy speculation';
                      } else if (factorKey === 'macro_overlay' && score < 50) {
                        return 'Stable macro environment with no major headwinds affecting market sentiment';
                      } else if (factorKey === 'net_liquidity' && score < 50) {
                        return 'Adequate liquidity conditions with no major tightening, supporting market stability';
                      } else {
                        return 'Low risk indicators contributing to overall market stability and reduced volatility';
                      }
                    })()}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </MobileCollapsible>

      {/* Pass 1: single merged narrative (replaces Why / Actionable / Smart Context) */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/90 p-3.5">
        <h4 className="text-sm font-semibold text-gray-900 mb-1.5">What matters right now</h4>
        <ul className="space-y-1 text-sm text-gray-800 list-disc list-inside">
          <li>{currentRead.driverLine}</li>
          <li>{currentRead.stabilizerLine}</li>
          <li>{currentRead.contextLine}</li>
          <li className="text-gray-700">{currentRead.stanceLine}</li>
        </ul>
      </div>

      {/* Risk Concentration */}
      {getRiskConcentration() && (
        <div className="mb-3">
          <div 
            className="text-xs font-medium text-gray-700 mb-2 flex items-center justify-between cursor-pointer hover:text-gray-900"
            onClick={() => toggleSection('riskConcentration')}
          >
            <div className="flex items-center gap-2">
              <span>🔍</span>
              <span>Risk Concentration</span>
            </div>
            <span className="text-lg transition-transform duration-200">
              {expandedSections.riskConcentration ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedSections.riskConcentration && (
            <div className="space-y-3">
              {/* Concentration Level Indicator */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3.5 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getRiskConcentration()!.concentrationIcon}</span>
                    <span className="text-sm font-medium text-gray-900">Concentration Level</span>
                  </div>
                  <div className={`text-sm font-bold ${
                    getRiskConcentration()!.concentrationColor === 'red' ? 'text-red-600' : 
                    getRiskConcentration()!.concentrationColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {getRiskConcentration()!.concentrationText}
                  </div>
                </div>
                
                {/* Concentration Bar */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Top 2 Factors ({getRiskConcentration()!.factorContributions.slice(0, 2).map(f => f.label).join(', ')})</span>
                    <span>{getRiskConcentration()!.top2Percentage.toFixed(0)}% of total risk</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        getRiskConcentration()!.concentrationColor === 'red' ? 'bg-red-500' : 
                        getRiskConcentration()!.concentrationColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, getRiskConcentration()!.top2Percentage)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-1.5">
                  {getRiskConcentration()!.concentrationInsight}
                </div>
                <div className="text-xs text-blue-600 italic">
                  💡 {getRiskConcentration()!.recommendation}
                </div>
              </div>
              
              {/* Factor Contribution Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 mb-2">Factor Risk Distribution</div>
                {getRiskConcentration()!.factorContributions.map((factor, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getFactorIcon(factor.key)}</span>
                        <span className="text-sm font-medium text-gray-900">{factor.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600">
                          {factor.contribution > 0 ? '+' : ''}{factor.contribution.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {factor.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Contribution Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Risk Contribution</span>
                        <span>{factor.percentage.toFixed(1)}% of total</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, factor.percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {factor.trend === 'improving' ? '📈 Improving' : 
                       factor.trend === 'declining' ? '📉 Declining' : '➡️ Stable'} 
                      - {factor.absoluteContribution.toFixed(1)} points contribution
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Confidence */}
      {getDataConfidence() && (
        <div className="mb-3">
          <div 
            className="text-xs font-medium text-gray-700 mb-2 flex items-center justify-between cursor-pointer hover:text-gray-900"
            onClick={() => toggleSection('dataConfidence')}
          >
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span>Data Confidence</span>
            </div>
            <span className="text-lg transition-transform duration-200">
              {expandedSections.dataConfidence ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedSections.dataConfidence && (
            <div className="space-y-3">
              {/* Overall Confidence Indicator */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3.5 border border-green-100 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getDataConfidence()!.overallConfidenceIcon}</span>
                    <span className="text-sm font-medium text-gray-900">Overall Confidence</span>
                  </div>
                  <div className={`text-sm font-bold ${
                    getDataConfidence()!.overallConfidenceColor === 'red' ? 'text-red-600' : 
                    getDataConfidence()!.overallConfidenceColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {getDataConfidence()!.overallConfidenceText} ({getDataConfidence()!.averageConfidenceScore.toFixed(0)}%)
                  </div>
                </div>
                
                {/* Confidence Bar */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Data Quality Score</span>
                    <span>{getDataConfidence()!.averageConfidenceScore.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        getDataConfidence()!.overallConfidenceColor === 'red' ? 'bg-red-500' : 
                        getDataConfidence()!.overallConfidenceColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, getDataConfidence()!.averageConfidenceScore)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-1.5">
                  {getDataConfidence()!.overallInsight}
                </div>
                <div className="text-xs text-green-600 italic">
                  💡 {getDataConfidence()!.overallRecommendation}
                </div>
              </div>
              
              {/* Factor Confidence Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 mb-1.5">Factor Data Quality</div>
                {getDataConfidence()!.factorConfidences.map((factor, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getFactorIcon(factor.key)}</span>
                        <span className="text-sm font-medium text-gray-900">{factor.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          factor.confidenceColor === 'red' ? 'text-red-600' : 
                          factor.confidenceColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {factor.confidenceIcon} {factor.confidenceText}
                        </span>
                        <span className="text-xs text-gray-500">
                          {factor.confidenceScore}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Data Quality</span>
                        <span>{factor.confidenceScore}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${
                            factor.confidenceColor === 'red' ? 'bg-red-500' : 
                            factor.confidenceColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, factor.confidenceScore)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 mb-1">
                      {factor.stalenessIcon} {factor.stalenessText} - {factor.confidenceContext}
                    </div>
                    {factor.stalenessLevel !== 'fresh' && (
                      <div className="text-xs text-orange-600 italic">
                        ⚠️ Data may not reflect current conditions
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-1 pt-4 border-t border-gray-200 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Advanced diagnostics</p>

      {/* Factor Volatility Analysis */}
      {getFactorVolatility() && (
        <div className="mb-4">
          <div 
            className="text-xs font-normal text-gray-500 mb-2 flex items-center justify-between cursor-pointer hover:text-gray-700"
            onClick={() => toggleSection('factorVolatility')}
          >
            <div className="flex items-center gap-2">
              <span>📈</span>
              <span>Factor Volatility ({getFactorVolatility()!.length})</span>
            </div>
            <span className="text-lg transition-transform duration-200">
              {expandedSections.factorVolatility ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedSections.factorVolatility && (
          <div className="space-y-3">
          <div className="text-xs text-gray-500 mb-3">
            As of {new Date().toISOString().split('T')[0]} {new Date().toISOString().split('T')[1].split('.')[0]} UTC · 30-day stdev, 90-day correlations
          </div>
            {getFactorVolatility()!.slice(0, expanded ? undefined : 3).map((factor, idx) => (
              <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFactorIcon(factor.key)}</span>
                    <span className="text-sm font-medium text-gray-900">{factor.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${factor.volatilityLevel === 'high' ? 'text-red-600' : factor.volatilityLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {factor.volatilityLevel === 'high' ? '🔥' : factor.volatilityLevel === 'medium' ? '⚡' : '📊'} {factor.volatilityLevel}
                    </span>
                    <span className="text-xs text-gray-500">
                      {factor.volatility.toFixed(2)}σ
                    </span>
                  </div>
                </div>
                
                {/* Volatility Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Volatility</span>
                    <span>{factor.volatility.toFixed(2)}σ (std dev)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${factor.volatilityLevel === 'high' ? 'bg-red-500' : factor.volatilityLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, (factor.volatility / 3) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600">
                  {factor.context}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Factor Momentum */}
      {getFactorMomentum() && (
        <div className="mb-4">
          <div 
            className="text-xs font-normal text-gray-500 mb-2 flex items-center justify-between cursor-pointer hover:text-gray-700"
            onClick={() => toggleSection('factorMomentum')}
          >
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span>Factor Momentum ({getFactorMomentum()!.length})</span>
            </div>
            <span className="text-lg transition-transform duration-200">
              {expandedSections.factorMomentum ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedSections.factorMomentum && (
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
          )}
        </div>
      )}

      {/* Factor Correlations */}
      {getFactorCorrelations() && (
        <div className="mb-4">
          <div 
            className="text-xs font-normal text-gray-500 mb-2 flex items-center justify-between cursor-pointer hover:text-gray-700"
            onClick={() => toggleSection('factorCorrelations')}
          >
            <div className="flex items-center gap-2">
              <span>🔗</span>
              <span>Factor Correlations ({getFactorCorrelations()!.length})</span>
            </div>
            <span className="text-lg transition-transform duration-200">
              {expandedSections.factorCorrelations ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedSections.factorCorrelations && (
            <div className="space-y-3">
              {getFactorCorrelations()!.slice(0, expanded ? undefined : 3).map((correlation, idx) => (
                <div key={idx} className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getFactorIcon(correlation.factorA)}</span>
                      <span className="text-sm font-medium text-gray-900">{correlation.factorALabel}</span>
                      <span className="text-gray-400">↔</span>
                      <span className="text-lg">{getFactorIcon(correlation.factorB)}</span>
                      <span className="text-sm font-medium text-gray-900">{correlation.factorBLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        correlation.color === 'green' ? 'text-green-600' : 
                        correlation.color === 'red' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {correlation.icon} {correlation.strength} {correlation.direction}
                      </span>
                      <span className="text-xs text-gray-500">
                        {correlation.correlation > 0 ? '+' : ''}{correlation.correlation.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Correlation Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Correlation</span>
                      <span>{correlation.correlation > 0 ? '+' : ''}{correlation.correlation.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          correlation.color === 'green' ? 'bg-green-500' : 
                          correlation.color === 'red' ? 'bg-red-500' : 'bg-gray-400'
                        }`}
                        style={{ 
                          width: `${Math.min(100, Math.abs(correlation.correlation) * 100)}%`,
                          marginLeft: correlation.correlation < 0 ? `${100 - Math.abs(correlation.correlation) * 100}%` : '0'
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600">
                    {correlation.context}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>





    </div>
  );
}
