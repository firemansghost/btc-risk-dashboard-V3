#!/usr/bin/env node
/**
 * Factor Staleness Alerts
 * 
 * This script detects when factor data becomes too old and generates
 * alerts for data staleness issues that could affect G-Score reliability.
 */

import fs from 'node:fs';

/**
 * Load latest factor data
 */
function loadLatestFactorData() {
  const latestPath = 'public/data/latest.json';
  
  if (!fs.existsSync(latestPath)) {
    return {
      success: false,
      error: 'Latest factor data not found',
      data: null
    };
  }
  
  try {
    const content = fs.readFileSync(latestPath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse latest data: ${error.message}`,
      data: null
    };
  }
}

/**
 * Calculate data age in hours
 */
function calculateDataAge(lastUtc) {
  if (!lastUtc) return null;
  
  const lastUpdate = new Date(lastUtc);
  const now = new Date();
  const diffMs = now - lastUpdate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  
  return diffHours;
}

/**
 * Get factor TTL (Time To Live) in hours
 */
function getFactorTTL(factorKey) {
  const ttlMap = {
    'trend_valuation': 6,
    'onchain': 72,
    'stablecoins': 24,
    'etf_flows': 24,
    'net_liquidity': 240, // 10 days
    'term_leverage': 24,
    'macro_overlay': 24,
    'social_interest': 24
  };
  
  return ttlMap[factorKey] || 24; // Default 24 hours
}

/**
 * Determine staleness severity
 */
function determineStalenessSeverity(ageHours, ttlHours) {
  if (ageHours > ttlHours * 2) return 'critical'; // More than 2x TTL
  if (ageHours > ttlHours) return 'high'; // Exceeds TTL
  if (ageHours > ttlHours * 0.8) return 'medium'; // 80% of TTL
  if (ageHours > ttlHours * 0.5) return 'low'; // 50% of TTL
  return 'fresh';
}

/**
 * Detect factor staleness issues
 */
function detectFactorStaleness(factorData) {
  if (!factorData || !factorData.factors) {
    return {
      success: false,
      message: 'No factor data available for staleness detection',
      alerts: []
    };
  }
  
  const alerts = [];
  const now = new Date();
  
  for (const factor of factorData.factors) {
    const ageHours = calculateDataAge(factor.last_utc);
    const ttlHours = getFactorTTL(factor.key);
    const severity = determineStalenessSeverity(ageHours, ttlHours);
    
    // Only create alerts for stale factors
    if (severity !== 'fresh') {
      const stalenessAlert = {
        factor: factor.label,
        factorKey: factor.key,
        status: factor.status,
        score: factor.score,
        lastUpdate: factor.last_utc,
        ageHours: ageHours,
        ttlHours: ttlHours,
        severity: severity,
        description: getStalenessDescription(factor.label, ageHours, ttlHours, severity)
      };
      
      alerts.push(stalenessAlert);
    }
  }
  
  return {
    success: true,
    alerts: alerts,
    totalAlerts: alerts.length
  };
}

/**
 * Get staleness description
 */
function getStalenessDescription(factorName, ageHours, ttlHours, severity) {
  const ageDescription = ageHours < 24 ? `${ageHours}h` : `${Math.round(ageHours / 24)}d`;
  const ttlDescription = ttlHours < 24 ? `${ttlHours}h` : `${Math.round(ttlHours / 24)}d`;
  
  const descriptions = {
    'critical': `${factorName} data is critically stale (${ageDescription} old, TTL: ${ttlDescription})`,
    'high': `${factorName} data is stale (${ageDescription} old, TTL: ${ttlDescription})`,
    'medium': `${factorName} data is aging (${ageDescription} old, TTL: ${ttlDescription})`,
    'low': `${factorName} data is getting old (${ageDescription} old, TTL: ${ttlDescription})`
  };
  
  return descriptions[severity] || `${factorName} data staleness detected`;
}

/**
 * Generate staleness alert notifications
 */
function generateStalenessAlerts(stalenessAlerts) {
  const notifications = [];
  
  for (const alert of stalenessAlerts) {
    const notification = {
      id: `staleness_alert_${alert.factorKey}_${Date.now()}`,
      type: 'factor_staleness',
      severity: alert.severity,
      timestamp: new Date().toISOString(),
      factor: alert.factor,
      factorKey: alert.factorKey,
      title: getStalenessAlertTitle(alert.severity, alert.factor),
      message: alert.description,
      data: {
        factor: alert.factor,
        factorKey: alert.factorKey,
        status: alert.status,
        score: alert.score,
        lastUpdate: alert.lastUpdate,
        ageHours: alert.ageHours,
        ttlHours: alert.ttlHours,
        severity: alert.severity
      },
      actions: getStalenessAlertActions(alert.severity, alert.factorKey)
    };
    
    notifications.push(notification);
  }
  
  return notifications;
}

/**
 * Get staleness alert title
 */
function getStalenessAlertTitle(severity, factorName) {
  const titles = {
    'critical': `🚨 CRITICAL: ${factorName} Data Critically Stale`,
    'high': `⚠️ HIGH: ${factorName} Data Stale`,
    'medium': `📊 MEDIUM: ${factorName} Data Aging`,
    'low': `ℹ️ INFO: ${factorName} Data Getting Old`
  };
  
  return titles[severity] || `${factorName} Staleness Alert`;
}

/**
 * Get recommended actions for staleness alerts
 */
function getStalenessAlertActions(severity, factorKey) {
  const actions = {
    'critical': [
      'Check data source connectivity',
      'Verify API keys and endpoints',
      'Review ETL pipeline logs',
      'Consider manual data refresh',
      'Monitor for system issues'
    ],
    'high': [
      'Check data source status',
      'Review ETL pipeline',
      'Monitor for API issues',
      'Consider data source alternatives'
    ],
    'medium': [
      'Monitor data source health',
      'Check for scheduled maintenance',
      'Review update frequency'
    ],
    'low': [
      'Monitor for further delays',
      'Check data source status'
    ]
  };
  
  // Add factor-specific actions
  const factorSpecificActions = {
    'stablecoins': ['Check CoinGecko API status', 'Verify rate limiting', 'Review stablecoin data sources'],
    'etf_flows': ['Check Farside website status', 'Verify HTML parsing', 'Review ETF data sources'],
    'net_liquidity': ['Check FRED API status', 'Verify API key', 'Review macro data sources'],
    'term_leverage': ['Check BitMEX API status', 'Verify funding rate data', 'Review leverage data sources'],
    'social_interest': ['Check Alternative.me API', 'Verify Fear & Greed data', 'Review social data sources'],
    'onchain': ['Check blockchain data sources', 'Verify mempool data', 'Review on-chain metrics'],
    'trend_valuation': ['Check price data sources', 'Verify technical indicators', 'Review trend calculations'],
    'macro_overlay': ['Check macro data sources', 'Verify DXY data', 'Review treasury data']
  };
  
  const baseActions = actions[severity] || ['Monitor data source'];
  const specificActions = factorSpecificActions[factorKey] || [];
  
  return [...baseActions, ...specificActions];
}

/**
 * Save staleness alerts to file
 */
function saveStalenessAlerts(notifications) {
  const alertsPath = 'public/data/factor_staleness_alerts.json';
  
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
 * Main function to generate factor staleness alerts
 */
async function generateFactorStalenessAlerts() {
  console.log('📊 Generating Factor Staleness Alerts');
  console.log('===================================');
  
  try {
    // Load latest factor data
    const dataResult = loadLatestFactorData();
    if (!dataResult.success) {
      console.log(`❌ ${dataResult.error}`);
      return { success: false, error: dataResult.error };
    }
    
    console.log('✅ Loaded latest factor data');
    
    // Detect staleness issues
    const stalenessResult = detectFactorStaleness(dataResult.data);
    if (!stalenessResult.success) {
      console.log(`❌ ${stalenessResult.message}`);
      return { success: false, error: stalenessResult.message };
    }
    
    console.log(`✅ Detected ${stalenessResult.totalAlerts} staleness issues`);
    
    if (stalenessResult.alerts.length === 0) {
      console.log('ℹ️  No staleness issues detected - all factors are fresh');
      return { success: true, alerts: 0 };
    }
    
    // Generate alert notifications
    const notifications = generateStalenessAlerts(stalenessResult.alerts);
    console.log(`✅ Generated ${notifications.length} staleness alert notifications`);
    
    // Save alerts
    const saveResult = saveStalenessAlerts(notifications);
    console.log(`✅ Saved ${saveResult.newAlerts} new alerts (${saveResult.totalAlerts} total)`);
    
    // Display summary
    console.log('\n📋 Factor Staleness Alerts Summary');
    console.log('==================================');
    
    const severityCounts = notifications.reduce((counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
      return counts;
    }, {});
    
    console.log(`Total Staleness Issues: ${stalenessResult.totalAlerts}`);
    console.log(`Critical Alerts: ${severityCounts.critical || 0}`);
    console.log(`High Alerts: ${severityCounts.high || 0}`);
    console.log(`Medium Alerts: ${severityCounts.medium || 0}`);
    console.log(`Low Alerts: ${severityCounts.low || 0}`);
    
    console.log('\n🚨 Staleness Issues:');
    stalenessResult.alerts.forEach(alert => {
      console.log(`   ${alert.factor}: ${alert.severity.toUpperCase()} - ${alert.description}`);
    });
    
    console.log(`\n📄 Alerts saved to: public/data/factor_staleness_alerts.json`);
    
    return {
      success: true,
      alerts: stalenessResult.totalAlerts,
      notifications: notifications.length,
      severityCounts: severityCounts
    };
    
  } catch (error) {
    console.error('❌ Factor staleness alerts generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateFactorStalenessAlerts };

// Run the factor staleness alerts generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorStalenessAlerts().catch(error => {
    console.error('❌ Factor staleness alerts generation failed:', error);
    process.exit(1);
  });
}
