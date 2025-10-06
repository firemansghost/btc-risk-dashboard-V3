'use client';

import { useCallback, useEffect, useState } from 'react';

// Client-side types to avoid importing server modules
type Pillar = { key: string; label: string; color: string; weight: number };
type FactorCfg = { key: string; label: string; pillar: string; weight: number; enabled: boolean };
type Band = { key: string; label: string; range: [number, number]; color: string; recommendation: string };

type ConfigDTO = {
  ok: boolean;
  config: {
    pillars: Pillar[];
    factors: FactorCfg[];
    bands: Band[];
    version: string;
    normalization: any;
    composite: { smoothingAlpha: number; minFactorsRequired: number };
    spikeDetector: any;
    powerLaw: any;
    digest?: string;
  };
  digest?: string;
};

type FactorSummary = { key: string; label: string; score: number | null; pillar?: string };
type LatestSnapshot = { ok: boolean; latest?: { factors: FactorSummary[]; composite_score: number } } | { ok: boolean; factors: FactorSummary[]; composite_score: number };

interface WhatIfWeightsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatIfWeightsModal({ isOpen, onClose }: WhatIfWeightsModalProps) {
  const [tab, setTab] = useState<'pillars' | 'advanced'>('pillars');
  const [config, setConfig] = useState<ConfigDTO | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<LatestSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Slider states
  const [pillarSliders, setPillarSliders] = useState<Map<string, number>>(new Map());
  const [factorSliders, setFactorSliders] = useState<Map<string, number>>(new Map());
  
  // Preview state
  const [preview, setPreview] = useState<{ score: number; band: Band } | null>(null);

