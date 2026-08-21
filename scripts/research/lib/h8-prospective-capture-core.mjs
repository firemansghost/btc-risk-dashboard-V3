/**
 * H8 prospective capture core — deterministic scientific / schema logic only.
 * No filesystem writes. No network.
 */

export const H8_PROTOCOL_VERSION = 'h8-prospective-three-model-v1';
export const H8_PROTOCOL_SHA = '85fb5bcbdb5c6d04333a3a9516629851efd890eb';
export const H8_PROTOCOL_DOCUMENT_PATH = 'docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md';
export const H8_PROTOCOL_DOCUMENT_BLOB = '41594c82ab9d837fee4a5e894b3d2ed419d68bc9';

export const H8_CAPTURE_CONTRACT_VERSION = 'h8-capture-implementation-contract-v1';
export const H8_CAPTURE_CONTRACT_SHA = '811359afc572c86aa3d2d8732a1efd2c72b9df8f';
export const H8_CAPTURE_CONTRACT_DOCUMENT_PATH = 'docs/H8_CAPTURE_IMPLEMENTATION_CONTRACT.md';
export const H8_CAPTURE_CONTRACT_DOCUMENT_BLOB = '9f107a2a02e57a89ba86372022d9978730b0b7fc';

export const H8_CAPTURE_SOURCE_SIDECAR_PATH = 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt';

export const STAGE_A_RUNTIME_PATHS = Object.freeze([
  '.github/workflows/daily-etl.yml',
  'scripts/research/capture-h8-prospective.mjs',
  'scripts/research/lib/h8-prospective-capture-core.mjs',
  'scripts/research/lib/h8-prospective-capture-io.mjs',
]);

export const SCIENTIFIC_FILE_BLOBS = Object.freeze({
  'config/dashboard-config.json': 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49',
  'lib/config-loader.mjs': '8f439254ca813050703a7c17bcd658474c19e2b2',
  'scripts/etl/compute.mjs': '6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4',
  'scripts/etl/factors.mjs': 'e9fd06df79967f0041a901e2dd971b771e669b03',
  'scripts/etl/stalenessUtils.mjs': '1c213b9b8eb659c9cda22d0834694ae3239eb768',
  'scripts/etl/marketCalendar.mjs': '77c5669f77bef11cbc43fb85f82bb4a42bfc2136',
  'scripts/etl/adjustments.mjs': '36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7',
  'scripts/etl/coinGeckoCache.mjs': 'fbfc5e35b3bd4af60eb00e780892b62f94e8bbff',
  'scripts/etl/priceHistory.mjs': '515b02acdd0cf4a72e62889dafb83cec6e8acd95',
  'scripts/etl/fetch-helper.mjs': 'da8ca2b441088f2e13364249e7ecbbed40dc22a4',
});

export const SCIENTIFIC_TREE_SHAS = Object.freeze({
  'scripts/etl/factors': '3921332c0decd56800e78580183931b718b9a345',
  'scripts/etl/lib': '64c73c01db27f1e6dbcd12d45d08c2f12bc47b12',
});

export const PRODUCTION_CONFIG_SHA256 =
  '712a6d138b7e58dee3e325ec2740044aad2a7a80fe027a8f3e3fef294ac3b57a';
export const PRODUCTION_CONFIG_GIT_BLOB = 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49';

export const REQUIRED_FACTOR_KEYS = Object.freeze([
  'trend_valuation',
  'stablecoins',
  'etf_flows',
  'net_liquidity',
  'term_leverage',
  'macro_overlay',
  'social_interest',
]);

export const OFFICIAL_WEIGHTS = Object.freeze({
  trend_valuation: 0.3,
  stablecoins: 0.18,
  etf_flows: 0.077,
  net_liquidity: 0.043,
  term_leverage: 0.2,
  macro_overlay: 0.1,
  social_interest: 0.1,
});

export const LIQ_HEAVY_TREND_WEIGHT = 0.25;
export const MOM_TILTED_TREND_WEIGHT = 0.35;
export const LIQ_HEAVY_LIQUIDITY_RATIO = Object.freeze({ numerator: 0.35, denominator: 0.3 });
export const MOM_TILTED_LIQUIDITY_RATIO = Object.freeze({ numerator: 0.25, denominator: 0.3 });

export const LIQ_HEAVY_LIQUIDITY_DEFINITIONS = Object.freeze({
  stablecoins: '0.18 * (0.35 / 0.30)',
  etf_flows: '0.077 * (0.35 / 0.30)',
  net_liquidity: '0.043 * (0.35 / 0.30)',
});

export const MOM_TILTED_LIQUIDITY_DEFINITIONS = Object.freeze({
  stablecoins: '0.18 * (0.25 / 0.30)',
  etf_flows: '0.077 * (0.25 / 0.30)',
  net_liquidity: '0.043 * (0.25 / 0.30)',
});

export const OBSERVATION_WINDOW_START = '2026-08-24';
export const OBSERVATION_WINDOW_END = '2027-02-19';
export const CLOSE_UNIVERSE_START = '2026-08-24';
export const CLOSE_UNIVERSE_END = '2027-03-21';
export const CLOSE_RECOVERY_CUTOFF = '2027-03-29';

export const BTC_SOURCE_PATH = 'public/data/btc_price_history.csv';
export const LATEST_PATH = 'public/data/latest.json';
export const CONFIG_PATH = 'config/dashboard-config.json';
export const BTC_HEADER = 'date_utc,close_usd,source,ingested_at_utc';

export const MANIFEST_VERSION = 'h8-created-manifest-v1';
export const STUDY_ID = 'h8-prospective-three-model-v1';
export const SCHEDULED_EVENT = 'DAILY_ETL';

export const OBSERVATION_PATH_RE =
  /^research\/h8-prospective\/observations\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/;
export const CLOSE_PATH_RE =
  /^research\/h8-prospective\/btc-closes\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/;

export const OBSERVATION_KEY_ORDER = Object.freeze([
  'study_id',
  'protocol_version',
  'protocol_sha',
  'h8_capture_source_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'observation_date',
  'scheduled_event',
  'observation_as_of_utc',
  'capture_created_utc',
  'etl_started_utc',
  'source_base_git_sha',
  'github_run_id',
  'github_run_attempt',
  'github_event_name',
  'github_workflow_ref',
  'github_sha',
  'production_model_version',
  'production_implementation_revision',
  'production_ssot_version',
  'production_config_git_blob',
  'production_config_sha256',
  'latest_artifact_sha256',
  'common_eligibility_status',
  'eligibility_reason',
  'official_integrity_status',
  'analysis_status',
  'factors',
  'official_published_score',
  'official_formula_score',
  'liq_heavy_score',
  'mom_tilted_score',
  'model_versions',
  'model_weight_definitions',
]);

