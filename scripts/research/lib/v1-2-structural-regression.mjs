// Coordinated v1.2 structural-regression gate.
// Deterministic supplied evidence. No network. No repository writes.
// Does not activate production and does not modify candidate semantics.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCKED_OFFICIAL_BLENDS, blendComponentScores } from '../../etl/lib/ssotSubweights.mjs';
import { matchBandForScore } from '../../etl/lib/riskBand.mjs';
import { decidePostComputeHealthCheck } from '../../etl/lib/postComputeHealth.mjs';
import { gateOfficialAdjustments } from '../../etl/lib/officialAdjustments.mjs';
import {
  APPROVED_ETF_SCORED_TICKERS,
  fingerprintEtfUniverse,
  getExpectedEligibleEtfTradingDate,
  validateEtfProviderObservation,
} from '../../etl/lib/etfSourceContract.mjs';
import { computeEtfCandidate } from '../../etl/lib/etfCandidateCompute.mjs';
import { createEmptyEtfSourceHistory, planEtfSourceHistoryMerge } from '../../etl/lib/etfSourceHistory.mjs';
import { isUsTradingDay } from '../../etl/marketCalendar.mjs';
import { createWeeklyCloses } from '../../etl/factors/marketRegime.mjs';
import { filterCompletedWeeklyCloses } from '../../etl/lib/completedPeriods.mjs';
import { sma200DenominatorCloses } from '../../etl/priceHistory.mjs';
import {
  expectedLatestSlotUtc,
  isObservationAcceptable,
  resolveFundingCadence,
} from '../../etl/lib/termFreshness.mjs';
import { getStalenessConfig, getStalenessStatus } from '../../etl/stalenessUtils.mjs';
import { getFactorsArray } from '../../../lib/config-loader.mjs';
import { fetchProductionVix, parseCboeVixHistory } from '../../etl/lib/vixSource.mjs';
import {
  analyzeV12StablecoinCoin,
  selectPriorDatedCalibrationObservations,
  stablecoinCoverageEligible,
  V12_STABLECOIN_CONFIG,
  computeV12StablecoinCandidate,
} from '../../etl/candidates/v1_2/stablecoins.mjs';
import {
  assertReportDirectoryOutsideRepo,
  readGitRef,
  readGitRevision,
  runInstrumentedMacro,
  runInstrumentedTrend,
  runProductionComposite,
  sha256 as hashText,
  macroEvidenceValues,
  trendPriceRecords,
} from './v1-2-gate-instrumentation.mjs';
import {
  V12_NET_LIQUIDITY_USD_MULTIPLIERS,
  canReuseV12NetLiquidityCache,
  computeV12NetLiquidityCandidate,
} from '../../etl/candidates/v1_2/net-liquidity.mjs';
import {
  canReuseV12SocialCache,
  computeV12SocialCandidate,
} from '../../etl/candidates/v1_2/social.mjs';
import {
  canReuseV12TermCache,
  computeV12TermCandidate,
  requiredScoreEligibleSpotUtc,
} from '../../etl/candidates/v1_2/term.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const GATE_ID = 'V1_2_STRUCTURAL_REGRESSION';
export const GATE_AS_OF_UTC = '2026-09-30T18:00:00.000Z';
export const FIXTURE_ID = 'v1-2-structural-regression-fixtures-v1';
const MS_DAY = 86_400_000;

const PROTECTED_PATHS = [
  'scripts/etl/factors.mjs',
  'scripts/etl/compute.mjs',
  'scripts/etl/stalenessUtils.mjs',
  'scripts/etl/lib/termFreshness.mjs',
  'scripts/etl/lib/ssotSubweights.mjs',
  'scripts/etl/lib/riskBand.mjs',
  'lib/composite-validator.mjs',
  'config/dashboard-config.json',
  'scripts/etl/candidates/v1_2/stablecoins.mjs',
  'scripts/etl/candidates/v1_2/net-liquidity.mjs',
  'scripts/etl/candidates/v1_2/social.mjs',
  'scripts/etl/candidates/v1_2/term.mjs',
  'scripts/etl/candidates/v1_2/data/stablecoin-dated-calibration-v1.json',
];

const FACTOR_WEIGHTS = {
  trend_valuation: 0.30,
  stablecoins: 0.18,
  etf_flows: 0.077,
  net_liquidity: 0.043,
  term_leverage: 0.20,
  macro_overlay: 0.10,
  social_interest: 0.10,
  onchain: 0,
};

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function fileSha(relativePath) {
  const absolute = path.join(REPO_ROOT, relativePath);
  return sha256(fs.readFileSync(absolute));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function assertion(id, requirement, status, detail) {
  return { id, requirement, status, detail };
}

function pass(id, requirement, detail) {
  return assertion(id, requirement, 'PASS', detail);
}

function fail(id, requirement, detail) {
  return assertion(id, requirement, 'FAIL', detail);
}

function limitation(id, requirement, detail) {
  return assertion(id, requirement, 'LIMITATION', detail);
}

function loadCanonicalComposite(factorsSource) {
  const marker = 'function calculateEnhancedGScore';
  const start = factorsSource.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let seen = false;
  let end = start;
  for (let i = start; i < factorsSource.length; i += 1) {
    const char = factorsSource[i];
    if (char === '{') {
      depth += 1;
      seen = true;
    } else if (char === '}') {
      depth -= 1;
      if (seen && depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const source = factorsSource.slice(start, end);
  const fn = new Function(`${source}\nreturn calculateEnhancedGScore;`)();
  return { fn, source, sha256: sha256(source) };
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_DAY).toISOString().slice(0, 10);
}

function socialEvidence() {
  const coins = [];
  for (let rank = 1; rank <= 15; rank += 1) {
    coins.push(rank === 8
      ? { item: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' } }
      : { item: { id: `coin-${rank}`, symbol: `c${rank}`, name: `Coin ${rank}` } });
  }
  const start = Date.parse('2026-08-31T00:00:00.000Z');
  const prices = Array.from({ length: 30 }, (_, index) => [start + index * MS_DAY, 70_000 + index * 50]);
  return {
    trendsData: { coins, trending_fetched_at: '2026-09-30T17:00:00.000Z' },
    priceData: { prices },
  };
}

function termEvidence() {
  const end = '2026-09-29';
  const days = 100;
  const start = addDays(end, -(days - 1));
  const funding = [];
  const prices = [];
  for (let lead = -40; lead < days; lead += 1) {
    const date = addDays(start, lead);
    prices.push([Date.parse(`${date}T00:00:00.000Z`), 100]);
  }
  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    for (const hour of [0, 8, 16]) {
      const iso = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
      funding.push({
        instId: 'BTC-USDT-SWAP',
        fundingTime: String(Date.parse(iso)),
        fundingRate: '0.0001',
      });
    }
  }
  for (const hour of [0, 8, 16]) {
    const iso = `2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`;
    funding.push({
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(iso)),
      fundingRate: '0.0002',
    });
  }
  prices.push([Date.parse(GATE_AS_OF_UTC), 250_000]);
  return { funding, prices };
}

function dropFundingDates(rows, fromDate, toDate) {
  return rows.filter((row) => {
    const ms = Number(row.fundingTime);
    if (!Number.isFinite(ms)) return true;
    const date = new Date(ms).toISOString().slice(0, 10);
    return date < fromDate || date > toDate;
  });
}

function stablecoinEvidence() {
  const calibration = readJson('scripts/etl/candidates/v1_2/data/stablecoin-dated-calibration-v1.json');
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const responses = V12_STABLECOIN_CONFIG.map((coin) => {
    const marketCaps = [];
    for (let age = 45; age >= 0; age -= 1) {
      const ts = endpointMs - age * MS_DAY;
      marketCaps.push([ts, 1e9 * coin.weight * (1 + (45 - age) * 0.001)]);
    }
    return { market_caps: marketCaps };
  });
  return { calibration, responses };
}

function wednesdaySources() {
  const endMs = Date.parse('2026-09-23T00:00:00.000Z');
  const dates = [];
  for (let index = 19; index >= 0; index -= 1) {
    dates.push(new Date(endMs - index * 7 * MS_DAY).toISOString().slice(0, 10));
  }
  const observations = (base, step) => dates.map((date, index) => ({
    date,
    value: String(base + index * step),
  }));
  return {
    walcl: { series_id: 'WALCL', query_semantics: 'NATIVE', observations: observations(6000, 10) },
    rrp: {
      series_id: 'RRPONTSYD',
      frequency: 'wew',
      aggregation_method: 'avg',
      observations: observations(400, 2),
    },
    wtregen: { series_id: 'WTREGEN', query_semantics: 'NATIVE', observations: observations(800, 1) },
  };
}

function runCandidates(bundle) {
  const stable = computeV12StablecoinCandidate({
    responses: bundle.stable.responses,
    calibration: bundle.stable.calibration,
    asOfUtc: GATE_AS_OF_UTC,
  });
  const liquidity = computeV12NetLiquidityCandidate({
    ...bundle.liquidity,
    asOfUtc: GATE_AS_OF_UTC,
  });
  const social = computeV12SocialCandidate({
    ...bundle.social,
    trendingFetchedAt: bundle.social.trendsData?.trending_fetched_at || null,
  });
  const term = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: { okx: bundle.term.funding },
    spotPrices: bundle.term.prices,
  });
  return { stable, liquidity, social, term };
}

function finiteScore(result) {
  return Number.isFinite(result?.score);
}

/**
 * Test-only adapter. Not imported by production.
 * A finite candidate score is not automatically fresh. Freshness binds to the
 * spot observation used at the selected cutoff, not to a later raw row.
 */
