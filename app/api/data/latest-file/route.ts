// app/api/data/latest-file/route.ts
// API route to serve latest.json with proper cache headers
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Read from public/data/latest.json (where ETL writes)
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
    
    const latestData = JSON.parse(content);
    
    // Fix: Recompute band if it doesn't match the score (handles stale ETL data)
    if (latestData.composite_score !== null && latestData.composite_score !== undefined) {
      const score = latestData.composite_score;
      const currentBand = latestData.band;
      
      // Check if band matches score using SSOT ranges
      if (currentBand && currentBand.range) {
        const bandMatches = score >= currentBand.range[0] && score <= currentBand.range[1];
        if (!bandMatches) {
          // Band doesn't match score - recompute using SSOT
          const { getBandForScore } = await import('@/lib/riskConfig');
          const correctBand = getBandForScore(score);
          console.log(`[API] Fixed band mismatch: score ${score} had band "${currentBand.label}" (range [${currentBand.range[0]}, ${currentBand.range[1]}]), corrected to "${correctBand.label}" (range [${correctBand.range[0]}, ${correctBand.range[1]}])`);
          latestData.band = correctBand;
        }
      }
    }
    
    // Return with no-cache headers to prevent edge/browser caching
    return NextResponse.json(latestData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-File-Path': filePath || 'unknown'
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: `Error: ${errorMessage}`,
      details: String(error)
    }, { 
      status: 404,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
}

