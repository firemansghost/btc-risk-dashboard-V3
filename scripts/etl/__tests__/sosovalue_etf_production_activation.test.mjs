import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from '../marketCalendar.mjs';
import { APPROVED_ETF_SCORED_TICKERS } from '../lib/etfSourceContract.mjs';
import { loadEtfSourceHistory } from '../lib/etfSourceHistory.mjs';
import { buildEtfProductionFactor } from '../lib/etfProduction.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-24T14:30:00.000Z';
const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config/dashboard-config.json'), 'utf8'));
const calibrationPath = path.join(REPO_ROOT, 'public/data/etf-flows-historical.json');
const calibrationBytes = fs.readFileSync(calibrationPath);
const calibration = JSON.parse(calibrationBytes.toString('utf8'));

function isTradingDay(dateString) {
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

async function productionFactor(overrides = {}) {
  const history = overrides.history ?? await loadEtfSourceHistory(path.join(REPO_ROOT, 'public/data/cache/etf_sosovalue/history.json'));
  return buildEtfProductionFactor({
    history,
    historicalCalibrationDocument: overrides.calibration ?? calibration,
    historicalCalibrationBytes: overrides.calibrationBytes ?? calibrationBytes,
    dashboardConfig: config,
    asOfUtc: overrides.asOfUtc ?? AS_OF,
    isTradingDay,
    acquisitionState: overrides.acquisitionState ?? 'live_refresh',
    acquisitionFailureReason: overrides.acquisitionFailureReason ?? null,
  });
}

test('production adapter reproduces the reviewed S7 economics', async () => {
  const factor = await productionFactor();
  assert.equal(factor.sourceTradingDate, '2026-09-23');
  assert.equal(factor.score, 44);
  assert.ok(Math.abs(factor.metrics.sum21_usd - 3177931690.3100004) < 1e-6);
  assert.ok(Math.abs(factor.metrics.pct - 17.518248175182483) < 1e-9);
  assert.ok(Math.abs(factor.metrics.z - -1.0520430919335124) < 1e-9);
  assert.ok(Math.abs(factor.metrics.acceleration_usd - 1304072168.21) < 1e-6);
  assert.ok(Math.abs(factor.metrics.hhi - 0.40905097527673207) < 1e-12);
  assert.equal(factor.lastUpdated, null);
  assert.equal(factor.provider, 'sosovalue');
  assert.notEqual(factor.provider, 'farside');
  assert.equal(factor.historicalCalibration.sourceGitBlobSha, '2986a65e565516f374f57bf031a672c84647330c');
  assert.equal(factor.historicalCalibration.canonicalUnit, 'USD');
  assert.equal(factor.historicalCalibration.multiplier, 1000000);
  for (const key of ['day_flow_usd', 'sum21_usd', 'z', 'pct', 'score']) {
    assert.equal(Number.isFinite(factor.metrics[key]), true, key);
  }
  const flows = factor.individualEtfFlows.at(-1).flows;
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) assert.equal(Number.isFinite(flows[ticker]), true, ticker);
  assert.notEqual(flows.FBTC, flows.BTC);
  assert.equal(Object.prototype.hasOwnProperty.call(flows, 'MSBT'), true);
});

test('acquisition state does not change ETF economics', async () => {
  const live = await productionFactor({ acquisitionState: 'live_refresh' });
  const fallback = await productionFactor({
    acquisitionState: 'durable_history_fallback',
    acquisitionFailureReason: 'capture_exit_1',
  });
  assert.equal(live.score, fallback.score);
  assert.equal(live.metrics.sum21_usd, fallback.metrics.sum21_usd);
  assert.equal(live.sourceTradingDate, fallback.sourceTradingDate);
  assert.notEqual(live.acquisitionState, fallback.acquisitionState);
});

test('durable fallback scores only the exact expected date', async () => {
  const history = await loadEtfSourceHistory(path.join(REPO_ROOT, 'public/data/cache/etf_sosovalue/history.json'));
  const scored = await productionFactor({ acquisitionState: 'durable_history_fallback' });
  assert.equal(scored.score, 44);
  const behind = structuredClone(history);
  delete behind.observations_by_date['2026-09-23'];
  const missed = await productionFactor({ history: behind, acquisitionState: 'durable_history_fallback' });
  assert.equal(missed.score, null);
  assert.equal(missed.reason, 'sosovalue_expected_eligible_date_unavailable');
});

test('a changed calibration blob nulls the ETF score', async () => {
  const changed = structuredClone(calibration);
  changed.rollingSums[0].sum += 1;
  const bytes = Buffer.from(JSON.stringify(changed));
  const factor = await productionFactor({ calibration: changed, calibrationBytes: bytes });
  assert.equal(factor.score, null);
  assert.equal(factor.reason, 'sosovalue_frozen_calibration_blob_mismatch');
});

