# H8 Prospective 30-Day Risk-Discrimination Preregistration

**Date:** 2026-08-20
**Phase:** H8 — prospective three-model forward holdout
**Status:** `PROTOCOL CANDIDATE — METHODOLOGY PROPOSED — NOT YET FROZEN`
**Proposed protocol version:** `h8-prospective-three-model-v1`
**Branch:** `research/h8-prospective-three-model-preregistration`
**Parent main HEAD at candidate creation:** `9478099ff775f1d6630b83bd402727870f15ca10`

This document is a **protocol candidate**. Methodology is **proposed**, not frozen. Independent review may amend it. Changing any later **frozen** PROTOCOL DECISION will require a new protocol version. H8 capture has **not** been implemented. H8 performance has **not** been calculated. Calibration remains **CLOSED**.

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
= 0.86 + (0.18 + 0.077 + 0.043) * (0.35 / 0.30)
= 0.86 + 0.30 * (0.35 / 0.30)
= 0.86 + 0.35
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
= 0.90 + 0.30 * (0.25 / 0.30)
= 0.90 + 0.25
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

**OPEN FOR REVIEW — production composite vs H8 scientific rule.** At parent main, production `scripts/etl/factors.mjs` `calculateEnhancedGScore` divides `weightedSum / totalWeight` of **fresh** factors, then `Math.round`. Production `scripts/etl/compute.mjs` then applies:

```text
finalComposite = Math.max(0, Math.min(100, Math.round(adjustedComposite * 10) / 10))
```

with cycle/spike `adj_pts` forced to `0` when those flags are disabled.

H8 v1 **does not adopt** missing-factor renormalization as a scientific rule. Instead it **requires common eligibility of all seven factors**, so Official `totalWeight = 1.00` and the production renormalization is a no-op on H8-eligible days. With adjustments disabled, the tenth-point rounding is also an identity on an already-integer Official composite.

