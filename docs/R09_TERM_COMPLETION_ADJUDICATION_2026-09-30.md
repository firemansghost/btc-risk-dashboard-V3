# R09 Term Structure & Leverage completion adjudication — 2026-09-30

Documentation / governance only.

This record freezes the human R09-B adjudication resulting from the official
R09-A LIVE Term Structure & Leverage completion audit.

It records:

- what PR #56 successfully repaired;
- what the official live audit proved remains defective;
- which successor semantic invariants are now frozen;
- which implementation/design detail still requires bounded R09-C work.

It does **not** activate production repair.

It does **not** change Daily ETL, `scripts/etl/factors.mjs`,
`scripts/etl/lib/termFreshness.mjs`, `scripts/etl/stalenessUtils.mjs`,
`scripts/etl/coinGeckoCache.mjs`, Term scoring, Term cache semantics,
`public/data/**`, `config/**`, model identity, SSOT, weights, subweights,
workflows, H8, R07, R01/R08, R03, or any production behavior.

Status labels used below:

- **COMPLETE** — evidence / adjudication lane finished.
- **PASS** — diagnostic evidence supports freezing the successor contract.
- **SELECTED AS SUCCESSOR** — frozen future implementation direction. Not active in production.
- **REJECTED AS SUCCESSOR** — must not be used as the future production contract.
- **ACCEPTED / PRESERVED** — keep; do not reopen without new evidence.
- **PENDING R09-C** — bounded design/feasibility still required before implementation.
- **NOT ACTIVATED** — production change remains unauthorized.
- **SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE** — future activation requires a new model/implementation era; exact IDs deferred.

---

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| PR #56 cadence-aware provider freshness/fallback | ACCEPTED / PRESERVED | Do not reopen without new evidence. Remaining defects are after / around valid provider selection. |
| `rates[0]` as latest funding | REJECTED AS SUCCESSOR | `ARRAY_POSITION_DOES_NOT_DEFINE_FUNDING_RECENCY` |
| 30 funding rows = 30 elapsed days | REJECTED AS SUCCESSOR | `THIRTY_DAY_MEANS_ELAPSED_TIME_NOT_THIRTY_SETTLEMENT_ROWS` |
| Funding multi-day mean vs individual settlement reference | REJECTED AS SUCCESSOR | `FUNDING_CURRENT_AND_REFERENCE_MUST_SHARE_AGGREGATION_AND_HORIZON` |
| Volatility full-window vs 7-row historical subsets | REJECTED AS SUCCESSOR | `VOLATILITY_CURRENT_AND_REFERENCE_MUST_SHARE_HORIZON` |
| Positional funding/spot Stress pairing | REJECTED AS SUCCESSOR | `POSITIONAL_FUNDING_SPOT_STRESS_PAIRING_REJECTED_AS_SUCCESSOR` |
| UTC-date mean of eligible funding settlements for Stress | SELECTED AS SUCCESSOR | Daily funding surface for exact UTC-date join to spot. Not chosen from predictive performance. |
| Exact-date Stress alignment (no fill/nearest/interpolation) | SELECTED AS SUCCESSOR DIRECTION | Common eligible UTC dates only. |
| Row0-centric `hasFundingDataChanged()` as sufficient cache identity | REJECTED AS SUCCESSOR CONTRACT | Complete score-relevant source fingerprint required. |
| PR #56 cache preservation of source observation timestamps | ACCEPTED / PRESERVED | Keep; do not rewrite stale source times to cache/now. |
| Binance null → displayed `451` | REJECTED AS SUCCESSOR | `PROVIDER_FAILURE_CLASS_MUST_BE_TRUTHFUL` |
| Close R09 with no repair | REJECTED | Official live evidence proves material remaining semantic defects. |
| Order-or-cache-only repair | REJECTED | Would leave horizon/aggregation/Stress mismatches. |
| Aligned elapsed-window successor direction | SELECTED | Frozen invariants in this adjudication. |
| Exact historical reference depth / daily boundary | PENDING R09-C | Not selectable from R09-A results alone. |
| Scientific materiality | SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE | Can alter Funding / Volatility / Stress / Term / G-Score evidence validity. Exact future model/version IDs deferred. |
| Production activation | NOT ACTIVATED | All production-repair authorization flags remain false. |

Official Term weights remain unchanged (funding `0.40` / realized_vol `0.35` /
stress `0.25`; Term factor weight `0.20`). R09 does **not** tune factor weight,
component weights, percentile risk transform, or Stress formula coefficients.

---

## 2. Authoritative R09-A LIVE audit

