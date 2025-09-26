#!/usr/bin/env node
/**
 * ETF Parsing Monitor
 * 
 * Comprehensive monitoring and error handling system for ETF parsing
 * with health checks, alerting, and fallback mechanisms.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * ETF Parsing Health Monitor
 */
class ETFParsingMonitor {
  constructor() {
    this.healthStatus = {
      lastCheck: null,
      status: 'unknown',
      errors: [],
      warnings: [],
      metrics: {},
      alerts: []
    };
    
    this.alertThresholds = {
      minFlows: 5,
      maxErrors: 3,
      maxWarnings: 5,
      maxRetries: 3
    };
  }

  /**
   * Check ETF parsing health
   */
  async checkHealth() {
    console.log('🏥 Checking ETF Parsing Health');
    console.log('===============================');
    
    this.healthStatus.lastCheck = new Date().toISOString();
    this.healthStatus.errors = [];
    this.healthStatus.warnings = [];
    this.healthStatus.alerts = [];
    
    try {
      // Check 1: Cache availability
      await this.checkCacheHealth();
      
      // Check 2: API availability
      await this.checkAPIHealth();
      
      // Check 3: Parsing functionality
      await this.checkParsingHealth();
      
      // Check 4: Data quality
      await this.checkDataQuality();
      
      // Determine overall status
      this.determineOverallStatus();
      
      // Generate alerts
      this.generateAlerts();
      
      console.log(`✅ Health check completed: ${this.healthStatus.status}`);
      return this.healthStatus;
      
    } catch (error) {
      this.healthStatus.status = 'critical';
      this.healthStatus.errors.push(`Health check failed: ${error.message}`);
      console.error('❌ Health check failed:', error.message);
      return this.healthStatus;
    }
  }

