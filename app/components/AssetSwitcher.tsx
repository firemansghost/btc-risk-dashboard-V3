'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analytics } from '@/lib/analytics';

interface AssetSwitcherProps {
  className?: string;
}

export default function AssetSwitcher({ className = '' }: AssetSwitcherProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const assets = [
    { key: 'btc', href: '/', label: 'BTC', icon: '₿' },
    { key: 'spx', href: '/spx', label: 'SPX', icon: '📈' },
    { key: 'tsla', href: '/tsla', label: 'TSLA', icon: '⚡' },
    { key: 'gold', href: '/gold', label: 'GOLD', icon: '🥇' },
  ];

  const getCurrentAsset = () => {
    if (pathname === '/' || pathname === '/bitcoin') return 'btc';
    if (pathname === '/spx') return 'spx';
    if (pathname === '/tsla') return 'tsla';
    if (pathname === '/gold') return 'gold';
    return 'btc';
  };

  if (!mounted) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="glass-sm rounded-lg p-1 flex space-x-1">
          {assets.map((asset) => (
            <div
              key={asset.key}
              className="px-3 py-2 text-sm font-medium rounded-md text-gray-600"
            >
              {asset.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentAsset = getCurrentAsset();

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="glass-sm rounded-lg p-1 flex space-x-1" role="tablist" aria-label="Asset selection">
        {assets.map((asset) => (
          <Link
            key={asset.key}
            href={asset.href}
            role="tab"
            aria-selected={currentAsset === asset.key}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 min-w-0 flex-shrink-0 ${
              currentAsset === asset.key
                ? 'glass-blue text-blue-900 border border-blue-300/50'
                : 'text-gray-600 hover:text-gray-900 hover:glass-hover'
            }`}
            onClick={() => {
              if (currentAsset !== asset.key) {
                analytics.assetsTabClicked(asset.key.toUpperCase());
              }
            }}
          >
            <span className="mr-1">{asset.icon}</span>
            {asset.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
