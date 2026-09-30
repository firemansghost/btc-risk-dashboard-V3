# R01/R08 Net Liquidity successor-semantics adjudication — 2026-09-30

Documentation / governance only.

This record freezes the R01/R08-A diagnostic findings and the R01/R08-B
successor-semantics adjudication for a future Net Liquidity source/unit/date/cache
repair.

It does **not** activate production repair.

It does **not** change Daily ETL, `scripts/etl/factors.mjs`,
`lib/factors/netLiquidity.ts`, `public/data/**`, `config/**`, model identity,
SSOT, weights, subweights, source routing, H8, R07, or any production workflow.

Status labels used below:

- **COMPLETE** — evidence / adjudication lane finished.
- **PASS** — diagnostic evidence supports freezing the successor contract.
- **APPROVED FOR FUTURE IMPLEMENTATION DESIGN** — frozen for later implementation PRs. Not active in production.
- **REJECTED AS SUCCESSOR CONTRACT** — must not be used as the future production contract.
- **REJECTED** — must not be done / must not remain as the successor rule.
- **NOT ACTIVATED** — production change remains unauthorized.
- **LEXICAL_FORMATTING_DIFFERENCE_ONLY** — wording difference without semantic unit conflict.

---

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| RRP ×1e6 production normalization | REJECTED AS SUCCESSOR CONTRACT | Correct RRPONTSYD multiplier is ×1e9. |
| Current positional date join | REJECTED AS SUCCESSOR CONTRACT | Production-query dates systematically mismatch; exact common Wednesday only. |
| WALCL-date-only cache invalidation | REJECTED AS SUCCESSOR CONTRACT | False negatives for non-WALCL and same-date revisions; live cache drift observed. |
| RRP-empty → zero substitution | REJECTED AS SUCCESSOR CONTRACT | Missing RRP makes the Wednesday unavailable; do not substitute zero. |
| Successor unit normalization | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | WALCL ×1e6, WTREGEN ×1e6, RRPONTSYD ×1e9. |
| Canonical observation date | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Wednesday. |
| Successor WALCL / WTREGEN | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Native Wednesday observations; do not force generic `frequency=w` when native already satisfies Wednesday cadence. |
| Successor RRP weekly transform | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Official FRED `RRPONTSYD` with `frequency=wew` and `aggregation_method=avg`. |
| Join rule | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Exact source-date intersection only. No positional / nearest / fill / interpolation. |
| Missingness | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Incomplete Wednesday excluded; insufficient exact-date history → factor unavailable. |
| Cache invalidation | APPROVED FOR FUTURE IMPLEMENTATION DESIGN | Deterministic fingerprint over complete canonical scoring-window source inputs for all three series. |
| Scoring formulas / subweights / factor weight | UNCHANGED | Level / RoC / momentum formulas and Net Liquidity subweights remain as current SSOT. |
| Scientific materiality | DECIDED | Scientifically material semantic change. Future activation requires a new model/implementation era. Exact future version IDs deferred. |
| Production activation | NOT ACTIVATED | All production-repair authorization flags remain false. |

SSOT **2.1.1** remains unchanged in this adjudication because official factor
weights, subweights, and risk bands are not being changed.

---

## 2. Official evidence (R01/R08-A)

| Field | Value |
|---|---|
| Workflow run | `36710504328` |
| Workflow | R01/R08 Net Liquidity source-date-cache diagnostic |
| Repository SHA | `88a86c3a3f7f83e56c7440edb39561e5bb88b942` |
| Artifact ID | `11093437874` |
| Artifact | `r01-r08-net-liquidity-diagnostic` |
| Artifact ZIP digest | `sha256:c26144eab6856e6eaba54f77efbbb25a56f8f1de1467f067c1aff240ac325cbd` |
| Extracted report SHA-256 | `2649147ed2c395c01ed8c44c212f5c62ca428433ecc21a7e244d6517253fdc6d` |
| Schema | `ghostgauge_r01_r08_net_liquidity_diagnostic_v1` |
| Run result | SUCCESS |
| Network boundary | `FRED_ONLY` |
| Repository / public-data writes | none |

