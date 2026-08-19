# GhostGauge H4 Forward-Return Analysis Protocol

**Date:** 2026-08-18
**Phase:** H4 — pre-registration / design only
**Audited `origin/main`:** `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b`
**Branch:** `docs/h4-forward-return-protocol`
**Protocol version:** `h4-forward-return-v1`

**Status:** Frozen research protocol for the first legitimate forward-return analysis of the H3.1 Git observation archive. **No forward returns were calculated.** Calibration gate remains **CLOSED**.

Labels used below:

- **FACT** — verified from Git objects at the analysis source SHA, or inherited from H1 / H3 / H3.1 records re-checked here
- **PROTOCOL DECISION** — frozen before any return values are seen; changing it requires a new protocol version
- **LIMITATION** — a bound on what H4.1 may claim even after results exist

H3.1 Daily Rule v1, artifact identity, and generated manifests are **not** reopened. This document does **not** implement H4.1.

---

## 1. Executive purpose

**PROTOCOL DECISION.** H4 exists so that return definitions, sample eligibility, score groupings, model-version treatment, horizons, and exclusions are frozen **before** anyone sees outcome numbers.

The future first study (H4.1) is a **descriptive forward-return analysis** of Daily Rule v1 `DAILY_PRIMARY` observations against a pinned Bitcoin completed-UTC-close series.

**LIMITATION.** H4.1 will not prove causality, will not validate current `v1.1.1` as a trading model, will not calibrate weights or bands, and will not be a strategy backtest.

---

## 2. Why the protocol is frozen before results

**PROTOCOL DECISION.** After results are visible, the project must not add horizons, change start/end prices, merge bands, drop inconvenient dates, invent a “v1.1 era,” switch to log returns, or run alternative correlations merely because the first numbers are inconvenient.

H4 therefore pre-registers:

- which rows may enter
- which price is the start
- which price is the end
- which formula is the return
- which horizons are calculated
- G-Score validity
- arithmetic summaries, Type-7 quantiles, and Spearman ranks
- which summaries are primary vs secondary
- how pre-registered groups with `n = 0` are retained and serialized
- which questions are out of scope

**LIMITATION.** Independent review of this protocol must complete before H4.1 implementation. Seeing results first would defeat the purpose of H4.

---

## 3. Analysis source SHA

**PROTOCOL DECISION.** Future H4.1 must read inputs from Git objects at:

```text
ANALYSIS_SOURCE_SHA = 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b
```

This is the `origin/main` merge that froze the H3.1 research archive. It is **not** the H3.1 builder’s internal `source_main_sha` (`c29601abff2252a553ef12c5ed843ea705f9956f`), which names the Git history the observation builder walked.

**FACT.** `public/data/btc_price_history.csv` continues to grow in later Daily ETL commits. H4.1 must **not** read the moving working-tree file.

**PROTOCOL DECISION.** H4.1 must conceptually use:

```text
git show 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b:research/historical-observations/daily_analytical_view.csv
git show 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b:public/data/btc_price_history.csv
```

Windows checkouts may rewrite line endings. Hashing or parsing the working tree is not the reproducibility contract. Git blob bytes are.

---

## 4. Input-file identities / hashes

**FACT.** At `ANALYSIS_SOURCE_SHA`:

| Input | Git blob SHA | SHA-256 of Git blob bytes |
|---|---|---|
| `research/historical-observations/daily_analytical_view.csv` | `95d4292580fb13c569efb4b618c3be8226d32948` | `375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9` |
| `public/data/btc_price_history.csv` | `e472247d7099e3e999daa99917864e92477213b5` | `85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44` |

The BTC-history blob SHA matches the H4 expected identity `e472247d7099e3e999daa99917864e92477213b5`.

The daily-view SHA-256 matches the frozen H3.1 generated-file hash. These hashes are **metadata identities only**. They were not produced by return arithmetic.

**PROTOCOL DECISION.** H4.1 must refuse to run if either Git blob SHA or SHA-256 differs from this table.

H4 inspected `artifact_manifest.csv` only for inherited H3.1 identity/assertions. Factor rows are **not** an H4.1 input.

---

## 5. H3.1 analytical population

**PROTOCOL DECISION.** The primary analytical population is **only** `daily_analytical_view` rows where `selection_status = DAILY_PRIMARY`.

**FACT.** At the pinned daily view:

