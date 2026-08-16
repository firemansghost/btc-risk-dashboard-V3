import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  CanonicalPriceHistoryError,
  addUtcDays,
  diagnoseCanonicalHistory,
  getDefaultRepoRoot,
  isCompletedDailyCandle,
  isPathInsideRoot,
  latestCompletedUtcDate,
  managePriceHistory,
  parsePriceHistoryCsv,
  resolveCanonicalPriceHistoryPath,
  sma200DenominatorCloses,
  upsertPriceRecords,
} from '../priceHistory.mjs';

const AS_OF = '2026-08-16T11:00:00.000Z';

function makeSeries(start, endInclusive, { source = 'coinbase', price0 = 10000 } = {}) {
  const rows = [];
  let d = start;
  let i = 0;
  while (d <= endInclusive) {
    rows.push({
      date_utc: d,
      close_usd: price0 + i,
      source,
      ingested_at_utc: AS_OF,
    });
    d = addUtcDays(d, 1);
    i += 1;
  }
  return rows;
}

async function withTempRepo(fn) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gg-price-hist-'));
  await fs.mkdir(path.join(repoRoot, 'public', 'data'), { recursive: true });
  try {
    return await fn(repoRoot);
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
}

async function readCanonical(repoRoot) {
  const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
  const text = await fs.readFile(csvPath, 'utf8');
  return { csvPath, text, records: parsePriceHistoryCsv(text) };
}

test('resolved canonical path stays inside a fake repo root', async () => {
  await withTempRepo(async (repoRoot) => {
    const resolved = resolveCanonicalPriceHistoryPath(repoRoot);
    assert.equal(
      resolved,
      path.resolve(repoRoot, 'public', 'data', 'btc_price_history.csv')
    );
    assert.equal(isPathInsideRoot(repoRoot, resolved), true);
    const cwdEscape = path.resolve(
      process.cwd(),
      '../../public/data/btc_price_history.csv'
    );
    assert.notEqual(resolved, cwdEscape);
    assert.equal(isPathInsideRoot(getDefaultRepoRoot(), cwdEscape), false);
  });
});

test('default module path is inside the real repo root', () => {
  const root = getDefaultRepoRoot();
  const resolved = resolveCanonicalPriceHistoryPath();
  assert.equal(isPathInsideRoot(root, resolved), true);
  assert.equal(
    resolved,
    path.resolve(root, 'public', 'data', 'btc_price_history.csv')
  );
});

test('completed daily candle semantics at 11:00 UTC', () => {
  assert.equal(latestCompletedUtcDate(AS_OF), '2026-08-15');
  assert.equal(isCompletedDailyCandle('2026-08-15', AS_OF), true);
  assert.equal(isCompletedDailyCandle('2026-08-16', AS_OF), false);
  assert.equal(isCompletedDailyCandle('2026-08-16', '2026-08-17T00:00:00.000Z'), true);
});

test('stale newest-date forces full backfill, not a 14-day merge', async () => {
  await withTempRepo(async (repoRoot) => {
    const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
    const stale = makeSeries('2025-09-01', '2025-09-28', {
      source: 'coinbase_historical',
    });
    await fs.writeFile(
      csvPath,
      ['date_utc,close_usd,source,ingested_at_utc']
        .concat(stale.map((r) => `${r.date_utc},${r.close_usd},${r.source},${r.ingested_at_utc}`))
        .join('\n') + '\n'
    );

    const diagnosis = diagnoseCanonicalHistory(stale, {
      asOfUtc: AS_OF,
      minRows: 10,
      recentWindowDays: 14,
    });
    assert.equal(diagnosis.needsFullBackfill, true);
    assert.equal(diagnosis.reason, 'stale_beyond_recent_window');

    let backfillCalls = 0;
    const backfill = makeSeries('2026-07-01', '2026-08-16', { source: 'coinbase_historical' });
    const recent = makeSeries('2026-08-02', '2026-08-16');

    const result = await managePriceHistory({
      repoRoot,
      asOfUtc: AS_OF,
      minRows: 10,
      recentWindowDays: 14,
      fetchBackfill: async () => {
        backfillCalls += 1;
        return { success: true, data: backfill, provenance: {} };
      },
      fetchRecent: async () => ({ success: true, data: recent, provenance: {} }),
    });

    assert.equal(backfillCalls, 1);
    const { records } = await readCanonical(repoRoot);
    assert.equal(records.at(-1).date_utc, '2026-08-15');
    assert.equal(records.some((r) => r.date_utc === '2026-08-16'), false);
    assert.equal(records[0].date_utc, '2026-07-01');
    assert.equal(result.diagnosis.needsFullBackfill, true);
    assert.equal(result.diagnosis.reason, 'stale_beyond_recent_window');
  });
});

