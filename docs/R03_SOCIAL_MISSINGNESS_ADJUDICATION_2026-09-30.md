# R03 Social missingness successor-semantics adjudication — 2026-09-30

Documentation / governance only.

This record freezes the R03-A Social missingness diagnostic findings and the
R03-B successor-semantics adjudication for a future Social component-missingness
repair.

It does **not** activate production repair.

It does **not** change Daily ETL, `scripts/etl/factors.mjs`,
`scripts/etl/coinGeckoCache.mjs`, Social scoring, Social cache code, CoinGecko
wrappers, `public/data/**`, `config/**`, model identity, SSOT, weights,
subweights, workflows, H8, R07, R01/R08, or any production behavior.

Status labels used below:

- **COMPLETE** — evidence / adjudication lane finished.
- **PASS** — diagnostic evidence supports freezing the successor contract.
- **SELECTED AS SUCCESSOR** — frozen future implementation target. Not active in production.
- **REJECTED AS SUCCESSOR** — must not be used as the future production contract.
- **DEFERRED / NOT AUTHORIZED** — not selected; separate future evidence would be required.
- **NOT ACTIVATED** — production change remains unauthorized.
- **SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE** — future activation requires a new model/implementation era; exact IDs deferred.

---

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| Current neutral-default Search/Momentum = 50 | REJECTED AS SUCCESSOR | Unavailable evidence must not masquerade as observed numeric neutral. |
| C0 `CURRENT_NEUTRAL_DEFAULT` | REJECTED AS SUCCESSOR | Treats unavailable evidence as observed-neutral 50. |
| C1 `AVAILABLE_COMPONENT_RENORMALIZATION` | REJECTED AS SUCCESSOR | Partial availability silently reweights 70/30 to 100/0 or 0/100; no evidence validates one-component Social as equivalent to the intended construct. |
| C2 `REQUIRE_BOTH_COMPONENTS` | SELECTED AS SUCCESSOR | Both official components must be eligible OBSERVED evidence; otherwise Social score = null and Social does not enter G-Score. |
| C3 `ELIGIBLE_PRIOR_OBSERVATION` | DEFERRED / NOT AUTHORIZED | Current cache lacks durable per-component evidence-state / freshness / provenance. |
| Non-finite derived Momentum | UNAVAILABLE | `NONFINITE_DERIVED_INPUT_IS_NOT_OBSERVED_EVIDENCE` — do not percentile-rank Infinity / -Infinity / NaN. |
| Malformed current price + unchanged rank cache reuse | REJECTED AS SUCCESSOR BEHAVIOR | `MALFORMED_OR_UNAVAILABLE_CURRENT_EVIDENCE_MUST_NOT_QUALIFY_FOR_FACTOR_CACHE_REUSE`. |
| Volatility in official Social blend | REJECTED | Remains descriptive / inventory only. |
| Scientific materiality | SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE | Changes whether Social's 10% weight participates when component evidence is incomplete/invalid. Exact future model/version IDs deferred. |
| Production activation | NOT ACTIVATED | All production-repair authorization flags remain false. |

SSOT **2.1.1** remains unchanged in this adjudication because official factor
weights, subweights, and risk bands are not being changed by this docs freeze.

---

## 2. Authoritative diagnostic evidence (R03-A)

| Field | Value |
|---|---|
| Workflow run | `36724133493` |
| Workflow | R03 Social missingness treatment diagnostic |
| Repository SHA | `cc8e550b923780df5aab39280c4352df06fcde3c` |
| Artifact ID | `11102032991` |
| Artifact | `r03-social-missingness-diagnostic` |
| Artifact ZIP SHA-256 | `b03ab346fc42e0da2f08e522b374407c8c261ed0f3f06dc97434a1a0c32a4437` |
| Extracted report SHA-256 | `82fc8b16ef3ba89c4d4914bcd3499120c634a043f4939397e499a31fb53786d2` |
| Schema | `ghostgauge_r03_social_missingness_diagnostic_v1` |
| Run result | SUCCESS |
| Provider network performed | `false` |
| Repository / public-data writes | none |
| Blockers | none |
| Warnings | none |

### Run integrity

- `workflow_dispatch` on `main`
- exact repository SHA above
- `origin/main` guard passed before diagnostic
- `origin/main` guard passed after diagnostic
- worktree clean
- `permissions: contents: read`
- `provider_network_performed: false`
- `repository_write_performed: false`
- `public_data_write_performed: false`
- `predictive_outcome_data_used: false`
- `h8_data_used_for_tuning: false`
- `automatic_adjudication_verdict: null`
- `production_change_authorized: false`
- blockers: none
- warnings: none

