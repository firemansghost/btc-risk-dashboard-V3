# Post-Merge Verification Report — React 18 + Node 20

**Date**: 2025-12-11  
**Merged PR**: #3 — `chore/vercel-build-fix-react18-node20`  
**Merge Commit**: `821c5d3`

---

## 1. Production Deploy Status

### ✅ Local Verification (Main Branch)
- **Node**: `20.18.x` (pinned in `package.json` engines)
- **Next.js**: `15.5.7` ✅
- **React**: `18.3.1` ✅
- **React-DOM**: `18.3.1` ✅
- **@types/react**: `^18.3.0` ✅

### ⚠️ Manual Verification Required (Vercel Dashboard)

**Action Required**: Check Vercel Production deployment build logs for commit `f720ba4` or `821c5d3`.

Verify in build logs:
- [ ] Node runtime = `20.x` (check "Detected Node.js version" or runtime logs)
- [ ] Next.js = `15.5.7` (check `npm list next` output)
- [ ] React/React-DOM = `18.3.1` (check `npm list react react-dom` output)
- [ ] No `Cannot find module './cjs/react.production.js'` error
- [ ] No "Vulnerable version of Next.js detected" banner
- [ ] Build completes successfully

**Production URL**: *(Check Vercel Dashboard → Deployments → Production)*

---

## 2. Route Smoke Test (Production)

**Action Required**: Visit Production URL and test each route with browser DevTools Console open.

| Route | Status | Console Errors | Notes |
|-------|--------|----------------|-------|
| `/` | ⏳ Pending | - | Verify gauge renders, asset switcher works |
| `/bitcoin` | ⏳ Pending | - | - |
| `/methodology` | ⏳ Pending | - | Verify 30/30/20/10/10 weights on first paint |
| `/assets` | ⏳ Pending | - | - |
| `/spx` | ⏳ Pending | - | - |
| `/tsla` | ⏳ Pending | - | - |
| `/gold` | ⏳ Pending | - | - |
| `/lab/weights` | ⏳ Pending | - | Verify banner + CSV header |

### Specific Checks

#### `/methodology`
- [ ] Pillar weights show `30/30/20/10/10` on first paint (no empty flash)
- [ ] Band descriptions match SSOT exactly
- [ ] Footer/model note shows `model_version: v1.1`

#### `/lab/weights`
- [ ] Banner visible: "Experimental — does not change the official G-Score"
- [ ] CSV export header contains `# model_version=v1.1`

#### `/` (Home)
- [ ] Radial gauge renders correctly
- [ ] Gauge has a11y label (check DevTools → Accessibility)
- [ ] Decorative SVG elements have `aria-hidden="true"` (check `<defs>` and particle `<g>`)
- [ ] Asset switcher (BTC/SPX/TSLA/GOLD) works

#### Adjustment Caps
- [ ] Cycle adjustment within ±2.0 points (check UI sliders/inputs)
- [ ] Spike adjustment within ±1.5 points (check UI sliders/inputs)
- [ ] Sandbox CSV export respects caps

---

## 3. Analytics Gating (Production)

**Action Required**: Check Vercel Project → Settings → Environment Variables.

- [ ] `NEXT_PUBLIC_ANALYTICS_ENABLED` status: ⏳ **Check Vercel Dashboard**

### If `NEXT_PUBLIC_ANALYTICS_ENABLED` is OFF or absent:
- ✅ Events are intentionally disabled (expected behavior)
- No further action needed

### If `NEXT_PUBLIC_ANALYTICS_ENABLED` is ON:
**Action Required**: Test on Production URL with Network tab open:
1. Click an asset tab (e.g., switch from BTC to SPX)
   - [ ] Exactly one `assets_tab_click` event fires
   - [ ] Payload includes: `{ utc, model_version: "v1.1", asset: "SPX" }`
   - [ ] No duplicate events
2. Click "Assets" in top navigation
   - [ ] Exactly one `assets_page_click` event fires
   - [ ] Payload includes: `{ utc, model_version: "v1.1" }`
   - [ ] No duplicate events

---

## 4. Housekeeping

### ✅ Completed
- [x] Remote branch `chore/vercel-build-fix-react18-node20` — already deleted (auto-cleanup after PR merge)
- [x] `.gitignore` verified — excludes checkpoint files:
  - `*_CHECKPOINT*.md`
  - `*_RESUME*.md`
  - `*_STATUS*.md`
  - `*_STEP*.md`
  - `*_BLOCKER*.md`
  - `T_*.md`
  - `GHOSTGAUGE_*.md`
  - `FINAL_*.md`
  - `PR_SUMMARY.md`
  - `docs/_internal/`
  - `node_modules/` (all subdirs)

### ⚠️ Manual Verification Required

#### Bundle Size Workflow
- [ ] Check GitHub Actions → Workflows → "Bundle Size Tracking"
- [ ] Verify latest run on `main` branch passed (after merge commit `821c5d3`)
- [ ] Confirm workflow is not blocking merges

#### Experimental.turbo Deprecation
- **Location**: `next.config.ts:121`
- **Current**: `experimental.turbo`
- **Status**: ⚠️ Deprecation warning expected (non-blocking)
- **TODO**: Create separate PR to migrate to `turbopack` key:
  ```typescript
  // Change from:
  experimental: {
    turbo: { ... }
  }
  // To:
  turbopack: { ... }
  ```

---

## 5. Summary

### ✅ Completed Locally
- PR merged to `main` (commit `821c5d3`)
- React 18.3.1 confirmed in `package.json` and `node_modules`
- Node 20.18.x pinned in `engines` and `.nvmrc`
- Remote branch deleted
- `.gitignore` verified

### ⏳ Manual Verification Required
1. **Vercel Production Build Logs**: Verify Node 20.x, React 18.3.1, no module errors
2. **Production URL**: Smoke test all routes, check console errors
3. **Analytics Gating**: Check env var status and test events if enabled
4. **CI Workflow**: Verify bundle-size tracking passed on `main`

### 📝 Follow-up Items
- [ ] **TODO**: Migrate `experimental.turbo` → `turbopack` in `next.config.ts` (separate PR)
- [ ] **Optional**: Performance pass for bundle size optimization (separate PR)

---

## Next Steps

1. **Immediate**: Check Vercel Production deployment build logs and URL
2. **Within 24h**: Complete route smoke test on Production
3. **Future PR**: Migrate `experimental.turbo` deprecation

---

**Report Generated**: 2025-12-11  
**Branch**: `main` (commit `f720ba4`)

