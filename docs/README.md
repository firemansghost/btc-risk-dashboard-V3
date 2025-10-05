# Bitcoin Risk Dashboard Documentation

## Overview

This documentation provides comprehensive information about the Bitcoin Risk Dashboard's factor weighting system, implementation details, and maintenance procedures.

## Documentation Structure

### 📊 Factor Weights Documentation
- **[Factor Weights Rationale](factor-weights-rationale.md)** - Comprehensive explanation of the weighting system
- **[Weight Implementation Guide](weight-implementation-guide.md)** - Technical implementation details
- **[Weight Change Log](weight-change-log.md)** - Version history and change rationale
- **[Weight Quick Reference](weight-quick-reference.md)** - Quick reference guide

### 🔧 Technical Documentation
- **[ETL Process](../scripts/etl/README.md)** - Extract, Transform, Load process
- **[API Documentation](../app/api/README.md)** - API endpoints and usage
- **[Configuration Guide](../config/README.md)** - Configuration management

### 📈 Factor Documentation
- **[Trend & Valuation Factor](../scripts/etl/factors/trendValuation.mjs)** - BMSB, Mayer Multiple, RSI
- **[Stablecoins Factor](../scripts/etl/factors/stablecoins.mjs)** - 7-coin weighted average
- **[ETF Flows Factor](../scripts/etl/factors/etfFlows.mjs)** - Institutional flow analysis
- **[On-chain Factor](../scripts/etl/factors/onchain.mjs)** - Network metrics

## Current Weight Distribution (v2.1.0)

| Factor | Weight | Pillar | Rationale |
|--------|--------|--------|-----------|
| **Trend & Valuation** | **25%** | Momentum | Most fundamental risk indicator |
| **Stablecoins** | **18%** | Liquidity | Enhanced with 7-coin coverage |
| **Term Leverage** | **18%** | Leverage | Derivatives market health |
| **ETF Flows** | **10%** | Liquidity | Major institutional indicator |
| **Net Liquidity** | **10%** | Liquidity | Fed balance sheet backdrop |
| **On-chain** | **8%** | Momentum | Core Bitcoin metrics |
| **Macro Overlay** | **6%** | Macro | External macroeconomic factors |
| **Social Interest** | **5%** | Social | Least predictive factor |

## Key Features

### 🚀 Comprehensive Performance Optimizations
- **Trend & Valuation**: 7ms calculation time with 24h cache and parallel BMSB/Mayer/RSI processing
- **Stablecoins**: 7-coin coverage with 3-source fallback (CoinGecko → CoinMarketCap → CryptoCompare) and 365-day baseline
- **ETF Flows**: Business-day logic with weekend/holiday exclusion and 24h cache
- **Term Leverage**: Multi-exchange fallback (BitMEX → Binance → OKX) with 6h cache and parallel processing
- **On-chain Activity**: 3-source fallback (Blockchain.info → Mempool.space → Mempool.observer) with 4h cache
- **Net Liquidity**: Enhanced FRED fetching with retry logic and 24h cache
- **Macro Overlay**: Parallel FRED data fetching with retry logic and 24h cache
- **Social Interest**: Momentum analysis with 6h cache and trending data

### 📊 Enhanced Analytics
- **Factor Volatility Analysis**: Show which factors are most volatile
- **Correlation Insights**: Highlight factors that move together
- **Risk Concentration**: Identify if risk is concentrated in specific factors
- **Confidence Levels**: Show how reliable each factor's data is

### 🎯 Smart Context
- **Market Phase Awareness**: Adapt explanations based on market conditions
- **Historical Context**: Provide historical perspective on current scores
- **Forward-looking Insights**: Anticipate potential risk changes

## Quick Start

### Test Weight System
```bash
cd scripts/etl
node -e "import('./factors.mjs').then(m => m.computeAllFactors()).then(result => { console.log('G-Score:', result.composite); })"
```

### Validate Configuration
```bash
cd scripts/etl
node -e "import('../../lib/config-loader.mjs').then(m => m.loadDashboardConfig()).then(config => { const total = Object.values(config.factors).reduce((sum, f) => sum + f.weight, 0); console.log('Total Weight:', total); console.log('Valid:', total === 1.0 ? '✅' : '❌'); })"
```

### Check Factor Status
```bash
cd scripts/etl
node -e "import('./factors.mjs').then(m => m.computeAllFactors()).then(result => { result.factors.forEach(f => console.log(f.label + ':', f.status, f.reason)); })"
```

## Maintenance

### Regular Tasks
1. **Weight Review**: Quarterly review of factor weights
2. **Performance Analysis**: Monthly analysis of factor performance
3. **Staleness Optimization**: Adjust TTL based on data freshness
4. **Cache Cleanup**: Regular cleanup of expired cache files

### Monitoring Metrics
- Factor correlation analysis
- Weight contribution analysis
- G-Score accuracy validation
- Factor staleness impact

## Version History

### v2.1.0 (2025-10-05) - Major Rebalancing
- **Trend & Valuation**: 20% → 25% (+5%)
- **Stablecoins**: 21% → 18% (-3%)
- **ETF Flows**: 9% → 10% (+1%)
- **On-chain**: 5% → 8% (+3%)
- **Term Leverage**: 20% → 18% (-2%)
- **Social Interest**: 10% → 5% (-5%)
- **Net Liquidity**: 5% → 10% (+5%)
- **Macro Overlay**: 10% → 6% (-4%)

### v2.0.0 (2025-01-20) - Initial Weight System
- Established baseline weighting system
- Initial factor weights and rationale

## Support

For questions or issues related to the factor weighting system:

1. **Check Documentation**: Review relevant documentation files
2. **Test Configuration**: Run validation commands
3. **Check Logs**: Review ETL process logs
4. **Monitor Performance**: Use monitoring metrics

## Contributing

When making changes to the factor weighting system:

1. **Update Documentation**: Update relevant documentation files
2. **Test Changes**: Run comprehensive tests
3. **Validate Weights**: Ensure weights sum to 1.0
4. **Update Version**: Increment version number
5. **Document Changes**: Update change log

---

*Last Updated: 2025-10-05*
*Version: 2.1.0*
*Bitcoin Risk Dashboard Documentation*
