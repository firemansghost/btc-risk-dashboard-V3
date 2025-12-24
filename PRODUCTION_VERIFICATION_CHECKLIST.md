# Production Verification Checklist

**Status**: ✅ Ready for production verification (awaiting Vercel inputs)

---

## 1. Git State & Dependencies

### ✅ Local Verification
- **Branch**: `main`
- **Git Status**: Clean (only `node_modules/` changes, expected)
- **Node Version** (local): `v22.18.0` *(Vercel will use 20.18.x per `package.json` engines)*
- **Next.js**: `15.5.7` ✅
- **React**: `18.3.1` ✅
- **React-DOM**: `18.3.1` ✅
- **Node Engine** (required): `20.18.x` (pinned in `package.json`)

---

## 2. Route Smoke Checklist

| Route | Console Errors | SSR Weights/Bands | Navigation | Notes |
|-------|---------------|-------------------|------------|-------|
| `/` | ⏳ | ⏳ | ⏳ | Verify gauge renders, asset switcher works, a11y labels present |
| `/bitcoin` | ⏳ | ⏳ | ⏳ | - |
| `/methodology` | ⏳ | ⏳ | ⏳ | **Critical**: Verify 30/30/20/10/10 weights on first paint, no empty flash |
| `/assets` | ⏳ | ⏳ | ⏳ | - |
| `/spx` | ⏳ | ⏳ | ⏳ | - |
| `/tsla` | ⏳ | ⏳ | ⏳ | - |
| `/gold` | ⏳ | ⏳ | ⏳ | - |
| `/lab/weights` | ⏳ | ⏳ | ⏳ | **Critical**: Banner visible, CSV header includes `# model_version=v1.1` |

### Additional Checks

| Check | Status | Details |
|-------|--------|---------|
| **Sandbox Banner** | ⏳ | Verify "Experimental — does not change the official G-Score" is visible on `/lab/weights` |
| **CSV Header** | ⏳ | Export CSV from Sandbox, verify first line contains `# model_version=v1.1` |
| **Adjustment Caps** | ⏳ | **Cycle**: Verify UI sliders/inputs respect ±2.0 cap |
| **Adjustment Caps** | ⏳ | **Spike**: Verify UI sliders/inputs respect ±1.5 cap |
| **Methodology Footer** | ⏳ | Verify footer shows `model_version: v1.1` |
| **Gauge A11y** | ⏳ | Verify gauge has proper `aria-label`, decorative SVG has `aria-hidden="true"` |

---

## 3. Analytics Gating Checklist

### Environment Variable Status
- **`NEXT_PUBLIC_ANALYTICS_ENABLED`**: ⏳ *Awaiting confirmation from Vercel Dashboard*

### If `NEXT_PUBLIC_ANALYTICS_ENABLED = true` (Production)

| Action | Expected Event | Payload Check | Status |
|--------|----------------|---------------|--------|
| Click asset tab (e.g., BTC → SPX) | `assets_tab_click` (exactly 1) | `{ utc, model_version: "v1.1", asset: "SPX" }` | ⏳ |
| Click "Assets" in top nav | `assets_page_click` (exactly 1) | `{ utc, model_version: "v1.1" }` | ⏳ |
| **No duplicates** | - | Verify no duplicate events in Network tab | ⏳ |

### If `NEXT_PUBLIC_ANALYTICS_ENABLED` is OFF or absent

- ✅ **Expected**: No analytics events fire (intentional behavior)
- ✅ **Action**: No further verification needed

---

## 4. What I Need From You

Please provide the following information from your Vercel Dashboard:

### Required Information

1. **Production URL**
   - Paste the Vercel Production deployment URL for `main` branch
   - Example: `https://your-app.vercel.app` or `https://your-app-production.vercel.app`

2. **Node.js Runtime (from Build Logs)**
   - Open Vercel Dashboard → Deployments → Latest Production deployment → Build Logs
   - Look for: "Detected Node.js version" or "Using Node.js"
   - **Expected**: `20.x` (should match `package.json` engines: `20.18.x`)
   - **Paste**: The exact Node version shown in logs

3. **Analytics Environment Variable**
   - Open Vercel Dashboard → Project → Settings → Environment Variables
   - Find: `NEXT_PUBLIC_ANALYTICS_ENABLED`
   - **Status**: `true` / `false` / `not set`
   - **Paste**: The value (or confirm if absent)

### Optional (Helpful)
- **Build ID**: From Vercel deployment details
- **Deployment URL**: Direct link to the deployment page

---

## 5. Bundle Size Optimization Recommendations

Ranked by impact (high → low):

1. **Verify Tree-Shaking**
   - Run `npm run analyze` and check for unused exports in `recharts`, `react-icons`
   - Use `sideEffects: false` in `package.json` if not already set
   - **Impact**: High (can reduce bundle by 50-100KB)

2. **Dynamic Import for Charts/Modals**
   - Convert heavy components (History modals, Score Insights) to `next/dynamic` with `loading` fallback
   - Lazy-load chart components that aren't above the fold
   - **Impact**: High (reduces initial JS by 100-200KB)

3. **Defer Sandbox Code**
   - Move `/lab/weights` page components to dynamic imports
   - Load sandbox only when user navigates to `/lab/weights`
   - **Impact**: Medium-High (saves ~50-100KB on initial load)

4. **Split Recharts Imports**
   - Import only needed chart components (e.g., `Line`, `Bar`) instead of full `recharts`
   - Use `experimental.optimizePackageImports` (already configured)
   - **Impact**: Medium (saves 30-50KB)

5. **Remove Unused Polyfills**
   - Audit `node_modules` for polyfills (e.g., `core-js`, `regenerator-runtime`)
   - Remove if not needed for target browsers
   - **Impact**: Medium (saves 20-40KB)

6. **Code Splitting for Routes**
   - Ensure each route has its own chunk (already configured via Next.js App Router)
   - Verify no shared chunks exceed 200KB
   - **Impact**: Low-Medium (improves load time, not total size)

7. **Optimize Images**
   - Verify all images use Next.js `Image` component with WebP/AVIF
   - Check for unoptimized SVGs or large PNGs
   - **Impact**: Low (reduces network transfer, not JS bundle)

8. **Remove Console Logs in Production**
   - Verify `compiler.removeConsole` is enabled (already in `next.config.ts`)
   - Check build output for any remaining console statements
   - **Impact**: Low (saves 5-10KB)

---

## Next Steps

1. ⏳ **Awaiting**: Vercel Production URL, Node.js runtime version, analytics env var status
2. Once provided, I'll complete the route smoke test and analytics verification
3. Report any issues found with specific steps to reproduce

---

**Generated**: 2025-12-11  
**Branch**: `main`  
**Commit**: `f720ba4`