export const CLOSE_KEY_ORDER = Object.freeze([
  'study_id',
  'protocol_version',
  'protocol_sha',
  'h8_capture_source_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'close_date_utc',
  'close_usd',
  'source',
  'source_row_ingested_at_utc',
  'captured_at_utc',
  'source_artifact_path',
  'source_artifact_sha256',
  'source_base_git_sha',
  'github_run_id',
  'github_run_attempt',
  'github_event_name',
  'github_workflow_ref',
  'github_sha',
]);

export const FACTOR_SNAPSHOT_KEY_ORDER = Object.freeze([
  'key',
  'score',
  'status',
  'last_updated_utc',
  'official_weight',
]);

export const MANIFEST_KEY_ORDER = Object.freeze(['manifest_version', 'capture_run_utc', 'files']);
export const MANIFEST_FILE_KEY_ORDER = Object.freeze(['path', 'sha256']);

export const MODEL_VERSIONS = Object.freeze({
  official: 'v1.1.1',
  liq_heavy: 'liq-heavy-v1',
  mom_tilted: 'mom-tilted-v1',
});

export const EXPECTED_LATEST_MODEL_VERSION = 'v1.1.1';
export const EXPECTED_IMPLEMENTATION_REVISION = 'integrity-2026-08';
export const EXPECTED_SSOT_VERSION = '2.1.1';

const SHA1_RE = /^[0-9a-f]{40}$/;
const UTC_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const STRICT_NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

let counters = createCounters();

function createCounters() {
  return {
    networkRequests: 0,
    observationFilesCreated: 0,
    closeFilesCreated: 0,
    filesWritten: 0,
    overwriteAttempts: 0,
    performanceCalculations: 0,
  };
}

export function resetCounters() {
  counters = createCounters();
  return snapshotCounters();
}

export function snapshotCounters() {
  return { ...counters };
}

export function incrementCounter(name, by = 1) {
  if (!(name in counters)) throw new Error(`STOP: unknown counter ${name}`);
  counters[name] += by;
  return counters[name];
}

export function assertNoPerformanceOrNetwork() {
  const snap = snapshotCounters();
  if (snap.networkRequests !== 0) throw new Error('STOP: networkRequests must remain 0');
  if (snap.performanceCalculations !== 0) {
    throw new Error('STOP: performanceCalculations must remain 0');
  }
  if (snap.overwriteAttempts !== 0) throw new Error('STOP: overwriteAttempts must remain 0');
}

export function orderedObject(keys, source) {
  const out = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      throw new Error(`STOP: missing required key ${key}`);
    }
    out[key] = source[key];
  }
  return out;
}

