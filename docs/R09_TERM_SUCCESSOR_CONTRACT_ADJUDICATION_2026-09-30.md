# R09-C Term successor contract adjudication — 2026-09-30

Documentation / governance only.

This record freezes the human **R09-C-B** adjudication resulting from the
official clean R09-C LIVE Term successor feasibility diagnostic.

It records:

- authoritative live provider evidence after PR #85 epoch-pagination repair;
- the frozen successor semantic contract (decisions C1–C13);
- Binance HTTP 451 as acquisition unavailability, not scientific history
  insufficiency;
- scientific materiality and the deferred production/version boundary.

It does **not** activate production repair.

It does **not** change Daily ETL, `scripts/etl/factors.mjs`,
`scripts/etl/lib/termFreshness.mjs`, Term scoring, Term cache semantics,
`public/data/**`, `config/**`, model identity, SSOT, weights, subweights,
Stress coefficients, G-Score bands, workflows, H8, R07, R01/R08, R03, or any
production behavior.

Status labels used below:

- **COMPLETE / PASS** — evidence lane finished; supports freezing the contract.
- **SELECTED AS SUCCESSOR** — frozen future implementation direction. Not active in production.
- **REJECTED AS SUCCESSOR** — must not be used as the future production contract.
- **FROZEN** — adjudication decision locked for successor design/implementation.
- **SUPERSEDED** — historical run retained but not authoritative for named conclusions.
- **NOT ACTIVATED** — production change remains unauthorized.
- **SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE** — future activation requires a new model/implementation era; exact IDs deferred.
- **SOURCE_ACQUISITION_UNAVAILABLE** — required evidence could not be acquired in this runtime; not a measured history depth.

