# Vercel Build Fix — React 18 + Node 20

## Changes Made

### 1. Node Version Pinning
- **package.json**: Updated `engines.node` from `">=20 <23"` to `"20.18.x"`
- **.nvmrc**: Updated from `"20"` to `"20.18.0"`

### 2. React Downgrade
- **react**: `^19.2.1` → `18.3.1` (exact version)
- **react-dom**: `^19.2.1` → `18.3.1` (exact version)
- **@types/react**: `^19.0.0` → `^18.3.0`

### 3. Next.js Version
- **next**: `15.5.7` (unchanged, secure version)

## Local Build Verification

✅ **Build Status**: PASSED
- No "Vulnerable version of Next.js detected" banner
- No module resolution errors
- All routes generated successfully
- React 18.3.1 confirmed in `node_modules`

## Branch & PR

- **Branch**: `chore/vercel-build-fix-react18-node20`
- **Commit**: `84685d3` - "fix: downgrade React to 18.3.1 and pin Node to 20.18.x for Vercel compatibility"
- **PR URL**: https://github.com/firemansghost/btc-risk-dashboard-V3/pull/new/chore/vercel-build-fix-react18-node20

## Next Steps

### 1. Create PR
Visit the PR URL above or create via GitHub UI.

### 2. Vercel Preview Build Verification
Once PR is created, Vercel will automatically create a Preview deployment. Verify:
- [ ] Build completes without `Cannot find module './cjs/react.production.js'` error
- [ ] No "Vulnerable version of Next.js detected" banner in build logs
- [ ] Runtime uses Node 20.x (check Vercel build logs)
- [ ] Preview URL accessible

### 3. Route Smoke Test (Preview)
Test these routes on the Preview URL:
- [ ] `/` (home)
- [ ] `/bitcoin`
- [ ] `/methodology`
- [ ] `/assets`
- [ ] `/spx`
- [ ] `/tsla`
- [ ] `/gold`
- [ ] `/lab/weights`

Check:
- [ ] All routes load without console errors
- [ ] No hydration errors
- [ ] Methodology page renders SSOT weights/bands on first paint

### 4. Vercel Project Settings (if needed)
If Vercel still uses Node 22:
1. Go to Vercel Dashboard → Project → Settings → General
2. Set **Node.js Version** to `20.x`
3. Redeploy

### 5. Merge & Production Deploy
Once Preview passes:
- [ ] Merge PR
- [ ] Wait for Production deploy
- [ ] Re-smoke test Production routes (same list as above)
- [ ] Verify Production runtime is Node 20.x

## Toolchain Summary

| Component | Version | Status |
|-----------|---------|--------|
| Node | 20.18.x | ✅ Pinned |
| Next.js | 15.5.7 | ✅ Secure |
| React | 18.3.1 | ✅ Stable |
| React-DOM | 18.3.1 | ✅ Stable |
| @types/react | ^18.3.0 | ✅ Compatible |

## Notes

- The `experimental.turbo` deprecation warning is expected and non-blocking (will address in separate PR)
- Peer dependency warnings during `npm install` are expected when downgrading React
- Local build on Node 22 shows EBADENGINE warning, but Vercel will use Node 20 per `.nvmrc` and `engines` field