export function parseStrictUtcCalendarDate(value, label = 'date') {
  if (typeof value !== 'string' || !UTC_DATE_RE.test(value)) {
    throw new Error(`STOP: ${label} is not YYYY-MM-DD`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new Error(`STOP: ${label} is not a real UTC calendar date`);
  }
  return value;
}

export function addUtcDays(date, days) {
  const parsed = parseStrictUtcCalendarDate(date);
  const year = Number(parsed.slice(0, 4));
  const month = Number(parsed.slice(5, 7));
  const day = Number(parsed.slice(8, 10));
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function compareUtcDates(a, b) {
  const left = parseStrictUtcCalendarDate(a);
  const right = parseStrictUtcCalendarDate(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function enumerateUtcDates(start, end) {
  parseStrictUtcCalendarDate(start, 'start');
  parseStrictUtcCalendarDate(end, 'end');
  if (compareUtcDates(start, end) > 0) throw new Error('STOP: date range inverted');
  const out = [];
  let cursor = start;
  while (compareUtcDates(cursor, end) <= 0) {
    out.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return out;
}

export function parseStrictUtcTimestamp(value, label = 'timestamp') {
  if (typeof value !== 'string' || value.length < 20) {
    throw new Error(`STOP: ${label} is not a valid UTC timestamp`);
  }
  if (value.includes('\r') || value.includes(' ')) {
    throw new Error(`STOP: ${label} is not a valid UTC timestamp`);
  }
  if (!(value.endsWith('Z') || /[+-]00:00$/.test(value))) {
    throw new Error(`STOP: ${label} must be offset-aware UTC`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`STOP: ${label} is not a valid UTC timestamp`);
  const iso = new Date(ms).toISOString();
  if (Number.isNaN(new Date(iso).getTime())) {
    throw new Error(`STOP: ${label} is not a valid UTC timestamp`);
  }
  return value;
}

export function utcCalendarDateFromTimestamp(value, label = 'timestamp') {
  const parsed = parseStrictUtcTimestamp(value, label);
  return parseStrictUtcCalendarDate(new Date(Date.parse(parsed)).toISOString().slice(0, 10), label);
}

export function parseStrictLowerSha(value, label = 'sha') {
  if (typeof value !== 'string' || !SHA1_RE.test(value)) {
    throw new Error(`STOP: ${label} is not a 40-character lowercase Git SHA`);
  }
  return value;
}

export function parseSidecarBytes(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('STOP: sidecar must be bytes');
  if (buf.length !== 41) throw new Error('STOP: sidecar must be exactly 41 bytes');
  if (buf[40] !== 0x0a) throw new Error('STOP: sidecar must end with LF');
  if (buf.includes(0x0d)) throw new Error('STOP: sidecar must not contain CR');
  const text = buf.subarray(0, 40).toString('utf8');
  if (text.includes(' ') || text.includes('\n')) {
    throw new Error('STOP: sidecar must not contain spaces or extra lines');
  }
  return parseStrictLowerSha(text, 'H8_CAPTURE_SOURCE_SHA sidecar');
}

export function observationPathForDate(date) {
  const d = parseStrictUtcCalendarDate(date, 'observation_date');
  return `research/h8-prospective/observations/${d}.json`;
}

export function closePathForDate(date) {
  const d = parseStrictUtcCalendarDate(date, 'close_date_utc');
  return `research/h8-prospective/btc-closes/${d}.json`;
}

export function assertAllowedManifestPath(repoRelativePath) {
  if (typeof repoRelativePath !== 'string') {
    throw new Error('STOP: manifest path must be a string');
  }
  if (repoRelativePath !== repoRelativePath.trim()) {
    throw new Error('STOP: manifest path has surrounding whitespace');
  }
  if (
    repoRelativePath.includes('\\') ||
    repoRelativePath.includes('\0') ||
    repoRelativePath.includes('//')
  ) {
    throw new Error('STOP: manifest path has illegal separators');
  }
  if (repoRelativePath.startsWith('/') || /^[A-Za-z]:/.test(repoRelativePath)) {
    throw new Error('STOP: manifest path must not be absolute');
  }
  const segments = repoRelativePath.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new Error('STOP: manifest path has non-canonical segments');
  }
  if (repoRelativePath === H8_CAPTURE_SOURCE_SIDECAR_PATH) {
    throw new Error('STOP: activation sidecar must never appear in a daily capture manifest');
  }
  if (OBSERVATION_PATH_RE.test(repoRelativePath) || CLOSE_PATH_RE.test(repoRelativePath)) {
    return repoRelativePath;
  }
  throw new Error(`STOP: manifest path is not an allowed H8 scientific artifact: ${repoRelativePath}`);
}

export function expectedPublishedPercent(officialDecimalWeight) {
  return officialDecimalWeight * 100;
}

export function validatePublishedWeight(factor, officialDecimalWeight) {
  const expected = expectedPublishedPercent(officialDecimalWeight);
  const hasWeight = Object.prototype.hasOwnProperty.call(factor, 'weight') && factor.weight != null;
  const hasPct =
    Object.prototype.hasOwnProperty.call(factor, 'weight_pct') && factor.weight_pct != null;
  if (hasWeight && hasPct && factor.weight !== factor.weight_pct) {
    throw new Error(`STOP: published weight vs weight_pct mismatch for ${factor.key}`);
  }
  if (hasWeight) {
    if (typeof factor.weight !== 'number' || !Number.isFinite(factor.weight)) {
      throw new Error(`STOP: published weight for ${factor.key} is not a finite Number`);
    }
    if (factor.weight !== expected) {
      throw new Error(`STOP: published weight-unit mismatch for ${factor.key}`);
    }
  }
  if (hasPct) {
    if (typeof factor.weight_pct !== 'number' || !Number.isFinite(factor.weight_pct)) {
      throw new Error(`STOP: published weight_pct for ${factor.key} is not a finite Number`);
    }
    if (factor.weight_pct !== expected) {
      throw new Error(`STOP: published weight_pct-unit mismatch for ${factor.key}`);
    }
  }
}

export function liqHeavyWeight(key) {
  if (key === 'trend_valuation') return LIQ_HEAVY_TREND_WEIGHT;
  if (key === 'stablecoins') return 0.18 * (0.35 / 0.3);
  if (key === 'etf_flows') return 0.077 * (0.35 / 0.3);
  if (key === 'net_liquidity') return 0.043 * (0.35 / 0.3);
  return OFFICIAL_WEIGHTS[key];
}

export function momTiltedWeight(key) {
  if (key === 'trend_valuation') return MOM_TILTED_TREND_WEIGHT;
  if (key === 'stablecoins') return 0.18 * (0.25 / 0.3);
  if (key === 'etf_flows') return 0.077 * (0.25 / 0.3);
  if (key === 'net_liquidity') return 0.043 * (0.25 / 0.3);
  return OFFICIAL_WEIGHTS[key];
}

export function roundClampScore(weightedSum) {
  return Math.round(Math.max(0, Math.min(100, weightedSum)));
}

export function computeOfficialScore(scoresByKey) {
  let weightedSum = 0;
  for (const key of REQUIRED_FACTOR_KEYS) {
    weightedSum += scoresByKey[key] * OFFICIAL_WEIGHTS[key];
  }
  return roundClampScore(weightedSum);
}

export function computeLiqHeavyScore(scoresByKey) {
  let weightedSum = 0;
  for (const key of REQUIRED_FACTOR_KEYS) {
    weightedSum += scoresByKey[key] * liqHeavyWeight(key);
  }
  return roundClampScore(weightedSum);
}

export function computeMomTiltedScore(scoresByKey) {
  let weightedSum = 0;
  for (const key of REQUIRED_FACTOR_KEYS) {
    weightedSum += scoresByKey[key] * momTiltedWeight(key);
  }
  return roundClampScore(weightedSum);
}

export function buildModelWeightDefinitions() {
  const official = {};
  const liqHeavy = {};
  const momTilted = {};
  for (const key of REQUIRED_FACTOR_KEYS) {
    const officialWeight = OFFICIAL_WEIGHTS[key];
    official[key] = orderedObject(['definition', 'evaluated_weight'], {
      definition: formatOfficialDefinition(officialWeight),
      evaluated_weight: officialWeight,
    });
    if (key === 'trend_valuation') {
      liqHeavy[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: '0.25',
        evaluated_weight: LIQ_HEAVY_TREND_WEIGHT,
      });
      momTilted[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: '0.35',
        evaluated_weight: MOM_TILTED_TREND_WEIGHT,
      });
    } else if (key === 'stablecoins' || key === 'etf_flows' || key === 'net_liquidity') {
      liqHeavy[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: LIQ_HEAVY_LIQUIDITY_DEFINITIONS[key],
        evaluated_weight: liqHeavyWeight(key),
      });
      momTilted[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: MOM_TILTED_LIQUIDITY_DEFINITIONS[key],
        evaluated_weight: momTiltedWeight(key),
      });
    } else {
      liqHeavy[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: formatOfficialDefinition(officialWeight),
        evaluated_weight: officialWeight,
      });
      momTilted[key] = orderedObject(['definition', 'evaluated_weight'], {
        definition: formatOfficialDefinition(officialWeight),
        evaluated_weight: officialWeight,
      });
    }
  }
  return orderedObject(['official', 'liq_heavy', 'mom_tilted'], {
    official,
    liq_heavy: liqHeavy,
    mom_tilted: momTilted,
  });
}

function formatOfficialDefinition(weight) {
  if (weight === 0.3) return '0.30';
  if (weight === 0.2) return '0.20';
  if (weight === 0.1) return '0.10';
  if (weight === 0.18) return '0.18';
  if (weight === 0.077) return '0.077';
  if (weight === 0.043) return '0.043';
  throw new Error('STOP: unexpected Official weight formatting');
}

export function assertJsonSafe(value, label = 'value') {
  if (value === undefined) throw new Error(`STOP: ${label} is undefined`);
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`STOP: ${label} is not a finite Number`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertJsonSafe(child, `${label}.${key}`);
    }
  }
}

export function canonicalizeJson(value) {
  assertJsonSafe(value);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (text.includes('\r')) throw new Error('STOP: canonical JSON must be LF only');
  if (text.charCodeAt(0) === 0xfeff) throw new Error('STOP: canonical JSON must not include BOM');
  return text;
}

export function parseCanonicalJson(text, label = 'json') {
  if (typeof text !== 'string') throw new Error(`STOP: ${label} must be text`);
  if (text.includes('\r')) throw new Error(`STOP: ${label} must be LF only`);
  if (text.charCodeAt(0) === 0xfeff) throw new Error(`STOP: ${label} must not include BOM`);
  if (!text.endsWith('\n')) throw new Error(`STOP: ${label} must end with LF`);
  return JSON.parse(text);
}

