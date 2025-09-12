// lib/indicators/rsi.ts
// RSI(14) with Wilder's smoothing

/**
 * Calculate RSI(14) using Wilder's smoothing method
 * @param closes Array of closing prices
 * @returns Array of RSI values (NaN until 14 samples available)
 */
export function rsi14(closes: number[]): number[] {
  if (closes.length < 2) {
    return new Array(closes.length).fill(NaN);
  }

  const rsi = new Array(closes.length).fill(NaN);
  const period = 14;

  // Need at least period + 1 values to calculate RSI
  if (closes.length < period + 1) {
    return rsi;
  }

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate first RSI value
  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    let gain = 0;
    let loss = 0;

    if (change > 0) {
      gain = change;
    } else {
      loss = Math.abs(change);
    }

    // Wilder's smoothing: new_avg = (prev_avg * (period - 1) + new_value) / period
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}
