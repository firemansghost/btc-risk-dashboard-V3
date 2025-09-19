// lib/format.ts
// Common formatting utilities

export const fmtUsd0 = (n: number): string =>
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(n);

export const fmtUsd2 = (n: number): string =>
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 2 
  }).format(n);

export const fmtNumber = (n: number, decimals: number = 0): string =>
  new Intl.NumberFormat('en-US', { 
    maximumFractionDigits: decimals 
  }).format(n);

export const fmtCompact = (n: number): string =>
  new Intl.NumberFormat('en-US', { 
    notation: 'compact', 
    maximumFractionDigits: 1 
  }).format(n);
