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
  CASE_A_CHART_CAPTURES,
  TREND_B_ISLAND_CAPTURES,
  ETF_HISTORICAL_BASELINE_PATH,
  ETF_HISTORICAL_BASELINE_BLOB,
  caseBCoinGeckoRangeBounds,
  validateCaseAChartVector,
  unwrapCoinGeckoCachePayload,
  extractLabeledSnapshotPrice,
  extractSocialBitcoinRank,
  validateBitmexFundingWindow,
  parseBtcPriceHistoryCsv,
  extractEtfRollingSumBaseline,
  normalizeCoinbaseDailyCandles,
  retainCoinbaseHistoryWindow,
  utcCalendarDateFromInstant,
  BRIDGE_PRODUCTION_CAPTURES,
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
  etfHistorical: 'public/data/etf-flows-historical.json',
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
  gitCommitExists(commitSha, gitExec);
  const out = gitExec(['rev-list', '--parents', '-n', '1', commitSha]);
  const parts = out
    .toString('utf8')
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new XrRuntimeSourceError(`unable to read commit parents: ${commitSha}`, {
      commitSha,
    });
  }
  if (parts[0] !== commitSha) {
    throw new XrRuntimeSourceError(`rev-list parent output mismatch for ${commitSha}`, {
      commitSha,
      output: parts[0],
    });
  }
  if (parts.length === 1) return null;
  return parts[1];
}

export function gitCatFileType(sha, gitExec = defaultGitExec) {
  const out = gitExec(['cat-file', '-t', sha]);
  return out.toString('utf8').trim();
}

export function gitCommitExists(commitSha, gitExec = defaultGitExec) {
  let type;
  try {
    type = gitCatFileType(commitSha, gitExec);
  } catch (error) {
    throw new XrRuntimeSourceError(`required commit unavailable: ${commitSha}`, {
      commitSha,
      cause: error?.message,
    });
  }
  if (type !== 'commit') {
    throw new XrRuntimeSourceError(`revision is not a commit: ${commitSha}`, {
      commitSha,
      type,
    });
  }
  return true;
}

export function isMissingPathInExistingCommitError(error, commitSha, gitPath) {
  if (!(error instanceof XrRuntimeSourceError)) return false;
  const msg = String(error.message || '');
  if (/not a git repository/i.test(msg)) return false;
  if (/corrupt|bad object|unable to read|permission denied|spawn failed/i.test(msg)) {
    return false;
  }
  const escapedPath = String(gitPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSha = String(commitSha).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    /exists on disk, but not in/i.test(msg) ||
    new RegExp(`path ['"]${escapedPath}['"] .*not in`, 'i').test(msg) ||
    new RegExp(`does not exist in ['"]${escapedSha}`, 'i').test(msg) ||
    new RegExp(`Not a valid object name ${escapedSha}:${escapedPath}`, 'i').test(msg) ||
    new RegExp(`does not exist in tree`, 'i').test(msg)
  );
}

