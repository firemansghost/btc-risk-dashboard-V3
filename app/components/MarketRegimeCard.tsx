'use client';

import { useEffect, useId, useState } from 'react';
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

function InfoCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}

function MarketRegimeInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[min(90vh,32rem)] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 leading-tight">
              How Market Regime Works
            </h2>
            <p id={descId} className="text-xs text-gray-500 mt-1 leading-snug">
              A moving-average framework for filtering out weekly noise.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            aria-label="Close"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-4 text-sm text-gray-700 leading-relaxed">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              The 2-Week Rule
            </h3>
            <p>
              Bitcoin is volatile, so one weekly move can be a fakeout. This card only confirms a
              regime change after two consecutive completed weekly closes above or below key
              moving-average levels.
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">BMSB</h3>
            <p>
              The Bull Market Support Band combines the 20-week SMA and 21-week EMA. It acts as the
              first trend test: in stronger markets it tends to behave like support; in weaker
              markets it often turns into resistance.
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              50-Week SMA
            </h3>
            <p>
              The 50-week SMA is the macro pivot. Sustained price action above it helps distinguish
              a true bull regime from a temporary relief rally.
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              How GhostGauge uses it
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="font-medium text-gray-900">Confirmed Bearish:</strong> two
                completed weekly closes below the BMSB
              </li>
              <li>
                <strong className="font-medium text-gray-900">Transition:</strong> two completed
                weekly closes above the BMSB, but not yet above the 50-week SMA for two consecutive
                weeks
              </li>
              <li>
                <strong className="font-medium text-gray-900">Confirmed Bullish:</strong> two
                completed weekly closes above the 50-week SMA
              </li>
            </ul>
          </section>
          <section className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600">
            <p className="font-medium text-gray-800 mb-0.5">Important</p>
            <p>
              This is a display-only context card. It helps interpret the trend, but it does not
              affect the official G-Score.
            </p>
          </section>
        </div>
        <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketRegimeCard({
  marketRegime,
  factorStatus,
  className = '',
}: MarketRegimeCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);
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
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <h2 className="mobile-subheading text-gray-900">Market Regime</h2>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={infoOpen}
            aria-label="Explain Market Regime methodology"
            className="shrink-0 inline-flex items-center justify-center rounded-full p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:p-0.5"
          >
            <InfoCircleIcon className="w-5 h-5 sm:w-[1.15rem] sm:h-[1.15rem]" />
          </button>
        </div>
        {factorStatus && factorStatus !== 'fresh' && (
          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 shrink-0">
            Trend data: {factorStatus}
          </span>
        )}
      </div>

      <MarketRegimeInfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />

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
          {lastCloseRow && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm min-w-0 items-baseline">
              <span className="text-gray-500 shrink-0">Last weekly close</span>
              <span className="text-gray-950 font-semibold min-w-0 break-words tabular-nums">
                {lastCloseRow}
              </span>
            </div>
          )}
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
