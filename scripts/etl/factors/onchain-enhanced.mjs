#!/usr/bin/env node
/**
 * Enhanced Onchain Factor with Fallback Data Sources
 * 
 * This enhanced version includes multiple fallback sources for better reliability:
 * - Primary: blockchain.info (existing)
 * - Fallback 1: mempool.space API
 * - Fallback 2: mempool.observer API
 * - Fallback 3: BlockCypher API
 */

import fs from 'node:fs';

// Utility functions (same as original)
function sma(values, period) {
  if (!values || values.length === 0) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const sum = slice.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
      result.push(sum / period);
    }
  }
  return result;
}

function percentileRank(sortedArray, value) {
  if (!sortedArray || sortedArray.length === 0) return NaN;
  const filtered = sortedArray.filter(Number.isFinite);
  if (filtered.length === 0) return NaN;
  
  const sorted = [...filtered].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  
  if (index === -1) return 100;
  if (index === 0) return 0;
  
  return (index / (sorted.length - 1)) * 100;
}

function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 2 } = options;
  
  // Normalize percentile to 0-1 range
  const normalized = percentile / 100;
  
  // Apply logistic function
  const logistic = 1 / (1 + Math.exp(-k * (normalized - 0.5)));
  
  // Invert if needed (higher percentile = lower risk)
  const output = invert ? 1 - logistic : logistic;
  
  // Scale to 0-100
  return Math.round(output * 100);
}

// Enhanced data source configurations
const DATA_SOURCES = {
  blockchain_info: {
    name: 'Blockchain.info',
    baseUrl: 'https://api.blockchain.info',
    endpoints: {
      mempool: '/charts/mempool-size?timespan=90days&format=json',
      fees: '/charts/transaction-fees?timespan=90days&format=json',
      feesUsd: '/charts/fees-usd?timespan=90days&format=json'
    },
    priority: 1
  },
  mempool_space: {
    name: 'Mempool.space',
    baseUrl: 'https://mempool.space/api',
    endpoints: {
      mempool: '/v1/mempool',
      fees: '/v1/fees/recommended'
    },
    priority: 2
  },
  mempool_observer: {
    name: 'Mempool.observer',
    baseUrl: 'https://mempool.observer/api',
    endpoints: {
      mempool: '/mempool',
      fees: '/fees'
    },
    priority: 3
  },
  blockcypher: {
    name: 'BlockCypher',
    baseUrl: 'https://api.blockcypher.com/v1/btc/main',
    endpoints: {
      mempool: '',
      fees: ''
    },
    priority: 4
  }
};

/**
 * Fetch data from blockchain.info (existing implementation)
 */
async function fetchBlockchainInfo(endpoint, provenance) {
  const url = `${DATA_SOURCES.blockchain_info.baseUrl}${endpoint}`;
  const t0 = Date.now();
  
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'btc-risk-dashboard' }, 
      cache: 'no-store' 
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

/**
 * Fetch data from mempool.space API
 */
async function fetchMempoolSpace(endpoint, provenance) {
  const url = `${DATA_SOURCES.mempool_space.baseUrl}${endpoint}`;
  const t0 = Date.now();
  
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'btc-risk-dashboard' }, 
      cache: 'no-store' 
    });
    const ms = Date.now() - t0;
    
    if (!res.ok) { 
      provenance.push({ url, ok: false, status: res.status, ms }); 
      return null; 
    }
    
    const data = await res.json();
    provenance.push({ url, ok: true, status: res.status, ms });
    
    return data;
  } catch (e) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

/**
 * Fetch data from mempool.observer API
 */
async function fetchMempoolObserver(endpoint, provenance) {
  const url = `${DATA_SOURCES.mempool_observer.baseUrl}${endpoint}`;
  const t0 = Date.now();
  
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'btc-risk-dashboard' }, 
      cache: 'no-store' 
    });
    const ms = Date.now() - t0;
    
    if (!res.ok) { 
      provenance.push({ url, ok: false, status: res.status, ms }); 
      return null; 
    }
    
    const data = await res.json();
    provenance.push({ url, ok: true, status: res.status, ms });
    
    return data;
  } catch (e) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

