# GhostGauge — Brand Card (v1.1)

This document defines GhostGauge's public narrative (what it is, who it's for), naming conventions (G-Score vs GRS), band labels, tone, and ready-to-use copy. It exists so UI text, social posts, and docs stay consistent. Keep this file in sync with live config and methodology versions.

---

# GhostGauge — Brand Card (v1.1)

A short, practical guide to what GhostGauge is, how it speaks, and how to present it to people with zero context.

## Brand at a glance

• **What it is**: A daily, transparent, factor-weighted market risk dashboard for Bitcoin. It compresses diverse data into a single 0–100 G-Score (higher = higher risk) with full driver transparency.

• **Who it's for**: Hedge-fund PMs, quants, sophisticated retail, and market-curious readers who want signal over noise.

• **Why it exists**: To help people frame risk, not predict price. Decision support—clear, repeatable, explainable.

• **Where it lives**: GhostGauge at ghostgauge.com; analysis voice from GrayGhost (author of the TWIMM newsletter).

• **How it feels**: Professional, analytical, modern UI—occasional, tasteful noir accents (mainly in social/newsletter, not the app).

## Brand architecture

• **Platform / Product**: GhostGauge
The destination and tool (dashboard, drivers, methodology, history/CSV, BTC⇄Gold, Sats per Dollar, Alerts).

• **Author / Persona**: GrayGhost
Byline & narrative lens in newsletter/social. On-site copy stays sober; persona is a light flourish.

• **Metric (formal)**: GrayGhost Risk Score (GRS v3)
Methods, whitepaper, code comments, API/docs.

• **Metric (everyday)**: G-Score
Headlines, UI chips, social posts, casual usage.

## One-liner & elevator pitch

• **One-liner**: GhostGauge turns market chaos into a single, transparent G-Score so you can calibrate risk at a glance.

• **30-second pitch**: GhostGauge blends seven enabled factor scores across liquidity, momentum, term structure, macro, and social/attention into a 0–100 G-Score (higher = higher risk). Each factor follows its own production logic, with factor-level status and source/timing context exposed in the dashboard. Click through to inspect the drivers and available history.

## Positioning & proof

• **Positioning**: Transparent risk telemetry for crypto + macro.

• **Promise**: Signals, not hype. Methods before marketing.

• **Proof points**:
  - Five-pillar model with published inputs & weights (30/30/20/10/10).
  - Seven enabled scoring factors; On-chain Activity is disabled at 0% in v1.1.1.
  - Factor-specific production logic produces 0–100 factor scores; included factor scores are combined using published versioned weights.
  - Factor History outputs are maintained by successful production ETL runs with documented provenance.
  - ETF Flows uses a 21-day aggregate-flow measure with source-freshness and data-quality guards.
  - Cycle and Spike adjustment mechanisms are disabled in production v1.1.1; reactivation would require a versioned methodology decision.
  - Clear risk bands and plain-English playbook.

## Audience & use cases

• **PMs/Quants**: Fast regime check; portfolio guardrails; risk-on/risk-off framing.

• **Sophisticated retail**: Sanity check against headlines & influencer noise.

• **Media/Creators**: Reliable daily artifact to cite/embed.

• **You (GrayGhost)**: Anchor for weekly commentary and cross-asset context.

## Messaging pillars (what we talk about)

1. **Transparency** — clear inputs, weights, freshness.
2. **Discipline** — stable methodology; versioned updates.
3. **Context** — show drivers, not just a number.
4. **Restraint** — risk framing ≠ trade signals.
5. **Macro-aware** — liquidity and cross-market data matter.

## Voice & tone

• **Primary**: Crisp, neutral, specific. Short sentences. No predictions.

• **Persona seasoning (optional)**: A brief noir-tinged line in social/newsletter—not in the app chrome.

• **Always include**: UTC timestamp and a path to methodology.

## Ready-to-use lines

• "Signals, not hype."
• "One score, five pillars, zero mystery."
• "Transparent risk for macro + crypto."

## Naming & notation

### Public names
• G-Score (BTC) / Bitcoin G-Score
• (Future-ready) G-Score (ETH)
• GhostGauge: product/site
• XAU Lens: BTC↔Gold module
• Sats Lens: Satoshis per Dollar module
• Alerts: zero-cross & band-change notices

### Formal references
• GRS v3 — GrayGhost Risk Score, versioned methodology.
• Modules: Drivers, Methodology, History, XAU Lens, Sats Lens, Alerts.

## Risk bands (display + copy — align with app defaults)

