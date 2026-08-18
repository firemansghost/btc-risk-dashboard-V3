# GhostGauge Historical Evidence Inventory

**Date:** 2026-08-18  
**Phase:** H1 — forensics only  
**Repository HEAD audited:** `695044d1ad7ad3e399a952d82979eab0c1d1586d` (`origin/main`)  
**Scope:** Git history, committed artifacts, committed source/config, committed documentation. No ETL, no live APIs, no backfill, no score regeneration.

Claims are labeled **FACT**, **INFERENCE**, or **UNKNOWN**.

The frozen v1.1 → v1.1.1 boundary is **not** altered by this audit:

- last verified v1.1 observation: **2026-08-16** (`0032a72942f70cf26a5dc7ca66a8161bfc0db909`)
- first verified v1.1.1 observation: **2026-08-17** (`db789cd9c59b474044d428bfdccbe07312798236`)

---

## Executive verdict

Current `public/data/history.csv` is **not** a globally as-published G-Score series.

**FACT.** On 2025-09-26, commit `68462f345a075d56ad1f697722f16b35abc89262` replaced a 22-row series dated 2025-09-05 through 2025-09-26 with a 731-row series dated 2023-09-25 through 2025-09-26. All 22 pre-existing rows were rewritten (scores and bands changed; prices were preserved except 2025-09-26). The 709 newly inserted dates are 2023-09-25 through 2025-09-04. Those reconstructed rows are still present at HEAD; none of the 731 rewritten/inserted rows later changed.

**FACT.** The backfill *script* (`48c2c67789fbc94ba343a4fc5c05e97c2172f8fe`, 2025-09-25) did **not** modify `history.csv`. It called `computeAllFactors(price)` with only the historical daily close and left a delay “to avoid overwhelming APIs.” At that commit, `computeAllFactors` invoked live factor fetchers (stablecoins, ETF, FRED, funding, social, onchain) with no as-of-date argument.

**INFERENCE.** The 2025-09-26 rewrite used then-current factor machinery (the same commit added “enhanced G-Score” sensitivity multipliers) plus live/non-point-in-time inputs. It is look-ahead / time-travel contaminated for factor inputs other than the historical BTC close used as the price column.

Therefore:

- Do **not** use current `history.csv` rows dated **2023-09-25 through 2025-09-26** as official published G-Scores.
- Git *can* recover earlier as-published snapshots from `latest.json` / pre-rewrite `history.csv` commits.
- From **2025-09-27** onward, daily `chore(etl): update artifacts` commits append genuine production prints onto the reconstructed prefix. The **tail** of `history.csv` is observational; the **prefix** is not.
- `factor_history.csv` still begins with **sample** rows (2025-08-28 through 2025-09-25). Those rows remain Grade D.
- `public/signals/etf_by_fund.csv` is still the 2025-09-26 `Math.random` file. It was never replaced by Farside.
- Signal v2 begins **2026-08-17** (two genuine ETL rows). It is not a historical replay store.
- Existing backtests consumed the reconstructed `history.csv` (start date 2023-09-25). Their performance statistics are **not** validated results.

This inventory does **not** start calibration.

---

## 1. `history.csv` provenance timeline

**Path:** `public/data/history.csv`  
**Current schema:** `date,score,band,price_usd`  
**Current range:** 2023-09-25 → 2026-08-18  
**Current data rows:** 1024  
**First introduction:** `83fdeac248cea52ceeea9a978273abf10442d19b` (2025-09-13) — a different prototype schema (many unlabeled numeric columns, one row dated 2025-09-14).

### Lifecycle (FACT)

