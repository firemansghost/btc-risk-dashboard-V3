// scripts/etl/priceHistory.mjs
// Unified BTC price history management with Coinbase as primary source

import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * CSV Schema for btc_price_history.csv:
 * date_utc,close_usd,source,ingested_at_utc
 */

const CSV_PATH = '../../public/data/btc_price_history.csv';
const CSV_HEADER = 'date_utc,close_usd,source,ingested_at_utc';

/**
 * Load existing price history from CSV
 * @returns {Array} Array of price records {date_utc, close_usd, source, ingested_at_utc}
 */
export async function loadPriceHistory() {
  const records = [];
  
  try {
    const fileStream = createReadStream(CSV_PATH);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isFirstLine = true;
    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        continue; // Skip header
      }
      
      if (line.trim()) {
        const [date_utc, close_usd, source, ingested_at_utc] = line.split(',');
        records.push({
          date_utc: date_utc.trim(),
          close_usd: parseFloat(close_usd),
          source: source.trim(),
          ingested_at_utc: ingested_at_utc.trim()
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading price history:', error.message);
    }
    // Return empty array if file doesn't exist
  }

  // Sort by date ascending
  return records.sort((a, b) => a.date_utc.localeCompare(b.date_utc));
}

/**
 * Save price history to CSV
 * @param {Array} records - Array of price records
 */
export async function savePriceHistory(records) {
  // Ensure directory exists
  await fs.mkdir('../../public/data', { recursive: true });
  
  // Sort by date ascending and deduplicate
  const uniqueRecords = new Map();
  
  // Process records with source precedence (coinbase wins)
  for (const record of records) {
    const existing = uniqueRecords.get(record.date_utc);
    if (!existing || record.source === 'coinbase') {
      uniqueRecords.set(record.date_utc, record);
    }
  }
  
  // Convert to sorted array
  const sortedRecords = Array.from(uniqueRecords.values())
    .sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  
  // Write CSV
  const lines = [CSV_HEADER];
  for (const record of sortedRecords) {
    lines.push(`${record.date_utc},${record.close_usd},${record.source},${record.ingested_at_utc}`);
  }
  
  await fs.writeFile(CSV_PATH, lines.join('\n'));
  
  console.log(`Price history saved: ${sortedRecords.length} records (${CSV_PATH})`);
  return {
    total_rows: sortedRecords.length,
    oldest_date: sortedRecords[0]?.date_utc,
    newest_date: sortedRecords[sortedRecords.length - 1]?.date_utc
  };
}

/**
 * Fetch extended historical data from Coinbase
 * Coinbase has data going back to ~2015, which is sufficient for our needs
 * @param {number} days - Number of days to fetch (minimum 700)
 * @returns {Object} {success, data, provenance}
 */
export async function fetchCoinbaseHistoricalBackfill(days = 730) {
  const startTime = Date.now();
  
  const provenance = {
    endpoint: 'coinbase_historical_backfill',
    requested_days: days,
    ok: false,
    status: 0,
    ms: 0,
    rows_fetched: 0
  };

  try {
    console.log(`Coinbase: Fetching ${days}+ days of historical BTC price data...`);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days + 30) * 86400000); // Add 30 day buffer
    
    // Coinbase API has a 300 candle limit, so we need to make multiple requests
    const allRecords = [];
    let currentStart = startDate;
    let requestCount = 0;
    const maxRequests = 10; // Safety limit
    
    while (currentStart < endDate && requestCount < maxRequests) {
      // Calculate end date for this chunk (300 days max per request)
      const chunkEnd = new Date(Math.min(
        currentStart.getTime() + 299 * 86400000, // 299 days (under 300 limit)
        endDate.getTime()
      ));
      
      console.log(`Coinbase: Fetching chunk ${requestCount + 1} (${currentStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]})...`);
      
      const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
      url.searchParams.set("granularity", "86400"); // Daily candles
      url.searchParams.set("start", currentStart.toISOString());
      url.searchParams.set("end", chunkEnd.toISOString());

      const response = await fetch(url.toString(), { 
        headers: { "User-Agent": "btc-risk-dashboard-historical-backfill" } 
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coinbase API ${response.status}: ${errorText}`);
      }

      const candles = await response.json();
      
      // Convert Coinbase candles to our format
      // Coinbase format: [timestamp, low, high, open, close, volume]
      for (const candle of candles) {
        const [timestamp, , , , close] = candle;
        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        if (Number.isFinite(close) && close > 0) {
          allRecords.push({
            date_utc: dateStr,
            close_usd: close,
            source: 'coinbase_historical',
            ingested_at_utc: new Date().toISOString()
          });
        }
      }
      
      console.log(`Coinbase: Chunk ${requestCount + 1} returned ${candles.length} records`);
      
      // Move to next chunk
      currentStart = new Date(chunkEnd.getTime() + 86400000); // Next day
      requestCount++;
      
      // Add small delay between requests to be respectful
      if (currentStart < endDate) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Remove duplicates and sort by date
    const uniqueRecords = new Map();
    for (const record of allRecords) {
      if (!uniqueRecords.has(record.date_utc) || 
          uniqueRecords.get(record.date_utc).close_usd === 0) {
        uniqueRecords.set(record.date_utc, record);
      }
    }
    
    const sortedRecords = Array.from(uniqueRecords.values())
      .sort((a, b) => a.date_utc.localeCompare(b.date_utc));
    
    // Filter to requested timeframe
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    const filteredRecords = sortedRecords.filter(record => record.date_utc >= cutoffDateStr);
    
    provenance.ok = true;
    provenance.status = 200;
    provenance.ms = Date.now() - startTime;
    provenance.rows_fetched = filteredRecords.length;
    
    console.log(`Coinbase: Successfully fetched ${filteredRecords.length} historical records`);
    console.log(`Date range: ${filteredRecords[0]?.date_utc} to ${filteredRecords[filteredRecords.length - 1]?.date_utc}`);

    return {
      success: true,
      data: filteredRecords,
      provenance
    };

  } catch (error) {
    provenance.error = error.message;
    provenance.ms = Date.now() - startTime;
    
    console.error('Coinbase historical backfill failed:', error.message);
    
    return {
      success: false,
      reason: error.message,
      data: [],
      provenance
    };
  }
}

/**
 * Fetch recent Coinbase daily candles and convert to our CSV format
 * @param {number} days - Number of recent days to fetch
 * @returns {Object} {success, data, provenance}
 */
export async function fetchRecentCoinbaseData(days = 14) {
  const startTime = Date.now();
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 86400000);
  
  const provenance = {
    endpoint: 'coinbase_daily_candles',
    requested_days: days,
    ok: false,
    status: 0,
    ms: 0,
    rows_fetched: 0
  };

  try {
    const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
    url.searchParams.set("granularity", "86400");
    url.searchParams.set("start", startDate.toISOString());
    url.searchParams.set("end", now.toISOString());

    console.log(`Coinbase: Fetching last ${days} days of daily candles...`);

    const response = await fetch(url.toString(), { 
      headers: { "User-Agent": "btc-risk-dashboard-price-history" } 
    });

    provenance.status = response.status;
    provenance.ms = Date.now() - startTime;
    provenance.url_masked = url.toString();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coinbase API ${response.status}: ${errorText}`);
    }

    const rawCandles = await response.json();
    provenance.ok = true;

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      throw new Error('Invalid or empty response from Coinbase API');
    }

    // Convert Coinbase format [timestamp, low, high, open, close, volume] to our format
    const records = rawCandles
      .map(candle => {
        if (!Array.isArray(candle) || candle.length < 6) {
          return null;
        }
        
        const timestamp = candle[0] * 1000; // Convert to milliseconds
        const close = Number(candle[4]);
        
        if (!Number.isFinite(close) || close <= 0) {
          return null;
        }
        
        // Convert timestamp to UTC date string (YYYY-MM-DD)
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];
        
        return {
          date_utc: dateStr,
          close_usd: close,
          source: 'coinbase',
          ingested_at_utc: new Date().toISOString()
        };
      })
      .filter(record => record !== null)
      .sort((a, b) => a.date_utc.localeCompare(b.date_utc));

    provenance.rows_fetched = records.length;
    
    console.log(`Coinbase: Successfully fetched ${records.length} daily records`);
    if (records.length > 0) {
      console.log(`Date range: ${records[0].date_utc} to ${records[records.length - 1].date_utc}`);
    }

    return {
      success: true,
      data: records,
      provenance
    };

  } catch (error) {
    provenance.error = error.message;
    provenance.ms = Date.now() - startTime;
    
    console.error('Coinbase recent data fetch failed:', error.message);
    
    return {
      success: false,
      reason: error.message,
      data: [],
      provenance
    };
  }
}


