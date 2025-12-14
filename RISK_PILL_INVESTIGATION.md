# Risk Pill Investigation Report

## Problem
GhostGauge home shows a score of 49 but the pill reads "High Risk" instead of "Moderate Buying".

## Expected Behavior
According to SSOT (`config/dashboard-config.json`):
- Score 49 should map to "Moderate Buying" (range [35, 49])
- Score 50 should map to "Hold & Wait" (range [50, 64])

## Root Cause Analysis

### Step 1: Data Verification

**SSOT Configuration** (`config/dashboard-config.json`):
```json
{
  "key": "moderate_buy",
  "label": "Moderate Buying",
  "range": [35, 49],
  "color": "yellow",
  "recommendation": "Moderate buying opportunities",
  "order": 3
}
```

**Latest Data** (`public/data/latest.json`):
- `composite_score`: 50
- `band.key`: "hold___wait" (note triple underscores - potential issue)
- `band.label`: "Hold & Wait"
- `band.range`: [50, 64]

**Note**: User reports seeing score 49, but latest.json shows 50. This suggests either:
1. Data has changed since last ETL run
2. User is looking at a different component (e.g., factor score vs composite score)
3. There's a caching issue

### Step 2: Component Analysis

**Risk Pill Location** (`app/components/RealDashboard.tsx` line 277-278):
```tsx
<div className={`inline-flex items-center px-3 py-2 rounded-full text-base font-semibold ${getBandColorClasses(latest?.band?.label ?? '')}`}>
  {latest?.band?.label ?? '—'}
</div>
```

The pill uses `latest?.band?.label` directly from the data. This is correct IF the ETL computed the band correctly.

### Step 3: Band Computation Logic

**Issue Found**: `lib/riskConfig.ts` line 335-339:
```typescript
export function getBandForScore(score: number): RiskBand {
  const bands = getConfig().bands;
  const band = bands.find(b => score >= b.range[0] && score < b.range[1]);  // ❌ BUG: Uses < instead of <=
  return band || bands[bands.length - 1]; // Default to highest band
}
```

**The Bug**: The comparison uses `score < b.range[1]` (exclusive upper bound) instead of `score <= b.range[1]` (inclusive upper bound).

**Impact**:
- Score 49 with range [35, 49]: `49 >= 35 && 49 < 49` = `true && false` = **false** ❌
- Score 49 doesn't match "Moderate Buying"
- Falls through to default (last band) = "High Risk" ❌

**Correct Logic**:
- Score 49 with range [35, 49]: `49 >= 35 && 49 <= 49` = `true && true` = **true** ✅

### Step 4: Other Hardcoded Mappings Found

1. **QuickGlanceAltDelta.tsx** (line 142): Uses hardcoded `if (score <= 49)` - correct but not using SSOT
2. **RadialGauge.tsx** (line 205): Hardcoded bands array - not using SSOT
3. **ETL compute.mjs**: Need to verify it uses `getBandForScore()` correctly

## Solutions

### Solution 1: Fix `getBandForScore()` (Primary Fix)
Change the comparison from `<` to `<=` to make upper bound inclusive:

```typescript
export function getBandForScore(score: number): RiskBand {
  const bands = getConfig().bands;
  const band = bands.find(b => score >= b.range[0] && score <= b.range[1]);  // ✅ Fixed: Uses <=
  return band || bands[bands.length - 1];
}
```

### Solution 2: Verify ETL Uses SSOT
Check that `scripts/etl/compute.mjs` uses `getBandForScore()` from `lib/riskConfig.ts` and not hardcoded logic.

### Solution 3: Remove Hardcoded Band Logic
Replace hardcoded band arrays in:
- `RadialGauge.tsx` - should load from SSOT
- `QuickGlanceAltDelta.tsx` - should use `getBandForScore()`

### Solution 4: Fix Band Key Mismatch
The ETL outputs `band.key: "hold___wait"` (triple underscores) but SSOT uses `"hold_wait"` (single underscore). This suggests the ETL might be using a different band computation or key mapping.

## Recommended Fix Priority

1. **CRITICAL**: Fix `getBandForScore()` comparison operator (Solution 1)
2. **HIGH**: Verify ETL uses SSOT for band computation
3. **MEDIUM**: Remove hardcoded band logic from components
4. **LOW**: Fix band key naming consistency

## Testing

After fixes, verify:
- Score 49 → "Moderate Buying" ✅
- Score 50 → "Hold & Wait" ✅
- Score 14 → "Aggressive Buying" ✅
- Score 34 → "Regular DCA Buying" ✅
- Score 64 → "Hold & Wait" ✅
- Score 79 → "Reduce Risk" ✅
- Score 80 → "High Risk" ✅
- Score 100 → "High Risk" ✅

