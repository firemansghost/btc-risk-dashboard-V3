# H6.1 Targeted Source Proof Audit

**Date:** 2026-08-19  
**Repository:** firemansghost/btc-risk-dashboard-V3  
**Branch:** `research/h6-1-targeted-source-proof-audit`  
**H6.1_BASE_SHA:** `b0dc6d1d77e17f3ff36ee13008a26207c4fe558d`  
**MODEL_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`  
**H6.1_VERSION:** `h6.1-targeted-source-proof-v1`  
**Frozen H6 document blob:** `cf060ff1f5c4aec4ba52e9dfd0982899af1dcabc`  
**Calibration gate:** CLOSED

This document records targeted source proof. It does not calculate historical G-Scores, historical factor scores, composites, H4 returns, or H5 risk outcomes.

---

## 1. Executive verdict

**DECISION:** Exact historical production replay of the full current seven-factor `v1.1.1` composite remains **NOT ESTABLISHED**.

**DECISION:** Validation-grade current-methodology replay of the full seven-factor composite remains **NOT ESTABLISHED**.

**DECISION:** Earliest defensible contiguous full-model date = **NONE / NOT ESTABLISHED**.

**DECISION:** Currently proven qualifying seven-factor overlapping interval = **NONE / NOT ESTABLISHED**.

**FACT:** H6.1 resolved several H6 unknowns without promoting the full model.

**DECISION:** `etf_flows` methodology class is upgraded to `B_POINT_IN_TIME_METHOD_EQUIVALENT` from **2025-10-07** on the Git HTML capture-date set. Exact class remains `U_UNRESOLVED`.

**DECISION:** The other six enabled factors remain `U_UNRESOLVED` / `U_UNRESOLVED` at factor level.

**FACT:** Component-level promotions that do **not** move the factor:

- Trend labeled `utc_intraday_snapshot` artifacts from **2026-08-17**
- Stablecoin 7-coin positional identity from **2025-10-05**
- Term BitMEX funding-provider identity from **2025-12-11**
- Social trending `A`/`A` retained from H6
- ALFRED vintage **retrieval** for NL and Macro series on three proof dates

**DECISION:** Recommended next phase is **EXPLORATORY RECONSTRUCTION PROTOCOL**. Validation-grade seven-factor A/B was not established. Remaining U items are heterogeneous (snapshot semantic break, dateless 365d series, sparse 30d charts, 11:00 UTC vintage timing). Do not begin replay implementation in this operation.

---

## 2. Scope and hard firewall

H6.1 turns specific H6 unknowns into `A` / `B` / `C` / `D` / `U` using evidence. It is not a backtest.

H6.1 did **not**:

- run `npm run etl:compute`, Daily ETL, or Refresh Dashboard
- calculate any historical G-Score, factor score, blend, return, or risk outcome
- regenerate H3 / H4 / H5
- change weights, bands, formulas, sources, or `public/data`
- backsolve raw inputs from cached scores

Temporary proof scripts lived outside the repository and are not committed.

Companion files (exactly four outputs):

1. `docs/H6_1_TARGETED_SOURCE_PROOF_AUDIT_2026-08-19.md` (this file)
2. `research/point-in-time-replay/h6_1_proof_matrix.csv`
3. `research/point-in-time-replay/h6_1_evidence_manifest.csv`
4. `research/point-in-time-replay/h6_1_factor_updates.csv`

---

## 3. Frozen H6 baseline

**FACT:** `origin/main` at branch creation equaled `b0dc6d1d77e17f3ff36ee13008a26207c4fe558d` with tree `3384fa15ff0b6cb6e3005867b0f00a2c96a962e3`.

**FACT:** Frozen H6 blobs were unchanged and were not edited:

| Path | Blob |
|---|---|
| `docs/H6_POINT_IN_TIME_REPLAY_FEASIBILITY_2026-08-19.md` | `cf060ff1f5c4aec4ba52e9dfd0982899af1dcabc` |
| `research/point-in-time-replay/factor_feasibility.csv` | `e217590d2eaf6c57695570cfb8df277f220c4471` |
| `research/point-in-time-replay/source_requirements.csv` | `1d19101f8530fc29c6c016f31a13b256e808f8b0` |
| `research/point-in-time-replay/README.md` | `dd7f104fb2f81ab038fccb2201be3e24edc26801` |

**FACT:** H6 baseline factor classes were all `U_UNRESOLVED` / `U_UNRESOLVED`. Full exact and methodology replay were **NOT ESTABLISHED**. Calibration was CLOSED.

---

## 4. Classification / promotion rules

H6 definitions are unchanged.

**FACT:** Replay class describes whether the **current** scored component/factor can be reconstructed.

**FACT:** Raw PIT source evidence can be strong while replay remains `U_UNRESOLVED`.

**DECISION:** Exact `A` requires methodology `A` or `B`. Factor exact `A` requires all required scored components/state to be exact `A`. Factor methodology `A`/`B` requires every required component to be `A`/`B` and required lookbacks/rank universes to be PIT-safe.

**DECISION:** Absence of proof remains `U`, not automatic `D`. No averaging across components.

---

## 5. P1 Trend snapshot proof

**Question:** Can current `utc_intraday_snapshot` input be reconstructed on historical dates?

**FACT:** Current `scripts/etl/lib/snapshotPrice.mjs` blob `d49c9486e0d75bdeecd8b4aa287cb07f6350e34e` selects the UTC daily Coinbase `86400s` candle whose calendar date equals `as_of` UTC date.

**EVIDENCE:** That file first appears in commit `daae316b4b574b730d27452ff475f25cbde84d16` (2026-08-16).

**EVIDENCE:** Parent commit `5ce98324e97794e7b1f511807ad2d3a5c7895186` `compute.mjs` blob `a2ec36d810018fa0707279a7e1c0e026cd8ab16d` used `getCoinbaseCloseForYesterday()`: request end is today UTC midnight; the last fully closed bucket is **yesterday**.

**EVIDENCE:** `public/data/latest.json` first carries `price_kind=utc_intraday_snapshot` on `db789cd9c59b474044d428bfdccbe07312798236` (2026-08-17), blob `82db3c2c0525aaa6dc1aa16932eabe143d7dff45`, `as_of_utc=2026-08-17T15:44:32.381Z`.

**EVIDENCE:** Unlabeled 2025-09-26 `e9083962` blob `f77f7e0dcd5aa1beaeab22c4e3403b0eca2e5652` has Coinbase `spot_usd=108739.09` at `11:19:04Z` and **no** `price_kind`.

**EVIDENCE:** Bounded Coinbase request at 2026-08-19 11:00 UTC returned the still-open `2026-08-19` daily bucket (response SHA-256 `14611ac9c532f027143b8a45851bb6adcd44bc035629d99e4e0b504801462904`).

**LIMITATION:** Reconstructing today's candle does not prove 2025 unlabeled spots used current snapshot logic.

**INFERENCE:** Pre-2026-08-16 published spots are yesterday completed closes unless a later proof shows otherwise.

**DECISION:** `PARTIALLY_PROVEN`. Labeled snapshot input is `A`/`A` from **2026-08-17**. Unlabeled historical spots are **not** current snapshot. Proof result is not `D` for the whole Trend history because labeled dates exist.

---

## 6. P2 Trend close/rank proof

**Question:** Can completed daily/weekly history and T-truncated Mayer/RSI universes be reconstructed without future leakage?

**FACT:** `sma200DenominatorCloses` / `filterCompletedDailyRecords` keep date `D` only if `as_of >= (D+1) 00:00Z`. `filterCompletedWeeklyCloses` uses the same completed-day clock.

**FACT:** Mayer numerator is the snapshot price (P1), not the last CSV row. Mayer/RSI percentiles rank the truncated series. BMSB needs 22 completed UTC weeks; SMA200 needs 200 completed UTC daily closes.

**EVIDENCE:** `public/data/btc_price_history.csv` has **5** Git commits. HEAD has 732 rows, `2024-08-17` through `2026-08-18`, mostly `coinbase_historical`.

**FACT:** Using today's full CSV at an earlier `T` would include later completed days unless truncated.

**LIMITATION:** Those five CSV blobs are not a daily vintage archive. Live Coinbase historical candles can supply completed closes; they are not proven equal to operational CSV state at historical `T`.

**DECISION:** `PARTIALLY_PROVEN`. Methodology `B` is available for T-truncated completed-close mathematics. Exact remains `U`. Factor Trend stays `U` because P1 snapshot identity is missing for unlabeled history and because all three scored components plus snapshot state are required.

**DECISION:** No Mayer, RSI, BMSB, or Trend scores were calculated.

---

## 7. P3 Stablecoin identity proof

**Question:** Can positional arrays be mapped to the current seven-coin basket with proof?

**FACT:** Current aggregation uses `responses[i]` with `stablecoins[i]`. Current IDs in order: `tether`, `usd-coin`, `dai`, `binance-usd`, `true-usd`, `frax`, `liquity-usd`.

**EVIDENCE:** Commit `6b959cb8535ff71ef6e3de36e71a245e8c73e127` (2025-10-04) already requested that seven-ID order. Later inspected `factors.mjs` versions keep the same ID/symbol order.

**EVIDENCE:** `2025-10-04.json` is **3** series, no ids. `2025-10-05.json` is **7** series, 31 `market_caps` each, no ids. 308/309 dated files are length 7.

**EVIDENCE:** Bounded `GET https://api.coingecko.com/api/v3/coins/binance-usd` still resolves (`id=binance-usd`, SHA-256 `8bbd2209da7417e0f9c4d69969d5f54f8fec3c5432874ff298fe71a59823e24b`). That is current identity, not 2025 volume proof.

