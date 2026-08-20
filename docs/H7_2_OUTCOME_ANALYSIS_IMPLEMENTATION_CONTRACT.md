# H7.2 Outcome-Analysis Implementation Contract

**Date:** 2026-08-20
**Phase:** H7.2 — implementation design only
**Status:** `IMPLEMENTATION CONTRACT — NOT YET IMPLEMENTED`
**Branch:** `research/h7-2-outcome-analysis-implementation`
**Base main SHA:** `1b03ba381c1aa5e785874ede777a5df2f5f7ea01`

This document translates the **frozen** H7.2 protocol into explicit software requirements. It does **not** implement analysis. It does **not** calculate MACE, returns, correlations, or any other outcome statistic. It does **not** change methodology.

The frozen protocol remains:

```text
docs/H7_2_OUTCOME_ANALYSIS_PREREGISTRATION.md
```

**FIREWALL.** Do not modify that protocol document. Any methodological change requires a new protocol version.

---

## 0. Frozen identities

| Item | Value |
|---|---|
| `H7_2_PROTOCOL_VERSION` | `h7-2-outcome-analysis-v1` |
| `H7_2_PROTOCOL_SHA` | `1886cb2c12f292f03d5deab7ef23200f02d1694d` |
| Frozen protocol tree | `8df44666ec7bfe90f4e0c377d8562ff7feae99e2` |
| Frozen protocol document blob | `648ff72ef74041ac8e4d9d1d2dd1d7b4a972d070` |
| `H7_1_ANALYSIS_SOURCE_SHA` | `c42543ec5fd042256dd47f754c91efc658b0e49a` |
| `H7_1_OUTPUT_COMMIT_SHA` | `b596619621aa4805d337c3047d98f1686529e6e7` |
| H7.2 protocol merge | `1b03ba381c1aa5e785874ede777a5df2f5f7ea01` |
| Calibration | **CLOSED** |

Frozen XR observations:

```text
commit = b596619621aa4805d337c3047d98f1686529e6e7
path   = research/exploratory-reconstruction/xr_observations.csv
blob   = 148999d51a02b87bdb93b9d32f9978ee3bef9401
```

Frozen BTC outcome source:

```text
commit = b596619621aa4805d337c3047d98f1686529e6e7
path   = public/data/btc_price_history.csv
blob   = e93a74edba11d04969ba81c141361acbab6ec3c3
sha256 = 8c3b57f779b764def7cfdff65205238cc14f2726c86572e63c450357e0852db1
```

`H7_2_ANALYSIS_SOURCE_SHA` does **not** exist yet. Do not assign it in this pass.

---

## 1. Purpose of later implementation

Later code must compute **exactly** the frozen H7.2 result set:

| Role | Combination |
|---|---|
| PRIMARY | XR × `MACE_30` × Spearman |
| SECONDARY | XR × `MACE_90` × Spearman |
| SECONDARY | XR × `MACE_180` × Spearman |

Nothing else.

Class: **DESCRIPTIVE RISK-DISCRIMINATION / RANKING-USEFULNESS**. Not forecasting, not G-Score validation, not as-published replay, not a trading backtest, not calibration.

Expected direction, frozen before results:

```text
higher XR -> larger MACE -> rho > 0
```

---

## 2. A. Input identity

Later implementation **must** read Git object bytes at the frozen identities. Moving working-tree copies are **not** authoritative.

Conceptual reads:

```text
git show 1886cb2c12f292f03d5deab7ef23200f02d1694d:docs/H7_2_OUTCOME_ANALYSIS_PREREGISTRATION.md
git show b596619621aa4805d337c3047d98f1686529e6e7:research/exploratory-reconstruction/xr_observations.csv
git show b596619621aa4805d337c3047d98f1686529e6e7:public/data/btc_price_history.csv
```

Required match:

| Input | Required Git blob |
|---|---|
| Frozen protocol document | `648ff72ef74041ac8e4d9d1d2dd1d7b4a972d070` |
| XR observations | `148999d51a02b87bdb93b9d32f9978ee3bef9401` |
| BTC price history | `e93a74edba11d04969ba81c141361acbab6ec3c3` |

BTC blob SHA-256 of exact Git bytes must remain:

```text
8c3b57f779b764def7cfdff65205238cc14f2726c86572e63c450357e0852db1
```