export function adaptV12TermCandidateForStatus(result, asOfUtc = GATE_AS_OF_UTC) {
  const required = requiredScoreEligibleSpotUtc(asOfUtc);
  const scoredSpot = result?.spot_observation_utc || null;
  const available = finiteScore(result);
  const scoredSpotFresh = typeof scoredSpot === 'string' && scoredSpot >= required;
  return {
    adapter: 'v1_2_term_status_adapter',
    production_referenced: false,
    eligible: available && scoredSpotFresh && result.cache_reuse_current_evidence_eligible === true,
    available,
    status: available && scoredSpotFresh ? 'score_eligible_fresh' : 'not_fresh',
    selected_provider: result?.selected_provider || null,
    common_cutoff_date_D: result?.common_cutoff_date_D || null,
    raw_spot_observation_utc: result?.latest_raw_spot_observation_utc || null,
    scored_spot_observation_utc: scoredSpot,
    required_score_eligible_spot_utc: required,
    funding_observation_utc: result?.funding_observation_utc || null,
    lastUpdated: result?.lastUpdated || null,
    acquisition_or_fallback: result?.provider_dispositions || [],
    reason: result?.reason || null,
  };
}

function etfHistory(asOfUtc) {
  const isTradingDay = (dateString) => isUsTradingDay(`${dateString}T00:00:00.000Z`);
  const expected = getExpectedEligibleEtfTradingDate(asOfUtc, isTradingDay);
  const dates = [];
  let cursor = expected;
  while (dates.length < 30) {
    if (isTradingDay(cursor)) dates.push(cursor);
    const [year, month, day] = cursor.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 1, day));
    previous.setUTCDate(previous.getUTCDate() - 1);
    cursor = previous.toISOString().slice(0, 10);
  }
  dates.reverse();
  const flows = () => Object.fromEntries(APPROVED_ETF_SCORED_TICKERS.map((ticker) => [ticker, 1]));
  const rows = dates.map((tradingDate) => ({
    tradingDate,
    summaryTotalUsd: APPROVED_ETF_SCORED_TICKERS.length,
    tickerFlowsUsd: flows(),
    providerUniverse: [...APPROVED_ETF_SCORED_TICKERS],
  }));
  const plan = planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), rows, '2026-09-30T16:00:00.000Z');
  return { expected, plan, isTradingDay };
}

function calibrationDocument() {
  return {
    metadata: {
      source: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
      fetchedAt: '2025-09-17T11:24:18.385Z',
      totalRecords: 294,
      dateRange: { start: '2024-01-11', end: '2025-09-16' },
    },
    rollingSums: [
      { date: '2024-02-16', sum: 1 },
      { date: '2024-02-17', sum: 2 },
    ],
  };
}

function identityAssertions(config, executed) {
  const out = [];
  const targets = [
    ['stablecoins', executed.stable],
    ['net_liquidity', executed.liquidity],
    ['social_interest', executed.social],
    ['term_leverage', executed.term],
  ];
  const identityOk = targets.every(([, result]) => result.model_version_target === 'v1.2.0'
    && result.implementation_revision_target === 'semantic-correctness-2026-09'
    && result.ssot_version === '2.1.1'
    && result.candidate_only === true
    && result.production_active === false);
  out.push(identityOk
    ? pass('candidate_identity', 'four candidate identities', 'v1.2.0 / semantic-correctness-2026-09 / SSOT 2.1.1')
    : fail('candidate_identity', 'four candidate identities', targets.map(([key, result]) => ({
      key,
      model: result.model_version_target,
      revision: result.implementation_revision_target,
      ssot: result.ssot_version,
    }))));
  const productionOk = config.model_version === 'v1.2.0'
    && config.implementation_revision === 'semantic-correctness-2026-09'
    && config.ssot_version === '2.1.1';
  out.push(productionOk
    ? pass('production_identity', 'integrated publication identity', 'v1.2.0 / semantic-correctness-2026-09 / SSOT 2.1.1')
    : fail('production_identity', 'integrated publication identity', {
      model_version: config.model_version,
      implementation_revision: config.implementation_revision,
      ssot_version: config.ssot_version,
    }));
  const weightMismatches = Object.entries(FACTOR_WEIGHTS).filter(([key, weight]) => config.factors[key].weight !== weight);
  out.push(weightMismatches.length === 0
    ? pass('factor_weights', 'configured factor weights', FACTOR_WEIGHTS)
    : fail('factor_weights', 'configured factor weights', weightMismatches));
  out.push(config.factors.onchain.enabled === false
    ? pass('onchain_disabled', 'on-chain disabled at weight 0', { enabled: false, weight: 0 })
    : fail('onchain_disabled', 'on-chain disabled at weight 0', config.factors.onchain));
  const pillars = { liquidity: 0.30, momentum: 0.30, leverage: 0.20, macro: 0.10, social: 0.10 };
  const pillarMismatch = Object.entries(pillars).filter(([key, weight]) => config.pillars[key].weight !== weight);
  out.push(pillarMismatch.length === 0
    ? pass('pillar_weights', 'pillar weights', pillars)
    : fail('pillar_weights', 'pillar weights', pillarMismatch));
  const subMismatch = Object.entries(LOCKED_OFFICIAL_BLENDS).filter(([factor, weights]) => {
    const configured = config.subweights[factor];
    return Object.entries(weights).some(([key, weight]) => configured?.[key] !== weight);
  });
  out.push(subMismatch.length === 0
    ? pass('subweights', 'official subweights', LOCKED_OFFICIAL_BLENDS)
    : fail('subweights', 'official subweights', subMismatch));
  const bands = config.bands.map((band) => [band.key, band.range]);
  const expectedBands = [
    ['aggressive_buy', [0, 14]],
    ['dca_buy', [15, 34]],
    ['moderate_buy', [35, 49]],
    ['hold_wait', [50, 64]],
    ['reduce_risk', [65, 79]],
    ['high_risk', [80, 100]],
  ];
  out.push(JSON.stringify(bands) === JSON.stringify(expectedBands)
    ? pass('band_boundaries', 'six risk-band boundaries', expectedBands)
    : fail('band_boundaries', 'six risk-band boundaries', bands));
  out.push(config.adjustments.cycle.enabled === false && config.adjustments.spike.enabled === false
    ? pass('adjustments_disabled', 'cycle and spike disabled', { cycle: false, spike: false })
    : fail('adjustments_disabled', 'cycle and spike disabled', config.adjustments));
  return out;
}

function isolationAssertions() {
  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  const compute = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/compute.mjs'), 'utf8');
  const adapter = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/v12ProductionAdapters.mjs'), 'utf8');
  const isolated = !/v1-2-structural-regression/.test(factors)
    && !/v1-2-structural-regression/.test(compute)
    && !/v1-2-structural-regression/.test(adapter)
    && !/candidates\/v1_2\//.test(factors)
    && !/candidates\/v1_2\//.test(compute)
    && factors.includes('v12ProductionAdapters.mjs')
    && adapter.includes('candidates/v1_2/stablecoins.mjs')
    && adapter.includes('candidates/v1_2/net-liquidity.mjs')
    && adapter.includes('candidates/v1_2/social.mjs')
    && adapter.includes('candidates/v1_2/term.mjs');
  return [isolated
    ? pass('production_isolation', 'production routes through the v1.2 adapter and does not import this gate', {
      factors_import_adapter: true,
      factors_import_gate: false,
      adapter_imports_candidates: true,
    })
    : fail('production_isolation', 'production routes through the v1.2 adapter and does not import this gate', {})];
}

function coordinatedAssertions(bundle, first, second) {
  const out = [];
  const allFinite = ['stable', 'liquidity', 'social', 'term'].every((key) => finiteScore(first[key]));
  out.push(allFinite
    ? pass('coordinated_all_eligible', 'four real candidates score together', {
      stable: first.stable.score,
      net_liquidity: first.liquidity.score,
      social: first.social.score,
      term: first.term.score,
    })
    : fail('coordinated_all_eligible', 'four real candidates score together', {
      stable: first.stable.reason,
      net_liquidity: first.liquidity.reason,
      social: first.social.reason,
      term: first.term.reason,
    }));
  out.push(JSON.stringify(summarize(first)) === JSON.stringify(summarize(second))
    ? pass('repeat_execution', 'identical inputs repeat', summarize(first))
    : fail('repeat_execution', 'identical inputs repeat', { first: summarize(first), second: summarize(second) }));

  const reorderedTerm = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: { okx: bundle.term.funding.slice().reverse() },
    spotPrices: bundle.term.prices.slice().reverse(),
  });
  out.push(reorderedTerm.fingerprint === first.term.fingerprint && reorderedTerm.score === first.term.score
    ? pass('reordered_term', 'reordered equivalent Term input', { fingerprint: reorderedTerm.fingerprint })
    : fail('reordered_term', 'reordered equivalent Term input', {
      score: reorderedTerm.score,
      fingerprint_changed: reorderedTerm.fingerprint !== first.term.fingerprint,
    }));

  const socialMissing = computeV12SocialCandidate({
    trendsData: { coins: [] },
    priceData: bundle.social.priceData,
  });
  const termMissing = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: {},
    spotPrices: bundle.term.prices,
  });
  const liquidityMissing = computeV12NetLiquidityCandidate({
    walcl: bundle.liquidity.walcl,
    rrp: { ...bundle.liquidity.rrp, observations: [] },
    wtregen: bundle.liquidity.wtregen,
    asOfUtc: GATE_AS_OF_UTC,
  });
  out.push(!finiteScore(socialMissing) && finiteScore(first.term)
    ? pass('social_unavailable_alone', 'Social null does not erase Term', {
      social: socialMissing.score,
      term: first.term.score,
    })
    : fail('social_unavailable_alone', 'Social null does not erase Term', {}));
  out.push(!finiteScore(socialMissing) && !finiteScore(termMissing) && finiteScore(first.stable) && finiteScore(first.liquidity)
    ? pass('multiple_unavailable', 'Social and Term unavailable together leaves the other candidates scored', {
      social: socialMissing.score,
      term: termMissing.score,
      stable: first.stable.score,
      net_liquidity: first.liquidity.score,
    })
    : fail('multiple_unavailable', 'multiple changed factors unavailable', {
      social: socialMissing.reason,
      term: termMissing.reason,
      stable: first.stable.reason,
      liquidity: first.liquidity.reason,
    }));
  out.push(!finiteScore(liquidityMissing)
    ? pass('net_liquidity_missing_rrp', 'missing RRP is unavailable', { score: liquidityMissing.score, reason: liquidityMissing.reason })
    : fail('net_liquidity_missing_rrp', 'missing RRP is unavailable', { score: liquidityMissing.score }));
  out.push(canReuseV12SocialCache({ current: socialMissing, cached: first.social }) === false
    && canReuseV12TermCache({ current: termMissing, cached: first.term }) === false
    ? pass('invalid_current_cache', 'unavailable current evidence cannot reuse an apparently valid cache', {})
    : fail('invalid_current_cache', 'unavailable current evidence cannot reuse an apparently valid cache', {}));
  return out;
}

