# Factor Weight Implementation Guide

## Technical Implementation

This document provides technical details for implementing and maintaining the factor weight system in the Bitcoin Risk Dashboard.

## Configuration Files

### Primary Configuration
- **File**: `config/dashboard-config.json`
- **Purpose**: Single source of truth for all factor weights
- **Validation**: Weights must sum to exactly 1.0

### Weight Structure
```json
{
  "factors": {
    "trend_valuation": {
      "weight": 0.25,
      "label": "Trend & Valuation",
      "pillar": "momentum"
    },
    "stablecoins": {
      "weight": 0.18,
      "label": "Stablecoins", 
      "pillar": "liquidity"
    }
    // ... other factors
  }
}
```

## Implementation Details

### Weight Loading
```javascript
// Load configuration from single source of truth
const { loadDashboardConfig, getFactorsArray } = await import('../../lib/config-loader.mjs');
const config = await loadDashboardConfig();
const factors = getFactorsArray(config);
```

### G-Score Calculation
```javascript
// Calculate composite score with weight normalization
let totalWeight = 0;
let weightedSum = 0;

for (let i = 0; i < factors.length; i++) {
  const factor = factors[i];
  const result = results[i];
  
  if (result.status === 'fulfilled' && result.value.score !== null) {
    totalWeight += factor.weight;
    weightedSum += (factor.weight * result.value.score);
  }
}

const compositeScore = weightedSum / totalWeight;
```

### Weight Validation
```javascript
// Validate weights sum to 1.0
const totalWeight = Object.values(config.factors)
  .reduce((sum, f) => sum + f.weight, 0);

if (Math.abs(totalWeight - 1.0) > 1e-6) {
  throw new Error(`Weights sum to ${totalWeight}, expected 1.0`);
}
```

## Performance Optimizations

### Trend & Valuation Optimizations
- **Caching**: 24-hour cache with intelligent invalidation
- **Parallel Processing**: BMSB, Mayer Multiple, and RSI calculated simultaneously
- **Incremental Updates**: Only recalculate when price data changes

### Stablecoins Optimizations
- **Multi-source Fallback**: CoinGecko → CoinMarketCap → CryptoCompare
- **Parallel Processing**: 7 stablecoins processed simultaneously
- **Historical Baseline**: 365-day rolling window for percentile calculations

### ETF Flows Optimizations
- **Business-day-only Calculations**: 21-day rolling sum excludes weekends
- **Caching**: 24-hour cache for flow data
- **Data Validation**: Cross-reference multiple sources

## Staleness Management

### Factor TTL Configuration
```javascript
const stalenessConfig = {
  trend_valuation: { ttl_hours: 6, market_dependent: true },
  stablecoins: { ttl_hours: 24, market_dependent: false },
  etf_flows: { ttl_hours: 24, business_days_only: true },
  onchain: { ttl_hours: 96, market_dependent: false },
  term_leverage: { ttl_hours: 6, market_dependent: true },
  macro_overlay: { ttl_hours: 24, business_days_only: true },
  social_interest: { ttl_hours: 24, business_days_only: true }
};
```

### Staleness Check
```javascript
const stalenessStatus = getStalenessStatus(
  factorData,
  stalenessConfig.ttlHours,
  {
    factorName: factor.key,
    marketDependent: stalenessConfig.marketDependent,
    businessDaysOnly: stalenessConfig.businessDaysOnly
  }
);
```

## Testing & Validation

### Weight Testing
```javascript
// Test weight system
const result = await computeAllFactors();
console.log('G-Score:', result.composite);
console.log('Total Weight:', result.totalWeight);
console.log('Weighted Sum:', result.weightedSum);
```

### Factor Contribution Analysis
```javascript
// Analyze factor contributions
result.factors.forEach(f => {
  if (f.score !== null) {
    const contribution = f.score * f.weight;
    console.log(`${f.label}: ${f.score} (weight: ${f.weight * 100}%, contribution: ${contribution})`);
  }
});
```

## Monitoring & Maintenance

### Key Metrics to Monitor
1. **Weight Validation**: Ensure weights sum to 1.0
2. **Factor Performance**: Monitor individual factor scores
3. **G-Score Accuracy**: Validate composite score calculations
4. **Staleness Impact**: Track factor staleness rates
5. **Cache Performance**: Monitor cache hit rates

### Regular Maintenance Tasks
1. **Weight Review**: Quarterly review of factor weights
2. **Performance Analysis**: Monthly analysis of factor performance
3. **Staleness Optimization**: Adjust TTL based on data freshness
4. **Cache Cleanup**: Regular cleanup of expired cache files

## Troubleshooting

### Common Issues

#### Weights Don't Sum to 1.0
```javascript
// Check configuration file
const config = await loadDashboardConfig();
const totalWeight = Object.values(config.factors)
  .reduce((sum, f) => sum + f.weight, 0);
console.log('Total Weight:', totalWeight);
```

#### G-Score Calculation Issues
```javascript
// Debug G-Score calculation
console.log('Total Weight:', totalWeight);
console.log('Weighted Sum:', weightedSum);
console.log('Composite Score:', weightedSum / totalWeight);
```

#### Factor Staleness Issues
```javascript
// Check factor staleness
result.factors.forEach(f => {
  console.log(`${f.label}: ${f.status} - ${f.reason}`);
});
```

## Future Enhancements

### Dynamic Weighting
- Consider market phase adaptation
- Implement volatility-based weighting
- Add seasonal adjustments

### Advanced Analytics
- Factor correlation analysis
- Weight contribution analysis
- Performance attribution

### Machine Learning Integration
- Automated weight optimization
- Factor performance prediction
- Dynamic weight adjustment

---

*Last Updated: 2025-10-05*
*Version: 2.1.0*
*Author: Bitcoin Risk Dashboard Team*
