# H7.2 Outcome-Analysis Preregistration

**Date:** 2026-08-20
**Phase:** H7.2 — frozen protocol
**Status:** `FROZEN PROTOCOL — OUTCOME ANALYSIS NOT YET EXECUTED`
**Branch:** `research/h7-2-outcome-analysis-preregistration`
**H7_2_PROTOCOL_VERSION:** `h7-2-outcome-analysis-v1`
**Parent main HEAD at branch creation:** `a8f22b8fadd91be8ef30a3b740b103647fd38326`

This document is the **frozen H7.2 protocol**. Methodology is frozen. Changing any **PROTOCOL DECISION** requires a new protocol version. H7.2 analysis has not yet been implemented. No outcome statistic has yet been calculated. Calibration remains **CLOSED**.

Do **not** write the eventual freeze-commit SHA into this document. The Git commit that freezes these bytes becomes `H7_2_PROTOCOL_SHA` after that commit exists.

Labels used below:

- **FACT** — inherited from closed H7.1 identities, frozen H7 protocol text, or source-integrity / structural-coverage audit
- **PROTOCOL DECISION** — frozen methodology; changing it requires a new protocol version
- **FIREWALL** — a prohibition that is not open to casual weakening
- **LIMITATION** — a bound on what later H7.2 execution may claim even after results exist
- **IMPLEMENTATION DETAIL** — later code/schema design, not an open methodology choice

---

## 0. Purpose

H7.2 exists so that the outcome-analysis methodology is written down **before anyone sees whether high or low XR scores preceded better or worse Bitcoin paths**.

This frozen protocol **does**:

- freeze the H7.2 research question, outcome, horizon, statistic, eligibility, claim language, and structural coverage invariants
- record the immutable H7.1 input identities
- record the frozen outcome-price source identity

This frozen protocol **does not**:

- implement analysis
- calculate outcome statistics
- load future BTC-return results into analysis
- calculate correlations, drawdowns, or MACE
- inspect whether high or low XR scores performed better
- tune weights or bands
- authorize a merge of H7.2 as complete analysis

---

## 1. Closed H7.1 identity (immutable input)

**FACT.** H7.1 is complete, merged, and scientifically closed.

| Item | Value |
|---|---|
| H7.1 status | `COMPLETE / MERGED / CLOSED` |
| `H7_1_ANALYSIS_SOURCE_SHA` | `c42543ec5fd042256dd47f754c91efc658b0e49a` |
| `H7_1_OUTPUT_COMMIT_SHA` | `b596619621aa4805d337c3047d98f1686529e6e7` |
| H7.1 output commit tree | `a2f2879c4141c03226ceb0bb29d3a9e354a9c4c6` |
| `H7_PROTOCOL_VERSION` | `h7-exploratory-reconstruction-v1` |
| H7.1 merge PR | `#25` |
| H7.1 merge commit | `a8f22b8fadd91be8ef30a3b740b103647fd38326` |

**FACT.** The primary H7.2 input is the frozen H7.1 observation file at the output commit, not a moving working-tree copy:

```text
git show b596619621aa4805d337c3047d98f1686529e6e7:research/exploratory-reconstruction/xr_observations.csv
```

Required companion identities at the same commit:

| File | Git blob SHA |
|---|---|
| `research/exploratory-reconstruction/xr_observations.csv` | `148999d51a02b87bdb93b9d32f9978ee3bef9401` |
| `research/exploratory-reconstruction/xr_factor_lineage.csv` | `938f4643bd0cc90de6a621295ddbbac65d5bd8c9` |
| `research/exploratory-reconstruction/xr_missingness.csv` | `869f386eca81c325268aecc4e27e2f1539ffbc95` |
| `research/exploratory-reconstruction/xr_bridge_check.csv` | `2fd46482c750623d98373fecbd54ce7e54228804` |
| `research/exploratory-reconstruction/ANALYSIS_SOURCE_SHA.txt` | `c264bf12a8eb1306ef3c2e5d3849cece5936cdcc` |
| `research/exploratory-reconstruction/PROTOCOL_VERSION.txt` | `24ebb23e56886b10f1eaee7f64aafd6ebca15385` |

**FIREWALL.** H7.2 must read those Git object bytes. A later working-tree edit, regeneration, or “repair” of H7.1 outputs is forbidden.

**FACT.** `ANALYSIS_SOURCE_SHA.txt` contains `c42543ec5fd042256dd47f754c91efc658b0e49a` and must not be rewritten to the output-commit SHA.

