/**
 * H7.1 Stage A — pure reconstruction/scoring logic.
 * No filesystem writes, no network, no env reads, no Date.now().
 * Mathematical behavior is ported from MODEL_SOURCE_SHA, except H7
 * no-renormalization which overrides permissive production blending.
 */

export const H7_PROTOCOL_VERSION = 'h7-exploratory-reconstruction-v1';
export const MODEL_SOURCE_SHA = '6b2fa9cf56ce738c74c8da6de0f5a972858f8a52';
export const H7_BASE_SHA = '6c03730df19adafd8e4e3b1f84361e64a378a6a6';
export const H7_MERGE_SHA = '4ed9a903f12a7e46bf959fcae12be9f8cfac1317';
export const H7_1_STAGE_A_BASE_SHA = '21820f19d4b7941e1f1b149b5b3e2e42463d3a44';

export const XR_START_DATE = '2025-12-11';
export const XR_END_DATE = '2026-08-19';
export const XR_EXPECTED_DATE_COUNT = 252;

export const BRIDGE_DATES = Object.freeze(['2026-08-17', '2026-08-18', '2026-08-19']);
export const TREND_B_ISLAND_DATES = Object.freeze(['2026-08-17', '2026-08-18', '2026-08-19']);

export const FROZEN_H7_BLOBS = Object.freeze({
  'docs/H7_EXPLORATORY_RECONSTRUCTION_PROTOCOL_2026-08-19.md':
    'be3843fda42c1db85c6616cc8351c765d3bc4555',
  'research/exploratory-reconstruction/H7_1_OUTPUT_SCHEMA.md':
    'f55cea118dc00314cde1d62525edcf2275cf5de7',
  'research/exploratory-reconstruction/README.md':
    '56451e66d0f05c7e003d6f320c250c54e6da04d3',
  'research/exploratory-reconstruction/factor_input_contract.csv':
    '49cd64f0820c53e274403b82abf126560eec1a81',
  'research/historical-observations/daily_analytical_view.csv':
    '95d4292580fb13c569efb4b618c3be8226d32948',
});

export const MODEL_CODE_BLOBS = Object.freeze({
  'scripts/etl/factors.mjs': 'e9fd06df79967f0041a901e2dd971b771e669b03',
  'scripts/etl/factors/trendValuation.mjs': '75046b4d47d73144f56c339c0461bdd4b6bf21b1',
  'scripts/etl/priceHistory.mjs': '515b02acdd0cf4a72e62889dafb83cec6e8acd95',
  'scripts/etl/factors/marketRegime.mjs': '48baab10898ddcf9d301d8ce415c69805960a469',
  'scripts/etl/lib/completedPeriods.mjs': 'a22a5a7efce828904a5881332d68098f956590fc',
  'scripts/etl/lib/ssotSubweights.mjs': 'c33e13a92cbc75697e51ea3face379f503a40924',
  'scripts/etl/marketCalendar.mjs': '77c5669f77bef11cbc43fb85f82bb4a42bfc2136',
  'scripts/etl/factors/stablecoinGrowthGuard.mjs': '3728eb0f7bc2ecdf5faa35edde564a735c9c6bb2',
  'scripts/etl/factors/stablecoinGrowthAggregation.mjs':
    '338ed9046643ab5ccc3fa7f892d4628fe8b55fb4',
  'config/dashboard-config.json': 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49',
  'scripts/etl/compute.mjs': '6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4',
  'scripts/etl/lib/snapshotPrice.mjs': 'd49c9486e0d75bdeecd8b4aa287cb07f6350e34e',
  'scripts/etl/stalenessUtils.mjs': '1c213b9b8eb659c9cda22d0834694ae3239eb768',
  'scripts/etl/lib/termFreshness.mjs': 'bc889e6b50f50c52b5d673c1d7f709ffe05c32e0',
  'scripts/etl/fetch-helper.mjs': 'da8ca2b441088f2e13364249e7ecbbed40dc22a4',
  'scripts/etl/coinGeckoCache.mjs': 'fbfc5e35b3bd4af60eb00e780892b62f94e8bbff',
});

export const H6_1_EVIDENCE_MANIFEST_PATH =
  'research/point-in-time-replay/h6_1_evidence_manifest.csv';
export const H6_1_EVIDENCE_MANIFEST_BLOB =
  '17c0312a4ae4e8bfdae5faf422af68393416f38b';
export const H6_1_FACTOR_UPDATES_PATH =
  'research/point-in-time-replay/h6_1_factor_updates.csv';
export const H6_1_FACTOR_UPDATES_BLOB = 'bddbe3f85721c594fb1e2a628646da5d29afbd44';

export const ETF_HISTORICAL_BASELINE_PATH = 'public/data/etf-flows-historical.json';
export const ETF_HISTORICAL_BASELINE_BLOB =
  '2986a65e565516f374f57bf031a672c84647330c';

export const CASE_B_COINGECKO_LOOKBACK_DAYS = 100;

export const US_MARKET_HOLIDAYS_UTC = Object.freeze(
  new Set([
    '2026-01-01',
    '2026-01-19',
    '2026-02-16',
    '2026-04-03',
    '2026-05-25',
    '2026-06-19',
    '2026-07-03',
    '2026-09-07',
    '2026-11-26',
    '2026-12-25',
  ])
);

export const CASE_A_CHART_DATES = Object.freeze(['2026-08-17', '2026-08-18', '2026-08-19']);

export const CASE_A_CHART_CAPTURES = Object.freeze({
  '2026-08-17': Object.freeze({
    observationDate: '2026-08-17',
    commitSha: 'db789cd9c59b474044d428bfdccbe07312798236',
    blobSha: '3eaaca33a4e0b63a0f0b9257982fee1ca1c2a275',
    path: 'public/data/cache/market_chart_30_daily.json',
  }),
  '2026-08-18': Object.freeze({
    observationDate: '2026-08-18',
    commitSha: '3e0c07ff08a236e59ad60e12373ff02eb138c7fb',
    blobSha: '4b9c8a1cbc460081b02f633a53741b1ca2975770',
    path: 'public/data/cache/market_chart_30_daily.json',
  }),
  '2026-08-19': Object.freeze({
    observationDate: '2026-08-19',
    commitSha: 'ad6be423dc5222c0844e1a367742984d1e69c2d7',
    blobSha: 'cc0e00a323629cc155c466d7b4213bf298182325',
    path: 'public/data/cache/market_chart_30_daily.json',
  }),
});

export const TREND_B_ISLAND_CAPTURES = Object.freeze({
  '2026-08-17': Object.freeze({
    observationDate: '2026-08-17',
    latestJsonCommitSha: 'db789cd9c59b474044d428bfdccbe07312798236',
    latestJsonBlobSha: '82db3c2c0525aaa6dc1aa16932eabe143d7dff45',
    btcPriceHistoryBlobSha: 'ccfa44f025c28a05b86e26c61dfad7320a92594c',
    btcPriceHistoryCommitSha: 'db789cd9c59b474044d428bfdccbe07312798236',
  }),
  '2026-08-18': Object.freeze({
    observationDate: '2026-08-18',
    latestJsonCommitSha: '3e0c07ff08a236e59ad60e12373ff02eb138c7fb',
    latestJsonBlobSha: 'd16a1a140930888a590eaa5f0a56a1c9830971b7',
    btcPriceHistoryBlobSha: 'e472247d7099e3e999daa99917864e92477213b5',
    btcPriceHistoryCommitSha: '3e0c07ff08a236e59ad60e12373ff02eb138c7fb',
  }),
  '2026-08-19': Object.freeze({
    observationDate: '2026-08-19',
    latestJsonCommitSha: 'ad6be423dc5222c0844e1a367742984d1e69c2d7',
    latestJsonBlobSha: 'fca84aed72c35344706eed247dff7bfe04d934be',
    btcPriceHistoryBlobSha: '419cd6a2430ad1939b6182f78cac95b117b74cb3',
    btcPriceHistoryCommitSha: 'ad6be423dc5222c0844e1a367742984d1e69c2d7',
  }),
});

export const TERM_CACHE_H7_COVERAGE = Object.freeze({
  uniqueDates: 241,
  first: '2025-12-11',
  last: '2026-08-19',
  commitTouches: 253,
});

export const SOCIAL_CACHE_H7_COVERAGE = Object.freeze({
  uniqueDates: 241,
  first: '2025-12-11',
  last: '2026-08-19',
  commitTouches: 252,
});

export const TRENDING_JSON_H7_COVERAGE = Object.freeze({
  uniqueDates: 3,
  first: '2026-08-17',
  last: '2026-08-19',
  commitTouches: 3,
});

export const STAGE_B_OUTPUT_FILES = Object.freeze([
  'xr_observations.csv',
  'xr_factor_lineage.csv',
  'xr_missingness.csv',
  'xr_bridge_check.csv',
  'ANALYSIS_SOURCE_SHA.txt',
  'PROTOCOL_VERSION.txt',
]);

export const OFFICIAL_FACTOR_ORDER = Object.freeze([
  'trend_valuation',
  'stablecoins',
  'etf_flows',
  'net_liquidity',
  'term_leverage',
  'macro_overlay',
  'social_interest',
]);

export const FACTOR_WEIGHTS = Object.freeze({
  trend_valuation: 0.3,
  stablecoins: 0.18,
  etf_flows: 0.077,
  net_liquidity: 0.043,
  term_leverage: 0.2,
  macro_overlay: 0.1,
  social_interest: 0.1,
});

export const SUBWEIGHTS = Object.freeze({
  trend_valuation: Object.freeze({
    bmsb_distance: 0.6,
    mayer_stretch: 0.3,
    weekly_rsi: 0.1,
  }),
  stablecoins: Object.freeze({
    supply_growth: 0.55,
    momentum: 0.3,
    concentration: 0.15,
  }),
  etf_flows: Object.freeze({
    sum_21d: 0.3,
    acceleration: 0.3,
    diversification: 0.4,
  }),
  net_liquidity: Object.freeze({
    level: 0.15,
    rate_of_change: 0.4,
    momentum: 0.45,
  }),
  term_leverage: Object.freeze({
    funding: 0.4,
    realized_vol: 0.35,
    stress: 0.25,
  }),
  macro_overlay: Object.freeze({
    dxy_20d: 0.4,
    us2y_20d: 0.35,
    vix_pct: 0.25,
  }),
  social_interest: Object.freeze({
    coingecko_trending_rank: 0.7,
    btc_price_momentum_7d: 0.3,
  }),
});

