# Factor Specifications

Mathematical contracts for all risk factors in the Bitcoin Risk Dashboard.

**Configuration Source**: All weights are loaded from `config/dashboard-config.json` (single source of truth)

## Liquidity/Flows Pillar (35% total weight)

*Prioritizes crypto-native flows (stablecoins, ETF creations/redemptions) over laggy Fed liquidity for better signal and less overlap with Macro inputs.*

### Stablecoins (21% weight)
- **Data Source**: CoinGecko multi-stablecoin data (USDT, USDC, DAI)
- **Window**: 90 days of daily data
- **Transform**: Multi-factor composite (Supply Growth 55%, Momentum 30%, Concentration 15%)
  - **Aggregate Supply Growth**: Market-cap weighted 30-day change across major stablecoins
  - **Growth Momentum**: 7-day vs 30-day trend acceleration/deceleration
  - **Market Concentration**: Herfindahl-Hirschman Index for diversification risk
- **Mapping**: Higher aggregate supply growth + lower concentration = Lower risk
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite of three components with market-share weighting

### ETF Flows (9% weight)
- **Data Source**: Farside Investors HTML scraping with individual ETF breakdown
- **Window**: 21-day rolling sum with acceleration analysis
- **Transform**: Multi-factor composite (21-day Sum 30%, Acceleration 30%, Diversification 40%)
  - **21-day Rolling Sum**: Primary momentum indicator from all Bitcoin ETFs
  - **Flow Acceleration**: 7-day recent vs previous 7-day comparison
  - **ETF Diversification**: HHI concentration risk across individual ETFs (IBIT, FBTC, etc.)
- **Mapping**: Higher flows + positive acceleration + lower concentration = Lower risk
- **Staleness TTL**: 5 days
- **Aggregation**: Weighted composite with historical baseline percentile ranking

### Net Liquidity (5% weight)
- **Data Source**: FRED API (WALCL, RRPONTSYD, WTREGEN)
- **Window**: 1 year of weekly data
- **Transform**: Multi-factor composite (Level 15%, Rate of Change 40%, Momentum 45%)
  - **Net Liquidity**: Fed Balance Sheet - Reverse Repo - Treasury General Account
  - **4-week Rate of Change**: Short-term liquidity trend (more predictive)
  - **12-week Momentum**: Acceleration/deceleration analysis
- **Mapping**: Higher liquidity growth = Lower risk (inverted)
- **Staleness TTL**: 7 days
- **Aggregation**: Weighted composite of three percentile-ranked components
- **Context Display**: Also appears in Macro Overlay as context only (not double-counted in composite score)


### On-chain Activity (5% weight, within Momentum pillar)
- **Data Source**: Blockchain.info + CoinGecko (fees, transactions, hash rate, prices, volumes)
- **Window**: 30 days of daily data
- **Transform**: Multi-factor composite (Congestion 60%, Activity 40%, NVT 0% + Security adjustment)
  - **Network Congestion**: Transaction fees relative to historical levels
  - **Transaction Activity**: Normalized daily transaction count
  - **NVT Ratio**: Network Value to Transactions (market cap / volume proxy)
  - **Hash Rate Security**: Network security bonus/penalty (±5 points)
- **Mapping**: Higher congestion + activity + NVT = Higher risk; higher security = Lower risk
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite with security adjustment and percentile ranking

## Momentum/Valuation Pillar (25% total weight)

### Trend & Valuation (20% weight)
- **Data Source**: CoinGecko Bitcoin price data
- **Window**: 365 days of daily data
- **Transform**: Cycle-Anchored Trend composite (BMSB 60%, Mayer Multiple 30%, Weekly RSI 10%)
  - **Mayer Multiple**: Price / 200-day SMA
  - **Bull Market Support Band (BMSB)**: Distance from 200-day SMA (proxy)
  - **Weekly RSI**: RSI(14) calculated on weekly price samples (every 7th day)
- **Mapping**: Higher values = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite of three percentile-ranked components

## Term Structure/Leverage Pillar (20% total weight)

### Term Structure & Leverage (20% weight)
- **Data Source**: BitMEX funding rates + CoinGecko spot prices
- **Window**: 30 days of funding data + spot price volatility
- **Transform**: Multi-factor composite (Funding 40%, Basis 35%, OI/MCap 25%)
  - **Funding Rate Level**: Average funding rate intensity (leverage demand)
  - **Funding Volatility**: Standard deviation of funding rates (instability)
  - **Term Structure Stress**: Combined funding-volatility stress indicator
