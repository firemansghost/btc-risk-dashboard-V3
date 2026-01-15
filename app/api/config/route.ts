// app/api/config/route.ts
// API endpoint to expose the effective risk configuration

import { NextResponse } from 'next/server';
import { getConfig, getConfigDigest } from '@/lib/riskConfig.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    const digest = getConfigDigest();
    
    return NextResponse.json({
      ok: true,
      config,
      digest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Config API error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}