| Status | Count | Dates / notes |
|---|---|---|
| Calendar rows | **338** | 2025-09-15 through 2026-08-18 inclusive |
| `DAILY_PRIMARY` | **323** | sole primary analysis population |
| `REVIEW_REQUIRED` | **4** | 2025-09-15, 2025-09-16, 2025-09-17, 2025-09-18 |
| `NO_DAILY_PRIMARY` | **11** | 2026-01-14, 03-06, 03-29, 03-30, 04-04, 04-05, 04-06, 04-12, 05-25, 06-01, 06-20 |

**PROTOCOL DECISION.** Exclude `REVIEW_REQUIRED` and `NO_DAILY_PRIMARY` from all primary forward-return analyses. Do **not** select a substitute artifact. Do **not** use same-date alternates, human feature blobs, reconstruction artifacts, or current production `history.csv` substitutions.

Daily Rule v1 remains frozen:

1. earliest eligible scheduled
2. else documented verified recovery
3. else documented verified manual print
4. else `REVIEW_REQUIRED` / `NO_DAILY_PRIMARY`

**FACT — inherited H3.1 assertions that H4.1 must keep:**

- **2025-09-26:** `e9083962fcac56e305dff66810b9c5a7fceed394` G47 Hold/Neutral is the observation. Not reconstruction-path `latest.json` G67. Not reconstructed `history.csv` G85.
- **2025-10-29:** `5c4535b2a8cc43ca52c74e66bba630b899c8cb09` G55 is the observation. `54d054b1` G57 remains artifact context only.
- **2026-08-17:** `db789cd9c59b474044d428bfdccbe07312798236` G47 `verified_recovery` is the observation.
- October 7–28 remain 22/22 research scheduled primaries and remain absent from production `history.csv`.

---

## 6. BTC market-outcome source audit

**PROTOCOL DECISION.** Market outcomes come **only** from pinned `public/data/btc_price_history.csv` at `ANALYSIS_SOURCE_SHA`.

**FACT.** Schema is `date_utc,close_usd,source,ingested_at_utc`.

**FACT.** Coverage audit of the pinned Git blob (counts only):

| Check | Result |
|---|---|
| Row count | **731** |
| Unique `date_utc` | **731** |
| First date | **2024-08-17** |
| Last date | **2026-08-17** |
| Duplicate dates | **0** |
| Missing UTC calendar dates in range | **0** |
| Null / non-finite / non-positive `close_usd` | **0** |
| Source `coinbase_historical` | **716** (2024-08-17 through 2026-08-02) |
| Source `coinbase` | **15** (2026-08-03 through 2026-08-17) |

Actual pinned coverage matches the expected 2024-08-17 through 2026-08-17 window of 731 completed UTC daily observations.

**FACT (H1, preserved).** This file is Grade-B **market-outcome** evidence. Historical rows were ingested later (bulk `ingested_at_utc` 2026-08-17, with later `coinbase` rows ingested 2026-08-18). That is acceptable for an external market series because H4.1 will **not** use it to recreate historical G-Scores.

**LIMITATION.** Do not imply that the market-history file existed historically in its current form. It is **not** publication-time proof for old G-Scores.

**PROTOCOL DECISION.** Do not repair, interpolate, or extend this series in H4 or H4.1.

---

## 7. Start-price contract

**PROTOCOL DECISION.** Primary H4.1 start price is `daily_analytical_view.price_usd` on the selected `DAILY_PRIMARY` row.

Name: **`artifact_spot_start_price`**.

Rationale:

- it is the price recorded with the actual G-Score artifact
- it existed at observation time
- it avoids using a same-day UTC close that can occur **after** the signal
- it preserves the information state of the selected print

**PROTOCOL DECISION.** Every eligible daily primary must have `price_usd` present, finite, and `> 0`. If not, that row is start-price-ineligible. Do **not** silently substitute a historical daily close.

**FACT.** Among 323 `DAILY_PRIMARY` rows, **323** have a valid start price. Missing/invalid start-price dates: **none**.

Protocol finalization is **not** stopped for start-price holes.

**PROTOCOL DECISION.** Reject as the primary start price:

- `close_usd` on observation date D
- previous-day close

**LIMITATION.** Many G-Score observations occurred intraday. The completed UTC close on D can occur after publication. Previous-day close would be known information but would not be the price that accompanied the published observation.

Alternative start-price definitions may be considered only in a separately pre-registered future robustness phase.

---

## 8. Endpoint-price contract

**PROTOCOL DECISION.** For horizon N:

```text
target_date = observation_date + N UTC calendar days
end price   = btc_price_history.close_usd where date_utc = target_date
```

Do **not**:

- interpolate
- use nearest / next / previous available date
- query an API
- use current BTC price
- extend the market series

