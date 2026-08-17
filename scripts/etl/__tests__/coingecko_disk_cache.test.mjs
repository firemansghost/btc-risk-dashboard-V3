import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CACHE_TTL_MINUTES,
  evaluateDiskCacheEntry,
  loadFromDiskCache,
  saveToDiskCache,
  wrapDiskCacheEnvelope,
} from '../coinGeckoCache.mjs';

const NOW = Date.parse('2026-08-17T13:49:00.000Z');
const FRESH_AT = '2026-08-17T13:30:00.000Z';
const STALE_AT = '2026-08-17T12:00:00.000Z';
const PAYLOAD = { prices: [[NOW, 62000]] };

test('legacy raw disk cache is not accepted as fresh', () => {
  const evaluated = evaluateDiskCacheEntry(PAYLOAD, { nowMs: NOW });
  assert.equal(evaluated.hit, false);
  assert.equal(evaluated.reason, 'legacy_raw_payload');
  assert.equal(evaluated.data, null);
});

test('envelope cachedAt within TTL is accepted and returns .data', () => {
  const envelope = wrapDiskCacheEnvelope(PAYLOAD, FRESH_AT);
  const evaluated = evaluateDiskCacheEntry(envelope, { nowMs: NOW, ttlMinutes: CACHE_TTL_MINUTES });
  assert.equal(evaluated.hit, true);
  assert.equal(evaluated.reason, 'fresh_cachedAt');
  assert.equal(evaluated.data, PAYLOAD);
});

test('envelope cachedAt older than TTL is rejected', () => {
  const envelope = wrapDiskCacheEnvelope(PAYLOAD, STALE_AT);
  const evaluated = evaluateDiskCacheEntry(envelope, {
    nowMs: NOW,
    ttlMinutes: 30,
  });
  assert.equal((NOW - Date.parse(STALE_AT)) / 60000 > 30, true);
  assert.equal(evaluated.hit, false);
  assert.equal(evaluated.reason, 'expired_cachedAt');
});

test('saveToDiskCache writes explicit cachedAt envelope', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gg-cg-cache-'));
  try {
    const saved = await saveToDiskCache('market_chart_30_daily', PAYLOAD, {
      cacheDir: dir,
      cachedAt: FRESH_AT,
    });
    assert.equal(saved.cachedAt, FRESH_AT);
    assert.deepEqual(saved.data, PAYLOAD);
    const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'market_chart_30_daily.json'), 'utf8'));
    assert.equal(onDisk.cachedAt, FRESH_AT);
    assert.deepEqual(onDisk.data, PAYLOAD);
    const loaded = await loadFromDiskCache('market_chart_30_daily', {
      cacheDir: dir,
      nowMs: NOW,
    });
    assert.deepEqual(loaded, PAYLOAD);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('committed repository market_chart cache is treated as a miss, not a fresh hit', async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const loaded = await loadFromDiskCache('market_chart_30_daily', {
    cacheDir: path.join(repoRoot, 'public/data/cache'),
    nowMs: NOW,
  });
  assert.equal(loaded, null);
});

test('recent filesystem mtime cannot make legacy content fresh', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gg-cg-mtime-'));
  try {
    const file = path.join(dir, 'market_chart_30_daily.json');
    await fs.writeFile(file, JSON.stringify(PAYLOAD), 'utf8');
    const recent = new Date(NOW);
    await fs.utimes(file, recent, recent);
    const loaded = await loadFromDiskCache('market_chart_30_daily', {
      cacheDir: dir,
      nowMs: NOW,
    });
    assert.equal(loaded, null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
