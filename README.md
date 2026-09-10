[![Bundle Size](https://img.shields.io/badge/bundle%20size-3.5 MB-blue)](https://github.com/firemansghost/btc-risk-dashboard-V3/actions)

# GhostGauge — Bitcoin Risk Dashboard

GhostGauge is a Bitcoin market-risk dashboard that publishes a daily UTC
intraday G-Score snapshot from 0–100. The current production model combines
seven enabled factor scores across five analytical pillars. Higher scores
represent higher model-defined market risk; the dashboard is intended to
frame risk, not predict Bitcoin's next price move.

`public/data/latest.json` is the authoritative current production snapshot.

**Live Dashboard**: https://www.ghostgauge.com/

**Repository**: https://github.com/firemansghost/btc-risk-dashboard-V3

**Vercel deployment**: https://btc-risk-dashboard-v3.vercel.app/

## Current production

Active identifiers: **v1.1.1** / **integrity-2026-08** / SSOT **2.1.1**.

Exact weights, bands, enabled status, and version live in
[`config/dashboard-config.json`](config/dashboard-config.json). Current
implementation truth is production code.

- Five analytical pillars: Liquidity / Flows 30%, Momentum / Valuation 30%, Term Structure / Leverage 20%, Macro Overlay 10%, Social / Attention 10%
- Seven enabled scoring factors: Trend & Valuation 30%, Stablecoins 18%, ETF Flows 7.7%, Net Liquidity 4.3%, Term Structure & Leverage 20%, Macro Overlay 10%, Social Interest 10%
- On-chain Activity is defined in configuration but disabled at 0%
- Cycle and Spike adjustments are implemented but disabled in v1.1.1 (zero contribution)
- **Input Status** reports source freshness and scoring availability. Fresh means the input satisfies the configured source-cadence contract; it is not statistical confidence, validation, or correctness.

## Quick Start

```bash
# Development
npm run dev

# Seed initial data
npm run etl:seed

# Compute risk factors
npm run etl:compute
```

## Daily ETL is Source of Truth

The dashboard is fed by a **daily scheduled production pipeline** that
computes risk factors and writes versioned JSON/CSV artifacts. GitHub Actions
is scheduled at 11:00 UTC; actual execution can begin later because of GitHub
Actions scheduling and queueing. The pipeline is scheduled daily; a given
calendar-day run can fail or be delayed.

When a run succeeds, it produces `public/data/latest.json` as the
authoritative **daily UTC intraday snapshot**. In-app refresh uses that
ETL-computed snapshot for consistency.

## Key Features

- **Daily UTC intraday G-Score snapshot** (0–100), not a continuously streaming feed and not an end-of-day close
- **Seven enabled scoring factors across five analytical pillars**, with factor-level weights and contributions
- **Factor-level transparency** for included scores, status, and source/timing context
- **Source-aware Input Status** (Fresh / Stale / Excluded / Status unknown)
- **Historical context with provenance boundaries** — headline and diagnostic history are not a clean as-published validation sample
- **Current six-band risk framework** (0–14 Aggressive Buying through 80–100 High Risk)
- **Official monthly Baseline DCA vs Risk-Based DCA comparison** (see Strategy Analysis)
- **Descriptive diagnostics** are shown separately from the current dashboard snapshot vintage

Versioned production weights are governed by `config/dashboard-config.json`.
Any UI simulation or customization does not change the official production model.

## ETF Flow Context

GhostGauge exposes current aggregate Bitcoin ETF-flow factor context and
source vintage from the production snapshot. This is descriptive input
context, not a forecast, probability, or per-fund prediction system.

## Strategy Analysis

Official monthly strategy comparison: Baseline DCA vs Risk-Based DCA.
Both strategies use the first available eligible history row in each
calendar month; missing months are skipped for both.

The comparison uses mixed-provenance historical G-Score data and is a
descriptive historical artifact, not validated as-published performance
evidence. Risk-Based DCA changes only new monthly contribution size; it does
not create an automatic sell or trim rule for Bitcoin already held.

Separate weekly monitoring artifacts are supporting/descriptive reports; they
are not the official monthly comparison.

## Research Status

H7 historical work is descriptive risk-discrimination/ranking research,
not predictive validation.

H8 v2 is the current frozen prospective evaluation. Its observation window
is live, and no interim H8 performance conclusion is authorized.

- [H8 v2 preregistration](docs/H8_V2_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md)
- [H8 v2 capture implementation contract](docs/H8_V2_CAPTURE_IMPLEMENTATION_CONTRACT.md)

## Read More

- [Project Brief](docs/PROJECT_BRIEF.md) — current high-level project overview
- [Brand Card](docs/BRAND_CARD.md) — voice, naming conventions, and ready-to-use copy
- [Legacy Factor Specifications](docs/FACTOR_SPECS.md) — pre-transition implementation reference; current implementation truth is production code/config
- [Data Schemas](docs/ARTIFACT_SCHEMAS.md) — data contracts and API specifications
- [Runbook](docs/RUNBOOK.md) — local development, deployment, and troubleshooting guide
- [Historical 2025 Roadmap Snapshot](docs/ROADMAP.md) — archived planning snapshot; not the current development plan
- [Architecture Decisions](docs/DECISIONS.md) — dated technical choices and rationale
- [Model Eras](docs/MODEL_ERAS.md) — verified model-era boundaries and historical provenance rules
- [Historical Evidence Inventory](docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md) — provenance forensic record for historical artifacts
- [Historical Data Eligibility](docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md) — rules for permissible analytical use of historical data
- [v1.1.1 Transition Closeout](docs/V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md) — integrity-transition record
- [Documentation index](docs/README.md) — current vs historical/legacy documentation map
- [Cursor Prompts](docs/PROMPTS/CURSOR_BASE.md) — AI agent guidelines and development rules
