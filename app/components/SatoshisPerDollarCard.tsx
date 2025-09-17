'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SatsData {
  updated_at: string;
  date: string;
  btc_close_usd: number;
  sats_per_usd: number;
  usd_per_sat: number;
  provenance: Array<{
    name: string;
    ok: boolean;
    url: string;
    ms: number | null;
  }>;
}

interface SatoshisPerDollarCardProps {
  className?: string;
}

export default function SatoshisPerDollarCard({ className = '' }: SatoshisPerDollarCardProps) {
  const [satsData, setSatsData] = useState<SatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSatsData() {
      try {
        // Force fresh read with cache: 'no-store' to prevent stale data
        const response = await fetch('/extras/sats.json', { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setSatsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load satoshis data');
      } finally {
        setLoading(false);
      }
    }

    fetchSatsData();
  }, []);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error || !satsData) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-sm text-gray-500 mb-2">Satoshis per Dollar</div>
        <div className="text-sm text-red-500">Data unavailable</div>
      </div>
    );
  }

  const sourceName = satsData.provenance[0]?.name || 'Unknown';

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Satoshis per Dollar</h3>
        <div className="group relative">
          <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            Based on daily close (UTC)
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">1 USD =</span>
          <span 
            className="text-lg font-semibold text-gray-900"
            title={`Exact: ${satsData.sats_per_usd.toFixed(8)} sats`}
          >
            {Math.round(satsData.sats_per_usd).toLocaleString()} sats
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">1 sat =</span>
          <span 
            className="text-lg font-semibold text-gray-900"
            title={`Exact: $${satsData.usd_per_sat.toFixed(8)}`}
          >
            ${satsData.usd_per_sat.toFixed(8)}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>As of {new Date(satsData.updated_at).toLocaleDateString()}</span>
          <Link 
            href="/sats" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View details →
          </Link>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Source: {sourceName}
      </div>
    </div>
  );
}
