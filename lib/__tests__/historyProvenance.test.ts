import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseGScoreHistoryCsv, utcDateMs } from '@/lib/historyChartCsv';
import {
  CURRENT_HISTORY_OBSERVED_FROM,
  CURRENT_HISTORY_RECONSTRUCTED_THROUGH,
  VERIFIED_V11_LAST_DATE,
  VERIFIED_V111_FIRST_DATE,
  buildHistoryPresentation,
  classifyCurrentHistoryCsvDate,
  classifyVerifiedModelEra,
  computeSegmentedTrends,
} from '@/lib/historyProvenance';

function csv(rows: string[]): string {
  return ['date,score,band,price_usd', ...rows].join('\n');
}

function productionPoints() {
  return parseGScoreHistoryCsv(
    readFileSync(path.join(process.cwd(), 'public', 'data', 'history.csv'), 'utf8')
  );
}

describe('historyProvenance classification', () => {
  it('classifies Sep 26 as reconstructed and Sep 27 as observed', () => {
    expect(classifyCurrentHistoryCsvDate('2025-09-26')).toBe('reconstructed');
    expect(classifyCurrentHistoryCsvDate('2025-09-27')).toBe('observed');
    expect(CURRENT_HISTORY_RECONSTRUCTED_THROUGH).toBe('2025-09-26');
    expect(CURRENT_HISTORY_OBSERVED_FROM).toBe('2025-09-27');
  });

  it('classifies verified model-era dates without inventing a v1.1 start', () => {
    expect(classifyVerifiedModelEra('2026-08-16')).toBe('v1.1-last');
    expect(classifyVerifiedModelEra('2026-08-17')).toBe('v1.1.1+');
    expect(classifyVerifiedModelEra('2026-05-21')).toBe('unclassified');
    expect(classifyVerifiedModelEra('2025-12-11')).toBe('unclassified');
    expect(VERIFIED_V11_LAST_DATE).toBe('2026-08-16');
    expect(VERIFIED_V111_FIRST_DATE).toBe('2026-08-17');
  });
});