export const FACTOR_COMPONENT_ORDER = Object.freeze({
  trend_valuation: Object.freeze([
    'utc_intraday_snapshot',
    'bmsb_distance',
    'mayer_stretch',
    'weekly_rsi',
  ]),
  stablecoins: Object.freeze(['supply_growth', 'momentum', 'concentration']),
  etf_flows: Object.freeze(['sum_21d', 'acceleration', 'diversification']),
  net_liquidity: Object.freeze(['level', 'rate_of_change', 'momentum']),
  term_leverage: Object.freeze(['funding', 'realized_vol', 'stress']),
  macro_overlay: Object.freeze(['dxy_20d', 'us2y_20d', 'vix_pct']),
  social_interest: Object.freeze(['coingecko_trending_rank', 'btc_price_momentum_7d']),
});

export const SCORED_COMPONENT_ORDER = Object.freeze({
  trend_valuation: Object.freeze(['bmsb_distance', 'mayer_stretch', 'weekly_rsi']),
  stablecoins: Object.freeze(['supply_growth', 'momentum', 'concentration']),
  etf_flows: Object.freeze(['sum_21d', 'acceleration', 'diversification']),
  net_liquidity: Object.freeze(['level', 'rate_of_change', 'momentum']),
  term_leverage: Object.freeze(['funding', 'realized_vol', 'stress']),
  macro_overlay: Object.freeze(['dxy_20d', 'us2y_20d', 'vix_pct']),
  social_interest: Object.freeze(['coingecko_trending_rank', 'btc_price_momentum_7d']),
});

export const ROLE_PRECEDENCE = Object.freeze([
  'MISSING',
  'C_SURROGATE',
  'C_CURRENT_HISTORY',
  'C_PIT_CONSERVATIVE',
  'B_METHOD_PIT',
]);

export const CLOCK_SOURCE_ENUM = Object.freeze([
  'ARTIFACT_AS_OF_UTC',
  'ARTIFACT_LEGACY_TIMESTAMP',
  'FIXED_1130_UTC',
]);

export const XR_STATUS_ENUM = Object.freeze(['ELIGIBLE', 'NOT_ELIGIBLE']);

export const BRIDGE_COMPARISON_STATUS_ENUM = Object.freeze([
  'COMPARABLE',
  'XR_MISSING',
  'PRODUCTION_MISSING',
  'NOT_COMPARABLE',
]);

export const MISSING_REASON_CODES = Object.freeze([
  'MISSING_CAPTURE',
  'MISSING_BASELINE',
  'MALFORMED_BASELINE',
  'AMBIGUOUS_INTRODUCTION',
  'FORBIDDEN_SAME_COMMIT_BASELINE',
  'MISSING_REQUIRED_OBSERVATION',
  'DUPLICATE_DATE',
  'OUT_OF_ORDER',
  'INVALID_VECTOR_LENGTH',
  'INVALID_CLOCK',
  'TIMESTAMP_CONFLICT',
  'MISSING_COMPONENT',
  'INSUFFICIENT_LOOKBACK',
  'NON_FINITE',
  'BRIDGE_CAPTURE_UNRESOLVED',
  'NO_BITMEX_EVIDENCE',
  'NO_BITCOIN_RANK',
  'NO_SAME_DATE_ETF',
  'NO_FUNDING_WINDOW',
  'WEEKLY_AGGREGATION_UNPROVEN',
  'INCOMPLETE_CANDLE',
  'FUTURE_OBSERVATION',
]);

export const XR_OBSERVATION_COLUMNS = Object.freeze([
  'observation_date',
  'reconstruction_as_of_utc',
  'reconstruction_clock_source',
  'xr_score',
  'xr_status',
  'trend_score',
  'stablecoins_score',
  'etf_score',
  'net_liquidity_score',
  'term_leverage_score',
  'macro_score',
  'social_score',
  'trend_role',
  'stablecoins_role',
  'etf_role',
  'net_liquidity_role',
  'term_leverage_role',
  'macro_role',
  'social_role',
  'reconstruction_grade',
  'eligible_full_composite',
  'missing_factor_count',
  'h7_base_sha',
  'model_source_sha',
  'protocol_version',
]);

export const XR_FACTOR_LINEAGE_COLUMNS = Object.freeze([
  'observation_date',
  'factor_key',
  'component_key',
  'reconstruction_role',
  'source_name',
  'source_type',
  'source_observation_start',
  'source_observation_end',
  'source_as_of_cutoff',
  'git_commit_sha',
  'git_blob_sha',
  'external_snapshot_sha256',
  'is_point_in_time',
  'is_surrogate',
  'is_current_history',
  'is_conservative_vintage',
  'availability_status',
  'missing_reason',
  'notes',
  'h7_base_sha',
  'protocol_version',
]);

export const XR_MISSINGNESS_COLUMNS = Object.freeze([
  'observation_date',
  'trend_available',
  'stablecoins_available',
  'etf_available',
  'net_liquidity_available',
  'term_leverage_available',
  'macro_available',
  'social_available',
  'eligible_full_composite',
  'missing_factors',
  'primary_missing_reason',
  'protocol_version',
]);

export const XR_BRIDGE_COLUMNS = Object.freeze([
  'observation_date',
  'factor_key',
  'xr_factor_score',
  'production_factor_score',
  'difference',
  'xr_input_role',
  'comparison_status',
  'notes',
]);

export const STABLECOIN_CONFIG = Object.freeze([
  Object.freeze({ id: 'tether', symbol: 'USDT', weight: 0.55 }),
  Object.freeze({ id: 'usd-coin', symbol: 'USDC', weight: 0.25 }),
  Object.freeze({ id: 'dai', symbol: 'DAI', weight: 0.05 }),
  Object.freeze({ id: 'binance-usd', symbol: 'BUSD', weight: 0.03 }),
  Object.freeze({ id: 'true-usd', symbol: 'TUSD', weight: 0.02 }),
  Object.freeze({ id: 'frax', symbol: 'FRAX', weight: 0.02 }),
  Object.freeze({ id: 'liquity-usd', symbol: 'LUSD', weight: 0.01 }),
]);

export const ETF_NAMED_FUNDS = Object.freeze([
  'ibit',
  'fbtc',
  'bitb',
  'arkb',
  'btco',
  'ezbc',
  'brrr',
  'hodl',
  'btcw',
  'gbtc',
  'btc',
]);

export const ETF_FLOW_PUBLISH_HOUR_UTC = 16;
export const MIN_VALID_STABLECOIN_GROWTH_COINS = 3;
export const MIN_STABLECOIN_WEIGHT_COVERAGE = 0.7;
export const COINBASE_CANDLE_GRANULARITY_SEC = 300;
export const DEFAULT_BACKFILL_DAYS = 730;
export const COINBASE_MAX_DAILY_CANDLES = 300;
export const COINBASE_HISTORICAL_CHUNK_SPAN_DAYS = 299;
export const COINBASE_HISTORICAL_LOOKBACK_PAD_DAYS = 30;
export const NL_LOOKBACK_DAYS = 365;
export const MACRO_LOOKBACK_DAYS = 120;

export const FACTOR_SCORE_FIELDS = Object.freeze({
  trend_valuation: 'trend_score',
  stablecoins: 'stablecoins_score',
  etf_flows: 'etf_score',
  net_liquidity: 'net_liquidity_score',
  term_leverage: 'term_leverage_score',
  macro_overlay: 'macro_score',
  social_interest: 'social_score',
});

export const FACTOR_ROLE_FIELDS = Object.freeze({
  trend_valuation: 'trend_role',
  stablecoins: 'stablecoins_role',
  etf_flows: 'etf_role',
  net_liquidity: 'net_liquidity_role',
  term_leverage: 'term_leverage_role',
  macro_overlay: 'macro_role',
  social_interest: 'social_role',
});

export const FACTOR_AVAIL_FIELDS = Object.freeze({
  trend_valuation: 'trend_available',
  stablecoins: 'stablecoins_available',
  etf_flows: 'etf_available',
  net_liquidity: 'net_liquidity_available',
  term_leverage: 'term_leverage_available',
  macro_overlay: 'macro_available',
  social_interest: 'social_available',
});

export class XrHistoricalMissingError extends Error {
  constructor(reasonCode, message) {
    super(message || reasonCode);
    this.name = 'XrHistoricalMissingError';
    this.reasonCode = reasonCode;
    this.kind = 'historical_missing';
  }
}

export class XrRuntimeSourceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'XrRuntimeSourceError';
    this.kind = 'runtime_source';
    this.details = details;
  }
}

export class XrInvariantError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'XrInvariantError';
    this.kind = 'invariant';
    this.details = details;
  }
}

export function assertWeightInvariants() {
  const factorSum = OFFICIAL_FACTOR_ORDER.reduce((s, k) => s + FACTOR_WEIGHTS[k], 0);
  if (Math.abs(factorSum - 1) > 1e-12) {
    throw new Error(`factor weights sum ${factorSum}, expected 1`);
  }
  for (const factorKey of OFFICIAL_FACTOR_ORDER) {
    const keys = SCORED_COMPONENT_ORDER[factorKey];
    const sum = keys.reduce((s, k) => s + SUBWEIGHTS[factorKey][k], 0);
    if (Math.abs(sum - 1) > 1e-12) {
      throw new Error(`${factorKey} subweights sum ${sum}, expected 1`);
    }
  }
}