**LIMITATION:** Files never store coin ids. Mapping is fetch-order plus contemporaneous code.

**DECISION:** `PROVEN` for 7-length files from **2025-10-05**. `2025-10-04` is excluded. Component identity `A`/`A` does **not** make the factor `A`/`B` (P4).

**DECISION:** No HHI was calculated.

---

## 8. P4 Stablecoin historical-universe proof

**Question:** Can current supply-growth and momentum rank universes be reconstructed using only material through `T`?

**FACT:** Current live fetch is CoinGecko `days=30`, not 365. Dated Git JSON files are ~31-point windows. That satisfies the current 30d cap window, not a 365-day raw universe.

**FACT:** `supply_growth` percentiles `historicalBaseline.changeSeries`. `momentum` in current code is a 7-day **threshold** on the 30d window (`recentMomentum > 1 / 0.5`), not a 365-day percentile. Concentration uses current caps.

**EVIDENCE:** `public/data/stablecoins-historical.json` is numbers-only `changeSeries` with `lastUpdated` and no observation dates. First blob 2025-10-05 length 1; HEAD 2026-08-19 length 283; 286 commits.

**FACT:** Current merge appends `newChangeSeries` from the 30d window then `slice(-365)`. Git length growth is about one point per day, not 30 points per day.

**LIMITATION:** HEAD `changeSeries` at an earlier `T` is lookahead. A dateless series cannot be independently T-truncated except by assuming append-only order.

