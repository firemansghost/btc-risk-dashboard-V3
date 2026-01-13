'use client';

import { useState, useEffect } from 'react';

type FactorStatus = {
  status: string;
  last_updated_utc?: string;
  reason?: string;
};

type StatusData = {
  factors?: Record<string, FactorStatus>;
};

type ContextHeaderProps = {
  status: StatusData | null;
  onModelChange?: (model: 'official' | 'liq-heavy' | 'mom-tilted') => void;
};

export default function ContextHeader({ status, onModelChange }: ContextHeaderProps) {
  const [selectedModel, setSelectedModel] = useState<'official' | 'liq-heavy' | 'mom-tilted'>('official');
  const [hasPresets, setHasPresets] = useState(false);

  // Check if presets exist in localStorage (from WeightsSandbox)
  useEffect(() => {
    const checkPresets = () => {
      // Check if user has visited sandbox and has preset saved
      const hasVisitedSandbox = localStorage.getItem('ghostgauge-sandbox-visited') === 'true';
      const lastPreset = localStorage.getItem('ghostgauge-sandbox-last-preset');
      
      // Presets exist if they're defined in QuickGlanceAltDelta/WeightsSandbox
      const presetsExist = ['liq_35_25', 'mom_25_35', 'official_30_30'].includes(lastPreset || 'official_30_30');
      setHasPresets(hasVisitedSandbox && presetsExist);
    };
    
    checkPresets();
    // Listen for changes to localStorage
    const interval = setInterval(checkPresets, 1000);
    return () => clearInterval(interval);
  }, []);

  // Count factor statuses
  const getSystemHealth = () => {
    if (!status?.factors) {
      return { fresh: 0, stale: 0, excluded: 0, total: 0 };
    }

    let fresh = 0;
    let stale = 0;
    let excluded = 0;

    Object.values(status.factors).forEach((factor: FactorStatus) => {
      if (factor.status === 'excluded') {
        excluded++;
      } else if (factor.status === 'stale' || factor.status === 'stale_beyond_ttl') {
        stale++;
      } else if (factor.status === 'fresh' || factor.status === 'success') {
        fresh++;
      }
    });

    const total = fresh + stale + excluded;
    return { fresh, stale, excluded, total };
  };

  const health = getSystemHealth();
  
  // Determine health dot color
  const getHealthDotColor = () => {
    if (health.excluded > 0) return 'bg-red-500';
    if (health.stale > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleModelChange = (model: 'official' | 'liq-heavy' | 'mom-tilted') => {
    setSelectedModel(model);
    if (onModelChange) {
      onModelChange(model);
    }
    
    // Update localStorage to match sandbox behavior
    const presetMap: Record<string, string> = {
      'official': 'official_30_30',
      'liq-heavy': 'liq_35_25',
      'mom-tilted': 'mom_25_35'
    };
    
    if (presetMap[model]) {
      localStorage.setItem('ghostgauge-sandbox-last-preset', presetMap[model]);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3">
          {/* Left: Model Perspective Toggles */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Model Perspective:</span>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Model perspective selection">
              <button
                type="button"
                onClick={() => handleModelChange('official')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-h-[44px] min-w-[44px] ${
                  selectedModel === 'official'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                aria-pressed={selectedModel === 'official'}
                aria-label="Official model perspective"
              >
                Official
              </button>
              <button
                type="button"
                onClick={() => handleModelChange('liq-heavy')}
                disabled={!hasPresets}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-h-[44px] min-w-[44px] ${
                  !hasPresets
                    ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : selectedModel === 'liq-heavy'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                aria-pressed={selectedModel === 'liq-heavy'}
                aria-disabled={!hasPresets}
                aria-label="Liquidity-heavy model perspective"
                title={!hasPresets ? 'Presets not available. Visit weights sandbox first.' : undefined}
              >
                Liq-Heavy
              </button>
              <button
                type="button"
                onClick={() => handleModelChange('mom-tilted')}
                disabled={!hasPresets}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-h-[44px] min-w-[44px] ${
                  !hasPresets
                    ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : selectedModel === 'mom-tilted'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
                aria-pressed={selectedModel === 'mom-tilted'}
                aria-disabled={!hasPresets}
                aria-label="Momentum-tilted model perspective"
                title={!hasPresets ? 'Presets not available. Visit weights sandbox first.' : undefined}
              >
                Mom-Tilted
              </button>
            </div>
            {selectedModel !== 'official' && (
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 rounded">
                Preview
              </span>
            )}
          </div>

          {/* Right: System Health Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getHealthDotColor()}`} aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">System Health</span>
            <span className="text-sm text-gray-600">
              ({health.fresh}/{health.stale}/{health.excluded})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
