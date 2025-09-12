// app/components/SystemStatusCard.tsx
'use client';

import { useState } from 'react';
import type { FactorSummary } from '@/lib/types';

interface SystemStatusCardProps {
  factors: FactorSummary[];
  provenance: any[];
}

export default function SystemStatusCard({ factors, provenance }: SystemStatusCardProps) {
  const [showProvenance, setShowProvenance] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'bg-green-100 text-green-800';
      case 'stale': return 'bg-yellow-100 text-yellow-800';
      case 'excluded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'fresh': return 'bg-green-500';
      case 'stale': return 'bg-yellow-500';
      case 'excluded': return 'bg-gray-500';
      default: return 'bg-red-500';
    }
  };

  const sources = factors.map(factor => ({
    name: factor.label,
    as_of: factor.last_utc,
    status: factor.status,
    note: factor.reason,
  }));

  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">System Status</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProvenance(!showProvenance)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showProvenance ? 'Hide' : 'Show'} Provenance
          </button>
          <button
            onClick={() => window.open('/api/data/latest?ts=' + Date.now(), '_blank')}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            View Raw
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map((source, index) => (
          <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
            <div className={`w-2 h-2 rounded-full ${getStatusDot(source.status)}`}></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{source.name}</div>
              <div className="text-xs text-gray-500">
                {source.as_of ? new Date(source.as_of).toLocaleString() : 'No data'}
              </div>
              {source.note && (
                <div className="text-xs text-gray-400 truncate">{source.note}</div>
              )}
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(source.status)}`}>
              {source.status}
            </span>
          </div>
        ))}
      </div>
      
      {showProvenance && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Data Provenance</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {provenance.map((prov, index) => (
              <div key={index} className="text-xs text-gray-600">
                <div className="font-medium">{prov.url || 'Unknown source'}</div>
                <div className="text-gray-500">
                  Status: {prov.status || 'Unknown'} | 
                  Time: {prov.ms ? `${prov.ms}ms` : 'Unknown'} |
                  {prov.note && ` Note: ${prov.note}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