- **Mapping**: Higher funding + higher volatility + higher stress = Higher risk
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite with percentile ranking of each component

## Social/Attention Pillar (10% total weight)

### Social Interest (10% weight)
- **Data Source**: CoinGecko trending searches + Bitcoin price data
- **Window**: Real-time trending + 30 days of price data
- **Transform**: Multi-factor composite (Google Trends 70%, Fear & Greed 30%, Volatility 0%)
  - **Search Attention**: Bitcoin trending rank on CoinGecko (higher rank = higher risk)
  - **Price Momentum**: 7-day vs 7-day price performance as sentiment proxy
  - **Volatility Social Signal**: 14-day price volatility as attention proxy
- **Mapping**: Higher search attention + bullish momentum + higher volatility = Higher risk
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite with percentile ranking for momentum and volatility components

## Macro Overlay Pillar (10% total weight)

### Macro Overlay (10% weight)
- **Data Source**: FRED API (DXY, 2Y/10Y Treasury, VIX, 10Y TIPS)
- **Window**: 120 days of macro data for trend analysis
- **Transform**: Multi-factor composite (Dollar 40%, Rates 35%, VIX 25%, Real Rates 0%)
  - **Dollar Strength Pressure**: DXY momentum with percentile ranking (stronger dollar = higher risk)
  - **Interest Rate Environment**: Yield level changes + yield curve analysis (higher/inverted = higher risk)
  - **Risk Appetite Gauge**: VIX level + momentum (rising fear = higher risk)
  - **Real Rate Pressure**: 10Y TIPS real yield changes (higher real rates = higher risk)
- **Mapping**: Dollar strength + rising rates + market fear + real rate pressure = Higher risk
- **Staleness TTL**: 1 day
- **Aggregation**: Weighted composite with regime classification and percentile ranking

## Display-Only Features (No Risk Weight)

### BTC⇄Gold Cross-Rates
- **Data Source**: CoinGecko Bitcoin + Metals API/Alpha Vantage/Stooq Gold
- **Window**: Daily close data
- **Transform**: BTC price / Gold price per ounce
- **Mapping**: Display-only (no risk scoring)
- **Status**: ✅ Implemented - provides cross-asset context

### Satoshis per Dollar
- **Data Source**: BTC daily close (Coinbase/CoinGecko)
- **Window**: Daily close data
- **Transform**: sats_per_usd = 100,000,000 / btc_close_usd
- **Mapping**: Display-only (no risk scoring)
- **Status**: ✅ Implemented - provides micro-unit perspective

## Score Aggregation

1. **Individual Factor Scoring**: Each factor produces a 0-100 risk score
2. **Staleness Filtering**: Only fresh factors contribute to composite
3. **Weight Normalization**: Weights re-normalized when factors are stale
4. **Weighted Sum**: Composite = Σ(factor_score × normalized_weight)
5. **Band Assignment**: Composite score mapped to risk band (0-15, 15-35, etc.)

## Data Quality Controls

- **Schema Tripwires**: Detect changes in data source formats
- **Z-Score Tripwires**: Flag extreme statistical outliers
- **Cache Fallbacks**: Use cached data when live sources fail
- **Retry Logic**: Exponential backoff for API failures
- **Validation**: Type checking and range validation for all inputs

## Factor History Tracking

Per-factor historical data is persisted daily for transparency and analysis:

- **CSV-First Approach**: Each factor generates a dedicated CSV file with daily snapshots
- **Idempotent Updates**: One row per day per factor, preventing duplicates
- **Complete Data**: Includes raw values, z-scores, and final risk scores
- **UI Integration**: Factor cards include "History" links for trend analysis
- **Optional Sparklines**: SVG sparklines available via configuration flag
- **Change Tracking**: 7/30/90-day change indicators for trend analysis

**History Files**:
- `stablecoins_30d.csv`: 30-day percentage changes and scores
- `etf_flows_21d.csv`: Daily flows, 21-day sums, and percentiles
- `net_liquidity_20d.csv`: 20-day liquidity deltas and scores
- `mayer_multiple.csv`: Mayer Multiple values and stretch indicators
- `funding_7d.csv`: 7-day funding rate averages and scores
- `dxy_20d.csv`: DXY 20-day changes and macro scores
- `fear_greed.csv`: Fear & Greed Index values and social scores
