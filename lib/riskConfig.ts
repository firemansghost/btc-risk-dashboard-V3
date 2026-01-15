// lib/riskConfig.ts
// Barrel file: Re-exports client-safe items only
// DO NOT import server-only functions here

// Re-export all client-safe types and functions
export * from './riskConfig.client';

// Note: Server-only functions (getConfig, getConfigDigest, etc.) are NOT exported here
// Import them directly from './riskConfig.server' in server-side code
