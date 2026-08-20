# H8 Prospective 30-Day Risk-Discrimination Preregistration

**Date:** 2026-08-20
**Phase:** H8 — prospective three-model forward holdout
**Status:** `PROTOCOL CANDIDATE — METHODOLOGY PROPOSED — NOT YET FROZEN`
**Proposed protocol version:** `h8-prospective-three-model-v1`
**Branch:** `research/h8-prospective-three-model-preregistration`
**Parent main HEAD at candidate creation:** `9478099ff775f1d6630b83bd402727870f15ca10`

This document is a **protocol candidate**. Methodology is **proposed**, not frozen. Independent review of `b0c1c2f0b42bfd08d5167814044a8e40770ecdc4` approved the core H8 design and confirmed the four prior review findings were resolved. This amendment records one final pre-freeze resolution: deterministic automatic BTC-close catch-up inside a fixed recovery window, plus separation of the scientific model-contract fingerprint from the later H8 capture-implementation identity. Changing any later **frozen** PROTOCOL DECISION will require a new protocol version. H8 capture has **not** been implemented. H8 performance has **not** been calculated. `H8_PROTOCOL_SHA` is **not** assigned. `H8_CAPTURE_SOURCE_SHA` is **not** assigned. Calibration remains **CLOSED**.

Do **not** write the eventual freeze-commit SHA into this document. The Git commit that later freezes accepted bytes becomes `H8_PROTOCOL_SHA` only after independent review and an explicit freeze.

Labels used below:

- **FACT** — inherited from closed H7.2 identities, current production config/code at the parent main SHA, or calendar arithmetic of the proposed window
- **PROPOSED PROTOCOL DECISION** — candidate methodology; not frozen until independent review accepts a freeze
- **FIREWALL** — a prohibition that is not open to casual weakening
- **LIMITATION** — a bound on what later H8 execution may claim even after results exist
- **IMPLEMENTATION DETAIL** — later code/schema design, not an open scientific choice once the protocol is frozen
- **OPEN FOR REVIEW** — an audit finding or design choice that independent review should explicitly accept or amend before freeze

---

## 0. Zero-state banner

**FACT. H8 has ZERO observations at protocol-candidate creation.**

**FACT. H8 has ZERO matured outcomes.**

**FACT. No H8 performance statistic has been calculated.**

The proposed capture dates are **future** relative to this protocol-design date (`2026-08-20`).

**FIREWALL.** Do not populate the study with:

- `2026-08-20` or earlier observations
- `2026-08-21`, `2026-08-22`, or `2026-08-23` observations
- H7 reconstructed XR rows
- reconstructed historical Official / Liq-Heavy / Mom-Tilted scores
- any backfilled or later-repaired capture

**FIREWALL.** This candidate was **not** chosen by inspecting historical Official / Liq-Heavy / Mom-Tilted performance, 30-day rho, or any grid of weights. Do not search historical data for a better weighting combination.

---

## 1. Purpose

**PROPOSED PROTOCOL DECISION.** H8 asks whether the **actual forward-captured** GhostGauge model family shows prospective 30-day risk-discrimination behavior.

Class:

```text
PROSPECTIVE DESCRIPTIVE RISK-DISCRIMINATION / RANKING-USEFULNESS HOLDOUT
```

The study captures model scores **before** their future outcomes exist.

H8 is **not**:

- a reconstruction
- a backtest
- historical optimization
- trading-strategy validation
- calibration
- model tuning
- a promotion decision for a challenger

**LIMITATION.** A later descriptive association, if it exists, does not prove that the gauge is predictive, calibrated, or suitable as a trading rule.

---

## 2. Closed predecessor identity

**FACT.** H7.2 is complete, merged, and scientifically closed.

| Item | Value |
|---|---|
| H7.2 status | `COMPLETE / MERGED / CLOSED` |
| `H7_2_PROTOCOL_VERSION` | `h7-2-outcome-analysis-v1` |
| H7.2 merge PR | `#27` |
| H7.2 merge commit / current main | `9478099ff775f1d6630b83bd402727870f15ca10` |

**FACT.** H7.2 found a modest directionally aligned association for the preregistered PRIMARY 30-day MACE analysis. That closed finding is the scientific motivation for a prospective follow-up. This candidate does **not** reprint, recompute, or reinterpret H7.2 rho.

**FIREWALL.** Do not modify H7, H7.1, or H7.2 protocol, contract, implementation, or outputs.

**FIREWALL.** Do not reuse H7 reconstructed XR rows as H8 data.

---

## 3. Exactly three frozen models

**PROPOSED PROTOCOL DECISION.** Freeze **exactly three** models for H8 v1.

| Role | Name / version | Status |
|---|---|---|
| PRIMARY / CHAMPION | Official `v1.1.1` | production |
| SECONDARY CHALLENGER | `liq-heavy-v1` | research only |
| SECONDARY CHALLENGER | `mom-tilted-v1` | research only |

**FIREWALL.** No fourth model is authorized.
**FIREWALL.** No fifth model is authorized.
**FIREWALL.** Do not create Official v2 inside H8 v1.
**FIREWALL.** Do not tune weights.
**FIREWALL.** Calibration remains **CLOSED**.

Any future new candidate must have an explicit hypothesis, frozen formula, version, prospective start date, and **separate** preregistration **before** its performance is observed.

---

## 4. Same factors — only top-level weights differ

**PROPOSED PROTOCOL DECISION.** All three H8 models use the **exact same** captured daily factor scores.

The challengers do **not** have:

- different data sources
- different factor formulas
- different subweights
- different freshness rules
- different enabled factors
- different cycle adjustment
- different spike adjustment

Only the frozen **top-level factor weights** differ.

This makes H8 a **controlled weighting comparison**.

**FIREWALL.** Do not alter factor formulas for H8.
**FIREWALL.** Do not give one challenger a different eligible-day set than another.

---

## 5. Official — PRIMARY / CHAMPION

### 5.1 Authoritative production SSOT

**FACT.** The authoritative current production SSOT at parent main `9478099ff775f1d6630b83bd402727870f15ca10` is:

```text
path                         = config/dashboard-config.json
git blob SHA                 = b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49
SHA256 of exact file bytes   = 712a6d138b7e58dee3e325ec2740044aad2a7a80fe027a8f3e3fef294ac3b57a
bytes                        = 7541
model_version                = v1.1.1
implementation_revision      = integrity-2026-08
ssot_version                 = 2.1.1
```

### 5.2 `config/weights.json` is NOT H8 Official authority