### Run integrity

- `workflow_dispatch` on `main`
- exact repository SHA above
- `origin/main` guard passed before diagnostic
- `origin/main` guard passed after diagnostic
- worktree clean
- `permissions: contents: read`
- `provider_network_scope: FRED_ONLY`
- `repository_write_performed: false`
- `public_data_write_performed: false`
- `predictive_outcome_data_used: false`
- `h8_data_used_for_tuning: false`
- `automatic_adjudication_verdict: null`
- `production_change_authorized: false`

---

## 3. Source identities

### WALCL

- native frequency: Weekly, As of Wednesday
- units: Millions of U.S. Dollars
- release: H.4.1 Factors Affecting Reserve Balances
- source: Board of Governors of the Federal Reserve System (US)

### WTREGEN

- native frequency: Weekly, Ending Wednesday
- units: Millions of U.S. Dollars
- release: H.4.1 Factors Affecting Reserve Balances
- source: Board of Governors of the Federal Reserve System (US)

### RRPONTSYD

- native frequency: Daily
- units returned live by FRED: Billions of US Dollars
- frozen fixture wording: Billions of U.S. Dollars
- release: Temporary Open Market Operations
- source: Federal Reserve Bank of New York

### `US` vs `U.S.` wording

Adjudicated as:

**LEXICAL_FORMATTING_DIFFERENCE_ONLY**

This is **not** a semantic unit conflict.

Do **not** modify the frozen fixture
`scripts/etl/__tests__/fixtures/fred-source-units.json` in this docs PR.

RRP source-unit contract remains billions of USD with multiplier **1e9**.

---

## 4. Confirmed current production defects

Canonical production remains:

`scripts/etl/factors.mjs` → `computeNetLiquidity()`

`lib/factors/netLiquidity.ts` is
**NONCANONICAL_APP_HELPER_REFERENCE** and is not production truth for this
adjudication.

### 4.1 R01 — source-unit defect

Current canonical Daily ETL applies:

| Series | Production multiplier | Correct contract |
|---|---|---|
| WALCL | ×1e6 | ×1e6 |
| WTREGEN | ×1e6 | ×1e6 |
| RRPONTSYD | ×1e6 | ×1e9 |

The RRP production multiplier is therefore wrong by a factor of **1000**.

**Status:** REJECTED AS SUCCESSOR CONTRACT.

### 4.2 R08 — date / cadence defect

Current production uses generic FRED:

- `frequency=w`
- `aggregation_method=avg`

Observed production-query dates in the official diagnostic:

- WALCL: Wednesday
- WTREGEN: Wednesday
- RRPONTSYD: Friday

Official positional / exact-date evidence:

| Metric | Value |
|---|---|
| positional rows | 52 |
| all-three dates identical | 0 |
| any-date mismatch | 52 |
| maximum absolute source-date offset | 2 days |
| exact three-series date intersection | 0 rows |

Current positional semantics systematically combine different source dates.

**Status:** REJECTED AS SUCCESSOR CONTRACT.

### 4.3 R08 — cache invalidation defect

Current detector depends only on:

`latestWalclDate`

Synthetic diagnostic scenarios show false negatives for:

- same-date WALCL revisions
- RRP-only date changes
- RRP-only value changes
- WTREGEN-only date changes
- WTREGEN-only value changes
- earlier in-window WALCL revisions
- earlier in-window RRP revisions
- earlier in-window WTREGEN revisions

The only tested source change detected by current logic is WALCL date advance.

Live evidence from the official diagnostic:

| Field | Value |
|---|---|
| Existing cache `cachedAt` | `2026-09-26T08:19:37.607Z` |
| Existing cache `latestWalclDate` | `2026-09-23` |
| Cached Net Liquidity | `5770618331000` |
| Official Sep 30 diagnostic P0 latest WALCL date | `2026-09-23` |
| Official Sep 30 diagnostic P0 Net Liquidity | `5770619460000` |
| Current P0 transformed RRP raw source value | `0.540` billion |

The cached Net Liquidity with the same WALCL/TGA levels implies the earlier
transformed RRP source value was approximately **1.669 billion**.

