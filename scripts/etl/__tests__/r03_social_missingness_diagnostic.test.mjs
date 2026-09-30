import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  CURRENT_NEUTRAL_DEFAULT,
  FROZEN_INVARIANT,
  FROZEN_MISSINGNESS_CONTRACT,
  OFFICIAL_SOCIAL_COMPONENT_KEYS,
  OFFICIAL_SOCIAL_WEIGHTS,
  R03_SCHEMA,
  assertFrozenSocialMissingnessFixture,
  buildNonFiniteMomentumFixture,
  buildOfflineR03Report,
  characterizePriceMomentumEvidence,
  characterizeTrendingEvidence,
  evaluateC3EligiblePriorObservation,
  evaluateSocialCacheDecisionScenarios,
  hasSocialDataChanged,
  loadFrozenSocialMissingnessFixture,
  scoreC0CurrentNeutralDefault,
  scoreC1AvailableComponentRenormalization,
  scoreC2RequireBothComponents,
} from '../../research/lib/r03-social-missingness-diagnostic.mjs';
import { assertOutsideRepository } from '../../research/diagnose-r03-social-missingness.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOCIAL_CACHE_PATH = path.join(
  REPO_ROOT,
  'public/data/cache/social_interest/social_interest_cache.json'
);

test('1. frozen missingness fixture identity remains unchanged', () => {
  const before = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/__tests__/fixtures/social-missingness-semantics.json'),
    'utf8'
  );
  const document = assertFrozenSocialMissingnessFixture(loadFrozenSocialMissingnessFixture());
  assert.equal(document.contract, FROZEN_MISSINGNESS_CONTRACT);
  assert.equal(document.invariant, FROZEN_INVARIANT);
  const after = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/__tests__/fixtures/social-missingness-semantics.json'),
    'utf8'
  );
  assert.equal(before, after);
});

test('2. official Social scored keys are exactly trending + momentum', () => {
  assert.deepEqual([...OFFICIAL_SOCIAL_COMPONENT_KEYS], [
    'coingecko_trending_rank',
    'btc_price_momentum_7d',
  ]);
});

test('3. official weights are 0.70 / 0.30', () => {
  assert.equal(OFFICIAL_SOCIAL_WEIGHTS.coingecko_trending_rank, 0.7);
  assert.equal(OFFICIAL_SOCIAL_WEIGHTS.btc_price_momentum_7d, 0.3);
  assert.deepEqual(LOCKED_OFFICIAL_BLENDS.social_interest, {
    coingecko_trending_rank: 0.7,
    btc_price_momentum_7d: 0.3,
  });
});

test('4. volatility is not an official scored component', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'a'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(report.official_component_contract.volatility_is_official_scored_component, false);
  assert.equal(report.official_component_contract.volatility_inventory_only, true);
});

test('5. current trending missing -> Search neutral 50', () => {
  const trending = characterizeTrendingEvidence({
    coins: [{ item: { id: 'ethereum', symbol: 'eth' } }],
  });
  assert.equal(trending.current_production_search_score, CURRENT_NEUTRAL_DEFAULT);
  assert.equal(trending.current_uses_neutral_default, true);
  const c0 = scoreC0CurrentNeutralDefault({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 63,
  });
  assert.equal(c0.search_score, 50);
});

test('6. current price missing -> Momentum neutral 50', () => {
  const price = characterizePriceMomentumEvidence({ prices: [[1, 100]] });
  assert.equal(price.current_production_momentum_score, CURRENT_NEUTRAL_DEFAULT);
  const c0 = scoreC0CurrentNeutralDefault({
    searchAvailable: true,
    searchObserved: 55,
    momentumAvailable: false,
  });
  assert.equal(c0.momentum_score, 50);
});

test('7. both missing -> current factor 50', () => {
  const c0 = scoreC0CurrentNeutralDefault({
    searchAvailable: false,
    momentumAvailable: false,
  });
  assert.equal(c0.factor_score, 50);
  assert.equal(c0.treats_unavailable_as_observed_neutral, true);
});