If independent review later finds that production published scores are not exact integers, or that production arithmetic diverges from the H8 formula on eligible days, those days are `INTEGRITY_MISMATCH` — they are not silently repaired.

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
2027-03-21
```

**PROPOSED PROTOCOL DECISION.** H8 primary result evaluation must **not** occur before the completed `2027-03-21` UTC daily close has been prospectively captured and accepted in the H8 close tape.

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

**PROPOSED PROTOCOL DECISION.** H8 study observations must be generated **only** from the scheduled Daily ETL event (`github.event_name == 'schedule'`).

**FIREWALL.** The following must **not** create a new H8-eligible observation:

- Refresh button
- API refresh
- local ETL
- `workflow_dispatch`
- rerun of a failed/non-schedule job
- any other ad-hoc execution

**PROPOSED PROTOCOL DECISION.** The H8 observation timestamp is the **actual** production artifact as-of / capture timestamp from that scheduled run.

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
- `latest_artifact_sha256`
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

The scheduled Daily ETL on date `T` may capture the completed UTC close for `T-1` after that close exists in the production BTC history.

Each close file should contain at least:

- `study_id`
- `close_date_utc`
- `close_usd`
- `source`
- `captured_at_utc`
- `source_artifact_sha256`
- `source_base_git_sha`

Once committed:

- **NEVER MODIFY**
- **NEVER OVERWRITE**
- **NEVER BACKFILL WITH A DIFFERENT VALUE**

If a completed close was not prospectively captured, mark it missing for H8 outcome coverage.

**FIREWALL.** Do not substitute a later revised close silently.

The H8 outcome tape must therefore itself be prospective.

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

1. the H8 observation was prospectively captured by the authorized scheduled Daily ETL
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

The first H8 v1 performance calculation occurs only after the complete study window has matured.

---

## 23. Fixed study end / no optional stopping

**PROPOSED PROTOCOL DECISION.** Do not stop because results appear good. Do not extend because results appear bad. Do not stop because a challenger appears better.

The planned observation window is the fixed 180-date window:

```text
2026-08-24 through 2027-02-19
```

The performance result waits for final 30-day maturity.

**FIREWALL.** No performance calculation before the completed `2027-03-21` UTC close is available in the prospective H8 close tape.

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

**FACT.** The following table records Git blob SHAs at parent main `9478099ff775f1d6630b83bd402727870f15ca10`. This pass did **not** modify these files.

A later blob change should **hard-stop H8 pending compatibility review** when marked `YES`. Files marked `NO` are documented so they are not mistaken for H8 scientific authority; a change to them still must not silently rewrite frozen H8 observations.

| Path | Git blob SHA | Role | Hard-stop H8 on blob change? |
|---|---|---|---|
| `config/dashboard-config.json` | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` | Authoritative Official v1.1.1 weights, enabled flags, subweights, cycle/spike flags, model/ssot versions | **YES** |
| `config/weights.json` | `9a8b2f8fba220bc9e5bd8de7f8bc1d27c707ba9b` | Older v1.1.0 config. **Not** H8 Official authority | NO as Official SSOT; still must not be treated as H8 Official if edited |
| `scripts/etl/factors.mjs` | `e9fd06df79967f0041a901e2dd971b771e669b03` | Factor scoring + production composite assembly (`calculateEnhancedGScore`) | **YES** |
| `scripts/etl/compute.mjs` | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` | ETL orchestration, adjustment gating, published `composite_score` / artifacts | **YES** |
| `scripts/etl/lib/ssotSubweights.mjs` | `c33e13a92cbc75697e51ea3face379f503a40924` | Official subweight lock + intra-factor blend | **YES** |
| `scripts/etl/lib/officialAdjustments.mjs` | `8dc663b1d202451d3a3c11a9a33604d69e775953` | Cycle/spike disable gating (`adj_pts = 0`) | **YES** |
| `scripts/etl/adjustments.mjs` | `36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7` | Cycle/spike math (currently gated off) | **YES** if reactivated or if gating bypassed |
| `scripts/etl/factors/trendValuation.mjs` | `75046b4d47d73144f56c339c0461bdd4b6bf21b1` | Trend & Valuation factor formula | **YES** |
| `scripts/etl/stalenessUtils.mjs` | `1c213b9b8eb659c9cda22d0834694ae3239eb768` | Production calendar-aware freshness | **YES** |
| `scripts/etl/marketCalendar.mjs` | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` | ETF / equity-calendar freshness helper | **YES** |
| `scripts/etl/lib/macroFreshness.mjs` | `7781aedb1941d4052aa1f90c20f52615abb7d979` | Macro Overlay source-cadence freshness | **YES** |
| `scripts/etl/lib/termFreshness.mjs` | `bc889e6b50f50c52b5d673c1d7f709ffe05c32e0` | Term / leverage freshness | **YES** |
| `scripts/etl/priceHistory.mjs` | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` | Production completed-UTC-close history used as the live source for later H8 close capture | **YES** for outcome-tape provenance |
| `scripts/etl/lib/gscoreHistoryCsv.mjs` | `d1c8ed95a5ac2dbaf3946f9573f2817474851774` | Date-level upsert of `history.csv` — **not** H8 research SSOT | NO as research SSOT; upsert behavior is why H8 needs append-only files |
| `lib/experimentalModel.ts` | `b041a44e37c6268e1d7ab4a9f9117ab0d27e2eeb` | UI-only pillar reweighting / Preview | **NO** for H8 scientific scores; UI may change without rewriting H8 formulas |
| `lib/composite-validator.mjs` | `7a4b30dd84e77b1e4e2cafc06f515efdbf0341b2` | Dev/CI composite check with 0.5 tolerance; treats weights as percents in places. **Not** H8 scientific arithmetic | **NO** as H8 scoring SSOT |
| `.github/workflows/daily-etl.yml` | `f2103048d384749310432eee610dffad2dad0f4f` | Scheduled capture mechanism | **YES** for observation-event gating; later H8 capture must not weaken scheduled-only rule |
| `scripts/etl/lib/riskBand.mjs` | `f7b15ed2b43da3cdd2d70d0d3a34d226ea73fef1` | Band labels from composite. H8 v1 does **not** analyze bands | NO for H8 v1 scientific statistic |

This is provenance design only. This pass did not modify any of these files.

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
AFTER successful production ETL compute
BEFORE artifact commit
```

Recommended future workflow condition for **study observations**:

```text
if: github.event_name == 'schedule'
```

Recommended placement:

1. `npm run etl:compute` succeeds
2. **new H8 capture step** (create-only observation + optional T-1 close file)
3. existing `git add` / commit of production artifacts, extended to include the new append-only research paths **only when the capture step created a new file**

`workflow_dispatch` may remain for operational production ETL. It must **not** write a new H8 observation.

**FIREWALL.** This pass does **not** edit `.github/workflows/daily-etl.yml`.

---

## 29. Capture implementation requirements — design only

**PROPOSED PROTOCOL DECISION.** Later capture implementation must be:

- append-only by UTC date
- create-only
- hard-fail on attempted overwrite
- idempotent only in the sense that an existing identical date artifact causes **STOP / no new scientific observation**, not overwrite
- scheduled-event-only for study observations
- network-free beyond data already retrieved by production ETL
- deterministic
- schema validated
- hash / provenance rich
- independently tested with synthetic fixtures

**FIREWALL.** Manual refresh must never alter a frozen H8 observation.

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

This candidate pass creates **only**:

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

**STOP FOR INDEPENDENT H8 PROTOCOL-CANDIDATE REVIEW.**

Do not freeze this document until that review accepts or amends it.
Do not implement capture until a freeze exists.
Do not start the 180-date window if capture infrastructure is not operational before `2026-08-24`.