| When | Commit | What `history.csv` contained |
|---|---|---|
| 2025-09-13 | `83fdeac2` | Prototype 1-row file, not the current 4-column schema |
| 2025-09-15 | `3d11cce2e82bd9d9116cc187a6cf75f12a4fe3f5` | First current-schema file: **11 rows**, 2025-09-05 → 2025-09-15. Same commit seeded `latest.json` (`composite` 47, `version` v3.0.0, `updated_at` 2025-09-15). Dates 2025-09-05..14 in that file were **not** independent daily publications; they arrived in one seed commit. |
| 2025-09-16 → 2025-09-26 | successive ETL/artifact commits, ending `e9083962fcac56e305dff66810b9c5a7fceed394` | Grew one day at a time to **22 rows**, 2025-09-05 → 2025-09-26. Last row at `e9083962`: `2025-09-26,47,Hold/Neutral,108739.09`. Matching `latest.json` `composite_score` 47. |
| 2025-09-25 | `48c2c677` | Script-only. `history.csv` unchanged except the ordinary daily append already in tree (21 rows at that SHA). |
| **2025-09-26** | **`68462f34`** | **Bulk reconstruction.** 22 → **731** rows. First date jumps to **2023-09-25**. **All 22 existing rows rewritten.** Last row becomes `2025-09-26,85,High Risk,109108.44`. Same commit adds enhanced G-Score multipliers in `scripts/etl/factors.mjs` and rebuilds several legacy signal CSVs. |
| 2025-09-27 | `068b5987179e9dfca767152d1dfe43f01211ea7e` | First post-rewrite daily append: 732 rows, last `2025-09-27,75,Increase Selling,109366.69`, matching `latest.json` score 75. |
| 2025-10-29 | `54d054b1` | 742 rows; reconstructed prefix unchanged |
| 2025-12-11 | `6082a0f7` | 785 rows; prefix unchanged |
| 2026-08-16 | `0032a729` | 1022 rows; prefix unchanged |
| 2026-08-18 | `3e0c07ff` / HEAD | 1024 rows; prefix unchanged |

**FACT.** Comparing `68462f34` vs HEAD for the 731 overlapping dates: **0 later changes**. There was no second bulk rewrite of reconstructed scores. Later Daily ETL appended (and same-day upserted) the current date only.

**FACT.** Example of destruction of a published score inside the current file:

| Date | Pre-rewrite (`e9083962`) | Current `history.csv` / `68462f34` |
|---|---|---|
| 2025-09-26 | 47 Hold/Neutral, price 108739.09 | 85 High Risk, price 109108.44 |
| 2025-09-05 | 47 Hold/Neutral | 68 Reduce Risk (price unchanged) |

### Did the historical factor calls have true as-of-date inputs?

**FACT, from `scripts/etl/backfill-gscore-history.mjs` at `48c2c677`:**

```js
const factorResults = await computeAllFactors(price);
// ...
if (i < datesNeedingBackfill.length - 1) {
  await new Promise(resolve => setTimeout(resolve, 100)); // "avoid overwhelming APIs"
}
```

**FACT, `computeAllFactors` at that SHA:** `async function computeAllFactors(dailyClose = null)` then `Promise.allSettled([computeTrendValuation(dailyClose), computeOnchain(), computeStablecoins(), computeEtfFlows(), ...])`. Only trend received the historical price. Other factors had **no historical date argument**.

**INFERENCE:** `68462f34` is the commit that actually wrote the reconstructed rows. It does not invoke the backfill script by name, but it is the only commit that inserts 709 historical dates, and it simultaneously changes the mixer. The reconstructed series is not a frozen as-of replay.

**Look-ahead / time-travel:** **FACT** that the designed backfill path used live APIs. **INFERENCE** that `68462f34` used that path or an equivalent live compute. Either way, reconstructed rows are **not** point-in-time safe. Additional contamination: 203 of 709 inserted scores equal `52`; 28 equal `100` — clustering consistent with a then-current factor snapshot painted across historical prices, not independent daily regimes.

### After the backfill, when does daily production begin?

**FACT.** From 2025-09-27, artifact commits append one new calendar date at a time and the new last row matches that commit’s `latest.json` composite. That tail is observational **relative to then-current production code**, sitting on top of a reconstructed prefix.

**Mixed provenance (FACT):** one file, two origins.

- 2023-09-25 … 2025-09-26: reconstructed / rewritten (Grade C)
- 2025-09-27 … 2026-08-18: daily production appends (Grade B as published numbers; not frozen-input replay)

### Can Git recover a cleaner as-published series?

**FACT. Yes, independently of the current `history.csv` prefix.**

For each Daily ETL / seed artifact commit, `public/data/latest.json` is the snapshot that was published that day (fields grew over time). Pre-rewrite `history.csv` at `e9083962` recovers the 22-day 2025-09-05..26 **file**, but only 2025-09-15..26 have matching contemporaneous `latest.json` publications; 2025-09-05..14 were seeded in `3d11cce2`.

Do **not** call current `history.csv` “as-published” globally.

---