export function parseAndAssertCanonicalArtifact(text, label = 'json') {
  const obj = parseCanonicalJson(text, label);
  const again = canonicalizeJson(obj);
  if (again !== text) throw new Error(`STOP: ${label} is not canonical serialized JSON`);
  return obj;
}

export function parseStrictSha256(value, label = 'sha256') {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`STOP: ${label} is not a 64-character lowercase SHA256`);
  }
  return value;
}

function factorTimestamp(factor) {
  const hasLastUtc = factor.last_utc != null;
  const hasLastUpdated = factor.lastUpdated != null;
  if (hasLastUtc && hasLastUpdated) {
    if (factor.last_utc !== factor.lastUpdated) {
      throw new Error(`STOP: factor timestamp mismatch for ${factor.key}`);
    }
    return parseStrictUtcTimestamp(factor.last_utc, `${factor.key}.last_utc`);
  }
  if (hasLastUtc) return parseStrictUtcTimestamp(factor.last_utc, `${factor.key}.last_utc`);
  if (hasLastUpdated) {
    return parseStrictUtcTimestamp(factor.lastUpdated, `${factor.key}.lastUpdated`);
  }
  return null;
}

export function extractRequiredFactors(latest) {
  if (!latest || !Array.isArray(latest.factors)) {
    throw new Error('STOP: latest.json factors must be an array');
  }
  const byKey = new Map();
  for (const factor of latest.factors) {
    if (!factor || typeof factor.key !== 'string') {
      throw new Error('STOP: latest.json factor is missing key');
    }
    if (!REQUIRED_FACTOR_KEYS.includes(factor.key)) continue;
    if (byKey.has(factor.key)) {
      throw new Error(`STOP: duplicate required factor ${factor.key}`);
    }
    byKey.set(factor.key, factor);
  }
  return byKey;
}

export function evaluateCommonEligibility(factorsByKey) {
  const reasons = [];
  const snapshots = [];
  for (const key of REQUIRED_FACTOR_KEYS) {
    const factor = factorsByKey.get(key);
    if (!factor) {
      reasons.push(`MISSING_FACTOR:${key}`);
      continue;
    }
    validatePublishedWeight(factor, OFFICIAL_WEIGHTS[key]);
    const scoreOk =
      typeof factor.score === 'number' &&
      Number.isFinite(factor.score) &&
      factor.score >= 0 &&
      factor.score <= 100;
    if (!scoreOk) reasons.push(`INVALID_SCORE:${key}`);
    if (factor.status !== 'fresh') reasons.push(`STATUS_NOT_FRESH:${key}`);
    let lastUpdated = null;
    try {
      lastUpdated = factorTimestamp(factor);
    } catch (error) {
      throw error;
    }
    if (factor.status === 'fresh' && lastUpdated == null) {
      reasons.push(`MISSING_TIMESTAMP:${key}`);
    }
    snapshots.push(
      orderedObject(FACTOR_SNAPSHOT_KEY_ORDER, {
        key,
        score: scoreOk ? factor.score : null,
        status: typeof factor.status === 'string' ? factor.status : null,
        last_updated_utc: lastUpdated,
        official_weight: OFFICIAL_WEIGHTS[key],
      })
    );
  }
  if (reasons.length === 0) {
    return {
      common_eligibility_status: 'ELIGIBLE',
      eligibility_reason: 'ALL_REQUIRED_FACTORS_FRESH',
      factors: snapshots,
    };
  }
  return {
    common_eligibility_status: 'NOT_ELIGIBLE',
    eligibility_reason: reasons.join('|'),
    factors: snapshots,
  };
}

export function classifyOfficialIntegrity({ eligible, publishedScore, formulaScore }) {
  if (!eligible) return 'NOT_CHECKED_NOT_ELIGIBLE';
  if (publishedScore === formulaScore) return 'MATCH';
  return 'INTEGRITY_MISMATCH';
}

export function classifyAnalysisStatus({ eligibilityStatus, integrityStatus }) {
  if (eligibilityStatus !== 'ELIGIBLE') return 'OBSERVATION_NOT_ELIGIBLE';
  if (integrityStatus === 'INTEGRITY_MISMATCH') return 'INTEGRITY_MISMATCH';
  return 'ELIGIBLE';
}

export function observationDateFromLatest(latest) {
  if (!latest || latest.ok !== true) throw new Error('STOP: latest.json ok must be true');
  const observationDate = utcCalendarDateFromTimestamp(latest.as_of_utc, 'latest.as_of_utc');
  if (latest.snapshot_date != null) {
    const snapshotDate = parseStrictUtcCalendarDate(latest.snapshot_date, 'latest.snapshot_date');
    if (snapshotDate !== observationDate) {
      throw new Error('STOP: latest.snapshot_date is inconsistent with as_of_utc');
    }
  }
  return observationDate;
}

export function assertLatestConfigAgreement(latest, config) {
  if (!latest || latest.ok !== true) throw new Error('STOP: latest.json ok must be true');
  if (latest.model_version !== EXPECTED_LATEST_MODEL_VERSION) {
    throw new Error('STOP: latest.model_version mismatch');
  }
  if (latest.implementation_revision !== EXPECTED_IMPLEMENTATION_REVISION) {
    throw new Error('STOP: latest.implementation_revision mismatch');
  }
  if (!config || typeof config !== 'object') throw new Error('STOP: dashboard-config missing');
  if (config.model_version !== EXPECTED_LATEST_MODEL_VERSION) {
    throw new Error('STOP: config.model_version mismatch');
  }
  if (config.implementation_revision !== EXPECTED_IMPLEMENTATION_REVISION) {
    throw new Error('STOP: config.implementation_revision mismatch');
  }
  if (config.ssot_version !== EXPECTED_SSOT_VERSION) {
    throw new Error('STOP: config.ssot_version mismatch');
  }
  if (latest.model_version !== config.model_version) {
    throw new Error('STOP: latest/config model_version disagreement');
  }
  if (latest.implementation_revision !== config.implementation_revision) {
    throw new Error('STOP: latest/config implementation_revision disagreement');
  }
}

export function assertSameRunTemporalProof({ etlStartedUtc, asOfUtc, captureRunUtc }) {
  const etl = parseStrictUtcTimestamp(etlStartedUtc, 'H8_ETL_STARTED_UTC');
  const asOf = parseStrictUtcTimestamp(asOfUtc, 'latest.as_of_utc');
  const capture = parseStrictUtcTimestamp(captureRunUtc, 'capture_run_utc');
  const etlMs = Date.parse(etl);
  const asOfMs = Date.parse(asOf);
  const captureMs = Date.parse(capture);
  if (!(etlMs <= asOfMs && asOfMs <= captureMs)) {
    throw new Error('STOP: latest.as_of_utc is not between ETL start and capture time');
  }
}

