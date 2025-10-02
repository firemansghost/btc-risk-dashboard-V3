/**
 * Alert Context Enhancer
 * 
 * Adds historical context, trend information, and actionable recommendations
 * to alerts to provide richer, more useful information to users.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Load historical data for context analysis
 */
function loadHistoricalData() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  
  const historicalData = {
    factorHistory: [],
    alertHistory: [],
    riskBandHistory: [],
    etfFlows: [],
    gScoreHistory: []
  };
  
  try {
    // Load factor history
    const factorHistoryPath = path.join(dataDir, 'factor_history.csv');
    if (fs.existsSync(factorHistoryPath)) {
      const content = fs.readFileSync(factorHistoryPath, 'utf8');
      const lines = content.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const record = {};
          headers.forEach((header, idx) => {
            record[header.trim()] = values[idx]?.trim();
          });
          historicalData.factorHistory.push(record);
        }
      }
    }
    
    // Load G-Score history
    const historyPath = path.join(dataDir, 'history.csv');
    if (fs.existsSync(historyPath)) {
      const content = fs.readFileSync(historyPath, 'utf8');
      const lines = content.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const record = {};
          headers.forEach((header, idx) => {
            record[header.trim()] = values[idx]?.trim();
          });
          historicalData.gScoreHistory.push(record);
        }
      }
    }
    
    // Load ETF flows history
    const etfFlowsPath = path.join(dataDir, 'etf-flows-historical.json');
    if (fs.existsSync(etfFlowsPath)) {
      const content = fs.readFileSync(etfFlowsPath, 'utf8');
      historicalData.etfFlows = JSON.parse(content);
    }
    
  } catch (error) {
    console.error('Error loading historical data:', error);
  }
  
  return historicalData;
}

/**
 * Analyze factor change trends
 */
function analyzeFactorTrends(factorKey, currentScore, historicalData) {
  const factorHistory = historicalData.factorHistory
    .filter(record => record[factorKey] && !isNaN(parseFloat(record[factorKey])))
    .sort((a, b) => new Date(a.date || a.timestamp) - new Date(b.date || b.timestamp));
  
  if (factorHistory.length < 2) {
    return {
      trend: 'insufficient_data',
      context: 'Insufficient historical data for trend analysis',
      recommendations: ['Monitor factor for more data points']
    };
  }
  
  const recentScores = factorHistory.slice(-7).map(r => parseFloat(r[factorKey]));
  const olderScores = factorHistory.slice(-14, -7).map(r => parseFloat(r[factorKey]));
  
  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : recentAvg;
  
  const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';
  const volatility = calculateVolatility(recentScores);
  
  // Count consecutive days in current direction
  let consecutiveDays = 1;
  for (let i = factorHistory.length - 2; i >= 0; i--) {
    const current = parseFloat(factorHistory[i + 1][factorKey]);
    const previous = parseFloat(factorHistory[i][factorKey]);
    if ((current > previous && recentAvg > olderAvg) || (current < previous && recentAvg < olderAvg)) {
      consecutiveDays++;
    } else {
      break;
    }
  }
  
  return {
    trend,
    volatility: volatility > 10 ? 'high' : volatility > 5 ? 'medium' : 'low',
    consecutiveDays,
    recentAverage: recentAvg,
    previousAverage: olderAvg,
    context: generateFactorContext(trend, consecutiveDays, volatility, currentScore),
    recommendations: generateFactorRecommendations(trend, volatility, currentScore)
  };
}

/**
 * Analyze risk band change context
 */
function analyzeRiskBandContext(currentBand, previousBand, currentScore, previousScore, historicalData) {
  const bandHistory = historicalData.gScoreHistory
    .filter(record => record.gScore && !isNaN(parseFloat(record.gScore)))
    .sort((a, b) => new Date(a.date || a.timestamp) - new Date(b.date || b.timestamp));
  
  if (bandHistory.length < 2) {
    return {
      context: 'Insufficient historical data for band analysis',
      recommendations: ['Monitor G-Score trends for risk assessment']
    };
  }
  
  // Count days in each band over last 30 days
  const last30Days = bandHistory.slice(-30);
  const bandCounts = {};
  last30Days.forEach(record => {
    const score = parseFloat(record.gScore);
    const band = getRiskBand(score);
    bandCounts[band] = (bandCounts[band] || 0) + 1;
  });
  
  const daysInCurrentBand = bandCounts[currentBand] || 0;
  const daysInPreviousBand = bandCounts[previousBand] || 0;
  
  // Calculate trend
  const recentScores = last30Days.slice(-7).map(r => parseFloat(r.gScore));
  const olderScores = last30Days.slice(-14, -7).map(r => parseFloat(r.gScore));
  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : recentAvg;
  
  const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';
  
  return {
    daysInCurrentBand,
    daysInPreviousBand,
    trend,
    context: generateBandContext(currentBand, previousBand, daysInCurrentBand, daysInPreviousBand, trend),
    recommendations: generateBandRecommendations(currentBand, previousBand, trend, currentScore)
  };
}

