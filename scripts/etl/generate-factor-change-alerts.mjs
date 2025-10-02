#!/usr/bin/env node
/**
 * Generate Factor Change Alerts
 * 
 * This script compares current factor scores with previous day's scores
 * and generates alerts for significant changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { manageAlertsWithDeduplication } from './alert-deduplication.mjs';
import { determineSeverity, getSeverityConfig } from './alert-severity-system.mjs';

// Factor configuration
const FACTOR_CONFIG = {
  trend_valuation: { label: 'Trend & Valuation', weight: 20 },
  onchain: { label: 'On-chain Activity', weight: 5 },
  stablecoins: { label: 'Stablecoins', weight: 21 },
  etf_flows: { label: 'ETF Flows', weight: 9 },
  net_liquidity: { label: 'Net Liquidity', weight: 5 },
  term_leverage: { label: 'Term Structure & Leverage', weight: 20 },
  macro_overlay: { label: 'Macro Overlay', weight: 10 },
  social_interest: { label: 'Social Interest', weight: 10 }
};

// Alert thresholds
const THRESHOLDS = {
  medium: 10,  // ±10 points change
  high: 20     // ±20 points change
};

/**
 * Load factor history from CSV
 */
function loadFactorHistory() {
  try {
    const csvPath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      console.log('⚠️  Insufficient factor history data');
      return [];
    }
    
    const headers = lines[0].split(',');
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const record = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index] || null;
      });
      
      records.push(record);
    }
    
    return records;
  } catch (error) {
    console.log(`⚠️  Error loading factor history: ${error.message}`);
    return [];
  }
}

/**
 * Get current factor scores from latest.json
 */
function getCurrentFactorScores() {
  try {
    const latestPath = path.join(process.cwd(), 'public', 'data', 'latest.json');
    const content = fs.readFileSync(latestPath, 'utf8');
    const data = JSON.parse(content);
    
    const scores = {};
    if (data.factors && Array.isArray(data.factors)) {
      data.factors.forEach(factor => {
        if (factor.score !== null && factor.score !== undefined) {
          scores[factor.key] = {
            score: factor.score,
            status: factor.status,
            label: factor.label
          };
        }
      });
    }
    
    return scores;
  } catch (error) {
    console.log(`⚠️  Error loading current factor scores: ${error.message}`);
    return {};
  }
}

/**
 * Calculate factor change and determine severity
 */
function calculateFactorChange(currentScore, previousScore) {
  if (currentScore === null || previousScore === null || 
      currentScore === undefined || previousScore === undefined) {
    return null;
  }
  
  const change = currentScore - previousScore;
  const absChange = Math.abs(change);
  
  // Use unified severity system
  const severity = determineSeverity('factor_change', absChange);
  
  return {
    change,
    absChange,
    severity,
    changePercentage: previousScore !== 0 ? (change / previousScore) * 100 : 0
  };
}

/**
 * Generate factor change alert
 */
function generateFactorChangeAlert(factorKey, currentScore, previousScore, changeData) {
  const factor = FACTOR_CONFIG[factorKey];
  if (!factor) return null;
  
  const change = changeData.change;
  const severity = changeData.severity;
  const changeDir = change > 0 ? 'increased' : 'decreased';
  const changeAbs = Math.abs(change);
  
  const alert = {
    id: `factor_change_${factorKey}_${Date.now()}`,
    type: 'factor_change',
    severity: severity,
    timestamp: new Date().toISOString(),
    factor: factor.label,
    factorKey: factorKey,
    title: `📊 ${severity.toUpperCase()}: ${factor.label} Factor Changed`,
    message: `${factor.label} ${changeDir} significantly: ${previousScore} → ${currentScore} (${change > 0 ? '+' : ''}${change.toFixed(1)} points)`,
    data: {
      factor: factor.label,
      factorKey: factorKey,
      previous_score: previousScore,
      current_score: currentScore,
      change_points: change,
      change_percentage: changeData.changePercentage,
      severity: severity,
      weight: factor.weight
    },
    actions: [
      'Review factor details and recent changes',
      'Consider implications for market outlook',
      'Monitor for continued factor volatility',
      'Check data source reliability',
      'Review related market indicators'
    ]
  };
  
  return alert;
}

/**
 * Main function to generate factor change alerts
 */