export function isObservationInWindow(observationDate) {
  const date = parseStrictUtcCalendarDate(observationDate, 'observation_date');
  return (
    compareUtcDates(date, OBSERVATION_WINDOW_START) >= 0 &&
    compareUtcDates(date, OBSERVATION_WINDOW_END) <= 0
  );
}

export function buildObservationObject({
  captureSourceSha,
  observationDate,
  asOfUtc,
  captureCreatedUtc,
  etlStartedUtc,
  provenance,
  production,
  latestSha256,
  eligibility,
  officialPublishedScore,
  officialFormulaScore,
  liqHeavyScore,
  momTiltedScore,
}) {
  const obj = orderedObject(OBSERVATION_KEY_ORDER, {
    study_id: STUDY_ID,
    protocol_version: H8_PROTOCOL_VERSION,
    protocol_sha: H8_PROTOCOL_SHA,
    h8_capture_source_sha: parseStrictLowerSha(captureSourceSha, 'h8_capture_source_sha'),
    capture_contract_version: H8_CAPTURE_CONTRACT_VERSION,
    capture_contract_sha: H8_CAPTURE_CONTRACT_SHA,
    observation_date: parseStrictUtcCalendarDate(observationDate, 'observation_date'),
    scheduled_event: SCHEDULED_EVENT,
    observation_as_of_utc: parseStrictUtcTimestamp(asOfUtc, 'observation_as_of_utc'),
    capture_created_utc: parseStrictUtcTimestamp(captureCreatedUtc, 'capture_created_utc'),
    etl_started_utc: parseStrictUtcTimestamp(etlStartedUtc, 'etl_started_utc'),
    source_base_git_sha: parseStrictLowerSha(provenance.sourceBaseGitSha, 'source_base_git_sha'),
    github_run_id: provenance.githubRunId,
    github_run_attempt: provenance.githubRunAttempt,
    github_event_name: provenance.githubEventName,
    github_workflow_ref: provenance.githubWorkflowRef,
    github_sha: parseStrictLowerSha(provenance.githubSha, 'github_sha'),
    production_model_version: production.modelVersion,
    production_implementation_revision: production.implementationRevision,
    production_ssot_version: production.ssotVersion,
    production_config_git_blob: production.configGitBlob,
    production_config_sha256: production.configSha256,
    latest_artifact_sha256: latestSha256,
    common_eligibility_status: eligibility.common_eligibility_status,
    eligibility_reason: eligibility.eligibility_reason,
    official_integrity_status: eligibility.official_integrity_status,
    analysis_status: eligibility.analysis_status,
    factors: eligibility.factors,
    official_published_score: officialPublishedScore,
    official_formula_score: officialFormulaScore,
    liq_heavy_score: liqHeavyScore,
    mom_tilted_score: momTiltedScore,
    model_versions: orderedObject(['official', 'liq_heavy', 'mom_tilted'], MODEL_VERSIONS),
    model_weight_definitions: buildModelWeightDefinitions(),
  });
  return obj;
}

export function buildCloseObject({
  captureSourceSha,
  closeDateUtc,
  closeUsd,
  source,
  sourceRowIngestedAtUtc,
  capturedAtUtc,
  sourceArtifactSha256,
  provenance,
}) {
  return orderedObject(CLOSE_KEY_ORDER, {
    study_id: STUDY_ID,
    protocol_version: H8_PROTOCOL_VERSION,
    protocol_sha: H8_PROTOCOL_SHA,
    h8_capture_source_sha: parseStrictLowerSha(captureSourceSha, 'h8_capture_source_sha'),
    capture_contract_version: H8_CAPTURE_CONTRACT_VERSION,
    capture_contract_sha: H8_CAPTURE_CONTRACT_SHA,
    close_date_utc: parseStrictUtcCalendarDate(closeDateUtc, 'close_date_utc'),
    close_usd: closeUsd,
    source,
    source_row_ingested_at_utc: parseStrictUtcTimestamp(
      sourceRowIngestedAtUtc,
      'source_row_ingested_at_utc'
    ),
    captured_at_utc: parseStrictUtcTimestamp(capturedAtUtc, 'captured_at_utc'),
    source_artifact_path: BTC_SOURCE_PATH,
    source_artifact_sha256: sourceArtifactSha256,
    source_base_git_sha: parseStrictLowerSha(provenance.sourceBaseGitSha, 'source_base_git_sha'),
    github_run_id: provenance.githubRunId,
    github_run_attempt: provenance.githubRunAttempt,
    github_event_name: provenance.githubEventName,
    github_workflow_ref: provenance.githubWorkflowRef,
    github_sha: parseStrictLowerSha(provenance.githubSha, 'github_sha'),
  });
}

export function parseStrictPositiveClose(text, label = 'close_usd') {
  if (typeof text !== 'string' || text === '') {
    throw new Error(`STOP: ${label} is blank`);
  }
  if (!STRICT_NUMBER_RE.test(text)) {
    throw new Error(`STOP: ${label} has trailing numeric junk or is malformed`);
  }
  const n = Number(text);
  if (!Number.isFinite(n)) throw new Error(`STOP: ${label} is not finite`);
  if (!(n > 0)) throw new Error(`STOP: ${label} must be > 0`);
  return n;
}

export function parseBtcPriceHistoryCsv(text) {
  if (typeof text !== 'string') throw new Error('STOP: BTC CSV must be text');
  if (text.includes('\r')) throw new Error('STOP: BTC CSV must be LF only');
  if (!text.endsWith('\n')) throw new Error('STOP: BTC CSV must end with LF');
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length < 1) throw new Error('STOP: BTC CSV missing header');
  if (lines[0] !== BTC_HEADER) throw new Error('STOP: BTC CSV header mismatch');
  const byDate = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '') throw new Error(`STOP: BTC CSV blank line at ${i + 1}`);
    const cols = line.split(',');
    if (cols.length !== 4) throw new Error(`STOP: BTC CSV column count mismatch at ${i + 1}`);
    const [dateUtc, closeUsd, source, ingested] = cols;
    const date = parseStrictUtcCalendarDate(dateUtc, `BTC CSV date at ${i + 1}`);
    if (byDate.has(date)) throw new Error(`STOP: BTC CSV duplicate date ${date}`);
    if (typeof source !== 'string' || source === '') {
      throw new Error(`STOP: BTC CSV missing source at ${date}`);
    }
    const close = parseStrictPositiveClose(closeUsd, `BTC CSV close at ${date}`);
    const ingestedAt = parseStrictUtcTimestamp(ingested, `BTC CSV ingested_at_utc at ${date}`);
    byDate.set(date, {
      date_utc: date,
      close_usd: close,
      source,
      ingested_at_utc: ingestedAt,
    });
  }
  return byDate;
}

