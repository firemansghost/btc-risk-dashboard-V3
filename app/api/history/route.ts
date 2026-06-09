// app/api/history/route.ts
import { NextResponse } from 'next/server';
import { readFactorHistoryPoints, sliceHistoryByDays } from '@/lib/factorHistoryCsv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = (url.searchParams.get('range') ?? '90d') as '30d' | '90d' | '180d' | '1y';
  const days =
    range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365;

  try {
    const all = await readFactorHistoryPoints();
    const recent = sliceHistoryByDays(all, days);
    return NextResponse.json(
      { ok: true, range, points: recent },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message, points: [] },
      { status: 404 }
    );
  }
}