test('8. missing/error current behavior violates frozen observed-neutral invariant', () => {
  const c0 = scoreC0CurrentNeutralDefault({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 63,
  });
  assert.equal(c0.violates_frozen_invariant, true);
  assert.equal(c0.treats_unavailable_as_observed_neutral, true);
});

test('9. C1 both available -> 70/30', () => {
  const c1 = scoreC1AvailableComponentRenormalization({
    searchAvailable: true,
    momentumAvailable: true,
    searchObserved: 70,
    momentumObserved: 40,
  });
  assert.equal(c1.factor_score, Math.round(70 * 0.7 + 40 * 0.3));
  assert.deepEqual(c1.effective_weights, OFFICIAL_SOCIAL_WEIGHTS);
});

test('10. C1 Search-only -> Search renormalizes to 100%', () => {
  const c1 = scoreC1AvailableComponentRenormalization({
    searchAvailable: true,
    momentumAvailable: false,
    searchObserved: 85,
  });
  assert.equal(c1.factor_score, 85);
  assert.equal(c1.effective_weights.coingecko_trending_rank, 1);
  assert.equal(c1.momentum_score, null);
});

test('11. C1 Momentum-only -> Momentum renormalizes to 100%', () => {
  const c1 = scoreC1AvailableComponentRenormalization({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 20,
  });
  assert.equal(c1.factor_score, 20);
  assert.equal(c1.effective_weights.btc_price_momentum_7d, 1);
  assert.equal(c1.search_score, null);
});

test('12. C1 both missing -> null', () => {
  const c1 = scoreC1AvailableComponentRenormalization({
    searchAvailable: false,
    momentumAvailable: false,
  });
  assert.equal(c1.factor_score, null);
  assert.equal(c1.factor_null, true);
});

test('13. C2 either missing -> null', () => {
  assert.equal(
    scoreC2RequireBothComponents({
      searchAvailable: true,
      searchObserved: 55,
      momentumAvailable: false,
    }).factor_score,
    null
  );
  assert.equal(
    scoreC2RequireBothComponents({
      searchAvailable: false,
      momentumAvailable: true,
      momentumObserved: 63,
    }).factor_score,
    null
  );
});

test('14. C2 both available -> 70/30', () => {
  const c2 = scoreC2RequireBothComponents({
    searchAvailable: true,
    momentumAvailable: true,
    searchObserved: 55,
    momentumObserved: 63,
  });
  assert.equal(c2.factor_score, Math.round(55 * 0.7 + 63 * 0.3));
});

test('15. no candidate treats unavailable as observed numeric 50', () => {
  for (const fn of [
    scoreC1AvailableComponentRenormalization,
    scoreC2RequireBothComponents,
  ]) {
    const result = fn({
      searchAvailable: false,
      momentumAvailable: true,
      momentumObserved: 63,
    });
    assert.notEqual(result.search_score, 50);
    assert.equal(result.treats_unavailable_as_observed_neutral, false);
  }
});

test('16. malformed trending is distinguished from provider error', () => {
  const missingCoins = characterizeTrendingEvidence({});
  const nonArrayThrows = characterizeTrendingEvidence({ coins: 'x' });
  const errored = characterizeTrendingEvidence(null, { fetchError: true });
  assert.equal(missingCoins.diagnostic_state, 'MALFORMED');
  assert.equal(missingCoins.current_uses_neutral_default, true);
  assert.equal(nonArrayThrows.diagnostic_state, 'THROWS_BEFORE_COMPONENT_SCORING');
  assert.equal(nonArrayThrows.current_throws_before_component_scoring, true);
  assert.equal(nonArrayThrows.current_factor_score, null);
  assert.equal(nonArrayThrows.applicable_to_c0_neutral_default_matrix, false);
  assert.equal(errored.diagnostic_state, 'ERROR');
  assert.notEqual(nonArrayThrows.diagnostic_state, errored.diagnostic_state);
});

test('17. Bitcoin-absent trending response is distinguished from provider error', () => {
  const absent = characterizeTrendingEvidence({
    coins: [{ item: { id: 'solana', symbol: 'sol' } }],
  });
  const errored = characterizeTrendingEvidence(null, { fetchError: true });
  assert.equal(absent.diagnostic_state, 'MISSING');
  assert.equal(absent.detail, 'bitcoin_absent_from_trending_coins');
  assert.equal(absent.current_uses_neutral_default, true);
  assert.equal(errored.diagnostic_state, 'ERROR');
});

