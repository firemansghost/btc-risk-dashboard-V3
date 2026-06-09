/**
 * Presentation-only stale detection for the Bitcoin⇄Gold display card.
 * Does not alter gold fetching, ETL, API behavior, or scoring.
 */

/** Conservative display-only threshold: gold reference older than this vs dashboard snapshot is labeled stale. */
export const GOLD_CROSS_DISPLAY_STALE_DAYS = 7;

const MS_DAY = 24 * 60 * 60 * 1000;

export type GoldCrossDisplayStatus = 'fresh' | 'stale' | 'missing';

export function getGoldCrossDisplayStatus(
  goldUpdatedAt: string | null | undefined,
  referenceUtc: string | null | undefined,
  now: number = Date.now()
): GoldCrossDisplayStatus {
  if (!goldUpdatedAt) return 'missing';

  const goldTs = new Date(goldUpdatedAt).getTime();
  if (!Number.isFinite(goldTs)) return 'missing';

  const referenceTs = referenceUtc ? new Date(referenceUtc).getTime() : now;
  const ref = Number.isFinite(referenceTs) ? referenceTs : now;

  const ageMs = Math.max(0, ref - goldTs);
  const staleThresholdMs = GOLD_CROSS_DISPLAY_STALE_DAYS * MS_DAY;

  return ageMs > staleThresholdMs ? 'stale' : 'fresh';
}