async function generateFactorChangeAlerts() {
  console.log('🔍 Generating Factor Change Alerts...');
  console.log('=====================================');
  
  // Load factor history
  const history = loadFactorHistory();
  if (history.length < 2) {
    console.log('⚠️  Insufficient history data for comparison');
    return;
  }
  
  // Get current factor scores
  const currentScores = getCurrentFactorScores();
  if (Object.keys(currentScores).length === 0) {
    console.log('⚠️  No current factor scores available');
    return;
  }
  
  // Get previous day's scores (most recent history entry)
  const previousRecord = history[history.length - 1];
  const previousScores = {};
  
  Object.keys(FACTOR_CONFIG).forEach(factorKey => {
    const scoreKey = `${factorKey}_score`;
    const score = previousRecord[scoreKey];
    if (score && score !== 'null' && score !== '') {
      previousScores[factorKey] = parseFloat(score);
    }
  });
  
  console.log(`📊 Comparing ${Object.keys(currentScores).length} current factors with previous day`);
  
  const alerts = [];
  
  // Compare each factor
  Object.keys(FACTOR_CONFIG).forEach(factorKey => {
    const currentScore = currentScores[factorKey]?.score;
    const previousScore = previousScores[factorKey];
    
    if (currentScore !== undefined && previousScore !== undefined) {
      const changeData = calculateFactorChange(currentScore, previousScore);
      
      if (changeData && changeData.severity) {
        const alert = generateFactorChangeAlert(factorKey, currentScore, previousScore, changeData);
        if (alert) {
          alerts.push(alert);
          console.log(`🚨 ${alert.severity.toUpperCase()}: ${alert.factor} changed ${changeData.change > 0 ? '+' : ''}${changeData.change.toFixed(1)} points (${previousScore} → ${currentScore})`);
        }
      }
    }
  });
  
  // Save alerts with deduplication
  const alertsPath = path.join(process.cwd(), 'public', 'data', 'factor_change_alerts.json');
  
  // Load existing alerts
  let existingAlerts = [];
  try {
    if (fs.existsSync(alertsPath)) {
      const content = fs.readFileSync(alertsPath, 'utf8');
      existingAlerts = JSON.parse(content);
    }
  } catch (error) {
    console.log(`⚠️  Error loading existing alerts: ${error.message}`);
  }
  
  if (alerts.length > 0) {
    // Use deduplication system
    const result = manageAlertsWithDeduplication(existingAlerts, alerts, {
      retentionDays: 30,
      maxAlerts: 500
    });
    
    // Save deduplicated alerts
    fs.writeFileSync(alertsPath, JSON.stringify(result.alerts, null, 2));
    
    console.log(`✅ Factor Change Alert Management:`);
    console.log(`   📊 Original: ${result.stats.original} existing + ${result.stats.new} new`);
    console.log(`   🔄 Duplicates removed: ${result.stats.duplicatesRemoved}`);
    console.log(`   🗑️  Old alerts removed: ${result.stats.oldRemoved}`);
    console.log(`   📁 Final count: ${result.stats.final} alerts`);
  } else {
    console.log('✅ No significant factor changes detected');
    
    // Still clean up old alerts even if no new ones
    if (existingAlerts.length > 0) {
      const result = manageAlertsWithDeduplication(existingAlerts, [], {
        retentionDays: 30,
        maxAlerts: 500
      });
      
      if (result.stats.oldRemoved > 0) {
        fs.writeFileSync(alertsPath, JSON.stringify(result.alerts, null, 2));
        console.log(`🗑️  Cleaned up ${result.stats.oldRemoved} old alerts`);
      }
    }
  }
  
  // Update combined alerts file
  try {
    const combinedAlertsPath = path.join(process.cwd(), 'public', 'data', 'alerts', 'latest.json');
    const alertsDir = path.dirname(combinedAlertsPath);
    
    if (!fs.existsSync(alertsDir)) {
      fs.mkdirSync(alertsDir, { recursive: true });
    }
    
    // Load all alert types
    const alertTypes = [
      'etf_zero_cross_alerts',
      'risk_band_change_alerts',
      'factor_staleness_alerts',
      'cycle_adjustment_alerts',
      'spike_adjustment_alerts',
      'sma50w_warning_alerts',
      'factor_change_alerts'
    ];
    
    const allAlerts = [];
    
    for (const alertType of alertTypes) {
      const filePath = path.join(process.cwd(), 'public', 'data', `${alertType}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const alerts = JSON.parse(content);
          if (Array.isArray(alerts)) {
            allAlerts.push(...alerts);
          }
        } catch (error) {
          console.log(`⚠️  Error loading ${alertType}: ${error.message}`);
        }
      }
    }
    
    // Sort by timestamp (newest first)
    allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Save combined alerts
    const combinedData = {
      timestamp: new Date().toISOString(),
      total_alerts: allAlerts.length,
      alerts: allAlerts
    };
    
    fs.writeFileSync(combinedAlertsPath, JSON.stringify(combinedData, null, 2));
    console.log(`✅ Updated combined alerts file with ${allAlerts.length} total alerts`);
    
  } catch (error) {
    console.log(`⚠️  Error updating combined alerts: ${error.message}`);
  }
  
  console.log('🎯 Factor change alert generation complete');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorChangeAlerts().catch(console.error);
}

export { generateFactorChangeAlerts };
