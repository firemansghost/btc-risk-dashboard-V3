'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtUsd0 } from '@/lib/format';
import { getBandTextColor } from '@/lib/band-colors';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';
import { recalculateGScoreWithFreshPrice } from '@/lib/dynamicGScore';
import { formatFriendlyTimestamp, calculateFreshness, formatLocalRefreshTime, calculateYesterdayDelta } from '@/lib/dateUtils';
import { getBandTextColorFromLabel } from '@/lib/bandTextColors';
import { formatSourceTimestamp } from '@/lib/sourceUtils';
import { calculateContribution, getFactorStaleness, getFactorSubSignals, sortFactorsByContribution, getFactorTTL, getFactorCadence } from '@/lib/factorUtils';
import SystemStatusCard from './SystemStatusCard';
import RiskBandLegend from './RiskBandLegend';
import WhatIfWeightsModal from './WhatIfWeightsModal';
import ProvenanceModal from './ProvenanceModal';
import FactorHistoryModal from './FactorHistoryModal';
import EnhancedFactorDetails from './EnhancedFactorDetails';
import EtfBreakdownModal from './EtfBreakdownModal';
import EtfPerformanceAnalysis from './EtfPerformanceAnalysis';
import WeightsLauncher from './WeightsLauncher';
import HistoryChart from './HistoryChart';
import BtcGoldCard from './BtcGoldCard';
import SatoshisPerDollarCard from './SatoshisPerDollarCard';
import RadialGauge from './RadialGauge';

