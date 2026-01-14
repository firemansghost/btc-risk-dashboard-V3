'use client';

import { useEffect, useRef } from 'react';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';

type SystemHealthPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  factors: any[];
  onJumpToFactor: (factorKey: string) => void;
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

// Get severity level for sorting
function getSeverityLevel(status: string): number {
  if (status === 'excluded') return 0; // Highest priority
  if (status === 'stale' || status === 'stale_beyond_ttl') return 1;
  return 2; // fresh/success
}

export default function SystemHealthPanel({
  isOpen,
  onClose,
  factors,
  onJumpToFactor
}: SystemHealthPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const focusableElements = panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  // Sort factors by severity: excluded, stale, fresh
  const sortedFactors = [...factors].sort((a, b) => {
    const severityA = getSeverityLevel(a.status);
    const severityB = getSeverityLevel(b.status);
    if (severityA !== severityB) return severityA - severityB;
    // If same severity, sort by label
    return (a.label || a.key).localeCompare(b.label || b.key);
  });

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel - Desktop: slide from right, Mobile: bottom sheet */}
      <div 
        ref={panelRef}
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
        aria-labelledby="health-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="health-panel-title" className="text-lg font-semibold text-gray-900">
            System Health Details
          </h2>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Close health panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {sortedFactors.map((factor) => {
              const status = factor.status || 'unknown';
              const isExcluded = status === 'excluded';
              const isStale = status === 'stale' || status === 'stale_beyond_ttl';
              const isFresh = status === 'fresh' || status === 'success';
              
              const statusColor = isExcluded 
                ? 'bg-red-100 text-red-800 border-red-200' 
                : isStale 
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                : 'bg-green-100 text-green-800 border-green-200';

              const lastUpdated = factor.last_utc || factor.as_of_utc || factor.last_updated_utc;
              const age = formatAge(lastUpdated);

              return (
                <div
                  key={factor.key}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Factor Name + Pillar */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {factor.label || factor.key}
                        </h3>
                        {factor.pillar && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getPillarBadgeClasses(factor.pillar)}`}>
                            {getPillarLabel(factor.pillar)}
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColor}`}>
                          {isExcluded ? 'Excluded' : isStale ? 'Stale' : 'Fresh'}
                        </span>
                        {factor.reason && (
                          <span className="text-xs text-gray-600 truncate" title={factor.reason}>
                            {factor.reason.length > 40 ? factor.reason.substring(0, 40) + '...' : factor.reason}
                          </span>
                        )}
                      </div>

                      {/* Age + Last Updated */}
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Age: {age}</div>
                        {lastUpdated && (
                          <div>Last updated: {formatFriendlyTimestamp(lastUpdated)}</div>
                        )}
                      </div>
                    </div>

                    {/* Jump Button */}
                    <button
                      onClick={() => {
                        onJumpToFactor(factor.key);
                        onClose();
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex-shrink-0 min-h-[44px]"
                      aria-label={`Jump to ${factor.label || factor.key} factor card`}
                    >
                      Jump
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
