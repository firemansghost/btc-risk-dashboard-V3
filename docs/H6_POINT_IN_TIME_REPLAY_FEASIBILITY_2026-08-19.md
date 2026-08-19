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

A Git-provenance completion pass corrected the first H6 inventory. Classifications below supersede the first-pass Social `D_NOT_REPLAYABLE` / `NONE` wording.

---

## 1. Executive conclusion

**DECISION:** Exact historical production replay of the **full** current seven-factor `v1.1.1` composite is **NOT ESTABLISHED**.

**DECISION:** Validation-grade current-methodology replay of the **full** seven-factor composite is **NOT ESTABLISHED**.

**DECISION:** Earliest defensible contiguous full-model date = **NONE / NOT ESTABLISHED**. No date is manufactured.

**DECISION:** `social_interest` is **not** `D_NOT_REPLAYABLE` on the Git-captured date set. Contemporaneous Git blobs of `public/data/cache/trending.json` and `public/data/cache/social_interest/social_interest_cache.json` are point-in-time CoinGecko trending **source** evidence. Factor-level replay of **current** 70/30 Social remains `U_UNRESOLVED` / `U_UNRESOLVED` because the 30% momentum percentile universe is not proven PIT-safe. Historical 40/35/25 cache aggregates are not current-methodology proof.

**FACT:** Replay class describes whether the **current** scored factor can be reconstructed. A raw Git capture can be exact PIT **source** evidence while replay class remains `U`.

**FACT:** Full exact production replay on date T still requires **all seven** enabled scored factors to be `A` on T. Full validation-grade methodology replay requires all seven `A` or `B` with no `C`/`D`/`U` component.

**FACT:** After classification hardening, all seven enabled factors are `U_UNRESOLVED` / `U_UNRESOLVED` at **factor replay** level. Strong PIT raw-source evidence is retained for Social trending, ETF HTML, stablecoin dated JSON, term `fundingData`, macro/NL observation dates, and `latest.json` spots.

**DECISION:** No surviving `D` blocker was demonstrated for a usable Social Git interval. Full-model `NO` is therefore not used. Remaining blockers are unfinished proof (`U`), not a demonstrated impossibility of every factor.

**DECISION:** Recommended next step is **H6.1 TARGETED SOURCE PROOF AUDIT**. Do not begin a replay implementation. Do not calculate historical scores.

---

## 2. Scope and hard firewall

H6 determines whether the **current** `v1.1.1` methodology can be reconstructed historically without lookahead contamination.

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

Companion files (exactly four outputs):

1. `docs/H6_POINT_IN_TIME_REPLAY_FEASIBILITY_2026-08-19.md` (this file)
2. `research/point-in-time-replay/README.md`
3. `research/point-in-time-replay/source_requirements.csv`
4. `research/point-in-time-replay/factor_feasibility.csv`

---

## 3. Current v1.1.1 implementation identity

**FACT:** `origin/main` equals `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`. H6 branched from that SHA exactly.

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
| `scripts/etl/lib/sourceObservationTime.mjs` | `8a9790666e8d8ea508a865de1b2f4b0da75a3db8` | Social/macro source-observation clocks |
| `scripts/etl/coinGeckoCache.mjs` | `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff` | Disk cache; `getTrending()` → key `trending` → `public/data/cache/trending.json` |
| `scripts/etl/marketCalendar.mjs` | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` | ETF publication hour, US trading-day, `selectPublishedEtfFlowRows` |
| `scripts/etl/fetch-helper.mjs` | `da8ca2b441088f2e13364249e7ecbbed40dc22a4` | Retry/backoff fetch wrapper |
| `scripts/etl/factors/stablecoinGrowthAggregation.mjs` | `338ed9046643ab5ccc3fa7f892d4628fe8b55fb4` | Stablecoin growth aggregation |
| `scripts/etl/factors/stablecoinGrowthGuard.mjs` | `3728eb0f7bc2ecdf5faa35edde564a735c9c6bb2` | Min coins / weight guard |
| `lib/config-loader.mjs` | `8f439254ca813050703a7c17bcd658474c19e2b2` | Runtime config load |

**FACT:** `CoinGeckoClient.getTrending()` in `coinGeckoCache.mjs` calls `https://api.coingecko.com/api/v3/search/trending` and stores the response under disk-cache key `trending`, which maps to `public/data/cache/trending.json`.