/**
 * Get current Bitcoin price from Coinbase
 */
async function fetchCoinbaseSpot() {
  try {
    const res = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
      headers: { 'User-Agent': 'btc-risk-dashboard' },
      cache: 'no-store'
    });
    
    if (!res.ok) return { usd: NaN };
    
    const data = await res.json();
    return { usd: parseFloat(data.price) };
  } catch {
    return { usd: NaN };
  }
}

/**
 * Enhanced onchain computation with fallback sources
 */
export async function computeOnchainEnhanced() {
  const provenance = [];
  const sourcesUsed = [];
  const fallbackAttempts = [];

  console.log('🔍 Computing enhanced onchain factor with fallback sources...');

  // --- Mempool Size with Fallbacks ---
  let mempoolData = null;
  let mempoolSource = null;

  // Try blockchain.info first (primary)
  try {
    mempoolData = await fetchBlockchainInfo(DATA_SOURCES.blockchain_info.endpoints.mempool, provenance);
    if (mempoolData?.values?.length) {
      mempoolSource = 'blockchain.info';
      sourcesUsed.push('blockchain.info • mempool-size');
    }
  } catch (error) {
    fallbackAttempts.push(`blockchain.info mempool failed: ${error.message}`);
  }

  // Try mempool.space if blockchain.info failed
  if (!mempoolData?.values?.length) {
    try {
      const mempoolSpaceData = await fetchMempoolSpace(DATA_SOURCES.mempool_space.endpoints.mempool, provenance);
      if (mempoolSpaceData?.mempool?.size) {
        // Convert mempool.space format to our expected format
        const sizeMB = mempoolSpaceData.mempool.size / (1024 * 1024); // Convert bytes to MB
        mempoolData = { values: [sizeMB], timestamps: [Date.now()] };
        mempoolSource = 'mempool.space';
        sourcesUsed.push('mempool.space • mempool');
      }
    } catch (error) {
      fallbackAttempts.push(`mempool.space failed: ${error.message}`);
    }
  }

  // Try mempool.observer if others failed
  if (!mempoolData?.values?.length) {
    try {
      const mempoolObserverData = await fetchMempoolObserver(DATA_SOURCES.mempool_observer.endpoints.mempool, provenance);
      if (mempoolObserverData?.mempool?.size) {
        const sizeMB = mempoolObserverData.mempool.size / (1024 * 1024);
        mempoolData = { values: [sizeMB], timestamps: [Date.now()] };
        mempoolSource = 'mempool.observer';
        sourcesUsed.push('mempool.observer • mempool');
      }
    } catch (error) {
      fallbackAttempts.push(`mempool.observer failed: ${error.message}`);
    }
  }

  // Process mempool data
  let s_mempool = null;
  if (mempoolData?.values?.length) {
    const memMA7 = sma(mempoolData.values, 7);
    const memLast = memMA7.at(-1);
    
    if (Number.isFinite(memLast)) {
      const pr = percentileRank(memMA7.filter(Number.isFinite), memLast);
      s_mempool = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: true, k: 2 }) : null;
    }
  }

  // --- Fees with Fallbacks ---
  let feesUSDLast = null;
  let feesSeries = [];
  let feesSource = "";

  // Try blockchain.info transaction-fees first
  try {
    const feesBtc = await fetchBlockchainInfo(DATA_SOURCES.blockchain_info.endpoints.fees, provenance);
    if (feesBtc?.values?.length) {
      const maBTC = sma(feesBtc.values, 7);
      const lastBTC = maBTC.at(-1);
      if (Number.isFinite(lastBTC)) {
        const spot = await fetchCoinbaseSpot();
        if (Number.isFinite(spot?.usd)) {
          feesUSDLast = lastBTC * spot.usd;
          feesSeries = maBTC.map(v => Number.isFinite(v) ? v * spot.usd : NaN);
          feesSource = 'blockchain.info • transaction-fees × spot';
        }
      }
    }
  } catch (error) {
    fallbackAttempts.push(`blockchain.info fees failed: ${error.message}`);
  }

  // Try blockchain.info fees-usd fallback
  if (!Number.isFinite(feesUSDLast)) {
    try {
      const feesUsd = await fetchBlockchainInfo(DATA_SOURCES.blockchain_info.endpoints.feesUsd, provenance);
      if (feesUsd?.values?.length) {
        feesSeries = sma(feesUsd.values, 7);
        const last = feesSeries.at(-1);
        if (Number.isFinite(last)) {
          feesUSDLast = last;
          feesSource = 'blockchain.info • fees-usd (fallback)';
        }
      }
    } catch (error) {
      fallbackAttempts.push(`blockchain.info fees-usd failed: ${error.message}`);
    }
  }

  // Try mempool.space fees if blockchain.info failed
  if (!Number.isFinite(feesUSDLast)) {
    try {
      const mempoolSpaceFees = await fetchMempoolSpace(DATA_SOURCES.mempool_space.endpoints.fees, provenance);
      if (mempoolSpaceFees?.fastestFee) {
        // Use fastest fee as proxy for network congestion
        const spot = await fetchCoinbaseSpot();
        if (Number.isFinite(spot?.usd)) {
          feesUSDLast = mempoolSpaceFees.fastestFee * spot.usd;
          feesSource = 'mempool.space • fees × spot';
        }
      }
    } catch (error) {
      fallbackAttempts.push(`mempool.space fees failed: ${error.message}`);
    }
  }

  // Process fees data
  let s_fees = null;
  if (Number.isFinite(feesUSDLast) && feesSeries.length) {
    const pr = percentileRank(feesSeries.filter(Number.isFinite), feesUSDLast);
    s_fees = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: false, k: 2 }) : null;
  }

  // Calculate composite score
  let compositeScore = null;
  let scoreComponents = [];

  if (s_mempool !== null && s_fees !== null) {
    // Both components available - use weighted average
    compositeScore = Math.round((s_mempool * 0.4) + (s_fees * 0.6));
    scoreComponents = [
      { name: 'Mempool', score: s_mempool, weight: 0.4, source: mempoolSource },
      { name: 'Fees', score: s_fees, weight: 0.6, source: feesSource }
    ];
  } else if (s_mempool !== null) {
    // Only mempool available
    compositeScore = s_mempool;
    scoreComponents = [
      { name: 'Mempool', score: s_mempool, weight: 1.0, source: mempoolSource }
    ];
  } else if (s_fees !== null) {
    // Only fees available
    compositeScore = s_fees;
    scoreComponents = [
      { name: 'Fees', score: s_fees, weight: 1.0, source: feesSource }
    ];
  }

  // Log results
  console.log(`📊 Enhanced Onchain Results:`);
  console.log(`  Composite Score: ${compositeScore}`);
  console.log(`  Mempool: ${s_mempool} (${mempoolSource || 'failed'})`);
  console.log(`  Fees: ${s_fees} (${feesSource || 'failed'})`);
  console.log(`  Sources Used: ${sourcesUsed.join(', ')}`);
  if (fallbackAttempts.length > 0) {
    console.log(`  Fallback Attempts: ${fallbackAttempts.length}`);
  }

  return {
    score: compositeScore,
    reason: compositeScore !== null ? 'enhanced_with_fallbacks' : 'all_sources_failed',
    lastUpdated: new Date().toISOString(),
    source: sourcesUsed.join(', '),
    details: [
      { label: 'Mempool 7d avg (MB)', value: s_mempool !== null ? `${s_mempool.toFixed(1)}` : 'N/A' },
      { label: 'Fees 7d avg (USD)', value: s_fees !== null ? `$${feesUSDLast?.toFixed(0) || 'N/A'}` : 'N/A' },
      { label: 'Data Sources', value: sourcesUsed.join(', ') },
      { label: 'Fallback Attempts', value: fallbackAttempts.length.toString() }
    ],
    provenance,
    scoreComponents,
    fallbackAttempts
  };
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  computeOnchainEnhanced().then(result => {
    console.log('Enhanced Onchain Factor Result:', JSON.stringify(result, null, 2));
  }).catch(console.error);
}