**FACT.** `config/weights.json` at the same parent main is an older `v1.1.0` configuration:

```text
path                         = config/weights.json
git blob SHA                 = 9a8b2f8fba220bc9e5bd8de7f8bc1d27c707ba9b
SHA256 of exact file bytes   = c5009cbf98c4c8ebc1c08f0c2f8a1f8ca8b545633192b1ae7045b4e0818f660f
version                      = v1.1.0
```

That file still describes a **35% liquidity / 25% momentum** pillar mix, with onchain enabled and different factor weights (including `trend_valuation = 0.25`, `onchain = 0.08`, `etf_flows = 0.10`, `net_liquidity = 0.12`).

**FIREWALL.** `config/weights.json` is **not** authoritative for H8 Official. Do not treat it as the Official v1.1.1 SSOT. Do not treat its 35/25 mix as the Official H8 formula.

### 5.3 Official factor weights

**FACT / PROPOSED PROTOCOL DECISION.** Official v1.1.1 factor weights, copied from `config/dashboard-config.json`:

| Factor | Enabled | Weight |
|---|---|---|
| `trend_valuation` | true | `0.30` |
| `onchain` | **false** | `0` |
| `stablecoins` | true | `0.18` |
| `etf_flows` | true | `0.077` |
| `net_liquidity` | true | `0.043` |
| `term_leverage` | true | `0.20` |
| `macro_overlay` | true | `0.10` |
| `social_interest` | true | `0.10` |

```text
0.30 + 0.18 + 0.077 + 0.043 + 0.20 + 0.10 + 0.10 = 1.00
```

Official liquidity-pillar total among the three liquidity factors:

```text
0.18 + 0.077 + 0.043 = 0.30
```

### 5.4 Cycle and spike

**FACT.** At Official v1.1.1:

```text
adjustments.cycle.enabled = false
adjustments.spike.enabled = false
```

**PROPOSED PROTOCOL DECISION.** H8 Official scoring uses those disabled flags. Reactivating cycle or spike is a methodology change and is not authorized under H8 v1.

---

## 6. Liq-Heavy — SECONDARY CHALLENGER

**PROPOSED PROTOCOL DECISION.**

```text
name/version = liq-heavy-v1
role         = SECONDARY CHALLENGER
```

Pillar target:

```text
Liquidity = 0.35
Momentum  = 0.25
Leverage  = 0.20
Macro     = 0.10
Social    = 0.10
```

Preserve Official **internal liquidity proportions**. Define:

```text
LIQ_HEAVY_SCALE = 0.35 / 0.30
challenger_weight(factor) = official_factor_weight * LIQ_HEAVY_SCALE
```

for `stablecoins`, `etf_flows`, and `net_liquidity`.

Exact factor-weight definition (ratio expressions are the mathematical source of truth; do not freeze rounded decimal approximations as the definition):

| Factor | Weight definition |
|---|---|
| `trend_valuation` | `0.25` |
| `onchain` | `0` (disabled; unused) |
| `stablecoins` | `0.18 * (0.35 / 0.30)` which equals `0.21` exactly |
| `etf_flows` | `0.077 * (0.35 / 0.30)` |
| `net_liquidity` | `0.043 * (0.35 / 0.30)` |
| `term_leverage` | `0.20` |
| `macro_overlay` | `0.10` |
| `social_interest` | `0.10` |

Algebraic sum:

```text
0.25
+ 0.18 * (0.35 / 0.30)
+ 0.077 * (0.35 / 0.30)
+ 0.043 * (0.35 / 0.30)
+ 0.20
+ 0.10
+ 0.10
= (0.25 + 0.20 + 0.10 + 0.10)
  + (0.18 + 0.077 + 0.043) * (0.35 / 0.30)
= 0.65 + 0.30 * (0.35 / 0.30)
= 0.65 + 0.35
= 1.00
```

**FIREWALL.** Do not replace the ratio expressions with independently rounded decimals as the scientific definition.

---

## 7. Mom-Tilted — SECONDARY CHALLENGER

**PROPOSED PROTOCOL DECISION.**

```text
name/version = mom-tilted-v1
role         = SECONDARY CHALLENGER
```

Pillar target:

```text
Liquidity = 0.25
Momentum  = 0.35
Leverage  = 0.20
Macro     = 0.10
Social    = 0.10
```

Preserve Official internal liquidity proportions. Define:

```text
MOM_TILTED_SCALE = 0.25 / 0.30
challenger_weight(factor) = official_factor_weight * MOM_TILTED_SCALE
```

for `stablecoins`, `etf_flows`, and `net_liquidity`.

Exact factor-weight definition:

| Factor | Weight definition |
|---|---|
| `trend_valuation` | `0.35` |
| `onchain` | `0` (disabled; unused) |
| `stablecoins` | `0.18 * (0.25 / 0.30)` which equals `0.15` exactly |
| `etf_flows` | `0.077 * (0.25 / 0.30)` |
| `net_liquidity` | `0.043 * (0.25 / 0.30)` |
| `term_leverage` | `0.20` |
| `macro_overlay` | `0.10` |
| `social_interest` | `0.10` |

Algebraic sum:

```text
0.35
+ 0.18 * (0.25 / 0.30)
+ 0.077 * (0.25 / 0.30)
+ 0.043 * (0.25 / 0.30)
+ 0.20
+ 0.10
+ 0.10
= (0.35 + 0.20 + 0.10 + 0.10)
  + (0.18 + 0.077 + 0.043) * (0.25 / 0.30)
= 0.75 + 0.30 * (0.25 / 0.30)
= 0.75 + 0.25
= 1.00
```

---

## 8. H8 scientific score arithmetic

**PROPOSED PROTOCOL DECISION.** For an H8-eligible observation, each model score is:

```text
weighted_sum =
  sum(factor_score * model_factor_weight)

score =
  Math.round(
    Math.max(
      0,
      Math.min(100, weighted_sum)
    )
  )
```

Use JavaScript `Number` semantics. No intermediate rounding. All three models produce integer scores in `0–100`.

**FIREWALL.** Do not use a serialized score as an arithmetic input.
**FIREWALL.** Do not use UI missing-factor omission / pillar renormalization as the H8 scientific scoring rule.
**FIREWALL.** Do not renormalize around a missing factor.
**FIREWALL.** Do not substitute a prior factor score.
**FIREWALL.** Do not backfill an observation later.

**PROPOSED PROTOCOL DECISION — production Official arithmetic on H8-eligible days.** The following production behavior is verified at parent main `9478099ff775f1d6630b83bd402727870f15ca10` and is accepted as the candidate protocol's Official-integrity basis.

