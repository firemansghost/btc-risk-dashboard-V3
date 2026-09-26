import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  MIN_STABLECOIN_WEIGHT_COVERAGE,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
  buildValidStablecoinGrowthSnapshot,
} from '../factors/stablecoinGrowthAggregation.mjs';
import {
  DAY_MS,
  PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
  R07_COMPARATOR_ID,
  R07_SCORE_CALIBRATION_ID,
  R07_SCHEMA,
  analyzeElapsedCoin,
  analyzePositionalCoin,
  buildElapsedStablecoinGrowthSnapshot,
  buildR07Report,
  percentileRank,
  riskFromPercentile,
  scoreStablecoinFactor,
} from '../../research/lib/r07-stablecoin-elapsed-time.mjs';
import { runR07StablecoinElapsedTimeDiagnostic } from '../../research/diagnose-r07-stablecoin-elapsed-time.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github/workflows/r07-stablecoin-elapsed-time-diagnostic.yml');
const CACHE_DIR = path.join(REPO_ROOT, 'public/data/cache/stablecoins');
const BASELINE_PATH = path.join(REPO_ROOT, 'public/data/stablecoins-historical.json');
const LATEST_PATH = path.join(REPO_ROOT, 'public/data/latest.json');
const FIXED_SHA = '4bd9d7197319bdcaac09cd0a50c91513afde7075';
const FIXED_GENERATED_AT = '2026-09-26T18:00:00.000Z';

function dailyCaps({ startMs, days, startCap = 100, delta = 1 }) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    out.push([startMs + i * DAY_MS, startCap + i * delta]);
  }
  return out;
}

function sevenResponses(builder) {
  return PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin, index) => ({
    market_caps: builder(coin, index),
  }));
}

test('production config snapshot matches the verified seven-coin order and weights', () => {
  assert.deepEqual(
    PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin) => [
      coin.id,
      coin.symbol,
      coin.weight,
      coin.cmcId,
    ]),
    [
      ['tether', 'USDT', 0.55, '825'],
      ['usd-coin', 'USDC', 0.25, '3408'],
      ['dai', 'DAI', 0.05, '4943'],
      ['binance-usd', 'BUSD', 0.03, '4687'],
      ['true-usd', 'TUSD', 0.02, '2563'],
      ['frax', 'FRAX', 0.02, '6952'],
      ['liquity-usd', 'LUSD', 0.01, '9566'],
    ]
  );
});

test('current positional selection on clean daily timestamps uses exact index semantics', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const caps = dailyCaps({ startMs: start, days: 40, startCap: 1000, delta: 10 });
  const positional = analyzePositionalCoin('USDT', caps);
  assert.equal(positional.ok, true);
  assert.equal(positional.endpoint_original_index, 39);
  assert.equal(positional.positional_7d_prior_index, 33);
  assert.equal(positional.positional_30d_prior_index, 10);
  // Existing production index math is length-7 / length-30, which is 6 / 29 daily steps.
  assert.equal(positional.positional_7d_elapsed_hours, 6 * 24);
  assert.equal(positional.positional_30d_elapsed_hours, 29 * 24);
  assert.equal(positional.change7d, (caps[39][1] - caps[33][1]) / caps[33][1]);
  assert.equal(positional.change30d, (caps[39][1] - caps[10][1]) / caps[10][1]);

  const finiteCaps = caps.map(([, cap]) => cap).filter((cap) => Number.isFinite(cap));
  assert.equal(finiteCaps.length, 40);
  assert.equal(
    positional.change7d,
    (finiteCaps[finiteCaps.length - 1] - finiteCaps[finiteCaps.length - 7]) / finiteCaps[finiteCaps.length - 7]
  );
  assert.equal(
    positional.change30d,
    (finiteCaps[finiteCaps.length - 1] - finiteCaps[finiteCaps.length - 30]) / finiteCaps[finiteCaps.length - 30]
  );
});

test('timestamp-aware comparator selects latest observation at or before target and never after', () => {
  const endpoint = Date.parse('2026-02-10T00:00:00.000Z');
  const caps = [
    [endpoint - 10 * DAY_MS, 100],
    [endpoint - 8 * DAY_MS, 110],
    [endpoint - 7 * DAY_MS + 3_600_000, 120], // 1h after 7d target — must not be selected
    [endpoint - 6 * DAY_MS, 130],
    [endpoint, 140],
  ];
  const elapsed = analyzeElapsedCoin('USDT', caps);
  assert.equal(elapsed.ok, false);
  assert.equal(elapsed.horizon_7d.available, true);
  assert.equal(elapsed.horizon_7d.selected_prior_timestamp_ms, endpoint - 8 * DAY_MS);
  assert.ok(elapsed.horizon_7d.selected_prior_timestamp_ms <= endpoint - 7 * DAY_MS);
  assert.ok(elapsed.horizon_7d.selected_prior_timestamp_ms !== endpoint - 7 * DAY_MS + 3_600_000);
  assert.equal(elapsed.horizon_30d.available, false);
  assert.equal(elapsed.horizon_30d.reason, 'missing_at_or_before_30d_target');
  assert.equal(elapsed.comparator_id, R07_COMPARATOR_ID);
  assert.equal(elapsed.successor_rule_authorized, false);
});

