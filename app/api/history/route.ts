// app/api/history/route.ts
import { NextResponse } from 'next/server';
import { readAllHistory } from '@/lib/history';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = (url.searchParams.get('range') ?? '90d') as '30d'|'90d'|'180d'|'1y';
  const days = range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365;
  const all = await readAllHistory();
  const recent = all.slice(-days);
  return NextResponse.json({ ok: true, range, points: recent });
}
