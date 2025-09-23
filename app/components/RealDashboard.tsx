'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtUsd0 } from '@/lib/format';
import { getBandTextColor } from '@/lib/band-colors';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';
import { recalculateGScoreWithFreshPrice } from '@/lib/dynamicGScore';
import { formatFriendlyTimestamp, calculateFreshness, formatLocalRefreshTime, calculateYesterdayDelta } from '@/lib/dateUtils';
import { getBandTextColorFromLabel } from '@/lib/bandTextColors';
import { formatSourceTimestamp } from '@/lib/sourceUtils';
import { calculateContribution, getFactorStaleness, getFactorSubSignals, sortFactorsByContribution } from '@/lib/factorUtils';
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

// Format signed numbers for cycle/spike adjustments
function formatSignedNumber(value: number): string {
  if (value === 0) return '—';
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

// Get correct band color classes (matching RiskBandLegend exactly)
function getBandColorClasses(color: string): string {
  // Handle both semantic color names and hex colors
  if (color === '#059669' || color === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (color === '#16A34A' || color === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (color === '#65A30D' || color === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (color === '#6B7280' || color === 'blue') return 'bg-sky-100 text-sky-800 border-sky-200';  // Hold/Neutral
  if (color === '#CA8A04' || color === 'yellow') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (color === '#DC2626' || color === 'orange') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (color === '#991B1B' || color === 'red') return 'bg-rose-100 text-rose-800 border-rose-200';
  
  // Fallback to semantic names
  switch (color) {
    case 'green': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'blue': return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'red': return 'bg-rose-100 text-rose-800 border-rose-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

// Get proper recommendation text based on band key or label
function getBandRecommendation(band: any): string {
  // If we already have a proper recommendation, use it
  if (band?.recommendation && band.recommendation !== band.label) {
    return band.recommendation;
  }
  
  // Map band keys/labels to proper recommendations
  const key = band?.key || band?.label?.toLowerCase().replace(/\s+/g, '_');
  const label = band?.label;
  
  if (key === 'maximum_buying' || label === 'Maximum Buying') return 'Maximum allocation';
  if (key === 'buying' || label === 'Buying') return 'Continue regular purchases';
  if (key === 'accumulate' || label === 'Accumulate') return 'Continue regular purchases';
  if (key === 'hold_neutral' || label === 'Hold/Neutral') return 'Maintain positions, selective buying';
  if (key === 'reduce' || label === 'Reduce') return 'Take some profits';
  if (key === 'selling' || label === 'Selling') return 'Accelerate profit taking';
  if (key === 'maximum_selling' || label === 'Maximum Selling') return 'Exit most/all positions';
  
  // Fallback to the band label if no mapping found
  return band?.label || 'Unknown';
}

export default function RealDashboard() {
  console.log('RealDashboard: component mounting');
  
  const [latest, setLatest] = useState<any|null>(null);
  const [status, setStatus] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string|null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
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
                Bitcoin G-Score: <span className={getBandTextColorFromLabel(latest?.band?.label ?? '')}>{latest?.composite_score ?? '—'} — {latest?.band?.label ?? '—'}</span>
                {(() => {
                  const delta = calculateYesterdayDelta(latest?.composite_score, latest);
                  if (!delta) return null;
                  return (
                    <span 
                      className="ml-3 px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded-full border border-gray-200"
                      title="Change in headline G-Score since the previous daily close"
                    >
                      {delta.glyph} {delta.displayText}
                    </span>
                  );
                })()}
              </h1>
              <div className="flex items-center gap-2 mt-3 mb-4">
                <p className="text-sm text-gray-600">
                  Daily 0–100 risk score for Bitcoin (GRS v3). As of {latest?.as_of_utc ? formatFriendlyTimestamp(latest.as_of_utc) : '—'} · <a href="/methodology" className="text-emerald-600 hover:text-emerald-700">Methodology</a>
                </p>
                {latest?.as_of_utc && (() => {
                  const freshness = calculateFreshness(latest.as_of_utc);
                  return (
                    <div className="group relative">
                      <span 
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${freshness.className}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Data freshness: ${freshness.level}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            // Tooltip will show on focus
                          }
                        }}
                      >
                        {freshness.level}
                      </span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Artifacts updated {latest.as_of_utc} ({formatFriendlyTimestamp(latest.as_of_utc)}); most inputs refresh daily.
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                <a href="/methodology#btc-g-score" className="text-emerald-600 hover:text-emerald-700 underline">New here? What the G-Score means →</a>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {refreshMessage && (
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
                  {refreshMessage}
                </div>
              )}
              {refreshError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-md max-w-md">
                  {refreshError}
                </div>
              )}
              <div className="flex flex-col items-end">
                {lastRefreshedAt && (
                  <div className="text-xs text-gray-500 mb-1">
                    Last refreshed {formatLocalRefreshTime(lastRefreshedAt)}
                  </div>
                )}
                <button
                  onClick={() => {
                    setRefreshing(true);
                    setRefreshMessage('Fetching fresh prices...');
                    setRefreshError(null);
                    
                    // Use simple refresh API to fetch fresh prices (Vercel-compatible)
                    fetch('/api/smart-refresh-simple', { method: 'POST' })
                      .then(async (res) => {
                        console.log('Refresh response status:', res.status, res.statusText);
                        if (!res.ok) {
                          const errorText = await res.text();
                          console.error('Refresh API error response:', errorText);
                          throw new Error(`API Error ${res.status}: ${errorText}`);
                        }
                        return res.json();
                      })
                      .then((data) => {
                        console.log('Smart refresh success:', data);
                        const freshBtcPrice = data.data?.btc_price;
                        setRefreshMessage(`✅ Fresh prices: BTC $${freshBtcPrice?.toLocaleString() || 'N/A'}`);
                        setLastRefreshedAt(new Date());
                        
                        // Update the Bitcoin price and recalculate G-Score
                        if (freshBtcPrice && latest) {
                          // Recalculate G-Score with fresh Bitcoin price
                          recalculateGScoreWithFreshPrice(latest, freshBtcPrice)
                            .then(updatedData => {
                              setLatest(updatedData);
                              console.log('Updated G-Score with fresh Bitcoin price:', updatedData.composite_score);
                              
                              // Force refresh of Bitcoin⇄Gold and Satoshis cards
                              window.dispatchEvent(new CustomEvent('btc-price-updated', { 
                                detail: { btc_price: freshBtcPrice, updated_at: data.data.updated_at } 
                              }));
                            })
                            .catch(error => {
                              console.error('Error recalculating G-Score:', error);
                              // Fallback to simple price update
                              const updatedLatest = {
                                ...latest,
                                btc: {
                                  ...latest.btc,
                                  spot_usd: freshBtcPrice,
                                  as_of_utc: data.data.updated_at
                                }
                              };
                              setLatest(updatedLatest);
                              
                              window.dispatchEvent(new CustomEvent('btc-price-updated', { 
                                detail: { btc_price: freshBtcPrice, updated_at: data.data.updated_at } 
                              }));
                            });
                        }
                        
                        setRefreshing(false);
                        setTimeout(() => setRefreshMessage(null), 5000);
                      })
                      .catch((error) => {
                        console.error('Smart refresh failed:', error);
                        const errorMsg = `Couldn't refresh. Using last good snapshot from ${latest?.as_of_utc ? formatFriendlyTimestamp(latest.as_of_utc) : 'unknown time'}. Try again.`;
                        setRefreshError(errorMsg);
                        setRefreshMessage(null);
                        setRefreshing(false);
                        
                        // Show error toast
                        setTimeout(() => setRefreshError(null), 8000);
                      });
                  }}
                  disabled={loading || refreshing}
                  aria-busy={refreshing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                {refreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    <span>Refreshing…</span>
                  </>
                ) : (
                  <span>Refresh Dashboard</span>
                )}
              </button>
              </div>
              {/* Aria-live region for screen readers */}
              <div 
                aria-live="polite" 
                aria-atomic="true" 
                className="sr-only"
                role="status"
              >
                {refreshing && "Refreshing dashboard data"}
                {refreshMessage && refreshMessage.includes('✅') && "Dashboard refreshed successfully"}
                {refreshError && `Error: ${refreshError}`}
              </div>
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
            
            {/* Risk Band with Colorized Box */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-600">Band:</span>
                {latest?.band && (
                  <span className={`px-2 py-1 rounded border text-xs font-medium ${getBandColorClasses(latest.band.color)}`}>
                    {latest.band.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 ml-10">
                {getBandRecommendation(latest?.band)}
              </div>
            </div>
            
            {/* Tune Weights Button */}
            <div className="flex items-center gap-2 mb-3">
              <button 
                onClick={() => setWhatIfModalOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium border-b border-blue-200 hover:border-blue-300 transition-colors"
              >
                Tune weights
              </button>
            </div>
            
            {/* Cycle & Spike Adjustments */}
            <div className="flex items-center gap-2">
              {(() => {
                const cycleValue = latest?.cycle_adjustment?.adj_pts ?? latest?.adjustments?.cycle_nudge ?? 0;
                const hasValue = cycleValue !== 0 && cycleValue != null;
                return (
                  <div className="group relative">
                    <span 
                      className={`px-2 py-0.5 text-[11px] rounded border ${
                        hasValue 
                          ? 'bg-slate-100 text-slate-700 border-slate-200' 
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Cycle adjustment: ${hasValue ? formatSignedNumber(cycleValue) : 'disabled'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                        }
                        if (e.key === 'Escape') {
                          e.currentTarget.blur();
                        }
                      }}
                    >
                      Cycle: {formatSignedNumber(cycleValue)}
                    </span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Small cycle-context nudge based on long-trend residuals. Usually ±0–2 pts; may be disabled.
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const spikeValue = latest?.spike_adjustment?.adj_pts ?? latest?.adjustments?.spike_nudge ?? 0;
                const hasValue = spikeValue !== 0 && spikeValue != null;
                return (
                  <div className="group relative">
                    <span 
                      className={`px-2 py-0.5 text-[11px] rounded border ${
                        hasValue 
                          ? 'bg-slate-100 text-slate-700 border-slate-200' 
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Spike adjustment: ${hasValue ? formatSignedNumber(spikeValue) : 'disabled'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                        }
                        if (e.key === 'Escape') {
                          e.currentTarget.blur();
                        }
                      }}
                    >
                      Spike: {formatSignedNumber(spikeValue)}
                    </span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      One-day move vs recent volatility. Nudges the score a few points when markets jump.
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bitcoin Price */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bitcoin Price</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{latest?.btc?.spot_usd ? fmtUsd0(latest.btc.spot_usd) : 'N/A'}</div>
            <div className="text-xs text-gray-500">
              {formatSourceTimestamp('Coinbase (daily close)', latest?.btc?.as_of_utc || '—')}
            </div>
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
            asOfUtc={latest?.as_of_utc}
            onOpenProvenance={() => setProvenanceModalOpen(true)}
            onOpenWeights={() => setWhatIfModalOpen(true)}
          />
        </div>

        {/* Factor Cards */}
        <div className="mb-6">
          {/* Factor Summary */}
          <div className="text-sm text-gray-600 mb-4">
            Sorted by contribution · Liquidity 35% · Momentum 25% · Term 20% · Macro 10% · Social 10%
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {sortFactorsByContribution(latest?.factors || []).map((factor: any) => {
            const contribution = calculateContribution(factor.score, factor.weight_pct);
            const staleness = getFactorStaleness(factor.last_utc || factor.as_of_utc);
            const subSignals = getFactorSubSignals(factor.key);
            
            return (
            <div key={factor.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <div className="mb-4">
                {/* Header Row with Title and Chips */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">{factor.label}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPillarBadgeClasses(factor.pillar)}`}>
                      {getPillarLabel(factor.pillar)}
                    </span>
                  </div>
                  
                  {/* Staleness Badge - positioned in top right */}
                  <div className="absolute top-2 right-2">
                    <span 
                      className={`px-2 py-1 rounded text-xs font-medium border ${staleness.className}`}
                      title={staleness.tooltip}
                    >
                      {staleness.level}
                    </span>
                  </div>
                  
                  {/* Score, Weight, Contribution Chips */}
                  <div className="flex items-center space-x-2 flex-wrap">
                    {/* Score Chip (Primary) */}
                    <span 
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        factor.score !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                      }`}
                      aria-label={`Score: ${factor.score !== null ? factor.score.toFixed(0) : 'N/A'}`}
                    >
                      {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
                    </span>
                    
                    {/* Weight Chip (Muted) */}
                    <span 
                      className="px-2 py-1 rounded text-xs text-gray-600 bg-gray-50 border border-gray-200"
                      aria-label={`Weight: ${factor.weight_pct ? `${factor.weight_pct}%` : 'unknown'}`}
                    >
                      W: {factor.weight_pct ? `${factor.weight_pct}%` : '—'}
                    </span>
                    
                    {/* Contribution Chip (Muted) */}
                    <span 
                      className="px-2 py-1 rounded text-xs text-gray-600 bg-gray-50 border border-gray-200"
                      aria-label={`Contribution: ${contribution !== null ? contribution.toFixed(1) : 'unknown'}`}
                    >
                      C: {contribution !== null ? contribution.toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
                
                {/* Pillar Row with Links */}
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">
                      {factor.pillar ? factor.pillar.charAt(0).toUpperCase() + factor.pillar.slice(1) : 'Unknown'} Pillar
                    </span>
                    {factor.counts_toward && factor.counts_toward !== factor.pillar && (
                      <span className="ml-2 text-xs text-blue-600">
                        (counts toward {factor.counts_toward})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => openHistoryModal({key: factor.key, label: factor.label})}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      History
                    </button>
                    <a 
                      href="/methodology" 
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      What's this?
                    </a>
                  </div>
                </div>
                
                {/* Status Info */}
                <div className="text-sm text-gray-600">
                  Status: <span className={`font-medium ${
                    factor.status === 'fresh' ? 'text-green-600' : 
                    factor.status === 'stale' ? 'text-yellow-600' : 
                    factor.status === 'excluded' ? 'text-gray-600' : 
                    'text-red-600'
                  }`}>
                    {factor.status || staleness.level}
                  </span>
                  {factor.status === 'excluded' && factor.reason && (
                    <span className="ml-2 text-xs text-gray-500">({factor.reason})</span>
                  )}
                </div>
                
                {/* What's Inside Bullets */}
                <div className="mt-3 text-sm text-gray-600">
                  <div className="font-medium text-gray-700 mb-1">What's inside:</div>
                  <ul className="space-y-1">
                    {subSignals.slice(0, 3).map((signal, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-gray-400 mr-2">•</span>
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Excluded Factor State */}
              {staleness.level === 'excluded' ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">Temporarily excluded from today's G-Score.</span>
                    <br />
                    <span className="text-xs">
                      Reason: {factor.reason || factor.status || 'stale data'}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Always show first 3 details */}
                  {factor.details && factor.details.length > 0 && (
                <div className="mb-4">
                  <div className="space-y-2">
                    {factor.details.slice(0, 3).map((detail: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{detail.label}:</span>
                        <span className="font-medium text-gray-900">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show "+X more..." if there are more details */}
                  {factor.details.length > 3 && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleFactorExpansion(factor.key)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {expandedFactors.has(factor.key) 
                          ? '- Show less' 
                          : `+${factor.details.length - 3} more...`}
                      </button>
                    </div>
                  )}

                  {/* Show additional details when expanded */}
                  {expandedFactors.has(factor.key) && factor.details.length > 3 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {factor.details.slice(3).map((detail: any, idx: number) => (
                        <div key={idx + 3} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{detail.label}:</span>
                          <span className="font-medium text-gray-900">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Macro-specific: Add Net Liquidity context */}
                  {factor.key === 'macro_overlay' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="mb-2">
                        <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">Context</h4>
                      </div>
                      {(() => {
                        // Find Net Liquidity factor for context display
                        const netLiquidityFactor = latest?.factors?.find((f: any) => f.key === 'net_liquidity');
                        if (!netLiquidityFactor) return null;
                        
                        return (
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">Net Liquidity (FRED)</span>
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                  Context only — scored under Liquidity (5%)
                                </span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {netLiquidityFactor.score !== null ? netLiquidityFactor.score.toFixed(0) : 'N/A'}
                              </span>
                            </div>
                            {netLiquidityFactor.details && netLiquidityFactor.details.length > 0 && (
                              <div className="space-y-1">
                                {netLiquidityFactor.details.slice(0, 2).map((detail: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center text-xs">
                                    <span className="text-gray-600">{detail.label}:</span>
                                    <span className="font-medium text-gray-800">{detail.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 text-xs text-gray-600">
                              <span title="Shown for context; Net Liquidity is scored under Liquidity (5%) to avoid double-counting macro effects">
                                Provides macro context without double-counting in composite score
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Factor with no details (excluded factors) */}
              {(!factor.details || factor.details.length === 0) && factor.status === 'excluded' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    This factor is currently excluded due to missing configuration.
                    {factor.reason === 'missing_fred_api_key' && (
                      <span className="block mt-1 text-xs text-gray-500">
                        Requires FRED API key for economic data access.
                      </span>
                    )}
                  </div>
                </div>
              )}
              
                  {/* ETF-specific action button */}
                  {factor.key === 'etf_flows' && (
                    <div className="mt-2">
                      <button
                        onClick={openEtfBreakdown}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        By ETF
                      </button>
                    </div>
                  )}
                  
                  {/* Last Updated timestamp */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Last updated: {latest?.as_of_utc ? new Date(latest.as_of_utc).toLocaleString() + ' UTC' : 'Unknown'}
                    </div>
                  </div>
                </div>
                </>
              )}
            </div>
            );
          })}
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