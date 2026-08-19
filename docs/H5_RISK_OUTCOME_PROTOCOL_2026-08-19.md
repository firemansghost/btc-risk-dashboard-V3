# GhostGauge H5 Risk-Outcome Analysis Protocol

**Date:** 2026-08-19
**Phase:** H5 — pre-registration / design only
**Audited `origin/main`:** `828054cd2080f1d657ba86d55c1e2e693b7fd317`
**Branch:** `docs/h5-risk-outcome-protocol`
**Protocol version:** `h5-risk-outcome-v1`

**Status:** Frozen research protocol for the first direct GhostGauge risk-outcome analysis of the H3.1 Git observation archive. **No risk outcomes were calculated.** Calibration gate remains **CLOSED**.

Labels used below:

- **FACT** — inherited from H3.1 / H4 / H4.1 frozen records, or from pinned Git object identities
- **PROTOCOL DECISION** — frozen before any risk-outcome values are seen; changing it requires a new protocol version
- **LIMITATION** — a bound on what H5.1 may claim even after results exist

This document does **not** implement H5.1. It does **not** modify `docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md`, `docs/H4_1_FORWARD_RETURN_INTERPRETATION_2026-08-19.md`, `research/forward-returns/**`, or `research/historical-observations/**`.

---

## 1. Executive purpose

**PROTOCOL DECISION.** H5 exists so that risk-outcome definitions, sample eligibility, score groupings, model-version treatment, horizons, and exclusions are frozen **before** anyone sees downside-path, drawdown, volatility-family, or tail-event numbers.

The future first study (H5.1) is a **descriptive close-based risk-outcome analysis** of Daily Rule v1 `DAILY_PRIMARY` observations against the same pinned Bitcoin completed-UTC-close series used by H4/H4.1.

**PROTOCOL DECISION.**

```text
PROTOCOL_VERSION = h5-risk-outcome-v1
ANALYSIS_SOURCE_SHA = 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b
```

**LIMITATION.** H5.1 will not prove causality, will not validate current `v1.1.1`, will not calibrate weights or bands, will not measure true intraday MAE or true intraday maximum drawdown, and will not be a strategy backtest.

---

## 2. Why direct risk outcomes are being tested

**FACT.** H4.1 tested terminal forward Bitcoin return. The frozen historical sample did not show the expected G-Score-to-forward-return ordering. H4.1 did not calculate drawdowns, volatility, downside volatility, or tail-event incidence.

**PROTOCOL DECISION.** H5 asks a different question, closer to the intended purpose of a risk gauge:

> When GhostGauge published a higher G-Score, was the subsequent Bitcoin path associated with greater downside risk and/or greater close-to-close price instability?

**PROTOCOL DECISION.** H5 uses the **same** frozen analytical population and **same** frozen Bitcoin market series as H4/H4.1 so that it tests a different outcome concept rather than quietly changing the historical sample after H4.1 results were seen.

**LIMITATION.** Later data accrual requires a separately frozen future snapshot. Mixing later observations into this H5 snapshot is forbidden.

---

## 3. Analysis source and input identities

**PROTOCOL DECISION.** Future H5.1 must read Git object bytes at `ANALYSIS_SOURCE_SHA`, not moving working-tree copies.

**FACT.** At `ANALYSIS_SOURCE_SHA`:

| Input | Path | Git blob SHA | SHA-256 of Git blob bytes |
|---|---|---|---|
| Daily analytical view | `research/historical-observations/daily_analytical_view.csv` | `95d4292580fb13c569efb4b618c3be8226d32948` | `375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9` |
| BTC price history | `public/data/btc_price_history.csv` | `e472247d7099e3e999daa99917864e92477213b5` | `85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44` |

**PROTOCOL DECISION.** H5.1 must conceptually use:

```text
git show 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b:research/historical-observations/daily_analytical_view.csv
git show 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b:public/data/btc_price_history.csv
```

**PROTOCOL DECISION.** Any identity mismatch in H5.1 is a hard STOP. Do not repair, interpolate, or silently accept a later main SHA.

**PROTOCOL DECISION.** `factor_manifest.csv` is **not** an H5 input.

---

## 4. Analytical population and G-Score validity

**PROTOCOL DECISION.** Use only `selection_status = DAILY_PRIMARY`.

**FACT.** Frozen H3.1 / H4 population at the analysis source SHA:

- 338 calendar rows
- 323 `DAILY_PRIMARY`
- 4 `REVIEW_REQUIRED`
- 11 `NO_DAILY_PRIMARY`

