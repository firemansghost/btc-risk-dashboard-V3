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
    const latest = JSON.parse(content);
    
    return NextResponse.json(latest);
  } catch (error) {
    return NextResponse.json({ 
      ok: false, 
      error: 'No snapshot yet. Run ETL pipeline first.' 
    }, { status: 404 });
  }
}