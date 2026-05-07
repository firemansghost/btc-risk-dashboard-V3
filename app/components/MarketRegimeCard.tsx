'use client';

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
};

type MarketRegimeCardProps = {
  marketRegime?: MarketRegimePayload | null;
  /** Trend & Valuation factor status (optional subtle hint) */
  factorStatus?: string;
  className?: string;
};

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

export default function MarketRegimeCard({
  marketRegime,
  factorStatus,
  className = '',
}: MarketRegimeCardProps) {
  const mr = marketRegime;
  const ok = mr && mr.status === 'ok';
  const badgeKey = mr?.badgeKey ?? 'insufficient';

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
        className={`inline-flex items-center justify-center rounded-lg border-2 px-3 py-2 text-center font-bold text-sm sm:text-base tracking-wide ${badgeClasses(
          ok ? badgeKey : 'insufficient'
        )}`}
        role="status"
        aria-label={mr?.badge ?? 'Regime unavailable'}
      >
        {mr?.badge ?? 'INSUFFICIENT DATA'}
      </div>

      {mr?.approximation && ok && (
        <p className="text-xs text-gray-500 mt-2">Uses current BMSB / 50W levels as an approximation for earlier weeks.</p>
      )}

      <p className="text-sm text-gray-700 mt-3 leading-snug">{mr?.interpretation ?? 'Regime data unavailable.'}</p>

      {ok && mr.durationLine && (
        <p className="text-sm text-gray-600 mt-2">{mr.durationLine}</p>
      )}
      {ok && mr.proximityLine && (
        <p className="text-sm text-gray-600 mt-1">{mr.proximityLine}</p>
      )}
      {ok && mr.nextConfirmationLine && (
        <p className="text-sm text-gray-600 mt-1">{mr.nextConfirmationLine}</p>
      )}

      <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-200/90 leading-relaxed">
        {mr?.methodologyNote ??
          'Uses the last two completed weekly closes vs BMSB and 50-week SMA. Display-only; does not affect the G-Score.'}
      </p>
    </div>
  );
}
