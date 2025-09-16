// scripts/etl/factors.mjs
// ETL-compatible factor computations for the daily pipeline
// Simplified versions of the main factor implementations

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const ISO = (d) => d.toISOString().split("T")[0];

// Simple percentile rank calculation
function percentileRank(arr, value) {
  const sorted = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break;
  }
  return count / sorted.length;
}

// Simple moving average
function sma(arr, period) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// Simple RSI calculation
function calculateRSI(prices, period = 14) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let gains = 0;
      let losses = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(rsi);
      }
    }
  }
  return result;
}

// Risk score from percentile (0-100)
function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  
  let p = percentile;
  if (invert) p = 1 - p;
  
  // Logistic function: 1 / (1 + e^(-k * (2p - 1)))
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

// ============================================================================
// FACTOR COMPUTATIONS
// ============================================================================

// 1. TREND & VALUATION
async function computeTrendValuation() {
  try {
    // Use CoinGecko for more reliable data access
    const url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    
    const data = await res.json();
    if (!data.prices || !Array.isArray(data.prices) || data.prices.length < 200) {
      return { score: null, reason: "insufficient_data" };
    }

    // Extract closes (oldest first)
    const closes = data.prices.map(([timestamp, price]) => price).filter(Number.isFinite);
    if (closes.length < 200) return { score: null, reason: "insufficient_data" };

    // Calculate SMA200 and Mayer Multiple
    const sma200 = sma(closes, 200);
    const mayerSeries = closes.map((price, i) => price / sma200[i]).filter(Number.isFinite);
    
    if (mayerSeries.length === 0) return { score: null, reason: "calculation_failed" };

    // Use latest Mayer Multiple for percentile ranking
    const latestMayer = mayerSeries[mayerSeries.length - 1];
    const percentile = percentileRank(mayerSeries, latestMayer);
    
    // Higher Mayer Multiple = higher risk (invert percentile)
    const score = riskFromPercentile(percentile, { invert: true, k: 3 });
    
    // Calculate additional metrics for details
    const latestPrice = closes[closes.length - 1];
    const latestSma200 = sma200[sma200.length - 1];
    const bmsbDistance = ((latestMayer - 1) * 100);
    
    // Simple RSI calculation for momentum
    const rsi = calculateRSI(closes, 14);
    const latestRsi = rsi[rsi.length - 1];
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "Price vs 200-day SMA (Mayer)", value: latestMayer.toFixed(2) },
        { label: "Distance to Bull Market Support Band", value: `${bmsbDistance.toFixed(1)}%` },
        { label: "Weekly momentum (RSI proxy)", value: latestRsi.toFixed(1) },
        { label: "Current Price", value: `$${latestPrice.toLocaleString()}` },
        { label: "200-day SMA", value: `$${latestSma200.toLocaleString()}` }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 2. SOCIAL INTEREST (Fear & Greed Index)
async function computeSocialInterest() {
  try {
    const url = "https://api.alternative.me/fng/?limit=0&format=json";
    const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
    if (!res.ok) throw new Error(`Fear & Greed ${res.status}`);
    
    const data = await res.json();
    if (!Array.isArray(data?.data) || data.data.length === 0) {
      return { score: null, reason: "no_data" };
    }

    // Extract values and sort by timestamp
    const values = data.data
      .map(item => Number(item.value))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    if (values.length === 0) return { score: null, reason: "no_valid_data" };

    // Use latest value for percentile ranking
    const latest = values[values.length - 1];
    const percentile = percentileRank(values, latest);
    
    // Higher Fear & Greed value (greed) = higher risk (no inversion)
    const score = riskFromPercentile(percentile, { invert: false, k: 3 });
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "Fear & Greed Index", value: latest.toString() },
        { label: "Index Percentile (1y)", value: `${(percentile * 100).toFixed(0)}%` },
        { label: "Sentiment Level", value: latest >= 75 ? "Extreme Greed" : latest >= 55 ? "Greed" : latest >= 45 ? "Neutral" : latest >= 25 ? "Fear" : "Extreme Fear" },
        { label: "Data Points", value: values.length.toString() }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 3. NET LIQUIDITY (FRED data - requires API key)
async function computeNetLiquidity() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { score: null, reason: "missing_fred_api_key" };
  }

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    // Fetch FRED series in parallel
    const [walcl, rrp, tga] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`)
    ]);

    if (!walcl.ok || !rrp.ok || !tga.ok) {
      return { score: null, reason: "fred_api_error" };
    }

    const [walclData, rrpData, tgaData] = await Promise.all([
      walcl.json(),
      rrp.json(),
      tga.json()
    ]);

    // Extract values and calculate net liquidity
    const walclValues = walclData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const rrpValues = rrpData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const tgaValues = tgaData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];

    if (walclValues.length === 0 || rrpValues.length === 0 || tgaValues.length === 0) {
      return { score: null, reason: "insufficient_fred_data" };
    }

    // Calculate net liquidity (simplified - use latest values)
    const latestWalcl = walclValues[walclValues.length - 1];
    const latestRrp = rrpValues[rrpValues.length - 1];
    const latestTga = tgaValues[tgaValues.length - 1];
    
    const netLiquidity = latestWalcl - latestRrp - latestTga;
    
    // Create a simple series for percentile ranking (use all available values)
    const netLiquiditySeries = [];
    const minLength = Math.min(walclValues.length, rrpValues.length, tgaValues.length);
    for (let i = 0; i < minLength; i++) {
      const nl = walclValues[i] - rrpValues[i] - tgaValues[i];
      if (Number.isFinite(nl)) netLiquiditySeries.push(nl);
    }

    if (netLiquiditySeries.length === 0) {
      return { score: null, reason: "net_liquidity_calculation_failed" };
    }

    const percentile = percentileRank(netLiquiditySeries, netLiquidity);
    
    // Higher net liquidity = lower risk (invert percentile)
    const score = riskFromPercentile(percentile, { invert: true, k: 3 });
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "Fed Balance Sheet (WALCL)", value: `$${(latestWalcl / 1e12).toFixed(1)}T` },
        { label: "Reverse Repo (RRP)", value: `$${(latestRrp / 1e9).toFixed(0)}B` },
        { label: "Treasury General Account", value: `$${(latestTga / 1e9).toFixed(0)}B` },
        { label: "Net Liquidity", value: `$${(netLiquidity / 1e12).toFixed(1)}T` },
        { label: "Liquidity Percentile (1y)", value: `${(percentile * 100).toFixed(0)}%` }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 4. STABLECOINS (CoinGecko data)
async function computeStablecoins() {
  try {
    const url = "https://api.coingecko.com/api/v3/coins/usd-coin/market_chart?vs_currency=usd&days=90&interval=daily";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    
    const data = await res.json();
    if (!data.market_caps || !Array.isArray(data.market_caps)) {
      return { score: null, reason: "no_market_cap_data" };
    }

    // Extract market cap values (oldest first)
    const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
    if (marketCaps.length < 30) {
      return { score: null, reason: "insufficient_stablecoin_data" };
    }

    // Calculate 30-day change
    const latest = marketCaps[marketCaps.length - 1];
    const thirtyDaysAgo = marketCaps[Math.max(0, marketCaps.length - 30)];
    const change = (latest - thirtyDaysAgo) / thirtyDaysAgo;

    // Create a series of 30-day changes for percentile ranking
    const changeSeries = [];
    for (let i = 30; i < marketCaps.length; i++) {
      const current = marketCaps[i];
      const past = marketCaps[i - 30];
      if (Number.isFinite(current) && Number.isFinite(past) && past !== 0) {
        changeSeries.push((current - past) / past);
      }
    }

    if (changeSeries.length === 0) {
      return { score: null, reason: "change_calculation_failed" };
    }

    const percentile = percentileRank(changeSeries, change);
    
    // Higher supply growth = lower risk (invert percentile)
    const score = riskFromPercentile(percentile, { invert: true, k: 3 });
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "USDC Market Cap", value: `$${(latest / 1e9).toFixed(1)}B` },
        { label: "30-day Change", value: `${(change * 100).toFixed(1)}%` },
        { label: "Supply Growth Percentile", value: `${(percentile * 100).toFixed(0)}%` },
        { label: "30-day Trend", value: change > 0.05 ? "Strong Growth" : change > 0 ? "Moderate Growth" : change > -0.05 ? "Stable" : "Declining" }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 5. ETF FLOWS (Farside Investors) - Enhanced implementation with caching
async function computeEtfFlows() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheDir = 'public/data/cache/etf';
    const cacheFile = `${cacheDir}/${today}.html`;
    
    // Try to read from cache first (if today's data exists)
    let html = "";
    let successfulUrl = "";
    let fromCache = false;
    
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(cacheFile)) {
        html = fs.readFileSync(cacheFile, 'utf8');
        fromCache = true;
        console.log(`ETF Flows: Using cached data from ${today}`);
      }
    } catch (error) {
      // Cache read failed, continue to live fetch
    }
    
    // If no cache, try live fetch
    if (!html) {
      const urls = [
        "https://farside.co.uk/bitcoin-etf-flow-all-data/",
        "https://farside.co.uk/bitcoin-etf-flow/",
        "https://farside.co.uk/etf-flows/",
        "https://farside.co.uk/etf-flows/btc"
      ];
      
      for (const url of urls) {
        try {
          const res = await fetch(url, { 
            headers: { 
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache"
            }
          });
          if (res.ok) {
            html = await res.text();
            successfulUrl = url;
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // Save to cache if we got live data
      if (html && !fromCache) {
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cacheFile, html, 'utf8');
          console.log(`ETF Flows: Saved live data to cache ${cacheFile}`);
        } catch (error) {
          console.warn('ETF Flows: Failed to save to cache:', error.message);
        }
      }
    }
    
    if (!html) {
      return { score: null, reason: "farside_unavailable" };
    }
    
    // Parse ETF flows from HTML with schema validation
    const parseResult = parseEtfFlowsFromHtml(html);
    const flows = parseResult.flows;
    const schemaHash = parseResult.schemaHash;
    
    if (flows.length === 0) {
      return { score: null, reason: "no_etf_data_parsed" };
    }
    
    // Schema tripwire - check if format changed
    const schemaChanged = await checkSchemaTripwire(schemaHash);
    if (schemaChanged) {
      console.warn(`ETF Flows: Schema change detected (hash: ${schemaHash}). Using cached data if available.`);
    }
    
    // Calculate 21-day rolling sum
    const flows21d = calculate21DayRollingSum(flows);
    
    if (flows21d.length === 0) {
      return { score: null, reason: "insufficient_data_for_21d_calculation" };
    }
    
    // Check staleness - if latest data is > 5 days old, mark as stale
    const latestDate = new Date(flows[flows.length - 1].date);
    const daysSinceUpdate = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
    const isStale = daysSinceUpdate > 5;
    
    // Get latest 21-day sum and calculate percentile
    const latest21d = flows21d[flows21d.length - 1];
    const percentile = percentileRank(flows21d, latest21d);
    
    // Z-score tripwire: check if latest 21-day sum is > 4σ from historical mean
    const mean21d = flows21d.reduce((sum, val) => sum + val, 0) / flows21d.length;
    const variance21d = flows21d.reduce((sum, val) => sum + Math.pow(val - mean21d, 2), 0) / flows21d.length;
    const stdDev21d = Math.sqrt(variance21d);
    const zScore21d = stdDev21d > 0 ? (latest21d - mean21d) / stdDev21d : 0;
    
    const isExtremeChange = Math.abs(zScore21d) > 4;
    if (isExtremeChange) {
      console.warn(`ETF Flows: Extreme 21-day sum change detected (z-score: ${zScore21d.toFixed(2)}). Latest: $${latest21d.toLocaleString()}, Mean: $${mean21d.toLocaleString()}, StdDev: $${stdDev21d.toLocaleString()}`);
    }
    
    // Higher inflows = lower risk (invert percentile)
    const score = riskFromPercentile(percentile, { invert: true, k: 3 });
    
    // Format details with explicit units and tooltips
    const latestFlow = flows[flows.length - 1];
    const totalFlows = flows.reduce((sum, f) => sum + f.flow, 0);
    
    return { 
      score: isStale ? null : score, 
      reason: isStale ? "stale_data" : "success",
      details: [
        { 
          label: "Latest Daily Flow", 
          value: formatCurrencyWithTooltip(latestFlow.flow),
          tooltip: `Exact: $${latestFlow.flow.toLocaleString()} (${latestFlow.date})`
        },
        { 
          label: "21-day Rolling Sum", 
          value: formatCurrencyWithTooltip(latest21d),
          tooltip: `Exact: $${latest21d.toLocaleString()} (21-day momentum)`
        },
        { label: "21-day Percentile", value: `${(percentile * 100).toFixed(0)}%` },
        { 
          label: "21-day Z-Score", 
          value: `${zScore21d.toFixed(2)}σ`,
          tooltip: isExtremeChange ? `EXTREME: ${zScore21d.toFixed(2)}σ from mean (${mean21d.toLocaleString()})` : `Normal: ${zScore21d.toFixed(2)}σ from mean`
        },
        { 
          label: "Total Flows (all time)", 
          value: formatCurrencyWithTooltip(totalFlows),
          tooltip: `Exact: $${totalFlows.toLocaleString()} (since ETF inception)`
        },
        { label: "Data Points", value: flows.length.toString() },
        { label: "Last Update", value: `${daysSinceUpdate.toFixed(1)} days ago` },
        { label: "Source", value: "Farside Investors" },
        { label: "Data Source", value: fromCache ? "Cache" : "Live" }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// Helper function to parse ETF flows from HTML
function parseEtfFlowsFromHtml(html) {
  const flows = [];
  
  // Look for data tables
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let dataTable = null;
  
  // Find the table with actual ETF flow data
  for (const match of tableMatches) {
    if (match.includes('2024-') || match.includes('2025-') || match.includes('Date') || match.includes('Total')) {
      dataTable = match;
      break;
    }
  }
  
  if (!dataTable) return { flows: [], schemaHash: null };
  
  // Parse table rows
  const rows = dataTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellText = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').trim();
  
  const parsed = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => cellText(m[2]));
    if (cells.length) parsed.push(cells);
  }
  
  if (parsed.length < 2) return { flows: [], schemaHash: null };
  
  // Find date and flow columns
  const header = parsed[0].map(h => h.toLowerCase());
  const dateCol = 0; // Usually first column
  const hasTotalCol = header.some(h => h.includes('total'));
  
  // Generate schema hash for tripwire
  const schemaHash = generateSchemaHash(header);
  
  // Determine scale (millions, billions, etc.)
  const hdr = header.join(' ');
  const scale = /\$bn|us\$bn/i.test(hdr) ? 1e9 :
                /\$m|us\$m|\(us\$m\)|\(\$m\)/i.test(hdr) ? 1e6 : 1;
  
  // Parse data rows
  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i];
    const dateRaw = (cells[dateCol] || '').trim();
    const date = parseDate(dateRaw);
    
    if (!date) continue; // Skip non-date rows
    
    let flow = NaN;
    
    // Try to find total flow column first
    if (hasTotalCol) {
      const idx = header.findIndex(h => h.includes('total'));
      const v = parseNumber(cells[idx]);
      if (Number.isFinite(v)) flow = v * scale;
    }
    
    // If no total column, sum all numeric columns
    if (!Number.isFinite(flow)) {
      let sum = 0;
      let hasData = false;
      for (let c = 1; c < cells.length; c++) {
        const v = parseNumber(cells[c]);
        if (Number.isFinite(v)) {
          sum += v;
          hasData = true;
        }
      }
      if (hasData) flow = sum * scale;
    }
    
    if (Number.isFinite(flow)) {
      flows.push({ date, flow });
    }
  }
  
  // Sort by date and deduplicate
  flows.sort((a, b) => a.date.localeCompare(b.date));
  const unique = new Map();
  for (const f of flows) {
    unique.set(f.date, f);
  }
  
  return { flows: Array.from(unique.values()), schemaHash };
}

// Helper function to parse dates in various formats
function parseDate(s) {
  const cleaned = s.trim().replace(/\s+/g, ' ');
  
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  
  // DD Mon YYYY (e.g., 11 Jan 2024)
  const m1 = cleaned.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (m1) {
    const [, d, mon, y] = m1;
    const mm = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    return `${y}-${mm[mon.toLowerCase()]}-${d.padStart(2,'0')}`;
  }
  
  // MM/DD/YYYY or DD/MM/YYYY
  const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const [, a, b, y] = m2;
    const A = parseInt(a,10), B = parseInt(b,10);
    // Default to MM/DD/YYYY (US format)
    return `${y}-${String(A).padStart(2,'0')}-${String(B).padStart(2,'0')}`;
  }
  
  return null;
}

// Helper function to parse numbers from strings
function parseNumber(s) {
  if (s == null) return NaN;
  const cleaned = String(s).replace(/[\s,$]/g, '').replace(/[–—−]/g, '-').replace(/\(([^)]+)\)/, '-$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Helper function to calculate 21-day rolling sum
function calculate21DayRollingSum(flows) {
  const sums = [];
  const flowsArray = flows.map(f => f.flow);
  
  for (let i = 0; i < flowsArray.length; i++) {
    if (i < 20) {
      sums.push(NaN); // Not enough data for 21-day sum
    } else {
      const sum = flowsArray.slice(i - 20, i + 1).reduce((a, b) => a + b, 0);
      sums.push(sum);
    }
  }
  
  return sums.filter(Number.isFinite);
}

// Helper function to format currency
function formatCurrency(amount) {
  if (!Number.isFinite(amount)) return "—";
  
  if (Math.abs(amount) >= 1e9) {
    return `$${(amount / 1e9).toFixed(1)}B`;
  } else if (Math.abs(amount) >= 1e6) {
    return `$${(amount / 1e6).toFixed(1)}M`;
  } else if (Math.abs(amount) >= 1e3) {
    return `$${(amount / 1e3).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

// Helper function to format currency with tooltip support
function formatCurrencyWithTooltip(amount) {
  if (!Number.isFinite(amount)) return "—";
  
  if (Math.abs(amount) >= 1e9) {
    return `$${(amount / 1e9).toFixed(1)}B`;
  } else if (Math.abs(amount) >= 1e6) {
    return `$${(amount / 1e6).toFixed(1)}M`;
  } else if (Math.abs(amount) >= 1e3) {
    return `$${(amount / 1e3).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

// Helper function to generate schema hash for tripwire
function generateSchemaHash(headers) {
  const headerString = headers.join(',');
  // Simple hash function (in production, you might want to use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < headerString.length; i++) {
    const char = headerString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// Helper function to check schema tripwire
async function checkSchemaTripwire(currentHash) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const statusPath = path.join(process.cwd(), 'public', 'data', 'status.json');
    let lastHash = null;
    
    if (fs.existsSync(statusPath)) {
      const statusContent = fs.readFileSync(statusPath, 'utf8');
      const status = JSON.parse(statusContent);
      lastHash = status.etf_schema_hash;
    }
    
    // Store current hash in status
    if (fs.existsSync(statusPath)) {
      const statusContent = fs.readFileSync(statusPath, 'utf8');
      const status = JSON.parse(statusContent);
      status.etf_schema_hash = currentHash;
      status.etf_schema_last_check = new Date().toISOString();
      fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    }
    
    return lastHash && lastHash !== currentHash;
  } catch (error) {
    console.warn('ETF Flows: Could not check schema tripwire:', error.message);
    return false;
  }
}

// Helper function to clean old cache files
async function cleanOldCacheFiles() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const cacheDir = 'public/data/cache/etf';
    if (!fs.existsSync(cacheDir)) return;
    
    const files = fs.readdirSync(cacheDir);
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    let cleaned = 0;
    
    for (const file of files) {
      if (file.endsWith('.html')) {
        const filePath = path.join(cacheDir, file);
        const stats = fs.statSync(filePath);
        const age = now.getTime() - stats.mtime.getTime();
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`ETF Flows: Cleaned ${cleaned} old cache files`);
    }
  } catch (error) {
    console.warn('ETF Flows: Could not clean cache files:', error.message);
  }
}

// 6. TERM LEVERAGE (BitMEX funding rates)
async function computeTermLeverage() {
  try {
    // BitMEX provides funding rate data via their public API
    const url = "https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true";
    const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
    if (!res.ok) throw new Error(`BitMEX ${res.status}`);
    
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { score: null, reason: "no_funding_data" };
    }
    
    // Extract funding rates (as percentages)
    const fundingRates = data.map(item => Number(item.fundingRate) * 100).filter(Number.isFinite);
    if (fundingRates.length === 0) {
      return { score: null, reason: "no_valid_funding_rates" };
    }
    
    // Calculate average funding rate over the period
    const avgFunding = fundingRates.reduce((sum, rate) => sum + rate, 0) / fundingRates.length;
    
    // Higher funding rates = higher leverage = higher risk
    // Convert to risk score (0-100)
    let score;
    if (avgFunding > 0.1) score = 80; // High leverage
    else if (avgFunding > 0.05) score = 60; // Moderate leverage
    else if (avgFunding > 0) score = 40; // Low leverage
    else score = 20; // Negative funding (bearish sentiment)
    
    const latestFunding = fundingRates[fundingRates.length - 1];
    const maxFunding = Math.max(...fundingRates);
    const minFunding = Math.min(...fundingRates);
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "Current Funding Rate", value: `${latestFunding.toFixed(4)}%` },
        { label: "30-day Average", value: `${avgFunding.toFixed(4)}%` },
        { label: "30-day Range", value: `${minFunding.toFixed(4)}% - ${maxFunding.toFixed(4)}%` },
        { label: "Leverage Level", value: avgFunding > 0.1 ? "High" : avgFunding > 0.05 ? "Moderate" : avgFunding > 0 ? "Low" : "Negative" }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 7. ON-CHAIN ACTIVITY (blockchain.info)
async function computeOnchain() {
  try {
    // Fetch transaction fees data from blockchain.info
    const url = "https://api.blockchain.info/charts/transaction-fees?timespan=30days&format=json";
    const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
    if (!res.ok) throw new Error(`Blockchain.info ${res.status}`);
    
    const data = await res.json();
    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return { score: null, reason: "no_fee_data" };
    }
    
    // Extract fee values (in USD)
    const fees = data.values.map(item => Number(item.y)).filter(Number.isFinite);
    if (fees.length === 0) {
      return { score: null, reason: "no_valid_fee_data" };
    }
    
    // Calculate average fee over the period
    const avgFee = fees.reduce((sum, fee) => sum + fee, 0) / fees.length;
    const latestFee = fees[fees.length - 1];
    
    // Higher fees = higher network activity = potentially higher risk (speculation)
    // Use percentile ranking for more sophisticated scoring
    const percentile = percentileRank(fees, latestFee);
    const score = riskFromPercentile(percentile, { invert: false, k: 3 });
    
    const maxFee = Math.max(...fees);
    const minFee = Math.min(...fees);
    
    return { 
      score, 
      reason: "success",
      details: [
        { label: "Current Transaction Fees", value: `$${latestFee.toFixed(0)}` },
        { label: "30-day Average", value: `$${avgFee.toFixed(0)}` },
        { label: "30-day Range", value: `$${minFee.toFixed(0)} - $${maxFee.toFixed(0)}` },
        { label: "Activity Percentile", value: `${(percentile * 100).toFixed(0)}%` },
        { label: "Network Activity", value: percentile > 0.8 ? "High" : percentile > 0.5 ? "Moderate" : "Low" }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 8. MACRO OVERLAY (FRED data)
async function computeMacroOverlay() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { score: null, reason: "missing_fred_api_key" };
  }

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    // Fetch DXY (Dollar Index), 2Y Yield, and VIX
    const [dxyRes, dgs2Res, vixRes] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=d&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=d&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=d&aggregation_method=avg`)
    ]);

    if (!dxyRes.ok || !dgs2Res.ok || !vixRes.ok) {
      return { score: null, reason: "fred_api_error" };
    }

    const [dxyData, dgs2Data, vixData] = await Promise.all([
      dxyRes.json(),
      dgs2Res.json(),
      vixRes.json()
    ]);

    // Extract values
    const dxyValues = dxyData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const dgs2Values = dgs2Data.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const vixValues = vixData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];

    if (dxyValues.length === 0 || dgs2Values.length === 0 || vixValues.length === 0) {
      return { score: null, reason: "insufficient_macro_data" };
    }

    // Calculate 20-day percentage changes
    const dxy20dChange = dxyValues.length >= 20 ? 
      (dxyValues[dxyValues.length - 1] - dxyValues[dxyValues.length - 20]) / dxyValues[dxyValues.length - 20] : 0;
    const dgs2_20dChange = dgs2Values.length >= 20 ? 
      (dgs2Values[dgs2Values.length - 1] - dgs2Values[dgs2Values.length - 20]) / dgs2Values[dgs2Values.length - 20] : 0;
    
    // VIX percentile
    const vixPercentile = percentileRank(vixValues, vixValues[vixValues.length - 1]);

    // Convert to risk scores
    const dxyRisk = Math.min(100, Math.max(0, 50 + (dxy20dChange * 1000))); // Stronger dollar = higher risk
    const dgs2Risk = Math.min(100, Math.max(0, 50 + (dgs2_20dChange * 1000))); // Higher yields = higher risk
    const vixRisk = vixPercentile * 100; // Higher VIX = higher risk

    // Average the three components
    const score = Math.round((dxyRisk + dgs2Risk + vixRisk) / 3);

    const latestDxy = dxyValues[dxyValues.length - 1];
    const latestDgs2 = dgs2Values[dgs2Values.length - 1];
    const latestVix = vixValues[vixValues.length - 1];

    return { 
      score, 
      reason: "success",
      details: [
        { label: "DXY 20d Δ", value: `${(dxy20dChange * 100).toFixed(1)}%` },
        { label: "US2Y 20d Δ", value: `${(dgs2_20dChange * 100).toFixed(1)}%` },
        { label: "VIX pctile", value: `${(vixPercentile * 100).toFixed(0)}%` },
        { label: "Current DXY", value: latestDxy.toFixed(1) },
        { label: "Current 2Y Yield", value: `${latestDgs2.toFixed(2)}%` },
        { label: "Current VIX", value: latestVix.toFixed(1) }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// ============================================================================
// MAIN COMPUTE FUNCTION
// ============================================================================

export async function computeAllFactors() {
  console.log("Computing risk factors...");
  
  const results = await Promise.allSettled([
    computeTrendValuation(),
    computeNetLiquidity(),
    computeStablecoins(),
    computeEtfFlows(),
    computeTermLeverage(),
    computeOnchain(),
    computeSocialInterest(),
    computeMacroOverlay()
  ]);

  const factors = [
    { key: 'trend_valuation', label: 'Trend & Valuation', pillar: 'momentum', weight: 25 },
    { key: 'net_liquidity', label: 'Net Liquidity (FRED)', pillar: 'liquidity', weight: 10 },
    { key: 'stablecoins', label: 'Stablecoins', pillar: 'liquidity', weight: 15 },
    { key: 'etf_flows', label: 'ETF Flows', pillar: 'liquidity', weight: 10 },
    { key: 'term_leverage', label: 'Term Structure & Leverage', pillar: 'leverage', weight: 20 },
    { key: 'onchain', label: 'On-chain Activity', pillar: 'social', weight: 10, counts_toward: 'momentum' },
    { key: 'social_interest', label: 'Social Interest', pillar: 'social', weight: 5 },
    { key: 'macro_overlay', label: 'Macro Overlay', pillar: 'macro', weight: 5 }
  ];

  const factorResults = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < factors.length; i++) {
    const factor = factors[i];
    const result = results[i];
    
    let score = null;
    let status = 'excluded';
    let reason = 'unknown';

    if (result.status === 'fulfilled') {
      const data = result.value;
      score = data.score;
      reason = data.reason;
      
      if (score !== null && Number.isFinite(score)) {
        status = 'fresh';
        totalWeight += factor.weight;
        weightedSum += (factor.weight * score);
      } else {
        status = 'excluded';
      }
    } else {
      reason = `promise_rejected: ${result.reason}`;
      status = 'excluded';
    }

    factorResults.push({
      key: factor.key,
      label: factor.label,
      pillar: factor.pillar,
      weight: factor.weight,
      score,
      status,
      reason,
      details: result.status === 'fulfilled' ? result.value.details : undefined
    });

    console.log(`${factor.key}: ${score !== null ? score : 'null'} (${status}) - ${reason}`);
  }

  // Calculate composite score
  const composite = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 47; // fallback to 47

  return {
    factors: factorResults,
    composite,
    totalWeight,
    weightedSum
  };
}

// Export additional functions for use in other modules
export { cleanOldCacheFiles };
