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
  const [expandedSections, setExpandedSections] = useState({
    factorVolatility: false,
    factorMomentum: false,
    factorCorrelations: false,
    riskConcentration: false,
    dataConfidence: false,
    recommendations: false
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
    console.log('getFactorCorrelations: Starting analysis', {
      hasExplanation: !!explanation,
      hasHistoricalData: !!historicalData,
      pointsLength: historicalData?.points?.length || 0,
      keyDriversLength: explanation?.keyDrivers?.length || 0
    });
    
    if (!explanation || !historicalData?.points || historicalData.points.length < 1) {
      console.log('getFactorCorrelations: Insufficient data', {
        hasExplanation: !!explanation,
        hasHistoricalData: !!historicalData,
        pointsLength: historicalData?.points?.length || 0,
        required: 1
      });
      return null;
    }

    const currentFactors = explanation.keyDrivers;
    const points = historicalData.points;
    
    console.log('getFactorCorrelations: Data check', {
      currentFactors: currentFactors.map(f => ({ key: f.key, label: f.label })),
      pointsSample: points.slice(0, 2).map((p: any) => Object.keys(p)),
      pointsLength: points.length
    });
    
    // Calculate correlations between all factor pairs
    const correlations = [];
    
    for (let i = 0; i < currentFactors.length; i++) {
      for (let j = i + 1; j < currentFactors.length; j++) {
        const factorA = currentFactors[i];
        const factorB = currentFactors[j];
        
        // Get factor scores over time
        const factorAScores = points.map((point: any) => point[factorA.key] || 0).filter((score: any) => !isNaN(score));
        const factorBScores = points.map((point: any) => point[factorB.key] || 0).filter((score: any) => !isNaN(score));
        
        console.log(`getFactorCorrelations: Checking ${factorA.key} vs ${factorB.key}`, {
          factorAScoresLength: factorAScores.length,
          factorBScoresLength: factorBScores.length,
          factorAScores: factorAScores.slice(0, 3),
          factorBScores: factorBScores.slice(0, 3)
        });
        
        if (factorAScores.length < 1 || factorBScores.length < 1) {
          console.log(`getFactorCorrelations: Skipping ${factorA.key} vs ${factorB.key} - insufficient data`);
          continue;
        }
        
        // For single data point, show current scores as baseline
        let correlation, strength, direction, icon, color, context;
        
        if (factorAScores.length === 1 && factorBScores.length === 1) {
          correlation = 0; // No correlation with single point
          strength = 'stable';
          direction = 'baseline';
          icon = '📊📊';
          color = 'gray';
          context = `${factorA.label} (${factorAScores[0].toFixed(1)}) and ${factorB.label} (${factorBScores[0].toFixed(1)}) - correlation analysis requires more historical data`;
        } else {
          // Calculate Pearson correlation coefficient for multiple data points
          correlation = calculateCorrelation(factorAScores, factorBScores);
          
          // Determine correlation strength and direction
          strength = 'weak';
          direction = 'neutral';
          icon = '➡️';
          color = 'gray';
          
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
          
          context = '';
          if (direction === 'positive') {
            context = `${factorA.label} and ${factorB.label} move together - when one rises, the other tends to rise`;
          } else if (direction === 'negative') {
            context = `${factorA.label} and ${factorB.label} move opposite - when one rises, the other tends to fall`;
          } else {
            context = `${factorA.label} and ${factorB.label} show little relationship`;
          }
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
    
    console.log('getFactorCorrelations: Final results', {
      correlationsFound: correlations.length,
      correlations: correlations.map(c => ({
        pair: `${c.factorALabel} ↔ ${c.factorBLabel}`,
        correlation: c.correlation,
        strength: c.strength,
        direction: c.direction
      }))
    });
    
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
    if (!explanation || !historicalData?.points || historicalData.points.length < 1) {
      console.log('getFactorVolatility: Insufficient data', {
        hasExplanation: !!explanation,
        hasHistoricalData: !!historicalData,
        pointsLength: historicalData?.points?.length || 0,
        required: 1
      });
      return null;
    }

    const currentFactors = explanation.keyDrivers;
    const points = historicalData.points;
    
    // Calculate volatility for each factor over available historical data
    const factorVolatility = currentFactors.map(factor => {
      const factorScores = points.map((point: any) => point[factor.key] || 0).filter((score: any) => !isNaN(score));
      
      if (factorScores.length < 1) {
        return null; // Not enough data
      }
      
      // For single data point, show current score as baseline
      if (factorScores.length === 1) {
        const currentScore = factorScores[0];
        const volatility = 0; // No volatility with single point
        const volatilityLevel = 'stable';
        const context = `${factor.label} shows current score of ${currentScore.toFixed(1)}, volatility analysis requires more historical data`;
        
        return {
          key: factor.key,
          label: factor.label,
          volatility,
          volatilityLevel,
          context
        };
      }
      
      // Calculate standard deviation (volatility) for multiple data points
      const mean = factorScores.reduce((sum: any, score: any) => sum + score, 0) / factorScores.length;
      const variance = factorScores.reduce((sum: any, score: any) => sum + Math.pow(score - mean, 2), 0) / factorScores.length;
      const volatility = Math.sqrt(variance);
      
      // Determine volatility level
      let volatilityLevel = 'low';
      if (volatility > 2.0) volatilityLevel = 'high';
      else if (volatility > 1.0) volatilityLevel = 'medium';
      
      let context = '';
      if (volatilityLevel === 'high') {
        context = `${factor.label} shows high volatility, contributing significant risk to the overall score`;
      } else if (volatilityLevel === 'medium') {
        context = `${factor.label} shows moderate volatility with some risk contribution`;
      } else {
        context = `${factor.label} shows low volatility, providing stable risk assessment`;
      }
      
      return {
        key: factor.key,
        label: factor.label,
        volatility,
        volatilityLevel,
        context
      };
    }).filter(factor => factor !== null); // Remove factors with insufficient data
    
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
    <div className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Score Insights</h3>
            <p className="text-sm text-gray-600">Comprehensive analysis of Bitcoin's risk landscape</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
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

      {/* Risk Breakdown Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gray-200 p-2 rounded-lg">
            <span className="text-lg">📊</span>
          </div>
          <h4 className="text-base font-semibold text-gray-800">Risk Breakdown</h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {explanation.totalScore}
            </div>
            <div className="text-gray-500">G-Score</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${getScoreColor(explanation.totalScore)}`}>
              {explanation.totalScore < 40 ? 'Low Risk' : 
               explanation.totalScore < 60 ? 'Moderate Risk' : 'High Risk'}
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
      </div>

      {/* Risk Contributors Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-200 p-2 rounded-lg">
            <span className="text-lg">🔴</span>
          </div>
          <h4 className="text-base font-semibold text-red-800">Top Risk Contributors</h4>
        </div>
        
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
              <div key={idx} className="bg-white rounded-lg p-4 border border-red-200 shadow-sm hover:shadow-md transition-all duration-200">
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
      </div>

      {/* Risk Mitigators Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-200 p-2 rounded-lg">
            <span className="text-lg">🟢</span>
          </div>
          <h4 className="text-base font-semibold text-green-800">Top Risk Mitigators</h4>
        </div>
        
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
              <div key={idx} className="bg-white rounded-lg p-4 border border-green-200 shadow-sm hover:shadow-md transition-all duration-200">
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
      </div>

      {/* Context Explanation Section */}
      <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-200 p-2 rounded-lg">
            <span className="text-lg">💡</span>
          </div>
          <h4 className="text-base font-semibold text-blue-800">Why This Score Makes Sense</h4>
        </div>
        
        <div className="text-sm text-gray-700 space-y-2">
          {(() => {
            // Determine market context and explain why the score makes sense
            const totalScore = explanation.totalScore;
            const highRiskCount = explanation.keyDrivers.filter(f => f.score > 60).length;
            const lowRiskCount = explanation.keyDrivers.filter(f => f.score < 40).length;
            
            // Market phase detection
            const isNearATH = totalScore > 50 && highRiskCount >= 2;
            const isLowRisk = totalScore < 40 && lowRiskCount >= 2;
            const isBalanced = totalScore >= 45 && totalScore <= 55;
            
            if (isNearATH) {
              return (
                <div className="space-y-2">
                  <p className="font-medium text-blue-800">
                    🚀 At All-Time Highs, Elevated Risk is Expected
                  </p>
                  <p>
                    When Bitcoin approaches ATHs, we naturally see higher risk metrics. 
                    On-chain activity shows distribution signals, institutions take profits 
                    (ETF outflows), and social media hype increases. This is normal market behavior.
                  </p>
                  <p>
                    The G-Score reflects this reality: <strong>high risk doesn't mean imminent crash</strong> - 
                    it means we're in a high-risk environment where caution is warranted.
                  </p>
                </div>
              );
            } else if (isLowRisk) {
              return (
                <div className="space-y-2">
                  <p className="font-medium text-green-800">
                    ✅ Low Risk Environment Detected
                  </p>
                  <p>
                    Multiple factors are showing low risk signals, indicating a more stable 
                    market environment. This suggests healthy market dynamics with less 
                    speculative activity and more balanced conditions.
                  </p>
                  <p>
                    This is typically seen during consolidation phases or after significant 
                    corrections when risk has been reset.
                  </p>
                </div>
              );
            } else if (isBalanced) {
              return (
                <div className="space-y-2">
                  <p className="font-medium text-yellow-800">
                    ⚖️ Balanced Risk Environment
                  </p>
                  <p>
                    The G-Score reflects a mixed signal environment where some factors show 
                    elevated risk while others remain stable. This is common during market 
                    transitions or when different market forces are competing.
                  </p>
                  <p>
                    This balanced state suggests the market is at an inflection point where 
                    the next move could go either direction based on which forces prevail.
                  </p>
                </div>
              );
            } else {
              return (
                <div className="space-y-2">
                  <p className="font-medium text-gray-800">
                    📊 Mixed Market Signals
                  </p>
                  <p>
                    The current G-Score reflects a complex market environment with both 
                    risk factors and mitigating factors present. This mixed signal state 
                    is common in dynamic markets where multiple forces are at play.
                  </p>
                  <p>
                    The score provides a balanced assessment of the current risk landscape, 
                    helping you understand both the opportunities and challenges present.
                  </p>
                </div>
              );
            }
          })()}
        </div>
      </div>

      {/* Actionable Insights Section */}
      <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-200 p-2 rounded-lg">
            <span className="text-lg">🎯</span>
          </div>
          <h4 className="text-base font-semibold text-purple-800">Actionable Insights</h4>
        </div>
        
        <div className="space-y-3">
          {(() => {
            // Generate actionable insights based on current factors and market conditions
            const totalScore = explanation.totalScore;
            const highRiskFactors = explanation.keyDrivers.filter(f => f.score > 60);
            const lowRiskFactors = explanation.keyDrivers.filter(f => f.score < 40);
            const moderateRiskFactors = explanation.keyDrivers.filter(f => f.score >= 40 && f.score <= 60);
            
            const insights = [];
            
            // High-risk factor monitoring
            if (highRiskFactors.length > 0) {
              insights.push({
                type: 'monitor',
                icon: '👀',
                title: 'Monitor High-Risk Factors',
                description: `Watch ${highRiskFactors.map(f => f.label).join(', ')} closely for changes`,
                details: highRiskFactors.map(factor => {
                  if (factor.key === 'onchain') {
                    return '• On-chain: Watch for whale movements and exchange inflows';
                  } else if (factor.key === 'etf_flows') {
                    return '• ETF Flows: Monitor daily flows for institutional sentiment shifts';
                  } else if (factor.key === 'trend_valuation') {
                    return '• Trend & Valuation: Track Mayer Multiple and price momentum';
                  } else if (factor.key === 'social_interest') {
                    return '• Social Interest: Monitor social media sentiment and FOMO levels';
                  } else if (factor.key === 'term_leverage') {
                    return '• Term Structure: Watch funding rates and leverage metrics';
                  } else if (factor.key === 'stablecoins') {
                    return '• Stablecoins: Monitor supply changes and selling pressure';
                  } else if (factor.key === 'macro_overlay') {
                    return '• Macro Overlay: Track economic indicators and policy changes';
                  } else if (factor.key === 'net_liquidity') {
                    return '• Net Liquidity: Monitor Fed policy and liquidity conditions';
                  }
                  return `• ${factor.label}: Watch for significant changes`;
                }).join('\n')
              });
            }
            
            // Low-risk factor opportunities
            if (lowRiskFactors.length > 0) {
              insights.push({
                type: 'opportunity',
                icon: '💚',
                title: 'Stable Foundation',
                description: `${lowRiskFactors.map(f => f.label).join(', ')} are providing market stability`,
                details: 'These factors suggest a more stable market environment with less speculative activity.'
              });
            }
            
            // Score-based guidance
            if (totalScore > 70) {
              insights.push({
                type: 'caution',
                icon: '⚠️',
                title: 'High Risk Environment',
                description: 'Consider reducing position sizes and increasing cash allocation',
                details: 'High risk doesn\'t mean imminent crash, but caution is warranted. Monitor for trend changes.'
              });
            } else if (totalScore < 30) {
              insights.push({
                type: 'opportunity',
                icon: '📈',
                title: 'Low Risk Environment',
                description: 'Consider increasing exposure if fundamentals align',
                details: 'Low risk environment suggests potential opportunities, but always consider your risk tolerance.'
              });
            } else {
              insights.push({
                type: 'balanced',
                icon: '⚖️',
                title: 'Balanced Approach',
                description: 'Maintain current strategy while monitoring key factors',
                details: 'Mixed signals suggest staying flexible and ready to adjust based on factor changes.'
              });
            }
            
            // Market phase specific guidance
            const isNearATH = totalScore > 50 && highRiskFactors.length >= 2;
            if (isNearATH) {
              insights.push({
                type: 'context',
                icon: '🚀',
                title: 'ATH Context',
                description: 'At all-time highs, elevated risk is normal',
                details: 'Focus on risk management rather than timing the market. Consider DCA strategies.'
              });
            }
            
            return insights.map((insight, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{insight.icon}</span>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 mb-1">{insight.title}</h5>
                    <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                    {insight.details && (
                      <div className="text-xs text-gray-600 whitespace-pre-line">
                        {insight.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Smart Context Section */}
      <div className="mb-6 p-5 bg-gradient-to-r from-indigo-50 to-purple-100 rounded-xl border border-indigo-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-200 p-2 rounded-lg">
            <span className="text-lg">🧠</span>
          </div>
          <h4 className="text-base font-semibold text-indigo-800">Smart Context Analysis</h4>
        </div>
        
        <div className="space-y-4">
          {(() => {
            // Generate smart context based on current market conditions and historical data
            const totalScore = explanation.totalScore;
            const highRiskCount = explanation.keyDrivers.filter(f => f.score > 60).length;
            const lowRiskCount = explanation.keyDrivers.filter(f => f.score < 40).length;
            const isNearATH = totalScore > 50 && highRiskCount >= 2;
            
            const smartContext = [];
            
            // Market Phase Awareness
            if (isNearATH) {
              smartContext.push({
                type: 'market-phase',
                icon: '🚀',
                title: 'Market Phase: All-Time High Environment',
                description: 'Bitcoin is operating in an ATH environment with elevated risk metrics',
                insights: [
                  'This is normal behavior at ATHs - elevated risk doesn\'t mean imminent crash',
                  'Historical data shows similar risk patterns during previous ATH cycles',
                  'Institutional profit-taking and whale distribution are expected at these levels',
                  'Social media hype and FOMO sentiment typically peak near ATHs'
                ]
              });
            } else if (totalScore < 40 && lowRiskCount >= 2) {
              smartContext.push({
                type: 'market-phase',
                icon: '🌱',
                title: 'Market Phase: Consolidation/Recovery',
                description: 'Bitcoin is in a lower-risk consolidation or recovery phase',
                insights: [
                  'Risk has been reset after previous market cycles',
                  'Stable fundamentals suggest healthy market development',
                  'Lower volatility indicates reduced speculative activity',
                  'This phase often precedes the next major move'
                ]
              });
            } else {
              smartContext.push({
                type: 'market-phase',
                icon: '⚖️',
                title: 'Market Phase: Transitional',
                description: 'Bitcoin is in a transitional phase with mixed signals',
                insights: [
                  'Competing forces are creating mixed risk signals',
                  'Market is at an inflection point between phases',
                  'Next major move will depend on which forces prevail',
                  'Close monitoring of key factors is recommended'
                ]
              });
            }
            
            // Historical Context
            if (historicalData && historicalData.points && historicalData.points.length > 1) {
              const recentScores = historicalData.points.slice(-7).map((p: any) => p.composite);
              const avgRecentScore = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
              const scoreTrend = recentScores[recentScores.length - 1] - recentScores[0];
              
              smartContext.push({
                type: 'historical',
                icon: '📊',
                title: 'Historical Context',
                description: `7-day average: ${avgRecentScore.toFixed(1)}, Trend: ${scoreTrend > 0 ? '+' : ''}${scoreTrend.toFixed(1)}`,
                insights: [
                  `Current score of ${totalScore} is ${totalScore > avgRecentScore ? 'above' : 'below'} recent average`,
                  `Score trend over past week: ${scoreTrend > 0 ? 'increasing risk' : 'decreasing risk'}`,
                  `Historical volatility: ${recentScores.length > 1 ? Math.max(...recentScores) - Math.min(...recentScores) : 0} points`,
                  `Risk level: ${totalScore > 70 ? 'High' : totalScore > 50 ? 'Moderate' : 'Low'} compared to historical range`
                ]
              });
            }
            
            // Forward-Looking Insights
            const forwardInsights = [];
            
            if (isNearATH) {
              forwardInsights.push('Monitor for potential distribution signals and institutional selling');
              forwardInsights.push('Watch for social media sentiment shifts and FOMO exhaustion');
              forwardInsights.push('Prepare for increased volatility as ATH resistance is tested');
            } else if (totalScore < 40) {
              forwardInsights.push('Low risk environment may present accumulation opportunities');
              forwardInsights.push('Monitor for fundamental improvements and institutional adoption');
              forwardInsights.push('Watch for breakout signals and momentum shifts');
            } else {
              forwardInsights.push('Mixed signals suggest staying flexible and ready to adjust');
              forwardInsights.push('Monitor key factors for directional clarity');
              forwardInsights.push('Prepare for potential volatility as market chooses direction');
            }
            
            smartContext.push({
              type: 'forward-looking',
              icon: '🔮',
              title: 'Forward-Looking Insights',
              description: 'Key factors to monitor for future market direction',
              insights: forwardInsights
            });
            
            return smartContext.map((context, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-lg mt-0.5">{context.icon}</span>
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900 mb-1">{context.title}</h5>
                    <p className="text-sm text-gray-700 mb-3">{context.description}</p>
                    <div className="space-y-1">
                      {context.insights.map((insight, insightIdx) => (
                        <div key={insightIdx} className="text-xs text-gray-600 flex items-start gap-2">
                          <span className="text-indigo-500 mt-0.5">•</span>
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Factor Volatility Analysis */}
      {getFactorVolatility() && (
        <div className="mb-4">
          <div 
            className="text-xs font-medium text-gray-600 mb-3 flex items-center justify-between cursor-pointer hover:text-gray-800"
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
            className="text-xs font-medium text-gray-600 mb-3 flex items-center justify-between cursor-pointer hover:text-gray-800"
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
            className="text-xs font-medium text-gray-600 mb-3 flex items-center justify-between cursor-pointer hover:text-gray-800"
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

      {/* Risk Concentration */}
      {getRiskConcentration() && (
        <div className="mb-4">
          <div 
            className="text-xs font-medium text-gray-600 mb-3 flex items-center justify-between cursor-pointer hover:text-gray-800"
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
            <div className="space-y-4">
              {/* Concentration Level Indicator */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
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
                <div className="mb-3">
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
                
                <div className="text-xs text-gray-600 mb-2">
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
        <div className="mb-4">
          <div 
            className="text-xs font-medium text-gray-600 mb-3 flex items-center justify-between cursor-pointer hover:text-gray-800"
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
            <div className="space-y-4">
              {/* Overall Confidence Indicator */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
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
                <div className="mb-3">
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
                
                <div className="text-xs text-gray-600 mb-2">
                  {getDataConfidence()!.overallInsight}
                </div>
                <div className="text-xs text-green-600 italic">
                  💡 {getDataConfidence()!.overallRecommendation}
                </div>
              </div>
              
              {/* Factor Confidence Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 mb-2">Factor Data Quality</div>
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




      {/* Recommendations */}
      <div className="border-t border-gray-100 pt-3">
        <div 
          className="text-xs font-medium text-gray-600 mb-2 cursor-pointer hover:text-gray-800 flex items-center justify-between"
          onClick={() => toggleSection('recommendations')}
        >
          <span>Recommendations ({explanation.recommendations.length})</span>
          <span className="text-lg transition-transform duration-200">
            {expandedSections.recommendations ? '🔽' : '▶️'}
          </span>
        </div>
        {expandedSections.recommendations && (
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
        )}
      </div>
    </div>
  );
}
