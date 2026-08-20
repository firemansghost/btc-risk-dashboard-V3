# Exploratory reconstruction research

**THIS DIRECTORY CONTAINS EXPLORATORY RECONSTRUCTION RESEARCH.**

**XR-Score is NOT historical G-Score.**  
It is **NOT** as-published.  
It is **NOT** validation-grade.  
It must **not** be shown on the production dashboard.  
It must **not** overwrite official history.  
It must **not** be used to tune current model weights/bands.

**Calibration remains CLOSED.**

---

## What this directory is

Protocol-stage files for **H7** (`h7-exploratory-reconstruction-v1`).

H7 pre-registers how a later **H7.1** implementation may build a labeled **XR-Score** (Exploratory Reconstruction Score) from current GhostGauge `v1.1.1` mathematics plus explicit reconstruction inputs.

H7 does **not** recreate as-published GhostGauge, exact historical production behavior, or validation-grade current-methodology history.

Hardened vector / SHA contracts:

- If a valid contemporaneous Git `market_chart_30_daily` capture exists for `T`, Term and Social use that entire captured vector **unchanged** (`B_METHOD_PIT`). Do not replace, append, drop, or reshape it.
- Only if no valid Git chart exists, construct the exact 31-point `C_SURROGATE` vector: UTC dates T-30 through T-1 plus one Coinbase completed 5-minute T proxy last.
- H7.1 generation is two-stage: freeze `H7_1_ANALYSIS_SOURCE_SHA` on an implementation-only commit, then generate outputs from that SHA. `ANALYSIS_SOURCE_SHA.txt` records that implementation SHA, not the later output-commit SHA.

## Frozen identity

| Item | Value |
|---|---|
| `H7_BASE_SHA` | `6c03730df19adafd8e4e3b1f84361e64a378a6a6` |
| `MODEL_SOURCE_SHA` | `6b2fa9cf56ce738c74c8da6de0f5a972858f8a52` |
| Protocol | `h7-exploratory-reconstruction-v1` |
| Window | 2025-12-11 through 2026-08-19 |

## Files present now (protocol only)

| Path | Role |
|---|---|
| `../docs/H7_EXPLORATORY_RECONSTRUCTION_PROTOCOL_2026-08-19.md` | Frozen protocol |
| `factor_input_contract.csv` | Per-component reconstruction contract |
| `H7_1_OUTPUT_SCHEMA.md` | Frozen future H7.1 column contract |
| `README.md` | This file |

## Files H7.1 may generate later

Do **not** create these until H7 is reviewed, merged, and its protocol / contract / schema blobs are frozen:

- `xr_observations.csv`
- `xr_factor_lineage.csv`
- `xr_missingness.csv`
- `xr_bridge_check.csv`
- `ANALYSIS_SOURCE_SHA.txt` (Stage A implementation SHA only; not the output-commit SHA)
- `PROTOCOL_VERSION.txt`

H7.1 must not calculate returns, MACE, drawdowns, correlations, or other outcome metrics.

## Claim firewall

Never say from XR alone that GhostGauge would have predicted X, worked or failed historically, is validated or invalidated, or that weights/bands should change. XR may later support hypothesis generation only.

## Implementation gate

H7.1 may not begin until this protocol is independently reviewed and merged and the protocol, `factor_input_contract.csv`, and `H7_1_OUTPUT_SCHEMA.md` blobs are frozen. H7.1 requires its own branch, a Stage A implementation-only commit, and generation only from `H7_1_ANALYSIS_SOURCE_SHA`.
