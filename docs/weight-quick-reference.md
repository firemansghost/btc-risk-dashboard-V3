# Factor Weights Quick Reference

## Current Weights (v2.1.0)

| Factor | Weight | Pillar | Key Components |
|--------|--------|--------|----------------|
| **Trend & Valuation** | **25%** | Momentum | BMSB (60%), Mayer Multiple (30%), RSI (10%) |
| **Stablecoins** | **18%** | Liquidity | 7-coin weighted average (USDT, USDC, DAI, BUSD, TUSD, FRAX, LUSD) |
| **Term Leverage** | **18%** | Leverage | Funding rates, basis, open interest |
| **ETF Flows** | **10%** | Liquidity | 21-day rolling sum (business days only) |
| **Net Liquidity** | **10%** | Liquidity | Fed balance sheet minus RRP and TGA |
| **On-chain** | **8%** | Momentum | Network fees, mempool congestion |
| **Macro Overlay** | **6%** | Macro | DXY, 2Y rates, VIX |
| **Social Interest** | **5%** | Social | Google Trends, Fear & Greed Index |

## Pillar Distribution

| Pillar | Total Weight | Factors |
|--------|--------------|---------|
| **Momentum** | **33%** | Trend & Valuation (25%) + On-chain (8%) |
| **Liquidity** | **38%** | Stablecoins (18%) + ETF Flows (10%) + Net Liquidity (10%) |
| **Leverage** | **18%** | Term Structure & Leverage (18%) |
| **Macro** | **6%** | Macro Overlay (6%) |
| **Social** | **5%** | Social Interest (5%) |

## Key Changes from v2.0.0

| Factor | Change | Impact |
|--------|--------|--------|
| **Trend & Valuation** | 20% → 25% (+5%) | 🎯 **Highest weight - most fundamental** |
| **Stablecoins** | 21% → 18% (-3%) | Still high due to 7-coin coverage |
| **ETF Flows** | 9% → 10% (+1%) | Major institutional indicator |
| **On-chain** | 5% → 8% (+3%) | Core Bitcoin metrics |
| **Term Leverage** | 20% → 18% (-2%) | Still important but less than valuation |
| **Social Interest** | 10% → 5% (-5%) | Least predictive factor |
| **Net Liquidity** | 5% → 10% (+5%) | Important backdrop liquidity |
| **Macro Overlay** | 10% → 6% (-4%) | External factor with reduced weight |

## Performance Optimizations

### Trend & Valuation
- **Caching**: 24-hour cache with intelligent invalidation
- **Parallel Processing**: BMSB, Mayer Multiple, RSI calculated simultaneously
- **Calculation Time**: 7ms (down from sequential processing)

### Stablecoins
- **Coverage**: 7-coin weighted average
- **Sources**: CoinGecko → CoinMarketCap → CryptoCompare fallback
- **Processing**: Parallel processing with staggered delays

### ETF Flows
- **Business Days Only**: 21-day rolling sum excludes weekends
- **Caching**: 24-hour cache for flow data
- **Validation**: Cross-reference multiple sources

### On-chain
- **Fallback Sources**: blockchain.info → mempool.space → blockstream
- **Enhanced Metrics**: Mempool size, transaction fees
- **Caching**: 96-hour cache for network data

## Staleness Configuration

| Factor | TTL | Market Dependent | Business Days Only |
|--------|-----|------------------|-------------------|
| **Trend & Valuation** | 6 hours | ✅ | ❌ |
| **Stablecoins** | 24 hours | ❌ | ❌ |
| **ETF Flows** | 24 hours | ❌ | ✅ |
| **On-chain** | 96 hours | ❌ | ❌ |
| **Term Leverage** | 6 hours | ✅ | ❌ |
| **Macro Overlay** | 24 hours | ❌ | ✅ |
| **Social Interest** | 24 hours | ❌ | ✅ |

## Configuration Files

### Primary Configuration
- **File**: `config/dashboard-config.json`
- **Validation**: Weights must sum to exactly 1.0
- **Version**: 2.1.0

### Weight Validation
```javascript
const totalWeight = Object.values(config.factors)
  .reduce((sum, f) => sum + f.weight, 0);
// Must equal 1.0
```

## Testing Commands

### Test Weight System
```bash
cd scripts/etl
node -e "import('./factors.mjs').then(m => m.computeAllFactors()).then(result => { console.log('G-Score:', result.composite); console.log('Total Weight:', result.totalWeight); })"
```

### Validate Weights
```bash
cd scripts/etl
node -e "import('../../lib/config-loader.mjs').then(m => m.loadDashboardConfig()).then(config => { const total = Object.values(config.factors).reduce((sum, f) => sum + f.weight, 0); console.log('Total Weight:', total); console.log('Valid:', total === 1.0 ? '✅' : '❌'); })"
```

## Troubleshooting

### Common Issues
1. **Weights don't sum to 1.0**: Check `config/dashboard-config.json`
2. **G-Score undefined**: Check factor staleness and API keys
3. **Cache issues**: Clear cache files in `public/data/cache/`
4. **Performance issues**: Check parallel processing implementation

### Debug Commands
```bash
# Check factor staleness
cd scripts/etl
node -e "import('./factors.mjs').then(m => m.computeAllFactors()).then(result => { result.factors.forEach(f => console.log(f.label + ':', f.status, f.reason)); })"

# Check cache status
ls -la public/data/cache/

# Validate configuration
cd scripts/etl
node -e "import('../../lib/config-loader.mjs').then(m => m.loadDashboardConfig()).then(config => { console.log('Version:', config.version); console.log('Factors:', Object.keys(config.factors).length); })"
```

## Future Considerations

### Potential Adjustments
- **Dynamic Weighting**: Market phase adaptation
- **Factor Performance**: Monitor and adjust based on predictive power
- **New Factors**: Integrate emerging risk factors
- **Seasonal Adjustments**: Consider seasonal factors

### Monitoring Metrics
- Factor correlation analysis
- Weight contribution analysis
- G-Score accuracy validation
- Factor staleness impact

---

*Last Updated: 2025-10-05*
*Version: 2.1.0*
*Quick Reference for Bitcoin Risk Dashboard*