**DECISION:** `NOT_PROVEN` for the current 365-day supply-growth universe. Dated files remain strong 30d PIT raw source. Factor stays `U`/`U` because `supply_growth` remains `U`.

**DECISION:** No growth or percentile scores were calculated.

---

## 9. P5 ETF structural proof

**Question:** Do contemporaneous Farside HTML captures contain everything the current ETF factor needs as raw inputs?

**FACT:** Current parser needs a Total column (or legacy sum), named fund columns in `ibit fbtc bitb arkb btco ezbc brrr hodl btcw gbtc btc`, business-day rows, `selectPublishedEtfFlowRows` at `ETF_FLOW_PUBLISH_HOUR_UTC=16`, >=21 published rows for `sum_21d`, >=14 published rows for two adjacent 7-day windows, and per-fund cells for diversification.

**EVIDENCE:** No-score parse of `2025-10-07.html` blob `5c199e78d5f5e6961fa649ecf0c2f178c7c99f39` at `asOf=2025-10-07T11:00:00.000Z`: Total present; all 11 named funds present; 435 published rows from **2024-01-11** through **2025-10-06**.

**EVIDENCE:** The same structural result holds on 2025-11-12, 2026-01-15 (after a Git gap), 2026-05-26 (holiday-adjacent), and 2026-08-19 (652 published rows through 2026-08-18; extra `msbt` column present and unused by the named list).

