import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { upsertGScoreHistoryCsv, GSCORE_HISTORY_HEADER } from '../lib/gscoreHistoryCsv.mjs';
import {
  buildFactorHistoryRecord,
  upsertFactorHistoryRecords,
  syncFactorHistoryFromRun
} from '../factor-history-tracking.mjs';

test('gscore history: upsert replaces existing date, no duplicate rows', () => {
  const input = [
    GSCORE_HISTORY_HEADER,
    '2026-01-01,50,Hold & Wait,100.00',
    '2026-01-02,55,Hold & Wait,101.00'
  ].join('\n');

  const out = upsertGScoreHistoryCsv(input, {
    date: '2026-01-01',
    score: 46,
    band: 'Moderate Buying',
    priceUsd: '99.00'
  });

  const lines = out.split('\n').filter((l) => l.length > 0);
  const jan1 = lines.filter((l) => l.startsWith('2026-01-01,'));
  assert.strictEqual(jan1.length, 1);
  assert.ok(jan1[0].includes('46,Moderate Buying'));
});

test('gscore history: insert new date preserves chronological order', () => {
  const input = [GSCORE_HISTORY_HEADER, '2026-01-03,51,A,1'].join('\n');
  const out = upsertGScoreHistoryCsv(input, {
    date: '2026-01-01',
    score: 50,
    band: 'B',
    priceUsd: '2'
  });
  const data = out.split('\n').slice(1);
  assert.strictEqual(data[0].split(',')[0], '2026-01-01');
  assert.strictEqual(data[1].split(',')[0], '2026-01-03');
});

test('gscore history: empty content yields header + row', () => {
  const out = upsertGScoreHistoryCsv(null, {
    date: '2026-05-07',
    score: 46,
    band: 'Moderate Buying',
    priceUsd: '81171.99'
  });
  assert.ok(out.startsWith(GSCORE_HISTORY_HEADER));
  assert.ok(out.includes('2026-05-07,46,Moderate Buying,81171.99'));
});

test('factor history: buildFactorHistoryRecord sets composite_band label', () => {
  const factors = [
    { key: 'trend_valuation', score: 52, status: 'fresh' },
    { key: 'stablecoins', score: 23, status: 'fresh' }
  ];
  const r = buildFactorHistoryRecord(factors, 46, 'Moderate Buying');
  assert.strictEqual(r.composite_score, 46);
  assert.strictEqual(r.composite_band, 'Moderate Buying');
  assert.strictEqual(r.trend_valuation_score, 52);
  assert.strictEqual(r.stablecoins_score, 23);
});

test('factor history: upsertFactorHistoryRecords updates same date once', () => {
  const rec = (score) =>
    buildFactorHistoryRecord(
      [{ key: 'trend_valuation', score: 50, status: 'fresh' }],
      score,
      'Hold & Wait'
    );
  const h = [];
  upsertFactorHistoryRecords(h, '2026-01-01', rec(50));
  upsertFactorHistoryRecords(h, '2026-01-01', rec(51));
  assert.strictEqual(h.length, 1);
  assert.strictEqual(h[0].composite_score, 51);
});

test('factor history: syncFactorHistoryFromRun writes CSV and stats', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-fh-'));
  const csv = path.join(dir, 'factor_history.csv');
  const statsPath = path.join(dir, 'factor_history_stats.json');
  const factors = [
    { key: 'trend_valuation', score: 52, status: 'fresh' },
    { key: 'onchain', score: null, status: 'excluded' },
    { key: 'stablecoins', score: 23, status: 'fresh' },
    { key: 'etf_flows', score: 41, status: 'fresh' },
    { key: 'net_liquidity', score: 69, status: 'fresh' },
    { key: 'term_leverage', score: 49, status: 'fresh' },
    { key: 'macro_overlay', score: 27, status: 'fresh' },
    { key: 'social_interest', score: 78, status: 'fresh' }
  ];

  syncFactorHistoryFromRun({
    date: '2026-05-07',
    factors,
    compositeScore: 46,
    bandLabel: 'Moderate Buying',
    historyPath: csv,
    statsPath
  });

  const content = fs.readFileSync(csv, 'utf8');
  assert.ok(content.includes('2026-05-07'));
  assert.ok(content.includes('Moderate Buying'));
  assert.ok(/,46,Moderate Buying/.test(content));

  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  assert.ok(stats.totalRecords >= 1);
});