**PROTOCOL DECISION.** Exclude `REVIEW_REQUIRED` and `NO_DAILY_PRIMARY`. No substitutions, same-date alternates, reconstruction artifacts, or production `history.csv` score substitution. Daily Rule v1 remains authoritative.

**PROTOCOL DECISION.** Special observation anchors remain as in H3.1 / H4:

- **2025-09-26:** commit `e9083962fcac56e305dff66810b9c5a7fceed394`, G47, artifact spot `108739.09`. Do not substitute reconstruction G67 or `history.csv` G85.
- **2025-10-29:** commit `5c4535b2a8cc43ca52c74e66bba630b899c8cb09`, G55. Do not substitute human G57 as primary.
- **2026-08-17:** commit `db789cd9c59b474044d428bfdccbe07312798236`, G47 verified recovery. No completed 30/90/180 window exists at the pinned BTC-history end date.

**PROTOCOL DECISION.** For all observation-anchored downside measures:

```text
start_price = daily_analytical_view.price_usd
start_price_source = artifact_spot_price_usd
```

Require finite and `> 0`. Do **not** use same-day completed close as signal start, previous-day close, or current price.

**PROTOCOL DECISION.** H5 uses G-Score for primary Spearman ranking, secondary Spearman rankings, and numeric-band assignment. Carry forward H4’s exact validity contract. **Before ANY H5.1 risk arithmetic**, every `DAILY_PRIMARY` score must be:

- present
- numeric
- finite
- integer
- `>= 0`
- `<= 100`

Any invalid `DAILY_PRIMARY` G-Score is a **HARD STOP**. Do **not** round, clamp, substitute, infer from native band, or silently drop the row.

**FACT.** Inherited H4 input-integrity facts (not new risk-outcome calculations):

```text
323 DAILY_PRIMARY
valid_score_count = 323
missing_score_count = 0
non_numeric_score_count = 0
non_integer_score_count = 0
out_of_range_score_count = 0
```

---

## 5. Market-data resolution limitation and BTC path validity

**FACT.** The pinned BTC market series columns are:

- `date_utc`
- `close_usd`
- `source`
- `ingested_at_utc`

It does **not** contain intraday high, intraday low, or an intraday path.

**LIMITATION.** H5 must **not** claim to measure true **intraday** maximum adverse excursion or true **intraday** maximum drawdown.

**PROTOCOL DECISION.** Use explicit terminology:

- **MAXIMUM ADVERSE CLOSE EXCURSION** (MACE)
- **MAXIMUM CLOSE DRAWDOWN** (MCDD)

These are completed-UTC-close-based path measures.

**LIMITATION.** A future OHLC/intraday study would require a separately pre-registered data source and protocol.

**PROTOCOL DECISION.** H5.1 must fail loudly if a required BTC path close is invalid. For every required `D` through `D+N` path close require:

- exact date exists
- exactly one row for the date
- `close_usd` present
- numeric
- finite
- `> 0`

No interpolation, nearest date, duplicate-date selection, zero close, negative close, `NaN` / `Infinity`, or silent row dropping.

**FACT.** Inherited frozen BTC input audit at the analysis source SHA (not a new risk-outcome calculation):

```text
731 rows
731 unique dates
first date = 2024-08-17
last date = 2026-08-17
duplicate dates = 0
missing UTC dates in range = 0
null / nonfinite / nonpositive closes = 0
```

**PROTOCOL DECISION.** Future H5.1 must reassert those pinned-input invariants **before** any outcome arithmetic. If they differ: **STOP**.

---

## 6. Horizons, eligibility, and reconciliation

**PROTOCOL DECISION.** Calculated horizons exactly: **30**, **90**, **180** UTC calendar days. **365** is coverage only. No H5.1 365 risk rows. No additional horizons.

**FACT.** Expected completed-horizon eligibility at this snapshot, inherited from H4 because H5 uses the same frozen population and outcome series:

| Horizon | Eligible `DAILY_PRIMARY` |
|---|---|
| 30 | 292 |
| 90 | 235 |
| 180 | 152 |
| 365 | 0 |

Total row-level H5.1 observations: `292 + 235 + 152 = 679`.

**PROTOCOL DECISION.** An observation is horizon-eligible only when **every** required completed daily close from `D` through `D+N` inclusive exists in the pinned BTC series.

**FACT.** The pinned series was audited contiguous. Expected missing internal path dates for eligible observations: **0**.

