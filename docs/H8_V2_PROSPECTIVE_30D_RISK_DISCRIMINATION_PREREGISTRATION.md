# H8 v2 Prospective 30-Day Risk-Discrimination Preregistration

**Date:** 2026-08-27
**Phase:** H8 v2 — successor prospective three-model forward holdout
**Status:** `PROTOCOL CANDIDATE — NOT FROZEN`
**Protocol version:** `h8-prospective-three-model-v2`
**Study namespace:** `h8-v2-prospective`
**Branch:** `research/h8-v2-protocol-candidate`
**Parent main HEAD at candidate creation:** `0abdc70a006cbab5b8f04a658a070812334b33b6`

```text
H8 v2 start date          = UNASSIGNED
H8 v2 observations        = ZERO
H8 v2 matured outcomes    = ZERO
H8 v2 performance         = NONE
H8 v2 capture implementation = NOT YET IMPLEMENTED
Calibration               = CLOSED
```

This document is a **protocol candidate**. It is **not** frozen. Do **not** assign `H8_V2_PROTOCOL_SHA`, `H8_V2_CAPTURE_CONTRACT_SHA`, `H8_V2_CAPTURE_SOURCE_SHA`, or `H8_V2_START_SHA` during this candidate pass. Those identities are assigned only after later independent freeze / implementation / start-authorization steps.

Future research namespace:

```text
research/h8-v2-prospective/
```

Do **not** reuse `research/h8-prospective/` for v2 observations, closes, rehearsal artifacts, activation state, or identity controls.

Labels used below:

- **FACT** — inherited from closed H8 v1 identities, current production config/code at the parent main SHA, or calendar arithmetic of the later-authorized window
- **CANDIDATE PROTOCOL DECISION** — proposed methodology for independent review; freeze requires a later accepted commit
- **FIREWALL** — a prohibition that is not open to casual weakening
- **LIMITATION** — a bound on what later H8 v2 execution may claim even after results exist
- **IMPLEMENTATION DETAIL** — later code/schema design, not an open scientific choice once the protocol is frozen

---

## 0. Sequencing — protocol first

**CANDIDATE PROTOCOL DECISION.** H8 v2 uses this order and no other:

```text
PROTOCOL FIRST
→ IMPLEMENTATION
→ REAL SCHEDULED NON-STUDY REHEARSAL
→ INDEPENDENT ACCEPTANCE
→ START AUTHORIZATION
→ PROSPECTIVE STUDY
```

The calendar does **not** start H8 v2 until the machinery has already proven it can execute the **non-empty research commit/push path**.

H8 v1 froze a start date and then failed to land a scientific research commit before that date. H8 v2 refuses to assign `S` until after a genuine scheduled non-study rehearsal has succeeded.

---

## 1. Zero-state banner

**FACT. H8 v2 observations = ZERO.**

**FACT. H8 v2 matured outcomes = ZERO.**

**FACT. H8 v2 performance calculations = NONE.**

**FACT. H8 v2 start date = UNASSIGNED.**

**FACT. H8 v2 capture implementation = NOT YET IMPLEMENTED.**

**FIREWALL.** Calibration remains **CLOSED**.

**FIREWALL.** Do not populate H8 v2 with:

- H7 reconstructed rows
- H7.1 rows
- H7.2 rows
- H8 v1 proposed / ephemeral 2026-08-24 observation
- production historical scores
- reconstructed Official scores
- reconstructed challenger scores
- August 2026 prospective-looking backfill
- rehearsal artifacts
- any date before the later v2 start authorization

---

## 2. Closed H8 v1 identity

**FACT.** H8 v1 remains historical and **CLOSED**.

| Item | Value |
|---|---|
| Protocol version | `h8-prospective-three-model-v1` |
| `H8_PROTOCOL_SHA` | `85fb5bcbdb5c6d04333a3a9516629851efd890eb` |
| Capture contract version | `h8-capture-implementation-contract-v1` |
| `H8_CAPTURE_CONTRACT_SHA` | `811359afc572c86aa3d2d8732a1efd2c72b9df8f` |
| Historical `H8_CAPTURE_SOURCE_SHA` | `8406b14f344a3c8805b6931ced55ac0d607af611` |
| Status | `STOPPED BEFORE SUCCESSFUL STUDY START` |
| Accepted v1 observations | **ZERO** |
| Accepted v1 BTC closes | **ZERO** |
| Performance | **NONE** |
| Calibration | **CLOSED** |

**FIREWALL.** Do not modify:

```text
docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md
docs/H8_CAPTURE_IMPLEMENTATION_CONTRACT.md
docs/H8_V1_START_FAILURE_2026-08-24.md
```

or any historical v1 identity / artifact.

**FIREWALL.** Do not recreate the deleted v1 activation sidecar `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt`.

**FIREWALL.** Do not treat any H8 v1 ephemeral runner file as accepted scientific evidence.

---

## 3. Purpose

**CANDIDATE PROTOCOL DECISION.** H8 v2 asks whether the **actual forward-captured** GhostGauge model family shows prospective 30-day risk-discrimination / ranking-usefulness behavior.

Class:

```text
PROSPECTIVE DESCRIPTIVE RISK-DISCRIMINATION / RANKING-USEFULNESS HOLDOUT
```

The study captures model scores **before** their future outcomes exist.

H8 v2 is **not**:

- historical reconstruction
- a backtest
- calibration
- model tuning
- trading-strategy validation
- a challenger promotion test
- proof of prediction
- proof of causality

**LIMITATION.** A later descriptive association, if it exists, does not prove that the gauge is predictive, calibrated, or suitable as a trading rule.

---

## 4. Exactly three models

**CANDIDATE PROTOCOL DECISION.** Freeze **exactly three** models. This is the same scientific model family as H8 v1.

