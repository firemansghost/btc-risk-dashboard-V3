# Checkpoint B — Methodology Fallback Message Correctness

## Files Touched
- `app/methodology/page.tsx` - Updated error UI logic for all three sections (bands, factors, pillars)

## What Changed and Why
- Only show "showing last-known values" when `lastKnownConfig` actually exists
- When no cache exists, show neutral message: "Couldn't load configuration. Please refresh the page."
- Prevents misleading users into thinking cached values are shown when they're not
- Maintains one-line, no-spinner pattern
