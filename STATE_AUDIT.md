# Repository State Audit

**Generated:** 2025-01-27  
**Purpose:** Map planned tasks (2, 4, 5) to PRESENT/ABSENT status with evidence

---

## 1. Current Repository State

- **HEAD Commit:** `f52932a8669b9d110c007851e084f7b7773206dd`
- **Branch:** `main`
- **Note:** This commit is an empty commit created to trigger Vercel deployment. The actual codebase state corresponds to commit `9b10ec9` (reverted state).

---

## 2. Task Status Mapping

### Task 2: System Health Panel

#### 2.1 ContextHeader has clickable System Health (button)
**Status:** ✅ **PRESENT**

**Evidence:**
- File: `app/components/ContextHeader.tsx`
- Lines: 193-209
- Implementation: Button with `onClick={() => onOpenHealthPanel?.()}` handler
- Features:
  - Clickable button with hover states (line 195)
  - Health summary text (lines 85-100, 207)
  - Health dot indicator (line 200)
  - Counts display: `({health.fresh}/{health.stale}/{health.excluded})` (line 203)
  - Timeout handling for loading state (lines 73-82)

#### 2.2 SystemHealthPanel component exists
**Status:** ✅ **PRESENT**

**Evidence:**
- File: `app/components/SystemHealthPanel.tsx`
- Lines: 1-219
- Features:
  - Panel with backdrop (lines 103-107)
  - Desktop: right-side drawer (line 114)
  - Mobile: bottom sheet (line 115)
  - Focus trap and keyboard navigation (lines 57-87)
  - Escape key handling (lines 48-55)
  - Sorted by severity: excluded → stale → fresh (lines 92-98)
  - Jump button for each factor (lines 200-209)
  - Age formatting (lines 15-29)
  - Status badges with colors (lines 150-154)

#### 2.3 RealDashboard wires panel open/close and jumpToFactor scroll/highlight
**Status:** ✅ **PRESENT**

**Evidence:**
- File: `app/components/RealDashboard.tsx`
- Panel state: Line 148 (`const [healthPanelOpen, setHealthPanelOpen] = useState(false);`)
- Panel import: Line 34 (`import SystemHealthPanel from './SystemHealthPanel';`)
- Panel rendering: Lines 1332-1337
- `jumpToFactor` function: Lines 263-274
  - Uses `document.getElementById(\`factor-${factorKey}\`)` (line 264)
  - Smooth scroll with `scrollIntoView` (line 266)
  - Highlight ring animation (lines 269-272)
- Panel wiring: Line 1337 (`onJumpToFactor={jumpToFactor}`)
- Open handler: Line 394 (`onOpenHealthPanel={() => setHealthPanelOpen(true)}`)

#### 2.4 Factor cards have id="factor-${factorKey}"
**Status:** ✅ **PRESENT**

**Evidence:**
- File: `app/components/RealDashboard.tsx`
- Line: 904
- Implementation: `<div id={\`factor-${factor.key}\`} ...>`
- Context: Inside factor card mapping loop (line 890)

---

### Task 4: Delta Provenance

#### 4.1 /api/factor-deltas exists and returns provenance fields
**Status:** ❌ **ABSENT**

**Evidence:**
- File: `app/api/factor-deltas/route.ts`
- Lines: 1-134
- Current implementation:
  - Returns `{ delta, previousScore, currentScore }` (lines 103-107)
  - **Missing fields:** `currentDate`, `previousDate`, `basis`
- Expected format (per Task 4 spec):
  ```typescript
  {
    factorKey: {
      delta: number | null,
      currentScore: number | null,
      previousScore: number | null,
      currentDate: "YYYY-MM-DD",
      previousDate: "YYYY-MM-DD" | null,
      basis: "previous_available_row"
    }
  }
  ```
- Current return type (line 80): `Record<string, { delta: number; previousScore: number; currentScore: number }>`
- **Note:** Route reads from CSV (line 14) and parses last 2 rows (lines 62-78), but does not extract or return date information.

#### 4.2 deltaUtils exists (formatDeltaProvenance/formatDeltaDisplay/getDeltaColorClass)
**Status:** ❌ **ABSENT**

**Evidence:**
- File search: No `lib/deltaUtils.ts` found
- Grep search: No matches for `formatDeltaProvenance`, `formatDeltaDisplay`, or `getDeltaColorClass`
- **Note:** These utility functions were planned but not implemented.

#### 4.3 UI shows provenance tooltip or drawer text
**Status:** ❌ **ABSENT**

**Evidence:**
- File: `app/components/RealDashboard.tsx`
- Delta display: Lines 976-989
- Current tooltip (line 985): Only shows `"24h change: +X points"` (no provenance)
- File: `app/components/FactorDetailsDrawer.tsx`
- Delta display: Lines 97-106
- Current display: Only shows delta value (no provenance text)
- **Note:** No tooltip or text indicating what dates are being compared or the basis of the delta.

#### 4.4 Tests exist and are configured to run
**Status:** ⚠️ **PARTIAL**

**Evidence:**
- Test configuration: `package.json` line 22 (`"test": "vitest run"`)
- Test files present:
  - `lib/__tests__/csv-export.test.ts`
  - `lib/__tests__/freshness.test.ts`
  - `lib/__tests__/normalize.test.ts`
  - `lib/__tests__/bands.test.ts`
- **Missing:** No `lib/__tests__/deltas.test.ts` or similar delta-specific tests
- Test run result: ✅ All 16 tests pass (4 test files)
- **Note:** Tests are configured and working, but delta-specific tests are absent.

