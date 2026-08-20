import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FROZEN_H7_BLOBS,
  MODEL_CODE_BLOBS,
  MODEL_SOURCE_SHA,
  FACTOR_WEIGHTS,
  SUBWEIGHTS,
  OFFICIAL_FACTOR_ORDER,
  XR_OBSERVATION_COLUMNS,
  XR_FACTOR_LINEAGE_COLUMNS,
  XR_MISSINGNESS_COLUMNS,
  XR_BRIDGE_COLUMNS,
  XR_EXPECTED_DATE_COUNT,
  XR_START_DATE,
  XR_END_DATE,
  generateObservationUniverse,
  validateObservationUniverse,
  selectReconstructionClock,
  aggregateFactorRole,
  aggregateFactorAvailability,
  blendRequiredComponentScores,
  blendOfficialComposite,
  percentileRankUnitInterval,
  riskFromPercentileUnitInterval,
  percentileRankTrend,
  riskFromPercentileTrend,
  smaCompact,
  scoreTrendComponents,
  scoreStablecoinComponents,
  scoreEtfComponents,
  scoreNetLiquidityComponents,
  scoreMacroComponents,
  scoreTermComponents,
  scoreSocialComponents,
  scoreSocialTrendingRank,
  validateCaseAChartVector,
  buildCaseBSurrogateVector,
  requiredCompletedSurrogateDates,
  rejectMalformedPriceVector,
  selectCompletedCoinbase5mCandle,
  vintageDateTMinus1,
  rejectFutureFredObservations,
  serializeCsv,
  formatCsvValue,
  parseCsv,
  formatMissingFactors,
  firstMissingReason,
  buildEligibility,
  buildBridgeRows,
  sortBridgeRows,
  MISSING_REASON_CODES,
  BRIDGE_COMPARISON_STATUS_ENUM,
  CLOCK_SOURCE_ENUM,
  addUtcDays,
  validateStablecoinBaseline,
  CASE_A_CHART_CAPTURES,
  TREND_B_ISLAND_CAPTURES,
  ETF_HISTORICAL_BASELINE_BLOB,
  US_MARKET_HOLIDAYS_UTC,
  getExpectedLatestUsTradingDay,
  XrInvariantError,
  caseBCoinGeckoRangeBounds,
  CASE_B_COINGECKO_LOOKBACK_DAYS,
  unwrapCoinGeckoCachePayload,
  extractEtfRollingSumBaseline,
  extractProductionFactorScores,
  reconstructTrendIslandSeries,
  parseBtcPriceHistoryCsv,
  retainCoinbaseHistoryWindow,
  coinbaseRetainedHistoryCutoffDate,
  DEFAULT_BACKFILL_DAYS,
  isUtcWeekday,
  isUsTradingDay,
  BRIDGE_PRODUCTION_CAPTURES,
  H7_PROTOCOL_VERSION,
  FACTOR_COMPONENT_ORDER,
  FACTOR_AVAIL_FIELDS,
  FACTOR_SCORE_FIELDS,
  FACTOR_ROLE_FIELDS,
  finalizeFactorRecords,
} from '../lib/xr-reconstruction-core.mjs';
import {
  buildAlfredRequest,
  buildNetLiquidityRequests,
  requireFredApiKey,
  fetchWithRetryInjected,
  findIntroductionCandidates,
  gitBlobExists,
  gitFirstParent,
  resolveFirstIntroduction,
  resolveStablecoinCapture,
  resolveTrendBIsland,
  GIT_PATHS,
  sanitizeFredUrl,
  XrRuntimeSourceError,
  XrHistoricalMissingError,
  classifyMissingVsRuntime,
  missingResult,
  buildCoinGeckoHistoryRangeRequest,
} from '../lib/xr-source-adapters.mjs';
import {
  runContractCheck,
  parseArgs,
  requireStageBFlags,
  assertSafeOutputDir,
  assertAnalysisSourceSha,
  previewCsv,
  runStageBGeneration,
  finalizeAtomicOutputs,
  assembleDateRecords,
  assembleStageBOutputSet,
  reconstructOneDate,
  presentComp,
  missingComp,
} from '../build-xr-reconstruction.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('identity: frozen H7 blobs and MODEL_CODE_BLOBS are populated', () => {
  assert.equal(Object.keys(FROZEN_H7_BLOBS).length, 5);
  assert.equal(FROZEN_H7_BLOBS['docs/H7_EXPLORATORY_RECONSTRUCTION_PROTOCOL_2026-08-19.md'],
    'be3843fda42c1db85c6616cc8351c765d3bc4555');
  assert.equal(MODEL_SOURCE_SHA, '6b2fa9cf56ce738c74c8da6de0f5a972858f8a52');
  assert.equal(MODEL_CODE_BLOBS['scripts/etl/factors.mjs'],
    'e9fd06df79967f0041a901e2dd971b771e669b03');
  assert.equal(MODEL_CODE_BLOBS['scripts/etl/coinGeckoCache.mjs'],
    'fbfc5e35b3bd4af60eb00e780892b62f94e8bbff');
  assert.equal(Object.keys(MODEL_CODE_BLOBS).length, 16);
  assert.equal(ETF_HISTORICAL_BASELINE_BLOB, '2986a65e565516f374f57bf031a672c84647330c');
  assert.equal(CASE_A_CHART_CAPTURES['2026-08-17'].blobSha, '3eaaca33a4e0b63a0f0b9257982fee1ca1c2a275');
  assert.equal(TREND_B_ISLAND_CAPTURES['2026-08-19'].latestJsonBlobSha, 'fca84aed72c35344706eed247dff7bfe04d934be');
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-17'].blobSha, '82db3c2c0525aaa6dc1aa16932eabe143d7dff45');
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-18'].blobSha, 'd16a1a140930888a590eaa5f0a56a1c9830971b7');
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-19'].commitSha, 'ad6be423dc5222c0844e1a367742984d1e69c2d7');
});