**PROTOCOL DECISION.** If H5.1 later finds a missing path date: **STOP**. Do not interpolate or substitute.

**PROTOCOL DECISION.** Explicit H5.1 horizon reconciliation. For each horizon:

```text
323 DAILY_PRIMARY
then date/path eligible
minus invalid start price
minus missing/invalid path close
minus invalid G-Score — HARD STOP, not drop
equals final H5.1 n
```

Frozen expected final n:

```text
30 = 292
90 = 235
180 = 152
total = 679
365 = 0
```

Any discrepancy: **STOP** and list exact dates / causes. Do not silently continue with a smaller population.

---

## 7. Primary research question

**PROTOCOL DECISION.** The **PRIMARY** H5 question is:

> Within Daily Rule v1 historical GhostGauge observations, was a higher published G-Score associated with a larger subsequent Maximum Adverse Close Excursion magnitude over the pre-specified 30-, 90-, and 180-calendar-day horizons?

**PROTOCOL DECISION.** Expected directional relationship:

higher G-Score → larger adverse-close-excursion magnitude

Therefore expected primary Spearman direction: **POSITIVE**.

**PROTOCOL DECISION.** Do not change this sign interpretation after results. No numerical “useful” cutoff is pre-registered. Do not invent strength categories such as weak / moderate / strong unless a separate pre-results convention is frozen.

**PROTOCOL DECISION.** Frozen sign-vs-usefulness distinction:

| Observed Spearman | Allowed description |
|---|---|
| `rho > 0` | directionally concordant with the pre-registered risk ordering |
| `rho = 0` | no monotonic ordering in the frozen sample |
| `rho < 0` | directionally opposite the pre-registered risk ordering |

A positive sign **alone** does **not** establish useful discrimination, strong association, validation, calibration, or economic significance.

Future H5.1 interpretation must:

- report the exact rho
- describe its magnitude cautiously
- state whether the sign is concordant or discordant
- consider sample coverage / overlap limitations
- **not** convert merely `rho > 0` into “GhostGauge worked”

A small negative or zero result must be reported exactly. No post-hoc promotion of MCDD or the volatility family if MACE is weak.

---

## 8. Primary MACE definition

**PROTOCOL DECISION.** Name: `maximum_adverse_close_excursion_magnitude`. Short label: **MACE**. This is **not** intraday MAE.

For observation date `D`, horizon `N`, artifact start price `S`:

Create the post-observation completed-close path:

```text
C_D, C_D+1, ..., C_D+N
```

where `C_x` is `btc_price_history.close_usd` for exact UTC date `x`. Include artifact start price `S` as the time-zero baseline.

```text
minimum_path_price = min(S, C_D, C_D+1, ..., C_D+N)
MACE = 1 - (minimum_path_price / S)
```

Properties:

- MACE is non-negative
- MACE = 0 if no completed close falls below artifact spot
- MACE = 0.20 means the worst completed UTC close in the window was 20% below the artifact spot price

**PROTOCOL DECISION.** Do not convert to absolute dollars for primary analysis. Do not use intraday lows. Do not use terminal `D+N` return as MACE.

---

## 9. Primary score association

**PROTOCOL DECISION.** For each horizon independently, Spearman correlation between G-Score and MACE magnitude.

Rank conventions **must match H4**:

- independent rank vectors
- 1-based conceptual ranks
- ties receive the arithmetic mean of occupied ranks
- rho = Pearson correlation of those rank vectors

**PROTOCOL DECISION.** No p-value. No confidence interval. No significance label.

If either rank vector has zero variance:

```text
rho = empty field
status = UNDEFINED_ZERO_VARIANCE
```

Never emit `0`, `NaN`, or `Infinity` as an undefined correlation.

**PROTOCOL DECISION.** Expected Spearman direction remains **POSITIVE**. That is directional concordance, not a claim that `rho > 0` is automatically useful risk ordering. See §7.

---

## 10. Maximum close drawdown definition

**PROTOCOL DECISION.** Name: `maximum_close_drawdown_magnitude` (MCDD). Secondary outcome.

This measures the worst completed-close peak-to-trough decline after the observation.

Construct price sequence:

```text
Q_0 = artifact_spot_start_price
Q_1 = C_D
Q_2 = C_D+1
...
Q_{N+1} = C_D+N
```

For each sequence position `i`:

```text
running_peak_i = max(Q_0 ... Q_i)
close_drawdown_i = 1 - (Q_i / running_peak_i)
MCDD = max(close_drawdown_i)
```

Properties:

- non-negative
- includes artifact spot as initial peak candidate
- can exceed MACE if BTC first rises after the observation and then falls
- based only on completed closes
- **not** true intraday maximum drawdown

**PROTOCOL DECISION.** Secondary expected association: higher G-Score → larger MCDD. Expected Spearman direction: **POSITIVE**. The same sign-vs-usefulness guard in §7 applies. Do not promote MCDD to primary after results.

---

## 11. Close-to-close volatility definition

**PROTOCOL DECISION.** Name: `close_to_close_volatility_annualized`. Secondary outcome.

This is a **close-to-close annualized population standard deviation of daily log returns**. It is **not** an intraday or high-frequency realized-volatility estimator.

Use completed UTC daily closes **only**. Do **not** use artifact spot in volatility-return intervals, because the interval from intraday artifact spot to same-day UTC close is a partial day.

For horizon `N`:

```text
C_0 = close on D
C_1 = close on D+1
...
C_N = close on D+N
```

Exactly `N` daily log returns. Formula **unchanged**:

```text
r_i = ln(C_i / C_{i-1})    for i = 1 ... N
r_bar = (1/N) * sum(r_i)
variance = (1/N) * sum((r_i - r_bar)^2)
close_to_close_volatility_annualized = sqrt(variance) * sqrt(365)
```

**PROTOCOL DECISION.** Use 365 because Bitcoin trades every calendar day. Do not use sample denominator `N-1`, simple-return volatility, the partial start-to-D-close interval, rolling external volatility, or API volatility.

**PROTOCOL DECISION.** Expected association: higher G-Score → higher close-to-close volatility. Expected Spearman direction: **POSITIVE**. The §7 sign-vs-usefulness guard applies. Do not promote this outcome to primary after results.

---

## 12. Zero-target downside deviation definition

**PROTOCOL DECISION.** Name: `zero_target_downside_deviation_annualized`. Secondary outcome.

This is a **zero-target downside-deviation** measure. It is **not** a standard deviation calculated only on negative days.

Use the **same** `N` daily log returns from the close-to-close volatility definition. Target daily log return: **0**. Formula **unchanged**:

```text
downside_component_i = min(r_i, 0)
downside_variance = (1/N) * sum(downside_component_i^2)
zero_target_downside_deviation_annualized = sqrt(downside_variance) * sqrt(365)
```

**PROTOCOL DECISION.**

- target = 0
- denominator is **all** `N` daily intervals
- positive returns contribute zero
- do **not** divide only by number of negative days
- do **not** subtract the mean of negative returns
- use log returns
- annualize with `sqrt(365)`

**PROTOCOL DECISION.** Expected association: higher G-Score → higher zero-target downside deviation. Expected Spearman direction: **POSITIVE**. The §7 sign-vs-usefulness guard applies. Do not promote this outcome to primary after results.

---

## 13. Tail-event thresholds

**PROTOCOL DECISION.** Tail outcomes are based **only** on MACE. Pre-registered exact thresholds: **10%**, **20%**, **30%**.

For each observation × horizon:

```text
mace_ge_10pct = 1 if MACE >= 0.10 else 0
mace_ge_20pct = 1 if MACE >= 0.20 else 0
mace_ge_30pct = 1 if MACE >= 0.30 else 0
```

Boundary is inclusive (`>=`). Threshold comparisons use **unrounded** MACE.

**PROTOCOL DECISION.** Do not introduce 5%, 15%, 25%, 40%, or 50% after results are visible without a new protocol.

These thresholds are descriptive severity markers. No significance testing. No logistic regression. No optimized threshold search. No score association for the three binary tail indicators in H5.1.

**PROTOCOL DECISION.** For each threshold:

```text
event_count = sum(binary indicator)
event_rate = event_count / n
```

For `n = 0`: `event_count = 0`, `event_rate` empty field, status `NO_COMPLETED_OUTCOMES`. Do not serialize an undefined rate as zero. No confidence intervals. No hypothesis tests.

---

## 14. Primary/secondary hierarchy

**PROTOCOL DECISION.** Freeze the analytical hierarchy.

**PRIMARY** outcome: Maximum Adverse Close Excursion magnitude.

**PRIMARY** association: G-Score vs MACE Spearman for 30 / 90 / 180.

**SECONDARY** continuous outcomes:

- Maximum Close Drawdown magnitude
- Close-to-close volatility annualized
- Zero-target downside deviation annualized

**SECONDARY** tail outcomes:

- MACE >= 10%
- MACE >= 20%
- MACE >= 30%

**PROTOCOL DECISION.** Do not promote a secondary metric to primary after results. Do not demote MACE because another metric looks better.

---

## 15. Numeric bands

**PROTOCOL DECISION.** Use published integer G-Score only. Do not infer from native band text.

| Predicate | Label |
|---|---|
| 0 <= score <= 14 | Aggressive Buying |
| 15 <= score <= 34 | Regular DCA Buying |
| 35 <= score <= 49 | Moderate Buying |
| 50 <= score <= 64 | Hold & Wait |
| 65 <= score <= 79 | Reduce Risk |
| 80 <= score <= 100 | High Risk |

**PROTOCOL DECISION.** No band merging. No threshold optimization. Retain `n = 0` groups. Future band summary universe is exactly **18** rows (3 horizons × 6 bands).

---

## 16. Model-version treatment

**PROTOCOL DECISION.** Preserve full-population exact source labels from the 323 `DAILY_PRIMARY` rows before horizon filtering:

- `v3.1.0`
- `v1.1`
- `v1.1.1`

Do not infer methodology eras. Do not treat version groups as controlled comparisons.

**FACT.** At this frozen snapshot, `v1.1.1` has no completed 30/90/180 H4 outcomes. The same eligibility therefore yields `n = 0` H5 outcomes at all three calculated horizons.

**PROTOCOL DECISION.** `v1.1.1` must remain represented as `n = 0` / `NO_COMPLETED_OUTCOMES` in the future model-version summary at all three horizons. A `MISSING` group is emitted only if a missing `model_version` exists in the frozen analytical population. Do not infer missing labels.

---

## 17. Statistical computation, summary scope, and serialization

**PROTOCOL DECISION.** Internal H5.1 calculations use unrounded JavaScript `Number` values. No `toFixed()` / `toPrecision()` before aggregation or ranking. Ranking uses unrounded values. Tail threshold comparisons use unrounded MACE. Serialized strings must never feed back into arithmetic.

**PROTOCOL DECISION.** H5.1 numeric serialization is frozen **now** to the H4.1 convention. There is no later escape hatch.

| Context | Rule |
|---|---|
| Internal | JavaScript `Number`; unrounded calculations |
| Computed numeric CSV fields | deterministic shortest round-trip decimal; `Number.prototype.toString()` or equivalent |
| Source price fields | preserve validated source field strings where practical |
| Null / undefined | empty CSV field |
| Forbidden literal strings | `null`, `undefined`, `NaN`, `Infinity` |
| CSV | RFC4180-compatible escaping; LF line endings; stable column order; stable row order |

**PROTOCOL DECISION.** Statistical-summary **scope** is the frozen output schemas, not a generic “all continuous metrics get n/mean/p25/p75/min/max” requirement.

| Context | Required statistics |
|---|---|
| Primary horizon MACE | `n`, ordinary arithmetic mean, Type-7 median, p25, p75, min, max |
| Numeric-band MACE | `n`, mean, Type-7 median, p25, p75 (no min/max by design) |
| Secondary continuous metrics in horizon/band summaries | mean and Type-7 median only, as named in those schemas |
| Model-version MACE | `n`, mean, Type-7 median |
| Score association | `n` and Spearman only |

Do not add statistics beyond each pre-registered schema during H5.1. Type-7 remains the median/quantile method wherever those statistics are requested.

No trimming, winsorization, geometric mean, outlier deletion, or rounding before aggregation.

**PROTOCOL DECISION.** Reuse the H4 Type-7 quantile definition exactly. Sort unrounded values ascending. For probability `p`:

```text
h = (n - 1) * p
j = floor(h)
g = h - j
if j + 1 < n:
  Q(p) = x[j] + g * (x[j+1] - x[j])
else:
  Q(p) = x[j]
median = Q(.50)
p25 = Q(.25)
p75 = Q(.75)
```

No quantile on `n = 0`.

**PROTOCOL DECISION.** Spearman rank conventions match H4 (§9 of this protocol / H4 Spearman contract).

---

## 18. Empty/small groups and n=0 serialization

**PROTOCOL DECISION.** Ordinary descriptive group summaries:

| n | status |
|---|---|
| 0 | `NO_COMPLETED_OUTCOMES` |
| 1 <= n < 20 | `SMALL N — DESCRIPTIVE ONLY` |
| n >= 20 | `OK` |