**FACT:** Earliest captured date with current raw-input structure fully supported = **2025-10-07**.

**FACT:** Each HTML dump still contains history from 2024-01-11. A missing Git file for one weekday does not remove that session from a later dump. It does remove a same-day PIT HTML for that weekday.

**EVIDENCE:** Missing weekdays vs filenames include 2025-10-13 (Columbus Day 2025, **not** in current `US_MARKET_HOLIDAYS_UTC`), 2026-05-25 (Memorial Day, in the set), and capture gaps 2026-01-14, 2026-03-06, 2026-03-30, 2026-04-06, 2026-06-01.

**LIMITATION:** `parseEtfFlowsFromHtml` uses `isBusinessDay` → `Date.getDay()` (local timezone). `selectPublishedEtfFlowRows` is UTC. Exact operational parser identity is therefore environment-dependent.

**EVIDENCE:** `public/data/etf-flows-historical.json` has **one** Git commit (`43826a2a`, 2025-09-17) covering flows through 2025-09-16. Current code prefers that file for the 21d percentile when it exists.

**DECISION:** `PROVEN` for raw-input structure from **2025-10-07**. Component exact/method `A` for the HTML inputs. Factor exact remains `U` because of local-TZ weekend filtering and the frozen preferred baseline. Factor methodology is `B` using capture-date HTML plus the UTC publication-hour rule.

**DECISION:** No 21d sums, acceleration values, HHI, or ETF scores were calculated.

---

## 10. P6 Net Liquidity ALFRED proof

**Question:** Can WALCL, RRPONTSYD, and WTREGEN values knowable at historical `T` be retrieved through an official vintage mechanism?

**FACT:** Production `fetchFredDataWithRetry` uses ordinary FRED (`frequency=w&aggregation_method=avg`) without `realtime_start` / `realtime_end`.

**EVIDENCE:** Official ALFRED and observations docs returned HTTP 200 (SHA-256 `5e27a920...` and `3cc39ab5...`). H.4.1 page returned HTTP 200 (`e5390283...`).

**EVIDENCE:** Bounded vintage weekly queries on 2025-12-11, 2026-08-17, and 2026-08-19 each returned 57–58 observations with `realtime_start` / `realtime_end`. Example: WALCL vintage 2025-12-11 last `observation_date=2025-12-10`, `realtime_start=2025-12-11` (SHA-256 `6e092fa45476ede57183c1f15d1edeea2b1965bf84abe7c742ba3babd8650bca`).

**EVIDENCE:** RRPONTSYD vintage 2025-12-11 last `observation_date=2025-12-12` (after `T`). Weekly aggregation can date after the vintage calendar day.

**FACT:** H.4.1 Thursday ~16:30 ET is after 11:00 UTC. Calendar-day vintage includes later same-day publication.

**EVIDENCE:** Git `net_liquidity_cache.json` still stores `latestWalclDate` / computed fields, not raw arrays.

**DECISION:** `PARTIALLY_PROVEN`. Vintage **retrieval** works. That is B-capability evidence. It does **not** establish factor `B` because 11:00 UTC knowability is unresolved and production uses non-vintage FRED. Exact `A` is not established.

**DECISION:** No WALCL−RRP−TGA, rate-of-change, momentum, or NL scores were calculated.

---

## 11. P7 Term funding-provider proof

**Question:** Can the selected perpetual-funding provider be identified from historical term caches before `funding_provider` existed?

**EVIDENCE:** All **253** `term_leverage_cache.json` blobs have `fundingData` length 30, `symbol=XBTUSD`, keys `timestamp/symbol/fundingInterval/fundingRate/fundingRateDaily`, `fundingInterval=2000-01-01T08:00:00.000Z`, and details `Data Source` `BitMEX` or `Bitmex`. Explicit `funding_provider=bitmex` exists on 3 blobs only. Binance-like / OKX-like markers: 0.

**EVIDENCE:** First cache `d511199b` 2025-12-11 blob `974ecdae231939b69ec4e124f377cdefd6a4308a` already has the BitMEX schema without the explicit field.

