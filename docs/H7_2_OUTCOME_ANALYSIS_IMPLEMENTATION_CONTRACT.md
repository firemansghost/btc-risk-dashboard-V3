# H7.2 Outcome-Analysis Implementation Contract

**Date:** 2026-08-20
**Phase:** H7.2 — implementation design only
**Status:** `HARDENED IMPLEMENTATION CONTRACT — NOT YET IMPLEMENTED`
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

No new horizon. No new outcome. No band analysis. No grouping. No p-value. No confidence interval. No calibration.

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

## 3. Numeric computation and serialization

These are **implementation rules** inherited from the H4/H5 computation convention. They are not a methodology change.

**PROTOCOL IMPLEMENTATION DECISION.** Internal arithmetic must use JavaScript `Number` values. All calculations remain **UNROUNDED** internally.

**FIREWALL.** Do **not** use `toFixed()`, `toPrecision()`, `Math.round()`, or equivalent rounding before:

- minimum-path selection
- MACE calculation
- XR ranking
- MACE ranking
- Spearman calculation
- direction classification

MACE values used for ranking must be the raw unrounded calculated `Number`. Spearman must use the raw unrounded rank values. No serialized numeric string may ever feed back into arithmetic.

Computed numeric CSV fields must use deterministic shortest round-trip decimal serialization:

```text
Number.prototype.toString()
```

or an exactly equivalent deterministic shortest-round-trip representation. Do not choose a fixed number of decimal places.

Undefined numeric result: **empty CSV field**. Do **not** serialize undefined numeric results as `null`, `undefined`, `NaN`, or `Infinity`.

CSV requirements for later generated files:

- RFC4180-compatible quoting/escaping
- LF line endings
- deterministic header order
- deterministic row order
- final newline
- no locale-dependent numeric formatting
- decimal point = `.`
- no thousands separators

---

## 4. B. Universe and strict XR parsing

Require exactly:

```text
252 H7.1 observation rows
234 XR ELIGIBLE
18 XR NOT_ELIGIBLE
```

Require exact ascending UTC calendar dates `2025-12-11` through `2026-08-19`. No duplicates. No gaps.

The frozen XR input is authoritative by Git blob identity, but the parser must still reject semantic coercion errors.

**PROTOCOL IMPLEMENTATION DECISION.** `xr_status` must be exactly one of:

```text
ELIGIBLE
NOT_ELIGIBLE
```

For every `ELIGIBLE` row, `xr_score` must be:

- present
- numeric
- finite
- integer
- `>= 0`
- `<= 100`

For every `NOT_ELIGIBLE` row, `xr_score` must be the actual empty CSV field.

**FIREWALL.** Do **not** coerce an empty field to numeric zero. Explicitly prohibit semantics such as `Number('') === 0` from being accepted as a real score. Zero is a valid **PRESENT** score only when the source field actually contains a numeric zero.

Require the frozen relationship:

```text
xr_status = ELIGIBLE
    -> eligible_full_composite = TRUE
    and xr_score present

xr_status = NOT_ELIGIBLE
    -> eligible_full_composite = FALSE
    and xr_score empty
```

Any disagreement: **HARD STOP BEFORE OUTCOME CALCULATION.** Do not repair. Do not infer. Do not clamp. Do not round. Do not substitute.

**FIREWALL.** Do not modify `xr_status`. Do not rescore, repair, backfill, substitute, drop, or reclassify any H7.1 row.

`NOT_ELIGIBLE` rows remain in universe reporting and **must not** enter Spearman.

Unit tests for these parsing rules must use synthetic fixtures only.

---

## 5. C. Price-source structure and strict BTC parsing

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

**PROTOCOL IMPLEMENTATION DECISION.** `close_usd` must be parsed strictly. An empty field is invalid. Do **not** permit `Number('') === 0` as a valid close.

Each required close field must actually contain a numeric representation that parses to a finite `Number` `> 0`. No locale parsing. No commas. No implicit fallback. No default zero.

A required close is valid only if present, numeric, finite, and `> 0`.

Synthetic tests must cover empty close, zero close, negative close, NaN-like token, Infinity-like token, nonnumeric token, duplicate date, and missing exact date. No real MACE is calculated in these tests.

---

## 6. D. Horizons

Authorized horizons only:

```text
30
90
180
```

Primary = 30. Secondary = 90 and 180. Do not add any other horizon.

---

## 7. E. Structural coverage invariants

**Require these counts before calculating MACE.** They are pre-execution structural invariants from dates + `xr_status` + pinned series end date `2026-08-19` + contiguous price dates. They do not use price changes.