`scripts/etl/factors.mjs` `calculateEnhancedGScore()` calculates:

```text
normalizedScore = weightedSum / totalWeight
composite       = Math.round(normalizedScore)
```

with `totalWeight` equal to the sum of Official weights of **fresh** factors. H8 v1 **does not adopt** missing-factor renormalization as a scientific rule. Instead it **requires common eligibility of all seven required factors**. For an H8 `ELIGIBLE` observation:

- all seven required factors are `fresh`
- all seven Official weights participate
- Official `totalWeight = 1.00`
- therefore production normalization does not change the weighted sum

`scripts/etl/compute.mjs` subsequently calculates:

```text
adjustedComposite =
  composite
  + cycle_adjustment.adj_pts
  + spike_adjustment.adj_pts

finalComposite =
  Math.max(
    0,
    Math.min(
      100,
      Math.round(adjustedComposite * 10) / 10
    )
  )
```

At frozen Official v1.1.1, cycle adjustment is disabled and spike adjustment is disabled, so `adj_pts = 0`. Therefore on an H8-eligible day:

- production composite enters `compute.mjs` as an integer
- adjustment points equal zero
- tenth-point rounding is an identity
- the Official H8 scientific formula in this section should exactly equal production `composite_score`

**PROPOSED PROTOCOL DECISION.** `official_published_score` is the `composite_score` field from `public/data/latest.json` produced by the **same** authorized first-attempt scheduled ETL run whose factor snapshot is captured.

**FIREWALL.** Do **not** use `public/data/history.csv` as `official_published_score` scientific authority. That file remains operational / display history only because it has same-date upsert behavior.

`official_formula_score` remains an independent recomputation from the captured seven factor scores using frozen Official v1.1.1 weights and the H8 scientific arithmetic above. Exact mismatch remains `INTEGRITY_MISMATCH` and is excluded permanently. Do not repair the observation after the fact.

---

## 9. Common eligibility

**PROPOSED PROTOCOL DECISION.** The three models must use the **same** eligible observation set.

Required factors:

```text
trend_valuation
stablecoins
etf_flows
net_liquidity
term_leverage
macro_overlay
social_interest
```

An observation is `H8 ELIGIBLE` only if **all seven** required captured factors:

- exist
- have a real numeric score
- are finite
- are within `0–100`
- have production status `fresh` under the production calendar-aware freshness rules

For an H8-eligible day, **all three** model scores must be present.

If the common factor snapshot is not eligible:

```text
all three models are NOT_ELIGIBLE for scientific analysis on that date
```

**FIREWALL.** Do not allow one challenger to enter the sample while another does not.

---

## 10. Official score integrity check

**PROPOSED PROTOCOL DECISION.** For each eligible observation capture both:

```text
official_published_score
official_formula_score
```

`official_published_score` is exactly:

```text
public/data/latest.json -> composite_score
```

from the **same** authorized first-attempt scheduled Daily ETL run whose factor snapshot is captured.

**FIREWALL.** Do **not** read `official_published_score` from `public/data/history.csv`.

`official_formula_score` is independently recomputed from the captured seven factor scores using the frozen Official v1.1.1 weights and the H8 scientific arithmetic in §8.

Require exact equality.

If:

```text
official_published_score != official_formula_score
```

then the observation is:

```text
INTEGRITY_MISMATCH
```

and must **not** enter H8 analysis.

**FIREWALL.** Do not silently choose one value.
**FIREWALL.** Do not repair the observation after the fact.
**FIREWALL.** The mismatch remains permanently documented.

---

## 11. Existing experimental UI is not the research record

**FACT.** `lib/experimentalModel.ts` at parent main (blob `b041a44e37c6268e1d7ab4a9f9117ab0d27e2eeb`) currently defines UI-only pillar reweighting presets:

```text
official_30_30
liq_35_25
mom_25_35
```

Those presets normalize **within pillars** and can omit non-fresh factors. The dashboard shows non-Official models as Preview.

**PROPOSED PROTOCOL DECISION.** H8 does **not** use browser `localStorage` or UI state as scientific evidence.

H8 will freeze **standalone factor-level challenger formulas** (§6–§7) and capture the three scores as immutable research observations.

The UI may continue displaying previews. **No UI redesign is required by the H8 protocol itself.**

**FIREWALL.** A later UI number is not an H8 observation.

---

## 12. Prospective capture window

**PROPOSED PROTOCOL DECISION.**

```text
START = 2026-08-24
END   = 2027-02-19
```

Inclusive scheduled observation opportunities:

```text
180 UTC calendar dates
```

**FACT.** Calendar count `2026-08-24` through `2027-02-19` inclusive is 180 UTC dates.

**FIREWALL.** Do **not** include as H8 study observations:

```text
2026-08-20
2026-08-21
2026-08-22
2026-08-23
```

This creates a clean firewall between H7.2 completion / H8 design and the prospective holdout.

The final observation date `2027-02-19` requires 30-day outcome coverage through:

```text
C_2027-03-21
```

The exact BTC close dates needed for H8 v1 `MACE_30` are:

```text
2026-08-24 through 2027-03-21 inclusive
```

No earlier close is required for H8 primary analysis. No later close enters H8 v1 MACE.

**PROPOSED PROTOCOL DECISION.** Distinguish **close completion** from **prospective tape capture**. The `2027-03-21` UTC close becomes complete at the end of that UTC day, but H8 must **not** analyze merely because the market close now exists.

H8 performance must **not** be calculated:

- during the 180-date observation window
- during ordinary 30-day maturation
- during the fixed close-capture recovery period through `2027-03-29` UTC

The first H8 performance-analysis process may begin only **after all** of the following are true:

1. the authorized H8 observation window is closed
2. `C_2027-03-21` has completed
3. all authorized first-attempt scheduled close-capture opportunities through UTC date `2027-03-29` are finished or conclusively absent/failed
4. the immutable H8 score-observation tape is frozen for analysis
5. the immutable H8 BTC-close tape is frozen for analysis
6. independent capture-integrity review accepts those frozen tapes

Any still-missing required close remains missing. Apply the already-frozen sample rule: an observation lacking any exact `C_D` … `C_D+30` close is `OUTCOME_INCOMPLETE` and is excluded from Spearman.

