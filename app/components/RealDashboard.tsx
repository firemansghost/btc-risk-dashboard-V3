'use client';

import { useCallback, useEffect, useState } from 'react';
import HistoryChart from './HistoryChart';
import type { LatestSnapshot } from '@/lib/types';

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function RealDashboard() {
  const [latest, setLatest] = useState<LatestSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDetail, setApiDetail] = useState<any>(null);

  const loadLatest = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/data/latest?ts=' + Date.now(), { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? `GET /api/data/latest failed: ${res.status}`);
      return;
    }
    setLatest(json);
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/refresh', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setApiDetail({ ok: res.ok, status: res.status, json });
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? res.statusText ?? 'Refresh failed');
        return;
      }
      await loadLatest();
    } finally {
      setLoading(false);
    }
  }, [loadLatest]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const factors = latest?.factors ?? [];
  const hasFactor = (key: string) => factors.some(f => f.key === key && f.status !== 'excluded');

  const placeholders = [
    { key: 'trend_valuation', label: 'Trend & Valuation' },
    { key: 'net_liquidity', label: 'Net Liquidity (FRED)' },
    { key: 'stablecoins', label: 'Stablecoins' },
    { key: 'term_leverage', label: 'Term Structure & Leverage' },
    { key: 'onchain', label: 'On-chain Activity' },
    { key: 'etf_flows', label: 'ETF Flows' },
  ].filter(p => !hasFactor(p.key));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bitcoin Risk Dashboard</h1>
          <p className="text-sm text-gray-500">
            Updated <span className="font-mono">{latest?.as_of_utc ?? '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-sm underline"
            onClick={() => window.open('/api/data/latest?ts=' + Date.now(), '_blank', 'noopener,noreferrer')}
          >
            View Raw
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh Dashboard'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Composite Score</div>
          <div className="text-4xl font-bold">{latest?.composite_score ?? '—'}</div>
          <div className="mt-2 text-xs text-gray-500">Band: {latest?.band?.label ?? '—'}</div>
          {latest?.band?.recommendation && <div className="mt-1 text-xs">{latest.band.recommendation}</div>}
          {typeof latest?.btc?.spot_usd === 'number' && (
            <div className="mt-1 text-xs text-gray-500">
              BTC: {fmtUsd0(latest.btc.spot_usd)}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 md:col-span-2">
          <div className="text-sm text-gray-500 mb-2">Health</div>
          <div className="h-2 rounded bg-gray-200 overflow-hidden">
            {!!latest && <div className="h-2 bg-green-500" style={{ width: '100%' }} />}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Price candles: Coinbase Exchange. More factors coming next.
          </div>
        </div>
      </div>

      {placeholders.length ? (
        <div className="grid md:grid-cols-3 gap-4">
          {placeholders.map(p => (
            <div key={p.key} className="rounded-xl border p-4">
              <div className="font-medium">{p.label}</div>
              <div className="text-sm text-gray-500 mt-1">Coming soon — safely excluded.</div>
            </div>
          ))}
        </div>
      ) : null}

      <HistoryChart />

      {error && <div className="text-red-600 text-sm">Error: {error}</div>}

      {apiDetail && (
        <details className="text-sm">
          <summary className="cursor-pointer">API Response Details</summary>
          <pre className="mt-2 p-3 rounded-lg bg-black text-white overflow-auto text-xs">
{JSON.stringify(apiDetail, null, 2)}
</pre>
        </details>
      )}
    </div>
  );
}