## 2. Factor-history provenance timeline

**Path:** `public/data/factor_history.csv`  
**Current schema:** per-factor `*_score`/`*_status` for trend, onchain, stablecoins, etf_flows, net_liquidity, term_leverage, macro_overlay, social_interest, plus `composite_score`, `composite_band`  
**Current range:** 2025-08-28 → 2026-08-18  
**Current data rows:** 323  
**First introduction:** `d0abe770b6189ee7fb3ef90ff88103e81f5f7401` (2025-09-26)  
**Commit message (FACT):** “Generated 30 days of sample factor history data.”  
**Generator (FACT):** `scripts/etl/backfill-factor-history.mjs` — header comment “creates sample historical factor data”; uses `Math.random` plus sine/cosine walks.

### Sample rows (FACT)

| | |
|---|---|
| Dates | 2025-08-28 through 2025-09-26 (30 rows) at introduction |
| Pattern | Smooth ramps, every status `fresh`, including onchain scores, bands `Hold/Neutral` → `Increase Selling` |
| Still in current file? | **Yes** for **2025-08-28 through 2025-09-25** (byte-identical sample values, e.g. `2025-08-28,45,fresh,75,fresh,...52,Hold/Neutral`) |
| Overwritten? | **2025-09-26 only.** Next ETL `163e14f186af9f3fa60965325830769335230be7` replaced that one row (stablecoins became `null,excluded`; composite 68 → 73). |

**First genuine ETL-generated row:** **2025-09-27** (`068b5987`): `2025-09-27,51,fresh,58,fresh,38,fresh,...50,...` — not the sample ramp. This is **INFERENCE** that 2025-09-27+ are production writes; **FACT** that they were added by Daily ETL artifact commits rather than the sample generator.

**Onchain architecture (FACT):** sample and early genuine rows still have numeric `onchain_score`. From **2025-10-29** the onchain cells become `null,unknown`, matching config disable in `54d054b1`. Those older onchain numbers are a **different factor architecture** and, in the sample window, are not observations at all.

**Band labels (FACT):** sample used `Hold/Neutral`, `Begin Scaling Out`, `Increase Selling`. Later rows use SSOT labels such as `Hold & Wait`, `Moderate Buying`.

**Arithmetic reconstruction:** **NO** for sample rows. **LIMITED** for genuine rows: they record output scores/statuses, not frozen raw inputs. `factor_history.csv` is diagnostic attribution, not a replay tape.

---

## 3. Synthetic ETF findings

**Commit:** `e3c8306f7301e7c2d732118f2853cd4323992b48` (2025-09-26)  
**Message (FACT):** “Generate realistic flow patterns with market share distribution.”  
**Script (FACT):** `scripts/etl/etf-simple-backfill.mjs` — assumed market shares, `Math.random()` base flows, synthetic volatility, writes `public/signals/etf_by_fund.csv`. No Farside fetch.

**FACT.** Only two commits ever touched `etf_by_fund.csv`:

1. `1dae405a4003b42b0fdf9885933861510676883c` (2025-09-17) — 15 round-number test rows
2. `e3c8306f` — 3,576 synthetic rows, 2024-01-11 → 2025-09-25, 8 symbols

**FACT.** HEAD blob hash equals `e3c8306f`. `git diff e3c8306f HEAD -- public/signals/etf_by_fund.csv` is empty. A later Farside-attempting script `etf-full-history-backfill.mjs` (`93a098ca`, 2025-09-27) **never committed a replacement CSV**.

**Trustworthy range for `etf_by_fund.csv`:** **none**. The entire file is Grade D. Official ETF scoring used other paths (Farside HTML in Daily ETL / `etf_flows` factor), not this file, after production ETL existed — **INFERENCE** from ETL code; **FACT** that this CSV was not updated after 2025-09-26.

Related **FACT:** `68462f34` also added `rebuild-stablecoins-historical.mjs` and `rebuild-net-liquidity-final.mjs`, both using `Math.random`, and wrote those outputs into legacy `public/signals/*.csv`.

---

## 4. Signal provenance

### Legacy signals (`public/signals/*.csv` except `v2/`)

`public/signals/README.md` (FACT) warns: non-v2 files are legacy/untrusted because `details[].label` scrape + label drift produced placeholder zeros. Forward series live in `v2/`. `shouldAppendLegacySignalCsv() => false` under v1.1.1 froze most legacy factor CSVs at **2026-08-16** (`0032a729`).

