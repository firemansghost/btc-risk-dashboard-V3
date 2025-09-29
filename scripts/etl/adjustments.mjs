#!/usr/bin/env node
/**
 * Cycle and Spike Adjustment Calculations
 * 
 * This module implements the logic for cycle and spike adjustments
 * based on power-law trend analysis and volatility detection.
 */

import fs from 'node:fs';

/**
 * Calculate Bitcoin's power-law trend
 * Formula: Price = A × (Days since genesis)^B
 */
function calculatePowerLawTrend(historicalPrices) {
  if (historicalPrices.length < 365) {
    return null; // Need at least 1 year of data
  }

  // Convert dates to days since genesis (Jan 3, 2009)
  const genesisDate = new Date('2009-01-03');
  const dataPoints = historicalPrices.map((price, index) => {
    const daysSinceGenesis = index; // Assuming daily data
    return {
      x: Math.log(daysSinceGenesis + 1), // Log of days + 1 to avoid log(0)
      y: Math.log(price)
    };
  });

  // Linear regression on log-transformed data
  const n = dataPoints.length;
  const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
  const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
  const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Convert back to power-law form: A = e^intercept, B = slope
  const A = Math.exp(intercept);
  const B = slope;

  return { A, B, slope, intercept };
}

/**
 * Calculate current price's deviation from power-law trend
 */
function calculatePowerLawResidual(currentPrice, daysSinceGenesis, powerLawParams) {
  if (!powerLawParams) return null;

  const { A, B } = powerLawParams;
  const expectedPrice = A * Math.pow(daysSinceGenesis + 1, B);
  const residual = (currentPrice - expectedPrice) / expectedPrice;
  
  return {
    expectedPrice,
    residual,
    residualPercent: residual * 100
  };
}

/**
 * Calculate EWMA volatility
 */
function calculateEWMAVolatility(returns, period = 20, alpha = 0.1) {
  if (returns.length < period) return null;

  let variance = 0;
  for (let i = 0; i < period; i++) {
    variance += returns[i] * returns[i];
  }
  variance /= period;

  // Apply EWMA smoothing
  for (let i = period; i < returns.length; i++) {
    variance = alpha * returns[i] * returns[i] + (1 - alpha) * variance;
  }

  return Math.sqrt(variance);
}

/**
 * Calculate cycle adjustment based on power-law trend deviation
 */
export function calculateCycleAdjustment(historicalPrices, currentPrice) {
  try {
    const powerLawParams = calculatePowerLawTrend(historicalPrices);
    if (!powerLawParams) {
      return {
        adj_pts: 0,
        residual_z: null,
        reason: 'insufficient_data',
        power_law_params: null
      };
    }

    const daysSinceGenesis = historicalPrices.length;
    const residual = calculatePowerLawResidual(currentPrice, daysSinceGenesis, powerLawParams);
    
    if (!residual) {
      return {
        adj_pts: 0,
        residual_z: null,
        reason: 'calculation_failed',
        power_law_params: powerLawParams
      };
    }

    // Only apply adjustment if deviation is significant (>30%)
    const threshold = 0.30; // 30% deviation threshold
    if (Math.abs(residual.residual) < threshold) {
      return {
        adj_pts: 0,
        residual_z: residual.residual,
        reason: 'within_normal_range',
        power_law_params: powerLawParams,
        residual_percent: residual.residualPercent
      };
    }

    // Calculate adjustment (capped at ±2.0 points)
    const rawAdjustment = residual.residual * 3; // Scale factor
    const adjustment = Math.max(-2.0, Math.min(2.0, rawAdjustment));

    return {
      adj_pts: Math.round(adjustment * 10) / 10, // Round to 1 decimal
      residual_z: residual.residual,
      reason: 'significant_deviation',
      power_law_params: powerLawParams,
      residual_percent: residual.residualPercent,
      threshold_exceeded: Math.abs(residual.residual) > threshold
    };

  } catch (error) {
    console.error('Cycle adjustment calculation failed:', error);
    return {
      adj_pts: 0,
      residual_z: null,
      reason: 'calculation_error',
      error: error.message
    };
  }
}

/**
 * Calculate spike adjustment based on daily volatility
 */
export function calculateSpikeAdjustment(dailyReturns, currentReturn) {
  try {
    if (dailyReturns.length < 20) {
      return {
        adj_pts: 0,
        r_1d: currentReturn,
        sigma: 0,
        z: 0,
        reason: 'insufficient_data'
      };
    }

    // Calculate EWMA volatility
    const volatility = calculateEWMAVolatility(dailyReturns);
    if (!volatility || volatility === 0) {
      return {
        adj_pts: 0,
        r_1d: currentReturn,
        sigma: volatility || 0,
        z: 0,
        reason: 'no_volatility_data'
      };
    }

    // Calculate Z-score
    const zScore = currentReturn / volatility;

    // Only apply adjustment if Z-score is significant (>2.0)
    const threshold = 2.0;
    if (Math.abs(zScore) < threshold) {
      return {
        adj_pts: 0,
        r_1d: currentReturn,
        sigma: volatility,
        z: zScore,
        reason: 'within_normal_volatility'
      };
    }

    // Calculate adjustment (capped at ±1.5 points)
    const rawAdjustment = zScore * 0.3; // Scale factor
    const adjustment = Math.max(-1.5, Math.min(1.5, rawAdjustment));

    return {
      adj_pts: Math.round(adjustment * 10) / 10, // Round to 1 decimal
      r_1d: currentReturn,
      sigma: volatility,
      z: zScore,
      reason: 'significant_volatility',
      threshold_exceeded: Math.abs(zScore) > threshold
    };

  } catch (error) {
    console.error('Spike adjustment calculation failed:', error);
    return {
      adj_pts: 0,
      r_1d: currentReturn,
      sigma: 0,
      z: 0,
      reason: 'calculation_error',
      error: error.message
    };
  }
}

/**
 * Load historical price data for adjustments
 */
export async function loadHistoricalPrices() {
  try {
    const csvPath = 'public/data/price-history.csv';
    if (!fs.existsSync(csvPath)) {
      return null;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    // Find close price column
    const closeIndex = headers.findIndex(h => h.toLowerCase().includes('close'));
    if (closeIndex === -1) {
      return null;
    }

    // Parse historical prices (skip header)
    const prices = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const price = parseFloat(values[closeIndex]);
      if (!isNaN(price) && price > 0) {
        prices.push(price);
      }
    }

    return prices.length > 0 ? prices : null;
  } catch (error) {
    console.error('Failed to load historical prices:', error);
    return null;
  }
}

/**
 * Calculate daily returns from price data
 */
export function calculateDailyReturns(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const return_ = (prices[i] - prices[i-1]) / prices[i-1];
    returns.push(return_);
  }
  return returns;
}
