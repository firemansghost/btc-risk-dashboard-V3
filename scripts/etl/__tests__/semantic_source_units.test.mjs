// Locks objective FRED source-unit metadata for Net Liquidity.
// Intentionally does not import frozen scripts/etl/factors.mjs.
// Does not assert that live H8 production currently implements the corrected
// RRP conversion. Production R01 repair remains successor/post-H8 work.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'fred-source-units.json'
);

function loadContract() {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.equal(parsed.contract, 'fred_source_units_v1');
  return parsed;
}

function seriesById(contract, seriesId) {
  const matches = contract.series.filter((row) => row.series_id === seriesId);
  assert.equal(matches.length, 1, `expected exactly one ${seriesId} record`);
  return matches[0];
}

test('FRED source-unit contract identity and series population', () => {
  const contract = loadContract();
  assert.equal(contract.contract, 'fred_source_units_v1');
  assert.equal(contract.series.length, 3);
  assert.deepEqual(
    contract.series.map((row) => row.series_id),
    ['WALCL', 'WTREGEN', 'RRPONTSYD']
  );
  const ids = contract.series.map((row) => row.series_id);
  assert.equal(new Set(ids).size, ids.length);
});

test('WALCL source-unit metadata', () => {
  const walcl = seriesById(loadContract(), 'WALCL');
  assert.equal(walcl.source_unit, 'Millions of U.S. Dollars');
  assert.equal(walcl.usd_multiplier, 1000000);
});

test('WTREGEN source-unit metadata', () => {
  const wtregen = seriesById(loadContract(), 'WTREGEN');
  assert.equal(wtregen.source_unit, 'Millions of U.S. Dollars');
  assert.equal(wtregen.usd_multiplier, 1000000);
});

test('RRPONTSYD source-unit metadata differs from millions-scale series', () => {
  const contract = loadContract();
  const walcl = seriesById(contract, 'WALCL');
  const rrp = seriesById(contract, 'RRPONTSYD');
  assert.equal(rrp.source_unit, 'Billions of U.S. Dollars');
  assert.equal(rrp.usd_multiplier, 1000000000);
  assert.notEqual(rrp.usd_multiplier, walcl.usd_multiplier);
  assert.equal(rrp.usd_multiplier, walcl.usd_multiplier * 1000);
});

test('each series has HTTPS FRED provenance for its series_id', () => {
  const contract = loadContract();
  for (const row of contract.series) {
    assert.equal(typeof row.provenance_url, 'string');
    assert.match(row.provenance_url, /^https:\/\/fred\.stlouisfed\.org\/series\/[A-Z0-9]+$/);
    assert.equal(
      row.provenance_url,
      `https://fred.stlouisfed.org/series/${row.series_id}`
    );
  }
});