  /**
   * Check cache health
   */
  async checkCacheHealth() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheDir = 'public/data/cache/etf';
      const cacheFile = `${cacheDir}/${today}.html`;
      
      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 24) {
          this.healthStatus.warnings.push(`Cache is ${ageHours.toFixed(1)} hours old`);
        }
        
        this.healthStatus.metrics.cacheAge = ageHours;
        this.healthStatus.metrics.cacheSize = stats.size;
      } else {
        this.healthStatus.warnings.push('No cache file found');
      }
      
    } catch (error) {
      this.healthStatus.errors.push(`Cache check failed: ${error.message}`);
    }
  }

  /**
   * Check API health
   */
  async checkAPIHealth() {
    const urls = [
      "https://farside.co.uk/bitcoin-etf-flow-all-data/",
      "https://farside.co.uk/bitcoin-etf-flow/",
      "https://farside.co.uk/etf-flows/",
      "https://farside.co.uk/etf-flows/btc"
    ];
    
    let workingUrls = 0;
    const apiResults = {};
    
    for (const url of urls) {
      try {
        const response = await fetch(url, { 
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
          },
          timeout: 5000
        });
        
        if (response.ok) {
          workingUrls++;
          apiResults[url] = { status: 'ok', responseTime: Date.now() };
        } else {
          apiResults[url] = { status: 'error', code: response.status };
        }
      } catch (error) {
        apiResults[url] = { status: 'error', message: error.message };
      }
    }
    
    this.healthStatus.metrics.workingUrls = workingUrls;
    this.healthStatus.metrics.totalUrls = urls.length;
    this.healthStatus.metrics.apiResults = apiResults;
    
    if (workingUrls === 0) {
      this.healthStatus.errors.push('No API endpoints are responding');
    } else if (workingUrls < urls.length) {
      this.healthStatus.warnings.push(`${urls.length - workingUrls} API endpoints are down`);
    }
  }

  /**
   * Check parsing health
   */
  async checkParsingHealth() {
    try {
      // Test with sample HTML
      const sampleHTML = `
        <table>
          <tr><th>Date</th><th>Total Flow</th><th>IBIT</th><th>FBTC</th></tr>
          <tr><td>2024-01-11</td><td>100.5M</td><td>50.2M</td><td>30.1M</td></tr>
          <tr><td>2024-01-12</td><td>85.3M</td><td>45.1M</td><td>25.2M</td></tr>
        </table>
      `;
      
      // Import and test robust parser
      const { parseETFFlowsRobust } = await import('./robust-etf-parser.mjs');
      const result = await parseETFFlowsRobust(sampleHTML);
      
      if (result.success) {
        this.healthStatus.metrics.parsingTest = 'passed';
        this.healthStatus.metrics.testFlows = result.flows.length;
      } else {
        this.healthStatus.errors.push('Parsing test failed');
        this.healthStatus.metrics.parsingTest = 'failed';
      }
      
    } catch (error) {
      this.healthStatus.errors.push(`Parsing test failed: ${error.message}`);
      this.healthStatus.metrics.parsingTest = 'error';
    }
  }

  /**
   * Check data quality
   */
  async checkDataQuality() {
    try {
      // Check if ETF CSV exists and has recent data
      const csvPath = 'public/signals/etf_by_fund.csv';
      
      if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length > 1) {
          const lastLine = lines[lines.length - 1];
          const lastDate = lastLine.split(',')[0];
          
          const lastDateObj = new Date(lastDate);
          const daysSinceLastUpdate = (Date.now() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
          
          this.healthStatus.metrics.lastUpdate = lastDate;
          this.healthStatus.metrics.daysSinceUpdate = daysSinceLastUpdate;
          this.healthStatus.metrics.totalRecords = lines.length - 1;
          
          if (daysSinceLastUpdate > 7) {
            this.healthStatus.warnings.push(`Data is ${daysSinceLastUpdate.toFixed(1)} days old`);
          }
        } else {
          this.healthStatus.warnings.push('ETF CSV is empty');
        }
      } else {
        this.healthStatus.warnings.push('ETF CSV file not found');
      }
      
    } catch (error) {
      this.healthStatus.errors.push(`Data quality check failed: ${error.message}`);
    }
  }

  /**
   * Determine overall status
   */
  determineOverallStatus() {
    if (this.healthStatus.errors.length >= this.alertThresholds.maxErrors) {
      this.healthStatus.status = 'critical';
    } else if (this.healthStatus.errors.length > 0 || this.healthStatus.warnings.length >= this.alertThresholds.maxWarnings) {
      this.healthStatus.status = 'warning';
    } else {
      this.healthStatus.status = 'healthy';
    }
  }

  /**
   * Generate alerts
   */
  generateAlerts() {
    if (this.healthStatus.status === 'critical') {
      this.healthStatus.alerts.push({
        level: 'critical',
        message: 'ETF parsing is in critical state',
        timestamp: new Date().toISOString()
      });
    }
    
    if (this.healthStatus.warnings.length > 0) {
      this.healthStatus.alerts.push({
        level: 'warning',
        message: `${this.healthStatus.warnings.length} warnings detected`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (this.healthStatus.metrics.workingUrls === 0) {
      this.healthStatus.alerts.push({
        level: 'critical',
        message: 'All API endpoints are down',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Save health report
   */
  async saveHealthReport() {
    try {
      const reportPath = 'public/signals/etf_parsing_health.json';
      const report = {
        ...this.healthStatus,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`📊 Health report saved to: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Failed to save health report:', error.message);
    }
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    return {
      status: this.healthStatus.status,
      errors: this.healthStatus.errors.length,
      warnings: this.healthStatus.warnings.length,
      alerts: this.healthStatus.alerts.length,
      lastCheck: this.healthStatus.lastCheck
    };
  }
}

/**
 * ETF Parsing Error Handler
 */
class ETFParsingErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Handle parsing error
   */
  handleError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context,
      severity: this.determineSeverity(error)
    };
    
    this.errorHistory.push(errorRecord);
    
    // Keep only recent errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
    
    console.error(`❌ ETF Parsing Error: ${error.message}`);
    console.error(`   Context: ${JSON.stringify(context)}`);
    
    return errorRecord;
  }

  /**
   * Determine error severity
   */
  determineSeverity(error) {
    if (error.message.includes('timeout') || error.message.includes('network')) {
      return 'high';
    } else if (error.message.includes('parsing') || error.message.includes('format')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(
      error => new Date(error.timestamp) > last24h
    );
    
    const severityCounts = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: recentErrors.length,
      severity: severityCounts,
      lastError: this.errorHistory[this.errorHistory.length - 1]
    };
  }
}

/**
 * Main monitoring function
 */
async function monitorETFParsing() {
  console.log('🔍 Starting ETF Parsing Monitor');
  console.log('================================');
  
  const monitor = new ETFParsingMonitor();
  const errorHandler = new ETFParsingErrorHandler();
  
  try {
    // Run health check
    const healthStatus = await monitor.checkHealth();
    
    // Save health report
    await monitor.saveHealthReport();
    
    // Get summary
    const summary = monitor.getHealthSummary();
    const errorSummary = errorHandler.getErrorSummary();
    
    console.log('\n📊 Health Summary:');
    console.log(`   Status: ${summary.status}`);
    console.log(`   Errors: ${summary.errors}`);
    console.log(`   Warnings: ${summary.warnings}`);
    console.log(`   Alerts: ${summary.alerts}`);
    
    if (errorSummary.total > 0) {
      console.log('\n⚠️  Error Summary:');
      console.log(`   Total (24h): ${errorSummary.total}`);
      console.log(`   High: ${errorSummary.severity.high || 0}`);
      console.log(`   Medium: ${errorSummary.severity.medium || 0}`);
      console.log(`   Low: ${errorSummary.severity.low || 0}`);
    }
    
    return {
      success: true,
      health: healthStatus,
      summary,
      errorSummary
    };
    
  } catch (error) {
    errorHandler.handleError(error, { context: 'monitoring' });
    return {
      success: false,
      error: error.message
    };
  }
}

// Run monitoring if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  monitorETFParsing().catch(error => {
    console.error('❌ Monitoring failed:', error);
    process.exit(1);
  });
}

export { ETFParsingMonitor, ETFParsingErrorHandler, monitorETFParsing };