| Field | Value |
|---|---|
| Workflow run | `36740462616` |
| Workflow | R09 Term Structure & Leverage completion audit |
| Event | `workflow_dispatch` |
| Repository SHA | `f8bd2d5a68628edd803558ed8381ffe635f11a90` |
| Artifact ID | `11110476961` |
| Artifact | `r09-term-completion-audit` |
| Artifact ZIP SHA-256 | `065d7e98e165d0e2632a460478d809584906ec88b59a623c37de2d946924207d` |
| Extracted report SHA-256 | `c507b435af8fcb546ce0ea352a75d74b066cd6e328a69381770b4313b5f7f194` |
| Schema | `ghostgauge_r09_term_completion_audit_v1` |
| Mode | `LIVE_READ_ONLY` |
| Run result | SUCCESS |
| Blockers | none |
| Warnings | none |
| Provider network performed | `true` |
| Repository writes | none |
| Public-data writes | none |
| Predictive outcome data used | `false` |
| H8 data used for tuning | `false` |

### Run integrity

- `workflow_dispatch` against the exact repository SHA above
- `LIVE_READ_ONLY` mode
- schema `ghostgauge_r09_term_completion_audit_v1`
- provider network performed: true
- repository / public-data writes: none
- predictive / H8 tuning data: not used
- blockers: none
- warnings: none
- production change: not authorized by this audit

---

## 3. PR #56 boundary — preserve

**ACCEPTED / PRESERVED**

PR #56 cadence-aware provider freshness/fallback architecture remains accepted.

It correctly:

- rejects stale funding-provider evidence;
- applies provider-specific cadence semantics;
- preserves funding source observation timestamps;
- falls through the provider preference chain;
- fails closed if no provider is fresh.

R09 successor work must **not** reopen or discard that architecture without new
evidence.

R09's remaining defects occur **after / around** valid provider selection.

---

## 4. Official live provider evidence

### BitMEX

| Field | Value |
|---|---|
| HTTP | 200 |
| Semantic status | VALID payload |
| Rows | 30 usable |
| Returned order | DESCENDING |
| Latest source observation | `2026-09-16T12:00:00.000Z` |
| Freshness | STALE |
| Disposition | Correctly rejected by PR #56 freshness logic |

### Binance

| Field | Value |
|---|---|
| HTTP | 200 |
| Semantic status | VALID |
| Rows | 30 usable |
| Returned order | ASCENDING |
| Latest source observation | `2026-09-30T08:00:00.000Z` |
| Freshness | FRESH |
| Disposition | SELECTED by current preference chain after stale BitMEX |

### OKX

| Field | Value |
|---|---|
| HTTP | 200 |
| Provider code | `0` |
| Semantic status | VALID |
| Rows | 30 usable |
| Returned order | DESCENDING |
| Latest source observation | `2026-09-30T08:00:00.000Z` |
| Freshness | FRESH |

---

## 5. Confirmed material remainder 1 — provider row order

**REJECTED AS SUCCESSOR:** treating raw array position as funding recency.

Official selected provider: **Binance**.

Binance returned funding rows in **ASCENDING** timestamp order.

Current production uses `rates[0]` as `latestFunding`.

Official live reproduction:

| Quantity | Value |
|---|---|
| `rates[0]` | `0.007524%` |
| Actual latest-by-timestamp funding rate | `-0.000244%` |

Therefore `rates[0] === latest funding` is **FALSE** for a provider current
production can legitimately select.

### Adjudication

`ARRAY_POSITION_DOES_NOT_DEFINE_FUNDING_RECENCY`

### Successor rule

- parse explicit provider timestamps;
- require valid timestamps for scored funding evidence;
- canonicalize eligible funding history into explicit chronological
  **ASCENDING** order for time-series operations;
- select current/latest funding by **MAXIMUM ELIGIBLE SOURCE TIMESTAMP**;
- never define recency from raw provider array index.

Do **not** depend on provider-returned order.

---

## 6. Confirmed material remainder 2 — “30-day” funding window

**REJECTED AS SUCCESSOR:** silently treating 30 settlement rows as 30 elapsed days.

Official live selected Binance rows: **30**  
Cadence: **8 hours**  
First-to-last elapsed span: approximately **9.67 days**  
Rows required to span approximately 30 elapsed days at this cadence: **91**

Current public/detail terminology includes:

- 30-day Average
- 30-day Range
- metric key `funding_30d_avg`

### Adjudication

`THIRTY_DAY_MEANS_ELAPSED_TIME_NOT_THIRTY_SETTLEMENT_ROWS`

### Successor rule

