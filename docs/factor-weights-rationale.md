# Factor Weights Rationale

## Overview

This document explains the rationale behind the factor weights used in the Bitcoin Risk Dashboard's G-Score calculation. The weighting system was designed to prioritize the most predictive and fundamental risk indicators while maintaining a balanced approach to risk assessment.

## Weight Distribution (v2.1.0)

| Factor | Weight | Pillar | Rationale |
|--------|--------|--------|-----------|
| **Trend & Valuation** | **25%** | Momentum | Most fundamental risk indicator - cycle positioning |
| **Stablecoins** | **18%** | Liquidity | Enhanced with 7-coin coverage, crypto-native liquidity |
| **Term Structure & Leverage** | **18%** | Leverage | Derivatives market health, funding rates |
| **ETF Flows** | **10%** | Liquidity | Major institutional flow indicator |
| **Net Liquidity (FRED)** | **10%** | Liquidity | Fed balance sheet backdrop |
| **On-chain Activity** | **8%** | Momentum | Core Bitcoin network metrics |
| **Macro Overlay** | **6%** | Macro | External macroeconomic factors |
| **Social Interest** | **5%** | Social | Least predictive, sentiment indicator |

**Total Weight: 100%**

## Design Principles

### 1. **Fundamental Risk Priority**
- **Trend & Valuation (25%)**: Highest weight as it represents the most fundamental risk assessment
- Combines BMSB (Bull Market Support Band), Mayer Multiple, and RSI
- Provides cycle positioning and valuation context

### 2. **Liquidity Dominance (38% total)**
- **Stablecoins (18%)**: Enhanced with 7-coin coverage (USDT, USDC, DAI, BUSD, TUSD, FRAX, LUSD)
- **ETF Flows (10%)**: Major institutional adoption indicator
- **Net Liquidity (10%)**: Fed balance sheet backdrop

### 3. **Leverage & Derivatives (18%)**
- **Term Structure & Leverage**: Funding rates, basis, open interest
- Critical for understanding market stress and leverage cycles

### 4. **Core Bitcoin Metrics (8%)**
- **On-chain Activity**: Network fees, mempool congestion
- Direct Bitcoin network health indicators

### 5. **External Factors (11% total)**
- **Macro Overlay (6%)**: DXY, rates, VIX - important but less direct
- **Social Interest (5%)**: Google Trends, Fear & Greed - least predictive

## Historical Context

### Previous Weight Distribution (v2.0.0)
- Trend & Valuation: 20%
- Stablecoins: 21%
- Term Leverage: 20%
- ETF Flows: 9%
- Net Liquidity: 5%
- On-chain: 5%
- Macro Overlay: 10%
- Social Interest: 10%

### Key Changes in v2.1.0
1. **Trend & Valuation**: 20% → 25% (+5%)
   - **Rationale**: Most fundamental risk indicator deserves highest weight
   - Combines cycle positioning, valuation, and momentum

2. **Stablecoins**: 21% → 18% (-3%)
   - **Rationale**: Still high due to 7-coin coverage, but reduced to make room for Trend & Valuation

3. **ETF Flows**: 9% → 10% (+1%)
   - **Rationale**: Major institutional flow indicator, doubled weight

4. **On-chain**: 5% → 8% (+3%)
   - **Rationale**: Core Bitcoin metrics deserve more prominence

5. **Term Leverage**: 20% → 18% (-2%)
   - **Rationale**: Still important but less than fundamental valuation

6. **Social Interest**: 10% → 5% (-5%)
   - **Rationale**: Least predictive factor, reduced weight

## Factor-Specific Rationale

### Trend & Valuation (25%)
**Why Highest Weight:**
- Most fundamental risk assessment
- Combines cycle positioning (BMSB), valuation (Mayer Multiple), and momentum (RSI)
- Directly relates to Bitcoin's risk/reward profile
- Historical performance shows strong predictive power