---

## 3. Frozen existing invariant

Preserve:

**`MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL`**

Unavailable, missing, errored, malformed, insufficient, or invalid evidence
must not masquerade as an observed numeric neutral score.

Do **not** map any unavailable state to `0`, `50`, “neutral”, or
“stale-observed” unless a future separately adjudicated contract explicitly
authorizes it.

---

## 4. Official Social component contract

Freeze:

| Role | Identity |
|---|---|
| Official scored components | `coingecko_trending_rank`, `btc_price_momentum_7d` |
| Search weight | `0.70` |
| Momentum weight | `0.30` |
| Social factor weight | `0.10` |
| Volatility | **NOT** an official scored component — descriptive / inventory only |

Do **not** introduce volatility into the official Social blend.

---

## 5. Current production defect — confirmed

Canonical production currently initializes:

- Search = `50`
- Momentum = `50`

and can retain those defaults when component evidence is:

- missing
- unavailable
- errored
- malformed but non-throwing
- quantitatively insufficient

Those defaults can then enter the official 70/30 blend as if they were
observed evidence.

This violates the frozen successor invariant
`MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL`.

Separately, some malformed structural payloads throw before the blend and
already produce whole-factor null/error via the outer `computeSocialInterest()`
catch. Do **not** conflate those throwing paths with neutral-default paths.

Examples of throw-before-blend paths already characterized by R03-A:

- truthy non-array `trendsData.coins` (`.find` is not a function)
- array element that throws inside the trending `.find()` callback (e.g. `null`)
- non-iterable price row that throws during `prices.map(([timestamp, price]) => …)`
- latest-price extraction throw where applicable

---

## 6. Non-finite Momentum finding

R03-A deterministic reproduction:

| Field | Observed |
|---|---|
| Latest `priceChange` | `+Infinity` |
| `momentum7dPct` | `null` |
| `changePercentile` | `1` |
| Momentum component score | `95` |

Current production can therefore produce a numeric component score from a
non-finite latest derived momentum input by still calling
`percentileRank(changeSeries, priceChange)` when `changeSeries.length > 0`.

### Adjudication

**`NONFINITE_DERIVED_INPUT_IS_NOT_OBSERVED_EVIDENCE`**

A non-finite derived Momentum input must be unavailable for successor scoring.

Do **not** percentile-rank `Infinity` / `-Infinity` / `NaN` as eligible current
evidence.

Successor semantic state for this case: **`INVALID_DERIVED`**.

---

## 7. Cache finding

Current `hasSocialDataChanged()` can reuse a cached Social factor when Bitcoin
rank is unchanged and current `latestPrice` is:

- `undefined`
- `NaN`
- a nonnumeric string

because:

```text
Math.abs(malformedValue - cachedPrice) => NaN
NaN > 1000 => false
```

### Adjudication

**`MALFORMED_OR_UNAVAILABLE_CURRENT_EVIDENCE_MUST_NOT_QUALIFY_FOR_FACTOR_CACHE_REUSE`**

Current component evidence eligibility must be established before factor-cache
reuse can occur.

Do **not** adjudicate or tune the existing valid-price `$1000` threshold in
R03-B. For otherwise valid, observed current evidence, general cache-change
sensitivity outside missingness remains out of scope for this adjudication.

---

## 8. Candidate disposition

### C0 — `CURRENT_NEUTRAL_DEFAULT`

**REJECTED AS SUCCESSOR**

Reason: treats unavailable evidence as numeric observed-neutral `50` and
violates `MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL`.

### C1 — `AVAILABLE_COMPONENT_RENORMALIZATION`

**REJECTED AS SUCCESSOR**

Reason: although C1 avoids neutral-default substitution, partial availability
silently changes the official component construct:

| Availability | Intended construct | Effective C1 construct |
|---|---|---|
| Search-only | 70% Search / 30% Momentum | 100% Search / 0% Momentum |
| Momentum-only | 70% Search / 30% Momentum | 0% Search / 100% Momentum |

The R03-A diagnostic contains no evidence validating a one-component Social
score as scientifically equivalent/comparable to the intended two-component
70/30 Social construct.

Do **not** introduce implicit component reweighting under missingness.

