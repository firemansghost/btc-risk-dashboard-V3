# GhostGauge — Project Brief

## Authority & Current Production

Active production: **v1.1.1** / **integrity-2026-08** / SSOT **2.1.1**.

Current configuration authority is
[`config/dashboard-config.json`](../config/dashboard-config.json). Current
implementation truth is production code. Historical interpretation is governed
by [`MODEL_ERAS.md`](MODEL_ERAS.md). The integrity-transition record is
[`V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md`](V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md).

See also: [Brand Card](BRAND_CARD.md) for public narrative and band labels.

## Purpose

GhostGauge provides transparent Bitcoin market-risk context through a
0–100 G-Score. It is designed to frame current model-defined risk, not
forecast price or issue investment commands.

## Current Model

Seven enabled scoring factors across five analytical pillars.

**Pillar weights (30/30/20/10/10):**

- Liquidity / Flows — 30%
- Momentum / Valuation — 30%
- Term Structure / Leverage — 20%
- Macro Overlay — 10%
- Social / Attention — 10%

**Enabled factor weights:**

- Trend & Valuation — 30%
- Stablecoins — 18%
- ETF Flows — 7.7%
- Net Liquidity — 4.3%
- Term Structure & Leverage — 20%
- Macro Overlay — 10%
- Social Interest — 10%

On-chain Activity remains defined in configuration but is **disabled at 0%**
and does not contribute to the current score.

## Composite Behavior

Each enabled factor uses factor-specific production logic to produce a
0–100 factor score. Only factors classified fresh under production
source-cadence rules contribute; versioned weights are normalized over the
included set.

Cycle and Spike adjustment mechanisms remain implemented but are disabled in
production v1.1.1 and contribute zero points. Reactivation would require a
separate versioned methodology decision.

## Snapshot / Freshness

GhostGauge publishes a **daily UTC intraday snapshot**. Completed daily BTC
history is maintained separately where calculations require historical closes.

**Input Status** represents source freshness and scoring availability (Fresh,
Stale, Excluded, Status unknown). Fresh means the input satisfies the
configured source-cadence contract; it does not mean the input is validated
or correct. Individual inputs can have different vintages and cadences.
Inclusion is snapshot-specific; this brief does not assert that every factor
is fresh on any given day.

## Historical Evidence

`public/data/history.csv` contains mixed-provenance historical G-Score data
(reconstructed regions, later observational tail, and coverage limitations).
It is not a clean as-published validation sample.

Historical H7 work is descriptive risk-discrimination/ranking research, not
forecasting or model validation.

H8 v2 is an ongoing frozen prospective evaluation. No interim H8 performance
conclusion is authorized. See
[H8 v2 preregistration](H8_V2_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md)
and
[H8 v2 capture implementation contract](H8_V2_CAPTURE_IMPLEMENTATION_CONTRACT.md).

## Strategy Analysis

The official comparison is monthly Baseline DCA vs Risk-Based DCA. Both
strategies use the first available eligible history row in each calendar
month; months with no eligible row are skipped for both.

Risk-Based DCA changes **new monthly contribution size** only. It does not
automatically create a sell or trim instruction for Bitcoin already held.
Band labels such as Reduce Risk describe general market-risk context; they
are not an automatic liquidation rule in the official DCA framework.

The historical strategy comparison is a descriptive mixed-provenance artifact,
not validated as-published performance evidence. Separate weekly monitoring
reports are supporting/descriptive and are not the official monthly
comparison.

## Architecture

Durable high-level facts:

- Next.js frontend
- Node.js ETL
- GitHub Actions scheduling (daily scheduled production pipeline)
- Versioned JSON/CSV artifacts under `public/data/`
- Configuration SSOT in `config/dashboard-config.json`

Exact runtime details (caching, fallbacks, TTLs) are implementation-defined
and can change by factor; see current production code.

## Data Sources

Exact current provider behavior is implementation-defined and can vary by
factor; see current production code and factor-level provenance/status.

Broad families currently used by production scoring include FRED public-data
series, Coinbase/CoinGecko market data, and Farside ETF-flow source material.
Disabled On-chain providers are not current scoring sources. Do not treat
Alternative.me / Fear & Greed as current Social Interest authority.

## Alerts

Alert surfaces are operational/supporting features outside the G-Score
scientific contract and are undergoing a separate runtime/provenance
review. They should not be treated as the canonical record of current
model behavior.

## Risk Bands

Current six-band taxonomy:

- **0–14** Aggressive Buying
- **15–34** Regular DCA Buying
- **35–49** Moderate Buying
- **50–64** Hold & Wait
- **65–79** Reduce Risk
- **80–100** High Risk

Band labels and recommendation text describe general market-risk context.
The official Risk-Based DCA framework is narrower: it changes only new
monthly contribution size. It does not create an automatic sell or trim rule
for Bitcoin already held.
