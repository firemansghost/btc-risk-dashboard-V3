# R07 Stablecoin successor-semantics adjudication — 2026-09-30

Documentation / governance only.

This record freezes the R07 evidence findings and the successor-semantics
adjudication for a future Stablecoin elapsed-time / dated-calibration
implementation.

It does **not** activate production repair.

It does **not** change Daily ETL, the production Stablecoin scorer,
`public/data/**`, `config/dashboard-config.json`, model identity, SSOT,
weights, thresholds, source routing, H8, or any production workflow.

Status labels used below:

- **COMPLETE** — evidence lane finished.
- **PASS** — feasibility evidence supports proceeding to later design under the frozen contract.
- **APPROVED FOR FUTURE IMPLEMENTATION DESIGN** — frozen for later implementation PRs. Not active in production.
- **REJECTED AS SUCCESSOR CONTRACT** — must not be used as the future production contract.
- **REJECTED** — must not be done.
- **NOT ACTIVATED** — production change remains unauthorized.

---

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| Current positional 7d/30d semantics | REJECTED AS SUCCESSOR CONTRACT | Array-position lookback is not a true elapsed-time horizon. Do not rewrite historical production observations. |
| Elapsed-time horizon rule | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Endpoint = current-cache latest strict valid positive-cap observation; priors = greatest valid timestamp `<=` target at 7d/30d; no lookahead / interpolation / forward fill / synthetic timestamps. |
| Maximum target lag | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Selected prior must be strictly less than 24 hours behind the elapsed target. Otherwise that coin horizon is unavailable. |
| Cross-vintage rule | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | `LATEST_KNOWN_VINTAGE_AT_OR_BEFORE_T`. Later revisions may affect future runs once known; they must not rewrite earlier PIT availability. |
| Aggregation / weights / transforms | UNCHANGED | Preserve current seven-coin weights, min 3 coins, 70% coverage, renormalization, growth guard, momentum formula, concentration, subweights, and score transforms. |
| Dated successor calibration | PASS / FEASIBLE | Feasible from committed evidence. Must be a new versioned dated structure. Keep missing dates missing. |
| Legacy undated baseline reuse under corrected semantics | REJECTED | Preserve `public/data/stablecoins-historical.json` as `LEGACY_UNDATED_POSITIONAL_CALIBRATION`. Do not rewrite or silently relabel it. |
| Scientific materiality | DECIDED | R07 is scientifically material. Future production activation must create a new model/implementation era. Exact future version IDs are deferred. |
| Production activation | NOT ACTIVATED | `production_change_authorized: false` |

SSOT **2.1.1** remains unchanged in this adjudication because official factor
weights, subweights, and risk bands are not being changed.

---

## 2. Official evidence

### R07 original diagnostic

- Workflow run: `36285351085`

### R07-D dated-baseline feasibility

- Workflow run: `36659679769`
- Repository SHA: `aa3ea51ddc3e21fc96adb380c7eafdce6c1122c9`
- Artifact ID: `11073343540`
- Artifact ZIP digest: `sha256:ab2514870998add5f7b3815af50d08e590ae74831ef07d60a09050c273cb645c`
- Extracted report SHA-256: `95e0cecd462e798edf95957b4750814b403ca5f1dd5343dbd93e89ecf9e1f78b`
- Schema: `ghostgauge_r07_d_dated_baseline_feasibility_v1`

### Run integrity

- `workflow_dispatch` on `main`
- exact repository SHA above
- `origin/main` guard passed before diagnostic
- `origin/main` guard passed after diagnostic
- worktree clean
- `permissions: contents: read`
- `provider_network_performed: false`
- `repository_write_performed: false`
- `predictive_outcome_data_used: false`
- `h8_data_used_for_tuning: false`
- blockers: none
- warnings: none
- future-evidence violations: zero

---

## 3. R07-D key evidence summary

### Cache inventory

- 330 tracked Stablecoin cache files
- first filename date: `2025-10-04`
- last filename date: `2026-09-29`
- 329 date-boundary-eligible seven-slot paths
- 329 actually seven-slot eligible paths
- 1 unmapped cache: `2025-10-04`
- 31 tracked filename-date gaps
- 62 files contain at least one null response slot
- malformed JSON: 0
- non-array caches: 0
- unexpected post-boundary slot count: 0