export function utcDateFromIso(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate, days) {
  const d = utcDateFromIso(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDate(d);
}

export function utcCalendarDateFromInstant(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function isValidIsoInstant(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

export function fixed1130Utc(observationDate) {
  return `${observationDate}T11:30:00.000Z`;
}

export function vintageDateTMinus1(observationDate) {
  return addUtcDays(observationDate, -1);
}

export function generateObservationUniverse(
  start = XR_START_DATE,
  end = XR_END_DATE
) {
  if (start > end) throw new Error(`invalid date range ${start}..${end}`);
  const dates = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return dates;
}

export function validateObservationUniverse(dates) {
  const errors = [];
  if (!Array.isArray(dates)) errors.push('not_array');
  else {
    if (dates.length !== XR_EXPECTED_DATE_COUNT) errors.push(`count:${dates.length}`);
    if (dates[0] !== XR_START_DATE) errors.push(`first:${dates[0]}`);
    if (dates[dates.length - 1] !== XR_END_DATE) errors.push(`last:${dates.at(-1)}`);
    const unique = new Set(dates);
    if (unique.size !== dates.length) errors.push('not_unique');
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] <= dates[i - 1]) errors.push('not_strict_ascending');
      if (dates[i] !== addUtcDays(dates[i - 1], 1)) errors.push('calendar_gap');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function latestCompletedUtcDate(asOfUtc) {
  const asOf = new Date(asOfUtc);
  const todayUtc = formatUtcDate(
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  );
  return addUtcDays(todayUtc, -1);
}

export function isCompletedDailyCandle(dateUtc, asOfUtc) {
  if (!dateUtc || !asOfUtc) return false;
  const candleEndMs = utcDateFromIso(addUtcDays(dateUtc, 1)).getTime();
  return new Date(asOfUtc).getTime() >= candleEndMs;
}

export function isWeekComplete(weekSundayUtc, asOfUtc) {
  if (!weekSundayUtc || !asOfUtc) return false;
  return latestCompletedUtcDate(asOfUtc) >= weekSundayUtc;
}

export function filterCompletedWeeklyCloses(weeklyCloses, asOfUtc) {
  return (weeklyCloses || []).filter((w) => isWeekComplete(w.weekEnd, asOfUtc));
}

export function createWeeklyCloses(dailyCandles) {
  if (!dailyCandles || dailyCandles.length === 0) return [];
  const candlesByWeek = new Map();
  for (const candle of dailyCandles) {
    const date = new Date(candle.timestamp);
    const dayOfWeek = date.getUTCDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(date.getUTCDate() + daysUntilSunday);
    weekEnd.setUTCHours(0, 0, 0, 0);
    const weekKey = weekEnd.toISOString().split('T')[0];
    if (!candlesByWeek.has(weekKey)) candlesByWeek.set(weekKey, []);
    candlesByWeek.get(weekKey).push(candle);
  }
  const weeklyCloses = [];
  for (const [weekKey, candles] of candlesByWeek) {
    if (candles.length > 0) {
      const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
      const latestCandle = sortedCandles[sortedCandles.length - 1];
      weeklyCloses.push({
        weekEnd: weekKey,
        close: latestCandle.close,
        timestamp: latestCandle.timestamp,
      });
    }
  }
  return weeklyCloses.sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
}

export function sma200DenominatorCloses(rows, asOfUtc) {
  return (rows || [])
    .filter((r) => isCompletedDailyCandle(r.date_utc || r.date, asOfUtc))
    .map((r) => Number(r.close_usd ?? r.close))
    .filter(Number.isFinite);
}

export function utcCalendarMidnightIso(asOfUtc) {
  const asOf = new Date(asOfUtc);
  if (Number.isNaN(asOf.getTime())) throw new Error(`invalid asOfUtc: ${asOfUtc}`);
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  ).toISOString();
}

export function buildCoinbaseHistoricalChunkRanges({
  asOfUtc,
  days = DEFAULT_BACKFILL_DAYS,
  extraDays = COINBASE_HISTORICAL_LOOKBACK_PAD_DAYS,
  chunkSpanDays = COINBASE_HISTORICAL_CHUNK_SPAN_DAYS,
  maxCandles = COINBASE_MAX_DAILY_CANDLES,
} = {}) {
  const asOfMidnightUtc = utcCalendarMidnightIso(asOfUtc);
  const lookbackDays = days + extraDays;
  const rangeStartUtc = new Date(
    Date.parse(asOfMidnightUtc) - lookbackDays * 86400000
  ).toISOString();
  const rangeEndUtc = asOfMidnightUtc;
  const chunks = [];
  let currentStartUtc = rangeStartUtc;
  const maxChunks = 20;
  while (chunks.length < maxChunks) {
    const unboundedEndUtc = new Date(
      Date.parse(currentStartUtc) + chunkSpanDays * 86400000
    ).toISOString();
    const chunkEndUtc =
      Date.parse(unboundedEndUtc) < Date.parse(rangeEndUtc) ? unboundedEndUtc : rangeEndUtc;
    const inclusiveDays =
      Math.round((Date.parse(chunkEndUtc) - Date.parse(currentStartUtc)) / 86400000) + 1;
    chunks.push({ startUtc: currentStartUtc, endUtc: chunkEndUtc, inclusiveDays });
    if (inclusiveDays > maxCandles) {
      throw new Error(`chunk exceeds Coinbase ${maxCandles}-candle limit: ${inclusiveDays}`);
    }
    if (Date.parse(chunkEndUtc) >= Date.parse(rangeEndUtc)) break;
    currentStartUtc = chunkEndUtc;
  }
  return { asOfUtc, asOfMidnightUtc, rangeStartUtc, rangeEndUtc, chunks };
}

function collectExplicitTimestampDates(rawArtifact) {
  if (!rawArtifact || typeof rawArtifact !== 'object') return [];
  const keys = ['as_of_utc', 'updated_at', 'generated_at', 'timestamp'];
  const found = [];
  for (const key of keys) {
    const value = rawArtifact[key];
    if (!isValidIsoInstant(value)) continue;
    found.push({ key, value, utcDate: utcCalendarDateFromInstant(value) });
  }
  return found;
}

export function selectReconstructionClock({
  observationDate,
  dailyRow = null,
  rawArtifact = null,
} = {}) {
  const status = dailyRow?.selection_status || '';
  const hasSelectedPrimary =
    status === 'DAILY_PRIMARY' &&
    dailyRow?.primary_artifact_id &&
    dailyRow?.primary_artifact_commit_sha &&
    dailyRow?.primary_observation_as_of_utc;

  if (!hasSelectedPrimary || status === 'NO_DAILY_PRIMARY' || status === 'REVIEW_REQUIRED') {
    return {
      reconstruction_as_of_utc: fixed1130Utc(observationDate),
      reconstruction_clock_source: 'FIXED_1130_UTC',
      valid: true,
    };
  }

  const stamps = collectExplicitTimestampDates(rawArtifact);
  const uniqueDates = [...new Set(stamps.map((s) => s.utcDate).filter(Boolean))];
  if (uniqueDates.length > 1) {
    return {
      reconstruction_as_of_utc: '',
      reconstruction_clock_source: '',
      valid: false,
      reasonCode: 'TIMESTAMP_CONFLICT',
    };
  }

  const asOf = rawArtifact?.as_of_utc;
  if (isValidIsoInstant(asOf) && utcCalendarDateFromInstant(asOf) === observationDate) {
    return {
      reconstruction_as_of_utc: new Date(asOf).toISOString(),
      reconstruction_clock_source: 'ARTIFACT_AS_OF_UTC',
      valid: true,
    };
  }

  for (const key of ['updated_at', 'generated_at', 'timestamp']) {
    const value = rawArtifact?.[key];
    if (isValidIsoInstant(value) && utcCalendarDateFromInstant(value) === observationDate) {
      return {
        reconstruction_as_of_utc: new Date(value).toISOString(),
        reconstruction_clock_source: 'ARTIFACT_LEGACY_TIMESTAMP',
        valid: true,
      };
    }
  }

  return {
    reconstruction_as_of_utc: fixed1130Utc(observationDate),
    reconstruction_clock_source: 'FIXED_1130_UTC',
    valid: true,
  };
}

export function aggregateFactorRole(componentRoles) {
  const roles = (componentRoles || []).filter(Boolean);
  if (roles.length === 0) return 'MISSING';
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) return role;
  }
  return 'MISSING';
}

export function aggregateFactorAvailability(componentRoles) {
  const roles = componentRoles || [];
  if (roles.length === 0 || roles.some((r) => r === 'MISSING' || r == null)) return 'MISSING';
  if (roles.every((r) => r === 'B_METHOD_PIT')) return 'AVAILABLE_B';
  return 'AVAILABLE_C';
}

export function blendRequiredComponentScores(scoreByKey, weightsByKey, requiredKeys) {
  for (const key of requiredKeys) {
    const score = scoreByKey[key];
    if (score == null || !Number.isFinite(score) || !Number.isFinite(weightsByKey[key])) {
      return null;
    }
  }
  let weighted = 0;
  for (const key of requiredKeys) {
    weighted += scoreByKey[key] * weightsByKey[key];
  }
  return Math.round(weighted);
}

export function blendOfficialComposite(factorScoresByKey) {
  for (const key of OFFICIAL_FACTOR_ORDER) {
    const score = factorScoresByKey[key];
    if (score == null || !Number.isFinite(score)) return null;
  }
  let weighted = 0;
  for (const key of OFFICIAL_FACTOR_ORDER) {
    weighted += factorScoresByKey[key] * FACTOR_WEIGHTS[key];
  }
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export function percentileRankUnitInterval(arr, value) {
  const sorted = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break;
  }
  return count / sorted.length;
}

export function riskFromPercentileUnitInterval(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  let p = percentile;
  if (invert) p = 1 - p;
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

export function smaPadded(arr, period) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) result.push(NaN);
    else {
      const sum = arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function smaCompact(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function ema(data, period) {
  if (data.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * multiplier + result[i - 1] * (1 - multiplier));
  }
  return result;
}

export function calculateRsiFactors(prices, period = 14) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let gains = 0;
      let losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) result.push(100);
      else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

export function calculateRsiTrend(prices, period = 14) {
  if (prices.length < period + 1) return [];
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  const rsi = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const rs1 = avgGain / avgLoss;
  rsi.push(100 - 100 / (1 + rs1));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

export function percentileRankTrend(array, value) {
  if (array.length === 0) return NaN;
  const sorted = [...array].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item < value) count++;
    else if (item === value) count += 0.5;
  }
  return (count / sorted.length) * 100;
}

export function riskFromPercentileTrend(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  const p = Math.max(0.01, Math.min(99.99, percentile)) / 100;
  const z = Math.log(p / (1 - p)) / k;
  let score = 100 / (1 + Math.exp(-z));
  if (invert) score = 100 - score;
  return Math.round(score);
}