A nominal 30-day funding statistic must be based on explicit elapsed-time
coverage.

Do not silently interpret 30 rows as 30 days.

The selected provider must expose/acquire sufficient valid history to satisfy
the eventual frozen 30-day boundary contract.

Insufficient history is an explicit unavailable / provider-ineligible state.

Do **not** silently shorten the requested horizon.

Do **not** splice multiple providers inside one scoring window unless a future
separate adjudication explicitly authorizes it.

Exact 30-day boundary/inclusion and minimum history coverage remain for
**R09-C**.

---

## 7. Confirmed material remainder 3 — funding reference-horizon mismatch

**REJECTED AS SUCCESSOR:** percentile-ranking a multi-day mean against individual settlement rates.

Current funding component mechanically compares:

- current observation: mean of all returned funding settlements
- historical/reference distribution: individual settlement rates from that same returned array

These are different aggregation levels.

### Adjudication

`FUNDING_CURRENT_AND_REFERENCE_MUST_SHARE_AGGREGATION_AND_HORIZON`

### Successor direction

If the current Funding statistic is a 30-day elapsed-window mean, its percentile
reference must consist of historical rolling windows using the **SAME**:

- funding-rate definition;
- elapsed horizon;
- aggregation rule;
- provider/time semantics.

Do **not** percentile-rank a multi-day mean against individual 8-hour settlement
rates.

Exact historical reference depth is **NOT** frozen by R09-B. That requires
**R09-C** bounded design/feasibility.

---

## 8. Confirmed material remainder 4 — volatility horizon mismatch

**REJECTED AS SUCCESSOR:** comparing a ~30-day current statistic against ~7-row / ~6-day historical windows.

Official live CoinGecko evidence:

| Field | Value |
|---|---|
| Usable numeric price observations | 31 |
| Returned order | ASCENDING |
| Full elapsed span | approximately 29.66 days |
| Latest raw observation | `2026-09-30T15:54:20.000Z` |
| Final observation | intraday-timestamped |

Current Volatility observation uses returns across **all** numeric spot prices.  
Current historical comparison uses **7-row** subsets.

Live result: current observation horizon and historical subset horizon
**do not match**.

### Adjudication

`VOLATILITY_CURRENT_AND_REFERENCE_MUST_SHARE_HORIZON`

### Successor direction

A nominal 30-day realized-volatility observation must be percentile-ranked
against historical realized-volatility observations computed under the **SAME**
horizon and sampling/finality contract.

Exact historical reference depth and exact daily-window boundary/finality
contract remain for **R09-C**.

---

## 9. Spot intraday observation

Official live CoinGecko response contained regular daily observations plus a
terminal observation at `2026-09-30T15:54:20.000Z`.

The final interval was materially shorter than normal daily spacing.

### Adjudication

`RAW_FINAL_SPOT_TIMESTAMP_IS_NOT_AUTOMATICALLY_SCORE_ELIGIBLE_DAILY_EVIDENCE`

Future scoring must explicitly distinguish:

- raw provider observation timestamp;
- acquisition timestamp;
- score-eligible observation timestamp;
- regular daily-history observation;
- intraday terminal observation.

A raw terminal timestamp must not make Term appear fresher than the evidence
actually used by the statistic being scored.

Do **not** invent or mislabel CoinGecko provider finality.

**R09-C** must freeze the exact score-eligible daily sampling/boundary rule.

Also freeze:

`TERM_SPOT_FRESHNESS_BINDS_TO_SCORE_ELIGIBLE_EVIDENCE`

The freshness timestamp for the scored Term factor must come from the latest
spot observation that is actually eligible under the frozen scoring/window
contract.

Do not allow a malformed, excluded, non-finite, or otherwise non-scoreable
terminal row to make the factor appear current.

Continue preserving raw provider evidence separately for diagnostics/provenance.

---

## 10. Confirmed material remainder 5 — Stress positional misalignment

**REJECTED AS SUCCESSOR:** positional funding/spot Stress pairing after discarding timestamps.

Official live selected-provider Stress reproduction:

| Field | Value |
|---|---|
| Historical points | 17 |
| Funding subset elapsed window | approximately 48 hours |
| Spot subset elapsed window | approximately 144 hours |
| Calendar-overlapping historical windows | 0 / 17 |
| Overlap percentage | 0% |
| Median funding-vs-spot center-time separation | approximately 296 hours |
| Maximum center-time separation | approximately 424 hours |

Current implementation pairs funding and spot history by array position after
discarding timestamps.

### Adjudication

`POSITIONAL_FUNDING_SPOT_STRESS_PAIRING_REJECTED_AS_SUCCESSOR`

