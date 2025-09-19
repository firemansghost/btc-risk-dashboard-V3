'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtUsd0 } from '@/lib/format';
import { getBandTextColor } from '@/lib/band-colors';
import SystemStatusCard from './SystemStatusCard';
import RiskBandLegend from './RiskBandLegend';
import WhatIfWeightsModal from './WhatIfWeightsModal';
import ProvenanceModal from './ProvenanceModal';
import FactorHistoryModal from './FactorHistoryModal';
import EtfBreakdownModal from './EtfBreakdownModal';
import WeightsLauncher from './WeightsLauncher';
import HistoryChart from './HistoryChart';
import BtcGoldCard from './BtcGoldCard';
import SatoshisPerDollarCard from './SatoshisPerDollarCard';

function ErrorView({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return <div style={{ padding: 16 }}><p>{msg}</p><button onClick={onRetry} style={{ marginTop: 8 }}>Retry</button></div>;
}

export default function RealDashboard() {
  console.log('RealDashboard: component mounting');
  
  const [latest, setLatest] = useState<any|null>(null);
  const [status, setStatus] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const startedAt = useRef(0);

  // Modals
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [etfBreakdownOpen, setEtfBreakdownOpen] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<{key: string, label: string} | null>(null);

  // Factor expansion state
  const [expandedFactors, setExpandedFactors] = useState(new Set<string>());

  const load = useCallback(async () => {
    setError(null); setLoading(true); startedAt.current = Date.now();
    try {
      const [r1, r2] = await Promise.race([
        Promise.all([
          fetch('/data/latest.json', { cache:'no-store' }),
          fetch('/data/status.json', { cache:'no-store' }),
        ]),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout 12s: fetch artifacts')), 12000)),
      ]);
      if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status}/${r2.status}`);
      const [j1, j2] = await Promise.race([
        Promise.all([r1.json(), r2.json()]),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout 8s: parse artifacts')), 8000)),
      ]);
      setLatest(j1); setStatus(j2);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const openHistoryModal = (factor: {key: string, label: string}) => {
    setSelectedFactor(factor);
    setHistoryModalOpen(true);
  };

  const openEtfBreakdown = () => {
    setEtfBreakdownOpen(true);
  };

  // Loading/error states with robust timeouts
  const elapsed = Math.max(0, Date.now() - (startedAt.current || Date.now()));
  if (loading && elapsed < 12000) return <p>Loading dashboard… {Math.floor(elapsed/1000)}s</p>;
  if (loading && elapsed >= 12000) return <ErrorView msg="Timed out waiting for dashboard data." onRetry={load} />;
  if (error) return <ErrorView msg={`Failed to load: ${error}`} onRetry={load} />;
  if (!latest || !status) return <ErrorView msg="Missing data artifacts." onRetry={load} />;

  // Main dashboard render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-1">
              <div className="font-bold tracking-tight text-2xl md:text-3xl text-gray-900">
                <a href="/" className="hover:text-emerald-600 transition-colors">GhostGauge</a>
              </div>
              <h1 className="text-xl md:text-2xl font-medium text-gray-900 mt-1" aria-label={`Bitcoin G-Score ${latest?.composite_score ?? '—'}, band ${latest?.band?.label ?? '—'}`}>
                Bitcoin G-Score: <span className={getBandTextColor(latest?.band?.label ?? '—')}>{latest?.composite_score ?? '—'} — {latest?.band?.label ?? '—'}</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Daily 0–100 risk score for Bitcoin (GRS v3). As of {latest?.as_of_utc ? new Date(latest.as_of_utc).toLocaleString() + ' UTC' : '—'} · <a href="/methodology" className="text-emerald-600 hover:text-emerald-700">Methodology</a>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // Try to refresh via API first, fallback to data reload
                  fetch('/api/refresh', { method: 'POST' })
                    .then(res => res.ok ? res.json() : Promise.reject())
                    .then(() => {
                      // Wait a moment then reload data
                      setTimeout(() => load(), 1000);
                    })
                    .catch(() => {
                      // Fallback to just reloading data
                      load();
                    });
                }}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <span>Refresh Dashboard</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards - 5 Box Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Composite Score */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">BTC G-Score</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{latest?.composite_score ?? '—'}</div>
            <div className="text-xs text-gray-600">Band: {latest?.band?.label || '—'}</div>
          </div>

          {/* Bitcoin Price */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bitcoin Price</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{latest?.btc?.spot_usd ? fmtUsd0(latest.btc.spot_usd) : 'N/A'}</div>
            <div className="text-xs text-gray-600">as of {latest?.btc?.as_of_utc ? new Date(latest.btc.as_of_utc).toISOString().replace('T', ' ').replace('Z', 'Z') : '—'}</div>
          </div>

          {/* Model Version */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Model Version</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{latest?.model_version ?? 'v3'}</div>
            <div className="text-xs text-gray-600">Five-pillar framework</div>
          </div>

          {/* Bitcoin ⇄ Gold */}
          <BtcGoldCard className="h-full" />

          {/* Satoshis per Dollar */}
          <SatoshisPerDollarCard className="h-full" />
        </div>

        {/* Risk Band Legend */}
        <div className="mb-8">
          <RiskBandLegend score={latest?.composite_score || 0} />
        </div>

        {/* System Status */}
        <div className="mb-8">
          <SystemStatusCard
            factors={latest?.factors || []}
            provenance={latest?.provenance || []}
            onOpenProvenance={() => setProvenanceModalOpen(true)}
            onOpenWeights={() => setWhatIfModalOpen(true)}
          />
        </div>

        {/* Factor Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {latest?.factors?.map((factor: any) => (
            <div key={factor.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{factor.label}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-gray-700">
                      {factor.pillar ? factor.pillar.charAt(0).toUpperCase() + factor.pillar.slice(1) : 'Unknown'} Pillar
                    </span>
                    {factor.weight_pct && (
                      <span className="ml-2 text-gray-500">
                        (Weight: {factor.weight_pct}%)
                      </span>
                    )}
                    {factor.counts_toward && factor.counts_toward !== factor.pillar && (
                      <span className="ml-2 text-xs text-blue-600">
                        (counts toward {factor.counts_toward})
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Status: <span className={`font-medium ${
                      factor.status === 'fresh' ? 'text-green-600' : 
                      factor.status === 'stale' ? 'text-yellow-600' : 
                      factor.status === 'excluded' ? 'text-gray-600' : 
                      'text-red-600'
                    }`}>
                      {factor.status || 'Unknown'}
                    </span>
                    {factor.status === 'excluded' && factor.reason && (
                      <span className="ml-2 text-xs text-gray-500">({factor.reason})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    factor.score !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
                  </span>
                  <button
                    onClick={() => toggleFactorExpansion(factor.key)}
                    className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                  >
                    {expandedFactors.has(factor.key) ? '−' : '+'}
                  </button>
                </div>
              </div>

              {expandedFactors.has(factor.key) && (
                <div className="border-t border-gray-200 pt-4">
                  {/* Factor Details */}
                  {factor.details && factor.details.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Details:</h4>
                      <div className="space-y-1">
                        {factor.details.slice(0, 3).map((detail: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600">
                            <span className="font-medium">{detail.label}:</span> {detail.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openHistoryModal({key: factor.key, label: factor.label})}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      History
                    </button>
                    {factor.key === 'etf_flows' && (
                      <button
                        onClick={openEtfBreakdown}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        By ETF
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* History Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical G-Score</h3>
          <HistoryChart />
        </div>

        {/* Weights and Provenance */}
        <div className="flex justify-center space-x-4">
          <WeightsLauncher onOpen={() => setWhatIfModalOpen(true)} />
          <button
            onClick={() => setProvenanceModalOpen(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Data Sources
          </button>
        </div>

        {/* Dashboard Type Badge */}
        <div className="flex justify-center mt-8 pb-4">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
            🚀 RealDashboard
          </span>
        </div>
      </div>

      {/* Modals */}
      {whatIfModalOpen && (
        <WhatIfWeightsModal
          isOpen={whatIfModalOpen}
          onClose={() => setWhatIfModalOpen(false)}
        />
      )}

      {provenanceModalOpen && (
        <ProvenanceModal
          open={provenanceModalOpen}
          onClose={() => setProvenanceModalOpen(false)}
          items={latest?.provenance || []}
        />
      )}

      {historyModalOpen && selectedFactor && (
        <FactorHistoryModal
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          factorKey={selectedFactor?.key || ''}
          factorLabel={selectedFactor?.label || ''}
        />
      )}

      {etfBreakdownOpen && (
        <EtfBreakdownModal
          isOpen={etfBreakdownOpen}
          onClose={() => setEtfBreakdownOpen(false)}
        />
      )}
    </div>
  );
}