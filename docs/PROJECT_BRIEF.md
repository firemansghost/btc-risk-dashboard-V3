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

### Default Weights
- **Liquidity (40%)**: Net Liquidity (10%), Stablecoins (15%), ETF Flows (10%), On-chain Activity (5%)
  - *ETF Flows includes per-ETF breakdown with individual fund flows, 21-day rolling sums, and cumulative totals*
- **Momentum (25%)**: Trend & Valuation (25%)
- **Leverage (20%)**: Term Structure & Leverage (20%)
- **Social (5%)**: Social Interest (5%)
- **Macro (5%)**: Macro Overlay (5%)

### Risk Calculation Pipeline

1. **Data Collection**: Real-time APIs (FRED, CoinGecko, Farside, Alternative.me)
2. **Normalization**: Convert raw metrics to standardized values
3. **Z-Score Calculation**: Statistical normalization using historical baselines
4. **Logistic Mapping**: Transform z-scores to 0-100 risk scores using sigmoid function
5. **EWMA Smoothing**: Apply exponential weighted moving average for stability
6. **Weight Aggregation**: Combine pillar scores using configurable weights

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
- **Data Storage**: JSON artifacts in public directory (read-only in production)
- **APIs**: RESTful endpoints for data access and real-time refresh
- **Caching**: Intelligent caching with staleness detection and fallback mechanisms

## Data Sources

- **FRED API**: Federal Reserve economic data (Net Liquidity, Macro indicators)
- **CoinGecko**: Bitcoin price, market cap, and stablecoin data
- **Farside Investors**: Bitcoin ETF flows with individual ETF breakdowns
- **Alternative.me**: Fear & Greed Index for social sentiment
- **Blockchain.info**: On-chain metrics (transaction fees, hash rate, transaction count)

## Risk Bands

- **0-15**: Aggressive Buying (extreme opportunity)
- **15-35**: Regular DCA Buying (good opportunity)
- **35-55**: Hold/Neutral (wait and watch)
- **55-70**: Begin Scaling Out (reduce exposure)
- **70-85**: Increase Selling (significant caution)
- **85-100**: Maximum Selling (extreme caution)
