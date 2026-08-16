import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FEAR_GREED_LEGACY_FILE,
  SIGNAL_V2_SCHEMA_VERSION,
  SIGNAL_V2_SPECS,
  buildSignalV2Row,
  extractSignalV2Metrics,
  formatSignalV2Value,
  isFearGreedWriterEnabled,
  shouldAppendLegacySignalCsv,
  signalV2Header,
  upsertSignalV2Csv,
  writeFactorSignalV2,
} from '../lib/signalV2.mjs';

test('missing metric becomes empty cell, never numeric 0', () => {
  assert.equal(formatSignalV2Value(null), '');
  assert.equal(formatSignalV2Value(undefined), '');
  assert.equal(formatSignalV2Value(''), '');
  assert.equal(formatSignalV2Value(Number.NaN), '');
  assert.equal(formatSignalV2Value(Number.POSITIVE_INFINITY), '');
  const row = buildSignalV2Row('2026-08-16', ['pct_change_30d', 'score'], { score: 73 });
  assert.equal(row, '2026-08-16,v2,,73');
  assert.ok(!row.split(',')[2] || row.split(',')[2] === '');
  assert.notEqual(row.split(',')[2], '0');
});

test('genuine numeric zero is preserved as 0', () => {
  assert.equal(formatSignalV2Value(0), '0');
  const row = buildSignalV2Row('2026-08-16', ['day_flow_usd', 'score'], {
    day_flow_usd: 0,
    score: 75,
  });
  assert.equal(row, '2026-08-16,v2,0,75');
});

test('v2 schema version is stamped on every row', () => {
  assert.equal(SIGNAL_V2_SCHEMA_VERSION, 'v2');
  const header = signalV2Header(['mayer', 'score']);
  assert.equal(header, 'date,schema_version,mayer,score');
  const row = buildSignalV2Row('2026-08-16', ['mayer', 'score'], { mayer: 0.91, score: 46 });
  assert.equal(row.split(',')[1], 'v2');
});

test('v2 consumes metrics and never details[].label', () => {
  const factor = {
    key: 'stablecoins',
    metrics: { pct_change_30d: 1.5, score: 73 },
    details: [
      { label: '30-day Change', value: '0' },
      { label: 'Aggregate 30d Growth', value: '1.5%' },
    ],
  };
  const metrics = extractSignalV2Metrics(factor);
  assert.equal(metrics.pct_change_30d, 1.5);
  const row = buildSignalV2Row(
    '2026-08-16',
    SIGNAL_V2_SPECS.stablecoins.columns,
    metrics
  );
  assert.ok(row.includes(',1.5,73'));
  assert.ok(!row.split(',').includes('0'));
});

test('missing metrics object yields empty fields even when details have values', () => {
  const factor = {
    key: 'trend_valuation',
    details: [{ label: 'Mayer Multiple', value: '0.91' }],
  };
  const metrics = extractSignalV2Metrics(factor);
  const row = buildSignalV2Row(
    '2026-08-16',
    SIGNAL_V2_SPECS.trend_valuation.columns,
    metrics
  );
  assert.equal(row, '2026-08-16,v2,,,');
});

test('same-day upsert replaces the existing v2 row', () => {
  const header = signalV2Header(['score']);
  const first = upsertSignalV2Csv(null, header, buildSignalV2Row('2026-08-16', ['score'], { score: 50 }));
  const second = upsertSignalV2Csv(first, header, buildSignalV2Row('2026-08-16', ['score'], { score: 54 }));
  const lines = second.split('\n').filter(Boolean);
  assert.equal(lines.filter((line) => line.startsWith('2026-08-16,')).length, 1);
  assert.ok(lines[1].endsWith(',54'));
});

test('Fear & Greed legacy writer is stopped and has no v2 spec', () => {
  assert.equal(isFearGreedWriterEnabled(), false);
  assert.equal(shouldAppendLegacySignalCsv('social_interest'), false);
  assert.equal(shouldAppendLegacySignalCsv('stablecoins'), false);
  assert.equal(FEAR_GREED_LEGACY_FILE, 'public/signals/fear_greed.csv');
  assert.equal(SIGNAL_V2_SPECS.social_interest.file, 'social_interest.csv');
  assert.ok(!Object.values(SIGNAL_V2_SPECS).some((spec) => spec.file.includes('fear_greed')));
});

test('writeFactorSignalV2 writes structured row to temp dir, not fear_greed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-signal-v2-'));
  const result = await writeFactorSignalV2({
    date: '2026-08-16',
    directory: dir,
    factor: {
      key: 'etf_flows',
      metrics: { day_flow_usd: 12, sum21_usd: 100, z: 1.2, pct: 80, score: 75 },
      details: [{ label: '21-day Sum', value: '0' }],
    },
  });
  assert.equal(result.written, true);
  const text = fs.readFileSync(path.join(dir, 'etf_flows_21d.csv'), 'utf8');
  assert.ok(text.startsWith('date,schema_version,day_flow_usd,sum21_usd,z,pct,score'));
  assert.ok(text.includes('2026-08-16,v2,12,100,1.2,80,75'));
  assert.equal(fs.existsSync(path.join(dir, 'fear_greed.csv')), false);
});
