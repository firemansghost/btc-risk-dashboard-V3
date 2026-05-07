// scripts/etl/factors/marketRegime.mjs
// Display-only moving-average regime context (two completed weekly closes vs BMSB + 50W SMA).
// Does not affect G-Score. Duplicates minimal MA helpers to avoid import cycles with trendValuation.mjs.

function sma(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function ema(data, period) {
  if (data.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * multiplier + result[i - 1] * (1 - multiplier));
  }
  return result;
}

/** Same semantics as trendValuation.calculateBMSB */
function calculateBMSB(weeklyCloses) {
  if (weeklyCloses.length < 22) {
    return {
      status: 'insufficient_history',
      lower: null,
      upper: null,
      mid: null,
    };
  }
  const closes = weeklyCloses.map((w) => w.close);
  const sma20Series = sma(closes, 20);
  const ema21Series = ema(closes, 21);
  if (sma20Series.length === 0 || ema21Series.length === 0) {
    return { status: 'calculation_failed', lower: null, upper: null, mid: null };
  }
  const latestSMA20 = sma20Series[sma20Series.length - 1];
  const latestEMA21 = ema21Series[ema21Series.length - 1];
  const lower = Math.min(latestSMA20, latestEMA21);
  const upper = Math.max(latestSMA20, latestEMA21);
  const mid = (latestSMA20 + latestEMA21) / 2;
  return { status: 'ok', lower, upper, mid, sma20: latestSMA20, ema21: latestEMA21 };
}

function bmsbLowerAtWeekIndex(weeklyCloses, weekIndex) {
  const slice = weeklyCloses.slice(0, weekIndex + 1);
  const b = calculateBMSB(slice);
  if (b.lower == null) return null;
  return b.lower;
}

function sma50AtWeekIndex(weeklyCloses, weekIndex) {
  if (weekIndex < 49) return null;
  const closes = weeklyCloses.slice(0, weekIndex + 1).map((w) => w.close);
  const series = sma(closes, 50);
  return series[series.length - 1];
}

function classifyRegime(c0, c1, l0, l1, s0, s1) {
  const bothBelowBand = c0 < l0 && c1 < l1;
  const bothAbove50 = c0 > s0 && c1 > s1;
  const bothAboveLower = c0 > l0 && c1 > l1;

  if (bothBelowBand) return 'bearish';
  if (bothAbove50) return 'bullish';
  if (bothAboveLower) return 'transition';
  return 'transition_mixed';
}

function regimeLabelKey(regime) {
  if (regime === 'bullish') return 'confirmed_bullish';
  if (regime === 'bearish') return 'confirmed_bearish';
  return 'transition';
}

/**
 * Indices into `weeklyCloses` whose ISO week has fully elapsed per daily history.
 * `weekEnd` is the UTC calendar date of the Sunday that closes the ISO week (00:00 UTC).
 * A week counts as completed only when `lastDailyDateUtc` is on or after that Sunday — so
 * `btc_price_history.csv` may include a row for the current calendar day, and the in-progress
 * week's synthetic "weekly close" row still must not confirm until the week-end date is covered.
 * Compare: YYYY-MM-DD lexicographic order matches chronological order.
 */
export function getCompletedWeekIndices(weeklyCloses, lastDailyDateUtc) {
  if (!weeklyCloses?.length || !lastDailyDateUtc) return [];
  const completedIndices = [];
  for (let i = 0; i < weeklyCloses.length; i++) {
    if (lastDailyDateUtc >= weeklyCloses[i].weekEnd) {
      completedIndices.push(i);
    }
  }
  return completedIndices;
}

/** ISO week-ending-Sunday UTC — same grouping as trendValuation.createWeeklyCloses */
export function createWeeklyCloses(dailyCandles) {
  if (!dailyCandles || dailyCandles.length === 0) return [];

  const weeklyCloses = [];
  const candlesByWeek = new Map();

  for (const candle of dailyCandles) {
    const date = new Date(candle.timestamp);
    const dayOfWeek = date.getUTCDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(date.getUTCDate() + daysUntilSunday);
    weekEnd.setUTCHours(0, 0, 0, 0);
    const weekKey = weekEnd.toISOString().split('T')[0];

    if (!candlesByWeek.has(weekKey)) {
      candlesByWeek.set(weekKey, []);
    }
    candlesByWeek.get(weekKey).push(candle);
  }

  for (const [weekKey, candles] of candlesByWeek) {
    if (candles.length > 0) {
      const sortedCandles = candles.sort((a, b) => a.timestamp - b.timestamp);
      const latestCandle = sortedCandles[sortedCandles.length - 1];
      weeklyCloses.push({
        weekEnd: weekKey,
        close: latestCandle.close,
        timestamp: latestCandle.timestamp,
      });
    }
  }

  return weeklyCloses.sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
}