**FACT — code-vs-docs discrepancy:** `config/subweights.json` blob `e6cbb244e9ff6871e784a023e9e8e9f09e9a923d` still lists `social_interest.google_trends` / `fear_greed` and `term_leverage.funding_7d` / `basis_front` / `oi_mcap`. That file is **not** implementation authority.

**DECISION:** CODE WINS. Production subweights are `dashboard-config.json` `subweights` plus `LOCKED_OFFICIAL_BLENDS` in `ssotSubweights.mjs`.

---

## 4. Replay fidelity definitions

Three concepts are never treated as equivalent.

**Replay class describes whether the CURRENT scored component/factor can be reconstructed, not merely whether a historical raw source payload exists.**

**Raw PIT source evidence can be strong while factor replay remains `U_UNRESOLVED`.**

### Source evidence vs replay class

A contemporaneously committed Git cache/HTML blob is **category-2 point-in-time SOURCE EVIDENCE** for that capture. Record it in `repo_historical_evidence` and in the narrative.

It does **not** automatically make `exact_production_replay_class` or `methodology_replay_class` equal to `A`. Replay `A` also requires proven current lookbacks, percentile/rank universes truncated at T, constituent identity, publication-state rules, fallback identity, and all scored formula dependencies.

### Classification invariants

1. **Raw capture ≠ factor replay.** Do not overload replay class `A` to mean “we have the raw cache.”
2. **Exact is stricter than methodology.** If exact = `A_EXACT_POINT_IN_TIME`, methodology must be `A` or `B`. Exact `A` with method `U`/`C`/`D` is forbidden. If current methodology cannot yet be reconstructed, exact cannot be `A`.
3. **Factor aggregation.** Factor exact `A` only if **all** required scored components and required lookbacks/state are exact `A`. Factor methodology `A` or `B` only if **all** required scored components are `A` or `B` and required historical lookbacks/rank universes are PIT-safe. If any required component is `U`, `C`, or `D`, factor methodology must not be `A` or `B`.

### A. Exact production replay

Reconstruct the observation the **current** production pipeline would have produced at historical time T, including exact source/provider selected, exact source value as available then, exact publication/release timing, exact fallback behavior, exact cache state if material, exact current/snapshot price semantics, exact **current** formula, exact completed-period logic, and exact availability before `as_of_utc`.

### B. Point-in-time methodology replay

Reconstruct current `v1.1.1` mathematics using genuine point-in-time inputs knowable at T, without claiming the exact historical operational provider/fallback/cache state.

### C. Exploratory reconstruction

Uses inputs that are revised later, backfilled later, reconstructed later, proxy substituted, unavailable with exact release timing, or not provably knowable at T.

### Coverage wording

`INTERMITTENT` means the **full stated span** contains one or more gaps. It does **not** mean no contiguous subruns exist. Full-span coverage is intermittent; contiguous subruns exist, but the longest qualifying replay interval has not yet been established unless a specific run is proven. For ETF, evaluate business-day cadence rather than requiring weekend rows.

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

**FACT:** Overwriting a working-tree cache file does not erase historical Git blobs.

**FACT:** A mutable provider endpoint fetched today is not PIT. A same-day Git commit of that payload **is** PIT for the commit/capture date.

**DECISION:** Existing synthetic/reconstructed factor histories committed in Git are not strong point-in-time **raw-source** evidence merely because they are committed. Cached **raw** payloads (trending JSON, Farside HTML, stablecoin market_chart arrays, fundingData) are category-2 evidence. Cached **computed scores** are not used and are not backsolved.

---

## 6. Point-in-time knowability standard

A historical value is eligible only if it could reasonably have been known by the hypothetical GhostGauge run's `as_of_utc`.

Do not confuse observation date, publication/release time, fetch time, and later revision time.

**FACT:** Typical production cadence encoded in freshness modules is an ~11:xx UTC run. Same-day US macro prints and Thursday H.4.1 WALCL are often **not** yet knowable at that clock time.

