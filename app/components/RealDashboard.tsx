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
import EtfBreakdownModal from './EtfBreakdownModal';
import AlertBell from './AlertBell';
import { getBandTextColor } from '@/lib/band-colors';
import { fetchArtifact } from '@/lib/artifactFetch';
import type { LatestSnapshot, FactorSummary } from '@/lib/types';

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);


type Status = {
  updated_at: string;
  sources?: Array<{ name: string; ok: boolean; url?: string; ms?: number }>;
};

export default function RealDashboard() {
  const [latest, setLatest] = useState<LatestSnapshot | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<{key: string, label: string} | null>(null);
  const [etfBreakdownOpen, setEtfBreakdownOpen] = useState(false);
  const [hasByFund, setHasByFund] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  
  // Safe derived values
  const gScore = latest?.composite_score ?? null;
  const bandText = latest?.band?.label ?? '—';
  const price = latest?.btc?.spot_usd ?? null;
  const version = latest?.model_version ?? 'v3';
  
  // Simple derived flags
  const hasLatest = !!latest && latest.ok !== false;
  const hasStatus = !!status;
  
  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
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

  // Show fallback state when latest is null (artifacts missing)
  if (!latest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-yellow-600 text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Data Not Available</h2>
          <p className="text-gray-600 mb-4">
            The ETL artifacts are not yet available. This usually means the daily ETL process hasn't run yet.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 mr-2"
            >
              Check Again
            </button>
            <a
              href="https://github.com/firemansghost/btc-risk-dashboard-V3/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 inline-block"
            >
              Check ETL Status
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Load data function
  const loadData = useCallback(async () => {
    try {
      const [latestRes, statusRes] = await Promise.all([
        fetchArtifact('/data/latest.json'),
        fetchArtifact('/data/status.json')
      ]);

      if (latestRes.ok && statusRes.ok) {
        const [latestData, statusData] = await Promise.all([
          latestRes.json(),
          statusRes.json()
        ]);
        setLatest(latestData);
        setStatus(statusData);
        setError(null);
      } else {
        setError(`Failed to load data: latest=${latestRes.status}, status=${statusRes.status}`);
      }
    } catch (err) {
      setError(`Failed to load data: ${err}`);
    }
  }, []);

  // Check if ETF by fund data is available
  const checkByFundAvailability = useCallback(async () => {
    try {
      const response = await fetch('/signals/etf_by_fund.csv', { cache: 'no-store' });
      setHasByFund(response.ok);
    } catch (error) {
      setHasByFund(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshError(null);
    setIsRefreshing(true);
    
    try {
      await loadData();
      await checkByFundAvailability();
    } catch (err) {
      setRefreshError('Refresh failed. Using previous snapshot.');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, checkByFundAvailability]);

  // Load data on mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await loadData();
      await checkByFundAvailability();
      setIsLoading(false);
    };
    
    initializeData();
  }, [loadData, checkByFundAvailability]);

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

  useEffect(() => {
    // Check ETF by fund availability when data loads
    if (latest) {
      checkByFundAvailability();
    }
  }, [latest, checkByFundAvailability]);

  const factors = latest?.factors ?? [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="space-y-1">
            <div className="font-bold tracking-tight text-2xl md:text-3xl text-gray-900">
              <a href="/" className="no-underline hover:underline">GhostGauge</a> — Bitcoin Risk Dashboard
            </div>
            <h1 className="text-xl md:text-2xl font-medium text-gray-900" aria-label={`Bitcoin G-Score ${gScore ?? '—'}, band ${bandText}`}>
              Bitcoin G-Score: <span className={`whitespace-nowrap ${getBandTextColor(bandText)}`}>
                {gScore ?? '—'} — {bandText}
              </span>
            </h1>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Daily 0–100 risk score for Bitcoin (GRS v3). As of {latest?.as_of_utc ? new Date(latest.as_of_utc).toUTCString() : '—'} · <a href="/methodology" className="underline">Methodology</a>
          </div>
          <div className="mt-2 flex gap-3 text-sm">
            <span>Price: {price != null ? `$${Intl.NumberFormat('en-US').format(price)}` : '—'}</span>
            <span>Model: {version}</span>
            <span 
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded cursor-pointer hover:bg-gray-200"
              onClick={() => setProvenanceModalOpen(true)}
              title="Click to view data sources and status"
            >
              Data source: ETL
            </span>
            {data?.fetchedAt && (
              <span className="text-gray-500">
                Last fetched: {new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AlertBell />
          <WeightsLauncher onOpen={() => setWhatIfModalOpen(true)} />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh Dashboard'}
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
          provenance={status?.sources ?? []} 
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
                {factor.key === 'etf_flows' && hasByFund && (
                  <button
                    onClick={() => setEtfBreakdownOpen(true)}
                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                    title="View per-ETF breakdown"
                  >
                    By ETF
                  </button>
                )}
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

      {(error || refreshError) && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          Error: {error?.message || refreshError}
        </div>
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

      {/* ETF Breakdown Modal */}
      <EtfBreakdownModal 
        isOpen={etfBreakdownOpen} 
        onClose={() => setEtfBreakdownOpen(false)} 
      />
      
      {/* Debug overlay for dev mode */}
      {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG === '1' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white text-xs p-3 rounded max-w-sm">
          <div className="font-bold mb-2">Debug Info</div>
          <div className="mb-1">
            <strong>Data Version:</strong> {data?.version || 'N/A'}
          </div>
          <div className="mb-1">
            <strong>Fetched At:</strong> {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : 'N/A'}
          </div>
          <div className="mb-1">
            <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
          </div>
          <div className="mb-1">
            <strong>Refreshing:</strong> {isRefreshing ? 'Yes' : 'No'}
          </div>
          <div className="mb-1">
            <strong>Has Data:</strong> {data ? 'Yes' : 'No'}
          </div>
          <div className="mb-1">
            <strong>Has Latest:</strong> {latest ? 'Yes' : 'No'}
          </div>
          <div className="mb-1">
            <strong>Has Status:</strong> {status ? 'Yes' : 'No'}
          </div>
          <div className="mb-1">
            <strong>Error:</strong> {error ? error.message : 'None'}
          </div>
          {latest && (
            <div className="mb-1">
              <strong>Latest OK:</strong> {latest.ok ? 'Yes' : 'No'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}