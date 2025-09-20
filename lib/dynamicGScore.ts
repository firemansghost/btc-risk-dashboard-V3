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

// Risk band calculation (matches ETL logic)
function getRiskBand(score: number) {
  if (score >= 0 && score <= 15) return { key: "maximum_buying", label: "Maximum Buying", range: [0, 15], color: "#059669", recommendation: "Maximum Buying" };
  if (score >= 16 && score <= 25) return { key: "buying", label: "Buying", range: [16, 25], color: "#16A34A", recommendation: "Buying" };
  if (score >= 26 && score <= 34) return { key: "accumulate", label: "Accumulate", range: [26, 34], color: "#65A30D", recommendation: "Accumulate" };
  if (score >= 35 && score <= 55) return { key: "hold_neutral", label: "Hold/Neutral", range: [35, 55], color: "#6B7280", recommendation: "Hold/Neutral" };
  if (score >= 56 && score <= 70) return { key: "reduce", label: "Reduce", range: [56, 70], color: "#CA8A04", recommendation: "Reduce" };
  if (score >= 71 && score <= 84) return { key: "selling", label: "Selling", range: [71, 84], color: "#DC2626", recommendation: "Selling" };
  return { key: "maximum_selling", label: "Maximum Selling", range: [85, 100], color: "#991B1B", recommendation: "Maximum Selling" };
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
    const newBand = getRiskBand(newCompositeScore);
    
    console.log('G-Score updated:', originalData.composite_score, '→', newCompositeScore);
    
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
