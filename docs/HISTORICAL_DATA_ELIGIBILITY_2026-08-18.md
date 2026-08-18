# GhostGauge Historical Data Eligibility

**Date:** 2026-08-18  
**Phase:** H1 — forensics only  
**Audited `origin/main`:** `695044d1ad7ad3e399a952d82979eab0c1d1586d`  
**Companion:** [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)

This matrix states what each dataset/date range may be used for. It is **not** a backtest and **not** permission to retune weights.

Legend: **YES** / **LIMITED** / **NO** / **UNKNOWN**  
Every **YES** has a reason.

Frozen boundary (unchanged): last verified v1.1 print **2026-08-16**; first verified v1.1.1 print **2026-08-17**. v1.1 start remains unverified.

---

## Eligibility matrix

| Dataset / date range | Grade | Observed vs reconstructed | Model lineage | Headline analysis | Factor analysis | Replay | Calibration | Outcome measurement | Primary limitation |
|---|---|---|---|---|---|---|---|---|---|
| `history.csv` 2023-09-25 … 2025-09-04 | C | Reconstructed 2025-09-26 (`68462f34`) | Then-current enhanced mixer + live factors (**INFERENCE** live APIs; **FACT** no as-of args in backfill script) | **NO** | **NO** | **NO** | **NO** | **LIMITED** — price column can be used as a historical BTC close *if* independently checked against a market series; the **score** cannot | Look-ahead / time-travel G-Scores; 22 later overlapping published rows were also overwritten |
| `history.csv` 2025-09-05 … 2025-09-26 **in the current file** | C | Rewritten over earlier publications | Same reconstruction | **NO** | **NO** | **NO** | **NO** | **LIMITED** — prices mostly preserved vs pre-rewrite file | Published 47s became 50–85s; 2025-09-26 47→85 |
| Git pre-rewrite `history.csv` / `latest.json` **2025-09-15 … 2025-09-26** | B | Observed snapshots; 2025-09-05..14 in the 22-row file were **seeded** in `3d11cce2`, not daily pubs | v3.x, 8 factors, pre-30/30 | **LIMITED** — only contemporaneous Git snapshots, **n small**; exclude seeded 2025-09-05..14 | **LIMITED** from `latest.json` factors when present | **NO** | **NO** | **YES** using that commit’s `latest.json` price, not later Coinbase rebuild | Tiny window; schema incomplete early |
| `history.csv` / Git `latest.json` **2025-09-27 … 2025-10-28** | B | Daily production appends; last row matched `latest.json` | Enhanced mixer; onchain still on | **LIMITED** — genuine prints of **then-current** model, not current v1.1.1 | **LIMITED** from `latest.json` / post-sample `factor_history` | **NO** | **NO** | **YES** vs a market price series or contemporaneous snapshot price | Not current-model history; no frozen inputs |
| Same sources **2025-10-29 … 2025-12-10** | B | Observed | 30/30, onchain off; artifact still `v3.1.0` | **LIMITED** | **LIMITED** | **NO** | **NO** | **YES** (same caveats) | Label ≠ v1.1; implementation still moving |
| Same sources **2025-12-11 … 2026-08-16** | B | Observed | **Labeled** `v1.1`; start of v1.1 **unverified** as methodology identity | **LIMITED** — descriptive headline path for **labeled** v1.1 prints only if segmented from v1.1.1 | **LIMITED** | **NO** | **NO** | **YES** | Do not call this “the v1.1 era” start; integrity semantics later changed |
| Git `latest.json` + `history.csv` tail **2026-08-17 … 2026-08-18** | B (publication evidence strong) | Observed v1.1.1 / `integrity-2026-08` | Frozen active era | **LIMITED** — official prints, **n=2**; do not infer edge | **LIMITED** — 7 factors + v2 metrics | **NO** | **NO** | **NO** for 30d+ forward until those horizons elapse | Sample far too small to tune |
| `factor_history.csv` 2025-08-28 … 2025-09-25 | D | Sample (`d0abe770` / `Math.random`) | Fake | **NO** | **NO** | **NO** | **NO** | **NO** | Still in the current file |
| `factor_history.csv` 2025-09-26 | U/C | Sample row overwritten once by ETL | Mixed | **NO** | **NO** | **NO** | **NO** | **NO** | Single contaminated date |
| `factor_history.csv` 2025-09-27 … | B/U | ETL diagnostic writes | Follows then-current architecture (onchain numeric → `null,unknown` from 2025-10-29) | **NO** as headline (use `latest.json`) | **LIMITED** descriptive attribution | **NO** | **NO** | **NO** | Not frozen-input replay; gaps exist |
| `btc_price_history.csv` 2024-08-17 … 2026-08-17 | B as **market** series | Canonical Coinbase completed UTC dailies, bulk-ingested 2026-08-17 | N/A | N/A | N/A | N/A | N/A | **YES** as future-return **market** denominator/numerator for dates inside this window (**reason:** completed Coinbase daily closes, contiguous 731 rows). **NO** as proof of publication-time price before ingest | Re-ingest time ≠ historical knowledge |
| Legacy `public/signals/*` (non-v2) | D | Synthetic, placeholder zeros, and/or label-scrape | N/A | **NO** | **NO** | **NO** | **NO** | **NO** | README + Git: `Math.random` and all-zero metric columns |
| `public/signals/etf_by_fund.csv` all dates | D | Entire file = `e3c8306f` `Math.random` | N/A | **NO** | **NO** | **NO** | **NO** | **NO** | Never replaced by Farside |
| `public/signals/v2/*` 2026-08-17 … 2026-08-18 | B | Genuine ETL metrics extract | v1.1.1 | **NO** (not the official score) | **LIMITED** — two days, incomplete raw fields (`net_liquidity` empty) | **NO** | **NO** | **NO** | Not a raw-input archive |
| `backtesting_report.json` / `_fixed.json` | C/D | Built 2025-09-26 on 731 reconstructed days | Enhanced/reconstructed | **NO** | **NO** | **NO** | **NO** | **NO** | Do not quote performance |
| `dca_vs_risk_comparison.json` / `weekly_backtesting_report.json` | C | `"dataSource": history.csv` including reconstructed prefix | Mixed, last generated 2026-08-16 | **NO** as validated strategy proof | **NO** | **NO** | **NO** | **NO** | Same contaminated headline series |
| Display / UI chart of current `history.csv` | — | Mixed file | Mixed | **YES** as **honestly labeled mixed** chart only if the reconstructed prefix is marked; otherwise **NO** | **NO** | **NO** | **NO** | **NO** | Default UI today does not mark the 2025-09-26 join |

