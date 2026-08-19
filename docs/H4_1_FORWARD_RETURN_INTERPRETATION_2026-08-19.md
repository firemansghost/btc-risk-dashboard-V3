# GhostGauge H4.1 Forward-Return Interpretation Closeout

**Date:** 2026-08-19
**Phase:** H4.1 interpretation only
**Audited `origin/main`:** `ad6be423dc5222c0844e1a367742984d1e69c2d7`
**Frozen H4.1 result-set merge:** `876fefbacabd8e645e90a8fdd4be28c71acc42c9`
**Frozen H4 analysis source:** `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b`
**Protocol version:** `h4-forward-return-v1`
**Branch:** `docs/h4-1-forward-return-interpretation`

**Status:** Formal interpretation of the first pre-registered GhostGauge forward-return study. **No new calculations.** Calibration gate remains **CLOSED**.

Labels used below:

- **FACT** — copied from already-frozen H4 protocol and H4.1 outputs
- **INTERPRETATION** — reading of those frozen numbers against the pre-registered H4 question
- **LIMITATION** — a bound on what H4.1 may claim
- **DECISION** — closeout action or non-action frozen here

This document does **not** modify `docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md`, does **not** regenerate `research/forward-returns/**`, and does **not** authorize model changes.

Authoritative frozen inputs:

- `docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md`
- `research/forward-returns/README.md`
- `research/forward-returns/summary_by_horizon.csv`
- `research/forward-returns/score_association.csv`
- `research/forward-returns/summary_by_numeric_band.csv`
- `research/forward-returns/summary_by_model_version.csv`

---

## 1. Executive conclusion

**INTERPRETATION.** The frozen historical sample shows essentially no useful monotonic relationship between published G-Score and subsequent 30-, 90-, or 180-calendar-day Bitcoin returns. The observed rank relationships are small and directionally opposite the expected forward-return ordering.

**FACT.** H4 expected that a higher published G-Score would be associated with a less favorable subsequent Bitcoin return. The frozen Spearman rank associations are:

| Horizon | n | Spearman rho |
|---|---|---|
| 30 | 292 | `0.03218388496690566` |
| 90 | 235 | `0.05148484671137791` |
| 180 | 152 | `0.06316457953944889` |

All three values are close to zero and slightly positive.

**LIMITATION.** No inferential test was performed. These numbers do not prove the absence of every possible relationship. They also do not support treating historical GhostGauge as a validated forward-return ranking signal.

**DECISION.** H4.1 does not authorize calibration, weight changes, band changes, scoring-formula changes, or recommendation changes. Current `v1.1.1` has zero completed H4.1 outcomes. The next research step is a separately pre-registered risk-outcome protocol (H5), not retuning.

---

## 2. Study identity and frozen evidence

**FACT.** H4 froze the analysis design before returns were calculated. H4.1 generated the first result set under that protocol.

| Item | Value |
|---|---|
| Protocol | `docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md` |
| Protocol version | `h4-forward-return-v1` |
| Analysis source SHA | `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` |
| Result-set merge | `876fefbacabd8e645e90a8fdd4be28c71acc42c9` |
| Current `origin/main` at this closeout | `ad6be423dc5222c0844e1a367742984d1e69c2d7` |
| Advancement after H4.1 | `chore(etl): update artifacts [skip ci]` |

**FACT.** The H4.1 research outputs at current `origin/main` match the frozen result-set hashes. This closeout interprets those files. It does not recreate them.

**FACT.** Population frozen by H3.1 / H4 / H4.1:

- 338 calendar rows
- 323 `DAILY_PRIMARY`
- 4 `REVIEW_REQUIRED`
- 11 `NO_DAILY_PRIMARY`

**FACT.** Eligible completed forward-return rows:

- 30-calendar-day: 292
- 90-calendar-day: 235
- 180-calendar-day: 152
- total row-level observations: 679
- 365-day performance rows: 0

**FACT.** Return contract, unchanged:

- start = artifact spot `price_usd`
- end = exact UTC calendar `observation_date + N` completed Coinbase close
- formula = simple `(end / start) - 1`
- association statistic = average-rank Spearman of G-Score vs that simple return

