import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Mock prediction data - in a real implementation, this would call ML models
    const predictions = {
      timestamp: new Date().toISOString(),
      horizon: 7, // days
      confidence: 78,
      models: {
        arima: { accuracy: 87.3, weight: 0.4 },
        lstm: { accuracy: 84.7, weight: 0.35 },
        randomForest: { accuracy: 82.9, weight: 0.25 }
      },
      forecasts: {
        daily: [
          { date: '2025-09-29', flow: 45.2, confidence: 85, trend: 'up' },
          { date: '2025-09-30', flow: 48.7, confidence: 82, trend: 'up' },
          { date: '2025-10-01', flow: 51.3, confidence: 79, trend: 'up' },
          { date: '2025-10-02', flow: 49.8, confidence: 76, trend: 'down' },
          { date: '2025-10-03', flow: 47.2, confidence: 73, trend: 'down' },
          { date: '2025-10-04', flow: 44.6, confidence: 70, trend: 'down' },
          { date: '2025-10-05', flow: 46.1, confidence: 68, trend: 'up' }
        ],
        weekly: {
          thisWeek: 312.4,
          nextWeek: 298.7,
          confidence: 72
        },
        individual: [
          { symbol: 'IBIT', name: 'iShares Bitcoin Trust', current: 25.3, predicted: 28.7, confidence: 82, trend: 'up', marketShare: 35.2 },
          { symbol: 'FBTC', name: 'Fidelity Wise Origin Bitcoin Fund', current: 18.9, predicted: 22.1, confidence: 78, trend: 'up', marketShare: 26.3 },
          { symbol: 'BITB', name: 'Bitwise Bitcoin ETF', current: 12.4, predicted: 11.8, confidence: 85, trend: 'down', marketShare: 17.2 },
          { symbol: 'ARKB', name: 'ARK 21Shares Bitcoin ETF', current: 8.7, predicted: 9.2, confidence: 79, trend: 'up', marketShare: 12.1 },
          { symbol: 'BTCO', name: 'Invesco Galaxy Bitcoin ETF', current: 6.2, predicted: 6.8, confidence: 76, trend: 'up', marketShare: 8.6 }
        ]
      },
      performance: {
        historicalAccuracy: {
          '1day': 87.3,
          '7day': 82.1,
          '30day': 76.8
        },
        modelMetrics: [
          { model: 'ARIMA', accuracy: 87.3, mape: 12.4, rmse: 8.2, status: 'active' },
          { model: 'LSTM', accuracy: 84.7, mape: 15.1, rmse: 9.8, status: 'active' },
          { model: 'Random Forest', accuracy: 82.9, mape: 16.8, rmse: 10.5, status: 'active' },
          { model: 'Linear Regression', accuracy: 79.2, mape: 19.3, rmse: 12.1, status: 'backup' }
        ],
        ensemble: {
          accuracy: 91.2,
          rmse: 8.7,
          weights: { arima: 0.4, lstm: 0.35, randomForest: 0.25 }
        }
      },
      insights: [
        'Strong momentum in IBIT and FBTC suggests continued institutional interest',
        'BITB showing slight decline may indicate profit-taking',
        'Overall trend remains positive with 7-day forecast of $298.7M',
        'High confidence (85%) in tomorrow\'s prediction of $45.2M'
      ]
    };

    return NextResponse.json(predictions);
  } catch (error) {
    console.error('ETF Predictions API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate ETF predictions' },
      { status: 500 }
    );
  }
}