| File | Intro | Current dates | Classification |
|---|---|---|---|
| `etf_by_fund.csv` | `1dae405a` / rewrite `e3c8306f` | 2024-01-11 → 2025-09-25 | **D synthetic** (`Math.random`) |
| `etf_flows_21d.csv` | `6585b201` (2025-09-17) | 2024-02-08 → 2026-08-16 | **D/U mixed** — `68462f34` historical insert via HTML parser (**UNKNOWN** whether those parses are true Farside); many later rows `0,0,0` derived fields from label drift (**FACT**) |
| `stablecoins_30d.csv` | `6585b201` | 2025-08-28 → 2026-08-16 | **D** — rebuild script uses `Math.random`; 291/321 rows are `0,0,score` (**FACT**) |
| `mayer_multiple.csv` | `6585b201` | 2025-09-17 → 2026-08-16 | **D** — unique `mayer` value is `0` for all 301 rows (**FACT**) |
| `funding_7d.csv` | `6585b201` | 2025-09-16 → 2026-08-16 | **D** for the zero-metric tail (**FACT** 272/296 rows `0,0,score`) |
| `dxy_20d.csv` | `6585b201` | 2025-09-17 → 2026-08-16 | **D** — all `dxy_delta20d` = 0 (**FACT**) |
| `net_liquidity_20d.csv` | `6585b201` | 2025-07-08 → 2026-08-16 | **D** — rebuild uses `Math.random` (**FACT**) |
| `fear_greed.csv` | `6585b201` | 2025-09-17 → 2026-08-16 | **D** — 298/301 `fng_value` = 0; Social no longer uses F&G (**FACT**) |
| `onchain_activity.csv` | `bcb987b1` (2025-09-29) | 2025-08-28 → 2025-10-29 | **D/U** — `backfill-onchain.mjs` estimates with `Math.random` from scores |
| `btc_xau.csv` | `4d2b6e01` | 7 sparse dates, last 2025-10-29 | Display-only; **not** official G-Score input. Stale. Grade **U/B** as a thin XAU series, **NO** for calibration |
| `sats_per_usd.csv` | `123fab03` | 2025-09-17 → 2026-08-18 | Derived from BTC; display-only. **NO** for scoring calibration |

### Signal v2 (`public/signals/v2/`)

**FACT.** Writer code: `7389da6322b4c3791d2037f922a8548ee9565c81` (2026-08-16).  
**FACT.** First committed observations: `db789cd9` (2026-08-17) — header + one row each.  
**FACT.** Second observations: `3e0c07ff` (2026-08-18).  
**First trustworthy signal-v2 date:** **2026-08-17**.

Seven files, two rows each: `dxy_20d`, `etf_flows_21d`, `funding`, `mayer_multiple`, `net_liquidity_20d`, `social_interest`, `stablecoins_30d`. Missing metrics are empty cells, not `0` (**FACT**, matches writer). `net_liquidity` metric cells empty both days.

**FACT.** v2 is derived from then-current factor `metrics`, not a raw-input archive. It is **not** sufficient for current-model historical replay. It **is** usable for descriptive factor-output analysis on 2026-08-17 and 2026-08-18 only. Do not treat two days as a calibration sample.

---

## 5. BTC price-history provenance

**Path:** `public/data/btc_price_history.csv`  
**Current schema:** `date_utc,close_usd,source,ingested_at_utc`  
**Current range:** 2024-08-17 → 2026-08-17  
**Current data rows:** 731  
**Sources at HEAD (FACT):** `coinbase_historical` 716, `coinbase` 15, Alpha Vantage **0**.

| Commit | Role |
|---|---|
| `e33a13f9` (2025-09-24) | File created: 14 Coinbase days. Message mentions Alpha Vantage; **FACT** the CSV `source` column is only `coinbase`. |
| `d2ec290c` (2025-09-24) | Code: Coinbase-only system |
| `9ea3ddb5` (2025-09-28) | Major backfill to 729 rows, 2023-09-29 → 2025-09-28 |
| `5ce98324` / `e238a642` (2026-08-16) | v1.1.1 **code** for completed UTC daily candles (did not rewrite CSV) |
| `db789cd9` (2026-08-17) | First published repaired CSV: window 2024-08-17 → 2026-08-16, almost all `ingested_at_utc=2026-08-17T15:43:11.045Z` |
| `3e0c07ff` (2026-08-18) | Append completed 2026-08-17 |