**FACT:** A provider returning a value for historical date D **today** does not prove that the same value was available on D.

**LIMITATION:** A Git artifact committed at 15:43 UTC is PIT for that fetch, not automatically identical to an 11:xx UTC fetch of a live endpoint (Social trending).

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

**FACT:** On-chain is disabled / weight 0 and does **not** block full current composite replay. Market Regime, Cycle Timing, Gold, and Sats are display-only.

---

## 8. Trend & Valuation audit

**FACT:** Current scored components are BMSB distance 0.60, Mayer stretch 0.30, weekly RSI 0.10.

**FACT:** `calculateBMSB` requires at least 22 completed UTC weekly closes. Snapshot price is the distance numerator. Mayer stretch = snapshot / SMA200 of completed UTC daily closes. Weekly RSI uses completed weekly closes.

**FACT:** `utc_intraday_snapshot` is a different measurement from the completed daily close.

**EVIDENCE — latest.json inventory (`git log --all --follow`):**

- first appearance: 2025-09-15 (`3d11cce2`)
- last appearance: 2026-08-19 (`ad6be423`)
- 452 commits, 451 distinct blobs, 328 distinct commit dates
- path-log without `--follow`: 425 commits; 423 with numeric `btc.spot_usd` (or equivalent); 303 distinct `as_of` dates with spot
- `price_kind=utc_intraday_snapshot` is present on **3** inspected recent commits only; 420 path-log blobs have no `price_kind`
- example: commit `e9083962` `btc.spot_usd=108739.09`, `as_of_utc=2025-09-26T11:19:04.150Z`, `source=Coinbase`
- `.data/json/latest.json`: 12 commits, 6 dates, 2025-09-04 through 2025-09-16 only

**EVIDENCE:** `public/data/btc_price_history.csv` has **5** Git commits (2025-09-24, 2025-09-28, 2026-08-17, 2026-08-18, 2026-08-19). It is not a daily completed-close archive.

**LIMITATION:** Hundreds of contemporaneous published spots exist. That does **not** prove they were produced by current `selectSnapshotFromDailyCandles`. Unlabeled spots are provenance context.

**DECISION:** Coverage is **INTERMITTENT contemporaneous prices**, not “isolated.” Factor classes remain `U_UNRESOLVED` / `U_UNRESOLVED` because current snapshot semantics plus SMA200 CSV-at-T are not proven. Confidence: `MEDIUM`.

---

## 9. Stablecoins audit

**FACT:** Official components are supply_growth 0.55, momentum 0.30, concentration 0.15. Current code hardcodes a 7-coin basket including BUSD 0.03.

**EVIDENCE — dated Git JSON (`public/data/cache/stablecoins/*.json`):**

- 309 files, filenames 2025-10-04 through 2026-08-19
- **every** file first appeared on the **same calendar day** as its filename (`lag=0`)
- later-modified count = 0
- no bulk-backfill commit (each first-appearance commit adds 1 file)
- 8 calendar gaps >1 day
- 2025-10-04 payload is a **3-coin** array of `{prices, market_caps, total_volumes}` (~91 points)
- 308 files from **2025-10-05** are **7-coin**; HEAD 2026-08-19 has ~31-point windows
- objects have **no coin id keys** (positional)

**EVIDENCE:** `public/data/stablecoins-historical.json` has 287 commits from 2025-10-05 through 2026-08-19 and stores derived `changeSeries` (length 283 on HEAD), not raw caps.

**LIMITATION:** Today’s CoinGecko market-chart API is mutable. That does **not** erase these contemporaneous captures.

**LIMITATION:** The hardcoded BUSD-inclusive basket is a survivorship / methodology-selection issue distinct from capture vintage. Each dated file holds 31–91 days of caps, not a proven 365-day PIT raw universe.

**DECISION:** Those Git files are **strong exact PIT raw-source evidence** (category 2). Earliest raw captured 7-series date = **2025-10-05**. Full-span coverage is `INTERMITTENT`; contiguous subruns exist, but the longest qualifying **replay** interval has not been established.

**DECISION:** Factor/component **replay** classes cannot be exact `A` while current 365-day percentile, positional constituent identity, and T-truncated `changeSeries` remain unproven.

