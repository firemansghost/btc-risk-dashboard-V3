// scripts/etl/factors/onchain.mjs
// On-chain Activity: combines BTC mempool usage, tx fees, and miner profitability.
// Pure JS/ESM implementation for ETL runner compatibility.

const NORM = { logistic_k: 3 };

const mean = (a) => {
  const x = a.filter(Number.isFinite);
  return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN;
};

// Simple percentile rank calculation
function percentileRank(arr, value) {
  const sorted = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  
  const index = sorted.findIndex(x => x >= value);
  if (index === -1) return 1.0; // value is larger than all elements
  if (index === 0) return 0.0; // value is smaller than all elements
  
  return index / sorted.length;
}

// Simple moving average
function sma(arr, period) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = arr.slice(i - period + 1, i + 1);
      const validValues = slice.filter(Number.isFinite);
      result.push(validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : NaN);
    }
  }
  return result;
}

// Risk score from percentile (0-100)
function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  
  // Clamp percentile to [0, 1]
  const p = Math.max(0, Math.min(1, percentile));
  
  // Apply inversion if requested
  const adjustedP = invert ? (1 - p) : p;
  
  // Logistic transformation: more extreme scores at the tails
  // S-curve: f(x) = 1 / (1 + e^(-k*(2x-1)))
  const logisticInput = k * (2 * adjustedP - 1);
  const logisticOutput = 1 / (1 + Math.exp(-logisticInput));
  
  // Scale to 0-100
  return Math.round(logisticOutput * 100);
}

async function fetchChart(name, provenance, timespan = "90days") {
  const url = `https://api.blockchain.info/charts/${name}?timespan=${timespan}&format=json`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "btc-risk-dashboard" }, 
      cache: "no-store" 
    });
    const ms = Date.now() - t0;
    const txt = await res.text();
    
    if (!res.ok) { 
      provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) }); 
      return null; 
    }
    
    provenance.push({ url, ok: true, status: res.status, ms });
    
    let j = null;
    try { 
      j = JSON.parse(txt); 
    } catch { 
      return null; 
    }
    
    const vs = Array.isArray(j?.values) ? j.values : [];
    const xs = vs.map((p) => Number(p?.y)).filter(Number.isFinite);
    const ts = vs.map((p) => Number(p?.x) * 1000).filter(Number.isFinite);
    
    return { values: xs, timestamps: ts };
  } catch (e) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

async function fetchCoinbaseSpot() {
  try {
    const response = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
      headers: { "User-Agent": "btc-risk-dashboard" }
    });
    if (!response.ok) throw new Error(`Coinbase API ${response.status}`);
    const data = await response.json();
    return { usd: Number(data.price) };
  } catch (error) {
    console.warn('Coinbase spot fetch failed:', error);
    return { usd: NaN };
  }
}

