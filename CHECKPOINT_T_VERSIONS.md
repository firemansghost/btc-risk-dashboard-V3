# Checkpoint: T-VERSIONS

## Task / Sub-step
T-VERSIONS — Final verification sweep

## Result
✅ **Complete** — All version references updated to use `model_version` from SSOT

## Evidence
- ✅ **TypeScript**: No errors (`npm run typecheck` passes)
- ✅ **API Routes**: 
  - `app/api/refresh/route.ts:336` uses `config.model_version`
  - `app/api/data/latest/route.ts:108` uses `getConfig().model_version`
- ✅ **UI Components**:
  - `app/components/RealDashboard.tsx:655` defaults to 'v1.1'
- ✅ **ETL Script**:
  - `scripts/etl/compute.mjs` loads `model_version` from `dashboard-config.json` SSOT
- ✅ **UI Displays**:
  - `app/methodology/page.tsx`: Shows v1.1 in multiple places (lines 68, 777, 854)
  - `app/components/WeightsSandbox.tsx`: CSV header shows `# model_version=v1.1` (line 272)
- ✅ **Grep Verification**:
  - No `config.version` references found in codebase
  - No stray v3.x version strings in app/lib directories

## Next Sub-step
T-SEC-NEXT Sub-step 1: Verify lockfile consistency for react-server-dom-* packages

