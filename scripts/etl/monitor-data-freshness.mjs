#!/usr/bin/env node
/**
 * Data Freshness Monitoring Script
 * 
 * This script monitors data source freshness and tracks update patterns
 * to identify when data sources become stale or delayed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { manageAlertsWithDeduplication } from './alert-deduplication.mjs';
import { determineSeverity, getSeverityConfig } from './alert-severity-system.mjs';

// Data source configurations
const DATA_SOURCES = {
  blockchain_info: {
    name: 'Blockchain.info',
    baseUrl: 'https://api.blockchain.info',
    endpoints: [
      { name: 'mempool-size', path: '/charts/mempool-size?timespan=7days&format=json' },
      { name: 'transaction-fees', path: '/charts/transaction-fees?timespan=7days&format=json' },
      { name: 'fees-usd', path: '/charts/fees-usd?timespan=7days&format=json' }
    ],
    expectedUpdateFrequency: 'daily', // Expected update frequency
    maxStalenessHours: 48 // Maximum acceptable staleness
  },
  coingecko: {
    name: 'CoinGecko',
    baseUrl: 'https://api.coingecko.com',
    endpoints: [
      { name: 'bitcoin-price', path: '/api/v3/simple/price?ids=bitcoin&vs_currencies=usd' },
      { name: 'trending', path: '/api/v3/search/trending' }
    ],
    expectedUpdateFrequency: 'continuous',
    maxStalenessHours: 6
  },
  fred: {
    name: 'FRED (Federal Reserve)',
    baseUrl: 'https://api.stlouisfed.org',
    endpoints: [
      { name: 'net-liquidity', path: '/fred/series/WALCL/observations?api_key=DEMO_KEY&file_type=json' }
    ],
    expectedUpdateFrequency: 'weekly',
    maxStalenessHours: 168 // 7 days
  }
};

/**
 * Check data source freshness
 */
