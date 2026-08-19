# H6.1 Targeted Source Proof Audit

**Date:** 2026-08-19  
**Repository:** firemansghost/btc-risk-dashboard-V3  
**Branch:** `research/h6-1-targeted-source-proof-audit`  
**H6.1_BASE_SHA:** `b0dc6d1d77e17f3ff36ee13008a26207c4fe558d`  
**MODEL_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`  
**H6.1_VERSION:** `h6.1-targeted-source-proof-v1`
**Correction pass:** stablecoin state-lineage / P8 exact-method invariant (still the same H6.1 version; frozen H6 untouched)
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

**DECISION:** `stablecoins` methodology class is upgraded to `B_POINT_IN_TIME_METHOD_EQUIVALENT` from **2025-10-05** on the 7-series dated-cache set with Git-recoverable pre-run `changeSeries` state. Exact class remains `U_UNRESOLVED`.

**DECISION:** The other five enabled factors remain `U_UNRESOLVED` / `U_UNRESOLVED` at factor level (`trend_valuation`, `net_liquidity`, `term_leverage`, `macro_overlay`, `social_interest`).

**FACT:** Component-level promotions that do **not** move their factor:

- Trend labeled `utc_intraday_snapshot` artifacts from **2026-08-17**
- Stablecoin 7-coin positional identity from **2025-10-05** (now also used at factor method B)
- Term BitMEX funding-provider identity from **2025-12-11**
- Term/Social `market_chart_30_daily` vectors `A`/`A` on the sparse captured-date set from **2025-09-20**
- Social trending `A`/`A` retained from H6
- ALFRED vintage **retrieval** for NL and Macro series on three proof dates

**DECISION:** Recommended next phase is **EXPLORATORY RECONSTRUCTION PROTOCOL**. Validation-grade seven-factor A/B was not established. Remaining U items are heterogeneous (snapshot semantic break, 11:00 UTC vintage timing, sparse 30d charts at factor-aggregation density). Do not begin replay implementation in this operation.

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

**EVIDENCE:** Full `scripts/etl/compute.mjs` history contains 46 commits. `getCoinbaseCloseForYesterday()` is present from the first ETL commit `3d11cce2e82bd9d9116cc187a6cf75f12a4fe3f5` (2025-09-15, blob `62f61618178f8e959c8a848f30c182a6174408cf`) through the immediate pre-snapshot parent `5ce98324`. `git log -S` shows the symbol was added once and replaced once (`daae316b`, 2026-08-16). All 42 pre-snapshot `compute.mjs` commits contain the call. The four commits without it are `daae316b` and three later 2026-08-16 signal/ETL commits.

**INFERENCE:** Inspected pre-snapshot implementations, including 2025-09-26 (`d0abe770` blob `ba1e44117dd80717a34eae859f08fec5afba0e94`) and the immediate pre-change parent, use `getCoinbaseCloseForYesterday()`. No inspected pre-change implementation proves current `utc_intraday_snapshot` semantics. This is not a reconstruction of runtime Coinbase-failure fallbacks.

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

**DECISION:** `PROVEN` for 7-length files from **2025-10-05**. `2025-10-04` is excluded. Component identity `A`/`A` is now used together with corrected P4 state lineage for factor methodology `B` (section 8).

**DECISION:** No HHI was calculated.

---

## 8. P4 Stablecoin historical-universe proof

**Question:** Can current supply-growth and momentum rank universes be reconstructed using only material through `T`?

**FACT:** Current live fetch is CoinGecko `days=30`, not 365. Dated Git JSON files are ~31-point windows. That satisfies the current 30d cap window.

**FACT:** `calculateWeightedStablecoinChanges()` at MODEL_SOURCE_SHA (`factors.mjs` blob `e9fd06df79967f0041a901e2dd971b771e669b03`) loops `for (let i = 30; i < coin.marketCaps.length; i++)`. For N market-cap observations the number of 30-day change observations is `max(N - 30, 0)`. For a normal 31-point CoinGecko daily window, N = 31, therefore **one** 30-day change observation per coin. After weighted aggregation, `newChangeSeries` normally contains **one** weighted aggregate observation. This audit did not calculate that numerical value.

**FACT:** Production then performs `updatedChangeSeries = [...historicalBaseline.changeSeries, ...newChangeSeries]` and `slice(-365)` if length exceeds 365. HEAD length is 283, so the 365-cap has not been reached. Production does **not** normally append a 30-point baseline window when the fetched market-cap vectors contain 31 daily observations.

**FACT:** `computeStablecoins()` reads `historicalBaseline` before scoring. The supply percentile uses that **pre-run** `changeSeries`. After the current calculation it may write `updatedHistoricalData`. Observation T therefore uses the pre-run baseline. The Git commit produced by run T may contain the post-run baseline. Exact replay of the baseline for observation T requires the prior committed blob, not the same-commit post-run blob. On first creation (empty file) current code uses the fallback 1-point `newChangeSeries` as the percentile universe, then writes it.

**FACT:** `supply_growth` percentiles `historicalBaseline.changeSeries`. `momentum` in current code is a 7-day **threshold** on the 30d window (`recentMomentum > 1 / 0.5`), not a 365-day percentile. Concentration uses current caps.

**EVIDENCE:** Git history of `public/data/stablecoins-historical.json`: **286** commits and **286** unique blobs. First commit `b3a4924bd593bb9f2564725eb2a773d3950328b7` (2025-10-05) blob `31d5b361e84f8b478b0d3750285eb736b67794c0`, `lastUpdated=2025-10-05T00:05:38.264Z`, length 1. HEAD `ad6be423` blob `5bce43351e41c47dfebd440264bc8ef307520d8a`, length 283. The series is numbers-only with no observation dates.

**EVIDENCE:** Consecutive `changeSeries` structural classification (no value recomputation):

| Class | Count |
|---|---|
| UNCHANGED | 3 |
| APPEND_1 | 282 |
| APPEND_N | 0 |
| ROLLING_APPEND | 0 |
| RESET | 1 (first blob) |
| REWRITE | 0 |
| OTHER | 0 |

**FACT:** Where APPEND_1 is expected, the previous array is preserved as an exact prefix. No REWRITE of already-present values occurred. The ~1-point-per-commit Git growth is consistent with current production, not evidence against it. The three UNCHANGED commits (2026-07-27, 2026-08-03, 2026-08-08) rewrote `lastUpdated` with an identical series.

**EVIDENCE:** Representative pre-run vs post-run:

| Observation date | Pre-run blob / length | Post-run blob / length | Transition |
|---|---|---|---|
| 2025-10-05 | none (empty-baseline branch) | `31d5b361` / 1 | RESET |
| 2025-10-06 | `31d5b361` / 1 | `5a97ae52` / 2 | APPEND_1 |
| 2025-12-11 | `b10768d5` / 45 (`ec1b931b`) | `ef1094ad` / 46 (`6082a0f7`) | APPEND_1 |
| 2026-08-17 | `59da15c9` / 280 (`0032a729`) | `e7dcb199` / 281 (`db789cd9`) | APPEND_1 |
| 2026-08-19 | `c3c5f8b0` / 282 (`3e0c07ff`) | `5bce4335` / 283 (`ad6be423`) | APPEND_1 |

**FACT:** For every candidate date T, the Git-recoverable pre-run state is the last committed historical blob with commit date strictly before T (empty on 2025-10-05). Same-commit post-run blobs are not the observation-T universe.

**EVIDENCE:** Date / raw-cache join (presence only; no `aggregateChange` / growth / HHI): 309 dated files; 308 are 7-series from 2025-10-05 through 2026-08-19 (`2025-10-04` remains 3-series exclude). All 308 have structurally satisfiable growth-guard inputs (`>=3` coins with `>=30` finite caps and SSOT weight coverage `>=0.7` from those slots). 260 files have all seven series at `>=31` caps; 48 have at least one empty/short slot but still pass the structural guard. Contemporaneous 7-coin fetch-order code exists from `6b959cb8` (2025-10-04). Current 30d raw-window structure is present. Gap count vs filenames = **8**. Longest contiguous run = **101** calendar days from **2025-10-05** through **2026-01-13**. First reconstructable pre-run baseline date = **2025-10-06**. Longest preferred-path interval = **100** days from **2025-10-06** through **2026-01-13**.

**LIMITATION:** Dated JSON still does not label CoinGecko vs CMC/CryptoCompare fallback identity. Missing internal dates on `changeSeries` are not a blocker once append-only prefix preservation is proven, but exact upstream provider identity remains unproven.

**DECISION:** `PROVEN` for recoverable PIT baseline **state lineage**. `supply_growth` exact remains `U_UNRESOLVED`. `supply_growth` methodology is `B_POINT_IN_TIME_METHOD_EQUIVALENT` from **2025-10-05** on the 7-series set. Momentum and concentration are supplied by the same dated 30d files (P3 identity `A`/`A`). Stablecoins factor methodology is therefore `B` on that set. Factor exact remains `U`.

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

**FACT:** Current `computeTermLeverage` calls `coinGecko.getMarketChart(30, 'daily')` and uses `spotData.prices`. That call writes `public/data/cache/market_chart_30_daily.json`. Term cache stores `spot_observation_utc` but **not** the price vector.

**EVIDENCE:** `getMarketChart(30, 'daily')` exists in `factors.mjs` from commit `929f8befe23f8b9f5e98e8456f122e1aef3bebe8` (2025-09-19, blob `3ec2df2aa0e7eb8b2d343c2bf6ea8acbe0604790`), **before** the first Git chart capture. Current MODEL_SOURCE_SHA uses the same call (`coinGeckoCache.mjs` blob `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff`).

**EVIDENCE:** `market_chart_30_daily.json` has **12** commits / **9** distinct capture dates, all 31-point vectors: 2025-09-20 (`c897c44c` blob `b990b54cff761d65057d54f74f667406a4cdb744`), 2025-09-23, 2025-09-24, 2025-09-26, 2025-10-01, 2025-10-29, 2026-08-17, 2026-08-18, 2026-08-19. Pre-envelope captures are raw CoinGecko payloads; 2026-08-17 onward include `cachedAt`. Both are the operational `market_chart_30_daily` measurement.

**FACT:** The earliest **component** candidate is **2025-09-20**, the first proven current `market_chart_30_daily` capture under those code semantics. Term funding-cache overlap (2026-08-17..19) is factor-intersection metadata only and is not the component start.

**FACT:** Exact `A` on a captured date requires method `A` or `B` on that same date. The prior `A`/`U` pair is forbidden and is corrected.

**EVIDENCE:** Historical CoinGecko stability checks (correction pass; raw prices only):

| Capture | Endpoint | HTTP | Match / differ | Response SHA-256 |
|---|---|---|---|---|
| 2025-09-26 `1647c787` blob `3d4d8a11` | `market_chart/range` from/to covering 2025-08-28..2025-09-26 plus 100d | 401 | not comparable | `7a7fb9329968a1f03f7a1e14c00a093a5beef7dff1bb54e86a86ea150b60f088` |
| 2025-10-29 `983e04df` blob `a92edbbd` | `market_chart/range` covering 2025-09-30..2025-10-29 plus 100d | 401 | not comparable | `aaebf3dc45b0eeb88c48168b209e552fe24036e44f3309d0208482f4646726e9` |
| 2026-08-17 `db789cd9` blob `3eaaca33` | `market_chart/range` covering 2026-07-19..2026-08-17 plus 100d | 200 | 29 matching; 2 differing | `c71354edfdcb4d402382db819d868f431ecd3f9c8ae16176d7fbfe082ee680a1` |
| public max daily | `market_chart?days=max&interval=daily` | 401 | not comparable | `3356a1df6705487728d6483830acbbf58d18e7255522a572ac62d3f8babdfbf1` |

**FACT:** Public CoinGecko API error_code 10012: historical queries are limited to the past 365 days. That is why the 2025 captures cannot be compared from 2026-08-19 without a paid plan. The 2026-08-17 range body had 131 daily points (2026-04-10 through 2026-08-18). The two price differences are both UTC date `2026-08-17` (Git has two same-calendar-day points vs one live daily point; max abs diff 1145.53). Completed days in that capture matched the later official daily series. No realized volatility was calculated.

**LIMITATION:** Equality on one recent capture does **not** turn uncaptured dates into PIT evidence. It is provider historical-stability evidence for completed days inside that sampled window only. 2025 revision/backfill remains untested because the official public endpoint cannot retrieve those dates from this environment.

**DECISION:** `PROVEN` on the captured-date set. P8 exact/method = `A_EXACT_POINT_IN_TIME` / `A_EXACT_POINT_IN_TIME` from **2025-09-20** on those Git captures. Coverage is INTERMITTENT (9 dates; long gap after 2025-10-29). Term factor `realized_vol` / `stress` remain unable to establish a meaningful full-factor interval across the dense funding-cache span.

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

**EVIDENCE:** Social cache stores `latestPrice` / ranks, not the 30d price vector. The 30d chart archive is the same captured set as P8 (`A`/`A` from **2025-09-20** on those dates). Current momentum can structurally use those exact raw vectors on those dates. No momentum value was calculated.

**DECISION:** Momentum component is `A`/`A` on the P8 captured-date set. H6 trending `A`/`A` is retained. Social **factor** stays `U`/`U` because trending and momentum are not validation-grade on the same defined interval of meaningful length: trending capture density begins 2025-12-11 while 30d charts in that span exist only on 2026-08-17..19. A three-day island is not a full-factor replay interval.

**DECISION:** No momentum percentile or Social factor score was calculated.

---

## 15. Updated component classifications

| Component | After H6.1 exact / method | Notes |
|---|---|---|
| Trend `utc_intraday_snapshot` | A/A from 2026-08-17 labeled artifacts; unlabeled history not current snapshot | P1 |
| Trend completed-close / Mayer-RSI universe | U / B (mechanical T-truncation) | P2 |
| Stablecoin constituent identity | A/A from 2025-10-05 7-length files | P3 |
| Stablecoin 365d supply-growth universe | U / B from 2025-10-05 via recoverable pre-run changeSeries | P4 corrected |
| Stablecoin 7d momentum threshold / caps | structurally supplied by dated 30d files; method-safe with P3 identity | P4 |
| ETF HTML raw inputs | A/A from 2025-10-07 | P5 |
| ETF exact operational parser/baseline | U | P5 |
| NL ALFRED retrieval | capability proven; factor components U | P6 |
| Term funding provider / 30-row window | A/A from 2025-12-11 | P7 |
| Term 30d spot chart | A/A on captured dates from 2025-09-20; INTERMITTENT | P8 corrected |
| Macro ALFRED retrieval | capability proven; 11:00 U | P9 |
| Social trending | A/A retained from H6 | not reopened |
| Social 7d momentum | A/A on the same P8 captured-date set; sparse | P10 |

---

## 16. Updated seven-factor classifications

| Factor | Baseline | After H6.1 | Earliest exact | Earliest method |
|---|---|---|---|---|
| trend_valuation | U/U | U/U | empty | empty |
| stablecoins | U/U | U / **B** | empty | **2025-10-05** |
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

**FACT:** Intersection of factor-level A/B date sets is ETF method-B dates (from 2025-10-07) and Stablecoins method-B dates (from 2025-10-05). Five factors remain U, so no seven-factor overlap exists.

**DECISION:** A three-day 2026-08-17..19 island where labeled snapshots, CSV vintages, ETF HTML, term funding+chart, and social chart coexist is **not** promoted to a full-model interval because NL, Macro, Trend unlabeled history, Term factor density, and Social factor density still fail H6 aggregation.

---

## 18. Full exact-replay verdict

**A. Exact historical current-model replay:** **NOT ESTABLISHED**

Not `YES` (seven-factor exact A not established). Not `NO` (no new demonstrated D blocker of the whole model).

**Remaining exact blockers:** Trend snapshot identity before 2026-08-17; Stablecoins unlabeled CoinGecko vs fallback identity; ETF parser timezone / preferred baseline; NL/Macro non-vintage production plus 11:00 vintage; Term vol/stress chart density; Social factor density (momentum A only on sparse chart dates).

---

## 19. Full methodology-replay verdict

**B. Validation-grade current-methodology replay:** **NOT ESTABLISHED**

ETF is now `B`. Stablecoins is now `B`. Five factors remain `U`. All-seven A/B is not established.

**C. Earliest defensible full-model date:** **NONE / NOT ESTABLISHED**

**D. Longest defensible overlapping interval:** **NONE / NOT ESTABLISHED**

Exploratory reconstruction remains conceivable for hypothesis generation only. It was **not** built.

---

## 20. Remaining blockers

**E. Remaining exact blockers**

1. Trend: unlabeled spots used `getCoinbaseCloseForYesterday()`, not current snapshot.
2. Stablecoins: dated JSON does not label CoinGecko vs CMC/CryptoCompare fallback; exact A withheld.
3. ETF: local-TZ `isBusinessDay`; frozen 2025-09-17 percentile file vs HTML-derived universe.
4. NL/Macro: production ordinary FRED; operational caches lack raw arrays.
5. Term: 30d chart `A`/`A` on 9 captured dates; not contiguous on the funding-cache interval.
6. Social: momentum `A`/`A` only on those same sparse chart dates; not a full-factor interval with trending.

**F. Remaining methodology blockers**

1. Trend snapshot semantic break still blocks method A/B for unlabeled dates.
2. NL/Macro 11:00 UTC vintage rule not specified as current methodology (date-level ALFRED failed that test).
3. Term/Social 30d chart density at factor-aggregation level.
4. ETF method B is established; Stablecoins method B is established; they are not remaining methodology blockers for those factors.

---

## 21. Recommended next phase

**DECISION:** **EXPLORATORY RECONSTRUCTION PROTOCOL**

Rationale: After corrected P4 and P8, validation-grade seven-factor A/B is still not established. Remaining factor-level U items are more than one or two closed-form proofs (Trend snapshot break; NL 11:00 vintage; Macro 11:00 vintage; Term chart density; Social factor density). Sparse 30d charts cannot be invented from Git. Pre-2026-08-16 Trend spots are the wrong measurement. An explicitly non-validation study could still use proven ETF HTML, 7-coin JSON plus recoverable pre-run baselines, BitMEX funding windows, captured 30d charts, and ALFRED vintages **with** the 11:00 caveats. Forward collection of labeled snapshots and `market_chart_30` should continue operationally, but that is not a full-model authorization.

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

**FACT:** H6.1 does not replace H6 classifications except where `h6_1_factor_updates.csv` records an explicit update (`etf_flows` methodology `B`; `stablecoins` methodology `B`).

**FACT:** H6 conclusions that remain true: no historical G-Scores; no historical factor scores; no replay built; raw PIT source evidence can be strong while factor replay is `U`; Social `D` remains withdrawn; Social trending `A`/`A` retained.

---

## 23. Calibration decision

**DECISION:** Calibration gate remains **CLOSED**.

No H6.1-based changes to weights, subweights, factor formulas, score formula, bands, thresholds, recommendations, or data sources.

---

## 24. Final H6.1 verdict

**DECISION:** H6.1 completed the ten assigned proof tracks and a correction pass for P4/P8. External HTTP requests used as evidence: **36** (limit 50). Response SHA-256 recorded for retrievals.

| Item | Result |
|---|---|
| Exact current-model replay | **NOT ESTABLISHED** |
| Validation-grade current-methodology replay | **NOT ESTABLISHED** |
| Earliest full-model date | **NONE / NOT ESTABLISHED** |
| Seven-factor overlapping interval | **NONE / NOT ESTABLISHED** |
| ETF methodology | **B from 2025-10-07** |
| Stablecoins methodology | **B from 2025-10-05** |
| Other five factors | **U / U** |
| P8 chart component | **A / A from 2025-09-20 on captured dates** |
| Next phase | **EXPLORATORY RECONSTRUCTION PROTOCOL** |
| Calibration | **CLOSED** |

**SAFETY:** No historical G-Scores. No historical factor scores. No composites. No H4/H5. No ETL. No source backfill. No model tuning. No production code or `public/data` commits.

STOP FOR FINAL INDEPENDENT H6.1 REVIEW. Do not merge. Do not begin replay implementation.
