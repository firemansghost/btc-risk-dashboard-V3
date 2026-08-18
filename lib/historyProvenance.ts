import {
  eachUtcDateInclusive,
  filterHistoryByRange,
  getRangeCutoffDate,
  latestHistoryDate,
  utcDateMs,
  type HistoryChartPoint,
  type HistoryRange,
} from '@/lib/historyChartCsv';

export const CURRENT_HISTORY_RECONSTRUCTED_THROUGH = '2025-09-26';
export const CURRENT_HISTORY_OBSERVED_FROM = '2025-09-27';
export const VERIFIED_V11_LAST_DATE = '2026-08-16';
export const VERIFIED_V111_FIRST_DATE = '2026-08-17';
export const HISTORY_EWMA_ALPHA = 0.1;

export type HistoryProvenance = 'reconstructed' | 'observed';
export type VerifiedModelEra = 'unclassified' | 'v1.1-last' | 'v1.1.1+';

export type HistoryPresentationRow = {
  date: string;
  timestamp: number;
  score: number | null;
  band: string | null;
  price_usd: number | null;
  provenance: HistoryProvenance | null;
  verifiedModelEra: VerifiedModelEra | null;
  observedScore: number | null;
  reconstructedScore: number | null;
  observedTrendPreV111: number | null;
  observedTrendV111: number | null;
  reconstructedTrend: number | null;
  trendScore: number | null;
  isObservation: boolean;
  isGap: boolean;
  isHiddenLegacy: boolean;
};

export type HistoryPresentation = {
  rows: HistoryPresentationRow[];
  domain: [number, number];
  cutoffDate: string;
  anchorDate: string;
  observationCount: number;
  reconstructedObservationCount: number;
  observedObservationCount: number;
  showsLegacySeries: boolean;
  showsProvenanceMarker: boolean;
  showsModelEraMarker: boolean;
  legacyOutOfRange: boolean;
  provenanceMarkerTimestamp: number;
  modelEraMarkerTimestamp: number;
};

export function classifyCurrentHistoryCsvDate(date: string): HistoryProvenance {
  return date <= CURRENT_HISTORY_RECONSTRUCTED_THROUGH ? 'reconstructed' : 'observed';
}

export function classifyVerifiedModelEra(date: string): VerifiedModelEra {
  if (date === VERIFIED_V11_LAST_DATE) return 'v1.1-last';
  if (date >= VERIFIED_V111_FIRST_DATE) return 'v1.1.1+';
  return 'unclassified';
}

function emptyGeometryRow(
  date: string,
  flags: Pick<HistoryPresentationRow, 'isGap' | 'isHiddenLegacy'>
): HistoryPresentationRow {
  return {
    date,
    timestamp: utcDateMs(date),
    score: null,
    band: null,
    price_usd: null,
    provenance: null,
    verifiedModelEra: null,
    observedScore: null,
    reconstructedScore: null,
    observedTrendPreV111: null,
    observedTrendV111: null,
    reconstructedTrend: null,
    trendScore: null,
    isObservation: false,
    isGap: flags.isGap,
    isHiddenLegacy: flags.isHiddenLegacy,
  };
}

type TrendFields = {
  reconstructedTrend: number | null;
  observedTrendPreV111: number | null;
  observedTrendV111: number | null;
  trendScore: number | null;
};

function trendBucket(date: string, provenance: HistoryProvenance): keyof TrendFields {
  if (provenance === 'reconstructed') return 'reconstructedTrend';
  if (date >= VERIFIED_V111_FIRST_DATE) return 'observedTrendV111';
  return 'observedTrendPreV111';
}

/**
 * EWMA over visible observations only. Resets at provenance and Aug 16/17.
 * Missing calendar days do not decay state; they simply have no trend value.
 */
export function computeSegmentedTrends(
  observations: HistoryChartPoint[],
  alpha = HISTORY_EWMA_ALPHA
): Map<string, TrendFields> {
  const byDate = new Map<string, TrendFields>();
  let reconstructed: number | undefined;
  let observedPre: number | undefined;
  let observedV111: number | undefined;

  for (const p of observations) {
    const provenance = classifyCurrentHistoryCsvDate(p.date);
    const bucket = trendBucket(p.date, provenance);
    let value: number;
    if (bucket === 'reconstructedTrend') {
      value = reconstructed === undefined ? p.score : alpha * p.score + (1 - alpha) * reconstructed;
      reconstructed = value;
    } else if (bucket === 'observedTrendPreV111') {
      value = observedPre === undefined ? p.score : alpha * p.score + (1 - alpha) * observedPre;
      observedPre = value;
    } else {
      value = observedV111 === undefined ? p.score : alpha * p.score + (1 - alpha) * observedV111;
      observedV111 = value;
    }
    const rounded = Math.round(value);
    const fields: TrendFields = {
      reconstructedTrend: null,
      observedTrendPreV111: null,
      observedTrendV111: null,
      trendScore: rounded,
    };
    fields[bucket] = rounded;
    byDate.set(p.date, fields);
  }

  return byDate;
}

