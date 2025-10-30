'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import { analytics } from '@/lib/analytics';

type FactorScores = Record<string, number>;

type SandboxData = {
  date_utc: string;
  factor_scores: FactorScores;
  factor_statuses?: Record<string, string>;
  official_composite: number;
  cycle_adj: number;
  spike_adj: number;
  official_band: string;
};

type FactorConfig = {
  key: string;
  label: string;
  pillar: string;
  weight: number;
  enabled: boolean;
};

type PillarConfig = {
  key: string;
  label: string;
  weight: number;
};

type BandConfig = {
  key: string;
  label: string;
  range: [number, number];
  color: string;
  recommendation: string;
};

type Preset = {
  key: string;
  label: string;
  description: string;
  weights: Record<string, number>;
};

const PRESETS: Preset[] = [
  {
    key: 'official_30_30',
    label: 'Official — Balanced 30/30',
    description: 'Liquidity 30%, Momentum 30%, Leverage 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.30,
      momentum: 0.30,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  },
  {
    key: 'liq_35_25',
    label: 'Liquidity-heavy — 35/25',
    description: 'Liquidity 35%, Momentum 25%, Leverage 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.35,
      momentum: 0.25,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  },
  {
    key: 'mom_25_35',
    label: 'Momentum-tilted — 25/35',
    description: 'Liquidity 25%, Momentum 35%, Leverage 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.25,
      momentum: 0.35,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  }
];

const WINDOW_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' }
];

