'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

console.log('QuickGlanceAltDelta: Component loaded');

interface QuickGlanceAltDeltaProps {
  className?: string;
}

export default function QuickGlanceAltDelta({ className = '' }: QuickGlanceAltDeltaProps) {
  console.log('QuickGlanceAltDelta: Component function called');
  
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
    
    console.log('QuickGlanceAltDelta: localStorage check', { visited, preset });
    
    if (visited === 'true') {
      setHasVisitedSandbox(true);
      setLastPreset(preset);
      console.log('QuickGlanceAltDelta: Setting state', { hasVisitedSandbox: true, lastPreset: preset });
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
      console.log('QuickGlanceAltDelta: fetchAltScore - no lastPreset');
      return;
    }
    
    console.log('QuickGlanceAltDelta: fetchAltScore - starting', { lastPreset });
    setLoading(true);
    try {
      const response = await fetch('/api/sandbox/factors?window=30');
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      console.log('QuickGlanceAltDelta: fetchAltScore - data received', { factorsCount: data.factors?.length });
      
      if (data.factors && data.factors.length > 0) {
        // Get the latest day's data
        const latestDay = data.factors[0];
        
        // Calculate alt score based on preset
        const altScore = calculateAltScore(latestDay, lastPreset);
        const officialScore = latestDay.official_g_score;
        
        console.log('QuickGlanceAltDelta: fetchAltScore - calculated scores', { altScore, officialScore });
        
        setAltScore(altScore);
        setOfficialScore(officialScore);
      }
    } catch (error) {
      console.error('Error fetching alt score:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAltScore = (dayData: any, preset: string): number => {
    // This is a simplified calculation - in a real implementation,
    // you'd want to use the same logic as the WeightsSandbox component
    const presetWeights = {
      'liq_35_25': { liquidity: 0.35, momentum: 0.25, term: 0.20, macro: 0.10, social: 0.10 },
      'mom_25_35': { liquidity: 0.25, momentum: 0.35, term: 0.20, macro: 0.10, social: 0.10 },
      'official_30_30': { liquidity: 0.30, momentum: 0.30, term: 0.20, macro: 0.10, social: 0.10 }
    };

    const weights = presetWeights[preset as keyof typeof presetWeights];
    if (!weights) return dayData.official_g_score;

    // Calculate weighted average using the preset weights
    let weightedSum = 0;
    let totalWeight = 0;

    // Map factor scores to pillars and apply weights
    const factorScores = {
      stablecoins: dayData.stablecoins_score || 0,
      etf_flows: dayData.etf_flows_score || 0,
      net_liquidity: dayData.net_liquidity_score || 0,
      trend_valuation: dayData.trend_valuation_score || 0,
      term_leverage: dayData.term_leverage_score || 0,
      macro_overlay: dayData.macro_overlay_score || 0,
      social_interest: dayData.social_interest_score || 0
    };

    // Liquidity pillar (stablecoins + etf_flows + net_liquidity)
    const liquidityScore = (
      (factorScores.stablecoins * 0.18) +
      (factorScores.etf_flows * 0.077) +
      (factorScores.net_liquidity * 0.043)
    ) / 0.30; // Normalize to 0-100

    // Momentum pillar (trend_valuation)
    const momentumScore = factorScores.trend_valuation;

    // Other pillars
    const termScore = factorScores.term_leverage;
    const macroScore = factorScores.macro_overlay;
    const socialScore = factorScores.social_interest;

    // Calculate weighted average
    weightedSum = (
      liquidityScore * weights.liquidity +
      momentumScore * weights.momentum +
      termScore * weights.term +
      macroScore * weights.macro +
      socialScore * weights.social
    );
    totalWeight = weights.liquidity + weights.momentum + weights.term + weights.macro + weights.social;

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : dayData.official_g_score;
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
    const getBand = (score: number) => {
      if (score <= 14) return 'Aggressive Buying';
      if (score <= 34) return 'Regular DCA Buying';
      if (score <= 49) return 'Moderate Buying';
      if (score <= 64) return 'Hold & Wait';
      if (score <= 79) return 'Reduce Risk';
      return 'High Risk';
    };

    const altBand = getBand(altScore);
    const officialBand = getBand(officialScore);

    if (altBand === officialBand) return 'same band';
    
    const bandOrder = ['Aggressive Buying', 'Regular DCA Buying', 'Moderate Buying', 'Hold & Wait', 'Reduce Risk', 'High Risk'];
    const altIndex = bandOrder.indexOf(altBand);
    const officialIndex = bandOrder.indexOf(officialBand);
    
    if (altIndex > officialIndex) return '↑ one band';
    if (altIndex < officialIndex) return '↓ one band';
    return 'same band';
  };

  const handleClick = () => {
    router.push('/lab/weights');
  };

  // Don't show if user hasn't visited sandbox or if we don't have scores yet
  console.log('QuickGlanceAltDelta: Render check', { hasVisitedSandbox, lastPreset, altScore, officialScore });
  
  if (!hasVisitedSandbox || !altScore || !officialScore) {
    console.log('QuickGlanceAltDelta: Not showing - missing data');
    return null;
  }

  const delta = altScore - officialScore;
  const deltaText = delta > 0 ? `+${delta}` : delta.toString();
  const bandComparison = getBandComparison(altScore, officialScore);

  // Don't show if it's the official preset and delta is 0
  if (lastPreset === 'official_30_30' && delta === 0) {
    return null;
  }

  return (
    <div className={`mb-3 ${className}`}>
      <button
        onClick={handleClick}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
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
