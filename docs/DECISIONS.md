# Architecture Decisions

Key technical choices and rationale for the Bitcoin Risk Dashboard.

## 2026-05-07 (continuity): Stablecoins data-quality guard and history artifact upserts

**Decision / continuity:**

1. **Stablecoins:** Reject **non-finite** aggregate growth inputs (e.g. **NaN**) in the Stablecoins factor path instead of letting them flow into percentile-based scoring. Invalid input returns **`score: null`** / **`invalid_stablecoin_growth_input`**; **finite** behavior and weights are unchanged.
2. **`history.csv`:** **Upsert** the row for the current **`daily_close_date` / `y.date`** on each Daily ETL run so same-day reruns **replace** the prior row (no “first write wins” staleness vs **`latest.json`**).
3. **`factor_history.csv`:** Write factor history from the **current ETL run** (in-memory factors + headline composite + SSOT band label) **after** **`latest.json`** is written—not from a pre-write stale read of **`latest.json`**.

**Reason:** Invalid math must not present as a confident numeric official factor score. Same-day pipeline behavior should keep **`latest.json`**, **`history.csv`**, and **`factor_history.csv`** aligned for the same close date where possible.

**Implication:**

- **Current official score** is **`public/data/latest.json`**.
- **Chart history** is **`public/data/history.csv`** (as-published series; not automatically “re-modeled history” without an approved backfill).
- **Factor attribution over time** is **`public/data/factor_history.csv`** (diagnostic).
- **Do not** fake historical recomputes by replaying **live** ETL over past dates—factors are **time-varying**; trustworthy historical recomputation needs **frozen per-day inputs**, not today’s API state.

**Scope:** Data-quality guard + artifact writer consistency only—not G-Score methodology, weights, or risk bands.

---

## 2026-04-19 (continuity): Daily ETL post-check defers to centralized freshness for calendar-sensitive factors

**Decision / continuity:** `runPostComputeHealthCheck()` in `scripts/etl/compute.mjs` must **not** override centralized staleness for factors that are **calendar-sensitive** in SSOT staleness config (`market_dependent` or `business_days_only`) when the pipeline has already marked them **`fresh`** (e.g. `etf_flows` with **`fresh_weekend_data_from_friday`** on Sunday).

**Context:** Sunday Daily ETL failed with a raw wall-clock **`age_exceeds_ttl`** gate while `etf_flows` was correctly **`fresh`** under weekend/business-day rules in **`stalenessUtils.mjs`**.

**Implication:** Centralized freshness logic is the **source of truth** for those factors; avoid adding parallel stricter TTL checks that contradict `checkStaleness` / `getStalenessStatus` outcomes.

**Scope:** Pipeline / freshness-alignment only—not a scoring or G-Score model change. **Node 20** Actions deprecation cleanup on touched ETL-related workflows landed in the same maintenance window.

---

## 2026-04-15 (continuity): Keep simplified Next.js config as production baseline

**Decision:** Treat **`next.config.ts` without custom `webpack` customization** and **without `experimental.optimizePackageImports`** as the **preferred production baseline** for GhostGauge on Vercel.

**Reason:** Deploy instability (including `Unable to find lambda for route: …` while `/methodology` appeared static in build output) was traced to the **build/config layer**—heavy manual `splitChunks` / `cacheGroups`, optimization overrides, and experimental import optimization—not to Methodology page logic. A stock-leaning config restored stable deployments.

**Implication:** Keep Next/Vercel configuration **boring and stable**. Do **not** restore aggressive webpack tuning by default. If bundle metrics justify it later, add **narrow**, **measured** changes and validate on Vercel before merging.

**Related:** `turbopack` SVG rule, `headers`, `images`, `compiler.removeConsole`, and `@next/bundle-analyzer` wrapper remain. **`vercel.json`** was removed earlier to avoid overlapping route/header rules with Next; use project settings or `next.config` for any future edge cases.

---

