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

import { coinGecko } from './coinGeckoCache.mjs';

// 1. TREND & VALUATION (Multi-factor: BMSB 60%, Mayer 30%, RSI 10%)
// Import the new implementation with true BMSB and unified Coinbase price source
import { computeTrendValuation as computeTrendValuationNew } from './factors/trendValuation.mjs';

async function computeTrendValuation(dailyClose = null) {
  return await computeTrendValuationNew(dailyClose);
}

// 2. SOCIAL INTEREST (Search trends and social sentiment)
async function computeSocialInterest() {
  try {
    // Use centralized CoinGecko client with caching and rate limiting
    const [trendsData, priceData] = await Promise.all([
      coinGecko.getTrending().catch(() => null),
      coinGecko.getMarketChart(30, 'daily').catch(() => null)
    ]);

    // Multi-factor analysis using available data
    // 1. Search Attention (40% weight) - Bitcoin trending rank
    let searchScore = 50; // neutral default
    let bitcoinRank = "N/A";
    let searchAttention = "Low";
    
    if (trendsData?.coins && Array.isArray(trendsData.coins)) {
      const bitcoinTrending = trendsData.coins.find(coin => 
        coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
      );
      
      if (bitcoinTrending) {
        const rank = trendsData.coins.indexOf(bitcoinTrending) + 1;
        bitcoinRank = `#${rank}`;
        
        // Convert rank to risk score (higher rank = higher attention = higher risk)
        if (rank <= 3) {
          searchScore = 85;
          searchAttention = "Extreme";
        } else if (rank <= 7) {
          searchScore = 70;
          searchAttention = "High";
        } else if (rank <= 15) {
          searchScore = 55;
          searchAttention = "Moderate";
        } else {
          searchScore = 35;
          searchAttention = "Low";
        }
      }
    }

    // 2. Price Momentum Social Signal (35% weight) - price-based sentiment proxy
    let momentumScore = 50; // neutral default
    let priceSignal = "Neutral";
    
    if (priceData?.prices && Array.isArray(priceData.prices) && priceData.prices.length >= 14) {
      const prices = priceData.prices.map(([timestamp, price]) => price).filter(Number.isFinite);
      
      if (prices.length >= 14) {
        // Calculate recent vs past performance (social sentiment proxy)
        const recent7d = prices.slice(-7);
        const previous7d = prices.slice(-14, -7);
        
        const recentAvg = recent7d.reduce((sum, price) => sum + price, 0) / recent7d.length;
        const previousAvg = previous7d.reduce((sum, price) => sum + price, 0) / previous7d.length;
        const priceChange = ((recentAvg - previousAvg) / previousAvg) * 100;
        
        // Build price change series for percentile ranking
        const changeSeries = [];
        for (let i = 14; i < prices.length; i++) {
          const recent = prices.slice(i-7, i);
          const previous = prices.slice(i-14, i-7);
          const rAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
          const pAvg = previous.reduce((sum, p) => sum + p, 0) / previous.length;
          const change = ((rAvg - pAvg) / pAvg) * 100;
          if (Number.isFinite(change)) changeSeries.push(change);
        }
        
        if (changeSeries.length > 0) {
          const changePercentile = percentileRank(changeSeries, priceChange);
          momentumScore = riskFromPercentile(changePercentile, { invert: false, k: 3 });
        }
        
        // Determine price signal
        if (priceChange > 10) priceSignal = "Strong Bullish";
        else if (priceChange > 3) priceSignal = "Bullish";
        else if (priceChange > -3) priceSignal = "Neutral";
        else if (priceChange > -10) priceSignal = "Bearish";
        else priceSignal = "Strong Bearish";
      }
    }

    // 3. Volatility Social Signal (25% weight) - price volatility as attention proxy
    let volatilityScore = 50; // neutral default
    let volatilityLevel = "Normal";
    
    if (priceData?.prices && Array.isArray(priceData.prices) && priceData.prices.length >= 14) {
      const prices = priceData.prices.map(([timestamp, price]) => price).filter(Number.isFinite);
      
      if (prices.length >= 14) {
        // Calculate 14-day price volatility
        const returns = [];
        for (let i = 1; i < Math.min(prices.length, 14); i++) {
          const return_ = (prices[i] - prices[i-1]) / prices[i-1];
          if (Number.isFinite(return_)) returns.push(return_);
        }
        
        if (returns.length > 0) {
          const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r*r, 0) / returns.length) * 100;
          
          // Build volatility series for percentile ranking
          const volSeries = [];
          for (let i = 14; i < prices.length; i++) {
            const subset = prices.slice(i-14, i);
            const rets = [];
            for (let j = 1; j < subset.length; j++) {
              const ret = (subset[j] - subset[j-1]) / subset[j-1];
              if (Number.isFinite(ret)) rets.push(ret);
            }
            if (rets.length > 0) {
              const vol = Math.sqrt(rets.reduce((sum, r) => sum + r*r, 0) / rets.length) * 100;
              volSeries.push(vol);
            }
          }
          
          if (volSeries.length > 0) {
            const volPercentile = percentileRank(volSeries, volatility);
            volatilityScore = riskFromPercentile(volPercentile, { invert: false, k: 3 });
          }
          
          // Determine volatility level
          if (volatility > 8) volatilityLevel = "Extreme";
          else if (volatility > 5) volatilityLevel = "High";
          else if (volatility > 2) volatilityLevel = "Moderate";
          else volatilityLevel = "Low";
        }
      }
    }

    // Composite score (weighted blend) - BMSB-dominant Trend & Valuation
    const compositeScore = Math.round(
      searchScore * 0.70 + 
      momentumScore * 0.30 + 
      volatilityScore * 0.00  // Parked for now
    );
    
    return { 
      score: compositeScore, 
      reason: "success",
      lastUpdated: new Date().toISOString(),
      details: [
        { label: "Search Attention", value: searchAttention },
        { label: "Bitcoin Trending Rank", value: bitcoinRank },
        { label: "Price Signal (7d)", value: priceSignal },
        { label: "Volatility Level (14d)", value: volatilityLevel },
        { label: "Social Risk Level", value: compositeScore > 70 ? "High" : compositeScore > 50 ? "Moderate" : "Low" },
        { label: "Component Scores", value: `Search: ${searchScore}, Momentum: ${momentumScore}, Vol: ${volatilityScore}` },
        { label: "Data Source", value: "CoinGecko trends + price analysis" }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// Cache configuration for Net Liquidity
const NET_LIQUIDITY_CACHE_DIR = 'public/data/cache/net_liquidity';
const NET_LIQUIDITY_CACHE_TTL_HOURS = 24; // 24 hours cache for FRED data
const NET_LIQUIDITY_CACHE_FILE = 'net_liquidity_cache.json';

/**
 * Load cached Net Liquidity data
 */
async function loadNetLiquidityCache() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cachePath = path.join(NET_LIQUIDITY_CACHE_DIR, NET_LIQUIDITY_CACHE_FILE);
    const cacheData = await fs.readFile(cachePath, { encoding: 'utf8' });
    const parsed = JSON.parse(cacheData);
    
    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(parsed.cachedAt).getTime();
    const maxAge = NET_LIQUIDITY_CACHE_TTL_HOURS * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      console.log(`Net Liquidity: Using cached data (${Math.round(cacheAge / (60 * 1000))} minutes old)`);
      return parsed;
    } else {
      console.log(`Net Liquidity: Cache expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`);
      return null;
    }
  } catch (error) {
    console.log(`Net Liquidity: No valid cache found: ${error.message}`);
    return null;
  }
}

/**
 * Save Net Liquidity data to cache
 */
async function saveNetLiquidityCache(data) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    await fs.mkdir(NET_LIQUIDITY_CACHE_DIR, { recursive: true });
    const cachePath = path.join(NET_LIQUIDITY_CACHE_DIR, NET_LIQUIDITY_CACHE_FILE);
    
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), { encoding: 'utf8' });
    console.log(`Net Liquidity: Cached data saved to ${cachePath}`);
  } catch (error) {
    console.warn(`Net Liquidity: Failed to save cache: ${error.message}`);
  }
}

/**
 * Check if FRED data has changed since last cache
 */
function hasFredDataChanged(currentData, cachedData) {
  if (!cachedData || !cachedData.latestWalclDate) {
    return true;
  }
  
  // Check if latest observation date has changed
  return currentData.latestWalclDate !== cachedData.latestWalclDate;
}

/**
 * Fetch FRED data with enhanced error handling and retry logic
 */