---

## 2. H7.1 row-preservation contract

**FACT.** Frozen H7.1 universe:

- UTC calendar dates `2025-12-11` through `2026-08-19` inclusive
- 252 dates
- 234 `ELIGIBLE`
- 18 `NOT_ELIGIBLE`

**FIREWALL.** No H7.1 row may be deleted, rescored, repaired, backfilled, substituted, or reclassified after outcome inspection.

That includes:

- all 252 dates remain in the reporting universe
- the exact 234 `ELIGIBLE` observations remain the default XR-eligibility set
- all 18 `NOT_ELIGIBLE` dates remain recorded missing / ineligible observations
- all existing XR scores remain unchanged
- all factor scores remain unchanged
- all H7.1 roles / provenance remain unchanged

**FIREWALL.** H7.2 may later attach outcome fields in separately generated analysis outputs. It may not overwrite `xr_observations.csv` or any other accepted H7.1 artifact.

**FIREWALL.** Do not modify `xr_status`.

---

## 3. What XR is and is not

**FACT.** XR-Score is an exploratory reconstruction constructed under `h7-exploratory-reconstruction-v1`. It uses current GhostGauge `v1.1.1` mathematics mixed with labeled reconstruction inputs.

**FIREWALL.** XR is:

- **NOT** historical G-Score
- **NOT** as-published history
- **NOT** validation-grade current-methodology replay
- **NOT** a production dashboard series

**LIMITATION.** Even a clean H7.2 association cannot convert XR into historical G-Score or into a claim that GhostGauge “would have predicted” the same path.

---

## 4. A. Analysis question

**PROTOCOL DECISION.** Primary H7.2 question:

> Within the frozen H7.1 exploratory reconstruction sample, was higher XR associated with greater subsequent Bitcoin downside measured from completed UTC daily closes?

**PROTOCOL DECISION.** Classify H7.2 as:

```text
DESCRIPTIVE RISK-DISCRIMINATION / RANKING-USEFULNESS ANALYSIS
```

It is **not**:

- forecasting validation
- historical G-Score validation
- as-published replay
- trading-strategy backtest
- calibration
- weight or band optimization

**PROTOCOL DECISION.** Expected directional relationship, frozen before any result is viewed:

```text
higher XR
    ->
larger subsequent Maximum Adverse Close Excursion
    ->
positive Spearman rho
```

Rejected alternatives:

- forecasting / ex-ante prediction audit
- calibration of weights or bands
- horse race versus published G-Score
- terminal-return usefulness as the primary question

**LIMITATION.** This is a descriptive association in one frozen exploratory sample. It is not a forecast test and not a production-validation test.

---

## 5. B. Primary outcome

**PROTOCOL DECISION.** Primary outcome:

```text
name        = maximum_adverse_close_excursion_30d
short label = MACE_30
```

XR does not contain an immutable artifact spot-price field. H7.2 therefore does **not** invent or reconstruct a new artifact spot start price.

**PROTOCOL DECISION.** Start / baseline price:

```text
S = C_D
```

where `C_D` is the completed UTC daily close for XR observation date `D`.

**FACT.** Every H7.1 reconstruction timestamp belongs to UTC date `D` and occurs before that UTC day’s closing boundary. Therefore `C_D` is the first completed UTC daily close after the XR observation.

**LIMITATION.** `C_D` is the first completed UTC daily close after the H7.1 reconstruction timestamp for observation date `D`. Because H7.2 uses `S = C_D`, the H7.2 MACE measure does **not** include price movement between `reconstruction_as_of_utc` and the completed UTC close `C_D`.

Therefore H7.2 measures **close-based downside beginning from the observation-date completed UTC close**. It does **not** measure immediate adverse excursion beginning at the exact XR reconstruction timestamp.

This is an intentional measurement convention caused by XR having no frozen artifact spot-price field. Do **not** change `S` away from `C_D`. Do **not** introduce an intraday price to close that gap.

It must **not** later be described as “maximum downside immediately after the XR signal” or equivalent language.

Permitted description:

> subsequent close-based downside measured from the first completed UTC daily close after the XR observation.

**PROTOCOL DECISION.** For horizon `N`:

```text
path_N = C_D, C_D+1, ..., C_D+N
MACE_N = 1 - min(C_D, C_D+1, ..., C_D+N) / C_D
```

For `N = 30`:

- 31 close observations
- 30 forward calendar-day intervals
- `C_D` is the baseline
- MACE is non-negative
- MACE = 0 if no later completed close through `D+30` falls below `C_D`
- MACE = 0.20 means the worst completed UTC close through `D+30` was 20% below `C_D`

**LIMITATION.** This remains **close-only MACE**. It is **not** true intraday maximum adverse excursion.

**FIREWALL.** Do not use:

- reconstruction-time Coinbase surrogate as `S`
- the same H7.1 internal price vector as `S`
- previous-day close
- current live BTC price
- intraday lows
- terminal return as MACE

This definition differs from H5, which used artifact spot as `S` and included that spot in the path. H7.2 cannot copy that start-price rule because XR has no artifact spot field.

---

## 6. C. Forward horizons

**PROTOCOL DECISION.** One primary horizon:

```text
30 UTC calendar days
```

Rationale:

- closest of the inherited H4/H5 horizons to a daily risk-gauge use case
- maximizes usable frozen-snapshot coverage relative to 90d/180d
- was already part of prior GhostGauge research
- avoids selecting among multiple horizons after results

**PROTOCOL DECISION.** Secondary horizons only:

```text
90 UTC calendar days
180 UTC calendar days
```

The same MACE definition applies, with `N` replaced.

**FIREWALL.** No additional horizons are permitted in H7.2. Do not add `1d`, `7d`, `14d`, `21d`, `45d`, `60d`, `120d`, `365d`, or any other horizon.

**PROTOCOL DECISION.** Primary H7.2 result = 30-day MACE association. 90-day and 180-day MACE are **SECONDARY** only. A stronger secondary result may not replace a weaker primary result.

**FIREWALL.** Do not characterize H7.2 based on whichever horizon has the largest rho.

---

## 7. D. Outcome price source

**PROTOCOL DECISION.** Freeze outcome market data to the same Git commit that contains the accepted H7.1 Stage-B outputs.

```text
OUTCOME_SOURCE_COMMIT_SHA = b596619621aa4805d337c3047d98f1686529e6e7
path                      = public/data/btc_price_history.csv
git blob SHA              = e93a74edba11d04969ba81c141361acbab6ec3c3
```

Conceptual read:

```text
git show b596619621aa4805d337c3047d98f1686529e6e7:public/data/btc_price_history.csv
```

**FACT.** Independently verified Git blob identity at that commit/path is `e93a74edba11d04969ba81c141361acbab6ec3c3`. This protocol-design pass confirmed that blob SHA and did not substitute another snapshot.

**FACT.** SHA-256 of the exact Git blob bytes:

```text
8c3b57f779b764def7cfdff65205238cc14f2726c86572e63c450357e0852db1
```

**FACT.** Structural source-integrity audit of those blob bytes (no outcome statistics):

| Item | Value |
|---|---|
| Columns | `date_utc`, `close_usd`, `source`, `ingested_at_utc` |
| Date row count | 733 |
| Unique date-key count | 733 |
| First UTC date | `2024-08-17` |
| Last UTC date | `2026-08-19` |
| Duplicate-date count | 0 |
| Calendar-gap count | 0 |
| Malformed `date_utc` count | 0 |
| Non-finite / non-positive `close_usd` count | 0 |

**FACT.** The pinned series therefore supplies an exact UTC-calendar close for every date from `2024-08-17` through `2026-08-19` inclusive. That range covers the entire H7.1 observation window as baseline dates. It does **not** extend past `2026-08-19`, so required `D+N` dates after that last close are incomplete by construction.

**FIREWALL.** Do not use a later working-tree copy. Do not use current live market data. Do not extend the price series after H7.1. Do not replace historical prices with later provider corrections. Do not retrieve another provider.

**FIREWALL.** If a later execution finds a different Git blob SHA than `e93a74edba11d04969ba81c141361acbab6ec3c3`, **STOP**. Do not substitute another snapshot.

---

## 8. Outcome date rule

**PROTOCOL DECISION.** For observation date `D` and horizon `N`, required price dates are **exactly**:

```text
D, D+1, ..., D+N
```

using UTC calendar-date keys matching `btc_price_history.date_utc`.

**PROTOCOL DECISION.** Bitcoin trades every calendar day in this pinned series. Do not apply:

- business-day shifting
- weekend shifting
- holiday shifting
- nearest-date selection
- first-available-after-date substitution

**FIREWALL.** Each required close must exist for its exact UTC calendar date. No interpolation. No forward fill. No backward fill. No substitute provider.

