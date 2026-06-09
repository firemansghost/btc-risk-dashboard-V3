'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/lib/analytics';
import { computeSandboxDayComposite, type ModelPresetKey } from '@/lib/experimentalModel';
import { getBandForScore } from '@/lib/riskConfig.client';

interface QuickGlanceAltDeltaProps {
  className?: string;
}

export default function QuickGlanceAltDelta({ className = '' }: QuickGlanceAltDeltaProps) {
  
  const [hasVisitedSandbox, setHasVisitedSandbox] = useState(false);
  const [lastPreset, setLastPreset] = useState<string | null>(null);
  const [altScore, setAltScore] = useState<number | null>(null);
  const [officialScore, setOfficialScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user has visited the sandbox
    const visited = localStorage.getItem('ghostgauge-sandbox-visited');
    const preset = localStorage.getItem('ghostgauge-sandbox-last-preset');
    
    if (visited === 'true') {
      setHasVisitedSandbox(true);
      setLastPreset(preset);
    }
  }, []);

  useEffect(() => {
    if (hasVisitedSandbox && lastPreset) {
      // Fetch the latest data to calculate alt score
      fetchAltScore();
    }
  }, [hasVisitedSandbox, lastPreset]);

  const fetchAltScore = async () => {
    if (!lastPreset) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/sandbox/factors?window=30');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();

      const rows = Array.isArray(result.data) ? result.data : [];
      const configFactors = Array.isArray(result.config?.factors) ? result.config.factors : [];
      if (rows.length > 0 && configFactors.length > 0) {
        const latestDay = rows[rows.length - 1];

        const alt = computeSandboxDayComposite(
          {
            factor_scores: latestDay.factor_scores,
            factor_statuses: latestDay.factor_statuses,
            cycle_adj: latestDay.cycle_adj,
            spike_adj: latestDay.spike_adj,
          },
          configFactors,
          lastPreset as ModelPresetKey
        );
        const official = typeof latestDay.official_composite === 'number' ? Math.round(latestDay.official_composite) : null;

        if (official !== null) {
          setAltScore(alt);
          setOfficialScore(official);
        }
      }
    } catch (error) {
      console.error('QuickGlanceAltDelta error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPresetLabel = (preset: string): string => {
    const labels = {
      'liq_35_25': '35/25',
      'mom_25_35': '25/35',
      'official_30_30': '30/30'
    };
    return labels[preset as keyof typeof labels] || '30/30';
  };

  const getBandComparison = (altScore: number, officialScore: number): string => {
    const altBand = getBandForScore(altScore).label;
    const officialBand = getBandForScore(officialScore).label;

    if (altBand === officialBand) return 'same band';
    
    const bandOrder = ['Aggressive Buying', 'Regular DCA Buying', 'Moderate Buying', 'Hold & Wait', 'Reduce Risk', 'High Risk'];
    const altIndex = bandOrder.indexOf(altBand);
    const officialIndex = bandOrder.indexOf(officialBand);
    
    if (altIndex > officialIndex) return '↑ one band';
    if (altIndex < officialIndex) return '↓ one band';
    return 'same band';
  };

  const handleClick = () => {
    const delta = (altScore ?? 0) - (officialScore ?? 0);
    analytics.quickGlanceClicked(lastPreset, delta);
    router.push('/lab/weights');
  };

  // Don't show if user hasn't visited sandbox or if we don't have scores yet
  if (!hasVisitedSandbox || !altScore || !officialScore) {
    return null;
  }

  const delta = altScore - officialScore;
  const deltaText = delta > 0 ? `+${delta}` : delta.toString();
  const bandComparison = getBandComparison(altScore, officialScore);

  // Don't show if it's the official preset and delta is 0
  if (lastPreset === 'official_30_30' && delta === 0) return null;

  return (
    <div className={`mb-3 ${className}`}>
      <button
        onClick={handleClick}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        aria-label={`Open weights sandbox. Alt preset ${getPresetLabel(lastPreset || 'official_30_30')}: ${deltaText} points, ${bandComparison}`}
        title="Compare different weight mixes"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Alt ({getPresetLabel(lastPreset || 'official_30_30')}): {deltaText} pts, {bandComparison}
      </button>
    </div>
  );
}
