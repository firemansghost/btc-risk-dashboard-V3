// Locks the source/semantic fact that Farside FBTC and BTC are distinct identities.
// Intentionally does not import frozen scripts/etl/factors.mjs.
// Does not assert that the current live H8 parser already implements exact-token
// resolution. Production R02 repair remains successor/post-H8 work.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'farside-etf-identities.json'
);

function loadContract() {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.equal(parsed.contract, 'farside_etf_identity_v1');
  return parsed;
}

function identityBySymbol(contract, symbol) {
  const matches = contract.identities.filter((row) => row.symbol === symbol);
  assert.equal(matches.length, 1, `expected exactly one ${symbol} identity`);
  return matches[0];
}

function findExactIndex(headers, token) {
  const needle = String(token).trim().toUpperCase();
  return headers.findIndex((header) => String(header).trim().toUpperCase() === needle);
}

test('Farside ETF identity contract and header population', () => {
  const contract = loadContract();
  assert.equal(contract.contract, 'farside_etf_identity_v1');
  assert.deepEqual(contract.headers, ['Date', 'FBTC', 'BTC', 'Total']);
});

test('FBTC and BTC are distinct source identities', () => {
  const contract = loadContract();
  assert.equal(contract.identities.length, 2);
  assert.deepEqual(
    contract.identities.map((row) => row.symbol),
    ['FBTC', 'BTC']
  );
  const symbols = contract.identities.map((row) => row.symbol);
  assert.equal(new Set(symbols).size, symbols.length);
  const fbtc = identityBySymbol(contract, 'FBTC');
  const btc = identityBySymbol(contract, 'BTC');
  assert.notEqual(fbtc.symbol, btc.symbol);
});

test('FBTC and BTC have distinct header tokens', () => {
  const contract = loadContract();
  const fbtc = identityBySymbol(contract, 'FBTC');
  const btc = identityBySymbol(contract, 'BTC');
  assert.equal(fbtc.header, 'FBTC');
  assert.equal(btc.header, 'BTC');
  assert.notEqual(fbtc.header, btc.header);
});

test('FBTC and BTC occupy distinct fixture header positions', () => {
  const contract = loadContract();
  const fbtc = identityBySymbol(contract, 'FBTC');
  const btc = identityBySymbol(contract, 'BTC');
  assert.equal(fbtc.expected_index, 1);
  assert.equal(btc.expected_index, 2);
  assert.notEqual(fbtc.expected_index, btc.expected_index);
  assert.equal(contract.headers[fbtc.expected_index], 'FBTC');
  assert.equal(contract.headers[btc.expected_index], 'BTC');
});

test('exact-token lookup resolves FBTC and BTC to different indices', () => {
  const { headers } = loadContract();
  const fbtcIndex = findExactIndex(headers, 'FBTC');
  const btcIndex = findExactIndex(headers, 'BTC');
  assert.equal(fbtcIndex, 1);
  assert.equal(btcIndex, 2);
  assert.notEqual(fbtcIndex, btcIndex);
});

test('substring containment is insufficient for ETF identity', () => {
  assert.equal('FBTC'.includes('BTC'), true);
  assert.notEqual('FBTC', 'BTC');
});

test('provenance is a non-empty HTTPS Farside URL', () => {
  const { provenance_url: provenanceUrl } = loadContract();
  assert.equal(typeof provenanceUrl, 'string');
  assert.ok(provenanceUrl.length > 0);
  assert.match(provenanceUrl, /^https:\/\/farside\.co\.uk\//);
});