export function calculateBmsb(weeklyCloses, snapshotPrice = null) {
  if (weeklyCloses.length < 22) {
    return {
      status: 'insufficient_history',
      sma20: null,
      ema21: null,
      lower: null,
      upper: null,
      mid: null,
      distance: null,
      weekEnd: null,
    };
  }
  const closes = weeklyCloses.map((w) => w.close);
  const sma20Series = smaCompact(closes, 20);
  const ema21Series = ema(closes, 21);
  if (sma20Series.length === 0 || ema21Series.length === 0) {
    return {
      status: 'calculation_failed',
      sma20: null,
      ema21: null,
      lower: null,
      upper: null,
      mid: null,
      distance: null,
      weekEnd: null,
    };
  }
  const latestSMA20 = sma20Series[sma20Series.length - 1];
  const latestEMA21 = ema21Series[ema21Series.length - 1];
  const latestWeeklyClose = closes[closes.length - 1];
  const priceForDistance =
    snapshotPrice != null && Number.isFinite(snapshotPrice)
      ? snapshotPrice
      : latestWeeklyClose;
  const lower = Math.min(latestSMA20, latestEMA21);
  const upper = Math.max(latestSMA20, latestEMA21);
  const mid = (latestSMA20 + latestEMA21) / 2;
  let status;
  if (priceForDistance > upper) status = 'above';
  else if (priceForDistance < lower) status = 'below';
  else status = 'inside';
  const distance = ((priceForDistance - mid) / mid) * 100;
  return {
    status,
    sma20: latestSMA20,
    ema21: latestEMA21,
    lower,
    upper,
    mid,
    distance,
    weekEnd: weeklyCloses[weeklyCloses.length - 1].weekEnd,
  };
}

export function scoreTrendComponents({ snapshotPrice, dailyCloses, weeklyCloses }) {
  if (!Number.isFinite(snapshotPrice)) {
    return { scores: null, reasonCode: 'NON_FINITE' };
  }
  if (!dailyCloses || dailyCloses.length < 200) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  if (!weeklyCloses || weeklyCloses.length < 22) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  const bmsb = calculateBmsb(weeklyCloses, snapshotPrice);
  let sBmsb = null;
  if (bmsb.status !== 'insufficient_history' && bmsb.status !== 'calculation_failed') {
    const bmsbPercentile = 50 + bmsb.distance * 2;
    const clampedPercentile = Math.max(1, Math.min(99, bmsbPercentile));
    sBmsb = riskFromPercentileTrend(clampedPercentile, { invert: false, k: 3 });
  }
  const sma200Series = smaCompact(dailyCloses, 200);
  const latestSMA200 = sma200Series[sma200Series.length - 1];
  if (!Number.isFinite(latestSMA200) || latestSMA200 === 0) {
    return { scores: null, reasonCode: 'NON_FINITE' };
  }
  const mayerMultiple = snapshotPrice / latestSMA200;
  const mayerSeries = dailyCloses
    .map((price, i) => (i >= 199 ? price / sma200Series[i - 199] : NaN))
    .filter(Number.isFinite);
  const prMayer = percentileRankTrend(mayerSeries, mayerMultiple);
  const sMayer = Number.isFinite(prMayer)
    ? riskFromPercentileTrend(prMayer, { invert: true, k: 3 })
    : null;
  const weeklyClosePrices = weeklyCloses.map((w) => w.close);
  const weeklyRSI = calculateRsiTrend(weeklyClosePrices, 14);
  const latestWeeklyRSI = weeklyRSI[weeklyRSI.length - 1];
  const prRsi = percentileRankTrend(weeklyRSI, latestWeeklyRSI);
  const sRsi = Number.isFinite(prRsi)
    ? riskFromPercentileTrend(prRsi, { invert: false, k: 3 })
    : null;
  const scores = {
    bmsb_distance: sBmsb,
    mayer_stretch: sMayer,
    weekly_rsi: sRsi,
  };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.trend_valuation,
    SCORED_COMPONENT_ORDER.trend_valuation
  );
  return { scores, factorScore, bmsb, mayerMultiple, latestSMA200, latestWeeklyRSI };
}

export function guardStablecoinAggregateChange(aggregateChange) {
  if (!Number.isFinite(aggregateChange)) {
    return { ok: false, reason: 'invalid_stablecoin_growth_input' };
  }
  return { ok: true };
}

export function buildValidStablecoinGrowthSnapshot(stablecoinsConfig, responses) {
  const excluded = [];
  const valid = [];
  const totalConfiguredWeight = stablecoinsConfig.reduce((s, c) => s + c.weight, 0);
  for (let i = 0; i < stablecoinsConfig.length; i++) {
    const coin = stablecoinsConfig[i];
    const data = responses[i];
    const sym = coin.symbol;
    if (!Number.isFinite(coin.weight) || coin.weight <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_config_weight' });
      continue;
    }
    if (!data?.market_caps || !Array.isArray(data.market_caps) || data.market_caps.length < 30) {
      excluded.push({ symbol: sym, reason: 'missing_or_short_30d_history' });
      continue;
    }
    const marketCaps = data.market_caps.map(([, cap]) => cap).filter((c) => Number.isFinite(c));
    if (marketCaps.length < 30) {
      excluded.push({ symbol: sym, reason: 'insufficient_finite_caps' });
      continue;
    }
    const latest = marketCaps[marketCaps.length - 1];
    const thirtyDaysAgo = marketCaps[marketCaps.length - 30];
    const sevenDaysAgo = marketCaps[marketCaps.length - 7];
    if (!Number.isFinite(latest) || latest <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_current_cap' });
      continue;
    }
    if (!Number.isFinite(thirtyDaysAgo) || thirtyDaysAgo <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_prior_30d_cap' });
      continue;
    }
    if (!Number.isFinite(sevenDaysAgo) || sevenDaysAgo <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_prior_7d_cap' });
      continue;
    }
    const change30d = (latest - thirtyDaysAgo) / thirtyDaysAgo;
    const change7d = (latest - sevenDaysAgo) / sevenDaysAgo;
    if (!Number.isFinite(change30d)) {
      excluded.push({ symbol: sym, reason: 'non_finite_change_30d' });
      continue;
    }
    if (!Number.isFinite(change7d)) {
      excluded.push({ symbol: sym, reason: 'non_finite_change_7d' });
      continue;
    }
    valid.push({
      symbol: sym,
      weight: coin.weight,
      marketCap: latest,
      change30d,
      change7d,
    });
  }
  const includedWeightSum = valid.reduce((s, c) => s + c.weight, 0);
  const weightCoverage =
    totalConfiguredWeight > 0 ? includedWeightSum / totalConfiguredWeight : 0;
  const meta = { excluded, totalConfiguredWeight, includedWeightSum, weightCoverage };
  if (valid.length < MIN_VALID_STABLECOIN_GROWTH_COINS) {
    return { ok: false, reason: 'insufficient_valid_stablecoin_growth_inputs', valid, ...meta };
  }
  if (weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE) {
    return { ok: false, reason: 'insufficient_valid_stablecoin_growth_inputs', valid, ...meta };
  }
  const wSum = includedWeightSum;
  const aggregateChange =
    wSum > 0 ? valid.reduce((s, c) => s + c.change30d * c.weight, 0) / wSum : NaN;
  const growthGuard = guardStablecoinAggregateChange(aggregateChange);
  if (!growthGuard.ok) {
    return { ok: false, reason: growthGuard.reason, valid, aggregateChange, ...meta };
  }
  const recentMomentum = valid.reduce((s, c) => {
    const m = c.change7d / Math.max(Math.abs(c.change30d), 0.001);
    return s + m * (c.weight / wSum);
  }, 0);
  const totalMarketCap = valid.reduce((sum, c) => sum + c.marketCap, 0);
  return {
    ok: true,
    valid,
    excluded,
    aggregateChange,
    recentMomentum,
    totalMarketCap,
    totalConfiguredWeight,
    includedWeightSum,
    weightCoverage,
  };
}

export function calculateWeightedStablecoinChanges(responses, stablecoins) {
  const coinData = [];
  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    const coin = stablecoins[i];
    if (response?.market_caps) {
      const marketCaps = response.market_caps
        .map(([, cap]) => cap)
        .filter(Number.isFinite);
      coinData.push({ symbol: coin.symbol, weight: coin.weight, marketCaps });
    }
  }
  if (coinData.length === 0) return [];
  const coinChanges = [];
  for (const coin of coinData) {
    const changes = [];
    for (let i = 30; i < coin.marketCaps.length; i++) {
      const current = coin.marketCaps[i];
      const past = coin.marketCaps[i - 30];
      if (Number.isFinite(current) && Number.isFinite(past) && past > 0 && current > 0) {
        changes.push((current - past) / past);
      }
    }
    coinChanges.push({ symbol: coin.symbol, weight: coin.weight, changes });
  }
  const weightedChanges = [];
  const maxLength = Math.max(...coinChanges.map((c) => c.changes.length));
  for (let i = 0; i < maxLength; i++) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const coin of coinChanges) {
      if (i < coin.changes.length && Number.isFinite(coin.changes[i])) {
        weightedSum += coin.changes[i] * coin.weight;
        totalWeight += coin.weight;
      }
    }
    if (totalWeight > 0) weightedChanges.push(weightedSum / totalWeight);
  }
  return weightedChanges;
}

export function validateStablecoinBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
  }
  if (!Array.isArray(baseline.changeSeries)) {
    return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
  }
  if (baseline.changeSeries.some((v) => !Number.isFinite(v))) {
    return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
  }
  return { ok: true };
}

export function scoreStablecoinComponents({ responses, baseline }) {
  const snapshot = buildValidStablecoinGrowthSnapshot(STABLECOIN_CONFIG, responses);
  if (!snapshot.ok) return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK', snapshot };
  const baselineCheck = validateStablecoinBaseline(baseline);
  if (!baselineCheck.ok) return { scores: null, reasonCode: baselineCheck.reasonCode, snapshot };
  const changeSeries =
    baseline.changeSeries.length > 0
      ? baseline.changeSeries
      : calculateWeightedStablecoinChanges(responses, STABLECOIN_CONFIG);
  if (changeSeries.length === 0) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK', snapshot };
  }
  const supplyPercentile = percentileRankUnitInterval(changeSeries, snapshot.aggregateChange);
  const supplyScore = riskFromPercentileUnitInterval(supplyPercentile, {
    invert: true,
    k: 3,
  });
  const recentMomentum = snapshot.recentMomentum;
  const momentumScore = recentMomentum > 1 ? 30 : recentMomentum > 0.5 ? 50 : 70;
  const hhi = snapshot.valid.reduce((sum, coin) => {
    const marketShare = coin.marketCap / snapshot.totalMarketCap;
    return sum + marketShare * marketShare;
  }, 0);
  const concentrationScore = Math.min(hhi * 100, 100);
  const scores = {
    supply_growth: supplyScore,
    momentum: momentumScore,
    concentration: concentrationScore,
  };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.stablecoins,
    SCORED_COMPONENT_ORDER.stablecoins
  );
  return { scores, factorScore, snapshot };
}

