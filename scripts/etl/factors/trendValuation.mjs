// scripts/etl/factors/trendValuation.mjs
// Trend & Valuation factor with true BMSB calculation and unified Coinbase price source

/**
 * Simple Moving Average calculation
 * @param {number[]} data - Array of numbers
 * @param {number} period - Period for SMA
 * @returns {number[]} Array of SMA values
 */
function sma(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

/**
 * Exponential Moving Average calculation
 * @param {number[]} data - Array of numbers
 * @param {number} period - Period for EMA
 * @returns {number[]} Array of EMA values
 */
function ema(data, period) {
  if (data.length === 0) return [];
  
  const multiplier = 2 / (period + 1);
  const result = [data[0]]; // Start with first value
  
  for (let i = 1; i < data.length; i++) {
    result.push((data[i] * multiplier) + (result[i - 1] * (1 - multiplier)));
  }
  
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {number[]} prices - Array of prices
 * @param {number} period - RSI period (typically 14)
 * @returns {number[]} Array of RSI values
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return [];

  const gains = [];
  const losses = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const rsi = [];
  
  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Calculate first RSI
  const rs1 = avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs1)));
  
  // Calculate subsequent RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

/**
 * Calculate percentile rank of a value within an array
 * @param {number[]} array - Array of values
 * @param {number} value - Value to find percentile for
 * @returns {number} Percentile rank (0-100)
 */
function percentileRank(array, value) {
  if (array.length === 0) return NaN;
  
  const sorted = [...array].sort((a, b) => a - b);
  let count = 0;
  
  for (const item of sorted) {
    if (item < value) count++;
    else if (item === value) count += 0.5; // Handle ties
  }
  
  return (count / sorted.length) * 100;
}

/**
 * Convert percentile rank to risk score using logistic transformation
 * @param {number} percentile - Percentile rank (0-100)
 * @param {Object} options - Transformation options
 * @returns {number} Risk score (0-100)
 */
function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  
  if (!Number.isFinite(percentile)) return null;
  
  // Convert percentile to z-score equivalent
  const p = Math.max(0.01, Math.min(99.99, percentile)) / 100;
  const z = Math.log(p / (1 - p)) / k;
  
  // Apply logistic transformation to 0-100 scale
  let score = 100 / (1 + Math.exp(-z));
  
  // Invert if specified (for metrics where higher values mean lower risk)
  if (invert) {
    score = 100 - score;
  }
  
  return Math.round(score);
}

/**
 * Fetch Coinbase daily candles for historical price data
 * @param {number} days - Number of days to fetch
 * @returns {Object} {candles, provenance}
 */
