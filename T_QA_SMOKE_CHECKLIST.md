# T-QA-SMOKE — Final Verification Checklist

## Routes to Test
- [ ] `/` (dashboard)
- [ ] `/bitcoin`
- [ ] `/methodology`
- [ ] `/lab/weights` (sandbox)
- [ ] `/assets`
- [ ] `/spx`
- [ ] `/tsla`
- [ ] `/gold`

## Verification Items

### 1. Adjustment Caps
- [ ] Cycle adjustment ≤ ±2.0 in UI
- [ ] Spike adjustment ≤ ±1.5 in UI
- [ ] Cycle adjustment ≤ ±2.0 in sandbox CSV export
- [ ] Spike adjustment ≤ ±1.5 in sandbox CSV export

### 2. Model Version Display
- [ ] Methodology page shows v1.1
- [ ] Sandbox CSV header shows `# model_version=v1.1`
- [ ] Dashboard shows v1.1 (if displayed)

### 3. Analytics Behavior
- [ ] In Preview with `NEXT_PUBLIC_ANALYTICS_ENABLED=true`: Events fire once per interaction
- [ ] In local dev: No events fired
- [ ] In Preview without flag: No events fired
- [ ] Payload includes { asset, utc, model_version }

### 4. Gauge Accessibility
- [ ] One concise label announced by screen reader
- [ ] Decorative SVG elements (defs, gradients, particles) marked aria-hidden

### 5. SEO
- [ ] `/spx` has `robots: noindex`
- [ ] `/tsla` has `robots: noindex`
- [ ] `/gold` has `robots: noindex`
- [ ] `/assets` has canonical to itself

### 6. Methodology Fallback
- [ ] Friendly fallback message appears on SSOT fetch failure
- [ ] No infinite "Loading..." spinners
- [ ] Last-known values displayed when config fetch fails

### 7. Console Errors
- [ ] No console errors on all tested routes

### 8. Lighthouse Accessibility
- [ ] `/` has a11y score ≥ 95
- [ ] `/lab/weights` has a11y score ≥ 95

## Notes
- Preview URL: [To be added after deployment]
- Test Date: [To be added]
- Tester: [To be added]

