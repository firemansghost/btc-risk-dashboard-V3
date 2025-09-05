// app/api/data/latest/route.ts
import { NextResponse } from 'next/server';
import { readJson } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const latest = await readJson('latest.json');
  if (!latest) {
    return NextResponse.json({ ok: false, error: 'No snapshot yet. POST /api/refresh first.' }, { status: 404 });
  }
  return NextResponse.json(latest);
}