| Role | Name / version | Status |
|---|---|---|
| PRIMARY / CHAMPION | Official `v1.1.1` | production |
| SECONDARY CHALLENGER | `liq-heavy-v1` | research only |
| SECONDARY CHALLENGER | `mom-tilted-v1` | research only |

**FIREWALL.** No fourth model.
**FIREWALL.** No fifth model.
**FIREWALL.** No new weights.
**FIREWALL.** No grid search.
**FIREWALL.** No optimization.
**FIREWALL.** No historical comparison used to choose another challenger.
**FIREWALL.** Calibration remains **CLOSED**.

Any future new candidate must have an explicit hypothesis, frozen formula, version, prospective start authorization, and **separate** preregistration **before** its performance is observed.

---

## 5. Same factors — only top-level weights differ

**CANDIDATE PROTOCOL DECISION.** All three models use the **exact same** captured daily factor snapshot.

The challengers do **not** have different:

- sources
- formulas
- subweights
- freshness rules
- missing-data handling
- adjustments
- eligibility sets

Only the frozen **top-level factor weights** differ.

This remains a **controlled weighting comparison**.

**FIREWALL.** Do not alter factor formulas for H8 v2.
**FIREWALL.** Do not give one challenger a different eligible-day set than another.

---

## 6. Official — PRIMARY / CHAMPION

### 6.1 Authoritative production SSOT

**FACT.** The authoritative current production SSOT at parent main `0abdc70a006cbab5b8f04a658a070812334b33b6` is:

```text
path                         = config/dashboard-config.json
git blob SHA                 = b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49
model_version                = v1.1.1
implementation_revision      = integrity-2026-08
ssot_version                 = 2.1.1
```

### 6.2 `config/weights.json` is NOT H8 Official authority

**FACT.** `config/weights.json` at the same parent main remains an older `v1.1.0` configuration (blob `9a8b2f8fba220bc9e5bd8de7f8bc1d27c707ba9b`).

**FIREWALL.** `config/weights.json` is **not** authoritative for H8 Official.

### 6.3 Official factor weights

**FACT / CANDIDATE PROTOCOL DECISION.** Official v1.1.1 factor weights, copied from `config/dashboard-config.json`:

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

### 6.4 Cycle and spike

**FACT.** At Official v1.1.1:

```text
adjustments.cycle.enabled = false
adjustments.spike.enabled = false
```

**CANDIDATE PROTOCOL DECISION.** H8 v2 Official scoring uses those disabled flags. Reactivating cycle or spike is a methodology change and is not authorized under H8 v2.

### 6.5 Trend freshness