For Spearman:

| condition | status | rho |
|---|---|---|
| n = 0 | `NO_COMPLETED_OUTCOMES` | empty field |
| else if either rank vector has zero variance | `UNDEFINED_ZERO_VARIANCE` | empty field |
| else | `OK` | serialized Number |

**PROTOCOL DECISION.** For `n = 0`:

- `n = 0`
- all undefined continuous statistics: empty field
- all Spearman: empty field
- tail `event_count`: `0`
- tail `event_rate`: empty field
- status: `NO_COMPLETED_OUTCOMES`

Do not emit `NaN`, `Infinity`, `null`, or `undefined` as strings. Do not treat `n = 0` as merely small n. Do not serialize an undefined rate or undefined Spearman as zero.

---

## 19. Overlapping-window limitation

**LIMITATION.** Daily 30-, 90-, and 180-day risk windows overlap heavily. Nominal `n` (292 / 235 / 152) is **not** the number of independent market experiments.

**PROTOCOL DECISION.** H5.1 may **not** use:

- naive t-tests
- ordinary independent-observation standard errors
- correlation p-values
- significance claims
- confidence intervals that assume row independence

Any future inferential study accounting for temporal dependence requires a separate pre-registration. **H5 is descriptive.** This limitation was frozen before results.

---

## 20. Required H5.1 output universes

**PROTOCOL DECISION.** H5 itself creates **none** of these files. For protocol `h5-risk-outcome-v1`, they are the **required** H5.1 generated outputs. Implementation code/tests will be separately scoped during H5.1 review.

Required H5.1 generated outputs:

- `research/risk-outcomes/README.md`
- `research/risk-outcomes/risk_outcomes.csv`
- `research/risk-outcomes/summary_by_horizon.csv`
- `research/risk-outcomes/score_association.csv`
- `research/risk-outcomes/summary_by_numeric_band.csv`
- `research/risk-outcomes/summary_by_model_version.csv`
- `research/risk-outcomes/ANALYSIS_SOURCE_SHA.txt`
- `research/risk-outcomes/PROTOCOL_VERSION.txt`

**PROTOCOL DECISION.** `ANALYSIS_SOURCE_SHA.txt` exact content: `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` plus one LF newline.

**PROTOCOL DECISION.** `PROTOCOL_VERSION.txt` exact content: `h5-risk-outcome-v1` plus one LF newline.

### 20.1 Row-level file

`research/risk-outcomes/risk_outcomes.csv`

One row per eligible `DAILY_PRIMARY` × horizon. Exactly **679** data rows. No 365 rows.

Sort: `observation_date` ascending, then `horizon_days` ascending.

Required exact columns in this order:

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
window_first_close_date
window_last_close_date
maximum_adverse_close_excursion_magnitude
maximum_close_drawdown_magnitude
close_to_close_volatility_annualized
zero_target_downside_deviation_annualized
mace_ge_10pct
mace_ge_20pct
mace_ge_30pct
analysis_source_sha
protocol_version
```

`start_price_source = artifact_spot_price_usd`. `window_first_close_date = observation_date`. `window_last_close_date = observation_date + horizon_days`. Do **not** include H4 terminal forward return in this file.

### 20.2 Horizon summary

`research/risk-outcomes/summary_by_horizon.csv`

Exactly **3** rows in order: 30, 90, 180. No 365 performance row.

The full Type-7 p25/p75/min/max set is required for **PRIMARY MACE** here. Secondary continuous outcomes in this file intentionally receive **mean and median only**.

Required columns in this exact order:

```text
horizon_days
n
mean_mace
median_mace
p25_mace
p75_mace
min_mace
max_mace
mean_maximum_close_drawdown
median_maximum_close_drawdown
mean_close_to_close_volatility_annualized
median_close_to_close_volatility_annualized
mean_zero_target_downside_deviation_annualized
median_zero_target_downside_deviation_annualized
mace_ge_10pct_event_count
mace_ge_10pct_event_rate
mace_ge_20pct_event_count
mace_ge_20pct_event_rate
mace_ge_30pct_event_count
mace_ge_30pct_event_rate
status
analysis_source_sha
protocol_version
```

### 20.3 Score association

`research/risk-outcomes/score_association.csv`

Exactly **12** rows. No binary-tail Spearman.

Required columns in this exact order:

```text
horizon_days
outcome_name
n
spearman_rho
expected_direction
status
analysis_source_sha
protocol_version
```

Row order:

```text
30:
  1 maximum_adverse_close_excursion_magnitude
  2 maximum_close_drawdown_magnitude
  3 close_to_close_volatility_annualized
  4 zero_target_downside_deviation_annualized
