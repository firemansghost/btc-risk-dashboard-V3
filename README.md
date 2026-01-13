[![Bundle Size](https://img.shields.io/badge/bundle%20size-4.21 MB-blue)](https://github.com/firemansghost/btc-risk-dashboard-V3/actions)

# Bitcoin Risk Dashboard

A real-time Bitcoin risk assessment dashboard that provides a 0-100 risk score based on five analytical pillars: Liquidity, Momentum, Leverage, Macro, and Social factors. The system offers complete transparency with detailed factor breakdowns, historical tracking, and configurable weights.

**Live Dashboard**: https://btc-risk-dashboard-v3.vercel.app/  
**Repository**: https://github.com/firemansghost/btc-risk-dashboard-V3

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

The dashboard relies on a daily ETL pipeline that computes all risk factors and generates data artifacts. The ETL runs automatically via GitHub Actions at 11:00 UTC and produces `public/data/latest.json` as the authoritative data source. Real-time refresh functionality is available but uses the same ETL-computed factors for consistency.

## Read More

- [Project Brief & Methodology](docs/PROJECT_BRIEF.md) - Complete product overview and risk calculation methodology
- [Brand Card](/brand) - Voice, naming conventions, and ready-to-use copy
- [Factor Specifications](docs/FACTOR_SPECS.md) - Mathematical contracts for all risk factors
- [Data Schemas](docs/ARTIFACT_SCHEMAS.md) - Authoritative data contracts and API specifications
- [Runbook](docs/RUNBOOK.md) - Local development, deployment, and troubleshooting guide
- [Roadmap](docs/ROADMAP.md) - Planned features and development timeline
- [Architecture Decisions](docs/DECISIONS.md) - Key technical choices and rationale
- [Cursor Prompts](docs/PROMPTS/CURSOR_BASE.md) - AI agent guidelines and development rules

## Key Features

### Risk Assessment
- **Real-time G-Score**: 0-100 risk assessment based on five analytical pillars
- **Interactive Radial Gauge**: Professional SVG gauge with smooth animations and accessibility
- **Factor Transparency**: Detailed breakdown of all risk factors with weights and contributions
- **Historical Tracking**: Complete factor history with percentile rankings
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