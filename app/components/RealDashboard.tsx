'use client';
import { useCallback, useEffect, useState } from 'react';
import HistoryChart from './HistoryChart';
import type { LatestSnapshot } from '@/lib/types';

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(n);

export default function RealDashboard() {
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<LatestSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiDetail, setApiDetail] = useState<any>(null);

  const loadLatest = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/data/latest?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) { setError(`GET /api/data/latest failed: ${res.status}`); return; }
    const json = await res.json(); setLatest(json);
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch('/api/refresh', { method: 'POST' });
      const json = await res.json().catch(()=>({}));
      setApiDetail({ ok: res.ok, status: res.status, json });
      if (!res.ok || !json?.ok) { setError(json?.error ?? res.statusText ?? 'Refresh failed'); return; }
      await loadLatest();
    } finally { setLoading(false); }
  }, [loadLatest]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const factors = latest?.factors ?? [];
  const has = (key: string) => factors.some(f => f.key === key && f.status !== 'excluded');
  const placeholders = [
    { key:'net_liquidity', label:'Net Liquidity (FRED)' },
    { key:'stablecoins', label:'Stablecoins' },
    { key:'term_leverage', label:'Term Structure & Leverage' },
    { key:'onchain', label:'On-chain Activity' },
    { key:'etf_flows', label:'ETF Flows' },
  ].filter(p => !has(p.key));

  const tv = factors.find(f => f.key === 'trend_valuation');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bitcoin Risk Dashboard</h1>
          <p className="text-sm text-gray-500">Updated <span className="font-mono">{latest?.as_of_utc ?? '—'}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sm underline" onClick={() => window.open('/api/data/latest?ts=' + Date.now(), '_blank')}>
            View Raw
          </button>
          <button onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
            {loading ? 'Refreshing…' : 'Refresh Dashboard'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Composite Score</div>
          <div className="text-4xl font-bold">{latest?.composite_score ?? '—'}</div>
          <div className="mt-2 text-xs text-gray-500">Band: {latest?.band?.label ?? '—'}</div>
          {typeof latest?.btc?.spot_usd === 'number' && (
            <div className="mt-1 text-xs text-gray-500">
              BTC: {fmtUsd0(latest.btc.spot_usd!)}{latest?.btc?.as_of_utc ? ` • as of ${new Date(latest.btc.as_of_utc).toISOString().slice(0,16).replace('T',' ')}Z` : ''}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 md:col-span-2">
          <div className="text-sm text-gray-500 mb-2">Health</div>
          <div className="h-2 rounded bg-gray-200 overflow-hidden">
            {!!latest && <div className="h-2 bg-green-500" style={{ width:'100%' }} />}
          </div>
          <div className="mt-2 text-xs text-gray-500">Price: Coinbase spot ticker for MVP.</div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Trend &amp; Valuation</div>
          <div className="text-xs text-gray-500">Weight {tv?.weight_pct ?? 30}% • {tv?.source ?? '—'}</div>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Score</div>
            <div className="text-3xl font-semibold">{tv?.score ?? '—'}</div>
            <div className="text-xs text-gray-500">Last: {tv?.last_utc ?? '—'}</div>
          </div>
          <div className="md:col-span-3">
            <div className="grid sm:grid-cols-3 gap-3">
              {(tv?.details ?? []).map((d,i)=>(
                <div key={i} className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">{d.label}</div>
                  <div className="text-sm font-mono">{String(d.value)}</div>
                </div>
              ))}
            </div>
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

      {apiDetail && (
        <details className="text-sm">
          <summary className="cursor-pointer">API Response Details</summary>
          <pre className="mt-2 p-3 rounded-lg bg-black text-white overflow-auto text-xs">{JSON.stringify(apiDetail, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
