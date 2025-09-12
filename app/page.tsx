'use client';

import { useEffect, useMemo, useState } from 'react';
import ScoreGauge from './components/ScoreGauge';
import FactorCard from './components/FactorCard';

// Very light local type to avoid import churn
type FactorDetail = { label: string; value: any };
type FactorSummary = {
  key: string;
  label: string;
  weight_pct: number;
  score: number | null;
  status: 'fresh' | 'stale' | 'excluded';
  last_utc: string | null;
  source: string | null;
  details: FactorDetail[];
  reason?: string;
};
type LatestSnapshot = {
  ok: boolean;
  as_of_utc: string;
  composite_score: number;
  band: { key: string; label: string; range: [number, number]; color: string; recommendation: string };
  health: 'green' | 'yellow' | 'red' | 'gray';
  factors: FactorSummary[];
  btc: { spot_usd: number; as_of_utc: string; source: string };
};

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Page() {
  const [tab, setTab] = useState<'overview' | 'sources'>('overview');
  const [latest, setLatest] = useState<LatestSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function fetchLatest({ refresh }: { refresh: boolean }) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/refresh', { method: refresh ? 'POST' : 'GET', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? res.statusText);
      setLatest(j.latest ?? j); // supports both {latest} and direct payload
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLatest({ refresh: false });
  }, []);

  const composite = latest?.composite_score ?? 0;
  const btc = latest?.btc?.spot_usd ?? null;

  const factors = useMemo(() => latest?.factors ?? [], [latest]);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-400 bg-clip-text text-transparent">
                  Bitcoin Risk Dashboard
                </span>
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Updated <span className="font-medium">{latest ? new Date(latest.as_of_utc).toISOString() : '—'}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLatest({ refresh: true })}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Refresh Dashboard
              </button>
              <a
                href="/api/refresh"
                target="_blank"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                View Raw
              </a>
            </div>
          </div>

          {err && <p className="mt-3 text-sm text-red-600">Error: {err}</p>}
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <div className="inline-flex overflow-hidden rounded-xl border bg-white p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'overview' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'sources' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
            onClick={() => setTab('sources')}
          >
            Data Sources
          </button>
        </div>
      </div>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-6">
        {/* Hero / headline score */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Score + band */}
            <div className="md:col-span-2">
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-sm uppercase tracking-wide text-neutral-500">Composite Score</div>
                  <div className="mt-1 text-6xl font-semibold tabular-nums">{composite}</div>
                </div>
                <div className="grow">
                  <div className="mt-2">
                    <ScoreGauge value={composite} />
                  </div>
                  <div className="mt-2 text-sm text-neutral-600">
                    <span className="font-medium">{latest?.band?.label ?? '—'}</span>
                    <span className="mx-2 opacity-50">•</span>
                    {latest?.band?.recommendation ?? '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* BTC price block */}
            <div className="rounded-xl border bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">BTC</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{btc ? fmtUSD(btc) : '—'}</div>
              <div className="mt-2 text-sm text-neutral-600">
                <span>Live from {latest?.btc?.source ?? '—'}</span>
                <span className="mx-2 opacity-50">•</span>
                <span>Updated {timeAgo(latest?.btc?.as_of_utc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {tab === 'overview' ? (
          <>
            {/* Factor grid */}
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {loading && !latest && (
                <div className="col-span-full rounded-2xl border bg-white p-6 text-neutral-500">Loading…</div>
              )}
              {factors.map((f) => (
                <FactorCard key={f.key} factor={f} />
              ))}
            </div>
          </>
        ) : (
          /* Data Sources tab */
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {factors.map((f) => (
              <div key={f.key} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="mb-2 flex items-start justify-between">
                  <div className="text-lg font-medium">{f.label}</div>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-neutral-600">
                    Weight {f.weight_pct}%
                  </span>
                </div>
                <p className="text-sm text-neutral-600">
                  <span className="font-medium">Source:</span> {f.source ?? '—'}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  <span className="font-medium">Last update:</span> {f.last_utc ?? '—'}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  <span className="font-medium">Status:</span>{' '}
                  {f.status === 'fresh' ? 'Fresh' : f.status === 'stale' ? 'Stale' : 'Excluded'}
                  {f.reason ? ` — ${f.reason}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
