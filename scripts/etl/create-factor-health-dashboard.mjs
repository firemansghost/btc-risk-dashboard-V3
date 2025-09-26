#!/usr/bin/env node
/**
 * Create Factor Health Dashboard
 * 
 * This script creates a comprehensive factor health dashboard
 * that monitors system status, data freshness, and API health.
 */

import fs from 'node:fs';

/**
 * Generate factor health dashboard data
 */
async function generateFactorHealthDashboard() {
  console.log('📊 Creating Factor Health Dashboard');
  console.log('==================================');
  
  try {
    // Load latest data
    const latestPath = 'public/data/latest.json';
    if (!fs.existsSync(latestPath)) {
      console.log('❌ Latest data not found');
      return { success: false, error: 'Latest data not found' };
    }
    
    const latestData = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    console.log('✅ Loaded latest data');
    
    // Load status data
    const statusPath = 'public/data/status.json';
    if (!fs.existsSync(statusPath)) {
      console.log('❌ Status data not found');
      return { success: false, error: 'Status data not found' };
    }
    
    const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    console.log('✅ Loaded status data');
    
    // Generate health metrics
    const healthMetrics = {
      timestamp: new Date().toISOString(),
      overall_health: 'healthy',
      factors: [],
      apis: [],
      system: {},
      alerts: []
    };
    
    // Analyze factors
    console.log('📊 Analyzing factors...');
    const factors = latestData.factors || [];
    
    factors.forEach(factor => {
      const factorHealth = {
        name: factor.label,
        key: factor.key,
        status: factor.status,
        score: factor.score,
        last_updated: factor.last_utc,
        staleness: calculateStaleness(factor.last_utc),
        health_score: calculateFactorHealthScore(factor)
      };
      
      healthMetrics.factors.push(factorHealth);
    });
    
    // Analyze APIs
    console.log('📊 Analyzing APIs...');
    const provenance = latestData.provenance || [];
    
    provenance.forEach(api => {
      const apiHealth = {
        name: api.name || 'Unknown',
        url: api.url || 'Unknown',
        status: api.status || 'Unknown',
        response_time: api.ms || 0,
        health_score: calculateAPIHealthScore(api)
      };
      
      healthMetrics.apis.push(apiHealth);
    });
    
    // Analyze system metrics
    console.log('📊 Analyzing system metrics...');
    healthMetrics.system = {
      composite_score: latestData.composite_score,
      model_version: latestData.model_version,
      as_of_utc: latestData.as_of_utc,
      total_factors: factors.length,
      fresh_factors: factors.filter(f => f.status === 'fresh').length,
      stale_factors: factors.filter(f => f.status === 'stale').length,
      excluded_factors: factors.filter(f => f.status === 'excluded').length,
      overall_health_score: calculateOverallHealthScore(factors)
    };
    
    // Generate alerts
    console.log('📊 Generating alerts...');
    healthMetrics.alerts = generateAlerts(factors, provenance);
    
    // Determine overall health
    const healthScore = healthMetrics.system.overall_health_score;
    if (healthScore >= 90) {
      healthMetrics.overall_health = 'excellent';
    } else if (healthScore >= 75) {
      healthMetrics.overall_health = 'healthy';
    } else if (healthScore >= 60) {
      healthMetrics.overall_health = 'warning';
    } else {
      healthMetrics.overall_health = 'critical';
    }
    
    // Save dashboard data
    const dashboardPath = 'public/data/factor-health-dashboard.json';
    fs.writeFileSync(dashboardPath, JSON.stringify(healthMetrics, null, 2), 'utf8');
    
    console.log(`✅ Dashboard saved to: ${dashboardPath}`);
    
    // Display summary
    console.log('\n📋 Factor Health Dashboard Summary');
    console.log('===================================');
    console.log(`Overall Health: ${healthMetrics.overall_health.toUpperCase()} (${healthScore}/100)`);
    console.log(`Factors: ${healthMetrics.system.fresh_factors} fresh, ${healthMetrics.system.stale_factors} stale, ${healthMetrics.system.excluded_factors} excluded`);
    console.log(`APIs: ${healthMetrics.apis.length} monitored`);
    console.log(`Alerts: ${healthMetrics.alerts.length} active`);
    
    if (healthMetrics.alerts.length > 0) {
      console.log('\n🚨 Active Alerts:');
      healthMetrics.alerts.forEach(alert => {
        console.log(`   ${alert.severity.toUpperCase()}: ${alert.message}`);
      });
    }
    
    return {
      success: true,
      healthScore: healthScore,
      overallHealth: healthMetrics.overall_health,
      factorsCount: factors.length,
      alertsCount: healthMetrics.alerts.length
    };
    
  } catch (error) {
    console.error('❌ Dashboard creation failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate factor staleness in hours
 */
function calculateStaleness(lastUtc) {
  if (!lastUtc) return null;
  
  const lastUpdate = new Date(lastUtc);
  const now = new Date();
  const diffMs = now - lastUpdate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  
  return diffHours;
}

/**
 * Calculate factor health score
 */
function calculateFactorHealthScore(factor) {
  let score = 100;
  
  // Deduct points for staleness
  if (factor.status === 'stale') {
    score -= 20;
  } else if (factor.status === 'excluded') {
    score -= 50;
  }
  
  // Deduct points for old data
  const staleness = calculateStaleness(factor.last_utc);
  if (staleness > 24) {
    score -= Math.min(30, staleness - 24);
  }
  
  // Deduct points for null scores
  if (factor.score === null || factor.score === undefined) {
    score -= 40;
  }
  
  return Math.max(0, score);
}

/**
 * Calculate API health score
 */
function calculateAPIHealthScore(api) {
  let score = 100;
  
  // Deduct points for slow responses
  if (api.ms > 5000) {
    score -= 20;
  } else if (api.ms > 10000) {
    score -= 40;
  }
  
  // Deduct points for errors
  if (api.status !== 'ok' && api.status !== 'success') {
    score -= 50;
  }
  
  return Math.max(0, score);
}

/**
 * Calculate overall health score
 */
function calculateOverallHealthScore(factors) {
  if (factors.length === 0) return 0;
  
  const totalScore = factors.reduce((sum, factor) => {
    return sum + calculateFactorHealthScore(factor);
  }, 0);
  
  return Math.round(totalScore / factors.length);
}

/**
 * Generate alerts based on system state
 */
function generateAlerts(factors, provenance) {
  const alerts = [];
  
  // Check for excluded factors
  const excludedFactors = factors.filter(f => f.status === 'excluded');
  if (excludedFactors.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${excludedFactors.length} factor(s) excluded: ${excludedFactors.map(f => f.label).join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Check for stale factors
  const staleFactors = factors.filter(f => f.status === 'stale');
  if (staleFactors.length > 0) {
    alerts.push({
      severity: 'info',
      message: `${staleFactors.length} factor(s) stale: ${staleFactors.map(f => f.label).join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Check for slow APIs
  const slowAPIs = provenance.filter(api => api.ms > 10000);
  if (slowAPIs.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${slowAPIs.length} API(s) slow: ${slowAPIs.map(api => api.name).join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Check for failed APIs
  const failedAPIs = provenance.filter(api => api.status !== 'ok' && api.status !== 'success');
  if (failedAPIs.length > 0) {
    alerts.push({
      severity: 'error',
      message: `${failedAPIs.length} API(s) failed: ${failedAPIs.map(api => api.name).join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  return alerts;
}

// Run the dashboard creation
generateFactorHealthDashboard().catch(error => {
  console.error('❌ Dashboard creation failed:', error);
  process.exit(1);
});
