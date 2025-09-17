'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface GoldCrossData {
  updated_at: string;
  date: string;
  btc_close_usd: number;
  xau_close_usd: number;
  btc_per_oz: number;
  oz_per_btc: number;
  provenance: Array<{
    name: string;
    ok: boolean;
    url: string;
    ms: number;
    fallback?: boolean;
  }>;
}

interface BtcGoldCardProps {
  className?: string;
}

export default function BtcGoldCard({ className = '' }: BtcGoldCardProps) {
  const [goldData, setGoldData] = useState<GoldCrossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGoldData() {
      try {
        // Force fresh read with cache: 'no-store' to prevent stale data
        const response = await fetch('/extras/gold_cross.json', { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setGoldData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load gold data');
      } finally {
        setLoading(false);
      }
    }

    fetchGoldData();
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

  if (error || !goldData) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-sm text-gray-500 mb-2">BTC⇄Gold</div>
        <div className="text-sm text-red-500">Data unavailable</div>
      </div>
    );
  }

  const isFallback = goldData.provenance.some(p => p.fallback);
  const sourceName = goldData.provenance[0]?.name || 'Unknown';

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">BTC⇄Gold</h3>
        {isFallback && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            fallback
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">1 BTC =</span>
          <span 
            className="text-lg font-semibold text-gray-900"
            title={`Exact: ${goldData.btc_per_oz.toFixed(6)} oz`}
          >
            {goldData.btc_per_oz.toFixed(2)} oz
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">1 oz =</span>
          <span 
            className="text-lg font-semibold text-gray-900"
            title={`Exact: ${goldData.oz_per_btc.toFixed(6)} BTC`}
          >
            {goldData.oz_per_btc.toFixed(4)} BTC
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>As of {new Date(goldData.updated_at).toLocaleDateString()}</span>
          <Link 
            href="/xau" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View details →
          </Link>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Source: {sourceName}
        {isFallback && (
          <span className="ml-1 text-yellow-600">• Using fallback source</span>
        )}
      </div>
    </div>
  );
}