**Components:**
- BMSB (60%): 20-week SMA + 21-week EMA
- Mayer Multiple (30%): Price vs 200-day SMA
- RSI (10%): 14-week momentum

### Stablecoins (18%)
**Why High Weight:**
- Enhanced with 7-coin coverage for better market representation
- Crypto-native liquidity signal
- Direct indicator of market liquidity and demand
- Weighted average of USDT, USDC, DAI, BUSD, TUSD, FRAX, LUSD

**Optimizations:**
- 365-day rolling historical baseline
- Multi-source fallback (CoinGecko → CoinMarketCap → CryptoCompare)
- Parallel processing with caching

### Term Structure & Leverage (18%)
**Why Important:**
- Derivatives market health indicator
- Funding rates, basis, open interest
- Critical for understanding market stress
- Leverage cycles are key risk factors

### ETF Flows (10%)
**Why Significant:**
- Major institutional adoption indicator
- Direct flow of capital into Bitcoin
- Enhanced with business-day-only calculations
- 21-day rolling sum for trend analysis

### On-chain Activity (8%)
**Why Core Bitcoin Metrics:**
- Network fees and mempool congestion
- Direct Bitcoin network health indicators
- Enhanced with fallback data sources
- Core to understanding Bitcoin's utility

### Net Liquidity (10%)
**Why Important Backdrop:**
- Fed balance sheet minus RRP and TGA
- Macro liquidity backdrop
- Important but less direct than crypto-native signals

### Macro Overlay (6%)
**Why Reduced Weight:**
- External macroeconomic factors
- DXY, 2Y rates, VIX
- Important but less predictive than crypto-native factors
- Reduced from 10% to 6%

### Social Interest (5%)
**Why Lowest Weight:**
- Google Trends and Fear & Greed Index
- Least predictive factor
- Sentiment indicators are lagging
- Reduced from 10% to 5%

## Implementation Details

### Weight Validation
- All weights must sum to exactly 1.0
- Configuration stored in `config/dashboard-config.json`
- Real-time validation during ETL process

### Performance Optimizations
- **Trend & Valuation**: 7ms calculation time with caching
- **Stablecoins**: Parallel processing with multi-source fallback
- **ETF Flows**: Business-day-only calculations
- **On-chain**: Enhanced with fallback data sources

### Staleness Management
- **Trend & Valuation**: 6 hours TTL, market-dependent
- **Stablecoins**: 24 hours TTL
- **ETF Flows**: 24 hours TTL, business-days-only
- **On-chain**: 96 hours TTL
- **Term Leverage**: 6 hours TTL, market-dependent
- **Macro Overlay**: 24 hours TTL, business-days-only
- **Social Interest**: 24 hours TTL, business-days-only

## Future Considerations

### Potential Adjustments
1. **Market Phase Adaptation**: Consider dynamic weighting based on market conditions
2. **Factor Performance**: Monitor factor performance and adjust weights accordingly
3. **New Factors**: Integrate new risk factors as they become available
4. **Seasonal Adjustments**: Consider seasonal factors in weighting

### Monitoring Metrics
- Factor correlation analysis
- Weight contribution analysis
- G-Score accuracy validation
- Factor staleness impact

## Conclusion

The current weighting system prioritizes fundamental risk indicators while maintaining a balanced approach to risk assessment. The 25% weight for Trend & Valuation reflects its status as the most fundamental risk indicator, while the 38% total for liquidity factors (Stablecoins + ETF Flows + Net Liquidity) acknowledges the importance of liquidity in Bitcoin risk assessment.

The system is designed to be:
- **Predictive**: Prioritizes factors with strong predictive power
- **Balanced**: Maintains diversity across different risk types
- **Adaptive**: Allows for future adjustments based on performance
- **Transparent**: Clear rationale for each weight decision

---

*Last Updated: 2025-10-05*
*Version: 2.1.0*
*Author: Bitcoin Risk Dashboard Team*
