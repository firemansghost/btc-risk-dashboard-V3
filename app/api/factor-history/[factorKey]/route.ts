import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ factorKey: string }> }
) {
  try {
    const { factorKey } = await params;
    console.log('Factor key received:', factorKey);
    
    return NextResponse.json({ 
      message: 'Factor History API working',
      factorKey: factorKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in factor history API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}