**EVIDENCE:** Live BitMEX sample uses the same keys and dummy interval encoding (SHA-256 `209848687aaf4dfd2532bab98d8997654305df9e90f15502d228365c7f7c2b2f`). Binance from this environment returned 451.

**DECISION:** `PROVEN`. Provider identity is `A`/`A` from **2025-12-11** on the captured set. This is not an XBTUSD-only inference; schema, label, and BitMEX interval encoding coincide.

**DECISION:** No funding averages or Term scores were calculated.

---

## 12. P8 Term spot-chart proof

**Question:** Can the current 30-day spot-price input for realized_vol/stress be recreated point-in-time?

**FACT:** Current `computeTermLeverage` calls `coinGecko.getMarketChart(30, 'daily')` and uses `spotData.prices`. Term cache stores `spot_observation_utc` but **not** the price vector.

**EVIDENCE:** `market_chart_30_daily.json` has 12 commits / ~10 dates (2025-09-20 … 2025-10-29, then 2026-08-17/18/19). Captured vectors have 31 points.

**FACT:** Overlap with the dense term funding archive (from 2025-12-11) is **2026-08-17/18/19** only.

**EVIDENCE:** Live CoinGecko 30d daily series matched 29 completed days of the 2026-08-19 Git capture with **0** differences (SHA-256 `c24434163653d9b785ac3fa5ba51cebc5bc4a3a012995636b54bd70e67fa80cd`).

**LIMITATION:** Same-day equality does not prove 2025 captures are unrevised. Current CoinGecko history is not historical PIT truth.

**DECISION:** `PARTIALLY_PROVEN`. Chart vectors are exact PIT on their capture dates. Factor `realized_vol` / `stress` remain `U` over the funding-cache interval because the chart archive is not contiguous there.

**DECISION:** No realized volatility, stress, or Term scores were calculated.

---

## 13. P9 Macro ALFRED/release-time proof

**Question:** Can current Macro inputs be reconstructed from data actually knowable by historical run time?

**FACT:** Required series are `DTWEXBGS`, `DGS2`, `DGS10`, `VIXCLS`. Production uses ordinary FRED daily fetches, not ALFRED.

**EVIDENCE:** H.15 and H.10 pages returned HTTP 200. Current `macroFreshness.mjs` already separates H.10 Monday 16:15 ET, H.15 afternoon CT, and a VIX FRED heuristic.

**EVIDENCE:** ALFRED daily vintages on the three proof dates retrieved 100+ observations per series. DGS2/DGS10 on 2026-08-19 vintage ended **2026-08-18**. DTWEXBGS on Aug 2026 vintages ended **2026-08-14** (prior Friday).

**EVIDENCE:** VIXCLS lastDate **equals the vintage date** on 2025-12-11 and 2026-08-17 (SHA-256 for 2026-08-17 vintage `d73a3cd03a7dffc11af5fed0e723b69b05ae87bb00647ded0f37a7734258d040`). Calendar vintage therefore includes a same-day VIX print that is not knowable at 11:00 UTC.

**LIMITATION:** Date-only ALFRED is not sufficient for a typical scheduled 11:00 UTC run. A conservative prior-day vintage plus dropping `observation_date` on/after run UTC date would be a new rule, not current production.

**DECISION:** `PARTIALLY_PROVEN`. Retrieval works. Factor remains `U`/`U`. T-truncated VIX without T+1 contamination is not established at 11:00 UTC.

**DECISION:** No 20-day DXY/DGS2 change, DGS10 inversion bonus, VIX percentile, or Macro score was calculated.

---

## 14. P10 Social momentum proof

**Question:** Can current `btc_price_momentum_7d` be reconstructed using only data available through `T`?

**FACT:** Current code fetches `coinGecko.getMarketChart(30, 'daily')`. Momentum is last-7 average vs previous-7 average inside **that same 30d vector**. The percentile universe is other 7-vs-7 windows in the same fetch after a 14-day warmup. It is **not** a long historical rank archive.

**FACT:** `latestPrice` is used by `hasSocialDataChanged` as a cache-compare threshold, not as the momentum input. Historical 40/35/25 cache aggregates are not current 70/30 proof.

