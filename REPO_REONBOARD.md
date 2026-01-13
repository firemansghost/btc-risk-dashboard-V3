# Repo Re-Onboard Report
**Date:** 2025-01-13  
**Purpose:** Fast re-onboarding before UI redesign tasks to avoid breaking production

---

## 1. Repo Status & Sync

### Git Status
- **Remote:** `origin https://github.com/firemansghost/btc-risk-dashboard-v3`
- **Current Branch:** `main`
- **Sync Status:** ✅ Up to date (pulled latest 24 commits)
- **Working Tree:** Clean

### Recent Commits (last 5)
1. `5d8624a` - fix(etl): remove duplicate nowIso declaration causing CI crash
2. `29a50fe` - fix: social_interest staleness - ensure lastUpdated propagation and grace window
3. `bfe6a2b` - chore(etl): update artifacts [skip ci]
4. `d81dbe7` - chore(etl): update artifacts [skip ci]
5. `3da595a` - chore(backtesting): weekly analysis update [skip ci]

---

## 2. Repo Map (Paths Only)

### UI Entry Points
- **Main Page:** `app/page.tsx` → Renders `CanaryPage` component
- **Canary Page:** `app/components/CanaryPage.tsx` → Wrapper with `ViewSwitch`
- **Main Dashboard:** `app/components/RealDashboard.tsx` (primary UI component)
- **Simple Dashboard:** `app/components/SimpleDashboard.tsx` (alternative view)

### API Routes (UI Data Sources)
**Critical Data Routes:**
- `/api/data/latest-file` → Serves `public/data/latest.json` with no-cache headers + band correction
- `/api/data/status` → Serves `public/data/status.json` with no-cache headers
- `/api/data/latest` → Alternative latest endpoint
- `/api/refresh` → Real-time refresh (rate-limited, uses ETL artifacts when available)
- `/api/config` → Dashboard configuration (SSOT)

**Factor History:**
- `/api/factor-history/[factorKey]` → Factor-specific history

**Other Routes:**
- `/api/og` → Open Graph image generation
- `/api/health` → Health check
- `/api/history` → Historical data
- `/api/alerts` → Alert system

### ETL Scripts & Outputs
**Core ETL:**
- `scripts/etl/compute.mjs` → Main ETL orchestrator (writes `latest.json`, `status.json`)
- `scripts/etl/factors.mjs` → Factor computation logic (75+ factor files)
- `scripts/etl/fetch-helper.mjs` → HTTP fetch utilities with retry/fallback
- `scripts/etl/stalenessUtils.mjs` → Staleness calculation utilities

**ETL Outputs:**
- `public/data/latest.json` → Latest G-Score + factors + band
- `public/data/status.json` → Factor freshness status (per-factor `status`, `last_updated_utc`, `reason`)
- `public/data/factor_history.csv` → Historical factor scores
- `public/data/history.csv` → Historical G-Score
- `public/data/cache/*/` → Per-factor cache directories

**ETL Cache Directories:**
- `public/data/cache/trend_valuation/`
- `public/data/cache/net_liquidity/`
- `public/data/cache/stablecoins/`
- `public/data/cache/term_leverage/`
- `public/data/cache/onchain/`
- `public/data/cache/etf/`
- `public/data/cache/social_interest/`
- `public/data/cache/macro_overlay/`

### GitHub Actions Workflows
- `.github/workflows/daily-etl.yml` → Daily ETL at 11:00 UTC (Node 20.18.0)
- `.github/workflows/weekly-backtesting.yml` → Weekly backtesting analysis
- `.github/workflows/bundle-size-tracking.yml` → Bundle size monitoring

### SSOT Configuration
- `config/dashboard-config.json` → **PRIMARY SSOT** (model_version, pillars, factors, bands, weights, normalization, freshness)
- `config/weights.json` → Legacy weights (may be deprecated)
- `config/subweights.json` → Sub-weight configurations
- `config/ui.json` → UI-specific settings
- `config/risk.json` → Risk band definitions (may be consolidated into dashboard-config.json)

**Config Loader:**
- `lib/config-loader.mjs` → Loads SSOT config
- `lib/riskConfig.ts` → TypeScript utilities for config access (`getBandForScore()`, `getConfig()`, etc.)

