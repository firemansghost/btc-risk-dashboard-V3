'use client';

import { useCallback, useEffect, useState } from 'react';
import { withTimeout } from '@/lib/withTimeout';
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
  const [startedAt, setStartedAt] = useState<number | null>(null);
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
          {startedAt && (
            <p className="text-xs text-gray-500 mt-2">{Math.round((Date.now() - startedAt)/1000)}s elapsed</p>
          )}
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

  // Simple data loading function
  const loadData = useCallback(async () => {
    try {
      console.log('RealDashboard: Loading data...');
      setStartedAt(Date.now());
      const [latestRes, statusRes] = await withTimeout(Promise.all([
        fetch('/data/latest.json', { cache: 'no-store' }),
        fetch('/data/status.json', { cache: 'no-store' })
      ]), 12000, 'loadData fetch artifacts');

      console.log('RealDashboard: Fetch responses:', {
        latest: { ok: latestRes.ok, status: latestRes.status },
        status: { ok: statusRes.ok, status: statusRes.status }
      });

      if (latestRes.ok && statusRes.ok) {
        const [latestData, statusData] = await withTimeout(Promise.all([
          latestRes.json(),
          statusRes.json()
        ]), 8000, 'parse artifacts json');
        console.log('RealDashboard: Data loaded successfully:', { latest: !!latestData, status: !!statusData });
        setLatest(latestData);
        setStatus(statusData);
        setError(null);
      } else {
        const errorMsg = `Failed to load data: latest=${latestRes.status}, status=${statusRes.status}`;
        console.error(errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = `Failed to load data: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
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

  // Watchdog to prevent endless spinner
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      if (isLoading) {
        setError('Timed out waiting for dashboard data.');
        setIsLoading(false);
      }
    }, 13000);
    return () => clearTimeout(timer);
  }, [isLoading]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-1">
              {process.env.NEXT_PUBLIC_SHOW_VIEW_BADGE !== 'false' && (
                <div className="text-xs text-gray-500 mb-1">View: RealDashboard</div>
              )}
              <div className="font-bold tracking-tight text-2xl md:text-3xl text-gray-900">
                <a href="/" className="hover:text-emerald-600 transition-colors">GhostGauge</a>
              </div>
              <h1 className="text-xl md:text-2xl font-medium text-gray-900 mt-1" aria-label={`Bitcoin G-Score ${gScore}, band ${bandText}`}>
                Bitcoin G-Score: <span className={getBandTextColor(bandText)}>{gScore} — {bandText}</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Daily 0–100 risk score for Bitcoin (GRS v3). As of {latest?.as_of_utc ? new Date(latest.as_of_utc).toLocaleString() + ' UTC' : '—'} · <a href="/methodology" className="text-emerald-600 hover:text-emerald-700">Methodology</a>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <AlertBell />
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isRefreshing ? (
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
            <div className="text-3xl font-bold text-gray-900 mb-1">{gScore ?? '—'}</div>
            <div className="text-xs text-gray-600">Band: {bandText}</div>
          </div>

          {/* Bitcoin Price */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bitcoin Price</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{price ? fmtUsd0(price) : 'N/A'}</div>
            <div className="text-xs text-gray-600">as of {latest?.btc?.as_of_utc ? new Date(latest.btc.as_of_utc).toISOString().replace('T', ' ').replace('Z', 'Z') : '—'}</div>
          </div>

          {/* Model Version */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Model Version</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{version}</div>
            <div className="text-xs text-gray-600">Five-pillar framework</div>
          </div>

          {/* Bitcoin ⇄ Gold */}
          <BtcGoldCard className="h-full" />

          {/* Satoshis per Dollar */}
          <SatoshisPerDollarCard className="h-full" />
        </div>

        {/* Risk Band Legend */}
        <div className="mb-8">
          <RiskBandLegend score={gScore || 0} />
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
          {latest?.factors?.map((factor) => (
            <div key={factor.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{factor.label}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    factor.score !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {factor.score !== null ? factor.score.toFixed(1) : 'N/A'}
                  </span>
                  <button
                    onClick={() => toggleFactorExpansion(factor.key)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedFactors.has(factor.key) ? '−' : '+'}
                  </button>
                </div>
              </div>
              
              {expandedFactors.has(factor.key) && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-600 mb-4">
                    {factor.details && factor.details.length > 0 
                      ? factor.details[0].label 
                      : 'No details available.'}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openHistoryModal({key: factor.key, label: factor.label})}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      History
                    </button>
                    {factor.key === 'etf_flows' && hasByFund && (
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