Successor Stress must use explicit calendar/time alignment.

---

## 11. Stress daily funding representation

R09-A demonstrated both of these are mechanically feasible:

- UTC-date mean of all eligible settlements
- UTC-date final settlement

### R09-B selection

`UTC_DATE_MEAN_OF_ELIGIBLE_FUNDING_SETTLEMENTS`

**SELECTED AS SUCCESSOR**

Reason:

- Funding is an 8-hour settlement series.
- A daily mean preserves all eligible settlements for the UTC date.
- It represents the day's sustained funding pressure.
- It avoids choosing one arbitrary intra-day settlement as representative.
- It provides a natural daily surface for alignment to the daily spot series.

This is a semantic design choice.

It is **not** selected from predictive performance.

No H8 or forward-return evidence was used.

---

## 12. Stress alignment contract

Freeze successor direction:

1. derive eligible funding settlement observations;
2. aggregate funding to one UTC-date mean per eligible date;
3. derive score-eligible spot daily observations;
4. join by **EXACT UTC DATE**;
5. use common eligible dates only;
6. no positional pairing;
7. no nearest-date join;
8. no forward fill;
9. no backward fill;
10. no interpolation;
11. no synthetic missing-date reconstruction.

Current and historical Stress observations must use the **SAME** nominal horizon
and aggregation rules.

Exact rolling-history depth and boundary/finality rules remain for **R09-C**.

---

## 13. Term `lastUpdated` semantics

Current production sets:

`lastUpdated = fundingObservationUtc`

and separately preserves:

- `funding_observation_utc`
- `spot_observation_utc`

Top-level freshness correctly checks both legs.

### R09-B successor provenance direction

`lastUpdated` must represent the **OLDEST / BINDING** latest score-eligible
observation across all required Term evidence legs.

Preserve individual timestamps separately. At minimum preserve:

- `funding_observation_utc`
- `spot_observation_utc`
- `lastUpdated` / binding observation

Do **not** replace source observation time with:

- fetch time
- cache write time
- current wall clock

---

## 14. Cache invalidation contract

Current `hasFundingDataChanged()` is **REJECTED** as a sufficient successor
cache identity contract.

Confirmed false-negative classes include:

- Binance `fundingTime` advances with unchanged rate;
- OKX `fundingTime` advances with unchanged rate;
- earlier funding history changes while row0 is unchanged;
- spot values change while funding is unchanged;
- spot observation timestamp changes while funding is unchanged;
- spot history advances while funding is unchanged;
- some provider-switch conditions.

### Successor requirement

Cache identity must use a deterministic fingerprint covering the **COMPLETE**
score-relevant source evidence.

At minimum fingerprint:

- selected provider identity;
- canonical funding source timestamps + rates used by the current calculation;
- canonical funding history/reference rows required by scoring;
- score-eligible spot timestamps + prices used by the current calculation;
- spot history/reference rows required by scoring;
- scoring-window/finality contract identity where needed to disambiguate semantics.

Provider identity change invalidates the fingerprint.

A provider switch must not reuse an old factor merely because current and cached
row0 values happen to compare equal.

Cache reuse also remains subject to source-cadence freshness.

No stale source observation may be rewritten to cache time / now.

Exact fingerprint schema remains for **R09-C**.

---

## 15. Cache preservation — keep good PR #56 behavior

**ACCEPTED / PRESERVED**

Preserve:

- cached source observation timestamps remain source timestamps;
- `cachedAt` does not become `lastUpdated`;
- stale cached funding rejects reuse;
- stale cached spot rejects reuse;
- Term calculation cache TTL remains a separate optimization layer.

R09-B does **not** authorize changing the existing 6-hour file TTL merely
because the source fingerprint must improve.

---

## 16. Provider failure provenance

Confirmed current production behavior:

Binance `rawRows === null` is displayed as `451` regardless of whether the
actual cause was HTTP 451.

### Adjudication

`PROVIDER_FAILURE_CLASS_MUST_BE_TRUTHFUL`

Successor provenance must distinguish at minimum:

- `HTTP_451`
- `HTTP_OTHER`
- `NETWORK_ERROR`
- `MALFORMED_RESPONSE`
- `PROVIDER_ERROR`
- `EMPTY`
- `STALE`
- `VALID` / `FRESH`

Do **not** infer HTTP 451 from generic null.

This is also part of the standing R10 provenance obligation.

---

## 17. Official Term weights — unchanged

Freeze existing official contract:

| Item | Value |
|---|---|
| funding | `0.40` |
| realized_vol | `0.35` |
| stress | `0.25` |
| Term factor G-Score weight | `0.20` |

