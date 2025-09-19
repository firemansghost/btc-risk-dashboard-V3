'use client';

import { useEffect, useState } from 'react';
import RiskBandLegend from './RiskBandLegend';

export default function SimpleDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('SimpleDashboard: Loading data...');
        
        const response = await fetch('/data/latest.json', { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        console.log('SimpleDashboard: Response status:', response.status);
        
        if (response.ok) {
          const jsonData = await response.json();
          console.log('SimpleDashboard: Data loaded:', jsonData);
          setData(jsonData);
          setError(null);
        } else {
          setError(`Failed to load data: ${response.status}`);
        }
      } catch (err) {
        console.error('SimpleDashboard: Error loading data:', err);
        setError(`Error: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const toggleFactorExpansion = (key: string) => {
    setExpandedFactors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleDetailsExpansion = (key: string) => {
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button className="border-b-2 border-emerald-600 text-emerald-600 font-medium py-2 px-1 text-sm">
              Overview
            </button>
            <button className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium py-2 px-1 text-sm">
              Methodology
            </button>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GhostGauge — Bitcoin Risk Dashboard</h1>
              <div className="mt-1 text-lg text-gray-800">
                Bitcoin G-Score: <span className="font-semibold">{data?.composite_score ?? '—'}</span> — {data?.band?.label || '—'}
            </div>
              <p className="text-sm text-gray-600 mt-2">
                Daily 0–100 risk score for Bitcoin (GRS v3). As of {data?.as_of_utc ? new Date(data.as_of_utc).toISOString() : 'Unknown'} ·
                <a href="/methodology" className="ml-1 underline text-gray-700 hover:text-gray-900">Methodology</a>
                <span className="ml-3 text-gray-500">Data source:</span> <span className="ml-1 text-gray-700">ETL</span>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center text-sm text-gray-500">
                <span className="mr-1">No</span> alerts
              </div>
              <button className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                <span className="text-sm font-medium">Weights</span>
              </button>
              <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                Refresh Dashboard
              </button>
            </div>
          </div>
        </div>
        
        {/* Key Metrics Cards - 5 Box Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Composite Score Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">BTC G-Score</h3>
            <div className="text-4xl font-bold text-gray-900 mb-1">{data?.composite_score ?? '—'}</div>
            <div className="text-xs text-gray-600 mb-1">Band: {data?.band?.label || '—'}</div>
            <div className="text-xs text-gray-700 mb-2">{data?.band?.label || ''}</div>
            <div className="flex items-center gap-2 mb-3">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Tune weights</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] rounded bg-slate-100 text-slate-700 border border-slate-200">Cycle:</span>
              <span className="px-2 py-0.5 text-[11px] rounded bg-yellow-100 text-yellow-800 border border-yellow-200">Spike:</span>
            </div>
          </div>

          {/* Bitcoin Price Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bitcoin Price</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              ${data?.btc?.spot_usd ? data.btc.spot_usd.toLocaleString() : 'N/A'}
            </div>
            <div className="text-xs text-gray-600">
              as of {data?.btc?.as_of_utc ? new Date(data.btc.as_of_utc).toISOString().replace('T', ' ').replace('Z', 'Z') : 'Unknown'}
            </div>
          </div>

          {/* Bitcoin ⇄ Gold Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bitcoin⇄Gold</h3>
              <span className="text-[10px] rounded bg-yellow-100 text-yellow-800 px-2 py-0.5">fallback</span>
            </div>
            <div className="text-sm text-gray-700">
              <div className="flex items-baseline justify-between">
                <span>1 Bitcoin</span>
                <span className="text-2xl font-semibold text-gray-900">
                  {data?.cross?.btc_per_oz ? `${data.cross.btc_per_oz.toFixed(2)} oz` : '—'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span>1 oz</span>
                <span className="text-lg font-semibold text-gray-900">
                  {data?.cross?.oz_per_btc ? `${Number(data.cross.oz_per_btc).toFixed(6)} Bitcoin` : '—'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span>As of {data?.as_of_utc ? new Date(data.as_of_utc).toLocaleDateString() : '—'}</span>
              <a className="text-blue-600 hover:text-blue-700" href="#">View details</a>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">Source: Stooq • Using fallback source</div>
          </div>

          {/* Satoshis per Dollar Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Satoshis per Dollar</h3>
            <div className="text-sm text-gray-700">
              <div className="flex items-baseline justify-between">
                <span>1 USD =</span>
                <span className="text-2xl font-semibold text-gray-900">
                  {data?.btc?.spot_usd ? `${Math.round(100000000 / data.btc.spot_usd).toLocaleString()} sats` : '—'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span>1 sat =</span>
                <span className="text-lg font-semibold text-gray-900">
                  {data?.btc?.spot_usd ? `$${(data.btc.spot_usd / 100000000).toFixed(8)}` : '—'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span>As of {data?.btc?.as_of_utc ? new Date(data.btc.as_of_utc).toLocaleDateString() : '—'}</span>
              <a className="text-blue-600 hover:text-blue-700" href="#">View details</a>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">Source: BTC daily close (Coinbase)</div>
          </div>

          {/* Model Version Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Model Version</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {data?.model_version || 'N/A'}
            </div>
            <div className="text-xs text-gray-600">
              Five-pillar framework
            </div>
          </div>
        </div>

        {/* Risk Bands Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Risk Bands</h2>
            <div className="flex items-center space-x-4">
              <span className="text-xs text-gray-500">cfg e610de09434312d6</span>
              <a href="/methodology#bands" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Learn how bands work →
              </a>
            </div>
          </div>
          <RiskBandLegend score={data?.composite_score || 0} />
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Last Updated</h2>
          <p className="text-gray-600">
            {data?.as_of_utc ? new Date(data.as_of_utc).toLocaleString() + ' UTC' : 'N/A'}
          </p>
        </div>

        {data?.factors && data.factors.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Risk Factors</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.factors.map((factor: any, index: number) => (
                <div key={factor.key || index} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
                  {/* Header with pillar/weight info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{factor.label}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        factor.score !== null ? 
                          (factor.score >= 70 ? 'bg-red-100 text-red-800' :
                           factor.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                           factor.score >= 30 ? 'bg-emerald-100 text-emerald-800' :
                           'bg-blue-100 text-blue-800') : 
                          'bg-gray-100 text-gray-800'
                      }`}>
                        {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
                      </span>
                    </div>
                    
                    {/* Pillar and weight info */}
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium text-gray-700">
                        {factor.pillar ? factor.pillar.charAt(0).toUpperCase() + factor.pillar.slice(1) : 'Unknown'} / 
                        {factor.counts_toward ? factor.counts_toward.charAt(0).toUpperCase() + factor.counts_toward.slice(1) : 'Unknown'}
                      </span>
                      {factor.weight_pct && (
                        <span className="ml-2 text-gray-500">
                          (Weight {factor.weight_pct}%, Score {factor.score !== null ? factor.score.toFixed(0) : 'N/A'})
                        </span>
                      )}
                      {factor.counts_toward && factor.counts_toward !== factor.pillar && (
                        <span className="ml-2 text-xs text-blue-600">
                          (counts toward {factor.counts_toward})
                        </span>
                      )}
                    </div>
                    
                    {/* Status */}
                    <div className="text-sm text-gray-600">
                      Status: <span className={`font-medium ${
                        factor.status === 'fresh' ? 'text-green-600' : 
                        factor.status === 'stale' ? 'text-yellow-600' : 
                        factor.status === 'excluded' ? 'text-gray-600' : 
                        factor.status === 'coming soon' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {factor.status || 'Unknown'}
                      </span>
                      {factor.status === 'stale' && (
                        <span className="ml-2 text-xs text-yellow-600">(Data older than 48h)</span>
                      )}
                    </div>
                  </div>

                  {/* Sophisticated details display */}
                  {factor.details && factor.details.length > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="space-y-4">
                        {/* Primary metrics - show first 3-4 key metrics prominently */}
                        <div className="grid grid-cols-1 gap-3">
                          {factor.details.slice(0, 4).map((detail: any, detailIndex: number) => (
                            <div key={detailIndex} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                              <span className="text-sm font-medium text-gray-700">{detail.label}</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {typeof detail.value === 'number' ? detail.value.toFixed(2) : detail.value}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Additional details - collapsible */}
                        {factor.details.length > 4 && (
                          <div>
                            {!expandedDetails.has(factor.key) && (
                              <button
                                onClick={() => toggleDetailsExpansion(factor.key)}
                                className="w-full text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 px-3 border border-emerald-200 rounded-md hover:bg-emerald-50 transition-colors"
                              >
                                +{factor.details.length - 4} more details
                              </button>
                            )}
                            
                            {expandedDetails.has(factor.key) && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Additional Details</div>
                                {factor.details.slice(4).map((detail: any, detailIndex: number) => (
                                  <div key={detailIndex + 4} className="flex justify-between items-center py-1 px-2 text-sm">
                                    <span className="text-gray-600">{detail.label}</span>
                                    <span className="text-gray-800 font-medium">
                                      {typeof detail.value === 'number' ? detail.value.toFixed(2) : detail.value}
                                    </span>
                                  </div>
                                ))}
                                <button
                                  onClick={() => toggleDetailsExpansion(factor.key)}
                                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 mt-2"
                                >
                                  Show less
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Status and metadata */}
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Last updated: {factor.last_utc ? new Date(factor.last_utc).toLocaleString() : 'Unknown'}</span>
                            {factor.reason && factor.reason !== 'success' && (
                              <span className="text-orange-600 italic">{factor.reason}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(!factor.details || factor.details.length === 0) && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="text-sm text-gray-500">No additional details available.</div>
                    </div>
                  )}

                  {/* Sophisticated footer */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium border-b border-blue-200 hover:border-blue-300 transition-colors">
                          What's this?
                        </button>
                        {factor.details && factor.details.some((d: any) => d.tooltip) && (
                          <button className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                            View tooltips
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {factor.weight}% weight
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Refresh Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}