**FIREWALL.** Do not postpone analysis indefinitely trying to obtain missing close values.
**FIREWALL.** Do not reconstruct the entire outcome tape in March 2027 from a later moving file.
**FIREWALL.** Do not extend the 180 observation dates.
**FIREWALL.** Do not add post-`2027-03-21` closes to MACE.

The study observation window itself remains the fixed 180-date window. Do not extend observations.

**FIREWALL.** If H8 capture infrastructure is **not** fully merged and operational **before** the scheduled `2026-08-24` observation:

```text
DO NOT silently start late under this protocol.
STOP.
```

A revised preregistration / version with a new start date would be required.

---

## 13. Observation event

**FACT.** The existing production scheduled Daily ETL is `.github/workflows/daily-etl.yml` at parent main:

```text
git blob SHA = f2103048d384749310432eee610dffad2dad0f4f
cron         = 0 11 * * *
```

Triggers currently present:

- `schedule` (`0 11 * * *`)
- `workflow_dispatch`

The workflow currently:

1. checks out the repo
2. runs `npm run etl:compute`
3. commits `public/data`, `public/signals`, `public/extras`, `public/alerts` to `main`

**PROPOSED PROTOCOL DECISION.** H8 study **score observations** and H8 prospective **BTC-close artifacts** may be written **only** during a **first-attempt** scheduled Daily ETL event.

Future capture gate for both classes:

```text
github.event_name == 'schedule' && github.run_attempt == 1
```

`github.event_name == 'schedule'` alone is **insufficient**, because a GitHub Actions rerun of a scheduled workflow still has `event_name = schedule`.

This first-attempt-only rule applies to **both**:

- H8 score observation capture
- H8 prospective BTC-close capture, including automatic close catch-up

**FIREWALL.** The following must **not** create a new H8 observation or H8 close artifact:

- Refresh button
- API refresh
- local ETL
- `workflow_dispatch`
- GitHub Actions rerun (`run_attempt != 1`), even if `event_name == 'schedule'`
- any other ad-hoc execution
- any CLI / UI / workflow flag that lets an operator choose dates to fill

### 13.1 Score capture versus outcome capture

**PROPOSED PROTOCOL DECISION.** Distinguish two artifact classes:

```text
SCORE OBSERVATION
  = the prospective model signal
  = may never be backfilled

BTC CLOSE ARTIFACT
  = an outcome measurement
  = may use deterministic AUTOMATIC CATCH-UP under §15
```

This does **not** permit:

- manual outcome selection
- discretionary reconstruction
- operator-selected dates
- post-result repair
- overwriting a captured value

The catch-up rule is automatic, mechanical, and fixed **before outcomes exist**.

**FIREWALL.** H8 score observations remain:

- first-attempt scheduled-event-only
- one immutable observation per UTC observation date
- never overwritten
- never backfilled
- never reconstructed later
- never created from `workflow_dispatch`
- never created from GitHub reruns
- never created from Refresh / API / local runs

If the authorized score observation for an expected UTC date is missed, that observation remains `CAPTURE_MISSING` forever under H8 v1.

**PROPOSED PROTOCOL DECISION.** `observation_as_of_utc` is the actual production artifact as-of timestamp from the scheduled ETL snapshot being captured.

**PROPOSED PROTOCOL DECISION.** `observation_date` is the UTC calendar-date portion of `observation_as_of_utc`.

Do **not** assign `observation_date` merely from:

- nominal cron time
- local date
- `workflow_dispatch` date
- filename expectation

The scheduled observation must satisfy:

```text
2026-08-24 <= observation_date <= 2027-02-19
```

and the target observation file must not already exist.

If a heavily delayed scheduled run crosses into another UTC calendar date, do **not** rewrite history to make it belong to the nominal prior date. Absent expected calendar dates remain `CAPTURE_MISSING` in universe reporting. A duplicate target observation date does not create a second observation.

**FIREWALL.** Do not pretend the observation occurred exactly at 11:00 UTC if GitHub Actions started or completed late.

---

## 14. Immutable daily observation record

**FACT.** `public/data/history.csv` uses date-level upsert semantics (`scripts/etl/lib/gscoreHistoryCsv.mjs`, blob `d1c8ed95a5ac2dbaf3946f9573f2817474851774`). Same-day reruns replace the row.

**PROPOSED PROTOCOL DECISION.** H8 must **not** rely on `public/data/history.csv` as its authoritative research record.

Proposed authoritative prospective score artifact:

```text
research/h8-prospective/observations/YYYY-MM-DD.json
```

Exactly one file per UTC observation date.

Once created and committed:

- **NEVER MODIFY IT**
- **NEVER OVERWRITE IT**
- **NEVER BACKFILL IT**

If a scheduled observation is missed, that date remains `CAPTURE_MISSING`. A later manual run cannot fill it.

Each observation file should eventually contain at least:

- `study_id`
- `protocol_version`
- `observation_date`
- `scheduled_event = DAILY_ETL`
- `observation_as_of_utc`
- `capture_created_utc`
- `production_model_version`
- `production_implementation_revision`
- `production_ssot_version`
- `production_config_git_blob`
- `production_config_sha256`
- `source_base_git_sha`
- `h8_capture_source_sha` (accepted capture-implementation identity; distinct from the daily-data / current Git SHA)
- `latest_artifact_sha256`
- operational provenance, including at least:
  - `github_run_id`
  - `github_run_attempt`
  - `github_event_name`
  - and preferably `github_workflow_ref` and `github_sha`
- `common_eligibility_status`
- `eligibility_reason`
- required factor snapshot for all seven factors:
  - factor key
  - score
  - status
  - `last_updated_utc`
  - weight in Official
- `official_published_score`
- `official_formula_score`
- `liq_heavy_score`
- `mom_tilted_score`
- model version identifiers:
  - official = `v1.1.1`
  - liq-heavy = `liq-heavy-v1`
  - mom-tilted = `mom-tilted-v1`
- model factor-weight definitions, or an immutable reference to their frozen definition

Production snapshot BTC price may be captured for provenance. It is **not** the H8 primary MACE baseline.

**FIREWALL.** Do not include future outcome data in an observation artifact.

**IMPLEMENTATION DETAIL.** Exact JSON key names / schema file may be specified in a later capture-implementation contract. The fields above are required content.

---

## 15. Prospective BTC close tape

**PROPOSED PROTOCOL DECISION.** H8 should prospectively capture completed UTC BTC daily closes as they become known.

**FIREWALL.** Do **not** wait until March 2027 and reconstruct the complete outcome tape from a later moving file.

Proposed authoritative close artifact:

```text
research/h8-prospective/btc-closes/YYYY-MM-DD.json
```