test('identity: factor weights and subweights', () => {
  assert.equal(FACTOR_WEIGHTS.trend_valuation, 0.3);
  assert.equal(FACTOR_WEIGHTS.stablecoins, 0.18);
  assert.equal(FACTOR_WEIGHTS.etf_flows, 0.077);
  assert.equal(FACTOR_WEIGHTS.net_liquidity, 0.043);
  assert.equal(FACTOR_WEIGHTS.term_leverage, 0.2);
  assert.equal(FACTOR_WEIGHTS.macro_overlay, 0.1);
  assert.equal(FACTOR_WEIGHTS.social_interest, 0.1);
  const sum = OFFICIAL_FACTOR_ORDER.reduce((s, k) => s + FACTOR_WEIGHTS[k], 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.equal(SUBWEIGHTS.trend_valuation.bmsb_distance, 0.6);
  assert.equal(SUBWEIGHTS.social_interest.coingecko_trending_rank, 0.7);
});

test('identity: exact output columns', () => {
  assert.equal(XR_OBSERVATION_COLUMNS.length, 25);
  assert.equal(XR_FACTOR_LINEAGE_COLUMNS.length, 21);
  assert.equal(XR_MISSINGNESS_COLUMNS.length, 12);
  assert.equal(XR_BRIDGE_COLUMNS.length, 8);
  assert.equal(XR_OBSERVATION_COLUMNS[0], 'observation_date');
  assert.equal(XR_BRIDGE_COLUMNS[7], 'notes');
});

test('date universe: exactly 252 ordered UTC dates', () => {
  const dates = generateObservationUniverse();
  const v = validateObservationUniverse(dates);
  assert.equal(dates.length, XR_EXPECTED_DATE_COUNT);
  assert.equal(dates[0], XR_START_DATE);
  assert.equal(dates.at(-1), XR_END_DATE);
  assert.equal(v.ok, true);
  assert.ok(!dates.includes('2026-08-20'));
});

test('clock: raw as_of_utc wins when UTC date equals T', () => {
  const clock = selectReconstructionClock({
    observationDate: '2026-01-15',
    dailyRow: {
      selection_status: 'DAILY_PRIMARY',
      primary_artifact_id: 'abc',
      primary_artifact_commit_sha: 'def',
      primary_observation_as_of_utc: '2026-01-15T11:19:00.000Z',
    },
    rawArtifact: {
      as_of_utc: '2026-01-15T11:19:27.000Z',
      updated_at: '2026-01-15T11:19:27.000Z',
    },
  });
  assert.equal(clock.reconstruction_clock_source, 'ARTIFACT_AS_OF_UTC');
  assert.equal(clock.reconstruction_as_of_utc, '2026-01-15T11:19:27.000Z');
});

test('clock: legacy updated_at then generated_at then timestamp', () => {
  const clock = selectReconstructionClock({
    observationDate: '2026-01-15',
    dailyRow: {
      selection_status: 'DAILY_PRIMARY',
      primary_artifact_id: 'abc',
      primary_artifact_commit_sha: 'def',
      primary_observation_as_of_utc: '2026-01-15T11:00:00.000Z',
    },
    rawArtifact: {
      updated_at: '2026-01-15T11:05:00.000Z',
      generated_at: '2026-01-15T11:01:00.000Z',
    },
  });
  assert.equal(clock.reconstruction_clock_source, 'ARTIFACT_LEGACY_TIMESTAMP');
  assert.equal(clock.reconstruction_as_of_utc, '2026-01-15T11:05:00.000Z');
});

test('clock: FIXED_1130_UTC for NO_DAILY_PRIMARY / REVIEW_REQUIRED', () => {
  const a = selectReconstructionClock({
    observationDate: '2026-01-14',
    dailyRow: { selection_status: 'NO_DAILY_PRIMARY' },
  });
  const b = selectReconstructionClock({
    observationDate: '2026-01-14',
    dailyRow: { selection_status: 'REVIEW_REQUIRED' },
  });
  assert.equal(a.reconstruction_clock_source, 'FIXED_1130_UTC');
  assert.equal(a.reconstruction_as_of_utc, '2026-01-14T11:30:00.000Z');
  assert.equal(b.reconstruction_clock_source, 'FIXED_1130_UTC');
});

test('clock: timestamp UTC-date conflict is invalid and keeps no fourth enum', () => {
  const clock = selectReconstructionClock({
    observationDate: '2026-01-15',
    dailyRow: {
      selection_status: 'DAILY_PRIMARY',
      primary_artifact_id: 'abc',
      primary_artifact_commit_sha: 'def',
      primary_observation_as_of_utc: '2026-01-15T11:19:00.000Z',
    },
    rawArtifact: {
      as_of_utc: '2026-01-15T11:19:27.000Z',
      updated_at: '2026-01-14T23:00:00.000Z',
    },
  });
  assert.equal(clock.valid, false);
  assert.equal(clock.reconstruction_as_of_utc, '');
  assert.equal(clock.reconstruction_clock_source, '');
  assert.equal(clock.reasonCode, 'TIMESTAMP_CONFLICT');
  assert.equal(CLOCK_SOURCE_ENUM.includes('COMMIT_TIMESTAMP'), false);
});

test('clock: commit timestamp field is never a clock source', () => {
  const clock = selectReconstructionClock({
    observationDate: '2026-01-15',
    dailyRow: {
      selection_status: 'DAILY_PRIMARY',
      primary_artifact_id: 'abc',
      primary_artifact_commit_sha: 'def',
      primary_observation_as_of_utc: '2026-01-15T11:19:00.000Z',
    },
    rawArtifact: {
      commit_timestamp: '2026-01-15T18:00:00.000Z',
      daily_close_date: '2026-01-15',
    },
  });
  assert.equal(clock.reconstruction_clock_source, 'FIXED_1130_UTC');
});

test('roles: precedence and availability', () => {
  assert.equal(
    aggregateFactorRole(['B_METHOD_PIT', 'C_SURROGATE', 'C_CURRENT_HISTORY']),
    'C_SURROGATE'
  );
  assert.equal(aggregateFactorRole(['MISSING', 'C_SURROGATE']), 'MISSING');
  assert.equal(aggregateFactorAvailability(['B_METHOD_PIT', 'B_METHOD_PIT']), 'AVAILABLE_B');
  assert.equal(aggregateFactorAvailability(['B_METHOD_PIT', 'C_SURROGATE']), 'AVAILABLE_C');
  assert.equal(aggregateFactorAvailability(['B_METHOD_PIT', 'MISSING']), 'MISSING');
});

test('math: percentile and risk golden values independently computed', () => {
  // count(v<=3) in [1,2,3,4,5] = 3; 3/5 = 0.6
  assert.equal(percentileRankUnitInterval([1, 2, 3, 4, 5], 3), 0.6);
  // logistic 1/(1+e^-0.6)*100 rounded = 65
  assert.equal(riskFromPercentileUnitInterval(0.6), 65);
  // ties: (1 + 0.5 + 0.5)/4 * 100 = 50
  assert.equal(percentileRankTrend([10, 20, 20, 30], 20), 50);
  assert.equal(riskFromPercentileTrend(50), 50);
  assert.deepEqual(smaCompact([1, 2, 3, 4], 2), [1.5, 2.5, 3.5]);
});

test('math: no factor renormalization and no composite renormalization', () => {
  const blended = blendRequiredComponentScores(
    { funding: 40, realized_vol: 50, stress: 60 },
    SUBWEIGHTS.term_leverage,
    ['funding', 'realized_vol', 'stress']
  );
  // 40*0.4 + 50*0.35 + 60*0.25 = 48.5 → 49
  assert.equal(blended, 49);
  assert.equal(
    blendRequiredComponentScores(
      { funding: 40, realized_vol: null, stress: 60 },
      SUBWEIGHTS.term_leverage,
      ['funding', 'realized_vol', 'stress']
    ),
    null
  );
  const all50 = Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 50]));
  assert.equal(blendOfficialComposite(all50), 50);
  assert.equal(blendOfficialComposite({ ...all50, macro_overlay: null }), null);
});

test('golden: trend_valuation synthetic', () => {
  const dailyCloses = Array.from({ length: 200 }, () => 100);
  const weeklyCloses = Array.from({ length: 30 }, (_, i) => ({
    weekEnd: addUtcDays('2025-01-05', i * 7),
    close: 100,
    timestamp: Date.UTC(2025, 0, 5) + i * 7 * 86400000,
  }));
  const result = scoreTrendComponents({
    snapshotPrice: 110,
    dailyCloses,
    weeklyCloses,
  });
  assert.ok(result.factorScore != null);
  assert.equal(result.bmsb.distance, 10);
  // distance 10 → percentile 70 → trend logistic 57
  // mayer 1.1 vs all-1.0 series → invert logistic 4; RSI same 4
  // 57*0.6 + 4*0.3 + 4*0.1 = 35.8 → 36
  assert.equal(result.scores.bmsb_distance, 57);
  assert.equal(result.scores.mayer_stretch, 4);
  assert.equal(result.scores.weekly_rsi, 4);
  assert.equal(result.factorScore, 36);
});

