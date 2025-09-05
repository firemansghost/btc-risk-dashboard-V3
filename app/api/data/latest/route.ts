// app/api/data/latest/route.ts
import { NextResponse } from 'next/server';
import { readJson } from '@/lib/storage';
import type { LatestSnapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const latest = await readJson<LatestSnapshot>('latest.json');
  if (!latest) return NextResponse.json({ ok: false, error: 'No data yet. POST /api/refresh first.' }, { status: 404 });
  return NextResponse.json(latest);
}
