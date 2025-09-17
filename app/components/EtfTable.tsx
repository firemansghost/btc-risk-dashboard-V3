'use client';

import React from 'react';

interface EtfFlow {
  [key: string]: number;
}

interface EtfTableProps {
  individualEtfFlows?: EtfFlow;
  className?: string;
}

// ETF metadata for display
const ETF_METADATA = {
  ibit: { name: 'iShares Bitcoin Trust', symbol: 'IBIT', color: 'text-blue-600' },
  fbtc: { name: 'Fidelity Wise Origin Bitcoin Fund', symbol: 'FBTC', color: 'text-green-600' },
  bitb: { name: 'Bitwise Bitcoin ETF', symbol: 'BITB', color: 'text-purple-600' },
  arkb: { name: 'ARK 21Shares Bitcoin ETF', symbol: 'ARKB', color: 'text-orange-600' },
  btco: { name: 'Invesco Galaxy Bitcoin ETF', symbol: 'BTCO', color: 'text-indigo-600' },
  ezbc: { name: 'Franklin Bitcoin ETF', symbol: 'EZBC', color: 'text-pink-600' },
  brrr: { name: 'VanEck Bitcoin Trust', symbol: 'BRRR', color: 'text-red-600' },
  hodl: { name: 'VanEck Bitcoin Strategy ETF', symbol: 'HODL', color: 'text-yellow-600' },
  btcw: { name: 'WisdomTree Bitcoin Fund', symbol: 'BTCW', color: 'text-teal-600' },
  gbtc: { name: 'Grayscale Bitcoin Trust', symbol: 'GBTC', color: 'text-gray-600' },
  btc: { name: 'Other Bitcoin ETFs', symbol: 'BTC', color: 'text-slate-600' }
};

export default function EtfTable({ individualEtfFlows, className = '' }: EtfTableProps) {
  if (!individualEtfFlows || Object.keys(individualEtfFlows).length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Individual ETF Flows</h3>
        <p className="text-gray-500 text-sm">No individual ETF data available</p>
      </div>
    );
  }

  // Sort ETFs by flow amount (highest to lowest)
  const sortedEtfs = Object.entries(individualEtfFlows)
    .filter(([_, flow]) => flow !== 0) // Only show ETFs with non-zero flows
    .sort(([_, a], [__, b]) => Math.abs(b) - Math.abs(a));

  const formatFlow = (flow: number): string => {
    if (flow === 0) return '$0';
    if (Math.abs(flow) >= 1000) {
      return `$${(flow / 1000).toFixed(1)}K`;
    }
    return `$${flow.toFixed(1)}`;
  };

  const getFlowColor = (flow: number): string => {
    if (flow > 0) return 'text-green-600 bg-green-50';
    if (flow < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getFlowIcon = (flow: number): string => {
    if (flow > 0) return '↗';
    if (flow < 0) return '↘';
    return '→';
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Individual ETF Flows</h3>
        <span className="text-sm text-gray-500">Latest Daily</span>
      </div>
      
      {sortedEtfs.length === 0 ? (
        <p className="text-gray-500 text-sm">No significant ETF flows today</p>
      ) : (
        <div className="space-y-2">
          {sortedEtfs.map(([etfKey, flow]) => {
            const metadata = ETF_METADATA[etfKey as keyof typeof ETF_METADATA];
            if (!metadata) return null;

            return (
              <div
                key={etfKey}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${metadata.color.replace('text-', 'bg-')}`} />
                  <div>
                    <div className="font-medium text-gray-900">{metadata.symbol}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {metadata.name}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getFlowColor(flow)} px-2 py-1 rounded-full`}>
                    {getFlowIcon(flow)} {formatFlow(flow)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Total Active ETFs: {sortedEtfs.length}</span>
          <span>Data: Farside Investors</span>
        </div>
      </div>
    </div>
  );
}
