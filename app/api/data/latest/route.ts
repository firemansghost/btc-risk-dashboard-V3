// app/api/data/latest/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Read from public/data/latest.json (where ETL writes)
    const filePath = path.join(process.cwd(), 'public', 'data', 'latest.json');
    const content = await fs.readFile(filePath, 'utf8');
    const etlData = JSON.parse(content);
    
    // Transform ETL format to full API format expected by dashboard
    const apiData = {
      ok: true,
      as_of_utc: etlData.updated_at,
      composite_raw: etlData.composite,
      composite_score: etlData.composite,
      cycle_adjustment: {
        adj_pts: etlData.adjustments?.cycle_nudge || 0,
        residual_z: null,
        last_utc: null,
        source: null,
        reason: "disabled"
      },
      spike_adjustment: {
        adj_pts: etlData.adjustments?.spike_nudge || 0,
        r_1d: null,
        sigma: null,
        z: null,
        ref_close: null,
        spot: etlData.price_usd,
        last_utc: etlData.updated_at,
        source: "ETL pipeline",
        reason: "disabled"
      },
      band: {
        key: etlData.band?.name?.toLowerCase().replace(/\s+/g, '_') || 'hold_neutral',
        label: etlData.band?.name || 'Hold/Neutral',
        range: [etlData.band?.lo || 35, etlData.band?.hi || 55],
        color: 'blue',
        recommendation: 'Maintain positions, selective buying'
      },
      health: 'green',
      factors: (etlData.factors || []).map((factor: any) => ({
        key: factor.key,
        label: factor.label,
        pillar: factor.pillar,
        weight_pct: factor.weight,
        score: factor.score,
        status: factor.status,
        last_utc: etlData.updated_at,
        source: factor.reason === 'success' ? 'ETL pipeline' : null,
        details: [
          {
            label: 'Score',
            value: factor.score?.toString() || 'N/A'
          },
          {
            label: 'Status',
            value: factor.status
          }
        ],
        reason: factor.reason
      })),
      btc: {
        spot_usd: etlData.price_usd,
        as_of_utc: etlData.updated_at,
        source: 'ETL pipeline'
      },
      provenance: [
        {
          url: 'ETL pipeline',
          ok: true,
          status: 200,
          ms: 0,
          note: 'Computed via ETL pipeline'
        }
      ],
      model_version: etlData.version || 'v3.1.0',
      transform: {},
      config_digest: etlData.config_digest || "etl"
    };
    
    return NextResponse.json(apiData);
  } catch (error) {
    return NextResponse.json({ 
      ok: false, 
      error: 'No snapshot yet. Run ETL pipeline first.' 
    }, { status: 404 });
  }
}