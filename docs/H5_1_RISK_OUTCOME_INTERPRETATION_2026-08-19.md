# GhostGauge H5.1 Risk-Outcome Interpretation Closeout

**Date:** 2026-08-19
**Phase:** H5.1 interpretation only
**Audited `origin/main`:** `86623656544a71af47279c8d7ce7c07c2eb65d0a`
**Frozen H5 protocol:** `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md`
**Frozen H5.1 result-set merge:** `86623656544a71af47279c8d7ce7c07c2eb65d0a`
**Frozen H5 analysis source:** `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b`
**Protocol version:** `h5-risk-outcome-v1`
**Branch:** `docs/h5-1-risk-outcome-interpretation`

**Status:** Formal interpretation of the first pre-registered GhostGauge direct risk-outcome study. **No new calculations.** Calibration gate remains **CLOSED**.

Labels used below:

- **FACT** — copied from already-frozen H5 protocol and H5.1 outputs
- **INTERPRETATION** — reading of those frozen numbers against the pre-registered H5 question
- **LIMITATION** — a bound on what H5.1 may claim
- **DECISION** — closeout action or non-action frozen here

This document does **not** modify `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md`, does **not** regenerate `research/risk-outcomes/**`, does **not** regenerate H4/H4.1, and does **not** authorize model changes.

Authoritative frozen inputs:

- `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md`
- `research/risk-outcomes/README.md`
- `research/risk-outcomes/summary_by_horizon.csv`
- `research/risk-outcomes/score_association.csv`
- `research/risk-outcomes/summary_by_numeric_band.csv`
- `research/risk-outcomes/summary_by_model_version.csv`

---

## 1. Executive conclusion

**INTERPRETATION.** The frozen historical lineage shows **horizon-dependent** associations between published G-Score and subsequent close-based risk-path outcomes. The three calculated horizons do not tell one story.

**FACT.** H5 expected that a higher published G-Score would be associated with a larger subsequent Maximum Adverse Close Excursion (MACE) magnitude. The frozen primary Spearman rank associations are:

| Horizon | n | Spearman rho |
|---|---|---|
| 30 | 292 | `0.008510803537346878` |
| 90 | 235 | `-0.20991000131435208` |
| 180 | 152 | `0.334004150838944` |

**INTERPRETATION.**

- 30d is directionally concordant by sign but numerically near zero. A positive sign alone is not useful validation.
- 90d is directionally opposite the pre-registered expected relationship.
- 180d is directionally concordant and the largest positive primary association among the three frozen horizons.

**LIMITATION.** The 180d result is **not** called validated, predictive, significant, proof, or successful calibration. No inferential testing was performed.

**DECISION.** H5.1 does not authorize calibration, weight changes, band changes, scoring-formula changes, or recommendation changes. Current `v1.1.1` has zero completed H5.1 outcomes. Combined H4.1 + H5.1 evidence does not establish a stable, horizon-robust historical ranking relationship. The next research step is a point-in-time replay feasibility audit (H6), not retuning.

---

## 2. Study identity and frozen evidence

**FACT.** H5 froze the analysis design before risk outcomes were calculated. H5.1 generated the first result set under that protocol.

| Item | Value |
|---|---|
| Protocol | `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md` |
| Protocol version | `h5-risk-outcome-v1` |
| Analysis source SHA | `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` |
| Result-set merge | `86623656544a71af47279c8d7ce7c07c2eb65d0a` |
| Current `origin/main` at this closeout | `86623656544a71af47279c8d7ce7c07c2eb65d0a` |

**FACT.** This closeout interprets those frozen files. It does not recreate them.

**FACT.** Population frozen by H3.1 / H4 / H5 / H5.1:

- 338 calendar rows
- 323 `DAILY_PRIMARY`
- 4 `REVIEW_REQUIRED`
- 11 `NO_DAILY_PRIMARY`

**FACT.** Eligible completed risk-outcome rows:

- 30-calendar-day: 292
- 90-calendar-day: 235
- 180-calendar-day: 152
- total row-level observations: 679
- 365-day performance rows: 0

**FACT.** Primary outcome contract, unchanged:

- start = artifact spot `price_usd`
- path = completed UTC closes from observation date D through D+N inclusive, plus the artifact start price as a floor candidate
- MACE = `1 - min(S, C_D, ..., C_D+N) / S`
- this is **not** true intraday MAE
- association statistic = average-rank Spearman of G-Score vs unrounded MACE
- expected direction = **POSITIVE**