Columns A–G from the H1 brief map as: Headline = B; Factor = C; Replay = E; Calibration = F; Outcome = G. Display/descriptive history (A) is **YES** only for Git snapshots and for post-2025-09-26 `history.csv` tails, and **LIMITED** for the current unsegmented CSV.

---

## Calibration gate

Do **not** change GhostGauge official weights, subweights, bands, or scoring transforms based on historical performance until **all** of the following are true:

1. **Target series is observational, not reconstructed.** Rows created or rewritten by `68462f34` (2023-09-25 … 2025-09-26 in current `history.csv`) are ineligible as G-Score observations.
2. **Sample / synthetic / placeholder series are excluded.** This includes `factor_history` 2025-08-28 … 2025-09-25, `etf_by_fund.csv`, legacy signal zeros, and `Math.random` rebuild CSVs.
3. **The v1.1 → v1.1.1 boundary is segmented.** Aug 16 G54 and Aug 17 G47 must not enter the same performance bucket as a seven-point market move.
4. **v1.1 start remains unverified.** Do not pool “all pre-v1.1.1 labeled rows” as one model without a separately proven start and stable implementation.
5. **n is large enough that two v1.1.1 days cannot dominate the fit.** The 2026-08-17 forward era is the corrected implementation era and is **not** yet a calibration sample.
6. **Replay, if any, uses frozen point-in-time inputs with defensible vintages** — not live APIs looped over past dates, not current `factor_history.csv`, not signal v2 alone.
7. **Existing backtest JSON is treated as contaminated working product**, never as a baseline to beat.
8. **Any YES for outcome measurement uses a market price series (or contemporaneous `latest.json` price),** not the reconstructed G-Score, as the return driver.

Until that gate is met, historical work may **inventory, describe, and recover Git snapshots**. It may not retune the official model.

---

## Grades at a glance

| Grade | Datasets |
|---|---|
| **A** | Individual v1.1.1 `latest.json` publication artifacts (`db789cd9`, `3e0c07ff`) as evidence of **what was published** — not as a tuning sample |
| **B** | Post-2025-09-27 Daily ETL `latest.json` / `history.csv` tail; labeled-v1.1 prints 2025-12-11 … 2026-08-16; canonical Coinbase price history as a **market** series; signal v2 (2 days); genuine `factor_history` tail |
| **C** | Reconstructed `history.csv` prefix; backtests/DCA reports that consumed it |
| **D** | Sample `factor_history` prefix; `etf_by_fund.csv`; legacy zeroed/synthetic signals; onchain backfill CSV |
| **U** | v1.1 methodology start; frozen vendor payloads; mixed 2025-09-26 factor_history row; Farside-vs-cache status of early `etf_flows_21d.csv` history |