test('18. insufficient price history is distinguished from provider error', () => {
  const insufficient = characterizePriceMomentumEvidence({
    prices: Array.from({ length: 5 }, (_, i) => [i, 100 + i]),
  });
  const errored = characterizePriceMomentumEvidence(null, { fetchError: true });
  assert.equal(insufficient.diagnostic_state, 'INSUFFICIENT_HISTORY');
  assert.equal(errored.diagnostic_state, 'ERROR');
});

test('19. exactly-14 finite-price current behavior is characterized correctly', () => {
  const exactly14 = characterizePriceMomentumEvidence({
    prices: Array.from({ length: 14 }, (_, i) => [i, 100 + i]),
  });
  assert.equal(exactly14.diagnostic_state, 'INSUFFICIENT_HISTORY');
  assert.equal(exactly14.change_series_length, 0);
  assert.equal(exactly14.current_uses_neutral_default, true);
  assert.equal(exactly14.current_production_momentum_score, 50);
});

test('20. current cache decision: null current rank with valid cache forces recompute', () => {
  assert.equal(
    hasSocialDataChanged(
      { bitcoinRank: null, latestPrice: 83000 },
      { bitcoinRank: 11, latestPrice: 83000 }
    ),
    true
  );
});

test('21. current cache decision: null current price with valid cache forces recompute', () => {
  assert.equal(
    hasSocialDataChanged(
      { bitcoinRank: 11, latestPrice: null },
      { bitcoinRank: 11, latestPrice: 83000 }
    ),
    true
  );
});

test('22. current cache decision: both null with valid cache forces recompute', () => {
  assert.equal(
    hasSocialDataChanged(
      { bitcoinRank: null, latestPrice: null },
      { bitcoinRank: 11, latestPrice: 83000 }
    ),
    true
  );
});

test('23. current cache unchanged case can reuse factor cache', () => {
  assert.equal(
    hasSocialDataChanged(
      { bitcoinRank: 11, latestPrice: 83000 },
      { bitcoinRank: 11, latestPrice: 83000 }
    ),
    false
  );
  const scenarios = evaluateSocialCacheDecisionScenarios();
  const unchanged = scenarios.find((s) => s.id === 'rank_unchanged_price_unchanged');
  assert.equal(unchanged.action, 'reuse_cached_factor_calculation');
});

test('24. whole Social null is excluded from top-level weight participation', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'b'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  const nullBehavior = report.whole_factor_composite_behavior.behaviors.find(
    (b) => b.social_return === 'null_score'
  );
  assert.equal(nullBehavior.enters_gscore, false);
  assert.equal(nullBehavior.weight_enters_totalWeight, false);
});

test('25. top-level remaining fresh weights normalize as current computeAllFactors semantics', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(
    report.whole_factor_composite_behavior.example_renormalization
      .social_excluded_total_weight_if_others_all_fresh,
    0.9
  );
  assert.equal(
    report.whole_factor_composite_behavior.behaviors.find((b) => b.social_return === 'null_score')
      .remaining_fresh_weights_renormalized,
    true
  );
});

test('26. current cache lacks sufficient independent component provenance', () => {
  const snapshot = JSON.parse(fs.readFileSync(SOCIAL_CACHE_PATH, 'utf8'));
  const c3 = evaluateC3EligiblePriorObservation(snapshot);
  assert.equal(
    c3.structural_verdict,
    'CURRENT_PROVENANCE_INSUFFICIENT_FOR_COMPONENT_LEVEL_CACHE_REUSE'
  );
  assert.equal(c3.findings.independent_search_observation_timestamp, false);
  assert.equal(c3.findings.per_component_freshness_eligibility, false);
  assert.equal(
    c3.findings.explicit_per_component_evidence_state_observed_vs_defaulted_missing_error,
    false
  );
  assert.match(c3.findings.primary_deficiency, /per-component evidence-state/i);
});

test('27. no network use', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'd'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(report.provider_network_performed, false);
});

