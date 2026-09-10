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

type AlertsApiResponse = {
  success?: boolean;
  mode?: string;
  source?: string;
  occurred_at?: string | null;
  alerts?: EtlEvent[];
  note?: string;
};

function formatFact(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return 'n/a';
}

function eventTypeLabel(type: string | undefined): string {
  if (type === 'etf_zero_cross') return 'ETF Flow Zero Cross';
  if (type === 'band_change') return 'Risk Band Change';
  return `ETL event: ${type || 'unknown'}`;
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

function typeBadgeClass(type: string | undefined): string {
  if (type === 'etf_zero_cross') return 'bg-blue-100 text-blue-800';
  if (type === 'band_change') return 'bg-slate-100 text-slate-800';
  return 'bg-gray-100 text-gray-800';
}

export default function AlertsPage() {
  const [events, setEvents] = useState<EtlEvent[]>([]);
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [source, setSource] = useState('public/alerts/latest.json');
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    async function fetchCurrentOutput() {
      try {
        const response = await fetch('/api/alerts', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data: AlertsApiResponse = await response.json().catch(() => ({}));

        if (!response.ok || data.success !== true || !Array.isArray(data.alerts)) {
          setUnavailable(true);
          setEvents([]);
          setOccurredAt(null);
          return;
        }

        setUnavailable(false);
        setEvents(data.alerts);
        setOccurredAt(typeof data.occurred_at === 'string' ? data.occurred_at : null);
        if (typeof data.source === 'string' && data.source.trim() !== '') {
          setSource(data.source);
        }
      } catch {
        setUnavailable(true);
        setEvents([]);
        setOccurredAt(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCurrentOutput();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 break-words">
                Alerts — Current ETL Event Output
              </h1>
            </div>
            <Link
              href="/alerts/types"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium shrink-0"
            >
              Current event types →
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5 mb-6 min-w-0">
          <p className="text-sm text-amber-950 leading-relaxed">
            During the live H8 study, GhostGauge intentionally exposes only the latest
            event output written by the frozen production ETL. Legacy alert collections
            are excluded because their schemas, labels, weights, and historical
            provenance are not aligned with current v1.1.1. This page is not a complete
            historical alert ledger.
          </p>
          <p className="text-sm text-amber-950 leading-relaxed mt-3">
            An empty current output means only that the latest successful ETL artifact
            contains no emitted events. It does not prove that no relevant market
            change occurred outside that output.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow mb-6 p-4 sm:p-6 min-w-0">
          <p className="text-sm text-gray-700 break-words">
            <span className="font-medium text-gray-900">Source:</span>{' '}
            <code className="bg-gray-100 px-1 rounded break-all">{source}</code>
          </p>
          <p className="text-sm text-gray-700 mt-2">
            <span className="font-medium text-gray-900">ETL output:</span>{' '}
            {unavailable
              ? 'Current ETL event output unavailable.'
              : occurredAt
                ? formatFriendlyTimestamp(occurredAt)
                : loading
                  ? 'Loading…'
                  : 'Timestamp not present on the current artifact.'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Current-run output only — not a complete alert history.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow min-w-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Latest available ETL events</h2>
          </div>

          <div className="p-4 sm:p-6">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading current ETL event output…</p>
              </div>
            )}

            {!loading && unavailable && (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Current ETL event output unavailable.
                </h3>
                <p className="text-gray-500 text-sm">
                  The public UI did not receive a valid current-run artifact. This is
                  not a statement that no market change occurred.
                </p>
              </div>
            )}

            {!loading && !unavailable && events.length === 0 && (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No events were emitted in the latest available ETL event output.
                </h3>
                <p className="text-gray-500 text-sm">
                  This is current-run output only, not a statement about complete historical
                  market activity.
                </p>
              </div>
            )}

            {!loading && !unavailable && events.length > 0 && (
              <div className="space-y-4">
                {events.map((event, idx) => {
                  const type = typeof event.type === 'string' ? event.type : 'unknown';
                  return (
                    <div
                      key={`${type}-${idx}`}
                      className="border border-gray-200 rounded-lg p-4 min-w-0"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeBadgeClass(type)}`}>
                          {eventTypeLabel(type)}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium break-words">
                        {describeEtlEvent(event)}
                      </p>
                      {type === 'etf_zero_cross' && (
                        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div><span className="font-medium text-gray-800">direction:</span> {formatFact(event.direction)}</div>
                          <div><span className="font-medium text-gray-800">from:</span> {formatFact(event.from)}</div>
                          <div><span className="font-medium text-gray-800">to:</span> {formatFact(event.to)}</div>
                          <div><span className="font-medium text-gray-800">deadband:</span> {formatFact(event.deadband)}</div>
                        </dl>
                      )}
                      {type === 'band_change' && (
                        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="break-words"><span className="font-medium text-gray-800">from:</span> {formatFact(event.from)}</div>
                          <div className="break-words"><span className="font-medium text-gray-800">to:</span> {formatFact(event.to)}</div>
                          <div><span className="font-medium text-gray-800">composite_from:</span> {formatFact(event.composite_from)}</div>
                          <div><span className="font-medium text-gray-800">composite_to:</span> {formatFact(event.composite_to)}</div>
                        </dl>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