**FACT.** After the accepted Trend-cache-removal merge (`ffdfaf1c21c65af68b241c15b87d85c154dffe3a`, PR #33), Trend & Valuation is intentionally computed **fresh on each ETL invocation** because the current BTC snapshot participates directly in Mayer and BMSB scoring.

**CANDIDATE PROTOCOL DECISION.** H8 v2 captures the Trend score produced by that same-run fresh computation. It does **not** reuse a prior snapshot via Trend factor-result cache.

---

## 7. Liq-Heavy — SECONDARY CHALLENGER

**CANDIDATE PROTOCOL DECISION.**

```text
name/version = liq-heavy-v1
role         = SECONDARY CHALLENGER
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
= 0.65 + 0.30 * (0.35 / 0.30)
= 0.65 + 0.35
= 1.00
```

**FIREWALL.** Do not replace the ratio expressions with independently rounded decimals as the scientific definition.

---

## 8. Mom-Tilted — SECONDARY CHALLENGER

**CANDIDATE PROTOCOL DECISION.**

```text
name/version = mom-tilted-v1
role         = SECONDARY CHALLENGER
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
= 0.75 + 0.30 * (0.25 / 0.30)
= 0.75 + 0.25
= 1.00
```

---

## 9. H8 scientific score arithmetic

**CANDIDATE PROTOCOL DECISION.** Preserve v1 arithmetic exactly.

For every eligible captured factor snapshot:

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
**FIREWALL.** Do not renormalize around a missing factor.
**FIREWALL.** Do not substitute a prior factor score.
**FIREWALL.** Do not carry forward a prior factor.
**FIREWALL.** Do not reconstruct a score later.

**CANDIDATE PROTOCOL DECISION — production Official arithmetic on H8-eligible days.** Production `calculateEnhancedGScore()` divides by the sum of Official weights of **fresh** factors. H8 v2 **does not adopt** missing-factor renormalization as a scientific rule. Instead it **requires common eligibility of all seven required factors**. For an H8 `ELIGIBLE` observation:

- all seven required factors are `fresh`
- all seven Official weights participate
- Official `totalWeight = 1.00`
- therefore production normalization does not change the weighted sum

At Official v1.1.1, cycle and spike adjustments are disabled, so on an H8-eligible day the Official H8 scientific formula should exactly equal production `composite_score`.

`official_published_score` is the `composite_score` field from `public/data/latest.json` produced by the **same** authorized first-attempt scheduled ETL run whose factor snapshot is captured.

**FIREWALL.** Do **not** use `public/data/history.csv` as `official_published_score` scientific authority.

---

## 10. Common eligibility

**CANDIDATE PROTOCOL DECISION.** The three models must use the **same** eligible observation set.

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

A scheduled captured opportunity is `ELIGIBLE` only when all seven required production factors:

- exist
- are finite
- are between `0` and `100`
- have production status `fresh`

All three models share exactly the same eligibility state.

If any required factor is not fresh/valid:

```text
observation status = NOT_ELIGIBLE
```

Do not calculate a scientific model score using missing-factor renormalization.

The immutable observation artifact should still record that the scheduled capture occurred and why it was `NOT_ELIGIBLE`.

**FIREWALL.** Do not allow one challenger to enter the sample while another does not.

---

## 11. Official score integrity check

**CANDIDATE PROTOCOL DECISION.** Preserve same-run Official integrity verification.

Capture:

```text
A. production published public/data/latest.json composite_score
B. independently recomputed Official score from the captured seven-factor
   snapshot and frozen Official weights
```

Require exact integer equality.

If mismatch:

```text
status = INTEGRITY_MISMATCH
```

The date is permanently not eligible for H8 scientific score analysis.

**FIREWALL.** Do not repair or reconstruct it later.
**FIREWALL.** Do not silently choose one value.

---

## 12. Existing experimental UI is not the research record

**FACT.** `lib/experimentalModel.ts` at parent main (blob `b041a44e37c6268e1d7ab4a9f9117ab0d27e2eeb`) remains UI-only pillar reweighting / Preview.

**CANDIDATE PROTOCOL DECISION.** H8 v2 does **not** use browser `localStorage` or UI state as scientific evidence.

**FIREWALL.** A later UI number is not an H8 observation.

---

## 13. Candidate H8 v2 scientific fingerprint

**FACT.** These identities are recorded at parent main `0abdc70a006cbab5b8f04a658a070812334b33b6`. This pass did **not** modify these files.

Do **not** yet call this collection the frozen H8 v2 scientific fingerprint. Call it:

```text
CANDIDATE H8 V2 SCIENTIFIC FINGERPRINT
```

until the protocol is independently reviewed and frozen.

H8 v2 must **not** reuse the old v1 factors tree `3921332c0decd56800e78580183931b718b9a345`.

Accepted post-Trend-repair factor identities:

| Path | Git SHA | Kind |
|---|---|---|
| `scripts/etl/factors/` | `163b086f72ec43117e8bfcbbe5fd31732dae715d` | tree |
| `scripts/etl/factors/trendValuation.mjs` | `3abf6f0611f86f58aca06c736d9baf41c7eb4ae9` | blob |
| `scripts/etl/lib/` | `64c73c01db27f1e6dbcd12d45d08c2f12bc47b12` | tree |

Individual production blobs:

| Path | Git blob SHA |
|---|---|
| `config/dashboard-config.json` | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` |
| `lib/config-loader.mjs` | `8f439254ca813050703a7c17bcd658474c19e2b2` |
| `scripts/etl/compute.mjs` | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` |
| `scripts/etl/factors.mjs` | `e9fd06df79967f0041a901e2dd971b771e669b03` |
| `scripts/etl/stalenessUtils.mjs` | `1c213b9b8eb659c9cda22d0834694ae3239eb768` |
| `scripts/etl/marketCalendar.mjs` | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` |
| `scripts/etl/adjustments.mjs` | `36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7` |
| `scripts/etl/coinGeckoCache.mjs` | `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff` |
| `scripts/etl/priceHistory.mjs` | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` |
| `scripts/etl/fetch-helper.mjs` | `da8ca2b441088f2e13364249e7ecbbed40dc22a4` |

A blob change inside `scripts/etl/factors/` or `scripts/etl/lib/` changes that tree SHA even if `factors.mjs` / `compute.mjs` themselves are unchanged.

Ordinary Daily ETL `public/**` artifact commits are **not** themselves scientific-fingerprint changes.

---

## 14. Start date — deliberately unassigned

**CANDIDATE PROTOCOL DECISION.** This is the major v2 sequencing change.

Do **not** select a calendar start date in this base protocol candidate.

Define:

```text
S = later-authorized H8 v2 UTC start date
```

`S` remains **UNASSIGNED** until all readiness requirements are satisfied.

The protocol freezes **window arithmetic** now without choosing `S`.

Observation opportunities:

```text
S through S + 179 calendar days inclusive
= exactly 180 UTC observation opportunities
```

Required BTC-close universe:

```text
S through S + 209 calendar days inclusive
```

because the final observation at `S+179` requires `MACE30` through:

```text
(S+179)+30 = S+209
```

Automatic close-recovery authorization ends:

```text
S + 217 calendar days
```

which provides eight additional UTC scheduled opportunities after the final required close date.

The exact derived calendar dates are populated only in the later start authorization.

**FIREWALL.** No start date is assigned in this candidate document.

### 14.1 Objective start-date selection

**CANDIDATE PROTOCOL DECISION.** `S` remains unassigned during protocol / implementation / rehearsal. Which future date becomes `S` is **not** discretionary.

Use the **first** successfully committed-and-pushed qualifying scheduled `NON_STUDY_REHEARSAL` as the objective anchor.

Define:

```text
R = UTC timestamp of that qualifying rehearsal's successfully pushed
    research commit
```

Independent review may **accept** or **reject** that rehearsal, but it may **not** substitute a later successful rehearsal merely because market conditions are preferable.

If the first qualifying rehearsal is rejected for a **documented operational or integrity defect**, it is disqualified and the next qualifying genuine scheduled rehearsal becomes `R`.

Once a rehearsal is independently accepted, derive `S` mechanically.

Frozen selection rule:

```text
start_selection_rule =
  earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1

S = the earliest UTC calendar date D whose nominal 11:00 UTC Daily ETL
    opportunity is at least 72 hours after R

S = min D such that:
      11:00 UTC on D  >=  R + 72 hours
  AND all start-readiness requirements remain satisfied
```

The 72-hour interval provides time for:

- independent rehearsal review
- creation / review of start authorization
- required pre-start merge lead time

The selection of `S` must **NOT** depend on:

- Bitcoin price
- G-Score
- factor values
- macro regime
- volatility
- ETF flows
- market direction
- analyst preference
- convenience
- expected future conditions

**FIREWALL.** Once `R` is accepted, `S` is mechanically derived.
**FIREWALL.** Researchers / operators may not voluntarily delay `S` to a later valid date because market conditions appear more or less favorable.

---

## 15. Start authorization record

**CANDIDATE PROTOCOL DECISION.** Define a later, separate scientific-control artifact:

```text
research/h8-v2-prospective/H8_V2_START.json
```

This file **DOES NOT exist** during protocol drafting or implementation / rehearsal.

### 15.1 One-shot immutability

**CANDIDATE PROTOCOL DECISION.** Exactly **one** accepted start-authorization artifact exists for an H8 v2 study.

It must be:

- created prospectively
- committed and pushed before study start
- never modified after merge
- never overwritten
- never deleted
- never rewritten to another `S`
- never amended with a new observation-end date
- never amended with a new close-end date
- never amended with a new recovery-end date

Once successfully merged and independently verified:

```text
H8_V2_START.json is immutable
H8_V2_START_SHA permanently identifies that authorization
```

If a merged `H8_V2_START.json` is later proven malformed, inconsistent, scientifically incompatible, or invalid under the frozen protocol:

```text
STOP BEFORE STUDY CAPTURE
```

Do **NOT** edit or replace that start file.

Require a **successor protocol / study** rather than rewriting the scientific start record.

The normal procedure must prevent invalid start authorization from merging in the first place.

### 15.2 Required content

The future start authorization must contain at minimum:

- `protocol_version`
- `protocol_sha`
- `capture_contract_version`
- `capture_contract_sha`
- `capture_source_sha`
- `scientific_fingerprint`
- `qualifying_rehearsal_path`
- `qualifying_rehearsal_commit_sha`
- `qualifying_rehearsal_run_id`
- `qualifying_rehearsal_utc`
- `start_selection_rule`
- `start_date_utc`
- `observation_end_date_utc`
- `required_close_end_date_utc`
- `recovery_end_date_utc`
- `authorization_created_utc`

`start_selection_rule` must identify the frozen deterministic rule:

```text
earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1
```

Exact JSON schema remains capture-contract work. The scientific requirements above are frozen here.

The start-authorization commit becomes `H8_V2_START_SHA` after independent verification.

The start authorization may **ONLY** be created after:

- protocol frozen and merged
- capture contract frozen and merged
- implementation accepted
- capture source identity assigned
- implementation merged
- H8 v2 identity preflight passing
- mandatory scheduled non-study rehearsal successfully committed and pushed
- rehearsal independently reviewed and accepted
- no known unresolved production-integrity defect affecting scientific capture
- `S` derived from accepted `R` by the frozen 72-hour rule

**FIREWALL.** No start authorization during this protocol-candidate pass.

---

## 16. Prospective start lead time and expired readiness

**CANDIDATE PROTOCOL DECISION.** Freeze a minimum lead-time rule.

The `H8_V2_START.json` authorization commit must be present on `main` at least **24 hours** before the nominal 11:00 UTC scheduled Daily ETL opportunity on `S`.

Equivalent:

```text
start_authorization_merge_time
  <=
11:00 UTC on calendar date S-1
```

**FIREWALL.** Do not silently shorten the lead time.

If the start authorization cannot be independently accepted and merged by:

```text
11:00 UTC on S-1
```

then that accepted rehearsal does **NOT** authorize a later discretionary `S`.

Instead:

```text
READINESS EXPIRES FOR THAT REHEARSAL
```

Require another genuine scheduled `NON_STUDY_REHEARSAL`.

The first later rehearsal that passes all requirements becomes the new `R`.

Then derive a new `S` mechanically using the same 72-hour rule.

**FIREWALL.** Do not convert a missed Monday authorization deadline into “just pick Thursday.”
**FIREWALL.** No arbitrary later `S` after readiness expires.

---

## 17. Mandatory real scheduled rehearsal

**CANDIDATE PROTOCOL DECISION.** This is the second major v2 correction.

Before `H8_V2_START.json` may exist, the **final accepted** H8 v2 capture machinery must survive at least one genuine **first-attempt scheduled Daily ETL** rehearsal.

The following do **NOT** qualify:

- `workflow_dispatch`
- rerun `attempt > 1`
- local execution
- API reconstruction
- a synthetic unit test
- an empty research manifest

The rehearsal must exercise the **real non-empty research commit/push path** that v1 failed to exercise before study start.

Future implementation / contract must support an explicitly authorized `NON_STUDY_REHEARSAL` artifact under a separate namespace such as:

```text
research/h8-v2-prospective/rehearsals/
```

The rehearsal artifact must be permanently labeled:

```text
NON_STUDY
NOT_AN_OBSERVATION
NOT_A_BTC_CLOSE
NOT_FOR_PERFORMANCE
```

It must contain **no** scientific model scores, no challenger scores, no MACE, no returns, no rank statistics, and no performance result.

It may contain operational provenance needed to prove the path worked, such as:

- scheduled run ID
- run attempt
- event name
- source checkout SHA
- protocol identity
- contract identity
- capture-source identity
- scientific-fingerprint hashes
- manifest / hash information
- escrow / commit / push success metadata

The rehearsal must traverse the same mechanism that real observations will use:

```text
capture artifact creation
→ escrow
→ production phase
→ research restore/stage
→ research commit
→ rebase/merge policy
→ research push
```

If a scheduled rehearsal opportunity never fires because GitHub's scheduler does not trigger it: **do not manually replace it**. Wait for another genuine scheduled opportunity.

### 17.1 First-qualifying rehearsal — no shopping

**CANDIDATE PROTOCOL DECISION.** The qualifying rehearsal is **not** chosen after inspecting several successful rehearsals.

The **FIRST** genuine first-attempt scheduled rehearsal that:

- uses the final accepted implementation
- creates a non-empty `NON_STUDY_REHEARSAL` artifact
- traverses escrow
- allows production to remain safe
- successfully stages / commits / pushes the research artifact
- passes identity checks

is the **candidate qualifying rehearsal**.

Independent review either:

```text
ACCEPTS it
```

or

```text
REJECTS it for a documented operational / integrity defect
```

It may **not** be rejected merely to wait for a more convenient start date.

If rejected, the next qualifying scheduled rehearsal is evaluated under the **same** rule.

**FIREWALL.** No rehearsal shopping.

---

## 18. Rehearsal data firewall

**CANDIDATE PROTOCOL DECISION.** Rehearsal artifacts can never become observations.

Do not:

- rename a rehearsal artifact into the observation namespace
- copy rehearsal data into an observation artifact
- infer an Official / challenger score from rehearsal metadata
- use rehearsal timing as the study start
- include rehearsal in `N`
- calculate MACE from rehearsal
- include rehearsal in performance analysis

Rehearsal success only proves machinery.

---

## 19. Scheduled observation authority

**CANDIDATE PROTOCOL DECISION.** Once H8 v2 is active, authorize score observation capture only when **all** of the following are true:

```text
github.event_name == 'schedule'
AND
github.run_attempt == 1
AND
H8_V2_START.json exists and passes identity validation
AND
actual UTC observation date is within S through S+179 inclusive
```

Never create score observations from:

- `workflow_dispatch`
- reruns
- local execution
- API / operator-triggered capture

**FIREWALL.** No override flag.
**FIREWALL.** No force flag.
**FIREWALL.** No backfill flag.

---

## 20. Observation date semantics

**CANDIDATE PROTOCOL DECISION.** Preserve the v1 rule.

The scientific observation date is the UTC calendar date of the **actual same-run observation timestamp**.

Do **not** infer the observation date from the intended cron date.

This matters because GitHub scheduled workflows can start many hours late.

If a scheduled run nominally associated with one cron opportunity actually executes after UTC midnight: use the actual UTC date of the observation timestamp.

Never rewrite another calendar day's artifact.

**FIREWALL.** Do not pretend the observation occurred exactly at 11:00 UTC if GitHub Actions started or completed late.

---

## 21. Scheduler misses

**CANDIDATE PROTOCOL DECISION.** Once the study has legitimately started:

Every UTC date `S` through `S+179` is an observation **opportunity**.

If no authorized first-attempt scheduled Daily ETL occurs on date `D`:

```text
D = CAPTURE_MISSING
```

Do **not**:

- create an observation file later
- manually substitute a `workflow_dispatch` run
- replay `D`
- reconstruct `D` from `public/data` history
- reconstruct challenger scores
- shift the observation window

The study continues to future fixed dates.

**IMPORTANT DIFFERENCE FROM THE V1 START-GATE FAILURE.**

A scheduler miss on `S` does **not** itself invalidate v2 if all readiness gates were completed before `S`.

The v1 failure was different: the infrastructure had not demonstrated a successful scientific commit path before the fixed study start.

V2 prevents that situation by refusing to assign `S` until **after** rehearsal.

---

## 22. Duplicate / late capture rule

**CANDIDATE PROTOCOL DECISION.** At most one immutable observation artifact may exist for one UTC date.

If one already exists: do not overwrite it.

If multiple authorized scheduled executions somehow occur on the same UTC date: the first successfully **committed and pushed** valid artifact wins. Later runs for that date produce no second observation.

A failed / ephemeral runner file is **not** an accepted observation.

Only successfully committed and pushed repository evidence is accepted.

---

## 23. Production must remain safe

**CANDIDATE PROTOCOL DECISION.** Preserve the key v1 operational separation.

H8 failure must never prevent normal GhostGauge production publication.

Production artifact commit and scientific research commit remain separate.

Research paths must never be staged in the production commit.

If H8:

- preflight fails
- capture fails
- escrow fails
- research commit fails
- research rebase fails
- research push fails

production should remain independently capable of landing.

An H8 failure must fail **CLOSED scientifically**, not fail production.

---

## 24. Failure after an observation was created locally

**CANDIDATE PROTOCOL DECISION.** Preserve this v1 lesson explicitly.

An observation or close that exists only on an ephemeral Actions runner is **NOT** accepted scientific evidence.

If the research commit / push fails: the artifact is not part of the accepted tape.

Do not recreate that score observation later.

The corresponding date remains `CAPTURE_MISSING` or the protocol's equivalent capture-failure classification.

Future close recovery may still operate according to the frozen close rules.

---

## 25. Scientific fingerprint change during study

**CANDIDATE PROTOCOL DECISION.** If any frozen SCIENTIFIC model-contract identity changes after H8 v2 starts:

```text
capture must STOP BEFORE WRITES
```

Do not silently continue using a changed model.
Do not redefine the fingerprint.
Do not mix pre-change and post-change scientific implementations inside the same fixed model experiment.

A scientific fingerprint change requires a successor study / protocol.

Production GhostGauge may continue changing independently if desired, but H8 v2 cannot treat changed scientific bytes as the same frozen model.

---

## 26. Capture-only infrastructure defect during study

**CANDIDATE PROTOCOL DECISION.** Distinguish scientific changes from operational capture changes.

A later capture-only defect **MAY** be eligible for a successor capture-contract version under the **SAME** v2 scientific protocol only if independent review proves:

- no scientific fingerprint byte changes
- no model formula changes
- no weights change
- no factor semantics change
- no eligibility-rule change
- no observation reconstruction
- no missed-date repair

Any dates missed during the outage remain permanently missing.

A successor capture implementation may only operate prospectively after its own acceptance / activation.

If compatibility cannot be proven: **STOP H8 v2** and require a successor study.

---

## 27. Immutable daily observation record

**CANDIDATE PROTOCOL DECISION.** H8 v2 must **not** rely on `public/data/history.csv` as its authoritative research record.

Proposed authoritative prospective score artifact:

```text
research/h8-v2-prospective/observations/YYYY-MM-DD.json
```

Exactly one file per UTC observation date.

Once created, committed, and pushed:

- **NEVER MODIFY IT**
- **NEVER OVERWRITE IT**
- **NEVER BACKFILL IT**

Each created observation file should eventually contain at least:

- `study_id`
- `protocol_version`
- `observation_date`
- `scheduled_event = DAILY_ETL`
- `observation_as_of_utc`
- `capture_created_utc`
- production model / implementation / ssot versions
- scientific-fingerprint identities
- `source_base_git_sha`
- `h8_v2_capture_source_sha`
- operational provenance (`github_run_id`, `github_run_attempt`, `github_event_name`, preferably `github_workflow_ref` and `github_sha`)
- `common_eligibility_status`
- `eligibility_reason`
- required seven-factor snapshot, subject to the score-presence rules below
- model version identifiers and frozen weight definitions, or an immutable reference to them

Production snapshot BTC price may be captured for provenance. It is **not** the H8 primary MACE baseline.

**FIREWALL.** Do not include future outcome data in an observation artifact.

### 27.1 Score presence by observation status

**CANDIDATE PROTOCOL DECISION.** Scientific score fields are populated according to Axis A status. Exact JSON null-versus-absent encoding remains a later frozen schema, but the scientific presence rules are:

**ELIGIBLE**

- seven-factor snapshot recorded
- `official_published_score` recorded
- `official_formula_score` recorded
- `liq_heavy_score` recorded
- `mom_tilted_score` recorded
- all three research scores are valid for later analysis subject to Axis B outcome completeness

**NOT_ELIGIBLE**

- factor snapshot and eligibility reason recorded
- no H8 scientific model score may be calculated using stale / missing / invalid factors
- `official_formula_score` = null / absent according to later frozen schema
- `liq_heavy_score` = null / absent
- `mom_tilted_score` = null / absent
- production published composite may be retained only as provenance if the later contract chooses, but it is **not** an H8 scientific score

**INTEGRITY_MISMATCH**

- factor snapshot recorded
- `official_published_score` recorded
- independently recomputed `official_formula_score` recorded so the mismatch is auditable
- date excluded permanently from H8 scientific analysis
- challenger scientific scores (`liq_heavy_score`, `mom_tilted_score`) are null / absent because the observation is not eligible for H8 scientific analysis

**CAPTURE_MISSING**

- no observation artifact is created after the fact
- final accounting comes from the frozen opportunity ledger / analysis accounting, not reconstructed scores

The common seven-factor eligibility gate itself is unchanged.

**IMPLEMENTATION DETAIL.** Exact JSON key names / schema remain a later capture-implementation contract.

---

## 28. Prospective BTC close tape

**CANDIDATE PROTOCOL DECISION.** Preserve the prospective immutable close-tape design.

Required close universe:

```text
S through S+209 inclusive
```

One immutable artifact per UTC close date under:

```text
research/h8-v2-prospective/btc-closes/YYYY-MM-DD.json
```

Capture only completed UTC daily closes.

No open / intraday price.

No post-`S+209` close may enter `MACE30`.

BTC close capture remains authorized **only** during:

```text
github.event_name == 'schedule' && github.run_attempt == 1
```

and only after `H8_V2_START.json` exists.

Automatic deterministic catch-up may run only on authorized first-attempt scheduled ETLs.

For run date `T`, consider missing required dates:

```text
d <= T-1
```

in ascending order, where:

```text
S <= d <= S+209
AND
research/h8-v2-prospective/btc-closes/d.json does not already exist
AND
UTC run-date T <= S+217
```

First valid authorized completed close permanently wins.

If the source row for `d` is absent or invalid: leave a gap. Later authorized scheduled catch-up may retry until `T <= S+217`.

After recovery end: remaining gaps are permanent.

**FIREWALL.** No manual close backfill.
**FIREWALL.** No `workflow_dispatch` close recovery.
**FIREWALL.** No rerun close recovery.
**FIREWALL.** No operator-selected close.

Once a close artifact exists: never overwrite, revise, replace, or synchronize it to a later production history revision.

---

## 29. Primary scientific question

**CANDIDATE PROTOCOL DECISION.**

PRIMARY QUESTION:

> Within the frozen H8 v2 prospective holdout, is higher forward-captured Official G-Score associated with greater subsequent Bitcoin downside over 30 UTC calendar days?

```text
class             = prospective descriptive risk discrimination
PRIMARY MODEL     = Official v1.1.1
PRIMARY OUTCOME   = MACE30
PRIMARY STATISTIC = Spearman(Official G-Score, MACE30)
```

Expected direction:

```text
higher Official G-Score
  -> larger subsequent MACE
  -> rho > 0
```

This mirrors the H7.2 / H8 v1 PRIMARY question prospectively.

---

## 30. Primary outcome definition

**CANDIDATE PROTOCOL DECISION.** Preserve H7.2 / H8 v1 `MACE30` exactly.

For observation date `D`:

```text
MACE30 =
  1 - min(C_D, C_D+1, ..., C_D+30) / C_D
```

where all `C` values are completed UTC daily closes.

The window contains:

```text
31 closes
30 forward intervals
```

Primary outcome only: `MACE30`.

**FIREWALL.** No `MACE90`.
**FIREWALL.** No `MACE180`.
**FIREWALL.** No return target.
**FIREWALL.** No new outcome selected after study begins.

Close-only. No intraday low. No terminal forward return. No reconstruction-time or observation-time snapshot price as primary baseline.

**LIMITATION.** Close-only MACE is not true intraday maximum adverse excursion.

---

## 31. Primary analysis

**CANDIDATE PROTOCOL DECISION.**

Primary:

```text
Spearman(Official score, MACE30)
```

using only observations whose Axis A status is `ELIGIBLE` **and** whose Axis B status is `OUTCOME_COMPLETE`.

Secondary:

```text
Spearman(Liq-Heavy score, MACE30)
Spearman(Mom-Tilted score, MACE30)
```

Descriptive secondary comparison may report:

```text
challenger rho - Official rho
```

**FIREWALL.** No p-values.
**FIREWALL.** No confidence intervals.
**FIREWALL.** No significance claims.
**FIREWALL.** No multiple-testing adjustment.
**FIREWALL.** No model promotion rule.
**FIREWALL.** No threshold optimization.

If either vector has zero variance:

```text
rho = null
```

Spearman convention remains the H7.2 / H8 v1 convention: independently rank, 1-based conceptual ranks, arithmetic mean occupied rank for ties, Pearson correlation of rank vectors, unrounded internal arithmetic.

---

## 32. No interim performance

**CANDIDATE PROTOCOL DECISION.** Absolute firewall.

Before final analysis authorization, do **NOT** calculate or expose:

- interim `MACE30`
- interim Spearman rho
- model rankings
- challenger delta-rho
- rolling performance
- subset performance
- "how H8 is doing"
- early winner
- early loser

Do not calculate performance even after individual 30-day outcomes mature.

**FIREWALL.** No peeking.

Operational integrity monitoring **is** allowed (file exists, hash valid, statuses, missing counts, schema validity) provided it does not join scores to future outcomes for performance analysis.

---

## 33. Analysis start gate

**CANDIDATE PROTOCOL DECISION.** No final H8 v2 analysis until **ALL** are true:

- observation window `S` through `S+179` is closed
- required close date `S+209` has passed
- automatic recovery window through `S+217` is complete
- observation tape is frozen
- BTC-close tape is frozen
- capture / rehearsal artifacts are clearly separated
- scientific identity has been independently verified
- all permanent missingness classifications are finalized
- no unresolved integrity mismatch exists
- analysis implementation is separately reviewed

Only then may outcome / performance analysis begin.

**FIREWALL.** Do not postpone analysis indefinitely trying to obtain missing close values.
**FIREWALL.** Do not reconstruct the entire outcome tape from a later moving file.
**FIREWALL.** Do not extend the 180 observation dates.
**FIREWALL.** Do not add post-`S+209` closes to MACE.

---

## 34. Two-axis missingness accounting

**CANDIDATE PROTOCOL DECISION.** Final reporting uses **two separate dimensions**. Do not place outcome-completeness beside capture / eligibility as if they were one mutually exclusive list.

### 34.1 Axis A — observation / capture status

Every one of the **180** observation opportunities must have exactly **ONE** mutually exclusive final observation status:

```text
ELIGIBLE
NOT_ELIGIBLE
INTEGRITY_MISMATCH
CAPTURE_MISSING
```

These four primary-status counts **MUST** reconcile exactly to:

```text
ELIGIBLE
+ NOT_ELIGIBLE
+ INTEGRITY_MISMATCH
+ CAPTURE_MISSING
= 180
```

If useful, `CAPTURE_MISSING` may have non-scientific reason codes such as:

```text
scheduler_did_not_fire
capture_failed
escrow_failed
research_commit_failed
research_push_failed
```

Those remain **subreasons under `CAPTURE_MISSING`**. They are not additional top-level Axis A categories.

**FIREWALL.** Do not create overlapping top-level Axis A categories.

### 34.2 Axis B — outcome completeness

Only observations whose Axis A status is `ELIGIBLE` receive an outcome-completeness classification after the close tape freezes:

```text
OUTCOME_COMPLETE
OUTCOME_INCOMPLETE
```

Require:

```text
OUTCOME_COMPLETE + OUTCOME_INCOMPLETE
= ELIGIBLE
```

Primary analysis `N` is:

```text
ELIGIBLE observations
AND
OUTCOME_COMPLETE
```

`OUTCOME_INCOMPLETE` does **NOT** replace the underlying `ELIGIBLE` observation status.

It is a second-axis outcome status.

**FIREWALL.** No silent dropping of missing dates.
**FIREWALL.** Do not count `OUTCOME_INCOMPLETE` toward the 180 Axis A total as a fifth capture status.

---

## 35. Result language and governance

**CANDIDATE PROTOCOL DECISION.** For Official PRIMARY:

| rho | label |
|---|---|
| `rho > 0` | `DIRECTIONALLY_ALIGNED_WITH_H7_2_PRIMARY` |
| `rho = 0` | `NO_DIRECTIONAL_ASSOCIATION` |
| `rho < 0` | `DIRECTIONALLY_OPPOSED_TO_H7_2_PRIMARY` |
| undefined / null | `UNDEFINED` |

Always report exact rho and `N`.

**FIREWALL.** Do **not** translate into `VALIDATED`, `INVALIDATED`, `PROVEN`, `FAILED`, `PREDICTIVE`, or `STATISTICALLY SIGNIFICANT`.

For challengers: report exact rho and exact delta vs Official.

**FIREWALL.** Do not use `WINNER`, `LOSER`, or `BEST MODEL`.

Official v1.1.1 remains production Champion throughout H8 v2 unless an external operational necessity requires otherwise. Liq-Heavy and Mom-Tilted remain research Challengers. H8 v2 itself cannot change Official weights, promote a challenger, create Official v2, or create another challenger.

---

## 36. Limitations

**LIMITATION.**

- descriptive rank association only
- overlapping 30-day outcome windows
- serial dependence
- finite sample
- common market regime exposure
- missing scheduled observations possible
- outcome censoring / incompleteness possible
- not calibration
- not causality
- not trading-rule validation
- not proof of prediction

---

## 37. August 27 scheduler event — context only

**FACT / OPERATIONAL CONTEXT.** GitHub scheduler behavior can be materially delayed.

Observed operational example (not scientific data):

```text
Bundle Size Tracking cron = 02:00 UTC
2026-08-27 actual scheduled start ≈ 12:16 UTC
delay ≈ 10 hours 16 minutes

Daily ETL cron = 11:00 UTC
had not attempted by approximately 13:40 UTC on 2026-08-27
```

This is operational context supporting:

- strict actual-date observation semantics
- `CAPTURE_MISSING` / no-backfill rules
- refusal to treat a missed scheduled fire as something that can be repaired by `workflow_dispatch`

**FIREWALL.** Do not make this incident an observation.
**FIREWALL.** Do not use it as scientific data.

---

## 38. V1 → V2 explicit change log

H8 v2 is scientifically equivalent to H8 v1 except for the following identified changes:

1. **Distinct v2 namespace.** Protocol version `h8-prospective-three-model-v2`. Study namespace `h8-v2-prospective`. Research path `research/h8-v2-prospective/`. Do not reuse `research/h8-prospective/`.

2. **Updated candidate scientific fingerprint.** Reflects the accepted Trend factor-cache removal. Candidate factors tree `163b086f72ec43117e8bfcbbe5fd31732dae715d`. Trend blob `3abf6f0611f86f58aca06c736d9baf41c7eb4ae9`. Trend is computed fresh each ETL invocation because the current BTC snapshot participates in scoring.

3. **Start date is NOT frozen in the base protocol.** `S` remains `UNASSIGNED` here.

4. **Start date is assigned later** through an independently frozen prospective `research/h8-v2-prospective/H8_V2_START.json` authorization, with derived window dates populated only then.

5. **Deterministic rehearsal-anchored start-date selection.** The first independently accepted qualifying scheduled `NON_STUDY_REHEARSAL` defines `R`. `S` is the earliest UTC date `D` whose nominal 11:00 UTC Daily ETL opportunity is at least 72 hours after `R`. No market-based or convenience-based discretion. These are candidate repairs made **before** protocol freeze, not post-hoc changes after freeze.

6. **No discretionary start delay.** Once `R` is accepted, researchers may not voluntarily choose a later valid `S`. If start authorization is not merged by 11:00 UTC on `S-1`, readiness expires for that rehearsal and another genuine scheduled rehearsal is required.

7. **Immutable one-shot `H8_V2_START.json`.** Exactly one accepted start-authorization artifact. Never modified, overwritten, deleted, or rewritten after merge. `H8_V2_START_SHA` is permanent. A malformed merged authorization cannot be repaired in place; a successor study is required.

8. **Mandatory successful genuine scheduled `NON_STUDY_REHEARSAL`** before start authorization. The first qualifying successful scheduled rehearsal is evaluated. Independent review accepts or rejects only on operational / integrity grounds. No rehearsal shopping.

9. **Rehearsal must exercise a non-empty research commit/push path.** Unit tests, empty manifests, `workflow_dispatch`, reruns, and local runs do not qualify.

10. **A scheduler miss on the first authorized observation date does not invalidate the study** if all readiness gates were satisfied before `S`. That date remains `CAPTURE_MISSING`.

11. **Missed scheduled observations remain `CAPTURE_MISSING` and are never reconstructed.**

12. **Two-axis missingness / outcome accounting.** Axis A (`ELIGIBLE` / `NOT_ELIGIBLE` / `INTEGRITY_MISMATCH` / `CAPTURE_MISSING`) sums to 180. Axis B (`OUTCOME_COMPLETE` / `OUTCOME_INCOMPLETE`) applies only to `ELIGIBLE` and sums to `ELIGIBLE`. Analysis `N` is `ELIGIBLE` and `OUTCOME_COMPLETE` only.

13. **Capture-only compatibility repairs** may use an independently reviewed successor capture contract without changing the frozen scientific model, but missing dates remain missing. If scientific compatibility cannot be proven, stop and require a successor study.

Everything else remains scientifically equivalent to v1 unless this candidate explicitly identifies and justifies a change.

---

## 39. What this candidate pass does and does not do

The candidate branch modifies **only**:

```text
docs/H8_V2_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md
```

This repair-before-freeze revision tightens start-date selection, start-authorization immutability, two-axis missingness, and score-presence rules. It does **not** change model math.

It does **not**:

- freeze the protocol
- assign `H8_V2_PROTOCOL_SHA` / capture-contract SHA / capture-source SHA / start SHA
- choose `S`
- create `H8_V2_START.json`
- create or modify capture implementation
- edit `.github/workflows/daily-etl.yml`
- edit `scripts/research/capture-h8-prospective.mjs` or H8 v1 capture libraries
- modify H8 v1 protocol, contract, or stop-record documents
- recreate the v1 activation sidecar
- create observations, closes, or rehearsals
- calculate MACE, Spearman, or any performance statistic
- tune weights
- reopen calibration

The capture implementation contract is the **next** phase after this protocol is independently reviewed and frozen.

---

## 40. Stop

**STOP FOR INDEPENDENT REPAIRED H8 V2 PROTOCOL REVIEW.**

Do not implement capture machinery in this pass.
Do not select a study start date in this pass.
Do not reactivate H8 v1.
Do not calculate performance.
Do not merge this candidate until independent scientific review accepts it.