/**
 * Analyze ETF flow context
 */
function analyzeETFContext(currentFlow, previousFlow, historicalData) {
  const etfFlows = historicalData.etfFlows || [];
  if (etfFlows.length < 2) {
    return {
      context: 'Insufficient ETF flow data for analysis',
      recommendations: ['Monitor ETF flows for trend analysis']
    };
  }
  
  const recentFlows = etfFlows.slice(-7).map(f => f.net_flow || 0);
  const olderFlows = etfFlows.slice(-14, -7).map(f => f.net_flow || 0);
  
  const recentAvg = recentFlows.reduce((a, b) => a + b, 0) / recentFlows.length;
  const olderAvg = olderFlows.length > 0 ? olderFlows.reduce((a, b) => a + b, 0) / olderFlows.length : recentAvg;
  
  const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';
  const volatility = calculateVolatility(recentFlows);
  
  // Count zero crosses in last 30 days
  const last30Flows = etfFlows.slice(-30);
  let zeroCrosses = 0;
  for (let i = 1; i < last30Flows.length; i++) {
    const current = last30Flows[i].net_flow || 0;
    const previous = last30Flows[i-1].net_flow || 0;
    if ((current > 0 && previous <= 0) || (current <= 0 && previous > 0)) {
      zeroCrosses++;
    }
  }
  
  return {
    trend,
    volatility: volatility > 50 ? 'high' : volatility > 25 ? 'medium' : 'low',
    zeroCrosses,
    recentAverage: recentAvg,
    previousAverage: olderAvg,
    context: generateETFContext(trend, zeroCrosses, volatility, currentFlow),
    recommendations: generateETFRecommendations(trend, volatility, currentFlow)
  };
}

/**
 * Generate contextual messages
 */
function generateFactorContext(trend, consecutiveDays, volatility, currentScore) {
  const parts = [];
  
  if (consecutiveDays > 1) {
    parts.push(`This is the ${consecutiveDays}${getOrdinalSuffix(consecutiveDays)} consecutive day of ${trend} trend`);
  }
  
  if (volatility === 'high') {
    parts.push('High volatility detected in recent movements');
  }
  
  if (currentScore > 80) {
    parts.push('Factor is in extremely high territory');
  } else if (currentScore < 20) {
    parts.push('Factor is in extremely low territory');
  }
  
  return parts.length > 0 ? parts.join('. ') + '.' : 'Factor showing normal variation';
}

function generateBandContext(currentBand, previousBand, daysInCurrent, daysInPrevious, trend) {
  const parts = [];
  
  if (daysInCurrent > 0) {
    parts.push(`Spent ${daysInCurrent} days in ${currentBand} band over last 30 days`);
  }
  
  if (daysInPrevious > 0) {
    parts.push(`Previously spent ${daysInPrevious} days in ${previousBand} band`);
  }
  
  if (trend === 'improving') {
    parts.push('G-Score showing improving trend');
  } else if (trend === 'declining') {
    parts.push('G-Score showing declining trend');
  }
  
  return parts.length > 0 ? parts.join('. ') + '.' : 'Risk band change with normal variation';
}

function generateETFContext(trend, zeroCrosses, volatility, currentFlow) {
  const parts = [];
  
  if (zeroCrosses > 0) {
    parts.push(`${zeroCrosses} zero-crosses in last 30 days`);
  }
  
  if (volatility === 'high') {
    parts.push('High volatility in ETF flows');
  }
  
  if (trend === 'improving') {
    parts.push('ETF flows showing improving trend');
  } else if (trend === 'declining') {
    parts.push('ETF flows showing declining trend');
  }
  
  if (Math.abs(currentFlow) > 100) {
    parts.push('Large flow magnitude detected');
  }
  
  return parts.length > 0 ? parts.join('. ') + '.' : 'ETF flow change with normal variation';
}

/**
 * Generate actionable recommendations
 */
function generateFactorRecommendations(trend, volatility, currentScore) {
  const recommendations = [];
  
  if (currentScore > 80) {
    recommendations.push('Consider reducing exposure - factor in extreme high territory');
  } else if (currentScore < 20) {
    recommendations.push('Consider increasing exposure - factor in extreme low territory');
  }
  
  if (volatility === 'high') {
    recommendations.push('Monitor closely - high volatility may indicate instability');
  }
  
  if (trend === 'declining') {
    recommendations.push('Watch for continued decline - may indicate weakening fundamentals');
  } else if (trend === 'improving') {
    recommendations.push('Positive momentum - consider if trend will continue');
  }
  
  return recommendations.length > 0 ? recommendations : ['Monitor factor for further changes'];
}

