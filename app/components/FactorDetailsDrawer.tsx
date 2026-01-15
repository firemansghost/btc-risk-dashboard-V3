'use client';

import { useEffect, useState, useRef } from 'react';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';
import { getFactorStaleness, getFactorSubSignals, getFactorTTL, getFactorCadence } from '@/lib/factorUtils';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import { formatDeltaDisplay, getDeltaColorClass, formatDeltaProvenance } from '@/lib/deltaUtils';
import { getBandForScore } from '@/lib/riskConfig';

type FactorDetailsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  factor: any;
  latest: any;
  factorDeltas?: Record<string, { 
    delta: number | null; 
    previousScore: number | null; 
    currentScore: number | null;
    currentDate: string;
    previousDate: string | null;
    basis: 'previous_day' | 'previous_available_row' | 'insufficient_history';
  }>;
};

// Format age in human-readable format
function formatAge(lastUpdated: string | undefined): string {
  if (!lastUpdated) return 'Unknown';
  
  const now = new Date();
  const updated = new Date(lastUpdated);
  const ageMs = now.getTime() - updated.getTime();
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMinutes / 60);
  const ageDays = Math.floor(ageHours / 24);
  
  if (ageDays > 0) return `${ageDays}d ago`;
  if (ageHours > 0) return `${ageHours}h ago`;
  if (ageMinutes > 0) return `${ageMinutes}m ago`;
  return 'Just now';
}

// Copy to clipboard with fallback
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback: use textarea method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      document.body.removeChild(textarea);
      return false;
    }
  } catch (err) {
    return false;
  }
}

