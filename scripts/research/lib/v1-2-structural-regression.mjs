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
  const social = computeV12SocialCandidate(bundle.social);
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
  const productionOk = config.model_version === 'v1.1.2'
    && config.implementation_revision === 'etf-sosovalue-vix-cboe-2026-09'
    && config.ssot_version === '2.1.1';
  out.push(productionOk
    ? pass('production_identity', 'active production identity', 'v1.1.2 / etf-sosovalue-vix-cboe-2026-09 / SSOT 2.1.1')
    : fail('production_identity', 'active production identity', {
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
  const isolated = !/candidates\/v1_2\//.test(factors)
    && !/v1-2-structural-regression/.test(factors)
    && !/candidates\/v1_2\//.test(compute)
    && !/v1-2-structural-regression/.test(compute);
  return [isolated
    ? pass('production_isolation', 'production entry points do not import candidates or this gate', {
      factors_imports_candidate: false,
      compute_imports_candidate: false,
    })
    : fail('production_isolation', 'production entry points do not import candidates or this gate', {})];
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
  const componentLine = (trendResult.details || []).find((row) => row.label === "Component Scores")?.value || "";
  const componentNumbers = [...componentLine.matchAll(/-?\d+/g)].map((match) => Number(match[0]));
  const componentBlend = componentNumbers.length >= 3
    ? blendComponentScores({
      bmsb_distance: componentNumbers[0],
      mayer_stretch: componentNumbers[1],
      weekly_rsi: componentNumbers[2],
    }, LOCKED_OFFICIAL_BLENDS.trend_valuation)
    : null;
  out.push(Number.isFinite(trendResult.score)
    && trendResult.reason === "success"
    && trendResult.lastUpdated === GATE_AS_OF_UTC
    && trendResult.score === componentBlend
    ? pass("trend_full_execution", "instrumented Trend production function with a frozen clock and supplied prices", {
      score: trendResult.score,
      lastUpdated: trendResult.lastUpdated,
      instrumentation: trendRun.instrumentation,
    })
    : fail("trend_full_execution", "instrumented Trend production function with a frozen clock and supplied prices", {
      score: trendResult.score,
      reason: trendResult.reason,
      lastUpdated: trendResult.lastUpdated,
      componentLine,
      componentBlend,
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

function fulfilled(value) {
  return { status: 'fulfilled', value };
}

async function productionIntegrationAssertions(executed, unchanged, mutate = null) {
  const out = [];
  const settled = {
    trend_valuation: fulfilled({
      score: unchanged.trendResult.score,
      lastUpdated: unchanged.trendResult.lastUpdated,
      reason: unchanged.trendResult.reason,
    }),
    onchain: fulfilled({ score: 99, lastUpdated: GATE_AS_OF_UTC, reason: 'must_not_map' }),
    stablecoins: fulfilled({
      score: executed.stable.score,
      lastUpdated: executed.stable.lastUpdated || GATE_AS_OF_UTC,
      reason: executed.stable.reason || 'success',
    }),
    etf_flows: fulfilled({
      score: unchanged.etfResult.score,
      lastUpdated: GATE_AS_OF_UTC,
      reason: 'success',
      sourceTradingDate: unchanged.etfResult.selectedTradingDate,
      expectedEligibleTradingDate: unchanged.etfResult.expectedEligibleTradingDate,
    }),
    net_liquidity: fulfilled({
      score: executed.liquidity.score,
      lastUpdated: executed.liquidity.lastUpdated || GATE_AS_OF_UTC,
      reason: executed.liquidity.reason || 'success',
    }),
    term_leverage: fulfilled({
      score: executed.term.score,
      lastUpdated: executed.term.lastUpdated,
      reason: executed.term.reason || 'success',
      funding_observation_utc: executed.term.funding_observation_utc,
      spot_observation_utc: executed.term.spot_observation_utc,
      funding_provider: executed.term.selected_provider,
    }),
    macro_overlay: fulfilled({
      score: unchanged.macroResult.score,
      lastUpdated: unchanged.macroResult.lastUpdated,
      reason: unchanged.macroResult.reason || 'success',
      latestDxyDate: unchanged.macroResult.latestDxyDate,
      latestDgs2Date: unchanged.macroResult.latestDgs2Date,
      latestVixDate: unchanged.macroResult.latestVixDate,
    }),
    social_interest: fulfilled({
      score: executed.social.score,
      lastUpdated: executed.social.lastUpdated || GATE_AS_OF_UTC,
      reason: executed.social.reason || 'success',
    }),
  };
  if (mutate === 'swap_keys') {
    const trend = settled.trend_valuation;
    settled.trend_valuation = settled.social_interest;
    settled.social_interest = trend;
  }
  const asOf = mutate === 'stale_as_term' ? executed.term.lastUpdated : GATE_AS_OF_UTC;
  const integrated = await runProductionComposite(settled, asOf);
  const rows = integrated.result.factors;
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  const termAdapter = adaptV12TermCandidateForStatus(executed.term, GATE_AS_OF_UTC);
  const trendMapped = byKey.trend_valuation?.score === unchanged.trendResult.score;
  out.push(!byKey.onchain && trendMapped
    ? pass('composite_factor_mapping', 'production loop maps by factor key and omits disabled On-chain', {
      keys: rows.map((row) => row.key),
    })
    : fail('composite_factor_mapping', 'production loop maps by factor key and omits disabled On-chain', {
      keys: rows.map((row) => row.key),
      trend: byKey.trend_valuation?.score,
      expected_trend: unchanged.trendResult.score,
    }));
  const termRow = byKey.term_leverage;
  const termStaleAtGateAsOf = mutate !== 'stale_as_term';
  out.push(termAdapter.selected_provider === executed.term.selected_provider
    && termAdapter.scored_spot_observation_utc === executed.term.spot_observation_utc
    && termAdapter.raw_spot_observation_utc === executed.term.latest_raw_spot_observation_utc
    && termAdapter.lastUpdated === executed.term.lastUpdated
    && termRow?.lastUpdated === executed.term.lastUpdated
    && (termStaleAtGateAsOf ? termRow?.status === 'stale' : termRow?.status === 'fresh')
    ? pass('term_adapter_on_production_path', 'Term adapter keeps scored timing and production staleness is not rewritten', {
      adapter_status: termAdapter.status,
      production_status: termRow?.status,
      lastUpdated: termRow?.lastUpdated,
      scored_spot: termAdapter.scored_spot_observation_utc,
      raw_spot: termAdapter.raw_spot_observation_utc,
    })
    : fail('term_adapter_on_production_path', 'Term adapter keeps scored timing and production staleness is not rewritten', {
      adapter: termAdapter,
      production: termRow,
    }));
  const fresh = rows.filter((row) => row.status === 'fresh');
  const includedWeight = fresh.reduce((sum, row) => sum + row.weight, 0);
  const weightedSum = fresh.reduce((sum, row) => sum + row.weight * row.score, 0);
  const expectedComposite = includedWeight === 0 ? 50 : Math.round(weightedSum / includedWeight);
  out.push(integrated.result.totalWeight === includedWeight
    && integrated.result.weightedSum === weightedSum
    && integrated.result.composite === expectedComposite
    && fresh.every((row) => row.key !== 'onchain')
    && (termStaleAtGateAsOf ? !fresh.some((row) => row.key === 'term_leverage') : fresh.some((row) => row.key === 'term_leverage'))
    ? pass('composite_included_weight', 'only fresh enabled factors enter the production weighted sum', {
      composite: integrated.result.composite,
      totalWeight: integrated.result.totalWeight,
      fresh: fresh.map((row) => row.key),
    })
    : fail('composite_included_weight', 'only fresh enabled factors enter the production weighted sum', {
      composite: integrated.result.composite,
      expectedComposite,
      totalWeight: integrated.result.totalWeight,
      includedWeight,
      fresh: fresh.map((row) => row.key),
    }));
  const withoutSocial = {
    ...settled,
    social_interest: fulfilled({ score: null, lastUpdated: null, reason: 'social_component_unavailable' }),
  };
  const missingSocial = await runProductionComposite(withoutSocial, GATE_AS_OF_UTC);
  const socialRow = missingSocial.result.factors.find((row) => row.key === 'social_interest');
  out.push(socialRow?.status === 'excluded' && missingSocial.result.totalWeight === integrated.result.totalWeight - (byKey.social_interest?.status === 'fresh' ? byKey.social_interest.weight : 0)
    ? pass('composite_missing_social', 'a null Social score is excluded and the remaining fresh weight is renormalized by the production loop', {
      social: socialRow?.status,
      totalWeight: missingSocial.result.totalWeight,
      composite: missingSocial.result.composite,
    })
    : fail('composite_missing_social', 'a null Social score is excluded', {
      social: socialRow,
      totalWeight: missingSocial.result.totalWeight,
      baseline: integrated.result.totalWeight,
    }));
  const empty = Object.fromEntries(Object.keys(settled).map((key) => [key, fulfilled({ score: null, reason: 'unavailable' })]));
  const none = await runProductionComposite(empty, GATE_AS_OF_UTC);
  const health = decidePostComputeHealthCheck({
    failedFactors: none.result.factors.filter((row) => row.status !== 'fresh').map((row) => row.key),
  });
  out.push(none.result.composite === 50 && none.result.totalWeight === 0 && health.ok === false
    ? pass('composite_zero_weight_health', 'zero included weight stays 50 and does not satisfy publication health', {
      composite: none.result.composite,
      health: health.reason,
    })
    : fail('composite_zero_weight_health', 'zero included weight stays 50 and does not satisfy publication health', {
      composite: none.result.composite,
      totalWeight: none.result.totalWeight,
      health,
    }));
  if (mutate === 'cache') {
    const corrupted = structuredClone(executed.term);
    delete corrupted.components.funding.percentile;
    const reuse = canReuseV12TermCache({ current: executed.term, cached: corrupted });
    out.push(reuse === true
      ? pass('cache_mutation_control', 'corrupted cache was incorrectly accepted', { reuse })
      : fail('cache_mutation_control', 'corrupted cache must not be accepted', { reuse }));
  }
  return { assertions: out, instrumentation: integrated.instrumentation };
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
  const second = runCandidates(bundle);
  const unchanged = await unchangedFactorAssertions(config);
  const identityConfig = mutate === 'weight'
    ? { ...config, factors: { ...config.factors, term_leverage: { ...config.factors.term_leverage, weight: 1 } } }
    : config;
  const integration = await productionIntegrationAssertions(first, unchanged, mutate);
  const assertions = [
    ...identityAssertions(identityConfig, first),
    ...isolationAssertions(),
    ...coordinatedAssertions(bundle, first, second),
    ...contractAssertions(bundle, first),
    ...unchanged.assertions,
    ...compositeAssertions(config, compositeFn),
    ...integration.assertions,
  ];
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
    source_hashes: hashesBefore,
    composite_function_sha256: compositeFn?.sha256 || null,
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
