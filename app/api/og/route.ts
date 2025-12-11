import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// Band color mapping (same as lib/band-colors.ts)
function getBandColor(bandColor: string): string {
  switch (bandColor) {
    case 'green':  return '#059669'; // emerald-600
    case 'blue':   return '#0284c7'; // sky-600
    case 'yellow': return '#ca8a04'; // yellow-600
    case 'orange': return '#ea580c'; // orange-600
    case 'red':    return '#dc2626'; // rose-600
    default:       return '#374151'; // gray-700
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read the latest data
    const latestData = await fetch(`${request.nextUrl.origin}/api/data/latest-file?v=${Date.now()}`, {
      cache: 'no-store'
    });
    
    if (!latestData.ok) {
      throw new Error('Failed to fetch latest data');
    }
    
    const data = await latestData.json();
    
    if (!data.ok) {
      throw new Error('Latest data not available');
    }

    const score = data.composite_score;
    const band = data.band;
    const asOfUtc = data.as_of_utc;
    
    // Format the date
    const date = new Date(asOfUtc);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });

    // Get band color
    const bandColor = getBandColor(band.color);
    
    // Create SVG
    const svg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="630" fill="url(#bg)"/>
        
        <!-- GhostGauge Logo/Brand -->
        <text x="100" y="120" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="#f8fafc">
          GhostGauge
        </text>
        
        <!-- Bitcoin Risk Dashboard -->
        <text x="100" y="180" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="500" fill="#94a3b8">
          Bitcoin Risk Dashboard
        </text>
        
        <!-- G-Score -->
        <text x="100" y="280" font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="500" fill="#f8fafc">
          Bitcoin G-Score:
        </text>
        
        <!-- Score and Band (colored) -->
        <text x="100" y="340" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="700" fill="${bandColor}">
          ${score} — ${band.label}
        </text>
        
        <!-- As of timestamp -->
        <text x="100" y="420" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="400" fill="#94a3b8">
          As of ${formattedDate} ${formattedTime} UTC
        </text>
        
        <!-- Decorative elements -->
        <circle cx="1000" cy="150" r="80" fill="none" stroke="#334155" stroke-width="2" opacity="0.3"/>
        <circle cx="1050" cy="200" r="40" fill="none" stroke="#475569" stroke-width="1" opacity="0.2"/>
        <circle cx="950" cy="250" r="60" fill="none" stroke="#64748b" stroke-width="1" opacity="0.2"/>
      </svg>
    `;

    // Convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svg))
      .png({
        quality: 100,
        compressionLevel: 6
      })
      .toBuffer();

    return new NextResponse(pngBuffer as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes cache
      },
    });

  } catch (error) {
    console.error('Error generating OG image:', error);
    
    // Fallback to static image
    try {
      const fallbackImage = await fetch(`${request.nextUrl.origin}/og-default.png`);
      if (fallbackImage.ok) {
        const fallbackBuffer = await fallbackImage.arrayBuffer();
        return new NextResponse(fallbackBuffer as any, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=300, s-maxage=300',
          },
        });
      }
    } catch (fallbackError) {
      console.error('Fallback image also failed:', fallbackError);
    }
    
    // Ultimate fallback - return a simple error image
    const errorSvg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#0f172a"/>
        <text x="600" y="315" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="500" fill="#f8fafc" text-anchor="middle">
          GhostGauge — Bitcoin Risk Dashboard
        </text>
      </svg>
    `;
    
    const errorPng = await sharp(Buffer.from(errorSvg))
      .png()
      .toBuffer();
      
    return new NextResponse(errorPng as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=60', // 1 minute cache for errors
      },
    });
  }
}