test('28. outside-repo report requirement', () => {
  assert.throws(
    () => assertOutsideRepository(path.join(REPO_ROOT, 'tmp-report.json')),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  assert.doesNotThrow(() =>
    assertOutsideRepository(path.join(os.tmpdir(), 'r03-outside-report.json'))
  );
});

test('29. all authorization flags false', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'e'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(report.schema, R03_SCHEMA);
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.missingness_repair_authorized, false);
  assert.equal(report.cache_policy_change_authorized, false);
  assert.equal(report.component_reweighting_authorized, false);
  assert.equal(report.whole_factor_exclusion_authorized, false);
  assert.equal(report.model_version_change_authorized, false);
  assert.equal(report.automatic_adjudication_verdict, null);
});

test('30. no predictive/H8 data use', () => {
  const report = buildOfflineR03Report({
    repositorySha: 'f'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(report.predictive_outcome_data_used, false);
  assert.equal(report.h8_data_used_for_tuning, false);
  assert.equal(report.public_data_write_performed, false);
  assert.equal(report.repository_write_performed, false);
});

test('31. workflow artifact upload is post-SHA-guard', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r03-social-missingness-diagnostic.yml'),
    'utf8'
  );
  const postGuardIdx = yml.indexOf('Require origin/main after diagnostic');
  const uploadIdx = yml.indexOf('Upload R03 diagnostic report');
  assert.ok(postGuardIdx >= 0);
  assert.ok(uploadIdx > postGuardIdx);
  const uploadSection = yml.slice(uploadIdx, uploadIdx + 280);
  assert.ok(!/if:\s*always\(\)/.test(uploadSection));
});

test('32. workflow has no provider secret / network requirement', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r03-social-missingness-diagnostic.yml'),
    'utf8'
  );
  assert.ok(!/FRED_API_KEY|COINGECKO|secrets\./i.test(yml));
  assert.ok(!/schedule:/.test(yml));
  assert.ok(!/pull_request:/.test(yml));
  assert.match(yml, /workflow_dispatch:/);
});

test('checked-in Social cache remains unchanged by diagnostic imports', () => {
  const before = fs.readFileSync(SOCIAL_CACHE_PATH, 'utf8');
  buildOfflineR03Report({
    repositorySha: '1'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  const after = fs.readFileSync(SOCIAL_CACHE_PATH, 'utf8');
  assert.equal(before, after);
});

test('non-array coins trending payload throws before scoring (not C0=50)', () => {
  const result = characterizeTrendingEvidence({ coins: 'not-an-array' });
  assert.equal(result.current_throws_before_component_scoring, true);
  assert.equal(result.current_path_reaches_factor_blend, false);
  assert.equal(result.whole_factor_score_known, true);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_factor_reason_class, 'error');
  assert.equal(result.current_can_enter_gscore, false);
  assert.equal(result.applicable_to_c0_neutral_default_matrix, false);
});

test('null-element trending array throws inside find callback', () => {
  const result = characterizeTrendingEvidence({ coins: [null] });
  assert.equal(result.diagnostic_state, 'THROWS_BEFORE_COMPONENT_SCORING');
  assert.equal(result.detail, 'array_element_throws_inside_find_callback');
  assert.equal(result.whole_factor_score_known, true);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_can_enter_gscore, false);
});

test('malformed price null-row throws during map destructuring', () => {
  const result = characterizePriceMomentumEvidence({
    prices: Array.from({ length: 14 }, (_, i) => (i === 3 ? null : [i, 100 + i])),
  });
  assert.equal(result.current_throws_before_component_scoring, true);
  assert.equal(result.whole_factor_score_known, true);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_can_enter_gscore, false);
  assert.equal(result.applicable_to_c0_neutral_default_matrix, false);
  assert.match(result.detail, /map_destructuring_throws/);
});