function summarize(executed) {
  return {
    stable: executed.stable.score,
    liquidity: executed.liquidity.score,
    social: executed.social.score,
    term: executed.term.score,
    term_fingerprint: executed.term.fingerprint,
    social_fingerprint: executed.social.fingerprint || null,
  };
}

function contractAssertions(bundle, executed) {
  const out = [];
  const stable = executed.stable;
  out.push(stable.calibration_id === 'STABLECOIN_DATED_CALIBRATION_V1'
    && stable.calibration_validation?.ok === true
    && stable.legacy_baseline_used !== true
    ? pass('stablecoin_calibration', 'dated calibration contract, legacy baseline not relabeled', {
      calibration_id: stable.calibration_id,
      observation_date: stable.observation_date,
    })
    : fail('stablecoin_calibration', 'dated calibration contract', {
      calibration_id: stable.calibration_id,
      validation: stable.calibration_validation,
    }));
  const endpoint = Date.parse('2026-09-30T12:00:00.000Z');
  const target7 = endpoint - 7 * MS_DAY;
  const target30 = endpoint - 30 * MS_DAY;
  const exactCaps = [];
  const underCaps = [];
  for (let day = 40; day >= 0; day -= 1) {
    const ts = endpoint - day * MS_DAY;
    if (ts !== target7 && ts !== target30) exactCaps.push([ts, 1e9]);
    if (ts === target7 || ts === target30) underCaps.push([ts - 23 * 60 * 60 * 1000, 1e9]);
    else underCaps.push([ts, 1e9]);
  }
  const asOfMs = Date.parse(GATE_AS_OF_UTC);
  const exact = analyzeV12StablecoinCoin('USDT', exactCaps, { asOfMs });
  const under = analyzeV12StablecoinCoin('USDT', underCaps, { asOfMs });
  out.push(finiteScore(stable)
    ? pass('stablecoin_scored', 'strict positive-cap evidence scores', { score: stable.score, observation_date: stable.observation_date })
    : fail('stablecoin_scored', 'strict positive-cap evidence scores', { reason: stable.reason }));
  out.push(exact.horizon_7d?.available === false
    && exact.horizon_7d?.lag_hours_target_to_prior === 24
    && exact.horizon_30d?.available === false
    && exact.horizon_30d?.lag_hours_target_to_prior === 24
    && under.horizon_7d?.available === true
    && under.horizon_7d?.lag_hours_target_to_prior === 23
    && under.horizon_30d?.available === true
    && under.horizon_30d?.lag_hours_target_to_prior === 23
    ? pass('stablecoin_exact_24h_lag', 'removing the target observation leaves a prior exactly 24h behind', {
      exact_7d: exact.horizon_7d?.lag_hours_target_to_prior,
      exact_30d: exact.horizon_30d?.lag_hours_target_to_prior,
      under_7d: under.horizon_7d?.lag_hours_target_to_prior,
    })
    : fail('stablecoin_exact_24h_lag', 'removing the target observation leaves a prior exactly 24h behind', {
      exact7: exact.horizon_7d,
      exact30: exact.horizon_30d,
      under7: under.horizon_7d,
      under30: under.horizon_30d,
    }));
  const priors = selectPriorDatedCalibrationObservations(bundle.stable.calibration, stable.observation_date);
  out.push(priors.length > 0 && priors.every((row) => row.observation_date < stable.observation_date)
    ? pass('stablecoin_prior_calibration', 'calibration rows used as reference are strictly before the observation date', {
      observation_date: stable.observation_date,
      prior_count: priors.length,
    })
    : fail('stablecoin_prior_calibration', 'calibration rows are strictly earlier', { observation_date: stable.observation_date }));
  const thin = stablecoinCoverageEligible({ validCoinCount: 2, includedWeightSum: 0.6, totalConfiguredWeight: 1 });
  out.push(thin.eligible === false
    ? pass('stablecoin_coverage_floor', 'fewer than three coins or under 70 percent coverage is ineligible', thin)
    : fail('stablecoin_coverage_floor', 'coverage floor', thin));

  out.push(executed.liquidity.usd_multipliers.WALCL === 1e6
    && executed.liquidity.usd_multipliers.WTREGEN === 1e6
    && executed.liquidity.usd_multipliers.RRPONTSYD === 1e9
    && V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD === 1e9
    ? pass('net_liquidity_multipliers', 'WALCL/WTREGEN ×1e6 and RRP ×1e9', executed.liquidity.usd_multipliers)
    : fail('net_liquidity_multipliers', 'USD multipliers', executed.liquidity.usd_multipliers));
  out.push(executed.liquidity.source_contracts.RRPONTSYD.frequency === 'wew'
    && executed.liquidity.source_contracts.RRPONTSYD.aggregation_method === 'avg'
    ? pass('net_liquidity_rrp_contract', 'official RRP wew/avg contract', executed.liquidity.source_contracts.RRPONTSYD)
    : fail('net_liquidity_rrp_contract', 'official RRP contract', executed.liquidity.source_contracts.RRPONTSYD));
  const nlFingerprint = executed.liquidity.canonical_input_fingerprint;
  const revised = computeV12NetLiquidityCandidate({
    ...bundle.liquidity,
    walcl: {
      ...bundle.liquidity.walcl,
      observations: bundle.liquidity.walcl.observations.map((row, index) => (
        index === 0 ? { ...row, value: String(Number(row.value) + 1) } : row
      )),
    },
    asOfUtc: GATE_AS_OF_UTC,
  });
  out.push(revised.canonical_input_fingerprint !== nlFingerprint
    ? pass('net_liquidity_fingerprint_revision', 'earlier WALCL revision changes the scoring fingerprint', {})
    : fail('net_liquidity_fingerprint_revision', 'earlier WALCL revision changes the scoring fingerprint', {}));
  out.push(canReuseV12NetLiquidityCache({
    currentFingerprint: revised.canonical_input_fingerprint,
    cached: { ...executed.liquidity, canonical_input_fingerprint: nlFingerprint },
  }) === false
    ? pass('net_liquidity_cache_revision', 'revised fingerprint cannot reuse the prior cache', {})
    : fail('net_liquidity_cache_revision', 'revised fingerprint cannot reuse the prior cache', {}));

  out.push(executed.social.component_weights.coingecko_trending_rank === 0.7
    && executed.social.component_weights.btc_price_momentum_7d === 0.3
    && executed.social.components.search.state === 'OBSERVED'
    && executed.social.components.momentum.state === 'OBSERVED'
    ? pass('social_both_components', '70/30 blend only with both components observed', {
      score: executed.social.score,
      weights: executed.social.component_weights,
    })
    : fail('social_both_components', 'both Social components observed', executed.social.components));
  const partial = computeV12SocialCandidate({
    trendsData: bundle.social.trendsData,
    priceData: { prices: [] },
  });
  out.push(partial.score === null
    ? pass('social_no_renormalization', 'missing Momentum does not renormalize Search into a Social score', { score: partial.score, reason: partial.reason })
    : fail('social_no_renormalization', 'missing Momentum does not renormalize Search', { score: partial.score }));
  out.push(!Object.hasOwn(executed.social.component_weights, 'volatility')
    ? pass('social_volatility_excluded', 'volatility is not an official Social weight', {})
    : fail('social_volatility_excluded', 'volatility is not an official Social weight', executed.social.component_weights));

  const holed = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: { okx: dropFundingDates(bundle.term.funding, '2026-09-19', '2026-09-29') },
    spotPrices: bundle.term.prices,
  });
  out.push(holed.score === null
    && holed.reason === 'stale_score_eligible_spot'
    && holed.common_cutoff_date_D === '2026-09-18'
    && holed.spot_observation_utc === '2026-09-18T00:00:00.000Z'
    && holed.latest_score_eligible_spot_utc === '2026-09-29T00:00:00.000Z'
    ? pass('term_scored_cutoff_freshness', 'unused fresh spot does not freshen an older scored cutoff', {
      D: holed.common_cutoff_date_D,
      scored_spot: holed.spot_observation_utc,
      required: holed.score_eligible_spot_required_utc,
    })
    : fail('term_scored_cutoff_freshness', 'unused fresh spot does not freshen an older scored cutoff', {
      score: holed.score,
      reason: holed.reason,
      D: holed.common_cutoff_date_D,
      scored_spot: holed.spot_observation_utc,
    }));
  out.push(executed.term.common_cutoff_date_D === '2026-09-29'
    && executed.term.score != null
    && executed.term.components.funding.reference_count === 60
    && executed.term.components.realized_vol.price_count === 31
    && executed.term.components.realized_vol.return_count === 30
    ? pass('term_c1_c13_current', 'current Term cutoff, 60 references, and 31/30 volatility window', {
      score: executed.term.score,
      D: executed.term.common_cutoff_date_D,
      lastUpdated: executed.term.lastUpdated,
    })
    : fail('term_c1_c13_current', 'current Term contract window', {
      score: executed.term.score,
      D: executed.term.common_cutoff_date_D,
      reason: executed.term.reason,
    }));
  const conflict = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: {
      okx: bundle.term.funding.concat([{
        instId: 'BTC-USDT-SWAP',
        fundingTime: String(Date.parse('2026-09-20T08:00:00.000Z')),
        fundingRate: null,
      }]),
    },
    spotPrices: bundle.term.prices,
  });
  out.push(conflict.score === null
    ? pass('term_malformed_duplicate', 'null-rate duplicate fails closed', { reason: conflict.reason })
    : fail('term_malformed_duplicate', 'null-rate duplicate fails closed', { score: conflict.score }));
  const acquired = computeV12TermCandidate({
    asOfUtc: GATE_AS_OF_UTC,
    funding: {
      bitmex: { rows: null, acquisition: { classification: 'HTTP_451', http_status: 451 } },
      okx: bundle.term.funding,
    },
    spotPrices: bundle.term.prices,
  });
  const bitmex = acquired.provider_dispositions.find((row) => row.provider === 'bitmex');
  out.push(acquired.selected_provider === 'okx'
    && bitmex?.disposition === 'SOURCE_ACQUISITION_UNAVAILABLE'
    && bitmex?.acquisition_classification === 'HTTP_451'
    && bitmex?.disposition !== 'HISTORY_INSUFFICIENT'
    ? pass('term_acquisition_vs_history', 'HTTP 451 is acquisition failure and OKX can stand alone', bitmex)
    : fail('term_acquisition_vs_history', 'HTTP 451 is acquisition failure and OKX can stand alone', {
      selected: acquired.selected_provider,
      bitmex,
    }));
  const mutatedCache = structuredClone(executed.term);
  delete mutatedCache.components.funding.percentile;
  out.push(canReuseV12TermCache({ current: executed.term, cached: mutatedCache }) === false
    && canReuseV12TermCache({ current: executed.term, cached: structuredClone(executed.term) }) === true
    ? pass('term_cache_provenance', 'complete cache clone reuses; missing percentile does not', {})
    : fail('term_cache_provenance', 'complete cache clone reuses; missing percentile does not', {}));
  const adapted = adaptV12TermCandidateForStatus(executed.term);
  const adaptedStale = adaptV12TermCandidateForStatus(holed);
  out.push(adapted.status === 'score_eligible_fresh'
    && adapted.lastUpdated === executed.term.lastUpdated
    && adaptedStale.status === 'not_fresh'
    && adaptedStale.lastUpdated === holed.lastUpdated
    ? pass('term_status_adapter', 'test-only adapter keeps raw and scored timing distinct', {
      fresh: adapted.status,
      stale: adaptedStale.status,
      scored_spot: adaptedStale.scored_spot_observation_utc,
      raw_spot: adaptedStale.raw_spot_observation_utc,
    })
    : fail('term_status_adapter', 'test-only adapter keeps raw and scored timing distinct', { adapted, adaptedStale }));
  return out;
}

