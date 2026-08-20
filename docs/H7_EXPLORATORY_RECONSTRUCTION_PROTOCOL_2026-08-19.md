# H7 Exploratory Reconstruction Protocol

**Date:** 2026-08-19  
**Repository:** firemansghost/btc-risk-dashboard-V3  
**Branch:** `research/h7-exploratory-reconstruction-protocol`  
**H7_BASE_SHA:** `6c03730df19adafd8e4e3b1f84361e64a378a6a6`  
**MODEL_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`  
**H7_PROTOCOL_VERSION:** `h7-exploratory-reconstruction-v1`
**Correction pass:** Git-chart precedence; exact 31-point surrogate; factor-role/availability aggregation; two-stage ANALYSIS_SOURCE_SHA
**Frozen H6.1 factor-update blob:** `bddbe3f85721c594fb1e2a628646da5d29afbd44`  
**Calibration gate:** CLOSED

This document **pre-registers** an exploratory reconstruction. It does not calculate XR-Scores, historical factor scores, composites, bands, recommendations, returns, or risk outcomes.

---

## 1. Executive purpose

H7 asks a narrower question than H6/H6.1:

Can GhostGauge construct a clearly labeled, reproducible, temporally disciplined **exploratory** historical series using current `v1.1.1` mathematics plus pre-registered reconstruction inputs, and use that later for hypothesis generation without presenting it as validation?

The reconstructed research quantity is **XR-Score** (Exploratory Reconstruction Score).

H7 itself is **PROTOCOL ONLY**. H7.1 implementation, series generation, and any later outcome analysis are out of scope for this operation.

---

## 2. Relationship to H6 / H6.1

H6 (`b0dc6d1d77e17f3ff36ee13008a26207c4fe558d`) established that full seven-factor **exact** and **validation-grade current-methodology** historical replay of current GhostGauge `v1.1.1` is **NOT ESTABLISHED**.

H6.1 (`6c03730df19adafd8e4e3b1f84361e64a378a6a6`, tree `f4859fdd0e90c5e3fbeb533fa59cff021d7faa79`) established useful **date-set-specific** methodology coverage without promoting a full model:

| Factor | Exact / method | Proven method date set | Coverage |
|---|---|---|---|
| `trend_valuation` | U / B | 2026-08-17..2026-08-19 | ISOLATED |
| `stablecoins` | U / B | from 2025-10-05 | INTERMITTENT |
| `etf_flows` | U / B | from 2025-10-07 | INTERMITTENT |
| `net_liquidity` | U / U | none | — |
| `term_leverage` | U / B | 2026-08-17..2026-08-19 | ISOLATED |
| `macro_overlay` | U / U | none | — |
| `social_interest` | U / B | 2026-08-17..2026-08-19 | ISOLATED |

Full exact replay: **NOT ESTABLISHED**. Full methodology replay: **NOT ESTABLISHED**. Earliest full-model date: **NONE**. Qualifying seven-factor interval: **NONE**.

H7 does **not** reopen those verdicts. It defines a **separate** exploratory construct that may mix H6.1 `B` inputs with explicitly labeled `C` reconstruction paths.

H6 and H6.1 files are frozen inputs. This protocol does not edit them.

---

## 3. Why this is exploratory rather than validation-grade

H7 is exploratory because:

1. A full seven-factor validation-grade current-methodology replay was **not** established.
2. Net Liquidity and Macro remain `U` at H6.1 methodology class; H7 uses conservative vintage rules that **differ** from production timing.
3. Pre-2026-08-17 Trend uses a Coinbase 5-minute **surrogate**, not current `utc_intraday_snapshot` identity.
4. Term/Social 30-day vectors outside Git `market_chart_30_daily` captures use the frozen 31-observation `C_SURROGATE` vector, not the live CoinGecko `market_chart` response.
5. Any eligible full composite therefore includes one or more `C` paths.

A mixed `B`/`C` composite is **not** validation-grade. Isolation or intermittency of `B` coverage does not convert `C` paths into `B`.

---

## 4. XR terminology

The reconstructed research quantity **must** be called:

**XR-Score**  
**Exploratory Reconstruction Score**

Never label it:

- G-Score
- historical G-Score
- as-published G-Score
- backtested G-Score
- validated G-Score

**FACT:** XR-Score is a research construct derived from current GhostGauge mathematics using a mixture of stronger point-in-time evidence and explicitly exploratory historical reconstruction inputs.

**FACT:** XR-Score is **NOT** an official GhostGauge print. It must not be shown on the production dashboard, overwrite official history, or be used to tune current weights/bands.

---

## 5. Frozen implementation identity

| Item | Value |
|---|---|
| `H7_BASE_SHA` | `6c03730df19adafd8e4e3b1f84361e64a378a6a6` |
| `MODEL_SOURCE_SHA` | `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52` |
| `H7_PROTOCOL_VERSION` | `h7-exploratory-reconstruction-v1` |
| Production-methodology source | current `v1.1.1` at `MODEL_SOURCE_SHA` |

XR uses current `v1.1.1` factor formulas, factor weights, subweights, score mappings, and percentile mechanics from `MODEL_SOURCE_SHA`.

Frozen official factor weights (no changes):

| Factor | Weight |
|---|---|
| `trend_valuation` | 0.30 |
| `stablecoins` | 0.18 |
| `etf_flows` | 0.077 |
| `net_liquidity` | 0.043 |
| `term_leverage` | 0.20 |
| `macro_overlay` | 0.10 |
| `social_interest` | 0.10 |

Frozen official subweights (no changes):

| Factor | Subweights |
|---|---|
| `trend_valuation` | `bmsb_distance` 0.60; `mayer_stretch` 0.30; `weekly_rsi` 0.10 |
| `stablecoins` | `supply_growth` 0.55; `momentum` 0.30; `concentration` 0.15 |
| `etf_flows` | `sum_21d` 0.30; `acceleration` 0.30; `diversification` 0.40 |
| `net_liquidity` | `level` 0.15; `rate_of_change` 0.40; `momentum` 0.45 |
| `term_leverage` | `funding` 0.40; `realized_vol` 0.35; `stress` 0.25 |
| `macro_overlay` | `dxy_20d` 0.40; `us2y_20d` 0.35; `vix_pct` 0.25 |
| `social_interest` | `coingecko_trending_rank` 0.70; `btc_price_momentum_7d` 0.30 |

No weight changes. No subweight changes. No formula redesign. No threshold changes. No optimization. No experimental 35/25 or 25/35 UI models.

Companion contract: `research/exploratory-reconstruction/factor_input_contract.csv`.

---

## 6. Reconstruction window

Frozen H7 v1 candidate window:

- `XR_START_DATE` = **2025-12-11**
- `XR_END_DATE` = **2026-08-19**

Do **not** extend earlier in H7.1. 2025-12-11 is the first date with dense historical Term funding and Social trending provenance in addition to Stablecoin and ETF evidence. Pre-2025-12-11 reconstruction would require more aggressive source substitution and is **OUT OF SCOPE**.

H7.1 may **not** silently expand the series with later dates. A future extension requires a separately frozen snapshot/version.

---

## 7. Observation-clock rule

Every observation date `T` has an explicit reconstruction clock `reconstruction_as_of_utc`.

**Preferred:** the contemporaneous H3/H3.1 `DAILY_PRIMARY` artifact's explicit `observation_as_of_utc` / `as_of_utc` when available and trustworthy.

**Fallback:** `11:30:00 UTC` on `T`.

Record which clock source was used (`reconstruction_clock_source`).

Do **not** use Git commit time as a substitute for observation time when a better source exists.

The reconstruction clock is used for:

- Trend intraday proxy selection
- source publication knowability
- ETF publication cutoff
- ALFRED/FRED timing discipline
- current-day market-price proxy

---

## 8. Reconstruction evidence roles

Use **exactly** these roles. No `A_EXACT` claim is required for XR. H7's purpose is not exact production replay.

| Role | Meaning |
|---|---|
| `B_METHOD_PIT` | An H6/H6.1 validation-grade methodology input on the defined captured date set |
| `C_PIT_CONSERVATIVE` | Official historical/vintage data made temporally conservative through an explicit lag/cutoff that differs from exact production behavior |
| `C_CURRENT_HISTORY` | Historical values retrieved later from a current historical endpoint and not proven to be the exact historical point-in-time state |
| `C_SURROGATE` | A reproducible historical measurement substituted for a required current input because the original current measurement is unavailable historically |
| `MISSING` | Required input cannot be reconstructed under H7 v1 rules |

---

## 9. Missingness / no-renormalization rule

For each date `T`, classify every factor as `AVAILABLE_B`, `AVAILABLE_C`, or `MISSING` using the section 18 aggregation rule (component roles first; never infer availability from a numeric factor score).

A full XR-Score may be produced **only** when all seven factor scores are available under the pre-registered H7 input paths (`AVAILABLE_B` or `AVAILABLE_C`).

If any required factor is unavailable:

- `XR-Score` = `NULL` / `xr_status` = `NOT_ELIGIBLE`
- `eligible_full_composite` = FALSE

Do **not**:

- drop the factor
- neutral-fill
- zero-fill
- carry forward
- interpolate
- nearest-date replace
- redistribute weight
- renormalize remaining factors

Partial-factor rows may be retained for research diagnostics. They are **not** XR-Score observations.

---

## 10. Trend input contract

Current scored components remain `bmsb_distance`, `mayer_stretch`, and `weekly_rsi` with official subweights. Mayer numerator is the snapshot price, not the last completed CSV/daily close.

**2026-08-17 through 2026-08-19:** use the H6.1-proven methodology path:

- labeled `utc_intraday_snapshot`
- contemporaneous `btc_price_history.csv` vintage
- current Trend implementation (`trendValuation.mjs`, `priceHistory.mjs`, `snapshotPrice.mjs` at `MODEL_SOURCE_SHA`)

Role: `B_METHOD_PIT`.

**Dates before 2026-08-17:** the old published GhostGauge spot **must not** be used as if it were the current snapshot. H6.1 proved pre-change production used `getCoinbaseCloseForYesterday()`.

Frozen H7 v1 exploratory intraday snapshot proxy:

- Coinbase BTC-USD historical **5-minute** candle
- most recent **completed** 5-minute candle whose closing boundary is `<= reconstruction_as_of_utc`
- that candle close is `xr_snapshot_price_usd`

Role: `C_SURROGATE`.

Do **not** use the completed UTC daily close as the snapshot numerator.

Completed daily/weekly history outside the contemporaneous CSV island: Coinbase historical completed candles; include only observations completed before `reconstruction_as_of_utc`. Role: `C_CURRENT_HISTORY`.

Run current Trend mathematics without modification. No old Trend factor score may be used as an input.

**Surrogate firewall:** the 5-minute proxy is chosen because it is deterministic, source-related, intraday, knowable without using future-of-day close, and reasonably close in measurement concept to current snapshot semantics. It is **not** claimed to equal the historical value current GhostGauge would have seen. Do not choose a different intraday time or granularity because historical results look better. Do not fit the proxy against historical G-Score, BTC future returns, MACE, bands, or factor outcomes. The proxy rule is frozen **before** H7.1 scores exist.

If a required Trend input is missing: factor = `MISSING`. No carry-forward.

---

## 11. Stablecoins input contract

Use the H6.1 proven methodology path.

Preferred inputs:

- contemporaneous dated seven-series Stablecoin JSON
- contemporaneous seven-coin fetch-order identity
- Git-recoverable **pre-run** `stablecoins-historical.json` `changeSeries` state
- current formula (`supply_growth` 0.55 / `momentum` 0.30 / `concentration` 0.15)

Role: `B_METHOD_PIT`.

Use the prior committed baseline blob for observation `T`. Do **not** use the same-run post-run baseline as the observation-`T` percentile universe.

Do **not** fill dates with missing Stablecoin raw capture using a later API query in H7 v1. No alternate basket. No modern replacement for BUSD/TUSD/etc.

If required Stablecoin source state is missing: factor = `MISSING`. No carry-forward.

H6.1 support exists from 2025-10-05; H7 v1 observations still start at 2025-12-11.

---

## 12. ETF input contract

Use the H6.1 proven methodology path when a contemporaneous dated Farside HTML capture exists.

Inputs:

- capture-date Farside HTML
- current named fund structure
- UTC publication cutoff (`ETF_FLOW_PUBLISH_HOUR_UTC=16`)
- current `sum_21d` / `acceleration` / `diversification` mathematics
- current preferred historical baseline behavior

Role: `B_METHOD_PIT`.

Do **not** use today's live Farside table to fill missing historical capture dates. Do **not** use a future Git HTML capture as point-in-time evidence for an earlier date.

If required same-date reconstruction state is unavailable: ETF factor = `MISSING`.

Current parser timezone quirks (`isBusinessDay` uses local `Date.getDay()`) remain documented. They do not authorize a different HTML source.

No 21-day flow or HHI calculations occur during H7 protocol work.

---

## 13. Net Liquidity input contract

H6.1 left Net Liquidity `U` because exact 11:00/11:30 UTC historical production knowability could not be established.

H7 may use an explicitly conservative official-vintage path. Required series: `WALCL`, `RRPONTSYD`, `WTREGEN`.

For observation `T`:

- `realtime_end` / vintage cutoff `<= T-1` calendar day
- exclude any returned observation whose observation date is `>= T`

Role: `C_PIT_CONSERVATIVE`.

This intentionally sacrifices some same-day information to avoid using future-of-run releases. It is **not** exact production replay and is **not** H6 methodology `B`. Do not later promote it merely because resulting scores resemble official prints.

Reproduce current Net Liquidity mathematics (`level` / `rate_of_change` / `momentum`) without changing weights or score mapping.

Production fetches FRED with `frequency=w` and `aggregation_method=avg`. If H7.1 must locally emulate that weekly aggregation, it **must first prove** the aggregation convention and document it. Do not silently invent an aggregation convention. If equivalence cannot be established: factor = `MISSING`.

---

## 14. Term / Leverage input contract

Current required components: `funding` 0.40, `realized_vol` 0.35, `stress` 0.25.

**Funding:** contemporaneous Git `fundingData` / BitMEX evidence when available. Role: `B_METHOD_PIT`.

Preferred H7 v1 decision: **Git funding evidence only**. Missing Git funding dates remain `MISSING`. H7 v1 does **not** select an official BitMEX historical retrieval fallback. Do not silently carry forward.

**30-day price vector (shared with Social; section 17):**

**CASE A.** If a valid contemporaneous Git capture of `public/data/cache/market_chart_30_daily.json` exists for `T` under the H6.1-proven measurement path: use the **entire captured price vector exactly as preserved**. Do **not** replace its current-day observation, append a Coinbase proxy, drop an observation, substitute completed daily history, or normalize it to a different vector shape. Role: `B_METHOD_PIT`. Term and Social must consume the **same exact captured vector**.

**CASE B.** Only if no valid contemporaneous Git chart exists: construct the frozen 31-observation `C_SURROGATE` vector (section 17). Do **not** mix B and surrogate construction on the same date.

This surrogate is **not** claimed to equal the historical live CoinGecko `market_chart` response. It exists solely when the Git capture is absent, and to prevent using `T`'s final daily close.

Run current realized-volatility and stress mathematics unchanged in H7.1. No funding averages, realized volatility, stress, or Term scores are calculated in H7.

---

## 15. Macro input contract

Required current inputs: `DTWEXBGS`, `DGS2`, `DGS10`, `VIXCLS`.

Use official ALFRED/FRED historical vintages.

H6.1 proved calendar-day vintage can contain same-day VIX that was not available by the historical morning run. H7 v1 therefore uses:

- vintage cutoff `<= T-1`
- exclude `observation_date >= T`

Role: `C_PIT_CONSERVATIVE`.

Run current Macro mathematics (`dxy_20d`, `us2y_20d`, DGS10 inversion bonus on the rates score, `vix_pct`) without modification.

Do not use same-day US close data. Do not use today's fully revised FRED history without vintage control.

If required vintage inputs are missing: factor = `MISSING`.

---

## 16. Social input contract

Current scored components: CoinGecko trending rank 70%; BTC price momentum 30%.

**Trending rank:** contemporaneous Git social-interest / CoinGecko trending evidence. Role: `B_METHOD_PIT`.

Use the raw `bitcoinRank`, **not** old aggregate Social factor scores. Do **not**:

- use historical old Social composite score
- use 40/35/25 aggregate as current 70/30 score
- substitute Google Trends
- substitute Fear & Greed
- carry trending rank forward
- interpolate rank

If no valid contemporaneous Bitcoin rank exists: Social factor = `MISSING`.

**Momentum:** the **same** 30-day price-vector contract as Term (section 17).

- If a valid contemporaneous Git `market_chart_30_daily` capture exists for `T`: use that **entire captured vector unchanged**. Role: `B_METHOD_PIT`. The 31-point surrogate rule does **not** apply.
- Only if no valid contemporaneous Git chart exists: use the frozen 31-observation `C_SURROGATE` vector. Role: `C_SURROGATE`.

Run current 7-vs-7 percentile mechanics unchanged. The resulting Social factor is exploratory whenever a required component is `C`.

---

## 17. Common reconstructed 30-day price-vector contract

Term and Social **must** use the same price vector for the same observation date. Do not independently construct two historical price series. Do not mix CASE A and CASE B on the same date.

### CASE A — contemporaneous Git chart exists

If a valid contemporaneous `public/data/cache/market_chart_30_daily.json` Git capture exists for `T` under the H6.1-proven measurement path:

- use the **entire captured price vector exactly as preserved**
- do **not** replace its current-day observation
- do **not** append a Coinbase proxy
- do **not** drop an observation
- do **not** substitute completed daily history
- do **not** normalize it to a different vector shape

Role: `B_METHOD_PIT`.

On **2026-08-17, 2026-08-18, and 2026-08-19**, where H6.1 has proven contemporaneous captures: Term and Social **must** use those Git-captured charts unchanged as `B_METHOD_PIT`. Do **not** use the `C_SURROGATE` vector on those dates if the approved capture is present and valid. If an expected bridge capture cannot be resolved or validated: mark the affected input `MISSING` and report it. Do **not** silently fall back during the bridge.

### CASE B — no contemporaneous Git chart exists

Only then construct the frozen exploratory hybrid vector. Role: `C_SURROGATE`.

Exact shape:

- 30 completed daily BTC observations for UTC dates **T-30 through T-1 inclusive**, chronological order, one observation per UTC calendar date
- **plus** exactly one observation-`T` Coinbase proxy: the most recent **completed** 5-minute BTC-USD candle whose **end** boundary is `<= reconstruction_as_of_utc`
- result: **exactly 31** ordered price observations; the T proxy is the **final** element

Do **not** use `T`'s completed final UTC daily close. Do **not** include `T-31`. Do **not** allow 29 completed days, 31 completed days, variable-length windows, nearest dates, interpolation, or duplicate UTC dates.

Completed historical observations may come from the frozen `C_CURRENT_HISTORY` CoinGecko historical daily path. No numerical vector generation occurs in this protocol.

If **any one** of the required 30 completed daily observations is unavailable: the surrogate vector = `MISSING`, and every component requiring it follows its existing missing rule.

H7.1 must **reject** (not silently repair) duplicate completed UTC dates, missing required UTC dates, out-of-order points, or more/fewer than 31 total points.

H7.1 lineage must record which case applied, source identities, observation cutoff, and response snapshot/hash.

---

## 18. Full composite eligibility

### Factor-level role aggregation

`xr_factor_lineage.csv` preserves component-level reconstruction roles. `xr_observations.csv` has one role column per factor.

The factor-level role is the **most limiting** required component role, applied mechanically in this **reporting** precedence (it does **not** assert an empirical ranking among C categories):

1. `MISSING`
2. `C_SURROGATE`
3. `C_CURRENT_HISTORY`
4. `C_PIT_CONSERVATIVE`
5. `B_METHOD_PIT`

Examples:

- Trend before Aug 17: snapshot `C_SURROGATE` + completed history `C_CURRENT_HISTORY` → `trend_role = C_SURROGATE`
- Term on a normal non-chart-capture date: funding `B_METHOD_PIT` + price vector `C_SURROGATE` → `term_leverage_role = C_SURROGATE`
- Social on a normal non-chart-capture date: trending `B_METHOD_PIT` + momentum `C_SURROGATE` → `social_role = C_SURROGATE`
- Net Liquidity: all required path `C_PIT_CONSERVATIVE` → `net_liquidity_role = C_PIT_CONSERVATIVE`
- Macro: `C_PIT_CONSERVATIVE`
- Stablecoins: `B_METHOD_PIT` when fully available under its preferred H6.1 path
- ETF: `B_METHOD_PIT` when fully available under its preferred H6.1 path
- Bridge Trend/Term/Social may be `B_METHOD_PIT` only when **all** required components use the proven B path

### Factor availability

If any required component is `MISSING`: factor availability = `MISSING`.
Else if **every** required component is `B_METHOD_PIT`: factor availability = `AVAILABLE_B`.
Else: factor availability = `AVAILABLE_C`.

This drives `xr_missingness.csv` and `eligible_full_composite`. Do not infer availability from a numeric factor score.

### Full XR eligibility

Eligible full XR-Score only if all seven factors are `AVAILABLE_B` or `AVAILABLE_C`.

If even one factor is `MISSING`: full XR-Score = `NULL`. No renormalization, imputation, interpolation, or nearest-date replacement.

`xr_status` in `xr_observations.csv` has exactly two H7.1 v1 values:

- `ELIGIBLE` when all seven factors are available and `xr_score` is populated; `eligible_full_composite` = TRUE
- `NOT_ELIGIBLE` when one or more factors are `MISSING` and `xr_score` is empty; `eligible_full_composite` = FALSE

Every eligible full XR-Score must carry `reconstruction_grade` = `EXPLORATORY_ONLY`, even if some factors are `B`. Reason: the full composite includes one or more `C` reconstruction paths. Do **not** call a mixed `B`/`C` composite validation-grade.

---

## 19. XR score-combination rule

When eventually authorized in H7.1:

1. Calculate the seven factor scores using **current** `v1.1.1` mathematics from `MODEL_SOURCE_SHA`.
2. Combine with current official weights exactly.
3. No rounding changes, band-threshold changes, or score clipping beyond current production behavior.
4. No alternate models.

H7.1 primary output emits **raw XR-Score only**. It must **not** emit Aggressive Buying, Regular DCA Buying, Moderate Buying, Hold & Wait, Reduce Risk, or High Risk as recommendations.

A later research protocol may derive a CURRENT-BAND CROSSWALK for descriptive analysis. Do not attach trading/playbook semantics to XR.

**This protocol calculates zero scores.**

---

## 20. Bridge-period rule

Frozen non-tuning bridge / implementation-check period:

- 2026-08-17
- 2026-08-18
- 2026-08-19

On these dates, where H6.1 has proven contemporaneous `market_chart_30_daily` captures: Term and Social must use the Git-captured chart **unchanged** as `B_METHOD_PIT`. Do **not** use the `C_SURROGATE` vector if the approved capture is present and valid. If an expected bridge capture cannot be resolved or validated: mark the affected input `MISSING` and report it. Do **not** silently fall back.

Trend on these dates uses the H6.1 labeled-snapshot plus contemporaneous CSV path (`B_METHOD_PIT`) when all required Trend components are on the proven B path.

H7.1 may later compare XR reconstruction inputs/factor outputs with genuine current `v1.1.1` production observations on these dates.

Purpose: detect implementation mistakes, quantify reconstruction divergence, verify formula wiring.

**Not** purpose: choose better proxy rules, tune factors, optimize reconstruction, fit weights, or improve historical agreement.

If XR differs: **report the difference**. Do **not** change frozen H7 rules to make it match. Any reconstruction-rule change requires an H7 protocol version increment and an independent justification unrelated to outcome performance.

---

## 21. Historical-output non-input firewall

Do **not** use historical G-Score, factor score, band, or recommendation to:

- fill missing source inputs
- infer missing source values
- select proxy methods
- choose timestamps
- calibrate reconstructed factors
- validate a source substitution

No backsolving.

Historical official outputs may be used later only as clearly separated diagnostic comparison data under a pre-registered analysis (bridge check is diagnostic only).

---

## 22. H4/H5 outcome firewall

H7 protocol design must **not** use H4/H5 outcome results to select:

- source substitutions
- proxy time
- data provider
- lag rule
- missing-data rule
- reconstruction window
- factor inclusion rule

H4/H5 are already known. H7 reconstruction rules are justified only by temporal integrity, measurement similarity, source availability, and reproducibility.

Do not choose a reconstruction path because it produces better historical return/risk ordering.

---

## 23. Future H7.1 output contract

Expected future directory: `research/exploratory-reconstruction/`

Potential H7.1 **generated** outputs (do **not** create them now except this protocol-stage README):

- `xr_observations.csv`
- `xr_factor_lineage.csv`
- `xr_missingness.csv`
- `xr_bridge_check.csv`
- `ANALYSIS_SOURCE_SHA.txt`
- `PROTOCOL_VERSION.txt`
- `README.md` (already present as protocol-stage README)

Exact intended columns are frozen in `research/exploratory-reconstruction/H7_1_OUTPUT_SCHEMA.md`.

H7.1 must use a **two-stage immutable** process:

**Stage A — implementation source.** Create and independently review the H7.1 reconstruction implementation **without** generated XR outputs. Commit that implementation. Freeze `H7_1_ANALYSIS_SOURCE_SHA` = that exact implementation-only Git commit SHA. No generated XR CSV may be part of that commit.

**Stage B — generation.** Execute reconstruction from **exactly** `H7_1_ANALYSIS_SOURCE_SHA` against the frozen H7 protocol/blob contracts. Generate the approved H7.1 output files. `ANALYSIS_SOURCE_SHA.txt` must contain `H7_1_ANALYSIS_SOURCE_SHA`. The later output-commit SHA is **not** written into `ANALYSIS_SOURCE_SHA.txt`. This avoids a circular self-referential SHA.

Any implementation change after the Stage A SHA invalidates generated outputs and requires a new implementation source SHA and complete regeneration. No silent source drift.

Before generated outputs are accepted, H7.1 lineage must freeze (do **not** invent these future SHAs now):

- H7 protocol blob
- `factor_input_contract.csv` blob
- `H7_1_OUTPUT_SCHEMA.md` blob
- `H7_1_ANALYSIS_SOURCE_SHA`
- `MODEL_SOURCE_SHA`

Generated outputs must record/hash these identities where applicable.

Future workflow:

1. H7 protocol (this document)
2. independent review and merge; freeze protocol and contract blobs
3. H7.1 Stage A implementation commit (`H7_1_ANALYSIS_SOURCE_SHA`)
4. H7.1 Stage B generation from that SHA
5. freeze XR series and hashes
6. independent review
7. **only then** consider a separate exploratory outcome-analysis protocol

H7.1 must **not** calculate 30d/90d/180d returns, MACE, MCDD, volatility outcomes, downside outcomes, Spearman, band performance, or strategy performance.

Reconstruction first. Outcomes later.

---

## 24. Claim firewall

Never say from XR alone:

- GhostGauge would have predicted X
- GhostGauge worked historically
- GhostGauge failed historically
- the model is validated
- the model is invalidated
- the weights are correct
- the weights are wrong
- the bands are calibrated
- the bands should be changed
- the reconstruction is as-published
- the reconstruction is point-in-time validation

XR later may support:

- hypothesis generation
- source-sensitivity investigation
- identifying possible patterns worth testing with future genuine observations

Nothing stronger without separate evidence.

---

## 25. Calibration decision

**DECISION:** Calibration gate remains **CLOSED**.

H7 cannot authorize changes to weights, subweights, score formula, factor formulas, thresholds, bands, recommendations, data sources, or production timing.

No tuning is allowed from exploratory results.

---

## 26. H7.1 implementation gate

**H7 PROTOCOL FROZEN ONLY.**

H7.1 **MAY NOT BEGIN UNTIL**:

- this H7 protocol branch is independently reviewed
- the protocol is merged
- the exact protocol blob is frozen
- the exact `factor_input_contract.csv` blob is frozen
- the exact `H7_1_OUTPUT_SCHEMA.md` blob is frozen

H7.1 will require its own branch, independent review of the Stage A implementation commit, and generation only from `H7_1_ANALYSIS_SOURCE_SHA`.

Do not implement reconstruction during H7 protocol creation. Do not calculate exploratory scores.

---

## 27. Final protocol verdict

**DECISION:** H7 v1 exploratory reconstruction protocol is frozen as documentation and contracts only.

| Item | Result |
|---|---|
| XR window | 2025-12-11 through 2026-08-19 |
| XR-Score | research construct; not historical G-Score |
| Full XR eligibility | all seven factors available; else NULL |
| Reconstruction grade | `EXPLORATORY_ONLY` for every eligible composite |
| Official bands/recommendations | not in H7.1 primary output |
| Bridge | 2026-08-17..19; report differences; no tuning |
| H7.1 | not begun |
| Calibration | CLOSED |

**SAFETY:** No XR-Scores. No historical factor scores. No composites. No returns/risk outcomes. No ETL. No source retrieval. No production changes. No backfill. No model tuning.

STOP FOR INDEPENDENT H7 PROTOCOL REVIEW. Do not merge. Do not begin H7.1. Do not calculate exploratory scores.