test('non-finite latest priceChange still yields numeric percentile Momentum score', () => {
  const result = characterizePriceMomentumEvidence(buildNonFiniteMomentumFixture());
  assert.equal(result.priceChange, Number.POSITIVE_INFINITY);
  assert.equal(result.priceChange_is_finite, false);
  assert.equal(result.momentum7dPct ?? result.computation.momentum7dPct, null);
  assert.ok(result.change_series_length > 0);
  assert.equal(result.changePercentile, 1);
  assert.equal(result.current_production_momentum_score, 95);
  assert.equal(result.current_component_score, 95);
  assert.equal(result.numeric_score_from_nonfinite_latest_input, true);
  assert.equal(result.current_uses_neutral_default, false);
  assert.equal(result.whole_factor_score_known, false);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_can_enter_gscore, null);
});

test('cache matrix includes undefined/NaN current-price coercion reuse behavior', () => {
  const scenarios = evaluateSocialCacheDecisionScenarios();
  const undef = scenarios.find((s) => s.id === 'rank_unchanged_current_latestPrice_undefined');
  const nan = scenarios.find((s) => s.id === 'rank_unchanged_current_latestPrice_NaN');
  const str = scenarios.find((s) => s.id === 'rank_unchanged_current_latestPrice_nonnumeric_string');
  assert.equal(undef.hasSocialDataChanged, false);
  assert.equal(undef.malformed_current_evidence_can_reuse_factor_cache, true);
  assert.equal(nan.hasSocialDataChanged, false);
  assert.equal(nan.malformed_current_evidence_can_reuse_factor_cache, true);
  assert.equal(str.hasSocialDataChanged, false);
  assert.equal(str.malformed_current_evidence_can_reuse_factor_cache, true);
  assert.equal(
    hasSocialDataChanged(
      { bitcoinRank: 11, latestPrice: undefined },
      { bitcoinRank: 11, latestPrice: 83000 }
    ),
    false
  );
});