**PROTOCOL DECISION.** A required close is valid only if it is present, numeric, finite, and `> 0`. Any other value makes that horizon’s path incomplete.

---

## 9. E. Universe and eligibility

**PROTOCOL DECISION.** Reporting universe remains all **252** H7.1 dates.

**FACT.** XR status remains frozen:

- 234 `ELIGIBLE`
- 18 `NOT_ELIGIBLE`

**PROTOCOL DECISION.** Horizon-specific analysis status:

| Condition | Status | Enters that horizon’s Spearman? |
|---|---|---|
| `xr_status = NOT_ELIGIBLE` | `XR_NOT_ELIGIBLE` | No |
| `xr_status = ELIGIBLE` and every required close `C_D` through `C_D+N` exists, is finite, and `> 0` | `OUTCOME_COMPLETE` | Yes |
| `xr_status = ELIGIBLE` and the complete required price path does not exist | `OUTCOME_INCOMPLETE` | No |

Primary 30-day analysis sample:

```text
xr_status = ELIGIBLE
AND
every required close C_D through C_D+30 exists and is finite and > 0
```

**PROTOCOL DECISION.** Apply the same independent eligibility rule to 90d and 180d secondary horizons. Completeness is horizon-specific. A date may be complete for 30d and incomplete for 90d/180d.

**FIREWALL.** Do not modify `xr_status`. Do not repair XR. Do not silently delete incomplete recent dates from the 252-date universe.

**PROTOCOL DECISION.** The later H7.2 report must show, for each horizon, coverage counts only:

- 252 total universe rows
- `XR_ELIGIBLE` count
- `XR_NOT_ELIGIBLE` count
- `OUTCOME_COMPLETE` count
- `OUTCOME_INCOMPLETE` count
- final analysis `N`

These are coverage counts, not performance statistics.

### 9.1 Pre-execution structural coverage invariants

**PROTOCOL DECISION.** The following expected structural coverage values are frozen **before** any outcome calculation. They are derived solely from:

- the frozen 252 H7.1 observation dates
- frozen `xr_status`
- the pinned outcome series ending `2026-08-19`
- the verified fact that the pinned outcome date series is contiguous with no gaps

They do **not** use price changes, MACE, returns, or correlation.

| Horizon | Latest observation date with a complete `D..D+N` price-date path | `XR_ELIGIBLE` | `XR_NOT_ELIGIBLE` | Expected `OUTCOME_COMPLETE` among `XR_ELIGIBLE` | Expected `OUTCOME_INCOMPLETE` among `XR_ELIGIBLE` | Expected analysis `N` |
|---|---|---|---|---|---|---|
| 30d (primary) | `2026-07-20` | 234 | 18 | 205 | 29 | **205** |
| 90d (secondary) | `2026-05-21` | 234 | 18 | 149 | 85 | **149** |
| 180d (secondary) | `2026-02-20` | 234 | 18 | 68 | 166 | **68** |

For each horizon:

```text
XR_NOT_ELIGIBLE
  + OUTCOME_COMPLETE among XR_ELIGIBLE
  + OUTCOME_INCOMPLETE among XR_ELIGIBLE
  = 252
```

Therefore:

```text
30d:  18 + 205 + 29 = 252
90d:  18 + 149 + 85 = 252
180d: 18 +  68 + 166 = 252
```

**FIREWALL.** These are **pre-execution structural invariants**. Later H7.2 implementation must **STOP** if actual horizon eligibility differs from these expected counts. Do not automatically “fix” the sample. Do not substitute dates. Do not extend the market-data snapshot. Do not calculate MACE in order to verify these counts.

**IMPLEMENTATION DETAIL.** Exact output filenames / column order for those coverage tables are left to later execution design. The counts themselves are required.

---

## 10. F. Primary statistic

**PROTOCOL DECISION.** Primary statistic:

```text
Spearman rank correlation between XR score and MACE_30
```

computed only on the primary 30-day analysis sample.

**PROTOCOL DECISION.** Use the same rank convention already frozen in H4/H5:

- rank XR independently
- rank MACE independently
- conceptual ranks are 1-based
- tied values receive the arithmetic mean of occupied ranks
- `rho` = Pearson correlation of the two rank vectors

**FIREWALL.** Do not use:

- Pearson on raw XR / MACE
- regression coefficient
- R-squared
- AUC
- high-vs-low mean difference
- band spread

**FIREWALL.** No p-value. No confidence interval. No significance star. No hypothesis-test language.

**PROTOCOL DECISION.** If either rank vector has zero variance:

```text
rho = null
status = UNDEFINED_ZERO_VARIANCE
```

Never emit `NaN`, `Infinity`, or `0` as a substitute for undefined.

**PROTOCOL DECISION.** Expected preregistered direction:

```text
rho > 0
```

**IMPLEMENTATION DETAIL.** CSV serialization of `null` rho (empty field versus explicit token) may be specified at execution time, provided it is not emitted as `0`, `NaN`, or `Infinity`.

---

## 11. G. Secondary statistics

**PROTOCOL DECISION.** H7.2 permits **exactly two** secondary outcome statistics:

```text
Spearman(XR, MACE_90)
Spearman(XR, MACE_180)
```

using the exact same ranking and horizon-specific eligibility rules.

**FIREWALL.** No other secondary outcome family is authorized. Specifically do **not** calculate in H7.2:

- terminal forward return
- MCDD
- realized volatility
- downside volatility
- tail-event rates
- AUC
- band outcome tables
- quintile outcome tables
- high/low group differences
- alternative correlation measures
- factor-by-factor outcome correlations

If those questions are worth studying later, they require a separate preregistered experiment.

---

## 12. H. MACE inclusion

**PROTOCOL DECISION.** MACE is the **only** authorized outcome family in H7.2. The exact formula is §5. Horizons are §6. Sign convention is non-negative close-path adverse excursion from `S = C_D`. Aggregation is Spearman as in §10–§11.

No other MACE variant is authorized (intraday MAE, dollar MACE, terminal-return-as-MACE, or a different start price).

---

## 13. I. Drawdown / MAE

**PROTOCOL DECISION.** True intraday MAE and maximum close drawdown (MCDD) are **out of scope** for H7.2.

**LIMITATION.** Close-only MACE is not true intraday maximum adverse excursion and is not peak-to-trough MCDD.

---

## 14. J. Score treatment

**PROTOCOL DECISION.** Treat XR only as a **continuous 0–100 score**, with rank transformation for Spearman.

**FIREWALL.** Do not analyze:

- production score bands
- new XR bands
- quintiles
- tertiles
- high / medium / low groups
- threshold events

No grouping scheme is part of H7.2. No new score bands may be invented after seeing outcomes.

**LIMITATION.** Not applying production band labels does not make XR an official G-Score print; XR remains exploratory reconstruction either way.

---

## 15. K. Multiple-comparison firewall

**PROTOCOL DECISION.** There is exactly one **PRIMARY** combination:

```text
XR × 30-day MACE × Spearman rho
```

Secondary combinations are exactly:

```text
XR × 90-day MACE × Spearman rho
XR × 180-day MACE × Spearman rho
```

Nothing else.

**FIREWALL.** Do not add additional outcomes after seeing results. Do not promote a secondary result to primary. Do not characterize H7.2 based on whichever horizon has the largest rho.

---

## 16. Serial dependence / overlapping windows

**LIMITATION.** Daily XR observations are serially related. Forward MACE windows overlap heavily. Consecutive 30-day observations share nearly the entire subsequent price window.

Therefore H7.2 observations must **not** be treated as statistically independent trials.

Consequences:

- Spearman rho is descriptive
- no ordinary independent-observation p-value
- no ordinary confidence interval
- no significance language
- no claim that `N` daily rows equal `N` independent experiments
- no causal interpretation

This limitation is part of the H7.2 design, not an after-the-fact caveat. It must appear in later result interpretation.

**FIREWALL.** Do **not** add a non-overlapping subsample in H7.2. That would create another analysis choice.

---

## 17. L. Result-language rule

**PROTOCOL DECISION.** Do not invent an arbitrary numeric success cutoff such as `rho >= 0.10`, `0.20`, `0.30`, or `0.50`. H5 deliberately avoided arbitrary correlation pass/fail thresholds. H7.2 retains that restraint.

**PROTOCOL DECISION.** Descriptive direction labels:

| Observed rho | Label |
|---|---|
| `rho > 0` | `DIRECTIONALLY_ALIGNED` |
| `rho = 0` | `NO_DIRECTIONAL_ASSOCIATION` |
| `rho < 0` | `DIRECTIONALLY_OPPOSED` |
| rho undefined because of zero variance | `UNDEFINED` |

Always report:

- exact rho
- analysis `N`
- horizon
- outcome definition

**FIREWALL.** A tiny positive rho remains numerically tiny even though its direction is aligned.

Do **not** translate `DIRECTIONALLY_ALIGNED` into: validated, successful, predictive, significant, or “works.”

