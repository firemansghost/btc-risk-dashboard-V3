#!/usr/bin/env node
/**
 * Risk Band Change Alerts
 * 
 * This script detects when G-Score crosses major risk band thresholds
 * and generates alerts for significant risk level changes.
 */

import fs from 'node:fs';

/**
 * Load G-Score history data
 */
function loadGScoreHistory() {
  const csvPath = 'public/data/history.csv';
  
  if (!fs.existsSync(csvPath)) {
    return {
      success: false,
      error: 'G-Score history CSV not found',
      data: []
    };
  }
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length <= 1) {
    return {
      success: false,
      error: 'No G-Score history data available',
      data: []
    };
  }
  
  const scores = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      scores.push({
        date: parts[0],
        gScore: parseFloat(parts[1]) || 0,
        band: parts[2] || 'Unknown'
      });
    }
  }
  
  return {
    success: true,
    data: scores.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}

/**
 * Determine risk band from G-Score
 */
function getRiskBand(gScore) {
  if (gScore >= 80) return 'Increase Selling';
  if (gScore >= 60) return 'Begin Scaling Out';
  if (gScore >= 40) return 'Hold/Neutral';
  if (gScore >= 20) return 'Begin Scaling In';
  return 'Increase Buying';
}

/**
 * Detect risk band change events
 */
function detectRiskBandChanges(scores) {
  if (scores.length < 2) {
    return {
      success: false,
      message: 'Insufficient data for risk band change detection',
      events: []
    };
  }
  
  const events = [];
  
  for (let i = 1; i < scores.length; i++) {
    const current = scores[i];
    const previous = scores[i - 1];
    
    const currentBand = getRiskBand(current.gScore);
    const previousBand = getRiskBand(previous.gScore);
    
    // Check for band changes
    if (currentBand !== previousBand) {
      const changeDirection = getChangeDirection(previous.gScore, current.gScore);
      const severity = calculateBandChangeSeverity(previousBand, currentBand, Math.abs(current.gScore - previous.gScore));
      
      events.push({
        type: 'band_change',
        date: current.date,
        previousScore: previous.gScore,
        currentScore: current.gScore,
        previousBand: previousBand,
        currentBand: currentBand,
        change: current.gScore - previous.gScore,
        changeDirection: changeDirection,
        severity: severity,
        description: `Risk band changed: ${previousBand} → ${currentBand} (${previous.gScore} → ${current.gScore})`
      });
    }
    
    // Check for significant score changes within the same band
    const scoreChange = Math.abs(current.gScore - previous.gScore);
    if (scoreChange >= 10 && currentBand === previousBand) {
      const severity = calculateScoreChangeSeverity(scoreChange);
      
      events.push({
        type: 'significant_score_change',
        date: current.date,
        previousScore: previous.gScore,
        currentScore: current.gScore,
        previousBand: previousBand,
        currentBand: currentBand,
        change: current.gScore - previous.gScore,
        changeDirection: getChangeDirection(previous.gScore, current.gScore),
        severity: severity,
        description: `Significant score change: ${previous.gScore} → ${current.gScore} (${currentBand})`
      });
    }
  }
  
  return {
    success: true,
    events: events,
    totalEvents: events.length
  };
}

/**
 * Get change direction
 */
function getChangeDirection(previousScore, currentScore) {
  if (currentScore > previousScore) return 'increasing';
  if (currentScore < previousScore) return 'decreasing';
  return 'stable';
}

/**
 * Calculate band change severity
 */
function calculateBandChangeSeverity(previousBand, currentBand, scoreChange) {
  // Critical band changes (high risk to low risk or vice versa)
  const criticalChanges = [
    ['Increase Selling', 'Increase Buying'],
    ['Increase Buying', 'Increase Selling'],
    ['Begin Scaling Out', 'Begin Scaling In'],
    ['Begin Scaling In', 'Begin Scaling Out']
  ];
  
  const isCritical = criticalChanges.some(([from, to]) => 
    (previousBand === from && currentBand === to) || 
    (previousBand === to && currentBand === from)
  );
  
  if (isCritical) return 'critical';
  if (scoreChange >= 20) return 'high';
  if (scoreChange >= 10) return 'medium';
  return 'low';
}

/**
 * Calculate score change severity
 */
function calculateScoreChangeSeverity(scoreChange) {
  if (scoreChange >= 20) return 'high';
  if (scoreChange >= 15) return 'medium';
  return 'low';
}

