// Shared CoinGecko pacing for the four v1.2 factors.
// A per-factor delay is not enough: computeAllFactors runs them concurrently.
// This queue is the single start gate for api.coingecko.com.

export const COINGECKO_PACE_MS = 2_000;
export const COINGECKO_MAX_ATTEMPTS = 3;
export const COINGECKO_RETRY_BASE_MS = 1_500;
export const COINGECKO_RETRY_AFTER_BUDGET_MS = 30_000;

const runtime = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
};

let chain = Promise.resolve();
let nextStartMs = 0;

export function configureAcquisitionRuntime({ sleep, now } = {}) {
  if (typeof sleep === 'function') runtime.sleep = sleep;
  if (typeof now === 'function') runtime.now = now;
}

export function resetAcquisitionQueue() {
  chain = Promise.resolve();
  nextStartMs = 0;
}

export function acquisitionNow() {
  return runtime.now();
}

export function isCoinGeckoUrl(resource) {
  try {
    return new URL(String(resource)).hostname === 'api.coingecko.com';
  } catch {
    return false;
  }
}

function retryAfterDelay(response, nowMs) {
  const header = response?.headers?.get?.('Retry-After');
  const raw = header == null || header === '' ? response?.retryAfter ?? null : header;
  if (raw == null || String(raw).trim() === '') return { raw: null, delayMs: null, valid: false };
  const text = String(raw).trim();
  if (/^\d+$/.test(text)) return { raw: text, delayMs: Number(text) * 1000, valid: true };
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return { raw: text, delayMs: null, valid: false };
  return { raw: text, delayMs: Math.max(0, parsed - nowMs), valid: true };
}

async function paceCoinGecko() {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const previous = chain;
  chain = previous.then(() => gate);
  await previous;
  try {
    const wait = Math.max(0, nextStartMs - runtime.now().getTime());
    if (wait > 0) await runtime.sleep(wait);
    nextStartMs = runtime.now().getTime() + COINGECKO_PACE_MS;
  } finally {
    release();
  }
}

function backoffMs(attempt) {
  return COINGECKO_RETRY_BASE_MS * (2 ** (attempt - 1));
}

/**
 * Pace and retry one CoinGecko call.
 * HTTP 429 stays on the returned response. It is never thrown as a network error.
 * A Retry-After above COINGECKO_RETRY_AFTER_BUDGET_MS ends the call without sleeping.
 */
export async function fetchCoinGecko(url, init, fetchImpl) {
  const attempts = [];
  for (let attempt = 1; attempt <= COINGECKO_MAX_ATTEMPTS; attempt += 1) {
    await paceCoinGecko();
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      const delay = backoffMs(attempt);
      const last = attempt === COINGECKO_MAX_ATTEMPTS;
      attempts.push({
        attempt,
        http_status: null,
        retry_delay_ms: last ? null : delay,
        termination: last ? 'network_exhausted' : 'retry_network',
      });
      if (last) {
        const wrapped = new Error(error instanceof Error ? error.message : String(error));
        wrapped.acquisition_attempts = attempts;
        wrapped.acquisition_termination = 'network_exhausted';
        throw wrapped;
      }
      await runtime.sleep(delay);
      continue;
    }
    const status = Number.isInteger(response?.status) ? response.status : 200;
    const retryable = status === 429 || (status >= 500 && status <= 599);
    if (!retryable) {
      attempts.push({ attempt, http_status: status, retry_delay_ms: null, termination: 'final' });
      return { response, attempts, termination: 'final' };
    }
    const parsed = retryAfterDelay(response, runtime.now().getTime());
    if (parsed.valid && parsed.delayMs > COINGECKO_RETRY_AFTER_BUDGET_MS) {
      attempts.push({
        attempt,
        http_status: status,
        retry_after: parsed.raw,
        retry_delay_ms: parsed.delayMs,
        termination: 'retry_after_exceeds_budget',
      });
      return { response, attempts, termination: 'retry_after_exceeds_budget' };
    }
    const delay = parsed.valid ? parsed.delayMs : backoffMs(attempt);
    if (attempt === COINGECKO_MAX_ATTEMPTS) {
      attempts.push({
        attempt,
        http_status: status,
        retry_after: parsed.raw,
        retry_delay_ms: null,
        termination: 'exhausted',
      });
      return { response, attempts, termination: 'exhausted' };
    }
    attempts.push({
      attempt,
      http_status: status,
      retry_after: parsed.raw,
      retry_delay_ms: delay,
      termination: 'retry',
    });
    await runtime.sleep(delay);
  }
  return { response: null, attempts, termination: 'exhausted' };
}

export async function fetchWithCoinGeckoPolicy(url, init, fetchImpl) {
  if (!isCoinGeckoUrl(url)) {
    return { response: await fetchImpl(url, init), attempts: null, termination: null };
  }
  return fetchCoinGecko(url, init, fetchImpl);
}

export async function fetchSocialLiveEnvelope(url, fetchImpl) {
  try {
    const fetched = await fetchCoinGecko(url, { headers: { 'User-Agent': 'btc-risk-etl' } }, fetchImpl);
    const response = fetched.response;
    if (!response || response.ok === false) {
      return {
        data: null,
        acquiredAt: null,
        fromCache: false,
        acquisition_attempts: fetched.attempts,
        acquisition_termination: fetched.termination,
      };
    }
    const data = await response.json();
    return {
      data,
      acquiredAt: acquisitionNow().toISOString(),
      fromCache: false,
      acquisition_attempts: fetched.attempts,
      acquisition_termination: fetched.termination,
    };
  } catch (error) {
    return {
      data: null,
      acquiredAt: null,
      fromCache: false,
      acquisition_attempts: Array.isArray(error?.acquisition_attempts) ? error.acquisition_attempts : null,
      acquisition_termination: error?.acquisition_termination || 'network_exhausted',
    };
  }
}
