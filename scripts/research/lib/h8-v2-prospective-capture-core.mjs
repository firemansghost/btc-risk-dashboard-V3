/**
 * H8 v2 prospective capture core — deterministic scientific / schema logic only.
 * No filesystem writes. No network. No provider clients.
 */

export const H8_V2_PROTOCOL_VERSION = 'h8-prospective-three-model-v2';
export const H8_V2_PROTOCOL_SHA = 'a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3';
export const H8_V2_PROTOCOL_DOCUMENT_PATH =
  'docs/H8_V2_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md';
export const H8_V2_PROTOCOL_DOCUMENT_BLOB = '1f4f4999afe1c3440c69ad54564dca948e61c603';

export const H8_V2_CAPTURE_CONTRACT_VERSION = 'h8-v2-capture-implementation-contract-v1';
export const H8_V2_CAPTURE_CONTRACT_SHA = 'b1adc9889e40efd94197f33e75ddb012ec486fa2';
export const H8_V2_CAPTURE_CONTRACT_DOCUMENT_PATH = 'docs/H8_V2_CAPTURE_IMPLEMENTATION_CONTRACT.md';
export const H8_V2_CAPTURE_CONTRACT_DOCUMENT_BLOB = '4295eabfb6d288a453a877f963e7e71c70024ca8';

export const H8_V2_CAPTURE_SOURCE_SIDECAR_PATH =
  'research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt';
export const H8_V1_CAPTURE_SOURCE_SIDECAR_PATH = 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt';
export const H8_V2_START_PATH = 'research/h8-v2-prospective/H8_V2_START.json';

export const STAGE_A_RUNTIME_PATHS = Object.freeze([
  '.github/workflows/daily-etl.yml',
  'scripts/research/capture-h8-v2-prospective.mjs',
  'scripts/research/lib/h8-v2-prospective-capture-core.mjs',
  'scripts/research/lib/h8-v2-prospective-capture-io.mjs',
]);

export const SCIENTIFIC_FILE_BLOBS = Object.freeze({
  'config/dashboard-config.json': 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49',
  'lib/config-loader.mjs': '8f439254ca813050703a7c17bcd658474c19e2b2',
  'scripts/etl/compute.mjs': '6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4',
  'scripts/etl/factors.mjs': 'e9fd06df79967f0041a901e2dd971b771e669b03',
  'scripts/etl/factors/trendValuation.mjs': '3abf6f0611f86f58aca06c736d9baf41c7eb4ae9',
  'scripts/etl/stalenessUtils.mjs': '1c213b9b8eb659c9cda22d0834694ae3239eb768',
  'scripts/etl/marketCalendar.mjs': '77c5669f77bef11cbc43fb85f82bb4a42bfc2136',
  'scripts/etl/adjustments.mjs': '36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7',
  'scripts/etl/coinGeckoCache.mjs': 'fbfc5e35b3bd4af60eb00e780892b62f94e8bbff',
  'scripts/etl/priceHistory.mjs': '515b02acdd0cf4a72e62889dafb83cec6e8acd95',
  'scripts/etl/fetch-helper.mjs': 'da8ca2b441088f2e13364249e7ecbbed40dc22a4',
});

export const SCIENTIFIC_TREE_SHAS = Object.freeze({
  'scripts/etl/factors': '163b086f72ec43117e8bfcbbe5fd31732dae715d',
  'scripts/etl/lib': '64c73c01db27f1e6dbcd12d45d08c2f12bc47b12',
});

/** Deterministic §6 path → SHA in contract table order. Directory paths keep the trailing slash. */
export const SCIENTIFIC_FINGERPRINT = Object.freeze({
  'config/dashboard-config.json': 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49',
  'lib/config-loader.mjs': '8f439254ca813050703a7c17bcd658474c19e2b2',
  'scripts/etl/compute.mjs': '6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4',
  'scripts/etl/factors.mjs': 'e9fd06df79967f0041a901e2dd971b771e669b03',
  'scripts/etl/factors/': '163b086f72ec43117e8bfcbbe5fd31732dae715d',
  'scripts/etl/factors/trendValuation.mjs': '3abf6f0611f86f58aca06c736d9baf41c7eb4ae9',
  'scripts/etl/lib/': '64c73c01db27f1e6dbcd12d45d08c2f12bc47b12',
  'scripts/etl/stalenessUtils.mjs': '1c213b9b8eb659c9cda22d0834694ae3239eb768',
  'scripts/etl/marketCalendar.mjs': '77c5669f77bef11cbc43fb85f82bb4a42bfc2136',
  'scripts/etl/adjustments.mjs': '36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7',
  'scripts/etl/coinGeckoCache.mjs': 'fbfc5e35b3bd4af60eb00e780892b62f94e8bbff',
  'scripts/etl/priceHistory.mjs': '515b02acdd0cf4a72e62889dafb83cec6e8acd95',
  'scripts/etl/fetch-helper.mjs': 'da8ca2b441088f2e13364249e7ecbbed40dc22a4',
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
export const LIQ_HEAVY_LIQUIDITY_RATIO = Object.freeze({ numerator: 0.35, denominator: 0.30 });
export const MOM_TILTED_LIQUIDITY_RATIO = Object.freeze({ numerator: 0.25, denominator: 0.30 });

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

export const BTC_SOURCE_PATH = 'public/data/btc_price_history.csv';
export const LATEST_PATH = 'public/data/latest.json';
export const CONFIG_PATH = 'config/dashboard-config.json';
export const BTC_HEADER = 'date_utc,close_usd,source,ingested_at_utc';

export const MANIFEST_VERSION = 'h8-v2-created-manifest-v1';
export const STUDY_ID = 'h8-v2-prospective';
export const SCHEDULED_EVENT = 'DAILY_ETL';
export const START_SELECTION_RULE =
  'earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1';

export const OBSERVATION_SCHEMA_VERSION = 'h8-v2-observation-v1';
export const CLOSE_SCHEMA_VERSION = 'h8-v2-close-v1';
export const REHEARSAL_SCHEMA_VERSION = 'h8-v2-rehearsal-v1';
export const START_SCHEMA_VERSION = 'h8-v2-start-v1';
export const DISQUALIFICATION_SCHEMA_VERSION = 'h8-v2-disqualification-v1';

export const OBSERVATION_WINDOW_DAYS = 179;
export const CLOSE_UNIVERSE_DAYS = 209;
export const CLOSE_RECOVERY_DAYS = 217;
export const REHEARSAL_LEAD_HOURS = 72;
export const COMMITTER_FUTURE_BOUND_SECONDS = 120;
export const GITHUB_MERGED_AT_TOLERANCE_MS = 5 * 60 * 1000;

export const OBSERVATION_PATH_RE =
  /^research\/h8-v2-prospective\/observations\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/;
export const CLOSE_PATH_RE =
  /^research\/h8-v2-prospective\/btc-closes\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/;
export const REHEARSAL_PATH_RE = /^research\/h8-v2-prospective\/rehearsals\/run-[0-9]+\.json$/;
export const DISQUALIFICATION_PATH_RE =
  /^research\/h8-v2-prospective\/controls\/disqualification-[0-9]+\.json$/;

export const OBSERVATION_KEY_ORDER = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'h8_v2_capture_source_sha',
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
  'scientific_fingerprint',
  'common_eligibility_status',
  'eligibility_reason',
  'official_integrity_status',
  'axis_a_status',
  'factors',
  'official_published_score',
  'official_formula_score',
  'liq_heavy_score',
  'mom_tilted_score',
  'model_versions',
  'model_weight_definitions',
]);