export function isUtcWeekend(dateIso) {
  const d = utcDateFromIso(dateIso);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function isUsMarketHoliday(dateIso) {
  return US_MARKET_HOLIDAYS_UTC.has(dateIso);
}

export function isUtcBusinessDay(dateIso) {
  return !isUtcWeekend(dateIso) && !isUsMarketHoliday(dateIso);
}

export function getPreviousUsTradingDay(dateIso) {
  let cursor = addUtcDays(dateIso, -1);
  while (!isUtcBusinessDay(cursor)) cursor = addUtcDays(cursor, -1);
  return cursor;
}

export function getExpectedLatestUsTradingDay(asOfUtc) {
  const asOf = new Date(asOfUtc);
  let candidate = formatUtcDate(
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  );
  if (isUtcBusinessDay(candidate)) {
    if (asOf.getUTCHours() < ETF_FLOW_PUBLISH_HOUR_UTC) {
      candidate = getPreviousUsTradingDay(candidate);
    }
  } else {
    candidate = getPreviousUsTradingDay(candidate);
  }
  return candidate;
}

export function selectPublishedEtfFlowRows(rows, asOfUtc) {
  const expectedLatestTradingDate = getExpectedLatestUsTradingDay(asOfUtc);
  return (rows || []).filter((row) => row?.date && row.date <= expectedLatestTradingDate);
}

export function parseEtfDate(s) {
  const cleaned = String(s || '').trim().replace(/\s+/g, ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const m1 = cleaned.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i
  );
  if (m1) {
    const [, d, mon, y] = m1;
    const mm = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    return `${y}-${mm[mon.toLowerCase()]}-${d.padStart(2, '0')}`;
  }
  const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const [, a, b, y] = m2;
    return `${y}-${String(parseInt(a, 10)).padStart(2, '0')}-${String(parseInt(b, 10)).padStart(2, '0')}`;
  }
  return null;
}

export function parseEtfNumber(s) {
  if (s == null) return NaN;
  const cleaned = String(s)
    .replace(/[\s,$]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\(([^)]+)\)/, '-$1');
  if (cleaned === '' || cleaned === '-' || cleaned === '--' || cleaned === '.') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function parseEtfFlowsFromHtml(html) {
  const flows = [];
  const individualEtfFlows = [];
  const tableMatches = String(html || '').match(/<table[\s\S]*?<\/table>/gi) || [];
  let dataTable = null;
  for (const match of tableMatches) {
    if (
      match.includes('2024-') ||
      match.includes('2025-') ||
      match.includes('2026-') ||
      match.includes('Date') ||
      match.includes('Total')
    ) {
      dataTable = match;
      break;
    }
  }
  if (!dataTable) return { flows: [], individualEtfFlows: [], schemaHash: null };
  const rows = dataTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellText = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  const parsed = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) =>
      cellText(m[2])
    );
    if (cells.length) parsed.push(cells);
  }
  if (parsed.length < 2) return { flows: [], individualEtfFlows: [], schemaHash: null };
  const header = parsed[0].map((h) => h.toLowerCase());
  const hasTotalCol = header.some((h) => h.includes('total'));
  const hdr = header.join(' ');
  const scale = /\$bn|us\$bn/i.test(hdr)
    ? 1e9
    : /\$m|us\$m|\(us\$m\)|\(\$m\)/i.test(hdr)
      ? 1e6
      : 1;
  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i];
    const date = parseEtfDate((cells[0] || '').trim());
    if (!date) continue;
    let flow = NaN;
    const individualFlows = {};
    if (hasTotalCol) {
      const idx = header.findIndex((h) => h.includes('total'));
      const v = parseEtfNumber(cells[idx]);
      if (Number.isFinite(v)) flow = v * scale;
    }
    for (const etf of ETF_NAMED_FUNDS) {
      const etfIdx = header.findIndex((h) => h.includes(etf));
      if (etfIdx !== -1 && etfIdx < cells.length) {
        const v = parseEtfNumber(cells[etfIdx]);
        if (Number.isFinite(v)) individualFlows[etf] = v * scale;
      }
    }
    if (hasTotalCol && !Number.isFinite(flow)) continue;
    const namedEtfColsPresent = ETF_NAMED_FUNDS.some(
      (etf) => header.findIndex((h) => h.includes(etf)) !== -1
    );
    if (hasTotalCol && namedEtfColsPresent && Object.keys(individualFlows).length === 0) {
      continue;
    }
    if (!hasTotalCol && !Number.isFinite(flow)) {
      let sum = 0;
      let hasData = false;
      for (let c = 1; c < cells.length; c++) {
        const v = parseEtfNumber(cells[c]);
        if (Number.isFinite(v)) {
          sum += v;
          hasData = true;
        }
      }
      if (hasData) flow = sum * scale;
    }
    if (Number.isFinite(flow) && isUtcBusinessDay(date)) {
      flows.push({ date, flow });
      if (Object.keys(individualFlows).length > 0) {
        individualEtfFlows.push({ date, flows: individualFlows });
      }
    }
  }
  flows.sort((a, b) => a.date.localeCompare(b.date));
  individualEtfFlows.sort((a, b) => a.date.localeCompare(b.date));
  const unique = new Map();
  for (const f of flows) unique.set(f.date, f);
  const uniqueIndividual = new Map();
  for (const f of individualEtfFlows) uniqueIndividual.set(f.date, f);
  return {
    flows: Array.from(unique.values()),
    individualEtfFlows: Array.from(uniqueIndividual.values()),
  };
}

export function calculate21DayRollingSum(flows) {
  const sums = [];
  for (let i = 0; i < flows.length; i++) {
    let businessDaysCounted = 0;
    let sum = 0;
    let j = i;
    while (j >= 0 && businessDaysCounted < 21) {
      if (isUtcBusinessDay(flows[j].date)) {
        sum += flows[j].flow;
        businessDaysCounted++;
      }
      j--;
    }
    if (businessDaysCounted === 21) sums.push(sum);
    else sums.push(NaN);
  }
  return sums.filter(Number.isFinite);
}

export function scoreEtfComponents({ html, asOfUtc, historicalBaseline = null }) {
  if (!Array.isArray(historicalBaseline) || historicalBaseline.length === 0) {
    return { scores: null, reasonCode: 'MISSING_BASELINE' };
  }
  const parsed = parseEtfFlowsFromHtml(html);
  const publishedFlows = selectPublishedEtfFlowRows(parsed.flows, asOfUtc);
  const publishedIndividual = selectPublishedEtfFlowRows(parsed.individualEtfFlows, asOfUtc);
  if (publishedFlows.length === 0) return { scores: null, reasonCode: 'NO_SAME_DATE_ETF' };
  const flows21d = calculate21DayRollingSum(publishedFlows);
  if (flows21d.length === 0) return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  const latest21d = flows21d[flows21d.length - 1];
  const percentile = percentileRankUnitInterval(historicalBaseline, latest21d);
  const score21d = riskFromPercentileUnitInterval(percentile, { invert: true, k: 3 });
  const flows7d = publishedFlows.slice(-7).reduce((sum, f) => sum + f.flow, 0);
  const flows14d = publishedFlows.slice(-14, -7).reduce((sum, f) => sum + f.flow, 0);
  const acceleration = flows7d - flows14d;
  const accelSeries = [];
  for (let i = 14; i < publishedFlows.length - 7; i++) {
    const recent = publishedFlows.slice(i, i + 7).reduce((sum, f) => sum + f.flow, 0);
    const previous = publishedFlows.slice(i - 7, i).reduce((sum, f) => sum + f.flow, 0);
    accelSeries.push(recent - previous);
  }
  const accelPercentile =
    accelSeries.length > 0 ? percentileRankUnitInterval(accelSeries, acceleration) : 0.5;
  const accelScore = riskFromPercentileUnitInterval(accelPercentile, { invert: true, k: 3 });
  let diversificationScore = 50;
  const latestIndividualFlows =
    publishedIndividual.length > 0 ? publishedIndividual[publishedIndividual.length - 1].flows : {};
  if (Object.keys(latestIndividualFlows).length > 0) {
    const totalAbsFlow = Object.values(latestIndividualFlows).reduce(
      (sum, flow) => sum + Math.abs(flow),
      0
    );
    if (totalAbsFlow > 0) {
      const hhi = Object.values(latestIndividualFlows)
        .map((flow) => Math.abs(flow) / totalAbsFlow)
        .reduce((sum, share) => sum + share * share, 0);
      diversificationScore = Math.min(hhi * 100, 100);
    }
  }
  const scores = {
    sum_21d: score21d,
    acceleration: accelScore,
    diversification: diversificationScore,
  };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.etf_flows,
    SCORED_COMPONENT_ORDER.etf_flows
  );
  return { scores, factorScore };
}

export function rejectFutureFredObservations(observations, observationDate) {
  return (observations || []).filter((o) => o?.date && o.date < observationDate);
}

export function scoreNetLiquidityComponents(observationsBySeries, observationDate) {
  const filter = (rows) => rejectFutureFredObservations(rows, observationDate);
  const walclValues = filter(observationsBySeries.WALCL)
    .map((o) => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null;
    })
    .filter(Number.isFinite);
  const rrpValues = filter(observationsBySeries.RRPONTSYD)
    .map((o) => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null;
    })
    .filter(Number.isFinite);
  const tgaValues = filter(observationsBySeries.WTREGEN)
    .map((o) => {
      const val = Number(o.value);
      return Number.isFinite(val) ? val * 1e6 : null;
    })
    .filter(Number.isFinite);
  if (walclValues.length === 0 || tgaValues.length === 0) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  const netLiquiditySeries = [];
  const minLength = Math.min(walclValues.length, tgaValues.length);
  for (let i = 0; i < minLength; i++) {
    const rrpValue = i < rrpValues.length ? rrpValues[i] : 0;
    const nl = walclValues[i] - rrpValue - tgaValues[i];
    if (Number.isFinite(nl)) netLiquiditySeries.push(nl);
  }
  if (netLiquiditySeries.length < 8) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  const latest = netLiquiditySeries[netLiquiditySeries.length - 1];
  const levelPercentile = percentileRankUnitInterval(netLiquiditySeries, latest);
  const levelScore = riskFromPercentileUnitInterval(levelPercentile, { invert: true, k: 3 });
  const fourWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 5] || netLiquiditySeries[0];
  const roc4w = ((latest - fourWeeksAgo) / Math.abs(fourWeeksAgo)) * 100;
  const rocSeries = [];
  for (let i = 4; i < netLiquiditySeries.length; i++) {
    const current = netLiquiditySeries[i];
    const past = netLiquiditySeries[i - 4];
    const roc = ((current - past) / Math.abs(past)) * 100;
    if (Number.isFinite(roc)) rocSeries.push(roc);
  }
  const rocPercentile =
    rocSeries.length > 0 ? percentileRankUnitInterval(rocSeries, roc4w) : 0.5;
  const rocScore = riskFromPercentileUnitInterval(rocPercentile, { invert: true, k: 3 });
  let momentumScore = 50;
  if (netLiquiditySeries.length >= 12) {
    const twelveWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 13];
    const eightWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 9];
    const recentSlope = (latest - eightWeeksAgo) / 4;
    const pastSlope = (eightWeeksAgo - twelveWeeksAgo) / 4;
    const acceleration = recentSlope - pastSlope;
    const accelSeries = [];
    for (let i = 12; i < netLiquiditySeries.length; i++) {
      const curr = netLiquiditySeries[i];
      const mid = netLiquiditySeries[i - 4];
      const past = netLiquiditySeries[i - 8];
      const recentSlp = (curr - mid) / 4;
      const pastSlp = (mid - past) / 4;
      const accel = recentSlp - pastSlp;
      if (Number.isFinite(accel)) accelSeries.push(accel);
    }
    if (accelSeries.length > 0) {
      const accelPercentile = percentileRankUnitInterval(accelSeries, acceleration);
      momentumScore = riskFromPercentileUnitInterval(accelPercentile, { invert: true, k: 3 });
    }
  }
  const scores = { level: levelScore, rate_of_change: rocScore, momentum: momentumScore };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.net_liquidity,
    SCORED_COMPONENT_ORDER.net_liquidity
  );
  return { scores, factorScore };
}

