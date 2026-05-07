'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AVG_BEAR_DURATION_DAYS,
  calculateCycleTiming,
  parseSnapshotToUtcCalendarDay,
  utcCalendarDayNowMs,
  type CyclePhase,
  type CycleTimingResult,
} from '@/lib/cycleTiming';

type CycleTimingCardProps = {
  asOfUtc?: string | null;
  /** True while the main dashboard snapshot is still loading (avoids a false INSUFFICIENT DATA flash). */
  dashboardLoading?: boolean;
  className?: string;
};

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

function badgeClasses(phase: CyclePhase): string {
  switch (phase) {
    case 'expansion':
      return 'bg-sky-600 text-white border-sky-700';
    case 'correction':
      return 'bg-amber-500 text-gray-900 border-amber-600';
    case 'accumulation':
      return 'bg-teal-600 text-white border-teal-700';
    default:
      return 'bg-gray-500 text-white border-gray-600';
  }
}

function CycleTimingInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
              How Cycle Timing Works
            </h2>
            <p id={descId} className="text-xs text-gray-500 mt-1 leading-snug">
              A time-based companion to the Market Regime card.
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
              Historical cycle rhythm
            </h3>
            <p>
              Bitcoin has often moved in rough four-year cycles around halving events. This card uses
              fixed cycle anchors to show where the current cycle sits in time.
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              Cycle anchors
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cycle bottom: November 21, 2022</li>
              <li>Halving: April 20, 2024</li>
              <li>Cycle peak anchor: October 15, 2025</li>
              <li>Historical bear window: roughly 365 days after the peak</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              What the progress bar shows
            </h3>
            <p>
              The progress bar tracks the number of days since the October 2025 peak anchor against a
              365-day historical post-peak timing window.
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              Reference levels (not live)
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
              <li>2022 cycle bottom near $15,500 (anchor reference only)</li>
              <li>2025 cycle peak anchor near $126,000 (anchor reference only)</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-1">
              Lifecycle note
            </h3>
            <p>
              This card does not automatically detect new tops, bottoms, or bull-market starts from
              price. It updates time progress from the fixed anchors above. The Market Regime card
              handles price-structure confirmation.
            </p>
          </section>
          <section className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600">
            <p className="font-medium text-gray-800 mb-0.5">Important</p>
            <p>
              This is a display-only timing model based on historical averages. It does not predict a
              guaranteed bottom and does not affect the official G-Score.
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

function formatDaysSincePeak(r: CycleTimingResult): string {
  if (r.phase === 'insufficient') return '—';
  if (r.daysSincePeak < 0) {
    const n = Math.abs(r.daysSincePeak);
    return `${n} day${n === 1 ? '' : 's'} before peak anchor`;
  }
  return `${r.daysSincePeak} day${r.daysSincePeak === 1 ? '' : 's'}`;
}

function formatBearProgress(r: CycleTimingResult): string {
  if (r.phase === 'insufficient') return '—';
  if (r.phase === 'expansion') return 'Pre-peak (0% of 365 days)';
  return `${r.bearProgressPct.toFixed(1)}% of ${AVG_BEAR_DURATION_DAYS} days`;
}

/** Month/year only; row label already says “Historical bottom window”. */
function bottomWindowRowValue(bottomWindowCopy: string): string {
  const t = bottomWindowCopy.trim();
  const withoutHistorical = t.replace(/^Historical bottom window:\s*/i, '').trim();
  if (withoutHistorical !== t) return withoutHistorical || '—';
  const withoutEstimated = t.replace(/^Estimated timing window:\s*/i, '').trim();
  if (withoutEstimated !== t) return withoutEstimated || '—';
  return t || '—';
}

export default function CycleTimingCard({
  asOfUtc,
  dashboardLoading = false,
  className = '',
}: CycleTimingCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const snapshotDayMs = useMemo(() => parseSnapshotToUtcCalendarDay(asOfUtc), [asOfUtc]);

  const { effectiveDayMs, usesFallback } = useMemo(() => {
    if (dashboardLoading) {
      return { effectiveDayMs: null as number | null, usesFallback: false };
    }
    if (snapshotDayMs != null) {
      return { effectiveDayMs: snapshotDayMs, usesFallback: false };
    }
    return { effectiveDayMs: utcCalendarDayNowMs(), usesFallback: true };
  }, [dashboardLoading, snapshotDayMs]);

  const r = useMemo(
    () =>
      effectiveDayMs != null ? calculateCycleTiming(effectiveDayMs) : calculateCycleTiming(null),
    [effectiveDayMs]
  );

  const progressForBar = r.bearProgressPct;
  const thumbLeft = `${Math.min(100, Math.max(0, progressForBar))}%`;

  return (
    <div
      className={`glass-card glass-shadow-lg card-md border border-white/20 card-hover w-full min-w-0 flex flex-col ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="mobile-subheading text-gray-900">Cycle Timing</h2>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={infoOpen}
              aria-label="Explain Cycle Timing methodology"
              className="shrink-0 inline-flex items-center justify-center rounded-full p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:p-0.5"
            >
              <InfoCircleIcon className="w-5 h-5 sm:w-[1.15rem] sm:h-[1.15rem]" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            Historical timing context based on the current cycle anchors.
          </p>
        </div>
      </div>

      <CycleTimingInfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />

      {dashboardLoading ? (
        <p
          className="text-sm text-gray-500 mt-3 leading-snug"
          aria-busy="true"
          aria-live="polite"
        >
          Loading cycle timing…
        </p>
      ) : (
        <>
          <div
            className={`inline-flex w-full sm:w-auto justify-center rounded-lg border-2 px-3 py-2.5 text-center font-bold text-xs sm:text-sm tracking-wide leading-tight ${badgeClasses(
              r.phase
            )}`}
            role="status"
            aria-label={r.badgeLabel}
          >
            {r.badgeLabel}
          </div>

          {usesFallback && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-2">
              Timing uses current UTC date (snapshot date unavailable).
            </p>
          )}

          <p className="text-sm text-gray-800 mt-3 leading-snug">{r.interpretation}</p>

          <div className="mt-4 space-y-2 border-t border-gray-200/90 pt-3">
            <RegimeRow label="Days since peak">{formatDaysSincePeak(r)}</RegimeRow>
            <RegimeRow label="Post-peak progress">{formatBearProgress(r)}</RegimeRow>
            <RegimeRow label="Historical bottom window">
              {bottomWindowRowValue(r.bottomWindowCopy)}
            </RegimeRow>
            <RegimeRow label="Cycle peak anchor">{r.anchorPeakFormatted}</RegimeRow>
            <RegimeRow label="Halving">{r.anchorHalvingFormatted}</RegimeRow>
            <RegimeRow label="Cycle bottom">{r.anchorBottomFormatted}</RegimeRow>
          </div>

          <div className="mt-4 min-w-0">
            <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mb-1 gap-2">
              <span className="shrink-0">Post-peak timing window</span>
              <span className="tabular-nums shrink-0">0 – {AVG_BEAR_DURATION_DAYS} days</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-gray-200 overflow-visible">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] duration-300"
                style={{ width: thumbLeft }}
                aria-hidden
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-amber-600 shadow-sm animate-pulse -translate-x-1/2"
                style={{ left: thumbLeft }}
                aria-hidden
              />
            </div>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1.5 leading-snug">{r.barCaption}</p>
          </div>
        </>
      )}
    </div>
  );
}