**PROTOCOL DECISION.** If the expected target date is missing from the pinned series, that observation is outcome-ineligible **for that horizon only**. Report the missing date. Do not repair it.

**FACT.** Bitcoin trades every calendar day. The pinned series is UTC-contiguous from 2024-08-17 through 2026-08-17.

---

## 9. Calendar-horizon semantics

**PROTOCOL DECISION.** Horizons are **UTC calendar days**, not trading sessions and not exact elapsed hours.

**LIMITATION.** The start is an intraday artifact snapshot (`observation_as_of_utc` / artifact spot). The endpoint is the completed UTC close on calendar date `D+N`. Elapsed hours therefore vary with observation time. The metric must be named:

**N-calendar-day forward-close return**

not “exact N-day return.”

---

## 10. Return formula

**PROTOCOL DECISION.** Primary H4.1 formula:

```text
forward_return_Nd = (end_close_usd / artifact_spot_start_price) - 1
```

Use **simple return**. Outputs may show both decimal and percentage. Do **not** substitute log returns.

**LIMITATION.** This is a price-path return of Bitcoin after a published G-Score. It is not a strategy return, not a funded-P&L series, and not a model-replay score.

H4 calculated **zero** of these values.

---

## 11. Fixed horizons

**PROTOCOL DECISION.** Primary calculated horizons, established before performance analysis:

| Horizon | Role in H4.1 |
|---|---|
| 30 calendar days | primary |
| 90 calendar days | primary |
| 180 calendar days | primary |
| 365 calendar days | schema / coverage reporting **only** |

**FACT.** Completed 365-day outcome n at this snapshot is **0**.

**PROTOCOL DECISION.** Do **not** calculate 365d performance. Do **not** add 7d, 14d, 21d, 45d, 60d, 120d, 270d, or any other horizon after seeing results. A new horizon requires a new protocol version **before** calculation.

---

## 12. Eligibility reconciliation

**PROTOCOL DECISION.** Date rule for horizon N:

```text
observation_date + N days <= 2026-08-17
```

That pinned market last date is a data-snapshot bound, not a claim that Bitcoin stopped trading.

**FACT.** Independent H4 count verification of `DAILY_PRIMARY` date-eligibility (no return values):

| Horizon | Date-eligible n | Expected H3.1 | Missing endpoint dates | Invalid start among date-eligible |
|---|---|---|---|---|
| 30d | **292** | 292 | 0 | 0 |
| 90d | **235** | 235 | 0 | 0 |
| 180d | **152** | 152 | 0 | 0 |
| 365d | **0** | 0 | 0 | 0 |

Counts match. No STOP.

**PROTOCOL DECISION.** Future H4.1 must publish this reconciliation for every horizon:

```text
338 calendar rows
323 DAILY_PRIMARY
4 REVIEW_REQUIRED   (excluded)
11 NO_DAILY_PRIMARY (excluded)
then:
DAILY_PRIMARY horizon-eligible by date
minus invalid/missing start price
minus missing endpoint close
minus invalid G-Score (must STOP, not silently drop)
equals final return n
```

No silent row dropping. List exact dates and causes if missingness appears.

**PROTOCOL DECISION.** An invalid G-Score on a `DAILY_PRIMARY` row is a **hard stop**, not a repair. H4.1 must not round, clamp, substitute, or drop that row in order to continue.

**FACT.** At this snapshot, expected start/end/score missingness for the three primary horizons is **zero**. Final return n is therefore expected to equal the date-eligible counts above **after** H4.1 computes returns. H4 itself stops at the counts.

---

## 13. Implementation / model-version boundaries

**PROTOCOL DECISION.** Do not pretend the 323 observations came from one immutable scoring implementation. Every future row retains `model_version`, `implementation_revision`, `operational_role`, `evidence_grade`, and `observation_date`.

Rules:

A. Do not invent a v1.1 methodology start.
B. `model_version = v1.1` is a **label only** from the date artifacts actually contain that label.
C. The Aug 16 / Aug 17 `v1.1` → `v1.1.1` boundary remains explicit (last verified v1.1 print 2026-08-16; first verified v1.1.1 print 2026-08-17).
D. A market outcome may extend across a later implementation change. That does **not** contaminate the market return. The signal remains attributed to the model/version present on its observation date.
E. Never describe historical `v3.1.0` / `v1.1` results as validated performance of current `v1.1.1`.

Use: **historical GhostGauge lineage**, or equally precise wording.

**LIMITATION.** Git existence is not proof that Vercel served the artifact. `deployment_status` remains `UNKNOWN` in H3.1.