  // Fetch config and latest data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [configRes, latestRes] = await Promise.all([
        fetch('/api/config?ts=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/data/latest?ts=' + Date.now(), { cache: 'no-store' })
      ]);

      const configData = await configRes.json().catch(() => null);
      const latestData = await latestRes.json().catch(() => null);

      if (!configRes.ok || !configData?.ok) {
        throw new Error('Failed to fetch config');
      }

      if (!latestRes.ok || !latestData?.ok) {
        throw new Error('Failed to fetch latest data');
      }

      setConfig(configData);
      setLatestSnapshot(latestData);

      // Initialize sliders with current config
      const pillarMap = new Map<string, number>();
      const factorMap = new Map<string, number>();

      configData.config.pillars.forEach((pillar: Pillar) => {
        pillarMap.set(pillar.key, pillar.weight);
      });

      configData.config.factors.forEach((factor: FactorCfg) => {
        if (factor.enabled) {
          factorMap.set(factor.key, factor.weight);
        }
      });

      setPillarSliders(pillarMap);
      setFactorSliders(factorMap);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate preview score and band
  const calculatePreview = useCallback(() => {
    if (!config || !latestSnapshot) return;

    const latest = (latestSnapshot as any).latest || latestSnapshot;
    const availableFactors = latest.factors.filter((f: any) => 
      f.score !== null && typeof f.score === 'number' && f.score >= 0 && f.score <= 100
    );

    if (availableFactors.length === 0) {
      setPreview(null);
      return;
    }

    let weights: Map<string, number>;

    if (tab === 'pillars') {
      // Distribute pillar weights to factors
      weights = new Map();
      const pillarGroups = new Map<string, typeof availableFactors>();
      
      // Group factors by pillar
      availableFactors.forEach((factor: any) => {
        const pillar = factor.pillar || 'unknown';
        if (!pillarGroups.has(pillar)) {
          pillarGroups.set(pillar, []);
        }
        pillarGroups.get(pillar)!.push(factor);
      });

      // Distribute pillar weights equally among factors in each pillar
      pillarGroups.forEach((factors, pillarKey) => {
        const pillarWeight = pillarSliders.get(pillarKey) || 0;
        const factorWeight = pillarWeight / factors.length;
        factors.forEach((factor: any) => {
          weights.set(factor.key, factorWeight);
        });
      });
    } else {
      // Use factor weights directly
      weights = new Map();
      availableFactors.forEach((factor: any) => {
        const weight = factorSliders.get(factor.key) || 0;
        weights.set(factor.key, weight);
      });
    }

    // Normalize weights
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      // Fallback to uniform weights
      const uniformWeight = 100 / availableFactors.length;
      availableFactors.forEach((factor: any) => {
        weights.set(factor.key, uniformWeight);
      });
    } else {
      // Normalize to 100%
      weights.forEach((weight, key) => {
        weights.set(key, (weight / totalWeight) * 100);
      });
    }

    // Calculate composite score
    let compositeScore = 0;
    availableFactors.forEach((factor: any) => {
      const weight = weights.get(factor.key) || 0;
      compositeScore += (weight / 100) * (factor.score || 0);
    });

    // Find band
    const band = config.config.bands.find(b => 
      compositeScore >= b.range[0] && compositeScore < b.range[1]
    ) || config.config.bands[config.config.bands.length - 1];

    setPreview({ score: Math.round(compositeScore), band });
  }, [config, latestSnapshot, tab, pillarSliders, factorSliders]);

  // Update preview when sliders change
  useEffect(() => {
    calculatePreview();
  }, [calculatePreview]);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen) {
      // Focus the first interactive element when modal opens
      const firstButton = document.querySelector('[role="dialog"] button') as HTMLButtonElement;
      if (firstButton) {
        firstButton.focus();
      }
    }
  }, [isOpen]);

  // Handle slider changes
  const updatePillarSlider = useCallback((pillarKey: string, value: number) => {
    setPillarSliders(prev => new Map(prev.set(pillarKey, value)));
  }, []);

  const updateFactorSlider = useCallback((factorKey: string, value: number) => {
    setFactorSliders(prev => new Map(prev.set(factorKey, value)));
  }, []);

  // Reset to original config
  const resetSliders = useCallback(() => {
    if (!config) return;

    const pillarMap = new Map<string, number>();
    const factorMap = new Map<string, number>();

    config.config.pillars.forEach((pillar: Pillar) => {
      pillarMap.set(pillar.key, pillar.weight);
    });

    config.config.factors.forEach((factor: FactorCfg) => {
      if (factor.enabled) {
        factorMap.set(factor.key, factor.weight);
      }
    });

    setPillarSliders(pillarMap);
    setFactorSliders(factorMap);
  }, [config]);

  // Copy config JSON
  const copyConfigJSON = useCallback(() => {
    if (!config) return;

    let jsonSnippet: any;

    if (tab === 'pillars') {
      const pillars = config.config.pillars.map(pillar => ({
        key: pillar.key,
        weight: pillarSliders.get(pillar.key) || pillar.weight
      }));
      jsonSnippet = { pillars };
    } else {
      const factors = config.config.factors
        .filter(factor => factor.enabled)
        .map(factor => ({
          key: factor.key,
          weight: factorSliders.get(factor.key) || factor.weight
        }));
      jsonSnippet = { factors };
    }

    navigator.clipboard.writeText(JSON.stringify(jsonSnippet, null, 2));
  }, [config, tab, pillarSliders, factorSliders]);

  if (!isOpen) return null;

  const latest = (latestSnapshot as any)?.latest || latestSnapshot;
  const availableFactors = latest?.factors.filter((f: any) => 
    f.score !== null && typeof f.score === 'number' && f.score >= 0 && f.score <= 100
  ) || [];

  return (
    <div className="glass-modal-backdrop fixed inset-0 flex items-center justify-center z-50 p-4" role="dialog" aria-modal>
      <div className="glass-modal bg-white/80 backdrop-blur-xl rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="glass-sm flex items-center justify-between p-6 border-b border-white/20">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">What-If Weights</h2>
            {config?.digest && (
              <p className="text-xs text-gray-500 mt-1">
                Config {config.digest} (read-only)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading configuration...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">Error: {error}</div>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Retry
              </button>
            </div>
          )}

          {config && latestSnapshot && !loading && !error && (
            <>
              {/* Tabs */}
              <div className="glass-sm flex gap-2 mb-6 border-b border-white/20 p-2 rounded-lg">
                <button
                  onClick={() => setTab('pillars')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    tab === 'pillars' 
                      ? 'glass-blue text-blue-900 border border-blue-300/50' 
                      : 'text-gray-600 hover:text-gray-800 hover:glass-hover'
                  }`}
                >
                  Pillars
                </button>
                <button
                  onClick={() => setTab('advanced')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    tab === 'advanced' 
                      ? 'glass-blue text-blue-900 border border-blue-300/50' 
                      : 'text-gray-600 hover:text-gray-800 hover:glass-hover'
                  }`}
                >
                  Advanced
                </button>
              </div>

              {/* Preview Card */}
              {preview && (
                <div className="glass-card mb-6 p-4 rounded-lg border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Preview Composite Score</div>
                      <div className="text-3xl font-bold text-gray-900">{preview.score}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 text-sm font-medium rounded-full ${
                        preview.band.color === 'green' ? 'bg-green-100 text-green-800' :
                        preview.band.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                        preview.band.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        preview.band.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                        preview.band.color === 'red' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {preview.band.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {preview.band.range[0]}-{preview.band.range[1]}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Based on current day's factor scores; no smoothing or cycle/spike adjustments.
                  </div>
                </div>
              )}

              {/* No factors available */}
              {availableFactors.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No factors available to preview.
                </div>
              )}

              {/* Sliders */}
              {availableFactors.length > 0 && (
                <div className="space-y-6">
                  {tab === 'pillars' ? (
                    // Pillar sliders
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Pillar Weights</h3>
                      {config.config.pillars.map(pillar => {
                        const pillarFactors = availableFactors.filter((f: any) => f.pillar === pillar.key);
                        const isDisabled = pillarFactors.length === 0;
                        const currentValue = pillarSliders.get(pillar.key) || pillar.weight;
                        
                        return (
                          <div key={pillar.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700">
                                {pillar.label}
                                {isDisabled && (
                                  <span className="text-xs text-gray-400 ml-2">(no available factors)</span>
                                )}
                              </label>
                              <span className="text-sm text-gray-500">{currentValue.toFixed(1)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="0.1"
                              value={currentValue}
                              onChange={(e) => updatePillarSlider(pillar.key, parseFloat(e.target.value))}
                              disabled={isDisabled}
                              aria-label={`Pillar weight: ${pillar.label}`}
                              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${
                                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Factor sliders
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Factor Weights</h3>
                      {config.config.factors
                        .filter(factor => factor.enabled && availableFactors.some((f: any) => f.key === factor.key))
                        .map(factor => {
                          const currentValue = factorSliders.get(factor.key) || factor.weight;
                          const factorData = availableFactors.find((f: any) => f.key === factor.key);
                          
                          return (
                            <div key={factor.key} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">
                                  {factor.label}
                                  <span className="text-xs text-gray-400 ml-2">
                                    (Score: {factorData?.score ?? 'N/A'})
                                  </span>
                                </label>
                                <span className="text-sm text-gray-500">{currentValue.toFixed(1)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={currentValue}
                                onChange={(e) => updateFactorSlider(factor.key, parseFloat(e.target.value))}
                                aria-label={`Factor weight: ${factor.label}`}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="glass-sm flex items-center justify-between p-6 border-t border-white/20">
          <button
            onClick={resetSliders}
            disabled={!config}
            title="Restore configuration defaults (no persistence)"
            className="glass-sm px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:glass-hover focus:glass-focus active:glass-active disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={copyConfigJSON}
              disabled={!config}
              className="glass-green px-4 py-2 text-sm font-medium text-green-800 rounded-lg hover:glass-hover focus:glass-focus active:glass-active disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Copy Config JSON
            </button>
            <button
              onClick={onClose}
              className="glass-blue px-4 py-2 text-sm font-medium text-blue-900 rounded-lg hover:glass-hover focus:glass-focus active:glass-active transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