### Reconstruction

- 329 eligible analysis events attempted
- 327 full candidate aggregates
- 99.3920972644377% coverage
- earliest valid full candidate: `2025-10-06`
- latest valid full candidate: `2026-09-29`
- maximum prior candidate baseline depth: 326
- longest contiguous valid candidate run: 98

### No-lookahead integrity

- future evidence violation count: 0
- source commits after analysis event: 0
- future-dated selected source caches: 0
- candidate percentile future-observation violations: 0

### Lag evidence

7d:

- median target lag ~0.7964h
- p95 ~14.1017h
- max ~18.5667h
- >24h: 0

30d:

- median target lag ~4.7847h
- p95 ~13.0351h
- max ~18.5611h
- >24h: 0

### Cross-vintage revisions

- 4,647 unique coin/timestamp keys
- 2,622 appear in multiple vintages
- 425 changed across vintages
- 16.209% of overlapping keys revised
- most revisions small
- rare material BUSD/FRAX cross-vintage differences exist
- maximum absolute percentage revision approximately 604.9%

Use neutral provenance terminology such as `cross_vintage_value_difference`
where live-provider identity is not independently preserved.

### Legacy baseline

- label: `LEGACY_UNDATED_POSITIONAL_CALIBRATION`
- path: `public/data/stablecoins-historical.json`
- 304 finite values
- no dated observation fields
- minimum ~-0.0508685
- maximum ~0.1969317
- must not be assigned synthetic dates
- must not be merged directly into successor calibration

### Candidate elapsed baseline

- 327 valid dated candidate aggregates
- range approximately -0.0509601 to +0.1967340
- broad distribution range remains similar to legacy calibration
- candidate is **not** an exact historical published-score replay

### Current Sep 29 descriptive example

Production positional:

- aggregate 30d growth ~0.580226%
- Stablecoin score 48
- Supply 33
- Momentum 70
- Concentration ~56.6024

R07-D elapsed candidate:

- aggregate 30d growth ~0.356895%
- Stablecoin score 47
- Supply 43
- Momentum 50
- Concentration ~56.6024
- prior candidate baseline depth 326

Do **not** interpret the one-point composite difference as immaterial:
underlying Supply and Momentum semantics differ materially and offset in this
observation.

---

## 4. Adjudicated decisions

### 4.1 Current positional semantics — REJECTED AS SUCCESSOR CONTRACT

Production currently interprets array positions as nominal 7d/30d horizons.

R07 evidence establishes that these are not true elapsed-time horizons.

Do not rewrite historical production observations.

### 4.2 Successor elapsed-time horizon rule — APPROVED FOR FUTURE IMPLEMENTATION DESIGN

For each coin:

**Endpoint**

- retain the current-cache latest strict valid positive-cap endpoint concept;
- this preserves the least-methodology-changing endpoint behavior;
- do not introduce a completed-daily endpoint methodology in R07.

**Targets**

- `target7 = endpointTimestamp - 7 * 86_400_000`
- `target30 = endpointTimestamp - 30 * 86_400_000`

**Prior selection**

- greatest strict valid observation timestamp `<= target`;
- latest vintage knowable by the applicable PIT / run boundary;
- selected source cache filename date must not be after the observation / run date;
- no future evidence;
- no interpolation;
- no forward fill;
- no synthetic timestamps.

### 4.3 Maximum target lag — STRICTLY LESS THAN 24 HOURS

Freeze the successor design guard as:

**strictly less than 24 hours**.

Reason:

- source semantics are daily cadence;
- a selected prior must lie within one daily interval behind the elapsed target;
- this is a semantic / source-cadence guard, not an outcome-tuned threshold;
- R07-D observed maxima were below 18.57 hours for both 7d and 30d;
- no historical R07-D candidate is being discarded merely to fit this rule.

If no valid prior exists within `<24h` of the target:

that coin's horizon is unavailable.

Do not silently use an older observation.

### 4.4 Cross-vintage rule — `LATEST_KNOWN_VINTAGE_AT_OR_BEFORE_T`

A later revision may affect future computations once known.

It must not retroactively rewrite what was available to an earlier PIT
observation.

