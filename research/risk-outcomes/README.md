# GhostGauge H5.1 frozen risk-outcome analysis

This directory is a **research-only** output of protocol `h5-risk-outcome-v1`.
Implementation identifier: `h5.1-v1`.

It is **not** a production data source, **not** a History UI feed, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

Authoritative protocol: `docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md`.

## Pin

| Item | Value |
|---|---|
| Analysis source SHA | `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` |
| Protocol version | `h5-risk-outcome-v1` |
| Daily view Git blob | `95d4292580fb13c569efb4b618c3be8226d32948` |
| Daily view SHA-256 | `375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9` |
| BTC history Git blob | `e472247d7099e3e999daa99917864e92477213b5` |
| BTC history SHA-256 | `85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44` |

H5.1 reads Git objects at the analysis source SHA. It does **not** parse moving working-tree copies of `btc_price_history.csv` or the daily analytical view.

## Exact build command

From the repository root, Git objects only, no network:

```text
node scripts/research/build-risk-outcome-analysis.mjs --analysis-source-sha 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b
```

Optional: `--output-dir <path>` for a temporary reproducibility check.

Do **not** hand-edit generated files. Regenerate with the builder.

Numeric CSV serialization of computed outcomes uses JavaScript `Number.prototype.toString()` (shortest round-trip decimal). Source `price_usd` strings are preserved after validation. Rounding is serialization only and is never fed back into aggregation, ranking, or threshold comparisons.

CSV output is RFC4180-compatible with LF line endings. Null/undefined statistics are empty fields. Literal strings `null`, `undefined`, `NaN`, and `Infinity` are never emitted.

## Inputs

- `research/historical-observations/daily_analytical_view.csv` at the analysis source SHA (H3.1 Daily Rule v1 view)
- `public/data/btc_price_history.csv` at the analysis source SHA (completed UTC close series only)

`factor_manifest.csv` is not an H5 input.

## Population

- 338 calendar rows
- **323** `DAILY_PRIMARY` rows enter the analysis
- **4** `REVIEW_REQUIRED` excluded: 2025-09-15, 2025-09-16, 2025-09-17, 2025-09-18
- **11** `NO_DAILY_PRIMARY` excluded: 2026-01-14, 03-06, 03-29, 03-30, 04-04, 04-05, 04-06, 04-12, 05-25, 06-01, 06-20
- No substitute artifacts, reconstruction artifacts, or production `history.csv` scores
- Every `DAILY_PRIMARY` G-Score must be a present finite integer in 0–100 (hard STOP otherwise)
- Start price is `daily_analytical_view.price_usd` labeled `artifact_spot_price_usd`

## Horizons

- Calculated: 30, 90, 180 UTC calendar days
- 365: coverage only; **no** 365 risk rows
- Eligibility requires every completed close from observation date D through D+N inclusive
- Frozen eligible n: 30d 292, 90d 235, 180d 152; total 679

## Outcome definitions

Primary: **Maximum Adverse Close Excursion (MACE)**

```text
minimum_path_price = min(S, C_D, C_D+1, ..., C_D+N)
MACE = 1 - minimum_path_price / S
```

S is the artifact spot start price. Path prices are completed UTC closes. This is **not** true intraday MAE.

Secondary continuous:

- Maximum close drawdown (MCDD): artifact spot as Q_0, then D…D+N closes; running peak; `1 - Q_i / peak`; max over i
- Close-to-close volatility annualized: N close-to-close log returns; population variance 1/N; times sqrt(365). Artifact spot is excluded from volatility intervals.
- Zero-target downside deviation annualized: same N log returns; `min(r_i, 0)` squared over all N; times sqrt(365)

Secondary tails on unrounded MACE: `>= 0.10`, `>= 0.20`, `>= 0.30` inclusive. No other thresholds. No Spearman on binary tails.

## Score association

Spearman of G-Score vs each of the four continuous outcomes, independently by horizon. Average occupied 1-based ranks for ties. Pearson of those rank vectors. `expected_direction = POSITIVE` for all 12 rows. No p-values, confidence intervals, significance labels, or raw-value Pearson.

## Numeric-band crosswalk

Published integer G-Score only:

| Predicate | Label |
|---|---|
| 0 <= score <= 14 | Aggressive Buying |
| 15 <= score <= 34 | Regular DCA Buying |
| 35 <= score <= 49 | Moderate Buying |
| 50 <= score <= 64 | Hold & Wait |
| 65 <= score <= 79 | Reduce Risk |
| 80 <= score <= 100 | High Risk |

Exactly 18 band-summary rows. Empty groups retained.

## Model versions

Exact source labels from the full 323 `DAILY_PRIMARY` rows: `v3.1.0`, `v1.1`, `v1.1.1`. Exactly 9 summary rows. `v1.1.1` is retained with n = 0 / `NO_COMPLETED_OUTCOMES` at all three calculated horizons. Not a controlled comparison.

## Statistics

- Arithmetic mean of unrounded values
- Type-7 median / p25 / p75 where the frozen schemas request them
- Horizon MACE: n, mean, median, p25, p75, min, max
- Band MACE: n, mean, median, p25, p75 (no min/max)
- Secondary continuous in horizon/band files: mean and median
- Model-version: n, mean MACE, median MACE
- `n = 0`: `NO_COMPLETED_OUTCOMES`; continuous stats empty; tail event_count 0; event_rate empty
- `1 <= n < 20`: `SMALL N — DESCRIPTIVE ONLY`
- `n >= 20`: `OK`

## Output files

| File | Contents |
|---|---|
| `risk_outcomes.csv` | 679 rows, one per eligible `DAILY_PRIMARY` × 30/90/180 |
| `summary_by_horizon.csv` | exactly 3 rows |
| `score_association.csv` | exactly 12 rows |
| `summary_by_numeric_band.csv` | exactly 18 rows |
| `summary_by_model_version.csv` | exactly 9 rows |
| `ANALYSIS_SOURCE_SHA.txt` | pin plus LF |
| `PROTOCOL_VERSION.txt` | `h5-risk-outcome-v1` plus LF |
| `README.md` | this file |

## Limits

- Git existence is not historical Vercel deployment proof.
- Historical lineage is not validated current `v1.1.1` performance. Current `v1.1.1` has n = 0 completed 30/90/180 H5 outcomes.
- Daily 30/90/180 windows overlap heavily. Nominal n is not independent trials. No naive t-tests, independent-observation standard errors, correlation p-values, or significance language.
- Close-only path measures are not true intraday MAE or intraday maximum drawdown.
- No factor analysis, H4 forward-return regeneration, OHLC study, point-in-time replay, strategy backtest, or calibration.
- A positive Spearman sign, if observed, is directional concordance only. This README does not interpret magnitudes.

Special Daily Rule v1 observations inherited from H3.1: 2025-09-26 uses `e9083962` G47 (not reconstruction G67 / history.csv G85); 2025-10-29 uses `5c4535b2` G55 (not human G57 as primary); 2026-08-17 `db789cd9` G47 verified recovery has no completed 30/90/180 window at the pinned BTC series end.