test('golden: stablecoins synthetic', () => {
  const responses = Array.from({ length: 7 }, () => ({
    market_caps: Array.from({ length: 31 }, (_, i) => [i * 86400000, 100 + i * 0]),
  }));
  for (const r of responses) {
    r.market_caps[r.market_caps.length - 1][1] = 101;
    r.market_caps[r.market_caps.length - 31][1] = 100;
    r.market_caps[r.market_caps.length - 7][1] = 100.5;
  }
  const baseline = { changeSeries: [0, 0.01, 0.02] };
  const result = scoreStablecoinComponents({ responses, baseline });
  // Independent: aggregateChange ≈ 0.01 vs baseline [0, 0.01, 0.02]
  // float 0.009999... ranks at 1/3; invert logistic → 73
  // momentum 0.4975 → 70; HHI 1/7*100 ≈ 14.2857
  // 73*0.55 + 70*0.30 + 14.2857*0.15 = 63.2928 → 63
  assert.equal(result.factorScore, 63);
});

test('golden: etf_flows synthetic', () => {
  const dates = [];
  let d = '2026-01-05';
  while (dates.length < 30) {
    const day = new Date(`${d}T00:00:00.000Z`).getUTCDay();
    if (day >= 1 && day <= 5) dates.push(d);
    d = addUtcDays(d, 1);
  }
  const rows = dates
    .map((date) => `<tr><td>${date}</td><td>10</td><td>1</td></tr>`)
    .join('');
  const html = `<table><tr><th>Date</th><th>Total</th><th>IBIT</th></tr>${rows}</table>`;
  const baseline = Array.from({ length: 40 }, (_, i) => 100 + i);
  const withBaseline = scoreEtfComponents({
    html,
    asOfUtc: '2026-02-20T18:00:00.000Z',
    historicalBaseline: baseline,
  });
  const withoutOwnUniverse = scoreEtfComponents({
    html,
    asOfUtc: '2026-02-20T18:00:00.000Z',
    historicalBaseline: [100000],
  });
  // latest21d=210 vs baseline 100..139 → invert logistic 5; accel 5; IBIT-only HHI 100
  // 5*0.3 + 5*0.3 + 100*0.4 = 43
  assert.equal(withBaseline.scores.sum_21d, 5);
  assert.equal(withBaseline.factorScore, 43);
  assert.notEqual(withBaseline.scores.sum_21d, withoutOwnUniverse.scores.sum_21d);
  assert.equal(scoreEtfComponents({ html, asOfUtc: '2026-02-20T18:00:00.000Z' }).reasonCode, 'MISSING_BASELINE');
});

test('golden: net_liquidity synthetic', () => {
  const mk = (n, start) =>
    Array.from({ length: n }, (_, i) => ({
      date: addUtcDays(start, i * 7),
      value: String(1000 + i),
    }));
  const result = scoreNetLiquidityComponents(
    {
      WALCL: mk(20, '2025-10-01'),
      RRPONTSYD: mk(20, '2025-10-01'),
      WTREGEN: mk(20, '2025-10-01'),
    },
    '2026-03-01'
  );
  // nl = WALCL-RRP-TGA is negative increasing; invert level 94, RoC 5, momentum 95
  // 94*0.15 + 5*0.40 + 95*0.45 = 58.85 → 59
  assert.equal(result.scores.level, 94);
  assert.equal(result.scores.rate_of_change, 5);
  assert.equal(result.scores.momentum, 95);
  assert.equal(result.factorScore, 59);
});

test('golden: macro_overlay synthetic', () => {
  const mk = (n, start, base) =>
    Array.from({ length: n }, (_, i) => ({
      date: addUtcDays(start, i),
      value: String(base + i * 0.01),
    }));
  const result = scoreMacroComponents(
    {
      DTWEXBGS: mk(80, '2025-11-01', 100),
      DGS2: mk(80, '2025-11-01', 4),
      DGS10: mk(80, '2025-11-01', 4.2),
      VIXCLS: mk(80, '2025-11-01', 15),
    },
    '2026-02-01'
  );
  assert.equal(result.scores.dxy_20d, 5);
  assert.equal(result.scores.us2y_20d, 5);
  assert.equal(result.scores.vix_pct, 95);
  // 5*0.4 + 5*0.35 + 95*0.25 = 27.5 → 28
  assert.equal(result.factorScore, 28);
});

test('golden: term_leverage synthetic', () => {
  const fundingRates = Array.from({ length: 30 }, (_, i) => ({ rate: 0.01 * (i + 1) }));
  const spotPrices = Array.from({ length: 31 }, (_, i) => 100 + i);
  const result = scoreTermComponents({ fundingRates, spotPrices });
  assert.equal(result.scores.funding, 50);
  assert.equal(result.scores.realized_vol, 50);
  assert.equal(result.scores.stress, 77);
  // 50*0.4 + 50*0.35 + 77*0.25 = 56.75 → 57
  assert.equal(result.factorScore, 57);
});

test('golden: social_interest synthetic', () => {
  assert.equal(scoreSocialTrendingRank(1), 85);
  assert.equal(scoreSocialTrendingRank(5), 70);
  assert.equal(scoreSocialTrendingRank(10), 55);
  assert.equal(scoreSocialTrendingRank(20), 35);
  const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
  const result = scoreSocialComponents({ bitcoinRank: 2, prices });
  assert.equal(result.scores.coingecko_trending_rank, 85);
  assert.equal(result.scores.btc_price_momentum_7d, 5);
  // 85*0.7 + 5*0.3 = 61
  assert.equal(result.factorScore, 61);
  assert.equal(scoreSocialComponents({ bitcoinRank: null, prices }).reasonCode, 'NO_BITCOIN_RANK');
});