**HARD STOP** on any identity mismatch. Do not repair, substitute, or continue.

Do not extend the market-data snapshot. Do not retrieve another provider. Do not use live prices.

---

## 3. B. Universe

Require exactly:

```text
252 H7.1 rows
234 XR ELIGIBLE
18 XR NOT_ELIGIBLE
```

UTC observation dates remain `2025-12-11` through `2026-08-19` inclusive, one row per date, ordered ascending, no calendar gaps.

**FIREWALL.** Do not modify `xr_status`. Do not rescore, repair, backfill, substitute, drop, or reclassify any H7.1 row.

`NOT_ELIGIBLE` rows remain in universe reporting and **must not** enter Spearman.

---

## 4. C. Price-source structure

Require the frozen BTC source to have:

```text
733 rows
733 unique dates
first date = 2024-08-17
last date  = 2026-08-19
duplicate dates = 0
calendar gaps = 0
malformed dates = 0
non-finite / non-positive closes = 0
```

Required columns, in order:

```text
date_utc, close_usd, source, ingested_at_utc
```

Exact-date rule: for observation date `D` and horizon `N`, required closes are **exactly** `D` through `D+N` inclusive, using UTC calendar-date keys. No weekend/holiday shifting, nearest-date selection, interpolation, forward fill, backward fill, or substitute provider.

A required close is valid only if present, numeric, finite, and `> 0`.

---

## 5. D. Horizons

Authorized horizons only:

```text
30
90
180
```

Primary = 30. Secondary = 90 and 180. Do not add any other horizon.

---

## 6. E. Structural coverage invariants

**Require these counts before calculating MACE.** They are pre-execution structural invariants from dates + `xr_status` + pinned series end date `2026-08-19` + contiguous price dates. They do not use price changes.

| Horizon | Latest complete `D` | `XR_ELIGIBLE` | `XR_NOT_ELIGIBLE` | `OUTCOME_COMPLETE` among `XR_ELIGIBLE` | `OUTCOME_INCOMPLETE` among `XR_ELIGIBLE` | Analysis `N` |
|---|---|---|---|---|---|---|
| 30d | `2026-07-20` | 234 | 18 | 205 | 29 | **205** |
| 90d | `2026-05-21` | 234 | 18 | 149 | 85 | **149** |
| 180d | `2026-02-20` | 234 | 18 | 68 | 166 | **68** |

Identity for each horizon:

```text
18 + OUTCOME_COMPLETE + OUTCOME_INCOMPLETE = 252
30d:  18 + 205 + 29 = 252
90d:  18 + 149 + 85 = 252
180d: 18 +  68 + 166 = 252
```

Horizon-specific analysis status:

| Condition | Status | Enters that horizon’s Spearman? |
|---|---|---|
| `xr_status = NOT_ELIGIBLE` | `XR_NOT_ELIGIBLE` | No |
| `xr_status = ELIGIBLE` and every required close `C_D` through `C_D+N` exists, is finite, and `> 0` | `OUTCOME_COMPLETE` | Yes |
| `xr_status = ELIGIBLE` and the complete required path does not exist | `OUTCOME_INCOMPLETE` | No |

If later implementation derives any different count: **STOP BEFORE OUTCOME CALCULATION.** Do not fix the sample. Do not substitute dates. Do not extend the snapshot. Do not calculate MACE to “verify” the counts.

---

## 7. F. MACE

Later implementation must use:

```text
S = C_D
path_N = C_D, C_D+1, ..., C_D+N
MACE_N = 1 - min(C_D, C_D+1, ..., C_D+N) / C_D
```

For `N = 30`: 31 close observations, 30 forward calendar-day intervals. MACE is non-negative. MACE = 0 if no later completed close through `D+N` falls below `C_D`.

No other baseline or path definition.

**FIREWALL.** Do not use:

- reconstruction-time Coinbase surrogate as `S`
- H7.1 internal price vector as `S`
- previous-day close
- current live BTC price
- intraday lows
- terminal return as MACE
- artifact-spot reconstruction

Calculate MACE **only** for `OUTCOME_COMPLETE` rows, and only after coverage invariants match.

---

## 8. G. Spearman

Later implementation must:

- independently rank XR
- independently rank MACE
- use 1-based conceptual ranks
- assign tied values the arithmetic mean of occupied ranks
- calculate Pearson correlation on the two rank vectors
- return `rho = null` / `status = UNDEFINED_ZERO_VARIANCE` if either rank vector has zero variance

Never emit `NaN`, `Infinity`, or `0` as a substitute for undefined.

**FIREWALL.** No p-values. No confidence intervals. No significance tests. No Pearson on raw XR/MACE. No regression, R-squared, AUC, group differences, or band spreads.

Spearman is computed only on that horizon’s `OUTCOME_COMPLETE` / `ELIGIBLE` analysis sample (`N` = 205 / 149 / 68).

---

## 9. H. Allowed result set

Exactly three correlations. No other outcome analysis.

Forbidden in H7.2 execution:

- terminal forward return
- MCDD
- realized / downside volatility
- tail-event rates
- AUC
- band / quintile / tertile / high-low tables
- alternative correlations
- factor-by-factor outcome correlations
- non-overlapping subsample
- additional horizons

---

## 10. `--contract-check` mode

Later analysis implementation **must** include a mode conceptually equivalent to `--contract-check`.

That mode must validate, **without** calculating MACE, price changes, returns, correlations, or XR-conditioned outcome values:

- protocol SHA / version identity (`h7-2-outcome-analysis-v1`, `1886cb2c…`)
- input Git object identities (protocol, XR, BTC blobs)
- input schemas
- 252 / 234 / 18 XR structure
- frozen BTC-series structural identity (733 / 2024-08-17 / 2026-08-19 / zeros)
- exact horizon list `{30, 90, 180}`
- 205 / 149 / 68 structural eligibility counts
- output-path safety (no overwrite of H7.1 artifacts; no write unless explicitly authorized)

Instrumentation required during contract-check:

```text
outcomeCalculations = 0
correlationCalculations = 0
```

If either counter is nonzero, **STOP**. Contract-check must not write result files containing MACE or rho.

Coverage-count validation in this mode may use date keys, `xr_status`, and presence/finite/positive close flags. It may **not** compute `min(path)/C_D`, price deltas, or rank correlations.

---

## 11. Development data firewall

When implementation code is written, unit tests for MACE, ranking, Spearman, eligibility, zero variance, missing paths, ties, and output validation **must use SYNTHETIC FIXTURES**.

**FIREWALL.**

- Do **not** use real H7.1 XR + BTC outcomes in unit tests.
- Do **not** calculate the real MACE values while debugging.
- Do **not** calculate a partial real correlation “just to make sure it works.”
- Do **not** log real XR/outcome pairs during development.

The first time the frozen real XR dataset is combined with frozen BTC price values to calculate MACE must occur only after **all** of:

1. implementation is complete
2. tests pass
3. independent implementation review passes
4. `H7_2_ANALYSIS_SOURCE_SHA` is frozen
5. a separately authorized execution begins

Until then, real XR scores and real BTC closes must not be joined for outcome arithmetic.

---

## 12. Future `H7_2_ANALYSIS_SOURCE_SHA`

`H7_2_ANALYSIS_SOURCE_SHA` will be the independently accepted Git commit containing the **completed H7.2 analysis implementation** before any real outcome calculation occurs.

It does **not** exist yet. Do not assign it in this pass.

After it is frozen:

- execution must run from **exactly** that commit
- any later implementation change invalidates analysis attribution
- a new implementation freeze is required before execution

`ANALYSIS_SOURCE_SHA.txt`, if later emitted, must contain `H7_2_ANALYSIS_SOURCE_SHA`, not the subsequent output-commit SHA.

---

## 13. Output design (contract level only)

Do **not** create these files now. Recommended future deterministic set, subject to independent implementation review:

| Future file | Role |
|---|---|
| `h7_2_horizon_rows.csv` | One row per 252-date universe × authorized horizon (252 × 3 = 756 rows), structural plus later calculated fields |
| `h7_2_summary.csv` | Exactly three rows: 30d PRIMARY, 90d SECONDARY, 180d SECONDARY |
| `PROTOCOL_SHA.txt` | Optional sidecar; `1886cb2c12f292f03d5deab7ef23200f02d1694d` |
| `ANALYSIS_SOURCE_SHA.txt` | Optional sidecar; implementation SHA only, after that SHA exists |

Suggested structural fields for horizon rows (not generated now):

