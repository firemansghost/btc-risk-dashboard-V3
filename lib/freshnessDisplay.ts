/**
 * Presentation-only freshness/status formatting for dashboard UI.
 * Does not alter scoring, ETL staleness rules, or artifact timestamps.
 */

import { getFactorCadence, getFactorTTL } from '@/lib/factorUtils';

export type FreshnessDisplayOptions = {
  /** Include TTL/technical detail (health panel, debug). Default false for compact cards. */
  verbose?: boolean;
};

export type FreshnessRecencyKind = 'recent' | 'withinCadence' | 'stale' | 'excluded' | 'unknown';

export type SystemHealthCounts = {
  fresh: number;
  stale: number;
  excluded: number;
};

export type FreshnessDisplayInput = {
  key?: string;
  status?: string;
  reason?: string | null;
  last_utc?: string | null;
  lastUpdated?: string | null;
  as_of_utc?: string | null;
};

export type FreshnessDisplay = {
  statusLabel: string;
  ageText: string;
  shortLine: string;
  detailLine: string | null;
  recencyKind: FreshnessRecencyKind;
  showDetailInCompactUi: boolean;
};

/** Factors where slower public-data cadence should be explained in compact UI. */
const SLOW_CADENCE_FACTOR_KEYS = new Set(['net_liquidity', 'macro_overlay', 'etf_flows']);

const MS_MINUTE = 60_000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

export function clampAgeMs(lastUpdated: string, now: number = Date.now()): number {
  const ts = new Date(lastUpdated).getTime();
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, now - ts);
}

/**
 * Format age from a timestamp; never returns negative values.
 */
export function formatFreshnessAge(
  lastUpdated: string | null | undefined,
  now: number = Date.now()
): string {
  if (!lastUpdated) return 'unknown';

  const ageMs = clampAgeMs(lastUpdated, now);
  if (ageMs < MS_MINUTE) return 'just now';

  const ageMinutes = Math.floor(ageMs / MS_MINUTE);
  if (ageMinutes < 60) return `${ageMinutes}m`;

  const ageHours = Math.floor(ageMs / MS_HOUR);
  if (ageHours < 24) return `${ageHours}h`;

  const ageDays = Math.floor(ageMs / MS_DAY);
  return `${ageDays}d`;
}

/**
 * Sanitize legacy artifact reason strings (e.g. fresh (-7998s)) for display fallback.
 */
export function sanitizeReasonForDisplay(reason: string | null | undefined): string {
  if (!reason) return '';

  return reason
    .replace(/\(-\d+s\)/g, '(just now)')
    .replace(/\(-\d+min\)/g, '(just now)')
    .replace(/\(-[\d.]+h\s*old\)/gi, '(just now)');
}

function resolveLastUpdated(factor: FreshnessDisplayInput): string | null {
  return factor.last_utc || factor.lastUpdated || factor.as_of_utc || null;
}

function normalizeStatus(status: string | undefined): string {
  if (!status) return 'unknown';
  if (status === 'success') return 'fresh';
  return status;
}

export function getSlowCadenceProfile(factorKey: string | undefined): {
  isSlowCadence: boolean;
  cadenceLabel: string;
  userDetailLine: string;
} | null {
  if (!factorKey || !SLOW_CADENCE_FACTOR_KEYS.has(factorKey)) return null;

  switch (factorKey) {
    case 'net_liquidity':
      return {
        isSlowCadence: true,
        cadenceLabel: 'Weekly FRED',
        userDetailLine: 'Latest available FRED data; fresh within source cadence',
      };
    case 'macro_overlay':
      return {
        isSlowCadence: true,
        cadenceLabel: 'FRED / macro',
        userDetailLine: 'Latest available macro data; fresh within source cadence',
      };
    case 'etf_flows':
      return {
        isSlowCadence: true,
        cadenceLabel: 'Business days',
        userDetailLine: 'Business-day source; latest available flow data',
      };
    default:
      return null;
  }
}

