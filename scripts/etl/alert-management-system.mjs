#!/usr/bin/env node
/**
 * Alert Management System
 * 
 * This script provides a comprehensive alert management system that
 * consolidates all alert types and provides management capabilities.
 */

import fs from 'node:fs';

/**
 * Load all alert types
 */
function loadAllAlerts() {
  const alertTypes = [
    'etf_zero_cross_alerts',
    'risk_band_change_alerts',
    'factor_staleness_alerts'
  ];
  
  const allAlerts = [];
  
  for (const alertType of alertTypes) {
    const filePath = `public/data/${alertType}.json`;
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const alerts = JSON.parse(content);
        
        if (Array.isArray(alerts)) {
          allAlerts.push(...alerts);
        }
      } catch (error) {
        console.log(`⚠️  Could not load ${alertType}: ${error.message}`);
      }
    }
  }
  
  return allAlerts;
}

/**
 * Generate alert statistics
 */
function generateAlertStatistics(alerts) {
  const stats = {
    total: alerts.length,
    byType: {},
    bySeverity: {},
    byDate: {},
    recent: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (const alert of alerts) {
    // Count by type
    stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    
    // Count by severity
    stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
    
    // Count severity totals
    if (alert.severity === 'critical') stats.critical++;
    else if (alert.severity === 'high') stats.high++;
    else if (alert.severity === 'medium') stats.medium++;
    else if (alert.severity === 'low') stats.low++;
    
    // Count recent alerts (last 24 hours)
    const alertDate = new Date(alert.timestamp);
    if (alertDate > oneDayAgo) {
      stats.recent++;
    }
    
    // Count by date
    const dateKey = alertDate.toISOString().split('T')[0];
    stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
  }
  
  return stats;
}

/**
 * Generate alert summary report
 */
function generateAlertSummary(alerts, stats) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalAlerts: stats.total,
    recentAlerts: stats.recent,
    criticalAlerts: stats.critical,
    alertTypes: stats.byType,
    severityBreakdown: stats.bySeverity,
    dailyBreakdown: stats.byDate,
    systemHealth: determineSystemHealth(stats),
    recommendations: generateRecommendations(stats, alerts)
  };
  
  return summary;
}

/**
 * Determine system health based on alerts
 */
function determineSystemHealth(stats) {
  if (stats.critical > 5) return 'critical';
  if (stats.critical > 0 || stats.high > 10) return 'warning';
  if (stats.medium > 20) return 'caution';
  return 'healthy';
}

/**
 * Generate recommendations based on alert patterns
 */
function generateRecommendations(stats, alerts) {
  const recommendations = [];
  
  if (stats.critical > 0) {
    recommendations.push({
      priority: 'high',
      category: 'critical_alerts',
      message: `${stats.critical} critical alerts require immediate attention`,
      actions: [
        'Review critical alerts immediately',
        'Check system health and data sources',
        'Consider emergency procedures'
      ]
    });
  }
  
  if (stats.recent > 20) {
    recommendations.push({
      priority: 'medium',
      category: 'high_volume',
      message: `High alert volume: ${stats.recent} alerts in last 24 hours`,
      actions: [
        'Review alert thresholds',
        'Consider adjusting sensitivity',
        'Check for system issues'
      ]
    });
  }
  
  if (stats.byType.factor_staleness > 5) {
    recommendations.push({
      priority: 'medium',
      category: 'data_quality',
      message: 'Multiple factor staleness alerts detected',
      actions: [
        'Check data source connectivity',
        'Review ETL pipeline health',
        'Verify API keys and endpoints'
      ]
    });
  }
  
  if (stats.byType.etf_zero_cross > 10) {
    recommendations.push({
      priority: 'low',
      category: 'market_volatility',
      message: 'High ETF flow volatility detected',
      actions: [
        'Monitor market conditions',
        'Review portfolio allocation',
        'Consider risk management adjustments'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Clean up old alerts
 */
function cleanupOldAlerts() {
  const alertTypes = [
    'etf_zero_cross_alerts',
    'risk_band_change_alerts',
    'factor_staleness_alerts'
  ];
  
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const cutoffDate = new Date(Date.now() - maxAge);
  
  let totalCleaned = 0;
  
  for (const alertType of alertTypes) {
    const filePath = `public/data/${alertType}.json`;
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const alerts = JSON.parse(content);
        
        if (Array.isArray(alerts)) {
          const filteredAlerts = alerts.filter(alert => {
            const alertDate = new Date(alert.timestamp);
            return alertDate > cutoffDate;
          });
          
          if (filteredAlerts.length !== alerts.length) {
            fs.writeFileSync(filePath, JSON.stringify(filteredAlerts, null, 2), 'utf8');
            const cleaned = alerts.length - filteredAlerts.length;
            totalCleaned += cleaned;
            console.log(`✅ Cleaned ${cleaned} old alerts from ${alertType}`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not clean ${alertType}: ${error.message}`);
      }
    }
  }
  
  return totalCleaned;
}

/**
 * Main function to manage alerts
 */
async function manageAlerts() {
  console.log('📊 Alert Management System');
  console.log('=========================');
  
  try {
    // Load all alerts
    const alerts = loadAllAlerts();
    console.log(`✅ Loaded ${alerts.length} total alerts`);
    
    // Generate statistics
    const stats = generateAlertStatistics(alerts);
    console.log(`✅ Generated alert statistics`);
    
    // Generate summary report
    const summary = generateAlertSummary(alerts, stats);
    
    // Save summary report
    const summaryPath = 'public/data/alert_management_summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    
    // Clean up old alerts
    const cleanedCount = cleanupOldAlerts();
    if (cleanedCount > 0) {
      console.log(`✅ Cleaned ${cleanedCount} old alerts`);
    }
    
    // Display summary
    console.log('\n📋 Alert Management Summary');
    console.log('============================');
    console.log(`Total Alerts: ${stats.total}`);
    console.log(`Recent (24h): ${stats.recent}`);
    console.log(`Critical: ${stats.critical}`);
    console.log(`High: ${stats.high}`);
    console.log(`Medium: ${stats.medium}`);
    console.log(`Low: ${stats.low}`);
    
    console.log('\n📊 Alert Types:');
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`   ${type}: ${count}`);
    }
    
    console.log('\n🚨 System Health:');
    console.log(`   Status: ${summary.systemHealth.toUpperCase()}`);
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      summary.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.message}`);
        console.log(`      Priority: ${rec.priority.toUpperCase()}`);
        console.log(`      Actions: ${rec.actions.join(', ')}`);
      });
    }
    
    console.log(`\n📄 Summary saved to: ${summaryPath}`);
    
    return {
      success: true,
      totalAlerts: stats.total,
      recentAlerts: stats.recent,
      systemHealth: summary.systemHealth,
      recommendations: summary.recommendations.length,
      cleanedAlerts: cleanedCount
    };
    
  } catch (error) {
    console.error('❌ Alert management failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { manageAlerts };

// Run the alert management if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  manageAlerts().catch(error => {
    console.error('❌ Alert management failed:', error);
    process.exit(1);
  });
}