| Horizon | Latest complete `D` | `XR_ELIGIBLE` | `XR_NOT_ELIGIBLE` | Expected `OUTCOME_COMPLETE` among `XR_ELIGIBLE` | Expected `OUTCOME_INCOMPLETE` among `XR_ELIGIBLE` | Expected analysis `N` |
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

## 8. F. MACE

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

Calculate MACE **only** for `OUTCOME_COMPLETE` rows, and only after coverage invariants match, and only during separately authorized real execution.

Any helper that computes minimum path price, MACE, or a price delta must increment `outcomeCalculations`.

---

## 9. G. Spearman

Later implementation must:

- independently rank XR
- independently rank MACE
- use 1-based conceptual ranks
- assign tied values the arithmetic mean of occupied ranks
- calculate Pearson correlation on the two rank vectors
- return empty CSV `spearman_rho` / `direction_label = UNDEFINED` / `UNDEFINED_ZERO_VARIANCE` if either rank vector has zero variance

Never emit `NaN`, `Infinity`, or `0` as a substitute for undefined.

**FIREWALL.** No p-values. No confidence intervals. No significance tests. No Pearson on raw XR/MACE. No regression, R-squared, AUC, group differences, or band spreads.

Spearman is computed only on that horizon’s `OUTCOME_COMPLETE` / `ELIGIBLE` analysis sample (`N` = 205 / 149 / 68).

Any helper that builds real-outcome rank vectors or computes Spearman/Pearson-on-ranks must increment `correlationCalculations`. Ranking of synthetic fixtures in unit tests is allowed; ranking of real XR joined to real MACE is not allowed until authorized execution.

---

## 10. H. Allowed result set

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

## 11. `--contract-check` mode

Later analysis implementation **must** include a mode conceptually equivalent to `--contract-check`.

The contract-check code path may read the exact frozen Git objects only for:

- Git identity verification
- schema verification
- strict field validity
- date structure
- `xr_status` counts
- price-date presence
- finite / positive close validation
- structural horizon eligibility counts
- output-path safety rules without writing

It may **NOT** calculate:

- minimum future price
- MACE
- any price delta
- any return
- any rank vector involving real outcomes
- any correlation
- any direction label

Coverage-count validation in this mode may use date keys, `xr_status`, and presence/finite/positive close flags. It may **not** compute `min(path)/C_D`, price deltas, or rank correlations.

All real outcome-arithmetic helpers must increment centrally controlled instrumentation counters when invoked:

```text
outcomeCalculations
correlationCalculations
networkRequests
filesWritten
```

For `--contract-check` require **exactly**:

```text
outcomeCalculations = 0
correlationCalculations = 0
networkRequests = 0
filesWritten = 0
```

If any differs: **CONTRACT CHECK FAILS.** Do not merely log a warning. Contract-check must not create result files.

---

## 12. Logging firewall

Before separately authorized real execution, development / tests / contract-check must **NOT** print or log row-level:

- real `xr_score` values
- real `close_usd` values
- real XR/price pairs
- real minimum path prices
- real MACE values
- real ranks
- real rho

Allowed diagnostics are structural only:

- commit / blob / SHA identities
- headers
- row counts
- date boundaries
- duplicate / gap counts
- validity counts
- eligibility counts
- error class
- offending date when needed for a structural failure

For a malformed field, report the date and field name without printing the real value unless independent review explicitly requests it.

---

## 13. Network firewall

H7.2 requires **no** external network data.

Both `--contract-check` and the eventual real analysis execution must operate entirely from frozen local Git object bytes.

**FIREWALL.** No `fetch()`, HTTP, provider API, current price lookup, GitHub API lookup during computation, data download, or external market source is permitted.

The analysis implementation must expose:

```text
networkRequests = 0
```

Any attempted network access in analysis code is a **HARD STOP**. Do not add `--allow-network`. No network permission is part of H7.2.

---

## 14. Real execution output isolation

The first real H7.2 outcome run must **NOT** write generated result files directly into the Git repository.

Real execution must require an explicit:

```text
--output-dir <path>
```

The final output directory must:

- be outside the repository
- not already exist
- not be a parent or child alias of a repository result path
- be created only during authorized execution

Require before real outcome arithmetic:

- clean worktree
- `git HEAD` exactly equal to the authorized `H7_2_ANALYSIS_SOURCE_SHA`
- supplied `--analysis-source-sha` exactly equal to `HEAD`
- frozen protocol / input identities match
- structural coverage counts match

Generation must use staging + atomic promotion. Do not expose a partially generated final output directory.

On any failure:

- stop
- remove / abandon staging
- do not promote final output
- do not alter repository files
- do not convert failure into missingness

No generated output may be copied into the repository until after independent output acceptance review.

---

## 15. Frozen future output set

Do **not** create these files now. The authorized real execution must produce **exactly four** files:

```text
h7_2_horizon_rows.csv
h7_2_summary.csv
PROTOCOL_SHA.txt
ANALYSIS_SOURCE_SHA.txt
```

No extras. No README. No JSON. No debug log in the output directory. Operational logs remain outside the accepted output set.

**FIREWALL.** Do not overwrite H7.1 files under `research/exploratory-reconstruction/`.

### 15.1 `h7_2_horizon_rows.csv`

Exactly **756** data rows because `252 observation dates × 3 horizons`.

Deterministic row order: `observation_date` ascending, and within each date `30`, then `90`, then `180`.

Exact columns, in this order:

1. `observation_date`
2. `horizon_days`
3. `role`
4. `xr_status`
5. `analysis_status`
6. `xr_score`
7. `start_close_usd`
8. `minimum_path_close_usd`
9. `mace`
10. `protocol_version`
11. `protocol_sha`
12. `analysis_source_sha`

Rules:

| Field | Rule |
|---|---|
| `horizon_days` | `30` / `90` / `180` only |
| `role` | `30` → `PRIMARY`; `90` → `SECONDARY`; `180` → `SECONDARY` |
| `xr_status` | copied exactly from frozen H7.1 input |
| `analysis_status` | `XR_NOT_ELIGIBLE` / `OUTCOME_COMPLETE` / `OUTCOME_INCOMPLETE` |
| `xr_score` | copied from frozen XR input when `ELIGIBLE`; empty when `NOT_ELIGIBLE` |
| `protocol_version` | `h7-2-outcome-analysis-v1` |
| `protocol_sha` | `1886cb2c12f292f03d5deab7ef23200f02d1694d` |
| `analysis_source_sha` | the frozen `H7_2_ANALYSIS_SOURCE_SHA` used for execution |

For `OUTCOME_COMPLETE` only:

```text
start_close_usd = C_D
minimum_path_close_usd = exact minimum close from C_D..C_D+N
mace = unrounded calculated MACE serialized using §3
```

For `XR_NOT_ELIGIBLE` or `OUTCOME_INCOMPLETE`:

```text
start_close_usd = empty
minimum_path_close_usd = empty
mace = empty
```

Do not emit partial outcome values for incomplete or noneligible rows.

### 15.2 `h7_2_summary.csv`

Exactly **3** data rows. Deterministic order: `30`, `90`, `180`.

Exact columns, in this order:

1. `horizon_days`
2. `role`
3. `universe_n`
4. `xr_eligible_n`
5. `xr_not_eligible_n`
6. `outcome_complete_n`
7. `outcome_incomplete_n`
8. `analysis_n`
9. `spearman_rho`
10. `direction_label`
11. `protocol_version`
12. `protocol_sha`
13. `analysis_source_sha`

Expected structural fields:

| `horizon_days` | `role` | `universe_n` | `xr_eligible_n` | `xr_not_eligible_n` | `outcome_complete_n` | `outcome_incomplete_n` | `analysis_n` |
|---|---|---|---|---|---|---|---|
| 30 | `PRIMARY` | 252 | 234 | 18 | 205 | 29 | 205 |
| 90 | `SECONDARY` | 252 | 234 | 18 | 149 | 85 | 149 |
| 180 | `SECONDARY` | 252 | 234 | 18 | 68 | 166 | 68 |

`spearman_rho`: unrounded calculated rho serialized using §3, or empty if zero variance.

`direction_label` exactly one of:

```text
DIRECTIONALLY_ALIGNED
NO_DIRECTIONAL_ASSOCIATION
DIRECTIONALLY_OPPOSED
UNDEFINED
```

`protocol_version` / `protocol_sha` / `analysis_source_sha`: same identity rules as horizon rows.

### 15.3 `PROTOCOL_SHA.txt`

Must contain exactly:

```text
1886cb2c12f292f03d5deab7ef23200f02d1694d
```

plus a final LF newline.

### 15.4 `ANALYSIS_SOURCE_SHA.txt`

Must contain exactly the future frozen `H7_2_ANALYSIS_SOURCE_SHA` plus a final LF newline. Do not substitute a later output-commit SHA.

---

## 16. Output cross-file validation

The future implementation must validate the complete output bundle **before promotion**.

The validator must require:

- exact four-filename set
- 756 horizon data rows
- exact 252 × `{30,90,180}` cartesian product
- exact row ordering
- exact three summary rows
- exact 205 / 149 / 68 analysis counts
- exact 18 `XR_NOT_ELIGIBLE` per horizon
- exact 29 / 85 / 166 `OUTCOME_INCOMPLETE` counts
- role matches horizon
- `xr_status` copied correctly
- `xr_score` semantics obey the strict rules
- calculated outcome fields present **only** for `OUTCOME_COMPLETE`
- calculated outcome fields absent otherwise
- MACE finite and `>= 0` when present
- start / minimum closes finite and `> 0` when present
- `minimum_path_close_usd <= start_close_usd`
- each emitted MACE equals `1 - minimum_path_close_usd / start_close_usd` using unrounded arithmetic
- summary coverage equals horizon-row coverage
- summary rho is recomputed from exactly that horizon’s `OUTCOME_COMPLETE` rows
- `direction_label` matches rho sign
- protocol identity is exact in every row
- analysis-source identity is exact in every row
- sidecars match row identities

Any mismatch: **STOP.** Do not promote output.

---

## 17. Synthetic test requirements

Before real execution is ever authorized, synthetic-fixture tests must cover at least:

**INPUT / PARSING**

- strict `ELIGIBLE` XR score
- valid numeric zero score
- blank `NOT_ELIGIBLE` score
- reject blank as numeric zero
- nonnumeric score
- nonfinite score
- fractional XR score
- score below 0
- score above 100
- duplicate date
- date gap
- wrong `xr_status` / `eligible_full_composite` relationship

**PRICE STRUCTURE**

- exact-date path
- missing path date
- duplicate price date
- empty close
- zero close
- negative close
- nonnumeric close
- nonfinite close

**MACE**

- no downside → 0
- minimum at `D`
- minimum inside window
- minimum at `D+N`
- `D+N` inclusive
- correct 30 / 90 / 180 path cardinality
- no intermediate rounding

**RANK / SPEARMAN**

- perfect positive
- perfect negative
- ties with arithmetic mean ranks
- tied XR values
- tied MACE values
- all-XR zero variance
- all-MACE zero variance
- undefined rho stays empty / `UNDEFINED`
- no intermediate rounding

**OUTPUT**

- exact 756-row cartesian structure on an appropriately sized synthetic fixture, or an equivalent generalized cardinality test
- deterministic order
- RFC4180 quoting
- LF endings
- final newline
- empty undefined fields
- no `NaN` / `Infinity` / `null` / `undefined` tokens
- cross-file tamper detection
- sidecar mismatch detection

**CONTRACT CHECK**

- `outcomeCalculations` remains 0
- `correlationCalculations` remains 0
- `networkRequests` remains 0
- `filesWritten` remains 0
- contract-check cannot accidentally call outcome helpers

All outcome-arithmetic tests use synthetic data only.

---

## 18. Future `H7_2_ANALYSIS_SOURCE_SHA`

`H7_2_ANALYSIS_SOURCE_SHA` will be the independently accepted Git commit containing the **completed H7.2 analysis implementation** before any real outcome calculation occurs.

It does **not** exist yet. Do not assign it in this pass.

After it is frozen:

- execution must run from **exactly** that commit
- any later implementation change invalidates analysis attribution
- a new implementation freeze is required before execution

`ANALYSIS_SOURCE_SHA.txt` must contain `H7_2_ANALYSIS_SOURCE_SHA`, not the subsequent output-commit SHA.

---

## 19. Result-language contract

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

## 20. C_D timing limitation

**LIMITATION.** MACE begins at `C_D`. It excludes price movement from `reconstruction_as_of_utc` to `C_D`.

Later results must **not** be described as immediate downside after the exact XR observation timestamp.

Permitted description:

> subsequent close-based downside measured from the first completed UTC daily close after the XR observation.

Do not change `S` away from `C_D`. Do not introduce an intraday price.

---

## 21. Serial dependence

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

## 22. Tuning / calibration firewall

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

## 23. Implementation-sequence firewall

1. Implementation contract accepted
2. Implementation code written using synthetic outcome fixtures
3. `--contract-check` passes with zero `outcomeCalculations`, `correlationCalculations`, `networkRequests`, and `filesWritten`
4. Full tests pass
5. Independent implementation review
6. Freeze `H7_2_ANALYSIS_SOURCE_SHA`
7. Separately authorized real execution
8. Independent output acceptance
9. Only then copy / commit accepted results if authorized

No real calculation may move earlier in that sequence.

---

## 24. Explicit non-actions in this hardening commit

- frozen protocol document unchanged
- no analysis code written
- no result files generated
- no scripts or tests added
- no MACE calculated
- no return calculated
- no correlation calculated
- no minimum real future price calculated
- no real rank vector calculated
- no XR-conditioned outcome analysis
- no network data retrieved
- no H7.1 changes
- no tuning
- no calibration
- implementation branch not merged
- `H7_2_ANALYSIS_SOURCE_SHA` not assigned

STOP FOR INDEPENDENT HARDENED IMPLEMENTATION-CONTRACT REVIEW.
