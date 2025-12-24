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

## Configuration Management

### Risk Band Configuration

**Single Source of Truth**: `config/dashboard-config.json`

The risk band system uses a centralized configuration approach:

#### Configuration File Structure
```json
{
  "bands": [
    {
      "key": "aggressive_buy",
      "label": "Aggressive Buying", 
      "range": [0, 14],
      "color": "green",
      "recommendation": "Max allocation",
      "order": 1
    }
    // ... additional bands
  ]
}
```

#### How It Works
- **UI Components**: Load bands from `dashboard-config.json` via `lib/riskConfig.ts`
- **ETL Pipeline**: Loads bands from `dashboard-config.json` in `scripts/etl/compute.mjs`
- **Consistency**: All components use identical ranges and colors
- **Fallbacks**: Robust error handling prevents system failures

#### Updating Risk Bands
1. **Edit Configuration**: Modify `config/dashboard-config.json`
2. **Validate Ranges**: Ensure non-overlapping ranges (e.g., 0-14, 15-34, 35-49)
3. **Deploy Changes**: Push to repository (no code changes needed)
4. **Automatic Update**: All components will use new configuration

#### Best Practices
- **Non-overlapping Ranges**: Avoid gaps or overlaps between bands
- **Consistent Colors**: Use semantic color names (`green`, `yellow`, `orange`, `red`)
- **Clear Labels**: Use descriptive band names and recommendations
- **Version Control**: All changes are tracked in Git

#### Troubleshooting
- **Configuration Errors**: Check JSON syntax in `dashboard-config.json`
- **Missing Bands**: System falls back to hardcoded defaults
- **Inconsistent Display**: Verify all components load from same source
- **ETL Failures**: Check that `loadRiskBands()` succeeds in compute.mjs

## Required Secrets

### Production (Vercel)
- `FRED_API_KEY`: Federal Reserve Economic Data API key
- `RISK_REFRESH_TOKEN`: Optional token for refresh endpoint authentication

### Optional (for enhanced features)
- `ETF_FLOWS_CSV_URL`: Alternative ETF data source
- `ALPHAVANTAGE_API_KEY`: For additional market data (BTC⇄Gold feature)
- `METALS_API_KEY`: For gold price data (BTC⇄Gold feature)
- `ALERT_WEBHOOK_URL`: Optional webhook for alert notifications (ETF zero-cross, band changes)
- `ALERT_WEBHOOK_SECRET`: Optional HMAC secret for webhook signature verification

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

## Webhook Verification

### HMAC Signature Verification

When `ALERT_WEBHOOK_SECRET` is set, webhooks include HMAC signatures for security:

- **Header**: `X-GhostGauge-Signature` (hex-encoded HMAC-SHA256)
- **Header**: `X-GhostGauge-Timestamp` (ISO timestamp)
- **Algorithm**: `HMAC-SHA256(secret, timestamp + "." + rawBody)`

### Verification Examples

#### Node.js
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(secret, signature, timestamp, body) {
  const message = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Usage in Express.js
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-ghostgauge-signature'];
  const timestamp = req.headers['x-ghostgauge-timestamp'];
  const body = req.body.toString();
  
  if (!verifyWebhookSignature(process.env.WEBHOOK_SECRET, signature, timestamp, body)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook payload
  const payload = JSON.parse(body);
  console.log('Verified webhook:', payload);
  res.status(200).send('OK');
});
```

#### Python
```python
import hmac
import hashlib
import time
from flask import Flask, request, jsonify

def verify_webhook_signature(secret, signature, timestamp, body):
    message = f"{timestamp}.{body}"
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-GhostGauge-Signature')
    timestamp = request.headers.get('X-GhostGauge-Timestamp')
    body = request.get_data(as_text=True)
    
    if not verify_webhook_signature(
        os.environ['WEBHOOK_SECRET'], 
        signature, 
        timestamp, 
        body
    ):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process webhook payload
    payload = request.get_json()
    print(f"Verified webhook: {payload}")
    return jsonify({'status': 'OK'}), 200
```

### Webhook Payload Format
```json
{
  "run_id": "github_run_123",
  "occurred_at": "2025-01-17T11:00:00.000Z",
  "alerts": [
    {
      "type": "etf_zero_cross",
      "direction": "up",
      "from": -1500000,
      "to": 2000000
    }
  ],
  "diagnostics": {
    "etf_csv_rows": 180,
    "history_csv_rows": 365,
    "total_alerts_today": 1
  }
}
```

### Local Testing

#### Start Webhook Test Receiver
```bash
# Start the local webhook receiver
npm run webhook:dev

# Server runs on http://localhost:8787/alerts
# Health check: http://localhost:8787/health
```

#### Environment Setup for Testing
```bash
# Set up test secrets
export ALERT_WEBHOOK_SECRET_ACTIVE="test-secret-active-123"
export ALERT_WEBHOOK_SECRET_NEXT="test-secret-next-456"
export ALERT_WEBHOOK_URL="http://localhost:8787/alerts"

# Run ETL with webhook testing
npm run etl:compute
```

#### Manual Testing with curl
```bash
# Test webhook with valid signature
curl -X POST http://localhost:8787/alerts \
  -H "Content-Type: application/json" \
  -H "X-GhostGauge-Signature: $(echo -n "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ).{\"test\":\"payload\"}" | openssl dgst -sha256 -hmac "test-secret-active-123" -hex | cut -d' ' -f2)" \
  -H "X-GhostGauge-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
  -d '{"test": "payload"}'