One immutable file per completed UTC BTC close date.

The exact close dates required for H8 v1 `MACE_30` are:

```text
2026-08-24 through 2027-03-21 inclusive
```

No earlier close is required for H8 primary analysis. No later close enters H8 v1 MACE.

**PROPOSED PROTOCOL DECISION.** BTC close capture remains authorized **only** during:

```text
github.event_name == 'schedule' && github.run_attempt == 1
```

No `workflow_dispatch`, GitHub rerun, Refresh/API, local run, manual force, or manual backfill may write an H8 BTC-close artifact.

### 15.1 Deterministic automatic close catch-up

**PROPOSED PROTOCOL DECISION.** Replace any rule that an authorized run may capture only `T-1`.

For every authorized first-attempt scheduled ETL on UTC date `T`:

AFTER production ETL successfully updates the canonical completed UTC BTC history, the H8 close-capture process deterministically considers **all** required H8 close dates `d` satisfying:

```text
2026-08-24 <= d <= 2027-03-21
AND
d <= T - 1 UTC calendar day
AND
research/h8-prospective/btc-closes/d.json does not already exist
AND
the UTC run-date T is <= 2027-03-29
```

Process eligible missing dates in **ascending date order**.

For each missing required date:

If the post-ETL canonical completed-price artifact contains a row for **exactly** `d` whose close is present, finite, `> 0`, and a completed UTC daily candle, then create the immutable H8 close artifact for `d`.

If the source row for `d` is absent or invalid:

- do not substitute another date
- do not use spot price
- do not invent a value
- leave `d` uncaptured
- continue deterministically according to the later implementation contract

A later authorized first-attempt scheduled run may automatically capture `d` if it remains missing, the canonical source then contains a valid completed close, and the run-date is still within the authorized close-capture window.

This is **AUTOMATIC CATCH-UP**. It is **not** discretionary backfill.

**FIREWALL.** There must be no CLI / UI / workflow flag allowing the operator to choose which historical H8 close dates to fill.

### 15.2 First-authorized-value rule

**FACT.** The production canonical BTC history performs recent-date upserts from Coinbase.

**PROPOSED PROTOCOL DECISION.** For a required close date `d` that does not yet have an H8 close artifact: the first valid close value for `d` encountered by the deterministic H8 close-capture process at an authorized first-attempt scheduled event becomes the **permanent** H8 value.

Once `research/h8-prospective/btc-closes/d.json` exists, **NEVER**:

- overwrite it
- revise it
- replace it with a later Coinbase value
- synchronize it to a revised production history
- select another provider value

even if the canonical production BTC history later changes its row for `d`.

The H8 outcome tape therefore records the prospectively captured canonical value, not a later hindsight-corrected value.

### 15.3 Normal expected capture examples

Under the normal daily schedule:

```text
first required close  = 2026-08-24
  normally first eligible during first-attempt scheduled ETL on 2026-08-25

last required close   = 2027-03-21
  normally first eligible during first-attempt scheduled ETL on 2027-03-22
```

Under normal operations, automatic catch-up usually finds only `T-1` missing. If an earlier authorized capture failed, the next authorized scheduled run automatically considers that older missing date as well.

### 15.4 Fixed close-capture recovery window

**PROPOSED PROTOCOL DECISION.** Do not allow outcome catch-up indefinitely.

Automatic H8 BTC-close capture is authorized on first-attempt scheduled runs through:

```text
2027-03-29 UTC inclusive
```

Thus:

```text
normal final-close capture opportunity begins = 2027-03-22
fixed operational recovery grace continues through = 2027-03-29
```

After the end of the authorized `2027-03-29` UTC capture opportunity, **no new H8 v1 BTC-close artifact may be created**. No manual repair. No discretionary extension. No waiting until the tape happens to become complete. Remaining missing close artifacts remain missing permanently for H8 v1.

This recovery period changes only operational capture resilience. It does **not**:

- extend the observation window
- extend the MACE horizon
- add later market closes to MACE
- alter model scores
- alter the primary statistic

### 15.5 Why automatic catch-up does not convert H8 into reconstruction

H8 model observations:

- are captured before future outcomes exist
- are immutable
- cannot be backfilled

BTC outcome values:

- are captured automatically during a fixed preregistered operational window
- use the canonical completed-close source available at the first authorized capture opportunity that successfully records them
- become immutable when captured
- cannot be manually selected or revised

The final analysis uses only these frozen prospective artifacts.

**FIREWALL.** Do not reconstruct the entire outcome tape in March 2027 from a later moving file.

### 15.6 Close-artifact provenance

Each eventual close artifact must preserve enough provenance to identify the exact source state used. At minimum later implementation must capture:

- `study_id`
- `protocol_version`
- `close_date_utc`
- `close_usd`
- `source`
- `source_row_ingested_at_utc`
- `captured_at_utc`
- `source_artifact_sha256`
- `source_base_git_sha`
- `h8_capture_source_sha`
- operational provenance at least: `github_run_id`, `github_run_attempt`, `github_event_name`
- preferably also: `github_workflow_ref`, `github_sha`

Exact JSON schema remains an implementation-contract detail.

Once an H8 close artifact is created and committed:

- **NEVER MODIFY**
- **NEVER OVERWRITE**
- **NEVER REPLACE WITH A DIFFERENT VALUE**

---

## 16. Primary scientific question

**PROPOSED PROTOCOL DECISION.**

PRIMARY QUESTION:

> Within the frozen H8 prospective holdout, is higher forward-captured Official G-Score associated with greater subsequent Bitcoin downside over 30 UTC calendar days?

```text
class            = prospective descriptive risk discrimination
PRIMARY MODEL    = Official v1.1.1
PRIMARY OUTCOME  = MACE_30
PRIMARY STATISTIC = Spearman(Official G-Score, MACE_30)
```

Expected direction:

```text
higher Official G-Score
  -> larger subsequent MACE
  -> rho > 0
```

This mirrors the H7.2 PRIMARY question prospectively.

---

## 17. Primary outcome definition

**PROPOSED PROTOCOL DECISION.** For observation date `D`:

```text
S = completed prospectively captured UTC close C_D
path = C_D through C_D+30 inclusive
     = 31 completed UTC closes

MACE_30 = 1 - min(C_D ... C_D+30) / C_D
```

Close-only. No intraday low. No terminal forward return. No reconstruction-time or observation-time snapshot price as primary baseline.

This deliberately mirrors H7.2 so prospective evidence is comparable.

