'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';

type EtlEvent = {
  type?: string;
  direction?: unknown;
  from?: unknown;
  to?: unknown;
  deadband?: unknown;
  composite_from?: unknown;
  composite_to?: unknown;
  [key: string]: unknown;
};

type LoadState = 'loading' | 'ok' | 'unavailable';

function formatFact(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return 'n/a';
}

function describeEtlEvent(event: EtlEvent): string {
  const type = typeof event?.type === 'string' ? event.type : 'unknown';
  if (type === 'etf_zero_cross') {
    return `ETF 21-day flow measure crossed zero: ${formatFact(event.from)} → ${formatFact(event.to)}`;
  }
  if (type === 'band_change') {
    return `Risk band changed: ${formatFact(event.from)} → ${formatFact(event.to)} (${formatFact(event.composite_from)} → ${formatFact(event.composite_to)})`;
  }
  return `ETL event: ${type}`;
}

function statusLabel(state: LoadState, count: number): string {
  if (state === 'unavailable') return 'ETL events unavailable';
  if (count === 0) return 'No current ETL events';
  return count === 1 ? '1 current ETL event' : `${count} current ETL events`;
}

export default function AlertBell() {
  const [events, setEvents] = useState<EtlEvent[]>([]);
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isHovered, setIsHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchCurrentOutput() {
      try {
        const response = await fetch('/api/alerts', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success !== true || !Array.isArray(data.alerts)) {
          setLoadState('unavailable');
          setEvents([]);
          setOccurredAt(null);
          return;
        }

        setLoadState('ok');
        setEvents(data.alerts);
        setOccurredAt(typeof data.occurred_at === 'string' ? data.occurred_at : null);
      } catch {
        setLoadState('unavailable');
        setEvents([]);
        setOccurredAt(null);
      }
    }

    fetchCurrentOutput();

    const handleDashboardRefresh = () => {
      fetchCurrentOutput();
    };
    const handleWorkflowComplete = () => {
      fetchCurrentOutput();
    };

    window.addEventListener('dashboard-refreshed', handleDashboardRefresh);
    window.addEventListener('workflow-completed', handleWorkflowComplete);

    return () => {
      window.removeEventListener('dashboard-refreshed', handleDashboardRefresh);
      window.removeEventListener('workflow-completed', handleWorkflowComplete);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      if (!isPopupHovered) {
        setIsHovered(false);
      }
    }, 150);
    setHoverTimeout(timeout);
  };

  const handlePopupMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsPopupHovered(true);
  };

  const handlePopupMouseLeave = () => {
    setIsPopupHovered(false);
    setIsHovered(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const label = statusLabel(loadState, events.length);
  const showPopup = loadState !== 'loading' && (isHovered || isPopupHovered);

  if (loadState === 'loading') {
    return (
      <div className="relative min-w-0">
        <div className="w-6 h-6 text-gray-400 animate-pulse">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 max-w-full">
      <Link
        href="/alerts"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors min-w-0 max-w-full"
        title={label}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative shrink-0">
          <svg
            className={`w-6 h-6 ${
              loadState === 'unavailable'
                ? 'text-amber-600'
                : events.length > 0
                  ? 'text-slate-700'
                  : 'text-gray-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
          {loadState === 'ok' && events.length > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[0.75rem] h-3 px-0.5 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-[10px] leading-none text-white font-bold">{events.length}</span>
            </div>
          )}
        </div>
        <span className="text-sm font-medium break-words min-w-0">
          {label}
        </span>
      </Link>

      {showPopup && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3"
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <div className="text-xs text-gray-500 mb-2 break-words">
            {occurredAt
              ? `ETL output as of ${formatFriendlyTimestamp(occurredAt)}`
              : loadState === 'unavailable'
                ? 'Current ETL event output unavailable.'
                : 'ETL output timestamp not present on the current artifact.'}
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Current-run output only — not a complete alert history.
          </p>
          {loadState === 'unavailable' && (
            <p className="text-sm text-gray-700">ETL events unavailable</p>
          )}
          {loadState === 'ok' && events.length === 0 && (
            <p className="text-sm text-gray-700">No current ETL events</p>
          )}
          {loadState === 'ok' &&
            events.slice(0, 5).map((event, idx) => (
              <div key={`${event.type || 'event'}-${idx}`} className="text-sm text-gray-700 mb-2 p-2 bg-gray-50 rounded break-words">
                {describeEtlEvent(event)}
              </div>
            ))}
          {loadState === 'ok' && events.length > 5 && (
            <div className="text-xs text-gray-500 mb-2">
              … and {events.length - 5} more
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <Link
              href="/alerts"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View current ETL events →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