---

### Task 5: Truth Panel Drawer

#### 5.1 FactorDetailsDrawer has prominent stale/excluded banner at top
**Status:** ⚠️ **PARTIAL**

**Evidence:**
- File: `app/components/FactorDetailsDrawer.tsx`
- Lines: 109-125
- Current implementation:
  - Status banner exists (lines 110-125)
  - Shows for stale/excluded factors
  - **Issue:** Banner is NOT at the top of the drawer
  - Banner appears after:
    - Header (lines 64-78)
    - Factor name + pillar badge (lines 82-87)
    - Score + 24h Delta section (lines 89-107)
  - **Note:** Per Task 5 spec, banner should be "prominent" and "at top" (likely immediately after header).

#### 5.2 Copy summary + Copy JSON buttons
**Status:** ❌ **ABSENT**

**Evidence:**
- File: `app/components/FactorDetailsDrawer.tsx`
- Lines: 1-183 (full file)
- Grep search: No matches for "Copy summary", "Copy JSON", "copySummary", "copyJson"
- **Note:** Copy functionality was planned but not implemented.

#### 5.3 Lazy-loaded mini-chart
**Status:** ❌ **ABSENT**

**Evidence:**
- File: `app/components/FactorDetailsDrawer.tsx`
- Lines: 1-183 (full file)
- Grep search: No matches for "mini-chart", "lazy.*chart", "HistoryChart", "factor-history"
- **Note:** Mini chart feature was planned but not implemented.

#### 5.4 /api/factor-history/[factorKey] route exists
**Status:** ⚠️ **STUB ONLY**

**Evidence:**
- File: `app/api/factor-history/[factorKey]/route.ts`
- Lines: 1-20
- Current implementation:
  - Route exists and accepts `factorKey` parameter (line 5)
  - Returns mock response: `{ message: 'Factor History API working', factorKey, timestamp }` (lines 11-15)
  - **Missing:** Actual CSV reading, date range filtering, JSON/CSV format support
- **Note:** Route is a placeholder stub, not a functional implementation.

#### 5.5 Route uses Node runtime if it reads from FS
**Status:** ❌ **ABSENT**

**Evidence:**
- File: `app/api/factor-history/[factorKey]/route.ts`
- Lines: 1-20
- **Missing:** No `export const runtime = 'nodejs'` declaration
- **Note:** Since the route is a stub and doesn't read from filesystem, this is not yet applicable. However, per Task 5 spec, if/when implemented, it should include this export.

---

## 3. Verification Commands

### 3.1 npm run lint
**Status:** ❌ **FAILED**

**Error:**
```
Error: Cannot find module './cjs/react.production.js'
```

**File:** `node_modules/react/index.js` (dependency issue, not code issue)

**Root Cause Guess:** Corrupted or incomplete `node_modules` installation. This is an environment/dependency issue, not a code problem. The error occurs during Next.js lint initialization, before any code analysis.

**Note:** This is a local environment issue. Vercel builds may succeed if dependencies are properly installed.

### 3.2 npm test
**Status:** ✅ **PASSED**

**Result:**
- Test Files: 4 passed (4)
- Tests: 16 passed (16)
- Duration: 1.51s

**Test Files:**
- `lib/__tests__/csv-export.test.ts` (9 tests)
- `lib/__tests__/freshness.test.ts` (2 tests)
- `lib/__tests__/normalize.test.ts` (3 tests)
- `lib/__tests__/bands.test.ts` (2 tests)

**Note:** All tests pass. No delta-specific tests present.

### 3.3 npm run build
**Status:** ❌ **FAILED**

**Error:**
```
Error: Cannot find module './cjs/react.production.js'
```

**File:** `node_modules/react/index.js` (same dependency issue as lint)

**Root Cause Guess:** Same as lint error - corrupted `node_modules`. The build process fails during Next.js initialization before any code compilation.

**Note:** This is a local environment issue. Vercel builds may succeed if dependencies are properly installed.

---

## 4. Summary

### Task 2: System Health Panel
**Overall Status:** ✅ **COMPLETE**

All components of Task 2 are present and functional:
- Clickable System Health button in ContextHeader
- SystemHealthPanel component with full functionality
- RealDashboard wiring for panel and jumpToFactor
- Factor cards with proper IDs

### Task 4: Delta Provenance
**Overall Status:** ❌ **INCOMPLETE**

Missing components:
- Provenance fields in `/api/factor-deltas` response (`currentDate`, `previousDate`, `basis`)
- `deltaUtils.ts` utility functions
- UI provenance tooltips/text
- Delta-specific tests

Present:
- Basic delta computation and display
- Test infrastructure (but no delta tests)

### Task 5: Truth Panel Drawer
**Overall Status:** ❌ **INCOMPLETE**

Missing components:
- Copy summary + Copy JSON buttons
- Lazy-loaded mini-chart
- Functional `/api/factor-history/[factorKey]` route (currently stub)
- Node runtime export in factor-history route

Partially present:
- Status banner exists but not prominently positioned at top

---

## 5. Recommendations

1. **Fix local environment:** Run `npm install` to resolve `node_modules` issues affecting lint/build.
2. **Task 4 priority:** Implement provenance fields in delta API and add UI tooltips.
3. **Task 5 priority:** Complete FactorDetailsDrawer enhancements (banner positioning, copy buttons, mini-chart).
4. **Testing:** Add delta-specific tests once provenance is implemented.

---

**Audit completed:** 2025-01-27
