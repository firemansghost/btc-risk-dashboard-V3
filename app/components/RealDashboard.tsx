'use client';

import { useCallback, useEffect, useState } from 'react';
import HistoryChart from './HistoryChart';
import PillarBadge from './PillarBadge';
import InfoTooltip from './InfoTooltip';
import WeightsLauncher from './WeightsLauncher';
import RiskBandLegend from './RiskBandLegend';
import WhatIfWeightsModal from './WhatIfWeightsModal';
import ProvenanceModal from './ProvenanceModal';
import SystemStatusCard from './SystemStatusCard';
import MacroCard from './MacroCard';
import EtfTable from './EtfTable';
import BtcGoldCard from './BtcGoldCard';
import SatoshisPerDollarCard from './SatoshisPerDollarCard';
import FactorHistoryModal from './FactorHistoryModal';
import AlertBell from './AlertBell';
import type { LatestSnapshot } from '@/lib/types';

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function RealDashboard() {
  const [latest, setLatest] = useState<LatestSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDetail, setApiDetail] = useState<any>(null);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<{key: string, label: string} | null>(null);

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
      // Use the real-time data directly instead of reloading static data
      setLatest(json.latest);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFactorExpansion = useCallback((factorKey: string) => {
    setExpandedFactors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(factorKey)) {
        newSet.delete(factorKey);
      } else {
        newSet.add(factorKey);
      }
      return newSet;
    });
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const factors = latest?.factors ?? [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2" aria-label={`Bitcoin G-Score current value ${latest?.composite_score ?? '—'}, band ${latest?.band?.label ?? '—'}`}>
            Bitcoin G-Score: {latest?.composite_score ?? '—'} — {latest?.band?.label ?? '—'}
          </h1>
          <p className="text-sm text-gray-500">
            As of <span className="font-mono">{latest?.as_of_utc ?? '—'}</span> UTC · 
            <a href="/methodology" className="text-blue-600 hover:text-blue-800 underline ml-1">Methodology</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AlertBell />
          <WeightsLauncher onOpen={() => setWhatIfModalOpen(true)} />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {loading ? 'Refreshing…' : 'Refresh Dashboard'}
          </button>
        </div>
      </div>

      {/* Top Row: Composite Score + BTC Price + BTC⇄Gold + Satoshis per Dollar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-2">BTC G-Score</div>
          <div className="text-4xl font-bold text-gray-900 mb-2">{latest?.composite_score ?? '—'}</div>
          <div className="text-xs text-gray-500 mb-1">Band: {latest?.band?.label ?? '—'}</div>
          {latest?.band?.recommendation && (
            <div className="text-xs text-gray-600 mb-2">{latest.band.recommendation}</div>
          )}
          {/* Tune weights link */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setWhatIfModalOpen(true)}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              title="Press W to open weights"
            >
              Tune weights
            </button>
          </div>
          {/* Adjustment indicators */}
          <div className="mt-2 flex gap-2">
            {latest?.cycle_adjustment?.adj_pts !== 0 && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                Cycle: {latest?.cycle_adjustment?.adj_pts && latest.cycle_adjustment.adj_pts > 0 ? '+' : ''}{latest?.cycle_adjustment?.adj_pts}
              </span>
            )}
            {latest?.spike_adjustment?.adj_pts !== 0 && (
              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                Spike: {latest?.spike_adjustment?.adj_pts && latest.spike_adjustment.adj_pts > 0 ? '+' : ''}{latest?.spike_adjustment?.adj_pts}
              </span>
            )}
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-2">Bitcoin Price</div>
          <div className="text-2xl font-bold text-gray-900">
            {typeof latest?.btc?.spot_usd === 'number' ? fmtUsd0(latest.btc.spot_usd) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {latest?.btc?.as_of_utc ? `as of ${new Date(latest.btc.as_of_utc).toISOString().slice(0,16).replace('T',' ')}Z` : ''}
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-2">Model Version</div>
          <div className="text-lg font-semibold text-gray-900">{latest?.model_version ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Five-pillar risk framework</div>
        </div>
        
        <BtcGoldCard />
        <SatoshisPerDollarCard />
      </div>

      {/* Risk Band Legend */}
      {latest?.composite_score !== undefined && (
        <div className="mb-6">
          <RiskBandLegend score={latest.composite_score} />
        </div>
      )}

      {/* System Status */}
      <div className="mb-6">
        <SystemStatusCard 
          factors={factors} 
          provenance={latest?.provenance ?? []} 
          onOpenWeights={() => setWhatIfModalOpen(true)}
          onOpenProvenance={() => setProvenanceModalOpen(true)}
        />
      </div>


      {/* Five-Pillar Factor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {factors.map(factor => {
          const isExpanded = expandedFactors.has(factor.key);
          const hasMoreDetails = factor.details && factor.details.length > 3;
          
          return (
            <div key={factor.key} className="rounded-xl border p-4 bg-white shadow-sm">
            {/* Header with Pillar Badge and Weight */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PillarBadge pillar={factor.pillar} />
                {factor.counts_toward ? (
                  <span className="text-xs text-gray-500">counts toward {factor.counts_toward}</span>
                ) : (
                  <span className="text-xs text-gray-500">Weight {factor.weight_pct}%</span>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">
                  {factor.score !== null ? factor.score : '—'}
                </span>
              </div>
            </div>
            
            {/* Factor Title */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">{factor.label}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedFactor({ key: factor.key, label: factor.label });
                    setHistoryModalOpen(true);
                  }}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                  title="View factor history"
                >
                  History
                </button>
                <a
                  href={`/methodology#${factor.key}`}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Learn more about this factor"
                >
                  What's this?
                </a>
              </div>
            </div>
            
            {/* Status */}
            <div className="mb-3">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                factor.status === 'fresh' ? 'bg-green-100 text-green-800' :
                factor.status === 'stale' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {factor.status}
              </span>
            </div>
            
            {/* Details */}
            {factor.details && factor.details.length > 0 && (
              <div className="space-y-2">
                {factor.details.slice(0, 3).map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      {detail.label}
                      <InfoTooltip formula={detail.formula} window={detail.window} />
                    </span>
                    <span className="font-medium text-gray-900">{detail.value}</span>
                  </div>
                ))}
                {hasMoreDetails && (
                  <div>
                    {/* Expandable details */}
                    {isExpanded && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-gray-100">
                        {factor.details.slice(3).map((detail, idx) => (
                          <div key={idx + 3} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                              {detail.label}
                              <InfoTooltip formula={detail.formula} window={detail.window} />
                            </span>
                            <span className="font-medium text-gray-900">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Toggle button */}
                    <button
                      onClick={() => toggleFactorExpansion(factor.key)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2 flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show less
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          +{factor.details.length - 3} more...
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Source */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 truncate">{factor.source}</div>
              {factor.reason && (
                <div className="text-xs text-gray-400 mt-1">{factor.reason}</div>
              )}
            </div>
          </div>
          );
        })}
        
        {/* Macro Overlay Card */}
        <MacroCard />
      </div>

      {/* ETF Flows Table */}
      {factors.find(f => f.key === 'etf_flows')?.individualEtfFlows && (
        <div className="mb-6">
          <EtfTable 
            individualEtfFlows={factors.find(f => f.key === 'etf_flows')?.individualEtfFlows}
          />
        </div>
      )}

      <HistoryChart />

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          Error: {error}
        </div>
      )}

      {apiDetail && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600 mb-2">API Response Details</summary>
          <pre className="mt-2 p-3 rounded-lg bg-gray-900 text-white overflow-auto text-xs">
            {JSON.stringify(apiDetail, null, 2)}
          </pre>
        </details>
      )}

      {/* What-If Weights Modal */}
      <WhatIfWeightsModal
        isOpen={whatIfModalOpen}
        onClose={() => setWhatIfModalOpen(false)}
      />

      {/* Provenance Modal */}
      <ProvenanceModal
        open={provenanceModalOpen}
        onClose={() => setProvenanceModalOpen(false)}
        items={latest?.provenance ?? []}
      />

      {/* Factor History Modal */}
      {selectedFactor && (
        <FactorHistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedFactor(null);
          }}
          factorKey={selectedFactor.key}
          factorLabel={selectedFactor.label}
        />
      )}
    </div>
  );
}