export default function WeightsSandbox() {
  const [data, setData] = useState<SandboxData[]>([]);
  const [config, setConfig] = useState<{
    factors: FactorConfig[];
    bands: BandConfig[];
    pillars: PillarConfig[];
  } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('official_30_30');
  const [selectedWindow, setSelectedWindow] = useState<number>(180);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedUtc, setGeneratedUtc] = useState<string>('');

  // Load sandbox data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/sandbox/factors?window=${selectedWindow}`);
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.error || 'Failed to load sandbox data');
        }
        
        setData(result.data);
        setConfig(result.config);
        setGeneratedUtc(result.generated_utc);
        
        // Store sandbox visit for Phase 5 hook
        localStorage.setItem('ghostgauge-sandbox-visited', 'true');
      } catch (err) {
        console.error('Sandbox data load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sandbox data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    analytics.sandboxOpened('direct');
  }, [selectedWindow]);

  // Track preset changes for Phase 5 hook
  useEffect(() => {
    if (selectedPreset) {
      localStorage.setItem('ghostgauge-sandbox-last-preset', selectedPreset);
    }
  }, [selectedPreset]);

  // Compute alternative scores
  const computedData = useMemo(() => {
    if (!data.length || !config) return [];

    const preset = PRESETS.find(p => p.key === selectedPreset);
    if (!preset) return [];

    return data.map(day => {
      // Collect active factors and weights (respect daily status: include only 'fresh')
      const activeFactors = config.factors.filter(f => {
        if (!f.enabled) return false;
        const hasScore = day.factor_scores[f.key] !== undefined;
        const status = day.factor_statuses ? day.factor_statuses[f.key] : 'fresh';
        const isFresh = status === 'fresh';
        return hasScore && isFresh;
      });

      // Group by pillar and compute normalized pillar averages (0-100)
      const pillarScores: Record<string, number> = {};
      const pillarWeightSums: Record<string, number> = {};
      activeFactors.forEach(f => {
        const pillar = f.pillar;
        pillarWeightSums[pillar] = (pillarWeightSums[pillar] || 0) + f.weight;
      });

      activeFactors.forEach(f => {
        const pillar = f.pillar;
        const wSum = pillarWeightSums[pillar] || 0;
        if (wSum > 0) {
          const normalizedWeight = f.weight / wSum;
          pillarScores[pillar] = (pillarScores[pillar] || 0) + day.factor_scores[f.key] * normalizedWeight;
        }
      });

      // Apply alternative pillar weights to pillar averages
      let altComposite = 0;
      Object.entries(preset.weights).forEach(([pillarKey, pillarWeight]) => {
        if (pillarScores[pillarKey] !== undefined) {
          altComposite += pillarScores[pillarKey] * pillarWeight;
        }
      });

      // Apply same adjustments as official
      const finalAltComposite = Math.max(0, Math.min(100, 
        altComposite + day.cycle_adj + day.spike_adj
      ));

      // Determine band for alt score
      const altBand = config.bands.find(band => 
        finalAltComposite >= band.range[0] && finalAltComposite <= band.range[1]
      ) || config.bands[config.bands.length - 1];

      return {
        ...day,
        alt_composite: finalAltComposite,
        alt_band: altBand.label,
        delta: finalAltComposite - day.official_composite,
        pillar_scores: pillarScores
      };
    });
  }, [data, config, selectedPreset]);

  // Get today's data (most recent)
  const todayData = computedData[computedData.length - 1];
  const preset = PRESETS.find(p => p.key === selectedPreset);

  // Calculate band distribution
  const bandDistribution = useMemo(() => {
    if (!config || !computedData.length) return [];

    const officialBands: Record<string, number> = {};
    const altBands: Record<string, number> = {};

    computedData.forEach(day => {
      officialBands[day.official_band] = (officialBands[day.official_band] || 0) + 1;
      altBands[day.alt_band] = (altBands[day.alt_band] || 0) + 1;
    });

    return config.bands.map(band => ({
      band: band.label,
      official_pct: ((officialBands[band.label] || 0) / computedData.length * 100).toFixed(1),
      alt_pct: ((altBands[band.label] || 0) / computedData.length * 100).toFixed(1)
    }));
  }, [computedData, config]);

  // Calculate 90-day correlation
  const correlation = useMemo(() => {
    if (computedData.length < 2) return null;
    
    const recentData = computedData.slice(-90);
    if (recentData.length < 2) return null;

    const officialScores = recentData.map(d => d.official_composite);
    const altScores = recentData.map(d => d.alt_composite);

    const meanOfficial = officialScores.reduce((a, b) => a + b, 0) / officialScores.length;
    const meanAlt = altScores.reduce((a, b) => a + b, 0) / altScores.length;

    let numerator = 0;
    let denomOfficial = 0;
    let denomAlt = 0;

    for (let i = 0; i < recentData.length; i++) {
      const officialDiff = officialScores[i] - meanOfficial;
      const altDiff = altScores[i] - meanAlt;
      
      numerator += officialDiff * altDiff;
      denomOfficial += officialDiff * officialDiff;
      denomAlt += altDiff * altDiff;
    }

    const correlation = numerator / Math.sqrt(denomOfficial * denomAlt);
    return isNaN(correlation) ? 0 : correlation;
  }, [computedData]);

  // CSV Export
  const exportCSV = () => {
    if (!computedData.length || !preset) return;

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
    
    const headers = [
      '# ghostgauge_alt_export',
      `# preset=${preset.key}`,
      `# window_days=${selectedWindow}`,
      '# model_version=v1.1',
      `# utc_generated=${now.toISOString()}`,
      'date_utc,official_gscore,alt_gscore,official_band,alt_band,official_composite_pre_adj,alt_composite_pre_adj,cycle_adj,spike_adj',
      ''
    ];

    const rows = computedData.map(day => [
      day.date_utc,
      day.official_composite.toFixed(1),
      day.alt_composite.toFixed(1),
      day.official_band,
      day.alt_band,
      (day.official_composite - day.cycle_adj - day.spike_adj).toFixed(1),
      (day.alt_composite - day.cycle_adj - day.spike_adj).toFixed(1),
      day.cycle_adj.toFixed(1),
      day.spike_adj.toFixed(1)
    ]);

    const csvContent = [...headers, ...rows.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostgauge_alt_${preset.key}_${now.toISOString().slice(0, 10)}_${now.toISOString().slice(11, 16).replace(':', '')}UTC.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    analytics.csvExported(preset.key, selectedWindow);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sandbox data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Sandbox Data Unavailable</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
              <p className="mt-1">Try again later or check back when more data is available.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (computedData.length < 15) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Need 15+ Finalized Days</h3>
        <p className="text-gray-600">
          Need 15+ finalized days to compare. As of {formatFriendlyTimestamp(generatedUtc)}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" aria-label="Weights Sandbox experimental comparison">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Compare weight mixes (experimental)
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Re-weight finalized daily inputs to see how different pillar mixes would read. 
          This does not change the official G-Score.
        </p>
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-2xl mx-auto">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-yellow-800">
              Experimental — does not change the official G-Score. Informational only.
            </span>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Model v1.1 · Finalized days only · UTC timestamps · Same exclusion/renormalization as production
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preset Selector */}
          <div>
            <label id="preset-label" className="block text-sm font-medium text-gray-700 mb-3">
              Weight Preset
            </label>
            <div role="radiogroup" aria-labelledby="preset-label" className="space-y-2">
              {PRESETS.map((preset) => (
                <label key={preset.key} className="flex items-start">
                  <input
                    type="radio"
                    name="preset"
                    value={preset.key}
                    checked={selectedPreset === preset.key}
                    onChange={(e) => { setSelectedPreset(e.target.value); analytics.presetChanged(e.target.value); }}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    aria-checked={selectedPreset === preset.key}
                    aria-label={`${preset.label}. ${preset.description}`}
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {preset.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {preset.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Window Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Time Window
            </label>
            <select
              value={selectedWindow}
              onChange={(e) => { const days = parseInt(e.target.value); setSelectedWindow(days); analytics.windowChanged(days); }}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Today's Comparison */}
      {todayData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Comparison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Official G-Score</div>
              <div className="text-3xl font-bold text-gray-900">
                {todayData.official_composite.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">{todayData.official_band}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Alternative G-Score</div>
              <div className="text-3xl font-bold text-blue-600 flex items-center justify-center">
                {todayData.alt_composite.toFixed(1)}
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  ALT: {preset?.key.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-600">{todayData.alt_band}</div>
            </div>
          </div>
          
          <div className="mt-4 text-center" aria-live="polite">
            <div className="text-lg font-medium text-gray-900">
              {todayData.delta > 0 ? '+' : ''}{todayData.delta.toFixed(1)} points
              {todayData.official_band === todayData.alt_band ? ' (same band)' : 
               todayData.delta > 0 ? ' (↑ one band)' : ' (↓ one band)'}
            </div>
          </div>

          {/* Alt Pillar Contributions (score × alt weight) */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Alt pillar contributions (today)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pillar</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pillar score</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Alt weight</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contribution</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(preset?.weights || {}).map(([pillarKey, w]) => {
                    const score = todayData.pillar_scores?.[pillarKey] ?? 0;
                    const contrib = score * w;
                    const label = pillarKey
                      .replace('liquidity', 'Liquidity / Flows')
                      .replace('momentum', 'Momentum / Valuation')
                      .replace('term', 'Term Structure / Leverage')
                      .replace('macro', 'Macro Overlay')
                      .replace('social', 'Social / Attention');
                    return (
                      <tr key={pillarKey}>
                        <td className="px-4 py-2 text-sm text-gray-900">{label}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">{score.toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">{(w * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{contrib.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">History Comparison</h2>
          <p className="text-sm text-gray-600 mt-1">
            Finalized days only. UTC.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date (UTC)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Official
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alt
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 align-middle">
                    ALT: {preset?.key.replace('_', ' ').toUpperCase()}
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Official Band
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alt Band
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {computedData.slice(-10).reverse().map((day, index) => (
                <tr key={day.date_utc}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(day.date_utc).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.official_composite.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {day.alt_composite.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.delta > 0 ? '+' : ''}{day.delta.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.official_band}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {day.alt_band}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Band Distribution */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Band Distribution</h2>
          <p className="mt-1 text-sm text-gray-600">
            Time spent in each risk band over the selected {selectedWindow}-day window
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Band
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Official %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alt %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bandDistribution.map((row, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.band}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.official_pct}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {row.alt_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correlation */}
      {correlation !== null && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Correlation (90-day)</h2>
          <p className="text-gray-600">
            Correlation between Alt and Official: {correlation.toFixed(3)}
          </p>
        </div>
      )}

      {/* Export and Footer */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <button
              onClick={exportCSV}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label={`Export CSV for preset ${preset?.key || 'official_30_30'} and window ${selectedWindow} days`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
          <div className="text-sm text-gray-500">
            <p>As of {formatFriendlyTimestamp(generatedUtc)} · Window: {selectedWindow} days · Adjustments applied after weighting.</p>
            <p className="mt-1">Bands are context, not advice. All times UTC.</p>
          </div>
        </div>
      </div>

      {/* Provenance */}
      <div className="text-xs text-gray-500 text-center">
        Model version v1.1 — Presets are informational and do not change the official G-Score. All times UTC.
      </div>
    </div>
  );
}
