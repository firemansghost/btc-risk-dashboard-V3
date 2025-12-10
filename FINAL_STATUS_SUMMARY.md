# Final Status Summary — Resume After Timeout

## Completed Tasks

### ✅ T-VERSIONS — Complete
- **Status**: Done
- **Evidence**: 
  - TS error fixed: `app/api/refresh/route.ts:336` uses `config.model_version`
  - All API routes use `getConfig().model_version`
  - UI defaults to 'v1.1'
  - ETL loads from SSOT
  - No `config.version` references remain
  - Methodology + Sandbox show v1.1
- **Commit**: `5b3036f`

### ✅ T-ANALYTICS-ASSET-TAB — Complete
- **Status**: Done
- **Evidence**:
  - Gating implemented: `NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'` AND `NODE_ENV === 'production'`
  - Event handlers updated to include `model_version` from SSOT
  - Payload shape: { asset, utc, model_version }
  - TypeScript passes
- **Commit**: `266dde2`

## Partial Tasks

### ⚠️ T-SEC-NEXT — Partial
- **Status**: Sub-step A complete, B & C pending
- **Completed**:
  - ✅ Lockfile consistency verified (next@15.5.7, react@19.2.1, react-dom@19.2.1)
- **Pending**:
  - ⚠️ Preview build creation (requires manual push to GitHub/Vercel)
  - ⚠️ Route smoke tests (requires Preview URL)
- **Note**: See `T_SEC_NEXT_PREVIEW_NOTE.md` for manual steps

### ⚠️ T-QA-SMOKE — Not Started
- **Status**: Checklist created, testing pending
- **Pending**: Manual verification on Preview deployment
- **Checklist**: See `T_QA_SMOKE_CHECKLIST.md`

## Branch Status
- **Branch**: `chore/resume-after-timeout`
- **Commits**: 
  - `5b3036f` - T-VERSIONS
  - `266dde2` - T-ANALYTICS
- **Uncommitted Changes**: None

## Next Steps (Manual)
1. Push branch to GitHub: `git push origin chore/resume-after-timeout`
2. Create Vercel Preview deployment
3. Verify build logs (no security warnings)
4. Smoke test routes on Preview
5. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` on one Preview
6. Verify analytics events fire correctly
7. Complete T-QA-SMOKE checklist
8. Merge to main when all checks pass

## Files Modified
- `lib/analytics.ts` - Added gating logic
- `app/components/AssetSwitcher.tsx` - Added model_version to payload
- `app/components/Navigation.tsx` - Added model_version to payload
- `app/api/refresh/route.ts` - Fixed to use config.model_version
- `app/api/data/latest/route.ts` - Fixed to use config.model_version
- `app/components/RealDashboard.tsx` - Default to v1.1
- `scripts/etl/compute.mjs` - Load model_version from SSOT