test('gappy candidate fails validation and does not replace existing file', async () => {
  await withTempRepo(async (repoRoot) => {
    const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
    const existing = makeSeries('2025-09-01', '2025-09-28', { source: 'coinbase_historical' });
    const existingText =
      ['date_utc,close_usd,source,ingested_at_utc']
        .concat(existing.map((r) => `${r.date_utc},${r.close_usd},${r.source},${r.ingested_at_utc}`))
        .join('\n') + '\n';
    await fs.writeFile(csvPath, existingText);

    const gappy = makeSeries('2026-07-01', '2026-08-15').filter(
      (r) => r.date_utc !== '2026-07-15'
    );

    await assert.rejects(
      () =>
        managePriceHistory({
          repoRoot,
          asOfUtc: AS_OF,
          minRows: 10,
          recentWindowDays: 14,
          fetchBackfill: async () => ({ success: true, data: gappy, provenance: {} }),
          fetchRecent: async () => ({ success: true, data: gappy.slice(-5), provenance: {} }),
        }),
      (err) => {
        assert.equal(err instanceof CanonicalPriceHistoryError, true);
        assert.match(err.message, /validation failed/);
        assert.equal(err.details.existingPreserved, true);
        return true;
      }
    );

    const after = await fs.readFile(csvPath, 'utf8');
    assert.equal(after, existingText);
  });
});

test('same-day upsert replaces the existing row for that date', async () => {
  await withTempRepo(async (repoRoot) => {
    const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
    const existing = makeSeries('2026-07-01', '2026-08-15', {
      source: 'coinbase_historical',
      price0: 1000,
    });
    await fs.writeFile(
      csvPath,
      ['date_utc,close_usd,source,ingested_at_utc']
        .concat(existing.map((r) => `${r.date_utc},${r.close_usd},${r.source},${r.ingested_at_utc}`))
        .join('\n') + '\n'
    );

    const incoming = makeSeries('2026-08-02', '2026-08-15', { price0: 50000 });
    await managePriceHistory({
      repoRoot,
      asOfUtc: AS_OF,
      minRows: 10,
      recentWindowDays: 14,
      fetchBackfill: async () => {
        throw new Error('full backfill should not run');
      },
      fetchRecent: async () => ({ success: true, data: incoming, provenance: {} }),
    });

    const { records } = await readCanonical(repoRoot);
    const row = records.find((r) => r.date_utc === '2026-08-15');
    assert.equal(row.close_usd, incoming.find((r) => r.date_utc === '2026-08-15').close_usd);
    assert.equal(row.source, 'coinbase');
    const untouched = records.find((r) => r.date_utc === '2026-07-01');
    assert.equal(untouched.close_usd, 1000);
  });
});

test('open UTC daily candle is excluded from canonical file and SMA200 denominator', async () => {
  const mixed = [
    ...makeSeries('2026-01-01', '2026-08-15'),
    {
      date_utc: '2026-08-16',
      close_usd: 999999,
      source: 'coinbase',
      ingested_at_utc: AS_OF,
    },
  ];
  const smaCloses = sma200DenominatorCloses(mixed, AS_OF);
  assert.equal(smaCloses.includes(999999), false);
  assert.equal(smaCloses.at(-1), mixed.find((r) => r.date_utc === '2026-08-15').close_usd);

  await withTempRepo(async (repoRoot) => {
    await managePriceHistory({
      repoRoot,
      asOfUtc: AS_OF,
      minRows: 10,
      fetchBackfill: async () => ({ success: true, data: mixed, provenance: {} }),
      fetchRecent: async () => ({ success: true, data: mixed.slice(-20), provenance: {} }),
    });
    const { records } = await readCanonical(repoRoot);
    assert.equal(records.some((r) => r.date_utc === '2026-08-16'), false);
    assert.equal(records.at(-1).date_utc, '2026-08-15');
  });
});

test('failed backfill does not replace a valid existing artifact', async () => {
  await withTempRepo(async (repoRoot) => {
    const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
    const existing = makeSeries('2025-09-01', '2025-09-28');
    const existingText =
      ['date_utc,close_usd,source,ingested_at_utc']
        .concat(existing.map((r) => `${r.date_utc},${r.close_usd},${r.source},${r.ingested_at_utc}`))
        .join('\n') + '\n';
    await fs.writeFile(csvPath, existingText);

    await assert.rejects(
      () =>
        managePriceHistory({
          repoRoot,
          asOfUtc: AS_OF,
          minRows: 10,
          recentWindowDays: 14,
          fetchBackfill: async () => ({
            success: false,
            reason: 'upstream_unavailable',
            data: [],
            provenance: {},
          }),
          fetchRecent: async () => ({ success: true, data: [], provenance: {} }),
        }),
      /backfill failed/
    );

    assert.equal(await fs.readFile(csvPath, 'utf8'), existingText);
  });
});

test('upsertPriceRecords incoming same-day wins', () => {
  const merged = upsertPriceRecords(
    [{ date_utc: '2026-08-15', close_usd: 1, source: 'coinbase_historical' }],
    [{ date_utc: '2026-08-15', close_usd: 2, source: 'coinbase' }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].close_usd, 2);
  assert.equal(merged[0].source, 'coinbase');
});