# Test with invalid signature (should fail)
curl -X POST http://localhost:8787/alerts \
  -H "Content-Type: application/json" \
  -H "X-GhostGauge-Signature: invalid-signature" \
  -H "X-GhostGauge-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
  -d '{"test": "payload"}'

# Test with old timestamp (should fail)
curl -X POST http://localhost:8787/alerts \
  -H "Content-Type: application/json" \
  -H "X-GhostGauge-Signature: $(echo -n "2020-01-01T00:00:00.000Z.{\"test\":\"payload\"}" | openssl dgst -sha256 -hmac "test-secret-active-123" -hex | cut -d' ' -f2)" \
  -H "X-GhostGauge-Timestamp: 2020-01-01T00:00:00.000Z" \
  -d '{"test": "payload"}'
```

#### Test Receiver Features
- **Signature Verification**: Validates HMAC-SHA256 signatures with active/next secrets
- **Timestamp Validation**: Rejects timestamps older than 5 minutes or in the future
- **Idempotency**: Prevents duplicate event processing using event ID hashing
- **Detailed Logging**: Color-coded console output with full request/response details
- **Health Check**: `/health` endpoint for monitoring
- **Event Database**: Stores processed events in `tmp/webhook-events.json`

## ETL Self-Check & Cache Management

### Self-Check Behavior

The ETL self-check runs before factor computation and performs the following:

1. **Config Validation**: Verifies `model_version` is present in SSOT config
2. **Cache Writeability Test**: Ensures `public/data/cache` is writable
3. **Stale Cache Detection & Purge**: Automatically purges caches older than `stale_beyond_hours` (or 24h fallback)
4. **Banner Output**: Prints model version, Node version, and working directory

**Key Change**: The self-check no longer hard-fails on stale caches. Instead, it:
- Logs a WARNING for stale factors
- Automatically purges stale caches
- Proceeds with recomputation
- Only fails if recompute cannot achieve freshness (post-check)

### Post-Compute Health Check

After all factors are computed, the ETL runs a post-compute health check that:
- Re-reads `status.json` to verify final state
- Checks all enabled factors are `status: "fresh"`
- Verifies timestamps are within TTL windows
- **Fails the job** if any required factor is not fresh after recompute

### CLI Flags

```bash
# Skip pre-compute self-check (post-check still runs)
node scripts/etl/compute.mjs --no-selfcheck
# or
SELF_CHECK=0 node scripts/etl/compute.mjs

# Force recompute specific factor
node scripts/etl/compute.mjs --force-recompute=trend_valuation

# Force recompute all factors
node scripts/etl/compute.mjs --force-recompute=all

# Soft-fail mode (warn but don't exit on post-check failures)
node scripts/etl/compute.mjs --soft-fail
```

### Purge Rules

Caches are automatically purged when:
- Cache age > `stale_beyond_hours` (from SSOT config)
- Cache age > 24h (fallback if `stale_beyond_hours` not set)
- `--force-recompute` flag is used

### Manual Factor Recompute

To manually force recompute a single factor:

```bash
# Purge and recompute trend_valuation
node scripts/etl/compute.mjs --force-recompute=trend_valuation

# Purge and recompute all factors
node scripts/etl/compute.mjs --force-recompute=all

# Purge and recompute social_interest (with soft-fail for first run after fix)
node scripts/etl/compute.mjs --force-recompute=social_interest --soft-fail
```

### Manual Recovery

If a factor remains stale after recompute (e.g., timestamp propagation issue):

```bash
# Force recompute with soft-fail to allow job to complete
node scripts/etl/compute.mjs --force-recompute=social_interest --soft-fail

# Check the factor status after run
jq '.factors.social_interest // .social_interest | {status, last_updated_utc}' public/data/status.json
```

**Note**: The `--soft-fail` flag allows the ETL to complete even if post-check fails, useful for one-time recovery scenarios. The next run should pass once timestamps are properly propagated.

### Trend & Valuation Specific Guard

The Trend & Valuation factor has additional guards:
- Always recomputes if unified price history CSV (`public/data/btc_price_history.csv`) mtime is newer than cache
- Always recomputes if cache is missing
- Always recomputes if cache age > TTL (6h) or stale_beyond_hours (12h)
- Updates `lastUpdated` timestamp even when using cached calculations

### Expected Log Output

**Successful run with stale cache purge:**
```
[ETL self-check] model_version=v1.1 • ssot_version=2.1.0 • node=v20.18.0 • cwd=/path/to/repo
[ETL self-check] purged stale cache: trend_valuation (age=25.3h, stale>12h)
[ETL self-check] OK (cache write/read verified at /path/to/repo/public/data/cache, 1 stale cache(s) purged)
...
[ETL post-check] OK: all required factors fresh
[ETL post-check] Factor freshness summary:
[ETL post-check]   ✅ trend_valuation: fresh (fresh (0.0h old))
[ETL post-check]   ✅ term_leverage: fresh (fresh (0.0h old))
...
```

**Failed run (upstream down):**
```
[ETL self-check] purged stale cache: term_leverage (age=48.2h, stale>12h)
...
[ETL post-check] FAIL: 1 required factor(s) not fresh after recompute:
[ETL post-check]   term_leverage reason=no_funding_data_any_source last_updated_utc=null
```

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