• 0–14 Aggressive Buying — Historically depressed/washed-out conditions.
• 15–34 Regular DCA Buying — Favorable long-term conditions; take your time.
• 35–49 Moderate Buying — Moderate buying opportunities.
• 50–64 Hold & Wait — Hold core; buy dips selectively.
• 65–79 Reduce Risk — Trim risk; tighten risk controls.
• 80–100 High Risk — Crowded tape; prone to disorderly moves.

*(Note: these bands are configurable in app config; keep brand copy in sync with the live config and use live config as main source)*

## Slugs / API / data keys (examples)

• gscore_btc, grs_version=3
• pillar_liquidity, pillar_momentum, pillar_leverage, pillar_macro, pillar_social

## Do / Don't (naming)

• **Do**: Use G-Score in UI/social; use GRS in docs/methods.
• **Do**: Qualify asset explicitly (e.g., "Bitcoin G-Score").
• **Don't**: Call it an "index" or imply trade signals.
• **Don't**: Use sensational qualifiers ("warning!", "guaranteed!", etc.).

## Headline / subhead templates

### Dashboard H1
Today's Bitcoin G-Score: {value}

### Dashboard subhead / tooltip
The GrayGhost Risk Score (GRS v3) blends five pillars into a transparent 0–100 risk measure.

### Drivers section
Drivers — Liquidity · Momentum · Term Structure · Macro · Social

### Band legend (match live config)
0–14 Aggressive Buying · 15–34 Regular DCA Buying · 35–49 Moderate Buying · 50–64 Hold & Wait · 65–79 Reduce Risk · 80–100 High Risk

### Methodology CTA
Methodology (GRS v3) — inputs, normalization, weights, and staleness handling

### SEO title
GhostGauge — Bitcoin G-Score (0–100 multi-factor market risk)

### SEO description
Daily, transparent, factor-weighted risk for BTC. Liquidity, momentum, term structure, macro, social. Signals, not hype.

## Social & newsletter patterns

### Crossing-band alert (X/Twitter, from @grayghost)
Bitcoin G-Score just crossed 70 — High risk. Drivers + chart on GhostGauge.
ghostgauge.com

### Weekly wrap (TWIMM)
W/W Δ: 58 → 66. Liquidity led; term structure cooled. Full breakdown in Drivers.
ghostgauge.com

### Multi-asset tease (future)
ETH G-Score: 48 (Hold & Wait). Compare BTC/ETH drivers on GhostGauge.

### Persona-seasoned alt (sparingly)
"The street's loud. Signals aren't. BTC G-Score 72 — High."

## How the metric works (brief public summary)

• **Inputs → Pillars**: Liquidity/Flows (30%), Momentum/Valuation (30%), Term Structure/Leverage (20%), Macro (10%), Social/Attention (10%). Seven enabled scoring factors; On-chain Activity is disabled at 0%.

• **Factor scoring**: Each enabled factor uses factor-specific production logic to produce a 0–100 factor score.

• **Aggregation**: Only factors classified fresh in production contribute to the composite; versioned weights are normalized over the included set for that snapshot.

• **Freshness**: Input freshness is source-aware and is not a validation or accuracy claim.

• **Adjustments**: Cycle and Spike adjustment mechanisms are disabled in production v1.1.1; reactivation would require a versioned methodology decision.

• **Transparency**: Production snapshots expose factor-level status and source/timing context, with historical and downloadable artifacts available where provided.

• **Interpretation**: Higher G-Score = higher market risk (crowding, leverage, froth). Summary statistic, not a trade signal.

## Boilerplate (use anywhere)

GhostGauge is a daily market risk dashboard that compresses diverse market data into a single 0–100 G-Score—with full transparency into the drivers. Built by GrayGhost, GhostGauge blends liquidity, momentum, term structure, macro, and social signals into a disciplined, versioned methodology (GRS v3). It's decision support, not investment advice.

## Brand guardrails

• **Transparency first**: Always show As of (UTC) and link Methodology.
• **No calls**: Avoid directional predictions or trade language.
• **Consistency**: Use G-Score in UI/posts; reserve GRS for methods.
• **Tone**: Calm, precise, repeatable. Save persona noir lines for social/newsletter.
• **Neutral methodology**: Avoid personal names or vendor marks in core methodology. Use neutral descriptors (e.g., 'Cycle-Anchored Trend', 'BMSB distance').

## "What to show" checklist for any page/post

• Asset + G-Score + Band (e.g., "Bitcoin G-Score 72 — High").
• As of (UTC) timestamp.
• Top driver moves (1–2 bullets).
• Link to Drivers and Methodology.
• Disclosure: "For information only. Not investment advice."
