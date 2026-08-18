# GhostGauge Historical Data Eligibility

**Date:** 2026-08-18
**Phase:** H1 — forensics only
**Audited `origin/main`:** `695044d1ad7ad3e399a952d82979eab0c1d1586d`
**Companion:** [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)

This matrix states what each dataset/date range may be used for. It is **not** a backtest and **not** permission to retune weights.

Legend: **YES** / **LIMITED** / **NO** / **UNKNOWN**
Every **YES** has a reason.

Frozen boundary (unchanged): last verified v1.1 print **2026-08-16**; first verified v1.1.1 print **2026-08-17**. v1.1 start remains unverified.

### POST-H1 H3 CLARIFICATION — 2026-08-18

**Not a re-run of H1.** Original H1 audited HEAD `695044d1…` is unchanged as the H1 snapshot identifier.

A later `--full-history` Git audit in **H3** ([`docs/H3_GIT_OBSERVATION_MANIFEST_REVIEW_2026-08-18.md`](H3_GIT_OBSERVATION_MANIFEST_REVIEW_2026-08-18.md)) supersedes **only** the earlier characterization of current-file gaps **2025-10-07..2025-10-28** as “no committed observation.” Those 22 dates had scheduled committed `latest.json` artifacts and contemporaneous `history.csv` rows, later dropped by merge `1e27313f`. **Current production `history.csv` is unchanged** and still lacks those rows. Live History UI therefore still shows them as visual gaps. H3 Daily Rule v1 governs future daily-primary selection; **H3.1 is not built.** Calibration remains **CLOSED**.

---

## Eligibility matrix