async function fetchCoinbaseCandles(days = 300) {
  const startTime = Date.now();
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 86400000);
  
  const provenance = {
    url: `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${startDate.toISOString()}&end=${now.toISOString()}`,
    ok: false,
    status: 0,
    ms: 0
  };
  
  try {
    // Use the same URL construction pattern as the working ETL code
    const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
    url.searchParams.set("granularity", "86400");
    url.searchParams.set("start", startDate.toISOString());
    url.searchParams.set("end", now.toISOString());

    const response = await fetch(url.toString(), { 
      headers: { "User-Agent": "btc-risk-dashboard-trend-valuation" } 
    });

    provenance.status = response.status;
    provenance.ms = Date.now() - startTime;
    provenance.url = url.toString();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coinbase API ${response.status}: ${errorText}`);
    }

    const rawCandles = await response.json();
    provenance.ok = true;

    // Validate response
    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      throw new Error('Invalid or empty response from Coinbase API');
    }

    // Convert Coinbase format [timestamp, low, high, open, close, volume] to our format
    // Sort oldest-first for consistent processing
    const candles = rawCandles
      .map(candle => {
        if (!Array.isArray(candle) || candle.length < 6) {
          return null; // Skip invalid candles
        }
        return {
          timestamp: candle[0] * 1000, // Convert to milliseconds
          open: Number(candle[3]),
          high: Number(candle[2]),
          low: Number(candle[1]),
          close: Number(candle[4]),
          volume: Number(candle[5])
        };
      })
      .filter(candle => candle !== null && Number.isFinite(candle.close))
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`Fetched ${candles.length} daily candles from Coinbase`);
    return { candles, provenance };

  } catch (error) {
    provenance.error = error.message;
    provenance.ms = Date.now() - startTime;
    console.error('Coinbase candles fetch failed:', error.message);
    return { candles: [], provenance };
  }
}

/**
 * Convert daily candles to weekly closes using ISO week boundaries (UTC)
 * @param {Array} dailyCandles - Array of daily candle objects
 * @returns {Array} Array of weekly close objects {weekEnd, close, timestamp}
 */
function createWeeklyCloses(dailyCandles) {
  if (!dailyCandles || dailyCandles.length === 0) return [];

  const weeklyCloses = [];
  const candlesByWeek = new Map();

  // Group candles by ISO week
  for (const candle of dailyCandles) {
    const date = new Date(candle.timestamp);
    
    // Calculate ISO week ending date (Sunday 00:00 UTC)
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(date.getUTCDate() + daysUntilSunday);
    weekEnd.setUTCHours(0, 0, 0, 0);
    
    const weekKey = weekEnd.toISOString().split('T')[0];
    
    if (!candlesByWeek.has(weekKey)) {
      candlesByWeek.set(weekKey, []);
    }
    candlesByWeek.get(weekKey).push(candle);
  }

  // Create weekly closes (use the latest close in each week)
  for (const [weekKey, candles] of candlesByWeek) {
    if (candles.length > 0) {
      // Sort by timestamp and take the latest close
      const sortedCandles = candles.sort((a, b) => a.timestamp - b.timestamp);
      const latestCandle = sortedCandles[sortedCandles.length - 1];
      
      weeklyCloses.push({
        weekEnd: weekKey,
        close: latestCandle.close,
        timestamp: latestCandle.timestamp
      });
    }
  }

  // Sort by week end date
  return weeklyCloses.sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
}

/**
 * Calculate Bull Market Support Band (BMSB) using 20-week SMA and 21-week EMA
 * @param {Array} weeklyCloses - Array of weekly close objects
 * @returns {Object} BMSB calculation results
 */
function calculateBMSB(weeklyCloses) {
  if (weeklyCloses.length < 22) {
    return {
      status: 'insufficient_history',
      sma20: null,
      ema21: null,
      lower: null,
      upper: null,
      mid: null,
      distance: null,
      weekEnd: null
    };
  }

  const closes = weeklyCloses.map(w => w.close);
  const sma20Series = sma(closes, 20);
  const ema21Series = ema(closes, 21);

  if (sma20Series.length === 0 || ema21Series.length === 0) {
    return {
      status: 'calculation_failed',
      sma20: null,
      ema21: null,
      lower: null,
      upper: null,
      mid: null,
      distance: null,
      weekEnd: null
    };
  }

  const latestSMA20 = sma20Series[sma20Series.length - 1];
  const latestEMA21 = ema21Series[ema21Series.length - 1];
  const latestClose = closes[closes.length - 1];
  const latestWeekEnd = weeklyCloses[weeklyCloses.length - 1].weekEnd;

  const lower = Math.min(latestSMA20, latestEMA21);
  const upper = Math.max(latestSMA20, latestEMA21);
  const mid = (latestSMA20 + latestEMA21) / 2;

  let status;
  if (latestClose > upper) {
    status = 'above';
  } else if (latestClose < lower) {
    status = 'below';
  } else {
    status = 'inside';
  }

  const distance = ((latestClose - mid) / mid) * 100;

  return {
    status,
    sma20: latestSMA20,
    ema21: latestEMA21,
    lower,
    upper,
    mid,
    distance,
    weekEnd: latestWeekEnd
  };
}

/**
 * Compute Trend & Valuation factor with true BMSB and unified Coinbase price source
 * @param {number} dailyClose - Daily close price from main ETL (for consistency)
 * @returns {Object} Factor computation result
 */
export async function computeTrendValuation(dailyClose = null) {
  try {
    // Fetch Coinbase daily candles (300 days - Coinbase API limit)
    const { candles, provenance } = await fetchCoinbaseCandles(300);
    
    if (candles.length < 200) {
      return { 
        score: null, 
        reason: "insufficient_data",
        lastUpdated: new Date().toISOString(),
        provenance: [provenance]
      };
    }

    // Extract daily closes for calculations
    const dailyCloses = candles.map(c => c.close);
    
    // Use provided daily close for consistency, or fall back to latest from candles
    const currentPrice = dailyClose || dailyCloses[dailyCloses.length - 1];
    
    // Calculate 200-day SMA for Mayer Multiple
    const sma200Series = sma(dailyCloses, 200);
    if (sma200Series.length === 0) {
      return { 
        score: null, 
        reason: "sma200_calculation_failed",
        lastUpdated: new Date().toISOString(),
        provenance: [provenance]
      };
    }
    
    const latestSMA200 = sma200Series[sma200Series.length - 1];
    const mayerMultiple = currentPrice / latestSMA200;
    
    // Create weekly closes using ISO week boundaries
    const weeklyCloses = createWeeklyCloses(candles);
    
    if (weeklyCloses.length < 15) {
      return { 
        score: null, 
        reason: "insufficient_weekly_data",
        lastUpdated: new Date().toISOString(),
        provenance: [provenance]
      };
    }

    // Calculate true BMSB (20-week SMA + 21-week EMA)
    const bmsb = calculateBMSB(weeklyCloses);
    
    // Calculate 50-week SMA diagnostic (display-only, not part of score)
    const weeklyClosePrices = weeklyCloses.map(w => w.close);
    let sma50wDiagnostic = null;
    
    if (weeklyClosePrices.length >= 50) {
      const sma50Series = sma(weeklyClosePrices, 50);
      const latestSMA50 = sma50Series[sma50Series.length - 1];
      const currentWeeklyClose = weeklyClosePrices[weeklyClosePrices.length - 1];
      
      // Check if below 50W SMA for ≥2 consecutive weeks
      let consecutiveWeeksBelow = 0;
      for (let i = Math.max(0, sma50Series.length - 10); i < sma50Series.length; i++) {
        if (weeklyClosePrices[i + 49] < sma50Series[i]) { // +49 because sma50Series starts at index 49
          consecutiveWeeksBelow++;
        } else {
          consecutiveWeeksBelow = 0; // Reset counter if not below
        }
      }
      
      sma50wDiagnostic = {
        sma50: latestSMA50,
        currentClose: currentWeeklyClose,
        isBelow: currentWeeklyClose < latestSMA50,
        consecutiveWeeksBelow: consecutiveWeeksBelow,
        showWarning: consecutiveWeeksBelow >= 2
      };
    }
    
    // Calculate Weekly RSI(14) using weekly closes
    const weeklyRSI = calculateRSI(weeklyClosePrices, 14);
    
    if (weeklyRSI.length === 0) {
      return { 
        score: null, 
        reason: "rsi_calculation_failed",
        lastUpdated: new Date().toISOString(),
        provenance: [provenance]
      };
    }

    const latestWeeklyRSI = weeklyRSI[weeklyRSI.length - 1];
    const latestWeeklyClose = weeklyClosePrices[weeklyClosePrices.length - 1];

    // Calculate percentile ranks for scoring
    const mayerSeries = dailyCloses.map((price, i) => 
      i >= 199 ? price / sma200Series[i - 199] : NaN
    ).filter(Number.isFinite);
    
    const prMayer = percentileRank(mayerSeries, mayerMultiple);
    const prRsi = percentileRank(weeklyRSI, latestWeeklyRSI);

    // Calculate individual component scores
    const sMayer = Number.isFinite(prMayer) ? riskFromPercentile(prMayer, { invert: true, k: 3 }) : null;
    const sRsi = Number.isFinite(prRsi) ? riskFromPercentile(prRsi, { invert: false, k: 3 }) : null;
    
    // BMSB score calculation
    let sBmsb = null;
    if (bmsb.status !== 'insufficient_history' && bmsb.status !== 'calculation_failed') {
      // For BMSB scoring, we'll use the distance from midpoint as a risk indicator
      // Positive distance (above mid) = higher risk, negative (below mid) = lower risk
      const bmsbPercentile = 50 + (bmsb.distance * 2); // Scale distance to percentile-like range
      const clampedPercentile = Math.max(1, Math.min(99, bmsbPercentile));
      sBmsb = riskFromPercentile(clampedPercentile, { invert: false, k: 3 });
    }

    // Weighted blend: BMSB 60%, Mayer 30%, RSI 10%
    const components = [];
    const weights = [];
    
    if (sBmsb !== null) {
      components.push(sBmsb);
      weights.push(0.6);
    }
    if (sMayer !== null) {
      components.push(sMayer);
      weights.push(0.3);
    }
    if (sRsi !== null) {
      components.push(sRsi);
      weights.push(0.1);
    }

    let score = null;
    if (components.length > 0) {
      // Re-normalize weights if some components are missing
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = weights.map(w => w / weightSum);
      
      score = Math.round(
        components.reduce((sum, component, i) => sum + component * normalizedWeights[i], 0)
      );
    }

    // Prepare detailed results
    const details = [
      { label: "Price vs 200-day SMA (Mayer)", value: mayerMultiple.toFixed(2) },
      { 
        label: "Bull Market Support Band", 
        value: bmsb.status === 'insufficient_history' ? 'Insufficient history' :
               bmsb.status === 'calculation_failed' ? 'Calculation failed' :
               `${bmsb.status} (${bmsb.distance > 0 ? '+' : ''}${bmsb.distance.toFixed(1)}%)`
      },
      { label: "Weekly momentum (RSI)", value: latestWeeklyRSI.toFixed(1) },
      { label: "BTC Price (daily close)", value: `$${currentPrice.toLocaleString()}` },
      { label: "200-day SMA", value: `$${latestSMA200.toLocaleString()}` },
      { label: "Weekly Close (for BMSB)", value: `$${latestWeeklyClose.toLocaleString()}` }
    ];

    // Add BMSB band details if available
    if (bmsb.status !== 'insufficient_history' && bmsb.status !== 'calculation_failed') {
      details.push({
        label: "BMSB (20W SMA / 21W EMA)",
        value: `$${bmsb.sma20.toLocaleString()} / $${bmsb.ema21.toLocaleString()}`
      });
    }

    // Add 50W SMA diagnostic if available
    if (sma50wDiagnostic) {
      details.push({
        label: "50-week SMA diagnostic",
        value: sma50wDiagnostic.showWarning 
          ? `Below 50W SMA (${sma50wDiagnostic.consecutiveWeeksBelow} weeks)`
          : `Above 50W SMA ($${sma50wDiagnostic.sma50.toLocaleString()})`
      });
    }

    // Add component scores
    details.push({
      label: "Component Scores",
      value: `BMSB: ${sBmsb || 'N/A'}, Mayer: ${sMayer || 'N/A'}, RSI: ${sRsi || 'N/A'}`
    });

    return {
      score,
      reason: "success",
      lastUpdated: new Date().toISOString(),
      details,
      bmsb,
      weeklyClose: latestWeeklyClose,
      weekEnd: weeklyCloses[weeklyCloses.length - 1].weekEnd,
      sma50wDiagnostic,
      provenance: [provenance]
    };

  } catch (error) {
    return { 
      score: null, 
      reason: `error: ${error.message}`,
      lastUpdated: new Date().toISOString(),
      provenance: []
    };
  }
}