The observation-time BTC snapshot may be stored only for provenance / future separately preregistered research.

**LIMITATION.** Close-only MACE is not true intraday maximum adverse excursion.

**LIMITATION.** Overlapping 30-day windows mean observations are not independent. Spearman remains descriptive only.

---

## 18. Primary analysis sample

**PROPOSED PROTOCOL DECISION.** A date enters the H8 PRIMARY analysis only if:

1. the H8 observation was prospectively captured by the authorized **first-attempt** scheduled Daily ETL
2. `common_eligibility_status = ELIGIBLE`
3. Official integrity check passed
4. all exact prospectively captured BTC closes `C_D` through `C_D+30` exist and are valid finite positive values

Otherwise retain the date in universe reporting but do not enter Spearman.

Statuses should distinguish at least:

```text
ELIGIBLE_OUTCOME_COMPLETE
OBSERVATION_NOT_ELIGIBLE
CAPTURE_MISSING
INTEGRITY_MISMATCH
OUTCOME_INCOMPLETE
```

**FIREWALL.** Do not interpolate.
**FIREWALL.** Do not substitute.

---

## 19. Challenger analyses

**PROPOSED PROTOCOL DECISION.** Secondary challenger analyses use the **exact same eligible dates** and the **exact same `MACE_30` outcome values** as Official.

```text
SECONDARY: Spearman(Liq-Heavy, MACE_30)
SECONDARY: Spearman(Mom-Tilted, MACE_30)
```

Also preregister descriptive deltas:

```text
liq_heavy_delta_rho  = rho_liq_heavy  - rho_official
mom_tilted_delta_rho = rho_mom_tilted - rho_official
```

These deltas are **descriptive only**.

A positive delta does **not** automatically:

- promote a challenger
- replace Official
- authorize new weights
- validate the challenger

**FIREWALL.** No p-values.
**FIREWALL.** No confidence intervals.
**FIREWALL.** No significance labels.
**FIREWALL.** No threshold such as “challenger wins if delta > X”.

---

## 20. Spearman convention

**PROPOSED PROTOCOL DECISION.** Use the same frozen convention as H7.2:

- continuous / integer score values as captured
- independently rank model score and MACE
- 1-based conceptual ranks
- arithmetic mean occupied rank for ties
- Pearson correlation of rank vectors
- unrounded internal arithmetic

If either vector has zero variance:

```text
rho undefined
```

**FIREWALL.** No significance testing.

---

## 21. No longer-horizon tests in H8 v1

**PROPOSED PROTOCOL DECISION.** H8 v1 is specifically a prospective replication / follow-up of the H7.2 **30-day** primary finding.

**FIREWALL.** Do **not** add as H8 v1 outcome tests:

- 90d
- 180d
- terminal return
- realized volatility
- MCDD
- tail-event rates
- AUC
- bands
- quintiles
- regimes
- factor correlations

Those require separately preregistered studies.

---

## 22. No interim performance peeking

**PROPOSED PROTOCOL DECISION.** During the 180-date capture window and outcome-maturation period, do **not** calculate or display:

- running MACE correlation
- running Spearman
- challenger delta rho
- “current performance”
- hit rate
- outcome-by-score chart
- band performance
- partial-study performance

Operational integrity monitoring **is** allowed:

- capture file exists
- hash valid
- factor statuses
- score formula integrity
- missing observation count
- close file exists
- schema validity

**FIREWALL.** Monitoring must not join scores to future outcomes for performance analysis.

The first H8 v1 performance calculation occurs only after the conditions in §12 are met: observation window closed, `C_2027-03-21` complete, authorized close-capture opportunities through `2027-03-29` finished or conclusively absent/failed, both tapes frozen, and independent capture-integrity review accepted. Missing required closes remain `OUTCOME_INCOMPLETE`. Do not wait indefinitely.

---

## 23. Fixed study end / no optional stopping

**PROPOSED PROTOCOL DECISION.** Do not stop because results appear good. Do not extend because results appear bad. Do not stop because a challenger appears better.

The planned observation window is the fixed 180-date window:

```text
2026-08-24 through 2027-02-19
```

The performance result waits for the frozen analysis-readiness rule in §12. It does **not** wait indefinitely for missing close values.

**FIREWALL.** No performance calculation during the observation window, ordinary 30-day maturation, or the fixed close-capture recovery period through `2027-03-29` UTC.
**FIREWALL.** After that recovery window ends, remaining missing close artifacts stay missing; affected observations are `OUTCOME_INCOMPLETE`.
**FIREWALL.** No post-`2027-03-21` close enters MACE.

---

## 24. Result language

**PROPOSED PROTOCOL DECISION.** For Official PRIMARY:

| rho | label |
|---|---|
| `rho > 0` | `DIRECTIONALLY_ALIGNED_WITH_H7_2_PRIMARY` |
| `rho = 0` | `NO_DIRECTIONAL_ASSOCIATION` |
| `rho < 0` | `DIRECTIONALLY_OPPOSED_TO_H7_2_PRIMARY` |
| undefined | `UNDEFINED` |

Always report exact rho and `N`.

**FIREWALL.** Do **not** translate into:

- `VALIDATED`
- `INVALIDATED`
- `PROVEN`
- `FAILED`
- `PREDICTIVE`
- `STATISTICALLY SIGNIFICANT`

For challengers: report exact rho and exact delta vs Official.

**FIREWALL.** Do not use `WINNER`, `LOSER`, or `BEST MODEL`.

A challenger result may motivate a later separately preregistered model-promotion study. It does **not** automatically alter production.

---

## 25. Champion / challenger governance

**PROPOSED PROTOCOL DECISION.** Official v1.1.1 remains production Champion throughout H8 unless an external operational necessity requires otherwise.

Liq-Heavy and Mom-Tilted remain research Challengers.

H8 itself cannot:

- change Official weights
- promote a challenger
- create Official v2
- create another challenger
- delete old scores

If a future model change is scientifically justified: create a new versioned candidate. Historical models remain permanently reproducible.

**FIREWALL.** No fourth or fifth candidate during H8 v1.

---

## 26. Model-change firewall during H8

**PROPOSED PROTOCOL DECISION.** Distinguish:

```text
METHODOLOGY CHANGE
versus
NON-METHODOLOGY OPERATIONAL CHANGE
```

At minimum, any change to:

- enabled factors
- factor weights
- pillar interpretation
- factor scoring formulas
- subweights
- cycle / spike adjustments
- model version
- challenger formula

is an H8 methodology / model change.