Do **not** translate `DIRECTIONALLY_OPPOSED` into: invalidated, broken, or failed.

The final interpretation must discuss the actual magnitude and limitations without a model pass/fail declaration.

---

## 18. M. Claim firewall

**FIREWALL.** Permitted language is bounded to forms such as:

> In the frozen H7.1 exploratory reconstruction sample, higher XR was directionally aligned / opposed / unassociated with greater subsequent close-based downside over the preregistered horizon.

XR remains:

- exploratory reconstruction
- not historical G-Score
- not as-published
- not validation-grade replay
- not a production backtest

**FIREWALL.** Do not say:

- “GhostGauge predicted…”
- “GhostGauge would have predicted…”
- “Historical G-Score…” from XR evidence
- “The model was validated…”
- “The model was invalidated…”
- “the weights are correct / wrong”
- “the bands should change”

**LIMITATION.** Association in an exploratory reconstruction sample is not a trading result, not a forecast audit, and not a production-calibration result.

---

## 19. N. Tuning firewall

**FIREWALL.** Calibration remains **CLOSED**.

No H7.2 result may alter:

- factor weights
- factor subweights
- production bands
- thresholds
- factor definitions
- reconstruction roles
- XR values
- production methodology

Any future calibration experiment requires its own separately authorized protocol. H7.2 cannot be that experiment.

---

## 20. Future data accrual

**PROTOCOL DECISION.** The outcome price snapshot is frozen at:

```text
H7_1_OUTPUT_COMMIT_SHA = b596619621aa4805d337c3047d98f1686529e6e7
```

**FIREWALL.** Do not later extend H7.2 when additional future outcomes mature. If later research wants more completed 30d/90d/180d windows for the recent XR dates, that requires a **new** protocol/version and a newly frozen market-data snapshot.

Do not append later prices to H7.2.

---

## 21. Implementation gate

This document is the **frozen H7.2 protocol**. Methodology is frozen. H7.2 analysis has **not** yet been implemented. No outcome statistic has yet been calculated.

H7.2 execution **may not begin** until independent frozen-protocol verification of this document’s Git identity. After that verification, analysis code may be written against these frozen identities only. Changing any **PROTOCOL DECISION** requires a new protocol version.

Until execution is separately authorized:

- do not write analysis code
- do not retrieve additional outcome data
- do not calculate statistics
- do not merge H7.2 as complete analysis
- do not write `H7_2_PROTOCOL_SHA` into this document

**IMPLEMENTATION DETAIL.** Later execution may specify output paths, CSV column order, and rho serialization mechanics, provided they implement this methodology unchanged.

---

## 22. Explicit non-actions in this freeze

Confirmed for this frozen-protocol commit:

- no outcome statistic calculated
- no returns calculated
- no MACE calculated
- no correlation calculated
- no XR-conditioned market analysis
- no analysis code written
- no H7.1 data changed
- no tuning
- no calibration
- H7.2 not merged

---

## 23. Closed A–N checklist

| Item | Resolution |
|---|---|
| A. Analysis question | Descriptive risk-discrimination / ranking-usefulness: higher XR associated with greater subsequent close-based downside |
| B. Primary outcome | `MACE_30`; `S = C_D`; close-only; does not include `reconstruction_as_of_utc` → `C_D` path |
| C. Horizons | Primary 30d; secondary 90d and 180d only |
| D. Price source | `b5966196` / `public/data/btc_price_history.csv` / blob `e93a74ed…` |
| E. Eligibility | 252-date universe; Spearman uses `ELIGIBLE` and outcome-complete rows only; expected N 205 / 149 / 68; `NOT_ELIGIBLE` and incomplete retained in reporting |
| F. Primary statistic | Spearman(XR, `MACE_30`); H4/H5 ranks; no p-value |
| G. Secondary statistics | Spearman(XR, `MACE_90`) and Spearman(XR, `MACE_180`) only |
| H. MACE | Included; formula in §5 |
| I. Drawdown / MAE | Out of scope |
| J. Score treatment | Continuous 0–100 with rank transform; no bands or groups |
| K. Multiple comparisons | One primary combination; two secondary combinations |
| L. Result language | Direction labels only; no rho cutoff; no pass/fail |
| M. Claim firewall | Exploratory-sample association language only |
| N. Tuning firewall | Calibration CLOSED |

STOP FOR INDEPENDENT H7.2 FROZEN-PROTOCOL VERIFICATION.
