#!/usr/bin/env node
/**
 * Enhanced Factor Monitoring
 * 
 * This script provides advanced monitoring to detect when factors become static
 * and alert on issues that could affect G-Score reliability.
 */

import fs from 'node:fs';

/**
 * Analyze factor score dynamics over time
 */
function analyzeFactorDynamics(csvPath, factorName) {
  if (!fs.existsSync(csvPath)) {
    return {
      factor: factorName,
      status: 'missing',
      score: 0,
      message: 'CSV file not found'
    };
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length < 10) {
    return {
      factor: factorName,
      status: 'insufficient_data',
      score: 0,
      message: `Only ${lines.length - 1} data points available`
    };
  }

  // Parse scores from CSV (assuming score is the last column)
  const scores = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const score = parseFloat(parts[parts.length - 1]);
    if (!isNaN(score)) {
      scores.push(score);
    }
  }

  if (scores.length < 5) {
    return {
      factor: factorName,
      status: 'insufficient_data',
      score: 0,
      message: `Only ${scores.length} valid scores found`
    };
  }

  // Calculate dynamics metrics
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const range = Math.max(...scores) - Math.min(...scores);
  
  // Check for static scores (low variance)
  const isStatic = stdDev < 5; // Less than 5 points standard deviation
  
  // Check for recent changes (last 5 scores)
  const recentScores = scores.slice(-5);
  const recentVariance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
  const recentStdDev = Math.sqrt(recentVariance);
  const isRecentlyStatic = recentStdDev < 3;
  
  // Calculate trend
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstHalfMean = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
  const secondHalfMean = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
  const trend = secondHalfMean - firstHalfMean;
  
  // Determine status
  let status = 'healthy';
  let message = 'Factor showing normal dynamics';
  
  if (isStatic && isRecentlyStatic) {
    status = 'critical';
    message = 'Factor appears completely static (low variance in all recent data)';
  } else if (isStatic) {
    status = 'warning';
    message = 'Factor showing low overall variance (may be static)';
  } else if (isRecentlyStatic) {
    status = 'info';
    message = 'Factor recently static but has historical variance';
  }
  
  if (Math.abs(trend) > 20) {
    status = status === 'healthy' ? 'info' : status;
    message += ` (strong trend: ${trend > 0 ? '+' : ''}${trend.toFixed(1)} points)`;
  }

  return {
    factor: factorName,
    status: status,
    score: Math.round(mean),
    dataPoints: scores.length,
    stdDev: Math.round(stdDev * 100) / 100,
    range: Math.round(range),
    trend: Math.round(trend * 10) / 10,
    isStatic: isStatic,
    isRecentlyStatic: isRecentlyStatic,
    message: message
  };
}

/**
 * Check G-Score diversity over time
 */
function analyzeGScoreDiversity(historyPath) {
  if (!fs.existsSync(historyPath)) {
    return {
      status: 'missing',
      message: 'History file not found'
    };
  }

  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length < 10) {
    return {
      status: 'insufficient_data',
      message: `Only ${lines.length - 1} data points available`
    };
  }

  // Parse G-Scores from history.csv
  const gScores = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const gScore = parseFloat(parts[1]); // G-Score is typically column 1
    if (!isNaN(gScore)) {
      gScores.push(gScore);
    }
  }

  if (gScores.length < 5) {
    return {
      status: 'insufficient_data',
      message: `Only ${gScores.length} valid G-Scores found`
    };
  }

  // Calculate diversity metrics
  const mean = gScores.reduce((sum, score) => sum + score, 0) / gScores.length;
  const variance = gScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / gScores.length;
  const stdDev = Math.sqrt(variance);
  const range = Math.max(...gScores) - Math.min(...gScores);
  
  // Check for static G-Scores
  const isStatic = stdDev < 5; // Less than 5 points standard deviation
  
  // Check for recent changes (last 10 scores)
  const recentScores = gScores.slice(-10);
  const recentVariance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
  const recentStdDev = Math.sqrt(recentVariance);
  const isRecentlyStatic = recentStdDev < 3;
  
  // Determine status
  let status = 'healthy';
  let message = 'G-Score showing good diversity';
  
  if (isStatic && isRecentlyStatic) {
    status = 'critical';
    message = 'G-Score appears completely static (low variance in all recent data)';
  } else if (isStatic) {
    status = 'warning';
    message = 'G-Score showing low overall variance (may be static)';
  } else if (isRecentlyStatic) {
    status = 'info';
    message = 'G-Score recently static but has historical variance';
  }

  return {
    status: status,
    dataPoints: gScores.length,
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(stdDev * 100) / 100,
    range: Math.round(range),
    isStatic: isStatic,
    isRecentlyStatic: isRecentlyStatic,
    message: message
  };
}

