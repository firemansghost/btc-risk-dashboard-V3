// lib/pillar-colors.ts
// Utility functions for pillar color management

import type { PillarKey } from './types';

export interface PillarColorConfig {
  background: string;
  text: string;
  border: string;
  badge: string; // For badge/chip styling
}

export const PILLAR_COLORS: Record<PillarKey, PillarColorConfig> = {
  liquidity: {
    background: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800 border border-blue-200'
  },
  momentum: {
    background: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800 border border-green-200'
  },
  leverage: {
    background: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-800 border border-orange-200'
  },
  social: {
    background: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border border-purple-200'
  },
  macro: {
    background: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-800 border border-gray-200'
  }
};

/**
 * Get pillar color configuration for a given pillar key
 */
export function getPillarColors(pillar: PillarKey): PillarColorConfig {
  return PILLAR_COLORS[pillar] || PILLAR_COLORS.macro; // Default to macro if unknown
}

/**
 * Get pillar badge classes for styling
 */
export function getPillarBadgeClasses(pillar: PillarKey): string {
  return getPillarColors(pillar).badge;
}

/**
 * Get pillar label for display
 */
export function getPillarLabel(pillar: PillarKey): string {
  const labels: Record<PillarKey, string> = {
    liquidity: 'Liquidity',
    momentum: 'Momentum', 
    leverage: 'Leverage',
    social: 'Social',
    macro: 'Macro'
  };
  return labels[pillar] || 'Unknown';
}