async function checkDataSourceFreshness(sourceName, sourceConfig) {
  const results = {
    source: sourceName,
    name: sourceConfig.name,
    status: 'unknown',
    lastUpdate: null,
    stalenessHours: null,
    endpoints: [],
    alerts: []
  };

  console.log(`🔍 Checking ${sourceConfig.name}...`);

  for (const endpoint of sourceConfig.endpoints) {
    const fullUrl = sourceConfig.baseUrl + endpoint.path;
    const endpointResult = {
      name: endpoint.name,
      url: fullUrl,
      status: 'unknown',
      lastUpdate: null,
      stalenessHours: null,
      error: null
    };

    try {
      const response = await fetch(fullUrl, {
        headers: { 'User-Agent': 'btc-risk-dashboard-freshness-monitor' },
        cache: 'no-store'
      });

      if (!response.ok) {
        endpointResult.status = 'error';
        endpointResult.error = `HTTP ${response.status}`;
        results.alerts.push(`❌ ${endpoint.name}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      endpointResult.status = 'success';

      // Extract timestamp from different data formats
      let lastUpdate = null;
      if (data.values && Array.isArray(data.values) && data.values.length > 0) {
        // Blockchain.info format
        const lastValue = data.values[data.values.length - 1];
        if (lastValue && lastValue.x) {
          lastUpdate = new Date(lastValue.x * 1000);
        }
      } else if (data.observations && Array.isArray(data.observations)) {
        // FRED format
        const lastObs = data.observations[data.observations.length - 1];
        if (lastObs && lastObs.date) {
          lastUpdate = new Date(lastObs.date);
        }
      } else if (data.bitcoin && data.bitcoin.last_updated) {
        // CoinGecko format
        lastUpdate = new Date(data.bitcoin.last_updated * 1000);
      }

      if (lastUpdate) {
        endpointResult.lastUpdate = lastUpdate.toISOString();
        const stalenessHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        endpointResult.stalenessHours = stalenessHours;

        // Check if data is stale
        if (stalenessHours > sourceConfig.maxStalenessHours) {
          results.alerts.push(`⚠️ ${endpoint.name}: Data is ${stalenessHours.toFixed(1)}h old (max: ${sourceConfig.maxStalenessHours}h)`);
        } else if (stalenessHours > sourceConfig.maxStalenessHours / 2) {
          results.alerts.push(`ℹ️ ${endpoint.name}: Data is ${stalenessHours.toFixed(1)}h old (approaching limit)`);
        } else {
          results.alerts.push(`✅ ${endpoint.name}: Fresh (${stalenessHours.toFixed(1)}h old)`);
        }
      } else {
        results.alerts.push(`❓ ${endpoint.name}: Could not determine last update time`);
      }

    } catch (error) {
      endpointResult.status = 'error';
      endpointResult.error = error.message;
      results.alerts.push(`❌ ${endpoint.name}: ${error.message}`);
    }

    results.endpoints.push(endpointResult);
  }

  // Determine overall source status
  const hasErrors = results.endpoints.some(ep => ep.status === 'error');
  const hasStaleData = results.endpoints.some(ep => ep.stalenessHours && ep.stalenessHours > sourceConfig.maxStalenessHours);
  
  if (hasErrors) {
    results.status = 'error';
  } else if (hasStaleData) {
    results.status = 'stale';
  } else {
    results.status = 'fresh';
  }

  return results;
}

/**
 * Generate freshness report
 */
async function generateFreshnessReport() {
  console.log('📊 Data Freshness Monitoring Report');
  console.log('=====================================');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');

  const report = {
    timestamp: new Date().toISOString(),
    sources: [],
    summary: {
      totalSources: 0,
      freshSources: 0,
      staleSources: 0,
      errorSources: 0,
      totalAlerts: 0
    }
  };

  // Check each data source
  for (const [sourceName, sourceConfig] of Object.entries(DATA_SOURCES)) {
    const result = await checkDataSourceFreshness(sourceName, sourceConfig);
    report.sources.push(result);
    report.summary.totalSources++;

    switch (result.status) {
      case 'fresh':
        report.summary.freshSources++;
        break;
      case 'stale':
        report.summary.staleSources++;
        break;
      case 'error':
        report.summary.errorSources++;
        break;
    }

    report.summary.totalAlerts += result.alerts.length;
  }

  // Print summary
  console.log('📈 Summary:');
  console.log(`  Total Sources: ${report.summary.totalSources}`);
  console.log(`  Fresh: ${report.summary.freshSources}`);
  console.log(`  Stale: ${report.summary.staleSources}`);
  console.log(`  Errors: ${report.summary.errorSources}`);
  console.log(`  Total Alerts: ${report.summary.totalAlerts}`);
  console.log('');

  // Save report
  const reportPath = path.join(process.cwd(), 'public', 'data', 'data_freshness_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`💾 Report saved to: ${reportPath}`);

  // Generate alerts for critical issues
  const criticalAlerts = [];
  
  for (const source of report.sources) {
    if (source.status === 'error') {
      criticalAlerts.push({
        id: `freshness_alert_${source.source}_${Date.now()}`,
        type: 'data_freshness',
        severity: determineSeverity('data_freshness', stalenessHours) || 'high',
        timestamp: new Date().toISOString(),
        source: source.name,
        sourceKey: source.source,
        title: `🚨 HIGH: ${source.name} Data Source Error`,
        message: `${source.name} data source is experiencing errors. Check endpoint availability.`,
        data: {
          source: source.name,
          sourceKey: source.source,
          status: source.status,
          alerts: source.alerts
        },
        actions: [
          'Check data source status',
          'Verify API endpoints',
          'Review network connectivity',
          'Check for rate limiting',
          'Monitor for resolution'
        ]
      });
    } else if (source.status === 'stale') {
      criticalAlerts.push({
        id: `freshness_alert_${source.source}_${Date.now()}`,
        type: 'data_freshness',
        severity: determineSeverity('data_freshness', stalenessHours) || 'medium',
        timestamp: new Date().toISOString(),
        source: source.name,
        sourceKey: source.source,
        title: `⚠️ MEDIUM: ${source.name} Data Source Stale`,
        message: `${source.name} data source is stale. Data may be outdated.`,
        data: {
          source: source.name,
          sourceKey: source.source,
          status: source.status,
          alerts: source.alerts
        },
        actions: [
          'Monitor data source updates',
          'Check for scheduled maintenance',
          'Review update frequency',
          'Consider fallback sources',
          'Verify data accuracy'
        ]
      });
    }
  }

  // Save freshness alerts with deduplication
  const alertsPath = path.join(process.cwd(), 'public', 'data', 'data_freshness_alerts.json');
  
  // Load existing alerts
  let existingAlerts = [];
  try {
    if (fs.existsSync(alertsPath)) {
      const content = fs.readFileSync(alertsPath, 'utf8');
      existingAlerts = JSON.parse(content);
    }
  } catch (error) {
    console.log(`⚠️  Error loading existing freshness alerts: ${error.message}`);
  }

  if (criticalAlerts.length > 0) {
    // Use deduplication system
    const result = manageAlertsWithDeduplication(existingAlerts, criticalAlerts, {
      retentionDays: 7, // Shorter retention for freshness alerts
      maxAlerts: 100
    });
    
    // Save deduplicated alerts
    fs.writeFileSync(alertsPath, JSON.stringify(result.alerts, null, 2));
    
    console.log(`🚨 Data Freshness Alert Management:`);
    console.log(`   📊 Original: ${result.stats.original} existing + ${result.stats.new} new`);
    console.log(`   🔄 Duplicates removed: ${result.stats.duplicatesRemoved}`);
    console.log(`   🗑️  Old alerts removed: ${result.stats.oldRemoved}`);
    console.log(`   📁 Final count: ${result.stats.final} alerts`);
  } else {
    console.log('✅ No critical data freshness issues detected');
    
    // Still clean up old alerts even if no new ones
    if (existingAlerts.length > 0) {
      const result = manageAlertsWithDeduplication(existingAlerts, [], {
        retentionDays: 7,
        maxAlerts: 100
      });
      
      if (result.stats.oldRemoved > 0) {
        fs.writeFileSync(alertsPath, JSON.stringify(result.alerts, null, 2));
        console.log(`🗑️  Cleaned up ${result.stats.oldRemoved} old freshness alerts`);
      }
    }
  }

  console.log('✅ Data freshness monitoring complete');
  return report;
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFreshnessReport().catch(console.error);
}

export { generateFreshnessReport };