test('stablecoins: first-introduction / parent / same-commit / ambiguous', () => {
  const blobs = {
    'C1:public/data/cache/stablecoins/2026-01-02.json': 'blob-raw',
    'P1:public/data/stablecoins-historical.json': 'blob-base',
  };
  const parents = { C1: 'P1' };
  const trees = {
    C1: new Set(['public/data/cache/stablecoins/2026-01-02.json', 'public/data/stablecoins-historical.json']),
    P1: new Set(['public/data/stablecoins-historical.json']),
  };
  const gitExec = (args) => {
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    const cmd = args.join(' ');
    if (cmd.startsWith('log --diff-filter=A')) return Buffer.from('C1\n');
    if (args[0] === 'rev-list' && args.includes('--parents')) {
      const sha = args[args.length - 1];
      return Buffer.from(`${sha} ${parents[sha]}\n`);
    }
    if (args[0] === 'rev-parse' && args[1].endsWith('^')) return Buffer.from(parents[args[1].slice(0, -1)] + '\n');
    if (args[0] === 'rev-parse') {
      const spec = args[1];
      if (blobs[spec]) return Buffer.from(blobs[spec] + '\n');
      const [sha, pth] = spec.split(':');
      if (trees[sha]?.has(pth)) return Buffer.from(`blob-${sha}\n`);
      throw new XrRuntimeSourceError('path does not exist in tree', { status: 128 });
    }
    if (args[0] === 'show') {
      const spec = args[1];
      if (spec.endsWith('stablecoins-historical.json')) {
        return Buffer.from(JSON.stringify({ changeSeries: [0.01] }));
      }
      return Buffer.from(JSON.stringify([{ market_caps: [] }]));
    }
    throw new XrRuntimeSourceError(cmd);
  };
  const intro = resolveFirstIntroduction('public/data/cache/stablecoins/2026-01-02.json', gitExec);
  assert.equal(intro.ok, true);
  assert.equal(intro.commitSha, 'C1');
  assert.equal(intro.firstParentSha, 'P1');
  const resolved = resolveStablecoinCapture('2026-01-02', gitExec);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.firstParentSha, 'P1');
  assert.notEqual(resolved.captureCommitSha, resolved.firstParentSha);

  const gitExecAmbiguous = (args) => {
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    if (args[0] === 'log') return Buffer.from('C1\nC2\n');
    if (args[0] === 'rev-list' && args.includes('--parents')) {
      const sha = args[args.length - 1];
      return Buffer.from(`${sha} ${sha === 'C1' ? 'P1' : 'P2'}\n`);
    }
    if (args[0] === 'rev-parse' && String(args[1]).endsWith('^')) {
      const sha = args[1].slice(0, -1);
      return Buffer.from(`${sha === 'C1' ? 'P1' : 'P2'}\n`);
    }
    if (args[0] === 'rev-parse') {
      const spec = args[1];
      if (spec.startsWith('P1:') || spec.startsWith('P2:')) {
        throw new XrRuntimeSourceError('path does not exist in tree', { status: 128 });
      }
      return Buffer.from('blob\n');
    }
    throw new XrRuntimeSourceError('no');
  };
  const amb = findIntroductionCandidates('public/data/cache/stablecoins/2026-01-02.json', gitExecAmbiguous);
  assert.ok(amb.length >= 2);
  const ambIntro = resolveFirstIntroduction('x', gitExecAmbiguous);
  assert.equal(ambIntro.reasonCode, 'AMBIGUOUS_INTRODUCTION');
});

test('stablecoins: malformed baseline is MISSING', () => {
  assert.equal(validateStablecoinBaseline(null).ok, false);
  assert.equal(validateStablecoinBaseline({ changeSeries: ['bad'] }).reasonCode, 'MALFORMED_BASELINE');
});

test('price vector: CASE A untouched and never mixes proxy', () => {
  const chart = { prices: [[1, 10], [2, 11], [3, 12]] };
  const a = validateCaseAChartVector(chart);
  assert.equal(a.ok, true);
  assert.equal(a.role, 'B_METHOD_PIT');
  assert.deepEqual(a.vector, [[1, 10], [2, 11], [3, 12]]);
  a.vector[0][1] = 99;
  assert.equal(chart.prices[0][1], 10);
});

test('price vector: CASE B exact 31 with T-30..T-1 and proxy last', () => {
  const T = '2026-02-10';
  const required = requiredCompletedSurrogateDates(T);
  assert.equal(required.length, 30);
  assert.equal(required[0], addUtcDays(T, -30));
  assert.equal(required[29], addUtcDays(T, -1));
  const map = new Map(required.map((d, i) => [d, 100 + i]));
  const built = buildCaseBSurrogateVector({
    observationDate: T,
    completedDailyByUtcDate: map,
    coinbaseProxyPrice: 999,
  });
  assert.equal(built.ok, true);
  assert.equal(built.vector.length, 31);
  assert.equal(built.vector[30].price, 999);
  assert.equal(built.vector[30].kind, 'coinbase_proxy');
  assert.equal(rejectMalformedPriceVector(built.vector).ok, true);
});

test('price vector: duplicate and missing dates rejected', () => {
  const T = '2026-02-10';
  const required = requiredCompletedSurrogateDates(T);
  const map = new Map(required.map((d) => [d, 100]));
  map.delete(required[4]);
  const missing = buildCaseBSurrogateVector({
    observationDate: T,
    completedDailyByUtcDate: map,
    coinbaseProxyPrice: 1,
  });
  assert.equal(missing.reasonCode, 'MISSING_REQUIRED_OBSERVATION');
  const dup = rejectMalformedPriceVector([
    ...required.map((date) => ({ date, price: 1, kind: 'completed_daily' })),
    { date: T, price: 1, kind: 'coinbase_proxy' },
  ]);
  // duplicate by replacing one date
  const bad = required.map((date) => ({ date, price: 1, kind: 'completed_daily' }));
  bad[3] = { date: bad[2].date, price: 1, kind: 'completed_daily' };
  assert.equal(
    rejectMalformedPriceVector([...bad, { date: T, price: 1, kind: 'coinbase_proxy' }]).reasonCode,
    'DUPLICATE_DATE'
  );
  assert.equal(dup.ok, true);
});

test('coinbase: completed 5m selection, incomplete rejected, unordered, exact boundary', () => {
  const asOf = '2026-01-15T11:30:00.000Z';
  const asOfSec = Date.parse(asOf) / 1000;
  const completed = [asOfSec - 600, 1, 2, 3, 111, 0];
  const incomplete = [asOfSec - 100, 1, 2, 3, 222, 0];
  const exact = [asOfSec - 300, 1, 2, 3, 333, 0];
  const unordered = [incomplete, exact, completed];
  const selected = selectCompletedCoinbase5mCandle(unordered, asOf);
  assert.equal(selected.ok, true);
  assert.equal(selected.close, 333);
  const onlyIncomplete = selectCompletedCoinbase5mCandle([incomplete], asOf);
  assert.equal(onlyIncomplete.ok, false);
});

test('FRED/ALFRED: exact T-1 and weekends not rolled', () => {
  const monday = '2026-01-05';
  const req = buildAlfredRequest({
    seriesId: 'WALCL',
    observationDate: monday,
    lookbackDays: 365,
    frequency: 'w',
    apiKey: 'SECRETKEY',
  });
  assert.equal(req.realtime_start, '2026-01-04');
  assert.equal(req.realtime_end, '2026-01-04');
  assert.equal(req.observation_end, '2026-01-04');
  assert.equal(vintageDateTMinus1(monday), '2026-01-04');
  assert.equal(new Date(`${req.realtime_start}T00:00:00.000Z`).getUTCDay(), 0);
  assert.ok(!req.sanitizedUrl.includes('SECRETKEY'));
  assert.match(req.sanitizedUrl, /api_key=REDACTED/);
  const nl = buildNetLiquidityRequests(monday, 'SECRETKEY');
  assert.equal(nl[0].frequency, 'w');
  const kept = rejectFutureFredObservations(
    [{ date: '2026-01-04', value: '1' }, { date: '2026-01-05', value: '2' }],
    monday
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].date, '2026-01-04');
});

