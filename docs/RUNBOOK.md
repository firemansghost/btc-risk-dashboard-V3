# Runbook

Operational guide for local development, deployment, and troubleshooting.

## Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Setup
```bash
# Clone repository
git clone https://github.com/firemansghost/btc-risk-dashboard-V3.git
cd btc-risk-dashboard-V3

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Development Commands

```bash
# Start development server
npm run dev
# → http://localhost:3000

# Seed initial data
npm run etl:seed
# → Creates public/data/history.csv with sample data

# Compute risk factors
npm run etl:compute
# → Generates public/data/latest.json with current risk assessment

# Backfill ETF flows to inception
npm run etl:backfill
# → Creates public/data/etf-flows-historical.json with historical baseline

# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm run test
```

## GitHub Actions Schedule

- **ETL Pipeline**: Runs daily at 11:00 UTC
- **Workflow**: `.github/workflows/etl.yml`
- **Artifacts**: Updates `public/data/latest.json`, `status.json`, `history.csv`
- **Notifications**: Optional webhook alerts on failures

## Required Secrets

### Production (Vercel)
- `FRED_API_KEY`: Federal Reserve Economic Data API key
- `RISK_REFRESH_TOKEN`: Optional token for refresh endpoint authentication

### Optional (for enhanced features)
- `ETF_FLOWS_CSV_URL`: Alternative ETF data source
- `ALPHAVANTAGE_API_KEY`: For additional market data
- `METALS_API_KEY`: For gold price data (BTC⇄Gold feature)
- `ALERT_WEBHOOK_URL`: Slack/Discord notifications for failures

### Local Development
Create `.env.local`:
```bash
FRED_API_KEY=your_fred_api_key_here
RISK_REFRESH_TOKEN=optional_dev_token
```

## Troubleshooting

### Blank Dashboard UI
**Symptoms**: Dashboard loads but shows no data
**Causes**: Missing or corrupted data artifacts
**Solutions**:
1. Check if `public/data/latest.json` exists and is valid JSON
2. Run `npm run etl:compute` to regenerate data
3. Verify API keys in `.env.local`
4. Check browser console for JavaScript errors

### Stale Factors
**Symptoms**: Factors show "stale" status instead of "fresh"
**Causes**: Data sources unavailable or API rate limits
**Solutions**:
1. Check `public/data/status.json` for source status
2. Verify API keys are valid and not rate-limited
3. Check network connectivity to external APIs
4. Review ETL logs for specific error messages

### Farside Schema Warnings
**Symptoms**: ETF flows show schema change warnings
**Causes**: Farside Investors changed their HTML structure
**Solutions**:
1. Update `parseEtfFlowsFromHtml` function in `scripts/etl/factors.mjs`
2. Test with `npm run etl:compute`
3. Update schema hash validation if needed
4. Consider implementing more robust HTML parsing

### Rate Limits
**Symptoms**: API calls failing with 429 status codes
**Causes**: Too many requests to external APIs
**Solutions**:
1. Implement exponential backoff in API calls
2. Add request caching where appropriate
3. Use alternative data sources if available
4. Contact API providers for higher rate limits

### Build Failures
**Symptoms**: Vercel deployment fails
**Causes**: TypeScript errors, missing dependencies, or build issues
**Solutions**:
1. Run `npm run typecheck` locally to catch TypeScript errors
2. Run `npm run build` locally to test build process
3. Check for missing environment variables
4. Review Vercel build logs for specific error messages

## Update Discipline

### Contract Changes
When modifying data schemas or API contracts:

1. **Update Documentation**: Modify `docs/ARTIFACT_SCHEMAS.md`
2. **Bump Version**: Increment version in `public/data/latest.json`
3. **Test Locally**: Run full ETL pipeline and verify output
4. **Update Types**: Modify TypeScript interfaces in `lib/types.ts`
5. **Deploy**: Push changes and verify production deployment

### Factor Changes
When modifying risk factors:

1. **Update Specs**: Modify `docs/FACTOR_SPECS.md`
2. **Test Calculation**: Verify factor scoring logic
3. **Update Tests**: Add/update unit tests for new logic
4. **Document Changes**: Update `docs/DECISIONS.md` with rationale
5. **Version Bump**: Increment model version

### API Changes
When modifying API endpoints:

1. **Update Schemas**: Modify `docs/ARTIFACT_SCHEMAS.md`
2. **Maintain Compatibility**: Ensure backward compatibility
3. **Update Types**: Modify TypeScript interfaces
4. **Test Endpoints**: Verify all API routes work correctly
5. **Document Breaking Changes**: Update CHANGELOG.md

## Monitoring

### Health Checks
- **Endpoint**: `/api/health` - Returns system status
- **Data Freshness**: Check `status.json` for staleness indicators
- **Error Rates**: Monitor API response codes and error rates

### Logs
- **Vercel**: Check function logs in Vercel dashboard
- **GitHub Actions**: Review ETL pipeline logs
- **Local**: Use `console.log` statements for debugging

### Alerts
- **ETL Failures**: GitHub Actions can send webhook notifications
- **Data Staleness**: Dashboard shows stale factor indicators
- **API Errors**: Check `status.json` for source health status
