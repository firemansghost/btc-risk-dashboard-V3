// scripts/etl/fetch-helper.mjs
// Centralized fetch wrapper with retry/backoff and fallback handling

/**
 * Centralized fetch with retry/backoff and HTTP status classification
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options (headers, etc.)
 * @param {Object} config - Retry configuration
 * @param {number} config.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} config.baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @param {Function} config.onRetry - Optional callback on retry (attempt, error)
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    onRetry = null
  } = config;

  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'btc-risk-dashboard-etl',
          ...options.headers
        }
      });

      const status = response.status;

      // 429 Rate Limit: Use Retry-After header or exponential backoff
      if (status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Exponential with jitter
        
        if (attempt < maxRetries) {
          if (onRetry) onRetry(attempt, { status, retryAfter: delay });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // Final attempt failed with 429
        throw new Error(`Rate limited (429) after ${maxRetries} attempts`);
      }

      // 451/401/403: Skip immediately, mark as unavailable
      if ([451, 401, 403].includes(status)) {
        throw new Error(`Source unavailable (${status})`);
      }

      // 5xx Server Errors: Retry with backoff
      if (status >= 500 && status < 600) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          if (onRetry) onRetry(attempt, { status, delay });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Server error (${status}) after ${maxRetries} attempts`);
      }

      // 2xx/3xx/4xx (except handled above): Return response
      if (!response.ok && status >= 400) {
        throw new Error(`HTTP ${status}: ${response.statusText}`);
      }

      return response;

    } catch (error) {
      lastError = error;
      
      // Network errors: Retry with backoff
      if (error.message.includes('fetch') || error.message.includes('network') || !error.message.includes('HTTP')) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          if (onRetry) onRetry(attempt, { error: error.message, delay });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // If it's a 451/401/403, don't retry
      if (error.message.includes('451') || error.message.includes('401') || error.message.includes('403')) {
        throw error;
      }
      
      // Final attempt failed
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Fetch failed after all retries');
}

/**
 * Fetch JSON with retry/backoff
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} config - Retry configuration
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function fetchJsonWithRetry(url, options = {}, config = {}) {
  const response = await fetchWithRetry(url, options, config);
  return await response.json();
}

/**
 * Global fallback tracker for ETL summary
 */
export const fallbackTracker = {
  stablecoins: 0,
  etf: 0,
  macro: 0,
  term: 0,
  social: 0,
  onchain: 0
};

/**
 * Log a fallback warning
 * @param {string} factor - Factor name (stablecoins, etf, macro, term, social, onchain)
 * @param {string} provider - Provider that failed
 * @param {string} fallbackProvider - Fallback provider used
 */
export function logFallback(factor, provider, fallbackProvider) {
  fallbackTracker[factor] = (fallbackTracker[factor] || 0) + 1;
  console.log(`[ETL warn] ${factor}.${provider} degraded → fallback=${fallbackProvider}`);
}

/**
 * Reset fallback tracker (call at start of ETL run)
 */
export function resetFallbackTracker() {
  Object.keys(fallbackTracker).forEach(key => {
    fallbackTracker[key] = 0;
  });
}