test('missing at-or-before target produces unavailable without interpolation', () => {
  const endpoint = Date.parse('2026-03-01T00:00:00.000Z');
  const caps = [
    [endpoint - 3 * DAY_MS, 100],
    [endpoint, 110],
  ];
  const elapsed = analyzeElapsedCoin('USDC', caps);
  assert.equal(elapsed.ok, false);
  assert.equal(elapsed.horizon_7d.available, false);
  assert.equal(elapsed.horizon_30d.available, false);
  assert.equal(elapsed.change7d, null);
  assert.equal(elapsed.change30d, null);
});

test('irregular spacing reports selected timestamp and elapsed age', () => {
  const endpoint = Date.parse('2026-04-01T00:00:00.000Z');
  const caps = dailyCaps({ startMs: endpoint - 40 * DAY_MS, days: 41, startCap: 200 });
  caps[caps.length - 7] = [endpoint - 10 * DAY_MS, caps[caps.length - 7][1]]; // stretch positional 7d gap
  const positional = analyzePositionalCoin('DAI', caps);
  assert.equal(positional.ok, true);
  assert.notEqual(positional.positional_7d_elapsed_hours, 7 * 24);
  assert.equal(positional.positional_7d_elapsed_hours, 10 * 24);
});

test('duplicate timestamps are reported deterministically', () => {
  const endpoint = Date.parse('2026-05-01T00:00:00.000Z');
  const caps = [
    [endpoint - 30 * DAY_MS, 100],
    [endpoint - 7 * DAY_MS, 110],
    [endpoint - 7 * DAY_MS, 111],
    [endpoint, 120],
  ];
  const elapsed = analyzeElapsedCoin('TUSD', caps);
  assert.equal(elapsed.diagnostics.duplicate_timestamps, 1);
  assert.equal(elapsed.horizon_7d.selected_original_index, 2);
  assert.equal(elapsed.horizon_7d.selected_prior_cap, 111);
});

test('out-of-order timestamps are reported', () => {
  const endpoint = Date.parse('2026-06-01T00:00:00.000Z');
  const caps = [
    [endpoint - 10 * DAY_MS, 100],
    [endpoint - 20 * DAY_MS, 90],
    [endpoint, 120],
  ];
  const elapsed = analyzeElapsedCoin('FRAX', caps);
  assert.equal(elapsed.diagnostics.out_of_order_timestamps, 1);
  assert.equal(elapsed.endpoint_timestamp_ms, endpoint);
});

test('invalid and non-positive caps are handled explicitly', () => {
  const endpoint = Date.parse('2026-07-01T00:00:00.000Z');
  const caps = [
    [endpoint - 30 * DAY_MS, 100],
    [Number.NaN, 105],
    [endpoint - 7 * DAY_MS, Number.POSITIVE_INFINITY],
    [endpoint - 3 * DAY_MS, 0],
    [endpoint - 2 * DAY_MS, -5],
    [endpoint, 110],
  ];
  const elapsed = analyzeElapsedCoin('LUSD', caps);
  assert.equal(elapsed.diagnostics.invalid_timestamps, 1);
  assert.equal(elapsed.diagnostics.non_finite_caps, 1);
  assert.equal(elapsed.diagnostics.non_positive_caps, 2);
  assert.equal(elapsed.ok, true);
});

test('minimum valid-coin count remains 3 and weight coverage remains 70%', () => {
  assert.equal(MIN_VALID_STABLECOIN_GROWTH_COINS, 3);
  assert.equal(MIN_STABLECOIN_WEIGHT_COVERAGE, 0.7);
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const good = dailyCaps({ startMs: start, days: 35, startCap: 1000 });
  const responses = sevenResponses((_coin, index) => (index < 2 ? good : []));
  const elapsed = buildElapsedStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  assert.equal(elapsed.ok, false);
  assert.equal(elapsed.reason, 'insufficient_valid_stablecoin_growth_inputs');
  assert.ok(elapsed.valid.length < 3);
});