/**
 * Generate risk band change alert notifications
 */
function generateRiskBandAlerts(events) {
  const notifications = [];
  
  for (const event of events) {
    const notification = {
      id: `risk_band_alert_${event.date}_${Date.now()}`,
      type: 'risk_band_change',
      severity: event.severity,
      timestamp: new Date().toISOString(),
      date: event.date,
      title: getRiskBandAlertTitle(event.type, event.severity, event.changeDirection),
      message: event.description,
      data: {
        previousScore: event.previousScore,
        currentScore: event.currentScore,
        previousBand: event.previousBand,
        currentBand: event.currentBand,
        change: event.change,
        changeDirection: event.changeDirection
      },
      actions: getRiskBandAlertActions(event.type, event.severity, event.currentBand, event.changeDirection)
    };
    
    notifications.push(notification);
  }
  
  return notifications;
}

/**
 * Get risk band alert title
 */
function getRiskBandAlertTitle(eventType, severity, changeDirection) {
  const titles = {
    'band_change': {
      'critical': changeDirection === 'increasing' ? '🚨 CRITICAL: Risk Level Spiked' : '🚨 CRITICAL: Risk Level Dropped',
      'high': changeDirection === 'increasing' ? '⚠️ HIGH: Risk Level Increased' : '⚠️ HIGH: Risk Level Decreased',
      'medium': changeDirection === 'increasing' ? '📊 MEDIUM: Risk Level Rose' : '📊 MEDIUM: Risk Level Fell',
      'low': changeDirection === 'increasing' ? 'ℹ️ INFO: Risk Level Up' : 'ℹ️ INFO: Risk Level Down'
    },
    'significant_score_change': {
      'high': '⚠️ HIGH: Significant G-Score Change',
      'medium': '📊 MEDIUM: Notable G-Score Change',
      'low': 'ℹ️ INFO: G-Score Change'
    }
  };
  
  return titles[eventType]?.[severity] || 'Risk Band Alert';
}

/**
 * Get recommended actions for risk band changes
 */
function getRiskBandAlertActions(eventType, severity, currentBand, changeDirection) {
  const actions = {
    'band_change': {
      'critical': {
        'Increase Selling': ['Consider reducing Bitcoin exposure', 'Review portfolio allocation', 'Monitor for trend continuation'],
        'Begin Scaling Out': ['Consider scaling out of positions', 'Review risk management', 'Monitor market conditions'],
        'Hold/Neutral': ['Maintain current allocation', 'Monitor for further changes', 'Review risk parameters'],
        'Begin Scaling In': ['Consider scaling into positions', 'Review entry strategies', 'Monitor for trend confirmation'],
        'Increase Buying': ['Consider increasing Bitcoin allocation', 'Review accumulation strategy', 'Monitor for trend continuation']
      },
      'high': {
        'Increase Selling': ['Review portfolio risk', 'Consider position sizing', 'Monitor market conditions'],
        'Begin Scaling Out': ['Monitor for trend continuation', 'Review risk management', 'Consider scaling out'],
        'Hold/Neutral': ['Monitor market conditions', 'Review risk parameters', 'Assess trend direction'],
        'Begin Scaling In': ['Monitor for trend confirmation', 'Review entry strategies', 'Consider scaling in'],
        'Increase Buying': ['Monitor for trend continuation', 'Review accumulation strategy', 'Consider increasing allocation']
      },
      'medium': {
        'Increase Selling': ['Monitor market conditions', 'Review risk management'],
        'Begin Scaling Out': ['Monitor for trend continuation', 'Review risk parameters'],
        'Hold/Neutral': ['Monitor market conditions', 'Assess trend direction'],
        'Begin Scaling In': ['Monitor for trend confirmation', 'Review entry strategies'],
        'Increase Buying': ['Monitor for trend continuation', 'Review accumulation strategy']
      },
      'low': {
        'Increase Selling': ['Monitor market conditions'],
        'Begin Scaling Out': ['Monitor for trend continuation'],
        'Hold/Neutral': ['Monitor market conditions'],
        'Begin Scaling In': ['Monitor for trend confirmation'],
        'Increase Buying': ['Monitor for trend continuation']
      }
    },
    'significant_score_change': {
      'high': ['Investigate market catalysts', 'Review portfolio strategy', 'Monitor for trend reversal'],
      'medium': ['Analyze score drivers', 'Review risk management', 'Monitor market conditions'],
      'low': ['Monitor for follow-up changes', 'Assess market sentiment']
    }
  };
  
  return actions[eventType]?.[severity]?.[currentBand] || actions[eventType]?.[severity] || ['Monitor market conditions'];
}

