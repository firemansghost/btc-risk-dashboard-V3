# GhostGauge H6 — Point-in-Time Replay Feasibility

**H6_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`  
**H6_VERSION:** `h6-pit-feasibility-v1`  
**Date:** 2026-08-19

This directory is a **research-only feasibility map**. It is **not** a backtest, **not** a historical G-Score archive, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

## What H6 did

H6 inspected the **current** `v1.1.1` / `integrity-2026-08` production implementation at `H6_SOURCE_SHA` and asked whether that methodology can be reconstructed historically **without lookahead**.

A follow-on correction completed the **full Git-history provenance inventory** of cache and artifact paths that the first H6 pass under-counted. That correction did **not** calculate scores.

H6 did **not**:

- calculate historical G-Scores
- calculate historical factor scores
- regenerate H4 / H4.1 / H5 / H5.1
- run ETL
- fetch production APIs to compute scores
- fill missing observations
- change weights, formulas, bands, or thresholds

## Classification vocabulary

Every source/component is assigned exactly one class:

| Class | Meaning |
|---|---|
| `A_EXACT_POINT_IN_TIME` | Exact production measurement/provider/state reconstructable as known at historical T |
| `B_POINT_IN_TIME_METHOD_EQUIVALENT` | Same underlying measurement, genuine point-in-time inputs, but not exact production provider/fallback/cache identity |
| `C_EXPLORATORY_ONLY` | Historical values exist, but revision/backfill/proxy/timing prevents validation-grade use |
| `D_NOT_REPLAYABLE` | Required scored input has no defensible historical point-in-time source |
| `U_UNRESOLVED` | Evidence is insufficient to classify |

Exact production replay of the **full current composite** requires all seven enabled scored factors to be `A` on date T.

Validation-grade **current-methodology** replay requires all seven to be `A` or `B` with no `C`/`D`/`U` component.

These three concepts are never treated as equivalent:

1. exact historical production replay
2. point-in-time methodological replay
3. exploratory reconstruction

**Replay class describes whether the CURRENT scored component/factor can be reconstructed, not merely whether a historical raw source payload exists.**

**Raw PIT source evidence can be strong while factor replay remains `U_UNRESOLVED`.**

A contemporaneous Git capture is category-2 **source evidence**. It does not automatically make `exact_production_replay_class` or `methodology_replay_class` equal to `A`.

### Classification invariants

1. **Raw capture ≠ factor replay.** Use `repo_historical_evidence` (and the H6 narrative) for exact captured-source quality. Replay class `A` requires the **current** scored formula, lookbacks, rank universes, constituent identity, publication-state rules, and fallback identity to be reconstructable from PIT-safe inputs.

2. **Exact is stricter than methodology.** If `exact_production_replay_class = A_EXACT_POINT_IN_TIME`, then `methodology_replay_class` must be `A_EXACT_POINT_IN_TIME` or `B_POINT_IN_TIME_METHOD_EQUIVALENT`. Exact `A` with method `U`/`C`/`D` is forbidden. If current methodology cannot yet be reconstructed, exact replay cannot be `A`.

3. **Factor aggregation.** A factor is exact `A` only if **all** required scored components (and required lookbacks/state) are exact `A`. A factor is validation-grade methodology `A` or `B` only if **all** required scored components are `A` or `B` and required historical lookbacks/rank universes are PIT-safe. If any required component is `U`, `C`, or `D`, the factor methodology class must not be `A` or `B`.

A class of `A` or `B` may apply to a **defined captured date set** only when those invariants hold on that set.

`INTERMITTENT` means the **full stated span** contains one or more gaps. It does **not** mean no contiguous subruns exist. Longest qualifying replay interval is not established in H6 unless stated.

## Evidence hierarchy

Strongest to weakest:

1. Current pinned production code/config
2. Contemporaneous Git artifacts with source timestamps/provenance
3. Official immutable/versioned source documentation or vintage system
4. Official mutable provider documentation/pages
5. Archived historical provider pages
6. Reliable third-party archival evidence
7. Inference

Category 7 is never promoted to fact. Committed reconstructed/synthetic factor histories are **not** automatically point-in-time source evidence.

**FACT:** An overwritten working-tree cache path does not erase historical Git blobs. `git log` / `git show <commit>:<path>` recovers prior committed versions.

**FACT:** A mutable provider page fetched today is not PIT evidence. A genuinely contemporaneous Git capture of that page **is** PIT evidence for the capture date.

Absence of an official historical API does **not** by itself imply `D_NOT_REPLAYABLE` if contemporaneous Git captures exist.

## Files

| File | Role |
|---|---|
| `source_requirements.csv` | One row per distinct scored source/component requirement |
| `factor_feasibility.csv` | One row per enabled scored factor |
| `docs/H6_POINT_IN_TIME_REPLAY_FEASIBILITY_2026-08-19.md` | Narrative audit and verdicts |

Authoritative protocol/interpretation context (unchanged by H6):

- `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md`
- `docs/H5_1_RISK_OUTCOME_INTERPRETATION_2026-08-19.md`

## Calibration

H6 cannot authorize weight, subweight, formula, band, source, threshold, or recommendation changes. Any future replay that calculates scores requires a separately frozen protocol.
