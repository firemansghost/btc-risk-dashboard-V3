/**
 * Date and timestamp formatting utilities for the dashboard
 */

/**
 * Format a date to friendly "MMM D, YYYY · HH:mm UTC" format
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "Sep 22, 2025 · 11:20 UTC"
 */
export function formatFriendlyTimestamp(date: Date | string | number): string {
  if (!date) return '—';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  
  return `${month} ${day}, ${year} · ${hours}:${minutes} UTC`;
}

/**
 * Calculate data freshness based on age
 * @param timestamp - Date object, ISO string, or timestamp
 * @returns Object with freshness level and age in hours
 */
export function calculateFreshness(timestamp: Date | string | number): {
  level: 'Fresh' | 'Stale' | 'Very Stale';
  ageHours: number;
  className: string;
} {
  if (!timestamp) {
    return { level: 'Very Stale', ageHours: 999, className: 'bg-red-100 text-red-800 border-red-200' };
  }
  
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const ageMs = now - then;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  if (ageHours <= 24) {
    return { level: 'Fresh', ageHours, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  } else if (ageHours <= 72) {
    return { level: 'Stale', ageHours, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  } else {
    return { level: 'Very Stale', ageHours, className: 'bg-red-100 text-red-800 border-red-200' };
  }
}

/**
 * Format local timestamp for "Last refreshed" display
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string like "11:24:05 (local)"
 */
export function formatLocalRefreshTime(date: Date | string | number): string {
  if (!date) return '—';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds} (local)`;
}
