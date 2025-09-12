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
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0', color: '#111827' }}>Bitcoin Risk Dashboard</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>
            Updated <span style={{ fontFamily: 'monospace' }}>{latest?.as_of_utc ?? '—'}</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            style={{ fontSize: '14px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            onClick={() => window.open('/api/data/latest?ts=' + Date.now(), '_blank', 'noopener,noreferrer')}
          >
            View Raw
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              backgroundColor: loading ? '#9ca3af' : '#059669', 
              color: 'white', 
              border: 'none', 
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh Dashboard'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ 
          borderRadius: '12px', 
          border: '1px solid #e5e7eb', 
          backgroundColor: 'white', 
          padding: '16px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Composite Score</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>{latest?.composite_score ?? '—'}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Band: {latest?.band?.label ?? '—'}</div>
          {latest?.band?.recommendation && <div style={{ fontSize: '12px', color: '#4b5563' }}>{latest.band.recommendation}</div>}
          {typeof latest?.btc?.spot_usd === 'number' && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              BTC: {fmtUsd0(latest.btc.spot_usd)}
            </div>
          )}
        </div>

        <div style={{ 
          borderRadius: '12px', 
          border: '1px solid #e5e7eb', 
          backgroundColor: 'white', 
          padding: '16px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          gridColumn: 'span 2'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Health</div>
          <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e5e7eb', overflow: 'hidden', marginBottom: '8px' }}>
            {!!latest && <div style={{ height: '100%', backgroundColor: '#10b981', width: '100%' }} />}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Price candles: Coinbase Exchange. More factors coming next.
          </div>
        </div>
      </div>

      {/* Factor Cards */}
      {factors.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {factors.map(factor => (
            <div key={factor.key} style={{ 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white', 
              padding: '16px', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontWeight: '500', color: '#111827' }}>{factor.label}</div>
                <div style={{ 
                  fontSize: '12px', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  backgroundColor: factor.status === 'fresh' ? '#dcfce7' : factor.status === 'stale' ? '#fef3c7' : '#f3f4f6',
                  color: factor.status === 'fresh' ? '#166534' : factor.status === 'stale' ? '#92400e' : '#6b7280'
                }}>
                  {factor.weight_pct}%
                </div>
              </div>
              
              {factor.score !== null ? (
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                  {factor.score}
                </div>
              ) : (
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                  {factor.reason || 'No data available'}
                </div>
              )}
              
              {factor.details && factor.details.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {factor.details.slice(0, 3).map((detail, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '12px', 
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      <span>{detail.label}:</span>
                      <span style={{ fontWeight: '500' }}>{detail.value}</span>
                    </div>
                  ))}
                  {factor.details.length > 3 && (
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                      +{factor.details.length - 3} more...
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                {factor.source}
              </div>
            </div>
          ))}
        </div>
      )}

      {placeholders.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {placeholders.map(p => (
            <div key={p.key} style={{ 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white', 
              padding: '16px', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
            }}>
              <div style={{ fontWeight: '500', color: '#111827', marginBottom: '4px' }}>{p.label}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Coming soon — safely excluded.</div>
            </div>
          ))}
        </div>
      ) : null}

      <HistoryChart />

      {error && (
        <div style={{ 
          color: '#dc2626', 
          fontSize: '14px', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '12px',
          marginBottom: '24px'
        }}>
          Error: {error}
        </div>
      )}

      {apiDetail && (
        <details style={{ fontSize: '14px' }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', marginBottom: '8px' }}>API Response Details</summary>
          <pre style={{ 
            marginTop: '8px', 
            padding: '12px', 
            borderRadius: '8px', 
            backgroundColor: '#1f2937', 
            color: 'white', 
            overflow: 'auto', 
            fontSize: '12px' 
          }}>
{JSON.stringify(apiDetail, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}