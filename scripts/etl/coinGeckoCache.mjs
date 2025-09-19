// scripts/etl/coinGeckoCache.mjs
// Centralized CoinGecko API client with rate limiting, caching, and retry logic

import fs from 'node:fs/promises';
import path from 'node:path';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between calls
const MAX_RETRIES = 3;
const CACHE_TTL_MINUTES = 30; // Cache data for 30 minutes
const CACHE_DIR = 'public/data/cache';

let lastApiCall = 0;
const cache = new Map();

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.warn('Failed to create cache directory:', error.message);
  }
}

/**
 * Generate cache key for a URL
 */
function getCacheKey(url) {
  return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
}

/**
 * Load cached data from disk
 */
async function loadFromDiskCache(cacheKey) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    const stats = await fs.stat(cacheFile);
    const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
    
    if (ageMinutes <= CACHE_TTL_MINUTES) {
      const content = await fs.readFile(cacheFile, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    // Cache miss or expired
  }
  return null;
}

/**
 * Save data to disk cache
 */
async function saveToDiskCache(cacheKey, data) {
  try {
    await ensureCacheDir();
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('Failed to save to disk cache:', error.message);
  }
}

/**
 * Rate-limited fetch with retry logic
 */
async function rateLimitedFetch(url, options = {}) {
  // Enforce rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastCall;
    console.log(`CoinGecko rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastApiCall = Date.now();

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'btc-risk-etl',
          ...options.headers
        }
      });

      if (response.ok) {
        return await response.json();
      } else if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.log(`CoinGecko 429 rate limit, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error(`CoinGecko ${response.status}`);
        continue;
      } else {
        throw new Error(`CoinGecko ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`CoinGecko error, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Cached CoinGecko API client
 */
export class CoinGeckoClient {
  /**
   * Get Bitcoin market chart data with caching
   * @param {number} days - Number of days of data
   * @param {string} interval - Data interval (daily, hourly)
   * @returns {Promise<Object>} Market chart data
   */
  async getMarketChart(days, interval = 'daily') {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=${interval}`;
    const cacheKey = getCacheKey(`market_chart_${days}_${interval}`);
    
    // Check memory cache first
    const memoryCache = cache.get(cacheKey);
    if (memoryCache && (Date.now() - memoryCache.timestamp) < CACHE_TTL_MINUTES * 60 * 1000) {
      console.log(`CoinGecko cache hit (memory): market_chart ${days}d ${interval}`);
      return memoryCache.data;
    }

    // Check disk cache
    const diskCache = await loadFromDiskCache(cacheKey);
    if (diskCache) {
      console.log(`CoinGecko cache hit (disk): market_chart ${days}d ${interval}`);
      // Update memory cache
      cache.set(cacheKey, { data: diskCache, timestamp: Date.now() });
      return diskCache;
    }

    // Fetch from API
    console.log(`CoinGecko API call: market_chart ${days}d ${interval}`);
    const data = await rateLimitedFetch(url);
    
    // Cache the result
    const cacheEntry = { data, timestamp: Date.now() };
    cache.set(cacheKey, cacheEntry);
    await saveToDiskCache(cacheKey, data);
    
    return data;
  }

  /**
   * Get trending search data with caching
   * @returns {Promise<Object>} Trending data
   */
  async getTrending() {
    const url = 'https://api.coingecko.com/api/v3/search/trending';
    const cacheKey = getCacheKey('trending');
    
    // Check memory cache first
    const memoryCache = cache.get(cacheKey);
    if (memoryCache && (Date.now() - memoryCache.timestamp) < CACHE_TTL_MINUTES * 60 * 1000) {
      console.log('CoinGecko cache hit (memory): trending');
      return memoryCache.data;
    }

    // Check disk cache
    const diskCache = await loadFromDiskCache(cacheKey);
    if (diskCache) {
      console.log('CoinGecko cache hit (disk): trending');
      // Update memory cache
      cache.set(cacheKey, { data: diskCache, timestamp: Date.now() });
      return diskCache;
    }

    // Fetch from API
    console.log('CoinGecko API call: trending');
    const data = await rateLimitedFetch(url);
    
    // Cache the result
    const cacheEntry = { data, timestamp: Date.now() };
    cache.set(cacheKey, cacheEntry);
    await saveToDiskCache(cacheKey, data);
    
    return data;
  }

  /**
   * Get yesterday's Bitcoin close price
   * @returns {Promise<Object>} Price data with timestamp and close price
   */
  async getYesterdayClose() {
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily';
    const cacheKey = getCacheKey('yesterday_close');
    
    // Check memory cache first
    const memoryCache = cache.get(cacheKey);
    if (memoryCache && (Date.now() - memoryCache.timestamp) < CACHE_TTL_MINUTES * 60 * 1000) {
      console.log('CoinGecko cache hit (memory): yesterday_close');
      return memoryCache.data;
    }

    // Check disk cache
    const diskCache = await loadFromDiskCache(cacheKey);
    if (diskCache) {
      console.log('CoinGecko cache hit (disk): yesterday_close');
      // Update memory cache
      cache.set(cacheKey, { data: diskCache, timestamp: Date.now() });
      return diskCache;
    }

    // Fetch from API
    console.log('CoinGecko API call: yesterday_close');
    const data = await rateLimitedFetch(url);
    
    if (!data.prices || !Array.isArray(data.prices) || data.prices.length < 2) {
      throw new Error('Invalid price data from CoinGecko');
    }

    // Get yesterday's price (second to last)
    const yesterdayPrice = data.prices[data.prices.length - 2];
    const result = {
      timestamp: yesterdayPrice[0],
      close: Number(yesterdayPrice[1])
    };
    
    // Cache the result
    const cacheEntry = { data: result, timestamp: Date.now() };
    cache.set(cacheKey, cacheEntry);
    await saveToDiskCache(cacheKey, result);
    
    return result;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    cache.clear();
    console.log('CoinGecko cache cleared');
  }
}

// Export singleton instance
export const coinGecko = new CoinGeckoClient();