Thus a real source-input change occurred while `latestWalclDate` stayed
unchanged.

**Status:** REJECTED AS SUCCESSOR CONTRACT.

### 4.4 RRP-zero missingness

Current production substitutes zero when RRP is empty or shorter than the
positional row.

**Status:** REJECTED AS SUCCESSOR CONTRACT.

---

## 5. Wednesday RRP evidence

Official FRED Wednesday-ending RRP query:

- `series_id=RRPONTSYD`
- `frequency=wew`
- `aggregation_method=avg`

Cross-check against independent native-daily → Thursday-through-Wednesday average:

| Metric | Value |
|---|---|
| shared dates | 53 |
| dates only in FRED | 0 |
| dates only in independent reconstruction | 0 |
| exact matches | 10 |
| differing rows | 43 |

The first boundary date, **2025-10-01**, has a large difference because the
bounded native daily diagnostic window begins **2025-09-30** and therefore does
not contain the full preceding Thursday-through-Wednesday source window.

Do **not** treat that first-boundary difference as evidence against FRED WEW.

For the remaining **52** dates:

| Metric | Approximate value |
|---|---|
| maximum absolute difference | $500,000 |
| median absolute difference | $200,000 |
| p95 relative difference | ~0.0984% |

Treat the remaining small differences as descriptive transformation / rounding
differences.

### Adjudication

- Use official FRED **WEW** as the successor RRP weekly transformation.
- Do **not** implement an independent in-production daily-to-Wednesday
  aggregation while official FRED WEW is available.
- The independent reconstruction remains diagnostic validation only.

---

## 6. Successor contract — frozen for future implementation

These rules are frozen for a later authorized production-repair PR.
They are **not** active now.

### 6.1 Unit normalization

| Series | USD multiplier |
|---|---|
| WALCL | 1e6 |
| WTREGEN | 1e6 |
| RRPONTSYD | 1e9 |

### 6.2 Canonical observation date

Net Liquidity canonical observation date:

**WEDNESDAY**

### 6.3 WALCL source semantics

Use native WALCL Wednesday observations.

Do not force generic weekly aggregation when native observations already
satisfy the canonical cadence.

### 6.4 WTREGEN source semantics

Use native WTREGEN Wednesday observations.

Do not force generic weekly aggregation when native observations already
satisfy the canonical cadence.

### 6.5 RRP source semantics

Use official FRED:

- `series_id=RRPONTSYD`
- `frequency=wew`
- `aggregation_method=avg`

This is the canonical Wednesday-ending RRP observation for the successor
Net Liquidity calculation.

### 6.6 Join rule

Exact source-date intersection only.

For date `T`:

```text
NetLiquidity(T) = WALCL(T) - RRP_WEW(T) - WTREGEN(T)
```

where all three inputs have the exact same Wednesday `T`.

Forbidden:

- positional index joins
- nearest-date pairing
- forward fill
- backward fill
- interpolation
- synthetic observation dates

### 6.7 Latest selected observation

Use the most recent exact common Wednesday for which all three canonical source
observations exist.

A newer RRP observation must **not** be paired with an older WALCL/WTREGEN
observation.

Report:

- each source's latest available source date
- selected common scoring date

The factor's data-as-of / `lastUpdated` should describe the selected common
scoring date, not merely `latestWalclDate`.

### 6.8 Missingness

Missing RRP is unavailable.

Do **not** substitute zero.

An incomplete Wednesday is excluded from the canonical series.

If complete exact-date history is insufficient for the current scoring formulas:

Net Liquidity factor is unavailable.

Do **not** manufacture sufficiency through forward fill or zero substitution.

### 6.9 Cache invalidation

Reject:

`latestWalclDate`-only invalidation.

Future implementation must calculate a deterministic fingerprint over the
complete canonical scoring-window source inputs used by the factor:

- WALCL selected date/value rows
- RRP WEW selected date/value rows
- WTREGEN selected date/value rows

The fingerprint must be sensitive to:

- source date additions
- same-date value revisions
- earlier in-window revisions
- any source-specific change that can alter the computed factor

