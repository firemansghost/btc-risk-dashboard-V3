#!/usr/bin/env node
/**
 * ETF Zero-Cross Alerts
 * 
 * This script detects when ETF flows change from inflows to outflows
 * and generates real-time alerts for significant flow changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { manageAlertsWithDeduplication } from './alert-deduplication.mjs';
import { enhanceAlertsWithContext } from './alert-context-enhancer.mjs';

/**
 * Load historical data for context enhancement
 */
function loadHistoricalData() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  
  const historicalData = {
    factorHistory: [],
    gScoreHistory: [],
    etfFlows: []
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
 * Load ETF flows data
 */
function loadEtfFlowsData() {
  const csvPath = 'public/signals/etf_flows_21d.csv';
  
  if (!fs.existsSync(csvPath)) {
    return {
      success: false,
      error: 'ETF flows CSV not found',
      data: []
    };
  }
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length <= 1) {
    return {
      success: false,
      error: 'No ETF flows data available',
      data: []
    };
  }
  
  const flows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 4) {
      flows.push({
        date: parts[0],
        sum21_usd: parseFloat(parts[1]) || 0,
        z: parseFloat(parts[2]) || 0,
        score: parseFloat(parts[3]) || 0
      });
    }
  }
  
  return {
    success: true,
    data: flows.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}

/**
 * Detect zero-cross events in ETF flows
 */