**LIMITATION.** Git existence is not historical Vercel deployment proof. Historical lineage is not validated current `v1.1.1` performance.

---

## 3. Primary pre-registered question

**FACT.** The H5 primary question was:

> Within Daily Rule v1 historical GhostGauge observations, was a higher published G-Score associated with a larger subsequent Maximum Adverse Close Excursion magnitude over 30, 90, and 180 calendar days?

**FACT.** The expected directional relationship was:

higher G-Score → larger subsequent MACE magnitude

That expected rank relationship is **positive** Spearman rho between G-Score and MACE.

**FACT.** Frozen primary results from `score_association.csv`:

| Horizon | n | Spearman rho | Expected direction | Status |
|---|---|---|---|---|
| 30 | 292 | `0.008510803537346878` | POSITIVE | OK |
| 90 | 235 | `-0.20991000131435208` | POSITIVE | OK |
| 180 | 152 | `0.334004150838944` | POSITIVE | OK |

**INTERPRETATION.** 30d is directionally concordant by sign but numerically near zero. Do not characterize a positive sign alone as useful validation.

**INTERPRETATION.** 90d is directionally opposite the pre-registered expected relationship.

**INTERPRETATION.** 180d is directionally concordant and the largest positive primary association among the three frozen horizons.

**LIMITATION.** Do not call the 180d result validated, predictive, significant, proof, or successful calibration. No inferential testing was performed.

---

## 4. Secondary continuous results

**FACT.** Frozen Spearman values from `score_association.csv` for the four continuous outcomes:

| Horizon | Outcome | Spearman rho |
|---|---|---|
| 30 | maximum_adverse_close_excursion_magnitude | `0.008510803537346878` |
| 30 | maximum_close_drawdown_magnitude | `-0.048606866017602245` |
| 30 | close_to_close_volatility_annualized | `-0.1611344027512241` |
| 30 | zero_target_downside_deviation_annualized | `-0.08457637996261376` |
| 90 | maximum_adverse_close_excursion_magnitude | `-0.20991000131435208` |
| 90 | maximum_close_drawdown_magnitude | `-0.2771980914428936` |
| 90 | close_to_close_volatility_annualized | `-0.5351118771028875` |
| 90 | zero_target_downside_deviation_annualized | `-0.340912152936228` |
| 180 | maximum_adverse_close_excursion_magnitude | `0.334004150838944` |
| 180 | maximum_close_drawdown_magnitude | `0.21757090044389843` |
| 180 | close_to_close_volatility_annualized | `0.2947629033539691` |
| 180 | zero_target_downside_deviation_annualized | `0.13451749129724722` |

**INTERPRETATION.** The horizon pattern is not unique to MACE. All four continuous measures are directionally opposite the expected positive relationship at 90d. All four are directionally concordant at 180d. At 30d, primary MACE is near zero while the three secondary relationships are negative.

**INTERPRETATION.** This supports describing the frozen historical relationship as **horizon-dependent**.

**LIMITATION.** Do not claim the four outcomes are independent confirmations. They use overlapping observations and related Bitcoin price paths.

---

## 5. Overall market-risk context

**FACT.** Frozen horizon MACE summaries from `summary_by_horizon.csv`:

| Horizon | n | mean | median | p25 | p75 | min | max |
|---|---|---|---|---|---|---|---|
| 30 | 292 | `0.10737695594669797` | `0.07284877515661836` | `0.02894794426399397` | `0.18393818939015305` | `0` | `0.3511290680764203` |
| 90 | 235 | `0.23184640902060719` | `0.2524614935587891` | `0.1814395333219832` | `0.2966106413654829` | `0` | `0.40774817917770456` |
| 180 | 152 | `0.3482939779412759` | `0.3458452382835755` | `0.31091269164342616` | `0.42587369290898697` | `0.1135164963168418` | `0.4951578456841347` |

**FACT.** Frozen tail incidence on unrounded MACE:

| Horizon | n | >=10% count | >=10% rate | >=20% count | >=20% rate | >=30% count | >=30% rate |
|---|---|---|---|---|---|---|---|
| 30 | 292 | 115 | `0.3938356164383562` | 63 | `0.21575342465753425` | 15 | `0.05136986301369863` |
| 90 | 235 | 207 | `0.8808510638297873` | 170 | `0.723404255319149` | 50 | `0.2127659574468085` |
| 180 | 152 | 152 | `1` | 138 | `0.9078947368421053` | 122 | `0.8026315789473685` |

