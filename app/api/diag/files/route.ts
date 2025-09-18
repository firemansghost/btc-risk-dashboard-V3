// app/api/diag/files/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function GET() {
  try {
    const cwd = process.cwd();
    const publicDir = path.join(cwd, 'public');
    
    const result: any = {
      cwd,
      public: {}
    };
    
    // Check each artifact directory
    const dirs = ['data', 'signals', 'extras', 'alerts'];
    
    for (const dir of dirs) {
      const dirPath = path.join(publicDir, dir);
      try {
        const files = await fs.readdir(dirPath);
        const fileStats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          })
        );
        result.public[dir] = fileStats;
      } catch (error) {
        result.public[dir] = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    return new NextResponse(JSON.stringify(result, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new NextResponse(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      cwd: process.cwd()
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}