export async function computeOnchain() {
  const provenance = [];
  const sourcesUsed = [];

  // --- mempool (MB) ---
  const mem = await fetchChart("mempool-size", provenance);
  const memMA7 = sma(mem?.values ?? [], 7);
  const memLast = memMA7.at(-1);
  let s_mempool = null;
  
  if (Number.isFinite(memLast)) {
    const pr = percentileRank(memMA7.filter(Number.isFinite), memLast);
    s_mempool = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: true, k: NORM.logistic_k }) : null;
    sourcesUsed.push("blockchain.info • mempool-size");
  }

  // --- fees: transaction-fees preferred (more reliable), fallback to fees-usd ---
  let feesUSDLast = null;
  let feesSeries = [];
  let feesSource = "";
  let feesPartial = false;

  // Try transaction-fees first (more reliable endpoint)
  const feesBtc = await fetchChart("transaction-fees", provenance);
  if (feesBtc?.values?.length) {
    const maBTC = sma(feesBtc.values, 7);
    const lastBTC = maBTC.at(-1);
    if (Number.isFinite(lastBTC)) {
      const spot = await fetchCoinbaseSpot();
      if (Number.isFinite(spot?.usd)) {
        feesUSDLast = lastBTC * spot.usd;
        // Build a comparable series just for percentile calc (scale BTC→USD by current spot)
        feesSeries = maBTC.map(v => Number.isFinite(v) ? v * spot.usd : NaN);
        feesSource = "blockchain.info • transaction-fees × spot";
      }
    }
  }

  // Fallback to fees-usd if transaction-fees failed
  if (!Number.isFinite(feesUSDLast)) {
    const feesUsd = await fetchChart("fees-usd", provenance);
    if (feesUsd?.values?.length) {
      feesSeries = sma(feesUsd.values, 7);
      const last = feesSeries.at(-1);
      if (Number.isFinite(last)) {
        feesUSDLast = last;
        feesSource = "blockchain.info • fees-usd (fallback)";
        feesPartial = true;
      }
    }
  }

  let s_fees = null;
  if (Number.isFinite(feesUSDLast) && feesSeries.length) {
    const pr = percentileRank(feesSeries.filter(Number.isFinite), feesUSDLast);
    s_fees = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: true, k: NORM.logistic_k }) : null;
    sourcesUsed.push(feesSource);
  }

  // --- Puell Multiple (miner revenue / 365-day SMA) ---
  const revenue = await fetchChart("miners-revenue", provenance, "3years");
  let s_puell = null;
  let puellLast = null;
  let puellPercentile = null;
  
  if (revenue?.values?.length && revenue.values.length >= 365) {
    const revenue365SMA = sma(revenue.values, 365);
    const puellSeries = [];
    
    // Calculate Puell Multiple for each day where we have both revenue and SMA
    for (let i = 0; i < revenue.values.length; i++) {
      if (Number.isFinite(revenue.values[i]) && Number.isFinite(revenue365SMA[i]) && revenue365SMA[i] > 0) {
        puellSeries.push(revenue.values[i] / revenue365SMA[i]);
      } else {
        puellSeries.push(NaN);
      }
    }
    
    const puellClean = puellSeries.filter(Number.isFinite);
    if (puellClean.length > 0) {
      puellLast = puellClean[puellClean.length - 1];
      puellPercentile = percentileRank(puellClean, puellLast);
      // Higher Puell Multiple = higher risk (inverted)
      s_puell = Number.isFinite(puellPercentile) ? riskFromPercentile(puellPercentile, { invert: false, k: NORM.logistic_k }) : null;
      sourcesUsed.push("blockchain.info • miners-revenue");
    }
  }

  // --- Partial data handling with re-normalized weights ---
  const availableComponents = [];
  const componentWeights = [];
  const componentNames = [];

  // Fees component (60% base weight)
  if (Number.isFinite(s_fees)) {
    availableComponents.push(s_fees);
    componentWeights.push(0.6);
    componentNames.push("fees");
  }

  // Mempool component (40% base weight)
  if (Number.isFinite(s_mempool)) {
    availableComponents.push(s_mempool);
    componentWeights.push(0.4);
    componentNames.push("mempool");
  }

  // Calculate score with re-normalized weights
  let score = null;
  let partialDataNote = "";
  
  if (availableComponents.length > 0) {
    // Re-normalize weights to sum to 1.0
    const weightSum = componentWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = componentWeights.map(w => w / weightSum);
    
    // Calculate weighted average
    const weightedSum = availableComponents.reduce((sum, component, i) => 
      sum + (component * normalizedWeights[i]), 0);
    score = Math.round(weightedSum);
    
    // Add partial data note if not all components available
    const missingComponents = [];
    if (!componentNames.includes("fees")) missingComponents.push("fees");
    if (!componentNames.includes("mempool")) missingComponents.push("mempool");
    
    if (missingComponents.length > 0) {
      partialDataNote = `Partial data (${missingComponents.join(", ")} unavailable)`;
    }
  }

  // Timestamp: use minimum of available data timestamps (youngest common denominator)
  const availableTimestamps = [];
  if (mem?.timestamps?.length) availableTimestamps.push(mem.timestamps.at(-1));
  if (feesBtc?.timestamps?.length) availableTimestamps.push(feesBtc.timestamps.at(-1));
  if (revenue?.timestamps?.length) availableTimestamps.push(revenue.timestamps.at(-1));
  
  const lastTs = availableTimestamps.length > 0 
    ? Math.min(...availableTimestamps) 
    : Date.now();
  const last_utc = new Date(lastTs).toISOString();

  // Build details with partial data indication
  const details = [
    { label: "Fees 7d avg (USD)", value: Number.isFinite(feesUSDLast) ? `$${Math.round(feesUSDLast).toLocaleString("en-US")}` : "—" },
    { label: "Mempool 7d avg (MB)", value: Number.isFinite(memLast) ? `${Math.round(memLast / 1_000_000)} MB` : "—" },
    { label: "Puell Multiple", value: Number.isFinite(puellLast) ? puellLast.toFixed(3) : "—" },
  ];

  // Add partial data note if applicable
  if (partialDataNote) {
    details.push({ label: "Note", value: partialDataNote });
  }

  return {
    score,
    reason: score !== null ? "success" : "failed",
    lastUpdated: last_utc,
    details,
    provenance,
    source: sourcesUsed.join(" + ") || "blockchain.info"
  };
}
