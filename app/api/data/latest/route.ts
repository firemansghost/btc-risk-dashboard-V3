// app/api/data/latest/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Read from public/data/latest.json (where ETL writes)
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'data', 'latest.json'),
      path.join(process.cwd(), '..', 'public', 'data', 'latest.json'),
      './public/data/latest.json',
      '../public/data/latest.json'
    ];
    
    let content = null;
    let filePath = null;
    
    for (const testPath of possiblePaths) {
      try {
        content = await fs.readFile(testPath, 'utf8');
        filePath = testPath;
        break;
      } catch (e) {
        // Try next path
      }
    }
    
    if (!content) {
      throw new Error('Could not find latest.json in any expected location');
    }
    
    const etlData = JSON.parse(content);
    
    // Transform ETL format to full API format expected by dashboard
    const apiData = {
      ok: true,
      as_of_utc: etlData.updated_at,
      composite_raw: etlData.composite,
      composite_score: etlData.composite,
      // Prefer rich objects if present; fall back to legacy nudges
      cycle_adjustment: etlData.cycle_adjustment ?? {
        adj_pts: etlData.adjustments?.cycle_nudge || 0,
        residual_z: null,
        last_utc: etlData.updated_at ?? null,
        source: 'ETL pipeline',
        reason: 'disabled'
      },
      spike_adjustment: etlData.spike_adjustment ?? {
        adj_pts: etlData.adjustments?.spike_nudge || 0,
        r_1d: 0,
        sigma: 0,
        z: 0,
        ref_close: etlData.price_usd,
        spot: etlData.price_usd,
        last_utc: etlData.updated_at,
        source: 'ETL pipeline',
        reason: 'disabled'
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
        details: factor.details || [
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
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      ok: false, 
      error: `Error: ${errorMessage}`,
      details: String(error)
    }, { status: 404 });
  }
}