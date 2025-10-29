import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json({ 
      message: 'Dynamic route working',
      id: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get params' }, { status: 500 });
  }
}