---

## 3. Known Issues & Guards

### Caching Headers & Force-Dynamic
**✅ CRITICAL:** All data API routes use aggressive no-cache headers:
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `export const dynamic = 'force-dynamic'` (Next.js route config)
- `export const revalidate = 0` (ISR disabled)

**Routes with no-cache:**
- `/api/data/latest-file/route.ts`
- `/api/data/status/route.ts`
- `/app/page.tsx` (page-level: `export const dynamic = 'force-dynamic'`)

**⚠️ GUARD:** Any new API routes serving ETL data MUST include these headers to prevent stale data.

### Stale/Excluded Factor Handling
**✅ CRITICAL:** Stale/excluded factors MUST always be visible in UI:

**Display Rules:**
- **Excluded factors:** Show gray banner: "Temporarily excluded from today's G-Score. Reason: {reason}"
- **Stale factors:** Show yellow/amber badge with status
- **Factor cards:** Always render, even if `status === 'excluded'` or `status === 'stale'`
- **Composite calculation:** Only `status === 'fresh'` factors contribute to G-Score (weights re-normalized)

**Implementation:**
- `app/components/RealDashboard.tsx` lines 894-903: Excluded factor banner
- `app/components/FactorCard.tsx`: Status badge always visible
- `lib/factorUtils.ts`: `getFactorStaleness()` determines status

**⚠️ GUARD:** Never hide or filter out excluded/stale factors from UI. They must be visible with clear status indicators.

### Risk Band Mapping/Boundaries
**✅ CRITICAL:** Risk bands use **inclusive ranges** (fixed in recent commits):

**SSOT Bands (from `config/dashboard-config.json`):**
- Aggressive Buying: [0, 14]
- Regular DCA Buying: [15, 34]
- Moderate Buying: [35, 49] ← **Score 49 must map here**
- Hold & Wait: [50, 64]
- Reduce Risk: [65, 79]
- High Risk: [80, 100]

**Implementation:**
- `lib/riskConfig.ts`: `getBandForScore()` uses `<=` for upper bound (inclusive)
- `scripts/etl/compute.mjs`: `riskBand()` function uses `<=` for upper bound
- `app/api/data/latest-file/route.ts`: Server-side band correction if mismatch detected
- `app/components/RealDashboard.tsx`: Client-side safety check for band correction

**⚠️ GUARD:** All band comparisons must use `score >= range[0] && score <= range[1]` (inclusive). Never use `<` for upper bound.

### ETL Self-Check + Cache Purge Behavior
**✅ CRITICAL:** ETL self-check policy (from recent fixes):

