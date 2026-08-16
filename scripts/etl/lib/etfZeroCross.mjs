/**
 * ETF 21-day sum zero-cross detection from structured v2 rows.
 * Never reads frozen legacy public/signals/etf_flows_21d.csv.
 */

export function detectEtfZeroCrossFromRows(rows, { lookback = 180 } = {}) {
  const series = (rows || [])
    .map((row) => {
      const raw = row.sum21_usd;
      if (raw == null || raw === '') return { date: row.date, sum21: NaN };
      return { date: row.date, sum21: Number(raw) };
    })
    .filter((row) => row.date && Number.isFinite(row.sum21))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length < 2) {
    return { detected: false, reason: 'insufficient_v2_rows', alerts: [] };
  }

  const window = series.slice(-lookback);
  const values = window.map((row) => row.sum21);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  const eps = Math.max(Math.round(0.02 * std), 1000);
  const prev = window[window.length - 2].sum21;
  const curr = window[window.length - 1].sum21;

  if (Math.abs(prev) > eps && Math.abs(curr) > eps && Math.sign(prev) !== Math.sign(curr)) {
    return {
      detected: true,
      reason: 'zero_cross',
      alerts: [
        {
          type: 'etf_zero_cross',
          direction: curr > 0 ? 'up' : 'down',
          from: prev,
          to: curr,
          deadband: eps,
        },
      ],
      deadband: eps,
    };
  }

  return { detected: false, reason: 'no_zero_cross', alerts: [], deadband: eps, prev, curr };
}