export function scoreMacroComponents(observationsBySeries, observationDate) {
  const take = (rows) =>
    rejectFutureFredObservations(rows, observationDate)
      .map((o) => Number(o.value))
      .filter(Number.isFinite);
  const dxyValues = take(observationsBySeries.DTWEXBGS);
  const dgs2Values = take(observationsBySeries.DGS2);
  const dgs10Values = take(observationsBySeries.DGS10);
  const vixValues = take(observationsBySeries.VIXCLS);
  if (dxyValues.length < 30 || dgs2Values.length < 30 || vixValues.length < 30) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  const dxy20dChange =
    dxyValues.length >= 20
      ? ((dxyValues[dxyValues.length - 1] - dxyValues[dxyValues.length - 20]) /
          dxyValues[dxyValues.length - 20]) *
        100
      : 0;
  const dxyChangeSeries = [];
  for (let i = 20; i < dxyValues.length - 20; i++) {
    const change = ((dxyValues[i] - dxyValues[i - 20]) / dxyValues[i - 20]) * 100;
    if (Number.isFinite(change)) dxyChangeSeries.push(change);
  }
  const dxyPercentile =
    dxyChangeSeries.length > 0
      ? percentileRankUnitInterval(dxyChangeSeries, dxy20dChange)
      : 0.5;
  const dollarScore = riskFromPercentileUnitInterval(dxyPercentile, { invert: false, k: 3 });
  const latest2Y = dgs2Values[dgs2Values.length - 1];
  const latest10Y = dgs10Values.length > 0 ? dgs10Values[dgs10Values.length - 1] : latest2Y + 1;
  const yieldCurve = latest10Y - latest2Y;
  const dgs2_20dChange =
    dgs2Values.length >= 20
      ? ((dgs2Values[dgs2Values.length - 1] - dgs2Values[dgs2Values.length - 20]) /
          dgs2Values[dgs2Values.length - 20]) *
        100
      : 0;
  const yieldChangeSeries = [];
  for (let i = 20; i < dgs2Values.length - 20; i++) {
    const change = ((dgs2Values[i] - dgs2Values[i - 20]) / dgs2Values[i - 20]) * 100;
    if (Number.isFinite(change)) yieldChangeSeries.push(change);
  }
  const yieldPercentile =
    yieldChangeSeries.length > 0
      ? percentileRankUnitInterval(yieldChangeSeries, dgs2_20dChange)
      : 0.5;
  let ratesScore = riskFromPercentileUnitInterval(yieldPercentile, { invert: false, k: 3 });
  if (yieldCurve < 0) ratesScore = Math.min(100, ratesScore + 15);
  const latestVix = vixValues[vixValues.length - 1];
  const vixPercentile = percentileRankUnitInterval(vixValues, latestVix);
  const vix7dAvg =
    vixValues.length >= 7 ? vixValues.slice(-7).reduce((sum, v) => sum + v, 0) / 7 : latestVix;
  const vix30dAvg =
    vixValues.length >= 30
      ? vixValues.slice(-30, -7).reduce((sum, v) => sum + v, 0) / 23
      : latestVix;
  const vixMomentum = vix7dAvg - vix30dAvg;
  let vixScore = riskFromPercentileUnitInterval(vixPercentile, { invert: false, k: 3 });
  if (vixMomentum > 2) vixScore = Math.min(100, vixScore + 10);
  else if (vixMomentum < -2) vixScore = Math.max(0, vixScore - 5);
  const scores = { dxy_20d: dollarScore, us2y_20d: ratesScore, vix_pct: vixScore };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.macro_overlay,
    SCORED_COMPONENT_ORDER.macro_overlay
  );
  return { scores, factorScore };
}

