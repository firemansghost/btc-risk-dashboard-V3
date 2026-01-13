'use client';

import { useEffect } from 'react';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';
import { getFactorStaleness, getFactorSubSignals, getFactorTTL, getFactorCadence } from '@/lib/factorUtils';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';

type FactorDetailsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  factor: any;
  latest: any;
  factorDeltas?: Record<string, { delta: number; previousScore: number; currentScore: number }>;
};

export default function FactorDetailsDrawer({ 
  isOpen, 
  onClose, 
  factor, 
  latest,
  factorDeltas = {}
}: FactorDetailsDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !factor) return null;

  const factorTTL = getFactorTTL(factor.key);
  const staleness = getFactorStaleness(factor.last_utc || factor.as_of_utc, factorTTL, factor.key);
  const subSignals = getFactorSubSignals(factor.key);
  const cadence = getFactorCadence(factor.key);
  const delta = factorDeltas[factor.key];

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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="drawer-title" className="text-lg font-semibold text-gray-900">
            {factor.label}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Factor Name + Pillar Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPillarBadgeClasses(factor.pillar)}`}>
              {getPillarLabel(factor.pillar)}
            </span>
          </div>

          {/* Score + 24h Delta */}
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm text-gray-600 mb-1">Risk Score</div>
              <div className="text-2xl font-bold text-gray-900">
                {factor.score !== null ? factor.score.toFixed(0) : 'N/A'}
              </div>
            </div>
            {delta && (
              <div>
                <div className="text-sm text-gray-600 mb-1">24h Change</div>
                <div className={`text-xl font-semibold ${
                  delta.delta > 0 ? 'text-red-600' : delta.delta < 0 ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {delta.delta > 0 ? '+' : ''}{delta.delta}
                </div>
              </div>
            )}
          </div>

          {/* Status + Reason (if stale/excluded) */}
          {(staleness.level === 'stale' || staleness.level === 'excluded' || factor.status === 'excluded') && (
            <div className={`p-3 rounded-lg border ${
              staleness.level === 'stale' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="text-sm font-medium text-gray-900 mb-1">
                Status: <span className={staleness.level === 'stale' ? 'text-yellow-700' : 'text-gray-700'}>
                  {staleness.level === 'stale' ? 'Stale' : 'Excluded'}
                </span>
              </div>
              {factor.reason && (
                <div className="text-sm text-gray-600">
                  Reason: {factor.reason}
                </div>
              )}
            </div>
          )}

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

          {/* Cadence Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Update Cadence</h3>
            <div className="text-sm text-gray-600">
              <div>{cadence.label}</div>
              <div className="text-xs text-gray-500 mt-1">{cadence.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                TTL: {cadence.ttlHours < 24 ? `${cadence.ttlHours}h` : `${cadence.ttlHours / 24}d`}
              </div>
            </div>
          </div>

          {/* Last Updated */}
          {factor.last_utc && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Last Updated</h3>
              <div className="text-sm text-gray-600">
                {formatFriendlyTimestamp(factor.last_utc)}
              </div>
            </div>
          )}

          {/* Sources/Provenance */}
          {factor.source && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Data Source</h3>
              <div className="text-sm text-gray-600">{factor.source}</div>
            </div>
          )}

          {/* Weight */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Weight</h3>
            <div className="text-sm text-gray-600">
              {factor.weight_pct ? `${factor.weight_pct}%` : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