function detectZeroCrossEvents(flows) {
  if (flows.length < 2) {
    return {
      success: false,
      message: 'Insufficient data for zero-cross detection',
      events: []
    };
  }
  
  const events = [];
  
  for (let i = 1; i < flows.length; i++) {
    const current = flows[i];
    const previous = flows[i - 1];
    
    // Check for zero-cross events
    const currentFlow = current.sum21_usd;
    const previousFlow = previous.sum21_usd;
    
    // Zero-cross from positive to negative (inflows to outflows)
    if (previousFlow > 0 && currentFlow < 0) {
      events.push({
        type: 'inflow_to_outflow',
        date: current.date,
        previousFlow: previousFlow,
        currentFlow: currentFlow,
        change: currentFlow - previousFlow,
        severity: calculateSeverity(Math.abs(currentFlow - previousFlow)),
        description: `ETF flows crossed zero: ${previousFlow.toFixed(1)}M → ${currentFlow.toFixed(1)}M`
      });
    }
    
    // Zero-cross from negative to positive (outflows to inflows)
    if (previousFlow < 0 && currentFlow > 0) {
      events.push({
        type: 'outflow_to_inflow',
        date: current.date,
        previousFlow: previousFlow,
        currentFlow: currentFlow,
        change: currentFlow - previousFlow,
        severity: calculateSeverity(Math.abs(currentFlow - previousFlow)),
        description: `ETF flows crossed zero: ${previousFlow.toFixed(1)}M → ${currentFlow.toFixed(1)}M`
      });
    }
    
    // Significant flow changes (even without zero-cross)
    const flowChange = Math.abs(currentFlow - previousFlow);
    if (flowChange > 100) { // More than $100M change
      events.push({
        type: 'significant_change',
        date: current.date,
        previousFlow: previousFlow,
        currentFlow: currentFlow,
        change: currentFlow - previousFlow,
        severity: calculateSeverity(flowChange),
        description: `Significant ETF flow change: ${previousFlow.toFixed(1)}M → ${currentFlow.toFixed(1)}M (${flowChange.toFixed(1)}M change)`
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
 * Calculate alert severity based on flow change magnitude
 */
function calculateSeverity(changeMagnitude) {
  if (changeMagnitude >= 500) return 'critical';
  if (changeMagnitude >= 200) return 'high';
  if (changeMagnitude >= 100) return 'medium';
  return 'low';
}

/**
 * Generate alert notifications
 */
function generateAlertNotifications(events) {
  const notifications = [];
  
  for (const event of events) {
    const notification = {
      id: `etf_alert_${event.date}_${Date.now()}`,
      type: 'etf_zero_cross',
      severity: event.severity,
      timestamp: new Date().toISOString(),
      date: event.date,
      title: getAlertTitle(event.type, event.severity),
      message: event.description,
      data: {
        previousFlow: event.previousFlow,
        currentFlow: event.currentFlow,
        change: event.change,
        changePercent: event.previousFlow !== 0 ? ((event.change / Math.abs(event.previousFlow)) * 100).toFixed(1) : 'N/A'
      },
      actions: getAlertActions(event.type, event.severity)
    };
    
    notifications.push(notification);
  }
  
  return notifications;
}

/**
 * Get alert title based on event type and severity
 */
function getAlertTitle(eventType, severity) {
  const titles = {
    'inflow_to_outflow': {
      'critical': '🚨 CRITICAL: ETF Flows Turn Negative',
      'high': '⚠️ HIGH: ETF Flows Turn Negative',
      'medium': '📊 MEDIUM: ETF Flows Turn Negative',
      'low': 'ℹ️ INFO: ETF Flows Turn Negative'
    },
    'outflow_to_inflow': {
      'critical': '🚨 CRITICAL: ETF Flows Turn Positive',
      'high': '⚠️ HIGH: ETF Flows Turn Positive',
      'medium': '📊 MEDIUM: ETF Flows Turn Positive',
      'low': 'ℹ️ INFO: ETF Flows Turn Positive'
    },
    'significant_change': {
      'critical': '🚨 CRITICAL: Major ETF Flow Change',
      'high': '⚠️ HIGH: Major ETF Flow Change',
      'medium': '📊 MEDIUM: Significant ETF Flow Change',
      'low': 'ℹ️ INFO: ETF Flow Change'
    }
  };
  
  return titles[eventType]?.[severity] || 'ETF Flow Alert';
}

/**
 * Get recommended actions based on event type and severity
 */
function getAlertActions(eventType, severity) {
  const actions = {
    'inflow_to_outflow': {
      'critical': ['Review portfolio allocation', 'Consider reducing Bitcoin exposure', 'Monitor for trend continuation'],
      'high': ['Monitor ETF flow trends', 'Review risk management', 'Consider position sizing'],
      'medium': ['Track flow patterns', 'Assess market sentiment'],
      'low': ['Monitor for follow-up changes']
    },
    'outflow_to_inflow': {
      'critical': ['Consider increasing Bitcoin allocation', 'Monitor for trend confirmation', 'Review entry strategies'],
      'high': ['Monitor for trend continuation', 'Consider scaling in', 'Review risk parameters'],
      'medium': ['Track flow patterns', 'Assess market sentiment'],
      'low': ['Monitor for follow-up changes']
    },
    'significant_change': {
      'critical': ['Investigate market catalysts', 'Review portfolio strategy', 'Monitor for trend reversal'],
      'high': ['Analyze flow drivers', 'Review risk management', 'Monitor market conditions'],
      'medium': ['Track flow patterns', 'Assess market sentiment'],
      'low': ['Monitor for follow-up changes']
    }
  };
  
  return actions[eventType]?.[severity] || ['Monitor market conditions'];
}

/**
 * Save alerts to file
 */
function saveAlerts(notifications) {
  const alertsPath = 'public/data/etf_zero_cross_alerts.json';
  
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
  
  // Load historical data for context enhancement
  const historicalData = loadHistoricalData();
  
  // Enhance new alerts with context
  const enhancedAlerts = enhanceAlertsWithContext(notifications, historicalData);
  
  // Use deduplication system
  const result = manageAlertsWithDeduplication(existingAlerts, enhancedAlerts, {
    retentionDays: 30,
    maxAlerts: 200
  });
  
  // Save deduplicated alerts
  fs.writeFileSync(alertsPath, JSON.stringify(result.alerts, null, 2), 'utf8');
  
  console.log(`✅ ETF Zero-Cross Alert Management:`);
  console.log(`   📊 Original: ${result.stats.original} existing + ${result.stats.new} new`);
  console.log(`   🔄 Duplicates removed: ${result.stats.duplicatesRemoved}`);
  console.log(`   🗑️  Old alerts removed: ${result.stats.oldRemoved}`);
  console.log(`   📈 Final alerts: ${result.stats.final}`);
  
  return {
    totalAlerts: result.stats.final,
    newAlerts: result.stats.new,
    savedAlerts: result.stats.final
  };
}

/**
 * Main function to generate ETF zero-cross alerts
 */
async function generateEtfZeroCrossAlerts() {
  console.log('📊 Generating ETF Zero-Cross Alerts');
  console.log('==================================');
  
  try {
    // Load ETF flows data
    const flowsResult = loadEtfFlowsData();
    if (!flowsResult.success) {
      console.log(`❌ ${flowsResult.error}`);
      return { success: false, error: flowsResult.error };
    }
    
    console.log(`✅ Loaded ${flowsResult.data.length} ETF flows records`);
    
    // Detect zero-cross events
    const detectionResult = detectZeroCrossEvents(flowsResult.data);
    if (!detectionResult.success) {
      console.log(`❌ ${detectionResult.message}`);
      return { success: false, error: detectionResult.message };
    }
    
    console.log(`✅ Detected ${detectionResult.totalEvents} zero-cross events`);
    
    if (detectionResult.events.length === 0) {
      console.log('ℹ️  No zero-cross events detected in current data');
      return { success: true, events: 0, alerts: 0 };
    }
    
    // Generate alert notifications
    const notifications = generateAlertNotifications(detectionResult.events);
    console.log(`✅ Generated ${notifications.length} alert notifications`);
    
    // Save alerts
    const saveResult = saveAlerts(notifications);
    console.log(`✅ Saved ${saveResult.newAlerts} new alerts (${saveResult.totalAlerts} total)`);
    
    // Display summary
    console.log('\n📋 ETF Zero-Cross Alerts Summary');
    console.log('=================================');
    
    const severityCounts = notifications.reduce((counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
      return counts;
    }, {});
    
    console.log(`Total Events: ${detectionResult.totalEvents}`);
    console.log(`Critical Alerts: ${severityCounts.critical || 0}`);
    console.log(`High Alerts: ${severityCounts.high || 0}`);
    console.log(`Medium Alerts: ${severityCounts.medium || 0}`);
    console.log(`Low Alerts: ${severityCounts.low || 0}`);
    
    console.log('\n🚨 Recent Alerts:');
    notifications.slice(-5).forEach(alert => {
      console.log(`   ${alert.date}: ${alert.title}`);
      console.log(`     ${alert.message}`);
    });
    
    console.log(`\n📄 Alerts saved to: public/data/etf_zero_cross_alerts.json`);
    
    return {
      success: true,
      events: detectionResult.totalEvents,
      alerts: notifications.length,
      severityCounts: severityCounts
    };
    
  } catch (error) {
    console.error('❌ ETF zero-cross alerts generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateEtfZeroCrossAlerts };

// Run the ETF zero-cross alerts generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateEtfZeroCrossAlerts().catch(error => {
    console.error('❌ ETF zero-cross alerts generation failed:', error);
    process.exit(1);
  });
}
