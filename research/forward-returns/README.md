# GhostGauge H4.1 frozen forward-return analysis

This directory is a **research-only** output of protocol `h4-forward-return-v1`.
It is **not** a production data source, **not** a History UI feed, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

Authoritative protocol: `docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md`.

## Pin

| Item | Value |
|---|---|
| Analysis source SHA | `2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b` |
| Protocol version | `h4-forward-return-v1` |
| Daily view Git blob | `95d4292580fb13c569efb4b618c3be8226d32948` |
| Daily view SHA-256 | `375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9` |
| BTC history Git blob | `e472247d7099e3e999daa99917864e92477213b5` |
| BTC history SHA-256 | `85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44` |

H4.1 reads Git objects at the analysis source SHA. It does **not** parse moving working-tree copies of `btc_price_history.csv`.

## Exact build command

From the repository root, Git objects only, no network:

```text
node scripts/research/build-forward-return-analysis.mjs --analysis-source-sha 2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b
```

Optional: `--output-dir <path>` for a temporary reproducibility check.

Do **not** hand-edit generated files. Regenerate with the builder.

Numeric CSV serialization of computed returns uses JavaScript `Number.prototype.toString()` (shortest round-trip decimal). Source `price_usd` and `close_usd` strings are preserved after validation. Rounding is serialization only and is never fed back into aggregation.

## Inputs

- `research/historical-observations/daily_analytical_view.csv` at the analysis source SHA (H3.1 Daily Rule v1 view)
- `public/data/btc_price_history.csv` at the analysis source SHA (Grade-B market-outcome series; not publication-time proof for old G-Scores)

## Population

- 338 calendar rows (2025-09-15 through 2026-08-18)
- **323** `DAILY_PRIMARY` rows enter the analysis
- **4** `REVIEW_REQUIRED` excluded: 2025-09-15, 2025-09-16, 2025-09-17, 2025-09-18
- **11** `NO_DAILY_PRIMARY` excluded: 2026-01-14, 03-06, 03-29, 03-30, 04-04, 04-05, 04-06, 04-12, 05-25, 06-01, 06-20
- No substitute artifacts, human feature blobs, reconstruction artifacts, or production `history.csv` scores

## Return contract

- Calculated horizons: 30, 90, 180 UTC calendar days
- 365 days: coverage only; **no** 365 performance rows
- Start: `daily_analytical_view.price_usd` labeled `artifact_spot_price_usd` (not same-day close, not prior close)
- End: `btc_price_history.close_usd` on exact `observation_date + N` UTC calendar days, labeled `btc_price_history.close_usd`
- Formula: `(end_close_usd / artifact_spot_start_price) - 1` (simple return)
- Metric name: **N-calendar-day forward-close return**. The start is an intraday artifact snapshot; the endpoint is the completed UTC close on calendar date D+N. Elapsed hours vary with observation time.

Date-eligible `DAILY_PRIMARY` counts at this snapshot: 30d 292, 90d 235, 180d 152, 365d 0. Row-level `forward_returns.csv` has 679 rows.

## Numeric-band crosswalk (secondary)

Published integer G-Score only, not native band text:

| Predicate | Label |
|---|---|
| 0 <= score <= 14 | Aggressive Buying |
| 15 <= score <= 34 | Regular DCA Buying |
| 35 <= score <= 49 | Moderate Buying |
| 50 <= score <= 64 | Hold & Wait |
| 65 <= score <= 79 | Reduce Risk |
| 80 <= score <= 100 | High Risk |

`summary_by_numeric_band.csv` has exactly 18 rows (3 horizons × 6 bands). Empty groups are retained.

## Statistics

- Arithmetic mean of unrounded simple returns (no trim, winsorize, geometric mean, or annualization)
- Median / p25 / p75: Hyndman–Fan Type 7 linear interpolation on unrounded returns
- Spearman rho: sample Pearson correlation of independently ranked G-Score and forward return; ties use the arithmetic mean of occupied 1-based ranks
- Zero-variance Spearman: empty rho and status `UNDEFINED_ZERO_VARIANCE` (never 0 / NaN / Infinity)
- `n = 0`: status `NO_COMPLETED_OUTCOMES`; mean/median/p25/p75/min/max/Spearman empty; no quantile on an empty vector
- `1 <= n < 20`: `SMALL N — DESCRIPTIVE ONLY`
- `n >= 20`: `OK`
- No Pearson of unranked values, regression, p-values, confidence intervals, or significance labels

## Output files

| File | Contents |
|---|---|
| `forward_returns.csv` | one row per eligible `DAILY_PRIMARY` × 30/90/180 |
| `summary_by_horizon.csv` | exactly 3 rows (30, 90, 180) |
| `score_association.csv` | exactly 3 Spearman rows (30, 90, 180) |
| `summary_by_numeric_band.csv` | exactly 18 rows |
| `summary_by_model_version.csv` | exactly 9 rows at this snapshot (`v3.1.0`, `v1.1`, `v1.1.1` × 3 horizons) |
| `ANALYSIS_SOURCE_SHA.txt` | pin |
| `PROTOCOL_VERSION.txt` | `h4-forward-return-v1` |
| `README.md` | this file |

Model-version groups come from the full 323 `DAILY_PRIMARY` labels before horizon filtering. `v1.1.1` is retained with `n = 0` / `NO_COMPLETED_OUTCOMES` for all three calculated horizons at this snapshot. A `MISSING` group is emitted only if a missing `model_version` exists in that frozen population.

## Limits

- Git existence is not proof that Vercel historically served the artifact (`deployment_status` remains `UNKNOWN` in H3.1).
- Historical GhostGauge lineage is not validated current `v1.1.1` performance. Do not invent a v1.1 methodology start. The Aug 16 / Aug 17 `v1.1` → `v1.1.1` boundary remains explicit.
- Daily observations with overlapping 30/90/180-day windows are not statistically independent. This analysis is descriptive. It does not use naive t-tests, independent-observation standard errors, correlation p-values, or significance language.
- No factor analysis, trading-strategy backtest, drawdown, volatility, or hit-rate work.
- No calibration.

Special Daily Rule v1 observations inherited from H3.1: 2025-09-26 uses `e9083962` G47 (not reconstruction G67 / history.csv G85); 2025-10-29 uses `5c4535b2` G55 (not human G57 as primary); 2026-08-17 `db789cd9` G47 verified recovery has no completed 30/90/180 outcome at the pinned BTC series end.