/**
 * @param {Array<{ weekEnd: string, close: number, timestamp: number }>} weeklyCloses - sorted, full series
 * @param {string} lastDailyDateUtc - YYYY-MM-DD of last daily candle (UTC calendar date)
 * @param {number} currentPrice - Daily close used for Trend & Valuation (proximity text)
 * @returns {object} marketRegime payload for latest.json (display-only)
 */
export function computeMarketRegime(weeklyCloses, lastDailyDateUtc, currentPrice) {
  const methodologyNoteOk =
    'Uses the last two completed weekly closes vs the BMSB and 50-week SMA. Proximity uses the Trend daily close. Display-only; does not affect the G-Score.';

  const insufficient = {
    status: 'insufficient_data',
    badge: 'INSUFFICIENT DATA',
    badgeKey: 'insufficient',
    regime: null,
    interpretation: 'Not enough completed weekly history to classify regime yet.',
    durationLine: null,
    proximityLine: null,
    nextConfirmationLine: null,
    methodologyNote: methodologyNoteOk,
    approximation: false,
    lastDailyDateUtc,
    completedWeekEnds: null,
    streakWeeks: null,
    streakLabel: null,
    bmsbLower: null,
    fiftyWeekSma: null,
    lastCompletedWeeklyClose: null,
    distanceLabel: null,
    distancePct: null,
    distanceSide: null,
    nextConfirmationText: null,
  };

  if (
    !weeklyCloses?.length ||
    !lastDailyDateUtc ||
    !Number.isFinite(currentPrice)
  ) {
    return insufficient;
  }

  const completedIndices = getCompletedWeekIndices(weeklyCloses, lastDailyDateUtc);

  if (completedIndices.length < 2) {
    return {
      ...insufficient,
      interpretation:
        'Need two completed weekly closes before the current week finishes (last daily: ' +
        lastDailyDateUtc +
        ').',
    };
  }

  const i1 = completedIndices[completedIndices.length - 1];
  const i0 = completedIndices[completedIndices.length - 2];
  const w0 = weeklyCloses[i0];
  const w1 = weeklyCloses[i1];
  const c0 = w0.close;
  const c1 = w1.close;

  const fullBmsb = calculateBMSB(weeklyCloses);
  const closesAll = weeklyCloses.map((w) => w.close);
  const sma50SeriesFull = closesAll.length >= 50 ? sma(closesAll, 50) : [];
  const currentSma50 =
    sma50SeriesFull.length > 0 ? sma50SeriesFull[sma50SeriesFull.length - 1] : null;

  let l0 = bmsbLowerAtWeekIndex(weeklyCloses, i0);
  let l1 = bmsbLowerAtWeekIndex(weeklyCloses, i1);
  let s0 = sma50AtWeekIndex(weeklyCloses, i0);
  let s1 = sma50AtWeekIndex(weeklyCloses, i1);
  let approximation = false;

  if (l0 == null || l1 == null) {
    if (fullBmsb.lower == null) {
      return { ...insufficient, interpretation: 'BMSB could not be computed for regime context.' };
    }
    l0 = l1 = fullBmsb.lower;
    approximation = true;
  }
  if (s0 == null || s1 == null) {
    if (currentSma50 == null) {
      return { ...insufficient, interpretation: '50-week SMA not available for regime context.' };
    }
    s0 = s1 = currentSma50;
    approximation = true;
  }

  const rawRegime = classifyRegime(c0, c1, l0, l1, s0, s1);
  const key = regimeLabelKey(rawRegime);

  const fmtUsd = (n) =>
    '$' +
    Number(n).toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });

  const pctDiff = (fromLevel, price) =>
    (((price - fromLevel) / fromLevel) * 100).toFixed(1);

  /** Pairs (completedIndices[k], completedIndices[k+1]) walking backward */
  let streakPairs = 1;
  for (let k = completedIndices.length - 3; k >= 0; k--) {
    const a = completedIndices[k];
    const b = completedIndices[k + 1];
    const ca = weeklyCloses[a].close;
    const cb = weeklyCloses[b].close;
    let la = bmsbLowerAtWeekIndex(weeklyCloses, a);
    let lb = bmsbLowerAtWeekIndex(weeklyCloses, b);
    let sa = sma50AtWeekIndex(weeklyCloses, a);
    let sb = sma50AtWeekIndex(weeklyCloses, b);
    if (la == null || lb == null) {
      la = lb = fullBmsb.lower;
    }
    if (sa == null || sb == null) {
      if (currentSma50 == null) break;
      sa = sb = currentSma50;
    }
    const r = classifyRegime(ca, cb, la, lb, sa, sb);
    if (regimeLabelKey(r) !== key) break;
    streakPairs++;
  }
  const durationWeeks = streakPairs + 1;

  /** Human label for streak; matches displayed regime bucket (two-week rule), not a trading signal. */
  const streakTail =
    key === 'confirmed_bullish'
      ? 'bullish'
      : key === 'confirmed_bearish'
        ? 'bearish'
        : 'in transition';
  const streakLabel = `${durationWeeks} consecutive weeks ${streakTail}`;

  let interpretation = '';
  let proximityLine = '';
  let nextConfirmationLine = '';

  const pivot50 = currentSma50 != null ? currentSma50 : s1;
  const bandLower = fullBmsb.lower != null ? fullBmsb.lower : l1;

  /** Display-only row helpers (numbers for UI formatting) */
  let distanceLabel = '';
  let distancePct = null;
  let distanceSide = '';
  let nextConfirmationText = '';

  if (key === 'confirmed_bearish') {
    interpretation =
      'Bitcoin has closed below the BMSB for two completed weeks, confirming bearish regime pressure.';
    const pu = fmtUsd(bandLower);
    const sign = currentPrice >= bandLower ? 'above' : 'below';
    proximityLine = `${Math.abs(Number(pctDiff(bandLower, currentPrice)))}% ${sign} BMSB support area (${pu}) — distance uses Trend daily close.`;
    nextConfirmationLine = `Next structural step: two completed weekly closes back above the BMSB lower band (~${pu}).`;
    distanceLabel = 'Distance to BMSB lower';
    distancePct = Math.abs(Number(pctDiff(bandLower, currentPrice)));
    distanceSide = currentPrice >= bandLower ? 'above' : 'below';
    nextConfirmationText = `2 completed weekly closes above ${pu} (BMSB lower)`;
  } else if (key === 'confirmed_bullish') {
    interpretation =
      'Bitcoin has closed above the macro pivot for two completed weeks, confirming a bullish moving-average regime.';
    const p50 = fmtUsd(pivot50);
    proximityLine = `${Math.abs(Number(pctDiff(pivot50, currentPrice)))}% ${currentPrice >= pivot50 ? 'above' : 'below'} 50-week SMA (${p50}) — distance uses Trend daily close.`;
    nextConfirmationLine = `BMSB lower ~${fmtUsd(bandLower)} is the nearer moving-average support zone.`;
    distanceLabel = 'Distance to 50-week SMA';
    distancePct = Math.abs(Number(pctDiff(pivot50, currentPrice)));
    distanceSide = currentPrice >= pivot50 ? 'above' : 'below';
    nextConfirmationText = `Nearer context: BMSB lower near ${fmtUsd(bandLower)} (moving averages only)`;
  } else {
    interpretation =
      'Bitcoin has reclaimed the BMSB, but has not yet confirmed the macro pivot above the 50-week SMA.';
    const p50 = fmtUsd(pivot50);
    proximityLine = `${Math.abs(Number(pctDiff(pivot50, currentPrice)))}% ${currentPrice >= pivot50 ? 'above' : 'below'} 50-week macro pivot (${p50}).`;
    nextConfirmationLine = `Next confirmation: two completed weekly closes above ${p50} (50-week SMA).`;
    distanceLabel = 'Distance to macro pivot (50W)';
    distancePct = Math.abs(Number(pctDiff(pivot50, currentPrice)));
    distanceSide = currentPrice >= pivot50 ? 'above' : 'below';
    nextConfirmationText = `2 completed weekly closes above ${p50} (50-week SMA)`;
  }

  const badge =
    key === 'confirmed_bullish'
      ? 'CONFIRMED BULLISH'
      : key === 'confirmed_bearish'
        ? 'CONFIRMED BEARISH'
        : 'TRANSITION';

  const durationLine = streakLabel;

  return {
    status: 'ok',
    badge,
    badgeKey: key,
    regime: key,
    rawRegime: rawRegime === 'transition_mixed' ? 'transition_mixed' : rawRegime,
    interpretation,
    durationLine,
    proximityLine,
    nextConfirmationLine,
    methodologyNote: methodologyNoteOk,
    approximation,
    lastDailyDateUtc,
    completedWeekEnds: [w0.weekEnd, w1.weekEnd],
    priceForProximity: currentPrice,
    streakWeeks: durationWeeks,
    streakLabel,
    bmsbLower: bandLower,
    fiftyWeekSma: pivot50,
    lastCompletedWeeklyClose: c1,
    distanceLabel,
    distancePct,
    distanceSide,
    nextConfirmationText,
  };
}
