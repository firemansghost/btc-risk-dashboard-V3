import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Test factor API working',
    timestamp: new Date().toISOString()
  });
}
