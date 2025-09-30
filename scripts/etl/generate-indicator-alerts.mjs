#!/usr/bin/env node
/**
 * Generate Indicator Alerts
 * 
 * This script generates alerts for:
 * - Cycle adjustments (significant cycle changes)
 * - Spike adjustments (significant spike changes) 
 * - 50W SMA warnings (2+ consecutive weeks below 50W SMA)
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Load latest data
 */
function loadLatestData() {
  const latestPath = 'public/data/latest.json';
  
  if (!fs.existsSync(latestPath)) {
    console.log('❌ Latest data not found');
    return null;
  }
  
  const content = fs.readFileSync(latestPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Load existing alerts
 */
function loadExistingAlerts(alertType) {
  const alertPath = `public/data/${alertType}_alerts.json`;
  
  if (!fs.existsSync(alertPath)) {
    return [];
  }
  
  const content = fs.readFileSync(alertPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Save alerts
 */
function saveAlerts(alertType, alerts) {
  const alertPath = `public/data/${alertType}_alerts.json`;
  fs.writeFileSync(alertPath, JSON.stringify(alerts, null, 2), 'utf8');
  console.log(`✅ Saved ${alerts.length} ${alertType} alerts to ${alertPath}`);
}

/**
 * Generate cycle adjustment alerts
 */
function generateCycleAlerts(latestData) {
  const alerts = loadExistingAlerts('cycle_adjustment');
  const today = new Date().toISOString().split('T')[0];
  
  const cycleAdj = latestData.cycle_adjustment;
  if (!cycleAdj) return alerts;
  
  // Check for significant cycle adjustment (threshold: ±5 points)
  const threshold = 5;
  const absAdjustment = Math.abs(cycleAdj.adj_pts || 0);
  
  if (absAdjustment >= threshold) {
    const direction = (cycleAdj.adj_pts || 0) > 0 ? 'positive' : 'negative';
    const magnitude = Math.abs(cycleAdj.adj_pts || 0);
    
    const alert = {
      id: `cycle_${today}_${Date.now()}`,
      type: 'cycle_adjustment',
      timestamp: new Date().toISOString(),
      severity: absAdjustment >= 10 ? 'high' : 'medium',
      title: `Significant Cycle Adjustment Detected`,
      message: `Cycle adjustment: ${direction} ${magnitude.toFixed(1)} points`,
      details: {
        adjustment_points: cycleAdj.adj_pts,
        residual_z: cycleAdj.residual_z,
        source: cycleAdj.source,
        reason: cycleAdj.reason
      },
      action_required: absAdjustment >= 10 ? 'Review cycle analysis' : 'Monitor trend'
    };
    
    // Check if similar alert already exists today
    const existingToday = alerts.find(a => 
      a.type === 'cycle_adjustment' && 
      a.timestamp.startsWith(today) &&
      Math.abs(a.details.adjustment_points - cycleAdj.adj_pts) < 1
    );
    
    if (!existingToday) {
      alerts.unshift(alert);
      console.log(`🔔 Generated cycle adjustment alert: ${direction} ${magnitude.toFixed(1)} points`);
    }
  }
  
  // Keep only last 30 days of alerts
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return alerts.filter(alert => alert.timestamp > thirtyDaysAgo);
}

/**
 * Generate spike adjustment alerts
 */
function generateSpikeAlerts(latestData) {
  const alerts = loadExistingAlerts('spike_adjustment');
  const today = new Date().toISOString().split('T')[0];
  
  const spikeAdj = latestData.spike_adjustment;
  if (!spikeAdj) return alerts;
  
  // Check for significant spike adjustment (threshold: ±3 points)
  const threshold = 3;
  const absAdjustment = Math.abs(spikeAdj.adj_pts || 0);
  
  if (absAdjustment >= threshold) {
    const direction = (spikeAdj.adj_pts || 0) > 0 ? 'positive' : 'negative';
    const magnitude = Math.abs(spikeAdj.adj_pts || 0);
    
    const alert = {
      id: `spike_${today}_${Date.now()}`,
      type: 'spike_adjustment',
      timestamp: new Date().toISOString(),
      severity: absAdjustment >= 6 ? 'high' : 'medium',
      title: `Significant Spike Adjustment Detected`,
      message: `Spike adjustment: ${direction} ${magnitude.toFixed(1)} points`,
      details: {
        adjustment_points: spikeAdj.adj_pts,
        r_1d: spikeAdj.r_1d,
        sigma: spikeAdj.sigma,
        z_score: spikeAdj.z,
        ref_close: spikeAdj.ref_close
      },
      action_required: absAdjustment >= 6 ? 'Review volatility analysis' : 'Monitor price action'
    };
    
    // Check if similar alert already exists today
    const existingToday = alerts.find(a => 
      a.type === 'spike_adjustment' && 
      a.timestamp.startsWith(today) &&
      Math.abs(a.details.adjustment_points - spikeAdj.adj_pts) < 1
    );
    
    if (!existingToday) {
      alerts.unshift(alert);
      console.log(`🔔 Generated spike adjustment alert: ${direction} ${magnitude.toFixed(1)} points`);
    }
  }
  
  // Keep only last 30 days of alerts
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return alerts.filter(alert => alert.timestamp > thirtyDaysAgo);
}

/**
 * Generate 50W SMA alerts
 */
function generate50WSMAAlerts(latestData) {
  const alerts = loadExistingAlerts('sma50w_warning');
  const today = new Date().toISOString().split('T')[0];
  
  // Find trend_valuation factor
  const trendFactor = latestData.factors?.find(f => f.key === 'trend_valuation');
  if (!trendFactor?.sma50wDiagnostic) return alerts;
  
  const sma50w = trendFactor.sma50wDiagnostic;
  
  // Check for 50W SMA warning (2+ consecutive weeks below)
  if (sma50w.showWarning && sma50w.consecutiveWeeksBelow >= 2) {
    const alert = {
      id: `sma50w_${today}_${Date.now()}`,
      type: 'sma50w_warning',
      timestamp: new Date().toISOString(),
      severity: sma50w.consecutiveWeeksBelow >= 4 ? 'high' : 'medium',
      title: `50-Week SMA Warning`,
      message: `Bitcoin has closed below 50W SMA for ${sma50w.consecutiveWeeksBelow} consecutive weeks`,
      details: {
        sma50: sma50w.sma50,
        current_close: sma50w.currentClose,
        consecutive_weeks_below: sma50w.consecutiveWeeksBelow,
        is_below: sma50w.isBelow,
        price_vs_sma: ((sma50w.currentClose - sma50w.sma50) / sma50w.sma50 * 100).toFixed(2)
      },
      action_required: sma50w.consecutiveWeeksBelow >= 4 ? 
        'Consider reducing risk exposure' : 
        'Monitor for potential trend change'
    };
    
    // Check if similar alert already exists today
    const existingToday = alerts.find(a => 
      a.type === 'sma50w_warning' && 
      a.timestamp.startsWith(today) &&
      a.details.consecutive_weeks_below === sma50w.consecutiveWeeksBelow
    );
    
    if (!existingToday) {
      alerts.unshift(alert);
      console.log(`🔔 Generated 50W SMA warning: ${sma50w.consecutiveWeeksBelow} weeks below`);
    }
  }
  
  // Keep only last 30 days of alerts
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return alerts.filter(alert => alert.timestamp > thirtyDaysAgo);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔔 Generating indicator alerts...');
  
  const latestData = loadLatestData();
  if (!latestData) {
    console.log('❌ Cannot generate alerts without latest data');
    return;
  }
  
  // Generate alerts for each indicator
  const cycleAlerts = generateCycleAlerts(latestData);
  const spikeAlerts = generateSpikeAlerts(latestData);
  const sma50wAlerts = generate50WSMAAlerts(latestData);
  
  // Save all alerts
  saveAlerts('cycle_adjustment', cycleAlerts);
  saveAlerts('spike_adjustment', spikeAlerts);
  saveAlerts('sma50w_warning', sma50wAlerts);
  
  // Generate combined latest alerts
  const allAlerts = [...cycleAlerts, ...spikeAlerts, ...sma50wAlerts]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10); // Keep only latest 10 alerts
  
  const latestAlerts = {
    occurred_at: new Date().toISOString(),
    alerts: allAlerts
  };
  
  fs.writeFileSync('public/data/alerts/latest.json', JSON.stringify(latestAlerts, null, 2), 'utf8');
  console.log(`✅ Generated ${allAlerts.length} total alerts`);
  
  // Log summary
  console.log(`📊 Alert Summary:`);
  console.log(`   Cycle adjustments: ${cycleAlerts.length}`);
  console.log(`   Spike adjustments: ${spikeAlerts.length}`);
  console.log(`   50W SMA warnings: ${sma50wAlerts.length}`);
}

main().catch(console.error);
