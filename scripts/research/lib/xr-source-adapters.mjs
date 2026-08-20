/**
 * H7.1 Stage A — source adapters.
 * Network functions require injected fetchImpl. No requests at import time.
 * Git uses injected gitExec. Never silently substitutes HEAD working-tree files.
 */

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  XrHistoricalMissingError,
  XrRuntimeSourceError,
  vintageDateTMinus1,
  addUtcDays,
  NL_LOOKBACK_DAYS,
  MACRO_LOOKBACK_DAYS,
  COINBASE_CANDLE_GRANULARITY_SEC,
  buildCoinbaseHistoricalChunkRanges,
  requiredCompletedSurrogateDates,
} from './xr-reconstruction-core.mjs';

export const GIT_PATHS = Object.freeze({
  latestJson: 'public/data/latest.json',
  stablecoinDated: (date) => `public/data/cache/stablecoins/${date}.json`,
  stablecoinHistorical: 'public/data/stablecoins-historical.json',
  etfDated: (date) => `public/data/cache/etf/${date}.html`,
  termCache: 'public/data/cache/term_leverage/term_leverage_cache.json',
  marketChart: 'public/data/cache/market_chart_30_daily.json',
  trending: 'public/data/cache/trending.json',
  socialCache: 'public/data/cache/social_interest/social_interest_cache.json',
  dailyView: 'research/historical-observations/daily_analytical_view.csv',
  priceHistoryCsv: 'public/data/btc_price_history.csv',
});

function defaultGitExec(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
    cwd: options.cwd,
  });
  if (result.error) {
    throw new XrRuntimeSourceError(`git spawn failed: ${result.error.message}`, {
      args,
    });
  }
  if (result.status !== 0) {
    const err = result.stderr?.toString('utf8') || `git exit ${result.status}`;
    throw new XrRuntimeSourceError(`git failed: ${err.trim()}`, { args, status: result.status });
  }
  return result.stdout;
}

export function gitRevParse(spec, gitExec = defaultGitExec) {
  const out = gitExec(['rev-parse', spec]);
  return out.toString('utf8').trim();
}

export function gitShowBuffer(spec, gitExec = defaultGitExec) {
  return gitExec(['show', spec]);
}

export function gitShowText(spec, gitExec = defaultGitExec) {
  return gitShowBuffer(spec, gitExec).toString('utf8');
}

export function gitFirstParent(commitSha, gitExec = defaultGitExec) {
  const out = gitExec(['rev-parse', `${commitSha}^`]);
  return out.toString('utf8').trim();
}

export function isGitMissingObjectError(error) {
  if (!(error instanceof XrRuntimeSourceError)) return false;
  if (error.details?.code === 'missing_git_object') return true;
  if (error.details?.status === 128) return true;
  const msg = String(error.message || '');
  return /does not exist in|exists on disk, but not in|Needed a single revision|bad revision|unknown revision|invalid object name/i.test(
    msg
  );
}

export function gitBlobExists(commitSha, gitPath, gitExec = defaultGitExec) {
  try {
    gitRevParse(`${commitSha}:${gitPath}`, gitExec);
    return true;
  } catch (error) {
    if (isGitMissingObjectError(error)) return false;
    throw error;
  }
}

