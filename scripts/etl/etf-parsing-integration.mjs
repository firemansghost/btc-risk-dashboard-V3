#!/usr/bin/env node
/**
 * ETF Parsing Integration
 * 
 * Integrates all ETF parsing improvements into a single system
 * with comprehensive error handling, monitoring, and fallback mechanisms.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * ETF Parsing Integration System
 */
class ETFParsingIntegration {
  constructor() {
    this.config = {
      maxRetries: 3,
      timeout: 10000,
      minFlows: 5,
      cacheDir: 'public/data/cache/etf',
      outputDir: 'public/signals'
    };
    
    this.status = {
      initialized: false,
      lastRun: null,
      success: false,
      errors: [],
      warnings: [],
      metrics: {}
    };
  }

  /**
   * Initialize the integration system
   */
  async initialize() {
    console.log('🚀 Initializing ETF Parsing Integration');
    console.log('=========================================');
    
    try {
      // Create necessary directories
      await this.createDirectories();
      
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize monitoring
      await this.initializeMonitoring();
      
      this.status.initialized = true;
      console.log('✅ Integration system initialized');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      this.status.errors.push(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    const directories = [
      this.config.cacheDir,
      this.config.outputDir,
      'public/signals/backup'
    ];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  /**
   * Load configuration
   */
  async loadConfiguration() {
    try {
      const configPath = 'config/dashboard-config.json';
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = { ...this.config, ...config.etfParsing };
        console.log('📋 Configuration loaded');
      }
    } catch (error) {
      console.warn('⚠️  Could not load configuration:', error.message);
    }
  }

  /**
   * Initialize monitoring
   */
  async initializeMonitoring() {
    try {
      const { ETFParsingMonitor } = await import('./etf-parsing-monitor.mjs');
      this.monitor = new ETFParsingMonitor();
      console.log('📊 Monitoring initialized');
    } catch (error) {
      console.warn('⚠️  Could not initialize monitoring:', error.message);
    }
  }

  /**
   * Run comprehensive ETF parsing
   */
  async runETFParsing() {
    console.log('🔄 Running Comprehensive ETF Parsing');
    console.log('====================================');
    
    this.status.lastRun = new Date().toISOString();
    this.status.errors = [];
    this.status.warnings = [];
    
    try {
      // Step 1: Health check
      console.log('🏥 Step 1: Health Check');
      await this.performHealthCheck();
      
      // Step 2: Data fetching
      console.log('📡 Step 2: Data Fetching');
      const htmlData = await this.fetchETFData();
      
      if (!htmlData) {
        throw new Error('No HTML data available');
      }
      
      // Step 3: Robust parsing
      console.log('🔍 Step 3: Robust Parsing');
      const parseResult = await this.parseETFData(htmlData);
      
      if (!parseResult.success) {
        throw new Error(`Parsing failed: ${parseResult.errors.join(', ')}`);
      }
      
      // Step 4: Data processing
      console.log('⚙️  Step 4: Data Processing');
      const processedData = await this.processETFData(parseResult);
      
      // Step 5: Output generation
      console.log('📝 Step 5: Output Generation');
      await this.generateOutputs(processedData);
      
      // Step 6: Monitoring update
      console.log('📊 Step 6: Monitoring Update');
      await this.updateMonitoring();
      
      this.status.success = true;
      console.log('✅ ETF parsing completed successfully');
      
      return {
        success: true,
        flows: processedData.flows,
        individualFlows: processedData.individualFlows,
        metrics: this.status.metrics
      };
      
    } catch (error) {
      this.status.success = false;
      this.status.errors.push(error.message);
      console.error('❌ ETF parsing failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        errors: this.status.errors
      };
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    if (this.monitor) {
      const healthStatus = await this.monitor.checkHealth();
      this.status.metrics.health = healthStatus;
      
      if (healthStatus.status === 'critical') {
        throw new Error('Health check failed: critical status');
      }
    }
  }

  /**
   * Fetch ETF data
   */
  async fetchETFData() {
    const today = new Date().toISOString().split('T')[0];
    const cacheFile = `${this.config.cacheDir}/${today}.html`;
    
    // Try cache first
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      
      if (ageHours < 24) {
        console.log(`📁 Using cached data (${ageHours.toFixed(1)}h old)`);
        return fs.readFileSync(cacheFile, 'utf8');
      }
    }
    
    // Fetch live data
    console.log('📡 Fetching live data...');
    const urls = [
      "https://farside.co.uk/bitcoin-etf-flow-all-data/",
      "https://farside.co.uk/bitcoin-etf-flow/",
      "https://farside.co.uk/etf-flows/",
      "https://farside.co.uk/etf-flows/btc"
    ];
    
    for (const url of urls) {
      try {
        const response = await fetch(url, { 
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
          },
          timeout: this.config.timeout
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Save to cache
          fs.writeFileSync(cacheFile, html, 'utf8');
          console.log(`✅ Fetched from ${url} (${html.length} chars)`);
          
          return html;
        }
      } catch (error) {
        console.log(`❌ Failed to fetch from ${url}: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All data sources failed');
  }

  /**
   * Parse ETF data with robust parser
   */
  async parseETFData(html) {
    try {
      const { parseETFFlowsRobust } = await import('./robust-etf-parser.mjs');
      return await parseETFFlowsRobust(html, {
        maxRetries: this.config.maxRetries,
        timeout: this.config.timeout
      });
    } catch (error) {
      return {
        success: false,
        errors: [`Parser import failed: ${error.message}`],
        flows: [],
        individualFlows: []
      };
    }
  }

  /**
   * Process ETF data
   */
  async processETFData(parseResult) {
    const flows = parseResult.flows;
    const individualFlows = parseResult.individualFlows;
    
    if (flows.length < this.config.minFlows) {
      throw new Error(`Insufficient flows: ${flows.length} (minimum: ${this.config.minFlows})`);
    }
    
    // Calculate 21-day rolling sums
    const flows21d = this.calculate21DayRollingSum(flows);
    
    // Calculate metrics
    const metrics = {
      totalFlows: flows.length,
      individualFlows: individualFlows.length,
      dateRange: {
        start: flows[0]?.date,
        end: flows[flows.length - 1]?.date
      },
      rollingSums: flows21d.length
    };
    
    this.status.metrics = metrics;
    
    return {
      flows,
      individualFlows,
      flows21d,
      metrics
    };
  }

  /**
   * Calculate 21-day rolling sum
   */
  calculate21DayRollingSum(flows) {
    const flows21d = [];
    
    for (let i = 20; i < flows.length; i++) {
      const sum = flows.slice(i - 20, i + 1).reduce((acc, f) => acc + f.flow, 0);
      flows21d.push({
        date: flows[i].date,
        sum: sum
      });
    }
    
    return flows21d;
  }

  /**
   * Generate outputs
   */
  async generateOutputs(processedData) {
    const { flows, individualFlows, flows21d } = processedData;
    
    // Generate aggregate CSV
    const aggregateCsv = this.generateAggregateCSV(flows, flows21d);
    const aggregatePath = `${this.config.outputDir}/etf_flows_aggregate.csv`;
    fs.writeFileSync(aggregatePath, aggregateCsv, 'utf8');
    console.log(`📄 Generated aggregate CSV: ${aggregatePath}`);
    
    // Generate individual ETF CSV
    const individualCsv = this.generateIndividualCSV(individualFlows);
    const individualPath = `${this.config.outputDir}/etf_by_fund.csv`;
    fs.writeFileSync(individualPath, individualCsv, 'utf8');
    console.log(`📄 Generated individual CSV: ${individualPath}`);
    
    // Generate status report
    const statusReport = this.generateStatusReport();
    const statusPath = `${this.config.outputDir}/etf_parsing_status.json`;
    fs.writeFileSync(statusPath, JSON.stringify(statusReport, null, 2), 'utf8');
    console.log(`📊 Generated status report: ${statusPath}`);
  }

  /**
   * Generate aggregate CSV
   */
  generateAggregateCSV(flows, flows21d) {
    const rows = ['date,day_flow_usd,sum21_usd,cumulative_usd'];
    
    let cumulative = 0;
    for (let i = 0; i < flows.length; i++) {
      const flow = flows[i];
      cumulative += flow.flow;
      
      const rollingSum = i >= 20 ? flows21d[i - 20].sum : 0;
      
      rows.push([
        flow.date,
        Math.round(flow.flow),
        Math.round(rollingSum),
        Math.round(cumulative)
      ].join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Generate individual ETF CSV
   */
  generateIndividualCSV(individualFlows) {
    const rows = ['date,symbol,day_flow_usd,sum21_usd,cumulative_usd'];
    
    // Group by ETF and calculate metrics
    const etfGroups = {};
    for (const flow of individualFlows) {
      for (const [etf, amount] of Object.entries(flow.flows)) {
        if (!etfGroups[etf]) {
          etfGroups[etf] = [];
        }
        etfGroups[etf].push({
          date: flow.date,
          flow: amount
        });
      }
    }
    
    // Generate rows for each ETF
    for (const [etf, flows] of Object.entries(etfGroups)) {
      const sortedFlows = flows.sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0;
      
      for (let i = 0; i < sortedFlows.length; i++) {
        const flow = sortedFlows[i];
        cumulative += flow.flow;
        
        const rollingSum = i >= 20 ? 
          sortedFlows.slice(i - 20, i + 1).reduce((sum, f) => sum + f.flow, 0) : 0;
        
        rows.push([
          flow.date,
          etf,
          Math.round(flow.flow),
          Math.round(rollingSum),
          Math.round(cumulative)
        ].join(','));
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Generate status report
   */
  generateStatusReport() {
    return {
      timestamp: new Date().toISOString(),
      status: this.status.success ? 'success' : 'failed',
      metrics: this.status.metrics,
      errors: this.status.errors,
      warnings: this.status.warnings,
      lastRun: this.status.lastRun
    };
  }

  /**
   * Update monitoring
   */
  async updateMonitoring() {
    if (this.monitor) {
      await this.monitor.saveHealthReport();
    }
  }
}

/**
 * Main integration function
 */
async function runETFParsingIntegration() {
  console.log('🚀 ETF Parsing Integration System');
  console.log('=================================');
  
  const integration = new ETFParsingIntegration();
  
  try {
    // Initialize
    await integration.initialize();
    
    if (!integration.status.initialized) {
      throw new Error('Initialization failed');
    }
    
    // Run parsing
    const result = await integration.runETFParsing();
    
    if (result.success) {
      console.log('\n🎉 ETF Parsing Integration completed successfully!');
      console.log(`📊 Generated ${result.flows.length} flows`);
      console.log(`🏢 Generated ${result.individualFlows.length} individual flows`);
    } else {
      console.log('\n❌ ETF Parsing Integration failed');
      console.log(`Error: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Integration failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run integration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runETFParsingIntegration().catch(error => {
    console.error('❌ Integration failed:', error);
    process.exit(1);
  });
}

export { ETFParsingIntegration, runETFParsingIntegration };