R09 does **not** tune:

- factor weight
- component weights
- percentile risk transform
- Stress formula coefficients

No predictive optimization is authorized.

---

## 18. R09-B repair disposition

| Option | Status | Reason |
|---|---|---|
| `CLOSE_R09_WITH_NO_REPAIR` | REJECTED | Official live evidence proves material remaining semantic defects. |
| `ORDER_OR_CACHE_ONLY_REPAIR` | REJECTED | Would leave 30-day funding horizon, funding aggregation, volatility horizon, and Stress time/cadence mismatches. |
| `ALIGNED_ELAPSED_WINDOW_SUCCESSOR_DIRECTION` | SELECTED | With the frozen invariants in this adjudication. |
| Exact implementation contract | **NOT YET COMPLETE** | R09-A does not justify selecting an arbitrary historical reference depth or exact 30-day daily sampling boundary after observing the results. |

---

## 19. R09-C required design questions

Before implementation, perform a bounded read-only R09-C design/feasibility step.

R09-C must freeze **without predictive tuning**:

1. exact 30-day boundary/inclusion rule for funding settlements;
2. minimum source-history coverage required for provider eligibility;
3. gap/duplicate handling;
4. exact CoinGecko score-eligible daily sampling rule;
5. treatment of terminal intraday CoinGecko observation;
6. exact current 30-day realized-volatility construction;
7. exact historical rolling-window construction;
8. exact historical reference depth for Funding;
9. exact historical reference depth for Volatility;
10. exact historical reference depth for Stress;
11. exact-date common-window eligibility for Stress;
12. provider request depth/pagination needed to satisfy the frozen semantics;
13. deterministic source fingerprint schema;
14. unavailability behavior when the required window/reference history cannot be established.

Do **not** choose these values from:

- BTC forward returns
- H8 outcomes
- future G-Scores
- P&L
- strategy performance

---

## 20. Scientific materiality / versioning

Adjudicate the eventual R09 successor repair as:

`SCIENTIFICALLY_MATERIAL_SEMANTIC_CHANGE`

Reason: it can alter:

- current funding-rate interpretation;
- Funding score;
- Volatility score;
- Stress score;
- Term composite score;
- whether Term's 20% G-Score weight contains valid current evidence.

The repair belongs in the forthcoming coordinated corrected model/implementation
era with the already adjudicated R07, R01/R08, and R03 successor semantics.

Do **not** freeze exact future:

- `model_version`
- `implementation_revision`

in this PR.

Those remain deferred until R09 is fully resolved and the corrected architecture
freeze begins.

---

## 21. Authorization flags

Record explicitly:

| Flag | Value |
|---|---|
| `production_change_authorized` | `false` |
| `term_successor_repair_authorized_for_production` | `false` |
| `provider_routing_rewrite_authorized` | `false` |
| `component_weight_change_authorized` | `false` |
| `factor_weight_change_authorized` | `false` |
| `stress_formula_coefficient_change_authorized` | `false` |
| `historical_reference_depth_frozen` | `false` |
| `model_version_change_authorized` | `false` |
| `successor_study_authorized` | `false` |

---

## 22. R09 status after this doc merges

| Lane / item | Status |
|---|---|
| R09-A | COMPLETE / PASS |
| R09-B | COMPLETE / MATERIAL REMAINDER CONFIRMED |
| PR #56 provider freshness | ACCEPTED / PRESERVED |
| Current row0 latest-funding assumption | REJECTED AS SUCCESSOR |
| Current 30-row == 30-day assumption | REJECTED AS SUCCESSOR |
| Current funding mean-vs-settlement percentile comparison | REJECTED AS SUCCESSOR |
| Current volatility horizon mismatch | REJECTED AS SUCCESSOR |
| Current positional Stress pairing | REJECTED AS SUCCESSOR |
| Current row0-centric cache detector | REJECTED AS SUFFICIENT SUCCESSOR CONTRACT |
| Aligned elapsed-window successor direction | SELECTED |
| Exact successor implementation contract | PENDING R09-C |
| Production repair | NOT ACTIVATED |
| R09 overall | **OPEN — R09-C REQUIRED** |

---

## 23. Next lane

After this documentation PR is independently reviewed and merged:

Proceed **ONLY** to:

**R09-C — bounded successor design / feasibility**

Do **not** begin the corrected architecture/version freeze yet.

Do **not** implement R07 / R01-R08 / R03 / R09 production repairs yet.

The roadmap requires R09 to be resolved before the corrected architecture freeze.