export function buildHistoryPresentation(input: {
  points: HistoryChartPoint[];
  range: HistoryRange;
  showLegacy: boolean;
  alpha?: number;
}): HistoryPresentation | null {
  const { points, range, showLegacy, alpha = HISTORY_EWMA_ALPHA } = input;
  const anchorDate = latestHistoryDate(points);
  if (!anchorDate) return null;

  const cutoffDate = getRangeCutoffDate(anchorDate, range);
  const inRange = filterHistoryByRange(points, range, anchorDate);
  const visibleObservations = inRange.filter((p) => {
    const provenance = classifyCurrentHistoryCsvDate(p.date);
    return provenance === 'observed' || showLegacy;
  });
  const trends = computeSegmentedTrends(visibleObservations, alpha);
  const byDate = new Map(inRange.map((p) => [p.date, p]));

  const rows: HistoryPresentationRow[] = eachUtcDateInclusive(cutoffDate, anchorDate).map((date) => {
    const src = byDate.get(date);
    const provenance = classifyCurrentHistoryCsvDate(date);
    const hiddenLegacy = provenance === 'reconstructed' && !showLegacy;

    if (!src) {
      if (hiddenLegacy) {
        return emptyGeometryRow(date, { isGap: false, isHiddenLegacy: true });
      }
      return emptyGeometryRow(date, { isGap: true, isHiddenLegacy: false });
    }

    if (hiddenLegacy) {
      return emptyGeometryRow(date, { isGap: false, isHiddenLegacy: true });
    }

    const trend = trends.get(date);
    const verifiedModelEra = classifyVerifiedModelEra(date);
    return {
      date,
      timestamp: utcDateMs(date),
      score: src.score,
      band: src.band || null,
      price_usd: src.price_usd,
      provenance,
      verifiedModelEra,
      observedScore: provenance === 'observed' ? src.score : null,
      reconstructedScore: provenance === 'reconstructed' ? src.score : null,
      observedTrendPreV111: trend?.observedTrendPreV111 ?? null,
      observedTrendV111: trend?.observedTrendV111 ?? null,
      reconstructedTrend: trend?.reconstructedTrend ?? null,
      trendScore: trend?.trendScore ?? null,
      isObservation: true,
      isGap: false,
      isHiddenLegacy: false,
    };
  });

  const observationRows = rows.filter((r) => r.isObservation);
  const reconstructedObservationCount = observationRows.filter((r) => r.provenance === 'reconstructed').length;
  const observedObservationCount = observationRows.filter((r) => r.provenance === 'observed').length;
  const showsLegacySeries = showLegacy && reconstructedObservationCount > 0;
  const legacyOutOfRange = showLegacy && cutoffDate > CURRENT_HISTORY_RECONSTRUCTED_THROUGH;

  return {
    rows,
    domain: [utcDateMs(cutoffDate), utcDateMs(anchorDate)],
    cutoffDate,
    anchorDate,
    observationCount: observationRows.length,
    reconstructedObservationCount,
    observedObservationCount,
    showsLegacySeries,
    showsProvenanceMarker: showsLegacySeries && cutoffDate <= CURRENT_HISTORY_RECONSTRUCTED_THROUGH && anchorDate >= CURRENT_HISTORY_OBSERVED_FROM,
    showsModelEraMarker: cutoffDate <= VERIFIED_V11_LAST_DATE && anchorDate >= VERIFIED_V111_FIRST_DATE,
    legacyOutOfRange,
    provenanceMarkerTimestamp: utcDateMs(CURRENT_HISTORY_OBSERVED_FROM),
    modelEraMarkerTimestamp: utcDateMs(VERIFIED_V111_FIRST_DATE),
  };
}

export function formatUtcLongDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(utcDateMs(date)));
}

export function formatBtcPrice(price: number): string {
  return `BTC $${Math.round(price).toLocaleString('en-US')}`;
}