| Dataset / date range | Grade | Observed vs reconstructed | Model lineage | Headline analysis | Factor analysis | Replay | Calibration | Outcome measurement | Primary limitation |
|---|---|---|---|---|---|---|---|---|---|
| `history.csv` 2023-09-25 … 2025-09-04 | C | Reconstructed on `68462f34` branch; kept by merge `a02a1a56` | Then-current enhanced mixer + live factors (**INFERENCE** live APIs; **FACT** no as-of args in backfill script) | **NO** | **NO** | **NO** | **NO** | **LIMITED** — price column can be used as a historical BTC close *if* independently checked against a market series; the **score** cannot | Look-ahead / time-travel G-Scores; two calendar gaps (2024-06-21, 2025-04-17) |
| `history.csv` 2025-09-05 … 2025-09-26 **in the current file** | C | `68462f34` rewrote 21 dates 2025-09-05..25 from the 21-row `48c2c677` base and supplied reconstructed Sep 26 G85; `a02a1a56` discarded sibling `e9083962` G47 | Same reconstruction | **NO** | **NO** | **NO** | **NO** | **LIMITED** — prices mostly preserved vs `48c2c677` / `e9083962` | Not the contemporaneous series |
| Git `e9083962` **2025-09-26** | B | Contemporaneous scheduled-style committed artifact **G47 Hold/Neutral** (`latest.json` and that commit’s `history.csv` row). Reconstruction-path `latest.json` is **G67**; reconstructed `history.csv` is **G85** — neither is the contemporaneous print | v3.x, 8 factors, pre-enhanced mixer | **LIMITED** — one day | **LIMITED** from that commit’s `latest.json` | **NO** | **NO** | **YES** using `e9083962` `latest.json` price | Do **not** use merged-file G85 or reconstruction-path G67 |
| Git contemporaneous artifacts **2025-09-15 … 2025-09-25** plus `e9083962` Sep 26 | B | Observed committed artifacts; 2025-09-05..14 in the 22-row file were **seeded** in `3d11cce2` | v3.x, 8 factors, pre-30/30 | **LIMITED** — small n; exclude seeded 2025-09-05..14 | **LIMITED** from `latest.json` factors when present | **NO** | **NO** | **YES** using that commit’s `latest.json` price | Tiny set; no 365d forward; Git ≠ proven live deploy |
| `history.csv` / Git `latest.json` **2025-09-27 … 2025-10-28** | B | **Current `history.csv`:** 10 of 32 dates; Oct 7–28 **absent from the surviving file**. **Git `--full-history` (H3):** scheduled committed `latest.json` artifacts for **all 22** Oct 7–28 dates (those commits also had contemporaneous `history.csv` rows later merge-dropped). Candidate-date coverage = **32**. Production file **unchanged**. | Enhanced mixer; onchain still on | **LIMITED** — then-current model; H3 Daily Rule v1 governs future daily-primary selection; do not auto-promote human/development blobs; H3.1 has **not** built the final analytical daily view; do **not** claim final analytical n | **LIMITED** | **NO** | **NO** | **YES** vs market series or contemporaneous snapshot price, for Git-recovered scheduled artifacts and for dates present in current `history.csv` | Mixed same-day artifact history / future H3.1 selection contract — **not** “no committed observation” for Oct 7–28. Current-file gaps remain. Git ≠ Vercel proof. |
| Same sources **2025-10-29 … 2025-12-10** | B | Observed; **43/43** contiguous in `history.csv` | 30/30, onchain off; artifact still `v3.1.0` | **LIMITED** | **LIMITED** | **NO** | **NO** | **YES** (same caveats); 365d **NO** | Label ≠ v1.1 |
| Same sources **2025-12-11 … 2026-08-16** | B | Observed set in **current `history.csv`:** **238** rows, **11** dates absent from current file. H3 found **no** `latest.json` candidate for those 11; cause **UNKNOWN** (not classified as ETL failure) | **Labeled** `v1.1`; start **unverified** | **LIMITED** — segment from v1.1.1 | **LIMITED** | **NO** | **NO** | **LIMITED** — 30d only ≤2026-07-18; 90d ≤2026-05-19; 180d ≤2026-02-18; **365d none** | Not a complete panel; integrity semantics later changed |
| Git `latest.json` + `history.csv` tail **2026-08-17 … 2026-08-18** | B (strong committed-artifact evidence) | Observed v1.1.1 / `integrity-2026-08` | Frozen active era | **LIMITED** — **n=2** | **LIMITED** | **NO** | **NO** | **NO** for 30d+ until those horizons elapse | Too small to tune |
| `factor_history.csv` 2025-08-28 … 2025-09-25 | D | Sample (`d0abe770` / `Math.random`) | Fake | **NO** | **NO** | **NO** | **NO** | **NO** | Still in the current file |
| `factor_history.csv` 2025-09-26 | U/C | Sample row overwritten once by ETL | Mixed | **NO** | **NO** | **NO** | **NO** | **NO** | Single contaminated date |
| `factor_history.csv` 2025-09-27 … | B/U | ETL diagnostic writes | Follows then-current architecture (onchain numeric → `null,unknown` from 2025-10-29) | **NO** as headline (use `latest.json`) | **LIMITED** descriptive attribution | **NO** | **NO** | **NO** | Not frozen-input replay; gaps exist |
| `btc_price_history.csv` 2024-08-17 … 2026-08-17 | B as **market** series | Canonical Coinbase completed UTC dailies, bulk-ingested 2026-08-17 | N/A | N/A | N/A | N/A | N/A | **YES** as future-return **market** denominator/numerator for dates inside this window (**reason:** completed Coinbase daily closes, contiguous 731 rows). **NO** as proof of publication-time price before ingest | Re-ingest time ≠ historical knowledge |
| Legacy `public/signals/*` (non-v2) | D | Synthetic, placeholder zeros, and/or label-scrape | N/A | **NO** | **NO** | **NO** | **NO** | **NO** | README + Git: `Math.random` and all-zero metric columns |
| `public/signals/etf_by_fund.csv` all dates | D | Entire file = `e3c8306f` `Math.random` | N/A | **NO** | **NO** | **NO** | **NO** | **NO** | Never replaced by Farside |
| `public/signals/v2/*` 2026-08-17 … 2026-08-18 | B | Genuine ETL metrics extract | v1.1.1 | **NO** (not the official score) | **LIMITED** — two days, incomplete raw fields (`net_liquidity` empty) | **NO** | **NO** | **NO** | Not a raw-input archive |
| `backtesting_report.json` / `_fixed.json` | C/D | Built 2025-09-26 on 731 reconstructed days | Enhanced/reconstructed | **NO** | **NO** | **NO** | **NO** | **NO** | Do not quote performance |
| `dca_vs_risk_comparison.json` / `weekly_backtesting_report.json` | C | `"dataSource": history.csv` including reconstructed prefix | Mixed, last generated 2026-08-16 | **NO** as validated strategy proof | **NO** | **NO** | **NO** | **NO** | Same contaminated headline series |
| Display / UI chart of current `history.csv` | — | Mixed file | Mixed | **YES** as **honestly labeled mixed** chart only if the reconstructed prefix is marked; otherwise **NO** | **NO** | **NO** | **NO** | **NO** | Default UI today does not mark the 2025-09-26 join. Oct 7–28 remain **current-file visual gaps**; H3 Git recovery is for the future research manifest, not the production chart source |

