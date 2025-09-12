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
  const [activeTab, setActiveTab] = useState<'overview' | 'data-sources'>('overview');

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

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeTab === 'overview' ? '#059669' : '#6b7280',
            borderBottom: activeTab === 'overview' ? '2px solid #059669' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'overview' ? '600' : '400',
            transition: 'all 0.2s ease'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('data-sources')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeTab === 'data-sources' ? '#059669' : '#6b7280',
            borderBottom: activeTab === 'data-sources' ? '2px solid #059669' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'data-sources' ? '600' : '400',
            transition: 'all 0.2s ease'
          }}
        >
          Data Sources
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
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
        </>
      )}

      {activeTab === 'data-sources' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {factors.map(factor => {
            // Get detailed description for each factor
            const getFactorDescription = (key: string) => {
              switch (key) {
                case 'trend_valuation':
                  return {
                    title: 'Trend & Valuation Analysis',
                    description: 'Combines multiple technical indicators to assess Bitcoin\'s price momentum and valuation relative to historical norms.',
                    components: [
                      '**BMSB (Buy My Shitcoin Band)**: Price position relative to 200-day Simple Moving Average (SMA)',
                      '**Mayer Multiple**: Current price divided by 200-day SMA (classic valuation metric)',
                      '**Long-term MA Ratio**: Price relative to 300-730 day SMA (depending on data availability)',
                      '**RSI(14)**: 14-day Relative Strength Index with 3-year percentile ranking'
                    ],
                    methodology: 'Weighted blend: BMSB (40%) + Mayer Multiple (40%) + RSI (20%). Higher percentiles indicate higher risk. Uses logistic function to normalize scores 0-100.'
                  };
                case 'net_liquidity':
                  return {
                    title: 'Federal Reserve Net Liquidity',
                    description: 'Measures the Federal Reserve\'s net liquidity injection into the financial system, which historically correlates with risk asset performance.',
                    components: [
                      '**WALCL**: Federal Reserve Total Assets (weekly)',
                      '**RRPONTSYD**: Reverse Repo Operations (weekly)',
                      '**WTREGEN**: Treasury General Account (weekly)',
                      '**Net Liquidity**: WALCL - RRPONTSYD - WTREGEN'
                    ],
                    methodology: 'Higher net liquidity typically supports risk assets. Score based on 3-year percentile ranking of weekly net liquidity values.'
                  };
                case 'stablecoins':
                  return {
                    title: 'Stablecoin Supply Dynamics',
                    description: 'Tracks the growth and composition of major stablecoin supplies, indicating market demand for crypto exposure and liquidity.',
                    components: [
                      '**USDT Supply**: Tether total supply derived from market cap ÷ price',
                      '**USDC Supply**: USD Coin total supply derived from market cap ÷ price',
                      '**Total Supply Growth**: 30-day change in combined USDT + USDC supply',
                      '**USDT Dominance**: USDT share of total stablecoin supply'
                    ],
                    methodology: 'Higher supply growth indicates increased demand for crypto exposure. Score based on 30-day supply change percentile ranking.'
                  };
                case 'term_leverage':
                  return {
                    title: 'Derivatives Market Leverage',
                    description: 'Monitors perpetual swap funding rates to gauge market leverage and sentiment in the derivatives market.',
                    components: [
                      '**BitMEX XBTUSD Funding**: 8-hour perpetual swap funding rates',
                      '**7-day Average**: Rolling 7-day average funding rate',
                      '**30-day Average**: Rolling 30-day average funding rate',
                      '**Momentum**: Difference between 7-day and 30-day averages'
                    ],
                    methodology: 'Lower funding rates indicate less leverage/speculation. Combines magnitude (absolute 7-day rate) and momentum (7d-30d change) with equal weighting.'
                  };
                case 'onchain':
                  return {
                    title: 'On-chain Network Activity',
                    description: 'Measures Bitcoin network usage through transaction fees and mempool activity, indicating network demand and congestion.',
                    components: [
                      '**Transaction Fees**: Daily USD-denominated transaction fees (7-day average)',
                      '**Mempool Size**: Bitcoin mempool size in MB (7-day average)',
                      '**Fee Fallback**: If USD fees unavailable, uses BTC fees × current spot price',
                      '**Network Congestion**: Higher fees and mempool size indicate increased demand'
                    ],
                    methodology: 'Higher network activity suggests increased usage but also potential congestion. Score based on percentile ranking of 7-day averages, inverted (higher activity = lower risk score).'
                  };
                case 'etf_flows':
                  return {
                    title: 'US Bitcoin ETF Flows',
                    description: 'Tracks daily net flows into US Bitcoin spot ETFs, indicating institutional and retail demand for Bitcoin exposure.',
                    components: [
                      '**Net Daily Flows**: Sum of all US Bitcoin ETF daily flows',
                      '**21-day Rolling Sum**: 21-day cumulative net flows for momentum',
                      '**Data Sources**: Farside Investors, with fallback to multiple parsing strategies',
                      '**Flow Types**: Includes all major US Bitcoin ETFs (GBTC, IBIT, FBTC, etc.)'
                    ],
                    methodology: 'Higher net inflows indicate increased demand. Score based on 21-day rolling sum percentile ranking. Uses multiple parsing strategies for robust data collection.'
                  };
                default:
                  return {
                    title: factor.label,
                    description: 'Factor description not available.',
                    components: [],
                    methodology: 'Methodology not specified.'
                  };
              }
            };

            const desc = getFactorDescription(factor.key);

            return (
              <div key={factor.key} style={{ 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb', 
                backgroundColor: 'white', 
                padding: '20px', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0' }}>{desc.title}</h3>
                  <div style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px', 
                    borderRadius: '16px', 
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    {factor.weight_pct}% weight
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', marginBottom: '16px' }}>
                  {desc.description}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>Key Components:</h4>
                  <ul style={{ margin: '0', paddingLeft: '16px', fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    {desc.components.map((component, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        <span dangerouslySetInnerHTML={{ __html: component.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>Scoring Methodology:</h4>
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    {desc.methodology}
                  </div>
                </div>
                
                <div style={{ fontSize: '12px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Data Source:</strong> {factor.source || 'Source information will appear once this factor is active.'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Status: <span style={{ color: factor.status === 'fresh' ? '#059669' : factor.status === 'stale' ? '#d97706' : '#6b7280' }}>{factor.status}</span></div>
                    <div>Updated: {factor.last_utc ? new Date(factor.last_utc).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}