**Two different uses (must not be conflated):**

| Use | Eligibility of current file |
|---|---|
| A. Historical **market price / outcome** series (completed UTC Coinbase daily closes, 2024-08-17 → 2026-08-17) | **LIMITED / YES** as a market series after v1.1.1 canonical repair. Re-ingested as a block on 2026-08-17, so it is not a growing as-of archive of what the repo knew on each past day. |
| B. Proof of the **price known at a historical G-Score publication** | **NO** for dates before the v1.1.1 ingest. Use that day’s `latest.json` price fields instead. |

Forward-horizon **availability** on this series as of 2026-08-17 (do **not** compute returns here): last start date with a complete 30/90/180/365 calendar-day window inside the file is approximately 2026-07-18 / 2026-05-19 / 2026-02-18 / 2025-08-17. That is coverage, not a performance result.

---

## 6. Model / config lineage evidence

Do **not** treat a config merge date as an observation date.

| Change | Code merge | First successful `latest.json` observation |
|---|---|---|
| SSOT file created (`6df687a3`, 2025-09-22) | 2025-09-22 | **UNKNOWN** for exact intro weights (replaced same day). Next print `171c9dfb` 2025-09-23 sees post-split weights. |
| Onchain disabled + 30/30 weights | `54d054b1` 2025-10-29 | **Same commit**, `as_of` 2025-10-29T15:42:29.269Z. Artifact `model_version` still `v3.1.0`. |
| Config field `model_version: v1.1` | `5b3036f3` 2025-12-10 | `6082a0f7` **2025-12-11**. Same-day earlier print `ec1b931b` still `v3.1.0`. |
| Cycle/spike disabled | `457d7e65` 2026-08-16 | `db789cd9` **2026-08-17** (`source: "ETL disabled"`). Aug 16 print is **before** this merge and is **not** a disabled observation. |
| Config `v1.1.1` | `daae316b` 2026-08-16 | `db789cd9` **2026-08-17** |

`latest.json` `model_version` line changed in **exactly three** commits (**FACT** `git log -G model_version -- public/data/latest.json`): `aecc6698` (adds `v3.1.0`), `6082a0f7` (`v1.1`), `db789cd9` (`v1.1.1`).

**The original start of v1.1 remains unverified as a methodology era.** First **label** in an artifact is 2025-12-11. That is **not** frozen here. Implementation continued to change after the label (e.g. Term TTL `fe24dc3c`, ETF `market_dependent` `2c151718`, Aug 16 integrity work). Oct 29 “SSOT v1.1” commit message (`983e04df`) is **not** an artifact `model_version`.

---

## 7. What Git artifact commits can reconstruct

For a typical `chore(etl): update artifacts [skip ci]` commit after fields existed:

| Field | Reconstructable? |
|---|---|
| Official score | **YES** from `latest.json` `composite` / `composite_score` |
| Band | **YES** when present |
| BTC price in the snapshot | **YES** from `latest.json` (not from later `btc_price_history.csv`) |
| `as_of_utc` / `updated_at` | **YES** once the field exists (seed used `updated_at`; scheduled ETL later uses `as_of_utc`) |
| Factor scores/statuses | **YES** from `latest.json` `factors[]` (schema evolved) |
| `model_version` | **YES** from 2025-09-18 (`aecc6698`) onward; **NO** on 2025-09-15 seed |
| `implementation_revision` | **YES** only from 2026-08-17 |
| `ssot_version` | **NO** — not stored on `latest.json` |
| Producing **artifact** SHA | **YES** (the commit) |
| Producing **code** SHA | **LIMITED** — parent of the bot commit, unless ETL was bundled into a feature commit (`54d054b1`, `3d11cce2`) |
| Frozen raw vendor payloads for that minute | **NO** / **UNKNOWN** — not retained as a complete point-in-time input archive |
| Pre-2025-09-27 scores from current `history.csv` | **NO** — those rows are reconstructed. Use pre-rewrite Git instead. |

Not every artifact commit has every field. Early snapshots lack `ok`, `health`, `model_version`, `snapshot_date`, `price_kind`.

---

## 8. Existing backtest provenance

