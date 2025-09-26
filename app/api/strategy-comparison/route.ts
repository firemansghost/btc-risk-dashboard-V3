import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const comparisonPath = path.join(process.cwd(), 'public', 'data', 'dca_vs_risk_comparison.json');
    
    if (!fs.existsSync(comparisonPath)) {
      return NextResponse.json(
        { success: false, error: 'Strategy comparison data not found' },
        { status: 404 }
      );
    }
    
    const content = fs.readFileSync(comparisonPath, 'utf8');
    const comparisonData = JSON.parse(content);
    
    return NextResponse.json({
      success: true,
      data: comparisonData
    });

  } catch (error) {
    console.error('Error fetching strategy comparison:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch strategy comparison data' },
      { status: 500 }
    );
  }
}