- exact: `U_UNRESOLVED`
- methodology: `U_UNRESOLVED`
- contiguous exact: `INTERMITTENT` (raw capture span)
- confidence: `MEDIUM`

---

## 10. ETF Flows audit

**FACT:** Official components are sum_21d 0.30, acceleration 0.30, diversification 0.40. `marketCalendar.mjs` defines `ETF_FLOW_PUBLISH_HOUR_UTC=16`, US trading days, and `selectPublishedEtfFlowRows`.

**EVIDENCE — dated Git HTML:**

- 305 files `public/data/cache/etf/YYYY-MM-DD.html`
- first filename 2025-10-07, last 2026-08-19
- **every** file first appeared the same calendar day as its filename (`lag=0`)
- later-modified = 0
- no bulk backfill
- `2025-10-07.html` ≈ 520KB / 460 `<tr>`; `2026-08-19.html` ≈ 785KB / 673 `<tr>`
- missing weekdays inside the filename span: 2025-10-13, 2026-01-14, 2026-03-06, 2026-03-30, 2026-04-06, 2026-05-25, 2026-06-01

**INFERENCE:** 2025-10-13 and 2026-05-25 align with US market holidays. Other missing weekdays are capture gaps until proven holidays against `US_MARKET_HOLIDAYS_UTC`.