test('ETF freshness follows the New York expected trading date', () => {
  const fresh = getStalenessStatus(
    { score: 44, sourceTradingDate: '2026-09-23', expectedEligibleTradingDate: '2026-09-23', lastUpdated: null },
    24,
    { factorName: 'etf_flows', asOf: '2026-09-24T14:30:00.000Z' }
  );
  assert.equal(fresh.status, 'fresh');
  assert.equal(fresh.reason, 'fresh_expected_eligible_trading_date');
  const stale = getStalenessStatus(
    { score: 44, sourceTradingDate: '2026-09-22', expectedEligibleTradingDate: '2026-09-23', lastUpdated: null },
    24,
    { factorName: 'etf_flows', asOf: '2026-09-24T14:30:00.000Z' }
  );
  assert.equal(stale.status, 'stale');
  const afterSixteen = getStalenessStatus(
    { score: 44, sourceTradingDate: '2026-09-23', expectedEligibleTradingDate: '2026-09-23', lastUpdated: null },
    24,
    { factorName: 'etf_flows', asOf: '2026-09-24T20:00:00.000Z' }
  );
  assert.equal(afterSixteen.status, 'fresh');
  assert.equal(afterSixteen.reason, 'fresh_expected_eligible_trading_date');
  const weekend = getStalenessStatus(
    { score: 44, sourceTradingDate: '2026-09-25', expectedEligibleTradingDate: '2026-09-25', lastUpdated: null },
    24,
    { factorName: 'etf_flows', asOf: '2026-09-27T15:00:00.000Z' }
  );
  assert.equal(weekend.status, 'fresh');
  const holiday = getStalenessStatus(
    { score: 44, sourceTradingDate: '2026-09-04', expectedEligibleTradingDate: '2026-09-04', lastUpdated: null },
    24,
    { factorName: 'etf_flows', asOf: '2026-09-08T11:00:00.000Z' }
  );
  assert.equal(holiday.status, 'fresh');
});

test('production identity and workflow keep the activation contract', () => {
  assert.equal(config.model_version, 'v1.1.2');
  assert.equal(config.implementation_revision, 'etf-sosovalue-2026-09');
  assert.equal(config.ssot_version, '2.1.1');
  assert.equal(config.factors.etf_flows.weight, 0.077);
  assert.deepEqual(config.subweights.etf_flows, { sum_21d: 0.3, acceleration: 0.3, diversification: 0.4 });
  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  const active = factors.slice(factors.indexOf('async function computeEtfFlows'), factors.indexOf('async function computeLegacyFarsideEtfFlows'));
  assert.equal(active.includes('buildEtfProductionFactor'), true);
  assert.equal(active.includes('fetchEtfHtml'), false);
  assert.equal(active.includes('selectPublishedEtfFlowRows'), false);
  assert.equal(active.includes('isEtfFlowsFreshForSourceCadence'), false);
  const daily = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  assert.equal(daily.includes('cron: "0 11 * * *"'), true);
  assert.match(daily, /group:\s*etl/);
  assert.equal(daily.includes('SOSOVALUE_API_KEY: ${{ secrets.SOSOVALUE_API_KEY }}'), true);
  assert.ok(daily.indexOf('capture-sosovalue-etf-source.mjs') < daily.indexOf('npm run etl:compute'));
  assert.equal(daily.includes('--mode COMMIT'), true);
  assert.equal(daily.includes('COMMIT_SOSOVALUE_ETF_HISTORY'), true);
  assert.equal(daily.includes('if: always()'), true);
  assert.equal(daily.includes('origin/main advanced during source acquisition'), true);
  const capture = daily.slice(
    daily.indexOf('name: Refresh SoSoValue ETF source history'),
    daily.indexOf('name: Upload SoSoValue source capture report')
  );
  assert.match(capture, /continue-on-error:\s*true/);
  assert.ok(capture.indexOf('ETF_SOSOVALUE_ACQUISITION_STATE=live_refresh') < capture.indexOf('exit "$status"'));
  assert.ok(capture.indexOf('ETF_SOSOVALUE_ACQUISITION_FAILURE_REASON') < capture.indexOf('exit "$status"'));
  const persist = daily.slice(
    daily.indexOf('name: Persist successful SoSoValue source history'),
    daily.indexOf('name: Reject a dirty worktree after a failed SoSoValue capture')
  );
  assert.match(persist, /if:\s*steps\.sosovalue_capture\.outputs\.capture_status == '0'/);
  assert.equal(persist.includes('continue-on-error'), false);
  assert.equal(persist.includes("outcome == 'success'"), false);
  const dirty = daily.slice(
    daily.indexOf('name: Reject a dirty worktree after a failed SoSoValue capture'),
    daily.indexOf('name: Require checkout to match origin/main before compute')
  );
  assert.match(dirty, /steps\.sosovalue_capture\.outputs\.capture_status != '0'/);
  assert.match(dirty, /git status --porcelain --untracked-files=all/);
  assert.ok(dirty.indexOf('exit 1') > dirty.indexOf('failed capture left repository modifications'));
  const handoff = daily.slice(
    daily.indexOf('name: Require checkout to match origin/main before compute'),
    daily.indexOf('name: Run ETL compute')
  );
  assert.equal(handoff.includes('git checkout --detach origin/main'), false);
  assert.match(handoff, /git checkout -B main origin\/main/);
  assert.match(handoff, /git rev-parse HEAD/);
  assert.match(handoff, /git rev-parse origin\/main/);
  assert.match(handoff, /git branch --show-current/);
  assert.match(handoff, /checkout is not branch main/);
  assert.ok(daily.indexOf('Persist successful SoSoValue source history') < daily.indexOf('npm run etl:compute'));
  assert.ok(daily.indexOf('git checkout -B main origin/main') < daily.indexOf('npm run etl:compute'));
  assert.ok(daily.indexOf('chore(etl): update artifacts [skip ci]') < daily.lastIndexOf('git push origin main'));
  assert.equal(daily.includes('git checkout --detach origin/main'), false);
  const footer = fs.readFileSync(path.join(REPO_ROOT, 'app/components/EtfTable.tsx'), 'utf8');
  assert.equal(footer.includes('Data: Farside Investors'), false);
  assert.equal(footer.includes('SoSoValue'), true);
  assert.equal(footer.includes('frozen calibration'), true);
});