test('candidate aggregation renormalizes included weights', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const responses = sevenResponses((coin) =>
    dailyCaps({
      startMs: start,
      days: 40,
      startCap: coin.symbol === 'USDT' ? 1000 : 500,
      delta: coin.symbol === 'USDT' ? 5 : 1,
    })
  );
  responses[3] = null; // BUSD missing (weight 0.03); remaining configured weights sum to 0.90
  const elapsed = buildElapsedStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  assert.equal(elapsed.ok, true);
  assert.ok(Math.abs(elapsed.includedWeightSum - 0.9) < 1e-12);
  const expected = elapsed.valid.reduce((sum, coin) => sum + coin.change30d * coin.weight, 0) / elapsed.includedWeightSum;
  assert.equal(elapsed.aggregateChange, expected);
});

test('aligned-timestamp fixture can produce equal current and candidate semantics', () => {
  const endpoint = Date.parse('2026-02-10T00:00:00.000Z');
  const alignedCaps = (startCap) => {
    const caps = [];
    for (let i = 0; i < 30; i += 1) {
      let ts;
      if (i === 0) ts = endpoint - 30 * DAY_MS;
      else if (i === 23) ts = endpoint - 7 * DAY_MS;
      else if (i === 29) ts = endpoint;
      else if (i < 23) ts = endpoint - 30 * DAY_MS + i * DAY_MS;
      else ts = endpoint - (30 - i) * DAY_MS;
      caps.push([ts, startCap + i]);
    }
    return caps;
  };
  const responses = sevenResponses((_coin, index) => alignedCaps(1000 + index * 10));
  const current = buildValidStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  const elapsed = buildElapsedStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  assert.equal(current.ok, true);
  assert.equal(elapsed.ok, true);
  assert.equal(current.aggregateChange, elapsed.aggregateChange);
  assert.equal(current.recentMomentum, elapsed.recentMomentum);
});

test('irregular fixture can produce measurable divergence', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const responses = sevenResponses((_coin, index) => {
    const caps = dailyCaps({ startMs: start, days: 40, startCap: 1000 + index * 10, delta: 2 });
    // Stretch the positional -7 observation earlier so elapsed picks a different prior.
    caps[caps.length - 7] = [caps[caps.length - 1][0] - 10 * DAY_MS, caps[caps.length - 7][1]];
    return caps;
  });
  const current = buildValidStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  const elapsed = buildElapsedStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  assert.equal(current.ok, true);
  assert.equal(elapsed.ok, true);
  assert.notEqual(current.recentMomentum, elapsed.recentMomentum);
});

test('common-baseline score comparison uses identical calibration for both sides', () => {
  const changeSeries = [0.01, 0.02, 0.03, 0.04, 0.05];
  const valid = [{ marketCap: 100 }, { marketCap: 50 }];
  const left = scoreStablecoinFactor({
    aggregateChange: 0.03,
    recentMomentum: 0.4,
    validCoins: valid,
    changeSeries,
  });
  const right = scoreStablecoinFactor({
    aggregateChange: 0.03,
    recentMomentum: 0.4,
    validCoins: valid,
    changeSeries,
  });
  assert.equal(left.calibration, R07_SCORE_CALIBRATION_ID);
  assert.deepEqual(left, right);
  assert.equal(left.momentumScore, 70);
  assert.equal(percentileRank(changeSeries, 0.03), 0.6);
  assert.equal(riskFromPercentile(0.6, { invert: true, k: 3 }), riskFromPercentile(0.4, { invert: false, k: 3 }));
});

test('report schema keeps authorization and network flags closed', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const responses = sevenResponses((_coin, index) =>
    dailyCaps({ startMs: start, days: 35, startCap: 1000 + index, delta: 1 })
  );
  const report = buildR07Report({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    productionIdentity: {
      model_version: 'v1.1.2',
      implementation_revision: 'etf-sosovalue-vix-cboe-2026-09',
      ssot_version: '2.1.1',
    },
    baselineDocument: { lastUpdated: FIXED_GENERATED_AT, dataPoints: 3, changeSeries: [0.01, 0.02, 0.03] },
    baselineBytes: Buffer.from('{"changeSeries":[0.01,0.02,0.03]}'),
    cacheEntries: [{ filename: '2026-01-01.json', responses, bytes: Buffer.from('[]') }],
  });
  assert.equal(report.schema, R07_SCHEMA);
  assert.equal(report.mode, 'READ_ONLY');
  assert.equal(report.r07_status, 'DIAGNOSTIC_ONLY');
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.successor_rule_authorized, false);
  assert.equal(report.provider_network_performed, false);
  assert.equal(report.repository_write_performed, false);
  assert.equal(report.h8_data_used_for_tuning, false);
  assert.equal(report.adjudication_required, true);
  assert.equal(report.automatic_materiality_threshold, null);
  assert.equal(report.summary.automatic_materiality_threshold, null);
  assert.equal(report.elapsed_time_comparator.id, R07_COMPARATOR_ID);
  assert.equal(report.elapsed_time_comparator.successor_rule_authorized, false);
});

