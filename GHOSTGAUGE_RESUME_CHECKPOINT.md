# GhostGauge — Resume Checkpoint after Timeout

## Task Status Summary

| Task | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| **T-SEC-NEXT** | **Partial** | ✅ `package.json`: next@15.5.7, react@19.2.1, react-dom@19.2.1<br>✅ `package.json`: engines updated to ">=20 <23"<br>❌ Lockfile not verified for react-server-dom-* consistency<br>❌ Vercel build logs not checked<br>❌ Route sanity tests not run | Verify lockfile consistency, check Vercel logs, run route tests |
| **T-ADJ-CAPS** | **Done** | ✅ `config/dashboard-config.json` lines 261-262, 267-268: Cycle ±2.0, Spike ±1.5<br>✅ `lib/adjust/fastSpike.ts` line 137: caps at ±1.5<br>✅ `scripts/etl/adjustments.mjs` lines 125, 191: ETL caps correctly<br>✅ `app/methodology/page.tsx` line 106-107: shows caps once | None — Complete |
| **T-VERSIONS** | **Partial** | ✅ `config/dashboard-config.json` lines 2-3: model_version="v1.1", ssot_version="2.1.0"<br>✅ `lib/riskConfig.ts` lines 91-92, 174-175: interface updated<br>✅ `app/components/WeightsSandbox.tsx` line 272: CSV header shows v1.1<br>✅ `app/methodology/page.tsx` lines 60, 748, 823: shows v1.1<br>❌ `app/components/RealDashboard.tsx` line 655: defaults to 'v3' instead of 'v1.1'<br>❌ `app/api/data/latest/route.ts` line 108: uses `etlData.version || 'v3.1.0'`<br>❌ `app/api/refresh/route.ts` line 336: uses `config.version` (doesn't exist, causes TS error)<br>⚠️ `config/risk.json` line 2: legacy file with "v3.3.0-custom" (not SSOT, can ignore) | Fix RealDashboard default, fix API routes to use config.model_version, resolve TS error |
| **T-ANALYTICS-ASSET-TAB** | **Partial** | ✅ `lib/analytics.ts` lines 50-67: assetsTabClicked() and assetsPageClicked() added<br>✅ `app/components/AssetSwitcher.tsx` lines 68-72: onClick handler added<br>✅ `app/components/Navigation.tsx`: onClick handlers added for /assets links<br>✅ Payload includes asset, utc, model_version<br>❌ No explicit dev mode check (but track() silently no-ops if no dataLayer/gtag) | Add explicit dev mode check or document that silent no-op is sufficient |
| **T-GAUGE-ARIA** | **Done** | ✅ `app/components/RadialGauge.tsx` line 465: main SVG has aria-label<br>✅ `app/components/RadialGauge.tsx` line 473: `<defs aria-hidden="true">`<br>✅ `app/components/RadialGauge.tsx` line 610: particles wrapped in `<g aria-hidden="true">` | None — Complete |
| **T-SEO-ASSETS** | **Done** | ✅ `app/spx/page.tsx` line 35-38: robots noindex + TODO comment<br>✅ `app/tsla/page.tsx` line 35-38: robots noindex + TODO comment<br>✅ `app/gold/page.tsx` line 35-38: robots noindex + TODO comment<br>✅ `app/assets/page.tsx` line 150-152: canonical to '/assets' | None — Complete |
| **T-METH-ERROR-FALLBACK** | **Done** | ✅ `app/methodology/page.tsx` lines 28-29: configError and lastKnownConfig state<br>✅ `app/methodology/page.tsx` lines 39-40: sets error message "Couldn't load the latest config"<br>✅ `app/methodology/page.tsx` lines 276-299: friendly fallback with last-known values<br>✅ No "Loading..." messages found (grep returned 0 matches) | None — Complete |
| **T-SANDBOX-BANNER** | **Done** | ✅ `app/components/WeightsSandbox.tsx` lines 364-373: banner exists with exact text<br>✅ `app/components/WeightsSandbox.tsx` line 354: aria-label updated to "Experimental mode. This view does not change the official G-Score." | None — Complete |
| **T-QA-SMOKE** | **Not Started** | N/A — Verification step to run after all fixes | Run after T-VERSIONS and T-ANALYTICS fixes |

## Regressions & Warnings

### TypeScript Error (Blocking)
- **File**: `app/api/refresh/route.ts` line 336
- **Error**: `Property 'version' does not exist on type 'RiskConfig'`
- **Cause**: Code references `config.version` but interface now has `model_version` and `ssot_version`
- **Impact**: Build will fail

### Version Inconsistencies (Non-blocking)
- **File**: `app/components/RealDashboard.tsx` line 655
- **Issue**: Defaults to `'v3'` instead of `'v1.1'` when `latest?.model_version` is undefined
- **Impact**: UI may show wrong version if data missing

- **File**: `app/api/data/latest/route.ts` line 108
- **Issue**: Uses `etlData.version || 'v3.1.0'` instead of config model_version
- **Impact**: API may return wrong version

### Legacy Config File (Informational)
- **File**: `config/risk.json`
- **Note**: Contains "v3.3.0-custom" but this is not the SSOT (dashboard-config.json is)
- **Action**: Can be ignored or archived

## Resume Plan

### First Incomplete Task: **T-VERSIONS** (Partial → Complete)

**Execution Plan:**
1. Fix TypeScript error in `app/api/refresh/route.ts` line 336:
   - Change `config.version` → `config.model_version`
2. Fix `app/components/RealDashboard.tsx` line 655:
   - Change `latest?.model_version ?? 'v3'` → `latest?.model_version ?? 'v1.1'`
3. Fix `app/api/data/latest/route.ts` line 108:
   - Change to use `config.model_version` from getConfig() instead of `etlData.version`
4. Verify API `/api/config` exposes `model_version` and `ssot_version` in response
5. Run `npm run typecheck` to confirm no TS errors
6. Verify UI displays v1.1 consistently

**Acceptance Criteria:**
- ✅ No TypeScript errors
- ✅ All UI/CSV/Sandbox display v1.1 only
- ✅ No "v3.3.0" remnants in user-facing code
- ✅ API config route exposes model_version and ssot_version

### Next Task: **T-ANALYTICS-ASSET-TAB** (Partial → Complete)

**Execution Plan:**
1. Add explicit dev mode check to `lib/analytics.ts` track() function:
   - Skip tracking if `process.env.NODE_ENV === 'development'`
   - Or document that silent no-op is sufficient (current behavior)
2. Verify events fire once per interaction (no duplicate on SSR/CSR transitions)
3. Test in devtools/network tab

**Acceptance Criteria:**
- ✅ Events disabled in dev OR documented as silent no-op
- ✅ Events fire once per interaction
- ✅ Payload includes { asset, utc, model_version }

### Final Task: **T-QA-SMOKE** (Not Started → Complete)

**Execution Plan:**
1. Hard-refresh routes: /, /methodology, /lab/weights, /assets, /spx, /tsla, /gold, /bitcoin
2. Verify:
   - Adjustments capped at ±2.0/±1.5 in UI and sandbox CSV
   - model_version=v1.1 on Methodology and sandbox CSV headers
   - assets_tab_click events present (devtools/network)
   - Gauge AT label reads once; decorative parts hidden
   - Coming-soon routes are noindex; /assets canonical present
   - No console errors

**Acceptance Criteria:**
- ✅ All checks pass
- ✅ No errors in console
- ✅ Lighthouse a11y ≥ 95 on / and /lab/weights

---

**Report Generated**: 2025-01-XX  
**Next Action**: Fix T-VERSIONS TypeScript error and version inconsistencies


