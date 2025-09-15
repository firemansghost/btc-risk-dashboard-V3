// lib/math/powerLaw.ts
// Power-law diminishing returns adjustment for Bitcoin price

import { DIMRT } from '@/lib/config';
import { ols, sampleStdDev, clamp, tanh01, dailyToWeekly } from '@/lib/math/normalize';

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string; note?: string };

/**
 * Calculate power-law diminishing returns adjustment
 * @param dailyCandles Array of {timestamp, close} daily candles
 * @param provenance Array to collect provenance information
 * @returns Power-law adjustment result
 */
export async function calculatePowerLawAdjustment(
  dailyCandles: { timestamp: number; close: number }[],
  provenance: Prov[]
): Promise<{
  adj_pts: number;
  residual_z: number | null;
  last_utc: string | null;
  source: string | null;
  reason?: string;
}> {
  if (!DIMRT.enabled) {
    return { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'disabled' };
  }

  try {
    // Convert daily candles to weekly closes
    const weekly = dailyToWeekly(dailyCandles);
    
    if (weekly.length < 10) {
      return { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'insufficient_weekly_data' };
    }

    // Anchor date: 2010-07-18 UTC
    const anchorDate = new Date(DIMRT.anchor + 'T00:00:00.000Z');
    const anchorTs = anchorDate.getTime();

    // Prepare data for regression
    const xs: number[] = [];
    const ys: number[] = [];
    const timestamps: number[] = [];

    for (const candle of weekly) {
      const daysSinceAnchor = Math.max(1, Math.floor((candle.timestamp - anchorTs) / (24 * 60 * 60 * 1000)));
      const x = Math.log(daysSinceAnchor);
      const y = Math.log(candle.close);

      if (Number.isFinite(x) && Number.isFinite(y) && y > 0) {
        xs.push(x);
        ys.push(y);
        timestamps.push(candle.timestamp);
      }
    }

    if (xs.length < 10) {
      return { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'insufficient_regression_data' };
    }

    // Fit OLS regression: y = a + b*x
    const regression = ols(xs, ys);
    if (!regression) {
      return { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'regression_failed' };
    }

    const { a, b } = regression;

    // Calculate residuals
    const residuals: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      const predicted = a + b * xs[i];
      const actual = ys[i];
      residuals.push(actual - predicted);
    }

    // Calculate z-score for the most recent residual
    const mean = residuals.reduce((s, r) => s + r, 0) / residuals.length;
    const std = sampleStdDev(residuals);
    const lastResidual = residuals[residuals.length - 1];
    const z = std > 0 ? (lastResidual - mean) / std : 0;

    // Clip z-score
    const clippedZ = clamp(z, -DIMRT.pl_z_clip, DIMRT.pl_z_clip);

    // Convert to adjustment points
    const tanh = tanh01(clippedZ / DIMRT.pl_z_scale);
    const adj_pts = Math.round(DIMRT.max_points * tanh);

    // Last UTC timestamp
    const lastTimestamp = timestamps[timestamps.length - 1];
    const last_utc = new Date(lastTimestamp).toISOString().slice(0, 19) + 'Z';

    return {
      adj_pts,
      residual_z: clippedZ,
      last_utc,
      source: 'Power-law residual (ln price vs ln time)',
    };

  } catch (error: any) {
    provenance.push({
      url: 'power-law-calculation',
      ok: false,
      status: 0,
      ms: 0,
      error: error?.message ?? String(error),
      note: 'Power-law adjustment calculation failed'
    });

    return { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'calculation_error' };
  }
}

/**
 * Fetch extended daily candles for power-law calculation
 * @param provenance Array to collect provenance information
 * @returns Array of daily candles with extended history
 */
export async function fetchExtendedDailyCandles(provenance: Prov[]): Promise<{ timestamp: number; close: number }[]> {
  const { fetchDailyCandles } = await import('@/lib/data/btc');
  
  // Fetch more data for power-law calculation (12 years worth)
  const days = DIMRT.weekly_window_years * 365;
  const result = await fetchDailyCandles(days, provenance);
  
  // Convert to timestamp/close format
  // fetchDailyCandles returns DailyCandle[] with time and close properties
  return result.map(candle => ({
    timestamp: candle.time,
    close: candle.close
  }));
}
