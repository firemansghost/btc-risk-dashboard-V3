'use client';

import React, { useEffect, useState } from 'react';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';

type FactorDetail = {
  label?: string;
  value?: string;
  tooltip?: string;
};

type FactorContext = {
  label: string;
  score: number | null;
  weightPct: number | null;
  status: string | null;
  reason: string | null;
  sourceAsOfUtc: string | null;
  details: FactorDetail[];
};

type ContextData = {
  snapshotDate: string | null;
  snapshotAsOfUtc: string | null;
  factor: FactorContext;
  methodology?: {
    type: string;
    forwardLooking: boolean;
    description: string;
  };
};

function formatUtcDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function ContextCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="text-3xl font-bold text-gray-900 mb-3">{value}</div>
      {description ? <p className="text-sm text-gray-600">{description}</p> : null}
    </div>
  );
}

export default function EtfFlowContextPage() {
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/etf-predictions', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result || typeof result !== 'object' || !result.factor) {
          throw new Error(result?.error || 'ETF flow context unavailable');
        }

        setData({
          snapshotDate: result.snapshotDate ?? null,
          snapshotAsOfUtc: result.snapshotAsOfUtc ?? null,
          factor: {
            label: result.factor.label || 'ETF Flows',
            score: typeof result.factor.score === 'number' ? result.factor.score : null,
            weightPct: typeof result.factor.weightPct === 'number' ? result.factor.weightPct : null,
            status: result.factor.status ?? null,
            reason: result.factor.reason ?? null,
            sourceAsOfUtc: result.factor.sourceAsOfUtc ?? null,
            details: Array.isArray(result.factor.details) ? result.factor.details : [],
          },
          methodology: result.methodology,
        });
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : 'ETF flow context unavailable');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading ETF Flow Context...</p>
        </div>
      </div>
    );
  }

  const factor = data?.factor;
  const sourceDate = formatUtcDate(factor?.sourceAsOfUtc ?? null);
  const snapshotDate = formatUtcDate(data?.snapshotDate ?? data?.snapshotAsOfUtc ?? null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Bitcoin ETF Flow Context</h1>
          <p className="text-lg lg:text-xl text-blue-100">
            Aggregate ETF-flow diagnostics from the current GhostGauge production snapshot. This page
            explains the ETF factor inputs and their source vintage; it does not forecast future ETF
            flows.
          </p>
          <p className="text-base lg:text-lg text-blue-200 mt-2">
            Descriptive context only. These values are not probabilities, AI/ML forecasts, trading
            signals, or an independent per-fund forecast. They are part of the existing production
            ETF factor context.
          </p>
          {data ? (
            <div className="text-sm text-blue-100 mt-4 space-y-1">
              <p>
                ETF source as of {sourceDate || 'not present in snapshot'}
                {factor?.sourceAsOfUtc ? (
                  <span className="block text-blue-200">
                    {formatFriendlyTimestamp(factor.sourceAsOfUtc)}
                  </span>
                ) : null}
              </p>
              <p>
                Dashboard snapshot {snapshotDate || 'not present in snapshot'}
                {data.snapshotAsOfUtc ? (
                  <span className="block text-blue-200">
                    {formatFriendlyTimestamp(data.snapshotAsOfUtc)}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-gray-600">Loading ETF flow context…</p>
        ) : error || !factor ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-sm font-medium text-red-800">ETF flow context unavailable</h2>
            <p className="text-sm text-red-600 mt-1">{error || 'ETF flow context unavailable'}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Production ETF factor</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <ContextCard
                  title="ETF factor score"
                  value={typeof factor.score === 'number' ? String(factor.score) : '—'}
                  description="Aggregate ETF-flow factor score from the current production snapshot."
                />
                <ContextCard
                  title="ETF factor weight"
                  value={typeof factor.weightPct === 'number' ? `${factor.weightPct}%` : '—'}
                  description="Published weight of the ETF factor in the current G-Score mix."
                />
                <ContextCard
                  title="Source status"
                  value={factor.status || '—'}
                  description={factor.reason || 'Status from the production ETF factor artifact.'}
                />
              </div>
            </div>

            {factor.details.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Aggregate ETF-flow diagnostics</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Values below are copied from the production factor details. Units are the
                  snapshot&apos;s existing display values, not independently recalculated here.
                </p>
                <dl className="divide-y divide-gray-100">
                  {factor.details.map((detail, index) => (
                    <div
                      key={`${detail.label || 'detail'}-${index}`}
                      className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1"
                    >
                      <dt className="text-sm font-medium text-gray-700">{detail.label || '—'}</dt>
                      <dd className="text-sm text-gray-900 sm:text-right">
                        <div className="font-mono">{detail.value || '—'}</div>
                        {detail.tooltip ? (
                          <div className="text-xs text-gray-500 mt-1">{detail.tooltip}</div>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </>
        )}

        <div className="mt-8 p-4 bg-blue-100 rounded-lg text-blue-800 text-sm">
          <p>
            <strong>Method:</strong>{' '}
            {data?.methodology?.description ||
              'This page mirrors the aggregate ETF-flow diagnostics used by the current GhostGauge production factor.'}
          </p>
          <p className="mt-2">
            Not financial advice. Per-fund series are not shown on this page.
          </p>
        </div>
      </div>
    </div>
  );
}