Columns A–G from the H1 brief map as: Headline = B; Factor = C; Replay = E; Calibration = F; Outcome = G. Display/descriptive history (A) is **YES** only for Git committed artifacts and for post-2025-09-26 `history.csv` dates that actually exist **in the current file**. The observational tail must be analyzed as an **observation set**, not an assumed complete daily panel. H3 Git-recovered Oct 7–28 artifacts are committed evidence for a future research manifest; they are **not** in current production `history.csv` and **H3.1 has not** selected daily primaries yet.

As of 2026-08-18, the longest fully observable forward horizon for genuine GhostGauge committed production artifacts is **180 days**. No genuine committed G-Score artifact has yet aged 365 days.

---

## Calibration gate

Do **not** change GhostGauge official weights, subweights, bands, or scoring transforms based on historical performance until **all** of the following are true:

1. **Target series is observational, not reconstructed.** Current `history.csv` 2023-09-25 … 2025-09-26 is ineligible as G-Score observation: `68462f34` reconstructed that branch from a 21-row base, and `a02a1a56` kept it (including Sep 26 G85) over sibling `e9083962` G47. Recover Sep 26 from `e9083962` only.
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
| **A** | Individual v1.1.1 `latest.json` **committed production artifacts** (`db789cd9`, `3e0c07ff`) as evidence of **what Git recorded** — not as a tuning sample, and not by itself proof of live Vercel serving |
| **B** | Post-2025-09-27 successful ETL `latest.json` / `history.csv` observation set (**current `history.csv` remains gapped**; H3 `--full-history` recovers 22 scheduled October artifacts later merge-dropped from the surviving CSV). Committed-artifact evidence remains Grade **B**; this does **not** turn the set into current-model replay and does **not** authorize calibration. Also: labeled-v1.1 prints 2025-12-11 … 2026-08-16; `e9083962` Sep 26 G47; canonical Coinbase price history as a **market** series; signal v2 (2 days); genuine `factor_history` tail |
| **C** | Reconstructed `history.csv` prefix as kept by `a02a1a56`; backtests/DCA reports that consumed it |
| **D** | Sample `factor_history` prefix; `etf_by_fund.csv`; legacy zeroed/synthetic signals; onchain backfill CSV |
| **U** | v1.1 methodology start; frozen vendor payloads; mixed 2025-09-26 factor_history row; Farside-vs-cache status of early `etf_flows_21d.csv` history |

---

## Related

- Evidence inventory: [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)
- Later `--full-history` forensic audit (supersedes **only** the narrow October absence characterization): [`docs/H3_GIT_OBSERVATION_MANIFEST_REVIEW_2026-08-18.md`](H3_GIT_OBSERVATION_MANIFEST_REVIEW_2026-08-18.md)