**FACT:** US spot Bitcoin ETP approval is documented at [SEC press release 2024-7](https://www.sec.gov/newsroom/press-releases/2024-7). First trading 2024-01-11 remains structural inception. Git HTML does **not** start then.

**FACT:** `2025-10-07.html` header cells include `IBIT`, `FBTC`, `GBTC`, and `Total`. That is necessary column presence, not a completed 21-business-day / as-of / HHI structural proof.

**DECISION:** Live Farside [bitcoin-etf-flow-all-data](https://farside.co.uk/bitcoin-etf-flow-all-data/) fetched today is not PIT. Genuinely contemporaneous Git HTML **is** category-2 PIT **source** evidence for that capture date.

**DECISION:** Parser execution and as-of-eligible 21-business-day row counting were **not** completed as a no-score structural proof in this hardening pass. Factor-level replay is therefore **not** `A` solely because the HTML files exist (Option B).

- exact: `U_UNRESOLVED`
- methodology: `U_UNRESOLVED`
- raw PIT HTML: retained (305 same-day first appearances, 0 backfills, 0 later modifications, 2025-10-07–2026-08-19)
- full-span coverage: `INTERMITTENT` on a **business-day** cadence (weekday gaps remain; weekends are not required)
- contiguous subruns exist; longest qualifying replay interval not established
- confidence: `MEDIUM` for replay class; HTML provenance remains high-quality source evidence

---

## 11. Net Liquidity audit

**FACT:** Official components are level 0.15, rate_of_change 0.40, momentum 0.45. Production fetches FRED `WALCL`, `RRPONTSYD`, `WTREGEN`. Current FRED observations are latest-revised.

**EVIDENCE:** [FRED ALFRED](https://fred.stlouisfed.org/docs/api/fred/alfred.html) documents vintage `realtime_start` / `realtime_end` / `vintage_dates`. [H.4.1](https://www.federalreserve.gov/releases/h41/) publishes Thursday ~4:30 p.m. ET.

**EVIDENCE — Git cache:** `public/data/cache/net_liquidity/net_liquidity_cache.json`

- 97 distinct blobs / commits / dates
- first 2025-12-11 (`d511199b`)
- last 2026-08-14 (`56ec0993`) blob `74bad5a46f7faeb64c59ea1dbdb8261ef3395384`
- fields include `latestWalclDate`, `lastUpdated`, `details`, `cachedAt`
- inspected blobs do **not** contain raw WALCL/RRP/TGA arrays

**DECISION:** Git cache is operational provenance (which WALCL date production bound). It is not a raw vintage archive. Do not backsolve FRED from cached scores.

**DECISION:** exact `U_UNRESOLVED`; methodology `U_UNRESOLVED`; coverage `INTERMITTENT`; confidence `MEDIUM`.

---

## 12. Term Structure & Leverage audit

**FACT:** Official components are funding 0.40, realized_vol 0.35, stress 0.25. Fallback BitMEX → Binance → OKX.

**EVIDENCE — `term_leverage_cache.json`:**

- 253 distinct blobs, 241 distinct commit dates, 2025-12-11 through 2026-08-19
- same 8 calendar gaps as social cache (11 missing days)
- `fundingData` length **30 in all 253 blobs**
- explicit `funding_provider` field in **3** blobs only, first `db789cd9` 2026-08-17, all `bitmex`
- tree `876fefba` blob `ea0db3913c29e06a8da3b2693f7bd413828b5db9`: `funding_provider=bitmex`, `funding_observation_utc=2026-08-18T04:00:00.000Z`, `spot_observation_utc=2026-08-18T11:27:40.000Z`
- 2025-12-11 sample: no `funding_provider` field; `fundingData[0].symbol=XBTUSD`; details label `Data Source: BitMEX`

**DECISION:** The first-pass phrase “no dated provider-selection archive” is **too strong**. Git contains a dense dated **funding-window** archive and a **short** explicit provider-field archive (3 days). No sufficiently long contiguous explicit `funding_provider` field series has been established.

**EVIDENCE — spot/vol chart cache:**

- `market_chart_30_daily.json`: 13 commits, 10 dates (2025-09-20 … 2025-10-29, then 2026-08-17/18/19)
- `market_chart_365_daily.json`: 4 commits, last 2025-09-23

**DECISION:** Factor-level exact and methodology remain `U_UNRESOLVED` because scored `realized_vol` / `stress` lack a contiguous PIT 30-day chart archive even though funding windows are densely cached. Confidence: `MEDIUM`.

External docs: [BitMEX API](https://www.bitmex.com/app/apiOverview), [Binance funding-rate history](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History), [OKX funding-rate history](https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate-history).

---

## 13. Macro Overlay audit

**FACT:** Official scored blend is `dxy_20d` 0.40 (`DTWEXBGS`), `us2y_20d` 0.35 (`DGS2` plus `DGS10` inversion bonus), `vix_pct` 0.25 (`VIXCLS`). `DFII10` is fetched and not blended.

**EVIDENCE:** `macro_overlay_cache.json`: 175 blobs/dates, 2025-12-11 through 2026-08-19; weekend-like 1-day gap pattern (72 calendar gaps). Inspected blobs have `latestDxyDate` / `latestDgs2Date` / `latestVixDate` and **no** raw FRED arrays.

**EVIDENCE:** [FRED observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html), [ALFRED](https://fred.stlouisfed.org/docs/api/fred/alfred.html), [H.15](https://www.federalreserve.gov/releases/h15/). `macroFreshness.mjs` encodes 11:xx UTC vs same-day US prints.

**DECISION:** Cache dates are operational provenance. They do not reconstruct vintages. Do not backsolve raw FRED from cached scores. Classes remain `U_UNRESOLVED`. Confidence: `MEDIUM`.

---

## 14. Social Interest audit

**FACT:** Official scored components are CoinGecko trending rank 0.70 and BTC 7-day price momentum 0.30. Stale comments and `config/subweights.json` (`google_trends` / `fear_greed`) are not SSOT.

**FACT:** Official CoinGecko docs describe a live endpoint, not a historical archive: [trending-search](https://docs.coingecko.com/reference/trending-search) and `https://api.coingecko.com/api/v3/search/trending` (accessed 2026-08-19).

**EVIDENCE — that live-only documentation does not outrank Git captures.**

### `public/data/cache/trending.json`

| Item | Value |
|---|---|
| First Git appearance | 2025-09-20 `c897c44c` blob `c05a3b4872f36b1e543bce928191994e60448be0` |
| Last Git appearance | 2026-08-19 `ad6be423` blob `7cfafba0eb3a54611f05ce5aeef8b6fd0438e388` |
| Distinct blobs / commits | 12 / 12 |
| Distinct commit dates | 9 |
| Dates | 2025-09-20, 2025-09-23, 2025-09-24, 2025-09-26, 2025-10-01, 2025-10-29, 2026-08-17, 2026-08-18, 2026-08-19 |

Confirmed reviewer blobs:

- 2025-09-26 `e9083962` → `e4770953a873ba475c690372d5e46ddae60b7f99` (raw `coins` envelope, no `cachedAt`; BTC `item.score=14`)
- 2026-08-17 `db789cd9` → `cd34029732767e0dab0635dc7f063dd25beb124a` (`cachedAt=2026-08-17T15:43:13.595Z`)
- 2026-08-18 tree `876fefba` → `d19ca5cc546e7685bfb54e243aabc9233dea2086`
- H6_SOURCE_SHA → `7cfafba0eb3a54611f05ce5aeef8b6fd0438e388` (`cachedAt=2026-08-19T11:29:41.976Z`)

Older payloads rely on commit provenance rather than `cachedAt`. Coverage of **raw** trending.json is **INTERMITTENT** with a large gap after 2025-10-29.

### `public/data/cache/social_interest/social_interest_cache.json`

| Item | Value |
|---|---|
| First Git appearance | 2025-12-11 `6082a0f7` blob `d993f24949db11f58fcbebd3557b52e7118a273e` |
| Last Git appearance | 2026-08-19 `ad6be423` blob `40b73f37414b616019b671ea1b795bba1c584463` |
| Distinct blobs / commits | 252 / 252 |
| Distinct commit dates | 241 |
| Finite `bitcoinRank` | 246 / 252 |
| `provider=CoinGecko • trending` | 238 / 252 |
| Calendar gaps | 8 gaps, 11 missing days |

Gaps: 2026-01-14; 2026-03-06; 2026-03-29–30; 2026-04-04–06; 2026-04-12; 2026-05-25; 2026-06-01; 2026-06-20.

Confirmed reviewer blobs:

- 2026-08-17 `db789cd9` blob `0adf5759c39d9a21c6345f1358118d3dbe26207a`: `provider=CoinGecko • trending`, `trending_fetched_at=2026-08-17T15:43:13.599Z`, `bitcoinRank=9`
- 2026-08-18 `3e0c07ff` blob `f63d2bb1ede13418a71f48fc0f093e244eaf3258`: trending fetch 11:29:26Z; details `Bitcoin Trending Rank = N/A` (production observation when BTC is not listed)
- 2026-08-19 blob `40b73f37`: `bitcoinRank=4`, `trending_fetched_at=2026-08-19T11:29:42.010Z`

2025-12-11 first blob already stores `bitcoinRank=5` and details `Data Sources: CoinGecko • trending`.

**FACT:** September 2025 Social implementation used Search Attention 40% / Price Momentum 35% / Volatility 25%. Current official blend is CoinGecko Trending Rank 70% / BTC Price Momentum 30%. Historical cache **aggregate scores** were not automatically calculated using the current blend and are **not** proof of exact current-methodology factor replay.

**DECISION:** The working-tree file being overwritten does **not** imply no historical PIT evidence.

**DECISION:** Do not backsolve rank from cached `score`. `bitcoinRank`, `searchScore`, `momentumScore`, `latestPrice`, `trending_fetched_at`, and `provider` remain legitimate provenance fields. Raw `trending.json` coins are source fields.

**DECISION:** Do not substitute Google Trends or Fear & Greed.

**DECISION — trending component:** PIT Git captures of CoinGecko trending exist on the captured set. Component replay of **current** rank→score mapping using those ranks is treated as `A_EXACT_POINT_IN_TIME` / `A_EXACT_POINT_IN_TIME` for that date set. `D_NOT_REPLAYABLE` is **removed** for captured dates.

**DECISION — momentum component:** `latestPrice` / `price_observation_utc` are PIT observations. The **current** 7-day momentum **percentile universe truncated at T** is not proven. Component replay is `U_UNRESOLVED` / `U_UNRESOLVED`. Raw observation capture ≠ complete current component replay.

**DECISION — factor aggregation:** Because momentum remains `U`, Social **factor** replay cannot be `A`/`A`.

- factor exact: `U_UNRESOLVED`
- factor methodology: `U_UNRESOLVED`
- Social is **NOT** `D`
- PIT source coverage: `INTERMITTENT` for the full 2025-12-11–2026-08-19 span (241/252 days). Full-span coverage is intermittent; contiguous subruns exist, but the longest qualifying replay interval has not yet been established.
- confidence: `MEDIUM` at factor level (`HIGH` that trending captures exist and that `D` is withdrawn)

---

## 15. Disabled/display-only features

Documented and **not** treated as replay blockers: onchain (`enabled: false`, weight 0), Market Regime, Cycle Timing, Gold, Sats.

---

## 16. Cross-factor lookback and earliest-date map

Feasibility-date rule (date arithmetic only; **not** a score calculation):

| Factor | Exact class | Method class | Earliest exact | Earliest method |
|---|---|---|---|---|
| trend_valuation | U | U | not established | not established |
| stablecoins | U | U | not established (raw 7-series captures from 2025-10-05) | not established |
| etf_flows | U | U | not established (raw HTML from 2025-10-07) | not established |
| net_liquidity | U | U | not established (cache from 2025-12-11 is provenance only) | not established |
| term_leverage | U | U | not established (fundingData from 2025-12-11; vol chart sparse) | not established |
| macro_overlay | U | U | not established (cache from 2025-12-11 is provenance only) | not established |
| social_interest | U | U | not established (trending PIT from 2025-12-11; momentum universe unproven) | not established |

**DECISION:** Full current-methodology candidate earliest date = max of all seven method candidate dates **only if** every factor is `A` or `B`. Any `U` factor ⇒ full validation-grade candidate date = **NONE / NOT ESTABLISHED**.

**DECISION:** Do not assume factor exclusion plus weight renormalization equals a full current-model replay.

---

## 17. Contiguous-overlap analysis

| Factor | Exact coverage | Method coverage |
|---|---|---|
| trend_valuation | INTERMITTENT unlabeled spots; snapshot semantics UNKNOWN | UNKNOWN |
| stablecoins | INTERMITTENT raw Git JSON 2025-10-05–2026-08-19; replay UNKNOWN | UNKNOWN (365d) |
| etf_flows | INTERMITTENT raw Git HTML 2025-10-07–2026-08-19 (business-day); replay UNKNOWN | UNKNOWN |
| net_liquidity | INTERMITTENT provenance cache | UNKNOWN |
| term_leverage | INTERMITTENT fundingData; sparse charts | UNKNOWN |
| macro_overlay | INTERMITTENT provenance cache | UNKNOWN |
| social_interest | INTERMITTENT social-cache 2025-12-11–2026-08-19; factor replay UNKNOWN | UNKNOWN (momentum universe) |

**FACT:** `INTERMITTENT` describes the **full stated span**. It does not mean no contiguous subruns exist. Contiguous subruns exist in the dense cache families; the longest qualifying **seven-factor replay** interval has not been established.

**DECISION:** There is **no currently proven** overlapping contiguous interval on which all seven enabled factors are `A` or `B`. Social + ETF **raw-source** windows overlap 2025-12-11–2026-08-19 but factor replay remains `U`.

---

## 18. Exact production replay conclusion

**Question:** Is exact historical production replay currently established?

**DECISION:** **NOT ESTABLISHED**

Not `NO`: Social `D` does not survive the Git inventory. ETF HTML, stablecoin dated JSON, and Social trending caches remain strong PIT **source** evidence. Not `YES`: all seven enabled factors are `U` at **factor replay** level, so all-seven-`A` is not shown for any date T.

---

## 19. Validation-grade methodology replay conclusion

**Question:** Is validation-grade current-methodology replay currently established?

**DECISION:** **NOT ESTABLISHED**

No enabled factor is validation-grade `A` or `B` at **factor** level after restoring aggregation rules. Trending **component** `A` does not lift Social factor `A` while momentum is `U`. Full seven-factor `A`/`B` is not shown.

Earliest defensible contiguous full-model date: **NONE / NOT ESTABLISHED**.

---

## 20. Exploratory reconstruction conclusion

**Question:** Could an exploratory reconstruction be built?

**DECISION:** **YES**, explicitly non-validation, using Git captures plus later-revised APIs. It was **not** built here. No scores were calculated.

It would be hypothesis generation only.

---

## 21. Blocking unknowns

Full-composite blockers (any one `U`/`C`/`D` is sufficient):

1. **Trend — `utc_intraday_snapshot` identity** of unlabeled `latest.json` spots (`U`)
2. **Trend / Mayer — SMA200 CSV** not daily-versioned (`U`)
3. **Stablecoins — 365-day PIT universe** and positional constituent identity (`U` replay; raw captures retained)
4. **Term — sparse `market_chart_30_daily.json`** for scored vol/stress (`C` component ⇒ factor not A/B)
5. **Term — explicit `funding_provider` only 3 days** (`U` for fallback identity)
6. **Macro / NL — no raw FRED in Git cache; ALFRED unproven** (`U`)
7. **Social momentum — T-truncated percentile universe** (`U`; trending `D` withdrawn)
8. **ETF — 21-business-day / as-of / HHI structural sufficiency** not proven from HTML (`U` replay; PIT HTML retained)
9. **Percentile lookahead** if today’s complete files are used as rank universes

Social trending is **not** a demonstrated `D` blocker on the Git-captured interval.

---

## 22. Recommended proof-of-retrieval follow-ups

These are **proofs**, not scoring jobs.

1. Social: prove current 70/30 momentum percentile universe truncated at T without using historical aggregate scores; document the 8 gap days; optional 11:xx vs later `trending_fetched_at`. Do not invent ranks. Do not treat 40/35/25 cache scores as current-blend proof.
2. ETF: no-score structural proof — Total + per-fund columns, ≥21 eligible business-day rows after `selectPublishedEtfFlowRows`, holiday mapping of weekday gaps.
3. Term: whether `details`/`symbol` plus `fundingData` identify venue across 241 dates; denser PIT 30d spot chart.
4. Trend: which `latest.json` spots are `utc_intraday_snapshot`.
5. Stablecoins: T-truncated 365-day universe from git blobs without today’s file; map positional series to SSOT ids.
6. Macro/NL: ALFRED vintage catalogs without computing scores.

None of these is authorization to calculate historical scores.

---

## 23. Relationship to H4/H5 evidence

**DECISION:** H6 does not reopen H3, H4/H4.1, or H5/H5.1.

**FACT:** H4/H4.1 and H5/H5.1 remain frozen, including interpretation blob `d6978aa9de6c53dd24ff9a1ca3cfd32eece2cf19`.

**DECISION:** Do not reinterpret reconstructed historical score rows as point-in-time source evidence. Do not backsolve missing raw inputs from published G-Scores or factor scores.

---

## 24. Calibration decision

**DECISION:** Calibration gate remains **CLOSED**.

H6 cannot authorize weights, subweights, formula changes, band changes, source substitutions, threshold changes, or recommendation changes.

Any future replay protocol must be separately frozen before scores are calculated.

---

## 25. Final feasibility verdict

| Question | Verdict |
|---|---|
| Exact historical production replay established? | **NOT ESTABLISHED** |
| Validation-grade current-methodology replay established? | **NOT ESTABLISHED** |
| Earliest defensible contiguous full-model date? | **NONE / NOT ESTABLISHED** |
| Social `D_NOT_REPLAYABLE`? | **Removed** for the Git-captured social-cache interval |
| Primary remaining full-model blockers? | All seven factors `U` at replay level; Social `D` withdrawn |
| Contiguous overlapping seven-factor interval? | **NOT ESTABLISHED / NONE currently proven** |
| Exploratory reconstruction conceivable? | **YES**, not built |
| Recommended next step? | **H6.1 TARGETED SOURCE PROOF AUDIT** |

**DECISION:** `NO HISTORICAL REPLAY` is withdrawn. Critical **replay** classes remain genuinely `U_UNRESOLVED`. Social is no longer a demonstrated `D` on the captured interval. Provenance (trending caches, ETF HTML, stablecoin JSON, fundingData, FRED dates, latest.json spots) is retained and does not by itself promote replay class.

**SAFETY:** No historical G-Scores were calculated. No historical factor scores were calculated. No replay built. No H4/H5 regeneration. No model changes. No ETL. No source-data backfill. Calibration remains CLOSED.

STOP FOR FINAL INDEPENDENT H6 REVIEW.

Do not merge. Do not begin H6.1. Do not calculate historical scores.