**FIREWALL.** Such a change must **not** silently continue under H8 v1. H8 v1 capture must stop pending independent review / a new protocol version.

For ordinary implementation or operational fixes that claim **not** to change model methodology: record the code/config provenance and require **explicit compatibility review** before treating subsequent observations as belonging to the same H8 model.

**FIREWALL.** Do not silently assume compatibility.

---

## 27. Model-contract fingerprint audit

**FACT.** Identities below are recorded at parent main `9478099ff775f1d6630b83bd402727870f15ca10`. This pass did **not** modify these files. The fingerprint is conservative: a change to a transitive scientific helper must not pass unnoticed merely because a top-level importer stayed unchanged.

**PROPOSED PROTOCOL DECISION.** Distinguish:

```text
H8 SCIENTIFIC MODEL-CONTRACT FINGERPRINT CHANGE
versus
H8 CAPTURE-IMPLEMENTATION FINGERPRINT CHANGE
versus
ordinary data-artifact changes under public/data, public/signals, public/extras, public/alerts
```

Daily `public/data` updates must **not** themselves hard-stop H8. Ordinary Git `HEAD` will advance every day during H8 and will **not** remain equal to the later `H8_CAPTURE_SOURCE_SHA`.

A scientific model-contract fingerprint change during H8:

- does **not** erase prior observations
- does **not** silently authorize later observations
- **pauses** H8 scientific capture pending explicit compatibility review

If the code change is scientifically compatible: document the compatibility decision **before** subsequent observations are treated as belonging to H8 v1.

If it changes methodology: H8 v1 does **not** silently continue.

The future H8 capture implementation **must not** modify any scientific model-contract fingerprint path without STOP / independent protocol review.

### 27.1 Scientific model-contract dependency trees

**FACT.** Git tree SHAs at parent main:

| Path | Git TREE SHA | Role | Hard-stop H8 on tree change? |
|---|---|---|---|
| `scripts/etl/factors/` | `3921332c0decd56800e78580183931b718b9a345` | Factor-formula helpers imported by production scoring (`trendValuation`, stablecoin aggregation/guard, market regime, onchain modules) | **YES** |
| `scripts/etl/lib/` | `64c73c01db27f1e6dbcd12d45d08c2f12bc47b12` | Scoring / freshness / adjustment / snapshot / close-period helpers used by production ETL | **YES** |

`scripts/etl/factors/` currently contains:

```text
marketRegime.mjs
onchain-enhanced.mjs
onchain.mjs
stablecoinGrowthAggregation.mjs
stablecoinGrowthGuard.mjs
trendValuation.mjs
```

`scripts/etl/lib/` currently contains:

```text
completedPeriods.mjs
etfZeroCross.mjs
gscoreHistoryCsv.mjs
macroFreshness.mjs
officialAdjustments.mjs
postComputeHealth.mjs
riskBand.mjs
signalV2.mjs
snapshotPrice.mjs
sourceObservationTime.mjs
ssotSubweights.mjs
termFreshness.mjs
```

A blob change inside either tree changes that tree SHA even if `factors.mjs` / `compute.mjs` themselves are unchanged.

### 27.2 Scientific model-contract individual production blobs

| Path | Git blob SHA | Role | Hard-stop H8 on blob change? |
|---|---|---|---|
| `config/dashboard-config.json` | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` | Authoritative Official v1.1.1 weights, enabled flags, subweights, cycle/spike flags, model/ssot versions | **YES** |
| `lib/config-loader.mjs` | `8f439254ca813050703a7c17bcd658474c19e2b2` | Loads and normalizes Official SSOT for ETL scoring | **YES** |
| `scripts/etl/compute.mjs` | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` | ETL orchestration, published `composite_score`, artifact as-of | **YES** |
| `scripts/etl/factors.mjs` | `e9fd06df79967f0041a901e2dd971b771e669b03` | Factor scoring + production composite assembly | **YES** |
| `scripts/etl/stalenessUtils.mjs` | `1c213b9b8eb659c9cda22d0834694ae3239eb768` | Production calendar-aware freshness / eligibility | **YES** |
| `scripts/etl/marketCalendar.mjs` | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` | ETF / equity-calendar freshness helper | **YES** |
| `scripts/etl/adjustments.mjs` | `36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7` | Cycle/spike math (currently gated off) | **YES** |
| `scripts/etl/coinGeckoCache.mjs` | `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff` | Price / social fetch cache used by factor scoring | **YES** |
| `scripts/etl/priceHistory.mjs` | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` | Production completed-UTC-close history used as the live source for later H8 close capture | **YES** |
| `scripts/etl/fetch-helper.mjs` | `da8ca2b441088f2e13364249e7ecbbed40dc22a4` | Direct production fetch/retry helper imported by `factors.mjs` and `compute.mjs` | **YES** |

### 27.3 Documented non-authority / non-H8-statistic files

These are recorded so they are not mistaken for H8 scientific authority. A change still must not silently rewrite frozen H8 observations.

| Path | Git blob SHA | Role | Hard-stop H8 scientific capture? |
|---|---|---|---|
| `config/weights.json` | `9a8b2f8fba220bc9e5bd8de7f8bc1d27c707ba9b` | Older v1.1.0 config. **Not** H8 Official authority | NO as Official SSOT |
| `lib/experimentalModel.ts` | `b041a44e37c6268e1d7ab4a9f9117ab0d27e2eeb` | UI-only pillar reweighting / Preview | **NO** for H8 scientific scores |
| `lib/composite-validator.mjs` | `7a4b30dd84e77b1e4e2cafc06f515efdbf0341b2` | Dev/CI composite check with 0.5 tolerance. **Not** H8 scientific arithmetic | **NO** as H8 scoring SSOT |
| `scripts/etl/lib/gscoreHistoryCsv.mjs` | `d1c8ed95a5ac2dbaf3946f9573f2817474851774` | Date-level upsert of `history.csv` — **not** H8 research SSOT | NO as research SSOT |
| `scripts/etl/lib/riskBand.mjs` | `f7b15ed2b43da3cdd2d70d0d3a34d226ea73fef1` | Band labels from composite. H8 v1 does **not** analyze bands | NO for H8 v1 statistic |
| `scripts/etl/factor-history-tracking.mjs` | `76cf56349944ac6b8f28e6401d2d981b25126b6f` | Post-compute operational history sync; does not define H8 scientific scores | NO for H8 scientific scores |

UI / application files unrelated to scientific score generation are not fingerprinted.

This is provenance design only. This pass did not modify any of these files.