test('C0 is not applied to throwing descriptive subcases', () => {
  const report = buildOfflineR03Report({
    repositorySha: '2'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  const throwing = report.descriptive_failure_subcases.filter((row) => {
    const evidence = row.trending || row.price;
    return evidence?.current_throws_before_component_scoring === true;
  });
  assert.ok(throwing.length >= 2);
  for (const row of throwing) {
    const evidence = row.trending || row.price;
    assert.equal(row.c0_applicable, false);
    assert.equal(evidence.applicable_to_c0_neutral_default_matrix, false);
    assert.equal(evidence.whole_factor_score_known, true);
    assert.equal(evidence.current_factor_score, null);
    assert.equal(evidence.current_can_enter_gscore, false);
  }
  assert.equal(
    report.candidate_treatments.C0_CURRENT_NEUTRAL_DEFAULT
      .applies_only_when_path_reaches_component_blend_with_retained_numeric_50,
    true
  );
  assert.equal(report.candidate_treatments.C1_AVAILABLE_COMPONENT_RENORMALIZATION.selected, false);
  assert.equal(report.candidate_treatments.C2_REQUIRE_BOTH_COMPONENTS.selected, false);
  assert.equal(report.candidate_treatments.C3_ELIGIBLE_PRIOR_OBSERVATION.selected, false);
});

test('dashboard config Social weight/subweights agree with locked blend', () => {
  const report = buildOfflineR03Report({
    repositorySha: '3'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.equal(report.official_component_contract.factor_weight, 0.1);
  assert.deepEqual(report.official_component_contract.dashboard_subweights, {
    coingecko_trending_rank: 0.7,
    btc_price_momentum_7d: 0.3,
  });
  assert.equal(report.blockers.length, 0);
});

test('missing Search component path does not claim whole-factor score', () => {
  const trending = characterizeTrendingEvidence({
    coins: [{ item: { id: 'ethereum', symbol: 'eth' } }],
  });
  assert.equal(trending.current_component_score, 50);
  assert.equal(trending.current_production_search_score, 50);
  assert.equal(trending.current_path_reaches_factor_blend, true);
  assert.equal(trending.whole_factor_score_known, false);
  assert.equal(trending.current_factor_score, null);
  assert.equal(trending.current_factor_reason_class, 'unknown_until_other_component');
  assert.equal(trending.current_can_enter_gscore, null);
});

test('observed Search=85 does not claim Social factor=85', () => {
  const trending = characterizeTrendingEvidence({
    coins: [
      { item: { id: 'bitcoin', symbol: 'btc' } },
      { item: { id: 'ethereum', symbol: 'eth' } },
    ],
  });
  assert.equal(trending.rank, 1);
  assert.equal(trending.current_component_score, 85);
  assert.equal(trending.current_production_search_score, 85);
  assert.equal(trending.current_path_reaches_factor_blend, true);
  assert.equal(trending.whole_factor_score_known, false);
  assert.equal(trending.current_factor_score, null);
  assert.equal(trending.current_can_enter_gscore, null);
});

test('non-finite Momentum component=95 does not claim Social factor=95', () => {
  const price = characterizePriceMomentumEvidence(buildNonFiniteMomentumFixture());
  assert.equal(price.current_component_score, 95);
  assert.equal(price.current_production_momentum_score, 95);
  assert.equal(price.whole_factor_score_known, false);
  assert.equal(price.current_factor_score, null);
  assert.notEqual(price.current_factor_score, 95);
});

test('exactly-14 Momentum default component score does not claim whole-factor score', () => {
  const exactly14 = characterizePriceMomentumEvidence({
    prices: Array.from({ length: 14 }, (_, i) => [i, 100 + i]),
  });
  assert.equal(exactly14.current_component_score, 50);
  assert.equal(exactly14.current_path_reaches_factor_blend, true);
  assert.equal(exactly14.whole_factor_score_known, false);
  assert.equal(exactly14.current_factor_score, null);
  assert.equal(exactly14.current_can_enter_gscore, null);
});

test('throwing trending path conclusively reports whole-factor null/error', () => {
  const result = characterizeTrendingEvidence({ coins: 'not-an-array' });
  assert.equal(result.whole_factor_score_known, true);
  assert.equal(result.current_path_reaches_factor_blend, false);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_factor_reason_class, 'error');
  assert.equal(result.current_can_enter_gscore, false);
  assert.equal(result.current_production_outcome, 'WHOLE_FACTOR_OUTER_CATCH_NULL');
});

test('throwing price path conclusively reports whole-factor null/error', () => {
  const result = characterizePriceMomentumEvidence({
    prices: Array.from({ length: 14 }, (_, i) => (i === 3 ? null : [i, 100 + i])),
  });
  assert.equal(result.whole_factor_score_known, true);
  assert.equal(result.current_path_reaches_factor_blend, false);
  assert.equal(result.current_factor_score, null);
  assert.equal(result.current_factor_reason_class, 'error');
  assert.equal(result.current_can_enter_gscore, false);
});

test('C0/C1/C2 still report actual factor scores when both component states supplied', () => {
  const c0 = scoreC0CurrentNeutralDefault({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 63,
  });
  assert.equal(c0.factor_score, 54);
  assert.equal(c0.can_enter_gscore_if_fresh, true);

  const c1 = scoreC1AvailableComponentRenormalization({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 63,
  });
  assert.equal(c1.factor_score, 63);
  assert.equal(c1.can_enter_gscore_if_fresh, true);

  const c2 = scoreC2RequireBothComponents({
    searchAvailable: false,
    momentumAvailable: true,
    momentumObserved: 63,
  });
  assert.equal(c2.factor_score, null);
  assert.equal(c2.can_enter_gscore_if_fresh, false);
});

test('component characterization scope note and auth flags remain false', () => {
  const report = buildOfflineR03Report({
    repositorySha: '4'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
    ssotSocialStaleness: { ttl_hours: 24, market_dependent: false, business_days_only: false },
  });
  assert.match(report.component_characterization_scope, /do not establish the final Social factor score/i);
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.missingness_repair_authorized, false);
  assert.equal(report.cache_policy_change_authorized, false);
  assert.equal(report.component_reweighting_authorized, false);
  assert.equal(report.whole_factor_exclusion_authorized, false);
  assert.equal(report.model_version_change_authorized, false);
  assert.equal(report.automatic_adjudication_verdict, null);
  assert.equal(report.candidate_treatments.C1_AVAILABLE_COMPONENT_RENORMALIZATION.selected, false);
  assert.equal(report.candidate_treatments.C2_REQUIRE_BOTH_COMPONENTS.selected, false);
  assert.equal(report.candidate_treatments.C3_ELIGIBLE_PRIOR_OBSERVATION.selected, false);
});