If canonical input fingerprint differs from cached fingerprint:

recompute.

If a cache lacks the successor fingerprint:

treat it as invalid for the successor implementation and recompute.

Cache provenance should retain at minimum:

- canonical input fingerprint
- selected common scoring date
- latest available WALCL source date
- latest available RRP WEW source date
- latest available WTREGEN source date
- cache creation time
- implementation/model identity when production activation occurs

Do **not** freeze a hash serialization implementation detail in this docs PR.

### 6.10 Scoring

Do **not** change:

- level formula
- rate_of_change formula
- momentum formula
- Net Liquidity subweights:
  - level `0.15`
  - rate_of_change `0.40`
  - momentum `0.45`
- factor weight

R01/R08 repair is source/unit/date/cache semantics only.

No score tuning.

### 6.11 Noncanonical helper

`lib/factors/netLiquidity.ts` is:

**NONCANONICAL_APP_HELPER_REFERENCE**

It is not current canonical Daily ETL truth.

Its separate semantics must not be used to define this adjudication.

Do not modify it in this docs PR.

Future implementation/cleanup may align, delegate, or retire that helper after
canonical production repair is independently reviewed.

### 6.12 Versioning

Adjudicate the future production repair as:

**SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE**

Future production activation requires a new model/implementation era.

Do **not** freeze the exact future:

- `model_version`
- `implementation_revision`

in this docs PR.

That remains deferred to the broader architecture/version freeze.

Current production identity remains unchanged until activation.

Do **not** update `MODEL_ERAS.md` in this adjudication.

### 6.13 Authorization

Explicitly recorded:

| Flag | Value |
|---|---|
| `production_change_authorized` | `false` |
| `source_unit_repair_authorized_for_production` | `false` |
| `date_join_repair_authorized_for_production` | `false` |
| `cache_invalidation_repair_authorized_for_production` | `false` |
| `missingness_repair_authorized_for_production` | `false` |

This adjudication freezes the implementation target.

It does **not** activate production repair.

---

## 7. Score evidence — descriptive only

Diagnostic context from the official R01/R08-A report:

| Comparator | Factor score |
|---|---|
| P0 current production reproduction | 63 |
| P1 RRP unit correction only | 62 |
| P3 source-correct Wednesday-aligned diagnostic | 64 |

P1 versus P0:

- all 52 overlapping values changed
- current-date composite factor delta: `-1`
- no 4-week RoC sign changes in this one-year sample

P3 current-date component comparison versus P0:

| Component | P0 | P3 |
|---|---|---|
| level | 67 | 61 |
| rate_of_change | 53 | 56 |
| momentum | 71 | 71 |
| factor composite | 63 | 64 |

These observed score differences are **not** a materiality threshold and are
**not** predictive validation.

Do **not** infer that a small current-date factor-score difference makes the
semantic repair immaterial.

No BTC returns, future G-Scores, H8 outcomes, or P&L were used.

---

## 8. R01/R08 status after this adjudication

| Item | Status |
|---|---|
| R01/R08-A | COMPLETE / PASS |
| R01/R08-B | COMPLETE once this adjudication document is merged |
| Current production positional semantics | REJECTED AS SUCCESSOR |
| RRP ×1e6 normalization | REJECTED AS SUCCESSOR |
| WALCL-date-only cache invalidation | REJECTED AS SUCCESSOR |
| RRP-zero missingness | REJECTED AS SUCCESSOR |
| Successor implementation contract | FROZEN BY R01/R08-B |
| Production repair | NOT ACTIVATED |

---

## 9. Explicit non-actions

This docs PR must **not**:

- change Daily ETL or Net Liquidity production code
- rewrite or silently update `fred-source-units.json`
- activate source-unit / date-join / cache / missingness repair
- change scoring formulas, subweights, or factor weight
- freeze a future `model_version` or `implementation_revision`
- update `MODEL_ERAS.md`
- modify `lib/factors/netLiquidity.ts`
- introduce H8 / predictive / P&L evaluation
- merge as production activation

---

END OF R01/R08-B ADJUDICATION RECORD