### C2 — `REQUIRE_BOTH_COMPONENTS`

**SELECTED AS SUCCESSOR**

Rules:

1. If both official components are eligible **OBSERVED** evidence: use the
   normal 70/30 Social blend.
2. If either official component is unavailable or invalid: Social factor score
   = `null`; Social does not enter G-Score.
3. No partial-component renormalization.

### C3 — `ELIGIBLE_PRIOR_OBSERVATION`

**DEFERRED / NOT AUTHORIZED**

Current cache/provenance is insufficient for safe component-level prior
observation reuse. Current cache lacks a durable explicit per-component
contract for:

- observed vs defaulted/missing/error state
- independent component freshness eligibility
- per-component source provenance
- independently trustworthy Search observation time

Do **not** use a prior component observation as a fallback under this R03
successor. Future component-level prior-observation reuse would require
separate evidence and adjudication.

---

## 9. Component evidence states

Freeze semantic states sufficient to distinguish at minimum:

| State | Meaning (successor) |
|---|---|
| `OBSERVED` | Eligible for component scoring |
| `MISSING` | Observation absent |
| `ERROR` | Provider/request failure or explicit error path |
| `MALFORMED` | Structurally unusable payload |
| `INSUFFICIENT_HISTORY` | Structurally usable but quantitatively insufficient |
| `INVALID_DERIVED` | Derived intermediate is non-finite / invalid |

Exact implementation enum spelling may be refined later, but these meanings
must remain distinct.

**All states other than `OBSERVED` are unavailable for successor component
scoring.**

Do **not** map any unavailable state to `0`, `50`, “neutral”, or
“stale-observed” unless a future separately adjudicated contract explicitly
authorizes it.

---

## 10. Search eligibility

Search is **OBSERVED** only when the current evidence is structurally valid and
contains a usable Bitcoin trending observation from the official source path.

At minimum:

- trending payload structurally usable
- Bitcoin/BTC observation present
- usable finite rank
- resulting Search score finite

Otherwise Search is unavailable with an explicit cause.

A structurally malformed path that currently throws should become explicit
unavailable/error semantics in the successor rather than silently contributing
`50`.

---

## 11. Momentum eligibility

Momentum is **OBSERVED** only when current price evidence supports the complete
official momentum calculation.

At minimum:

- price payload structurally usable
- sufficient finite source history
- finite latest derived `priceChange`
- non-empty usable finite comparison/change series
- finite percentile result
- finite resulting Momentum score

Otherwise Momentum is unavailable with an explicit cause.

Special cases:

| Case | Successor state |
|---|---|
| Exactly-14 finite prices with no usable comparison series | `INSUFFICIENT_HISTORY` — not observed-neutral `50` |
| Non-finite latest derived `priceChange` | `INVALID_DERIVED` — not an observed percentile input |

---

## 12. Factor behavior

Freeze:

**Both components OBSERVED:**

```text
SocialScore =
  0.70 * SearchScore
  + 0.30 * MomentumScore
```

subject to the existing canonical blend rounding behavior.

**Any official component unavailable:**

- Social score = `null`
- The factor is excluded/unavailable
- Do **not** renormalize the remaining Social component to 100%

---

## 13. Top-level G-Score behavior

Preserve existing canonical whole-factor behavior:

| Social return | G-Score participation |
|---|---|
| Fresh finite Social score | Enters G-Score; contributes normal 10% factor weight |
| Null / unavailable Social score | Does not enter `weightedSum`; 10% weight does not enter `totalWeight`; remaining fresh factors normalize over the reduced `totalWeight` |

This existing top-level normalization is **not** the same as C1
component-level renormalization.

Do **not** create a new composite-weighting mechanism in R03.

---

## 14. Current valid snapshot — descriptive only

Checked-in Social cache (diagnostic context only):

| Field | Value |
|---|---|
| Search | `55` |
| Momentum | `63` |
| Social | `57` |

With both components available:

| Candidate | Result |
|---|---|
| C0 | `57` |
| C1 | `57` |
| C2 | `57` |

Therefore the selected C2 successor preserves the normal complete-evidence
70/30 result. The adjudication changes missing/invalid evidence behavior, not
the ordinary both-observed calculation.

Do **not** treat this one snapshot as predictive validation.

---

## 15. Component provenance / timestamps

Future implementation must preserve component-specific evidence state and
provenance.

### Search