---

## 14. Primary research question

**PROTOCOL DECISION.** Freeze before results:

> Within Daily Rule v1 historical GhostGauge observations, was a higher published G-Score associated with less favorable subsequent Bitcoin returns over the pre-specified 30-, 90-, and 180-calendar-day horizons?

This is **descriptive**.

It is **not** proof of causality, proof of current-model validity, proof of calibration, or a trading-strategy backtest.

Higher G-Score means higher assessed risk. The expected directional relationship is generally higher score → less favorable subsequent return. The analysis must report what the data show without forcing that result.

---

## 15. Continuous-score analysis

**PROTOCOL DECISION.** H4.1 primary score analysis, for each of 30/90/180 days separately:

- n
- arithmetic mean forward return
- median forward return = Type-7 Q(0.50)
- p25 = Type-7 Q(0.25)
- p75 = Type-7 Q(0.75)
- minimum
- maximum
- Spearman rho of G-Score vs forward return (average-rank ties; null if zero variance)

Spearman is used because the score is bounded, the relationship need not be linear, and a 10-point score difference need not have a constant economic effect.

**PROTOCOL DECISION.** Do **not** compute Pearson correlation of the raw (unranked) series as an alternate primary test. Do **not** run regression in H4.1 primary analysis. Do **not** calculate a p-value, confidence interval, or significance label.

### 15.1 G-Score validity gate (counts only in H4)

**PROTOCOL DECISION.** H4.1 uses the published integer G-Score from `daily_analytical_view.score`. Before any return is calculated, each `DAILY_PRIMARY` score must be present, numeric, finite, an integer, and in `[0, 100]` inclusive.

Do **not** round a non-integer score, clamp an out-of-range score, or substitute native band text.

**FACT.** Audit of the 323 `DAILY_PRIMARY` rows at `ANALYSIS_SOURCE_SHA` (score field only; no return arithmetic):

| Check | Count |
|---|---|
| `valid_score_count` | **323** |
| `missing_score_count` | **0** |
| `non_numeric_score_count` | **0** |
| `non_integer_score_count` | **0** |
| `out_of_range_score_count` | **0** |

All 323 scores are integers in 0–100 inclusive. No STOP.

### 15.2 Arithmetic summaries

**PROTOCOL DECISION.** For each eligible horizon:

- `n` = number of valid forward-return observations in that horizon
- `mean` = ordinary arithmetic mean of those unrounded simple returns
- `minimum` = smallest observed simple return
- `maximum` = largest observed simple return

Do not trim, winsorize, or exclude outliers. Do not use a geometric mean. Do not annualize.

The same arithmetic-mean definition applies to the secondary numeric-band and model-version views wherever `mean` is reported.

### 15.3 Type-7 quantiles (median, p25, p75)

**PROTOCOL DECISION.** Median, p25, and p75 use the same deterministic linear-interpolation / Hyndman–Fan Type 7 convention.

Sort the unrounded simple returns ascending as `x[0] … x[n-1]`. For probability `p` in `[0, 1]`:

```text
h = (n - 1) * p
j = floor(h)
g = h - j
If j + 1 < n:
  Q(p) = x[j] + g * (x[j+1] - x[j])
Otherwise:
  Q(p) = x[j]
```

```text
median = Q(0.50)
p25    = Q(0.25)
p75    = Q(0.75)
```

When `n` is odd, Q(0.50) lands on the middle observation (`g = 0`). When `n` is even, Q(0.50) interpolates between the two central observations.

Use this same method for `summary_by_horizon` and `summary_by_numeric_band`. Do not choose a percentile method based on results.

### 15.4 Spearman implementation

**PROTOCOL DECISION.** Spearman rho is the **sample Pearson correlation of the ranks** of G-Score and forward return. Rank each variable independently.

For ties, assign every tied value the arithmetic mean of the 1-based rank positions it occupies.

Example: values `10, 20, 20, 40` receive ranks `1, 2.5, 2.5, 4`.

Do **not** use first/minimum/maximum/dense rank or random tie-breaking.

Sample Pearson of ranks `rx`, `ry`:

```text
rho = Σ(rx_i - mean(rx)) (ry_i - mean(ry))
      / sqrt( Σ(rx_i - mean(rx))²  ·  Σ(ry_i - mean(ry))² )
```

No p-value. No confidence interval. No significance label. Do not emit a Pearson correlation of the unranked series.

### 15.5 Zero-variance Spearman

