# Roadmap

Development timeline for the next 4-6 weeks.

## Week 1-2: BTC⇄Gold Panel

### ETL Integration
- [ ] Add gold price data source (Metals API or alternative)
- [ ] Implement BTC/Gold ratio calculation in ETL pipeline
- [ ] Add gold cross-rates to `latest.json` schema
- [ ] Create historical baseline for ratio percentiles

### UI Component
- [ ] Design BTC⇄Gold comparison card
- [ ] Show current ratio and 1-year percentile
- [ ] Display both BTC per ounce and ounces per BTC
- [ ] Add trend indicators and historical context

### Data Artifacts
- [ ] Generate `extras/gold_cross.json` artifact
- [ ] Update `ARTIFACT_SCHEMAS.md` with gold data contracts
- [ ] Add gold price to `history.csv` for historical tracking

## Week 3-4: Factor History & Mini Sparklines

### Historical Factor Data
- [ ] Extend ETL to track individual factor scores over time
- [ ] Create `signals/factor_history.csv` with daily factor scores
- [ ] Implement factor-specific historical baselines
- [ ] Add factor staleness tracking and alerts

### Mini Sparklines
- [ ] Design compact sparkline components for factor cards
- [ ] Show 30-day trend for each factor
- [ ] Add hover tooltips with detailed historical data
- [ ] Implement color coding for trend direction

### Enhanced Factor Details
- [ ] Add historical percentile context to factor details
- [ ] Show factor-specific volatility metrics
- [ ] Display correlation coefficients between factors
- [ ] Add factor performance attribution analysis

## Week 5-6: Alerts & Macro Redundancy

### Alert System
- [ ] Implement ETF zero-cross alerts (inflows to outflows)
- [ ] Add risk band change notifications
- [ ] Create factor staleness alerts
- [ ] Design alert management UI

### Macro Redundancy
- [ ] Add alternative macro data sources
- [ ] Implement macro factor redundancy checks
- [ ] Create macro stress indicator composite
- [ ] Add macro factor correlation analysis

### ETF Backfill Enhancement
- [ ] Extend ETF backfill to full inception history
- [ ] Improve ETF data parsing robustness
- [ ] Add individual ETF performance tracking
- [ ] Create ETF flow prediction models

## Week 7-8: Basic Backtests

### Historical Analysis
- [ ] Implement backtesting framework for risk bands
- [ ] Calculate historical performance of risk-based strategies
- [ ] Add factor performance attribution over time
- [ ] Create risk-adjusted return metrics

### Strategy Validation
- [ ] Test DCA vs. risk-based allocation strategies
- [ ] Analyze factor effectiveness over different market cycles
- [ ] Validate risk band performance across market conditions
- [ ] Create strategy comparison tools

## Future Considerations (Beyond 8 Weeks)

### Advanced Features
- [ ] Multi-timeframe analysis (1d, 1w, 1m risk scores)
- [ ] Portfolio optimization integration
- [ ] Real-time streaming data updates
- [ ] Mobile app development

### Data Enhancements
- [ ] Additional on-chain metrics (MVRV, NUPL, etc.)
- [ ] Social sentiment from multiple sources
- [ ] Institutional flow tracking
- [ ] Macro-economic leading indicators

### Infrastructure
- [ ] Database migration from JSON artifacts
- [ ] Real-time data streaming architecture
- [ ] Advanced caching and CDN optimization
- [ ] Multi-region deployment

## Success Metrics

### Technical
- [ ] 99.9% uptime for ETL pipeline
- [ ] <2 second dashboard load times
- [ ] 100% factor data freshness
- [ ] Zero data quality issues

### User Experience
- [ ] Intuitive factor explanations
- [ ] Clear risk band recommendations
- [ ] Responsive design across devices
- [ ] Fast refresh and update cycles

### Data Quality
- [ ] Robust error handling for all data sources
- [ ] Comprehensive data validation
- [ ] Historical data completeness
- [ ] Real-time data accuracy