async function fetchFredDataWithRetry(seriesId, apiKey, startISO, endISO, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'btc-risk-dashboard' },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        if (attempt < maxRetries) {
          console.log(`Net Liquidity: FRED ${seriesId} attempt ${attempt} failed (${response.status}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
        throw new Error(`FRED API error for ${seriesId}: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Net Liquidity: FRED ${seriesId} fetched successfully (${data.observations?.length || 0} observations)`);
      return data;
    } catch (error) {
      if (attempt === maxRetries) {
        console.log(`Net Liquidity: FRED ${seriesId} failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      console.log(`Net Liquidity: FRED ${seriesId} attempt ${attempt} failed: ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// 3. NET LIQUIDITY (FRED data - requires API key)
// Enhanced with caching, retry logic, and incremental updates
async function computeNetLiquidity() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { score: null, reason: "missing_fred_api_key" };
  }

  try {
    // Check for cached data first
    const cachedData = await loadNetLiquidityCache();

    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    // 🚀 ENHANCED FRED FETCHING: Use retry logic and parallel processing
    console.log('Net Liquidity: Fetching FRED data with retry logic...');
    const startTime = Date.now();
    
    const [walclData, rrpData, tgaData] = await Promise.all([
      fetchFredDataWithRetry('WALCL', apiKey, startISO, endISO),
      fetchFredDataWithRetry('RRPONTSYD', apiKey, startISO, endISO),
      fetchFredDataWithRetry('WTREGEN', apiKey, startISO, endISO)
    ]);
    
    const fetchTime = Date.now() - startTime;
    console.log(`Net Liquidity: FRED data fetched in ${fetchTime}ms`);

    // Check if we can use cached data (incremental update)
    const latestWalclDate = walclData.observations?.length > 0 ? 
      walclData.observations[walclData.observations.length - 1].date : null;
    
    const dataChanged = hasFredDataChanged({ latestWalclDate }, cachedData);
    
    if (cachedData && !dataChanged) {
      console.log('Net Liquidity: Using cached calculations (no FRED data changes)');
      return {
        score: cachedData.score,
        reason: "success_cached",
        lastUpdated: cachedData.lastUpdated,
        details: cachedData.details
      };
    }

    console.log('Net Liquidity: Computing fresh calculations (FRED data changed or no cache)');

    // Extract values and calculate net liquidity time series
    // FRED API returns values in millions, so we need to convert them
    const walclObservations = walclData.observations || [];
    const walclValues = walclObservations.map(o => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null; // Convert millions to actual dollars
    }).filter(Number.isFinite) || [];
    
    // Get the latest observation date for staleness detection (already declared above)
    // const latestWalclDate = walclObservations.length > 0 ? walclObservations[walclObservations.length - 1].date : null;
    
    const rrpValues = rrpData.observations?.map(o => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null; // Convert millions to actual dollars
    }).filter(Number.isFinite) || [];
    
    const tgaValues = tgaData.observations?.map(o => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null; // Convert millions to actual dollars
    }).filter(Number.isFinite) || [];

    if (walclValues.length === 0 || tgaValues.length === 0) {
      return { score: null, reason: "insufficient_fred_data" };
    }
    
    // RRP might have no data (common), so we'll use 0 as default
    if (rrpValues.length === 0) {
      console.warn('Net Liquidity: No RRP data available, using 0');
    }

    // Build complete net liquidity time series
    const netLiquiditySeries = [];
    const minLength = Math.min(walclValues.length, tgaValues.length);
    for (let i = 0; i < minLength; i++) {
      const rrpValue = i < rrpValues.length ? rrpValues[i] : 0;
      const nl = walclValues[i] - rrpValue - tgaValues[i];
      if (Number.isFinite(nl)) netLiquiditySeries.push(nl);
    }

    if (netLiquiditySeries.length < 8) { // Need at least 8 weeks for momentum
      return { score: null, reason: "insufficient_data_for_analysis" };
    }

    // Multi-factor analysis
    const latest = netLiquiditySeries[netLiquiditySeries.length - 1];
    const latestWalcl = walclValues[walclValues.length - 1];
    const latestRrp = rrpValues.length > 0 ? rrpValues[rrpValues.length - 1] : 0;
    const latestTga = tgaValues[tgaValues.length - 1];

    // 1. Absolute Level (30% weight)
    const levelPercentile = percentileRank(netLiquiditySeries, latest);
    const levelScore = riskFromPercentile(levelPercentile, { invert: true, k: 3 });

    // 2. 4-week Rate of Change (40% weight) - more predictive
    const fourWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 5] || netLiquiditySeries[0];
    const roc4w = ((latest - fourWeeksAgo) / Math.abs(fourWeeksAgo)) * 100;
    
    // Build RoC series for percentile ranking
    const rocSeries = [];
    for (let i = 4; i < netLiquiditySeries.length; i++) {
      const current = netLiquiditySeries[i];
      const past = netLiquiditySeries[i - 4];
      const roc = ((current - past) / Math.abs(past)) * 100;
      if (Number.isFinite(roc)) rocSeries.push(roc);
    }
    
    const rocPercentile = rocSeries.length > 0 ? percentileRank(rocSeries, roc4w) : 0.5;
    const rocScore = riskFromPercentile(rocPercentile, { invert: true, k: 3 }); // Higher growth = lower risk

    // 3. 12-week Momentum/Acceleration (30% weight) - trend strength
    let momentumScore = 50; // neutral default
    if (netLiquiditySeries.length >= 12) {
      const twelveWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 13];
      const eightWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 9];
      
      const recentSlope = (latest - eightWeeksAgo) / 4; // per week
      const pastSlope = (eightWeeksAgo - twelveWeeksAgo) / 4; // per week
      const acceleration = recentSlope - pastSlope;
      
      // Build acceleration series
      const accelSeries = [];
      for (let i = 12; i < netLiquiditySeries.length; i++) {
        const curr = netLiquiditySeries[i];
        const mid = netLiquiditySeries[i - 4];
        const past = netLiquiditySeries[i - 8];
        const recentSlp = (curr - mid) / 4;
        const pastSlp = (mid - past) / 4;
        const accel = recentSlp - pastSlp;
        if (Number.isFinite(accel)) accelSeries.push(accel);
      }
      
      if (accelSeries.length > 0) {
        const accelPercentile = percentileRank(accelSeries, acceleration);
        momentumScore = riskFromPercentile(accelPercentile, { invert: true, k: 3 });
      }
    }

    // Composite score (weighted blend)
    const compositeScore = Math.round(
      levelScore * 0.15 + 
      rocScore * 0.40 + 
      momentumScore * 0.45
    );
    
    const result = { 
      score: compositeScore, 
      reason: "success",
      lastUpdated: latestWalclDate ? `${latestWalclDate}T00:00:00.000Z` : new Date().toISOString(),
      details: [
        { label: "Fed Balance Sheet (WALCL)", value: `$${(latestWalcl / 1e12).toFixed(1)}T` },
        { label: "Reverse Repo (RRP)", value: rrpValues.length > 0 ? `$${(latestRrp / 1e9).toFixed(0)}B` : "No data" },
        { label: "Treasury General Account", value: `$${(latestTga / 1e9).toFixed(0)}B` },
        { label: "Net Liquidity", value: `$${(latest / 1e12).toFixed(1)}T` },
        { label: "4-week Change", value: `${roc4w >= 0 ? '+' : ''}${roc4w.toFixed(1)}%` },
        { label: "Level Percentile (1y)", value: `${(levelPercentile * 100).toFixed(0)}%` },
        { label: "Fetch Time", value: `${fetchTime}ms` },
        { label: "Component Scores", value: `Level: ${levelScore}, RoC: ${rocScore}, Momentum: ${momentumScore}` },
        { label: "Data as of", value: latestWalclDate || "Unknown" }
      ],
      latestWalclDate, // Include for cache comparison
      fetchTime // Include timing info
    };

    // Save to cache for future use
    await saveNetLiquidityCache(result);

    return result;
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// Helper function to calculate weighted average of all stablecoins
function calculateWeightedStablecoinChanges(responses, stablecoins) {
  const weightedChanges = [];
  
  // Process each stablecoin's data
  const coinData = [];
  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    const coin = stablecoins[i];
    
    if (response?.market_caps) {
      const marketCaps = response.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
      coinData.push({
        symbol: coin.symbol,
        weight: coin.weight,
        marketCaps: marketCaps
      });
    }
  }
  
  if (coinData.length === 0) return [];
  
  // Calculate 30-day changes for each coin
  const coinChanges = [];
  for (const coin of coinData) {
    const changes = [];
    for (let i = 30; i < coin.marketCaps.length; i++) {
      const current = coin.marketCaps[i];
      const past = coin.marketCaps[i - 30];
      if (Number.isFinite(current) && Number.isFinite(past) && past !== 0) {
        changes.push((current - past) / past);
      }
    }
    coinChanges.push({
      symbol: coin.symbol,
      weight: coin.weight,
      changes: changes
    });
  }
  
  // Calculate weighted average for each time period
  const maxLength = Math.max(...coinChanges.map(c => c.changes.length));
  for (let i = 0; i < maxLength; i++) {
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const coin of coinChanges) {
      if (i < coin.changes.length && Number.isFinite(coin.changes[i])) {
        weightedSum += coin.changes[i] * coin.weight;
        totalWeight += coin.weight;
      }
    }
    
    if (totalWeight > 0) {
      weightedChanges.push(weightedSum / totalWeight);
    }
  }
  
  return weightedChanges;
}

// Helper functions for data format conversion
function convertCmcToCoinGeckoFormat(cmcData, symbol) {
  try {
    // CMC historical data format conversion
    const prices = [];
    const marketCaps = [];
    const totalVolumes = [];
    
    if (cmcData.data && cmcData.data.quotes) {
      cmcData.data.quotes.forEach(quote => {
        const timestamp = new Date(quote.timestamp).getTime();
        const price = quote.quote.USD.price;
        const marketCap = quote.quote.USD.market_cap;
        const volume = quote.quote.USD.volume_24h;
        
        prices.push([timestamp, price]);
        marketCaps.push([timestamp, marketCap]);
        totalVolumes.push([timestamp, volume]);
      });
    }
    
    return {
      prices: prices,
      market_caps: marketCaps,
      total_volumes: totalVolumes
    };
  } catch (error) {
    console.log(`Stablecoins: Error converting CMC data for ${symbol}: ${error.message}`);
    return null;
  }
}

function convertCryptoCompareToCoinGeckoFormat(ccData, symbol) {
  try {
    // CryptoCompare historical data format conversion
    const prices = [];
    const marketCaps = [];
    const totalVolumes = [];
    
    if (ccData.Data && ccData.Data.Data) {
      ccData.Data.Data.forEach(dataPoint => {
        const timestamp = dataPoint.time * 1000; // Convert to milliseconds
        const price = dataPoint.close;
        const marketCap = dataPoint.mktcap || 0;
        const volume = dataPoint.volumeto || 0;
        
        prices.push([timestamp, price]);
        marketCaps.push([timestamp, marketCap]);
        totalVolumes.push([timestamp, volume]);
      });
    }
    
    return {
      prices: prices,
      market_caps: marketCaps,
      total_volumes: totalVolumes
    };
  } catch (error) {
    console.log(`Stablecoins: Error converting CryptoCompare data for ${symbol}: ${error.message}`);
    return null;
  }
}

// 4. STABLECOINS (Multi-stablecoin analysis with 365-day historical baseline and incremental updates)
async function computeStablecoins() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheDir = 'public/data/cache/stablecoins';
    const cacheFile = `${cacheDir}/${today}.json`;
    const historicalFile = 'public/data/stablecoins-historical.json';
    
    // Load historical baseline for percentile calculation
    let historicalBaseline = null;
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(historicalFile)) {
        const historicalContent = fs.readFileSync(historicalFile, 'utf8');
        const historicalData = JSON.parse(historicalContent);
        historicalBaseline = historicalData;
        console.log(`Stablecoins: Using historical baseline with ${historicalData.changeSeries?.length || 0} data points`);
      }
    } catch (error) {
      console.warn('Stablecoins: Could not load historical baseline:', error.message);
    }

    // Try to read from cache first (if today's data exists)
    let cachedData = null;
    let fromCache = false;
    
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(cacheFile)) {
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        cachedData = JSON.parse(cacheContent);
        fromCache = true;
        console.log(`Stablecoins: Using cached data from ${today}`);
      }
    } catch (error) {
      // Cache read failed, continue to live fetch
    }
    
    // Define stablecoins array with expanded coverage and current market weights
    const stablecoins = [
      { id: 'tether', symbol: 'USDT', weight: 0.55, cmcId: '825' }, // Market leader (reduced from 65%)
      { id: 'usd-coin', symbol: 'USDC', weight: 0.25, cmcId: '3408' }, // Second largest (reduced from 28%)
      { id: 'dai', symbol: 'DAI', weight: 0.05, cmcId: '4943' }, // Decentralized option (reduced from 7%)
      { id: 'binance-usd', symbol: 'BUSD', weight: 0.03, cmcId: '4687' }, // Binance stablecoin
      { id: 'true-usd', symbol: 'TUSD', weight: 0.02, cmcId: '2563' }, // TrueUSD
      { id: 'frax', symbol: 'FRAX', weight: 0.02, cmcId: '6952' }, // Frax stablecoin
      { id: 'liquity-usd', symbol: 'LUSD', weight: 0.01, cmcId: '9566' } // Liquity USD
    ];

    // If no cache, fetch live data with parallel processing
    let responses = [];
    if (!cachedData) {
      console.log(`Stablecoins: Fetching live data with parallel processing...`);

      // Process all stablecoins in parallel with fallback data sources
      const fetchPromises = stablecoins.map(async (coin, index) => {
        try {
          // Add staggered delays to avoid rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, index * 2000)); // 2s stagger
          }
          
          // Try multiple data sources with fallback chain
          let coinData = null;
          let dataSource = null;
          
          // Source 1: CoinGecko (primary) - Only fetch 30 days for incremental updates
          try {
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30&interval=daily`);
            
            if (response.ok) {
              coinData = await response.json();
              dataSource = 'CoinGecko';
              console.log(`Stablecoins: ${coin.symbol} data received from CoinGecko`);
            } else if (response.status === 429) {
              console.log(`Stablecoins: CoinGecko rate limited for ${coin.symbol}, trying fallback...`);
            } else {
              console.log(`Stablecoins: CoinGecko failed for ${coin.symbol}: ${response.status}, trying fallback...`);
            }
          } catch (error) {
            console.log(`Stablecoins: CoinGecko error for ${coin.symbol}: ${error.message}, trying fallback...`);
          }
          
          // Source 2: CoinMarketCap (fallback)
          if (!coinData) {
            try {
              const cmcResponse = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?id=${coin.cmcId || coin.id}&time_start=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&time_end=${new Date().toISOString()}`, {
                headers: {
                  'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY || '',
                  'Accept': 'application/json'
                }
              });
              
              if (cmcResponse.ok) {
                const cmcData = await cmcResponse.json();
                // Convert CMC format to CoinGecko format
                coinData = convertCmcToCoinGeckoFormat(cmcData, coin.symbol);
                dataSource = 'CoinMarketCap';
                console.log(`Stablecoins: ${coin.symbol} data received from CoinMarketCap`);
              } else {
                console.log(`Stablecoins: CoinMarketCap failed for ${coin.symbol}: ${cmcResponse.status}`);
              }
            } catch (error) {
              console.log(`Stablecoins: CoinMarketCap error for ${coin.symbol}: ${error.message}`);
            }
          }
          
          // Source 3: CryptoCompare (final fallback) - Only fetch 30 days
          if (!coinData) {
            try {
              const ccResponse = await fetch(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${coin.symbol}&tsym=USD&limit=30&api_key=${process.env.CRYPTOCOMPARE_API_KEY || ''}`);
              
              if (ccResponse.ok) {
                const ccData = await ccResponse.json();
                // Convert CryptoCompare format to CoinGecko format
                coinData = convertCryptoCompareToCoinGeckoFormat(ccData, coin.symbol);
                dataSource = 'CryptoCompare';
                console.log(`Stablecoins: ${coin.symbol} data received from CryptoCompare`);
              } else {
                console.log(`Stablecoins: CryptoCompare failed for ${coin.symbol}: ${ccResponse.status}`);
              }
            } catch (error) {
              console.log(`Stablecoins: CryptoCompare error for ${coin.symbol}: ${error.message}`);
            }
          }
          
          if (coinData) {
            console.log(`Stablecoins: ${coin.symbol} successfully fetched from ${dataSource}`);
            return coinData;
          } else {
            console.log(`Stablecoins: All data sources failed for ${coin.symbol}`);
            return null;
          }
        } catch (error) {
          console.log(`Stablecoins: Error fetching ${coin.symbol}: ${error.message}`);
          return null;
        }
      });

      // Wait for all parallel requests to complete
      responses = await Promise.all(fetchPromises);
      console.log(`Stablecoins: Completed parallel fetch for ${responses.filter(r => r !== null).length}/${stablecoins.length} coins`);
      
      // Save to cache if we got live data
      if (responses.length > 0 && !fromCache) {
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify(responses, null, 2), 'utf8');
          console.log(`Stablecoins: Saved live data to cache ${cacheFile}`);
        } catch (error) {
          console.warn('Stablecoins: Failed to save to cache:', error.message);
        }
      }
    } else {
      // Use cached data
      responses = cachedData;
    }
    
    let totalMarketCap = 0;
    let totalSupplyChange = 0;
    let totalWeightedChange = 0;
    let validCoins = 0;
    const coinData = [];

    // Process each stablecoin
    for (let i = 0; i < stablecoins.length; i++) {
      const coin = stablecoins[i];
      const data = responses[i];
      
      if (!data?.market_caps || !Array.isArray(data.market_caps) || data.market_caps.length < 30) {
        console.warn(`Stablecoins: No data for ${coin.symbol}`);
        continue;
      }

      const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
      if (marketCaps.length < 30) continue;

      const latest = marketCaps[marketCaps.length - 1];
      const thirtyDaysAgo = marketCaps[Math.max(0, marketCaps.length - 30)];
      const sevenDaysAgo = marketCaps[Math.max(0, marketCaps.length - 7)];
      
      const change30d = (latest - thirtyDaysAgo) / thirtyDaysAgo;
      const change7d = (latest - sevenDaysAgo) / sevenDaysAgo;

      coinData.push({
        symbol: coin.symbol,
        marketCap: latest,
        change30d: change30d,
        change7d: change7d,
        weight: coin.weight
      });

      totalMarketCap += latest;
      totalSupplyChange += change30d * coin.weight;
      totalWeightedChange += change30d * coin.weight;
      validCoins++;
    }

    if (validCoins === 0) {
      return { score: null, reason: "no_stablecoin_data" };
    }

    // Multi-factor analysis
    // 1. Aggregate Supply Growth (50% weight)
    const aggregateChange = totalWeightedChange; // Weighted by market share

    // 2. Supply Growth Momentum (30% weight) - 7d vs 30d trend
    const recentMomentum = coinData.reduce((sum, coin) => {
      const momentum = coin.change7d / Math.max(Math.abs(coin.change30d), 0.001); // Recent vs longer term
      return sum + momentum * coin.weight;
    }, 0);

    // 3. Market Concentration Risk (20% weight) - diversification
    const hhi = coinData.reduce((sum, coin) => {
      const marketShare = coin.marketCap / totalMarketCap;
      return sum + Math.pow(marketShare, 2);
    }, 0); // Herfindahl-Hirschman Index
    const concentrationScore = Math.min(hhi * 100, 100); // Higher = more concentrated = higher risk

    // Use historical baseline for percentile calculation (365-day window)
    let changeSeries = [];
    
    if (historicalBaseline?.changeSeries && historicalBaseline.changeSeries.length > 0) {
      // Use historical baseline for more accurate percentiles
      changeSeries = historicalBaseline.changeSeries;
      console.log(`Stablecoins: Using historical baseline with ${changeSeries.length} data points for percentile calculation`);
    } else {
      // Fallback: Build weighted average series from current data
      const weightedChanges = calculateWeightedStablecoinChanges(responses, stablecoins);
      changeSeries = weightedChanges;
      const weightInfo = stablecoins.map(coin => `${coin.symbol}: ${coin.weight}`).join(', ');
      console.log(`Stablecoins: Using weighted average fallback series with ${changeSeries.length} data points (${weightInfo})`);
    }

    if (changeSeries.length === 0) {
      return { score: null, reason: "percentile_calculation_failed" };
    }

    // Calculate component scores using historical baseline
    const supplyPercentile = percentileRank(changeSeries, aggregateChange);
    const supplyScore = riskFromPercentile(supplyPercentile, { invert: true, k: 3 });
    
    const momentumScore = recentMomentum > 1 ? 30 : recentMomentum > 0.5 ? 50 : 70; // Lower momentum = higher risk
    const concentrationRiskScore = concentrationScore; // Direct mapping

    // Composite score (weighted blend) - BMSB-dominant Trend & Valuation
    const compositeScore = Math.round(
      supplyScore * 0.55 + 
      momentumScore * 0.30 + 
      concentrationRiskScore * 0.15
    );
    
    // Update historical baseline with new data (365-day rolling window)
    if (!fromCache && responses.length > 0) {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        
        // Build new weighted average change series from current data
        const newChangeSeries = calculateWeightedStablecoinChanges(responses, stablecoins);
        console.log(`Stablecoins: Calculated weighted average changes: ${newChangeSeries.length} data points`);
        
        // Merge with existing historical data (365-day rolling window)
        let updatedChangeSeries = [];
        if (historicalBaseline?.changeSeries) {
          // Combine historical + new data, keep only last 365 days
          updatedChangeSeries = [...historicalBaseline.changeSeries, ...newChangeSeries];
          if (updatedChangeSeries.length > 365) {
            updatedChangeSeries = updatedChangeSeries.slice(-365); // Keep last 365 days
          }
        } else {
          updatedChangeSeries = newChangeSeries;
        }
        
        // Save updated historical baseline
        const updatedHistoricalData = {
          lastUpdated: new Date().toISOString(),
          changeSeries: updatedChangeSeries,
          dataPoints: updatedChangeSeries.length
        };
        
        fs.writeFileSync(historicalFile, JSON.stringify(updatedHistoricalData, null, 2), 'utf8');
        console.log(`Stablecoins: Updated historical baseline with ${updatedChangeSeries.length} data points`);
      } catch (error) {
        console.warn('Stablecoins: Failed to update historical baseline:', error.message);
      }
    }
    
    // Find dominant stablecoin for display
    const dominantCoin = coinData.reduce((max, coin) => 
      coin.marketCap > max.marketCap ? coin : max, coinData[0]);
    
    return { 
      score: compositeScore, 
      reason: "success",
      lastUpdated: new Date().toISOString(),
      details: [
        { label: "Total Market Cap", value: `$${(totalMarketCap / 1e9).toFixed(1)}B` },
        { label: "Dominant Stablecoin", value: `${dominantCoin.symbol} (${((dominantCoin.marketCap / totalMarketCap) * 100).toFixed(0)}%)` },
        { label: "Aggregate 30d Growth", value: `${(aggregateChange * 100).toFixed(1)}%` },
        { label: "Growth Momentum", value: recentMomentum > 1 ? "Accelerating" : recentMomentum > 0.5 ? "Steady" : "Decelerating" },
        { label: "Market Concentration", value: `HHI: ${(hhi * 10000).toFixed(0)}` },
        { label: "Supply Growth Percentile", value: `${(supplyPercentile * 100).toFixed(0)}%` },
        { label: "Historical Baseline", value: `${changeSeries.length} data points (weighted average of ${stablecoins.length} stablecoins)` },
        { label: "Stablecoin Coverage", value: `${stablecoins.map(c => c.symbol).join(', ')} (${stablecoins.length} coins)` },
        { label: "Component Scores", value: `Supply: ${supplyScore}, Momentum: ${momentumScore}, Concentration: ${concentrationRiskScore}` }
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
    const individualEtfFlows = parseResult.individualEtfFlows;
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
    
    // Calculate latest individual ETF flows
    const latestIndividualFlows = individualEtfFlows.length > 0 ? 
      individualEtfFlows[individualEtfFlows.length - 1].flows : {};
    
    // Load historical baseline for percentile calculation (business days only)
    let historicalBaseline = null;
    try {
      const fs = await import('node:fs');
      const historicalFile = 'public/data/etf-flows-historical.json';
      if (fs.existsSync(historicalFile)) {
        const historicalContent = fs.readFileSync(historicalFile, 'utf8');
        const historicalData = JSON.parse(historicalContent);
        
        // Filter historical baseline to exclude weekends
        const businessDaySums = historicalData.rollingSums
          .filter(item => {
            const date = new Date(item.date);
            return isBusinessDay(date);
          })
          .map(f => f.sum);
        
        historicalBaseline = businessDaySums;
        console.log(`ETF Flows: Using historical baseline with ${historicalBaseline.length} business day data points (filtered from ${historicalData.rollingSums.length} total)`);
      }
    } catch (error) {
      console.warn('ETF Flows: Could not load historical baseline:', error.message);
    }
    
    // Calculate percentile rank using historical baseline if available
    const percentile = historicalBaseline ? 
      percentileRank(historicalBaseline, latest21d) : 
      percentileRank(flows21d, latest21d);
    
    // Z-score tripwire: check if latest 21-day sum is > 4σ from historical mean
    const baselineForZScore = historicalBaseline || flows21d;
    const mean21d = baselineForZScore.reduce((sum, val) => sum + val, 0) / baselineForZScore.length;
    const variance21d = baselineForZScore.reduce((sum, val) => sum + Math.pow(val - mean21d, 2), 0) / baselineForZScore.length;
    const stdDev21d = Math.sqrt(variance21d);
    const zScore21d = stdDev21d > 0 ? (latest21d - mean21d) / stdDev21d : 0;
    
    const isExtremeChange = Math.abs(zScore21d) > 4;
    if (isExtremeChange) {
      console.warn(`ETF Flows: Extreme 21-day sum change detected (z-score: ${zScore21d.toFixed(2)}). Latest: $${latest21d.toLocaleString()}, Mean: $${mean21d.toLocaleString()}, StdDev: $${stdDev21d.toLocaleString()}`);
    }
    
    // Multi-factor ETF Flows analysis
    // 1. 21-day Rolling Sum (40% weight) - primary momentum indicator
    const score21d = riskFromPercentile(percentile, { invert: true, k: 3 });
    
    // 2. Recent Acceleration (30% weight) - 7d vs 21d trend
    const flows7d = flows.slice(-7).reduce((sum, f) => sum + f.flow, 0);
    const flows14d = flows.slice(-14, -7).reduce((sum, f) => sum + f.flow, 0);
    const acceleration = flows7d - flows14d; // Recent vs previous week
    
    // Build acceleration series for percentile ranking
    const accelSeries = [];
    for (let i = 14; i < flows.length - 7; i++) {
      const recent = flows.slice(i, i + 7).reduce((sum, f) => sum + f.flow, 0);
      const previous = flows.slice(i - 7, i).reduce((sum, f) => sum + f.flow, 0);
      accelSeries.push(recent - previous);
    }
    
    const accelPercentile = accelSeries.length > 0 ? percentileRank(accelSeries, acceleration) : 0.5;
    const accelScore = riskFromPercentile(accelPercentile, { invert: true, k: 3 });
    
    // 3. ETF Diversification (30% weight) - concentration risk
    let diversificationScore = 50; // neutral default
    if (Object.keys(latestIndividualFlows).length > 0) {
      const totalAbsFlow = Object.values(latestIndividualFlows)
        .reduce((sum, flow) => sum + Math.abs(flow), 0);
      
      if (totalAbsFlow > 0) {
        // Calculate Herfindahl-Hirschman Index for flow concentration
        const hhi = Object.values(latestIndividualFlows)
          .map(flow => Math.abs(flow) / totalAbsFlow)
          .reduce((sum, share) => sum + Math.pow(share, 2), 0);
        
        // Lower concentration = lower risk
        diversificationScore = Math.min(hhi * 100, 100);
      }
    }

    // Composite score (weighted blend) - BMSB-dominant Trend & Valuation
    const score = Math.round(
      score21d * 0.30 + 
      accelScore * 0.30 + 
      diversificationScore * 0.40
    );
    
    // Format details with explicit units and tooltips
    const latestFlow = flows[flows.length - 1];
    const totalFlows = flows.reduce((sum, f) => sum + f.flow, 0);
    
    return { 
      score: isStale ? null : score,
      reason: isStale ? "stale_data" : "success",
      lastUpdated: latestFlow.date ? `${latestFlow.date}T16:00:00.000Z` : new Date().toISOString(), // ETFs update after market close
      individualEtfFlows: individualEtfFlows, // Return full array for per-ETF breakdown
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
        { label: "7-day Recent Flows", value: formatCurrencyWithTooltip(flows7d) },
        { label: "Flow Acceleration", value: acceleration >= 0 ? `+${formatCurrencyWithTooltip(acceleration)}` : formatCurrencyWithTooltip(acceleration) },
        { label: "Diversification (HHI)", value: diversificationScore < 50 ? "High" : diversificationScore < 70 ? "Medium" : "Low" },
        { label: "21-day Percentile", value: `${(percentile * 100).toFixed(0)}%` },
        { 
          label: "21-day Z-Score", 
          value: `${zScore21d.toFixed(2)}σ`,
          tooltip: isExtremeChange ? `EXTREME: ${zScore21d.toFixed(2)}σ from mean (${mean21d.toLocaleString()})` : `Normal: ${zScore21d.toFixed(2)}σ from mean`
        },
        { label: "Component Scores", value: `21d: ${score21d}, Accel: ${accelScore}, Diversif: ${diversificationScore}` },
        { 
          label: "Total Flows (all time)", 
          value: formatCurrencyWithTooltip(totalFlows),
          tooltip: `Exact: $${totalFlows.toLocaleString()} (since ETF inception)`
        },
        { label: "Data Points", value: flows.length.toString() },
        { label: "Last Update", value: `${daysSinceUpdate.toFixed(1)} days ago` }
      ]
    };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// Helper function to parse ETF flows from HTML
function parseEtfFlowsFromHtml(html) {
  const flows = [];
  const individualEtfFlows = [];
  
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
  
  if (!dataTable) return { flows: [], individualEtfFlows: [], schemaHash: null };
  
  // Parse table rows
  const rows = dataTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellText = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').trim();
  
  const parsed = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => cellText(m[2]));
    if (cells.length) parsed.push(cells);
  }
  
  if (parsed.length < 2) return { flows: [], individualEtfFlows: [], schemaHash: null };
  
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
  
  // Define individual ETF columns
  const etfColumns = ['ibit', 'fbtc', 'bitb', 'arkb', 'btco', 'ezbc', 'brrr', 'hodl', 'btcw', 'gbtc', 'btc'];
  
  // Parse data rows
  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i];
    const dateRaw = (cells[dateCol] || '').trim();
    const date = parseDate(dateRaw);
    
    if (!date) continue; // Skip non-date rows
    
    let flow = NaN;
    const individualFlows = {};
    
    // Try to find total flow column first
    if (hasTotalCol) {
      const idx = header.findIndex(h => h.includes('total'));
      const v = parseNumber(cells[idx]);
      if (Number.isFinite(v)) flow = v * scale;
    }
    
    // Extract individual ETF flows
    for (const etf of etfColumns) {
      const etfIdx = header.findIndex(h => h.includes(etf));
      if (etfIdx !== -1 && etfIdx < cells.length) {
        const v = parseNumber(cells[etfIdx]);
        if (Number.isFinite(v)) {
          individualFlows[etf] = v * scale;
        }
      }
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
      // Only include business day flows (exclude weekends)
      const flowDate = new Date(date);
      if (isBusinessDay(flowDate)) {
        flows.push({ date, flow });
        if (Object.keys(individualFlows).length > 0) {
          individualEtfFlows.push({ date, flows: individualFlows });
        }
      }
    }
  }
  
  // Sort by date and deduplicate
  flows.sort((a, b) => a.date.localeCompare(b.date));
  individualEtfFlows.sort((a, b) => a.date.localeCompare(b.date));
  
  const unique = new Map();
  for (const f of flows) {
    unique.set(f.date, f);
  }
  
  const uniqueIndividual = new Map();
  for (const f of individualEtfFlows) {
    uniqueIndividual.set(f.date, f);
  }
  
  return { 
    flows: Array.from(unique.values()), 
    individualEtfFlows: Array.from(uniqueIndividual.values()),
    schemaHash 
  };
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

