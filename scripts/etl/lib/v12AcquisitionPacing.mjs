// Shared CoinGecko pacing for the four v1.2 factors.
// A per-factor delay is not enough: computeAllFactors runs them concurrently.
// This queue is the single start gate for api.coingecko.com.

export const COINGECKO_PACE_MS = 2_000;
export const COINGECKO_MAX_ATTEMPTS = 3;
export const COINGECKO_RETRY_BASE_MS = 1_500;
export const COINGECKO_RETRY_AFTER_BUDGET_MS = 30_000;
export const COINGECKO_SHARED_COOLDOWN_MAX_MS = 70_000;

const runtime = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
};

let chain = Promise.resolve();
let nextStartMs = 0;
let startsBlocked = false;
let longCooldownArmed = false;
let sharedCooldownPromise = null;
let cooldownDeadlineMs = 0;
let cooldownMeta = null;

export function configureAcquisitionRuntime({ sleep, now } = {}) {
  if (typeof sleep === 'function') runtime.sleep = sleep;
  if (typeof now === 'function') runtime.now = now;
}

export function resetAcquisitionQueue() {
  chain = Promise.resolve();
  nextStartMs = 0;
  startsBlocked = false;
  longCooldownArmed = false;
  sharedCooldownPromise = null;
  cooldownDeadlineMs = 0;
  cooldownMeta = null;
}

export function acquisitionNow() {
  return runtime.now();
}

