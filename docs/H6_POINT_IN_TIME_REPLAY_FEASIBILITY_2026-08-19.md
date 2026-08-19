# H6 Point-in-Time Replay Feasibility Audit

**Date:** 2026-08-19  
**Repository:** firemansghost/btc-risk-dashboard-V3  
**Branch:** `research/h6-point-in-time-replay-feasibility`  
**H6_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`  
**H6_VERSION:** `h6-pit-feasibility-v1`  
**Production model at source SHA:** `v1.1.1`  
**Implementation revision:** `integrity-2026-08`  
**SSOT version:** `2.1.1`  
**H5.1 interpretation closeout:** `docs/H5_1_RISK_OUTCOME_INTERPRETATION_2026-08-19.md`  
**H5.1 interpretation blob:** `d6978aa9de6c53dd24ff9a1ca3cfd32eece2cf19`  
**Calibration gate:** CLOSED

This document is an evidence map. It does not calculate historical G-Scores, historical factor scores, composites, H4 forward returns, or H5 risk outcomes.

---

## 1. Executive conclusion

**DECISION:** Exact historical production replay of current `v1.1.1` is **NO**.

**DECISION:** Validation-grade current-methodology replay of the full seven-factor composite is **NOT ESTABLISHED** and, on present evidence, is **NO**.

**DECISION:** Earliest defensible contiguous full-model date = **NONE / NOT ESTABLISHED**. No date is manufactured.

**FACT:** The current enabled scored universe is seven factors whose weights sum to 1.0. Full exact production replay on date T requires all seven to be `A_EXACT_POINT_IN_TIME` on T. Validation-grade methodology replay requires all seven to be `A` or `B` with no `C`/`D`/`U` scored component.

**EVIDENCE:** `social_interest.coingecko_trending_rank` carries official subweight 0.70. CoinGecko `GET /search/trending` is a live last-24h snapshot. Official CoinGecko documentation reviewed on 2026-08-19 does not expose a historical trending-rank endpoint.

**DECISION:** That component is `D_NOT_REPLAYABLE`. Historical BTC price momentum (subweight 0.30) cannot recreate the factor. Google Trends, Fear & Greed, neutral-fill, and backsolving from historical Social scores are forbidden and were not used.

**LIMITATION:** Independently of social interest, several other enabled factors remain `U_UNRESOLVED` or `C_EXPLORATORY_ONLY` (UTC intraday snapshot price, FRED-without-vintage, Farside table mutability, hardcoded stablecoin basket including BUSD, funding fallback identity). Any one `C`/`D`/`U` factor would already block full validation-grade composite replay.

**DECISION:** Recommended next step is **NO HISTORICAL REPLAY** of the current seven-factor model. Do not begin a replay implementation. Do not calculate historical scores.

---

## 2. Scope and hard firewall

H6 determines whether the **current** `v1.1.1` methodology can be reconstructed historically without lookahead contamination, and if so which factors, from what earliest date, using what source evidence, at what fidelity, with what unresolved limitations.

H6 does **not**:

- calculate any historical G-Score or factor score
- calculate composites, alternate scores, H4 returns, or H5 outcomes
- regenerate H4 / H4.1 / H5 / H5.1
- run ETL or `npm run etl:compute`
- use Refresh Dashboard
- change weights, subweights, formulas, bands, thresholds, or recommendations
- modify production code or `public/data/**` / `public/signals/**`
- create synthetic historical factor values or fill missing observations
- assume current API historical responses equal point-in-time historical truth

**FACT:** No backtest began in H6. Calibration remains CLOSED.

Companion files (exactly four outputs in this work):

1. `docs/H6_POINT_IN_TIME_REPLAY_FEASIBILITY_2026-08-19.md` (this file)
2. `research/point-in-time-replay/README.md`
3. `research/point-in-time-replay/source_requirements.csv`
4. `research/point-in-time-replay/factor_feasibility.csv`

---

## 3. Current v1.1.1 implementation identity

**FACT:** `origin/main` at audit start equals `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`. H6 branched from that SHA exactly. `H6_SOURCE_SHA` is frozen to that commit.

**FACT:** `docs/H5_1_RISK_OUTCOME_INTERPRETATION_2026-08-19.md` exists on that commit with blob `d6978aa9de6c53dd24ff9a1ca3cfd32eece2cf19`.

**FACT:** Implementation authority is current code and `config/dashboard-config.json`, not older prose and not `config/subweights.json`.

**EVIDENCE — identity fields** from `config/dashboard-config.json` blob `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49`:

- `model_version`: `v1.1.1`
- `implementation_revision`: `integrity-2026-08`
- `ssot_version`: `2.1.1`

**EVIDENCE — material implementation blobs at `H6_SOURCE_SHA`:**

| Path | Blob SHA | Role |
|---|---|---|
| `config/dashboard-config.json` | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` | SSOT weights, enabled flags, official subweights |
| `scripts/etl/lib/ssotSubweights.mjs` | `c33e13a92cbc75697e51ea3face379f503a40924` | Locked official blends; production blend gate |
| `scripts/etl/factors.mjs` | `e9fd06df79967f0041a901e2dd971b771e669b03` | Stablecoins, ETF, net liquidity, term leverage, macro, social |
| `scripts/etl/factors/trendValuation.mjs` | `75046b4d47d73144f56c339c0461bdd4b6bf21b1` | BMSB, Mayer, weekly RSI |
| `scripts/etl/lib/snapshotPrice.mjs` | `d49c9486e0d75bdeecd8b4aa287cb07f6350e34e` | `utc_intraday_snapshot` semantics |
| `scripts/etl/lib/completedPeriods.mjs` | `a22a5a7efce828904a5881332d68098f956590fc` | Completed UTC period truncation |
| `scripts/etl/priceHistory.mjs` | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` | Unified completed daily close CSV |
| `scripts/etl/compute.mjs` | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` | Orchestration and snapshot selection |
| `scripts/etl/lib/macroFreshness.mjs` | `7781aedb1941d4052aa1f90c20f52615abb7d979` | 11:xx UTC vs US release timing |
| `scripts/etl/lib/termFreshness.mjs` | `bc889e6b50f50c52b5d673c1d7f709ffe05c32e0` | Funding cadence, grace, provider selection |
| `scripts/etl/factors/stablecoinGrowthAggregation.mjs` | `338ed9046643ab5ccc3fa7f892d4628fe8b55fb4` | Stablecoin growth aggregation |
| `scripts/etl/factors/stablecoinGrowthGuard.mjs` | `3728eb0f7bc2ecdf5faa35edde564a735c9c6bb2` | Min coins / weight guard |
| `lib/config-loader.mjs` | `8f439254ca813050703a7c17bcd658474c19e2b2` | Runtime config load |

**FACT — code-vs-docs discrepancy:** `config/subweights.json` blob `e6cbb244e9ff6871e784a023e9e8e9f09e9a923d` still lists `social_interest.google_trends` / `fear_greed` and `term_leverage.funding_7d` / `basis_front` / `oi_mcap`. That file is **not** implementation authority.

**DECISION:** CODE WINS. Production subweights are `dashboard-config.json` `subweights` plus `LOCKED_OFFICIAL_BLENDS` in `ssotSubweights.mjs`.

Additional comment-level discrepancies inside `factors.mjs` (stale 40/35/25 social comments; stale net-liquidity 30/40/30 comments; stale ETF 40/30/30 comments) are not SSOT. Locked blends win.

---

## 4. Replay fidelity definitions

Three concepts are never treated as equivalent.

### A. Exact production replay

Reconstruct the observation the production pipeline would have produced at historical time T, including exact source/provider selected, exact source value as available then, exact publication/release timing, exact fallback behavior, exact cache state if material, exact current/snapshot price semantics, exact formula, exact completed-period logic, and exact availability before `as_of_utc`.

### B. Point-in-time methodology replay

Reconstruct current `v1.1.1` mathematics using genuine point-in-time inputs knowable at T, without claiming the exact historical operational provider/fallback/cache state. Any source substitution must be the same underlying measurement and itself point-in-time safe.

This can potentially be validation-grade methodology evidence. It is **not** exact production replay.

### C. Exploratory reconstruction

Uses inputs that are revised later, backfilled later, reconstructed later, proxy substituted, unavailable with exact release timing, or not provably knowable at T.

This can be research context only. It is **not** validation-grade.

---

## 5. Evidence hierarchy

Strongest available evidence, in order:

1. Current pinned production code/config
2. Contemporaneous Git artifacts with source timestamps/provenance
3. Official immutable/versioned source documentation or vintage system
4. Official mutable provider documentation/pages
5. Archived historical provider pages
6. Reliable third-party archival evidence
7. Inference

**DECISION:** Category 7 is never promoted to fact.

**DECISION:** Existing synthetic/reconstructed factor histories committed in Git are not strong point-in-time source evidence merely because they are committed. H3 contamination classifications remain in force. H4/H5 reconstructed score rows are not raw-source evidence and must not be backsolved.

---

## 6. Point-in-time knowability standard

A historical value is eligible only if it could reasonably have been known by the hypothetical GhostGauge run's `as_of_utc`.

Do not confuse:

- observation date
- publication/release time
- fetch time
- later revision time

**FACT:** Typical production cadence encoded in freshness modules is an ~11:xx UTC run. Same-day US macro prints and Thursday H.4.1 WALCL are often **not** yet knowable at that clock time.

**FACT:** A provider returning a value for historical date D **today** does not prove that the same value was available on D.

**DECISION:** If release time is unknown and material, classification cannot silently be `A`. This audit uses `U` or lower as warranted. No historical endpoint was treated as automatically point-in-time safe.

---

## 7. Full current factor dependency map

**FACT — enabled scored factors and weights** from `config/dashboard-config.json`:

| factor_key | enabled | weight |
|---|---|---|
| trend_valuation | true | 0.30 |
| stablecoins | true | 0.18 |
| etf_flows | true | 0.077 |
| net_liquidity | true | 0.043 |
| term_leverage | true | 0.20 |
| macro_overlay | true | 0.10 |
| social_interest | true | 0.10 |
| onchain | false | 0.00 |

Weight sum of the seven enabled factors = 1.0.

**FACT — official subweights** from `dashboard-config.json` and `LOCKED_OFFICIAL_BLENDS`:

| Factor | Component | Subweight |
|---|---|---|
| trend_valuation | bmsb_distance | 0.60 |
| trend_valuation | mayer_stretch | 0.30 |
| trend_valuation | weekly_rsi | 0.10 |
| stablecoins | supply_growth | 0.55 |
| stablecoins | momentum | 0.30 |
| stablecoins | concentration | 0.15 |
| etf_flows | sum_21d | 0.30 |
| etf_flows | acceleration | 0.30 |
| etf_flows | diversification | 0.40 |
| net_liquidity | level | 0.15 |
| net_liquidity | rate_of_change | 0.40 |
| net_liquidity | momentum | 0.45 |
| term_leverage | funding | 0.40 |
| term_leverage | realized_vol | 0.35 |
| term_leverage | stress | 0.25 |
| macro_overlay | dxy_20d | 0.40 |
| macro_overlay | us2y_20d | 0.35 |
| macro_overlay | vix_pct | 0.25 |
| social_interest | coingecko_trending_rank | 0.70 |
| social_interest | btc_price_momentum_7d | 0.30 |

**FACT:** On-chain is disabled / weight 0 and does **not** block full current composite replay.

**FACT:** Market Regime, Cycle Timing, Gold, and Sats are display-only and do **not** block replay.

**DECISION:** Factor methodology replay can only be `A` or `B` if **all** scored components can be reconstructed from point-in-time-safe inputs. Feasibility is not averaged across components.

---

## 8. Trend & Valuation audit

**FACT:** Current scored components are BMSB distance 0.60, Mayer stretch 0.30, weekly RSI 0.10.

**FACT:** `calculateBMSB` requires at least 22 completed UTC weekly closes (20-week SMA and 21-week EMA). Snapshot price is passed into BMSB as the distance numerator.

**FACT:** Mayer stretch = snapshot / SMA200 of **completed** UTC daily closes (`sma200DenominatorCloses`), then percentile over the Mayer series.

**FACT:** Weekly RSI(14) uses completed weekly closes, then percentile over the RSI series. Weekly RSI does **not** use the intraday snapshot as its RSI input.

**FACT:** `selectSnapshotFromDailyCandles` / `utc_intraday_snapshot` selects the still-open UTC daily Coinbase candle at the typical ~11:00 UTC run. That is a different measurement from the completed daily close.

**EVIDENCE:** `scripts/etl/lib/snapshotPrice.mjs` blob `d49c9486e0d75bdeecd8b4aa287cb07f6350e34e`.

**LIMITATION:** Recreating the factor from completed daily closes alone is **not** current methodology for BMSB or Mayer.

**LIMITATION:** Ranking historical T against a later-complete Mayer or RSI file that includes T+1…today is a lookahead hazard. A replay implementation must truncate rank universes at T.

**LIMITATION:** Coinbase vs CoinGecko price-history fallback identity at historical T is not reconstructable from Git as an outage log.

**EVIDENCE:** H3 / `latest.json` observation artifacts capture some contemporaneous `price_usd` values in the operational window beginning 2025-09. Those are isolated published snapshots, not a contiguous 200-day + 22-week PIT archive from an arbitrary start date. Reconstructed `btc_price_history.csv` is a completed-close series, not a snapshot archive.

**INFERENCE:** Coinbase hourly or minute candles *might* reconstruct the still-open UTC daily candle at 11:xx. This audit did not fetch those candles and did not compute any prices. Reconstruction remains unproven.

**DECISION:**

- `exact_production_replay_class`: `U_UNRESOLVED`
- `methodology_replay_class`: `U_UNRESOLVED`
- contiguous exact coverage: `UNKNOWN`
- contiguous method coverage: `UNKNOWN`
- primary blocker: `utc_intraday_snapshot` vs completed close
- confidence: `MEDIUM`

Weekly RSI in isolation could be method-equivalent from truncated completed weekly closes (`B` at component level in `source_requirements.csv`). The factor cannot be `B` while BMSB and Mayer remain `U`.

---

## 9. Stablecoins audit

**FACT:** Official components are supply_growth 0.55, momentum 0.30, concentration 0.15.

**FACT:** Current code hardcodes a 7-coin basket and weights: USDT 0.55, USDC 0.25, DAI 0.05, BUSD 0.03, TUSD 0.02, FRAX 0.02, LUSD 0.01.

**FACT:** Guard requires at least 3 coins and ≥70% of configured weight.

**FACT:** Source hierarchy is CoinGecko `market_chart` (~30d daily) primary, then CoinMarketCap historical, then CryptoCompare histoday.

**FACT:** Percentile scoring uses `public/data/stablecoins-historical.json` 365-day rolling `changeSeries`. Using today's complete file as the rank universe for historical T is lookahead.

**LIMITATION:** Reconstructing date T with **today's** basket membership, including discontinued BUSD, is not point-in-time market structure. Delisted, depegged, or rebranded stablecoins are not recovered from current metadata.

**LIMITATION:** CoinGecko/CMC/CryptoCompare historical market-cap series returned today can be revised or backfilled. A current historical endpoint is not a vintage archive.

**EVIDENCE:** Git tracks dated `public/data/cache/stablecoins/YYYY-MM-DD.json` from 2025-10-04 through 2026-08-19. That window is contemporaneous cache evidence for those dates only. It does not cover a 365-day burn-in before October 2025.

**DECISION:**

- exact: `C_EXPLORATORY_ONLY`
- methodology: `C_EXPLORATORY_ONLY`
- contiguous exact: `INTERMITTENT` (Git caches)
- contiguous method: `UNKNOWN`
- primary blocker: anachronistic hardcoded basket / BUSD
- confidence: `HIGH`

---

## 10. ETF Flows audit

**FACT:** Official components are sum_21d 0.30, acceleration 0.30, diversification 0.40.

**FACT:** Current implementation scrapes Farside HTML (`farside.co.uk/bitcoin-etf-flow-all-data/` and fallbacks), caches `public/data/cache/etf/YYYY-MM-DD.html`, selects published rows versus `as_of`, computes a 21-**business-day** rolling sum, 7d vs prior 7d acceleration, and HHI on individual ETF columns.

**FACT:** Percentile scoring versus `public/data/etf-flows-historical.json` must not use a later-complete universe to rank historical T.

**EVIDENCE:** US spot Bitcoin ETFs first traded on 2024-01-11 (issuer/Reuters contemporaneous reporting). Pre-inception zeros or weight renormalization are **not** full current-model replay.

**INFERENCE:** 21 business-day burn-in after 2024-01-11 yields an earliest *exploratory* candidate around 2024-02-12. That date is feasibility arithmetic only. It is **not** a validation-grade start date because Farside is a mutable published table.

**LIMITATION:** A Farside value retrieved today for date D is not proof of the table as knowable at T. Corrections and later-added funds can rewrite the all-data table.

**EVIDENCE:** Git-tracked ETF HTML exists from 2025-10-07 through 2026-08-19 (~305 files). That is intermittent contemporaneous capture, not a PIT archive from market inception.

**DECISION:**

- exact: `C_EXPLORATORY_ONLY`
- methodology: `C_EXPLORATORY_ONLY`
- earliest exact candidate: `2025-10-07` (first Git HTML date; still not vintage-controlled publication state)
- earliest method candidate: not established for validation
- contiguous exact: `INTERMITTENT`
- contiguous method: `UNKNOWN`
- primary blocker: Farside mutability / lack of vintage
- confidence: `HIGH`

---

## 11. Net Liquidity audit

**FACT:** Official components are level 0.15, rate_of_change 0.40, momentum 0.45. Comments elsewhere that still say 30/40/30 are stale. CODE WINS.

**FACT:** Production fetches FRED series `WALCL`, `RRPONTSYD`, `WTREGEN` over a 365-day window. Net liquidity = WALCL − RRP − TGA. Minimum 8 weeks; 12 weeks for momentum; 4-week rate of change.

**FACT:** Current FRED `observations` responses are **latest revised** values, not the vintage known at T.

**EVIDENCE:** FRED ALFRED documents `realtime_start` / `realtime_end` / `vintage_dates` as the official vintage mechanism ([FRED ALFRED API](https://fred.stlouisfed.org/docs/api/fred/alfred.html)). This audit did **not** retrieve vintage catalogs and did **not** compute net-liquidity values.

**EVIDENCE:** WALCL is an H.4.1 series. The Board publishes H.4.1 on Thursday at about 4:30 p.m. ET for the prior Wednesday ([H.4.1](https://www.federalreserve.gov/releases/h41/)). A typical 11:xx UTC Thursday run cannot yet have that release.

**LIMITATION:** Production cache fallback `success_cached_fred_error` means exact production replay requires knowing whether live FRED failed and whether an older cache was used. Git does not store a dated FRED vintage/outage log.

**DECISION:** ALFRED *may* later support method-equivalent vintage control. Completeness of vintages for all three series at 11:xx UTC alignment is **not proven**. Classification is therefore not `B`.

**DECISION:**

- exact: `U_UNRESOLVED`
- methodology: `U_UNRESOLVED`
- contiguous coverage: `UNKNOWN`
- primary blocker: latest FRED ≠ vintage known at T
- confidence: `MEDIUM`

---

## 12. Term Structure & Leverage audit

**FACT:** Official components are funding 0.40, realized_vol 0.35, stress 0.25. Stale `config/subweights.json` keys `funding_7d` / `basis_front` / `oi_mcap` are not current.

**FACT:** Production funding fallback is BitMEX → Binance → OKX via `selectFundingProvider`. BitMEX slots 04/12/20 UTC; Binance/OKX typically 00/08/16 UTC, with publication grace in `termFreshness.mjs`.

**FACT:** Realized vol and stress use a 30-day CoinGecko daily spot `market_chart` plus the selected funding series.

**LIMITATION:** Exact production replay requires knowing which venue won at T, whether primary was unavailable, and whether cache preserved an older observation. Git has no dated provider-selection log.

**LIMITATION:** Historical funding retention, instrument continuity, and unit/formula differences by venue were not proven in this audit. This audit did not hit exchange APIs to pull funding histories.

**LIMITATION:** CoinGecko 30-day daily spot returned today is a current historical response, not a vintage snapshot of what CoinGecko returned at T.

**DECISION:** A later canonical-venue method-equivalent path is conceivable if one venue's 30-day history is complete and point-in-time safe. It is **not established**.

**DECISION:**

- exact: `U_UNRESOLVED`
- methodology: `U_UNRESOLVED`
- contiguous coverage: `UNKNOWN`
- primary blocker: fallback identity + unproven historical retention
- confidence: `MEDIUM`

---

## 13. Macro Overlay audit

**FACT:** Official scored blend is `dxy_20d` 0.40 (`DTWEXBGS`), `us2y_20d` 0.35 (`DGS2`, plus inversion bonus using `DGS10`), `vix_pct` 0.25 (`VIXCLS`).

**FACT:** Code also fetches `DFII10`. `realRateScore` is computed and **not** in `LOCKED_OFFICIAL_BLENDS`. `DGS10` **does** affect the scored `us2y_20d` path via a +15 inversion bonus when 10Y−2Y < 0.

**FACT:** Fetch window is 120 days; ≥30 observations each for DXY/DGS2/VIX; 20-session changes; VIX percentile over the fetched window.

**EVIDENCE:** `macroFreshness.mjs` encodes that same-day US H.15 / DGS2 / VIX prints are often not knowable at 11:00 UTC.

**LIMITATION:** Current FRED is revised. Ranking historical T against today's complete 120-day VIX window is lookahead.

**LIMITATION:** Aligning rows by calendar date, ignoring 11:xx UTC knowability, would not reproduce production semantics.

**DECISION:**

- exact: `U_UNRESOLVED`
- methodology: `U_UNRESOLVED`
- contiguous coverage: `UNKNOWN`
- primary blocker: 11:xx UTC knowability + lack of vintage control
- confidence: `MEDIUM`

---

## 14. Social Interest audit

**FACT:** Official scored components are CoinGecko trending rank 0.70 and BTC 7-day price momentum 0.30.

**FACT:** Comments in `factors.mjs` that still describe a 40/35/25 blend including volatility are stale. Volatility may be computed internally; it is **not** in the official blend. CODE WINS.

**EVIDENCE:** CoinGecko trending-search documentation ([trending-search](https://docs.coingecko.com/reference/trending-search), accessed 2026-08-19) describes a current last-24h trending snapshot. No official historical trending-rank endpoint was found.

**EVIDENCE:** Git tracks a single overwritten file `public/data/cache/social_interest/social_interest_cache.json`, updated by ETL artifact commits. That is not a dated official trending archive and does not establish contiguous daily coverage.

**DECISION:** Isolated git blobs of that overwritten cache might later prove contemporaneous ranks on some ETL-commit days. Isolated snapshots do not establish a daily replay window. They were not reverse-engineered into ranks in this audit.

**DECISION:** Historical price momentum alone is not enough, because trending rank is 70% of current subweight.

**DECISION:** Do not invent trending rank. Do not replace it with Google Trends. Do not use Fear & Greed. Do not neutral-fill. Do not backsolve from historical Social scores.

**DECISION:**

- exact: `D_NOT_REPLAYABLE`
- methodology: `D_NOT_REPLAYABLE`
- earliest exact candidate: none
- earliest method candidate: none
- contiguous exact: `NONE`
- contiguous method: `NONE`
- primary blocker: no defensible historical CoinGecko trending-rank source
- confidence: `HIGH`

This is a full-composite replay blocker.

---

## 15. Disabled/display-only features

Documented and **not** treated as replay blockers:

| Feature | Status |
|---|---|
| onchain | `enabled: false`, weight 0.00 |
| Market Regime | display-only |
| Cycle Timing | display-only |
| Gold | display-only |
| Sats | display-only |

Only enabled scored factors determine current-composite replay feasibility.

---

## 16. Cross-factor lookback and earliest-date map

Feasibility-date rule (date arithmetic only; **not** a score calculation):

earliest usable date for a factor = latest of source inception, required lookback burn-in, point-in-time/vintage availability start, and required historical-state availability.

| Factor | Minimum lookback (implementation) | Structural inception | Validation-grade earliest date |
|---|---|---|---|
| trend_valuation | 200 completed UTC days + 22 completed weeks | BTC spot long predates the model | **NOT ESTABLISHED** (`U` snapshot) |
| stablecoins | 365-day changeSeries | Stablecoin markets exist historically | **NOT ESTABLISHED** (`C` basket/revision) |
| etf_flows | 21 business days | US spot BTC ETFs 2024-01-11 | **NOT ESTABLISHED** (`C` Farside mutability) |
| net_liquidity | 8–12 weeks; 365-day fetch | FRED series exist historically | **NOT ESTABLISHED** (`U` vintage) |
| term_leverage | 30-day funding + 30-day spot | Perpetual swaps exist historically | **NOT ESTABLISHED** (`U` fallback/retention) |
| macro_overlay | 120-day fetch; 20 sessions | FRED series exist historically | **NOT ESTABLISHED** (`U` vintage/timing) |
| social_interest | 7-day price for 30% leg; trending has no history | Trending API is live-only | **NONE** (`D`) |

**DECISION:** Full current-methodology candidate earliest date = max of all seven enabled-factor method candidate dates **only if** every factor is `A` or `B`. Any `C`/`D`/`U` factor ⇒ full validation-grade candidate date = **NONE / NOT ESTABLISHED**.

**DECISION:** Do not assume factor exclusion plus weight renormalization equals a full current-model replay. A six-factor study omitting social would be a **partial composite** and must be named as such if ever authorized separately.

---

## 17. Contiguous-overlap analysis

An earliest date alone is insufficient. Point-in-time-safe evidence must be assessed as `CONTIGUOUS`, `INTERMITTENT`, `UNKNOWN`, or `NONE`.

| Factor | Exact coverage | Method coverage |
|---|---|---|
| trend_valuation | UNKNOWN (isolated H3 snapshot prices) | UNKNOWN |
| stablecoins | INTERMITTENT Git JSON from 2025-10-04 | UNKNOWN |
| etf_flows | INTERMITTENT Git HTML from 2025-10-07 | UNKNOWN |
| net_liquidity | UNKNOWN | UNKNOWN |
| term_leverage | UNKNOWN | UNKNOWN |
| macro_overlay | UNKNOWN | UNKNOWN |
| social_interest | NONE | NONE |

**DECISION:** There is no overlapping contiguous interval on which all seven enabled factors are point-in-time safe. Isolated Git caches for ETF/stablecoins do not create a full-model daily replay window.

---

## 18. Exact production replay conclusion

**Question:** Is exact historical production replay currently established?

**DECISION:** **NO**

Exact current production replay on date T requires all seven enabled scored factors to be `A_EXACT_POINT_IN_TIME` on T.

No enabled factor is classified `A` at factor level. Social interest is `D`. Several others are `U` or `C` because fallback/cache state, 11:xx UTC snapshot, FRED vintage, and Farside publication state cannot be reconstructed as production would have selected them.

---

## 19. Validation-grade methodology replay conclusion

**Question:** Is validation-grade current-methodology replay currently established?

**DECISION:** **NO** / **NOT ESTABLISHED** as a date, and **NO** as a present finding.

Validation-grade current-methodology replay on T requires all seven enabled factors to be `A` or `B` with no `C`/`D`/`U` component.

**FACT:** `social_interest` methodology class is `D_NOT_REPLAYABLE`.

**FACT:** `stablecoins` and `etf_flows` are `C_EXPLORATORY_ONLY`.

**FACT:** `trend_valuation`, `net_liquidity`, `term_leverage`, and `macro_overlay` are `U_UNRESOLVED`.

Any one of those findings blocks a full validation-grade current-composite replay.

Earliest defensible contiguous full-model date: **NONE / NOT ESTABLISHED**.

---

## 20. Exploratory reconstruction conclusion

**Question:** Could an exploratory reconstruction be built?

**DECISION:** **YES**, in a limited, explicitly non-validation sense, for *some* inputs (truncated completed BTC closes; current FRED revised series; current Farside all-data table; current CoinGecko market caps).

**Question:** Would that exploratory reconstruction be useful for hypothesis generation only, rather than validation?

**DECISION:** **YES**. It would not be current-model validation. It would mix revised series, anachronistic baskets, live-only attention gaps, and later-complete percentile universes unless those hazards were separately frozen and labeled.

**DECISION:** An exploratory study that omitted `coingecko_trending_rank` or replaced it would **not** be a replay of current `v1.1.1`. H6 forbids those substitutions.

Exploratory reconstruction was **not** built in this audit. No scores were calculated.

---

## 21. Blocking unknowns

Full-composite blockers (any one is sufficient):

1. **Social — CoinGecko trending rank (0.70)** — `D_NOT_REPLAYABLE`. No official historical endpoint. No allowed substitute.
2. **Stablecoins — hardcoded current basket including BUSD** — `C`. Today's membership is not T's market structure.
3. **ETF — Farside mutable all-data table** — `C`. Today's historical rows are not vintage publications.
4. **Trend — `utc_intraday_snapshot`** — `U`. Completed close is a different measurement.
5. **Net liquidity / macro — FRED latest vs ALFRED vintage + 11:xx UTC** — `U`.
6. **Term leverage — BitMEX/Binance/OKX fallback identity + 30-day retention** — `U`.
7. **Percentile lookahead** — any use of a later-complete historical JSON/CSV as the rank universe for date T.

Operational fallback/cache state is an additional exact-production blocker even where methodology might later be proven.

---

## 22. Recommended proof-of-retrieval follow-ups

These are **proofs**, not scoring jobs. Do not begin replay implementation.

1. CoinGecko: reconfirm absence of any official trending-rank vintage/historical product (already HIGH-confidence negative on 2026-08-19).
2. Optional only: inventory git blobs of `social_interest_cache.json` to see whether isolated contemporaneous ranks exist. Isolated hits would remain non-contiguous and would not unlock full-model validation.
3. If a *partial-factor* study is ever separately authorized: prove ALFRED vintage catalogs for WALCL, RRPONTSYD, WTREGEN, DTWEXBGS, DGS2, DGS10, VIXCLS without computing scores.
4. If trend methodology is ever separately authorized: prove Coinbase hourly/minute reconstruction of `utc_intraday_snapshot` at 11:xx UTC without substituting completed closes.
5. If funding methodology is ever separately authorized: prove one venue's 30-day retention and instrument continuity; do not assume fallback identity.
6. Treat Git ETF HTML / stablecoin JSON as contemporaneous only for their dated filenames; do not backfill from current APIs into those dates.

None of these follow-ups is an authorization to calculate historical scores.

---

## 23. Relationship to H4/H5 evidence

**DECISION:** H6 does not reopen H3, H4/H4.1, or H5/H5.1.

**FACT:** H3 historical artifact lineage and contamination classifications remain valid.

**FACT:** H4/H4.1 terminal-return study remains frozen.

**FACT:** H5/H5.1 direct risk study remains frozen, including interpretation blob `d6978aa9de6c53dd24ff9a1ca3cfd32eece2cf19`.

**DECISION:** Do not reinterpret reconstructed historical score rows as point-in-time source evidence. Do not backsolve missing raw inputs from published G-Scores or factor scores.

H6 answers a different question: whether a longer point-in-time-safe replay of **current** methodology can be created. On present evidence, a full current-composite replay is not established.

---

## 24. Calibration decision

**DECISION:** Calibration gate remains **CLOSED**.

H6 cannot authorize:

- weights
- subweights
- formula changes
- band changes
- source substitutions
- threshold changes
- recommendation changes

Any future replay protocol must be separately frozen before scores are calculated.

---

## 25. Final feasibility verdict

| Question | Verdict |
|---|---|
| Exact historical production replay established? | **NO** |
| Validation-grade current-methodology replay established? | **NO** |
| Earliest defensible contiguous full-model date? | **NONE / NOT ESTABLISHED** |
| Primary full-model blocker? | `social_interest.coingecko_trending_rank` (`D_NOT_REPLAYABLE`) |
| Additional independent blockers? | stablecoin basket (`C`); ETF Farside (`C`); snapshot/FRED/funding (`U`) |
| Contiguous overlapping seven-factor interval? | **NONE** |
| Exploratory reconstruction conceivable? | **YES**, hypothesis generation only, not built here |
| Recommended next step? | **NO HISTORICAL REPLAY** |

**DECISION:** The recommended H6.1 path is **NO HISTORICAL REPLAY** because a critical current component (`coingecko_trending_rank`, 70% of Social Interest, 10% of the composite) is `D_NOT_REPLAYABLE` and no defensible method-equivalent path exists under H6 rules (no Google Trends, no Fear & Greed, no neutral-fill, no backsolve).

Residual `U_UNRESOLVED` items on other factors are independent additional blockers. Resolving them would still leave Social Interest `D` and would still leave Stablecoins and ETF Flows `C` unless those classifications later change on new evidence.

**SAFETY:** No historical G-Scores were calculated. No historical factor scores were calculated. No H4/H5 regeneration. No model changes. No ETL. No source-data backfill. Calibration remains CLOSED.

STOP FOR INDEPENDENT H6 FEASIBILITY REVIEW.

Do not merge. Do not begin any replay implementation. Do not calculate historical scores.