- `observation_date`
- `horizon_days`
- `role` (`PRIMARY` / `SECONDARY`)
- `xr_status` (copied, never modified)
- `analysis_status` (`XR_NOT_ELIGIBLE` / `OUTCOME_COMPLETE` / `OUTCOME_INCOMPLETE`)
- `xr_score` (copied from frozen XR; empty when `NOT_ELIGIBLE`)
- later `mace` only when `OUTCOME_COMPLETE` and only after authorized execution
- protocol / analysis-source identity columns

Suggested summary fields (not generated now):

- `horizon_days`
- `role`
- coverage counts (`universe_n`, `xr_eligible_n`, `xr_not_eligible_n`, `outcome_complete_n`, `outcome_incomplete_n`, `analysis_n`)
- `spearman_rho` or empty + `UNDEFINED_ZERO_VARIANCE`
- `direction_label`

Final exact filenames and schema remain subject to later independent implementation review.

**FIREWALL.** Do not overwrite H7.1 files under `research/exploratory-reconstruction/`.

---

## 14. Result-language contract

Future output / interpretation must retain frozen directional labels:

| Observed rho | Label |
|---|---|
| `rho > 0` | `DIRECTIONALLY_ALIGNED` |
| `rho = 0` | `NO_DIRECTIONAL_ASSOCIATION` |
| `rho < 0` | `DIRECTIONALLY_OPPOSED` |
| undefined | `UNDEFINED` |

Always report exact rho, analysis `N`, horizon, and outcome definition.

**FIREWALL.** Do not create `PASS`, `FAIL`, `VALIDATED`, `INVALIDATED`, `SIGNIFICANT`, or `PREDICTIVE` as result statuses.

Do not translate `DIRECTIONALLY_ALIGNED` into validated / successful / works. Do not translate `DIRECTIONALLY_OPPOSED` into invalidated / broken / failed. No arbitrary rho cutoff.

Permitted later claim form:

> In the frozen H7.1 exploratory reconstruction sample, higher XR was directionally aligned / opposed / unassociated with greater subsequent close-based downside over the preregistered horizon.

XR remains exploratory reconstruction, not historical G-Score.

---

## 15. C_D timing limitation

**LIMITATION.** MACE begins at `C_D`. It excludes price movement from `reconstruction_as_of_utc` to `C_D`.

Later results must **not** be described as immediate downside after the exact XR observation timestamp.

Permitted description:

> subsequent close-based downside measured from the first completed UTC daily close after the XR observation.

Do not change `S` away from `C_D`. Do not introduce an intraday price.

---

## 16. Serial dependence

**LIMITATION.** Daily XR observations are serially related. Forward MACE windows overlap heavily. Consecutive 30-day observations share nearly the entire subsequent price window.

Therefore:

- results are descriptive
- rows are not independent trials
- no ordinary p-values
- no ordinary confidence intervals
- no causal claims
- `N` daily rows are not `N` independent experiments

**FIREWALL.** Do not add a non-overlapping subsample.

---

## 17. Tuning / calibration firewall

Calibration remains **CLOSED**.

No H7.2 implementation or later result may alter:

- factor weights or subweights
- production bands or thresholds
- factor definitions
- reconstruction roles
- XR values
- production methodology
- frozen protocol text
- frozen H7.1 outputs
- frozen outcome-price snapshot

---

## 18. Future implementation sequence

1. Independent review of this implementation contract
2. Write analysis code + synthetic-fixture tests on this branch
3. `--contract-check` passes with `outcomeCalculations = 0` and `correlationCalculations = 0`
4. Independent implementation review
5. Freeze `H7_2_ANALYSIS_SOURCE_SHA` (implementation-only commit)
6. Separately authorized execution from that SHA
7. Only then join real XR with real BTC closes to calculate MACE and Spearman

This pass stops after step 1’s document.

---

## 19. Explicit non-actions in this contract commit

- frozen protocol document unchanged
- no analysis code written
- no result files generated
- no MACE calculated
- no return calculated
- no correlation calculated
- no XR-conditioned outcome analysis
- no real XR/outcome pairs inspected
- no H7.1 changes
- no tuning
- no calibration
- implementation branch not merged
- `H7_2_ANALYSIS_SOURCE_SHA` not assigned

STOP FOR INDEPENDENT H7.2 IMPLEMENTATION-CONTRACT REVIEW.