function ErrorView({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return <div style={{ padding: 16 }}><p>{msg}</p><button onClick={onRetry} style={{ marginTop: 8 }}>Retry</button></div>;
}

// Format signed numbers for cycle/spike adjustments
function formatSignedNumber(value: number): string {
  if (value === 0) return '—';
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

// Get correct band color classes (matching RiskBandLegend exactly)
function getBandColorClasses(input: string): string {
  // Handle band labels first
  const labelColorMap: Record<string, string> = {
    'Aggressive Buying': 'bg-green-100 text-green-800 border-green-200',
    'Regular DCA Buying': 'bg-green-100 text-green-800 border-green-200',
    'Moderate Buying': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Hold & Wait': 'bg-orange-100 text-orange-800 border-orange-200',
    'Reduce Risk': 'bg-red-100 text-red-800 border-red-200',
    'High Risk': 'bg-red-100 text-red-800 border-red-200'
  };
  
  if (labelColorMap[input]) {
    return labelColorMap[input];
  }
  
  // Handle both semantic color names and hex colors
  if (input === '#059669' || input === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (input === '#16A34A' || input === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (input === '#65A30D' || input === 'green') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (input === '#6B7280' || input === 'blue') return 'bg-sky-100 text-sky-800 border-sky-200';  // Hold/Neutral
  if (input === '#CA8A04' || input === 'yellow') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (input === '#DC2626' || input === 'orange') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (input === '#991B1B' || input === 'red') return 'bg-rose-100 text-rose-800 border-rose-200';
  
  // Fallback to semantic names
  switch (input) {
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
  const [enhancedDetailsOpen, setEnhancedDetailsOpen] = useState(false);
  const [etfBreakdownOpen, setEtfBreakdownOpen] = useState(false);
  const [etfPerformanceOpen, setEtfPerformanceOpen] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<{key: string, label: string} | null>(null);

  // Factor expansion state
  const [expandedFactors, setExpandedFactors] = useState(new Set<string>());
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user is first-time visitor
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('ghostgauge-onboarding-dismissed');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('ghostgauge-onboarding-dismissed', 'true');
  };

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

  const openEnhancedDetails = (factor: {key: string, label: string}) => {
    setSelectedFactor(factor);
    setEnhancedDetailsOpen(true);
  };

  const openEtfBreakdown = () => {
    setEtfBreakdownOpen(true);
  };

  const openEtfPerformance = () => {
    setEtfPerformanceOpen(true);
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
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 py-4 sm:py-6">
            <div className="flex-1">
              <div className="font-bold tracking-tight text-xl sm:text-2xl md:text-3xl text-gray-900 mb-4">
                <a href="/" className="hover:text-emerald-600 transition-colors">GhostGauge</a>
              </div>
              
              {/* Top Row: G-Score Card + Bitcoin Price Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Prominent G-Score Card - Unified Vertical Layout */}
                <div className="bg-white border-2 border-gray-300 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-200 ring-1 ring-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                      Bitcoin G-Score
                    </h1>
                    {(() => {
                      const delta = calculateYesterdayDelta(latest?.composite_score, latest);
                      if (!delta) return null;
                      return (
                        <span 
                          className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full border border-gray-200"
                          title="Change in headline G-Score since the previous daily close"
                        >
                          {delta.glyph} {delta.displayText}
                        </span>
                      );
                    })()}
                  </div>
                  
                  {/* Unified Vertical Layout: Gauge on top, Score below */}
                  <div className="flex flex-col items-center space-y-4">
                    {/* Radial Gauge */}
                    <div className="flex justify-center">
                      <RadialGauge 
                        score={latest?.composite_score ?? 0}
                        bandLabel={latest?.band?.label ?? '—'}
                        className="w-64 h-32"
                      />
                    </div>
                    
                    {/* Score Display - Centered below gauge */}
                    <div className="text-center space-y-2">
                      <div className="text-5xl font-bold text-gray-900">
                        {latest?.composite_score ?? '—'}
                      </div>
                      <div className={`inline-flex items-center px-3 py-2 rounded-full text-base font-semibold ${getBandColorClasses(latest?.band?.label ?? '')}`}>
                        {latest?.band?.label ?? '—'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getBandRecommendation(latest?.band)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bitcoin Price Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Bitcoin Price</h3>
                  <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{latest?.btc?.spot_usd ? fmtUsd0(latest.btc.spot_usd) : 'N/A'}</div>
                  <div className="text-sm text-gray-500">
                    {formatSourceTimestamp('Coinbase (daily close)', latest?.btc?.as_of_utc || '—')}
                  </div>
                </div>
              </div>
              
              {/* Refresh Dashboard Button - Moved below top cards */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-6 mb-4">
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
                <div className="flex flex-col items-start">
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
                    className="px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
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
                </div>
              </div>
              
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Onboarding Block */}
        {showOnboarding && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-800">Getting Started</h3>
              <button 
                onClick={dismissOnboarding}
                className="text-blue-600 hover:text-blue-800 text-xl font-bold leading-none"
                aria-label="Dismiss onboarding"
              >
                ×
              </button>
            </div>
            
            <div className="text-blue-700 text-sm space-y-3">
              <p>
                <strong>Bitcoin G-Score</strong> turns market conditions into a 0–100 risk measure (higher = riskier). 
                Use the risk bands as context, not commands.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1 text-blue-800">Quick Start:</h4>
                  <ul className="space-y-1 text-xs">
                    <li>• Check the <strong>G-Score</strong> and risk band above</li>
                    <li>• Review <strong>factor contributions</strong> below</li>
                    <li>• Use <strong>History</strong> buttons for trends</li>
                    <li>• Click <strong>Enhanced Details</strong> for deeper analysis</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1 text-blue-800">Learn More:</h4>
                  <div className="space-y-1 text-xs">
                    <div>
                      <a href="/what-is-risk" className="text-blue-600 hover:underline">What Is Risk?</a>
                      <span className="text-blue-500 ml-1">→ Risk concepts & analogies</span>
                    </div>
                    <div>
                      <a href="/methodology" className="text-blue-600 hover:underline">Methodology</a>
                      <span className="text-blue-500 ml-1">→ How G-Score is calculated</span>
                    </div>
                    <div>
                      <a href="/strategy-analysis" className="text-blue-600 hover:underline">Strategy Analysis</a>
                      <span className="text-blue-500 ml-1">→ Historical performance</span>
                    </div>
                    <div>
                      <a href="/etf-predictions" className="text-blue-600 hover:underline">ETF Predictions</a>
                      <span className="text-blue-500 ml-1">→ Flow forecasts</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-100 border border-blue-300 rounded p-3 mt-3">
                <p className="text-xs text-blue-800">
                  <strong>💡 Pro Tip:</strong> The G-Score combines 5 pillars (Liquidity, Momentum, Term Structure, Macro, Social) 
                  with transparent weights. Higher scores indicate riskier market conditions, not price predictions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Cards - Balanced 2x2 Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 lg:mb-8">
          {/* Composite Score */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">BTC G-Score</h3>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{latest?.composite_score ?? '—'}</div>
            
            {/* Risk Band with Colorized Box */}
            <div className="mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <span className="text-xs text-gray-600">Band:</span>
                {latest?.band && (
                  <span className={`px-2 py-1 rounded border text-xs font-medium w-fit ${getBandColorClasses(latest.band.color)}`}>
                    {latest.band.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 sm:ml-10">
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
              <span className="text-gray-400">•</span>
              <a 
                href="/what-is-risk" 
                className="text-xs text-blue-600 hover:text-blue-700 font-medium border-b border-blue-200 hover:border-blue-300 transition-colors"
              >
                What's this?
              </a>
            </div>
            
            {/* Cycle & Spike Adjustments */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
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
                      {hasValue ? 
                        `Long-term cycle position adjustment. Based on deviation from Bitcoin's power-law trend. Currently ${formatSignedNumber(cycleValue)} points.` :
                        `Long-term cycle position adjustment (inactive - conditions not met). Activates when Bitcoin deviates >30% from its long-term power-law trend.`
                      }
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
                      {hasValue ? 
                        `Daily volatility adjustment. Based on today's move vs recent volatility. Currently ${formatSignedNumber(spikeValue)} points.` :
                        `Daily volatility adjustment (inactive - conditions not met). Activates when daily move exceeds 2x recent volatility.`
                      }
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>


          {/* Model Version */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Model Version</h3>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{latest?.model_version ?? 'v3'}</div>
            <div className="text-xs text-gray-600">Five-pillar framework</div>
          </div>

        </div>

        {/* Second Row: Bitcoin⇄Gold + Satoshis per Dollar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 lg:mb-8">
          <BtcGoldCard className="h-full" />
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Risk Factor Breakdown</h2>
            <a 
              href="/methodology#factors" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium border-b border-blue-200 hover:border-blue-300 transition-colors"
            >
              How factors work →
            </a>
          </div>
          {/* Factor Summary */}
          <div className="text-sm text-gray-600 mb-4">
            Sorted by contribution · Liquidity 35% · Momentum 25% · Term 20% · Macro 10% · Social 10%
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {sortFactorsByContribution(latest?.factors || []).map((factor: any) => {
            const contribution = calculateContribution(factor.score, factor.weight_pct);
            const factorTTL = getFactorTTL(factor.key);
            const staleness = getFactorStaleness(factor.last_utc || factor.as_of_utc, factorTTL, factor.key);
            const subSignals = getFactorSubSignals(factor.key);
            const cadence = getFactorCadence(factor.key);
            
            return (
            <div key={factor.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 relative">
          {/* Reserved Badge Lane - Top Right */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-1 items-end">
            <span 
              className={`px-2 py-1 rounded text-xs font-medium border ${staleness.className}`}
              title={staleness.tooltip}
            >
              {staleness.level}
            </span>
            
            {/* 50W SMA Diagnostic Pill (Trend & Valuation only) */}
            {factor.key === 'trend_valuation' && factor.sma50wDiagnostic && (
              <span 
                className={`px-2 py-1 rounded text-xs font-medium border ${
                  factor.sma50wDiagnostic.showWarning 
                    ? 'bg-amber-100 text-amber-800 border-amber-200' 
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
                title={
                  factor.sma50wDiagnostic.showWarning
                    ? "Historical caution marker; display-only, not part of the score"
                    : "50-week SMA status; display-only, not part of the score"
                }
              >
                {factor.sma50wDiagnostic.showWarning 
                  ? `Below 50W SMA (${factor.sma50wDiagnostic.consecutiveWeeksBelow}+ weeks)`
                  : `Above 50W SMA ($${Math.round(factor.sma50wDiagnostic.sma50 / 1000)}k)`
                }
              </span>
            )}
            
            {/* Space for additional badges if needed */}
          </div>
              
              <div className="mb-4 pr-16 sm:pr-20"> {/* Add right padding to avoid badge lane */}
                {/* Header Row - Title and Pillar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">{factor.label}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${getPillarBadgeClasses(factor.pillar)}`}>
                    {getPillarLabel(factor.pillar)}
                  </span>
                </div>
                
                {/* Score Row - Dedicated flex container with controlled wrapping */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-h-[32px]">
                    {/* Risk Score Chip (Primary) */}
                    <span 
                      className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                        factor.score !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                      }`}
                      aria-label={`Risk score: ${factor.score !== null ? factor.score.toFixed(0) : 'N/A'}`}
                    >
                      Risk: {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
                    </span>
                    
                    {/* Weight Chip (Muted) */}
                    <span 
                      className="px-1.5 sm:px-2 py-1 rounded text-xs text-gray-600 bg-gray-50 border border-gray-200"
                      aria-label={`Weight: ${factor.weight_pct ? `${factor.weight_pct}%` : 'unknown'}`}
                    >
                      W: {factor.weight_pct ? `${factor.weight_pct}%` : '—'}
                    </span>
                    
                    {/* Contribution Chip (Muted) */}
                    <span 
                      className="px-1.5 sm:px-2 py-1 rounded text-xs text-gray-600 bg-gray-50 border border-gray-200"
                      aria-label={`Contribution: ${contribution !== null ? contribution.toFixed(1) : 'unknown'}`}
                    >
                      C: {contribution !== null ? contribution.toFixed(1) : '—'}
                    </span>
                  </div>
                
                {/* Pillar Row with Links */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-1">
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
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <button
                      onClick={() => openHistoryModal({key: factor.key, label: factor.label})}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                    >
                      History
                    </button>
                    <button
                      onClick={() => openEnhancedDetails({key: factor.key, label: factor.label})}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Enhanced Details
                    </button>
                    <a 
                      href="/methodology" 
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
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
                  
                  {/* Cadence Information */}
                  <div className="mt-2 text-xs text-gray-500" title={cadence.description}>
                    Cadence: {cadence.label} (TTL {cadence.ttlHours < 24 ? `${cadence.ttlHours}h` : `${cadence.ttlHours / 24}d`})
                  </div>
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
              
                  {/* ETF-specific action buttons */}
                  {factor.key === 'etf_flows' && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        onClick={openEtfBreakdown}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        By ETF
                      </button>
                      <button
                        onClick={openEtfPerformance}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Performance Analysis
                      </button>
                      <button
                        onClick={() => window.open('/etf-predictions', '_blank')}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Predictions
                      </button>
                      <a 
                        href="/etf-predictions" 
                        className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                      >
                        What are ETF flows? →
                      </a>
                    </div>
                  )}
                  
                  {/* Last Updated timestamp */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Last updated: {latest?.as_of_utc ? new Date(latest.as_of_utc).toLocaleString() + ' UTC' : 'Unknown'}
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

      {enhancedDetailsOpen && selectedFactor && (
        <EnhancedFactorDetails
          isOpen={enhancedDetailsOpen}
          onClose={() => setEnhancedDetailsOpen(false)}
          factorKey={selectedFactor?.key || ''}
          factorLabel={selectedFactor?.label || ''}
          currentScore={latest?.factors?.find((f: any) => f.key === selectedFactor?.key)?.score || 0}
          factorWeight={latest?.factors?.find((f: any) => f.key === selectedFactor?.key)?.weight}
        />
      )}

      {etfBreakdownOpen && (
        <EtfBreakdownModal
          isOpen={etfBreakdownOpen}
          onClose={() => setEtfBreakdownOpen(false)}
        />
      )}

      {etfPerformanceOpen && (
        <EtfPerformanceAnalysis
          isOpen={etfPerformanceOpen}
          onClose={() => setEtfPerformanceOpen(false)}
        />
      )}
    </div>
  );
}