async function unchangedFactorAssertions(config) {
  const out = [];
  const blend = blendComponentScores(
    { bmsb_distance: 80, mayer_stretch: 50, weekly_rsi: 20 },
    LOCKED_OFFICIAL_BLENDS.trend_valuation,
  );
  out.push(blend === 65
    ? pass('trend_blend', 'executed official 60/30/10 Trend blend', { score: blend })
    : fail('trend_blend', 'executed official 60/30/10 Trend blend', { score: blend }));


  const trendRun = await runInstrumentedTrend(GATE_AS_OF_UTC);
  const trendResult = trendRun.result;
  const trendExpected = expectedTrendFromFixture(GATE_AS_OF_UTC, 50_000);
  out.push(trendResult.score === trendExpected.score
    && trendResult.reason === 'success'
    && trendResult.lastUpdated === GATE_AS_OF_UTC
    ? pass('trend_full_execution', 'Trend score matches the fixture calculation, not the function\'s own component line', {
      score: trendResult.score,
      expected: trendExpected,
      lastUpdated: trendResult.lastUpdated,
      instrumentation: trendRun.instrumentation,
    })
    : fail('trend_full_execution', 'Trend score matches the fixture calculation', {
      score: trendResult.score,
      reason: trendResult.reason,
      lastUpdated: trendResult.lastUpdated,
      expected: trendExpected,
    }));
  const trendDescriptive = {
    score: trendResult.score,
    instrumentation_sha256: trendRun.instrumentation.instrumented_sha256,
  };

  const universe = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  const missingBtc = validateEtfProviderObservation({
    tradingDate: '2026-09-29',
    providerUniverse: APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'BTC'),
    tickerFlowsUsd: Object.fromEntries(APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'BTC').map((ticker) => [ticker, 1])),
    summaryTotalUsd: 11,
  });
  out.push(APPROVED_ETF_SCORED_TICKERS.length === 12
    && APPROVED_ETF_SCORED_TICKERS.includes('BTC')
    && APPROVED_ETF_SCORED_TICKERS.includes('FBTC')
    && universe.ok
    && missingBtc.complete === false
    ? pass('etf_universe', '12 approved tickers, BTC distinct from FBTC, missing BTC fails closed', {
      fingerprint: universe.fingerprint,
    })
    : fail('etf_universe', '12 approved tickers and fail-closed identity', { universe, missingBtc }));
  const etf = etfHistory(GATE_AS_OF_UTC);
  const etfResult = etf.plan.ok
    ? computeEtfCandidate({
      history: etf.plan.history,
      historicalCalibrationDocument: calibrationDocument(),
      dashboardConfig: config,
      asOfUtc: GATE_AS_OF_UTC,
      isTradingDay: etf.isTradingDay,
    })
    : { ok: false, reason: etf.plan.reason };
  out.push(etfResult.ok
    ? pass('etf_executed_selection', 'real ETF compute at the gate as-of', {
      score: etfResult.score,
      selectedTradingDate: etfResult.selectedTradingDate,
      expected: etf.expected,
    })
    : fail('etf_executed_selection', 'real ETF compute at the gate as-of', etfResult));

  const primary = await runInstrumentedMacro('cboe_primary');
  const fallback = await runInstrumentedMacro('fred_fallback');
  const unavailable = await runInstrumentedMacro('unavailable');
  out.push(primary.result.score === 95 && primary.result.vixProvider === 'cboe' && primary.result.vixFallbackUsed === false
    ? pass('macro_cboe_primary', 'full computeMacroOverlay keeps Cboe primary on constant supplied series', {
      score: primary.result.score,
      lastUpdated: primary.result.lastUpdated,
      vixProvider: primary.result.vixProvider,
    })
    : fail('macro_cboe_primary', 'full computeMacroOverlay keeps Cboe primary', primary.result));
  out.push(fallback.result.vixProvider === 'fred' && fallback.result.vixFallbackUsed === true && Number.isFinite(fallback.result.score)
    ? pass('macro_fred_fallback', 'full computeMacroOverlay uses guarded FRED fallback when Cboe transport fails', {
      score: fallback.result.score,
      reason: fallback.result.vixFallbackReason,
    })
    : fail('macro_fred_fallback', 'guarded FRED fallback', fallback.result));
  const varying = await runInstrumentedMacro('varying_dxy');
  const varyingExpected = expectedVaryingMacro();
  out.push(varying.result.score === varyingExpected.score
    && varyingExpected.dollar !== varyingExpected.rates
    && varyingExpected.dollar !== varyingExpected.vix
    && varyingExpected.rates !== varyingExpected.vix
    && varying.result.vixFallbackUsed === false
    && varying.result.latestDxyDate === varyingExpected.sourceDate
    && varying.result.latestDgs2Date === varyingExpected.sourceDate
    && varying.result.latestVixDate === varyingExpected.sourceDate
    && varying.result.lastUpdated
    && varying.result.lastUpdated !== GATE_AS_OF_UTC
    ? pass('macro_varying_coefficients', 'independent DXY, rates, and VIX components from the supplied series', {
      score: varying.result.score,
      expected: varyingExpected,
      lastUpdated: varying.result.lastUpdated,
      latestDxyDate: varying.result.latestDxyDate,
      latestDgs2Date: varying.result.latestDgs2Date,
      latestVixDate: varying.result.latestVixDate,
    })
    : fail('macro_varying_coefficients', 'independent DXY, rates, and VIX components from the supplied series', {
      score: varying.result?.score,
      expected: varyingExpected,
      lastUpdated: varying.result?.lastUpdated,
      latestDxyDate: varying.result?.latestDxyDate,
      latestDgs2Date: varying.result?.latestDgs2Date,
      latestVixDate: varying.result?.latestVixDate,
      fallback: varying.result?.vixFallbackUsed,
    }));
  const staleMacro = await runInstrumentedMacro('stale_cboe');
  out.push(staleMacro.result.vixFallbackUsed === true
    && staleMacro.result.latestVixDate === '2026-09-30'
    && staleMacro.result.latestVixDate !== '2026-08-01'
    && Number.isFinite(staleMacro.result.score)
    ? pass('macro_stale_cboe_fallback', 'stale Cboe evidence falls back to the current FRED VIX date', {
      score: staleMacro.result.score,
      latestVixDate: staleMacro.result.latestVixDate,
      reason: staleMacro.result.vixFallbackReason,
    })
    : fail('macro_stale_cboe_fallback', 'stale Cboe evidence falls back to the current FRED VIX date', staleMacro.result));
  out.push(unavailable.result.score === null
    ? pass('macro_unavailable', 'full computeMacroOverlay fails closed when Cboe and FRED VIX are unavailable', {
      reason: unavailable.result.reason,
    })
    : fail('macro_unavailable', 'unavailable macro evidence', unavailable.result));

  return {
    assertions: out,
    trendDescriptive,
    trendResult,
    macroResult: primary.result,
    etfResult,
    macroInstrumentation: primary.instrumentation,
  };
}