test('repository-local report path is refused and no file is created', async () => {
  const reportPath = path.join(REPO_ROOT, 'r07-should-not-exist.json');
  await assert.rejects(
    () => runR07StablecoinElapsedTimeDiagnostic({
      repositorySha: FIXED_SHA,
      reportPath,
      generatedAtUtc: FIXED_GENERATED_AT,
    }),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  assert.equal(fs.existsSync(reportPath), false);
});

test('workflow is manual read-only only and never writes the repository', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(workflow.includes('\npush:'), false);
  assert.equal(workflow.includes('pull_request:'), false);
  assert.equal(workflow.includes('schedule:'), false);
  assert.equal(workflow.includes('secrets.'), false);
  assert.equal(workflow.includes('git add'), false);
  assert.equal(workflow.includes('git commit'), false);
  assert.equal(workflow.includes('git push'), false);
  assert.equal(workflow.includes('daily-etl'), false);
  assert.equal(workflow.includes('etl:compute'), false);
  assert.equal(workflow.includes('capture-h8'), false);
  assert.equal(workflow.includes('capture-sosovalue-etf'), false);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /Require origin\/main before diagnostic/);
  assert.match(workflow, /Require origin\/main after diagnostic/);
  assert.match(workflow, /git status --porcelain --untracked-files=all/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /RUNNER_TEMP\/r07-stablecoin-elapsed-time-diagnostic-report\.json/);
});

test('latest current positional aggregate matches committed latest.json pct_change_30d within tolerance', () => {
  const latest = JSON.parse(fs.readFileSync(LATEST_PATH, 'utf8'));
  const factor = latest.factors.find((row) => row.key === 'stablecoins');
  const expectedPct = factor.metrics.pct_change_30d;
  const names = fs.readdirSync(CACHE_DIR).filter((name) => name.endsWith('.json')).sort();
  const latestCacheName = names.at(-1);
  const responses = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, latestCacheName), 'utf8'));
  const current = buildValidStablecoinGrowthSnapshot(PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT, responses);
  assert.equal(current.ok, true);
  const reconstructedPct = current.aggregateChange * 100;
  assert.ok(
    Math.abs(reconstructedPct - expectedPct) <= 1e-9,
    `expected ${expectedPct}, got ${reconstructedPct} from ${latestCacheName}`
  );
});

test('diagnostic CLI smoke against temp fixtures stays deterministic for fixed inputs', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r07-diag-'));
  const cacheDir = path.join(directory, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const responses = sevenResponses((_coin, index) =>
    dailyCaps({ startMs: start, days: 35, startCap: 1000 + index, delta: 1 })
  );
  fs.writeFileSync(path.join(cacheDir, '2026-02-05.json'), `${JSON.stringify(responses)}\n`);
  const baselinePath = path.join(directory, 'baseline.json');
  const latestPath = path.join(directory, 'latest.json');
  const configPath = path.join(directory, 'config.json');
  fs.writeFileSync(baselinePath, JSON.stringify({
    lastUpdated: FIXED_GENERATED_AT,
    dataPoints: 3,
    changeSeries: [0.01, 0.02, 0.03],
  }));
  fs.writeFileSync(latestPath, JSON.stringify({
    model_version: 'v1.1.2',
    implementation_revision: 'etf-sosovalue-vix-cboe-2026-09',
    factors: [{ key: 'stablecoins', metrics: { pct_change_30d: 1.234 } }],
  }));
  fs.writeFileSync(configPath, JSON.stringify({
    ssot_version: '2.1.1',
    factors: { stablecoins: { enabled: true, weight: 0.18 } },
  }));
  const reportPath = path.join(directory, 'report.json');
  try {
    const result = await runR07StablecoinElapsedTimeDiagnostic({
      repositorySha: FIXED_SHA,
      reportPath,
      generatedAtUtc: FIXED_GENERATED_AT,
      cacheDir,
      baselinePath,
      latestPath,
      configPath,
      repoRoot: REPO_ROOT,
    });
    assert.equal(result.report.repository_sha, FIXED_SHA);
    assert.equal(result.report.generated_at_utc, FIXED_GENERATED_AT);
    assert.equal(result.report.summary.cache_files_discovered, 1);
    assert.equal(result.report.provider_network_performed, false);
    assert.equal(fs.existsSync(reportPath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