**FACT:** Coinbase `latest.json` spots and completed closes are different measurements from CoinGecko daily chart prices.

**EVIDENCE:** Social cache stores `latestPrice` / ranks, not the 30d price vector. The 30d chart archive is the same sparse set as P8.

**DECISION:** `PARTIALLY_PROVEN`. The universe **can** be truncated mechanically by requesting a 30d window ending at `T`. That requires a PIT 30d CoinGecko vector, which is sparsely captured. Component remains `U`/`U`. H6 trending `A`/`A` is retained. Factor stays `U`/`U`.

**DECISION:** No momentum percentile or Social factor score was calculated.

---

## 15. Updated component classifications

| Component | After H6.1 exact / method | Notes |
|---|---|---|
| Trend `utc_intraday_snapshot` | A/A from 2026-08-17 labeled artifacts; unlabeled history not current snapshot | P1 |
| Trend completed-close / Mayer-RSI universe | U / B (mechanical T-truncation) | P2 |
| Stablecoin constituent identity | A/A from 2025-10-05 7-length files | P3 |
| Stablecoin 365d supply-growth universe | U/U | P4 |
| Stablecoin 7d momentum threshold / caps | structurally supplied by dated 30d files; not separately promoted | P4 |
| ETF HTML raw inputs | A/A from 2025-10-07 | P5 |
| ETF exact operational parser/baseline | U | P5 |
| NL ALFRED retrieval | capability proven; factor components U | P6 |
| Term funding provider / 30-row window | A/A from 2025-12-11 | P7 |
| Term 30d spot chart | A on sparse capture dates; U elsewhere | P8 |
| Macro ALFRED retrieval | capability proven; 11:00 U | P9 |
| Social trending | A/A retained from H6 | not reopened |
| Social 7d momentum | U/U | P10 |

---

## 16. Updated seven-factor classifications

| Factor | Baseline | After H6.1 | Earliest exact | Earliest method |
|---|---|---|---|---|
| trend_valuation | U/U | U/U | empty | empty |
| stablecoins | U/U | U/U | empty | empty |
| etf_flows | U/U | U / **B** | empty | **2025-10-07** |
| net_liquidity | U/U | U/U | empty | empty |
| term_leverage | U/U | U/U | empty | empty |
| macro_overlay | U/U | U/U | empty | empty |
| social_interest | U/U | U/U | empty | empty |

**DECISION:** Replay candidate dates are populated only where a factor-level class is actually established. Component A dates are not copied into empty factor date fields.

---

## 17. Coverage / overlap metadata

**FACT:** ETF Git HTML capture span is 2025-10-07 through 2026-08-19, 305 files, INTERMITTENT on a business-day filename cadence. Longest filename contiguous calendar run is 2025-10-14 through 2026-01-13.

**FACT:** Stablecoin 7-series dated JSON span is 2025-10-05 through 2026-08-19, 308 files, INTERMITTENT (8 calendar gaps retained from H6).

**FACT:** Term funding cache span is 2025-12-11 through 2026-08-19, 241 dates, INTERMITTENT.

**FACT:** Intersection of factor-level A/B date sets is **ETF method-B dates only**. Six factors remain U, so no seven-factor overlap exists.

**DECISION:** A three-day 2026-08-17..19 island where labeled snapshots, CSV vintages, ETF HTML, term funding+chart, and social chart coexist is **not** promoted to a full-model interval because NL, Macro, Stablecoins supply-growth, and Social momentum still fail H6 aggregation.

---

## 18. Full exact-replay verdict

**A. Exact historical current-model replay:** **NOT ESTABLISHED**

Not `YES` (seven-factor exact A not established). Not `NO` (no new demonstrated D blocker of the whole model).

**Remaining exact blockers:** Trend snapshot identity before 2026-08-17; Stablecoins 365d universe; ETF parser timezone / preferred baseline; NL/Macro non-vintage production plus 11:00 vintage; Term vol/stress chart; Social momentum 30d chart.

---

## 19. Full methodology-replay verdict

**B. Validation-grade current-methodology replay:** **NOT ESTABLISHED**

