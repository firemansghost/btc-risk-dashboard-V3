// Dynamic G-Score recalculation with fresh Bitcoin price
// Recalculates factors that depend on Bitcoin price and updates composite score

interface FactorData {
  key: string;
  label: string;
  pillar: string;
  weight: number;
  score: number | null;
  status: string;
  reason: string;
  last_utc?: string;
  details?: any[];
}

interface DashboardData {
  composite_score: number;
  factors: FactorData[];
  btc: {
    spot_usd: number;
    as_of_utc: string;
  };
  band: {
    key: string;
    label: string;
    range: [number, number];
    color: string;
    recommendation: string;
  };
}

// Load risk bands from single source of truth
async function loadRiskBands(): Promise<Array<{ key: string; label: string; range: [number, number]; color: string; recommendation: string }>> {
  try {
    const response = await fetch('/config/dashboard-config.json');
    if (!response.ok) {
      throw new Error('Failed to load dashboard config');
    }
    const config = await response.json();
    return config.bands || [];
  } catch (error) {
    console.error('Error loading risk bands:', error);
    // Fallback to current bands if config fails to load
    return [
      { key: "aggressive_buy", label: "Aggressive Buying", range: [0, 14], color: "green", recommendation: "Max allocation" },
      { key: "dca_buy", label: "Regular DCA Buying", range: [15, 34], color: "green", recommendation: "Continue regular purchases" },
      { key: "moderate_buy", label: "Moderate Buying", range: [35, 49], color: "yellow", recommendation: "Selective buying opportunities" },
      { key: "hold_wait", label: "Hold & Wait", range: [50, 64], color: "orange", recommendation: "Hold existing positions" },
      { key: "reduce_risk", label: "Reduce Risk", range: [65, 79], color: "red", recommendation: "Consider taking profits" },
      { key: "high_risk", label: "High Risk", range: [80, 100], color: "red", recommendation: "Significant risk of correction" }
    ];
  }
}

// Risk band calculation using single source of truth
function getRiskBand(score: number, bands: Array<{ key: string; label: string; range: [number, number]; color: string; recommendation: string }>): { key: string; label: string; range: [number, number]; color: string; recommendation: string } {
  for (const band of bands) {
    if (score >= band.range[0] && score <= band.range[1]) {
      return band;
    }
  }
  // Fallback to last band if score is out of range
  return bands[bands.length - 1] || { key: "unknown", label: "Unknown", range: [0, 100], color: "gray", recommendation: "Unknown" };
}

// Simple percentile rank calculation
function percentileRank(arr: number[], value: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  if (index === -1) return 100;
  return (index / sorted.length) * 100;
}

// Risk score from percentile (matches ETL logic)
function riskFromPercentile(percentile: number, options: { invert?: boolean; k?: number } = {}): number {
  const { invert = false, k = 2 } = options;
  let score = percentile;
  if (invert) score = 100 - score;
  
  // Apply sigmoid-like transformation
  const normalized = score / 100;
  const transformed = Math.pow(normalized, k);
  return Math.round(transformed * 100);
}

// Calculate Simple Moving Average
function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// Recalculate Trend & Valuation factor with fresh Bitcoin price
async function recalculateTrendValuation(freshBtcPrice: number, originalFactor: FactorData): Promise<FactorData> {
  try {
    // We need historical price data to recalculate this properly
    // For now, we'll estimate the impact based on the price change
    
    if (!originalFactor.details || originalFactor.score === null) {
      return originalFactor; // Can't recalculate without original data
    }
    
    // Find current price and 200-day SMA from details
    const currentPriceDetail = originalFactor.details.find(d => d.label.includes('Current Price'));
    const sma200Detail = originalFactor.details.find(d => d.label.includes('200-day SMA'));
    
    if (!currentPriceDetail || !sma200Detail) {
      return originalFactor; // Can't recalculate without these values
    }
    
    const originalPrice = parseFloat(currentPriceDetail.value.replace(/[$,]/g, ''));
    const sma200 = parseFloat(sma200Detail.value.replace(/[$,]/g, ''));
    
    // Calculate new Mayer Multiple with fresh price
    const newMayer = freshBtcPrice / sma200;
    const originalMayer = originalPrice / sma200;
    
    // Estimate score adjustment based on Mayer Multiple change
    // This is a simplified approach - the real calculation would need full historical data
    const mayerChange = ((newMayer - originalMayer) / originalMayer) * 100;
    
    // Rough estimate: 10% Mayer change ≈ 5-10 point score change
    const scoreAdjustment = Math.round(mayerChange * 0.5);
    const newScore = Math.max(0, Math.min(100, originalFactor.score + scoreAdjustment));
    
    // Update details with fresh price
    const updatedDetails = originalFactor.details.map(detail => {
      if (detail.label.includes('Current Price')) {
        return { ...detail, value: `$${freshBtcPrice.toLocaleString()}` };
      }
      if (detail.label.includes('Mayer')) {
        return { ...detail, value: newMayer.toFixed(2) };
      }
      return detail;
    });
    
    return {
      ...originalFactor,
      score: newScore,
      reason: `updated_with_fresh_price (${freshBtcPrice.toLocaleString()})`,
      details: updatedDetails
    };
    
  } catch (error) {
    console.error('Error recalculating Trend & Valuation:', error);
    return originalFactor;
  }
}

// Main function to recalculate G-Score with fresh Bitcoin price
export async function recalculateGScoreWithFreshPrice(
  originalData: DashboardData, 
  freshBtcPrice: number
): Promise<DashboardData> {
  try {
    console.log('Recalculating G-Score with fresh Bitcoin price:', freshBtcPrice);
    
    // Load risk bands from single source of truth
    const riskBands = await loadRiskBands();
    console.log('Loaded risk bands from config:', riskBands.length, 'bands');
    
    const updatedFactors: FactorData[] = [];
    let totalWeight = 0;
    let weightedSum = 0;
    
    // Process each factor
    for (const factor of originalData.factors) {
      let updatedFactor = factor;
      
      // Recalculate factors that depend on Bitcoin price
      if (factor.key === 'trend_valuation' && factor.status === 'fresh') {
        updatedFactor = await recalculateTrendValuation(freshBtcPrice, factor);
      }
      // Add other price-dependent factors here in the future
      
      updatedFactors.push(updatedFactor);
      
      // Include in composite calculation if fresh and has score
      if (updatedFactor.status === 'fresh' && updatedFactor.score !== null) {
        totalWeight += updatedFactor.weight;
        weightedSum += updatedFactor.weight * updatedFactor.score;
      }
    }
    
    // Calculate new composite score
    const newCompositeScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : originalData.composite_score;
    const newBand = getRiskBand(newCompositeScore, riskBands);
    
    console.log('G-Score updated:', originalData.composite_score, '→', newCompositeScore, 'Band:', newBand.label);
    
    return {
      ...originalData,
      composite_score: newCompositeScore,
      factors: updatedFactors,
      band: newBand,
      btc: {
        ...originalData.btc,
        spot_usd: freshBtcPrice,
        as_of_utc: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('Error recalculating G-Score:', error);
    return originalData;
  }
}
