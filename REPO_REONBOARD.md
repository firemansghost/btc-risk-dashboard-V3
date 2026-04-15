# Repo Re-Onboard Report
**Date:** 2025-01-13  
**Purpose:** Fast re-onboarding before UI redesign tasks to avoid breaking production

---

## Checkpoints

### GhostGauge Checkpoint — 2026-03-25

#### Project

- **Name:** GhostGauge
- **Repo:** `firemansghost/btc-risk-dashboard-V3`
- **Live site:** `ghostgauge.com`

#### Current status

Main Overview-page trust issues identified in this repair pass have been fixed and verified on live production.

#### What was broken

1. **Factor-card detail misassignment on the main Overview page**
   - Multiple factor cards were showing detail rows belonging to other factors.
   - This was a trust-killer because the UI looked cross-wired even when the app otherwise loaded.

2. **Production artifact mismatch after ETL merge fix**
   - The ETL keyed-merge bug was fixed in code, but the corrected `latest.json` artifact had not yet been regenerated/committed/deployed.
   - Result: production could still serve wrong factor details even though the code fix existed.

3. **Visible copy drift on Overview page**
   - Risk Factor Breakdown summary line showed old pillar weights:
     - `Liquidity 35% · Momentum 25% · Term 20% · Macro 10% · Social 10%`
   - Macro Overlay context chip showed:
     - `scored under Liquidity (5%)`
   - Both were out of sync with current SSOT.

#### What was fixed

##### 1) Factor-detail mapping bug

- Root cause was in the **ETL/artifact path**, not the React card rendering.
- Enabled factors had previously been merged against settled compute results by index instead of reliably by factor key.
- Fix was applied in ETL so factor payloads are merged by **factor key**.

##### 2) Artifact regeneration / production verification

- ETL outputs were regenerated and committed after the keyed-merge fix.
- Production was then verified against the live `/api/data/latest-file` payload.
- Live factor payload now matches expected domain-correct factor details.

##### 3) Overview-page copy drift

- Risk Factor Breakdown summary line now reflects official SSOT pillar weights:
  - `Liquidity 30% · Momentum 30% · Leverage 20% · Macro 10% · Social 10%`
- Macro Overlay context label now reflects Net Liquidity’s actual SSOT factor weight:
  - `4.3%`

#### Production verification summary

Verified live:

- factor cards now appear mapped correctly
- drawer still works correctly
- summary line now shows official 30/30/20/10/10
- Macro Overlay context chip now shows 4.3%

#### Important commits / task trail

- **ETL keyed-merge fix:** `2f24764` — `scripts/etl/factors.mjs` (merge compute results by factor key, not array index)
- **Artifact regeneration commit:** `c444abd` on `main` — regenerated `public/data/latest.json` and related ETL outputs after the merge fix
- **Overview-page copy drift fix:** `5315c96` — `app/components/RealDashboard.tsx` (SSOT-aligned pillar summary + Net Liquidity context %)

#### 2026-03-25 — mobile follow-up

Additional mobile UX fixes were completed after the main checkpoint:

- **Refresh Dashboard CTA** was moved into the **Bitcoin G-Score** card so it no longer overlaps nearby text on mobile and is more logically associated with the current score/snapshot area. (`d372b19`)
- **Historical G-Score card sizing** was fixed so the full `HistoryChart` component (controls + chart + caption) is properly measured by its parent container, preventing overlap with the intro copy below on mobile. (`0fd3adb`)

#### 2026-03-25 — Score Insights cleanup

Completed a **3-pass cleanup** of the Overview-page **Score Insights** card (`app/components/ScoreInsightsCard.tsx`):

- **Pass 1:** Removed overlapping narrative sections and replaced them with a concise **“What matters right now”** block.
- **Pass 2:** Improved hierarchy by keeping contributors / mitigators / concentration / confidence prominent and clearly separating **Advanced diagnostics** (volatility, momentum, correlations).
- **Pass 3:** Tightened wording, lightly reduced vertical heaviness, and clarified / deemphasized the **row-expansion** control (advanced list rows only; hidden when redundant).

#### Files touched in this repair pass

Primary files involved:

- `scripts/etl/factors.mjs`
- regenerated ETL artifacts including:
  - `public/data/latest.json`
  - related ETL outputs