ETF is now `B`. Six factors remain `U`. All-seven A/B is not established.

**C. Earliest defensible full-model date:** **NONE / NOT ESTABLISHED**

**D. Longest defensible overlapping interval:** **NONE / NOT ESTABLISHED**

Exploratory reconstruction remains conceivable for hypothesis generation only. It was **not** built.

---

## 20. Remaining blockers

**E. Remaining exact blockers**

1. Trend: unlabeled spots are yesterday close, not current snapshot.
2. Stablecoins: dateless `changeSeries` / current 365d merge not proven PIT-safe.
3. ETF: local-TZ `isBusinessDay`; frozen 2025-09-17 percentile file vs HTML-derived universe.
4. NL/Macro: production ordinary FRED; operational caches lack raw arrays.
5. Term: 30d chart not contiguous on the funding-cache interval.
6. Social: 30d CoinGecko momentum vector sparsely captured.

**F. Remaining methodology blockers**

1. Trend snapshot semantic break still blocks method A/B for unlabeled dates.
2. Stablecoins supply_growth 365d universe.
3. NL/Macro 11:00 UTC vintage rule not specified as current methodology (date-level ALFRED failed that test).
4. Term/Social 30d chart density.
5. ETF method B is established; it is not a remaining methodology blocker for that factor.

---

## 21. Recommended next phase

**DECISION:** **EXPLORATORY RECONSTRUCTION PROTOCOL**

Rationale: validation-grade seven-factor A/B is not established. Remaining U items are more than one or two closed-form proofs. Sparse 30d charts cannot be invented from Git. Pre-2026-08-16 Trend spots are the wrong measurement. An explicitly non-validation study could still use proven ETF HTML, 7-coin JSON, BitMEX funding windows, and ALFRED vintages **with** the 11:00 caveats. Forward collection of labeled snapshots and `market_chart_30` should continue operationally, but that is not a full-model authorization.

Not selected:

- H6.2 EXACT-REPLAY PROTOCOL (full exact replay not established)
- H6.2 METHOD-REPLAY PROTOCOL (all seven A/B not established)
- H6.2 NARROW TARGETED PROOF AUDIT (more than one or two important U items remain)
- NO HISTORICAL CURRENT-MODEL REPLAY (no genuine D of the whole model)
- CONTINUE FORWARD COLLECTION ONLY (historical proof in this audit was productive; remaining gaps are mixed)

Do not begin that protocol in this operation.

---

## 22. Relationship to H6

**FACT:** H6 files were not modified. H6 remains the frozen baseline.

**FACT:** H6.1 does not replace H6 classifications except where `h6_1_factor_updates.csv` records an explicit update (`etf_flows` methodology `B`).

**FACT:** H6 conclusions that remain true: no historical G-Scores; no historical factor scores; no replay built; raw PIT source evidence can be strong while factor replay is `U`; Social `D` remains withdrawn; Social trending `A`/`A` retained.

---

## 23. Calibration decision

**DECISION:** Calibration gate remains **CLOSED**.

No H6.1-based changes to weights, subweights, factor formulas, score formula, bands, thresholds, recommendations, or data sources.

---

## 24. Final H6.1 verdict

**DECISION:** H6.1 completed the ten assigned proof tracks. External HTTP requests used as evidence: **31** (limit 50). Response SHA-256 recorded for retrievals.

| Item | Result |
|---|---|
| Exact current-model replay | **NOT ESTABLISHED** |
| Validation-grade current-methodology replay | **NOT ESTABLISHED** |
| Earliest full-model date | **NONE / NOT ESTABLISHED** |
| Seven-factor overlapping interval | **NONE / NOT ESTABLISHED** |
| ETF methodology | **B from 2025-10-07** |
| Other six factors | **U / U** |
| Next phase | **EXPLORATORY RECONSTRUCTION PROTOCOL** |
| Calibration | **CLOSED** |

**SAFETY:** No historical G-Scores. No historical factor scores. No composites. No H4/H5. No ETL. No source backfill. No model tuning. No production code or `public/data` commits.

STOP FOR INDEPENDENT H6.1 PROOF REVIEW. Do not merge. Do not begin replay implementation.
