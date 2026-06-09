// app/api/data/latest-file/route.ts
// API route to serve latest.json with proper cache headers
import { NextResponse } from 'next/server';
import { readLatestArtifact } from '@/lib/latestArtifact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET() {
  try {
    const { data, filePath } = await readLatestArtifact();
    return NextResponse.json(data, {
      headers: {
        ...NO_CACHE_HEADERS,
        'X-File-Path': filePath,
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: `Error: ${errorMessage}`,
        details: String(error),
      },
      { status: 404, headers: NO_CACHE_HEADERS }
    );
  }
}