**INTERPRETATION.** The frozen sample contains substantial long-horizon Bitcoin downside. This describes the market path represented by the sample. It does **not** establish model quality.

**LIMITATION.** Do not use adverse market conditions to excuse unfavorable score ordering.

---

## 6. Numeric-band coverage

**FACT.** Frozen band n from `summary_by_numeric_band.csv`:

| Horizon | Aggressive Buying | Regular DCA Buying | Moderate Buying | Hold & Wait | Reduce Risk | High Risk |
|---|---|---|---|---|---|---|
| 30 | 0 | 0 | 60 | 229 | 3 | 0 |
| 90 | 0 | 0 | 57 | 175 | 3 | 0 |
| 180 | 0 | 0 | 49 | 100 | 3 | 0 |

**FACT.** Aggressive Buying, Regular DCA Buying, and High Risk have n = 0 at **all** horizons. Status for those rows: `NO_COMPLETED_OUTCOMES`.

**FACT.** Reduce Risk has n = 3 at all horizons. Status: `SMALL N — DESCRIPTIVE ONLY`.

**INTERPRETATION.** The study does **not** test the full six-band scale. The meaningful population is concentrated primarily in Moderate Buying and Hold & Wait.

---

## 7. Moderate Buying versus Hold & Wait

**FACT.** Frozen mean MACE for the two populated middle bands:

| Horizon | Moderate Buying n | Moderate Buying mean MACE | Hold & Wait n | Hold & Wait mean MACE |
|---|---|---|---|---|
| 30 | 60 | `0.12749719096917123` | 229 | `0.10253430822967886` |
| 90 | 57 | `0.2694410766228299` | 175 | `0.21923680401770052` |
| 180 | 49 | `0.34832009019596505` | 100 | `0.3453440360501564` |

**INTERPRETATION.** Moderate Buying had higher mean MACE than Hold & Wait at all three horizons. At 180d they are nearly equal.

**INTERPRETATION.** Therefore the published Moderate-versus-Hold band crosswalk does **not** show the expected clean ordering in this frozen sample. This remains true even though the score-level 180d Spearman is positive.

**LIMITATION.** Do not infer that the 180d score-level association validates the published bands. Reduce Risk n = 3 is too sparse for broad conclusions.

---

## 8. Model-version limitation

**FACT.** Frozen completed-horizon counts from `summary_by_model_version.csv`:

| Horizon | v3.1.0 | v1.1 | v1.1.1 |
|---|---|---|---|
| 30 | 83 | 209 | 0 |
| 90 | 83 | 152 | 0 |
| 180 | 83 | 69 | 0 |

**FACT.** Current `v1.1.1` has status `NO_COMPLETED_OUTCOMES` at all three calculated horizons.

**LIMITATION.** H5.1 provides **no** completed direct-risk evidence about current `v1.1.1`.

**LIMITATION.** Do not interpret `v3.1.0` versus `v1.1` as a controlled model comparison. Their observations occur in different dates / regimes.

---

## 9. Overlapping-window limitation

**FACT.** Eligible n of 292 / 235 / 152 are nominal observations.

**LIMITATION.** Daily 30/90/180 windows overlap heavily. They are **not** independent market trials.

**LIMITATION.** No significance claim, p-value, confidence interval, or independent-trial precision claim is authorized.

---

## 10. Relationship to H4.1

**FACT.** H4.1 tested terminal forward Bitcoin return. Its expected G-Score ordering was **not** shown.

**FACT.** H5.1 tests direct close-based risk-path outcomes instead, on the same frozen analytical population and the same frozen Bitcoin completed-close series.

**INTERPRETATION.** H5.1 provides a more nuanced result:

- 30d primary ordering is near zero
- 90d ordering is opposite expected
- 180d ordering is directionally concordant
- band-level ordering remains incomplete / inconsistent

**INTERPRETATION.** Combined H4.1 + H5.1 evidence does **not** establish a stable, horizon-robust historical ranking relationship.

**INTERPRETATION.** H5.1's 180d result provides a directionally concordant long-horizon pattern that is reasonable to investigate with additional defensible evidence.

**LIMITATION.** Do **not** say:

- H4 disproved GhostGauge
- H5 proved GhostGauge
- H5 rescued H4
- GhostGauge works
- GhostGauge fails

---

## 11. What H5.1 supports

**INTERPRETATION.** H5.1 supports the following statements and no stronger:

- The historical lineage shows horizon-dependent associations with direct close-based risk outcomes.
- The 180d historical score-to-MACE relationship is directionally concordant with the pre-registered risk ordering.
- The 30d primary relationship is numerically near zero.
- The 90d primary relationship is directionally opposite expected.
- Published-band coverage is incomplete and dominated by middle bands.
- Current `v1.1.1` has no completed H5.1 outcomes.

---

## 12. What H5.1 does not support

**LIMITATION.** H5.1 does **not** prove, and must not be cited as proving:

- current `v1.1.1` is valid
- current `v1.1.1` is invalid
- weights are correct
- weights are wrong
- bands are calibrated
- bands should be changed
- the model predicts crashes
- the model predicts returns
- trading profitability
- causality
- intraday downside risk
- full-cycle performance

**FACT.** H5.1 tested close-only path measures. It did **not** test true intraday MAE, true intraday maximum drawdown, OHLC paths, or strategy outcomes.

---

## 13. Calibration decision

**DECISION.** Calibration remains **CLOSED**.

**DECISION.** No official G-Score weight, subweight, factor formula, score formula, threshold, numeric band, recommendation, or data source should change because of H5.1.

**DECISION.** No tuning to improve historical H5.1 ordering is authorized.

Reasons include:

- the primary result is horizon-dependent rather than uniformly concordant
- 90d primary ordering is opposite expected
- 30d primary ordering is near zero
- published-band coverage is incomplete
- Moderate-versus-Hold mean MACE does not show the expected clean ordering
- current `v1.1.1` has zero completed outcomes
- outcomes overlap heavily
- historical lineage spans multiple implementations

**DECISION.** The response to a mixed result is more defensible evidence, not immediate retuning.

---

## 14. Current v1.1.1 forward collection

**DECISION.** Genuine forward `v1.1.1` evidence should continue accumulating untouched. Do not retroactively alter those observations.

**DECISION.** The original H5/H5.1 analysis remains frozen. Future `v1.1.1` completed-risk analysis requires a **new** explicit frozen snapshot. Do not overwrite H5.1.

**DECISION.** Do not tune `v1.1.1` while collecting that evidence unless an independently justified correctness/integrity bug requires repair.

---

## 15. Next research track

**DECISION.** Recommend:

**H6 — Point-in-Time Replay Feasibility Audit**

Purpose: determine whether a longer, multi-regime backtest of the **current** methodology can be constructed without lookahead contamination.

**DECISION.** H6 is **feasibility first**. Do not calculate historical scores during this H5.1 closeout.

The audit must be factor-by-factor and should assess:

- historical raw-data availability
- earliest trustworthy date
- publication timing
- historical revisions / vintage requirements
- API historical behavior
- coverage gaps
- whether exact current factor math can be reproduced
- whether source data were actually knowable on each historical date
- whether validation-grade replay is possible
- whether only exploratory reconstruction is possible
- whether some periods/factors are impossible to reproduce defensibly

**LIMITATION.** Explicit hazards include:

- current APIs queried for historical dates
- revised macro data
- ETF-flow availability
- synthetic/reconstructed historical signals
- social-data revisions/sampling
- historical leverage/term availability
- lookahead
- current methodology projected backward without point-in-time inputs

**DECISION.** Do not begin H6 on this branch.

---

## 16. Final closeout statement

H5.1 DIRECT RISK-OUTCOME STUDY CLOSED —

FROZEN HISTORICAL LINEAGE SHOWS HORIZON-DEPENDENT RISK ORDERING —

30-DAY PRIMARY RELATIONSHIP NEAR ZERO —

90-DAY PRIMARY RELATIONSHIP OPPOSITE EXPECTED —

180-DAY PRIMARY RELATIONSHIP DIRECTIONALLY CONCORDANT —

FULL BAND SYSTEM NOT VALIDATED —

CURRENT v1.1.1 HAS NO COMPLETED H5.1 OUTCOMES —

NO MODEL TUNING AUTHORIZED —

CALIBRATION GATE CLOSED —

NEXT: POINT-IN-TIME REPLAY FEASIBILITY AUDIT AND CONTINUED FORWARD
v1.1.1 EVIDENCE COLLECTION
