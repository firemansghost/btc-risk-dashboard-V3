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
    
    return { score, reason: "success" };
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
    
    return { score, reason: "success" };
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
    
    return { score, reason: "success" };
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
    
    return { score, reason: "success" };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 5. ETF FLOWS (Farside Investors - simplified)
async function computeEtfFlows() {
  try {
    // This is a simplified version - in production you'd want to fetch actual ETF data
    // For now, return a placeholder that can be enhanced later
    return { score: null, reason: "etf_flows_not_implemented" };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 6. TERM LEVERAGE (BitMEX funding rates - simplified)
async function computeTermLeverage() {
  try {
    // This is a simplified version - in production you'd want to fetch actual funding rates
    // For now, return a placeholder that can be enhanced later
    return { score: null, reason: "term_leverage_not_implemented" };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 7. ON-CHAIN ACTIVITY (blockchain.info - simplified)
async function computeOnchain() {
  try {
    // This is a simplified version - in production you'd want to fetch actual on-chain data
    // For now, return a placeholder that can be enhanced later
    return { score: null, reason: "onchain_not_implemented" };
  } catch (error) {
    return { score: null, reason: `error: ${error.message}` };
  }
}

// 8. MACRO OVERLAY (FRED data - simplified)
async function computeMacroOverlay() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { score: null, reason: "missing_fred_api_key" };
  }

  try {
    // This is a simplified version - in production you'd want to fetch DXY, 2Y yield, VIX
    // For now, return a placeholder that can be enhanced later
    return { score: null, reason: "macro_overlay_not_implemented" };
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
      reason
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