function compositeAssertions(config, compositeFn) {
  const out = [];
  if (!compositeFn) {
    return [fail('composite_function', 'canonical calculateEnhancedGScore source', 'function text not found')];
  }
  const zero = compositeFn.fn([], 0, 0);
  out.push(zero === 50
    ? pass('composite_zero_weight', 'canonical zero-included-weight arithmetic returns 50', {
      score: zero,
      source_sha256: compositeFn.sha256,
      not_observed_neutral_evidence: true,
    })
    : fail('composite_zero_weight', 'canonical zero-included-weight arithmetic returns 50', { score: zero }));
  const normalized = compositeFn.fn([], 0.5, 26);
  out.push(normalized === 52
    ? pass('composite_normalization', 'canonical included-weight normalization and integer rounding', { score: normalized })
    : fail('composite_normalization', 'canonical included-weight normalization and integer rounding', { score: normalized }));
  const health = decidePostComputeHealthCheck({ failedFactors: ['social_interest'] });
  const healthy = decidePostComputeHealthCheck({ failedFactors: [] });
  out.push(health.ok === false && health.exitProcess === true && healthy.ok === true && zero === 50
    ? pass('publication_health', 'a 50 fallback does not satisfy strict publication health', {
      fallback_score: zero,
      health,
    })
    : fail('publication_health', 'a 50 fallback does not satisfy strict publication health', { health, healthy }));
  const gated = gateOfficialAdjustments({
    config,
    cycle_adjustment: { adj_pts: 2 },
    spike_adjustment: { adj_pts: 1 },
    nowIso: GATE_AS_OF_UTC,
    yClose: 100_000,
  });
  out.push((gated.cycle_adjustment.adj_pts || 0) === 0 && (gated.spike_adjustment.adj_pts || 0) === 0
    ? pass('adjustments_gated', 'disabled cycle and spike contribute zero through the production gate', gated)
    : fail('adjustments_gated', 'disabled cycle and spike contribute zero', gated));
  const boundaries = [0, 14, 15, 34, 35, 49, 50, 64, 65, 79, 80, 100];
  const mapped = boundaries.map((score) => [score, matchBandForScore(score, config.bands)?.key || null]);
  const expected = [
    [0, 'aggressive_buy'],
    [14, 'aggressive_buy'],
    [15, 'dca_buy'],
    [34, 'dca_buy'],
    [35, 'moderate_buy'],
    [49, 'moderate_buy'],
    [50, 'hold_wait'],
    [64, 'hold_wait'],
    [65, 'reduce_risk'],
    [79, 'reduce_risk'],
    [80, 'high_risk'],
    [100, 'high_risk'],
  ];
  out.push(JSON.stringify(mapped) === JSON.stringify(expected)
    ? pass('band_mapping', 'executed band matcher at every boundary', mapped)
    : fail('band_mapping', 'executed band matcher at every boundary', { mapped, expected }));
  return out;
}

function smaValues(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function emaValues(data, period) {
  if (!data.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i += 1) {
    result.push((data[i] * multiplier) + (result[i - 1] * (1 - multiplier)));
  }
  return result;
}

function rsiValues(prices, period = 14) {
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i += 1) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const rsi = [100 - (100 / (1 + (avgGain / avgLoss)))];
  for (let i = period; i < gains.length; i += 1) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    rsi.push(100 - (100 / (1 + (avgGain / avgLoss))));
  }
  return rsi;
}

function trendPercentile(array, value) {
  const sorted = [...array].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item < value) count += 1;
    else if (item === value) count += 0.5;
  }
  return (count / sorted.length) * 100;
}

function trendRisk(percentile, invert = false) {
  const p = Math.max(0.01, Math.min(99.99, percentile)) / 100;
  const z = Math.log(p / (1 - p)) / 3;
  let score = 100 / (1 + Math.exp(-z));
  if (invert) score = 100 - score;
  return Math.round(score);
}

function expectedTrendFromFixture(asOfUtc, snapshotPrice) {
  const candles = trendPriceRecords().map((record) => ({
    timestamp: Date.parse(`${record.date_utc}T00:00:00.000Z`),
    close: record.close_usd,
    date_utc: record.date_utc,
  }));
  const dailyCloses = sma200DenominatorCloses(candles, asOfUtc);
  const sma200Series = smaValues(dailyCloses, 200);
  const latestSMA200 = sma200Series[sma200Series.length - 1];
  const mayerMultiple = snapshotPrice / latestSMA200;
  const mayerSeries = dailyCloses.map((price, index) => (
    index >= 199 ? price / sma200Series[index - 199] : NaN
  )).filter(Number.isFinite);
  const mayer = trendRisk(trendPercentile(mayerSeries, mayerMultiple), true);
  const weekly = filterCompletedWeeklyCloses(createWeeklyCloses(candles), asOfUtc);
  const closes = weekly.map((row) => row.close);
  const sma20 = smaValues(closes, 20).at(-1);
  const ema21 = emaValues(closes, 21).at(-1);
  const mid = (sma20 + ema21) / 2;
  const distance = ((snapshotPrice - mid) / mid) * 100;
  const bmsb = trendRisk(Math.max(1, Math.min(99, 50 + (distance * 2))), false);
  const rsi = rsiValues(closes, 14);
  const weeklyRsi = trendRisk(trendPercentile(rsi, rsi[rsi.length - 1]), false);
  const score = blendComponentScores({
    bmsb_distance: bmsb,
    mayer_stretch: mayer,
    weekly_rsi: weeklyRsi,
  }, LOCKED_OFFICIAL_BLENDS.trend_valuation);
  return { bmsb, mayer, weeklyRsi, score };
}

function change20(values) {
  const last = values[values.length - 1];
  const prior = values[values.length - 20];
  return ((last - prior) / prior) * 100;
}

function changeSeries(values) {
  const out = [];
  for (let i = 20; i < values.length - 20; i += 1) {
    const change = ((values[i] - values[i - 20]) / values[i - 20]) * 100;
    if (Number.isFinite(change)) out.push(change);
  }
  return out;
}

function macroPercentile(values, current) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  let count = 0;
  for (const value of sorted) {
    if (value <= current) count += 1;
    else break;
  }
  return sorted.length ? count / sorted.length : NaN;
}

function macroRisk(percentile) {
  const x = 3 * ((2 * percentile) - 1);
  return Math.round((1 / (1 + Math.exp(-x))) * 100);
}

function expectedVaryingMacro() {
  const evidence = macroEvidenceValues('varying_dxy');
  const dollar = macroRisk(macroPercentile(changeSeries(evidence.dxy), change20(evidence.dxy)));
  let rates = macroRisk(macroPercentile(changeSeries(evidence.dgs2), change20(evidence.dgs2)));
  const yieldCurve = evidence.dgs10.at(-1) - evidence.dgs2.at(-1);
  if (yieldCurve < 0) rates = Math.min(100, rates + 15);
  const latestVix = evidence.vix.at(-1);
  let vix = macroRisk(macroPercentile(evidence.vix, latestVix));
  const vix7 = evidence.vix.slice(-7).reduce((sum, value) => sum + value, 0) / 7;
  const prior = evidence.vix.slice(-30, -7);
  const vix30 = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  const momentum = vix7 - vix30;
  if (momentum > 2) vix = Math.min(100, vix + 10);
  else if (momentum < -2) vix = Math.max(0, vix - 5);
  const score = blendComponentScores({
    dxy_20d: dollar,
    us2y_20d: rates,
    vix_pct: vix,
  }, LOCKED_OFFICIAL_BLENDS.macro_overlay);
  return {
    dollar,
    rates,
    vix,
    dxyChange: change20(evidence.dxy),
    rateChange: change20(evidence.dgs2),
    latestVix,
    yieldCurve,
    sourceDate: evidence.dates.at(-1),
    score,
  };
}

function fulfilled(value) {
  return { status: 'fulfilled', value };
}

function deriveStablecoinObservation(result) {
  const stamps = (result.coins || [])
    .map((coin) => coin.endpoint_timestamp_iso)
    .filter((value) => typeof value === 'string');
  if (!stamps.length) {
    return { iso: null, derivation: 'missing_eligible_coin_endpoint' };
  }
  return {
    iso: stamps.slice().sort()[0],
    derivation: 'oldest eligible coin endpoint_timestamp_iso; not the scenario clock',
  };
}

function adaptV12TermSuccessor({ result, fundingRows, asOfUtc, forceEligible = false }) {
  const requiredSpot = requiredScoreEligibleSpotUtc(asOfUtc);
  const scoredSpot = result?.spot_observation_utc || null;
  const rawFunding = result?.latest_raw_funding_observation_utc || null;
  const provider = result?.selected_provider || null;
  const cadence = resolveFundingCadence({ provider: provider || 'okx', rows: fundingRows || [] });
  const expectedFunding = expectedLatestSlotUtc(asOfUtc, cadence);
  const providerFresh = isObservationAcceptable(rawFunding, expectedFunding);
  const scoredFresh = isObservationAcceptable(scoredSpot, requiredSpot);
  const eligible = Boolean(providerFresh && scoredFresh && Number.isFinite(result?.score) && result?.lastUpdated);
  return {
    eligible: forceEligible ? true : eligible,
    honest_eligible: eligible,
    reason: forceEligible
      ? 'mutated_include_stale'
      : !Number.isFinite(result?.score) ? 'unavailable'
        : !providerFresh ? 'raw_provider_not_fresh'
          : !scoredFresh ? 'scored_window_not_fresh'
            : !result?.lastUpdated ? 'missing_lastUpdated'
              : 'successor_eligible',
    lastUpdated: result?.lastUpdated || null,
    selected_provider: provider,
    raw_funding_observation_utc: rawFunding,
    scored_funding_observation_utc: result?.funding_observation_utc || null,
    raw_spot_observation_utc: result?.latest_raw_spot_observation_utc || null,
    scored_spot_observation_utc: scoredSpot,
    required_score_eligible_spot_utc: requiredSpot,
    expected_raw_funding_slot_utc: expectedFunding,
    derivation: 'raw funding slot versus provider cadence, and scored spot versus the completed-daily slot; lastUpdated is not rewritten',
  };
}

