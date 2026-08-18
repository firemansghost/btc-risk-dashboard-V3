[![Bundle Size](https://img.shields.io/badge/bundle%20size-3.59 MB-blue)](https://github.com/firemansghost/btc-risk-dashboard-V3/actions)

# Bitcoin Risk Dashboard

A Bitcoin risk assessment dashboard that publishes a daily UTC **intraday snapshot** G-Score (0-100) based on five analytical pillars: Liquidity, Momentum, Leverage, Macro, and Social factors. The system offers complete transparency with detailed factor breakdowns, historical tracking, and configurable weights. `public/data/latest.json` is the authoritative current snapshot.

**Live Dashboard**: https://www.ghostgauge.com/

**Repository**: https://github.com/firemansghost/btc-risk-dashboard-V3

**Vercel deployment**: https://btc-risk-dashboard-v3.vercel.app/

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

The dashboard relies on a daily ETL pipeline that computes all risk factors and generates data artifacts. GitHub Actions is scheduled at 11:00 UTC; actual execution can begin later because of GitHub Actions scheduling and queueing. The pipeline produces `public/data/latest.json` as the authoritative current snapshot. In-app refresh uses the same ETL-computed snapshot for consistency.

## Read More

- [Project Brief & Methodology](docs/PROJECT_BRIEF.md) - Complete product overview and risk calculation methodology
- [Brand Card](/brand) - Voice, naming conventions, and ready-to-use copy
- [Factor Specifications](docs/FACTOR_SPECS.md) - Mathematical contracts for all risk factors
- [Data Schemas](docs/ARTIFACT_SCHEMAS.md) - Authoritative data contracts and API specifications
- [Runbook](docs/RUNBOOK.md) - Local development, deployment, and troubleshooting guide
- [Roadmap](docs/ROADMAP.md) - Planned features and development timeline
- [Architecture Decisions](docs/DECISIONS.md) - Key technical choices and rationale
- [Model Eras](docs/MODEL_ERAS.md) - Verified model-era boundaries and historical provenance rules
- [Historical Evidence Inventory](docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md) - Provenance forensic record for historical artifacts
- [Historical Data Eligibility](docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md) - Rules for permissible analytical use of historical data
- [v1.1.1 Transition Closeout](docs/V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md) - Integrity-transition record
- [Cursor Prompts](docs/PROMPTS/CURSOR_BASE.md) - AI agent guidelines and development rules

## Key Features

### Risk Assessment
- **Daily UTC snapshot G-Score**: 0-100 risk assessment based on five analytical pillars (intraday snapshot, not an end-of-day close)
- **Interactive Radial Gauge**: Professional SVG gauge with smooth animations and accessibility
- **Factor Transparency**: Detailed breakdown of all risk factors with weights and contributions
- **Historical Tracking**: Headline and diagnostic history with documented provenance boundaries
- **Configurable Weights**: Dynamic weight adjustment with real-time impact analysis

### Interactive Visual Components
- **Advanced Radial Gauge**: Professional SVG gauge with gradient overlays and glow effects
- **Smooth Animations**: 60fps needle rotation and staggered band appearance
- **Accessibility Compliance**: Full WCAG support with screen reader announcements
- **Performance Optimized**: Respects user motion preferences and memory management
- **Interactive Tooltips**: Hover tooltips with risk band information and recommendations

### ETF Predictions System
- **Advanced Forecasting**: 7-day ETF flow predictions with confidence intervals
- **Individual ETF Analysis**: Per-fund performance tracking and market share analysis
- **Real-time Data Integration**: Live data from ETF flow sources
- **Machine Learning Models**: ARIMA, LSTM, Random Forest, and Ensemble methods
- **Interactive Dashboard**: Comprehensive UI with prediction charts and settings

### Strategy Analysis
- **Backtesting Framework**: Historical strategy performance analysis
- **Risk-Based Strategies**: DCA vs. risk-based allocation comparison
- **Performance Metrics**: Sharpe ratio, max drawdown, and return analysis
- **Interactive Testing**: User-defined scenario testing tools

Existing legacy backtest artifacts are retained for historical/reference purposes but are not validated calibration evidence because H1 established mixed/reconstructed historical inputs.