export const CLOSE_KEY_ORDER = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'h8_v2_capture_source_sha',
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

export const REHEARSAL_KEY_ORDER = Object.freeze([
  'schema_version',
  'study_id',
  'artifact_type',
  'study_status',
  'observation_status',
  'btc_close_status',
  'performance_status',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'capture_source_sha',
  'scientific_fingerprint',
  'github_run_id',
  'github_run_attempt',
  'github_event_name',
  'github_workflow_ref',
  'source_checkout_sha',
  'artifact_created_utc',
  'etl_started_utc',
]);

export const START_KEY_ORDER = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'capture_source_sha',
  'scientific_fingerprint',
  'qualifying_rehearsal_path',
  'qualifying_rehearsal_commit_sha',
  'qualifying_rehearsal_run_id',
  'qualifying_rehearsal_commit_committer_utc',
  'start_selection_rule',
  'start_date_utc',
  'observation_end_date_utc',
  'required_close_end_date_utc',
  'recovery_end_date_utc',
  'authorization_created_utc',
]);

export const DISQUALIFICATION_KEY_ORDER = Object.freeze([
  'schema_version',
  'study_id',
  'artifact_type',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'capture_source_sha',
  'qualifying_rehearsal_path',
  'qualifying_rehearsal_commit_sha',
  'qualifying_rehearsal_run_id',
  'disqualification_reason_code',
  'disqualification_created_utc',
]);

export const DISQUALIFICATION_REASON_CODES = Object.freeze([
  'timestamp_integrity_failure',
  'manufactured_committer_timestamp',
  'identity_mismatch',
  'artifact_contained_scientific_fields',
  'event_gate_violation',
  'push_reachability_unproven',
  'empty_research_manifest',
  'other_operational_integrity_defect',
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

export const FORBIDDEN_CAPTURE_FLAGS = Object.freeze([
  '--date',
  '--force',
  '--backfill',
  '--output-dir',
  '--overwrite',
  '--event',
  '--run-attempt',
  '--manifest-path',
]);

export const SYNTHETIC_S_DERIVATION_EXAMPLES = Object.freeze([
  { r: '2099-06-01T11:00:00.000Z', s: '2099-06-04' },
  { r: '2099-06-01T11:00:00.001Z', s: '2099-06-05' },
  { r: '2099-06-01T08:00:00.000Z', s: '2099-06-04' },
]);

export const PRE_START_ACTIONS = Object.freeze({
  INACTIVE: 'INACTIVE',
  REHEARSAL: 'REHEARSAL',
  HOLD_LIVE_CANDIDATE: 'HOLD_LIVE_CANDIDATE',
  STUDY: 'STUDY',
});

export const RESEARCH_COMMIT_SUBJECT_CAPTURE = 'research(h8-v2): capture prospective artifacts [skip ci]';
export const RESEARCH_COMMIT_SUBJECT_REHEARSAL = 'research(h8-v2): non-study rehearsal [skip ci]';

const SHA1_RE = /^[0-9a-f]{40}$/;
const UTC_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const STRICT_NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const REHEARSAL_FORBIDDEN_FIELD_RE =
  /^(?:official_published_score|official_formula_score|liq_heavy_score|mom_tilted_score|composite_score|mace|mace30|score|return|rho|rank|close_usd|btc_close|performance|delta_rho|hit_rate|auc|R|rehearsal_commit_sha|push_result|reachability|future_commit_sha)$/i;

let counters = createCounters();

function createCounters() {
  return {
    networkRequests: 0,
    rehearsalFilesCreated: 0,
    observationFilesCreated: 0,
    closeFilesCreated: 0,
    filesWritten: 0,
    overwriteAttempts: 0,
    scientificScoresCalculated: 0,
    performanceCalculations: 0,
  };
}

export class ObservationInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ObservationInputError';
  }
}

export class CloseInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CloseInputError';
  }
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
  return parseStrictLowerSha(text, 'H8_V2_CAPTURE_SOURCE_SHA sidecar');
}

export function observationPathForDate(date) {
  const d = parseStrictUtcCalendarDate(date, 'observation_date');
  return `research/h8-v2-prospective/observations/${d}.json`;
}

export function closePathForDate(date) {
  const d = parseStrictUtcCalendarDate(date, 'close_date_utc');
  return `research/h8-v2-prospective/btc-closes/${d}.json`;
}

export function rehearsalPathForRunId(runId) {
  const id = parseGitHubRunId(runId);
  return `research/h8-v2-prospective/rehearsals/run-${id}.json`;
}

export function disqualificationPathForRunId(runId) {
  const id = parseGitHubRunId(runId);
  return `research/h8-v2-prospective/controls/disqualification-${id}.json`;
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
  if (repoRelativePath === H8_V2_CAPTURE_SOURCE_SIDECAR_PATH) {
    throw new Error('STOP: activation sidecar must never appear in a daily capture manifest');
  }
  if (repoRelativePath === H8_V1_CAPTURE_SOURCE_SIDECAR_PATH) {
    throw new Error('STOP: v1 activation sidecar must never appear in a daily capture manifest');
  }
  if (repoRelativePath === H8_V2_START_PATH) {
    throw new Error('STOP: H8_V2_START.json must never appear in a daily capture manifest');
  }
  if (DISQUALIFICATION_PATH_RE.test(repoRelativePath)) {
    throw new Error('STOP: disqualification records must never appear in a daily capture manifest');
  }
  if (
    OBSERVATION_PATH_RE.test(repoRelativePath) ||
    CLOSE_PATH_RE.test(repoRelativePath) ||
    REHEARSAL_PATH_RE.test(repoRelativePath)
  ) {
    return repoRelativePath;
  }
  throw new Error(`STOP: manifest path is not an allowed H8 v2 scientific artifact: ${repoRelativePath}`);
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
  if (key === 'stablecoins') return 0.18 * (0.35 / 0.30);
  if (key === 'etf_flows') return 0.077 * (0.35 / 0.30);
  if (key === 'net_liquidity') return 0.043 * (0.35 / 0.30);
  return OFFICIAL_WEIGHTS[key];
}

