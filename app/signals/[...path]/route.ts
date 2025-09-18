// app/signals/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/');
    const fullPath = path.join(process.cwd(), 'public', 'signals', filePath);
    
    // Security check - ensure file is within signals directory
    if (!fullPath.startsWith(path.join(process.cwd(), 'public', 'signals'))) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    // Check if file exists and read it
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.csv' ? 'text/csv' : 'text/plain';
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving signals file:', error);
    return new NextResponse('Not Found', { status: 404 });
  }
}