export default function FactorDetailsDrawer({ 
  isOpen, 
  onClose, 
  factor, 
  latest,
  factorDeltas = {}
}: FactorDetailsDrawerProps) {
  const [copyState, setCopyState] = useState<{ summary: 'idle' | 'success' | 'error'; json: 'idle' | 'success' | 'error' }>({
    summary: 'idle',
    json: 'idle'
  });
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Clear copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen || !factor) return null;

  const factorTTL = getFactorTTL(factor.key);
  const staleness = getFactorStaleness(factor.last_utc || factor.as_of_utc, factorTTL, factor.key);
  const subSignals = getFactorSubSignals(factor.key);
  const cadence = getFactorCadence(factor.key);
  const delta = factorDeltas[factor.key];
  const lastUpdated = factor.last_utc || factor.as_of_utc;
  const age = formatAge(lastUpdated);
  
  // Get risk band for the factor score
  const riskBand = factor.score !== null && !isNaN(factor.score) 
    ? getBandForScore(factor.score) 
    : null;

  // Determine if factor is stale or excluded
  const isStale = staleness.level === 'stale' || staleness.level === 'stale_beyond_ttl';
  const isExcluded = staleness.level === 'excluded' || factor.status === 'excluded';
  const isProblematic = isStale || isExcluded;

  // Copy summary handler
  const handleCopySummary = async () => {
    const deltaDisplay = delta ? formatDeltaDisplay(delta.delta) : '—';
    const provenance = delta ? formatDeltaProvenance(delta) : 'Δ unavailable';
    const statusText = isExcluded ? 'EXCLUDED' : isStale ? 'STALE' : 'LIVE';
    const reasonText = factor.reason ? ` · ${factor.reason}` : '';
    const bandText = riskBand ? ` (${riskBand.label})` : '';
    
    const summary = `${factor.label} — score ${factor.score !== null ? factor.score.toFixed(0) : 'N/A'}${bandText} · Δ ${deltaDisplay} (${provenance}) · status ${statusText}${reasonText}`;
    
    const success = await copyToClipboard(summary);
    setCopyState(prev => ({ ...prev, summary: success ? 'success' : 'error' }));
    
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopyState(prev => ({ ...prev, summary: 'idle' }));
    }, 1500);
  };

  // Copy JSON handler
  const handleCopyJSON = async () => {
    const jsonData: any = {
      key: factor.key,
      label: factor.label,
      pillar: factor.pillar,
      score: factor.score,
      weight_pct: factor.weight_pct,
      status: factor.status || (isExcluded ? 'excluded' : isStale ? 'stale' : 'fresh'),
      reason: factor.reason || null,
      last_updated_utc: lastUpdated || null,
      age: age,
      source: factor.source || null,
      cadence: {
        label: cadence.label,
        description: cadence.description,
        ttlHours: cadence.ttlHours
      },
      subSignals: subSignals.length > 0 ? subSignals : null,
      riskBand: riskBand ? {
        key: riskBand.key,
        label: riskBand.label,
        range: riskBand.range
      } : null
    };

    // Add delta metadata if available
    if (delta) {
      jsonData.delta = {
        delta: delta.delta,
        currentScore: delta.currentScore,
        previousScore: delta.previousScore,
        currentDate: delta.currentDate,
        previousDate: delta.previousDate,
        basis: delta.basis,
        provenance: formatDeltaProvenance(delta)
      };
    }

    const jsonString = JSON.stringify(jsonData, null, 2);
    const success = await copyToClipboard(jsonString);
    setCopyState(prev => ({ ...prev, json: success ? 'success' : 'error' }));
    
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopyState(prev => ({ ...prev, json: 'idle' }));
    }, 1500);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer - Desktop: slide from right, Mobile: bottom sheet */}
      <div 
        className={`
          fixed z-50 bg-white shadow-2xl
          lg:right-0 lg:top-0 lg:h-full lg:w-96 lg:rounded-l-lg
          bottom-0 left-0 right-0 max-h-[80vh] rounded-t-lg
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Prominent Status Banner - At the very top */}
        {isProblematic && (
          <div className={`px-4 py-3 border-b ${
            isExcluded 
              ? 'bg-red-50 border-red-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold mb-1 ${
                  isExcluded ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {isExcluded ? 'EXCLUDED' : 'STALE'}: {factor.reason || 'No reason provided'}
                </div>
                <div className="text-xs text-gray-600">
                  Last update: {age}
                  {lastUpdated && (
                    <span className="ml-2 text-gray-500">
                      ({formatFriendlyTimestamp(lastUpdated)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header with Copy Buttons */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="drawer-title" className="text-lg font-semibold text-gray-900 flex-1 min-w-0">
            {factor.label}
          </h2>
          <div className="flex items-center gap-2 ml-2">
            {/* Copy Summary Button */}
            <button
              onClick={handleCopySummary}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Copy summary"
              title="Copy summary"
            >
              {copyState.summary === 'success' ? (
                <span className="text-green-600">✓</span>
              ) : copyState.summary === 'error' ? (
                <span className="text-red-600">✗</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            
            {/* Copy JSON Button */}
            <button
              onClick={handleCopyJSON}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Copy JSON"
              title="Copy JSON"
            >
              {copyState.json === 'success' ? (
                <span className="text-green-600">✓</span>
              ) : copyState.json === 'error' ? (
                <span className="text-red-600">✗</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              )}
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status Indicator (for fresh factors) */}
          {!isProblematic && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-green-800">Live</span>
              {lastUpdated && (
                <span className="text-xs text-green-600 ml-auto">
                  Updated {age}
                </span>
              )}
            </div>
          )}

          {/* Score + Delta + Provenance Block (Always Visible) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Risk Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
                </div>
                {riskBand && (
                  <div className="text-xs text-gray-500 mt-1">
                    {riskBand.label}
                  </div>
                )}
              </div>
              {delta && (
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">24h Change</div>
                  <div className={`text-xl font-semibold ${getDeltaColorClass(delta.delta)}`}>
                    {formatDeltaDisplay(delta.delta)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDeltaProvenance(delta)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* What's Inside */}
          {subSignals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">What's inside</h3>
              <ul className="space-y-1">
                {subSignals.map((signal, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-600">
                    <span className="text-gray-400 mr-2">•</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cadence */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Cadence</h3>
            <div className="text-sm text-gray-600">
              <div>{cadence.label}</div>
              <div className="text-xs text-gray-500 mt-1">{cadence.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                TTL: {cadence.ttlHours < 24 ? `${cadence.ttlHours}h` : `${cadence.ttlHours / 24}d`}
              </div>
            </div>
          </div>

          {/* Sources / Provenance */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Sources</h3>
            <div className="space-y-2">
              {factor.source && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Data Source:</span> {factor.source}
                </div>
              )}
              {lastUpdated && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Last Updated:</span> {formatFriendlyTimestamp(lastUpdated)}
                </div>
              )}
              {factor.weight_pct && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Weight:</span> {factor.weight_pct}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
