import { NextResponse } from 'next/server';
import { readLatestArtifact } from '@/lib/latestArtifact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FactorDetail = {
  label?: string;
  value?: string;
  tooltip?: string;
};

type EtfFactor = {
  key?: string;
  label?: string;
  score?: number | null;
  weight_pct?: number;
  status?: string;
  reason?: string;
  last_utc?: string | null;
  details?: FactorDetail[];
  metrics?: Record<string, unknown>;
};

const METHOD_DESCRIPTION =
  'This page mirrors the aggregate ETF-flow diagnostics used by the current GhostGauge production factor. It is descriptive context, not a forecast, probability, trading signal, or independent validation of the upstream parser.';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function unavailable(status: number, message: string) {
  return NextResponse.json(
    { error: 'ETF flow context unavailable', message },
    { status, headers: NO_CACHE_HEADERS }
  );
}

export async function GET() {
  try {
    const { data } = await readLatestArtifact();
    const factors = Array.isArray(data.factors) ? data.factors : [];
    const etf = factors.find((factor) => factor?.key === 'etf_flows') as EtfFactor | undefined;

    if (!etf) {
      return unavailable(404, 'ETF factor not found in the production snapshot.');
    }

    return NextResponse.json(
      {
        snapshotDate: data.snapshot_date ?? null,
        snapshotAsOfUtc: data.as_of_utc ?? null,
        factor: {
          label: etf.label ?? 'ETF Flows',
          score: typeof etf.score === 'number' ? etf.score : null,
          weightPct: typeof etf.weight_pct === 'number' ? etf.weight_pct : null,
          status: etf.status ?? null,
          reason: etf.reason ?? null,
          sourceAsOfUtc: etf.last_utc ?? null,
          details: Array.isArray(etf.details) ? etf.details : [],
          metrics: etf.metrics && typeof etf.metrics === 'object' ? etf.metrics : {},
        },
        methodology: {
          type: 'production_factor_context',
          forwardLooking: false,
          description: METHOD_DESCRIPTION,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('ETF Flow Context API Error:', error);
    return unavailable(500, 'Production snapshot could not be read.');
  }
}