| Artifact | First intro | What it consumed | Verdict |
|---|---|---|---|
| `public/data/backtesting_report.json` | `d96f89ea` 2025-09-26 | `dataRange` 2023-09-25 → 2025-09-26, 731 days — **the reconstructed `history.csv`** (**FACT**, timestamps 2025-09-26T17:08Z, first signal date 2023-09-25 G47 / 26296.08) | **Ineligible** as validated performance. Grade **C/D**. Do not quote statistics. |
| `public/data/backtesting_report_fixed.json` | same era (2025-09-26) | Same 731-day reconstructed window | Same |
| `public/data/dca_vs_risk_comparison.json` | weekly SSOT comparison commits (e.g. `206b2259` and predecessors) | `"dataSource": "public/data/history.csv"` (**FACT**), trades from 2023-09-25, `generatedAt` 2026-08-16 | Uses mixed-provenance history including reconstructed prefix. **Not** a validated calibration result. |
| `public/data/weekly_backtesting_report.json` | weekly-backtesting script | `"dataSource": "history.csv"`, range 2023-09-25 → 2026-08-16, 1022 days | Same limitation. Do not quote `avgReturn*` as validated. |

These files are retained as historical artifacts. They were **not** deleted or rerun.

---

## 9. Other synthetic / sample / backfill matches

Evidence discovery, not automatic condemnation of every hit.

| Item | Affected current artifact? |
|---|---|
| `backfill-gscore-history.mjs` | Designed the G-Score reconstruct; rows landed in `history.csv` via `68462f34` |
| `backfill-factor-history.mjs` | **Yes** — sample prefix of `factor_history.csv` |
| `etf-simple-backfill.mjs` | **Yes** — entire `etf_by_fund.csv` |
| `rebuild-stablecoins-historical.mjs` / `rebuild-net-liquidity-final.mjs` / `rebuild-funding-rates-simple.mjs` / `rebuild-etf-flows-historical.mjs` | **Yes** — legacy signal CSVs from `68462f34` |
| `backfill-onchain.mjs` | **Yes** — `onchain_activity.csv` |
| `etf-full-history-backfill.mjs` | Script exists; **no** committed replacement of `etf_by_fund.csv` |
| `fetch-helper.mjs` `Math.random` | Retry jitter only — **not** historical scores |
| `83fdeac2` prototype history | Superseded schema; not current 4-column series |

---

## 10. Dataset inventory (minimum set)

| Path | Purpose | Grade | Replay? | Look-ahead risk if used as then-known state |
|---|---|---|---|---|
| `history.csv` 2023-09-25..2025-09-26 | Chart headline series (reconstructed) | **C** | NO | YES |
| `history.csv` 2025-09-27..2026-08-16 | Chart headline (daily append of then-current prints) | **B** | NO | LOW for the printed number; HIGH if treated as current-model history |
| `history.csv` 2026-08-17..2026-08-18 | v1.1.1 prints | **B** (publication **A**-like) | NO | LOW for the printed number |
| Git `latest.json` per artifact commit | True publication snapshot | **B**, **A** for v1.1.1 fields | NO | LOW for published number |
| `factor_history.csv` 2025-08-28..2025-09-25 | Sample | **D** | NO | YES (fake) |
| `factor_history.csv` 2025-09-27.. | Diagnostic ETL write | **B/U** | NO | MEDIUM — outputs only |
| `btc_price_history.csv` | Canonical completed UTC daily closes | **B** as market series | N/A | N/A for outcomes; **NO** as publication-time price before ingest |
| `latest.json` / `status.json` HEAD | Current snapshot | **A/B** | N/A | N/A |
| `backtesting_report*.json` | Legacy reports | **C/D** | — | Built on reconstructed history |
| `dca_vs_risk_comparison.json` / `weekly_backtesting_report.json` | Strategy comparison | **C** | — | `history.csv` mixed provenance |
| Legacy `public/signals/*` | Frozen label-scrape / synthetic | **D** | NO | YES |
| `public/signals/v2/*` | Forward metrics extract | **B** (2 days) | NO | LOW for those two prints |
| `etf_by_fund.csv` | Synthetic by-fund history | **D** | NO | YES |

---

## 11. Candidate clean observational windows

No performance statistics. Windows reported only where Git supports them. **Do not tune on the tiny v1.1.1 sample.**