export function extractFundingObservationUtc(row, providerId = 'bitmex') {
  if (!row) return null;
  const key = String(providerId || 'bitmex').toLowerCase();
  let raw = key === 'bitmex' ? row.timestamp : row.fundingTime ?? row.timestamp;
  if (raw == null) return null;
  let date;
  if (typeof raw === 'string' && raw.includes('T')) date = new Date(raw);
  else {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    date = new Date(n < 1e12 ? n * 1000 : n);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function validateBitmexFundingWindow(rows) {
  if (!Array.isArray(rows) || rows.length < 30) {
    return { ok: false, reasonCode: 'NO_FUNDING_WINDOW' };
  }
  const rates = rows
    .map((item) => ({
      rate: Number(item.fundingRate) * 100,
      timestamp: extractFundingObservationUtc(item, 'bitmex'),
    }))
    .filter((item) => Number.isFinite(item.rate) && item.timestamp);
  if (rates.length < 30) return { ok: false, reasonCode: 'NO_BITMEX_EVIDENCE' };
  return { ok: true, rates: rates.slice(0, 30) };
}

export function scoreTermComponents({ fundingRates, spotPrices }) {
  if (!fundingRates || fundingRates.length < 30) {
    return { scores: null, reasonCode: 'NO_FUNDING_WINDOW' };
  }
  if (!spotPrices || spotPrices.length < 7) {
    return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  }
  const rates = fundingRates.map((f) => f.rate);
  const avgFunding = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const fundingPercentile = percentileRankUnitInterval(rates, avgFunding);
  const fundingScore = riskFromPercentileUnitInterval(fundingPercentile, {
    invert: false,
    k: 3,
  });
  const returns = [];
  for (let i = 1; i < spotPrices.length; i++) {
    returns.push((spotPrices[i] - spotPrices[i - 1]) / spotPrices[i - 1]);
  }
  const priceVolatility =
    returns.length > 0
      ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100
      : 0;
  const volSeries = [];
  for (let i = 7; i < spotPrices.length; i++) {
    const subset = spotPrices.slice(i - 7, i);
    const subsetReturns = [];
    for (let j = 1; j < subset.length; j++) {
      subsetReturns.push((subset[j] - subset[j - 1]) / subset[j - 1]);
    }
    const vol =
      subsetReturns.length > 0
        ? Math.sqrt(subsetReturns.reduce((sum, r) => sum + r * r, 0) / subsetReturns.length) *
          100
        : 0;
    volSeries.push(vol);
  }
  const volPercentile =
    volSeries.length > 0 ? percentileRankUnitInterval(volSeries, priceVolatility) : 0.5;
  const volScore = riskFromPercentileUnitInterval(volPercentile, { invert: false, k: 3 });
  const stressIndicator = Math.abs(avgFunding) * 10 + priceVolatility * 0.1;
  const stressSeries = [];
  for (let i = 7; i < Math.min(rates.length, spotPrices.length - 7); i++) {
    const fundingSubset = rates.slice(i - 7, i);
    const priceSubset = spotPrices.slice(i - 7, i);
    const avgF = fundingSubset.reduce((sum, r) => sum + r, 0) / fundingSubset.length;
    const subsetReturns = [];
    for (let j = 1; j < priceSubset.length; j++) {
      subsetReturns.push((priceSubset[j] - priceSubset[j - 1]) / priceSubset[j - 1]);
    }
    const vol =
      subsetReturns.length > 0
        ? Math.sqrt(subsetReturns.reduce((sum, r) => sum + r * r, 0) / subsetReturns.length) *
          100
        : 0;
    stressSeries.push(Math.abs(avgF) * 10 + vol * 0.1);
  }
  const stressPercentile =
    stressSeries.length > 0 ? percentileRankUnitInterval(stressSeries, stressIndicator) : 0.5;
  const stressScore = riskFromPercentileUnitInterval(stressPercentile, { invert: false, k: 3 });
  const scores = { funding: fundingScore, realized_vol: volScore, stress: stressScore };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.term_leverage,
    SCORED_COMPONENT_ORDER.term_leverage
  );
  return { scores, factorScore };
}

export function extractSocialBitcoinRank(payload) {
  const fromTrending = extractBitcoinRank(payload);
  if (Number.isFinite(fromTrending)) return fromTrending;
  const rank = Number(payload?.bitcoinRank ?? payload?.metrics?.trending_rank);
  return Number.isFinite(rank) && rank >= 1 ? rank : null;
}

export function extractBitcoinRank(trendingPayload) {
  const unwrapped = unwrapCoinGeckoCachePayload(trendingPayload);
  const payload = unwrapped.ok ? unwrapped.data : trendingPayload;
  const coins = payload?.coins;
  if (!Array.isArray(coins)) return null;
  const bitcoinTrending = coins.find(
    (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
  );
  if (!bitcoinTrending) return null;
  return coins.indexOf(bitcoinTrending) + 1;
}

export function scoreSocialTrendingRank(rank) {
  if (!Number.isFinite(rank) || rank < 1) return null;
  if (rank <= 3) return 85;
  if (rank <= 7) return 70;
  if (rank <= 15) return 55;
  return 35;
}

export function scoreSocialMomentum(prices) {
  if (!Array.isArray(prices) || prices.length < 14) return null;
  const recent7d = prices.slice(-7);
  const previous7d = prices.slice(-14, -7);
  const recentAvg = recent7d.reduce((sum, price) => sum + price, 0) / recent7d.length;
  const previousAvg = previous7d.reduce((sum, price) => sum + price, 0) / previous7d.length;
  const priceChange = ((recentAvg - previousAvg) / previousAvg) * 100;
  const changeSeries = [];
  for (let i = 14; i < prices.length; i++) {
    const recent = prices.slice(i - 7, i);
    const previous = prices.slice(i - 14, i - 7);
    const rAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const pAvg = previous.reduce((sum, p) => sum + p, 0) / previous.length;
    const change = ((rAvg - pAvg) / pAvg) * 100;
    if (Number.isFinite(change)) changeSeries.push(change);
  }
  if (changeSeries.length === 0) return null;
  const changePercentile = percentileRankUnitInterval(changeSeries, priceChange);
  return riskFromPercentileUnitInterval(changePercentile, { invert: false, k: 3 });
}

export function scoreSocialComponents({ bitcoinRank, prices }) {
  const searchScore = scoreSocialTrendingRank(bitcoinRank);
  if (searchScore == null) return { scores: null, reasonCode: 'NO_BITCOIN_RANK' };
  const momentumScore = scoreSocialMomentum(prices);
  if (momentumScore == null) return { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' };
  const scores = {
    coingecko_trending_rank: searchScore,
    btc_price_momentum_7d: momentumScore,
  };
  const factorScore = blendRequiredComponentScores(
    scores,
    SUBWEIGHTS.social_interest,
    SCORED_COMPONENT_ORDER.social_interest
  );
  return { scores, factorScore };
}

export function extractMarketChartPrices(chart) {
  const unwrapped = unwrapCoinGeckoCachePayload(chart);
  if (!unwrapped.ok) return null;
  const prices = unwrapped.data?.prices;
  if (!Array.isArray(prices)) return null;
  return prices;
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

export function unwrapCoinGeckoCachePayload(parsed) {
  if (isCoinGeckoDiskCacheEnvelope(parsed)) {
    return { ok: true, envelope: true, cachedAt: parsed.cachedAt, data: parsed.data };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.prices)) {
    return { ok: true, envelope: false, cachedAt: null, data: parsed };
  }
  return { ok: false, reasonCode: 'MISSING_CAPTURE' };
}

export function validateCaseAPriceRows(prices) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  const copied = [];
  let lastTs = -Infinity;
  for (const row of prices) {
    if (!Array.isArray(row) || row.length < 2) {
      return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
    }
    const ts = Number(row[0]);
    const price = Number(row[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(price)) {
      return { ok: false, reasonCode: 'NON_FINITE' };
    }
    if (ts < lastTs) return { ok: false, reasonCode: 'OUT_OF_ORDER' };
    lastTs = ts;
    copied.push([ts, price]);
  }
  return { ok: true, vector: copied };
}

export function validateCaseAChartVector(chart, { observationDate = null, expectedBlobSha = null } = {}) {
  const unwrapped = unwrapCoinGeckoCachePayload(chart);
  if (!unwrapped.ok) return { ok: false, reasonCode: unwrapped.reasonCode || 'MISSING_CAPTURE' };
  const validated = validateCaseAPriceRows(unwrapped.data?.prices);
  if (!validated.ok) return validated;
  return {
    ok: true,
    vector: validated.vector,
    role: 'B_METHOD_PIT',
    envelope: unwrapped.envelope,
    cachedAt: unwrapped.cachedAt,
    observationDate,
    expectedBlobSha,
  };
}

export function requiredCompletedSurrogateDates(observationDate) {
  const dates = [];
  for (let i = 30; i >= 1; i--) dates.push(addUtcDays(observationDate, -i));
  return dates;
}

export function normalizeCoinGeckoDailyByUtcDate(prices) {
  const byDate = new Map();
  for (const row of prices || []) {
    const ts = Array.isArray(row) ? row[0] : row?.timestamp;
    const price = Array.isArray(row) ? row[1] : row?.price;
    if (!Number.isFinite(ts) || !Number.isFinite(price)) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    if (byDate.has(date)) return { ok: false, reasonCode: 'DUPLICATE_DATE', byDate };
    byDate.set(date, price);
  }
  return { ok: true, byDate };
}

export function buildCaseBSurrogateVector({
  observationDate,
  completedDailyByUtcDate,
  coinbaseProxyPrice,
}) {
  const required = requiredCompletedSurrogateDates(observationDate);
  const points = [];
  for (const date of required) {
    const price = completedDailyByUtcDate?.get?.(date) ?? completedDailyByUtcDate?.[date];
    if (!Number.isFinite(price)) {
      return { ok: false, reasonCode: 'MISSING_REQUIRED_OBSERVATION', missingDate: date };
    }
    points.push({ date, price, kind: 'completed_daily' });
  }
  if (!Number.isFinite(coinbaseProxyPrice)) {
    return { ok: false, reasonCode: 'MISSING_REQUIRED_OBSERVATION' };
  }
  points.push({ date: observationDate, price: coinbaseProxyPrice, kind: 'coinbase_proxy' });
  if (points.length !== 31) return { ok: false, reasonCode: 'INVALID_VECTOR_LENGTH' };
  return { ok: true, vector: points, role: 'C_SURROGATE' };
}

export function rejectMalformedPriceVector(points) {
  if (!Array.isArray(points)) return { ok: false, reasonCode: 'INVALID_VECTOR_LENGTH' };
  if (points.length !== 31) return { ok: false, reasonCode: 'INVALID_VECTOR_LENGTH' };
  const completed = points.slice(0, 30);
  const dates = completed.map((p) => p.date);
  const unique = new Set(dates);
  if (unique.size !== 30) return { ok: false, reasonCode: 'DUPLICATE_DATE' };
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] <= dates[i - 1]) return { ok: false, reasonCode: 'OUT_OF_ORDER' };
  }
  if (points[30]?.kind !== 'coinbase_proxy') {
    return { ok: false, reasonCode: 'INVALID_VECTOR_LENGTH' };
  }
  return { ok: true };
}

export function selectCompletedCoinbase5mCandle(candles, asOfUtc) {
  const asOfMs = new Date(asOfUtc).getTime();
  if (!Number.isFinite(asOfMs)) return { ok: false, reasonCode: 'INVALID_CLOCK' };
  const normalized = [];
  for (const candle of candles || []) {
    let startSec;
    let close;
    if (Array.isArray(candle)) {
      startSec = Number(candle[0]);
      close = Number(candle[4]);
    } else {
      startSec = Number(candle.start ?? candle.time ?? candle[0]);
      close = Number(candle.close ?? candle[4]);
    }
    if (!Number.isFinite(startSec) || !Number.isFinite(close)) continue;
    if (startSec > 1e12) startSec = startSec / 1000;
    const endMs = (startSec + COINBASE_CANDLE_GRANULARITY_SEC) * 1000;
    if (endMs <= asOfMs) normalized.push({ startSec, endMs, close });
  }
  if (normalized.length === 0) return { ok: false, reasonCode: 'INCOMPLETE_CANDLE' };
  normalized.sort((a, b) => a.endMs - b.endMs);
  const selected = normalized[normalized.length - 1];
  return { ok: true, close: selected.close, endMs: selected.endMs, startSec: selected.startSec };
}

export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const src = String(text || '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatCsvValue(value) {
  if (value == null) return '';
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value.toString();
  }
  return csvEscape(value);
}

export function serializeCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => formatCsvValue(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function formatMissingFactors(missingKeys) {
  return OFFICIAL_FACTOR_ORDER.filter((k) => missingKeys.includes(k)).join(';');
}

export function formatPrimaryMissingReason({ factorKey, componentKey, reasonCode }) {
  return `${factorKey}:${componentKey}:${reasonCode}`;
}

export function firstMissingReason(componentRecords) {
  for (const factorKey of OFFICIAL_FACTOR_ORDER) {
    const order = FACTOR_COMPONENT_ORDER[factorKey];
    for (const componentKey of order) {
      const rec = componentRecords.find(
        (r) => r.factor_key === factorKey && r.component_key === componentKey
      );
      if (!rec || rec.reconstruction_role === 'MISSING') {
        return formatPrimaryMissingReason({
          factorKey,
          componentKey,
          reasonCode: rec?.missing_reason || 'MISSING_COMPONENT',
        });
      }
    }
  }
  return '';
}

export function buildEligibility({ factorAvailability, factorScores }) {
  const missing = OFFICIAL_FACTOR_ORDER.filter(
    (k) => factorAvailability[k] === 'MISSING' || factorAvailability[k] == null
  );
  if (missing.length > 0) {
    return {
      xr_status: 'NOT_ELIGIBLE',
      eligible_full_composite: false,
      xr_score: null,
      reconstruction_grade: '',
      missing_factor_count: missing.length,
      missing_factors: formatMissingFactors(missing),
    };
  }
  const nonFinite = OFFICIAL_FACTOR_ORDER.filter(
    (k) => !Number.isFinite(factorScores?.[k])
  );
  if (nonFinite.length > 0) {
    throw new XrInvariantError(
      'available factors must all have finite scores before composite eligibility',
      { nonFinite }
    );
  }
  const xr_score = blendOfficialComposite(factorScores);
  if (xr_score == null) {
    throw new XrInvariantError('composite was null after all factors were available and finite');
  }
  return {
    xr_status: 'ELIGIBLE',
    eligible_full_composite: true,
    xr_score,
    reconstruction_grade: 'EXPLORATORY_ONLY',
    missing_factor_count: 0,
    missing_factors: '',
  };
}

export function sortLineageRows(rows) {
  const factorIndex = Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    if (a.observation_date !== b.observation_date) {
      return a.observation_date.localeCompare(b.observation_date);
    }
    const fa = factorIndex[a.factor_key] ?? 99;
    const fb = factorIndex[b.factor_key] ?? 99;
    if (fa !== fb) return fa - fb;
    const ca = (FACTOR_COMPONENT_ORDER[a.factor_key] || []).indexOf(a.component_key);
    const cb = (FACTOR_COMPONENT_ORDER[b.factor_key] || []).indexOf(b.component_key);
    if (ca !== cb) return ca - cb;
    return String(a.source_name || '').localeCompare(String(b.source_name || ''));
  });
}

export function sortBridgeRows(rows) {
  const factorIndex = Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    if (a.observation_date !== b.observation_date) {
      return a.observation_date.localeCompare(b.observation_date);
    }
    const aComp = a.factor_key === '__XR_COMPOSITE__';
    const bComp = b.factor_key === '__XR_COMPOSITE__';
    if (aComp !== bComp) return aComp ? 1 : -1;
    return (factorIndex[a.factor_key] ?? 99) - (factorIndex[b.factor_key] ?? 99);
  });
}