async function expectedComposite(values, termDecision, mutate) {
  const config = readJson('config/dashboard-config.json');
  const enabled = getFactorsArray(config);
  const factors = [];
  for (const factor of enabled) {
    const value = values[factor.key];
    let eligible = false;
    let reason = 'missing';
    if (factor.key === 'term_leverage') {
      eligible = termDecision.honest_eligible === true;
      reason = termDecision.reason;
    } else if (!value || !Number.isFinite(value.score)) {
      eligible = false;
      reason = value?.reason || 'unavailable';
    } else if (factor.key === 'etf_flows') {
      eligible = value.sourceTradingDate === value.expectedEligibleTradingDate;
      reason = eligible ? 'fresh_expected_eligible_trading_date' : 'stale_expected_eligible_trading_date';
    } else if (!value.lastUpdated) {
      eligible = false;
      reason = 'missing_lastUpdated';
    } else {
      const stalenessConfig = await getStalenessConfig(factor.key);
      const status = getStalenessStatus(value, stalenessConfig.ttlHours, {
        factorName: factor.key,
        asOf: GATE_AS_OF_UTC,
        latestDxyDate: value.latestDxyDate,
        latestDgs2Date: value.latestDgs2Date,
        latestVixDate: value.latestVixDate,
      });
      eligible = status.status === 'fresh';
      reason = status.reason;
    }
    if (mutate === 'exclude_stablecoins' && factor.key === 'stablecoins') {
      // Expectation stays honest. The loop override is applied later.
    }
    factors.push({
      key: factor.key,
      score: value?.score ?? null,
      weight: factor.weight,
      eligible,
      reason,
      lastUpdated: value?.lastUpdated || null,
      derivation: value?.derivation || null,
    });
  }
  const fresh = factors.filter((factor) => factor.eligible && Number.isFinite(factor.score));
  const includedWeight = fresh.reduce((sum, factor) => sum + factor.weight, 0);
  const weightedSum = fresh.reduce((sum, factor) => sum + factor.weight * factor.score, 0);
  const unavailable = factors.filter((factor) => !factor.eligible);
  return {
    factors,
    includedWeight,
    weightedSum,
    composite: includedWeight === 0 ? 50 : Math.round(weightedSum / includedWeight),
    healthOk: unavailable.length === 0,
  };
}

async function productionIntegrationAssertions(executed, unchanged, mutate = null, prefix = null) {
  const out = [];
  const stableObservation = deriveStablecoinObservation(executed.stable);
  const requiredProvenance = {
    stablecoins: stableObservation.iso,
    net_liquidity: executed.liquidity.lastUpdated || null,
    social_interest: executed.social.lastUpdated || null,
    term_leverage: executed.term.lastUpdated || null,
    trend_valuation: unchanged.trendResult.lastUpdated || null,
    macro_overlay: unchanged.macroResult.lastUpdated || null,
    etf_flows: unchanged.etfResult.selectedTradingDate || null,
  };
  let termResult = executed.term;
  let termFundingRows = executed.termFundingRows;
  if (mutate === 'include_stale_term') {
    termFundingRows = dropFundingDates(executed.termFundingRows, '2026-09-19', '2026-09-29');
    termResult = computeV12TermCandidate({
      asOfUtc: GATE_AS_OF_UTC,
      funding: { okx: termFundingRows },
      spotPrices: executed.termPrices,
    });
  }
  const scoredProvenance = {
    stablecoins: Number.isFinite(executed.stable.score) ? requiredProvenance.stablecoins : 'unscored',
    net_liquidity: Number.isFinite(executed.liquidity.score) ? requiredProvenance.net_liquidity : 'unscored',
    social_interest: Number.isFinite(executed.social.score) ? requiredProvenance.social_interest : 'unscored',
    term_leverage: Number.isFinite(termResult.score) ? termResult.lastUpdated : 'unscored',
    trend_valuation: Number.isFinite(unchanged.trendResult.score) ? requiredProvenance.trend_valuation : 'unscored',
    macro_overlay: Number.isFinite(unchanged.macroResult.score) ? requiredProvenance.macro_overlay : 'unscored',
    etf_flows: Number.isFinite(unchanged.etfResult.score) ? requiredProvenance.etf_flows : 'unscored',
  };
  const missingProvenance = Object.entries(scoredProvenance).filter(([, value]) => !value);
  if (missingProvenance.length) {
    out.push(fail('factor_provenance', 'a scored factor is missing source or scored timing', {
      missing: missingProvenance.map(([key]) => key),
      stable_derivation: stableObservation.derivation,
    }));
    return { assertions: out, instrumentation: null };
  }
  const honestDecision = adaptV12TermSuccessor({
    result: termResult,
    fundingRows: termFundingRows,
    asOfUtc: GATE_AS_OF_UTC,
    forceEligible: false,
  });
  const appliedDecision = adaptV12TermSuccessor({
    result: termResult,
    fundingRows: termFundingRows,
    asOfUtc: GATE_AS_OF_UTC,
    forceEligible: mutate === 'include_stale_term',
  });
  const values = {
    trend_valuation: {
      score: unchanged.trendResult.score,
      lastUpdated: unchanged.trendResult.lastUpdated,
      reason: unchanged.trendResult.reason,
      source_date: unchanged.trendResult.lastUpdated,
      derivation: 'computeTrendValuation writes lastUpdated from its clock; the gate freezes that clock to the scenario as-of',
    },
    stablecoins: {
      score: executed.stable.score,
      lastUpdated: stableObservation.iso,
      reason: executed.stable.reason || 'success',
      source_date: stableObservation.iso,
      derivation: stableObservation.derivation,
    },
    etf_flows: {
      score: unchanged.etfResult.score,
      lastUpdated: `${unchanged.etfResult.selectedTradingDate}T00:00:00.000Z`,
      reason: 'success',
      sourceTradingDate: unchanged.etfResult.selectedTradingDate,
      expectedEligibleTradingDate: unchanged.etfResult.expectedEligibleTradingDate,
      source_date: unchanged.etfResult.selectedTradingDate,
      derivation: 'selectedTradingDate from computeEtfCandidate; not the scenario clock',
    },
    net_liquidity: {
      score: executed.liquidity.score,
      lastUpdated: executed.liquidity.lastUpdated,
      reason: executed.liquidity.reason || 'success',
      source_date: executed.liquidity.selected_common_scoring_date,
      derivation: 'selected common Wednesday from the candidate',
    },
    term_leverage: {
      score: termResult.score,
      lastUpdated: termResult.lastUpdated,
      reason: termResult.reason || 'success',
      funding_observation_utc: termResult.funding_observation_utc,
      spot_observation_utc: termResult.spot_observation_utc,
      funding_provider: termResult.selected_provider,
      latest_raw_funding_observation_utc: termResult.latest_raw_funding_observation_utc,
      latest_raw_spot_observation_utc: termResult.latest_raw_spot_observation_utc,
      source_date: termResult.spot_observation_utc,
      derivation: 'candidate lastUpdated is the binding scored observation and is not replaced',
    },
    macro_overlay: {
      score: unchanged.macroResult.score,
      lastUpdated: unchanged.macroResult.lastUpdated,
      reason: unchanged.macroResult.reason || 'success',
      latestDxyDate: unchanged.macroResult.latestDxyDate,
      latestDgs2Date: unchanged.macroResult.latestDgs2Date,
      latestVixDate: unchanged.macroResult.latestVixDate,
      source_date: unchanged.macroResult.lastUpdated,
      derivation: 'macroSourceObservationUtc from the instrumented computeMacroOverlay result',
    },
    social_interest: {
      score: executed.social.score,
      lastUpdated: executed.social.lastUpdated,
      reason: executed.social.reason || 'success',
      source_date: executed.social.lastUpdated,
      derivation: 'candidate lastUpdated is min(search fetch, score-eligible price observation)',
    },
  };
  const expectation = await expectedComposite(values, honestDecision, mutate);
  const settled = {
    trend_valuation: fulfilled(values.trend_valuation),
    onchain: fulfilled({ score: 99, lastUpdated: '2026-01-01T00:00:00.000Z', reason: 'must_not_map' }),
    stablecoins: fulfilled(values.stablecoins),
    etf_flows: fulfilled(values.etf_flows),
    net_liquidity: fulfilled(values.net_liquidity),
    term_leverage: fulfilled(values.term_leverage),
    macro_overlay: fulfilled(values.macro_overlay),
    social_interest: fulfilled(values.social_interest),
  };
  if (mutate === 'swap_stable_liquidity') {
    const stableScore = settled.stablecoins.value.score;
    settled.stablecoins.value.score = settled.net_liquidity.value.score;
    settled.net_liquidity.value.score = stableScore;
  }
  if (mutate === 'include_stale_term') {
    settled.term_leverage.value = {
      ...settled.term_leverage.value,
      score: executed.term.score,
      derivation: 'test-only boundary retained the stale scored spot and applied the finite same-as-of score',
    };
  }
  const eligibilityOverride = mutate === 'exclude_stablecoins' ? { stablecoins: 'stale' } : null;
  const integrated = await runProductionComposite(settled, GATE_AS_OF_UTC, {
    termSuccessorDecision: appliedDecision,
    eligibilityOverride,
  });
  const byKey = Object.fromEntries(integrated.result.factors.map((row) => [row.key, row]));
  const mappingOk = expectation.factors.every((factor) => byKey[factor.key]?.score === factor.score);
  out.push(!byKey.onchain && mappingOk
    ? pass('composite_factor_mapping', 'every enabled factor keeps its own score and disabled On-chain is omitted', {
      keys: integrated.result.factors.map((row) => row.key),
    })
    : fail('composite_factor_mapping', 'every enabled factor keeps its own score and disabled On-chain is omitted', {
      expected: expectation.factors.map((factor) => [factor.key, factor.score]),
      actual: integrated.result.factors.map((row) => [row.key, row.score]),
    }));
  const eligibilityOk = expectation.factors.every((factor) => (
    (byKey[factor.key]?.status === 'fresh') === factor.eligible
  ));
  out.push(eligibilityOk
    ? pass('factor_eligibility', 'eligibility was fixed from the scenario before the production loop ran', {
      expected: expectation.factors.map((factor) => [factor.key, factor.eligible]),
    })
    : fail('factor_eligibility', 'eligibility was fixed from the scenario before the production loop ran', {
      expected: expectation.factors.map((factor) => [factor.key, factor.eligible, factor.reason]),
      actual: integrated.result.factors.map((row) => [row.key, row.status]),
    }));
  out.push(integrated.result.totalWeight === expectation.includedWeight
    && integrated.result.weightedSum === expectation.weightedSum
    && integrated.result.composite === expectation.composite
    ? pass('composite_included_weight', 'included weight, weighted sum, and composite match the precomputed scenario', expectation)
    : fail('composite_included_weight', 'included weight, weighted sum, and composite match the precomputed scenario', {
      expected: expectation,
      totalWeight: integrated.result.totalWeight,
      weightedSum: integrated.result.weightedSum,
      composite: integrated.result.composite,
    }));
  const termRow = byKey.term_leverage;
  const timingDistinct = !Number.isFinite(termResult.score)
    || (honestDecision.raw_funding_observation_utc !== termResult.funding_observation_utc);
  out.push(termRow?.lastUpdated === termResult.lastUpdated
    && honestDecision.scored_spot_observation_utc === termResult.spot_observation_utc
    && timingDistinct
    && (termRow?.status === 'fresh') === honestDecision.honest_eligible
    ? pass('term_successor_integration', 'successor adapter composes raw-provider freshness and scored-window eligibility without rewriting lastUpdated', honestDecision)
    : fail('term_successor_integration', 'successor adapter composes raw-provider freshness and scored-window eligibility without rewriting lastUpdated', {
      honest: honestDecision,
      applied: appliedDecision,
      production_lastUpdated: termRow?.lastUpdated,
      production_status: termRow?.status,
      scenario_lastUpdated: termResult.lastUpdated,
    }));
  const provenanceOk = expectation.factors.every((factor) => byKey[factor.key]?.lastUpdated === factor.lastUpdated);
  out.push(provenanceOk
    ? pass('factor_provenance', 'source or scored timestamps are preserved for every enabled factor', requiredProvenance)
    : fail('factor_provenance', 'source or scored timestamps are preserved for every enabled factor', {
      expected: expectation.factors.map((factor) => [factor.key, factor.lastUpdated, factor.derivation]),
      actual: integrated.result.factors.map((row) => [row.key, row.lastUpdated]),
    }));
  const expectedFailed = expectation.factors.filter((factor) => !factor.eligible).map((factor) => factor.key);
  const actualFailed = integrated.result.factors.filter((row) => row.status !== 'fresh').map((row) => row.key);
  const expectedHealth = decidePostComputeHealthCheck({ failedFactors: expectedFailed });
  const actualHealth = decidePostComputeHealthCheck({ failedFactors: actualFailed });
  out.push(actualHealth.ok === expectedHealth.ok && actualHealth.ok === expectation.healthOk
    ? pass('publication_health_from_expectation', 'publication health matches the precomputed unavailable set', {
      healthOk: expectation.healthOk,
      expectedFailed,
      actualFailed,
    })
    : fail('publication_health_from_expectation', 'publication health matches the precomputed unavailable set', {
      expectedFailed,
      actualFailed,
      expectedHealth,
      actualHealth,
    }));
  const corrupted = structuredClone(executed.term);
  delete corrupted.components?.funding?.percentile;
  const reuse = mutate === 'cache_accept'
    ? true
    : canReuseV12TermCache({ current: executed.term, cached: corrupted });
  out.push(reuse === false
    ? pass('term_cache_rejection', 'malformed Term cache is rejected', { reuse })
    : fail('term_cache_rejection', 'malformed Term cache is rejected', { reuse, injected_acceptance: mutate === 'cache_accept' }));
  if (!mutate && !prefix) {
    const blank = Object.fromEntries(Object.keys(settled).map((key) => [key, fulfilled({
      score: null,
      lastUpdated: null,
      reason: 'unavailable',
    })]));
    const none = await runProductionComposite(blank, GATE_AS_OF_UTC, {});
    const noneHealth = decidePostComputeHealthCheck({
      failedFactors: none.result.factors.map((row) => row.key),
    });
    out.push(none.result.composite === 50 && none.result.totalWeight === 0 && noneHealth.ok === false
      ? pass('composite_zero_weight_health', 'zero included weight stays 50 and does not satisfy publication health', {
        composite: none.result.composite,
        totalWeight: none.result.totalWeight,
        health: noneHealth.reason,
      })
      : fail('composite_zero_weight_health', 'zero included weight stays 50 and does not satisfy publication health', {
        composite: none.result.composite,
        totalWeight: none.result.totalWeight,
        health: noneHealth,
      }));
  }
  if (prefix) {
    for (const item of out) item.id = `${prefix}__${item.id}`;
  }
  return { assertions: out, instrumentation: integrated.instrumentation };
}

