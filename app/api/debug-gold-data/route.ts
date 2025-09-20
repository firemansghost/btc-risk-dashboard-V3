import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Debug endpoint to check what gold data is available
export async function GET() {
  try {
    console.log('Debug Gold Data: Starting...');
    
    // Check static file
    let staticData = null;
    try {
      const staticPath = path.join(process.cwd(), 'public', 'extras', 'gold_cross.json');
      const staticContent = await fs.readFile(staticPath, 'utf8');
      staticData = JSON.parse(staticContent);
      console.log('Debug Gold Data: Static file loaded:', staticData);
    } catch (error) {
      console.log('Debug Gold Data: Static file error:', error);
    }
    
    // Check smart refresh API
    let smartRefreshData = null;
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const refreshResponse = await fetch(`${baseUrl}/api/smart-refresh-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (refreshResponse.ok) {
        smartRefreshData = await refreshResponse.json();
        console.log('Debug Gold Data: Smart refresh response:', smartRefreshData);
      } else {
        console.log('Debug Gold Data: Smart refresh failed:', refreshResponse.status);
      }
    } catch (error) {
      console.log('Debug Gold Data: Smart refresh error:', error);
    }
    
    return NextResponse.json({
      success: true,
      staticData: staticData,
      smartRefreshData: smartRefreshData,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        VERCEL_URL: process.env.VERCEL_URL
      }
    });
    
  } catch (error) {
    console.error('Debug Gold Data: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
