# Step 2 — Configure Preview Env for Analytics Gating

## Status
⚠️ **Requires Vercel Dashboard Access**

## Required Configuration

### Environment Variable
- **Name**: `NEXT_PUBLIC_ANALYTICS_ENABLED`
- **Value**: `"true"`
- **Scope**: Preview deployments only (not Production)
- **Apply to**: The Preview deployment for this PR

### Verification
- **NODE_ENV**: Should automatically be `"production"` in Vercel Preview deployments
- Confirm in Vercel dashboard → Preview deployment → Environment Variables

## Steps to Configure
1. Open Vercel dashboard
2. Navigate to the project: `btc-risk-dashboard-v3`
3. Go to Settings → Environment Variables
4. Add new variable:
   - Key: `NEXT_PUBLIC_ANALYTICS_ENABLED`
   - Value: `true`
   - Environment: Select "Preview" only (uncheck Production)
5. Save
6. Redeploy the Preview (or wait for next commit to trigger rebuild)

## Alternative: Set via Vercel CLI
If you have Vercel CLI access:
```bash
vercel env add NEXT_PUBLIC_ANALYTICS_ENABLED preview
# Enter value: true
```

## Blocker Check
- ✅ Can access Vercel dashboard? (If no, this is a blocker)
- ✅ Can modify environment variables? (If no, this is a blocker)

## Next Steps
After env var is set, proceed to Step 3 to verify the Preview build.