function generateBandRecommendations(currentBand, previousBand, trend, currentScore) {
  const recommendations = [];
  
  if (currentBand === 'Aggressive Buying') {
    recommendations.push('Consider increasing position size - aggressive buying opportunity');
  } else if (currentBand === 'Hold & Wait') {
    recommendations.push('Maintain current position - wait for clearer signals');
  } else if (currentBand === 'Caution') {
    recommendations.push('Reduce exposure - caution warranted');
  }
  
  if (trend === 'improving') {
    recommendations.push('Positive momentum - consider if improvement will continue');
  } else if (trend === 'declining') {
    recommendations.push('Monitor closely - declining trend may continue');
  }
  
  return recommendations.length > 0 ? recommendations : ['Monitor G-Score for further changes'];
}

function generateETFRecommendations(trend, volatility, currentFlow) {
  const recommendations = [];
  
  if (currentFlow > 50) {
    recommendations.push('Strong positive flows - bullish signal for Bitcoin');
  } else if (currentFlow < -50) {
    recommendations.push('Strong negative flows - bearish signal for Bitcoin');
  }
  
  if (volatility === 'high') {
    recommendations.push('High volatility - expect continued price swings');
  }
  
  if (trend === 'improving') {
    recommendations.push('ETF flows improving - positive for Bitcoin price');
  } else if (trend === 'declining') {
    recommendations.push('ETF flows declining - negative for Bitcoin price');
  }
  
  return recommendations.length > 0 ? recommendations : ['Monitor ETF flows for trend changes'];
}

/**
 * Utility functions
 */
function calculateVolatility(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getRiskBand(score) {
  if (score >= 0 && score <= 14) return 'Aggressive Buying';
  if (score >= 15 && score <= 34) return 'Regular DCA Buying';
  if (score >= 35 && score <= 49) return 'Hold & Wait';
  if (score >= 50 && score <= 64) return 'Hold & Wait';
  if (score >= 65 && score <= 79) return 'Caution';
  return 'Extreme Caution';
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return num + 'st';
  if (j === 2 && k !== 12) return num + 'nd';
  if (j === 3 && k !== 13) return num + 'rd';
  return num + 'th';
}

/**
 * Enhance alert with context
 */
export function enhanceAlertWithContext(alert, historicalData) {
  const enhanced = { ...alert };
  
  try {
    switch (alert.type) {
      case 'factor_change':
        if (alert.factorKey && alert.data?.change_points) {
          const context = analyzeFactorTrends(alert.factorKey, alert.data.current_score, historicalData);
          enhanced.context = context.context;
          enhanced.trend = context.trend;
          enhanced.consecutiveDays = context.consecutiveDays;
          enhanced.recommendations = context.recommendations;
        }
        break;
        
      case 'risk_band_change':
        if (alert.data?.previousBand && alert.data?.currentBand) {
          const context = analyzeRiskBandContext(
            alert.data.currentBand,
            alert.data.previousBand,
            alert.data.currentScore,
            alert.data.previousScore,
            historicalData
          );
          enhanced.context = context.context;
          enhanced.daysInCurrentBand = context.daysInCurrentBand;
          enhanced.daysInPreviousBand = context.daysInPreviousBand;
          enhanced.recommendations = context.recommendations;
        }
        break;
        
      case 'etf_zero_cross':
        if (alert.data?.currentFlow && alert.data?.previousFlow) {
          const context = analyzeETFContext(alert.data.currentFlow, alert.data.previousFlow, historicalData);
          enhanced.context = context.context;
          enhanced.trend = context.trend;
          enhanced.zeroCrosses = context.zeroCrosses;
          enhanced.recommendations = context.recommendations;
        }
        break;
        
      default:
        // For other alert types, add basic context
        enhanced.context = 'Alert generated based on current conditions';
        enhanced.recommendations = ['Monitor situation for further developments'];
    }
  } catch (error) {
    console.error('Error enhancing alert context:', error);
    enhanced.context = 'Context analysis unavailable';
    enhanced.recommendations = ['Monitor situation manually'];
  }
  
  return enhanced;
}

/**
 * Enhance all alerts in a collection
 */
export function enhanceAlertsWithContext(alerts, historicalData) {
  return alerts.map(alert => enhanceAlertWithContext(alert, historicalData));
}