export function selectCatchUpCloseDates({ captureRunUtc, existingCloseDates }) {
  const t = utcCalendarDateFromTimestamp(captureRunUtc, 'capture_run_utc');
  if (compareUtcDates(t, CLOSE_RECOVERY_CUTOFF) > 0) return [];
  const lastEligible = addUtcDays(t, -1);
  const existing = new Set(existingCloseDates || []);
  const out = [];
  for (const date of enumerateUtcDates(CLOSE_UNIVERSE_START, CLOSE_UNIVERSE_END)) {
    if (compareUtcDates(date, lastEligible) > 0) continue;
    if (existing.has(date)) continue;
    out.push(date);
  }
  return out;
}

export function isCompletedUtcCandle(date, captureRunUtc) {
  const d = parseStrictUtcCalendarDate(date, 'close_date_utc');
  const t = utcCalendarDateFromTimestamp(captureRunUtc, 'capture_run_utc');
  return compareUtcDates(d, addUtcDays(t, -1)) <= 0;
}

export function buildCreatedManifest({ captureRunUtc, files }) {
  const orderedFiles = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const normalized = orderedFiles.map((entry) =>
    orderedObject(MANIFEST_FILE_KEY_ORDER, {
      path: assertAllowedManifestPath(entry.path),
      sha256: entry.sha256,
    })
  );
  return orderedObject(MANIFEST_KEY_ORDER, {
    manifest_version: MANIFEST_VERSION,
    capture_run_utc: parseStrictUtcTimestamp(captureRunUtc, 'capture_run_utc'),
    files: normalized,
  });
}

export function validateObservationSchema(obj) {
  const keys = Object.keys(obj);
  if (keys.length !== OBSERVATION_KEY_ORDER.length) {
    throw new Error('STOP: observation key count mismatch');
  }
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== OBSERVATION_KEY_ORDER[i]) {
      throw new Error(`STOP: observation key order mismatch at ${OBSERVATION_KEY_ORDER[i]}`);
    }
  }
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: observation study_id mismatch');
  if (obj.protocol_version !== H8_PROTOCOL_VERSION) {
    throw new Error('STOP: observation protocol_version mismatch');
  }
  if (obj.protocol_sha !== H8_PROTOCOL_SHA) throw new Error('STOP: observation protocol_sha mismatch');
  if (obj.capture_contract_version !== H8_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: observation capture_contract_version mismatch');
  }
  if (obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: observation capture_contract_sha mismatch');
  }
  parseStrictUtcCalendarDate(obj.observation_date, 'observation_date');
  if (!Array.isArray(obj.factors) || obj.factors.length !== REQUIRED_FACTOR_KEYS.length) {
    throw new Error('STOP: observation factors length mismatch');
  }
  obj.factors.forEach((factor, index) => {
    const keysInner = Object.keys(factor);
    if (keysInner.join(',') !== FACTOR_SNAPSHOT_KEY_ORDER.join(',')) {
      throw new Error(`STOP: factor snapshot key order mismatch at ${index}`);
    }
    if (factor.key !== REQUIRED_FACTOR_KEYS[index]) {
      throw new Error('STOP: observation factor order mismatch');
    }
  });
}

export function validateCloseSchema(obj) {
  const keys = Object.keys(obj);
  if (keys.length !== CLOSE_KEY_ORDER.length) throw new Error('STOP: close key count mismatch');
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== CLOSE_KEY_ORDER[i]) throw new Error('STOP: close key order mismatch');
  }
  if (obj.protocol_sha !== H8_PROTOCOL_SHA) throw new Error('STOP: close protocol_sha mismatch');
  if (obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: close capture_contract_sha mismatch');
  }
  if (obj.source_artifact_path !== BTC_SOURCE_PATH) {
    throw new Error('STOP: close source_artifact_path mismatch');
  }
  if ('mace' in obj || 'score' in obj || 'return' in obj) {
    throw new Error('STOP: close artifact contains performance fields');
  }
}

function assertGithubProvenance(obj, label) {
  if (typeof obj.github_run_id !== 'string') throw new Error(`STOP: ${label} github_run_id must be a string`);
  parseGitHubRunId(obj.github_run_id);
  if (obj.github_run_attempt !== 1) throw new Error(`STOP: ${label} github_run_attempt must be 1`);
  if (obj.github_event_name !== 'schedule') throw new Error(`STOP: ${label} github_event_name must be schedule`);
  if (typeof obj.github_workflow_ref !== 'string' || obj.github_workflow_ref === '') {
    throw new Error(`STOP: ${label} github_workflow_ref must be a non-empty string`);
  }
  parseStrictLowerSha(obj.github_sha, `${label}.github_sha`);
  parseStrictLowerSha(obj.source_base_git_sha, `${label}.source_base_git_sha`);
  if (obj.source_base_git_sha !== obj.github_sha) {
    throw new Error(`STOP: ${label} source_base_git_sha must equal github_sha`);
  }
}

