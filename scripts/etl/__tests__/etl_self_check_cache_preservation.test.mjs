import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LEGACY_SCORE_CACHE_PATHS } from '../lib/v12ProductionAdapters.mjs';
import { purgeEligibleStaleCaches } from '../lib/etlSelfCheckCaches.mjs';

function write(root, relativePath, body) {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, body);
  return absolutePath;
}

test('stale frozen rollback caches survive while ordinary stale caches are removed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-self-check-caches-'));
  const protectedBodies = new Map([
    ['public/data/cache/stablecoins/2020-01-01.json', '{"frozen":"stablecoins"}\n'],
    ['public/data/cache/net_liquidity/net_liquidity_cache.json', '{"frozen":"net_liquidity"}\n'],
    ['public/data/cache/social_interest/social_interest_cache.json', '{"frozen":"social"}\n'],
    ['public/data/cache/term_leverage/term_leverage_cache.json', '{"frozen":"term"}\n'],
    ['public/data/stablecoins-historical.json', '{"frozen":"baseline"}\n'],
  ]);
  const ordinaryStale = 'public/data/cache/trend_valuation/trend_valuation_cache.json';
  const ordinaryFresh = 'public/data/cache/macro_overlay/macro_overlay_cache.json';
  const entries = [];

  for (const [relativePath, body] of protectedBodies) {
    entries.push({
      relativePath,
      absolutePath: write(root, relativePath, body),
      stale: true,
    });
  }
  entries.push({
    relativePath: ordinaryStale,
    absolutePath: write(root, ordinaryStale, '{"ordinary":"stale"}\n'),
    stale: true,
  });
  entries.push({
    relativePath: ordinaryFresh,
    absolutePath: write(root, ordinaryFresh, '{"ordinary":"fresh"}\n'),
    stale: false,
  });

  const before = new Map([...protectedBodies].map(([relativePath, body]) => [relativePath, body]));
  const result = await purgeEligibleStaleCaches({
    entries,
    remove: async (absolutePath) => {
      fs.unlinkSync(absolutePath);
    },
  });

  assert.deepEqual(result.removed, [ordinaryStale]);
  assert.equal(fs.existsSync(path.join(root, ...ordinaryStale.split('/'))), false);
  assert.equal(
    fs.readFileSync(path.join(root, ...ordinaryFresh.split('/')), 'utf8'),
    '{"ordinary":"fresh"}\n',
  );
  for (const [relativePath, body] of before) {
    const absolutePath = path.join(root, ...relativePath.split('/'));
    assert.equal(fs.existsSync(absolutePath), true, relativePath);
    assert.equal(fs.readFileSync(absolutePath, 'utf8'), body);
  }
  assert.equal(
    result.preserved.filter((row) => row.reason === 'frozen_rollback_cache').length,
    LEGACY_SCORE_CACHE_PATHS.length,
  );

  fs.rmSync(root, { recursive: true, force: true });
});
