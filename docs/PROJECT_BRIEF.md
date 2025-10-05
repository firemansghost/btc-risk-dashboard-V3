# Project Brief & Methodology

*See also: [Brand Card](/brand) (voice, naming, bands).*

## Purpose

The Bitcoin Risk Dashboard provides institutional-grade risk assessment for Bitcoin investments through a transparent, quantitative framework. It generates a 0-100 risk score where lower scores indicate better buying opportunities and higher scores suggest caution or selling pressure.

## Target Users

- **Institutional investors** seeking systematic Bitcoin allocation decisions
- **Retail investors** wanting data-driven entry/exit timing
- **Researchers** studying Bitcoin market dynamics and risk factors
- **Portfolio managers** integrating Bitcoin into diversified portfolios

## Five-Pillar Framework

### Current Weights (Single Source of Truth: `config/dashboard-config.json`)
- **Liquidity/Flows (38%)**: Stablecoins (18%), ETF Flows (10%), Net Liquidity (10%)
  - *Prioritizes crypto-native flows (stablecoins, ETF creations/redemptions) over laggy Fed liquidity*
  - *Enhanced with 7-coin stablecoin coverage, business-day ETF logic, and multi-source fallbacks*
- **Momentum/Valuation (33%)**: Trend & Valuation (25%), On-chain Activity (8%)
  - *Trend & Valuation now leads with highest weight, enhanced with parallel processing and caching*
- **Term Structure/Leverage (18%)**: Term Structure & Leverage (18%)
  - *Enhanced with multi-exchange fallback (BitMEX → Binance → OKX) and intelligent caching*
- **Macro Overlay (6%)**: Macro Overlay (6%)
  - *Enhanced with retry logic and parallel FRED fetching*
- **Social/Attention (5%)**: Social Interest (5%)
  - *Enhanced with momentum analysis and intelligent caching*

**Configuration Architecture:**
- All weights are dynamically loaded from `config/dashboard-config.json`
- ETL and frontend use identical configuration (guaranteed consistency)
- Comprehensive validation ensures weights sum to 100%
- Sub-factor weights defined with Cycle-Anchored Trend (BMSB-led) approach

### Risk Calculation Pipeline

1. **Data Collection**: Multi-source APIs with intelligent fallback chains
2. **Caching Layer**: Factor-level caching with appropriate TTLs (4-24 hours)
3. **Parallel Processing**: Concurrent data fetching and calculation optimization
4. **Normalization**: Convert raw metrics to standardized values
5. **Z-Score Calculation**: Statistical normalization using historical baselines
6. **Logistic Mapping**: Transform z-scores to 0-100 risk scores using sigmoid function
7. **EWMA Smoothing**: Apply exponential weighted moving average for stability
8. **Weight Aggregation**: Combine pillar scores using configurable weights

### Comprehensive System Optimizations

**Performance Enhancements:**
- **Intelligent Caching**: All 8 factors use sophisticated caching with appropriate TTLs
- **Parallel Processing**: Concurrent data fetching and calculation optimization
- **Multi-source Fallbacks**: Enhanced reliability with fallback data sources
- **Business-day Logic**: ETF Flows exclude weekends and holidays for accurate calculations

**Factor-specific Improvements:**
- **Trend & Valuation**: 7ms calculation time with parallel BMSB/Mayer/RSI processing
- **Stablecoins**: 7-coin coverage with 3-source fallback and 365-day historical baseline
- **ETF Flows**: Business-day awareness with weekend/holiday exclusion
- **Term Leverage**: Multi-exchange fallback (BitMEX → Binance → OKX) with 6h cache
- **On-chain Activity**: 3-source fallback (Blockchain.info → Mempool.space → Mempool.observer)
- **Net Liquidity**: Enhanced FRED fetching with retry logic and 24h cache
- **Macro Overlay**: Parallel FRED data fetching with retry logic
- **Social Interest**: Momentum analysis with 6h cache and trending data

### Staleness & Re-weighting

- **Fresh factors** (data < 24h old): Full weight in composite calculation
- **Stale factors** (data > 24h old): Excluded from composite, marked as "stale"
- **Dynamic re-normalization**: Weights automatically adjust when factors become stale
- **Transparency**: All staleness status visible in UI with clear indicators

### Optional Adjustments

- **Cycle Adjustment**: Long-term market cycle corrections (currently disabled)
- **Spike Adjustment**: Short-term volatility corrections (currently disabled)
- **Manual Overrides**: Configurable factor weights via UI

## Transparency Features

- **Factor Details**: Every calculation shows underlying data, formulas, and percentiles
- **Provenance Tracking**: Complete audit trail of data sources and computation timing
- **Historical Context**: 1-year percentile rankings for all metrics
- **Methodology Documentation**: Detailed explanations of each factor's calculation
- **Real-time Updates**: Live data refresh with source attribution
- **Display-Only Context**: BTC⇄Gold and Satoshis per Dollar provide additional perspective without affecting risk scores
- **Factor History**: Per-factor historical data persisted daily for transparency and trend analysis
- **Alert System**: Real-time notifications for ETF zero-cross events and risk band changes (informational only)

## Deployment Architecture

- **Frontend**: Next.js 15 with TypeScript, deployed on Vercel
- **ETL Pipeline**: Node.js scripts with GitHub Actions scheduling
- **Configuration**: Single source of truth in `config/dashboard-config.json`
  - Dynamic loading in both Node.js (ETL) and browser (frontend) environments
  - Comprehensive validation with weight sum checks and tolerance controls
  - Automatic cache clearing and consistency guarantees
- **Data Storage**: JSON artifacts in public directory (read-only in production)
  - `latest.json`: Computed G-Score results and factor outputs
  - `status.json`: ETL execution status and timestamps
- **APIs**: RESTful endpoints for data access and real-time refresh
- **Caching**: Intelligent caching with staleness detection and fallback mechanisms

## Data Sources

- **FRED API**: Federal Reserve economic data (Net Liquidity, Macro indicators)
- **CoinGecko**: Bitcoin price, market cap, and stablecoin data
- **Farside Investors**: Bitcoin ETF flows with individual ETF breakdowns
- **Alternative.me**: Fear & Greed Index for social sentiment
- **Blockchain.info**: On-chain metrics (transaction fees, hash rate, transaction count)

## Risk Bands

- **0-14**: Aggressive Buying (extreme opportunity)
- **15-34**: Regular DCA Buying (good opportunity)
- **35-49**: Moderate Buying (reduce position size)
- **50-64**: Hold & Wait (hold existing positions)
- **65-79**: Reduce Risk (consider taking profits)
- **80-100**: High Risk (significant risk of correction)