`trending_fetched_at` is an acquisition/fetch wall-clock timestamp.

It is **not** a CoinGecko source observation timestamp.

Do **not** relabel it as one.

### Momentum

`price_observation_utc` is derived from the provider price observation data
and is the component observation timestamp.

### Required future preservation

Future Social output/cache should preserve enough information to identify for
each official component:

- evidence state
- provider/source
- score when observed
- relevant acquisition timestamp
- relevant source-observation timestamp when available
- eligibility for the current calculation

Do **not** invent unavailable provider timestamps.

---

## 16. Factor-level cache vs component fallback

Freeze the distinction:

| Concept | Meaning | R03-B status |
|---|---|---|
| Factor-level cache reuse | Computation/cache optimization after current evidence eligibility is established | Must not bypass C2 both-components-observed requirement |
| Component-level prior-observation fallback | Substituting earlier evidence when a current component is unavailable | **NOT AUTHORIZED** |

Current evidence must not be classified unavailable and then silently replaced
by an old component score.

Factor-cache reuse must not bypass the C2 both-components-observed requirement.

---

## 17. Current wrapper cache

CoinGecko's existing short-lived wrapper cache may remain a transport/cache
layer.

R03-B does **not** adjudicate a new wrapper-cache architecture.

However:

- do not claim memory/disk/live origin when the wrapper does not expose it
- do not use wrapper-cache opacity as authorization for component-level stale fallback
- preserve truthful provider/timestamp semantics

---

## 18. Score examples — descriptive only

For the diagnostic synthetic `55` / `63` component pair:

| Search | Momentum | C0 | C1 | C2 |
|---|---|---|---|---|
| Available (`55`) | Available (`63`) | `57` | `57` | `57` |
| Unavailable | Available (`63`) | `54` | `63` | `null` |
| Available (`55`) | Unavailable | `54` | `55` | `null` |
| Unavailable | Unavailable | `50` | `null` | `null` |

State explicitly:

These are mathematical illustrations only.

They are **not**:

- historical replay
- backtest
- predictive validation
- materiality thresholds
- P&L analysis

No H8 outcomes were used for tuning.

---

## 19. Scientific materiality / versioning

Adjudicate the R03 successor repair as:

**`SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE`**

Reason: the successor changes whether Social's full 10% factor weight
participates in G-Score when official component evidence is incomplete or
invalid.

This repair should join the forthcoming new model/implementation era already
required by the R07 and R01/R08 successor semantics.

Do **not** freeze the exact future:

- `model_version`
- `implementation_revision`

in this docs PR.

Exact identity remains deferred until the broader corrected-architecture/version
freeze after the remaining material audit lane is complete.

Current production identity remains unchanged.

---

## 20. Authorization

Explicitly record:

| Flag | Value |
|---|---|
| `production_change_authorized` | `false` |
| `social_missingness_repair_authorized_for_production` | `false` |
| `partial_component_renormalization_authorized` | `false` |
| `component_prior_observation_fallback_authorized` | `false` |
| `cache_policy_change_authorized_for_production` | `false` |
| `model_version_change_authorized` | `false` |

The adjudication freezes the future implementation target.

It does **not** activate production repair.

---

## 21. R03 status after this adjudication

| Lane | Status |
|---|---|
| R03-A | COMPLETE / PASS |
| R03-B | COMPLETE once this adjudication document is merged |
| Current neutral-default semantics | REJECTED AS SUCCESSOR |
| C1 available-component renormalization | REJECTED AS SUCCESSOR |
| C2 require-both-components | SELECTED AS SUCCESSOR |
| C3 prior-component reuse | DEFERRED / NOT AUTHORIZED |
| Successor implementation contract | FROZEN BY R03-B |
| Production repair | NOT ACTIVATED |

---

## 22. Next lane

After R03-B documentation is independently reviewed and merged:

Proceed to:

**R09 — Term completion audit**

Do **not** implement R07, R01/R08, or R03 production repairs yet.

The remaining material semantic audit should be completed before the broader
corrected architecture/version freeze and coordinated versioned implementation.

---

## 23. Scope of this documentation PR

In scope:

- this adjudication record
- docs index link

Out of scope / explicitly unchanged:

- `scripts/**`
- `lib/**`
- `config/**`
- `public/data/**`
- workflows
- package files
- `docs/MODEL_ERAS.md`
- production Social scoring / cache / CoinGecko wrappers
- model-era identity activation