export function buildBridgeRows({
  observationDate,
  xrFactorScores,
  productionFactorScores,
  xrRoles,
  eligible,
  xrScore,
  productionGScore,
}) {
  const rows = [];
  for (const factorKey of OFFICIAL_FACTOR_ORDER) {
    const xr = xrFactorScores?.[factorKey];
    const prod = productionFactorScores?.[factorKey];
    let comparison_status = 'COMPARABLE';
    if (xr == null && prod == null) comparison_status = 'NOT_COMPARABLE';
    else if (xr == null) comparison_status = 'XR_MISSING';
    else if (prod == null) comparison_status = 'PRODUCTION_MISSING';
    rows.push({
      observation_date: observationDate,
      factor_key: factorKey,
      xr_factor_score: xr ?? '',
      production_factor_score: prod ?? '',
      difference: xr != null && prod != null ? xr - prod : '',
      xr_input_role: xrRoles?.[factorKey] || '',
      comparison_status,
      notes: '',
    });
  }
  if (eligible && xrScore != null && Number.isFinite(productionGScore)) {
    rows.push({
      observation_date: observationDate,
      factor_key: '__XR_COMPOSITE__',
      xr_factor_score: xrScore,
      production_factor_score: productionGScore,
      difference: xrScore - productionGScore,
      xr_input_role: 'EXPLORATORY_ONLY',
      comparison_status: 'COMPARABLE',
      notes: '',
    });
  }
  return sortBridgeRows(rows);
}

export function validateObservationRow(row) {
  for (const col of XR_OBSERVATION_COLUMNS) {
    if (!(col in row)) return { ok: false, error: `missing_column:${col}` };
  }
  if (!XR_STATUS_ENUM.includes(row.xr_status)) {
    return { ok: false, error: `bad_xr_status:${row.xr_status}` };
  }
  if (row.eligible_full_composite === true && row.xr_status !== 'ELIGIBLE') {
    return { ok: false, error: 'eligibility_mismatch' };
  }
  if (row.eligible_full_composite === false && row.xr_status !== 'NOT_ELIGIBLE') {
    return { ok: false, error: 'eligibility_mismatch' };
  }
  if (row.xr_status === 'ELIGIBLE' && row.reconstruction_grade !== 'EXPLORATORY_ONLY') {
    return { ok: false, error: 'grade_mismatch' };
  }
  if (row.xr_status === 'NOT_ELIGIBLE' && row.reconstruction_grade) {
    return { ok: false, error: 'grade_should_be_empty' };
  }
  if (
    row.reconstruction_clock_source &&
    !CLOCK_SOURCE_ENUM.includes(row.reconstruction_clock_source)
  ) {
    return { ok: false, error: `bad_clock:${row.reconstruction_clock_source}` };
  }
  return { ok: true };
}

export function extractEtfRollingSumBaseline(json) {
  const rows = json?.rollingSums;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
  }
  const values = [];
  for (const row of rows) {
    const sum = Number(row?.sum ?? row);
    if (!Number.isFinite(sum)) return { ok: false, reasonCode: 'MALFORMED_BASELINE' };
    values.push(sum);
  }
  return { ok: true, values };
}

export function parseBtcPriceHistoryCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h).trim());
  const dateIdx = header.indexOf('date_utc');
  const closeIdx = header.indexOf('close_usd');
  if (dateIdx < 0 || closeIdx < 0) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const date = rows[i][dateIdx];
    const close = Number(rows[i][closeIdx]);
    if (!date || !Number.isFinite(close)) continue;
    out.push({
      date_utc: date,
      close_usd: close,
      timestamp: Date.parse(`${date}T00:00:00.000Z`),
      close,
    });
  }
  return out.sort((a, b) => a.date_utc.localeCompare(b.date_utc));
}

export function extractLabeledSnapshotPrice(rawArtifact) {
  if (!rawArtifact || typeof rawArtifact !== 'object') {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  if (rawArtifact.price_kind !== 'utc_intraday_snapshot') {
    return { ok: false, reasonCode: 'MISSING_CAPTURE' };
  }
  const price = Number(rawArtifact.btc?.spot_usd);
  if (!Number.isFinite(price)) return { ok: false, reasonCode: 'NON_FINITE' };
  return {
    ok: true,
    price,
    snapshotDate: rawArtifact.snapshot_date || null,
    priceKind: rawArtifact.price_kind,
  };
}

export function extractProductionFactorScores(rawArtifact) {
  const factors = rawArtifact?.factors || {};
  const out = {};
  for (const key of OFFICIAL_FACTOR_ORDER) {
    const score = Number(factors?.[key]?.score);
    out[key] = Number.isFinite(score) ? score : null;
  }
  const g = Number(rawArtifact?.composite_score ?? rawArtifact?.score);
  return { factorScores: out, gScore: Number.isFinite(g) ? g : null };
}

export function caseBCoinGeckoRangeBounds(observationDate) {
  const fromDate = addUtcDays(observationDate, -CASE_B_COINGECKO_LOOKBACK_DAYS);
  const fromSec = Math.floor(Date.parse(`${fromDate}T00:00:00.000Z`) / 1000);
  const toSec = Math.floor(Date.parse(`${observationDate}T00:00:00.000Z`) / 1000) - 1;
  return { fromDate, fromSec, toSec, spanDays: CASE_B_COINGECKO_LOOKBACK_DAYS };
}

export function normalizeCoinbaseDailyCandles(candles, asOfUtc) {
  const byDate = new Map();
  for (const candle of candles || []) {
    let startSec;
    let close;
    if (Array.isArray(candle)) {
      startSec = Number(candle[0]);
      close = Number(candle[4]);
    } else {
      startSec = Number(candle.start ?? candle.time ?? candle[0]);
      close = Number(candle.close ?? candle[4]);
    }
    if (!Number.isFinite(startSec) || !Number.isFinite(close)) continue;
    if (startSec > 1e12) startSec = startSec / 1000;
    const date = new Date(startSec * 1000).toISOString().slice(0, 10);
    if (!isCompletedDailyCandle(date, asOfUtc)) continue;
    const existing = byDate.get(date);
    if (!existing || startSec >= existing.startSec) {
      byDate.set(date, { date, close, startSec });
    }
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ date_utc: row.date, close_usd: row.close, close: row.close, timestamp: row.startSec * 1000 }));
}

export function csvRowsToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = row[i] ?? '';
    return obj;
  });
}

export function validateH71OutputSet({
  observationDates,
  observations,
  missingness,
  lineage,
  bridge,
  analysisSourceSha,
  protocolVersion,
  requireFrozenUniverse = true,
}) {
  if (requireFrozenUniverse) {
    if (observationDates.length !== XR_EXPECTED_DATE_COUNT) {
      return { ok: false, error: `observation_count:${observationDates.length}` };
    }
    if (observationDates[0] !== XR_START_DATE || observationDates.at(-1) !== XR_END_DATE) {
      return { ok: false, error: 'observation_bounds' };
    }
  }
  if (observations.length !== observationDates.length) {
    return { ok: false, error: 'observations_row_count' };
  }
  if (missingness.length !== observationDates.length) {
    return { ok: false, error: 'missingness_row_count' };
  }
  for (let i = 0; i < observationDates.length; i++) {
    if (observations[i].observation_date !== observationDates[i]) {
      return { ok: false, error: `observation_order:${i}` };
    }
    if (missingness[i].observation_date !== observationDates[i]) {
      return { ok: false, error: `missingness_order:${i}` };
    }
    const rowCheck = validateObservationRow(observations[i]);
    if (!rowCheck.ok) return rowCheck;
    const eligible =
      observations[i].xr_status === 'ELIGIBLE' && observations[i].eligible_full_composite === true;
    if (eligible) {
      if (!Number.isFinite(Number(observations[i].xr_score))) {
        return { ok: false, error: 'eligible_missing_score' };
      }
      if (observations[i].reconstruction_grade !== 'EXPLORATORY_ONLY') {
        return { ok: false, error: 'eligible_grade' };
      }
    } else {
      if (observations[i].xr_score !== '' && observations[i].xr_score != null) {
        return { ok: false, error: 'not_eligible_score_present' };
      }
      if (observations[i].reconstruction_grade) {
        return { ok: false, error: 'not_eligible_grade_present' };
      }
    }
  }
  for (const date of observationDates) {
    for (const factorKey of OFFICIAL_FACTOR_ORDER) {
      for (const componentKey of FACTOR_COMPONENT_ORDER[factorKey]) {
        const rec = lineage.find(
          (r) =>
            r.observation_date === date &&
            r.factor_key === factorKey &&
            r.component_key === componentKey
        );
        if (!rec) return { ok: false, error: `lineage_missing:${date}:${factorKey}:${componentKey}` };
      }
    }
  }
  const bridgeDates = [...new Set(bridge.map((r) => r.observation_date))];
  for (const date of bridgeDates) {
    if (!BRIDGE_DATES.includes(date)) return { ok: false, error: `unexpected_bridge_date:${date}` };
  }
  if (requireFrozenUniverse) {
    for (const date of BRIDGE_DATES) {
      const rows = bridge.filter((r) => r.observation_date === date);
      const factorRows = rows.filter((r) => r.factor_key !== '__XR_COMPOSITE__');
      if (factorRows.length !== OFFICIAL_FACTOR_ORDER.length) {
        return { ok: false, error: `bridge_factor_rows:${date}` };
      }
      const obs = observations.find((r) => r.observation_date === date);
      const composites = rows.filter((r) => r.factor_key === '__XR_COMPOSITE__');
      if (obs?.xr_status === 'ELIGIBLE') {
        if (composites.length !== 1) return { ok: false, error: `bridge_composite:${date}` };
      } else if (composites.length !== 0) {
        return { ok: false, error: `bridge_composite_not_eligible:${date}` };
      }
      for (const row of rows) {
        for (const col of XR_BRIDGE_COLUMNS) {
          if (!(col in row)) return { ok: false, error: `bridge_column:${col}` };
        }
      }
    }
  }
  if (analysisSourceSha && !/^[0-9a-f]{40}$/i.test(analysisSourceSha.trim())) {
    return { ok: false, error: 'sidecar_analysis_source_sha' };
  }
  if (protocolVersion !== H7_PROTOCOL_VERSION) {
    return { ok: false, error: 'sidecar_protocol_version' };
  }
  return { ok: true };
}

assertWeightInvariants();