---

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| Funding 30-day boundary | SELECTED AS SUCCESSOR | `F30_HALF_OPEN` = `(T - 30 days, T]` |
| Funding aggregation | SELECTED AS SUCCESSOR | `DAILY_MEAN_THEN_30D_MEAN` |
| Volatility window | SELECTED AS SUCCESSOR | `V30_30_RETURNS` (31 prices / 30 returns) |
| Common cutoff | FROZEN | `TERM_COMMON_CUTOFF_DATE_V1` |
| Reference depth | FROZEN | `TERM_REFERENCE_60_V1` — 60 prior valid windows |
| Two-gate provider eligibility | FROZEN | Gate 1 (PR #56) + Gate 2 (successor history) |
| Funding COMPLETE-day contract | FROZEN | Stable cadence segment; exact expected slots |
| Duplicate funding rule | FROZEN | Exact duplicates collapsible; conflicting unresolved |
| CoinGecko completed daily | FROZEN | `CG_COMPLETED_UTC_DAILY_V1` midnight-only |
| Stress contract | FROZEN | Exact dates `D-29…D`; prices `D-30…D`; existing coefficients |
| Source fingerprint | FROZEN | Exact score-relevant Funding+Vol+Stress evidence union |
| `lastUpdated` | FROZEN | Min of required Funding / Stress-funding / spot legs |
| Fail-closed unavailability | FROZEN | No neutral defaults; no silent shortening |
| Binance HTTP 451 | SOURCE_ACQUISITION_UNAVAILABLE | Not zero history; not `HISTORY_INSUFFICIENT` from this evidence |
| Scientific materiality | SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE | Not a bug-only patch |
| Production activation | NOT ACTIVATED | Exact model/implementation IDs deferred |

Official Term weights remain unchanged (funding `0.40` / realized_vol `0.35` /
stress `0.25`; Term factor weight `0.20`). R09 does **not** tune factor weight,
component weights, percentile risk transform, or Stress formula coefficients.

---

## 2. Authoritative R09-C LIVE feasibility evidence

| Field | Value |
|---|---|
| Workflow run | `36772269855` |
| Workflow | R09 Term successor feasibility diagnostic |
| Run number | `2` |
| Repository SHA | `51f52c0076e252c27e6567f08b6de6a0a7cc73d6` |
| Artifact ID | `11124202466` |
| Artifact ZIP SHA-256 | `11533881535363e7584f240aa5a91f3613349d79f3a9e253f48d9c1869b221b1` |
| Extracted report SHA-256 | `105ee79f78423019bf03b12e45ebb7a3b01e04fdf00aa37294fe6ca74be89ab0` |
| Schema | `ghostgauge_r09_term_successor_feasibility_v1` |
| Mode | `LIVE_READ_ONLY` |
| Production authorization | `false` |
| Adjudication role | **AUTHORITATIVE R09-C LIVE FEASIBILITY EVIDENCE** |

### Run integrity

- Live read-only diagnostic against repository SHA `51f52c00…`
- Schema `ghostgauge_r09_term_successor_feasibility_v1`
- Production change: not authorized
- Repository / public-data writes: none (per diagnostic contract)
- Predictive / H8 tuning data: not used for adjudication

---

## 3. Superseded diagnostic run

| Field | Value |
|---|---|
| Workflow run | `36767806523` |
| Adjudication label | `SUPERSEDED_FOR_HISTORY_CAPACITY_BY_RUN_36772269855` |
| Reason | OKX history-depth conclusions invalidated after PR #85 proved and repaired numeric epoch pagination bounds (`pageTimestampBounds` used `Date.parse` on numeric / numeric-string `fundingTime`) |
| Historical record | **Retained** — do not delete |
| Use for history-capacity adjudication | **No** |

Run `36767806523` remains a historical diagnostic record. Its OKX
history-depth result is **INVALIDATED** for adjudication. Prefer run
`36772269855` for all provider history-capacity conclusions.

---

## 4. R09-C-A disposition

| Item | Status |
|---|---|
| R09-C-A | **COMPLETE / PASS** |
| Diagnostic implementation | **ADEQUATE FOR ADJUDICATION** |
| Run `36772269855` | **AUTHORITATIVE R09-C LIVE FEASIBILITY EVIDENCE** |
| Run `36767806523` | **SUPERSEDED FOR PROVIDER HISTORY-CAPACITY CONCLUSIONS** |
| Production repair | **NOT ACTIVATED** |

---

## 5. Live provider evidence (run 36772269855)

### 5.1 BitMEX

| Field | Value |
|---|---|
| Usable rows | 1,500 |
| Pages | 3 |
| Pagination termination | `MAX_CONFIGURED_PAGES_REACHED` |
| Earliest usable | `2025-05-04T20:00:00.000Z` |
| Latest usable | `2026-09-16T12:00:00.000Z` |
| Elapsed coverage | ~499.67 days |
| Gate 1 | FAIL / STALE |
| Gate 2 | PASS |
| Funding max prior depth | 469 |
| Stress max prior depth | 154 |
| Volatility-at-D max prior depth | 154 |
| Provider-specific common depth | 154 |
| `REFERENCE_60` feasible | YES |

### 5.2 Binance

| Field | Value |
|---|---|
| GitHub-runner request | HTTP 451 |
| Provider semantic status | `HTTP_ERROR` |
| Pagination termination | `HTTP_ERROR` |
| Historical capacity | **UNMEASURED** |
| Classification | `SOURCE_ACQUISITION_UNAVAILABLE` |

Do **NOT** record Binance as zero historical capacity.

Do **NOT** classify Binance as `HISTORY_INSUFFICIENT` from this evidence.

Source acquisition was unavailable in this runner; capacity was not measured.

### 5.3 OKX

| Field | Value |
|---|---|
| Usable rows | 281 |
| Requests / row counts | 4 requests: 100, 100, 81, 0 |
| Pagination termination | `PROVIDER_HISTORY_EXHAUSTED` |
| Pagination stall | none |
| Unresolved timestamp bounds | none |
| Earliest usable | `2026-06-29T08:00:00.000Z` |
| Latest usable | `2026-09-30T16:00:00.000Z` |
| Coverage | ~93.33 days |
| Observed cadence | one stable 8-hour segment |
| Observed UTC phases | 00 / 08 / 16 |
| Complete funding days | 93 |
| Gate 1 | PASS / FRESH |
| Gate 2 | PASS |
| Selected under two-gate concept | YES |
| Funding max prior depth | 62 |
| Stress max prior depth | 62 |
| Volatility-at-D max prior depth | 168 |
| Provider-specific common depth | 62 |
| `REFERENCE_60` feasible | YES |

### 5.4 CoinGecko

| Field | Value |
|---|---|
| Request interval | explicit `interval=daily` |
| Eligible completed daily rows | 199 |
| Eligible timestamps | all exact `00:00` UTC |
| Missing dates | none |
| Duplicate dates | none |
| Longest consecutive completed run | 199 |
| Terminal / current-day row | excluded |
| Latest score-eligible completed date | `2026-09-29` |

---

## 6. Max-depth interpretation

Diagnostic maxima from the authoritative clean run:

| Provider / source | Maxima |
|---|---|
| BitMEX provider-specific common depth | 154 |
| OKX provider-specific common depth | 62 |
| Binance | **UNMEASURED** due HTTP 451 |
| CoinGecko completed-daily capacity | 199 rows |

Do **NOT** treat report field

`max_common_live_reference_depth = 0`

as a scientific recommendation for reference depth.

That zero results from the literal all-provider minimum including an unavailable
Binance acquisition. Freeze reference depth from the **predeclared candidate +
selected-provider feasibility**, not from that global zero field.

---

## 7. Human adjudication — frozen decisions C1–C13

### DECISION C1 — Funding 30-day boundary

**SELECTED AS SUCCESSOR:** `F30_HALF_OPEN`

Definition:

`(T - 30 days, T]`

where `T` is the latest eligible funding settlement at or before common cutoff
`D`.

Reason:

- exact elapsed 30-day interval;
- avoids double-counting both interval endpoints;
- live stable 8-hour evidence yields 90 settlements;
- `F30_ENDPOINT_SPAN` yields 91 when an exact left-boundary settlement exists.

**REJECTED AS SUCCESSOR:** `F30_ENDPOINT_SPAN` as the successor canonical
boundary.

---

### DECISION C2 — Funding aggregation

**SELECTED AS SUCCESSOR:** `DAILY_MEAN_THEN_30D_MEAN`

Definition:

1. construct COMPLETE UTC-date funding means;
2. average the 30 daily means in the canonical current/reference window.

Reason:

- equal calendar-day weighting;
- same horizon semantics current/reference;
- robust to separately established cadence segments;
- aligns conceptually with the selected daily Stress funding surface.

Live evidence with constant 3 settlements/day produced effectively identical
values to settlement-level averaging. This is a **semantic design choice**, not
outcome optimization.

**REJECTED** as canonical successor aggregation: `SETTLEMENT_MEAN_30D`

Retain `SETTLEMENT_MEAN_30D` only as a diagnostic comparator if useful.

---

### DECISION C3 — Volatility window

**SELECTED AS SUCCESSOR:** `V30_30_RETURNS`

Definition:

- 31 consecutive completed daily prices;
- 30 simple daily returns;
- `RMS(simple returns) * 100`.

Reason: 30 returns represent the full 30 daily return intervals.

**REJECTED AS SUCCESSOR:** `V30_30_PRICES` (creates only 29 returns).

---

### DECISION C4 — Common cutoff

**FROZEN:** `TERM_COMMON_CUTOFF_DATE_V1`

`D` = latest UTC date satisfying:

- selected provider COMPLETE funding date;
- eligible completed CoinGecko daily date;
- `D` strictly before current as-of UTC date.

All current Term components are evaluated at the same `D`.

Live clean-run selected-provider `D`: **`2026-09-29`**.

No component may silently use a later date.

---

### DECISION C5 — Reference depth

**FROZEN:** `TERM_REFERENCE_60_V1`

Exact reference depth: **60 PRIOR VALID WINDOWS**.

Rules:

- current window excluded;
- all reference endpoints strictly earlier than current `D`;
- identical semantics/horizon current and reference;
- no outcome-based selection;
- no automatic shortening if fewer than 60 exist;
- fewer than 60 valid prior windows ⇒ component/provider ineligible.

Evidence:

- candidate depth 60 was predeclared before live evidence;
- OKX selected provider supports 62 valid prior Funding and Stress windows;
- BitMEX supports substantially more;
- CoinGecko supports required Volatility history;
- Binance historical capacity was unmeasured due HTTP 451 and must not be
  mislabeled zero.

**Explicit statement:**

60 is **NOT** frozen because it maximizes available history.

It is the **preregistered feasibility candidate** that passed on the selected
live provider without predictive/outcome tuning.

---

### DECISION C6 — Two-gate provider eligibility

**FROZEN** formal Gate 2.

Preserve provider preference:

**BitMEX → Binance → OKX**

| Gate | Contract |
|---|---|
| Gate 1 | PR #56 freshness/cadence eligibility |
| Gate 2 | Successor semantic/history eligibility sufficient to construct canonical current Funding window, 60 valid Funding references, canonical Volatility current/reference set, aligned current Stress window, 60 valid Stress references, and required fingerprint/provenance evidence |

A provider that passes Gate 1 but fails Gate 2 becomes **`HISTORY_INSUFFICIENT`**
and selection falls through to the next provider.

A provider whose history cannot be measured due acquisition error does **NOT**
pass Gate 2.

No cross-provider history splicing.

**Important:**

Do **NOT** require every named provider to prove 60-window capacity in every
runtime environment before the contract can exist.

An **accepted provider** is a provider that passes **BOTH** gates at runtime.

Therefore Binance HTTP 451 is an **acquisition limitation**, not evidence that
60-window history is scientifically insufficient.

---

### DECISION C7 — Funding COMPLETE-day contract

A funding UTC date is **COMPLETE** only if:

- it belongs to a mechanically established STABLE cadence/phase segment;
- every expected settlement slot for that segment exists exactly once;
- all included rates are finite;
- no conflicting duplicate exists.

Classifications:

- `COMPLETE_DAY`
- `INCOMPLETE_DAY`
- `CADENCE_AMBIGUOUS_DAY`
- `CONFLICTING_DAY`
- `NO_DATA`

Required current/reference windows must contain all required consecutive
COMPLETE days.

No fill. No interpolation. No nearest settlement. No silent shortened horizon.

---

### DECISION C8 — Duplicate funding rule

**FROZEN**

`EXACT_DUPLICATE` =
same provider + same source timestamp + same normalized funding rate.

May be deterministically collapsed to one scoring observation **ONLY IF**:

- duplicate condition is explicitly recorded in provenance/fingerprint semantics;
- collapse is deterministic;
- no conflicting values exist.

`CONFLICTING_DUPLICATE` =
same provider + same source timestamp + differing normalized funding rates.

Must **NOT** be automatically resolved.

Affected required day/window is unavailable.

No arbitrary first/last winner.

---

### DECISION C9 — CoinGecko completed daily contract

**FROZEN:** `CG_COMPLETED_UTC_DAILY_V1`

Eligible spot row requires:

- finite numeric price;
- unambiguous UTC date;
- exact `00:00:00.000` UTC timestamp;
- unique UTC date;
- UTC date strictly before as-of UTC date.

Exclude:

- current-day row;
- intraday terminal row;
- prior-date non-midnight row;
- duplicate-date ambiguity;
- non-finite price.

No synthetic daily close.

---

### DECISION C10 — Stress contract

**FROZEN** current Stress date construction.

Current Stress endpoint: `D`

Dates: **`D-29` through `D` inclusive**

Require exactly:

- 30 consecutive COMPLETE funding daily means;
- 30 consecutive spot returns;
- exact matching UTC dates.

A spot return for date `d` is:

`price[d] / price[d-1] - 1`

Therefore price evidence required is: **`D-30` through `D`**.

Preserve existing coefficients:

```
(abs(mean(funding_daily_30d)) * 10)
+
(RMS(spot_returns_30d) * 100 * 0.1)
```

No coefficient tuning.

No nearest-date join. No fill. No interpolation. No synthetic reconstruction.

---

### DECISION C11 — Source fingerprint

**FROZEN** candidate fingerprint architecture.

Contract identity candidate: `TERM_SUCCESSOR_SEMANTICS_V1`

Exact production-facing identifier may be assigned at implementation freeze;
**semantic content below is frozen now**.

Fingerprint includes:

- selected funding provider;
- exact score-relevant funding rows used by Funding and Stress:
  current + all 60 reference windows;
- exact score-relevant CoinGecko rows used by Volatility and Stress:
  current + all 60 reference windows;
- funding boundary semantic ID;
- funding aggregation semantic ID;
- CoinGecko eligibility semantic ID;
- Volatility window semantic ID;
- Stress alignment semantic ID;
- reference depth = 60;
- Term component-weight contract.

Serialization:

- deterministic versioned object;
- deterministic key order;
- chronological arrays;
- SHA-256.

Exclude:

- acquisition timestamp;
- cache timestamp;
- wall-clock now;
- unrelated fetched history.

Provider identity change invalidates fingerprint.

---

### DECISION C12 — `lastUpdated`

**FROZEN**

Term `lastUpdated` =
oldest/minimum latest **REQUIRED** score-eligible source observation among:

- Funding component funding evidence;
- Stress funding evidence;
- Volatility/Stress spot evidence.

Never use:

- acquisition timestamp;
- cache timestamp;
- wall clock;
- synthetic midnight.

Live selected-provider clean-run example:

| Leg | Timestamp |
|---|---|
| Funding used | `2026-09-29T16:00:00.000Z` |
| Stress funding used | `2026-09-29T16:00:00.000Z` |
| Spot used | `2026-09-29T00:00:00.000Z` |
| **Binding `lastUpdated`** | **`2026-09-29T00:00:00.000Z`** |

---

### DECISION C13 — Unavailability / fail-closed

**FROZEN**

No neutral defaults.

No silent horizon shortening.

No stale or partial cache masquerading as current data.

Whole Term unavailable if a **REQUIRED** current/reference evidence contract
fails, including:

- no provider passes Gate 1 + Gate 2;
- insufficient current funding history;
- fewer than 60 valid references;
- conflicting funding duplicate in required evidence;
- incomplete/ambiguous required funding day;
- missing/non-finite completed spot evidence;
- insufficient spot history;
- Stress intersection < 30 consecutive exact dates;
- fingerprint mismatch;
- stale required cache evidence.

Current-day/intraday CoinGecko raw evidence alone does **NOT** force
unavailability when the prior completed common cutoff `D` remains fully valid.

Provider switch requires fresh selection and fingerprint identity change.

---

## 8. Binance 451 interpretation

**FROZEN** adjudication:

GitHub-runner HTTP 451 is:

**`SOURCE_ACQUISITION_UNAVAILABLE`**

It is **NOT** evidence of:

- zero provider history;
- `REFERENCE_60` infeasibility;
- insufficient provider retention.

Therefore:

- Binance cannot pass Gate 2 in a runtime where required evidence cannot be
  acquired;
- selection falls through to the next provider;
- no history may be reconstructed from another provider;
- no cross-provider splicing.

Do not attempt outcome-based workarounds.

---

## 9. Materiality

**FROZEN:** R09 successor semantics are **SCIENTIFICALLY MATERIAL**.

Do not describe as a bug-only patch.

Reasons include:

- Funding horizon changes from row-count semantics to elapsed-window semantics;
- Funding current/reference aggregation becomes same-horizon daily semantics;
- Volatility horizon changes;
- Stress alignment changes from positional to exact calendar date;
- source eligibility/finality changes;
- provider selection gains history Gate 2;
- cache identity becomes complete source fingerprint;
- fail-closed behavior changes.

---

## 10. Version / production boundary

Remain deferred:

- exact successor `model_version`;
- exact successor `implementation_revision`;
- coordinated model-era boundary;
- production activation date.

Do **NOT** activate production.

Do **NOT** change:

- production weights;
- component weights;
- Stress coefficients;
- G-Score bands;
- any other factor semantics.

Those occur only in the later coordinated architecture/version freeze and
implementation stage.

---

## 11. Authorization flags

| Flag | Value |
|---|---|
| `production_change_authorized` | `false` |
| `term_successor_repair_authorized_for_production` | `false` |
| `scoring_formula_change_authorized` | `false` |
| `component_weight_change_authorized` | `false` |
| `factor_weight_change_authorized` | `false` |
| `stress_coefficient_change_authorized` | `false` |
| `model_version_change_authorized` | `false` |
| `successor_study_authorized` | `false` |
| `automatic_design_verdict` | `null` |
| `automatic_production_verdict` | `null` |

---

## 12. R09 status after this doc merges

| Lane / item | Status |
|---|---|
| R09-A | **COMPLETE / PASS** |
| R09-B | **COMPLETE / MATERIAL REMAINDER CONFIRMED** |
| R09-C-A | **COMPLETE / PASS** |
| R09-C-B | **ADJUDICATED / SUCCESSOR CONTRACT FROZEN** |
| R09 overall | **DESIGN COMPLETE / PRODUCTION REPAIR NOT ACTIVATED** |
| Production Term | **UNCHANGED** |

The next roadmap step after this adjudication document is merged is **NOT**
immediate production activation.

Return to roadmap governance for:

**corrected architecture/version freeze across resolved material factors.**

---

## 13. Predecessor / evidence chain

| Lane | Artifact / run | Role |
|---|---|---|
| R09-A | run `36740462616` | Official LIVE completion audit |
| R09-B | `docs/R09_TERM_COMPLETION_ADJUDICATION_2026-09-30.md` | Material remainder + successor direction freeze |
| R09-C-A | PR #84 / diagnostic implementation; PR #85 epoch pagination repair | Feasibility tooling adequate for adjudication |
| Superseded C live | run `36767806523` | Historical only; history-capacity conclusions superseded |
| Authoritative C live | run `36772269855` | This adjudication’s live evidence base |
| R09-C-B | this document | Successor contract freeze |
