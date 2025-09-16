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
    
    // Transform ETL format to API format expected by dashboard
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
        source: null,
        reason: "disabled"
      },
      factors: etlData.factors || [],
      band: etlData.band,
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