function reverseObservations(source) {
  return { ...source, observations: source.observations.slice().reverse() };
}

function scenarioBundles(bundle) {
  const emptyStable = {
    ...bundle.stable,
    responses: bundle.stable.responses.map(() => ({ market_caps: [] })),
  };
  const emptyLiquidity = {
    ...bundle.liquidity,
    rrp: { ...bundle.liquidity.rrp, observations: [] },
  };
  const emptySocial = { trendsData: { coins: [] }, priceData: { prices: [] } };
  const emptyTerm = { funding: [], prices: bundle.term.prices };
  const malformedTerm = {
    funding: bundle.term.funding.concat([{
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse('2026-09-20T08:00:00.000Z')),
      fundingRate: null,
    }]),
    prices: bundle.term.prices,
  };
  const reordered = {
    stable: {
      ...bundle.stable,
      responses: bundle.stable.responses.map((response) => ({
        market_caps: response.market_caps.slice().reverse(),
      })),
    },
    liquidity: {
      walcl: reverseObservations(bundle.liquidity.walcl),
      rrp: reverseObservations(bundle.liquidity.rrp),
      wtregen: reverseObservations(bundle.liquidity.wtregen),
    },
    social: {
      trendsData: { ...bundle.social.trendsData, coins: bundle.social.trendsData.coins.slice().reverse() },
      priceData: { prices: bundle.social.priceData.prices.slice().reverse() },
    },
    term: {
      funding: bundle.term.funding.slice().reverse(),
      prices: bundle.term.prices.slice().reverse(),
    },
  };
  return [
    { id: 'stablecoins_unavailable', bundle: { ...bundle, stable: emptyStable }, down: 'stable' },
    { id: 'net_liquidity_unavailable', bundle: { ...bundle, liquidity: emptyLiquidity }, down: 'liquidity' },
    { id: 'social_unavailable', bundle: { ...bundle, social: emptySocial }, down: 'social' },
    { id: 'term_unavailable', bundle: { ...bundle, term: emptyTerm }, down: 'term' },
    {
      id: 'joint_unavailable',
      bundle: { stable: emptyStable, liquidity: emptyLiquidity, social: emptySocial, term: emptyTerm },
      down: 'joint',
    },
    { id: 'malformed_current_valid_cache', bundle: { ...bundle, term: malformedTerm }, down: 'malformed' },
    { id: 'reordered_equivalent', bundle: reordered, down: 'reordered' },
  ];
}

async function scenarioCoverage(bundle, unchanged, baseline) {
  const out = [];
  const validCache = runCandidates(bundle).term;
  for (const scenario of scenarioBundles(bundle)) {
    const executed = runCandidates(scenario.bundle);
    executed.termFundingRows = scenario.bundle.term.funding;
    executed.termPrices = scenario.bundle.term.prices;
    const keys = ['stable', 'liquidity', 'social', 'term'];
    if (scenario.down === 'joint') {
      out.push(keys.every((key) => !finiteScore(executed[key]))
        ? pass('joint_unavailable', 'joint unavailability recomputes all four candidates together', summarize(executed))
        : fail('joint_unavailable', 'joint unavailability recomputes all four candidates together', summarize(executed)));
    } else if (scenario.down === 'reordered') {
      out.push(JSON.stringify(summarize(executed)) === JSON.stringify(summarize(baseline))
        ? pass('reordered_equivalent_bundle', 'reordered equivalent evidence recomputes all four candidates', summarize(executed))
        : fail('reordered_equivalent_bundle', 'reordered equivalent evidence recomputes all four candidates', {
          scenario: summarize(executed),
          baseline: summarize(baseline),
        }));
    } else if (scenario.down === 'malformed') {
      const reuse = canReuseV12TermCache({ current: executed.term, cached: validCache });
      out.push(executed.term.score === null && reuse === false
        ? pass('malformed_current_valid_cache', 'malformed current Term evidence cannot reuse a valid cache', {
          reason: executed.term.reason,
          reuse,
        })
        : fail('malformed_current_valid_cache', 'malformed current Term evidence cannot reuse a valid cache', {
          score: executed.term.score,
          reason: executed.term.reason,
          reuse,
        }));
    } else {
      const others = keys.filter((key) => key !== scenario.down);
      out.push(!finiteScore(executed[scenario.down]) && others.every((key) => finiteScore(executed[key]))
        ? pass(`${scenario.id}_isolated`, 'one changed factor is unavailable and the other three are recomputed', summarize(executed))
        : fail(`${scenario.id}_isolated`, 'one changed factor is unavailable and the other three are recomputed', summarize(executed)));
    }
    const integration = await productionIntegrationAssertions(executed, unchanged, null, scenario.id);
    out.push(...integration.assertions);
  }
  return out;
}

