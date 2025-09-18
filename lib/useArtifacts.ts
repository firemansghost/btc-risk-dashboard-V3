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
  latest: LatestSnapshot;
  status: Status;
  version: number;
  fetchedAt: string;
};

// Fallback data when artifacts are missing
const createFallbackData = (): ArtifactData => {
  const now = new Date().toISOString();
  return {
    latest: {
      ok: true,
      as_of_utc: now,
      composite_score: 50, // Neutral score
      composite_raw: 50,
      band: {
        key: 'neutral',
        label: 'Hold/Neutral',
        range: [40, 60],
        color: '#6B7280',
        recommendation: 'Hold/Neutral'
      },
      health: 'yellow',
      factors: [
        {
          key: 'trend_valuation',
          label: 'Trend Valuation',
          pillar: 'momentum',
          weight_pct: 20,
          score: 50,
          status: 'stale',
          last_utc: now,
          source: 'fallback',
          details: [],
          reason: 'Using fallback data - ETL artifacts not available'
        }
      ],
      btc: {
        spot_usd: 50000, // Fallback BTC price
        as_of_utc: now,
        source: 'fallback'
      },
      provenance: [],
      model_version: 'v3.1.0',
      transform: {},
      cycle_adjustment: {
        adj_pts: 0,
        residual_z: null,
        last_utc: null,
        source: null
      },
      spike_adjustment: {
        adj_pts: 0,
        r_1d: 0,
        sigma: 0,
        z: 0,
        ref_close: 0,
        spot: 0,
        last_utc: now,
        source: 'fallback'
      },
    },
    status: {
      updated_at: now,
      sources: [
        {
          name: 'Fallback Data',
          ok: true,
          url: undefined,
          ms: undefined
        }
      ],
      factors_computed: 1,
      factors_successful: 1,
      etf_schema_hash: 'fallback',
      etf_schema_last_check: now,
      gold_cross_rates: {
        status: 'fallback',
        source: 'fallback',
        fallback_used: true,
        latency_ms: 0
      },
      satoshis_per_dollar: {
        status: 'fallback',
        source: 'fallback',
        derived: true
      }
    },
    version: Date.now(),
    fetchedAt: now
  };
};

const fetcher = async ([_, version]: [string, number]): Promise<ArtifactData> => {
  try {
    const [latestRes, statusRes] = await Promise.all([
      fetchArtifact('/data/latest.json', version),
      fetchArtifact('/data/status.json', version)
    ]);

    // If both files are missing, return fallback data
    if (!latestRes.ok && !statusRes.ok) {
      console.warn('Both artifacts missing, using fallback data');
      return createFallbackData();
    }

    // If only one is missing, try to fetch the other
    let latest = null;
    let status = null;

    if (latestRes.ok) {
      latest = await latestRes.json();
    } else {
      console.warn('latest.json missing');
    }

    if (statusRes.ok) {
      status = await statusRes.json();
    } else {
      console.warn('status.json missing');
    }

    // If we have at least one artifact, return it; otherwise use fallback
    if (latest || status) {
      return {
        latest,
        status,
        version,
        fetchedAt: new Date().toISOString()
      };
    } else {
      console.warn('No artifacts available, using fallback data');
      return createFallbackData();
    }
  } catch (error) {
    console.error('Fetcher error:', error);
    // Return fallback data instead of throwing to prevent error state
    console.warn('Using fallback data due to error');
    return createFallbackData();
  }
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
