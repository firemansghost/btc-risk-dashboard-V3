# H7.1 output schema (pre-registered)

**Protocol:** `h7-exploratory-reconstruction-v1`  
**H7_BASE_SHA:** `6c03730df19adafd8e4e3b1f84361e64a378a6a6`  
**MODEL_SOURCE_SHA:** `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52`

This file freezes intended H7.1 generated-file columns **before implementation**.  
Do **not** create the generated CSVs in H7.  
Do **not** calculate scores in H7.

Future directory: `research/exploratory-reconstruction/`

---

## Future filenames

| File | When |
|---|---|
| `xr_observations.csv` | H7.1 only |
| `xr_factor_lineage.csv` | H7.1 only |
| `xr_missingness.csv` | H7.1 only |
| `xr_bridge_check.csv` | H7.1 only |
| `ANALYSIS_SOURCE_SHA.txt` | H7.1 only |
| `PROTOCOL_VERSION.txt` | H7.1 only |
| `README.md` | protocol-stage file already present; H7.1 may append a generated-output notice without weakening the XR ≠ G-Score firewall |

---

## `xr_observations.csv`

One row per observation date `T` in `2025-12-11`..`2026-08-19`.

Exact columns, in order:

1. `observation_date`
2. `reconstruction_as_of_utc`
3. `reconstruction_clock_source`
4. `xr_score`
5. `xr_status`
6. `trend_score`
7. `stablecoins_score`
8. `etf_score`
9. `net_liquidity_score`
10. `term_leverage_score`
11. `macro_score`
12. `social_score`
13. `trend_role`
14. `stablecoins_role`
15. `etf_role`
16. `net_liquidity_role`
17. `term_leverage_role`
18. `macro_role`
19. `social_role`
20. `reconstruction_grade`
21. `eligible_full_composite`
22. `missing_factor_count`
23. `h7_base_sha`
24. `model_source_sha`
25. `protocol_version`

Rules:

- No official G-Score field in this primary file.
- `xr_score` is NULL / empty when `eligible_full_composite` is false.
- `xr_status` distinguishes eligible XR observations from `NOT ELIGIBLE` partial rows.
- `reconstruction_grade` is `EXPLORATORY_ONLY` for every eligible full composite.
- Factor role fields use `B_METHOD_PIT`, `C_PIT_CONSERVATIVE`, `C_CURRENT_HISTORY`, `C_SURROGATE`, or `MISSING`.
- Do not emit official band labels or playbook recommendations in this file.

---

## `xr_factor_lineage.csv`

Long-form: one or more rows per observation date × factor × component / material source.

Exact columns, in order:

1. `observation_date`
2. `factor_key`
3. `component_key`
4. `reconstruction_role`
5. `source_name`
6. `source_type`
7. `source_observation_start`
8. `source_observation_end`
9. `source_as_of_cutoff`
10. `git_commit_sha`
11. `git_blob_sha`
12. `external_snapshot_sha256`
13. `is_point_in_time`
14. `is_surrogate`
15. `is_current_history`
16. `is_conservative_vintage`
17. `availability_status`
18. `missing_reason`
19. `notes`
20. `h7_base_sha`
21. `protocol_version`

Rules:

- Record completed-history source, current-day proxy source, observation cutoff, and response hash for the common 30-day vector.
- No missing factor may be silently omitted from lineage.

---

## `xr_missingness.csv`

One row per observation date.

Exact columns, in order:

1. `observation_date`
2. `trend_available`
3. `stablecoins_available`
4. `etf_available`
5. `net_liquidity_available`
6. `term_leverage_available`
7. `macro_available`
8. `social_available`
9. `eligible_full_composite`
10. `missing_factors`
11. `primary_missing_reason`
12. `protocol_version`

Availability values: `AVAILABLE_B`, `AVAILABLE_C`, or `MISSING`.  
No missing factor may be silently hidden.

---

## `xr_bridge_check.csv`

Limited to `2026-08-17`, `2026-08-18`, `2026-08-19`. Diagnostic only. No tuning follows from it.

Exact columns, in order:

1. `observation_date`
2. `factor_key`
3. `xr_factor_score`
4. `production_factor_score`
5. `difference`
6. `xr_input_role`
7. `comparison_status`
8. `notes`

Optional additional rows or columns for full XR versus production G-Score difference must remain labeled diagnostic and must not feed reconstruction-rule changes.

If XR differs from production: report the difference. Do not change frozen H7 rules to make it match.

---

## Identity sidecars (H7.1)

`ANALYSIS_SOURCE_SHA.txt` and `PROTOCOL_VERSION.txt` must record the reconstruction implementation SHA and `h7-exploratory-reconstruction-v1` (or a later frozen version increment). They are not created in H7.