90: same order
180: same order
```

`expected_direction = POSITIVE` for all 12.

### 20.4 Numeric-band summary

`research/risk-outcomes/summary_by_numeric_band.csv`

Exactly **18** rows. Retain every band even `n = 0`. Do not combine bands. No min/max for band MACE by design. Do not infer that §17 requires additional band columns.

Row order:

```text
30:
  Aggressive Buying
  Regular DCA Buying
  Moderate Buying
  Hold & Wait
  Reduce Risk
  High Risk
90: same order
180: same order
```

Required columns in this exact order:

```text
horizon_days
numeric_band_crosswalk
score_min
score_max
n
mean_mace
median_mace
p25_mace
p75_mace
mean_maximum_close_drawdown
median_maximum_close_drawdown
mean_close_to_close_volatility_annualized
median_close_to_close_volatility_annualized
mean_zero_target_downside_deviation_annualized
median_zero_target_downside_deviation_annualized
mace_ge_10pct_event_count
mace_ge_10pct_event_rate
mace_ge_20pct_event_count
mace_ge_20pct_event_rate
mace_ge_30pct_event_count
mace_ge_30pct_event_rate
status
analysis_source_sha
protocol_version
```

### 20.5 Model-version summary

`research/risk-outcomes/summary_by_model_version.csv`

Exactly **9** rows. Provenance-descriptive only. No inferred eras.

Row order:

```text
30: v3.1.0, v1.1, v1.1.1
90: v3.1.0, v1.1, v1.1.1
180: v3.1.0, v1.1, v1.1.1
```

Required columns in this exact order:

```text
horizon_days
model_version
n
mean_mace
median_mace
status
analysis_source_sha
protocol_version
```

`v1.1.1`: all three horizons remain `n = 0`, `NO_COMPLETED_OUTCOMES`.

---

## 21. Current v1.1.1 limitation

**FACT.** At this frozen source, current `v1.1.1` has no complete 30d / 90d / 180d H4 outcomes, and therefore no complete H5 outcomes at those horizons.

**LIMITATION.** H5/H5.1 remain historical-lineage research, not current `v1.1.1` validation.

**PROTOCOL DECISION.** Forward `v1.1.1` evidence continues accumulating separately. Do not mix later observations into this frozen H5 snapshot.

---

## 22. Relationship to H4/H4.1

**FACT.** H4 froze terminal simple forward-close return. H4.1 calculated that metric and did not show the expected negative Spearman ordering between G-Score and subsequent return.

**PROTOCOL DECISION.** H5 does not reopen, rewrite, or regenerate H4/H4.1. It does not include H4 terminal forward return in H5.1 outputs. It tests a different outcome family on the same frozen sample.

**LIMITATION.** A risk gauge may still be studied on close-based path outcomes even if it does not rank terminal returns. H5.1 will report whatever the frozen definitions produce. Concordant MACE Spearman would still not constitute complete intraday risk validation, calibration, or a claim that GhostGauge “worked.”

---

## 23. Point-in-time replay firewall

**PROTOCOL DECISION.** H5 does **not** authorize an expanded historical replay.

A future **POINT-IN-TIME REPLAY FEASIBILITY AUDIT** remains a separate track.

Do not:

- run current APIs backward
- backfill current factor values into old dates
- use revised macro data without vintage handling
- create synthetic historical ETF/flow values
- manufacture historical current-model scores

Longer backtesting must wait for that separate feasibility audit.

---

## 24. Calibration decision

**PROTOCOL DECISION.** Calibration gate remains **CLOSED**.

H5 does not authorize changing:

- weights
- subweights
- factor formulas
- bands
- recommendations
- score normalization
- data-source logic
- model version

**PROTOCOL DECISION.** H5.1 results alone will not automatically authorize calibration.

**PROTOCOL DECISION.** Factor analysis remains out of scope. Do not use `factor_manifest.csv`. Do not test factor vs MACE, drawdown, or volatility-family outcomes. Composite G-Score only. Factor analysis requires a separately pre-registered future phase.

---

## 25. Future implementation test requirements

**PROTOCOL DECISION.** Document only. Do **not** implement tests in H5.

H5.1 must test at minimum:

**Input / population**

- pinned analysis source enforcement
- both Git blob identities
- both SHA-256 values
- 338 / 323 / 4 / 11
- 292 / 235 / 152
- 679 total rows
- no 365 rows
- zero silent drops

**G-Score**

- all 323 valid pinned scores
- numeric, finite, integer, 0–100
- missing / nonnumeric / nonfinite / noninteger / below-zero / above-100 => hard STOP
- no rounding / clamping / substitution

**BTC path**

- 731 rows
- 731 unique dates
- first `2024-08-17`
- last `2026-08-17`
- 0 duplicates
- 0 missing dates
- all closes numeric / finite / `> 0`
- any invalid required close => STOP

**Reconciliation**

- 323 then date/path eligible minus invalid start price minus missing/invalid path close
- invalid G-Score is HARD STOP, not drop
- frozen final n 292 / 235 / 152 / 679
- discrepancy lists exact dates / causes

**Date path**

- strict UTC `YYYY-MM-DD`
- D close included in path
- D+N close included in path
- all intermediate dates required
- month boundary
- year boundary
- leap-year boundary
- no interpolation

**MACE**

- no decline => 0
- immediate decline
- later decline
- minimum exactly at D
- minimum exactly at D+N
- start price itself is floor when all closes higher
- 10/20/30 inclusive threshold boundaries

**Maximum close drawdown**

- monotonic rise => 0
- immediate decline from start
- rise then decline
- multiple peaks
- correct running peak
- can exceed MACE

**Close-to-close volatility** (formula unchanged)

- exactly N close-to-close log returns
- artifact spot excluded from volatility intervals
- population denominator N
- `sqrt(365)` annualization
- constant prices => zero close-to-close volatility

**Zero-target downside deviation** (formula unchanged)

- denominator all N
- positive returns contribute zero
- negative returns contribute squared log return
- all-positive sequence => zero
- `sqrt(365)` annualization

**Spearman**

- positive ordering
- negative ordering
- score ties
- outcome ties
- zero variance => empty rho / `UNDEFINED_ZERO_VARIANCE`

**Output universes**

- all six bands
- fixed 679 row-level rows
- fixed 3 horizon rows
- fixed 12 association rows
- fixed 18 band rows
- fixed 9 model-version rows
- `v1.1.1` n=0 retained
- exact column order for all CSVs
- exact row order
- n=0 null stats; tail `event_count = 0` and empty `event_rate`
- small-n status

**Precision / serialization**

- no rounding before aggregation
- unrounded threshold comparison
- deterministic `Number.prototype.toString()` serialization
- empty fields for null stats
- no `NaN` / `Infinity` / `null` / `undefined` strings
- exact `ANALYSIS_SOURCE_SHA.txt` and `PROTOCOL_VERSION.txt` bytes

---

## 26. Final protocol freeze statement

**PROTOCOL DECISION.** Independent review of this protocol must complete before H5.1 implementation. Seeing risk-outcome numbers first would defeat the purpose of H5.

**PROTOCOL DECISION.** Positive MACE Spearman may be described as **directionally concordant** with expected risk ordering. It may **not**, by sign alone, be called useful, strong, validated, calibrated, or predictive.

Negative Spearman: directionally opposite expected ordering.

Zero: no monotonic ordering in the frozen sample.

No arbitrary magnitude cutoff is introduced. Future interpretation must report exact values and limitations. No post-hoc promotion of MCDD or the volatility family if MACE is weak.

**PROTOCOL DECISION.** Concordant MACE Spearman would **not** automatically prove causality, current `v1.1.1` validity, proper calibration, correct weights, correct bands, trading profitability, or intraday risk prediction.

**PROTOCOL DECISION.** If the primary result does **not** show positive ordering: report it exactly. Do not change the MACE definition or promote another outcome after seeing results.

H5 RISK-OUTCOME PROTOCOL FROZEN —

CLOSE-BASED PATH RISK, NOT INTRADAY MAE —

SAME FROZEN H4/H4.1 SAMPLE AND BTC SERIES —

PRIMARY OUTCOME = MAXIMUM ADVERSE CLOSE EXCURSION —

SIGN CONCORDANCE IS NOT AUTOMATIC USEFULNESS —

NO RISK OUTCOMES CALCULATED —

NO H5.1 IMPLEMENTATION —

NO POINT-IN-TIME REPLAY —

CALIBRATION GATE CLOSED —

STOP FOR INDEPENDENT PROTOCOL REVIEW