| Window | Evidence | Grade | Model lineage | Factor history | Price outcomes | Max forward horizon now |
|---|---|---|---|---|---|---|
| Git-recovered snapshots **2025-09-17 → 2025-09-26** (pre-rewrite `latest.json` / `history.csv`) | Scheduled-style ETL artifacts; 2025-09-15 seed is one day earlier but includes seeded prior dates | **B** | Pre-SSOT / v3.x, 8 factors, pre-enhanced mixer until `68462f34` **same day as rewrite** | Sample-contaminated `factor_history` | Use contemporaneous `latest.json` price, not current CSV | Long in calendar time, but **n ≈ 10** prints |
| Daily production **2025-09-27 → 2025-10-28** | Artifact commits; last `history.csv` row matches `latest.json` | **B** | Enhanced mixer, onchain still enabled, weights not yet 30/30 | Genuine rows exist | `latest.json` price | Outcome series exists later; publication-time price ≠ current Coinbase rebuild |
| **2025-10-29 → 2025-12-10** | `54d054b1` onward | **B** | 30/30, onchain off, artifact still `v3.1.0` | Onchain `null,unknown` | same | same |
| **2025-12-11 → 2026-08-16** | `6082a0f7` … `0032a729` | **B** | **Labeled** `v1.1`; **not** a proven methodology-era start | Yes | same | 30d–365d possible vs Coinbase market series for older dates in this window |
| **2026-08-17 → current** | `db789cd9`, `3e0c07ff` | **B** headline / strong publication evidence | Frozen **v1.1.1 / integrity-2026-08** | Yes, 7 factors | Canonical Coinbase history | Too few prints for calibration; 30d forward **not yet observable** for 2026-08-17 |

**Not a candidate:** 2023-09-25 → 2025-09-04 in current `history.csv` (reconstructed only).

---

## 12. Unresolved provenance questions

1. **UNKNOWN:** whether `68462f34` invoked `backfill-gscore-history.mjs` literally or another one-off compute. The look-ahead design of the script is proven; the exact command line is not in Git.
2. **UNKNOWN:** whether any reconstructed G-Score used only price/trend and held other factors fixed (the 52-score pile-up is compatible with that **INFERENCE**, not proof).
3. **UNKNOWN:** complete frozen vendor payloads for any historical Daily ETL minute.
4. **UNKNOWN:** v1.1 **methodology** start date. First artifact **label** is 2025-12-11; that is not frozen as an era start.
5. **UNKNOWN:** which legacy `etf_flows_21d.csv` rows before the zero-drift era are true Farside parses vs cache artifacts.
6. **UNKNOWN:** exact set of missing `factor_history.csv` calendar days (323 rows vs span 2025-08-28 → 2026-08-18).
7. **UNKNOWN:** whether weekly-backtest / DCA comparison code applied then-current band maps onto reconstructed historical scores (band-label drift). Even if mapped correctly, inputs remain contaminated.

---

## 13. Recommended documentation corrections — NOT APPLIED

These are recommendations for independent review. **This audit did not edit** `docs/MODEL_ERAS.md`, `docs/DECISIONS.md`, or `REPO_REONBOARD.md`.

1. **`docs/MODEL_ERAS.md` overstates `history.csv` as an as-published headline series.** Current file mixes (a) reconstructed 2023-09-25..2025-09-26 rows that **replaced** earlier publications and (b) later daily appends. Say “as-published” only for Git `latest.json` snapshots and for `history.csv` dates **after** 2025-09-26, or recover pre-rewrite Git copies for 2025-09-15..26.
2. **`docs/DECISIONS.md` (2026-08-18 and 2026-05-07)** and **`REPO_REONBOARD.md` (2026-08-18 checkpoint)** repeat “`history.csv` remains as-published.” That is true of **policy going forward** (no v1.1.1 rewrite of the past) but **false as a description of the 2025-09-26 reconstruction already in the file**.
3. **Do not add a v1.1 start date** of 2025-12-11. That is the first `model_version` **label**, not a completed lineage proof. Keep start **unverified**.
4. Do not treat Oct 29 2025 (`54d054b1`) as v1.1 start; artifacts that day still say `v3.1.0`.

---

## Related

- Eligibility matrix: [`docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md`](HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md)
- Frozen era registry (unchanged): [`docs/MODEL_ERAS.md`](MODEL_ERAS.md)