export function gitBlobExists(commitSha, gitPath, gitExec = defaultGitExec) {
  gitCommitExists(commitSha, gitExec);
  try {
    gitRevParse(`${commitSha}:${gitPath}`, gitExec);
    return true;
  } catch (error) {
    if (isMissingPathInExistingCommitError(error, commitSha, gitPath)) return false;
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
    const parent = gitFirstParent(sha, gitExec);
    if (parent && gitBlobExists(parent, gitPath, gitExec)) continue;
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
    notes: `capture_commit=${intro.commitSha};capture_blob=${captureBlobSha};first_parent=${intro.firstParentSha};baseline_blob=${baselineBlobSha}`,
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

export function resolveBridgeProductionArtifact(observationDate, gitExec = defaultGitExec) {
  const expected = BRIDGE_PRODUCTION_CAPTURES[observationDate];
  if (!expected) return missingResult('MISSING_CAPTURE');
  gitCommitExists(expected.commitSha, gitExec);
  const shown = resolveGitBlobAtCommit(expected.commitSha, GIT_PATHS.latestJson, gitExec);
  if (!shown.ok || shown.blobSha !== expected.blobSha) {
    throw new XrRuntimeSourceError(
      `bridge production blob mismatch for ${observationDate}: expected ${expected.blobSha} got ${shown.blobSha || 'missing'}`
    );
  }
  let raw;
  try {
    raw = JSON.parse(shown.text);
  } catch {
    throw new XrRuntimeSourceError(`bridge production artifact is not JSON for ${observationDate}`);
  }
  return { ok: true, raw, ...expected };
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
  const bounds = caseBCoinGeckoRangeBounds(observationDate);
  const url =
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${bounds.fromSec}&to=${bounds.toSec}`;
  return { url, ...bounds, toExclusive: observationDate };
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

export function gitCatFileBlob(blobSha, gitExec = defaultGitExec) {
  return gitExec(['cat-file', '-p', blobSha]);
}

export function indexPathBlobTransitions(gitPath, gitExec = defaultGitExec) {
  const out = gitExec(['log', '--diff-filter=AM', '--format=%H %cI', '--', gitPath]).toString(
    'utf8'
  );
  const byDate = new Map();
  for (const line of out.trim().split(/\n/).filter(Boolean)) {
    const [sha, iso] = line.split(/\s+/);
    if (!sha || !iso) continue;
    const date = iso.slice(0, 10);
    const blobSha = gitRevParse(`${sha}:${gitPath}`, gitExec);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ commitSha: sha, blobSha, commitUtc: iso, path: gitPath });
  }
  return byDate;
}

function uniqueBlobs(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries || []) {
    if (seen.has(entry.blobSha)) continue;
    seen.add(entry.blobSha);
    out.push(entry);
  }
  return out;
}

export function resolveDatedCacheUpdate(observationDate, gitPath, index) {
  const entries = uniqueBlobs(index.get(observationDate) || []);
  if (entries.length === 0) return missingResult('MISSING_CAPTURE');
  if (entries.length > 1) {
    return missingResult('AMBIGUOUS_INTRODUCTION', { candidates: entries });
  }
  return { ok: true, ...entries[0] };
}

export function resolveCaseAMarketChart(observationDate, gitExec = defaultGitExec) {
  const expected = CASE_A_CHART_CAPTURES[observationDate];
  if (!expected) return missingResult('MISSING_CAPTURE', { notCaseADate: true });
  gitCommitExists(expected.commitSha, gitExec);
  const shown = resolveGitBlobAtCommit(expected.commitSha, expected.path, gitExec);
  if (!shown.ok) return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  if (shown.blobSha !== expected.blobSha) return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  let parsed;
  try {
    parsed = JSON.parse(shown.text);
  } catch {
    return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  }
  const validated = validateCaseAChartVector(parsed, {
    observationDate,
    expectedBlobSha: expected.blobSha,
  });
  if (!validated.ok) return missingResult(validated.reasonCode || 'BRIDGE_CAPTURE_UNRESOLVED');
  return {
    ok: true,
    role: 'B_METHOD_PIT',
    ...expected,
    vector: validated.vector,
    envelope: validated.envelope,
    cachedAt: validated.cachedAt,
  };
}

export function resolveSharedPriceVector(observationDate, gitExec = defaultGitExec) {
  if (CASE_A_CHART_CAPTURES[observationDate]) {
    const caseA = resolveCaseAMarketChart(observationDate, gitExec);
    if (!caseA.ok) return { ...caseA, forbidSurrogate: true };
    return caseA;
  }
  return { ok: false, reasonCode: 'MISSING_CAPTURE', useCaseB: true };
}

export function resolveTrendBIsland(observationDate, gitExec = defaultGitExec) {
  const expected = TREND_B_ISLAND_CAPTURES[observationDate];
  if (!expected) return { ok: false, outsideIsland: true };
  gitCommitExists(expected.latestJsonCommitSha, gitExec);
  const latest = resolveGitBlobAtCommit(
    expected.latestJsonCommitSha,
    GIT_PATHS.latestJson,
    gitExec
  );
  if (!latest.ok || latest.blobSha !== expected.latestJsonBlobSha) {
    return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  }
  let raw;
  try {
    raw = JSON.parse(latest.text);
  } catch {
    return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  }
  const snapshot = extractLabeledSnapshotPrice(raw);
  if (!snapshot.ok || snapshot.snapshotDate !== observationDate) {
    return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  }
  const csv = resolveGitBlobAtCommit(
    expected.btcPriceHistoryCommitSha,
    GIT_PATHS.priceHistoryCsv,
    gitExec
  );
  if (!csv.ok || csv.blobSha !== expected.btcPriceHistoryBlobSha) {
    return missingResult('BRIDGE_CAPTURE_UNRESOLVED');
  }
  return {
    ok: true,
    role: 'B_METHOD_PIT',
    snapshotPrice: snapshot.price,
    raw,
    historyRows: parseBtcPriceHistoryCsv(csv.text),
    ...expected,
  };
}

export function resolveFrozenEtfBaseline(gitExec = defaultGitExec) {
  const bytes = gitCatFileBlob(ETF_HISTORICAL_BASELINE_BLOB, gitExec);
  let json;
  try {
    json = JSON.parse(bytes.toString('utf8'));
  } catch {
    return missingResult('MALFORMED_BASELINE');
  }
  const extracted = extractEtfRollingSumBaseline(json);
  if (!extracted.ok) return missingResult(extracted.reasonCode);
  return {
    ok: true,
    blobSha: ETF_HISTORICAL_BASELINE_BLOB,
    path: ETF_HISTORICAL_BASELINE_PATH,
    values: extracted.values,
  };
}

export function resolveSameDateEtfHtml(observationDate, gitExec = defaultGitExec) {
  const path = GIT_PATHS.etfDated(observationDate);
  const intro = resolveFirstIntroduction(path, gitExec);
  if (!intro.ok) return intro;
  const shown = resolveGitBlobAtCommit(intro.commitSha, path, gitExec);
  if (!shown.ok) return missingResult('NO_SAME_DATE_ETF');
  return { ok: true, html: shown.text, ...shown, path, role: 'B_METHOD_PIT' };
}

export function parseTermCachePayload(json, asOfUtc) {
  const validated = validateBitmexFundingWindow(json?.fundingData || json?.funding || []);
  if (!validated.ok) return validated;
  const details = Array.isArray(json?.details) ? json.details : [];
  const sourceLabel = details.find((d) => /data source/i.test(d?.label || ''))?.value || '';
  const provider = String(json?.funding_provider || sourceLabel || '').toLowerCase();
  if (provider && !/bitmex/.test(provider)) return missingResult('NO_BITMEX_EVIDENCE');
  const future = validated.rates.some((row) => row.timestamp && row.timestamp > asOfUtc);
  if (future) return missingResult('FUTURE_OBSERVATION');
  return { ok: true, rates: validated.rates, provider: 'bitmex', json };
}

export function resolveTermFunding(observationDate, asOfUtc, termIndex, gitExec = defaultGitExec) {
  const update = resolveDatedCacheUpdate(observationDate, GIT_PATHS.termCache, termIndex);
  if (!update.ok) return update;
  const shown = resolveGitBlobAtCommit(update.commitSha, GIT_PATHS.termCache, gitExec);
  if (!shown.ok) return missingResult('MISSING_CAPTURE');
  let json;
  try {
    json = JSON.parse(shown.text);
  } catch {
    return missingResult('MISSING_CAPTURE');
  }
  const obsUtc =
    json.funding_observation_utc || json.lastUpdated || json.spot_observation_utc || update.commitUtc;
  if (obsUtc && utcCalendarDateFromInstant(obsUtc) && utcCalendarDateFromInstant(obsUtc) !== observationDate) {
    return missingResult('MISSING_CAPTURE');
  }
  const parsed = parseTermCachePayload(json, asOfUtc);
  if (!parsed.ok) return parsed;
  return { ok: true, role: 'B_METHOD_PIT', ...update, ...parsed };
}

export function resolveSocialRank(observationDate, trendingIndex, socialIndex, gitExec = defaultGitExec) {
  const trendingUpdate = resolveDatedCacheUpdate(observationDate, GIT_PATHS.trending, trendingIndex);
  if (trendingUpdate.ok) {
    const shown = resolveGitBlobAtCommit(trendingUpdate.commitSha, GIT_PATHS.trending, gitExec);
    if (shown.ok) {
      let json;
      try {
        json = JSON.parse(shown.text);
      } catch {
        json = null;
      }
      if (json) {
        const unwrapped = unwrapCoinGeckoCachePayload(json);
        if (unwrapped.ok && unwrapped.cachedAt) {
          const cachedDate = utcCalendarDateFromInstant(unwrapped.cachedAt);
          if (cachedDate && cachedDate !== observationDate) {
            return missingResult('MISSING_CAPTURE');
          }
        }
        const rank = extractSocialBitcoinRank(json);
        if (Number.isFinite(rank)) {
          return { ok: true, role: 'B_METHOD_PIT', rank, ...trendingUpdate, source: 'trending.json' };
        }
      }
    }
  }
  const socialUpdate = resolveDatedCacheUpdate(observationDate, GIT_PATHS.socialCache, socialIndex);
  if (!socialUpdate.ok) return missingResult('NO_BITCOIN_RANK');
  const shown = resolveGitBlobAtCommit(socialUpdate.commitSha, GIT_PATHS.socialCache, gitExec);
  if (!shown.ok) return missingResult('NO_BITCOIN_RANK');
  let json;
  try {
    json = JSON.parse(shown.text);
  } catch {
    return missingResult('NO_BITCOIN_RANK');
  }
  const rank = extractSocialBitcoinRank(json);
  if (!Number.isFinite(rank)) return missingResult('NO_BITCOIN_RANK');
  return { ok: true, role: 'B_METHOD_PIT', rank, ...socialUpdate, source: 'social_interest_cache.json' };
}

export async function fetchCoinbaseCompletedHistory(asOfUtc, runtime) {
  const requests = buildCoinbaseDailyChunkRequests(asOfUtc);
  const candles = [];
  const lineage = [];
  for (const req of requests) {
    const got = await fetchWithRetryInjected(req.url, {}, runtime);
    let json;
    try {
      json = JSON.parse(got.bodyBytes.toString('utf8'));
    } catch {
      throw new XrRuntimeSourceError('malformed unexpected API JSON', {
        url: runtime?.redact ? runtime.redact(req.url) : req.url,
      });
    }
    if (!Array.isArray(json)) {
      throw new XrRuntimeSourceError('unexpected Coinbase daily payload', { url: req.url });
    }
  candles.push(...json);
    lineage.push({
      url: req.url,
      sha256: got.sha256,
      bytes: got.bodyBytes.length,
      startUtc: req.startUtc,
      endUtc: req.endUtc,
    });
  }
  const normalized = normalizeCoinbaseDailyCandles(candles, asOfUtc);
  return {
    rows: retainCoinbaseHistoryWindow(normalized, asOfUtc),
    lineage,
    paddedRows: normalized,
  };
}

export async function fetchCoinbase5mProxy(asOfUtc, runtime) {
  const req = buildCoinbaseCandleRequest(asOfUtc);
  const got = await fetchWithRetryInjected(req.url, {}, runtime);
  let json;
  try {
    json = JSON.parse(got.bodyBytes.toString('utf8'));
  } catch {
    throw new XrRuntimeSourceError('malformed unexpected API JSON', { url: req.url });
  }
  return { candles: json, sha256: got.sha256, url: req.url, bodyBytes: got.bodyBytes };
}

export async function fetchCoinGeckoCaseBRange(observationDate, runtime) {
  const req = buildCoinGeckoHistoryRangeRequest(observationDate);
  const got = await fetchJsonSource(req.url, {}, runtime);
  return { ...got, request: req };
}

export async function fetchAlfredSeries(request, runtime) {
  const got = await fetchJsonSource(request.url, {}, {
    ...runtime,
    redact: (url) => request.sanitizedUrl || url,
  });
  return { ...got, request };
}

export { defaultGitExec, XrRuntimeSourceError, XrHistoricalMissingError };
