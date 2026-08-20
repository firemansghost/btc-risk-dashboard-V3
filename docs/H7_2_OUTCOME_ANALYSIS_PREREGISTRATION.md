# H7.2 Outcome-Analysis Preregistration Framework

**Date:** 2026-08-20  
**Phase:** H7.2 Stage A — protocol design only  
**Status:** `DRAFT FRAMEWORK — NOT FROZEN`  
**Branch:** `research/h7-2-outcome-analysis-preregistration`  
**Draft protocol label:** `h7-2-outcome-analysis-preregistration-draft`  
**Parent main HEAD at branch creation:** `a8f22b8fadd91be8ef30a3b740b103647fd38326`

This document is a **preregistration framework**. It does **not** freeze methodology. It does **not** implement analysis. It does **not** retrieve Bitcoin outcome data. It does **not** calculate returns, correlations, drawdowns, MACE, or any other result.

Independent methodology review must resolve the open decisions below **before** any outcome statistic is computed.

Labels used below:

- **FACT** — inherited from closed H7.1 identities or frozen H7 protocol text
- **FIREWALL** — a prohibition that is already in force and is not open to casual weakening
- **OPEN FOR REVIEW** — a substantive research-design choice that must be resolved before H7.2 is frozen
- **LIMITATION** — a bound on what later H7.2 execution may claim even after results exist

---

## 0. Purpose of this stage

H7.2 Stage A exists so that the outcome-analysis methodology is written down **before anyone sees whether high or low XR scores preceded better or worse Bitcoin paths**.

H7.2 Stage A **may**:

- identify the immutable H7.1 input
- distinguish analysis questions
- list candidate outcomes, horizons, price conventions, and statistics
- record tradeoffs
- recommend an option when a justification already exists
- mark every remaining choice for independent review

H7.2 Stage A **may not**:

- calculate outcome statistics
- load future BTC-return results into analysis
- calculate correlations, drawdowns, or MACE
- inspect whether high or low XR scores performed better
- tune weights or bands
- write analysis code
- merge this draft as if it were a frozen protocol

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
- the exact 234 `ELIGIBLE` observations remain the default primary inferential sample unless a different treatment is separately preregistered **before** results
- all 18 `NOT_ELIGIBLE` dates remain recorded missing / ineligible observations; they must not be silently dropped from reporting
- all existing XR scores remain unchanged
- all factor scores remain unchanged
- all H7.1 roles / provenance remain unchanged

**FIREWALL.** H7.2 may attach outcome fields in later analysis outputs. It may not overwrite `xr_observations.csv` or any other accepted H7.1 artifact.

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

**OPEN FOR REVIEW.** What exactly is H7.2 testing about XR?

These are different questions. Do not casually call all of them “prediction.”

| Question class | Meaning | H7.2 status |
|---|---|---|
| Association | Did XR and a later Bitcoin quantity tend to move together in this frozen sample? | Candidate primary class |
| Ranking usefulness | Did higher XR ranks coincide with worse (or better) subsequent outcomes than lower XR ranks? | Candidate refinement of association |
| Risk discrimination | Did higher XR coincide with larger subsequent downside / instability? | Candidate primary class, given GhostGauge’s risk-gauge purpose |
| Forecasting | Did XR provide usable ex-ante forecasts of future Bitcoin moves? | Not supported by this design unless a separate forecast protocol is written |
| Calibration | Do XR values match empirical frequencies, or should weights/bands change? | Forbidden in H7.2 |

**Recommended option, pending review:** treat H7.2 as a **descriptive association / ranking-usefulness** study of frozen XR versus one pre-registered subsequent Bitcoin outcome. If the chosen outcome is a downside-path measure, the study may also be described as **risk discrimination in this sample**. It should **not** be described as forecasting or calibration.

**Tradeoffs:**

- Association is the weakest scientifically honest claim and matches H7’s “hypothesis generation” purpose.
- Risk discrimination is closer to what a risk gauge is for, but still cannot validate production GhostGauge because XR is not historical G-Score.
- Forecasting would require an explicit forecast design, embargo rules, and a claim that the reconstruction was available as a live signal. H7.1 does not establish that.
- Calibration would reopen weights/bands. That is separately forbidden.