function buildDetailLine(
  factor: FreshnessDisplayInput,
  statusLabel: string,
  ageText: string,
  now: number,
  verbose: boolean
): { detailLine: string | null; recencyKind: FreshnessRecencyKind; showDetailInCompactUi: boolean } {
  const key = factor.key;
  const slowProfile = getSlowCadenceProfile(key);
  const lastUpdated = resolveLastUpdated(factor);

  if (statusLabel === 'excluded') {
    const reason = factor.reason?.trim();
    return {
      detailLine: reason
        ? `Excluded: ${sanitizeReasonForDisplay(reason)}`
        : 'Excluded from today\'s composite',
      recencyKind: 'excluded',
      showDetailInCompactUi: true,
    };
  }

  if (statusLabel === 'stale' || statusLabel === 'stale_beyond_ttl') {
    if (verbose) {
      const ttlHours = key ? getFactorTTL(key) : 24;
      const cadence = key ? getFactorCadence(key) : null;
      const cadenceHint = cadence ? cadence.label : 'configured';
      return {
        detailLine: `Past ${cadenceHint.toLowerCase()} freshness window (${ttlHours}h threshold). Data may still be shown but is no longer treated as current.`,
        recencyKind: 'stale',
        showDetailInCompactUi: true,
      };
    }
    return {
      detailLine: 'Past configured freshness window; may not reflect current conditions.',
      recencyKind: 'stale',
      showDetailInCompactUi: true,
    };
  }

  if (statusLabel === 'fresh' && slowProfile) {
    const ageMs = lastUpdated ? clampAgeMs(lastUpdated, now) : 0;
    const ageDays = ageMs / MS_DAY;
    const showCadenceDetail = ageDays >= 1 || !lastUpdated;

    if (showCadenceDetail) {
      return {
        detailLine: slowProfile.userDetailLine,
        recencyKind: 'withinCadence',
        showDetailInCompactUi: true,
      };
    }
  }

  if (statusLabel === 'fresh') {
    return {
      detailLine: null,
      recencyKind: 'recent',
      showDetailInCompactUi: false,
    };
  }

  if (factor.reason) {
    return {
      detailLine: sanitizeReasonForDisplay(factor.reason),
      recencyKind: 'unknown',
      showDetailInCompactUi: true,
    };
  }

  return {
    detailLine: null,
    recencyKind: 'unknown',
    showDetailInCompactUi: false,
  };
}

/**
 * Build user-facing freshness copy for a factor row/card.
 */
export function getFreshnessDisplay(
  factor: FreshnessDisplayInput,
  now: number = Date.now(),
  options: FreshnessDisplayOptions = {}
): FreshnessDisplay {
  const verbose = options.verbose ?? false;
  const statusLabel = normalizeStatus(factor.status);
  const lastUpdated = resolveLastUpdated(factor);

  let ageText: string;
  if (lastUpdated) {
    ageText = formatFreshnessAge(lastUpdated, now);
  } else if (factor.reason) {
    const match = factor.reason.match(/\(([^)]+)\)\s*$/);
    ageText = match ? sanitizeReasonForDisplay(match[1]).replace(/^\(/, '').replace(/\)$/, '') : 'unknown';
  } else {
    ageText = 'unknown';
  }

  const shortLine =
    statusLabel === 'fresh' || statusLabel === 'stale' || statusLabel === 'excluded'
      ? `${statusLabel} (${ageText})`
      : factor.reason
        ? sanitizeReasonForDisplay(factor.reason)
        : statusLabel;

  const { detailLine, recencyKind, showDetailInCompactUi } = buildDetailLine(
    factor,
    statusLabel,
    ageText,
    now,
    verbose
  );

  return {
    statusLabel,
    ageText,
    shortLine,
    detailLine,
    recencyKind,
    showDetailInCompactUi,
  };
}

export function formatSystemHealthCounts(counts: SystemHealthCounts): string {
  const parts = [
    `${counts.fresh} fresh`,
    `${counts.stale} stale`,
    `${counts.excluded} excluded`,
  ];
  return parts.join(' · ');
}

export function formatSystemHealthSummary(counts: SystemHealthCounts): string {
  if (counts.excluded > 0) {
    return `Degraded: ${counts.excluded} excluded factor${counts.excluded > 1 ? 's' : ''}`;
  }
  if (counts.stale > 0) {
    return `Degraded: ${counts.stale} stale factor${counts.stale > 1 ? 's' : ''}`;
  }
  const total = counts.fresh + counts.stale + counts.excluded;
  if (total === 0) return 'Health unavailable';
  return `All ${total} enabled factor${total > 1 ? 's' : ''} fresh`;
}

/** Data Confidence copy when all required factors are fresh. */
export function formatDataConfidenceFreshCopy(hasSlowCadenceFresh: boolean): {
  insight: string;
  recommendation: string;
  footnote: string | null;
} {
  return {
    insight: 'All required factors are fresh under their configured source cadence.',
    recommendation: 'Data quality is high; no required factors are stale or excluded.',
    footnote: hasSlowCadenceFresh
      ? 'Some macro/liquidity sources update on slower public-data cadences.'
      : null,
  };
}

export function formatFactorConfidenceContext(display: FreshnessDisplay): string {
  if (display.recencyKind === 'excluded') {
    return display.detailLine || 'Factor excluded from scoring';
  }
  if (display.recencyKind === 'stale') {
    return 'Past configured freshness window';
  }
  if (display.recencyKind === 'withinCadence' && display.detailLine) {
    return 'Fresh under configured source cadence';
  }
  return 'Updated recently';
}