**PROTOCOL DECISION.** If either rank vector has zero variance within a horizon (the Pearson denominator is zero), Spearman rho is **UNDEFINED**.

Represent rho as an empty/null CSV field. Emit an explicit status/reason such as:

```text
UNDEFINED_ZERO_VARIANCE
```

Do **not** emit `0`, `NaN`, or `Infinity`. Do not invent a correlation. This rule is frozen before seeing results.

### 15.6 Numeric precision / rounding

**PROTOCOL DECISION.**

- Calculate returns from source prices at their stored precision.
- Calculate all summaries and correlations from **unrounded** return values.
- Never round individual returns before aggregation.
- Never round ranks before correlation.
- Rounding is presentation/serialization only.
- A displayed rounded value must never be fed back into another calculation.

The future H4.1 README must disclose whatever deterministic serialization precision it uses. Do not choose internal precision based on output appearance.

### 15.7 Reporting universe, empty groups, and small-n status

**PROTOCOL DECISION.** Pre-registered summary groups are a **reporting universe**, not a post-hoc list of groups that happened to have completed outcomes.

**Primary row universe.** `summary_by_horizon.csv` and `score_association.csv` contain **exactly three rows**: horizons `30`, `90`, and `180`. One row per horizon regardless of any later statistical edge case. Horizon `365` is coverage-only and must **not** appear as a calculated performance row.

**Empty-group statistics.** If `n = 0` for a pre-registered group:

```text
n      = 0
mean   = empty/null
median = empty/null
p25    = empty/null
p75    = empty/null
minimum = empty/null   (when that statistic applies)
maximum = empty/null   (when that statistic applies)
Spearman = empty/null  (when that statistic applies)
status = NO_COMPLETED_OUTCOMES
```

No quantile algorithm is invoked on an empty vector. No divide-by-zero arithmetic is attempted. Do **not** serialize `0`, `NaN`, or `Infinity` as a substitute for an undefined statistic.

This empty-group rule is distinct from §15.5: `UNDEFINED_ZERO_VARIANCE` applies when `n >= 1` but a rank vector has zero variance. `NO_COMPLETED_OUTCOMES` applies when `n = 0`.

**Small-n status.**

| Condition | Status |
|---|---|
| `n = 0` | `NO_COMPLETED_OUTCOMES` |
| `1 <= n < 20` | `SMALL N — DESCRIPTIVE ONLY` |
| `n >= 20` | normal descriptive row (no small-n flag) |

Do not call an empty group merely “small n.”

**Primary horizon zero-n safety.** Expected primary horizon n at this snapshot remains 30d = 292, 90d = 235, 180d = 152. No primary horizon is currently empty. If a future implementation discrepancy somehow produces `n = 0` for a pre-registered primary horizon: keep the horizon row; all undefined statistics are null; `status = NO_COMPLETED_OUTCOMES`; do not substitute another horizon; do not change the protocol. If that discrepancy contradicts frozen eligibility counts, H4.1 must also **STOP** and report the inconsistency.

---

## 16. Overlapping-return limitation

**LIMITATION.** Daily observations with 30/90/180-day forward returns overlap heavily. Observations are **not** statistically independent.

**PROTOCOL DECISION.** H4.1 must **not** use naive t-tests, ordinary independent-observation standard errors, ordinary correlation p-values, or “statistically significant” claims.

The first analysis is descriptive. If statistical inference is wanted later, create a **separate protocol before running it**. That future protocol would need to address temporal dependence explicitly (for example block methods / HAC). H4 does not choose or run that inference.

---

## 17. Fixed numeric-band secondary analysis

**PROTOCOL DECISION.** Historical native band labels changed across the project. Do **not** treat historical band text as a stable cross-era grouping.

For a **secondary** descriptive view only, freeze `v1.1.1_numeric_band_crosswalk` with exact deterministic predicates on the **published integer G-Score**:

| Predicate | Crosswalk label |
|---|---|
| `0 <= score <= 14` | Aggressive Buying |
| `15 <= score <= 34` | Regular DCA Buying |
| `35 <= score <= 49` | Moderate Buying |
| `50 <= score <= 64` | Hold & Wait |
| `65 <= score <= 79` | Reduce Risk |
| `80 <= score <= 100` | High Risk |

These predicates are equivalent to the current v1.1.1 integer score boundaries in `config/dashboard-config.json`. That equivalence does **not** claim that historical artifacts originally used these labels.

**PROTOCOL DECISION.** H4.1 must **not** round a non-integer score into a band, clamp an out-of-range score, or infer a band from native text. The §15.1 validity gate makes this mapping exhaustive for every admitted G-Score.