/**
 * Save risk band alerts to file
 */
function saveRiskBandAlerts(notifications) {
  const alertsPath = 'public/data/risk_band_change_alerts.json';
  
  // Load existing alerts
  let existingAlerts = [];
  if (fs.existsSync(alertsPath)) {
    try {
      const existingContent = fs.readFileSync(alertsPath, 'utf8');
      existingAlerts = JSON.parse(existingContent);
    } catch (error) {
      console.log('⚠️  Could not load existing alerts, starting fresh');
    }
  }
  
  // Add new alerts
  const allAlerts = [...existingAlerts, ...notifications];
  
  // Keep only last 100 alerts to prevent file from growing too large
  const recentAlerts = allAlerts.slice(-100);
  
  fs.writeFileSync(alertsPath, JSON.stringify(recentAlerts, null, 2), 'utf8');
  
  return {
    totalAlerts: allAlerts.length,
    newAlerts: notifications.length,
    savedAlerts: recentAlerts.length
  };
}

/**
 * Main function to generate risk band change alerts
 */
async function generateRiskBandChangeAlerts() {
  console.log('📊 Generating Risk Band Change Alerts');
  console.log('====================================');
  
  try {
    // Load G-Score history
    const historyResult = loadGScoreHistory();
    if (!historyResult.success) {
      console.log(`❌ ${historyResult.error}`);
      return { success: false, error: historyResult.error };
    }
    
    console.log(`✅ Loaded ${historyResult.data.length} G-Score history records`);
    
    // Detect risk band changes
    const detectionResult = detectRiskBandChanges(historyResult.data);
    if (!detectionResult.success) {
      console.log(`❌ ${detectionResult.message}`);
      return { success: false, error: detectionResult.message };
    }
    
    console.log(`✅ Detected ${detectionResult.totalEvents} risk band change events`);
    
    if (detectionResult.events.length === 0) {
      console.log('ℹ️  No risk band change events detected in current data');
      return { success: true, events: 0, alerts: 0 };
    }
    
    // Generate alert notifications
    const notifications = generateRiskBandAlerts(detectionResult.events);
    console.log(`✅ Generated ${notifications.length} risk band alert notifications`);
    
    // Save alerts
    const saveResult = saveRiskBandAlerts(notifications);
    console.log(`✅ Saved ${saveResult.newAlerts} new alerts (${saveResult.totalAlerts} total)`);
    
    // Display summary
    console.log('\n📋 Risk Band Change Alerts Summary');
    console.log('==================================');
    
    const severityCounts = notifications.reduce((counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
      return counts;
    }, {});
    
    const eventTypeCounts = notifications.reduce((counts, alert) => {
      const type = alert.data.previousBand !== alert.data.currentBand ? 'band_change' : 'significant_score_change';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    
    console.log(`Total Events: ${detectionResult.totalEvents}`);
    console.log(`Band Changes: ${eventTypeCounts.band_change || 0}`);
    console.log(`Score Changes: ${eventTypeCounts.significant_score_change || 0}`);
    console.log(`Critical Alerts: ${severityCounts.critical || 0}`);
    console.log(`High Alerts: ${severityCounts.high || 0}`);
    console.log(`Medium Alerts: ${severityCounts.medium || 0}`);
    console.log(`Low Alerts: ${severityCounts.low || 0}`);
    
    console.log('\n🚨 Recent Alerts:');
    notifications.slice(-5).forEach(alert => {
      console.log(`   ${alert.date}: ${alert.title}`);
      console.log(`     ${alert.message}`);
    });
    
    console.log(`\n📄 Alerts saved to: public/data/risk_band_change_alerts.json`);
    
    return {
      success: true,
      events: detectionResult.totalEvents,
      alerts: notifications.length,
      severityCounts: severityCounts,
      eventTypeCounts: eventTypeCounts
    };
    
  } catch (error) {
    console.error('❌ Risk band change alerts generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateRiskBandChangeAlerts };

// Run the risk band change alerts generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateRiskBandChangeAlerts().catch(error => {
    console.error('❌ Risk band change alerts generation failed:', error);
    process.exit(1);
  });
}