**FIREWALL.** Do not reframe H7.2 after seeing results as “GhostGauge predicted X historically.”

---

## 5. B. Primary outcome

**OPEN FOR REVIEW.** Define one primary Bitcoin outcome before viewing results.

Candidate families, inherited as **design options** from earlier GhostGauge research rather than as automatic H7.2 decisions:

| Candidate | Precedent | What it tests | Main hazard |
|---|---|---|---|
| Terminal forward return | H4 / H4.1 | Did higher XR precede weaker (or stronger) subsequent completed-close returns? | Easy to over-read as a trading-signal test; H4.1 already found published G-Score did not show the expected return ordering |
| Maximum Adverse Close Excursion (MACE) | H5 / H5.1 | Did higher XR precede larger subsequent close-path downside from a defined start price? | Close-only; not true intraday MAE; start-price for XR is not yet defined |
| Maximum Close Drawdown (MCDD) | H5 secondary | Path drawdown from a running close peak | Secondary unless elevated before results |
| Volatility / downside-volatility family | H5 secondary | Subsequent close-to-close instability | Easy to mine if promoted after a weak primary |

**Recommended option, pending review:** choose **one** primary outcome from the H5-style downside-path family **or** the H4-style terminal-return family, and freeze that choice before execution. A risk-gauge motivation makes MACE the more coherent *candidate*, but that is not yet a frozen H7.2 decision because:

1. XR is not G-Score, so H5’s primary outcome does not transfer automatically.
2. XR rows have no artifact spot-price column; H5’s start-price definition cannot be copied blindly.
3. Choosing terminal return because “H4.1 was disappointing” would itself be post-hoc relative to prior G-Score results, even if XR outcomes have not been seen.

**FIREWALL.** Do not inspect XR-versus-Bitcoin results in order to pick the primary outcome.

**FIREWALL.** H7.2 is not a horse race versus published G-Score unless a separate, later protocol explicitly preregisters that comparison. This framework does not authorize it.

---

## 6. C. Forward horizons

**OPEN FOR REVIEW.** Pre-register the exact forward horizon or horizons before seeing which one “works.”

Design options:

1. Copy H4/H5 exactly: **30 / 90 / 180** UTC calendar days, with one of those declared primary.
2. Choose a **single** primary horizon and treat any others as coverage-only or secondary.
3. Add shorter horizons because the XR window ends on `2026-08-19` and, as of this draft date `2026-08-20`, long completed windows cannot exist for the most recent XR dates.

**Tradeoffs:**

- Copying 30/90/180 preserves comparability with H4/H5 language, but comparability of **samples** is still imperfect: H4/H5 used Daily Rule `DAILY_PRIMARY` G-Scores, not XR.
- Multiple horizons without a declared primary invite mining.
- Shorter horizons increase recent-date coverage but are a new choice and must be justified before results, not after.

**Coverage fact that does not require outcome calculation:** XR observation dates run through `2026-08-19`. Any horizon of `N` UTC days is incomplete for observation dates after `as-of date − N`, where the as-of date is the last available valid outcome price. This coverage truncation must be pre-registered as a reporting rule, not used to drop inconvenient recent XR rows from the 252-date universe.

**Recommended option, pending review:** freeze **one primary horizon** and at most the H4/H5 secondary set. Do not add extra horizons after seeing results. Do not drop incomplete-horizon dates from the H7.1 universe; report them as incomplete-outcome rows.

**FIREWALL.** Do not choose horizons after looking at which one performs best.

---

## 7. D. Price convention

**OPEN FOR REVIEW.** Define the exact outcome-price source and timestamp convention before execution.

XR `xr_observations.csv` does **not** contain a Bitcoin start price. H7.2 therefore cannot inherit H5’s `start_price = artifact_spot_price_usd` without a new, explicit mapping.

Required decisions:

