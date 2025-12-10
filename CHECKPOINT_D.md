# Checkpoint D — Methodology Initial Render Gap

## Files Touched
- `app/methodology/page.tsx` - Replaced three `null` renders with friendly fallback messages

## What Changed and Why
- Replaced `null` renders with brief placeholder messages for:
  1. Risk bands section: "Loading risk bands configuration..."
  2. Factor weights section: "Loading factor weights configuration..."
  3. Pillar weights section: "Loading pillar weights configuration..."
- Prevents "flash of nothing" during initial fetch
- Maintains "no infinite loaders" rule (single-line placeholders, no spinners)
- Once data resolves, SSOT values render normally

## Follow-ups
- None - All three sections now show friendly fallbacks instead of empty content