**LIMITATION.** Git existence is not historical Vercel deployment proof. Historical lineage is not validated current `v1.1.1` performance.

---

## 3. Primary research question

**FACT.** The H4 primary question was:

> Within Daily Rule v1 historical GhostGauge observations, was a higher published G-Score associated with less favorable subsequent Bitcoin returns over the pre-specified 30-, 90-, and 180-calendar-day horizons?

**FACT.** The expected directional relationship was:

higher G-Score → less favorable subsequent Bitcoin return

That expected rank relationship is negative Spearman rho between G-Score and simple forward return.

**LIMITATION.** H4.1 tested terminal forward Bitcoin price return only. It did not test drawdowns, volatility, downside volatility, tail-event incidence, factor performance, or trading-strategy outcomes.

---

## 4. Primary continuous-score result

**FACT.** Frozen `score_association.csv`:

| Horizon | n | Spearman rho | Status |
|---|---|---|---|
| 30 | 292 | `0.03218388496690566` | OK |
| 90 | 235 | `0.05148484671137791` | OK |
| 180 | 152 | `0.06316457953944889` | OK |

**INTERPRETATION.** The H4.1 historical sample does **not** show the expected monotonic score-to-forward-return relationship. All three rank associations are close to zero and slightly positive, which is opposite the expected negative direction.

**INTERPRETATION.** The frozen historical sample shows essentially no useful monotonic relationship between published G-Score and subsequent 30-, 90-, or 180-calendar-day Bitcoin returns. The observed rank relationships are small and directionally opposite the expected forward-return ordering.

**LIMITATION.** No p-value, confidence interval, or significance label was computed. Do not describe these associations as statistically significant or statistically insignificant. Do not write that they prove no relationship exists.

**LIMITATION.** Overlapping daily windows mean the nominal `n` values are not independent market experiments. Precision must not be overstated from the printed decimals.

---

## 5. Market-return context

**FACT.** Frozen `summary_by_horizon.csv`:

| Horizon | n | Mean | Median | p25 | p75 | Min | Max | Status |
|---|---|---|---|---|---|---|---|---|
| 30 | 292 | `-0.0522998541495515` | `-0.023187177057495956` | `-0.15175155979087296` | `0.0319388105545928` | `-0.3301676015794949` | `0.18613549617313696` | OK |
| 90 | 235 | `-0.15030780519985631` | `-0.19123889274344708` | `-0.23383278769099353` | `-0.11147417715254854` | `-0.37204579202375854` | `0.22248923009629062` | OK |
| 180 | 152 | `-0.26673426605815687` | `-0.2918963567214518` | `-0.3222997956004303` | `-0.20981155950415561` | `-0.45708259062973977` | `-0.021434131594577188` | OK |

**INTERPRETATION.** The frozen sample spans a strongly adverse Bitcoin outcome period. At 180 days, even the maximum observed return in the eligible sample was negative.

**LIMITATION.** This is important market context. It does **not** excuse the lack of score ordering.

**INTERPRETATION.** The adverse market environment limits the breadth of regimes represented in this first study, while the score still would have needed to rank relative outcomes within that environment to satisfy the H4 forward-return question.

---

## 6. Numeric-band result and coverage limits

**FACT.** Frozen numeric-band universe: 18 rows, 3 horizons × 6 published integer-score bands.

| Band | Score range |
|---|---|
| Aggressive Buying | 0–14 |
| Regular DCA Buying | 15–34 |
| Moderate Buying | 35–49 |
| Hold & Wait | 50–64 |
| Reduce Risk | 65–79 |
| High Risk | 80–100 |

**FACT.** Coverage:

- Aggressive Buying: `n = 0` at 30 / 90 / 180; status `NO_COMPLETED_OUTCOMES`
- Regular DCA Buying: `n = 0` at 30 / 90 / 180; status `NO_COMPLETED_OUTCOMES`
- High Risk: `n = 0` at 30 / 90 / 180; status `NO_COMPLETED_OUTCOMES`
- Reduce Risk: `n = 3` at 30 / 90 / 180; status `SMALL N — DESCRIPTIVE ONLY`