| Decision | Options | Notes |
|---|---|---|
| Price source | Pin a Git blob of `public/data/btc_price_history.csv`; use another documented completed-close series; use an exchange-native series | Moving working-tree market files are not a reproducibility contract |
| Entry / reference price `S` | Same-UTC-date completed close; next UTC close after `reconstruction_as_of_utc`; a clock-aligned intraday print; reconstruction-time surrogate already used inside XR | Using an XR-internal surrogate as both score input and outcome start would mix signal construction with outcome measurement |
| Future price | Completed UTC close on `observation_date + N`; first available close at or after that date | “First available” is a weekend/holiday rule and must be frozen, not improvised |
| UTC boundary | Observation date is already a UTC calendar date; outcome dates should use the same UTC date key | Do not mix local-exchange dates with UTC observation dates |
| Weekends | Bitcoin trades daily in the current completed-UTC-close series used by H4/H5; traditional FX/equity weekend rules are likely irrelevant | Confirm against the pinned series before execution |
| Missing market data | Hard STOP vs mark outcome incomplete vs exclude from the statistic while retaining the XR row in reporting | Silent interpolation is forbidden |
| Provider corrections | Use the pinned blob bytes; do not “fix” later restatements inside H7.2 | A later corrected series requires a new snapshot identity |

**Recommended option, pending review:**

- Pin one Git blob of a completed-UTC-close Bitcoin series **after** independent review, then freeze that blob SHA in the final protocol.
- Treat invalid/missing required closes as incomplete outcomes, not as license to repair XR rows.
- Do not use future-of-day information that would not have been knowable at `reconstruction_as_of_utc` if the study is described as temporally disciplined. If the study is only a same-sample descriptive association against later closes, say so explicitly.

**FIREWALL.** This draft does **not** retrieve, pin, or inspect outcome prices. No BTC return series is loaded here.

---

## 8. E. Eligibility

**Recommended inherited rule, pending confirmation:** primary inferential analysis uses the frozen **234 `ELIGIBLE`** XR dates.

**FIREWALL.** The **18 `NOT_ELIGIBLE`** rows must not be silently dropped from reporting. They remain part of the 252-date universe as recorded missing / ineligible observations.

**OPEN FOR REVIEW.** Additional outcome-completeness eligibility:

- If a primary-horizon price path is incomplete, is that row excluded from the primary statistic, retained as `OUTCOME_INCOMPLETE`, or a hard STOP?
- Are `NOT_ELIGIBLE` XR rows excluded from all inferential statistics, or also summarized as a missingness appendix only?

**Recommended option, pending review:**

- Inferential sample = `xr_status = ELIGIBLE` **and** complete primary-outcome path under the frozen price rule.
- Universe reporting = all 252 dates, with explicit counts for `ELIGIBLE` / `NOT_ELIGIBLE` / outcome-complete / outcome-incomplete.
- Do not recode `NOT_ELIGIBLE` to `ELIGIBLE` because an outcome exists.
- Do not recode `ELIGIBLE` to missing because the outcome is inconvenient.

---

## 9. F. Primary statistic

**OPEN FOR REVIEW.** Define one primary statistic before results are seen.

Conceptual candidates (evaluate during preregistration, select one before execution):

1. **Spearman rank correlation** of XR versus the primary outcome, using independent average-rank vectors and Pearson-on-ranks, matching H4/H5 rank convention. No p-value unless a later protocol adds an explicit inference framework.
2. **Mean or median outcome difference** between pre-registered high and low XR groups.
3. **A discrimination statistic** such as AUC of XR against a pre-registered binary tail event.

**Tradeoffs:**

- Spearman is continuous, rank-based, and already used in H4/H5, which reduces the chance of inventing a new favorite metric after seeing XR results.
- Group-mean differences are easier to narrate and easier to manipulate through grouping.
- AUC requires a binary event that must itself be frozen before results.

**Recommended option, pending review:** if the primary outcome is continuous, prefer **one Spearman association** as the primary statistic because it avoids post-hoc band invention. This remains an open decision, not a freeze.

**FIREWALL.** Do not compute the candidates “just to see.” Selection happens on this protocol branch before execution.

---

## 10. G. Secondary statistics

**OPEN FOR REVIEW.** Secondary / exploratory metrics must be labeled as such before execution.