// Helper function to calculate 21-day rolling sum (business days only)
function calculate21DayRollingSum(flows) {
  const sums = [];
  
  for (let i = 0; i < flows.length; i++) {
    // Count back 21 business days from current position
    let businessDaysCounted = 0;
    let sum = 0;
    let j = i;
    
    // Go backwards through the data until we have 21 business days
    while (j >= 0 && businessDaysCounted < 21) {
      const flowDate = new Date(flows[j].date);
      
      // Only count business days (Monday-Friday)
      if (isBusinessDay(flowDate)) {
        sum += flows[j].flow;
        businessDaysCounted++;
      }
      j--;
    }
    
    // Only include if we have exactly 21 business days
    if (businessDaysCounted === 21) {
      sums.push(sum);
    } else {
      sums.push(NaN); // Not enough business day data
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

// Cache configuration for Term Leverage
const TERM_LEVERAGE_CACHE_DIR = 'public/data/cache/term_leverage';
const TERM_LEVERAGE_CACHE_TTL_HOURS = 6; // 6 hours cache for derivatives data
const TERM_LEVERAGE_CACHE_FILE = 'term_leverage_cache.json';

/**
 * Load cached Term Leverage data
 */
async function loadTermLeverageCache() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cachePath = path.join(TERM_LEVERAGE_CACHE_DIR, TERM_LEVERAGE_CACHE_FILE);
    const cacheData = await fs.readFile(cachePath, { encoding: 'utf8' });
    const parsed = JSON.parse(cacheData);
    
    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(parsed.cachedAt).getTime();
    const maxAge = TERM_LEVERAGE_CACHE_TTL_HOURS * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      console.log(`Term Leverage: Using cached data (${Math.round(cacheAge / (60 * 1000))} minutes old)`);
      return parsed;
    } else {
      console.log(`Term Leverage: Cache expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`);
      return null;
    }
  } catch (error) {
    console.log(`Term Leverage: No valid cache found: ${error.message}`);
    return null;
  }
}

