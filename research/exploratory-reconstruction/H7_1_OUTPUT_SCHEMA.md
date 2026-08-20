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
- `xr_score` is NULL / empty when `eligible_full_composite` is FALSE.
- `xr_status` has exactly two H7.1 v1 values:
  - `ELIGIBLE` when all seven factors are available and `xr_score` is populated; `eligible_full_composite` = TRUE
  - `NOT_ELIGIBLE` when one or more factors are `MISSING` and `xr_score` is empty; `eligible_full_composite` = FALSE
- `reconstruction_grade` is `EXPLORATORY_ONLY` for every eligible full composite.
- Factor role fields use `B_METHOD_PIT`, `C_PIT_CONSERVATIVE`, `C_CURRENT_HISTORY`, `C_SURROGATE`, or `MISSING`.
- Factor-level role is the most limiting required component role using this reporting precedence (not an empirical ranking among C categories): `MISSING` then `C_SURROGATE` then `C_CURRENT_HISTORY` then `C_PIT_CONSERVATIVE` then `B_METHOD_PIT`.
- Do not emit official band labels or playbook recommendations in this file.
- Do not infer availability or eligibility from a numeric factor score.
- Generated outputs must record/hash frozen identities where the listed columns apply (`h7_base_sha`, `model_source_sha`, `protocol_version`). Do not invent future SHAs in this protocol.

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

- Preserve component-level reconstruction roles here. Factor-level roles in `xr_observations.csv` are aggregated from these required-component roles.
- For the shared Term/Social price vector: record CASE A vs CASE B. CASE A records the entire contemporaneous Git `market_chart_30_daily` vector unchanged. CASE B records the exact 31-point `C_SURROGATE` construction (UTC dates T-30 through T-1 plus Coinbase completed 5-minute T proxy last).
- Do not record a mixed B-plus-surrogate construction for the same date.
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

Factor availability is aggregated from required components:

- any required component `MISSING` → factor `MISSING`
- else every required component `B_METHOD_PIT` → `AVAILABLE_B`
- else → `AVAILABLE_C`

This file and `eligible_full_composite` must be driven by that rule. Do not infer availability from a numeric factor score. No missing factor may be silently hidden.

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

These eight columns are exact. No additional columns.

If full XR-versus-production G-Score diagnostic comparison is included, represent it as an additional **row** using `factor_key = __XR_COMPOSITE__` and the **same eight columns**. For that row:

- `xr_factor_score` = eligible XR-Score
- `production_factor_score` = genuine production G-Score
- `difference` = `xr_factor_score - production_factor_score`
- `xr_input_role` = `EXPLORATORY_ONLY`
- `comparison_status` = diagnostic status

Do not create the `__XR_COMPOSITE__` row if XR is not eligible. No tuning follows from any bridge difference.

If XR differs from production: report the difference. Do not change frozen H7 rules to make it match.

---

## Identity sidecars (H7.1)

H7.1 must use a two-stage immutable process.

**Stage A — implementation source.** Create and independently review the reconstruction implementation without generated XR outputs. Commit that implementation. Freeze `H7_1_ANALYSIS_SOURCE_SHA` as that exact implementation-only Git commit SHA. No generated XR CSV may be part of that commit.

**Stage B — generation.** Execute reconstruction from exactly `H7_1_ANALYSIS_SOURCE_SHA` against the frozen H7 protocol/blob contracts. Generate the approved H7.1 output files.

`ANALYSIS_SOURCE_SHA.txt` must contain `H7_1_ANALYSIS_SOURCE_SHA` only. The later output-commit SHA is **not** written into `ANALYSIS_SOURCE_SHA.txt`. This avoids a circular self-referential SHA.

`PROTOCOL_VERSION.txt` records `h7-exploratory-reconstruction-v1` (or a later frozen version increment).

Any implementation change after the Stage A SHA invalidates generated outputs and requires a new implementation source SHA and complete regeneration. No silent source drift.

Before generated outputs are accepted, H7.1 lineage must freeze:

- H7 protocol blob
- `factor_input_contract.csv` blob
- `H7_1_OUTPUT_SCHEMA.md` blob
- `H7_1_ANALYSIS_SOURCE_SHA`
- `MODEL_SOURCE_SHA`

Do not invent those future SHAs in this protocol. These sidecars are not created in H7.