export function coinGeckoCooldownSnapshot() {
  return cooldownMeta ? { ...cooldownMeta } : null;
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

function cooldownSkipRecord() {
  return {
    attempt: null,
    http_status: null,
    retry_delay_ms: null,
    termination: 'COOLDOWN_BUDGET_EXHAUSTED',
    skipped: true,
    reason: 'COOLDOWN_BUDGET_EXHAUSTED',
    scheduler: { kind: 'shared_cooldown', ...(cooldownMeta || {}) },
  };
}

function armSharedCooldown(delayMs, nowMs) {
  const requiredDeadlineMs = nowMs + delayMs;
  const snapshot = {
    kind: 'shared_cooldown',
    receipt_utc: new Date(nowMs).toISOString(),
    required_deadline_utc: new Date(requiredDeadlineMs).toISOString(),
    required_wait_ms: delayMs,
    actual_wait_ms: 0,
    budget_ms: COINGECKO_SHARED_COOLDOWN_MAX_MS,
    budget_consumed_ms: longCooldownArmed ? (cooldownMeta?.budget_consumed_ms || 0) : 0,
    pace_ms: COINGECKO_PACE_MS,
  };
  if (delayMs > COINGECKO_SHARED_COOLDOWN_MAX_MS) {
    startsBlocked = true;
    snapshot.reason = 'delay_above_shared_budget';
    cooldownMeta = snapshot;
    return snapshot;
  }
  if (longCooldownArmed) {
    startsBlocked = true;
    snapshot.reason = 'second_long_cooldown';
    snapshot.budget_consumed_ms = cooldownMeta?.budget_consumed_ms || delayMs;
    cooldownMeta = { ...cooldownMeta, blocked_reason: 'second_long_cooldown', later_required_wait_ms: delayMs };
    return { ...snapshot, ...cooldownMeta };
  }
  longCooldownArmed = true;
  snapshot.reason = 'shared_wait_armed';
  snapshot.budget_consumed_ms = delayMs;
  cooldownMeta = snapshot;
  cooldownDeadlineMs = requiredDeadlineMs;
  return { ...snapshot };
}

async function paceCoinGecko() {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const previous = chain;
  chain = previous.then(() => gate);
  await previous;
  let joinedCooldown = null;
  try {
    if (startsBlocked) return { blocked: true, scheduler: { kind: 'shared_cooldown', ...(cooldownMeta || {}), skipped: true } };
    if (!sharedCooldownPromise && longCooldownArmed && cooldownDeadlineMs > runtime.now().getTime()) {
      const wait = cooldownDeadlineMs - runtime.now().getTime();
      sharedCooldownPromise = runtime.sleep(wait).then(() => {
        if (cooldownMeta) {
          cooldownMeta.actual_wait_ms = wait;
          cooldownMeta.budget_consumed_ms = wait;
        }
      });
    }
    joinedCooldown = sharedCooldownPromise;
  } finally {
    release();
  }
  let cooldownWait = null;
  if (joinedCooldown) {
    const before = runtime.now().getTime();
    await joinedCooldown;
    cooldownWait = {
      kind: 'shared_cooldown',
      wait_ms: Math.max(0, runtime.now().getTime() - before),
      receipt_utc: cooldownMeta?.receipt_utc || null,
      required_deadline_utc: cooldownMeta?.required_deadline_utc || null,
      required_wait_ms: cooldownMeta?.required_wait_ms || null,
      actual_wait_ms: cooldownMeta?.actual_wait_ms || 0,
      budget_consumed_ms: cooldownMeta?.budget_consumed_ms || 0,
      budget_ms: COINGECKO_SHARED_COOLDOWN_MAX_MS,
    };
    if (startsBlocked) return { blocked: true, scheduler: { kind: 'shared_cooldown', ...(cooldownMeta || {}), skipped: true } };
  }
  let paceRelease;
  const paceGate = new Promise((resolve) => {
    paceRelease = resolve;
  });
  const pacePrevious = chain;
  chain = pacePrevious.then(() => paceGate);
  await pacePrevious;
  let paceWait = 0;
  try {
    if (startsBlocked) return { blocked: true, scheduler: cooldownWait || { kind: 'shared_cooldown', ...(cooldownMeta || {}), skipped: true } };
    paceWait = Math.max(0, nextStartMs - runtime.now().getTime());
    if (paceWait > 0) await runtime.sleep(paceWait);
    nextStartMs = runtime.now().getTime() + COINGECKO_PACE_MS;
  } finally {
    paceRelease();
  }
  if (startsBlocked) {
    return { blocked: true, scheduler: { kind: 'shared_cooldown', ...(cooldownMeta || {}), skipped: true } };
  }
  if (longCooldownArmed && cooldownDeadlineMs > runtime.now().getTime() && !joinedCooldown) {
    return paceCoinGecko();
  }
  return {
    blocked: false,
    scheduler: {
      kind: cooldownWait ? 'shared_cooldown' : 'pace',
      pace_wait_ms: paceWait,
      cooldown: cooldownWait,
    },
  };
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
    const gate = await paceCoinGecko();
    if (gate.blocked) {
      attempts.push(cooldownSkipRecord());
      return { response: null, attempts, termination: 'COOLDOWN_BUDGET_EXHAUSTED', cooldown: coinGeckoCooldownSnapshot() };
    }
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
        scheduler: gate.scheduler,
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
      attempts.push({ attempt, http_status: status, retry_delay_ms: null, termination: 'final', scheduler: gate.scheduler });
      return { response, attempts, termination: 'final', cooldown: coinGeckoCooldownSnapshot() };
    }
    const parsed = retryAfterDelay(response, runtime.now().getTime());
    if (parsed.valid && parsed.delayMs > COINGECKO_RETRY_AFTER_BUDGET_MS) {
      const cooldown = armSharedCooldown(parsed.delayMs, runtime.now().getTime());
      attempts.push({
        attempt,
        http_status: status,
        retry_after: parsed.raw,
        retry_delay_ms: parsed.delayMs,
        termination: 'retry_after_exceeds_budget',
        scheduler: gate.scheduler,
        cooldown,
      });
      return { response, attempts, termination: 'retry_after_exceeds_budget', cooldown: coinGeckoCooldownSnapshot() };
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
  let fetched;
  try {
    fetched = await fetchCoinGecko(url, { headers: { 'User-Agent': 'btc-risk-etl' } }, fetchImpl);
  } catch (error) {
    return {
      data: null,
      acquiredAt: null,
      fromCache: false,
      acquisition_attempts: Array.isArray(error?.acquisition_attempts) ? error.acquisition_attempts : null,
      acquisition_termination: error?.acquisition_termination || 'network_exhausted',
    };
  }
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
  let data;
  try {
    data = await response.json();
  } catch {
    return {
      data: null,
      acquiredAt: null,
      fromCache: false,
      acquisition_attempts: fetched.attempts,
      acquisition_termination: 'MALFORMED_RESPONSE',
    };
  }
  return {
    data,
    acquiredAt: acquisitionNow().toISOString(),
    fromCache: false,
    acquisition_attempts: fetched.attempts,
    acquisition_termination: fetched.termination,
  };
}