For each horizon × frozen band report only: n, arithmetic mean, Type-7 median, Type-7 p25, Type-7 p75.

**PROTOCOL DECISION.** `summary_by_numeric_band.csv` emits **exactly 18 rows**: the three calculated horizons (`30`, `90`, `180`) × the six frozen bands above, in that band order. Do **not** omit a band because `n = 0`. Do **not** combine it with another band. An empty band/horizon row uses the §15.7 `n = 0` / `NO_COMPLETED_OUTCOMES` serialization. Do not optimize the cutoffs after seeing sample sizes. If `1 <= n < 20`, mark `SMALL N — DESCRIPTIVE ONLY` and still report the row.

---

## 18. Native-band provenance

**PROTOCOL DECISION.** Preserve each artifact’s native `band` for provenance and row-level research output.

Do **not** use native band text as the primary cross-era analytical grouping. Do not normalize old labels into current labels except through the explicitly separate numeric crosswalk in §17.

---

## 19. Model-version secondary analysis

**PROTOCOL DECISION.** One secondary lineage check: for each horizon × **exact artifact `model_version`**, report n, arithmetic mean, and Type-7 median only.

The grouping universe is established from the **full 323 `DAILY_PRIMARY` population before horizon outcome filtering**. Do not infer methodology eras. Do not combine or rename versions merely to improve results. Do not create a synthetic “v1.1 era” before its explicit artifact label. Do not calculate model-version significance tests. Do not infer or add another version.

**FACT.** Among 323 `DAILY_PRIMARY` rows, `model_version` is present on **323** and missing on **0**. Exact observed labels at this pinned snapshot: `v3.1.0` 83, `v1.1` 238, `v1.1.1` 2. These are label counts only, not performance.

**PROTOCOL DECISION.** Because this pinned snapshot has zero missing `model_version` values, `MISSING` does **not** receive a summary row unless a missing value actually exists in the frozen analytical population. The missing-value rule itself is retained: if a missing label appears, it forms an explicit `MISSING` group and must not silently disappear; missing `model_version` still must **not** drop the observation from the primary horizon analysis. Do not infer a version from date, commit, config, or methodology assumptions.

**PROTOCOL DECISION.** At this H4 snapshot, `summary_by_model_version.csv` emits **exactly 9 rows**: horizons `30`, `90`, `180` × groups `v3.1.0`, `v1.1`, `v1.1.1`. Emit every combination even when `n = 0`.

**FACT (date eligibility only, no return arithmetic).** The two `v1.1.1` `DAILY_PRIMARY` dates are 2026-08-17 and 2026-08-18. Neither satisfies `observation_date + 30/90/180 <= 2026-08-17`. Therefore each of those three horizon × `v1.1.1` rows must appear with `n = 0` and `status = NO_COMPLETED_OUTCOMES`. Do **not** omit `v1.1.1` because it lacks completed outcomes.

If `1 <= n < 20` for a version/horizon group, mark **`SMALL N — DESCRIPTIVE ONLY`**. Do not suppress it. Do not call an `n = 0` group merely “small n.”

---

## 20. Factor-analysis exclusion

**PROTOCOL DECISION.** H4.1 is **composite score only**.

Do **not** analyze Trend & Valuation, Stablecoins, ETF Flows, Net Liquidity, Term Structure, Macro, Social, or On-chain. Do not rank factor predictive power, test factor weights, or regress returns on individual factors.

**LIMITATION.** Factor-level work creates many additional hypotheses and multiple-comparison opportunities. If composite-level analysis later justifies factor research, create a separately pre-registered phase.

`factor_manifest.csv` is not an H4.1 input.

---

## 21. Forward returns vs broader risk validation

**LIMITATION.** Forward return is only one outcome dimension. GhostGauge is framed as a risk metric. A complete risk evaluation might eventually consider separately pre-registered outcomes such as subsequent maximum drawdown, realized volatility, downside volatility, or tail-event incidence.

**PROTOCOL DECISION.** Do **not** calculate those in H4 or H4.1. The first study is specifically **forward-return descriptive analysis**. Do not conclude “the G-Score works” or “the G-Score fails” solely from forward returns. Do not call H4.1 complete “risk validation.”

---

## 22. Missingness contract

**PROTOCOL DECISION.** Every horizon’s H4.1 output must include the §12 eligibility reconciliation. No silent dropping.

**FACT (H4 audit, counts only):**

