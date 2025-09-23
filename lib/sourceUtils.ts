/**
 * Source formatting utilities for consistent microcopy across KPI cards
 */

import { formatFriendlyTimestamp } from './dateUtils';

/**
 * Format consistent "Source: Provider · As of: Timestamp" microcopy
 * @param source - Source name/provider
 * @param timestamp - Date object, ISO string, or timestamp
 * @returns Formatted string like "Source: Coinbase (daily close) · As of: Sep 22, 2025 · 11:20 UTC"
 */
export function formatSourceTimestamp(source: string, timestamp: Date | string | number): string {
  const formattedTime = formatFriendlyTimestamp(timestamp);
  return `Source: ${source} · As of: ${formattedTime}`;
}

/**
 * Get standardized source names for different data providers
 * @param provenance - Provenance data or source info
 * @returns Standardized source name
 */
export function getStandardizedSourceName(provenance: any): string {
  if (!provenance) return 'Unknown';
  
  // Handle array of provenance sources
  if (Array.isArray(provenance)) {
    const activeSource = provenance.find(p => p.ok) || provenance[0];
    if (!activeSource) return 'Unknown';
    
    // Map source names to standardized versions
    const sourceName = activeSource.name || 'Unknown';
    
    if (sourceName.toLowerCase().includes('coinbase')) return 'Coinbase (daily close)';
    if (sourceName.toLowerCase().includes('coingecko')) return 'CoinGecko';
    if (sourceName.toLowerCase().includes('alpha')) return 'Alpha Vantage';
    if (sourceName.toLowerCase().includes('yahoo')) return 'Yahoo Finance';
    if (sourceName.toLowerCase().includes('stooq')) return 'Stooq (fallback)';
    if (sourceName.toLowerCase().includes('btc daily close')) return 'BTC daily close (Coinbase)';
    
    return sourceName;
  }
  
  // Handle single source object
  if (typeof provenance === 'object' && provenance.name) {
    const sourceName = provenance.name;
    
    if (sourceName.toLowerCase().includes('coinbase')) return 'Coinbase (daily close)';
    if (sourceName.toLowerCase().includes('coingecko')) return 'CoinGecko';
    if (sourceName.toLowerCase().includes('alpha')) return 'Alpha Vantage';
    if (sourceName.toLowerCase().includes('yahoo')) return 'Yahoo Finance';
    if (sourceName.toLowerCase().includes('stooq')) return 'Stooq (fallback)';
    
    return sourceName;
  }
  
  // Handle string source
  if (typeof provenance === 'string') {
    if (provenance.toLowerCase().includes('coinbase')) return 'Coinbase (daily close)';
    if (provenance.toLowerCase().includes('coingecko')) return 'CoinGecko';
    if (provenance.toLowerCase().includes('alpha')) return 'Alpha Vantage';
    if (provenance.toLowerCase().includes('yahoo')) return 'Yahoo Finance';
    if (provenance.toLowerCase().includes('stooq')) return 'Stooq (fallback)';
    
    return provenance;
  }
  
  return 'Unknown';
}