export function validateCompleteObservation(obj, { expectedDate, captureSourceSha }) {
  validateObservationSchema(obj);
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: observation study_id mismatch');
  if (obj.protocol_version !== H8_PROTOCOL_VERSION) {
    throw new Error('STOP: observation protocol_version mismatch');
  }
  if (obj.protocol_sha !== H8_PROTOCOL_SHA) throw new Error('STOP: observation protocol_sha mismatch');
  if (obj.h8_capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: observation h8_capture_source_sha mismatch');
  }
  if (obj.capture_contract_version !== H8_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: observation capture_contract_version mismatch');
  }
  if (obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: observation capture_contract_sha mismatch');
  }
  if (obj.observation_date !== parseStrictUtcCalendarDate(expectedDate, 'expectedDate')) {
    throw new Error('STOP: observation_date does not match expected date');
  }
  if (obj.scheduled_event !== SCHEDULED_EVENT) throw new Error('STOP: scheduled_event mismatch');
  parseStrictUtcTimestamp(obj.observation_as_of_utc, 'observation_as_of_utc');
  parseStrictUtcTimestamp(obj.capture_created_utc, 'capture_created_utc');
  parseStrictUtcTimestamp(obj.etl_started_utc, 'etl_started_utc');
  assertSameRunTemporalProof({
    etlStartedUtc: obj.etl_started_utc,
    asOfUtc: obj.observation_as_of_utc,
    captureRunUtc: obj.capture_created_utc,
  });
  assertGithubProvenance(obj, 'observation');
  if (obj.production_model_version !== EXPECTED_LATEST_MODEL_VERSION) {
    throw new Error('STOP: production_model_version mismatch');
  }
  if (obj.production_implementation_revision !== EXPECTED_IMPLEMENTATION_REVISION) {
    throw new Error('STOP: production_implementation_revision mismatch');
  }
  if (obj.production_ssot_version !== EXPECTED_SSOT_VERSION) {
    throw new Error('STOP: production_ssot_version mismatch');
  }
  if (obj.production_config_git_blob !== PRODUCTION_CONFIG_GIT_BLOB) {
    throw new Error('STOP: production_config_git_blob mismatch');
  }
  if (obj.production_config_sha256 !== PRODUCTION_CONFIG_SHA256) {
    throw new Error('STOP: production_config_sha256 mismatch');
  }
  parseStrictSha256(obj.latest_artifact_sha256, 'latest_artifact_sha256');
  if (!['ELIGIBLE', 'NOT_ELIGIBLE'].includes(obj.common_eligibility_status)) {
    throw new Error('STOP: invalid common_eligibility_status');
  }
  if (typeof obj.eligibility_reason !== 'string' || obj.eligibility_reason === '') {
    throw new Error('STOP: eligibility_reason missing');
  }
  if (
    obj.common_eligibility_status === 'ELIGIBLE' &&
    obj.eligibility_reason !== 'ALL_REQUIRED_FACTORS_FRESH'
  ) {
    throw new Error('STOP: eligible observation has unexpected eligibility_reason');
  }
  if (
    !['MATCH', 'INTEGRITY_MISMATCH', 'NOT_CHECKED_NOT_ELIGIBLE'].includes(obj.official_integrity_status)
  ) {
    throw new Error('STOP: invalid official_integrity_status');
  }
  if (!['ELIGIBLE', 'INTEGRITY_MISMATCH', 'OBSERVATION_NOT_ELIGIBLE'].includes(obj.analysis_status)) {
    throw new Error('STOP: invalid analysis_status');
  }
  const expectedStatus = classifyAnalysisStatus({
    eligibilityStatus: obj.common_eligibility_status,
    integrityStatus: obj.official_integrity_status,
  });
  if (obj.analysis_status !== expectedStatus) {
    throw new Error('STOP: analysis_status inconsistent with eligibility/integrity');
  }
  obj.factors.forEach((factor, index) => {
    const key = REQUIRED_FACTOR_KEYS[index];
    if (factor.official_weight !== OFFICIAL_WEIGHTS[key]) {
      throw new Error(`STOP: factor official_weight mismatch for ${key}`);
    }
    if (factor.score != null) {
      if (typeof factor.score !== 'number' || !Number.isFinite(factor.score) || factor.score < 0 || factor.score > 100) {
        throw new Error(`STOP: factor score out of bounds for ${key}`);
      }
    }
    if (obj.common_eligibility_status === 'ELIGIBLE') {
      if (factor.status !== 'fresh') throw new Error(`STOP: eligible factor ${key} is not fresh`);
      parseStrictUtcTimestamp(factor.last_updated_utc, `${key}.last_updated_utc`);
    }
  });
  if (obj.common_eligibility_status === 'NOT_ELIGIBLE') {
    if (obj.official_formula_score !== null || obj.liq_heavy_score !== null || obj.mom_tilted_score !== null) {
      throw new Error('STOP: NOT_ELIGIBLE observation must null formula/challenger scores');
    }
    if (obj.official_integrity_status !== 'NOT_CHECKED_NOT_ELIGIBLE') {
      throw new Error('STOP: NOT_ELIGIBLE integrity status mismatch');
    }
  } else {
    for (const field of ['official_formula_score', 'liq_heavy_score', 'mom_tilted_score', 'official_published_score']) {
      const value = obj[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error(`STOP: ${field} out of bounds`);
      }
    }
  }
  const versions = obj.model_versions;
  if (
    versions.official !== MODEL_VERSIONS.official ||
    versions.liq_heavy !== MODEL_VERSIONS.liq_heavy ||
    versions.mom_tilted !== MODEL_VERSIONS.mom_tilted
  ) {
    throw new Error('STOP: model_versions mismatch');
  }
  if (canonicalizeJson(obj.model_weight_definitions) !== canonicalizeJson(buildModelWeightDefinitions())) {
    throw new Error('STOP: model_weight_definitions mismatch');
  }
}

export function validateCompleteClose(obj, { expectedDate, captureSourceSha }) {
  validateCloseSchema(obj);
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: close study_id mismatch');
  if (obj.protocol_version !== H8_PROTOCOL_VERSION) throw new Error('STOP: close protocol_version mismatch');
  if (obj.protocol_sha !== H8_PROTOCOL_SHA) throw new Error('STOP: close protocol_sha mismatch');
  if (obj.h8_capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: close h8_capture_source_sha mismatch');
  }
  if (obj.capture_contract_version !== H8_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: close capture_contract_version mismatch');
  }
  if (obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: close capture_contract_sha mismatch');
  }
  if (obj.close_date_utc !== parseStrictUtcCalendarDate(expectedDate, 'expectedDate')) {
    throw new Error('STOP: close_date_utc does not match expected date');
  }
  if (typeof obj.close_usd !== 'number' || !Number.isFinite(obj.close_usd) || !(obj.close_usd > 0)) {
    throw new Error('STOP: close_usd must be finite > 0');
  }
  if (typeof obj.source !== 'string' || obj.source === '') throw new Error('STOP: close source is blank');
  parseStrictUtcTimestamp(obj.source_row_ingested_at_utc, 'source_row_ingested_at_utc');
  parseStrictUtcTimestamp(obj.captured_at_utc, 'captured_at_utc');
  if (obj.source_artifact_path !== BTC_SOURCE_PATH) throw new Error('STOP: source_artifact_path mismatch');
  parseStrictSha256(obj.source_artifact_sha256, 'source_artifact_sha256');
  assertGithubProvenance(obj, 'close');
}

export function sha256HexFromNodeCrypto(crypto, buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function parseGitHubRunId(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new Error('STOP: H8_GITHUB_RUN_ID must be numeric');
  }
  return value;
}

export function parseGitHubRunAttempt(value) {
  if (value !== '1') throw new Error('STOP: H8_GITHUB_RUN_ATTEMPT must be 1');
  return 1;
}