- `app/components/RealDashboard.tsx`

#### What was intentionally not changed

- official G-Score math
- risk band logic
- preview / lab model logic
- stale/excluded factor visibility behavior
- broad dashboard redesign
- broad Next/Vercel config cleanup
- history API/data unification work
- general UX polish outside the identified trust issues

#### Deferred / backlog items

##### High-value UX backlog

1. **Overview mobile polish (refresh CTA + history card layout)** — **addressed 2026-03-25** (see *2026-03-25 — mobile follow-up* above). Open only minor layout nits if they appear on new devices.

##### Lower-priority cleanup

1. Audit Overview page for any remaining SSOT/copy drift.
2. Decide whether to clean up odd internal band key formatting like `hold___wait` if it leaks anywhere user-facing.
3. Consider a future history/data-serving consistency pass if needed.

#### Recommended next task when returning

Pick up from *Lower-priority cleanup* or any new issue from production; the mobile refresh/history-card overlap items from the original checkpoint are **done** (see *2026-03-25 — mobile follow-up*).

#### Thread starter for next GhostGauge session

Use this when resuming:

> Resume GhostGauge from the 2026-03-25 checkpoint. The major Overview-page trust issues were fixed: factor-card detail misassignment was corrected in the ETL/artifact path, regenerated artifacts were deployed, and Overview copy drift was fixed so the summary line now reflects official SSOT pillar weights and Macro Overlay context shows Net Liquidity at 4.3%. Follow-up mobile fixes (Refresh Dashboard placement under the Bitcoin G-Score card; Historical G-Score / `HistoryChart` parent sizing) shipped 2026-03-25. The Overview **Score Insights** card also received a **3-pass cleanup** (merged narrative → hierarchy / advanced diagnostics → wording + spacing + row-toggle polish). Treat the repo and live site as ground truth, prefer small reversible changes, do not break mobile, do not hide stale/excluded factors, and do not let experimental logic affect official outputs.

### 2026-04-14 Addendum — Score Insights, mobile polish, and ETL resilience

Short follow-up to **GhostGauge Checkpoint — 2026-03-25** (does not replace it). Captures UI/ETL work completed after that checkpoint.

#### Score Insights cleanup

A **3-pass cleanup** of the Overview-page **Score Insights** card (`app/components/ScoreInsightsCard.tsx`) was completed:

- **Pass 1:** Removed overlapping narrative bloat and replaced multiple repetitive narrative sections with a concise **“What matters right now”** block.
- **Pass 2:** Improved hierarchy by keeping contributors / mitigators / concentration / confidence prominent and clearly separating **Advanced diagnostics** (volatility, momentum, correlations).
- **Pass 3:** Tightened wording, slightly reduced vertical heaviness, and clarified / deemphasized the **list-expansion** control (advanced diagnostic lists only).

**Outcome:** Score Insights is shorter, less repetitive, easier to scan, and still grounded in factor behavior. (Earlier checkpoint bullets for this work: *2026-03-25 — Score Insights cleanup*.)

#### Mobile fixes

Overview **mobile UX** fixes (same items as *2026-03-25 — mobile follow-up*; commit refs remain there):

- **Refresh Dashboard CTA** was moved into the **Bitcoin G-Score** card so it no longer overlaps nearby text on mobile and is more logically associated with the current score/snapshot area.
- **Historical G-Score card sizing** was fixed so the full `HistoryChart` component is properly measured by its parent container, preventing overlap with the intro copy below on mobile.

**Outcome:** Mobile hero area is cleaner and tap behavior is improved; Historical G-Score content no longer spills into the next section on mobile.

#### Daily ETL resilience fix

After repeated **Daily ETL** workflow failures from **transient FRED 500** responses:

- **`net_liquidity`** and **`macro_overlay`** now **fall back to valid cached factor results** when live FRED refresh fails, instead of being immediately excluded.
- Fallback applies **only** when cached data is still acceptable under the factor’s **staleness policy** (SSOT); no-cache or too-stale cases still fail honestly.
- **`net_liquidity`** disk cache TTL / warm-cache behavior was **aligned with SSOT** staleness expectations (240h TTL for the on-disk warm path).
- Daily ETL was **re-run successfully** after the fix.