Likely secondary candidates, if the primary is a Spearman-on-continuous-outcome design:

- the other horizon(s), if more than one horizon is kept
- the non-primary outcome family (return if MACE is primary, or MACE if return is primary)
- MCDD / volatility-family path measures, if retained from H5
- pre-registered tail incidence
- descriptive quantiles of the primary outcome by pre-registered XR groups

**FIREWALL.** A secondary result may not replace the primary result after looking at the numbers. Weak primary + strong secondary = still a weak/inconclusive primary, plus a labeled secondary finding.

---

## 11. H. MACE

**OPEN FOR REVIEW.** Include MACE only if the exact formula, horizon, sign convention, benchmark, and aggregation are frozen first.

If MACE is included, the H5 formula is a **candidate**, not an automatic H7.2 definition:

```text
path = S, C_D, C_D+1, ..., C_D+N
minimum_path_price = min(path)
MACE = 1 - (minimum_path_price / S)
```

Candidate properties from H5, to accept or explicitly replace:

- close-only; not true intraday MAE
- MACE is non-negative
- MACE = 0 if no completed close in the window falls below `S`
- do not convert to dollars for primary analysis
- do not substitute terminal `D+N` return for MACE

H7.2-specific unresolved pieces:

- what `S` is, because XR has no artifact spot field
- whether `C_D` is the same-date close, the next close after `reconstruction_as_of_utc`, or something else
- which `N` is primary
- whether aggregation is Spearman of XR vs MACE, mean MACE by group, or both with one declared primary

**LIMITATION.** Close-only MACE is not true intraday maximum adverse excursion.

**FIREWALL.** Do not calculate MACE in this draft.

---

## 12. I. Drawdown / maximum adverse excursion

**OPEN FOR REVIEW.** If maximum adverse excursion or forward drawdown is included, freeze all of the following before calculation:

| Item | Questions to resolve |
|---|---|
| Exact interval | Primary `N` only, or also 30/90/180? Inclusive of `D`? |
| Intraday vs closing prices | H4/H5 series is close-only. True intraday MAE/drawdown would need a separately pinned OHLC or tick source |
| Sign convention | Magnitude of adverse move vs signed return vs peak-to-trough from a running peak (MCDD) |
| Recovery | Is recovery inside the window ignored (pure adverse excursion) or netted (terminal return)? |
| Aggregation | Spearman, mean/median, tail incidence, or group contrast |

**Recommended option, pending review:** if a path measure is used, keep the H5 distinction:

- **MACE** = adverse excursion from a fixed start `S`
- **MCDD** = close-to-close running-peak drawdown

and do not claim either is intraday.

**FIREWALL.** Do not calculate drawdowns in this draft.

---

## 13. J. Score relationship

**OPEN FOR REVIEW.** Pre-register whether XR is treated as continuous, ordinal/rank, fixed bands, or a combination.

Options:

1. **Continuous 0–100 XR** for the primary statistic.
2. **Ranks of XR** (Spearman already rank-transforms).
3. **Fixed production GhostGauge bands**, applied to XR only if the exact production band map is copied and labeled as an exploratory overlay, not as official XR bands.
4. **New XR-specific bands.**

**FIREWALL.** No new score bands may be invented after seeing outcomes.

**Recommended option, pending review:** primary analysis treats XR as **continuous / rank**. Any band overlay must use a pre-copied production map or a grouping frozen in the final protocol. Do not create “XR-native” bands during or after execution.

**LIMITATION.** Applying production band labels to XR does not make XR an official G-Score print.

---

## 14. K. Multiple comparisons

**OPEN FOR REVIEW.** Define primary versus secondary so dozens of horizon/statistic combinations cannot be mined for a favorable answer.

Minimum freeze required before execution:

- one analysis question class
- one primary outcome
- one primary horizon
- one primary statistic
- one inferential sample rule

Everything else is secondary, coverage, or diagnostic.

**Recommended option, pending review:** report the full pre-registered secondary set, but interpret only the primary combination as the H7.2 result. Do not add “just one more” horizon, tail threshold, or grouping after results.

