// Locks only the successor invariant that missing/error Social inputs are not
// genuine observed-neutral evidence. Intentionally does not import frozen
// scripts/etl/factors.mjs. Assigns no score, exclusion rule, reweight rule,
// cache rule, or future status. Successor treatment remains unresolved.
// Production R03 repair remains successor/post-H8 work.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'social-missingness-semantics.json'
);

const ALLOWED_STATES = new Set(['available', 'missing', 'error']);
const FORBIDDEN_CASE_KEYS = new Set([
  'score',
  'expected_score',
  'factor_score',
  'component_score',
  'neutral_score',
  'weights',
  'expected_weight',
  'expected_action',
  'treatment',
  'expected_status',
  'exclude_factor',
  'exclude_component',
  'reweight',
  'use_cache',
  'use_stale_cache',
  'use_last_valid',
  'return_null',
  'degraded_status',
  'fallback_strategy'
]);

function loadContract() {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.equal(parsed.contract, 'social_missingness_semantics_v1');
  return parsed;
}

function caseById(contract, id) {
  const matches = contract.cases.filter((row) => row.id === id);
  assert.equal(matches.length, 1, `expected exactly one ${id} case`);
  return matches[0];
}

function isMissingOrError(state) {
  return state === 'missing' || state === 'error';
}

test('Social missingness contract identity', () => {
  const contract = loadContract();
  assert.equal(contract.contract, 'social_missingness_semantics_v1');
  assert.equal(contract.factor, 'social_interest');
  assert.equal(contract.invariant, 'missing_or_error_is_not_observed_neutral');
});

test('Social missingness component dimensions', () => {
  const { components } = loadContract();
  assert.equal(components.length, 2);
  assert.deepEqual(components, [
    'coingecko_trending_rank',
    'btc_price_momentum_7d'
  ]);
  assert.equal(new Set(components).size, components.length);
});

test('Social missingness seven-case population', () => {
  const { cases } = loadContract();
  assert.equal(cases.length, 7);
  assert.deepEqual(
    cases.map((row) => row.id),
    [
      'both_available',
      'trending_missing_price_available',
      'trending_available_price_missing',
      'both_missing',
      'trending_error_price_available',
      'trending_available_price_error',
      'both_error'
    ]
  );
  const ids = cases.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('availability-state vocabulary is available, missing, or error', () => {
  const { cases } = loadContract();
  for (const row of cases) {
    assert.equal(ALLOWED_STATES.has(row.trending_state), true, row.id);
    assert.equal(ALLOWED_STATES.has(row.price_state), true, row.id);
  }
});

test('missing or error must not be treated as observed-neutral evidence', () => {
  const { cases } = loadContract();
  const missingOrErrorCases = cases.filter(
    (row) => isMissingOrError(row.trending_state) || isMissingOrError(row.price_state)
  );
  assert.equal(missingOrErrorCases.length, 6);
  for (const row of missingOrErrorCases) {
    assert.equal(row.may_be_treated_as_observed_neutral, false, row.id);
  }
});

test('fully available case is not evaluated as missing/error or labeled neutral', () => {
  const bothAvailable = caseById(loadContract(), 'both_available');
  assert.equal(bothAvailable.trending_state, 'available');
  assert.equal(bothAvailable.price_state, 'available');
  assert.equal(bothAvailable.may_be_treated_as_observed_neutral, null);
  assert.equal(isMissingOrError(bothAvailable.trending_state), false);
  assert.equal(isMissingOrError(bothAvailable.price_state), false);
  assert.notEqual(bothAvailable.may_be_treated_as_observed_neutral, true);
  assert.notEqual(bothAvailable.may_be_treated_as_observed_neutral, false);
});

test('fixture does not prescribe unresolved successor scoring or treatment', () => {
  const contract = loadContract();
  for (const row of contract.cases) {
    for (const key of Object.keys(row)) {
      assert.equal(FORBIDDEN_CASE_KEYS.has(key), false, key);
    }
  }
  const serialized = JSON.stringify(contract);
  for (const key of FORBIDDEN_CASE_KEYS) {
    assert.equal(serialized.includes(`"${key}"`), false, key);
  }
});