**Outcome:** Transient upstream FRED failures are less likely to fail the full Daily ETL when valid cache exists; true no-cache / too-stale cases still fail honestly.

**Task trail (verified on `main`):** `555d161` — `fix(etl): FRED outage fallback to cached net_liquidity and macro_overlay` (`scripts/etl/factors.mjs` + `scripts/etl/__tests__/fred_cache_fallback.test.mjs`).

These updates improve readability, mobile usability, and ETL resilience **without changing official score logic**.

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
- `.github/workflows/weekly-backtesting.yml` → Weekly **backtesting report** + **monthly SSOT** `dca_vs_risk_comparison.json` (same workflow; Sunday 11:30 UTC; see below)
- `.github/workflows/bundle-size-tracking.yml` → Bundle size monitoring

### Strategy Analysis — backtesting JSON artifacts (provenance)

Two different files power `/strategy-analysis`; **do not treat them as one backtesting engine**.

| Artifact | Generator | CI? |
|----------|-----------|-----|
| `public/data/weekly_backtesting_report.json` | `scripts/etl/weekly-backtesting.mjs` (`npm run etl:backtesting`) | **Yes** — `.github/workflows/weekly-backtesting.yml` (Sunday 11:30 UTC + manual dispatch) |
| `public/data/dca_vs_risk_comparison.json` | `scripts/etl/dca-vs-risk-strategy-comparison.mjs` (`npm run etl:strategy-comparison`) | **Yes** — same workflow commits the **canonical monthly SSOT** file after the weekly backtesting step |

**Local regeneration:** You can still run `npm run etl:strategy-comparison` (or `npm run etl:backtesting`) locally; CI keeps the repo artifact aligned with `history.csv` on a weekly cadence so production does not depend on forgotten manual runs.

**Strategy comparison file (`dca_vs_risk_comparison.json`):** **SSOT v2** monthly methodology — Baseline vs Risk-Based DCA; first row per calendar month; band from **score + `dashboard-config` inclusive ranges** (CSV band fallback); official six-band multipliers; value averaging under `exploratory` only. See `docs/strategy-analysis/BACKTESTING_SSOT_SPEC.md` and `SSOT_PRODUCT_DECISIONS.md`.

**Weekly file (`weekly_backtesting_report.json`):** Still the older **~every-30-rows** strategy sim + band monitoring — **not** unified with SSOT v2 yet. UI labels them separately.

Both read from `public/data/history.csv`, but **methodologies differ**. Headline percentages from one file are **not** interchangeable with the other.

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

### Next.js config & Vercel deploy (2026 baseline)
- **Preferred baseline:** **`next.config.ts` uses stock-leaning Next behavior** — no custom `webpack` `splitChunks` / `cacheGroups`, no `experimental.optimizePackageImports`. Those were removed after **Vercel deployment instability** (misleading errors such as missing lambda for `/methodology` while the route built as static; root cause was **config/output packaging**, not the page).
- **Operational posture:** Prefer **stable, minimal** Next config. Reintroduce custom bundling only with a **measured** reason and preview validation.
- **Install:** Use **`npm ci`** on Vercel (deterministic install vs `package-lock.json`); `packageManager` is pinned in `package.json`.
- **`vercel.json`:** **Removed** from the repo to avoid duplicate header/route rules overlapping `next.config.ts`; rely on Next headers + Vercel project settings if needed.
- **Decision log:** `docs/DECISIONS.md` (entry: simplified Next config baseline).

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

**Last Updated:** 2026-04-15 — added **Strategy Analysis — backtesting JSON artifacts (provenance)** under *Repo Map* (weekly vs comparison JSON generators and CI scope).  
**Previously:** 2026-04-14 (checkpoint **2026-03-25** plus **2026-04-14 addendum**: Score Insights summary, mobile polish cross-ref, FRED/cache ETL resilience; sections 1–8 below retain historical detail from 2025-01-13 where not superseded)  
**Status:** Trust repair and follow-ups per **Checkpoints**; **2026-04-14 addendum** records Score Insights / mobile / ETL resilience without rewriting the original checkpoint; UI redesign planning notes in sections below remain useful guards for future work