### 27.4 H8 capture-implementation fingerprint — not assigned yet

**PROPOSED PROTOCOL DECISION.** The H8 capture-implementation fingerprint does **not** exist yet. It will be established only AFTER:

- protocol freeze / merge
- capture code is written
- workflow is updated
- synthetic tests pass
- independent implementation review accepts the exact bytes

At that later point formally assign `H8_CAPTURE_SOURCE_SHA` to the accepted capture-implementation commit.

**FIREWALL.** Do **not** assign `H8_CAPTURE_SOURCE_SHA` in this document.

The later implementation freeze must record the exact accepted blobs for at least:

- `.github/workflows/daily-etl.yml`
- H8 capture script(s)
- H8 schemas / validation code
- other H8-specific runtime scientific-capture code

The implementation commit may add those H8 paths and modify the workflow, but must **not** alter the frozen scientific model-contract fingerprint absent a separately reviewed compatibility issue.

`H8_CAPTURE_SOURCE_SHA` identifies the accepted capture implementation commit, **not** the current daily-data commit. Each observation should eventually record both:

```text
h8_capture_source_sha
source_base_git_sha / github_sha
```

as distinct provenance concepts. The implementation contract will define exact runtime verification of frozen capture-script / workflow identities despite normal daily data commits.

After `H8_CAPTURE_SOURCE_SHA` is frozen, a later change to the accepted H8 runtime workflow fingerprint pauses scientific capture pending compatibility review.

### 27.5 Pre-H8 workflow blob — baseline, not final runtime identity

**FACT.** Current `.github/workflows/daily-etl.yml` at parent main:

```text
git blob SHA = f2103048d384749310432eee610dffad2dad0f4f
label        = PRE-H8 CAPTURE WORKFLOW BASELINE
```

This is **historical / pre-implementation provenance**. It is **not** the final frozen H8 runtime workflow identity.

Its expected one-time change to install the accepted H8 capture step does **not** itself constitute a model-methodology change. That workflow change must still be:

- independently reviewed
- frozen before first observation
- included in `H8_CAPTURE_SOURCE_SHA` provenance

---

## 28. Daily-ETL workflow audit and future capture location

**FACT.** Current scheduled production capture (do **not** edit in this pass):

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "0 11 * * *"
```

Current workflow stages, after `npm run etl:compute`, commit:

```text
public/data
public/signals
public/extras
public/alerts
```

to `main`.

**IMPLEMENTATION DETAIL — proposed, not implemented.** Later H8 capture should occur:

```text
1. production ETL succeeds
2. authorized first-attempt scheduled H8 capture runs
3. production + newly created H8 artifacts are committed
```

Recommended future workflow condition for **study observations and prospective close capture**:

```text
if: github.event_name == 'schedule' && github.run_attempt == 1
```

Future workflow staging must explicitly include **only** the intended H8 append-only paths in addition to existing production artifacts:

```text
research/h8-prospective/observations/
research/h8-prospective/btc-closes/
```

**FIREWALL.** Do **not** use `git add research` or another broad research-tree stage.

`workflow_dispatch` may remain for operational production ETL. Manual / `workflow_dispatch` production commits must **not** create or alter H8 artifacts. GitHub reruns must **not** create or alter H8 artifacts.

The expected one-time workflow change that installs the accepted H8 capture step is a **capture-implementation** change, not a scientific model-methodology change. It must still be independently reviewed, frozen before first observation, and included in later `H8_CAPTURE_SOURCE_SHA` provenance. After that freeze, a later change to the accepted runtime workflow pauses scientific capture pending compatibility review.

**FIREWALL.** This pass does **not** edit `.github/workflows/daily-etl.yml`.
**FIREWALL.** `H8_CAPTURE_SOURCE_SHA` is **not** assigned in this document.

---

## 29. Capture implementation requirements — design only

**PROPOSED PROTOCOL DECISION.** Later capture implementation must be:

- append-only by UTC date
- create-only
- hard-fail on attempted overwrite of an existing H8 artifact
- first-attempt scheduled-event-only (`github.event_name == 'schedule' && github.run_attempt == 1`)
- network-free beyond data already retrieved by production ETL
- deterministic
- schema validated
- hash / provenance rich
- independently tested with synthetic fixtures

Score-observation capture additionally:

- one immutable file per UTC observation date
- never backfilled, never reconstructed
- idempotent only in the sense that an existing identical date artifact causes **STOP / no new scientific observation**, not overwrite
- no force / backfill override of any kind

BTC-close capture additionally:

- deterministic automatic catch-up of missing required dates `d <= T-1` inside `2026-08-24`…`2027-03-21` while the UTC run-date is `<= 2027-03-29`
- first-authorized-valid value becomes immutable
- no operator-selected dates
- no CLI / UI / workflow flag to choose which historical close dates to fill
- no overwrite if the production canonical history later revises `d`

**FIREWALL.** Manual refresh must never alter a frozen H8 observation or frozen H8 close artifact.

**FIREWALL.** This pass writes **no** capture code, **no** research capture directory, **no** score files, and **no** outcome files.

---

## 30. Calibration / model-zoo firewall

**FIREWALL.** Calibration remains **CLOSED**.

**FIREWALL.** H8 cannot create Candidate 4 or Candidate 5.

Any future new candidate must have:

- explicit hypothesis
- frozen formula
- version
- prospective start date
- separate preregistration

before performance is observed.

**FIREWALL.** Do not search the historical data for a better weighting combination.
**FIREWALL.** Do not grid-search weights.
**FIREWALL.** Do not optimize 30-day rho.

---

## 31. What this candidate pass does and does not do

This candidate amendment modifies **only**:

```text
docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md
```

It does **not**:

- calculate historical performance for any model
- calculate prospective performance
- calculate MACE
- calculate returns
- calculate correlations
- compare historical Official / Liq-Heavy / Mom-Tilted performance
- tune weights
- create a fourth or fifth model
- modify production model methodology
- modify H7 / H7.1 / H7.2
- write capture implementation code
- edit Daily ETL
- create `research/h8-prospective/` directories or files
- merge this branch

---

## 32. Stop

**STOP FOR FINAL INDEPENDENT H8 PROTOCOL-CANDIDATE REVIEW.**

Do not freeze this document until that review accepts or amends it.
Do not assign `H8_PROTOCOL_SHA` yet.
Do not assign `H8_CAPTURE_SOURCE_SHA` yet.
Do not implement capture until a freeze exists.
Do not start the 180-date window if capture infrastructure is not operational before `2026-08-24`.
