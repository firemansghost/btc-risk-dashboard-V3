'use client';

import type { ReactNode } from 'react';

export type MarketRegimePayload = {
  status: string;
  badge: string;
  badgeKey: string;
  regime: string | null;
  rawRegime?: string;
  interpretation: string;
  durationLine: string | null;
  proximityLine: string | null;
  nextConfirmationLine: string | null;
  methodologyNote: string;
  approximation?: boolean;
  lastDailyDateUtc?: string | null;
  completedWeekEnds?: string[] | null;
  priceForProximity?: number;
  streakWeeks?: number | null;
  streakLabel?: string | null;
  bmsbLower?: number | null;
  fiftyWeekSma?: number | null;
  lastCompletedWeeklyClose?: number | null;
  distanceLabel?: string | null;
  distancePct?: number | null;
  distanceSide?: string | null;
  nextConfirmationText?: string | null;
};

type MarketRegimeCardProps = {
  marketRegime?: MarketRegimePayload | null;
  /** Trend & Valuation factor status (optional subtle hint) */
  factorStatus?: string;
  className?: string;
};

function fmtUsd(n: number) {
  return (
    '$' +
    Number(n).toLocaleString('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })
  );
}

/** Normalize badge copy for older payloads */
function displayBadgeText(badge: string | undefined) {
  if (!badge) return 'INSUFFICIENT DATA';
  if (badge === 'TRANSITION / NEUTRAL') return 'TRANSITION';
  return badge;
}

function badgeClasses(badgeKey: string): string {
  switch (badgeKey) {
    case 'confirmed_bullish':
      return 'bg-emerald-600 text-white border-emerald-700';
    case 'confirmed_bearish':
      return 'bg-red-600 text-white border-red-700';
    case 'transition':
      return 'bg-amber-500 text-gray-900 border-amber-600';
    default:
      return 'bg-gray-500 text-white border-gray-600';
  }
}

function RegimeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm min-w-0 items-baseline">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function MarketRegimeCard({
  marketRegime,
  factorStatus,
  className = '',
}: MarketRegimeCardProps) {
  const mr = marketRegime;
  const ok = mr && mr.status === 'ok';
  const badgeKey = mr?.badgeKey ?? 'insufficient';

  const streakTail =
    badgeKey === 'confirmed_bullish'
      ? 'bullish'
      : badgeKey === 'confirmed_bearish'
        ? 'bearish'
        : 'in transition';

  const streakText =
    ok &&
    (mr.streakLabel ??
      (mr.streakWeeks != null ? `${mr.streakWeeks} consecutive weeks ${streakTail}` : null));

  const bmsbRow =
    ok && mr.bmsbLower != null && Number.isFinite(mr.bmsbLower) ? fmtUsd(mr.bmsbLower) : null;
  const sma50Row =
    ok && mr.fiftyWeekSma != null && Number.isFinite(mr.fiftyWeekSma)
      ? fmtUsd(mr.fiftyWeekSma)
      : null;
  const lastCloseRow =
    ok &&
    mr.lastCompletedWeeklyClose != null &&
    Number.isFinite(mr.lastCompletedWeeklyClose)
      ? fmtUsd(mr.lastCompletedWeeklyClose)
      : null;

  const distanceRow =
    ok &&
    mr.distancePct != null &&
    mr.distanceSide &&
    mr.distanceLabel
      ? `${mr.distancePct}% ${mr.distanceSide}`
      : null;

  const hasNewRowData =
    ok &&
    (streakText ||
      (mr.bmsbLower != null && Number.isFinite(mr.bmsbLower)) ||
      (mr.fiftyWeekSma != null && Number.isFinite(mr.fiftyWeekSma)) ||
      (mr.lastCompletedWeeklyClose != null && Number.isFinite(mr.lastCompletedWeeklyClose)) ||
      (mr.distancePct != null && mr.distanceSide && mr.distanceLabel));

  const isLegacyCompact =
    ok &&
    !hasNewRowData &&
    !!(mr?.proximityLine || mr?.nextConfirmationLine || mr?.durationLine);

  const nextBody =
    ok &&
    !isLegacyCompact &&
    (mr.nextConfirmationText ||
      (mr.nextConfirmationLine
        ? mr.nextConfirmationLine.replace(/^\s*Next confirmation:\s*/i, '')
        : null));

  const methodology =
    mr?.methodologyNote ??
    'Uses the last two completed weekly closes vs the BMSB and 50-week SMA. Proximity uses the Trend daily close. Display-only; does not affect the G-Score.';

  return (
    <div
      className={`glass-card glass-shadow-lg card-md border border-white/20 card-hover w-full min-w-0 flex flex-col ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="mobile-subheading text-gray-900">Market Regime</h2>
        {factorStatus && factorStatus !== 'fresh' && (
          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 shrink-0">
            Trend data: {factorStatus}
          </span>
        )}
      </div>

      <div
        className={`inline-flex w-full sm:w-auto justify-center rounded-lg border-2 px-3 py-2.5 text-center font-bold text-xs sm:text-sm tracking-wide leading-tight ${badgeClasses(
          ok ? badgeKey : 'insufficient'
        )}`}
        role="status"
        aria-label={displayBadgeText(mr?.badge)}
      >
        {displayBadgeText(mr?.badge)}
      </div>

      {mr?.approximation && ok && (
        <p className="text-xs text-gray-500 mt-2">
          Uses current BMSB / 50W levels as an approximation for earlier weeks.
        </p>
      )}

      <p className="text-sm text-gray-800 mt-3 leading-snug">{mr?.interpretation ?? 'Regime data unavailable.'}</p>

      {ok && hasNewRowData && (
        <div className="mt-4 space-y-2 border-t border-gray-200/90 pt-3">
          {streakText && <RegimeRow label="Streak">{streakText}</RegimeRow>}
          {bmsbRow && <RegimeRow label="BMSB lower">{bmsbRow}</RegimeRow>}
          {sma50Row && <RegimeRow label="50W SMA">{sma50Row}</RegimeRow>}
          {lastCloseRow && <RegimeRow label="Last weekly close">{lastCloseRow}</RegimeRow>}
          {distanceRow && mr.distanceLabel && (
            <RegimeRow label={mr.distanceLabel}>{distanceRow}</RegimeRow>
          )}
        </div>
      )}

      {ok && isLegacyCompact && (
        <div className="mt-3 space-y-2 border-t border-gray-200/90 pt-3 text-sm text-gray-700">
          {mr.durationLine && <p className="leading-snug">{mr.durationLine}</p>}
          {mr.proximityLine && <p className="leading-snug">{mr.proximityLine}</p>}
          {mr.nextConfirmationLine && <p className="leading-snug">{mr.nextConfirmationLine}</p>}
        </div>
      )}

      {ok && nextBody && (
        <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-gray-900 min-w-0">
          <div className="text-xs font-semibold text-amber-900/90 uppercase tracking-wide mb-1">
            Next confirmation
          </div>
          <p className="leading-snug break-words">{nextBody}</p>
        </div>
      )}

      {!ok && mr?.proximityLine && (
        <p className="text-xs text-gray-600 mt-2">{mr.proximityLine}</p>
      )}

      <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-200/90 leading-relaxed">
        {methodology}
      </p>
    </div>
  );
}