**FACT.** The adequately populated groups are primarily Moderate Buying and Hold & Wait. Frozen mean simple returns:

| Horizon | Moderate Buying mean | Hold & Wait mean |
|---|---|---|
| 30 | `-0.07966545367596736` | `-0.045398990004635584` |
| 90 | `-0.18077313089809416` | `-0.13919840376105497` |
| 180 | `-0.3033152359111613` | `-0.24463867921338633` |

**INTERPRETATION.** Hold & Wait had less-negative mean forward returns than Moderate Buying at all three horizons. That ordering is not consistent with the desired interpretation that higher risk scores should generally correspond to less favorable subsequent returns.

**LIMITATION.** Do not claim the full six-band system was tested. The historical H4.1 sample has essentially no completed evidence from the lowest two bands or High Risk and only three observations from Reduce Risk. Therefore the first study primarily evaluates score behavior in the middle of the scale rather than across the full 0–100 operating range.

**DECISION.** Bands are not merged, re-bucketed, or re-thresholded in this closeout.

---

## 7. Model-version result

**FACT.** Frozen model-version universe: 9 rows. Groups preserved exactly as labeled in the H3.1 daily view:

- `v3.1.0`
- `v1.1`
- `v1.1.1`

for horizons 30, 90, and 180.

**FACT.** Current-model completed outcomes:

| Horizon | `v1.1.1` n | Mean | Median | Status |
|---|---|---|---|---|
| 30 | 0 | empty | empty | `NO_COMPLETED_OUTCOMES` |
| 90 | 0 | empty | empty | `NO_COMPLETED_OUTCOMES` |
| 180 | 0 | empty | empty | `NO_COMPLETED_OUTCOMES` |

**INTERPRETATION.** H4.1 provides no completed forward-return evidence for current `v1.1.1`.

**LIMITATION.** Do not infer methodology eras from these labels. Do not interpret historical `v3.1.0` versus `v1.1` differences as proof that one implementation is better. They occurred during different chronological portions of the Bitcoin market and are descriptive lineage slices only. They are not controlled comparisons.

**LIMITATION.** Historical GhostGauge lineage is not validated current `v1.1.1` performance.

---

## 8. Overlapping-window limitation

**FACT.** Nominal observation counts are 292 / 235 / 152.

**LIMITATION.** Those counts do **not** represent that many independent market experiments. Daily 30-, 90-, and 180-day return windows overlap heavily.

Therefore:

- do not make significance claims
- do not treat `n` as independent trials
- do not overstate precision

**FACT.** This limitation was frozen in H4 before results existed. It is not a post-hoc qualifier added because the associations were small.

---

## 9. What H4.1 supports

**INTERPRETATION / DECISION.** Freeze these conclusions:

**A.** The historical GhostGauge lineage is **not** validated as a forward-return ranking signal by H4.1.

**B.** The frozen sample does not show the expected monotonic relationship between higher G-Score and worse subsequent terminal Bitcoin return.

**C.** The middle score bands dominate the sample.

**D.** The sample represents limited market-regime diversity and strongly adverse subsequent Bitcoin outcomes.

**E.** No completed forward-return evidence exists yet for current `v1.1.1`.

**F.** No calibration or model change is justified from H4.1 alone.

---

## 10. What H4.1 does not support

**LIMITATION / DECISION.** Explicitly reject these conclusions:

- "The G-Score works."
- "The G-Score fails."
- "GhostGauge is useless."
- "Current v1.1.1 has been validated."
- "Current v1.1.1 has been invalidated."
- "The historical bands are properly calibrated."
- "The factor weights are correct."
- "The factor weights are wrong."
- "The model predicts price."
- "The model does not measure risk."

**FACT.** H4.1 tested one specific outcome: terminal forward Bitcoin price return.

**LIMITATION.** It did **not** test the complete concept of market risk.

---

## 11. Forward return versus risk measurement

**FACT.** GhostGauge is intended as a risk gauge. Terminal return is one outcome dimension.

