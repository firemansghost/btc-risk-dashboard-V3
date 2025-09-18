// lib/useArtifacts.ts
import useSWR, { mutate as globalMutate } from 'swr';
import { fetchArtifact } from './artifactFetch';
import type { LatestSnapshot } from './types';

type Status = {
  updated_at: string;
  sources: Array<{
    name: string;
    ok: boolean;
    ms?: number;
    url?: string;
    fallback?: boolean;
    cache_used?: boolean;
    fallback_used?: boolean;
  }>;
  factors_computed: number;
  factors_successful: number;
  etf_schema_hash?: string;
  etf_schema_last_check?: string;
  gold_cross_rates?: {
    status: string;
    source: string;
    fallback_used?: boolean;
    latency_ms?: number;
  };
  satoshis_per_dollar?: {
    status: string;
    source: string;
    derived?: boolean;
  };
};

type ArtifactData = {
  latest: LatestSnapshot | null;
  status: Status | null;
  version: number;
  fetchedAt: string;
};

const fetcher = async ([_, version]: [string, number]): Promise<ArtifactData> => {
  const [latestRes, statusRes] = await Promise.all([
    fetchArtifact('/data/latest.json', version),
    fetchArtifact('/data/status.json', version)
  ]);

  if (!latestRes.ok || !statusRes.ok) {
    throw new Error(`Failed to fetch artifacts: latest=${latestRes.status}, status=${statusRes.status}`);
  }

  const [latest, status] = await Promise.all([
    latestRes.json(),
    statusRes.json()
  ]);

  return {
    latest,
    status,
    version,
    fetchedAt: new Date().toISOString()
  };
};

export function useArtifacts() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(['artifacts', 0], fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 0, // Disable deduplication for immediate refreshes
  });

  async function refresh(): Promise<boolean> {
    const version = Date.now();
    
    try {
      // Cancel any in-flight revalidation and force a new one with fresh version
      await mutate(() => fetcher(['artifacts', version]), { 
        revalidate: false, 
        optimisticData: data 
      });
      
      // Also update any components using individual CSVs by busting SWR cache keys
      globalMutate(
        (key: any) => Array.isArray(key) && key[0]?.startsWith?.('csv:'), 
        undefined, 
        { revalidate: true }
      );
      
      return true;
    } catch (error) {
      console.error('Refresh failed:', error);
      return false;
    }
  }

  return { 
    data, 
    error, 
    isLoading, 
    isValidating,
    refresh,
    isRefreshing: Boolean(isLoading && data) // Show loading state when we have data but are refreshing
  };
}