test('runtime vs historical missing', async () => {
  await assert.rejects(
    () => fetchWithRetryInjected('https://example.test', {}, {
      fetchImpl: async () => ({ status: 500, arrayBuffer: async () => new ArrayBuffer(0) }),
      sleepImpl: async () => {},
      maxRetries: 2,
    }),
    (err) => err instanceof XrRuntimeSourceError
  );
  const hist = missingResult('MISSING_CAPTURE');
  assert.equal(hist.kind, 'historical_missing');
  assert.equal(classifyMissingVsRuntime(new XrHistoricalMissingError('MISSING_CAPTURE')), 'historical_missing');
  assert.throws(() => requireFredApiKey({}), (err) => err instanceof XrRuntimeSourceError);
  assert.throws(
    () =>
      gitBlobExists('C', 'x', () => {
        throw new XrRuntimeSourceError('git spawn failed: ENOENT');
      }),
    (err) => err instanceof XrRuntimeSourceError
  );
  assert.throws(
    () =>
      gitBlobExists('C', 'x', () => {
        throw new XrRuntimeSourceError('fatal: not a git repository', { status: 128 });
      }),
    (err) => err instanceof XrRuntimeSourceError
  );
  assert.throws(
    () =>
      gitBlobExists('C', 'x', (args) => {
        if (args[0] === 'cat-file') {
          throw new XrRuntimeSourceError('fatal: bad object C', { status: 128 });
        }
        throw new Error('unexpected');
      }),
    (err) => err instanceof XrRuntimeSourceError
  );
  assert.equal(
    gitBlobExists('C', 'x', (args) => {
      if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
      throw new XrRuntimeSourceError("path 'x' exists on disk, but not in 'C'");
    }),
    false
  );
});

test('csv: RFC4180 LF final newline null TRUE/FALSE ordering', () => {
  const csv = serializeCsv(['a', 'b', 'c'], [
    { a: null, b: true, c: false },
    { a: 'x,y', b: 10, c: 1.5 },
  ]);
  assert.equal(csv.endsWith('\n'), true);
  assert.equal(csv.includes('\r'), false);
  assert.match(csv, /TRUE/);
  assert.match(csv, /FALSE/);
  assert.equal(formatCsvValue(null), '');
  const parsed = parseCsv(csv);
  assert.equal(parsed[1][0], '');
  assert.equal(parsed[2][0], 'x,y');
  const bridge = buildBridgeRows({
    observationDate: '2026-08-17',
    xrFactorScores: { trend_valuation: 50, stablecoins: null },
    productionFactorScores: { trend_valuation: 48, stablecoins: 40 },
    xrRoles: { trend_valuation: 'B_METHOD_PIT' },
    eligible: true,
    xrScore: 51,
    productionGScore: 49,
  });
  const sorted = sortBridgeRows(bridge);
  assert.equal(sorted.at(-1).factor_key, '__XR_COMPOSITE__');
  assert.equal(sorted[0].factor_key, 'trend_valuation');
});

test('missingness: deterministic factor list and reason enum', () => {
  assert.ok(MISSING_REASON_CODES.includes('MISSING_CAPTURE'));
  assert.ok(BRIDGE_COMPARISON_STATUS_ENUM.includes('COMPARABLE'));
  assert.equal(formatMissingFactors(['social_interest', 'trend_valuation']), 'trend_valuation;social_interest');
  const reason = firstMissingReason([
    { factor_key: 'trend_valuation', component_key: 'utc_intraday_snapshot', reconstruction_role: 'C_SURROGATE' },
    { factor_key: 'trend_valuation', component_key: 'bmsb_distance', reconstruction_role: 'MISSING', missing_reason: 'INSUFFICIENT_LOOKBACK' },
  ]);
  assert.equal(reason, 'trend_valuation:bmsb_distance:INSUFFICIENT_LOOKBACK');
  const elig = buildEligibility({
    factorAvailability: Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 'AVAILABLE_C'])),
    factorScores: Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 40])),
  });
  assert.equal(elig.xr_status, 'ELIGIBLE');
  assert.equal(elig.reconstruction_grade, 'EXPLORATORY_ONLY');
});

test('stage-b safety flags and output dir', () => {
  assert.throws(() => requireStageBFlags({}), /Stage B generation requires/);
  const args = parseArgs(['--analysis-source-sha', 'abc', '--output-dir', '/tmp/out', '--allow-network']);
  assert.equal(args.allowNetwork, true);
  assert.throws(() => assertSafeOutputDir('public/data', process.cwd()));
  assert.equal(assertAnalysisSourceSha.name, 'assertAnalysisSourceSha');
  const csv = previewCsv(['a'], [{ a: 1 }]);
  assert.equal(csv, 'a\n1\n');
});

test('contract-check: frozen blobs, 252 dates, no network/files/scores', () => {
  const result = runContractCheck();
  assert.equal(result.ok, true, JSON.stringify(result.h7Mismatches.concat(result.modelMismatches)));
  assert.equal(result.networkRequests, 0);
  assert.equal(result.filesWritten, 0);
  assert.equal(result.historicalScoreCalculations, 0);
  assert.equal(result.universe.ok, true);
  assert.equal(result.columnCounts.xr_observations, 25);
  assert.equal(result.columnCounts.xr_bridge_check, 8);
  assert.equal(result.caseACaptures['2026-08-18'].blobSha, '4b9c8a1cbc460081b02f633a53741b1ca2975770');
  assert.equal(result.bridgeProductionCaptures['2026-08-19'].blobSha, 'fca84aed72c35344706eed247dff7bfe04d934be');
  assert.equal(Object.keys(result.bridgeProductionCaptures).length, 3);
});

test('eligibility: available-but-nonfinite throws invariant', () => {
  const availability = Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 'AVAILABLE_B']));
  const scores = Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 40]));
  scores.macro_overlay = null;
  assert.throws(
    () => buildEligibility({ factorAvailability: availability, factorScores: scores }),
    (err) => err instanceof XrInvariantError
  );
});

test('ETF holiday calendar matches MODEL_SOURCE_SHA set', () => {
  assert.equal(US_MARKET_HOLIDAYS_UTC.has('2026-01-19'), true);
  assert.equal(US_MARKET_HOLIDAYS_UTC.has('2026-05-25'), true);
  assert.equal(getExpectedLatestUsTradingDay('2026-01-19T18:00:00.000Z'), '2026-01-16');
  assert.equal(getExpectedLatestUsTradingDay('2026-05-25T18:00:00.000Z'), '2026-05-22');
  assert.equal(getExpectedLatestUsTradingDay('2026-02-10T15:00:00.000Z'), '2026-02-09');
  assert.equal(getExpectedLatestUsTradingDay('2026-02-10T16:00:00.000Z'), '2026-02-10');
  assert.equal(isUtcWeekday('2026-01-17'), false);
  assert.equal(isUtcWeekday('2026-01-18'), false);
  assert.equal(isUtcWeekday('2026-01-19'), true);
  assert.equal(isUsTradingDay('2026-01-19'), false);
  assert.equal(isUtcWeekday('2026-01-16'), true);
  assert.equal(isUsTradingDay('2026-01-16'), true);
});

test('CASE A envelope and raw payloads keep prices unchanged', () => {
  const prices = [[1, 10], [2, 11], [3, 12]];
  const raw = validateCaseAChartVector({ prices });
  const env = validateCaseAChartVector({ cachedAt: '2026-08-17T11:29:00.000Z', data: { prices } });
  assert.equal(raw.ok, true);
  assert.equal(env.ok, true);
  assert.equal(env.envelope, true);
  assert.deepEqual(raw.vector, prices);
  assert.deepEqual(env.vector, prices);
  raw.vector[0][1] = 99;
  assert.equal(prices[0][1], 10);
  assert.equal(validateCaseAChartVector({ cachedAt: 'x', data: { prices: [[1, 'bad']] } }).ok, false);
  assert.equal(unwrapCoinGeckoCachePayload({ foo: 1 }).ok, false);
});