export function assertCaptureEventGate(env) {
  if (env.GITHUB_ACTIONS !== 'true') throw new Error('STOP: real capture requires GITHUB_ACTIONS=true');
  if (env.H8_GITHUB_EVENT_NAME !== 'schedule') {
    throw new Error('STOP: real capture requires scheduled event');
  }
  parseGitHubRunAttempt(env.H8_GITHUB_RUN_ATTEMPT);
  parseGitHubRunId(env.H8_GITHUB_RUN_ID);
  parseStrictLowerSha(env.H8_GITHUB_SHA, 'H8_GITHUB_SHA');
  if (typeof env.H8_GITHUB_WORKFLOW_REF !== 'string' || env.H8_GITHUB_WORKFLOW_REF === '') {
    throw new Error('STOP: H8_GITHUB_WORKFLOW_REF is required');
  }
}

export function workflowStaticChecks(yamlText) {
  if (typeof yamlText !== 'string') throw new Error('STOP: workflow text missing');
  const findings = [];
  if (!/concurrency:\s*\n\s*group:\s*etl\s*\n\s*cancel-in-progress:\s*false/.test(yamlText)) {
    findings.push('concurrency serialization missing');
  }
  if (!/cron:\s*"0 11 \* \* \*"/.test(yamlText)) findings.push('schedule cron changed');
  if (!/workflow_dispatch:/.test(yamlText)) findings.push('workflow_dispatch missing');
  if (!/github\.event_name == 'schedule' && github\.run_attempt == 1/.test(yamlText)) {
    findings.push('H8 event gate missing');
  }
  if (/git add research(?:\/h8-prospective)?(?:\s|$)/.test(yamlText)) {
    findings.push('broad research staging present');
  }
  if (!yamlText.includes('research(h8): capture prospective artifacts [skip ci]')) {
    findings.push('H8 commit subject missing');
  }
  const h8CommitIdx = yamlText.indexOf('name: H8 scientific commit');
  if (h8CommitIdx === -1) findings.push('H8 scientific commit step missing');
  else {
    const h8Block = yamlText.slice(h8CommitIdx);
    if (/git pull origin main(?! --rebase)/.test(h8Block) || /trying merge instead/.test(h8Block)) {
      findings.push('H8 scientific rebase has merge fallback');
    }
  }
  if (yamlText.includes('H8_CAPTURE_SOURCE_SHA.txt') && />>.*H8_CAPTURE_SOURCE_SHA\.txt/.test(yamlText)) {
    findings.push('Stage A must not write activation sidecar');
  }
  const etlIdx = yamlText.indexOf('npm run etl:compute');
  const preflightIdx = yamlText.indexOf('H8 identity preflight');
  const captureIdx = yamlText.indexOf('H8 prospective capture');
  if (preflightIdx === -1 || etlIdx === -1 || preflightIdx > etlIdx) {
    findings.push('H8 preflight is not before ETL');
  }
  if (captureIdx === -1 || captureIdx < etlIdx) {
    findings.push('H8 capture is not after ETL');
  }
  if (!yamlText.includes('git add -A public/data public/signals public/extras public/alerts')) {
    findings.push('production staging paths missing');
  }
  return findings;
}

export function proposeObservation({
  latest,
  config,
  latestSha256,
  etlStartedUtc,
  captureRunUtc,
  captureSourceSha,
  provenance,
  production,
}) {
  assertLatestConfigAgreement(latest, config);
  assertSameRunTemporalProof({
    etlStartedUtc,
    asOfUtc: latest.as_of_utc,
    captureRunUtc,
  });
  const observationDate = observationDateFromLatest(latest);
  if (!isObservationInWindow(observationDate)) {
    return { skip: true, reason: 'OUTSIDE_OBSERVATION_WINDOW', observationDate };
  }
  const factorsByKey = extractRequiredFactors(latest);
  const eligibility = evaluateCommonEligibility(factorsByKey);
  const eligible = eligibility.common_eligibility_status === 'ELIGIBLE';
  let officialPublishedScore = null;
  if (typeof latest.composite_score === 'number' && Number.isFinite(latest.composite_score)) {
    officialPublishedScore = latest.composite_score;
  }
  let officialFormulaScore = null;
  let liqHeavyScore = null;
  let momTiltedScore = null;
  if (eligible) {
    if (
      typeof officialPublishedScore !== 'number' ||
      !Number.isFinite(officialPublishedScore) ||
      officialPublishedScore < 0 ||
      officialPublishedScore > 100
    ) {
      throw new Error('STOP: official_published_score must be finite 0-100 when ELIGIBLE');
    }
    const scoresByKey = Object.fromEntries(
      eligibility.factors.map((factor) => [factor.key, factor.score])
    );
    officialFormulaScore = computeOfficialScore(scoresByKey);
    liqHeavyScore = computeLiqHeavyScore(scoresByKey);
    momTiltedScore = computeMomTiltedScore(scoresByKey);
  }
  const officialIntegrityStatus = classifyOfficialIntegrity({
    eligible,
    publishedScore: officialPublishedScore,
    formulaScore: officialFormulaScore,
  });
  const analysisStatus = classifyAnalysisStatus({
    eligibilityStatus: eligibility.common_eligibility_status,
    integrityStatus: officialIntegrityStatus,
  });
  const observation = buildObservationObject({
    captureSourceSha,
    observationDate,
    asOfUtc: latest.as_of_utc,
    captureCreatedUtc: captureRunUtc,
    etlStartedUtc,
    provenance,
    production,
    latestSha256,
    eligibility: {
      ...eligibility,
      official_integrity_status: officialIntegrityStatus,
      analysis_status: analysisStatus,
    },
    officialPublishedScore,
    officialFormulaScore,
    liqHeavyScore,
    momTiltedScore,
  });
  validateObservationSchema(observation);
  return {
    skip: false,
    path: observationPathForDate(observationDate),
    observation,
    observationDate,
  };
}

export function proposeCloseArtifacts({
  csvText,
  sourceArtifactSha256,
  captureRunUtc,
  existingCloseDates,
  captureSourceSha,
  provenance,
}) {
  const byDate = parseBtcPriceHistoryCsv(csvText);
  const dates = selectCatchUpCloseDates({ captureRunUtc, existingCloseDates });
  const proposed = [];
  for (const date of dates) {
    const row = byDate.get(date);
    if (!row) continue;
    if (!isCompletedUtcCandle(date, captureRunUtc)) continue;
    const close = buildCloseObject({
      captureSourceSha,
      closeDateUtc: date,
      closeUsd: row.close_usd,
      source: row.source,
      sourceRowIngestedAtUtc: row.ingested_at_utc,
      capturedAtUtc: captureRunUtc,
      sourceArtifactSha256,
      provenance,
    });
    validateCloseSchema(close);
    proposed.push({ path: closePathForDate(date), close });
  }
  return proposed;
}
