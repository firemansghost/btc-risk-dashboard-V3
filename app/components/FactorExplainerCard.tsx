'use client';

import { useEffect, useState } from 'react';
import type { FactorContent } from '@/lib/methodology/factors';

interface FactorExplainerCardProps {
  factor: FactorContent;
  isEnabled?: boolean;
}

export default function FactorExplainerCard({ factor, isEnabled = true }: FactorExplainerCardProps) {
  const [pillarConfig, setPillarConfig] = useState<any>(null);

  useEffect(() => {
    // Fetch pillar config to get colors
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data?.ok && data.config?.pillars) {
          const pillar = data.config.pillars.find((p: any) => p.key === factor.pillar.toLowerCase());
          setPillarConfig(pillar);
        }
      })
      .catch(() => {});
  }, [factor.pillar]);

  const getPillarColor = (pillar: string) => {
    if (!pillarConfig) return 'bg-slate-100 text-slate-800 border-slate-200';
    
    switch (pillarConfig.color) {
      case 'green': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'blue': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'red': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getPillarColor(factor.pillar)}`}>
            {factor.pillar}
          </span>
          {!isEnabled && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 border-gray-200">
              Excluded
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{factor.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>

      {/* What we look at */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">What we look at:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          {factor.what.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-gray-400 mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Why it matters */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Why it matters:</h4>
        <p className="text-sm text-gray-600">{factor.why}</p>
      </div>

      {/* How it affects risk */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">How it affects risk:</h4>
        <p className="text-sm text-gray-600 font-mono">{factor.affects}</p>
      </div>

      {/* Update cadence */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Update cadence & staleness:</h4>
        <p className="text-sm text-gray-600">{factor.cadence}</p>
      </div>

      {/* Sources */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Primary sources:</h4>
        <div className="flex flex-wrap gap-2">
          {factor.sources.map((source, idx) => (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {source.label}
            </a>
          ))}
        </div>
      </div>

      {/* Caveats */}
      {factor.caveats && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Caveats:</h4>
          <p className="text-sm text-gray-600">{factor.caveats}</p>
        </div>
      )}
    </div>
  );
}