## 2026-04-15: GhostGauge strategy backtesting — SSOT target state (design only)

**Status:** Target-state **design** decision. **Not** implemented ETL/UI/workflow; see spec for scope.

**Spec:** [`docs/strategy-analysis/BACKTESTING_SSOT_SPEC.md`](strategy-analysis/BACKTESTING_SSOT_SPEC.md)

**Decision (target state):** Official GhostGauge backtesting should converge on **one** canonical methodology: **Baseline DCA vs Risk-Based DCA**, **one** calendar-month-style schedule, **official six-band** naming aligned with `config/dashboard-config.json`, and **band assignment from score + SSOT boundaries (inclusive)** whenever a numeric score exists — **not** from historical CSV `band` strings as primary. Legacy labels remain **fallback** for older/incomplete rows. **Value averaging** stays **exploratory / secondary**, not co-equal official headline without capital context.

**Rationale:** Reduces methodology drift between artifacts, aligns backtests with live boundary behavior, and records inclusive-boundary guardrails before implementation work.

**Implementation:** Deferred; future ETL changes must reference the spec and this entry.

---

## 2025-01-27: Risk Band Configuration - Single Source of Truth

**Decision**: Centralized risk band configuration in `config/dashboard-config.json`

**Context**: Risk band ranges and colors were hardcoded in multiple locations, leading to inconsistencies

**Options Considered**:
1. Keep hardcoded values in each component (current state)
2. Centralize in `lib/riskConfig.ts` only
3. Use `config/dashboard-config.json` as single source of truth

**Chosen Solution**: `config/dashboard-config.json` as single source of truth

**Rationale**:
- **Consistency**: All components (UI, ETL, API) use identical configuration
- **Maintainability**: Update ranges/colors in one place without code changes
- **Transparency**: Configuration is visible and version-controlled
- **Flexibility**: Easy to adjust risk bands without deployment
- **Robustness**: Fallback mechanisms prevent system failures

**Implementation**:
- `lib/riskConfig.ts`: Loads bands from `dashboard-config.json` for UI components
- `scripts/etl/compute.mjs`: Loads bands from `dashboard-config.json` for ETL processing
- All components now use consistent colors and non-overlapping ranges
- G-score calculation remains unaffected (bands only used for display/labeling)

**Benefits**:
- Single source of truth eliminates inconsistencies
- Easy maintenance without code changes
- Consistent user experience across all components
- Robust fallback mechanisms ensure system reliability

## 2025-09-17: Adopted Brand Card v1.1 (GhostGauge) as single source of truth for voice, naming, bands

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

## 2025-01-20: Standardized Trend & Valuation Methodology Language

**Decision**: Replaced vendor-/person-referencing phrasing with neutral "Cycle-Anchored Trend (BMSB-led)" language

**Context**: Historical references to "Next-Level Cowen" created legal, attribution, and expectation risks while being less clear to new users

**Options Considered**:
1. Keep existing "Next-Level Cowen" terminology
2. Replace with generic "trend analysis" language
3. Use descriptive "Cycle-Anchored Trend" terminology

**Chosen Solution**: Cycle-Anchored Trend (BMSB-led) approach

**Implementation**:
- Updated all references in app, docs, and config files
- Maintained exact same mathematics (BMSB 60%, Mayer 30%, RSI 10%)
- Added clear explanations of BMSB as cycle anchor
- Updated brand guidelines to avoid personal names

**Rationale**:
- **Clarity**: Plain-English explanation of BMSB distance as cycle anchor
- **Neutrality**: Avoids personal names and implied endorsements
- **Brand hygiene**: Reduces legal and trademark risks
- **Transparency**: Keeps mathematical approach and weights visible
- **Consistency**: Aligns language across all product touchpoints

**No Model Changes**: This is purely a copy/language update - all calculations, weights, and mathematical approaches remain identical

**Trade-offs**:
- Need to update documentation and user communications
- Loss of historical terminology familiarity
- Requires consistent application across all materials