/**
 * Main monitoring function
 */
async function runEnhancedFactorMonitoring() {
  console.log('🔍 Enhanced Factor Monitoring');
  console.log('============================');
  
  const factorCSVs = [
    { path: 'public/signals/etf_flows_21d.csv', name: 'ETF Flows' },
    { path: 'public/signals/funding_7d.csv', name: 'Funding Rates' },
    { path: 'public/signals/stablecoins_30d.csv', name: 'Stablecoins' },
    { path: 'public/signals/net_liquidity_20d.csv', name: 'Net Liquidity' },
    { path: 'public/signals/mayer_multiple.csv', name: 'Mayer Multiple' },
    { path: 'public/signals/dxy_20d.csv', name: 'DXY' },
    { path: 'public/signals/fear_greed.csv', name: 'Fear & Greed' }
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    factors: [],
    gScore: null,
    overallHealth: 'healthy',
    alerts: []
  };
  
  // Analyze individual factors
  console.log('📊 Analyzing individual factors...');
  for (const factor of factorCSVs) {
    const analysis = analyzeFactorDynamics(factor.path, factor.name);
    results.factors.push(analysis);
    
    console.log(`   ${factor.name}: ${analysis.status.toUpperCase()} - ${analysis.message}`);
    
    if (analysis.status === 'critical') {
      results.alerts.push({
        severity: 'critical',
        factor: factor.name,
        message: analysis.message
      });
    } else if (analysis.status === 'warning') {
      results.alerts.push({
        severity: 'warning',
        factor: factor.name,
        message: analysis.message
      });
    }
  }
  
  // Analyze G-Score diversity
  console.log('\n📊 Analyzing G-Score diversity...');
  const gScoreAnalysis = analyzeGScoreDiversity('public/data/history.csv');
  results.gScore = gScoreAnalysis;
  
  console.log(`   G-Score: ${gScoreAnalysis.status.toUpperCase()} - ${gScoreAnalysis.message}`);
  
  if (gScoreAnalysis.status === 'critical') {
    results.alerts.push({
      severity: 'critical',
      factor: 'G-Score',
      message: gScoreAnalysis.message
    });
  } else if (gScoreAnalysis.status === 'warning') {
    results.alerts.push({
      severity: 'warning',
      factor: 'G-Score',
      message: gScoreAnalysis.message
    });
  }
  
  // Determine overall health
  const criticalFactors = results.factors.filter(f => f.status === 'critical').length;
  const warningFactors = results.factors.filter(f => f.status === 'warning').length;
  
  if (criticalFactors > 0 || gScoreAnalysis.status === 'critical') {
    results.overallHealth = 'critical';
  } else if (warningFactors > 0 || gScoreAnalysis.status === 'warning') {
    results.overallHealth = 'warning';
  } else {
    results.overallHealth = 'healthy';
  }
  
  // Save monitoring results
  const monitoringPath = 'public/data/enhanced-factor-monitoring.json';
  fs.writeFileSync(monitoringPath, JSON.stringify(results, null, 2), 'utf8');
  
  // Display summary
  console.log('\n📋 Enhanced Factor Monitoring Summary');
  console.log('=====================================');
  console.log(`Overall Health: ${results.overallHealth.toUpperCase()}`);
  console.log(`Factors Analyzed: ${results.factors.length}`);
  console.log(`Critical Issues: ${results.alerts.filter(a => a.severity === 'critical').length}`);
  console.log(`Warning Issues: ${results.alerts.filter(a => a.severity === 'warning').length}`);
  
  if (results.alerts.length > 0) {
    console.log('\n🚨 Active Alerts:');
    results.alerts.forEach(alert => {
      console.log(`   ${alert.severity.toUpperCase()}: ${alert.factor} - ${alert.message}`);
    });
  } else {
    console.log('\n✅ No issues detected - all factors healthy!');
  }
  
  console.log(`\n📄 Monitoring results saved to: ${monitoringPath}`);
  
  return results;
}

// Run the monitoring
runEnhancedFactorMonitoring().catch(error => {
  console.error('❌ Monitoring failed:', error);
  process.exit(1);
});