**FIREWALL.** p-hacking by horizon, by statistic, by dropping `NOT_ELIGIBLE` dates, by dropping incomplete recent dates, or by inventing bands is prohibited.

---

## 15. L. Null / inconclusive result

**OPEN FOR REVIEW.** Define supportive / contradictory / inconclusive **before** observing results.

The final protocol must fill numeric or ordinal thresholds. This draft only states the required shape.

Candidate interpretation skeleton, not yet frozen:

| Label | Meaning to freeze |
|---|---|
| Supportive | Primary statistic has the pre-registered sign/direction and is large enough, under the frozen sample, to count as support for the stated XR-to-outcome association. Exact threshold TBD in review. |
| Contradictory | Primary statistic has the opposite sign/direction, or a pre-registered magnitude strong enough to count against the stated association. Exact threshold TBD in review. |
| Inconclusive | Magnitude too small, coverage too thin, or primary sample too incomplete to support either claim. |

**Recommended option, pending review:** do **not** use a p-value cutoff as the sole decision rule unless an inference framework is separately preregistered. H4/H5 reported rank associations without significance stars; copying that restraint is coherent. Magnitude and coverage still need explicit inconclusive bounds so a near-zero result cannot be narrated as success.

**FIREWALL.** A near-zero primary result is not license to promote a prettier secondary chart.

---

## 16. M. Claim firewall

**FIREWALL.** H7.2 may not claim:

- “GhostGauge predicted X historically”
- “GhostGauge would have predicted X”
- “historical G-Score did Y” from XR evidence
- “the model is validated / invalidated”
- “weights or bands should change”
- “XR is as-published”
- “XR is point-in-time validation”

Permitted later language, and only if the frozen design actually supports it:

- “In this frozen exploratory reconstruction sample, XR was associated with …”
- “This is hypothesis generation, not validation.”
- “XR remains exploratory reconstruction, not historical G-Score.”

**LIMITATION.** Association in an exploratory reconstruction sample is not a trading result, not a forecast audit, and not a production-calibration result.

---

## 17. N. Tuning firewall

**FIREWALL.** No result from H7.2 may automatically change:

- weights
- subweights
- bands
- thresholds
- production methodology
- reconstruction roles or scores

**FIREWALL.** Calibration remains **CLOSED**.

Any future calibration work must be a separately authorized experiment with its own protocol, identities, and review. H7.2 cannot be that experiment.

---

## 18. Implementation gate

This document is **framework only**.

H7.2 execution **may not begin** until:

1. independent methodology review of this framework
2. open decisions A–N are resolved or explicitly deferred
3. a later commit freezes a real protocol version, distinct from this draft label
4. any pinned outcome-price blob SHA is recorded
5. analysis code is written against those frozen identities only

Until then:

- do not write analysis code
- do not retrieve outcome data for this study
- do not calculate statistics
- do not merge H7.2 as complete

---

## 19. Explicit non-actions in this draft

Confirmed for this Stage A commit:

- no outcome data retrieved
- no outcome statistics calculated
- no H7.1 data changed
- no tuning
- no calibration
- no analysis implementation
- H7.2 not merged

---

## 20. Review checklist

Independent review should resolve or explicitly defer:

- [ ] A. Analysis question class
- [ ] B. One primary Bitcoin outcome
- [ ] C. Exact forward horizon(s), with one primary
- [ ] D. Price source blob, `S`, future price, UTC/weekend/missing-data rules
- [ ] E. Inferential sample vs universe reporting for the 18 `NOT_ELIGIBLE` dates and incomplete outcomes
- [ ] F. One primary statistic
- [ ] G. Labeled secondary list
- [ ] H. MACE formula / inclusion decision
- [ ] I. Drawdown formula / inclusion decision
- [ ] J. Continuous vs rank vs frozen bands
- [ ] K. Primary-versus-secondary firewall
- [ ] L. Supportive / contradictory / inconclusive thresholds
- [ ] M. Claim language
- [ ] N. Tuning / calibration remaining closed

STOP FOR INDEPENDENT H7.2 METHODOLOGY REVIEW.