const REQUIREMENT_MATRIX = [
  { id: 'identity_candidate', section: '13 identity', adjudication: null, assertions: ['candidate_identity'], support: [] },
  { id: 'identity_production', section: '13 identity', adjudication: null, assertions: ['production_identity'], support: [] },
  { id: 'identity_ssot_weights', section: '13 identity', adjudication: null, assertions: ['factor_weights', 'pillar_weights', 'subweights', 'band_boundaries'], support: [] },
  { id: 'unchanged_trend', section: '13 unchanged', adjudication: null, assertions: ['trend_full_execution', 'trend_blend'], support: [] },
  { id: 'unchanged_etf', section: '13 unchanged', adjudication: null, assertions: ['etf_universe', 'etf_executed_selection'], support: [] },
  { id: 'unchanged_macro', section: '13 unchanged', adjudication: null, assertions: ['macro_cboe_primary', 'macro_fred_fallback', 'macro_varying_coefficients', 'macro_unavailable', 'macro_stale_cboe_fallback'], support: [] },
  { id: 'r07_stablecoins', section: '13 changed', adjudication: 'R07', assertions: ['stablecoin_calibration', 'stablecoin_exact_24h_lag', 'stablecoin_prior_calibration', 'stablecoin_coverage_floor'], support: ['scripts/etl/__tests__/v1_2_stablecoin_candidate.test.mjs'] },
  { id: 'r01_r08_net_liquidity', section: '13 changed', adjudication: 'R01/R08', assertions: ['net_liquidity_multipliers', 'net_liquidity_rrp_contract', 'net_liquidity_fingerprint_revision', 'net_liquidity_cache_revision'], support: ['scripts/etl/__tests__/v1_2_net_liquidity_candidate.test.mjs'] },
  { id: 'r03_social', section: '13 changed', adjudication: 'R03', assertions: ['social_both_components', 'social_no_renormalization', 'social_volatility_excluded'], support: ['scripts/etl/__tests__/v1_2_social_candidate.test.mjs'] },
  { id: 'r09_term', section: '13 changed', adjudication: 'R09', assertions: ['term_c1_c13_current', 'term_scored_cutoff_freshness', 'term_successor_integration', 'term_cache_provenance'], support: ['scripts/etl/__tests__/v1_2_term_candidate.test.mjs'] },
  { id: 'missingness', section: '13 missingness', adjudication: null, assertions: ['social_no_renormalization', 'invalid_current_cache', 'term_cache_rejection', 'malformed_current_valid_cache', 'factor_provenance'], support: [] },
  { id: 'composite', section: '13 composite', adjudication: null, assertions: ['composite_factor_mapping', 'factor_eligibility', 'composite_included_weight', 'composite_zero_weight', 'composite_zero_weight_health', 'publication_health', 'onchain_disabled', 'adjustments_gated', 'band_mapping'], support: [] },
  { id: 'scenario_coverage', section: '13 composite', adjudication: null, assertions: ['coordinated_all_eligible', 'stablecoins_unavailable_isolated', 'net_liquidity_unavailable_isolated', 'social_unavailable_isolated', 'term_unavailable_isolated', 'joint_unavailable', 'reordered_equivalent_bundle'], support: [] },
  { id: 'scientific_restrictions', section: '13 scientific', adjudication: null, assertions: ['scientific_restrictions'], support: [] },
];

function requirementMatrix(assertions) {
  const byId = new Map(assertions.map((item) => [item.id, item.status]));
  return REQUIREMENT_MATRIX.map((row) => {
    const missing = row.assertions.filter((id) => !byId.has(id));
    const failed = row.assertions.filter((id) => byId.get(id) && byId.get(id) !== 'PASS');
    const status = missing.length || failed.length ? 'FAIL' : 'PASS';
    return { ...row, status, missing, failed };
  });
}

export async function runV12StructuralRegression({ mutate = null } = {}) {
  const hashesBefore = Object.fromEntries(PROTECTED_PATHS.map((item) => [item, fileSha(item)]));
  const config = readJson('config/dashboard-config.json');
  const factorsSource = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  const compositeFn = loadCanonicalComposite(factorsSource);
  const bundle = {
    stable: stablecoinEvidence(),
    liquidity: wednesdaySources(),
    social: socialEvidence(),
    term: termEvidence(),
  };
  const first = runCandidates(bundle);
  first.termFundingRows = bundle.term.funding;
  first.termPrices = bundle.term.prices;
  const second = runCandidates(bundle);
  const unchanged = await unchangedFactorAssertions(config);
  const identityConfig = mutate === 'weight'
    ? { ...config, factors: { ...config.factors, term_leverage: { ...config.factors.term_leverage, weight: 1 } } }
    : config;
  const integration = await productionIntegrationAssertions(first, unchanged, mutate);
  const gateImports = ['scripts/research/lib/v1-2-structural-regression.mjs', 'scripts/research/lib/v1-2-gate-instrumentation.mjs']
    .flatMap((file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8').split(/\r?\n/))
    .filter((line) => line.startsWith('import'));
  const scientific = gateImports.every((line) => !/h8|model_eras|pnl|returns/i.test(line));
  const assertions = [
    ...identityAssertions(identityConfig, first),
    ...isolationAssertions(),
    ...coordinatedAssertions(bundle, first, second),
    ...contractAssertions(bundle, first),
    ...unchanged.assertions,
    ...compositeAssertions(config, compositeFn),
    ...integration.assertions,
    ...(mutate ? [] : await scenarioCoverage(bundle, unchanged, first)),
    scientific
      ? pass('scientific_restrictions', 'the gate does not use H8, future returns, strategy P&L, or future G-Scores', { used: false })
      : fail('scientific_restrictions', 'the gate does not use H8, future returns, strategy P&L, or future G-Scores', { used: true }),
  ];
  const matrix = requirementMatrix(assertions);
  assertions.push(matrix.every((row) => row.status === 'PASS')
    ? pass('requirement_matrix', 'architecture-freeze section 13 and the four adjudications have supporting assertions', matrix)
    : fail('requirement_matrix', 'architecture-freeze section 13 and the four adjudications have supporting assertions', matrix.filter((row) => row.status !== 'PASS')));
  const hashesAfter = Object.fromEntries(PROTECTED_PATHS.map((item) => [item, fileSha(item)]));
  const mutated = PROTECTED_PATHS.filter((item) => hashesBefore[item] !== hashesAfter[item]);
  assertions.push(mutated.length === 0
    ? pass('protected_files_unmodified', 'protected production and candidate files were not mutated', { count: PROTECTED_PATHS.length })
    : fail('protected_files_unmodified', 'protected production and candidate files were not mutated', mutated));

  const failures = assertions.filter((item) => item.status === 'FAIL' || item.status === 'BLOCKED');
  const limitations = assertions.filter((item) => item.status === 'LIMITATION');
  const evidence = {
    gate: GATE_ID,
    fixture_id: FIXTURE_ID,
    as_of_utc: GATE_AS_OF_UTC,
    production_activation_authorized: false,
    starting_base_sha: '6f228082a70c0cb758718346da98f31caed0f221',
    source_hashes: hashesBefore,
    gate_hashes: {
      regression: hashText(fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/v1-2-structural-regression.mjs'), 'utf8')),
      instrumentation: hashText(fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/v1-2-gate-instrumentation.mjs'), 'utf8')),
    },
    composite_instrumentation: integration.instrumentation,
    active_identity: {
      model_version: config.model_version,
      implementation_revision: config.implementation_revision,
      ssot_version: config.ssot_version,
    },
    candidate_identity: {
      model_version: 'v1.2.0',
      implementation_revision: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
    },
    composite_function_sha256: compositeFn?.sha256 || null,
    requirement_matrix: matrix,
    assertions,
    executed_scores: summarize(first),
  };
  return {
    gate: GATE_ID,
    evidence_sha256: sha256(canonicalize(evidence)),
    overall_disposition: failures.length ? 'BLOCKED' : (limitations.length ? 'PASS_WITH_LIMITATIONS' : 'PASS'),
    production_activation_authorized: false,
    blockers: failures,
    limitations,
    counts: {
      pass: assertions.filter((item) => item.status === 'PASS').length,
      fail: failures.length,
      limitation: limitations.length,
    },
    evidence,
    run_metadata_excluded_from_evidence_hash: {
      node: process.version,
      platform: process.platform,
      tested_revision: readGitRevision(),
      starting_base_sha: readGitRef('origin/main'),
      trend_descriptive_score: unchanged.trendDescriptive,
    },
};
}

function readRepositorySha() {
  const head = fs.readFileSync(path.join(REPO_ROOT, '.git/HEAD'), 'utf8').trim();
  if (head.startsWith('ref: ')) {
    return fs.readFileSync(path.join(REPO_ROOT, '.git', head.slice(5)), 'utf8').trim();
  }
  return head;
}

export function writeStructuralRegressionReport(outputDirectory, report) {
  assertReportDirectoryOutsideRepo(outputDirectory, REPO_ROOT);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const target = path.join(outputDirectory, 'v1-2-structural-regression.json');
  assertReportDirectoryOutsideRepo(target, REPO_ROOT);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

/** Negative control. A wrong expectation must not be reported as PASS. */
export function corruptionProbeFails() {
  const composite = loadCanonicalComposite(fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8'));
  const actual = composite.fn([], 0, 0);
  return actual === 50 && (actual === 0) === false;
}
