import { isLegacyScoreCachePath } from './v12ProductionAdapters.mjs';

export function normalizeCachePath(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/');
}

/**
 * Frozen v1.1.2 rollback score caches and the undated Stablecoin baseline.
 * The self-check must not purge these, even when their timestamps are stale.
 */
export function isProtectedRollbackCache(relativePath) {
  return isLegacyScoreCachePath(normalizeCachePath(relativePath));
}

/**
 * Apply the self-check stale-cache decision.
 * Protected rollback caches are kept. Other stale caches are removed.
 * Entries that are not stale are left in place.
 */
export async function purgeEligibleStaleCaches({ entries, remove }) {
  const removed = [];
  const preserved = [];
  for (const entry of entries) {
    const relativePath = normalizeCachePath(entry.relativePath);
    if (entry.stale !== true) {
      preserved.push({ path: relativePath, reason: 'not_stale' });
      continue;
    }
    if (isProtectedRollbackCache(relativePath)) {
      preserved.push({ path: relativePath, reason: 'frozen_rollback_cache' });
      continue;
    }
    await remove(entry.absolutePath);
    removed.push(relativePath);
  }
  return { removed, preserved };
}