**LIMITATION.** A risk gauge may potentially be useful even if it does not rank terminal returns well if higher scores are associated with outcomes such as:

- deeper subsequent drawdowns
- larger maximum adverse excursion
- greater realized volatility
- greater downside volatility
- greater incidence of severe downside/tail events

**FACT.** H4.1 did **not** calculate any of those.

**DECISION.** The next research question should examine risk outcomes directly under a separately pre-registered protocol. Those quantities are not calculated in this closeout.

---

## 12. Calibration decision

**DECISION.** Calibration remains **CLOSED**.

**DECISION.** No official G-Score weight, factor, threshold, numeric band, scoring formula, or recommendation should change because of H4.1.

Reasons include:

- H4.1 does not show the expected forward-return ordering
- current `v1.1.1` has zero completed outcomes
- the score distribution does not cover much of the full range
- outcomes overlap heavily
- historical lineage spans multiple implementations
- the sample represents limited market-regime diversity

**DECISION.** The response to an inconvenient result is more evidence, not immediate retuning.

---

## 13. H5 recommendation

**DECISION.** Recommend:

**H5 — Risk-Outcome Analysis Protocol Freeze**

H5 must be designed **before** any new risk-outcome numbers are calculated.

Potential outcome families for H5 to evaluate and choose among include:

1. Maximum adverse excursion / maximum drawdown after observation
2. Realized volatility after observation
3. Downside volatility
4. Severe downside / tail-event incidence

**DECISION.** Do not choose exact definitions opportunistically in this H4.1 closeout.

H5 must specify, before calculations:

- exact outcome definitions
- start/end windows
- price series
- horizon treatment
- overlapping-window treatment
- score association statistic
- band reporting
- missingness
- inference limitations
- result universe

**DECISION.** Do not begin H5 calculations on this branch.

---

## 14. Longer point-in-time backtesting recommendation

**DECISION.** A longer historical backtest may be valuable and may ultimately be necessary to evaluate GhostGauge across multiple Bitcoin regimes.

**LIMITATION.** More historical rows are useful **only** if the underlying model inputs are point-in-time defensible.

**DECISION.** Do **not** recommend simply running the current model backward using today's APIs.

Known historical hazards include:

- revised macroeconomic data
- current API responses substituted for historical observations
- historically unavailable ETF/flow values
- reconstructed or synthetic signals
- lookahead contamination
- current methodology projected backward onto data it did not have

**DECISION.** Recommend a later **POINT-IN-TIME REPLAY FEASIBILITY AUDIT** before any expanded current-model backtest.

That audit should determine, factor by factor:

- which historical raw inputs can be recovered point-in-time
- earliest trustworthy date
- revision/vintage behavior
- source publication lag
- missing historical coverage
- whether exact current-model computation is reproducible
- whether any replay would need to be labeled exploratory rather than validation-grade

**DECISION.** Do not build that replay in this phase.

---

## 15. Continued v1.1.1 forward evidence

**DECISION.** Genuine forward `v1.1.1` evidence should continue accumulating untouched.

**DECISION.** The original H4/H4.1 analysis remains frozen. Future `v1.1.1` completed outcomes must be evaluated under a new explicit data snapshot rather than overwriting H4.1.

**DECISION.** Do not tune `v1.1.1` while collecting that evidence unless an independently justified correctness/integrity bug requires repair.

---

## 16. Final closeout statement

H4.1 FORWARD-RETURN STUDY CLOSED —

THE FROZEN HISTORICAL LINEAGE DID NOT SHOW THE EXPECTED
G-SCORE-TO-FORWARD-RETURN ORDERING —

THIS DOES NOT CONSTITUTE COMPLETE RISK VALIDATION OR INVALIDATION —

CURRENT v1.1.1 HAS NO COMPLETED H4.1 OUTCOMES —

NO MODEL TUNING AUTHORIZED —

CALIBRATION GATE CLOSED —

NEXT: PRE-REGISTER DIRECT RISK-OUTCOME TESTS AND EVALUATE
POINT-IN-TIME BACKTEST FEASIBILITY