- valid `DAILY_PRIMARY` start-price count: **323 / 323**
- missing/invalid start-price dates: **none**
- valid integer G-Score 0–100: **323 / 323**
- missing / non-numeric / non-integer / out-of-range G-Score dates: **none**
- `model_version` present: **323 / 323**; missing dates: **none**
- missing endpoint dates among date-eligible 30/90/180/365 observations: **none**

If H4.1 later finds a parse/implementation discrepancy, it must stop and list dates rather than impute.

---

## 23. Future H4.1 output schema

**PROTOCOL DECISION.** Do **not** create these files in H4.

Recommended later location: `research/forward-returns/`

| Future file | Role |
|---|---|
| `README.md` | human contract / how to rebuild |
| `forward_returns.csv` | one row per `DAILY_PRIMARY` × eligible horizon |
| `summary_by_horizon.csv` | primary continuous-score summaries; **exactly 3 rows** (`30`, `90`, `180`) |
| `summary_by_numeric_band.csv` | secondary crosswalk; **exactly 18 rows** (3 horizons × 6 bands) |
| `summary_by_model_version.csv` | secondary lineage; **exactly 9 rows** at this snapshot (3 horizons × `v3.1.0` / `v1.1` / `v1.1.1`) |
| `score_association.csv` | Spearman and distribution stats; **exactly 3 rows** (`30`, `90`, `180`) |
| `ANALYSIS_SOURCE_SHA.txt` | pin |
| `PROTOCOL_VERSION.txt` | `h4-forward-return-v1` |

Recommended `forward_returns.csv` fields:

```text
observation_date
primary_artifact_id
primary_artifact_commit_sha
observation_as_of_utc
g_score
native_band
numeric_band_crosswalk
model_version
implementation_revision
operational_role
evidence_grade
start_price_usd
start_price_source
horizon_days
target_date
end_close_usd
end_price_source
forward_return_decimal
forward_return_pct
analysis_source_sha
protocol_version
```

`start_price_source` must record `artifact_spot_price_usd`. `end_price_source` must record `btc_price_history.close_usd`. No field should contain an inferred model era.

Recommended `score_association.csv` must include Spearman rho as an empty field when undefined, plus an explicit status/reason (`OK`, `UNDEFINED_ZERO_VARIANCE`, or `NO_COMPLETED_OUTCOMES`). Do not serialize `NaN` or `Infinity`. Horizon `365` must not appear in these calculated summary files.

---

## 24. Reproducibility / deterministic implementation

**PROTOCOL DECISION.** Exact H4.1 implementation is a later task. Recommendation only:

- deterministic script under `scripts/research/`
- Node built-ins only
- read pinned Git objects at `ANALYSIS_SOURCE_SHA`, not the working tree
- verify blob SHA and SHA-256 before computing returns
- fail loudly on missing start price, missing endpoint, invalid G-Score, or hash mismatch
- apply Type-7 quantiles, average-rank Spearman, zero-variance null, and empty-group `NO_COMPLETED_OUTCOMES` rules from §15
- emit the frozen summary-row universes (3 / 18 / 9 rows) even when `n = 0`
- never round returns or ranks before aggregation
- stable CSV sort: `observation_date`, then `horizon_days`
- empty CSV field = null; never coerce null to `0`
- no network, no ETL, no live APIs, no Refresh Dashboard

Future H4.1 unit tests must cover:

- simple-return formula
- exact UTC D+N date arithmetic
- no same-day-close substitution
- G-Score validity gate
- all six numeric-band boundary predicates
- Type-7 quantiles
- even/odd median behavior
- Spearman without ties
- Spearman with score ties
- Spearman with return ties
- zero-variance Spearman ⇒ null + `UNDEFINED_ZERO_VARIANCE`
- no rounding before aggregation
- missing `model_version` secondary grouping as `MISSING` when a missing label exists
- empty numeric-band group retained with `n = 0`
- empty-group statistics serialize as null, not zero / `NaN` / `Infinity`
- fixed 18-row numeric-band summary universe
- fixed 9-row model-version summary universe at this H4 snapshot
- `v1.1.1` rows retained even with `n = 0`
- `n = 0` ⇒ `NO_COMPLETED_OUTCOMES`
- `1 <= n < 20` ⇒ `SMALL N — DESCRIPTIVE ONLY`

These are future H4.1 requirements. H4 does not add that script or those tests.

---

## 25. Protocol versioning

**PROTOCOL DECISION.** Frozen:

```text
protocol_version = h4-forward-return-v1
```

A future change to any of the following requires a **new** protocol version:

- start price
- endpoint price
- horizon
- daily population
- band cutoffs
- score grouping
- G-Score validity / integer mapping rule
- model-version grouping
- arithmetic summary definition
- Type-7 quantile / median algorithm
- Spearman rank, tie, or zero-variance rule
- empty-group reporting / summary-row universe
- rounding-before-aggregation rule
- correlation statistic
- inclusion/exclusion rule

Do not silently overwrite v1.

**PROTOCOL DECISION.** Pure bug fixes that do **not** change analytical semantics may retain v1 only after independent review (CSV escaping, deterministic sorting, error messages). Anything that changes which rows or values enter the analysis requires a new protocol version.

---

## 26. Future data accrual

**PROTOCOL DECISION.** New BTC prices must not silently expand the H4 sample.

H4 v1 is pinned to `ANALYSIS_SOURCE_SHA = 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` and its pinned BTC series ending **2026-08-17**.

Later analysis with more completed outcomes must be a new frozen analysis snapshot. Possible future label:

```text
h4-forward-return-v1-refresh-YYYY-MM-DD
```

The protocol may remain semantically v1 while the **data snapshot** receives an explicit new source/version identifier. Never replace the original H4.1 results silently.

---

## 27. Explicit non-goals

H4 and H4.1 must **not**:

- calculate returns in H4 (this phase)
- calculate log returns, drawdowns, hit rates, Spearman, or percentiles of returns in H4
- calculate regressions, p-values, or bootstrap tests
- optimize score thresholds, bands, weights, or factors
- select favorable horizons after seeing results
- run strategy simulations, allocations, Sharpe, CAGR, alpha, or portfolio drawdown
- modify the official model, H3.1 manifests, production data, app/lib/config, ETL, workflows, or package files
- run ETL, dispatch Daily ETL, call live APIs, or use Refresh Dashboard
- use `factor_manifest.csv` for predictive ranking
- treat this study as complete risk validation of GhostGauge
- describe historical lineage results as validated current-`v1.1.1` performance

---

## 28. H4.1 implementation recommendation

After independent H4 review — and only then — H4.1 should:

1. Pin `ANALYSIS_SOURCE_SHA` and refuse any other input snapshot.
2. Load Daily Rule v1 `DAILY_PRIMARY` rows from the pinned daily view.
3. Require valid `artifact_spot_start_price` and a valid integer G-Score in `[0, 100]`.
4. Join pinned `btc_price_history.close_usd` on exact `target_date`.
5. Compute simple N-calendar-day forward-close returns for 30/90/180 only, from unrounded source prices.
6. Emit row-level and summary CSVs from §23 using §15 arithmetic, Type-7 quantiles, Spearman rules, and frozen 3 / 18 / 9-row summary universes (retain `n = 0` groups).
7. Publish eligibility reconciliation from §12.
8. Run average-rank Spearman as the only primary association statistic, without p-values; emit null + `UNDEFINED_ZERO_VARIANCE` if either rank vector has zero variance; emit null + `NO_COMPLETED_OUTCOMES` if `n = 0`.
9. Keep native band, numeric crosswalk predicates, and exact `model_version` separate; retain `v1.1.1` rows at `n = 0`; emit secondary `MISSING` only if a missing label exists.
10. Leave calibration **CLOSED**.

Do **not** implement H4.1 on this branch.

---

## Appendix A. H4 coverage audit (counts only)

Performed against Git objects at `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b`. No return arithmetic.

| Item | Result |
|---|---|
| Daily calendar rows | 338 |
| `DAILY_PRIMARY` | 323 |
| `REVIEW_REQUIRED` | 4 (2025-09-15..18) |
| `NO_DAILY_PRIMARY` | 11 (listed in §5) |
| Valid start prices | 323 / 323 |
| Valid integer G-Score 0–100 | 323 / 323 |
| Invalid/missing G-Score | 0 |
| `model_version` present | 323 / 323 |
| `model_version` missing | 0 |
| BTC rows | 731, contiguous 2024-08-17..2026-08-17 |
| BTC sources | 716 `coinbase_historical`, 15 `coinbase` |
| 30d date-eligible | 292, 0 missing endpoints |
| 90d date-eligible | 235, 0 missing endpoints |
| 180d date-eligible | 152, 0 missing endpoints |
| 365d date-eligible | 0 |
| Primary summary rows (future) | 3 (`30`, `90`, `180`); 365 not a performance row |
| Numeric-band summary rows (future) | 18 |
| Model-version summary rows (future, this snapshot) | 9 (`v3.1.0`, `v1.1`, `v1.1.1` × 3 horizons) |

Calibration gate: **CLOSED**.