/**
 * Save Term Leverage data to cache
 */
async function saveTermLeverageCache(data) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    await fs.mkdir(TERM_LEVERAGE_CACHE_DIR, { recursive: true });
    const cachePath = path.join(TERM_LEVERAGE_CACHE_DIR, TERM_LEVERAGE_CACHE_FILE);
    
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), { encoding: 'utf8' });
    console.log(`Term Leverage: Cached data saved to ${cachePath}`);
  } catch (error) {
    console.warn(`Term Leverage: Failed to save cache: ${error.message}`);
  }
}

/**
 * Check if funding data has changed since last cache
 */
function hasFundingDataChanged(currentFundingData, cachedData) {
  if (!cachedData || !cachedData.fundingData || !cachedData.fundingData.length) {
    return true;
  }
  
  const currentLatest = currentFundingData[0]; // Most recent (reverse=true)
  const cachedLatest = cachedData.fundingData[0];
  
  // Check if latest funding rate has changed
  return !currentLatest || !cachedLatest || 
         currentLatest.fundingRate !== cachedLatest.fundingRate ||
         currentLatest.timestamp !== cachedLatest.timestamp;
}

/**
 * Fetch funding data from BitMEX
 */
async function fetchBitmexFundingData() {
  try {
    const response = await fetch("https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true", 
      { headers: { "User-Agent": "btc-risk-etl" } });
    
    if (!response.ok) {
      console.log(`Term Leverage: BitMEX failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Term Leverage: BitMEX data received (${data.length} records)`);
    return data;
  } catch (error) {
    console.log(`Term Leverage: BitMEX error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch funding data from Binance
 */
async function fetchBinanceFundingData() {
  try {
    const response = await fetch("https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=30");
    
    if (!response.ok) {
      console.log(`Term Leverage: Binance failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Term Leverage: Binance data received (${data.length} records)`);
    return data;
  } catch (error) {
    console.log(`Term Leverage: Binance error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch funding data from OKX
 */
async function fetchOKXFundingData() {
  try {
    const response = await fetch("https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=30");
    
    if (!response.ok) {
      console.log(`Term Leverage: OKX failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data.code === '0' && data.data) {
      console.log(`Term Leverage: OKX data received (${data.data.length} records)`);
      return data.data;
    }
    return null;
  } catch (error) {
    console.log(`Term Leverage: OKX error: ${error.message}`);
    return null;
  }
}

/**
 * Calculate funding component in parallel
 */
async function calculateFundingComponent(fundingRates) {
  return new Promise((resolve) => {
    setImmediate(() => {
      const rates = fundingRates.map(f => f.rate);
      const avgFunding = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      const latestFunding = rates[0]; // Most recent
      
      // Build historical series for percentile ranking
      const fundingPercentile = percentileRank(rates, avgFunding);
      const fundingScore = riskFromPercentile(fundingPercentile, { invert: false, k: 3 });
      
      resolve({
        component: 'funding',
        data: { avgFunding, latestFunding, fundingPercentile },
        score: fundingScore,
        weight: 0.40
      });
    });
  });
}

/**
 * Calculate volatility component in parallel
 */
async function calculateVolatilityComponent(spotPrices) {
  return new Promise((resolve) => {
    setImmediate(() => {
      // Calculate 7-day rolling volatility
      const returns = [];
      for (let i = 1; i < spotPrices.length; i++) {
        returns.push((spotPrices[i] - spotPrices[i-1]) / spotPrices[i-1]);
      }
      
      const priceVolatility = returns.length > 0 ? 
        Math.sqrt(returns.reduce((sum, r) => sum + r*r, 0) / returns.length) * 100 : 0;
      
      // Build volatility series for percentile ranking
      const volSeries = [];
      for (let i = 7; i < spotPrices.length; i++) {
        const subset = spotPrices.slice(i-7, i);
        const subsetReturns = [];
        for (let j = 1; j < subset.length; j++) {
          subsetReturns.push((subset[j] - subset[j-1]) / subset[j-1]);
        }
        const vol = subsetReturns.length > 0 ? 
          Math.sqrt(subsetReturns.reduce((sum, r) => sum + r*r, 0) / subsetReturns.length) * 100 : 0;
        volSeries.push(vol);
      }
      
      const volPercentile = volSeries.length > 0 ? percentileRank(volSeries, priceVolatility) : 0.5;
      const volScore = riskFromPercentile(volPercentile, { invert: false, k: 3 });
      
      resolve({
        component: 'volatility',
        data: { priceVolatility, volPercentile },
        score: volScore,
        weight: 0.35
      });
    });
  });
}

/**
 * Calculate stress component in parallel
 */
async function calculateStressComponent(fundingRates, spotPrices) {
  return new Promise((resolve) => {
    setImmediate(() => {
      const rates = fundingRates.map(f => f.rate);
      const avgFunding = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      
      // Calculate price volatility for stress indicator
      const returns = [];
      for (let i = 1; i < spotPrices.length; i++) {
        returns.push((spotPrices[i] - spotPrices[i-1]) / spotPrices[i-1]);
      }
      const priceVolatility = returns.length > 0 ? 
        Math.sqrt(returns.reduce((sum, r) => sum + r*r, 0) / returns.length) * 100 : 0;
      
      const stressIndicator = (Math.abs(avgFunding) * 10) + (priceVolatility * 0.1);
      
      // Build stress series for percentile ranking
      const stressSeries = [];
      for (let i = 7; i < Math.min(rates.length, spotPrices.length-7); i++) {
        const fundingSubset = rates.slice(i-7, i);
        const priceSubset = spotPrices.slice(i-7, i);
        const avgF = fundingSubset.reduce((sum, r) => sum + r, 0) / fundingSubset.length;
        
        const subsetReturns = [];
        for (let j = 1; j < priceSubset.length; j++) {
          subsetReturns.push((priceSubset[j] - priceSubset[j-1]) / priceSubset[j-1]);
        }
        const vol = subsetReturns.length > 0 ? 
          Math.sqrt(subsetReturns.reduce((sum, r) => sum + r*r, 0) / subsetReturns.length) * 100 : 0;
        
        stressSeries.push((Math.abs(avgF) * 10) + (vol * 0.1));
      }
      
      const stressPercentile = stressSeries.length > 0 ? percentileRank(stressSeries, stressIndicator) : 0.5;
      const stressScore = riskFromPercentile(stressPercentile, { invert: false, k: 3 });
      
      resolve({
        component: 'stress',
        data: { stressIndicator, stressPercentile },
        score: stressScore,
        weight: 0.25
      });
    });
  });
}

// 6. TERM STRUCTURE & LEVERAGE (Multi-factor derivatives analysis)
// Enhanced with caching, multi-exchange fallback, and parallel processing
async function computeTermLeverage() {
  try {
    // Check for cached data first
    const cachedData = await loadTermLeverageCache();
    
    // Fetch funding data from multiple exchanges with fallback chain
    const [bitmexData, binanceData, okxData, spotData] = await Promise.all([
      fetchBitmexFundingData(),
      fetchBinanceFundingData(), 
      fetchOKXFundingData(),
      coinGecko.getMarketChart(30, 'daily')
    ]);

    // Use best available funding data (prefer BitMEX, fallback to others)
    let fundingData = bitmexData;
    let dataSource = 'BitMEX';
    
    if (!fundingData || fundingData.length === 0) {
      fundingData = binanceData;
      dataSource = 'Binance';
    }
    
    if (!fundingData || fundingData.length === 0) {
      fundingData = okxData;
      dataSource = 'OKX';
    }
    
    if (!fundingData || fundingData.length === 0) {
      return { score: null, reason: "no_funding_data_any_source" };
    }
    
    if (!spotData.prices || !Array.isArray(spotData.prices)) {
      return { score: null, reason: "no_spot_data" };
    }

    // Check if we can use cached data (incremental update)
    const dataChanged = hasFundingDataChanged(fundingData, cachedData);
    
    if (cachedData && !dataChanged) {
      console.log('Term Leverage: Using cached calculations (no funding data changes)');
      return {
        score: cachedData.score,
        reason: "success_cached",
        lastUpdated: cachedData.lastUpdated,
        details: cachedData.details
      };
    }

    console.log(`Term Leverage: Computing fresh calculations (funding data changed or no cache) from ${dataSource}`);

    // Extract and process funding rates
    const fundingRates = fundingData.map(item => ({
      rate: Number(item.fundingRate) * 100, // Convert to percentage
      timestamp: new Date(item.timestamp)
    })).filter(item => Number.isFinite(item.rate));
    
    if (fundingRates.length === 0) {
      return { score: null, reason: "no_valid_funding_rates" };
    }

    // Extract spot prices for volatility calculation
    const spotPrices = spotData.prices.map(([timestamp, price]) => price).filter(Number.isFinite);
    if (spotPrices.length < 7) {
      return { score: null, reason: "insufficient_spot_data" };
    }

    // 🚀 PARALLEL PROCESSING: Calculate all components simultaneously
    console.log('Term Leverage: Computing components in parallel...');
    const startTime = Date.now();
    
    const [fundingResult, volatilityResult, stressResult] = await Promise.all([
      calculateFundingComponent(fundingRates),
      calculateVolatilityComponent(spotPrices),
      calculateStressComponent(fundingRates, spotPrices)
    ]);
    
    const parallelTime = Date.now() - startTime;
    console.log(`Term Leverage: Parallel calculations completed in ${parallelTime}ms`);

    // Extract results from parallel processing
    const fundingComponentData = fundingResult.data;
    const volatilityData = volatilityResult.data;
    const stressData = stressResult.data;
    
    const fundingScore = fundingResult.score;
    const volScore = volatilityResult.score;
    const stressScore = stressResult.score;

    // All calculations completed in parallel - no additional processing needed

    // Composite score (weighted blend)
    const compositeScore = Math.round(
      fundingScore * 0.40 + 
      volScore * 0.35 + 
      stressScore * 0.25
    );
    
    // Determine leverage regime
    let leverageRegime = "Low";
    if (Math.abs(fundingComponentData.avgFunding) > 0.05) leverageRegime = "High";
    else if (Math.abs(fundingComponentData.avgFunding) > 0.02) leverageRegime = "Moderate";
    
    // Determine term structure state
    let termStructure = "Normal";
    if (stressData.stressIndicator > 2) termStructure = "Stressed";
    else if (stressData.stressIndicator > 1) termStructure = "Elevated";
    
    const rates = fundingRates.map(f => f.rate);
    const maxFunding = Math.max(...rates);
    const minFunding = Math.min(...rates);
    
    const result = { 
      score: compositeScore, 
      reason: "success",
      lastUpdated: new Date().toISOString(),
      details: [
        { label: "Current Funding Rate", value: `${fundingComponentData.latestFunding.toFixed(4)}%` },
        { label: "30-day Average", value: `${fundingComponentData.avgFunding.toFixed(4)}%` },
        { label: "Price Volatility (30d)", value: `${volatilityData.priceVolatility.toFixed(2)}%` },
        { label: "Leverage Regime", value: leverageRegime },
        { label: "Term Structure", value: termStructure },
        { label: "30-day Range", value: `${minFunding.toFixed(4)}% - ${maxFunding.toFixed(4)}%` },
        { label: "Data Source", value: dataSource },
        { label: "Calculation Method", value: `Parallel processing (${parallelTime}ms)` },
        { label: "Component Scores", value: `Funding: ${fundingScore}, Vol: ${volScore}, Stress: ${stressScore}` }
      ],
      fundingData: fundingData, // Include for cache comparison
      parallelTime // Include timing info
    };

    // Save to cache for future use
    await saveTermLeverageCache(result);

    return result;
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 7. ON-CHAIN ACTIVITY (Enhanced with fallback sources)
async function computeOnchain() {
  try {
    // Try enhanced version first (with fallback sources)
    const { computeOnchainEnhanced } = await import('./factors/onchain-enhanced.mjs');
    const result = await computeOnchainEnhanced();
    
    // If enhanced version fails, fall back to original
    if (result.score === null) {
      console.log('⚠️  Enhanced onchain failed, trying original implementation...');
      const { computeOnchain: jsComputeOnchain } = await import('./factors/onchain.mjs');
      const fallbackResult = await jsComputeOnchain();
      return fallbackResult;
    }
    
    // Return enhanced result in expected ETL format
    return {
      score: result.score,
      reason: result.reason,
      lastUpdated: result.lastUpdated,
      details: result.details,
      provenance: result.provenance
    };
  } catch (error) {
    console.error('On-chain computation failed:', error);
    return { score: null, reason: `error: ${error.message}` };
  }
}

// Cache configuration for Macro Overlay
const MACRO_OVERLAY_CACHE_DIR = 'public/data/cache/macro_overlay';
const MACRO_OVERLAY_CACHE_TTL_HOURS = 24; // 24 hours cache for FRED data
const MACRO_OVERLAY_CACHE_FILE = 'macro_overlay_cache.json';

/**
 * Load cached Macro Overlay data
 */
async function loadMacroOverlayCache() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cachePath = path.join(MACRO_OVERLAY_CACHE_DIR, MACRO_OVERLAY_CACHE_FILE);
    const cacheData = await fs.readFile(cachePath, { encoding: 'utf8' });
    const parsed = JSON.parse(cacheData);
    
    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(parsed.cachedAt).getTime();
    const maxAge = MACRO_OVERLAY_CACHE_TTL_HOURS * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      console.log(`Macro Overlay: Using cached data (${Math.round(cacheAge / (60 * 1000))} minutes old)`);
      return parsed;
    } else {
      console.log(`Macro Overlay: Cache expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`);
      return null;
    }
  } catch (error) {
    console.log(`Macro Overlay: No valid cache found: ${error.message}`);
    return null;
  }
}

/**
 * Save Macro Overlay data to cache
 */
async function saveMacroOverlayCache(data) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    await fs.mkdir(MACRO_OVERLAY_CACHE_DIR, { recursive: true });
    const cachePath = path.join(MACRO_OVERLAY_CACHE_DIR, MACRO_OVERLAY_CACHE_FILE);
    
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), { encoding: 'utf8' });
    console.log(`Macro Overlay: Cached data saved to ${cachePath}`);
  } catch (error) {
    console.warn(`Macro Overlay: Failed to save cache: ${error.message}`);
  }
}

/**
 * Check if FRED macro data has changed since last cache
 */
function hasMacroDataChanged(currentData, cachedData) {
  if (!cachedData || !cachedData.latestDxyDate) {
    return true;
  }
  
  // Check if latest observation date has changed
  return currentData.latestDxyDate !== cachedData.latestDxyDate;
}

/**
 * Fetch FRED macro data with enhanced error handling and retry logic
 */
async function fetchMacroFredDataWithRetry(seriesId, apiKey, startISO, endISO, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=d&aggregation_method=avg`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'btc-risk-dashboard' },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        if (attempt < maxRetries) {
          console.log(`Macro Overlay: FRED ${seriesId} attempt ${attempt} failed (${response.status}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
        throw new Error(`FRED API error for ${seriesId}: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Macro Overlay: FRED ${seriesId} fetched successfully (${data.observations?.length || 0} observations)`);
      return data;
    } catch (error) {
      if (attempt === maxRetries) {
        console.log(`Macro Overlay: FRED ${seriesId} failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      console.log(`Macro Overlay: FRED ${seriesId} attempt ${attempt} failed: ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// 8. MACRO OVERLAY (Multi-factor macro environment analysis)
// Enhanced with caching, retry logic, and incremental updates
async function computeMacroOverlay() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { score: null, reason: "missing_fred_api_key" };
  }

  try {
    // Check for cached data first
    const cachedData = await loadMacroOverlayCache();

    const end = new Date();
    const start = new Date(end.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days for better trend analysis
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    // 🚀 ENHANCED FRED FETCHING: Use retry logic and parallel processing
    console.log('Macro Overlay: Fetching FRED macro data with retry logic...');
    const startTime = Date.now();
    
    const [dxyData, dgs2Data, dgs10Data, vixData, tipData] = await Promise.all([
      fetchMacroFredDataWithRetry('DTWEXBGS', apiKey, startISO, endISO),
      fetchMacroFredDataWithRetry('DGS2', apiKey, startISO, endISO),
      fetchMacroFredDataWithRetry('DGS10', apiKey, startISO, endISO),
      fetchMacroFredDataWithRetry('VIXCLS', apiKey, startISO, endISO),
      fetchMacroFredDataWithRetry('DFII10', apiKey, startISO, endISO).catch(() => null) // TIPS data is optional
    ]);
    
    const fetchTime = Date.now() - startTime;
    console.log(`Macro Overlay: FRED data fetched in ${fetchTime}ms`);

    // Check if we can use cached data (incremental update)
    const latestDxyDate = dxyData.observations?.length > 0 ? 
      dxyData.observations[dxyData.observations.length - 1].date : null;
    
    const dataChanged = hasMacroDataChanged({ latestDxyDate }, cachedData);
    
    if (cachedData && !dataChanged) {
      console.log('Macro Overlay: Using cached calculations (no FRED data changes)');
      return {
        score: cachedData.score,
        reason: "success_cached",
        lastUpdated: cachedData.lastUpdated,
        details: cachedData.details
      };
    }

    console.log('Macro Overlay: Computing fresh calculations (FRED data changed or no cache)');

    // Extract and clean values
    const dxyValues = dxyData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const dgs2Values = dgs2Data.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const dgs10Values = dgs10Data.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const vixValues = vixData.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];
    const realRateValues = tipData?.observations?.map(o => Number(o.value)).filter(Number.isFinite) || [];

    if (dxyValues.length < 30 || dgs2Values.length < 30 || vixValues.length < 30) {
      return { score: null, reason: "insufficient_macro_data" };
    }

    // Multi-factor analysis
    // 1. Dollar Strength Pressure (35% weight) - DXY momentum and level
    const latestDxy = dxyValues[dxyValues.length - 1];
    const dxy20dChange = dxyValues.length >= 20 ? 
      ((dxyValues[dxyValues.length - 1] - dxyValues[dxyValues.length - 20]) / dxyValues[dxyValues.length - 20]) * 100 : 0;
    const dxy60dChange = dxyValues.length >= 60 ? 
      ((dxyValues[dxyValues.length - 1] - dxyValues[dxyValues.length - 60]) / dxyValues[dxyValues.length - 60]) * 100 : 0;
    
    // Build DXY change series for percentile ranking
    const dxyChangeSeries = [];
    for (let i = 20; i < dxyValues.length - 20; i++) {
      const change = ((dxyValues[i] - dxyValues[i - 20]) / dxyValues[i - 20]) * 100;
      if (Number.isFinite(change)) dxyChangeSeries.push(change);
    }
    
    const dxyPercentile = dxyChangeSeries.length > 0 ? percentileRank(dxyChangeSeries, dxy20dChange) : 0.5;
    const dollarScore = riskFromPercentile(dxyPercentile, { invert: false, k: 3 }); // Stronger dollar = higher risk for Bitcoin

    // 2. Interest Rate Environment (30% weight) - Yield levels and curve shape
    const latest2Y = dgs2Values[dgs2Values.length - 1];
    const latest10Y = dgs10Values.length > 0 ? dgs10Values[dgs10Values.length - 1] : latest2Y + 1; // Fallback if 10Y unavailable
    const yieldCurve = latest10Y - latest2Y; // Term spread
    
    const dgs2_20dChange = dgs2Values.length >= 20 ? 
      ((dgs2Values[dgs2Values.length - 1] - dgs2Values[dgs2Values.length - 20]) / dgs2Values[dgs2Values.length - 20]) * 100 : 0;
    
    // Build yield change series for percentile ranking
    const yieldChangeSeries = [];
    for (let i = 20; i < dgs2Values.length - 20; i++) {
      const change = ((dgs2Values[i] - dgs2Values[i - 20]) / dgs2Values[i - 20]) * 100;
      if (Number.isFinite(change)) yieldChangeSeries.push(change);
    }
    
    const yieldPercentile = yieldChangeSeries.length > 0 ? percentileRank(yieldChangeSeries, dgs2_20dChange) : 0.5;
    let ratesScore = riskFromPercentile(yieldPercentile, { invert: false, k: 3 }); // Higher rates = higher risk
    
    // Adjust for yield curve inversion (additional risk)
    if (yieldCurve < 0) ratesScore = Math.min(100, ratesScore + 15); // Inverted curve adds risk

    // 3. Risk Appetite / Fear Gauge (25% weight) - VIX with momentum
    const latestVix = vixValues[vixValues.length - 1];
    const vixPercentile = percentileRank(vixValues, latestVix);
    
    // VIX momentum (recent vs past)
    const vix7dAvg = vixValues.length >= 7 ? 
      vixValues.slice(-7).reduce((sum, v) => sum + v, 0) / 7 : latestVix;
    const vix30dAvg = vixValues.length >= 30 ? 
      vixValues.slice(-30, -7).reduce((sum, v) => sum + v, 0) / 23 : latestVix;
    const vixMomentum = vix7dAvg - vix30dAvg;
    
    let vixScore = riskFromPercentile(vixPercentile, { invert: false, k: 3 }); // Higher VIX = higher risk
    
    // Adjust for VIX momentum (rising fear = additional risk)
    if (vixMomentum > 2) vixScore = Math.min(100, vixScore + 10);
    else if (vixMomentum < -2) vixScore = Math.max(0, vixScore - 5);

    // 4. Real Rate Pressure (10% weight) - Real yields impact on risk assets
    let realRateScore = 50; // neutral default
    let latestRealRate = 0;
    let realRateChange = 0;
    
    if (realRateValues.length >= 20) {
      latestRealRate = realRateValues[realRateValues.length - 1];
      realRateChange = ((latestRealRate - realRateValues[realRateValues.length - 20]) / Math.abs(realRateValues[realRateValues.length - 20])) * 100;
      
      // Build real rate series for percentile ranking
      const realRateSeries = [];
      for (let i = 20; i < realRateValues.length - 20; i++) {
        const change = ((realRateValues[i] - realRateValues[i - 20]) / Math.abs(realRateValues[i - 20])) * 100;
        if (Number.isFinite(change)) realRateSeries.push(change);
      }
      
      if (realRateSeries.length > 0) {
        const realRatePercentile = percentileRank(realRateSeries, realRateChange);
        realRateScore = riskFromPercentile(realRatePercentile, { invert: false, k: 3 }); // Higher real rates = higher risk
      }
    }

    // Composite score (weighted blend) - BMSB-dominant Trend & Valuation
    const compositeScore = Math.round(
      dollarScore * 0.40 + 
      ratesScore * 0.35 + 
      vixScore * 0.25 + 
      realRateScore * 0.00  // Parked for now
    );

    // Determine macro regime
    let macroRegime = "Neutral";
    if (latestVix > 25 && dxy20dChange > 2) macroRegime = "Risk-Off";
    else if (latestVix < 15 && dgs2_20dChange < -10) macroRegime = "Risk-On";
    else if (yieldCurve < -0.5) macroRegime = "Recession Risk";
    else if (latest2Y > 5) macroRegime = "Restrictive";
    
    // Determine dollar trend
    let dollarTrend = "Stable";
    if (dxy20dChange > 3) dollarTrend = "Strengthening";
    else if (dxy20dChange < -3) dollarTrend = "Weakening";
    
    // Determine rate environment
    let rateEnvironment = "Neutral";
    if (dgs2_20dChange > 15) rateEnvironment = "Rising Rapidly";
    else if (dgs2_20dChange > 5) rateEnvironment = "Rising";
    else if (dgs2_20dChange < -15) rateEnvironment = "Falling Rapidly";
    else if (dgs2_20dChange < -5) rateEnvironment = "Falling";

    const result = { 
      score: compositeScore, 
      reason: "success",
      lastUpdated: new Date().toISOString(),
      details: [
        { label: "Macro Regime", value: macroRegime },
        { label: "Dollar Trend (20d)", value: `${dollarTrend} (${dxy20dChange.toFixed(1)}%)` },
        { label: "Rate Environment", value: `${rateEnvironment} (${dgs2_20dChange.toFixed(1)}%)` },
        { label: "VIX Level", value: `${latestVix.toFixed(1)} (${(vixPercentile * 100).toFixed(0)}%ile)` },
        { label: "Yield Curve (10Y-2Y)", value: `${yieldCurve.toFixed(2)}%${yieldCurve < 0 ? ' (Inverted)' : ''}` },
        { label: "Real Rate (10Y TIPS)", value: realRateValues.length > 0 ? `${latestRealRate.toFixed(2)}%` : "N/A" },
        { label: "Fetch Time", value: `${fetchTime}ms` },
        { label: "Component Scores", value: `Dollar: ${dollarScore}, Rates: ${ratesScore}, VIX: ${vixScore}, Real: ${realRateScore}` },
        { label: "Current Levels", value: `DXY: ${latestDxy.toFixed(1)}, 2Y: ${latest2Y.toFixed(2)}%, VIX: ${latestVix.toFixed(1)}` }
      ],
      latestDxyDate, // Include for cache comparison
      fetchTime // Include timing info
    };

    // Save to cache for future use
    await saveMacroOverlayCache(result);

    return result;
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// ============================================================================
// MAIN COMPUTE FUNCTION
// ============================================================================

import { getStalenessStatus, getStalenessConfig, isBusinessDay } from './stalenessUtils.mjs';

export async function computeAllFactors(dailyClose = null) {
  console.log("Computing risk factors...");
  
  const results = await Promise.allSettled([
    computeTrendValuation(dailyClose),    // order: 1 - pass daily close for price consistency
    computeOnchain(),           // order: 2  
    computeStablecoins(),       // order: 3
    computeEtfFlows(),          // order: 4
    computeNetLiquidity(),      // order: 5
    computeTermLeverage(),      // order: 6
    computeMacroOverlay(),      // order: 7
    computeSocialInterest()     // order: 8
  ]);

  // Load configuration from single source of truth
  const { loadDashboardConfig, getFactorsArray } = await import('../../lib/config-loader.mjs');
  const config = await loadDashboardConfig();
  const factors = getFactorsArray(config);

  const factorResults = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < factors.length; i++) {
    const factor = factors[i];
    const result = results[i];
    
    let score = null;
    let status = 'excluded';
    let reason = 'unknown';
    let lastUpdated = null;

    if (result.status === 'fulfilled') {
      const data = result.value;
      score = data.score;
      reason = data.reason;
      
      if (score !== null && Number.isFinite(score)) {
        // Get staleness configuration for this factor
        const stalenessConfig = getStalenessConfig(factor.key);
        
        // Check staleness status
        const stalenessStatus = getStalenessStatus(
          { ...data, lastUpdated: data.lastUpdated || new Date().toISOString() },
          stalenessConfig.ttlHours,
          {
            factorName: factor.key,
            marketDependent: stalenessConfig.marketDependent,
            businessDaysOnly: stalenessConfig.businessDaysOnly
          }
        );
        
        status = stalenessStatus.status;
        lastUpdated = stalenessStatus.lastUpdated;
        
        // Only include fresh factors in composite calculation
        if (status === 'fresh') {
          totalWeight += factor.weight;
          weightedSum += (factor.weight * score);
          reason = stalenessStatus.reason;
        } else {
          reason = `${data.reason} -> ${stalenessStatus.reason}`;
        }
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
      weight_pct: factor.weight, // Absolute percentage for UI display (21, 9, 5, etc.)
      score,
      status,
      reason,
      last_utc: lastUpdated, // Add timestamp for SystemStatusCard
      details: result.status === 'fulfilled' ? result.value.details : undefined,
      individualEtfFlows: result.status === 'fulfilled' && result.value.individualEtfFlows ? result.value.individualEtfFlows : undefined,
      sma50wDiagnostic: result.status === 'fulfilled' && result.value.sma50wDiagnostic ? result.value.sma50wDiagnostic : undefined
    });

    console.log(`${factor.key}: ${score !== null ? score : 'null'} (${status}) - ${reason}`);
  }

  // Calculate composite score with weight normalization
  const composite = calculateEnhancedGScore(factorResults, totalWeight, weightedSum);
  
  // Log staleness summary
  const freshCount = factorResults.filter(f => f.status === 'fresh').length;
  const staleCount = factorResults.filter(f => f.status === 'stale').length;
  const excludedCount = factorResults.filter(f => f.status === 'excluded').length;
  console.log(`Factor staleness: ${freshCount} fresh, ${staleCount} stale, ${excludedCount} excluded`);

  // Validate composite calculation
  try {
    const { validateCompositeScore } = await import('../../lib/composite-validator.mjs');
    const validation = validateCompositeScore(
      factorResults, 
      composite, 
      { cycle: 0, spike: 0 } // No adjustments currently applied
    );
    
    // Log one-line result for dev/CI visibility
    const statusIcon = validation.valid ? '✅' : '❌';
    console.log(`Composite check: expected ${validation.expected.toFixed(1)}, recomputed ${validation.actual.toFixed(1)}, Δ = ${validation.delta.toFixed(1)} ${statusIcon}`);
    
    if (!validation.valid) {
      console.warn('⚠️  Composite validation failed - check calculation logic');
      console.warn(`   Tolerance exceeded: ${validation.delta.toFixed(3)} > 0.5`);
    }
  } catch (validationError) {
    console.warn('⚠️  Could not validate composite score:', validationError.message);
  }

  return {
    factors: factorResults,
    composite,
    totalWeight,
    weightedSum
  };
}

// Helper function to get yesterday's Bitcoin close from CoinGecko
async function getCoinGeckoCloseForYesterday() {
  try {
    const result = await coinGecko.getYesterdayClose();
    return { 
      date: new Date(result.timestamp).toISOString().split('T')[0], 
      close: result.close 
    };
  } catch (error) {
    console.warn('Failed to get yesterday close from CoinGecko:', error.message);
    throw error; // Re-throw to maintain existing error handling
  }
}

// BTC⇄Gold cross-rates calculation
async function computeBtcGoldRates() {
  try {
    const btcPrice = await getCoinGeckoCloseForYesterday();
    if (!btcPrice) {
      return { success: false, reason: "no_btc_price" };
    }

    // Try multiple gold price sources with fallback chain
    let goldPrice = null;
    let goldSource = null;
    let goldLatency = 0;
    let goldFallback = false;

    // Source 1: Metals API (requires API key)
    if (process.env.METALS_API_KEY) {
      try {
        const startTime = Date.now();
        const url = `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=XAU`;
        const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
        goldLatency = Date.now() - startTime;
        
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.rates && data.rates.XAU) {
            // Metals API returns XAU as USD per troy ounce
            goldPrice = data.rates.XAU;
            goldSource = "Metals API";
          }
        }
      } catch (error) {
        console.warn('Metals API failed:', error.message);
      }
    }

    // Source 2: Alpha Vantage (free tier, 25/day)
    if (!goldPrice && process.env.ALPHAVANTAGE_API_KEY) {
      try {
        const startTime = Date.now();
        const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=XAU&to_symbol=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`;
        const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
        goldLatency = Date.now() - startTime;
        
        if (res.ok) {
          const data = await res.json();
          if (data["Time Series (FX)"]) {
            const timeSeries = data["Time Series (FX)"];
            const dates = Object.keys(timeSeries).sort().reverse();
            if (dates.length > 0) {
              const latestDate = dates[0];
              const latestData = timeSeries[latestDate];
              goldPrice = parseFloat(latestData["4. close"]);
              goldSource = "Alpha Vantage";
            }
          }
        }
      } catch (error) {
        console.warn('Alpha Vantage failed:', error.message);
      }
    }

    // Source 3: Stooq CSV (no key required, reliable free source)
    if (!goldPrice) {
      try {
        const startTime = Date.now();
        const url = "https://stooq.com/q/d/l/?s=xauusd&i=d";
        const res = await fetch(url, { headers: { "User-Agent": "btc-risk-etl" } });
        goldLatency = Date.now() - startTime;
        
        if (res.ok) {
          const csvText = await res.text();
          const lines = csvText.split('\n').filter(line => line.trim());
          if (lines.length > 1) {
            // Parse CSV: Date,Open,High,Low,Close,Volume
            const lastLine = lines[lines.length - 1];
            const columns = lastLine.split(',');
            if (columns.length >= 5) {
              goldPrice = parseFloat(columns[4]); // Close price
              goldSource = "Stooq";
              goldFallback = false; // Stooq is a reliable primary source, not a fallback
            }
          }
        }
      } catch (error) {
        console.warn('Stooq failed:', error.message);
      }
    }

    if (!goldPrice) {
      return { success: false, reason: "no_gold_price" };
    }

    // Calculate ratios
    const btcPerOz = btcPrice.close / goldPrice;
    const ozPerBtc = 1 / btcPerOz;

    return {
      success: true,
      data: {
        updated_at: new Date().toISOString(),
        date: btcPrice.date,
        btc_close_usd: btcPrice.close,
        xau_close_usd: goldPrice,
        btc_per_oz: btcPerOz,
        oz_per_btc: ozPerBtc,
        provenance: [{
          name: goldSource,
          ok: true,
          url: goldSource === "Metals API" ? "https://metals-api.com/" : 
               goldSource === "Alpha Vantage" ? "https://www.alphavantage.co/" : 
               "https://stooq.com/",
          ms: goldLatency,
          fallback: goldFallback
        }]
      }
    };
  } catch (error) {
    return { success: false, reason: `error: ${error.message}` };
  }
}

// Helper function to clean old stablecoins cache files
async function cleanOldStablecoinsCacheFiles() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const cacheDir = 'public/data/cache/stablecoins';
    if (!fs.existsSync(cacheDir)) return;
    
    const files = fs.readdirSync(cacheDir);
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    let cleaned = 0;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
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
      console.log(`Stablecoins: Cleaned ${cleaned} old cache files`);
    }
  } catch (error) {
    console.warn('Stablecoins: Could not clean cache files:', error.message);
  }
}

// Export additional functions for use in other modules
export { cleanOldCacheFiles, cleanOldStablecoinsCacheFiles, computeBtcGoldRates };


// Enhanced G-Score calculation with deterministic scoring
function calculateEnhancedGScore(factorResults, totalWeight, weightedSum) {
  // If no factors are included, return neutral score
  if (totalWeight === 0) {
    return 50;
  }
  
  // Calculate normalized composite score (deterministic)
  const normalizedScore = weightedSum / totalWeight;
  
  // Ensure score is within valid range
  const compositeScore = Math.max(0, Math.min(100, Math.round(normalizedScore)));
  
  return compositeScore;
}