export function momTiltedWeight(key) {
  if (key === 'trend_valuation') return MOM_TILTED_TREND_WEIGHT;
  if (key === 'stablecoins') return 0.18 * (0.25 / 0.30);
  if (key === 'etf_flows') return 0.077 * (0.25 / 0.30);
  if (key === 'net_liquidity') return 0.043 * (0.25 / 0.30);
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

export function buildScientificFingerprint() {
  return orderedObject(Object.keys(SCIENTIFIC_FINGERPRINT), { ...SCIENTIFIC_FINGERPRINT });
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

export function missingFactorPlaceholder(key) {
  if (!REQUIRED_FACTOR_KEYS.includes(key)) {
    throw new Error(`STOP: unknown required factor ${key}`);
  }
  return orderedObject(FACTOR_SNAPSHOT_KEY_ORDER, {
    key,
    score: null,
    status: null,
    last_updated_utc: null,
    official_weight: OFFICIAL_WEIGHTS[key],
  });
}

export function isMissingFactorPlaceholder(factor, key) {
  return Boolean(
    factor &&
      factor.key === key &&
      factor.score === null &&
      factor.status === null &&
      factor.last_updated_utc === null &&
      factor.official_weight === OFFICIAL_WEIGHTS[key]
  );
}

export function evaluateCommonEligibility(factorsByKey) {
  const reasons = [];
  const snapshots = [];
  for (const key of REQUIRED_FACTOR_KEYS) {
    const factor = factorsByKey.get(key);
    if (!factor) {
      reasons.push(`MISSING_FACTOR:${key}`);
      snapshots.push(missingFactorPlaceholder(key));
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
    lastUpdated = factorTimestamp(factor);
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
  if (!eligible) return 'NOT_COMPUTED';
  if (publishedScore === formulaScore) return 'MATCH';
  return 'INTEGRITY_MISMATCH';
}

export function classifyAxisAStatus({ eligibilityStatus, integrityStatus }) {
  if (eligibilityStatus !== 'ELIGIBLE') return 'NOT_ELIGIBLE';
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
  const etl = parseStrictUtcTimestamp(etlStartedUtc, 'H8_V2_ETL_STARTED_UTC');
  const asOf = parseStrictUtcTimestamp(asOfUtc, 'latest.as_of_utc');
  const capture = parseStrictUtcTimestamp(captureRunUtc, 'capture_run_utc');
  const etlMs = Date.parse(etl);
  const asOfMs = Date.parse(asOf);
  const captureMs = Date.parse(capture);
  if (!(etlMs <= asOfMs && asOfMs <= captureMs)) {
    throw new Error('STOP: latest.as_of_utc is not between ETL start and capture time');
  }
}

export function deriveStudyWindows(startDateUtc) {
  const s = parseStrictUtcCalendarDate(startDateUtc, 'start_date_utc');
  return {
    start_date_utc: s,
    observation_end_date_utc: addUtcDays(s, OBSERVATION_WINDOW_DAYS),
    required_close_end_date_utc: addUtcDays(s, CLOSE_UNIVERSE_DAYS),
    recovery_end_date_utc: addUtcDays(s, CLOSE_RECOVERY_DAYS),
  };
}

export function authorizationDeadlineUtc(startDateUtc) {
  const s = parseStrictUtcCalendarDate(startDateUtc, 'start_date_utc');
  const sMinus1 = addUtcDays(s, -1);
  const year = Number(sMinus1.slice(0, 4));
  const month = Number(sMinus1.slice(5, 7));
  const day = Number(sMinus1.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, 11, 0, 0, 0)).toISOString();
}

export function isAuthorizationDeadlineInFuture(startDateUtc, captureRunUtc) {
  const deadlineMs = Date.parse(authorizationDeadlineUtc(startDateUtc));
  const nowMs = Date.parse(parseStrictUtcTimestamp(captureRunUtc, 'capture_run_utc'));
  return nowMs < deadlineMs;
}

export function isObservationInWindow(observationDate, startDateUtc) {
  const date = parseStrictUtcCalendarDate(observationDate, 'observation_date');
  const windows = deriveStudyWindows(startDateUtc);
  return (
    compareUtcDates(date, windows.start_date_utc) >= 0 &&
    compareUtcDates(date, windows.observation_end_date_utc) <= 0
  );
}

export function elevenUtcMs(dateUtc) {
  const d = parseStrictUtcCalendarDate(dateUtc);
  return Date.UTC(
    Number(d.slice(0, 4)),
    Number(d.slice(5, 7)) - 1,
    Number(d.slice(8, 10)),
    11,
    0,
    0,
    0
  );
}

export function normalizeGitCommitterUtc(ci) {
  if (typeof ci !== 'string' || ci.length < 20) {
    throw new Error('STOP: git committer %cI is not a valid timestamp');
  }
  if (ci.includes('\r') || ci.includes('\n') || ci.includes(' ')) {
    throw new Error('STOP: git committer %cI must be a single ISO-8601 token');
  }
  const ms = Date.parse(ci);
  if (!Number.isFinite(ms)) throw new Error('STOP: git committer %cI is not a valid timestamp');
  const dt = new Date(ms);
  const hasFractional = /\.\d+/.test(ci);
  if (!hasFractional && dt.getUTCMilliseconds() === 0) {
    return dt.toISOString().replace('.000Z', 'Z');
  }
  return dt.toISOString();
}

export function deriveCandidateS(rUtc) {
  const normalized = /\dT\d/.test(String(rUtc)) && String(rUtc).includes('Z')
    ? String(rUtc)
    : normalizeGitCommitterUtc(rUtc);
  const rMs = Date.parse(normalized);
  if (!Number.isFinite(rMs)) throw new Error('STOP: R is not a valid timestamp');
  const thresholdMs = rMs + REHEARSAL_LEAD_HOURS * 60 * 60 * 1000;
  let d = utcCalendarDateFromTimestamp(new Date(rMs).toISOString(), 'R');
  for (let i = 0; i < 16; i += 1) {
    if (elevenUtcMs(d) >= thresholdMs) return d;
    d = addUtcDays(d, 1);
  }
  throw new Error('STOP: failed to derive S from R');
}

export function assertFrozenSDerivationExamples() {
  for (const example of SYNTHETIC_S_DERIVATION_EXAMPLES) {
    const got = deriveCandidateS(example.r);
    if (got !== example.s) {
      throw new Error(`STOP: synthetic S derivation failed for R=${example.r}: got ${got}`);
    }
  }
}

export function floorEpochSeconds(utc) {
  const ms = Date.parse(utc);
  if (!Number.isFinite(ms)) throw new Error('STOP: timestamp is not valid for epoch-second floor');
  return Math.floor(ms / 1000);
}

export function assertCommitterTimestampIntegrity({
  committerUtc,
  artifactCreatedUtc,
  etlStartedUtc,
  verificationUtc,
}) {
  const normalizedR = normalizeGitCommitterUtc(committerUtc);
  const committerEpochSeconds = floorEpochSeconds(normalizedR.endsWith('Z') && !normalizedR.includes('.')
    ? normalizedR.replace('Z', '.000Z')
    : normalizedR);
  const artifactFloor = floorEpochSeconds(parseStrictUtcTimestamp(artifactCreatedUtc, 'artifact_created_utc'));
  const etlFloor = floorEpochSeconds(parseStrictUtcTimestamp(etlStartedUtc, 'H8_V2_ETL_STARTED_UTC'));
  const verifyFloor = floorEpochSeconds(
    parseStrictUtcTimestamp(verificationUtc, 'immediate_post_commit_verification_utc')
  );
  if (committerEpochSeconds < artifactFloor) {
    throw new Error('STOP: committer timestamp is earlier than artifact_created_utc');
  }
  if (committerEpochSeconds < etlFloor) {
    throw new Error('STOP: committer timestamp is earlier than H8_V2_ETL_STARTED_UTC');
  }
  if (committerEpochSeconds > verifyFloor + COMMITTER_FUTURE_BOUND_SECONDS) {
    throw new Error('STOP: committer timestamp exceeds runner-clock future bound');
  }
  return { committerUtc: normalizedR, committerEpochSeconds };
}

export function githubMergedAtDeltaMs(mergedAt, committerUtc) {
  const mergedMs = Date.parse(parseStrictUtcTimestamp(mergedAt, 'merged_at'));
  const committerMs = Date.parse(normalizeGitCommitterUtc(committerUtc));
  return Math.abs(mergedMs - committerMs);
}

export function githubMergedAtWithinFiveMinutes(mergedAt, committerUtc) {
  return githubMergedAtDeltaMs(mergedAt, committerUtc) <= GITHUB_MERGED_AT_TOLERANCE_MS;
}

export function classifyPreStartAction({
  activated,
  startExists,
  liveCandidate,
  disqualificationPresent,
  readinessExpired,
}) {
  if (!activated) return PRE_START_ACTIONS.INACTIVE;
  if (startExists) return PRE_START_ACTIONS.STUDY;
  if (liveCandidate) return PRE_START_ACTIONS.HOLD_LIVE_CANDIDATE;
  if (readinessExpired || disqualificationPresent || !liveCandidate) {
    return PRE_START_ACTIONS.REHEARSAL;
  }
  return PRE_START_ACTIONS.REHEARSAL;
}

export function researchCommitSubjectForLandable(landableEntries) {
  const paths = (landableEntries || []).map((entry) => entry.path || entry);
  const hasRehearsal = paths.some((p) => REHEARSAL_PATH_RE.test(p));
  const hasStudy = paths.some((p) => OBSERVATION_PATH_RE.test(p) || CLOSE_PATH_RE.test(p));
  if (hasRehearsal && hasStudy) {
    throw new Error('STOP: landable set must not mix rehearsal and study artifacts');
  }
  if (hasRehearsal) return RESEARCH_COMMIT_SUBJECT_REHEARSAL;
  return RESEARCH_COMMIT_SUBJECT_CAPTURE;
}

export function assertScientificCommitDateEnvUnset(env = process.env) {
  if (Object.prototype.hasOwnProperty.call(env, 'GIT_COMMITTER_DATE')) {
    throw new Error('STOP: GIT_COMMITTER_DATE must be unset during the scientific research-commit phase');
  }
  if (Object.prototype.hasOwnProperty.call(env, 'GIT_AUTHOR_DATE')) {
    throw new Error('STOP: GIT_AUTHOR_DATE must be unset during the scientific research-commit phase');
  }
}

export function assertForbiddenGitArgs(args) {
  if (!Array.isArray(args)) throw new Error('STOP: git args must be an array');
  if (args[0] === 'commit-tree' || args.includes('commit-tree')) {
    throw new Error('STOP: git commit-tree is forbidden');
  }
  if (args[0] === 'filter-branch' || args.includes('filter-branch')) {
    throw new Error('STOP: git filter-branch is forbidden');
  }
  if (args[0] === 'filter-repo' || args.includes('filter-repo')) {
    throw new Error('STOP: git filter-repo is forbidden');
  }
  if (args.includes('--committer-date-is-author-date')) {
    throw new Error('STOP: --committer-date-is-author-date is forbidden');
  }
  if (args.some((arg) => arg === '--date' || (typeof arg === 'string' && arg.startsWith('--date=')))) {
    throw new Error('STOP: git --date is forbidden');
  }
  if (args[0] === 'push' && (args.includes('--force') || args.includes('-f') || args.includes('--force-with-lease'))) {
    throw new Error('STOP: force push is forbidden');
  }
  if (args[0] === 'add' && args.some((a) => a === 'research' || a === 'research/h8-v2-prospective')) {
    throw new Error('STOP: git add research is forbidden');
  }
}

function wrapObservationInput(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ObservationInputError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ObservationInputError(message.startsWith('STOP:') ? message : `STOP: ${message}`);
  }
}

function wrapCloseInput(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CloseInputError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CloseInputError(message.startsWith('STOP:') ? message : `STOP: ${message}`);
  }
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
  return orderedObject(OBSERVATION_KEY_ORDER, {
    schema_version: OBSERVATION_SCHEMA_VERSION,
    study_id: STUDY_ID,
    protocol_version: H8_V2_PROTOCOL_VERSION,
    protocol_sha: H8_V2_PROTOCOL_SHA,
    capture_contract_version: H8_V2_CAPTURE_CONTRACT_VERSION,
    capture_contract_sha: H8_V2_CAPTURE_CONTRACT_SHA,
    h8_v2_capture_source_sha: parseStrictLowerSha(captureSourceSha, 'h8_v2_capture_source_sha'),
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
    scientific_fingerprint: buildScientificFingerprint(),
    common_eligibility_status: eligibility.common_eligibility_status,
    eligibility_reason: eligibility.eligibility_reason,
    official_integrity_status: eligibility.official_integrity_status,
    axis_a_status: eligibility.axis_a_status,
    factors: eligibility.factors,
    official_published_score: officialPublishedScore,
    official_formula_score: officialFormulaScore,
    liq_heavy_score: liqHeavyScore,
    mom_tilted_score: momTiltedScore,
    model_versions: orderedObject(['official', 'liq_heavy', 'mom_tilted'], MODEL_VERSIONS),
    model_weight_definitions: buildModelWeightDefinitions(),
  });
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
    schema_version: CLOSE_SCHEMA_VERSION,
    study_id: STUDY_ID,
    protocol_version: H8_V2_PROTOCOL_VERSION,
    protocol_sha: H8_V2_PROTOCOL_SHA,
    capture_contract_version: H8_V2_CAPTURE_CONTRACT_VERSION,
    capture_contract_sha: H8_V2_CAPTURE_CONTRACT_SHA,
    h8_v2_capture_source_sha: parseStrictLowerSha(captureSourceSha, 'h8_v2_capture_source_sha'),
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

export function buildRehearsalObject({
  captureSourceSha,
  provenance,
  artifactCreatedUtc,
  etlStartedUtc,
}) {
  if (provenance.githubSha !== provenance.sourceBaseGitSha && provenance.sourceCheckoutSha == null) {
    throw new Error('STOP: rehearsal source_checkout_sha must equal original github.sha');
  }
  const sourceCheckoutSha = parseStrictLowerSha(
    provenance.sourceCheckoutSha || provenance.sourceBaseGitSha || provenance.githubSha,
    'source_checkout_sha'
  );
  const githubSha = parseStrictLowerSha(provenance.githubSha, 'github_sha');
  if (sourceCheckoutSha !== githubSha) {
    throw new Error('STOP: rehearsal source_checkout_sha must equal github_sha');
  }
  return orderedObject(REHEARSAL_KEY_ORDER, {
    schema_version: REHEARSAL_SCHEMA_VERSION,
    study_id: STUDY_ID,
    artifact_type: 'NON_STUDY_REHEARSAL',
    study_status: 'NON_STUDY',
    observation_status: 'NOT_AN_OBSERVATION',
    btc_close_status: 'NOT_A_BTC_CLOSE',
    performance_status: 'NOT_FOR_PERFORMANCE',
    protocol_version: H8_V2_PROTOCOL_VERSION,
    protocol_sha: H8_V2_PROTOCOL_SHA,
    capture_contract_version: H8_V2_CAPTURE_CONTRACT_VERSION,
    capture_contract_sha: H8_V2_CAPTURE_CONTRACT_SHA,
    capture_source_sha: parseStrictLowerSha(captureSourceSha, 'capture_source_sha'),
    scientific_fingerprint: buildScientificFingerprint(),
    github_run_id: provenance.githubRunId,
    github_run_attempt: provenance.githubRunAttempt,
    github_event_name: provenance.githubEventName,
    github_workflow_ref: provenance.githubWorkflowRef,
    source_checkout_sha: sourceCheckoutSha,
    artifact_created_utc: parseStrictUtcTimestamp(artifactCreatedUtc, 'artifact_created_utc'),
    etl_started_utc: parseStrictUtcTimestamp(etlStartedUtc, 'etl_started_utc'),
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

export function selectCatchUpCloseDates({ captureRunUtc, existingCloseDates, startDateUtc }) {
  const windows = deriveStudyWindows(startDateUtc);
  const t = utcCalendarDateFromTimestamp(captureRunUtc, 'capture_run_utc');
  if (compareUtcDates(t, windows.recovery_end_date_utc) > 0) return [];
  const lastEligible = addUtcDays(t, -1);
  const existing = new Set(existingCloseDates || []);
  const out = [];
  for (const date of enumerateUtcDates(windows.start_date_utc, windows.required_close_end_date_utc)) {
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

export function validateCreatedManifest(obj) {
  const keys = Object.keys(obj);
  if (keys.length !== MANIFEST_KEY_ORDER.length) {
    throw new Error('STOP: created manifest key count mismatch');
  }
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== MANIFEST_KEY_ORDER[i]) {
      throw new Error(`STOP: created manifest key order mismatch at ${MANIFEST_KEY_ORDER[i]}`);
    }
  }
  if (obj.manifest_version !== MANIFEST_VERSION) {
    throw new Error('STOP: manifest_version mismatch');
  }
  parseStrictUtcTimestamp(obj.capture_run_utc, 'capture_run_utc');
  if (!Array.isArray(obj.files)) throw new Error('STOP: manifest files must be an array');
  let previousPath = null;
  const seen = new Set();
  for (const entry of obj.files) {
    const entryKeys = Object.keys(entry);
    if (entryKeys.length !== MANIFEST_FILE_KEY_ORDER.length) {
      throw new Error('STOP: manifest file entry key count mismatch');
    }
    for (let i = 0; i < entryKeys.length; i += 1) {
      if (entryKeys[i] !== MANIFEST_FILE_KEY_ORDER[i]) {
        throw new Error(`STOP: manifest file entry key order mismatch at ${MANIFEST_FILE_KEY_ORDER[i]}`);
      }
    }
    const allowed = assertAllowedManifestPath(entry.path);
    parseStrictSha256(entry.sha256, 'manifest file sha256');
    if (seen.has(allowed)) throw new Error(`STOP: duplicate manifest path ${allowed}`);
    if (previousPath !== null && allowed <= previousPath) {
      throw new Error('STOP: manifest files are not in deterministic lexicographic path order');
    }
    seen.add(allowed);
    previousPath = allowed;
  }
  return obj;
}

export function deriveEligibilityFromStoredFactors(factors) {
  const reasons = [];
  for (let index = 0; index < REQUIRED_FACTOR_KEYS.length; index += 1) {
    const key = REQUIRED_FACTOR_KEYS[index];
    const factor = Array.isArray(factors) ? factors[index] : null;
    if (!factor || factor.key !== key) {
      reasons.push(`MISSING_FACTOR:${key}`);
      continue;
    }
    if (factor.official_weight !== OFFICIAL_WEIGHTS[key]) {
      throw new Error(`STOP: factor official_weight mismatch for ${key}`);
    }
    if (isMissingFactorPlaceholder(factor, key)) {
      reasons.push(`MISSING_FACTOR:${key}`);
      continue;
    }
    const scoreOk =
      typeof factor.score === 'number' &&
      Number.isFinite(factor.score) &&
      factor.score >= 0 &&
      factor.score <= 100;
    if (!scoreOk) reasons.push(`INVALID_SCORE:${key}`);
    if (factor.status !== 'fresh') reasons.push(`STATUS_NOT_FRESH:${key}`);
    let lastUpdated = null;
    if (factor.last_updated_utc != null) {
      lastUpdated = parseStrictUtcTimestamp(factor.last_updated_utc, `${key}.last_updated_utc`);
    }
    if (factor.status === 'fresh' && lastUpdated == null) {
      reasons.push(`MISSING_TIMESTAMP:${key}`);
    }
  }
  if (reasons.length === 0) {
    return {
      common_eligibility_status: 'ELIGIBLE',
      eligibility_reason: 'ALL_REQUIRED_FACTORS_FRESH',
    };
  }
  return {
    common_eligibility_status: 'NOT_ELIGIBLE',
    eligibility_reason: reasons.join('|'),
  };
}

function assertExactKeyOrder(obj, expected, label) {
  const keys = Object.keys(obj);
  if (keys.length !== expected.length) throw new Error(`STOP: ${label} key count mismatch`);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== expected[i]) throw new Error(`STOP: ${label} key order mismatch at ${expected[i]}`);
  }
}

export function validateObservationSchema(obj) {
  assertExactKeyOrder(obj, OBSERVATION_KEY_ORDER, 'observation');
  if (obj.schema_version !== OBSERVATION_SCHEMA_VERSION) {
    throw new Error('STOP: observation schema_version mismatch');
  }
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: observation study_id mismatch');
  if (obj.protocol_version !== H8_V2_PROTOCOL_VERSION) {
    throw new Error('STOP: observation protocol_version mismatch');
  }
  if (obj.protocol_sha !== H8_V2_PROTOCOL_SHA) throw new Error('STOP: observation protocol_sha mismatch');
  if (obj.capture_contract_version !== H8_V2_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: observation capture_contract_version mismatch');
  }
  if (obj.capture_contract_sha !== H8_V2_CAPTURE_CONTRACT_SHA) {
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
  if ('analysis_status' in obj) {
    throw new Error('STOP: observation must use axis_a_status, not analysis_status');
  }
}

export function validateCloseSchema(obj) {
  assertExactKeyOrder(obj, CLOSE_KEY_ORDER, 'close');
  if (obj.schema_version !== CLOSE_SCHEMA_VERSION) throw new Error('STOP: close schema_version mismatch');
  if (obj.protocol_sha !== H8_V2_PROTOCOL_SHA) throw new Error('STOP: close protocol_sha mismatch');
  if (obj.capture_contract_sha !== H8_V2_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: close capture_contract_sha mismatch');
  }
  if (obj.source_artifact_path !== BTC_SOURCE_PATH) {
    throw new Error('STOP: close source_artifact_path mismatch');
  }
  if ('mace' in obj || 'score' in obj || 'return' in obj) {
    throw new Error('STOP: close artifact contains performance fields');
  }
}

function walkForbiddenRehearsalKeys(value, label) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbiddenRehearsalKeys(item, `${label}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (REHEARSAL_FORBIDDEN_FIELD_RE.test(key)) {
      throw new Error(`STOP: rehearsal artifact contains forbidden field ${label}.${key}`);
    }
    walkForbiddenRehearsalKeys(child, `${label}.${key}`);
  }
}

export function validateRehearsalSchema(obj) {
  assertExactKeyOrder(obj, REHEARSAL_KEY_ORDER, 'rehearsal');
  if (obj.schema_version !== REHEARSAL_SCHEMA_VERSION) {
    throw new Error('STOP: rehearsal schema_version mismatch');
  }
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: rehearsal study_id mismatch');
  if (obj.artifact_type !== 'NON_STUDY_REHEARSAL') throw new Error('STOP: rehearsal artifact_type mismatch');
  if (obj.study_status !== 'NON_STUDY') throw new Error('STOP: rehearsal study_status mismatch');
  if (obj.observation_status !== 'NOT_AN_OBSERVATION') {
    throw new Error('STOP: rehearsal observation_status mismatch');
  }
  if (obj.btc_close_status !== 'NOT_A_BTC_CLOSE') throw new Error('STOP: rehearsal btc_close_status mismatch');
  if (obj.performance_status !== 'NOT_FOR_PERFORMANCE') {
    throw new Error('STOP: rehearsal performance_status mismatch');
  }
  walkForbiddenRehearsalKeys(obj, 'rehearsal');
  if ('R' in obj || 'rehearsal_commit_sha' in obj || 'commit_sha' in obj) {
    throw new Error('STOP: rehearsal must not self-certify commit SHA or R');
  }
}

export function validateStartSchema(obj) {
  assertExactKeyOrder(obj, START_KEY_ORDER, 'start');
  if (obj.schema_version !== START_SCHEMA_VERSION) throw new Error('STOP: start schema_version mismatch');
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: start study_id mismatch');
  if (obj.protocol_version !== H8_V2_PROTOCOL_VERSION) {
    throw new Error('STOP: start protocol_version mismatch');
  }
  if (obj.protocol_sha !== H8_V2_PROTOCOL_SHA) throw new Error('STOP: start protocol_sha mismatch');
  if (obj.capture_contract_version !== H8_V2_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: start capture_contract_version mismatch');
  }
  if (obj.start_selection_rule !== START_SELECTION_RULE) {
    throw new Error('STOP: start_selection_rule must be preserved exactly');
  }
}

export function validateDisqualificationSchema(obj) {
  assertExactKeyOrder(obj, DISQUALIFICATION_KEY_ORDER, 'disqualification');
  if (obj.schema_version !== DISQUALIFICATION_SCHEMA_VERSION) {
    throw new Error('STOP: disqualification schema_version mismatch');
  }
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: disqualification study_id mismatch');
  if (obj.artifact_type !== 'REHEARSAL_DISQUALIFICATION') {
    throw new Error('STOP: disqualification artifact_type mismatch');
  }
  if (!DISQUALIFICATION_REASON_CODES.includes(obj.disqualification_reason_code)) {
    throw new Error('STOP: disqualification_reason_code is not allowed');
  }
  walkForbiddenRehearsalKeys(obj, 'disqualification');
}

function assertScheduleAttemptProvenance(obj, label) {
  if (typeof obj.github_run_id !== 'string') throw new Error(`STOP: ${label} github_run_id must be a string`);
  parseGitHubRunId(obj.github_run_id);
  if (obj.github_run_attempt !== 1) throw new Error(`STOP: ${label} github_run_attempt must be 1`);
  if (obj.github_event_name !== 'schedule') throw new Error(`STOP: ${label} github_event_name must be schedule`);
  if (typeof obj.github_workflow_ref !== 'string' || obj.github_workflow_ref === '') {
    throw new Error(`STOP: ${label} github_workflow_ref must be a non-empty string`);
  }
}

function assertGithubProvenance(obj, label) {
  assertScheduleAttemptProvenance(obj, label);
  parseStrictLowerSha(obj.github_sha, `${label}.github_sha`);
  parseStrictLowerSha(obj.source_base_git_sha, `${label}.source_base_git_sha`);
  if (obj.source_base_git_sha !== obj.github_sha) {
    throw new Error(`STOP: ${label} source_base_git_sha must equal github_sha`);
  }
}

function assertRehearsalProvenance(obj) {
  assertScheduleAttemptProvenance(obj, 'rehearsal');
  parseStrictLowerSha(obj.source_checkout_sha, 'rehearsal.source_checkout_sha');
}

export function validateCompleteObservation(obj, { expectedDate, captureSourceSha }) {
  validateObservationSchema(obj);
  if (obj.h8_v2_capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: observation h8_v2_capture_source_sha mismatch');
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
  if (canonicalizeJson(obj.scientific_fingerprint) !== canonicalizeJson(buildScientificFingerprint())) {
    throw new Error('STOP: observation scientific_fingerprint mismatch');
  }
  const asOfDate = utcCalendarDateFromTimestamp(obj.observation_as_of_utc, 'observation_as_of_utc');
  if (obj.observation_date !== asOfDate) {
    throw new Error('STOP: observation_date does not match observation_as_of_utc UTC date');
  }
  const derivedEligibility = deriveEligibilityFromStoredFactors(obj.factors);
  if (obj.common_eligibility_status !== derivedEligibility.common_eligibility_status) {
    throw new Error('STOP: stored common_eligibility_status does not match derived eligibility');
  }
  if (obj.eligibility_reason !== derivedEligibility.eligibility_reason) {
    throw new Error('STOP: stored eligibility_reason does not match derived factor deficiencies');
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
  if (derivedEligibility.common_eligibility_status === 'NOT_ELIGIBLE') {
    if (obj.official_formula_score !== null || obj.liq_heavy_score !== null || obj.mom_tilted_score !== null) {
      throw new Error('STOP: NOT_ELIGIBLE observation must null formula/challenger scores');
    }
    if (obj.official_integrity_status !== 'NOT_COMPUTED') {
      throw new Error('STOP: NOT_ELIGIBLE official_integrity_status must be NOT_COMPUTED');
    }
    if (obj.axis_a_status !== 'NOT_ELIGIBLE') {
      throw new Error('STOP: NOT_ELIGIBLE axis_a_status mismatch');
    }
    if (obj.official_published_score != null) {
      if (
        typeof obj.official_published_score !== 'number' ||
        !Number.isFinite(obj.official_published_score) ||
        obj.official_published_score < 0 ||
        obj.official_published_score > 100
      ) {
        throw new Error('STOP: official_published_score out of bounds');
      }
    }
    return;
  }
  const scoresByKey = {};
  for (const factor of obj.factors) {
    scoresByKey[factor.key] = factor.score;
  }
  const recomputedOfficial = computeOfficialScore(scoresByKey);
  if (obj.official_formula_score !== recomputedOfficial) {
    throw new Error('STOP: stored official_formula_score does not equal recomputed Official score');
  }
  if (
    typeof obj.official_published_score !== 'number' ||
    !Number.isFinite(obj.official_published_score) ||
    obj.official_published_score < 0 ||
    obj.official_published_score > 100
  ) {
    throw new Error('STOP: official_published_score out of bounds');
  }
  const expectedIntegrity = classifyOfficialIntegrity({
    eligible: true,
    publishedScore: obj.official_published_score,
    formulaScore: recomputedOfficial,
  });
  if (obj.official_integrity_status !== expectedIntegrity) {
    throw new Error('STOP: official_integrity_status does not match recomputed Official integrity');
  }
  const expectedAxisA = classifyAxisAStatus({
    eligibilityStatus: 'ELIGIBLE',
    integrityStatus: expectedIntegrity,
  });
  if (obj.axis_a_status !== expectedAxisA) {
    throw new Error('STOP: axis_a_status inconsistent with eligibility/integrity');
  }
  if (expectedIntegrity === 'INTEGRITY_MISMATCH') {
    if (obj.liq_heavy_score !== null || obj.mom_tilted_score !== null) {
      throw new Error('STOP: INTEGRITY_MISMATCH must null challenger scores');
    }
    return;
  }
  const recomputedLiqHeavy = computeLiqHeavyScore(scoresByKey);
  const recomputedMomTilted = computeMomTiltedScore(scoresByKey);
  if (obj.liq_heavy_score !== recomputedLiqHeavy) {
    throw new Error('STOP: stored liq_heavy_score does not equal recomputed Liq-Heavy score');
  }
  if (obj.mom_tilted_score !== recomputedMomTilted) {
    throw new Error('STOP: stored mom_tilted_score does not equal recomputed Mom-Tilted score');
  }
}

export function validateCompleteClose(obj, { expectedDate, captureSourceSha, startDateUtc = null }) {
  validateCloseSchema(obj);
  if (obj.study_id !== STUDY_ID) throw new Error('STOP: close study_id mismatch');
  if (obj.protocol_version !== H8_V2_PROTOCOL_VERSION) throw new Error('STOP: close protocol_version mismatch');
  if (obj.h8_v2_capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: close h8_v2_capture_source_sha mismatch');
  }
  if (obj.capture_contract_version !== H8_V2_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: close capture_contract_version mismatch');
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
  if (startDateUtc) {
    const windows = deriveStudyWindows(startDateUtc);
    if (compareUtcDates(obj.close_date_utc, windows.start_date_utc) < 0) {
      throw new Error('STOP: close_date_utc is before study close universe start');
    }
    if (compareUtcDates(obj.close_date_utc, windows.required_close_end_date_utc) > 0) {
      throw new Error('STOP: close_date_utc is after study close universe end');
    }
    const capturedDate = utcCalendarDateFromTimestamp(obj.captured_at_utc, 'captured_at_utc');
    if (compareUtcDates(capturedDate, windows.recovery_end_date_utc) > 0) {
      throw new Error('STOP: captured_at_utc is after close recovery cutoff');
    }
  }
  if (!isCompletedUtcCandle(obj.close_date_utc, obj.captured_at_utc)) {
    throw new Error('STOP: close_date_utc was not a completed UTC candle at capture');
  }
  parseStrictSha256(obj.source_artifact_sha256, 'source_artifact_sha256');
  assertGithubProvenance(obj, 'close');
}

export function validateCompleteRehearsal(obj, { captureSourceSha, expectedRunId = null }) {
  validateRehearsalSchema(obj);
  if (obj.protocol_version !== H8_V2_PROTOCOL_VERSION) {
    throw new Error('STOP: rehearsal protocol_version mismatch');
  }
  if (obj.protocol_sha !== H8_V2_PROTOCOL_SHA) throw new Error('STOP: rehearsal protocol_sha mismatch');
  if (obj.capture_contract_version !== H8_V2_CAPTURE_CONTRACT_VERSION) {
    throw new Error('STOP: rehearsal capture_contract_version mismatch');
  }
  if (obj.capture_contract_sha !== H8_V2_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: rehearsal capture_contract_sha mismatch');
  }
  if (obj.capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: rehearsal capture_source_sha mismatch');
  }
  if (canonicalizeJson(obj.scientific_fingerprint) !== canonicalizeJson(buildScientificFingerprint())) {
    throw new Error('STOP: rehearsal scientific_fingerprint mismatch');
  }
  assertRehearsalProvenance(obj);
  parseStrictUtcTimestamp(obj.artifact_created_utc, 'artifact_created_utc');
  parseStrictUtcTimestamp(obj.etl_started_utc, 'etl_started_utc');
  if (expectedRunId != null && obj.github_run_id !== String(expectedRunId)) {
    throw new Error('STOP: rehearsal github_run_id mismatch');
  }
}

export function validateCompleteStart(obj, { captureSourceSha, expectedR = null }) {
  validateStartSchema(obj);
  if (obj.capture_contract_sha !== H8_V2_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: start capture_contract_sha mismatch');
  }
  if (obj.capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
    throw new Error('STOP: start capture_source_sha mismatch');
  }
  if (canonicalizeJson(obj.scientific_fingerprint) !== canonicalizeJson(buildScientificFingerprint())) {
    throw new Error('STOP: start scientific_fingerprint mismatch');
  }
  if (!REHEARSAL_PATH_RE.test(obj.qualifying_rehearsal_path)) {
    throw new Error('STOP: qualifying_rehearsal_path is not a rehearsal artifact path');
  }
  parseStrictLowerSha(obj.qualifying_rehearsal_commit_sha, 'qualifying_rehearsal_commit_sha');
  parseGitHubRunId(obj.qualifying_rehearsal_run_id);
  const r = normalizeGitCommitterUtc(obj.qualifying_rehearsal_commit_committer_utc);
  if (expectedR != null && r !== normalizeGitCommitterUtc(expectedR) && r !== expectedR) {
    const expectedNormalized = normalizeGitCommitterUtc(expectedR);
    if (r !== expectedNormalized) {
      throw new Error('STOP: qualifying_rehearsal_commit_committer_utc must equal R');
    }
  }
  const derivedS = deriveCandidateS(r);
  if (obj.start_date_utc !== derivedS) {
    throw new Error('STOP: start_date_utc does not match frozen S derivation from R');
  }
  const windows = deriveStudyWindows(derivedS);
  if (obj.observation_end_date_utc !== windows.observation_end_date_utc) {
    throw new Error('STOP: observation_end_date_utc mismatch');
  }
  if (obj.required_close_end_date_utc !== windows.required_close_end_date_utc) {
    throw new Error('STOP: required_close_end_date_utc mismatch');
  }
  if (obj.recovery_end_date_utc !== windows.recovery_end_date_utc) {
    throw new Error('STOP: recovery_end_date_utc mismatch');
  }
  parseStrictUtcTimestamp(obj.authorization_created_utc, 'authorization_created_utc');
}

export function validateCompleteDisqualification(obj, { captureSourceSha = null } = {}) {
  validateDisqualificationSchema(obj);
  if (obj.protocol_sha !== H8_V2_PROTOCOL_SHA) {
    throw new Error('STOP: disqualification protocol_sha mismatch');
  }
  if (obj.capture_contract_sha !== H8_V2_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: disqualification capture_contract_sha mismatch');
  }
  if (captureSourceSha) {
    if (obj.capture_source_sha !== parseStrictLowerSha(captureSourceSha, 'captureSourceSha')) {
      throw new Error('STOP: disqualification capture_source_sha mismatch');
    }
  } else {
    parseStrictLowerSha(obj.capture_source_sha, 'capture_source_sha');
  }
  if (!REHEARSAL_PATH_RE.test(obj.qualifying_rehearsal_path)) {
    throw new Error('STOP: disqualification qualifying_rehearsal_path mismatch');
  }
  parseStrictLowerSha(obj.qualifying_rehearsal_commit_sha, 'qualifying_rehearsal_commit_sha');
  parseGitHubRunId(obj.qualifying_rehearsal_run_id);
  parseStrictUtcTimestamp(obj.disqualification_created_utc, 'disqualification_created_utc');
}

export function sha256HexFromNodeCrypto(crypto, buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function parseGitHubRunId(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new Error('STOP: H8_V2_GITHUB_RUN_ID must be numeric');
  }
  return value;
}

export function parseGitHubRunAttempt(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new Error('STOP: H8_V2_GITHUB_RUN_ATTEMPT is missing or non-numeric');
  }
  if (value !== '1') throw new Error('STOP: H8_V2_GITHUB_RUN_ATTEMPT must be 1');
  return 1;
}

export function assertCaptureEventGate(env) {
  if (!env || env.GITHUB_ACTIONS !== 'true') {
    throw new Error('STOP: real capture requires GITHUB_ACTIONS=true');
  }
  if (env.H8_V2_GITHUB_EVENT_NAME !== 'schedule') {
    throw new Error('STOP: real capture requires scheduled event');
  }
  parseGitHubRunAttempt(env.H8_V2_GITHUB_RUN_ATTEMPT);
  parseGitHubRunId(env.H8_V2_GITHUB_RUN_ID);
  parseStrictLowerSha(env.H8_V2_GITHUB_SHA, 'H8_V2_GITHUB_SHA');
  if (typeof env.H8_V2_GITHUB_WORKFLOW_REF !== 'string' || env.H8_V2_GITHUB_WORKFLOW_REF === '') {
    throw new Error('STOP: H8_V2_GITHUB_WORKFLOW_REF is required');
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
    findings.push('H8 v2 event gate missing');
  }
  if (/git add research(?:\/h8-v2-prospective)?(?:\s|$)/.test(yamlText)) {
    findings.push('broad research staging present');
  }
  if (!yamlText.includes(RESEARCH_COMMIT_SUBJECT_CAPTURE)) {
    findings.push('H8 v2 capture commit subject missing');
  }
  const h8CommitIdx = yamlText.indexOf('name: H8 v2 scientific commit');
  if (h8CommitIdx === -1) findings.push('H8 v2 scientific commit step missing');
  else {
    const h8Block = yamlText.slice(h8CommitIdx);
    const nextStep = h8Block.search(/\n      - name:/);
    const scientificBlock = nextStep === -1 ? h8Block : h8Block.slice(0, nextStep);
    if (/git pull origin main(?! --rebase)/.test(scientificBlock) || /trying merge instead/.test(scientificBlock)) {
      findings.push('H8 v2 scientific rebase has merge fallback');
    }
  }
  if (/>>.*H8_V2_CAPTURE_SOURCE_SHA\.txt/.test(yamlText)) {
    findings.push('Stage A must not write activation sidecar');
  }
  const etlIdx = yamlText.indexOf('npm run etl:compute');
  const preflightIdx = yamlText.indexOf('H8 v2 identity preflight');
  const captureIdx = yamlText.indexOf('H8 v2 prospective capture');
  if (preflightIdx === -1 || etlIdx === -1 || preflightIdx > etlIdx) {
    findings.push('H8 v2 preflight is not before ETL');
  } else {
    const preflightSlice = yamlText.slice(preflightIdx);
    const nextPreflightStep = preflightSlice.search(/\n      - name:/);
    const preflightBlock = nextPreflightStep === -1 ? preflightSlice : preflightSlice.slice(0, nextPreflightStep);
    if (!preflightBlock.includes('H8_V2_GITHUB_SHA: ${{ github.sha }}')) {
      findings.push('H8 v2 preflight missing H8_V2_GITHUB_SHA github.sha provenance');
    }
  }
  if (captureIdx === -1 || captureIdx < etlIdx) {
    findings.push('H8 v2 capture is not after ETL');
  }
  if (!yamlText.includes('git add -A public/data public/signals public/extras public/alerts')) {
    findings.push('production staging paths missing');
  }
  if (!yamlText.includes('capture-h8-v2-prospective.mjs')) {
    findings.push('v2 capture script path missing');
  }
  if (!yamlText.includes('h8-v2-prospective-capture-io.mjs')) {
    findings.push('v2 IO script path missing');
  }
  if (!yamlText.includes('runH8V2ScientificPhase')) {
    findings.push('runH8V2ScientificPhase missing');
  }
  for (const envName of [
    'H8_V2_CAPTURE_ALLOWED',
    'H8_V2_CAPTURE_COMPLETED',
    'H8_V2_PRODUCTION_OK',
    'H8_V2_ETL_STARTED_UTC',
    'H8_V2_GITHUB_RUN_ID',
    'H8_V2_GITHUB_RUN_ATTEMPT',
    'H8_V2_GITHUB_EVENT_NAME',
    'H8_V2_GITHUB_SHA',
    'H8_V2_GITHUB_WORKFLOW_REF',
    'H8_V2_CREATED_MANIFEST_PATH',
    'H8_V2_ESCROW_DIR',
  ]) {
    if (!yamlText.includes(envName)) findings.push(`${envName} missing`);
  }
  if (yamlText.includes('node scripts/research/capture-h8-prospective.mjs')) {
    findings.push('historical v1 capture script still invoked');
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
  startDateUtc,
}) {
  return wrapObservationInput(() => {
    assertLatestConfigAgreement(latest, config);
    assertSameRunTemporalProof({
      etlStartedUtc,
      asOfUtc: latest.as_of_utc,
      captureRunUtc,
    });
    const observationDate = observationDateFromLatest(latest);
    if (!isObservationInWindow(observationDate, startDateUtc)) {
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
      incrementCounter('scientificScoresCalculated');
      if (officialPublishedScore === officialFormulaScore) {
        liqHeavyScore = computeLiqHeavyScore(scoresByKey);
        incrementCounter('scientificScoresCalculated');
        momTiltedScore = computeMomTiltedScore(scoresByKey);
        incrementCounter('scientificScoresCalculated');
      }
    }
    const officialIntegrityStatus = classifyOfficialIntegrity({
      eligible,
      publishedScore: officialPublishedScore,
      formulaScore: officialFormulaScore,
    });
    const axisAStatus = classifyAxisAStatus({
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
        axis_a_status: axisAStatus,
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
  });
}

export function proposeCloseArtifacts({
  csvText,
  sourceArtifactSha256,
  captureRunUtc,
  existingCloseDates,
  captureSourceSha,
  provenance,
  startDateUtc,
}) {
  return wrapCloseInput(() => {
    const byDate = parseBtcPriceHistoryCsv(csvText);
    const dates = selectCatchUpCloseDates({ captureRunUtc, existingCloseDates, startDateUtc });
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
  });
}

export function proposeRehearsal({
  captureSourceSha,
  provenance,
  artifactCreatedUtc,
  etlStartedUtc,
}) {
  const rehearsal = buildRehearsalObject({
    captureSourceSha,
    provenance,
    artifactCreatedUtc,
    etlStartedUtc,
  });
  validateRehearsalSchema(rehearsal);
  return {
    path: rehearsalPathForRunId(provenance.githubRunId),
    rehearsal,
  };
}

assertFrozenSDerivationExamples();