**Pre-Compute:**
- ✅ Model version check (hard-fail if missing)
- ✅ Cache write test (hard-fail if can't write)
- ⚠️ Stale cache age: **WARNING only** (no hard-fail)
- ✅ Auto-purge: Caches older than `stale_beyond_hours` (or 24h fallback) are deleted

**Post-Compute:**
- ✅ Re-read `status.json` after all factors computed
- ✅ Hard-fail only if required factors still not fresh after recompute
- ✅ Log: `[ETL post-check] OK` or `[ETL post-check] FAIL: <factor> reason=...`

**CLI Flags:**
- `--no-selfcheck` → Skip pre-compute self-check (keep post-check)
- `--force-recompute=<factor|all>` → Delete cache(s) up front
- `--soft-fail` → Don't `process.exit(1)` on post-check (warn only)

**⚠️ GUARD:** ETL must never hard-fail on pre-compute stale caches. It should purge and proceed, only failing if recompute can't achieve freshness.

### Node/React/Next Version Pinning
**✅ CRITICAL:** Version constraints:
- **Node:** `20.18.x` (pinned in `package.json` engines, GitHub Actions uses `20.18.0`)
- **Next.js:** `15.5.7`
- **React:** `18.3.1`
- **React DOM:** `18.3.1`

**⚠️ GUARD:** Do not upgrade major versions without testing. Next.js 15 uses App Router exclusively.

---

## 4. Mobile Responsive Constraints

### Mobile Grid System
**CSS Classes (from `app/globals.css`):**
- `.mobile-grid-1` → `grid grid-cols-1 gap-4`
- `.mobile-grid-2` → `grid grid-cols-1 sm:grid-cols-2 gap-4` ← **Used for factor cards**
- `.mobile-grid-3` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- `.mobile-grid-4` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`

**Usage in RealDashboard:**
- Line 257: Hero cards (`mobile-grid-2`)
- Line 561: Secondary cards (`mobile-grid-2`)
- Line 723: Factor cards (`mobile-grid-2 mb-6 lg:mb-8`)

**⚠️ GUARD:** Factor cards use `mobile-grid-2` which means:
- Mobile: 1 column (stacked)
- `sm:` breakpoint (640px+): 2 columns
- Cards must have equal height or use flexbox to prevent layout jank

### Equal-Height Hero Cards
**Current Implementation:**
- Hero cards (G-Score, BTC Price, etc.) use `mobile-grid-2`
- Cards should stack cleanly on mobile without overflow

**⚠️ GUARD:** Any UI redesign must maintain:
- Equal-height cards on desktop (2-column grid)
- Clean stacking on mobile (1 column)
- No horizontal overflow on mobile viewports
- Touch-friendly button sizes (min 44x44px)

---

## 5. UI Data Flow

### Initial Load
1. `app/page.tsx` → `CanaryPage` → `ViewSwitch` → `RealDashboard`
2. `RealDashboard` fetches:
   - `/api/data/latest-file` → Latest G-Score + factors (with band correction)
   - `/api/data/status` → Factor freshness status
3. Client-side safety check: Recomputes band if mismatch detected

### Refresh Flow
1. User clicks "Refresh Dashboard" button
2. Calls `/api/refresh` (rate-limited: 60s per IP)
3. `/api/refresh` tries ETL artifacts first (`public/data/latest.json`)
4. Falls back to real-time computation if artifacts missing
5. Returns fresh data with proper band mapping

### Factor Display
- Factors sorted by contribution (`sortFactorsByContribution()`)
- Each factor card shows:
  - Status badge (fresh/stale/excluded)
  - Score (or "—" if excluded)
  - Details (expandable if >3 items)
  - Staleness banner if excluded
  - Last updated timestamp

---

## 6. Critical Files for UI Redesign

**Must Not Break:**
- `app/components/RealDashboard.tsx` → Main dashboard (1130 lines)
- `app/api/data/latest-file/route.ts` → Band correction logic
- `app/api/data/status/route.ts` → Status serving
- `lib/riskConfig.ts` → SSOT band mapping
- `app/globals.css` → Mobile grid system (lines 1615-1629)

**Can Modify (with care):**
- `app/components/FactorCard.tsx` → Individual factor card styling
- `app/components/DashboardHero.tsx` → Hero section
- `app/components/ScoreInsightsCard.tsx` → Score insights card
- `app/globals.css` → Styling (but preserve mobile-grid classes)

---

## 7. Acceptance Criteria for UI Redesign

### Must Preserve:
1. ✅ **Mobile responsiveness:** Cards stack cleanly on mobile (1 column), 2 columns on `sm:` breakpoint
2. ✅ **Stale/excluded visibility:** All factors visible with clear status indicators
3. ✅ **No caching regressions:** All data API routes must keep no-cache headers
4. ✅ **Equal-height cards:** Hero cards maintain equal height on desktop
5. ✅ **Band mapping accuracy:** Score-to-band mapping uses inclusive ranges
6. ✅ **Touch targets:** Buttons/interactive elements min 44x44px

### Can Improve:
- Visual styling (colors, shadows, spacing)
- Card layouts (as long as mobile-grid constraints respected)
- Typography hierarchy
- Animation/transitions
- Accessibility enhancements

---

## 8. Next Steps

1. ✅ Review this document
2. ⏳ Identify specific UI redesign tasks
3. ⏳ Validate tasks against acceptance criteria
4. ⏳ Create/update Plan Mode task list
5. ⏳ Begin implementation (after approval)

---

**Last Updated:** 2025-01-13  
**Status:** Ready for UI redesign planning
