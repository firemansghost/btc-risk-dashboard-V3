# Factor Specifications

Mathematical contracts for all risk factors in the Bitcoin Risk Dashboard.

## Liquidity Pillar (40% total weight)

### Net Liquidity (10% weight)
- **Data Source**: FRED API (WALCL, RRPONTSYD, WTREGEN)
- **Window**: 1 year of weekly data
- **Transform**: Net Liquidity = Fed Balance Sheet - Reverse Repo - Treasury General Account
- **Mapping**: Higher liquidity = Lower risk (inverted)
- **Staleness TTL**: 7 days
- **Aggregation**: Latest value percentile vs. 1-year history

### Stablecoins (15% weight)
- **Data Source**: CoinGecko USDC market cap
- **Window**: 90 days of daily data
- **Transform**: 30-day percentage change in USDC market cap
- **Mapping**: Higher supply growth = Lower risk (inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Current 30d change percentile vs. historical 30d changes

### ETF Flows (10% weight)
- **Data Source**: Farside Investors HTML scraping
- **Window**: 21-day rolling sum
- **Transform**: Sum of daily Bitcoin ETF flows over 21 days
- **Mapping**: Higher flows = Lower risk (inverted)
- **Staleness TTL**: 5 days
- **Aggregation**: Current 21d sum percentile vs. historical baseline (274 data points)

### On-chain Activity (5% weight, counts toward Momentum)
- **Data Source**: Blockchain.info (transaction fees, transaction count, hash rate)
- **Window**: 30 days of daily data
- **Transform**: Composite score (40% fees + 30% tx count + 30% hash rate)
- **Mapping**: Higher activity = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Multi-factor percentile ranking

## Momentum Pillar (25% total weight)

### Trend & Valuation (25% weight)
- **Data Source**: CoinGecko Bitcoin price data
- **Window**: 200 days of daily data
- **Transform**: Mayer Multiple (Price / 200-day SMA)
- **Mapping**: Higher multiple = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Current Mayer Multiple percentile vs. historical multiples

## Leverage Pillar (20% total weight)

### Term Structure & Leverage (20% weight)
- **Data Source**: CoinGecko Bitcoin price data
- **Window**: 30 days of daily data
- **Transform**: 7-day percentage change in Bitcoin price
- **Mapping**: Higher volatility = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Current 7d change percentile vs. historical 7d changes

## Social Pillar (5% total weight)

### Social Interest (5% weight)
- **Data Source**: Alternative.me Fear & Greed Index
- **Window**: 1 year of daily data
- **Transform**: Raw Fear & Greed Index value (0-100)
- **Mapping**: Higher greed = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Current value percentile vs. 1-year history

## Macro Pillar (5% total weight)

### Macro Overlay (5% weight)
- **Data Source**: FRED API (DXY, 2Y Treasury, VIX)
- **Window**: 20 days of daily data
- **Transform**: Composite macro stress indicator
- **Mapping**: Higher stress = Higher risk (not inverted)
- **Staleness TTL**: 1 day
- **Aggregation**: Multi-factor percentile ranking

## Planned: BTC⇄Gold Panel

### BTC/Gold Ratio (planned, no risk weight yet)
- **Data Source**: CoinGecko Bitcoin + Metals API Gold
- **Window**: 1 year of daily data
- **Transform**: BTC price / Gold price per ounce
- **Mapping**: TBD (ratios only, no risk scoring)
- **Status**: Schema documented but not implemented

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