describe('historyProvenance presentation', () => {
  it('keeps production Sep 26/27 and Aug 16/17 raw scores in the source parse', () => {
    const points = productionPoints();
    const sep26 = points.find((p) => p.date === '2025-09-26');
    const sep27 = points.find((p) => p.date === '2025-09-27');
    const aug16 = points.find((p) => p.date === '2026-08-16');
    const aug17 = points.find((p) => p.date === '2026-08-17');
    expect(sep26?.score).toBe(85);
    expect(classifyCurrentHistoryCsvDate(sep26!.date)).toBe('reconstructed');
    expect(sep27?.score).toBe(75);
    expect(classifyCurrentHistoryCsvDate(sep27!.date)).toBe('observed');
    expect(aug16?.score).toBe(54);
    expect(aug17?.score).toBe(47);
    expect(sep26?.composite).toBe(sep26?.score);
  });

  it('hides reconstructed scores when legacy is off and exposes them separately when on', () => {
    const points = productionPoints();
    const off = buildHistoryPresentation({ points, range: '1y', showLegacy: false });
    const on = buildHistoryPresentation({ points, range: '1y', showLegacy: true });
    expect(off).not.toBeNull();
    expect(on).not.toBeNull();

    const offSep26 = off!.rows.find((r) => r.date === '2025-09-26');
    const onSep26 = on!.rows.find((r) => r.date === '2025-09-26');
    const onSep27 = on!.rows.find((r) => r.date === '2025-09-27');

    expect(offSep26?.isHiddenLegacy).toBe(true);
    expect(offSep26?.isObservation).toBe(false);
    expect(offSep26?.reconstructedScore).toBeNull();
    expect(offSep26?.observedScore).toBeNull();
    expect(offSep26?.score).toBeNull();
    expect(off!.reconstructedObservationCount).toBe(0);

    expect(onSep26?.isObservation).toBe(true);
    expect(onSep26?.provenance).toBe('reconstructed');
    expect(onSep26?.reconstructedScore).toBe(85);
    expect(onSep26?.observedScore).toBeNull();
    expect(onSep27?.observedScore).toBe(75);
    expect(onSep27?.reconstructedScore).toBeNull();
    expect(on!.showsLegacySeries).toBe(true);

    const mixedRaw = on!.rows.filter((r) => r.observedScore != null && r.reconstructedScore != null);
    expect(mixedRaw).toHaveLength(0);
  });

  it('resets observed trend at Sep 27 to raw 75 and v1.1.1 trend at Aug 17 to raw 47', () => {
    const points = productionPoints();
    const on = buildHistoryPresentation({ points, range: '1y', showLegacy: true })!;
    const sep27 = on.rows.find((r) => r.date === '2025-09-27')!;
    const aug17 = on.rows.find((r) => r.date === '2026-08-17')!;
    const aug16 = on.rows.find((r) => r.date === '2026-08-16')!;

    expect(sep27.score).toBe(75);
    expect(sep27.trendScore).toBe(75);
    expect(sep27.observedTrendPreV111).toBe(75);
    expect(aug17.score).toBe(47);
    expect(aug17.trendScore).toBe(47);
    expect(aug17.observedTrendV111).toBe(47);
    expect(aug17.observedTrendPreV111).toBeNull();
    expect(aug16.observedTrendV111).toBeNull();
    expect(aug16.observedTrendPreV111).not.toBeNull();
  });

  it('does not let structural gaps enter EWMA or observation counts', () => {
    const points = parseGScoreHistoryCsv(
      csv([
        '2026-06-19,50,Hold & Wait,1',
        '2026-06-21,70,Hold & Wait,1',
        '2026-08-18,47,Moderate Buying,1',
      ])
    );
    const presentation = buildHistoryPresentation({ points, range: '90d', showLegacy: false })!;
    const jun20 = presentation.rows.find((r) => r.date === '2026-06-20')!;
    const jun21 = presentation.rows.find((r) => r.date === '2026-06-21')!;

    expect(jun20.isGap).toBe(true);
    expect(jun20.isObservation).toBe(false);
    expect(jun20.score).toBeNull();
    expect(jun20.observedScore).toBeNull();
    expect(jun20.band).toBeNull();
    expect(jun20.price_usd).toBeNull();
    expect(jun20.trendScore).toBeNull();
    expect(presentation.observationCount).toBe(3);

    const trends = computeSegmentedTrends(points);
    expect(trends.has('2026-06-20')).toBe(false);
    expect(jun21.trendScore).toBe(52);
  });

  it('breaks a single missing day between Jun 19 and Jun 21', () => {
    const points = parseGScoreHistoryCsv(
      csv([
        '2026-06-19,50,Hold & Wait,1',
        '2026-06-21,70,Hold & Wait,1',
        '2026-08-18,47,Moderate Buying,1',
      ])
    );
    const presentation = buildHistoryPresentation({ points, range: '90d', showLegacy: false })!;
    const jun19 = presentation.rows.find((r) => r.date === '2026-06-19')!;
    const jun20 = presentation.rows.find((r) => r.date === '2026-06-20')!;
    const jun21 = presentation.rows.find((r) => r.date === '2026-06-21')!;

    expect(jun19.observedScore).toBe(50);
    expect(jun20.observedScore).toBeNull();
    expect(jun20.isGap).toBe(true);
    expect(jun21.observedScore).toBe(70);

    const observedPath = [jun19, jun20, jun21].map((r) => r.observedScore);
    expect(observedPath).toEqual([50, null, 70]);
  });

  it('preserves calendar width for the Oct 6 to Oct 29 hole', () => {
    const points = parseGScoreHistoryCsv(
      csv([
        '2025-10-06,61,Hold & Wait,1',
        '2025-10-29,57,Hold & Wait,1',
        '2026-08-18,47,Moderate Buying,1',
      ])
    );
    const presentation = buildHistoryPresentation({ points, range: '1y', showLegacy: false })!;
    const oct6 = presentation.rows.find((r) => r.date === '2025-10-06')!;
    const oct7 = presentation.rows.find((r) => r.date === '2025-10-07')!;
    const oct28 = presentation.rows.find((r) => r.date === '2025-10-28')!;
    const oct29 = presentation.rows.find((r) => r.date === '2025-10-29')!;

    expect(oct6.observedScore).toBe(61);
    expect(oct7.isGap).toBe(true);
    expect(oct28.isGap).toBe(true);
    expect(oct29.observedScore).toBe(57);
    expect(oct29.timestamp - oct6.timestamp).toBe(23 * 86_400_000);
    expect(oct7.timestamp - oct6.timestamp).toBe(86_400_000);

    const gapDates = presentation.rows.filter((r) => r.date >= '2025-10-07' && r.date <= '2025-10-28');
    expect(gapDates).toHaveLength(22);
    expect(gapDates.every((r) => r.isGap && r.score == null && !r.isObservation)).toBe(true);
  });

  it('uses the full 1Y domain even when legacy reconstruction is hidden', () => {
    const points = productionPoints();
    const off = buildHistoryPresentation({ points, range: '1y', showLegacy: false })!;
    expect(off.cutoffDate).toBe('2025-08-18');
    expect(off.anchorDate).toBe('2026-08-18');
    expect(off.domain).toEqual([utcDateMs('2025-08-18'), utcDateMs('2026-08-18')]);
    expect(off.rows[0].date).toBe('2025-08-18');
    expect(off.rows[0].isHiddenLegacy).toBe(true);
    expect(off.rows[0].isGap).toBe(false);
  });
});