test('CASE B CoinGecko range is >90 days ending strictly before T', () => {
  const req = buildCoinGeckoHistoryRangeRequest('2026-06-01');
  assert.equal(req.spanDays, CASE_B_COINGECKO_LOOKBACK_DAYS);
  assert.equal(req.spanDays > 90, true);
  assert.equal(req.fromDate, '2026-02-21');
  assert.equal(req.toSec, Math.floor(Date.parse('2026-06-01T00:00:00.000Z') / 1000) - 1);
  const bounds = caseBCoinGeckoRangeBounds('2026-08-19');
  assert.equal(bounds.spanDays, 100);
});

test('CASE B required dates reject duplicates and missing values', () => {
  const T = '2099-03-10';
  const required = requiredCompletedSurrogateDates(T);
  assert.equal(required.length, 30);
  assert.equal(required[0], addUtcDays(T, -30));
  assert.equal(required.at(-1), addUtcDays(T, -1));
  const byDate = new Map(required.map((d, i) => [d, 100 + i]));
  const ok = buildCaseBSurrogateVector({
    observationDate: T,
    completedDailyByUtcDate: byDate,
    coinbaseProxyPrice: 200,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.vector.length, 31);
  byDate.delete(required[3]);
  assert.equal(
    buildCaseBSurrogateVector({
      observationDate: T,
      completedDailyByUtcDate: byDate,
      coinbaseProxyPrice: 200,
    }).reasonCode,
    'MISSING_REQUIRED_OBSERVATION'
  );
});

test('ETF frozen baseline extractor rejects malformed objects', () => {
  assert.equal(extractEtfRollingSumBaseline({ rollingSums: [{ date: '2026-01-16', sum: 10 }, { date: '2026-01-20', sum: 20 }] }).ok, true);
  assert.equal(extractEtfRollingSumBaseline({ rollingSums: [{ sum: 10 }, { sum: 20 }] }).ok, false);
  assert.equal(extractEtfRollingSumBaseline({ rollingSums: [] }).ok, false);
});

test('atomic finalize uses sibling staging and leaves no partial final dir', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-h71-test-'));
  const finalDir = path.join(parent, 'out');
  const files = Object.fromEntries(
    ['xr_observations.csv', 'xr_factor_lineage.csv', 'xr_missingness.csv', 'xr_bridge_check.csv', 'ANALYSIS_SOURCE_SHA.txt', 'PROTOCOL_VERSION.txt'].map(
      (n) => [n, `${n}\n`]
    )
  );
  finalizeAtomicOutputs(finalDir, files);
  for (const name of Object.keys(files)) {
    assert.equal(fs.readFileSync(path.join(finalDir, name), 'utf8'), files[name]);
  }
  assert.throws(() => finalizeAtomicOutputs(finalDir, files), /already exists/);
  const corruptDir = path.join(parent, 'corrupt');
  const corruptFs = {
    existsSync: (p) => fs.existsSync(p),
    mkdirSync: (p, opts) => fs.mkdirSync(p, opts),
    writeFileSync: (p, data, opts) => {
      if (String(p).endsWith('PROTOCOL_VERSION.txt')) {
        fs.writeFileSync(p, 'tampered\n', opts);
        return;
      }
      fs.writeFileSync(p, data, opts);
    },
    readFileSync: (p) => fs.readFileSync(p),
    readdirSync: (p) => fs.readdirSync(p),
    renameSync: (a, b) => fs.renameSync(a, b),
    rmSync: (p, opts) => fs.rmSync(p, opts),
  };
  assert.throws(
    () => finalizeAtomicOutputs(corruptDir, files, { fsImpl: corruptFs }),
    /staged bytes mismatch/
  );
  assert.equal(fs.existsSync(corruptDir), false);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('mocked end-to-end Stage-B orchestration is callable without HTTP', async () => {
  const date = '2099-03-03';
  const dates = [date];
  const scores = {
    trend_valuation: 36,
    stablecoins: 63,
    etf_flows: 43,
    net_liquidity: 59,
    term_leverage: 57,
    macro_overlay: 28,
    social_interest: 61,
  };
  const roles = {
    trend_valuation: 'C_SURROGATE',
    stablecoins: 'B_METHOD_PIT',
    etf_flows: 'B_METHOD_PIT',
    net_liquidity: 'C_PIT_CONSERVATIVE',
    term_leverage: 'C_SURROGATE',
    macro_overlay: 'C_PIT_CONSERVATIVE',
    social_interest: 'B_METHOD_PIT',
  };
  const availability = Object.fromEntries(
    OFFICIAL_FACTOR_ORDER.map((k) => [
      k,
      roles[k] === 'B_METHOD_PIT' ? 'AVAILABLE_B' : 'AVAILABLE_C',
    ])
  );
  const lineage = [];
  for (const factorKey of OFFICIAL_FACTOR_ORDER) {
    for (const componentKey of FACTOR_COMPONENT_ORDER[factorKey]) {
      lineage.push(
        presentComp(date, factorKey, componentKey, roles[factorKey], {
          source_name: 'synthetic',
          notes:
            factorKey === 'stablecoins'
              ? 'capture_commit=aa;capture_blob=bb;first_parent=cc;baseline_blob=dd'
              : factorKey === 'net_liquidity'
                ? 'request=https://api.stlouisfed.org/fred/series/observations?api_key=REDACTED;sha256=abc'
                : '',
        })
      );
    }
  }
  const clock = {
    valid: true,
    reconstruction_as_of_utc: '2099-03-03T11:30:00.000Z',
    reconstruction_clock_source: 'FIXED_1130_UTC',
  };
  const one = assembleDateRecords({
    observationDate: date,
    clock,
    factorScores: scores,
    factorRoles: roles,
    factorAvailability: availability,
    lineage,
  });
  assert.equal(one.eligibility.xr_status, 'ELIGIBLE');
  assert.equal(one.eligibility.eligible_full_composite, true);
  assert.equal(one.eligibility.missing_factor_count, 0);
  assert.equal(one.eligibility.missing_factors, '');
  assert.equal(one.eligibility.reconstruction_grade, 'EXPLORATORY_ONLY');
  assert.equal(one.observation.xr_score, 48);
  assert.equal(blendOfficialComposite(scores), 48);
  for (const key of OFFICIAL_FACTOR_ORDER) {
    assert.equal(Number.isFinite(one.factorScores[key]), true);
    assert.equal(['AVAILABLE_B', 'AVAILABLE_C'].includes(one.missingness[FACTOR_AVAIL_FIELDS[key]]), true);
  }
  const production = {
    factorScores: {
      trend_valuation: 40,
      stablecoins: 60,
      etf_flows: 40,
      net_liquidity: 50,
      term_leverage: 50,
      macro_overlay: 30,
      social_interest: 60,
    },
    gScore: 47,
  };
  const assembled = assembleStageBOutputSet({
    dates,
    reconstructions: [one],
    analysisSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    productionByDate: { [date]: production },
    frozenUniverse: false,
  });
  assert.equal(assembled.bridge.filter((r) => r.factor_key !== '__XR_COMPOSITE__').length, 7);
  assert.equal(assembled.bridge.filter((r) => r.factor_key === '__XR_COMPOSITE__').length, 1);
  assert.equal(
    assembled.bridge.find((r) => r.factor_key === 'trend_valuation').difference,
    36 - 40
  );
  assert.match(assembled.files['xr_factor_lineage.csv'], /first_parent=cc/);
  assert.match(assembled.files['xr_factor_lineage.csv'], /api_key=REDACTED/);
  assert.equal(
    assembled.files['ANALYSIS_SOURCE_SHA.txt'],
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'
  );
  assert.equal(assembled.files['PROTOCOL_VERSION.txt'], `${H7_PROTOCOL_VERSION}\n`);
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-h71-e2e-'));
  const outputDir = path.join(parent, 'xr-out');
  try {
    finalizeAtomicOutputs(outputDir, assembled.files);
    assert.equal(fs.existsSync(path.join(outputDir, 'xr_observations.csv')), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('synthetic one-factor MISSING is NOT_ELIGIBLE without renormalization', () => {
  const date = '2099-03-04';
  const scores = {
    trend_valuation: 36,
    stablecoins: 63,
    etf_flows: 43,
    net_liquidity: 59,
    term_leverage: 57,
    macro_overlay: 28,
    social_interest: null,
  };
  const roles = {
    trend_valuation: 'C_SURROGATE',
    stablecoins: 'B_METHOD_PIT',
    etf_flows: 'B_METHOD_PIT',
    net_liquidity: 'C_PIT_CONSERVATIVE',
    term_leverage: 'C_SURROGATE',
    macro_overlay: 'C_PIT_CONSERVATIVE',
    social_interest: 'MISSING',
  };
  const availability = Object.fromEntries(
    OFFICIAL_FACTOR_ORDER.map((k) => [k, k === 'social_interest' ? 'MISSING' : 'AVAILABLE_C'])
  );
  availability.stablecoins = 'AVAILABLE_B';
  availability.etf_flows = 'AVAILABLE_B';
  const lineage = [];
  for (const factorKey of OFFICIAL_FACTOR_ORDER) {
    for (const componentKey of FACTOR_COMPONENT_ORDER[factorKey]) {
      if (factorKey === 'social_interest') {
        lineage.push(missingComp(date, factorKey, componentKey, 'NO_BITCOIN_RANK'));
      } else {
        lineage.push(presentComp(date, factorKey, componentKey, roles[factorKey], { source_name: 'synthetic' }));
      }
    }
  }
  const one = assembleDateRecords({
    observationDate: date,
    clock: {
      valid: true,
      reconstruction_as_of_utc: '2099-03-04T11:30:00.000Z',
      reconstruction_clock_source: 'FIXED_1130_UTC',
    },
    factorScores: scores,
    factorRoles: roles,
    factorAvailability: availability,
    lineage,
  });
  assert.equal(one.observation.xr_status, 'NOT_ELIGIBLE');
  assert.equal(one.observation.xr_score, '');
  assert.equal(one.observation.reconstruction_grade, '');
  assert.equal(one.observation.missing_factor_count, 1);
  assert.equal(one.observation.missing_factors, 'social_interest');
  assert.equal(one.observation.eligible_full_composite, false);
  const bridge = buildBridgeRows({
    observationDate: date,
    xrFactorScores: scores,
    productionFactorScores: { trend_valuation: 10 },
    xrRoles: roles,
    eligible: false,
    xrScore: null,
    productionGScore: 40,
  });
  assert.equal(bridge.some((r) => r.factor_key === '__XR_COMPOSITE__'), false);
});

test('Trend B-island reconstruction path uses finite daily closes', () => {
  const observationDate = '2026-08-17';
  const asOfUtc = '2026-08-17T11:30:00.000Z';
  const lines = ['date_utc,close_usd'];
  for (let i = 250; i >= 1; i--) {
    lines.push(`${addUtcDays(observationDate, -i)},100`);
  }
  const historyRows = parseBtcPriceHistoryCsv(`${lines.join('\n')}\n`);
  const island = { historyRows, snapshotPrice: 110 };
  const series = reconstructTrendIslandSeries(island, asOfUtc);
  assert.equal(series.dailyCloses.every(Number.isFinite), true);
  assert.equal(series.dailyCloses.length >= 200, true);
  assert.equal(series.weeklyCloses.every((w) => Number.isFinite(w.close)), true);
  assert.equal(series.weeklyCloses.length >= 22, true);
  const result = scoreTrendComponents({
    snapshotPrice: 110,
    dailyCloses: series.dailyCloses,
    weeklyCloses: series.weeklyCloses,
  });
  assert.equal(Number.isFinite(result.factorScore), true);
});

test('Trend B-island resolver uses frozen identities with synthetic CSV', () => {
  const expected = TREND_B_ISLAND_CAPTURES['2026-08-17'];
  const lines = ['date_utc,close_usd'];
  for (let i = 250; i >= 1; i--) {
    lines.push(`${addUtcDays('2026-08-17', -i)},100`);
  }
  const csv = `${lines.join('\n')}\n`;
  const latest = {
    price_kind: 'utc_intraday_snapshot',
    snapshot_date: '2026-08-17',
    btc: { spot_usd: 110 },
  };
  const gitExec = (args) => {
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    if (args[0] === 'rev-parse' && String(args[1]).includes(GIT_PATHS.latestJson)) {
      return Buffer.from(`${expected.latestJsonBlobSha}\n`);
    }
    if (args[0] === 'rev-parse' && String(args[1]).includes(GIT_PATHS.priceHistoryCsv)) {
      return Buffer.from(`${expected.btcPriceHistoryBlobSha}\n`);
    }
    if (args[0] === 'show' && String(args[1]).includes(GIT_PATHS.latestJson)) {
      return Buffer.from(JSON.stringify(latest));
    }
    if (args[0] === 'show' && String(args[1]).includes(GIT_PATHS.priceHistoryCsv)) {
      return Buffer.from(csv);
    }
    throw new XrRuntimeSourceError(`path '${args[1] || ''}' exists on disk, but not in '${expected.latestJsonCommitSha}'`);
  };
  const island = resolveTrendBIsland('2026-08-17', gitExec);
  assert.equal(island.ok, true);
  const series = reconstructTrendIslandSeries(island, '2026-08-17T11:30:00.000Z');
  assert.equal(series.dailyCloses.every(Number.isFinite), true);
  const scored = scoreTrendComponents({
    snapshotPrice: island.snapshotPrice,
    dailyCloses: series.dailyCloses,
    weeklyCloses: series.weeklyCloses,
  });
  assert.equal(Number.isFinite(scored.factorScore), true);
});

test('ETF frozen baseline weekday filter keeps holiday Monday and drops weekend', () => {
  const extracted = extractEtfRollingSumBaseline({
    rollingSums: [
      { date: '2026-01-16', sum: 11 },
      { date: '2026-01-17', sum: 12 },
      { date: '2026-01-18', sum: 13 },
      { date: '2026-01-19', sum: 14 },
      { date: '2026-01-20', sum: 15 },
    ],
  });
  assert.equal(extracted.ok, true);
  assert.deepEqual(extracted.values, [11, 14, 15]);
});

test('production factors array extraction recovers all seven scores and composite', () => {
  const raw = {
    composite_score: 47,
    factors: [
      { key: 'trend_valuation', score: 46 },
      { key: 'stablecoins', score: 50 },
      { key: 'etf_flows', score: 40 },
      { key: 'net_liquidity', score: 30 },
      { key: 'term_leverage', score: 55 },
      { key: 'macro_overlay', score: 20 },
      { key: 'social_interest', score: 70 },
    ],
  };
  const extracted = extractProductionFactorScores(raw);
  assert.equal(extracted.gScore, 47);
  assert.equal(extracted.factorScores.trend_valuation, 46);
  assert.equal(extracted.factorScores.stablecoins, 50);
  assert.equal(extracted.factorScores.etf_flows, 40);
  assert.equal(extracted.factorScores.net_liquidity, 30);
  assert.equal(extracted.factorScores.term_leverage, 55);
  assert.equal(extracted.factorScores.macro_overlay, 20);
  assert.equal(extracted.factorScores.social_interest, 70);
  const bridge = buildBridgeRows({
    observationDate: '2026-08-19',
    xrFactorScores: extracted.factorScores,
    productionFactorScores: extracted.factorScores,
    xrRoles: Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 'B_METHOD_PIT'])),
    eligible: true,
    xrScore: 47,
    productionGScore: 47,
  });
  assert.equal(bridge.filter((r) => r.factor_key !== '__XR_COMPOSITE__').length, 7);
  assert.equal(bridge.find((r) => r.factor_key === 'trend_valuation').difference, 0);
  const missingProd = extractProductionFactorScores({
    composite_score: 47,
    factors: [{ key: 'trend_valuation', score: 46 }],
  });
  const missingBridge = buildBridgeRows({
    observationDate: '2026-08-17',
    xrFactorScores: {
      trend_valuation: 10,
      stablecoins: 20,
      etf_flows: 30,
      net_liquidity: 40,
      term_leverage: 50,
      macro_overlay: 60,
      social_interest: 70,
    },
    productionFactorScores: missingProd.factorScores,
    xrRoles: Object.fromEntries(OFFICIAL_FACTOR_ORDER.map((k) => [k, 'B_METHOD_PIT'])),
    eligible: false,
    xrScore: null,
    productionGScore: 47,
  });
  assert.equal(
    missingBridge.find((r) => r.factor_key === 'stablecoins').comparison_status,
    'PRODUCTION_MISSING'
  );
  assert.equal(missingBridge.some((r) => r.factor_key === '__XR_COMPOSITE__'), false);
});

test('Aug19 bridge production artifact does not alter FIXED_1130_UTC clock', () => {
  const clock = selectReconstructionClock({
    observationDate: '2026-08-19',
    dailyRow: { selection_status: 'NO_DAILY_PRIMARY' },
    rawArtifact: {
      as_of_utc: '2026-08-19T16:45:00.000Z',
      updated_at: '2026-08-19T16:45:00.000Z',
      composite_score: 47,
      factors: [{ key: 'trend_valuation', score: 46 }],
    },
  });
  assert.equal(clock.reconstruction_clock_source, 'FIXED_1130_UTC');
  assert.equal(clock.reconstruction_as_of_utc, '2026-08-19T11:30:00.000Z');
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-17'].blobSha, TREND_B_ISLAND_CAPTURES['2026-08-17'].latestJsonBlobSha);
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-18'].blobSha, TREND_B_ISLAND_CAPTURES['2026-08-18'].latestJsonBlobSha);
  assert.equal(BRIDGE_PRODUCTION_CAPTURES['2026-08-19'].blobSha, TREND_B_ISLAND_CAPTURES['2026-08-19'].latestJsonBlobSha);
});

test('Coinbase retained history uses production 730-day cutoff', () => {
  const asOfUtc = '2099-06-01T11:30:00.000Z';
  const cutoff = coinbaseRetainedHistoryCutoffDate(asOfUtc);
  assert.equal(cutoff, addUtcDays('2099-06-01', -DEFAULT_BACKFILL_DAYS));
  const rows = [];
  for (let i = 800; i >= 1; i--) {
    const date = addUtcDays('2099-06-01', -i);
    rows.push({ date_utc: date, close: 100, close_usd: 100 });
  }
  const retained = retainCoinbaseHistoryWindow(rows, asOfUtc);
  assert.equal(retained[0].date_utc >= cutoff, true);
  assert.equal(retained.some((r) => r.date_utc < cutoff), false);
  assert.equal(retained.length < rows.length, true);
});

test('first-parent Git runtime failure is not historical missing', () => {
  const root = gitFirstParent('ROOT', (args) => {
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    if (args[0] === 'rev-list' && args.includes('--parents')) return Buffer.from('ROOT\n');
    throw new XrRuntimeSourceError('unexpected');
  });
  assert.equal(root, null);
  assert.throws(
    () =>
      gitFirstParent('C', (args) => {
        if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
        throw new XrRuntimeSourceError('fatal: bad object C', { status: 128 });
      }),
    (err) => err instanceof XrRuntimeSourceError
  );
  assert.throws(
    () =>
      findIntroductionCandidates('public/data/cache/stablecoins/2026-01-02.json', (args) => {
        if (args[0] === 'log') return Buffer.from('C1\n');
        if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
        if (args[0] === 'rev-parse') return Buffer.from('blob\n');
        if (args[0] === 'rev-list') {
          throw new XrRuntimeSourceError('fatal: not a git repository', { status: 128 });
        }
        throw new XrRuntimeSourceError('unexpected');
      }),
    (err) => err instanceof XrRuntimeSourceError && /not a git repository/i.test(err.message)
  );
});

test('finalizeFactorRecords preserves valid snapshot when history is insufficient', () => {
  const recs = [
    presentComp('2099-01-01', 'trend_valuation', 'utc_intraday_snapshot', 'C_SURROGATE', {
      source_name: 'coinbase_5m',
      external_snapshot_sha256: 'abc123',
    }),
    presentComp('2099-01-01', 'trend_valuation', 'bmsb_distance', 'C_CURRENT_HISTORY', {
      source_name: 'coinbase_daily',
    }),
    presentComp('2099-01-01', 'trend_valuation', 'mayer_stretch', 'C_CURRENT_HISTORY', {
      source_name: 'coinbase_daily',
    }),
    presentComp('2099-01-01', 'trend_valuation', 'weekly_rsi', 'C_CURRENT_HISTORY', {
      source_name: 'coinbase_daily',
    }),
  ];
  const fin = finalizeFactorRecords(recs, { scores: null, reasonCode: 'INSUFFICIENT_LOOKBACK' }, 'trend_valuation');
  assert.equal(fin.availability, 'MISSING');
  assert.equal(fin.records[0].reconstruction_role, 'C_SURROGATE');
  assert.equal(fin.records[0].external_snapshot_sha256, 'abc123');
  assert.equal(fin.records[1].reconstruction_role, 'MISSING');
  assert.equal(fin.records[1].missing_reason, 'INSUFFICIENT_LOOKBACK');
});

test('runStageBGeneration has no identity or date-universe bypass', async () => {
  await assert.rejects(
    () => runStageBGeneration({ analysisSourceSha: 'abc', outputDir: '/tmp/x', allowNetwork: false }),
    /allow-network/
  );
  const src = runStageBGeneration.toString();
  assert.equal(src.includes('skipIdentityGuards'), false);
  assert.equal(src.includes('observationDates'), false);
  assert.equal(src.includes('requireFrozenUniverse'), false);
});
