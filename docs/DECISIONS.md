# Architecture Decisions

Key technical choices and rationale for the Bitcoin Risk Dashboard.

## 2025-09-17: ETL Commits Artifacts

**Decision**: ETL pipeline generates and commits data artifacts to repository

**Context**: Need reliable data source for dashboard that works in serverless environment

**Options Considered**:
1. Database storage (PostgreSQL, MongoDB)
2. External data service (AWS S3, Google Cloud Storage)
3. Repository artifacts (JSON files in public directory)

**Chosen Solution**: Repository artifacts

**Rationale**:
- Works seamlessly with Vercel's read-only filesystem
- Provides version control for data changes
- Enables easy rollback of data issues
- Simplifies deployment and reduces external dependencies
- Allows for data transparency and auditability

**Trade-offs**:
- Repository size grows over time
- Git history includes data changes
- Requires careful handling of large files

## 2025-09-17: ETF Flows Robustness with Schema Hash/Z-Tripwire/Cache

**Decision**: Implement multiple layers of robustness for ETF flows data

**Context**: Farside Investors HTML structure can change, causing parsing failures

**Options Considered**:
1. Simple HTML parsing with basic error handling
2. Multiple fallback URLs with retry logic
3. Comprehensive robustness system with schema validation

**Chosen Solution**: Multi-layer robustness system

**Components**:
- **Schema Hash Tripwire**: Detect HTML structure changes
- **Z-Score Tripwire**: Flag extreme statistical outliers
- **Cache System**: Store raw HTML for fallback when live fetch fails
- **Multiple URLs**: Try different Farside endpoints
- **Individual ETF Parsing**: Extract granular ETF data alongside totals

**Rationale**:
- Ensures data reliability even when source changes
- Provides early warning of data quality issues
- Enables detailed ETF breakdown analysis
- Maintains service availability during source outages

**Trade-offs**:
- Increased complexity in parsing logic
- Additional storage requirements for cache
- More sophisticated error handling needed

## 2025-09-17: BTC⇄Gold via Licensed-Friendly Sources

**Decision**: Use licensed-friendly data sources for gold price data

**Context**: Need reliable gold price data for BTC⇄Gold ratio calculations

**Options Considered**:
1. Free APIs with usage limits (CoinGecko, Alpha Vantage)
2. Premium APIs with licensing costs (Metals API, Quandl)
3. Multiple free sources with redundancy

**Chosen Solution**: Multi-source fallback chain with licensed-friendly priority

**Implementation**:
- **Primary**: Metals API (requires API key, professional grade)
- **Secondary**: Alpha Vantage (free tier, 25/day limit)
- **Fallback**: Stooq CSV (no key required, reliable)
- **Provenance tracking**: All sources tracked in status.json
- **Daily cadence**: Aligned with Bitcoin daily closes

**Rationale**:
- Ensures long-term data availability through fallback chain
- Avoids rate limiting issues with multiple sources
- Provides professional-grade data quality when available
- Supports commercial usage requirements
- Graceful degradation when premium sources unavailable

**Implementation Status**: ✅ Completed - ETL generates gold_cross.json and btc_xau.csv

**Trade-offs**:
- Additional API costs for premium sources
- More complex integration requirements
- Need for API key management
- Fallback sources may have lower data quality

## 2025-09-17: Refresh API Uses ETL Data for Consistency

**Decision**: Refresh endpoint prioritizes ETL data over real-time computation

**Context**: Need consistent data between initial load and refresh actions

**Options Considered**:
1. Always compute fresh data on refresh
2. Always use cached ETL data
3. Hybrid approach with ETL priority

**Chosen Solution**: Hybrid approach with ETL priority

**Implementation**:
- POST requests (refresh) force real-time computation
- GET requests (initial load) use ETL data
- Fallback to real-time if ETL data unavailable

**Rationale**:
- Maintains data consistency across user interactions
- Provides fresh data when explicitly requested
- Ensures reliability through ETL data fallback
- Balances performance with data freshness

**Trade-offs**:
- Slightly more complex API logic
- Potential confusion about data sources
- Need for clear user communication

## 2025-09-17: Individual ETF Data Extraction

**Decision**: Extract and store individual ETF flows alongside aggregate totals

**Context**: Users need granular insights into specific ETF performance

**Options Considered**:
1. Only store aggregate ETF flows
2. Store individual ETF data in separate artifacts
3. Include individual ETF data in main factor response

**Chosen Solution**: Include individual ETF data in main factor response

**Implementation**:
- Enhanced HTML parsing to extract individual ETF columns
- Added `individualEtfFlows` field to factor results
- Created dedicated ETF table component
- Updated TypeScript interfaces for type safety

**Rationale**:
- Provides valuable granular insights
- Enables detailed ETF performance analysis
- Maintains data consistency with aggregate flows
- Supports future ETF-specific features

**Trade-offs**:
- Increased data payload size
- More complex parsing logic
- Additional UI component maintenance

## 2025-09-17: Multi-Factor On-chain Activity Calculation

**Decision**: Combine multiple blockchain metrics for comprehensive activity assessment

**Context**: Single metric (transaction fees) insufficient for network activity

**Options Considered**:
1. Use only transaction fees
2. Use only transaction count
3. Combine multiple metrics with weighted scoring

**Chosen Solution**: Multi-factor composite with weighted scoring

**Implementation**:
- Transaction fees: 40% weight
- Transaction count: 30% weight  
- Hash rate: 30% weight
- Graceful handling of missing data
- Enhanced display with factor breakdown

**Rationale**:
- Provides more comprehensive network assessment
- Reduces impact of single metric anomalies
- Enables better risk scoring accuracy
- Maintains robustness when some data unavailable

**Trade-offs**:
- Increased complexity in calculation
- More API calls required
- Potential for data inconsistency across metrics
