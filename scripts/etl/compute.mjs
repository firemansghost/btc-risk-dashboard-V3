import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "url";
import { computeAllFactors } from "./factors.mjs";
import { getDashboardConfig, getModelVersion, getSsotVersion } from "../../lib/config-loader.mjs";
import { fallbackTracker, resetFallbackTracker } from "./fetch-helper.mjs";

// Resolve absolute paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to create HMAC signature for webhook
function createWebhookSignature(secret, payload, timestamp) {
  const body = JSON.stringify(payload);
  const message = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return signature;
}

// Helper function to check if a date is a business day (Monday-Friday)
function isBusinessDay(date) {
  const day = new Date(date).getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

// Helper function to generate per-ETF breakdown CSV
async function generatePerEtfBreakdown(currentDate, individualEtfFlows) {
  if (!individualEtfFlows || individualEtfFlows.length === 0) {
    console.log("No individual ETF flows data available for breakdown");
    return;
  }

  const csvPath = "public/signals/etf_by_fund.csv";
  const header = "date,symbol,day_flow_usd,sum21_usd,cumulative_usd";
  
  // Ensure the signals directory exists
  try {
    await fs.mkdir("public/signals", { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  
  // Load existing CSV to get historical data for rolling calculations
  let existingData = new Map(); // Map of "date,symbol" -> {day_flow_usd, sum21_usd, cumulative_usd}
  let cumulativeTotals = new Map(); // Map of symbol -> cumulative total
  
  try {
    const existingContent = await fs.readFile(csvPath, "utf8");
    const lines = existingContent.trim().split("\n");
    
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        const [date, symbol, dayFlow, sum21, cumulative] = lines[i].split(',');
        const key = `${date},${symbol}`;
        existingData.set(key, {
          day_flow_usd: parseFloat(dayFlow) || 0,
          sum21_usd: parseFloat(sum21) || 0,
          cumulative_usd: parseFloat(cumulative) || 0
        });
        cumulativeTotals.set(symbol, parseFloat(cumulative) || 0);
      }
    }
  } catch (error) {
    // File doesn't exist yet, start fresh
  }

  // Get today's individual ETF flows
  const todayFlows = individualEtfFlows.find(f => f.date === currentDate);
  if (!todayFlows || !todayFlows.flows) {
    console.log("No ETF flows data for today");
    return;
  }

  let rowsAppended = 0;
  const processedSymbols = new Set();

  // Process each ETF symbol
  for (const [symbol, dayFlow] of Object.entries(todayFlows.flows)) {
    const key = `${currentDate},${symbol}`;
    
    // Skip if already processed today
    if (existingData.has(key)) {
      continue;
    }

    // Calculate 21-day rolling sum (business days only)
    let sum21 = dayFlow;
    let businessDaysCounted = 1;
    
    // Look back through historical data to build 21-day sum
    const sortedDates = Array.from(existingData.keys())
      .map(k => k.split(',')[0])
      .filter(d => d < currentDate)
      .sort((a, b) => b.localeCompare(a)); // Most recent first
    
    for (const date of sortedDates) {
      if (businessDaysCounted >= 21) break;
      
      if (isBusinessDay(date)) {
        const historicalKey = `${date},${symbol}`;
        const historicalData = existingData.get(historicalKey);
        if (historicalData) {
          sum21 += historicalData.day_flow_usd;
          businessDaysCounted++;
        }
      }
    }

    // Update cumulative total
    const currentCumulative = cumulativeTotals.get(symbol) || 0;
    const newCumulative = currentCumulative + dayFlow;
    cumulativeTotals.set(symbol, newCumulative);

    // Append row to CSV
    const rowData = {
      date: currentDate,
      symbol: symbol,
      day_flow_usd: dayFlow,
      sum21_usd: sum21,
      cumulative_usd: newCumulative
    };

    await appendCsvRow(csvPath, header, rowData, 'date,symbol');
    rowsAppended++;
    processedSymbols.add(symbol);
  }

  if (rowsAppended > 0) {
    console.log(`ETF by fund: Added ${rowsAppended} rows for ${processedSymbols.size} funds`);
  }

  // Generate schema hash for the ETF by fund data
  const schemaHash = crypto.createHash('sha256')
    .update(header + JSON.stringify(Array.from(processedSymbols).sort()))
    .digest('hex')
    .substring(0, 8);

  return {
    rowsAppended,
    fundsCount: processedSymbols.size,
    schemaHash
  };
}

// Helper function to append a row to a CSV file (idempotent by date or composite key)
async function appendCsvRow(filePath, header, rowData, keyField = 'date') {
  try {
    let csvContent = "";
    try {
      csvContent = await fs.readFile(filePath, "utf8");
    } catch (error) {
      csvContent = header + "\n";
    }
    
    const csvLines = csvContent.trim().split("\n");
    const hasHeader = csvLines[0] === header;
    if (!hasHeader) csvLines.unshift(header);
    
    const newRow = Object.values(rowData).join(',');
    
    // Handle composite keys (e.g., "date,symbol")
    let keyValue;
    if (keyField.includes(',')) {
      const keyFields = keyField.split(',');
      keyValue = keyFields.map(field => rowData[field]).join(',');
    } else {
      keyValue = rowData[keyField];
    }
    
    const alreadyExists = csvLines.some(line => line.startsWith(keyValue + ","));
    
    if (!alreadyExists) {
      csvLines.push(newRow);
      await fs.writeFile(filePath, csvLines.join("\n"));
      return { appended: true, rows: csvLines.length - 1 };
    }
    
    return { appended: false, rows: csvLines.length - 1 };
  } catch (error) {
    console.warn(`Failed to append to ${filePath}:`, error.message);
    return { appended: false, rows: 0, error: error.message };
  }
}

// Load environment variables from .env.local if it exists
try {
  const envContent = await fs.readFile('.env.local', 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // .env.local doesn't exist, that's fine
}

const ISO = (d) => d.toISOString().split("T")[0];

async function readText(path) {
  try { return await fs.readFile(path, "utf8"); } catch { return null; }
}
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function getCoinbaseCloseForYesterday() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(todayUTC.getTime() - 2 * 86400_000); // two days window
  const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
  url.searchParams.set("granularity", "86400");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", todayUTC.toISOString());

  const res = await fetch(url, { headers: { "User-Agent": "gg-risk-etl" } });
  if (!res.ok) throw new Error(`Coinbase ${res.status}`);
  const rows = await res.json(); // newest-first
  const sorted = rows.map(r => ({ ts: r[0] * 1000, close: r[4] }))
                     .sort((a, b) => a.ts - b.ts);
  // Yesterday = last fully closed bucket (the last element)
  const last = sorted[sorted.length - 1];
  return { date: ISO(new Date(last.ts)), close: Number(last.close) };
}

async function getCoinGeckoCloseForYesterday() {
  const url = new URL("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", "2");
  url.searchParams.set("interval", "daily");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const j = await res.json(); // oldest-first
  const pair = j.prices[j.prices.length - 1]; // [ms, price]
  return { date: ISO(new Date(pair[0])), close: Number(pair[1]) };
}

// Load risk bands from dashboard-config.json
let riskBands = null;

async function loadRiskBands() {
  if (riskBands) return riskBands;
  
  try {
    const path = await import('path');
    const dashboardConfigPath = path.join(process.cwd(), 'config', 'dashboard-config.json');
    const dashboardConfigFile = await fs.readFile(dashboardConfigPath, 'utf8');
    const dashboardConfig = JSON.parse(dashboardConfigFile);
    
    if (dashboardConfig.bands && Array.isArray(dashboardConfig.bands)) {
      riskBands = dashboardConfig.bands;
      console.log('ETL: Loaded risk bands from dashboard-config.json');
      return riskBands;
    }
  } catch (error) {
    console.warn('ETL: Failed to load risk bands from dashboard-config.json:', error.message);
  }
  
  // Fallback to hardcoded bands if config fails
  riskBands = [
    { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 14], color: 'green', recommendation: 'Historically depressed/washed-out conditions.' },
    { key: 'dca_buy', label: 'Regular DCA Buying', range: [15, 34], color: 'green', recommendation: 'Favorable long-term conditions; take your time.' },
    { key: 'moderate_buy', label: 'Moderate Buying', range: [35, 49], color: 'yellow', recommendation: 'Moderate buying opportunities.' },
    { key: 'hold_wait', label: 'Hold & Wait', range: [50, 64], color: 'orange', recommendation: 'Hold core; buy dips selectively.' },
    { key: 'reduce_risk', label: 'Reduce Risk', range: [65, 79], color: 'red', recommendation: 'Trim risk; tighten risk controls.' },
    { key: 'high_risk', label: 'High Risk', range: [80, 100], color: 'red', recommendation: 'Crowded tape; prone to disorderly moves.' }
  ];
  console.log('ETL: Using fallback risk bands');
  return riskBands;
}

function riskBand(score) {
  if (!riskBands) {
    console.error('ETL: Risk bands not loaded. Call loadRiskBands() first.');
    return { name: "Unknown", lo: 0, hi: 100 };
  }
  
  // Find the band that contains this score
  for (const band of riskBands) {
    if (score >= band.range[0] && score < band.range[1]) {
      return { 
        name: band.label, 
        lo: band.range[0], 
        hi: band.range[1],
        color: band.color,
        recommendation: band.recommendation
      };
    }
  }
  
  // Fallback to last band if score is out of range
  const lastBand = riskBands[riskBands.length - 1];
  return { 
    name: lastBand.label, 
    lo: lastBand.range[0], 
    hi: lastBand.range[1],
    color: lastBand.color,
    recommendation: lastBand.recommendation
  };
}

/**
 * ETL Self-Check: Validate config and cache writeability before heavy work
 */
async function runSelfCheck() {
  // Check for bypass flags
  const skipSelfCheck = process.env.SELF_CHECK === '0' || 
                        process.argv.includes('--no-selfcheck') ||
                        process.argv.includes('--skip-selfcheck');
  
  if (skipSelfCheck) {
    const reason = process.env.SELF_CHECK === '0' ? 'env' : 'flag';
    console.log(`[ETL self-check] skipped (${reason})`);
    return;
  }

  try {
    // 1. Load normalized config and validate model_version
    const config = await getDashboardConfig();
    const modelVersion = config.model_version;
    const ssotVersion = config.ssot_version || modelVersion;
    
    if (!modelVersion || typeof modelVersion !== 'string') {
      console.error('[ETL self-check] Invalid config: model_version is missing. Check config/dashboard-config.json and config-loader.');
      process.exit(1);
    }

    // 2. Resolve absolute cache directory
    const cacheDir = path.resolve(process.cwd(), 'public/data/cache');
    
    // 3. Ensure cache directory exists and is writable
    await fs.mkdir(cacheDir, { recursive: true });
    
    // 4. Test write/read/delete
    const testFile = path.join(cacheDir, '.etl-self-check-temp.json');
    const testData = { timestamp: new Date().toISOString(), test: true };
    
    try {
      await fs.writeFile(testFile, JSON.stringify(testData), 'utf8');
      const readBack = await fs.readFile(testFile, 'utf8');
      const parsed = JSON.parse(readBack);
      
      if (parsed.test !== true) {
        throw new Error('Read-back validation failed');
      }
      
      await fs.unlink(testFile);
    } catch (error) {
      console.error(`[ETL self-check] Cache write/read test failed at ${cacheDir}: ${error.message}`);
      process.exit(1);
    }

    // 5. Print success banner
    console.log(`[ETL self-check] model_version=${modelVersion} • ssot_version=${ssotVersion} • node=${process.version} • cwd=${process.cwd()}`);
    console.log(`[ETL self-check] OK (cache write/read verified at ${cacheDir})`);
  } catch (error) {
    console.error(`[ETL self-check] Failed: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  // Run self-check first (fail-fast)
  await runSelfCheck();
  
  await ensureDir("public/data");
  
  // Load risk bands from dashboard-config.json
  await loadRiskBands();
  
  // Clean old cache files
  try {
    const { cleanOldCacheFiles } = await import('./factors.mjs');
    await cleanOldCacheFiles();
  } catch (error) {
    console.warn('Could not clean cache files:', error.message);
  }

  // 0) Manage unified price history (Alpha Vantage backfill + Coinbase primary)
  console.log("Managing unified BTC price history...");
  let priceHistoryResults = null;
  try {
    const { managePriceHistory } = await import('./priceHistory.mjs');
    priceHistoryResults = await managePriceHistory();
  } catch (error) {
    console.warn('Price history management failed:', error.message);
    // Continue with fallback approach
  }

  // 1) Get yesterday's close (Coinbase → CG fallback)
  let y;
  try { y = await getCoinbaseCloseForYesterday(); }
  catch { y = await getCoinGeckoCloseForYesterday(); }

  // 2) Compute real risk factors
  console.log("Computing real risk factors...");
  const factorResults = await computeAllFactors(y.close);
  const composite = factorResults.composite;

  // 2.1) Update factor history tracking
  console.log("Updating factor history...");
  try {
    const factorHistoryModule = await import('./factor-history-tracking.mjs');
    if (factorHistoryModule.updateFactorHistory) {
      await factorHistoryModule.updateFactorHistory();
    } else {
      console.log("⚠️  Factor history tracking not available");
    }
  } catch (error) {
    console.log(`⚠️  Factor history update failed: ${error.message}`);
  }

  // 2.5) Compute BTC⇄Gold cross-rates
  console.log("Computing BTC⇄Gold cross-rates...");
  const { computeBtcGoldRates } = await import('./factors.mjs');
  const goldResult = await computeBtcGoldRates();

  // 2.6) Compute Satoshis per Dollar (display-only)
  console.log("Computing Satoshis per Dollar...");
  const satsPerUsd = 100_000_000 / y.close;
  const usdPerSat = 1 / satsPerUsd;

  // 2.7) Generate factor history CSVs
  console.log("Generating factor history CSVs...");
  await ensureDir("public/signals");
  
  const historyResults = [];
  
  // Process each factor and generate history CSV
  for (const factor of factorResults.factors) {
    if (factor.status !== 'fresh') continue; // Only process fresh factors
    
    let csvResult = { appended: false, rows: 0 };
    
    switch (factor.key) {
      case 'stablecoins':
        csvResult = await appendCsvRow(
          "public/signals/stablecoins_30d.csv",
          "date,pct_change_30d,z,score",
          {
            date: y.date,
            pct_change_30d: factor.details?.find(d => d.label === "30-day Change")?.value?.replace('%', '') || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'etf_flows':
        // ETF flows CSV already exists, ensure it has the right columns
        csvResult = await appendCsvRow(
          "public/signals/etf_flows_21d.csv",
          "date,day_flow_usd,sum21_usd,z,pct,score",
          {
            date: y.date,
            day_flow_usd: factor.details?.find(d => d.label === "Latest Daily Flow")?.value?.replace(/[,$]/g, '') || '0',
            sum21_usd: factor.details?.find(d => d.label === "21-day Sum")?.value?.replace(/[,$]/g, '') || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            pct: factor.details?.find(d => d.label === "Percentile")?.value?.replace('%', '') || '0',
            score: factor.score
          }
        );
        
        // Generate per-ETF breakdown CSV
        if (factor.details?.find(d => d.label === "Individual ETF Flows")?.value === "Available") {
          const etfBreakdownResult = await generatePerEtfBreakdown(y.date, factor.individualEtfFlows);
          if (etfBreakdownResult && etfBreakdownResult.rowsAppended > 0) {
            historyResults.push({
              name: 'ETF by fund',
              ok: true,
              rows_appended: etfBreakdownResult.rowsAppended,
              funds: etfBreakdownResult.fundsCount,
              schema_hash_funds: etfBreakdownResult.schemaHash
            });
          }
        }
        break;
        
      case 'net_liquidity':
        csvResult = await appendCsvRow(
          "public/signals/net_liquidity_20d.csv",
          "date,delta20d_usd,z,score",
          {
            date: y.date,
            delta20d_usd: factor.details?.find(d => d.label === "Net Liquidity")?.value?.replace(/[,$T]/g, '') || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'trend_valuation':
        csvResult = await appendCsvRow(
          "public/signals/mayer_multiple.csv",
          "date,mayer,stretch,z,score",
          {
            date: y.date,
            mayer: factor.details?.find(d => d.label === "Mayer Multiple")?.value || '0',
            stretch: factor.details?.find(d => d.label === "Stretch")?.value || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'term_leverage':
        csvResult = await appendCsvRow(
          "public/signals/funding_7d.csv",
          "date,funding_7d_avg,z,score",
          {
            date: y.date,
            funding_7d_avg: factor.details?.find(d => d.label === "7-day Change")?.value?.replace('%', '') || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'macro_overlay':
        csvResult = await appendCsvRow(
          "public/signals/dxy_20d.csv",
          "date,dxy_delta20d,z,score",
          {
            date: y.date,
            dxy_delta20d: factor.details?.find(d => d.label === "DXY 20d Change")?.value?.replace('%', '') || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'social_interest':
        csvResult = await appendCsvRow(
          "public/signals/fear_greed.csv",
          "date,fng_value,z,score",
          {
            date: y.date,
            fng_value: factor.details?.find(d => d.label === "Fear & Greed Index")?.value || '0',
            z: factor.details?.find(d => d.label === "Z-Score")?.value || '0',
            score: factor.score
          }
        );
        break;
        
      case 'onchain':
        csvResult = await appendCsvRow(
          "public/signals/onchain_activity.csv",
          "date,fees_7d_avg,mempool_7d_avg,puell_multiple,score",
          {
            date: y.date,
            fees_7d_avg: factor.details?.find(d => d.label === "Fees 7d avg (USD)")?.value?.replace(/[$,]/g, '') || '0',
            mempool_7d_avg: factor.details?.find(d => d.label === "Mempool 7d avg (MB)")?.value?.replace(' MB', '') || '0',
            puell_multiple: factor.details?.find(d => d.label === "Puell Multiple")?.value || '0',
            score: factor.score
          }
        );
        break;
    }
    
    if (csvResult.appended) {
      historyResults.push({
        name: `History: ${factor.key}`,
        ok: true,
        rows_appended: 1,
        total_rows: csvResult.rows
      });
    }
  }

  // 2.8) Generate alerts for significant events
  console.log("Checking for alerts...");
  await ensureDir("public/alerts");
  
  const alerts = [];
  
  // 1) ETF Zero-Cross Detection
  try {
    const etfCsvPath = "public/signals/etf_flows_21d.csv";
    const etfCsvContent = await fs.readFile(etfCsvPath, "utf8");
    const etfLines = etfCsvContent.trim().split("\n");
    
    if (etfLines.length >= 2) {
      const headers = etfLines[0].split(',');
      const sum21Index = headers.indexOf('sum21_usd');
      
      if (sum21Index !== -1) {
        // Get last 180 days of sum21_usd for deadband calculation
        const last180Rows = etfLines.slice(-180).map(line => {
          const values = line.split(',');
          return Number(values[sum21Index]) || 0;
        });
        
        // Calculate deadband: max(round(0.02 * std), 1000)
        const mean = last180Rows.reduce((a, b) => a + b, 0) / last180Rows.length;
        const variance = last180Rows.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / last180Rows.length;
        const std = Math.sqrt(variance);
        const eps = Math.max(Math.round(0.02 * std), 1000);
        
        // Get last two rows
        const prevRow = etfLines[etfLines.length - 2].split(',');
        const currRow = etfLines[etfLines.length - 1].split(',');
        const prev = Number(prevRow[sum21Index]) || 0;
        const curr = Number(currRow[sum21Index]) || 0;
        
        // Check for zero-cross with deadband
        if (Math.abs(prev) > eps && Math.abs(curr) > eps && 
            Math.sign(prev) !== Math.sign(curr)) {
          const direction = curr > 0 ? 'up' : 'down';
          alerts.push({
            type: 'etf_zero_cross',
            direction,
            from: prev,
            to: curr,
            deadband: eps
          });
        }
      }
    }
  } catch (error) {
    console.warn("ETF zero-cross detection failed:", error.message);
  }
  
  // 2) Risk Band Change Detection
  try {
    // Read yesterday from history.csv
    const historyContent = await fs.readFile("public/data/history.csv", "utf8");
    const historyLines = historyContent.trim().split("\n");
    const yesterdayRow = historyLines.find(line => line.startsWith(y.date));
    
    if (yesterdayRow) {
      const yesterdayValues = yesterdayRow.split(',');
      const yesterdayBand = yesterdayValues[2]; // band column
      const yesterdayComposite = Number(yesterdayValues[1]); // score column
      
      // Get today's band from latest.json (already computed)
      const todayBand = band.name;
      const todayComposite = composite;
      
      if (yesterdayBand !== todayBand) {
        alerts.push({
          type: 'band_change',
          from: yesterdayBand,
          to: todayBand,
          composite_from: yesterdayComposite,
          composite_to: todayComposite
        });
      }
    }
  } catch (error) {
    console.warn("Band change detection failed:", error.message);
  }
  
  // 3) Idempotence check and alert persistence
  const alertLogPath = "public/alerts/log.csv";
  const alertLogHeader = "occurred_at,type,details";
  
  // Read existing log to check for today's alerts
  let existingLog = "";
  try {
    existingLog = await fs.readFile(alertLogPath, "utf8");
  } catch (error) {
    existingLog = alertLogHeader + "\n";
  }
  
  const logLines = existingLog.trim().split("\n");
  const todayDate = y.date;
  
  // Filter out alerts that already exist for today
  const newAlerts = alerts.filter(alert => {
    const alertType = alert.type;
    return !logLines.some(line => 
      line.startsWith(todayDate) && line.includes(alertType)
    );
  });
  
  // Append new alerts to log
  if (newAlerts.length > 0) {
    const newLogLines = newAlerts.map(alert => 
      `${todayDate},${alert.type},"${JSON.stringify(alert).replace(/"/g, '""')}"`
    );
    await fs.writeFile(alertLogPath, logLines.concat(newLogLines).join("\n"));
  }
  
  // 4) Write latest alerts
  const latestAlerts = {
    occurred_at: new Date().toISOString(),
    alerts: newAlerts
  };
  await fs.writeFile("public/alerts/latest.json", JSON.stringify(latestAlerts, null, 2));
  
  // 5) Optional webhook notification
  if (process.env.ALERT_WEBHOOK_URL && newAlerts.length > 0) {
    try {
      const webhookPayload = {
        run_id: process.env.GITHUB_RUN_ID || 'local',
        occurred_at: latestAlerts.occurred_at,
        alerts: newAlerts,
        diagnostics: {
          etf_csv_rows: etfLines?.length || 0,
          history_csv_rows: historyLines?.length || 0,
          total_alerts_today: newAlerts.length
        }
      };
      
      // Prepare headers with HMAC signature if secret is provided
      const headers = { 'Content-Type': 'application/json' };
      const timestamp = new Date().toISOString();
      
      if (process.env.ALERT_WEBHOOK_SECRET) {
        const signature = createWebhookSignature(process.env.ALERT_WEBHOOK_SECRET, webhookPayload, timestamp);
        headers['X-GhostGauge-Signature'] = signature;
        headers['X-GhostGauge-Timestamp'] = timestamp;
      }
      
      // Retry logic with exponential backoff
      let retries = 2;
      let delay = 1000;
      
      while (retries >= 0) {
        try {
          const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(30000) // 30 second timeout
          });
          
          if (response.ok) {
            console.log("Webhook notification sent successfully");
            break;
          } else if (response.status === 429 || response.status >= 500) {
            if (retries > 0) {
              console.log(`Webhook failed with ${response.status}, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              retries--;
            } else {
              throw new Error(`Webhook failed with ${response.status}`);
            }
          } else {
            throw new Error(`Webhook failed with ${response.status}`);
          }
        } catch (error) {
          if (retries === 0) {
            throw error;
          }
          console.log(`Webhook error: ${error.message}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
        }
      }
    } catch (error) {
      console.warn("Webhook notification failed:", error.message);
      // Add webhook failure to status (will be added to status.json later)
      historyResults.push({
        name: "Alerts Webhook",
        ok: false,
        error: error.message
      });
    }
  }
  
  if (newAlerts.length > 0) {
    console.log(`Generated ${newAlerts.length} alerts:`, newAlerts.map(a => a.type).join(', '));
  } else {
    console.log("No new alerts generated");
  }

  // 3) Upsert history.csv (will be updated after adjustments are calculated)

  // 4) latest.json with real factor data
  // Calculate cycle and spike adjustments
  const nowIso = new Date().toISOString();
  
  // Import adjustment calculation functions
  const { 
    calculateCycleAdjustment, 
    calculateSpikeAdjustment, 
    loadHistoricalPrices, 
    calculateDailyReturns 
  } = await import('./adjustments.mjs');
  
  // Load historical data for adjustments
  const historicalPrices = await loadHistoricalPrices();
  let cycle_adjustment, spike_adjustment;
  
  if (historicalPrices && historicalPrices.length > 365) {
    // Calculate cycle adjustment (power-law trend)
    const cycleResult = calculateCycleAdjustment(historicalPrices, y.close);
    cycle_adjustment = {
      ...cycleResult,
      last_utc: nowIso,
      source: 'ETL calculation'
    };
    
    // Calculate spike adjustment (volatility)
    const dailyReturns = calculateDailyReturns(historicalPrices);
    const currentReturn = dailyReturns.length > 0 ? dailyReturns[dailyReturns.length - 1] : 0;
    const spikeResult = calculateSpikeAdjustment(dailyReturns, currentReturn);
    spike_adjustment = {
      ...spikeResult,
      ref_close: historicalPrices[historicalPrices.length - 2] || y.close,
      spot: y.close,
      last_utc: nowIso,
      source: 'ETL calculation'
    };
  } else {
    // Fallback when insufficient historical data
    cycle_adjustment = {
      adj_pts: 0,
      residual_z: null,
      last_utc: nowIso,
      source: 'ETL fallback',
      reason: 'insufficient_historical_data'
    };
    spike_adjustment = {
      adj_pts: 0,
      r_1d: 0,
      sigma: 0,
      z: 0,
      ref_close: y.close,
      spot: y.close,
      last_utc: nowIso,
      source: 'ETL fallback',
      reason: 'insufficient_historical_data'
    };
  }

  // Apply adjustments to composite score
  const adjustedComposite = composite + (cycle_adjustment.adj_pts || 0) + (spike_adjustment.adj_pts || 0);
  const finalComposite = Math.max(0, Math.min(100, Math.round(adjustedComposite * 10) / 10));
  
  // Calculate risk band using adjusted composite score
  const band = riskBand(finalComposite);

  // 3) Upsert history.csv with adjusted composite score
  const header = "date,score,band,price_usd";
  const existing = await readText("public/data/history.csv");
  let lines = existing ? existing.trim().split("\n") : [header];

  const hasHeader = lines[0].toLowerCase().startsWith("date,score,band,price_usd");
  if (!hasHeader) lines.unshift(header);

  const already = lines.some(l => l.startsWith(y.date + ","));
  if (!already) {
    lines.push(`${y.date},${finalComposite},${band.name},${y.close.toFixed(2)}`);
  }
  await fs.writeFile("public/data/history.csv", lines.join("\n"));

  // Load model_version from SSOT
  let modelVersion = 'v1.1'; // Default fallback
  try {
    const dashboardConfigPath = path.join(process.cwd(), 'config', 'dashboard-config.json');
    const dashboardConfigContent = await fs.readFile(dashboardConfigPath, 'utf8');
    const dashboardConfig = JSON.parse(dashboardConfigContent);
    if (dashboardConfig.model_version) {
      modelVersion = dashboardConfig.model_version;
    }
  } catch (error) {
    console.warn('Could not load model_version from SSOT, using default:', error.message);
  }

  const latest = {
    ok: true,
    as_of_utc: new Date().toISOString(),
    composite_score: finalComposite,
    composite_raw: composite,
    band: {
      key: band.key || band.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: band.name,
      range: [band.lo, band.hi],
      color: band.color || '#6B7280',
      recommendation: band.recommendation || band.name
    },
    health: 'green',
    factors: factorResults.factors,
    btc: {
      spot_usd: y.close,
      as_of_utc: new Date().toISOString(),
      source: 'Coinbase'
    },
    provenance: [],
    model_version: modelVersion,
    transform: {},
    // Legacy nudges preserved for backward-compat clients
    adjustments: { cycle_nudge: 0.0, spike_nudge: 0.0 },
    // Rich objects for UI/API
    cycle_adjustment,
    spike_adjustment,
    config_digest: "etl_real_factors",
    ...(goldResult.success && { cross: { btc_per_oz: goldResult.data.btc_per_oz, oz_per_btc: goldResult.data.oz_per_btc } })
  };
  await fs.writeFile("public/data/latest.json", JSON.stringify(latest, null, 2));

  // 4.1) Generate indicator alerts (cycle, spike, 50W SMA)
  console.log("Generating indicator alerts...");
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    
    await execAsync('node scripts/etl/generate-indicator-alerts.mjs');
    console.log("✅ Indicator alerts generated successfully");
  } catch (error) {
    console.log(`⚠️  Indicator alert generation failed: ${error.message}`);
  }

  // 4.2) Generate factor change alerts
  console.log("Generating factor change alerts...");
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    
    await execAsync('node scripts/etl/generate-factor-change-alerts.mjs');
    console.log("✅ Factor change alerts generated successfully");
  } catch (error) {
    console.log(`⚠️  Factor change alert generation failed: ${error.message}`);
  }

  // 4.3) Monitor data freshness
  console.log("Monitoring data freshness...");
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    
    await execAsync('node scripts/etl/monitor-data-freshness.mjs');
    console.log("✅ Data freshness monitoring completed");
  } catch (error) {
    console.log(`⚠️  Data freshness monitoring failed: ${error.message}`);
  }

  // 5) status.json (preserve existing data like schema hashes)
  let existingStatus = {};
  try {
    const existingContent = await fs.readFile("public/data/status.json", "utf8");
    existingStatus = JSON.parse(existingContent);
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
  }
  
  const status = {
    ...existingStatus, // Preserve existing data like etf_schema_hash
    updated_at: new Date().toISOString(),
    sources: [
      { name: "Coinbase daily candles", ok: true, ms: null, url: "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400" },
      { name: "CoinGecko market chart (fallback)", ok: true, ms: null, url: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily" },
      { name: "Fear & Greed Index", ok: true, ms: null, url: "https://api.alternative.me/fng/" },
      { name: "FRED API (if key provided)", ok: !!process.env.FRED_API_KEY, ms: null, url: "https://fred.stlouisfed.org/" },
      ...(goldResult.success ? goldResult.data.provenance.map(p => ({
        ...p,
        cache_used: false, // Gold data is always fresh from API
        fallback_used: p.fallback || false
      })) : []),
      ...historyResults // Add factor history tracking
    ],
    factors_computed: factorResults.factors.length,
    factors_successful: factorResults.factors.filter(f => f.status === 'fresh').length,
    gold_cross_rates: goldResult.success ? {
      status: "success",
      source: goldResult.data.provenance[0]?.name || "unknown",
      fallback_used: goldResult.data.provenance[0]?.fallback || false,
      latency_ms: goldResult.data.provenance[0]?.ms || 0
    } : {
      status: "failed",
      reason: goldResult.reason
    },
    satoshis_per_dollar: {
      status: "success",
      source: "BTC daily close (derived)",
      derived: true
    },
    // Add price history management results
    price_history: priceHistoryResults ? {
      total_rows: priceHistoryResults.final_stats?.total_rows || 0,
      oldest_date: priceHistoryResults.final_stats?.oldest_date,
      newest_date: priceHistoryResults.final_stats?.newest_date,
      alpha_vantage_backfill: priceHistoryResults.alpha_vantage_backfill ? {
        status: priceHistoryResults.alpha_vantage_backfill.success ? "success" : "failed",
        rows_fetched: priceHistoryResults.alpha_vantage_backfill.provenance?.rows_fetched || 0,
        endpoint: priceHistoryResults.alpha_vantage_backfill.provenance?.endpoint,
        ms: priceHistoryResults.alpha_vantage_backfill.provenance?.ms,
        reason: priceHistoryResults.alpha_vantage_backfill.reason
      } : null,
      coinbase_daily_update: priceHistoryResults.coinbase_daily_update ? {
        status: priceHistoryResults.coinbase_daily_update.success ? "success" : "failed",
        rows_fetched: priceHistoryResults.coinbase_daily_update.provenance?.rows_fetched || 0,
        ms: priceHistoryResults.coinbase_daily_update.provenance?.ms,
        reason: priceHistoryResults.coinbase_daily_update.reason
      } : null,
      drift_check: priceHistoryResults.drift_check || null
    } : {
      status: "failed",
      reason: "Price history management not available"
    }
  };
  await fs.writeFile("public/data/status.json", JSON.stringify(status, null, 2));

  // 6) Create gold artifacts if successful
  if (goldResult.success) {
    // Create extras/gold_cross.json
    await ensureDir("public/extras");
    await fs.writeFile("public/extras/gold_cross.json", JSON.stringify(goldResult.data, null, 2));

    // Create signals/btc_xau.csv
    await ensureDir("public/signals");
    const csvHeader = "date,btc_close_usd,xau_close_usd,btc_per_oz,oz_per_btc";
    const csvPath = "public/signals/btc_xau.csv";
    
    let csvContent = "";
    try {
      csvContent = await fs.readFile(csvPath, "utf8");
    } catch (error) {
      csvContent = csvHeader + "\n";
    }
    
    const csvLines = csvContent.trim().split("\n");
    const hasHeader = csvLines[0] === csvHeader;
    if (!hasHeader) csvLines.unshift(csvHeader);
    
    const newRow = `${goldResult.data.date},${goldResult.data.btc_close_usd},${goldResult.data.xau_close_usd},${goldResult.data.btc_per_oz},${goldResult.data.oz_per_btc}`;
    const alreadyExists = csvLines.some(line => line.startsWith(goldResult.data.date + ","));
    
    if (!alreadyExists) {
      csvLines.push(newRow);
    }
    
    await fs.writeFile(csvPath, csvLines.join("\n"));
    console.log(`Gold cross-rates: 1 BTC = ${goldResult.data.btc_per_oz.toFixed(4)} oz, 1 oz = ${goldResult.data.oz_per_btc.toFixed(4)} BTC`);
  } else {
    console.warn(`Gold cross-rates failed: ${goldResult.reason}`);
  }

  // 7) Create satoshis artifacts
  const satsData = {
    updated_at: new Date().toISOString(),
    date: y.date,
    btc_close_usd: y.close,
    sats_per_usd: satsPerUsd,
    usd_per_sat: usdPerSat,
    provenance: [{
      name: "BTC daily close (Coinbase)",
      ok: true,
      url: "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400",
      ms: null // We don't track latency for derived data
    }]
  };

  // Create extras/sats.json
  await ensureDir("public/extras");
  await fs.writeFile("public/extras/sats.json", JSON.stringify(satsData, null, 2));

  // Create signals/sats_per_usd.csv
  const satsCsvHeader = "date,sats_per_usd,usd_per_sat,btc_close_usd";
  const satsCsvPath = "public/signals/sats_per_usd.csv";
  
  let satsCsvContent = "";
  try {
    satsCsvContent = await fs.readFile(satsCsvPath, "utf8");
  } catch (error) {
    satsCsvContent = satsCsvHeader + "\n";
  }
  
  const satsCsvLines = satsCsvContent.trim().split("\n");
  const hasSatsHeader = satsCsvLines[0] === satsCsvHeader;
  if (!hasSatsHeader) satsCsvLines.unshift(satsCsvHeader);
  
  const satsNewRow = `${y.date},${satsPerUsd},${usdPerSat},${y.close}`;
  const satsAlreadyExists = satsCsvLines.some(line => line.startsWith(y.date + ","));
  
  if (!satsAlreadyExists) {
    satsCsvLines.push(satsNewRow);
  }
  
  await fs.writeFile(satsCsvPath, satsCsvLines.join("\n"));
  console.log(`Satoshis per dollar: 1 USD = ${Math.round(satsPerUsd).toLocaleString()} sats, 1 sat = $${usdPerSat.toFixed(8)}`);

  console.log(`ETL compute OK for ${y.date}`);
  console.log(`Composite score: ${composite} (${band.name})`);
  console.log(`Factors: ${factorResults.factors.filter(f => f.status === 'fresh').length}/${factorResults.factors.length} successful`);
  
  // Print end-of-run summary
  const fallbackCounts = Object.entries(fallbackTracker)
    .filter(([_, count]) => count > 0)
    .map(([factor, count]) => `${factor}:${count}`)
    .join(', ');
  
  const fallbackSummary = fallbackCounts ? `fallbacks: {${fallbackCounts}}` : 'fallbacks: {}';
  console.log(`[ETL summary] ${fallbackSummary}`);
}

main().catch(e => { console.error(e); process.exit(1); });
