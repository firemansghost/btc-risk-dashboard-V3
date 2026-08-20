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
} from '../lib/xr-reconstruction-core.mjs';
import {
  buildAlfredRequest,
  buildNetLiquidityRequests,
  requireFredApiKey,
  fetchWithRetryInjected,
  findIntroductionCandidates,
  gitBlobExists,
  resolveFirstIntroduction,
  resolveStablecoinCapture,
  sanitizeFredUrl,
  XrRuntimeSourceError,
  XrHistoricalMissingError,
  classifyMissingVsRuntime,
  missingResult,
} from '../lib/xr-source-adapters.mjs';
import {
  runContractCheck,
  parseArgs,
  requireStageBFlags,
  assertSafeOutputDir,
  assertAnalysisSourceSha,
  previewCsv,
} from '../build-xr-reconstruction.mjs';

test('identity: frozen H7 blobs and MODEL_CODE_BLOBS are populated', () => {
  assert.equal(Object.keys(FROZEN_H7_BLOBS).length, 5);
  assert.equal(FROZEN_H7_BLOBS['docs/H7_EXPLORATORY_RECONSTRUCTION_PROTOCOL_2026-08-19.md'],
    'be3843fda42c1db85c6616cc8351c765d3bc4555');
  assert.equal(MODEL_SOURCE_SHA, '6b2fa9cf56ce738c74c8da6de0f5a972858f8a52');
  assert.equal(MODEL_CODE_BLOBS['scripts/etl/factors.mjs'],
    'e9fd06df79967f0041a901e2dd971b771e669b03');
  assert.equal(Object.keys(MODEL_CODE_BLOBS).length, 15);
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
  // distance 10 → percentile 70 → trend logistic ≈ 57
  assert.equal(result.scores.bmsb_distance, 57);
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
  const result = scoreEtfComponents({
    html,
    asOfUtc: '2026-02-20T18:00:00.000Z',
  });
  assert.ok(Number.isFinite(result.factorScore));
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
  assert.ok(Number.isFinite(result.factorScore));
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
  assert.ok(Number.isFinite(result.factorScore));
});

test('golden: term_leverage synthetic', () => {
  const fundingRates = Array.from({ length: 30 }, (_, i) => ({ rate: 0.01 * (i + 1) }));
  const spotPrices = Array.from({ length: 31 }, (_, i) => 100 + i);
  const result = scoreTermComponents({ fundingRates, spotPrices });
  assert.ok(Number.isFinite(result.factorScore));
});

test('golden: social_interest synthetic', () => {
  assert.equal(scoreSocialTrendingRank(1), 85);
  assert.equal(scoreSocialTrendingRank(5), 70);
  assert.equal(scoreSocialTrendingRank(10), 55);
  assert.equal(scoreSocialTrendingRank(20), 35);
  const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
  const result = scoreSocialComponents({ bitcoinRank: 2, prices });
  assert.ok(Number.isFinite(result.factorScore));
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
    const cmd = args.join(' ');
    if (cmd.startsWith('log --diff-filter=A')) return Buffer.from('C1\n');
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
    if (args[0] === 'log') return Buffer.from('C1\nC2\n');
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
    (err) => err instanceof XrRuntimeSourceError && /spawn failed/.test(err.message)
  );
  assert.equal(
    gitBlobExists('C', 'x', () => {
      throw new XrRuntimeSourceError('path does not exist in C', { status: 128 });
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
});
