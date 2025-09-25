'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import { formatSourceTimestamp, getStandardizedSourceName } from '@/lib/sourceUtils';

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
        // Try to get fresh gold price data first
        console.log('BtcGoldCard: Attempting to fetch fresh gold price data...');
        
        try {
          const refreshResponse = await fetch('/api/smart-refresh-simple', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            console.log('BtcGoldCard: Smart refresh response:', refreshData);
            
            if (refreshData.success && refreshData.data.gold_price) {
              console.log('BtcGoldCard: Using fresh gold price data');
              // Use fresh gold price data
              const freshGoldPrice = refreshData.data.gold_price;
              const freshBtcPrice = refreshData.data.btc_price;
              const btcPerOz = freshBtcPrice / freshGoldPrice;
              const ozPerBtc = freshGoldPrice / freshBtcPrice;
              
              const freshGoldData = {
                updated_at: refreshData.data.updated_at,
                date: new Date().toISOString().split('T')[0],
                btc_close_usd: freshBtcPrice,
                xau_close_usd: freshGoldPrice,
                btc_per_oz: btcPerOz,
                oz_per_btc: ozPerBtc,
                provenance: refreshData.data.provenance || [{
                  name: 'Alpha Vantage',
                  ok: true,
                  url: 'https://www.alphavantage.co/',
                  ms: 0,
                  fallback: false
                }]
              };
              setGoldData(freshGoldData);
              setLoading(false);
              return;
            }
          }
        } catch (apiError) {
          console.warn('BtcGoldCard: Fresh gold price API failed, falling back to static file:', apiError);
        }
        
        // Fallback to static file if fresh data fails
        console.log('BtcGoldCard: Loading from static file...');
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

  // Listen for Bitcoin price updates and recalculate ratios
  useEffect(() => {
    async function handleBtcPriceUpdate(event: CustomEvent) {
      const { btc_price, updated_at } = event.detail;
      if (goldData && btc_price) {
        // Try to get fresh gold price data
        try {
          const refreshResponse = await fetch('/api/smart-refresh-simple', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.data.gold_price) {
              // Use fresh gold price
              const freshGoldPrice = refreshData.data.gold_price;
              const btcPerOz = btc_price / freshGoldPrice;
              const ozPerBtc = freshGoldPrice / btc_price;
              
              const updatedGoldData = {
                ...goldData,
                btc_close_usd: btc_price,
                xau_close_usd: freshGoldPrice,
                btc_per_oz: btcPerOz,
                oz_per_btc: ozPerBtc,
                updated_at: updated_at,
                provenance: [{
                  name: 'Alpha Vantage',
                  ok: true,
                  url: 'https://www.alphavantage.co/',
                  ms: 0,
                  fallback: false
                }]
              };
              setGoldData(updatedGoldData);
              console.log('BtcGoldCard: Updated with fresh gold price:', freshGoldPrice);
              return;
            }
          }
        } catch (error) {
          console.warn('BtcGoldCard: Failed to fetch fresh gold price, using existing:', error);
        }
        
        // Fallback to existing gold price with new Bitcoin price
        const updatedGoldData = {
          ...goldData,
          btc_close_usd: btc_price,
          btc_per_oz: btc_price / goldData.xau_close_usd,
          oz_per_btc: goldData.xau_close_usd / btc_price,
          updated_at: updated_at
        };
        setGoldData(updatedGoldData);
        console.log('BtcGoldCard: Updated with fresh Bitcoin price (existing gold price):', btc_price);
      }
    }

    window.addEventListener('btc-price-updated', handleBtcPriceUpdate as unknown as EventListener);
    return () => {
      window.removeEventListener('btc-price-updated', handleBtcPriceUpdate as unknown as EventListener);
    };
  }, [goldData]);

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
        <h3 className="text-sm font-medium text-gray-900">Bitcoin⇄Gold</h3>
        {isFallback && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            fallback
          </span>
        )}
      </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Gold Price</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${goldData.xau_close_usd.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">1 Bitcoin =</span>
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
                    title={`Exact: ${goldData.oz_per_btc.toFixed(6)} Bitcoin`}
                  >
                    {goldData.oz_per_btc.toFixed(4)} Bitcoin
                  </span>
                </div>
              </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatSourceTimestamp(getStandardizedSourceName(goldData.provenance), goldData.updated_at)}</span>
          <Link 
            href="/xau" 
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View details →
          </Link>
        </div>
      </div>

      {isFallback && (
        <div className="mt-2 text-xs text-yellow-600">
          • Using fallback source
        </div>
      )}
    </div>
  );
}
