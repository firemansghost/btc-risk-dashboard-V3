# Checkpoint B — Client/Server Boundary Errors

## Files Touched
- `app/components/Navigation.tsx` - Removed `getConfig()` import and calls; added client-safe API fetch for model_version
- `app/components/AssetSwitcher.tsx` - Removed `require('@/lib/riskConfig')` and `getConfig()` call; added client-safe API fetch for model_version

## What Changed and Why
- Removed server-only `getConfig()` calls from client components (Navigation and AssetSwitcher)
- Replaced with client-safe fetch to `/api/config` endpoint on mount
- Cached `model_version` in component state to avoid repeated fetches
- Both components now fetch model_version once on mount and use cached value for analytics events

## Follow-ups
- None - TypeScript check passes, no server imports in client components

