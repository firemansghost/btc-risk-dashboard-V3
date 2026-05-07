/**
 * Display-only cycle timing from fixed UTC anchors (no G-Score / scoring impact).
 * Update anchors here when the cycle model advances.
 */

export const CYCLE_BOTTOM = '2022-11-21';
export const CYCLE_HALVING = '2024-04-20';
export const CYCLE_PEAK = '2025-10-15';
export const AVG_BEAR_DURATION_DAYS = 365;

export type CyclePhase = 'expansion' | 'correction' | 'accumulation' | 'insufficient';

export type CycleBarStatus = 'peak_anchor_not_reached' | 'in_window' | 'historical_window_complete';

export type CycleTimingAnchors = {
  cycleBottomYmd: string;
  halvingYmd: string;
  cyclePeakYmd: string;
  bearWindowDays: number;
};

export const DEFAULT_CYCLE_ANCHORS: CycleTimingAnchors = {
  cycleBottomYmd: CYCLE_BOTTOM,
  halvingYmd: CYCLE_HALVING,
  cyclePeakYmd: CYCLE_PEAK,
  bearWindowDays: AVG_BEAR_DURATION_DAYS,
};

export type CycleTimingResult = {
  phase: CyclePhase;
  badgeLabel: string;
  interpretation: string;
  daysSincePeak: number;
  bearProgressPct: number;
  barStatus: CycleBarStatus;
  /** Human label under progress bar */
  barCaption: string;
  bottomWindowCopy: string;
  anchorBottomFormatted: string;
  anchorHalvingFormatted: string;
  anchorPeakFormatted: string;
};

const MS_PER_DAY = 86400000;

/** Parse YYYY-MM-DD only; returns UTC midnight ms for that calendar day, or null. */
export function utcCalendarDayMsFromYmd(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms, ds] = ymd.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  const roundTrip = new Date(t).toISOString().slice(0, 10);
  if (roundTrip !== ymd) return null;
  return t;
}

/**
 * Parse dashboard snapshot timestamps to a stable UTC calendar day (no local TZ).
 */
export function parseSnapshotToUtcCalendarDay(iso: string | null | undefined): number | null {
  if (iso == null || typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const datePart = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return utcCalendarDayMsFromYmd(datePart);
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  const ymd = d.toISOString().slice(0, 10);
  return utcCalendarDayMsFromYmd(ymd);
}

export function utcCalendarDayNowMs(): number {
  return utcCalendarDayMsFromYmd(new Date().toISOString().slice(0, 10)) ?? Date.now();
}

function formatAnchorDisplay(ymd: string): string {
  const ms = utcCalendarDayMsFromYmd(ymd);
  if (ms == null) return ymd;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

function projectedBottomMonthYear(peakYmd: string, windowDays: number): string {
  const peakMs = utcCalendarDayMsFromYmd(peakYmd);
  if (peakMs == null) return '—';
  const endMs = peakMs + windowDays * MS_PER_DAY;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(endMs));
}

/**
 * Core timing from a UTC calendar-day instant (ms at UTC midnight) and anchors.
 */
export function calculateCycleTiming(
  asOfUtcDayMs: number | null,
  anchors: CycleTimingAnchors = DEFAULT_CYCLE_ANCHORS
): CycleTimingResult {
  const peakMs = utcCalendarDayMsFromYmd(anchors.cyclePeakYmd);
  const bottomMs = utcCalendarDayMsFromYmd(anchors.cycleBottomYmd);
  const halvingMs = utcCalendarDayMsFromYmd(anchors.halvingYmd);
  const windowDays = anchors.bearWindowDays;

  const bottomWindowLabel = projectedBottomMonthYear(anchors.cyclePeakYmd, windowDays);

  if (
    asOfUtcDayMs == null ||
    peakMs == null ||
    bottomMs == null ||
    halvingMs == null ||
    !Number.isFinite(windowDays) ||
    windowDays <= 0
  ) {
    return {
      phase: 'insufficient',
      badgeLabel: 'INSUFFICIENT DATA',
      interpretation: 'Cycle timing could not be computed from the available date.',
      daysSincePeak: 0,
      bearProgressPct: 0,
      barStatus: 'peak_anchor_not_reached',
      barCaption: '—',
      bottomWindowCopy: `Estimated timing window: ${bottomWindowLabel}`,
      anchorBottomFormatted: formatAnchorDisplay(anchors.cycleBottomYmd),
      anchorHalvingFormatted: formatAnchorDisplay(anchors.halvingYmd),
      anchorPeakFormatted: formatAnchorDisplay(anchors.cyclePeakYmd),
    };
  }

  const daysSincePeak = Math.floor((asOfUtcDayMs - peakMs) / MS_PER_DAY);

  const anchorBottomFormatted = formatAnchorDisplay(anchors.cycleBottomYmd);
  const anchorHalvingFormatted = formatAnchorDisplay(anchors.halvingYmd);
  const anchorPeakFormatted = formatAnchorDisplay(anchors.cyclePeakYmd);
  const bottomWindowCopy = `Historical bottom window: ${bottomWindowLabel}`;

  if (daysSincePeak < 0) {
    return {
      phase: 'expansion',
      badgeLabel: 'EXPANSION PHASE',
      interpretation:
        'Bitcoin remains before the current cycle peak anchor in this timing model.',
      daysSincePeak,
      bearProgressPct: 0,
      barStatus: 'peak_anchor_not_reached',
      barCaption: 'Peak anchor not reached',
      bottomWindowCopy,
      anchorBottomFormatted,
      anchorHalvingFormatted,
      anchorPeakFormatted,
    };
  }

  if (daysSincePeak < windowDays) {
    const raw = (daysSincePeak / windowDays) * 100;
    const bearProgressPct = Math.min(100, Math.max(0, raw));
    return {
      phase: 'correction',
      badgeLabel: 'CORRECTION PHASE',
      interpretation:
        'Bitcoin is in the post-peak timing window based on the October 2025 cycle peak anchor.',
      daysSincePeak,
      bearProgressPct,
      barStatus: 'in_window',
      barCaption: `Day ${daysSincePeak} of ~${windowDays} since cycle peak`,
      bottomWindowCopy,
      anchorBottomFormatted,
      anchorHalvingFormatted,
      anchorPeakFormatted,
    };
  }

  return {
    phase: 'accumulation',
    badgeLabel: 'ACCUMULATION WINDOW',
    interpretation:
      'The historical 365-day post-peak window is complete; timing now points to an accumulation window, not a guaranteed bottom.',
    daysSincePeak,
    bearProgressPct: 100,
    barStatus: 'historical_window_complete',
    barCaption: 'Historical window complete',
    bottomWindowCopy,
    anchorBottomFormatted,
    anchorHalvingFormatted,
    anchorPeakFormatted,
  };
}

export function cycleTimingFromSnapshotIso(
  iso: string | null | undefined,
  anchors: CycleTimingAnchors = DEFAULT_CYCLE_ANCHORS
): CycleTimingResult {
  const day = parseSnapshotToUtcCalendarDay(iso);
  return calculateCycleTiming(day, anchors);
}