Use neutral provenance terminology where the live provider identity is not
independently preserved.

### 4.5 Aggregation semantics — UNCHANGED

Preserve:

- current seven-coin configuration
- current coin weights
- minimum 3 valid coins
- minimum 70% configured-weight coverage
- renormalization of included weights
- current aggregate-growth guard
- current momentum formula
- current concentration computation
- current Stablecoin component subweights
- current score transforms / thresholds

R07 corrects the time / historical-calibration semantics.

It does not authorize unrelated Stablecoin retuning.

### 4.6 Historical calibration — dated successor FEASIBLE; legacy undated reuse REJECTED

A dated successor calibration is feasible from existing committed evidence.

Future implementation must:

- create a new explicitly versioned dated calibration structure;
- reconstruct historical candidate observations using the adjudicated
  elapsed-time semantics and PIT evidence rules;
- preserve observation date and provenance;
- include only valid reconstructed aggregates;
- keep missing dates missing;
- never invent dates;
- never interpolate missing historical observations;
- never use provider network backfill merely to manufacture continuity.

The existing `public/data/stablecoins-historical.json` must remain preserved
as:

`LEGACY_UNDATED_POSITIONAL_CALIBRATION`

Do **not** rewrite it into the new structure.

Do **not** silently relabel its numbers as elapsed-time observations.

### 4.7 Percentile / no-lookahead calibration

For live candidate observation T:

- calibration may use valid dated successor baseline observations strictly before T;
- T must not rank against itself;
- future observations are prohibited.

For reconstructed historical candidate observations:

- preserve PIT evidence availability;
- do not claim exact historical published-score replay;
- label the reconstruction as:

`CURRENT_CONFIG_RETROSPECTIVE_INPUT_RECONSTRUCTION`

### 4.8 Historical claims — what the candidate baseline is not

The R07 candidate baseline is **not**:

- an as-published historical Stablecoin score series;
- proof of historical provider identity;
- a rewrite of previous GhostGauge production observations;
- a backtest;
- predictive validation.

It is calibration reconstruction evidence.

### 4.9 Scientific materiality / model era

R07 **is** scientifically material.

Reason:

- horizon semantics change from array position to elapsed time;
- calibration structure changes from undated positional values to dated
  elapsed-time observations;
- underlying component inputs can move materially even when the headline
  Stablecoin composite happens to move little.

Therefore:

Any future production activation of this correction **must** create a new
model / implementation era.

This adjudication does **not** freeze the exact future `model_version` or
`implementation_revision`.

Exact corrected architecture / version identity remains deferred until the
project completes the remaining material semantic work and reaches the existing
corrected-architecture / version-freeze gate.

### 4.10 Production authorization — NO

`production_change_authorized: false`

This adjudication freezes the future semantics.

It does not activate them.

Do not change:

- Daily ETL
- production Stablecoin scorer
- `public/data/**`
- `config/dashboard-config.json`
- `model_version`
- `implementation_revision`
- `ssot_version`
- weights
- thresholds
- source routing
- H8
- any production workflow

---

## 5. R07 status after this adjudication

| Lane | Status |
|---|---|
| R07-A current-behavior diagnostic | COMPLETE |
| R07-B bounded comparison | COMPLETE |
| R07-D dated-baseline feasibility | COMPLETE / PASS |
| positional successor semantics | REJECTED |
| timestamp-aware elapsed successor direction | APPROVED |
| dated baseline migration feasibility | PASS |
| legacy undated baseline reuse under corrected semantics | REJECTED |
| future implementation contract | FROZEN BY R07-C |
| production repair | NOT ACTIVATED |

R07 diagnostic / adjudication lane is then **COMPLETE**.

---

## 6. Next project lane

After this documentation PR:

**R01 + R08 Net Liquidity diagnostic / design**

Do not begin R03 or R09 ahead of R01 / R08.

Do not implement R07 production activation in this PR.

---

## 7. Non-claims

This document does **not**:

- claim R07 production repair is live;
- freeze a future model version identifier;
- authorize Daily ETL or scorer changes;
- rewrite historical published Stablecoin scores;
- adjudicate historical provider identity;
- authorize predictive / H8 tuning;
- authorize Net Liquidity changes.