/**
 * Main function to manage price history (backfill + daily updates)
 * @returns {Object} Operation results and provenance
 */
export async function managePriceHistory() {
  console.log('Price History: Starting management process...');
  
  const results = {
    existing_rows: 0,
    coinbase_historical_backfill: null,
    coinbase_daily_update: null,
    final_stats: null
  };
  
  // 1. Load existing price history
  const existingRecords = await loadPriceHistory();
  results.existing_rows = existingRecords.length;
  
  console.log(`Price History: Loaded ${existingRecords.length} existing records`);
  
  // 2. Determine if we need historical backfill
  const needsBackfill = existingRecords.length < 500; // Target ≥700, minimum 500
  let allRecords = [...existingRecords];
  
  if (needsBackfill) {
    console.log('Price History: Insufficient data, performing Coinbase historical backfill...');
    
    const backfillResult = await fetchCoinbaseHistoricalBackfill(730);
    results.coinbase_historical_backfill = backfillResult;
    
    if (backfillResult.success) {
      // Add backfill data to our records
      allRecords = [...allRecords, ...backfillResult.data];
      console.log(`Price History: Added ${backfillResult.data.length} historical backfill records`);
    }
  } else {
    console.log('Price History: Sufficient data exists, skipping backfill');
  }
  
  // 3. Fetch recent Coinbase data
  console.log('Price History: Fetching recent Coinbase data...');
  const coinbaseResult = await fetchRecentCoinbaseData(14);
  results.coinbase_daily_update = coinbaseResult;
  
  if (coinbaseResult.success) {
    // Add Coinbase data to our records
    allRecords = [...allRecords, ...coinbaseResult.data];
    console.log(`Price History: Added ${coinbaseResult.data.length} Coinbase records`);
  }
  
  // 4. Save unified price history
  if (allRecords.length > results.existing_rows) {
    const saveResult = await savePriceHistory(allRecords);
    results.final_stats = saveResult;
    console.log(`Price History: Management complete - ${saveResult.total_rows} total records`);
  } else {
    console.log('Price History: No new data to save');
    results.final_stats = {
      total_rows: results.existing_rows,
      oldest_date: existingRecords[0]?.date_utc,
      newest_date: existingRecords[existingRecords.length - 1]?.date_utc
    };
  }
  
  return results;
}
