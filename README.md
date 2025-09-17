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
- [Factor Specifications](docs/FACTOR_SPECS.md) - Mathematical contracts for all risk factors
- [Data Schemas](docs/ARTIFACT_SCHEMAS.md) - Authoritative data contracts and API specifications
- [Runbook](docs/RUNBOOK.md) - Local development, deployment, and troubleshooting guide
- [Roadmap](docs/ROADMAP.md) - Planned features and development timeline
- [Architecture Decisions](docs/DECISIONS.md) - Key technical choices and rationale
- [Cursor Prompts](docs/PROMPTS/CURSOR_BASE.md) - AI agent guidelines and development rules
