/**
 * CoinGecko disk-cache helpers: freshness comes from cachedAt in file content,
 * never from filesystem mtime (checkout can refresh mtime on stale payloads).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export const RATE_LIMIT_DELAY = 1500;
export const MAX_RETRIES = 3;
export const CACHE_TTL_MINUTES = 30;
export const CACHE_DIR = 'public/data/cache';

let lastApiCall = 0;
const memoryCache = new Map();

export function getCacheKey(url) {
  return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
}

export function isCoinGeckoDiskCacheEnvelope(parsed) {
  return Boolean(
    parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.prototype.hasOwnProperty.call(parsed, 'data') &&
      typeof parsed.cachedAt === 'string'
  );
}

export function wrapDiskCacheEnvelope(data, cachedAt) {
  return {
    cachedAt,
    data,
  };
}

/**
 * Decide whether a parsed disk file is a usable cache hit.
 * Legacy raw CoinGecko payloads (no cachedAt) are always a miss.
 */
export function evaluateDiskCacheEntry(parsed, { nowMs = Date.now(), ttlMinutes = CACHE_TTL_MINUTES } = {}) {
  if (!isCoinGeckoDiskCacheEnvelope(parsed)) {
    return { hit: false, reason: 'legacy_raw_payload', data: null };
  }
  const cachedAtMs = Date.parse(parsed.cachedAt);
  if (!Number.isFinite(cachedAtMs)) {
    return { hit: false, reason: 'invalid_cachedAt', data: null };
  }
  const ageMinutes = (nowMs - cachedAtMs) / (1000 * 60);
  if (ageMinutes > ttlMinutes) {
    return { hit: false, reason: 'expired_cachedAt', data: null };
  }
  return { hit: true, reason: 'fresh_cachedAt', data: parsed.data };
}

async function ensureCacheDir(cacheDir = CACHE_DIR) {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (error) {
    console.warn('Failed to create cache directory:', error.message);
  }
}

export async function loadFromDiskCache(
  cacheKey,
  { cacheDir = CACHE_DIR, nowMs = Date.now(), ttlMinutes = CACHE_TTL_MINUTES } = {}
) {
  try {
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
    const content = await fs.readFile(cacheFile, 'utf8');
    const parsed = JSON.parse(content);
    const evaluated = evaluateDiskCacheEntry(parsed, { nowMs, ttlMinutes });
    if (!evaluated.hit) return null;
    return evaluated.data;
  } catch {
    return null;
  }
}

export async function saveToDiskCache(
  cacheKey,
  data,
  { cacheDir = CACHE_DIR, cachedAt = new Date().toISOString() } = {}
) {
  try {
    await ensureCacheDir(cacheDir);
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
    const envelope = wrapDiskCacheEnvelope(data, cachedAt);
    await fs.writeFile(cacheFile, JSON.stringify(envelope, null, 2));
    return envelope;
  } catch (error) {
    console.warn('Failed to save to disk cache:', error.message);
    return null;
  }
}

export function resetCoinGeckoMemoryCache() {
  memoryCache.clear();
}

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastCall;
    console.log(`CoinGecko rate limiting: waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastApiCall = Date.now();

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'btc-risk-etl',
          ...options.headers,
        },
      });

      if (response.ok) {
        return await response.json();
      } else if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 2000;
        console.log(
          `CoinGecko 429 rate limit, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        lastError = new Error(`CoinGecko ${response.status}`);
        continue;
      } else {
        throw new Error(`CoinGecko ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(
          `CoinGecko error, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export class CoinGeckoClient {
  constructor({ cacheDir = CACHE_DIR, now = () => Date.now(), memory = memoryCache } = {}) {
    this.cacheDir = cacheDir;
    this.now = now;
    this.memory = memory;
  }

  async #fromCaches(cacheKey, logLabel) {
    const nowMs = this.now();
    const mem = this.memory.get(cacheKey);
    if (mem && nowMs - mem.timestamp < CACHE_TTL_MINUTES * 60 * 1000) {
      console.log(`CoinGecko cache hit (memory): ${logLabel}`);
      return mem.data;
    }
    const disk = await loadFromDiskCache(cacheKey, { cacheDir: this.cacheDir, nowMs });
    if (disk != null) {
      console.log(`CoinGecko cache hit (disk): ${logLabel}`);
      this.memory.set(cacheKey, { data: disk, timestamp: nowMs });
      return disk;
    }
    return null;
  }

  async #store(cacheKey, data) {
    const nowMs = this.now();
    this.memory.set(cacheKey, { data, timestamp: nowMs });
    await saveToDiskCache(cacheKey, data, {
      cacheDir: this.cacheDir,
      cachedAt: new Date(nowMs).toISOString(),
    });
  }

  async getMarketChart(days, interval = 'daily') {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=${interval}`;
    const cacheKey = getCacheKey(`market_chart_${days}_${interval}`);
    const cached = await this.#fromCaches(cacheKey, `market_chart ${days}d ${interval}`);
    if (cached) return cached;

    console.log(`CoinGecko API call: market_chart ${days}d ${interval}`);
    const data = await rateLimitedFetch(url);
    await this.#store(cacheKey, data);
    return data;
  }

  async getTrending() {
    const url = 'https://api.coingecko.com/api/v3/search/trending';
    const cacheKey = getCacheKey('trending');
    const cached = await this.#fromCaches(cacheKey, 'trending');
    if (cached) return cached;

    console.log('CoinGecko API call: trending');
    const data = await rateLimitedFetch(url);
    await this.#store(cacheKey, data);
    return data;
  }

  async getYesterdayClose() {
    const url =
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily';
    const cacheKey = getCacheKey('yesterday_close');
    const cached = await this.#fromCaches(cacheKey, 'yesterday_close');
    if (cached) return cached;

    console.log('CoinGecko API call: yesterday_close');
    const data = await rateLimitedFetch(url);

    if (!data.prices || !Array.isArray(data.prices) || data.prices.length < 2) {
      throw new Error('Invalid price data from CoinGecko');
    }

    const yesterdayPrice = data.prices[data.prices.length - 2];
    const result = {
      timestamp: yesterdayPrice[0],
      close: Number(yesterdayPrice[1]),
    };
    await this.#store(cacheKey, result);
    return result;
  }

  clearCache() {
    this.memory.clear();
    console.log('CoinGecko cache cleared');
  }
}

export const coinGecko = new CoinGeckoClient();