export function sha256Bytes(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function redactSecret(text, secret) {
  if (!secret) return String(text ?? '');
  return String(text ?? '').split(secret).join('REDACTED');
}

export function sanitizeFredUrl(url, apiKey) {
  return redactSecret(url, apiKey).replace(/api_key=[^&]*/g, 'api_key=REDACTED');
}

export function findIntroductionCandidates(gitPath, gitExec = defaultGitExec) {
  const out = gitExec(['log', '--diff-filter=A', '--format=%H', '--', gitPath]);
  const shas = out
    .toString('utf8')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = [];
  for (const sha of shas) {
    if (!gitBlobExists(sha, gitPath, gitExec)) continue;
    let parent;
    try {
      parent = gitFirstParent(sha, gitExec);
    } catch {
      valid.push({ commitSha: sha, firstParentSha: null });
      continue;
    }
    if (gitBlobExists(parent, gitPath, gitExec)) continue;
    valid.push({ commitSha: sha, firstParentSha: parent });
  }
  return valid;
}

export function resolveFirstIntroduction(gitPath, gitExec = defaultGitExec) {
  const candidates = findIntroductionCandidates(gitPath, gitExec);
  if (candidates.length === 0) {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  if (candidates.length > 1) {
    return { ok: false, reasonCode: 'AMBIGUOUS_INTRODUCTION', candidates };
  }
  return { ok: true, ...candidates[0] };
}

export function resolveStablecoinCapture(observationDate, gitExec = defaultGitExec) {
  const path = GIT_PATHS.stablecoinDated(observationDate);
  const intro = resolveFirstIntroduction(path, gitExec);
  if (!intro.ok) return intro;
  const captureBlobSha = gitRevParse(`${intro.commitSha}:${path}`, gitExec);
  const captureBytes = gitShowBuffer(`${intro.commitSha}:${path}`, gitExec);
  if (!intro.firstParentSha) {
    return { ok: false, reasonCode: 'MISSING_BASELINE', captureCommitSha: intro.commitSha };
  }
  if (!gitBlobExists(intro.firstParentSha, GIT_PATHS.stablecoinHistorical, gitExec)) {
    return {
      ok: false,
      reasonCode: 'MISSING_BASELINE',
      captureCommitSha: intro.commitSha,
      firstParentSha: intro.firstParentSha,
    };
  }
  const baselineBlobSha = gitRevParse(
    `${intro.firstParentSha}:${GIT_PATHS.stablecoinHistorical}`,
    gitExec
  );
  const sameCommitBaselineExists = gitBlobExists(
    intro.commitSha,
    GIT_PATHS.stablecoinHistorical,
    gitExec
  );
  if (sameCommitBaselineExists) {
    const sameCommitBlob = gitRevParse(
      `${intro.commitSha}:${GIT_PATHS.stablecoinHistorical}`,
      gitExec
    );
    if (sameCommitBlob === baselineBlobSha) {
      // Parent equality is allowed; using C itself is still forbidden as the source pointer.
    }
  }
  const baselineText = gitShowText(
    `${intro.firstParentSha}:${GIT_PATHS.stablecoinHistorical}`,
    gitExec
  );
  let baseline;
  try {
    baseline = JSON.parse(baselineText);
  } catch {
    return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
  }
  let capture;
  try {
    capture = JSON.parse(captureBytes.toString('utf8'));
  } catch {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  return {
    ok: true,
    captureCommitSha: intro.commitSha,
    captureBlobSha,
    firstParentSha: intro.firstParentSha,
    baselineBlobSha,
    capture,
    baseline,
    path,
    notes: `capture=${intro.commitSha};parent=${intro.firstParentSha};baseline_blob=${baselineBlobSha}`,
  };
}

export function resolveGitBlobAtCommit(commitSha, gitPath, gitExec = defaultGitExec) {
  if (!commitSha) return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  if (!gitBlobExists(commitSha, gitPath, gitExec)) {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  const blobSha = gitRevParse(`${commitSha}:${gitPath}`, gitExec);
  const bytes = gitShowBuffer(`${commitSha}:${gitPath}`, gitExec);
  return { ok: true, commitSha, blobSha, bytes, text: bytes.toString('utf8') };
}

export function assertArtifactBlobMatches(commitSha, expectedBlobSha, gitExec = defaultGitExec) {
  const actual = gitRevParse(`${commitSha}:${GIT_PATHS.latestJson}`, gitExec);
  if (actual !== expectedBlobSha) {
    throw new XrRuntimeSourceError(
      `primary artifact blob mismatch: expected ${expectedBlobSha} got ${actual}`
    );
  }
  return actual;
}

export function resolveSelectedPrimaryArtifact(dailyRow, gitExec = defaultGitExec) {
  if (dailyRow?.selection_status !== 'DAILY_PRIMARY') {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  const commitSha = dailyRow.primary_artifact_commit_sha;
  const expectedBlob = dailyRow.primary_artifact_id;
  assertArtifactBlobMatches(commitSha, expectedBlob, gitExec);
  const shown = resolveGitBlobAtCommit(commitSha, GIT_PATHS.latestJson, gitExec);
  if (!shown.ok) return shown;
  let raw;
  try {
    raw = JSON.parse(shown.text);
  } catch {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  return { ok: true, commitSha, blobSha: shown.blobSha, raw };
}

export function resolveContemporaneousGitFile({
  observationDate,
  gitPath,
  primaryCommitSha,
  requireNoFallback = false,
  gitExec = defaultGitExec,
}) {
  if (primaryCommitSha) {
    const atPrimary = resolveGitBlobAtCommit(primaryCommitSha, gitPath, gitExec);
    if (atPrimary.ok) return { ...atPrimary, role: 'B_METHOD_PIT' };
    if (requireNoFallback) {
      return { ok: false, reasonCode: 'BRIDGE_CAPTURE_UNRESOLVED' };
    }
  }
  const dated = gitPath.includes(observationDate)
    ? resolveFirstIntroduction(gitPath, gitExec)
    : { ok: false };
  if (dated.ok) {
    const blob = resolveGitBlobAtCommit(dated.commitSha, gitPath, gitExec);
    if (blob.ok) return { ...blob, role: 'B_METHOD_PIT' };
  }
  if (requireNoFallback) return { ok: false, reasonCode: 'BRIDGE_CAPTURE_UNRESOLVED' };
  return { ok: false, reasonCode: 'MISSING_CAPTURE' };
}

function sleep(ms, sleepImpl) {
  if (sleepImpl) return sleepImpl(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetryInjected(
  url,
  options = {},
  {
    fetchImpl,
    sleepImpl,
    randomImpl = () => 0,
    maxRetries = 3,
    baseDelay = 1000,
    redact = (u) => u,
  } = {}
) {
  if (typeof fetchImpl !== 'function') {
    throw new XrRuntimeSourceError('fetchImpl is required; live fetch is not a Stage A default');
  }
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchImpl(url, options);
      const status = response.status;
      if (status === 429) {
        if (attempt < maxRetries) {
          await sleep(baseDelay * 2 ** (attempt - 1) + randomImpl() * 1000, sleepImpl);
          continue;
        }
        throw new XrRuntimeSourceError(`Rate limited (429) after ${maxRetries} attempts`, {
          url: redact(url),
          status,
        });
      }
      if (status >= 500 && status < 600) {
        if (attempt < maxRetries) {
          await sleep(baseDelay * 2 ** (attempt - 1) + randomImpl() * 1000, sleepImpl);
          continue;
        }
        throw new XrRuntimeSourceError(`Server error (${status}) after ${maxRetries} attempts`, {
          url: redact(url),
          status,
        });
      }
      if (!response.ok && status >= 400) {
        throw new XrRuntimeSourceError(`HTTP ${status}`, { url: redact(url), status });
      }
      const bodyBytes = Buffer.from(await response.arrayBuffer());
      return { response, bodyBytes, sha256: sha256Bytes(bodyBytes), status };
    } catch (error) {
      if (error instanceof XrRuntimeSourceError) {
        lastError = error;
        if (attempt >= maxRetries) throw error;
        await sleep(baseDelay * 2 ** (attempt - 1), sleepImpl);
        continue;
      }
      lastError = new XrRuntimeSourceError(`network failure: ${error.message}`, {
        url: redact(url),
      });
      if (attempt >= maxRetries) throw lastError;
      await sleep(baseDelay * 2 ** (attempt - 1), sleepImpl);
    }
  }
  throw lastError || new XrRuntimeSourceError('fetch failed');
}

export function requireFredApiKey(env = {}) {
  const key = env.FRED_API_KEY;
  if (!key) {
    throw new XrRuntimeSourceError('FRED_API_KEY absent', { code: 'missing_fred_api_key' });
  }
  return key;
}

export function buildAlfredRequest({
  seriesId,
  observationDate,
  lookbackDays,
  frequency,
  aggregationMethod = 'avg',
  apiKey,
}) {
  const vintage = vintageDateTMinus1(observationDate);
  const observationStart = addUtcDays(vintage, -lookbackDays);
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    observation_start: observationStart,
    observation_end: vintage,
    realtime_start: vintage,
    realtime_end: vintage,
    frequency,
    aggregation_method: aggregationMethod,
  });
  const url = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`;
  return {
    url,
    sanitizedUrl: sanitizeFredUrl(url, apiKey),
    vintageDate: vintage,
    realtime_start: vintage,
    realtime_end: vintage,
    observation_end: vintage,
    observation_start: observationStart,
    seriesId,
    frequency,
    aggregation_method: aggregationMethod,
  };
}

export function buildNetLiquidityRequests(observationDate, apiKey) {
  return ['WALCL', 'RRPONTSYD', 'WTREGEN'].map((seriesId) =>
    buildAlfredRequest({
      seriesId,
      observationDate,
      lookbackDays: NL_LOOKBACK_DAYS,
      frequency: 'w',
      aggregationMethod: 'avg',
      apiKey,
    })
  );
}

export function buildMacroRequests(observationDate, apiKey) {
  return ['DTWEXBGS', 'DGS2', 'DGS10', 'VIXCLS'].map((seriesId) =>
    buildAlfredRequest({
      seriesId,
      observationDate,
      lookbackDays: MACRO_LOOKBACK_DAYS,
      frequency: 'd',
      aggregationMethod: 'avg',
      apiKey,
    })
  );
}

export function parseFredObservations(json, observationDate) {
  const rows = json?.observations || [];
  const kept = [];
  for (const row of rows) {
    if (!row?.date) continue;
    if (row.date >= observationDate) continue;
    kept.push({ date: row.date, value: row.value });
  }
  return kept;
}

export function buildCoinGeckoHistoryRangeRequest(observationDate) {
  const required = requiredCompletedSurrogateDates(observationDate);
  const fromDate = addUtcDays(required[0], -15);
  const fromSec = Math.floor(Date.parse(`${fromDate}T00:00:00.000Z`) / 1000);
  const toSec = Math.floor(Date.parse(`${observationDate}T00:00:00.000Z`) / 1000) - 1;
  const url =
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`;
  return { url, fromSec, toSec, fromDate, toExclusive: observationDate };
}

export function buildCoinbaseCandleRequest(asOfUtc, lookbackMinutes = 180) {
  const asOfMs = Date.parse(asOfUtc);
  const start = new Date(asOfMs - lookbackMinutes * 60 * 1000).toISOString();
  const end = new Date(asOfUtc).toISOString();
  const url =
    `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${COINBASE_CANDLE_GRANULARITY_SEC}` +
    `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  return { url, start, end, granularity: COINBASE_CANDLE_GRANULARITY_SEC };
}

export function buildCoinbaseDailyChunkRequests(asOfUtc) {
  const ranges = buildCoinbaseHistoricalChunkRanges({ asOfUtc });
  return ranges.chunks.map((chunk) => ({
    url:
      `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400` +
      `&start=${encodeURIComponent(chunk.startUtc)}&end=${encodeURIComponent(chunk.endUtc)}`,
    ...chunk,
  }));
}

export async function fetchJsonSource(url, fetchOptions, runtime) {
  const got = await fetchWithRetryInjected(url, fetchOptions, runtime);
  let json;
  try {
    json = JSON.parse(got.bodyBytes.toString('utf8'));
  } catch {
    throw new XrRuntimeSourceError('malformed unexpected API JSON', {
      url: runtime?.redact ? runtime.redact(url) : url,
    });
  }
  return { ...got, json };
}

export function classifyMissingVsRuntime(error) {
  if (error instanceof XrHistoricalMissingError) return 'historical_missing';
  if (error instanceof XrRuntimeSourceError) return 'runtime_source';
  return 'unknown';
}

export function missingResult(reasonCode, extra = {}) {
  return { ok: false, kind: 'historical_missing', reasonCode, ...extra };
}

export { defaultGitExec, XrRuntimeSourceError, XrHistoricalMissingError };
