export default function BrandPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-li:text-gray-700 prose-li:leading-relaxed prose-blockquote:text-gray-600 prose-blockquote:border-l-gray-300 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200">
        <h1>GhostGauge — Brand Card (v1.1)</h1>
        
        <p>This document defines GhostGauge's public narrative (what it is, who it's for), naming conventions (G-Score vs GRS), band labels, tone, and ready-to-use copy. It exists so UI text, social posts, and docs stay consistent. Keep this file in sync with live config and methodology versions.</p>
        
        <hr />
        
        <h1>GhostGauge — Brand Card (v1.1)</h1>
        
        <p>A short, practical guide to what GhostGauge is, how it speaks, and how to present it to people with zero context.</p>
        
        <h2>Brand at a glance</h2>
        
        <ul>
          <li><strong>What it is</strong>: A daily, transparent, factor-weighted market risk dashboard for Bitcoin. It compresses diverse data into a single 0–100 G-Score (higher = higher risk) with full driver transparency.</li>
          <li><strong>Who it's for</strong>: Hedge-fund PMs, quants, sophisticated retail, and market-curious readers who want signal over noise.</li>
          <li><strong>Why it exists</strong>: To help people frame risk, not predict price. Decision support—clear, repeatable, explainable.</li>
          <li><strong>Where it lives</strong>: GhostGauge at ghostgauge.com; analysis voice from GrayGhost (author of the TWIMM newsletter).</li>
          <li><strong>How it feels</strong>: Professional, analytical, modern UI—occasional, tasteful noir accents (mainly in social/newsletter, not the app).</li>
        </ul>
        
        <h2>Brand architecture</h2>
        
        <ul>
          <li><strong>Platform / Product</strong>: GhostGauge<br />
            The destination and tool (dashboard, drivers, methodology, history/CSV, BTC⇄Gold, Sats per Dollar, Alerts).</li>
          <li><strong>Author / Persona</strong>: GrayGhost<br />
            Byline & narrative lens in newsletter/social. On-site copy stays sober; persona is a light flourish.</li>
          <li><strong>Metric (formal)</strong>: GrayGhost Risk Score (GRS v3)<br />
            Methods, whitepaper, code comments, API/docs.</li>
          <li><strong>Metric (everyday)</strong>: G-Score<br />
            Headlines, UI chips, social posts, casual usage.</li>
        </ul>
        
        <h2>One-liner & elevator pitch</h2>
        
        <ul>
          <li><strong>One-liner</strong>: GhostGauge turns market chaos into a single, transparent G-Score so you can calibrate risk at a glance.</li>
          <li><strong>30-second pitch</strong>: GhostGauge blends liquidity, momentum, term structure, macro, and social/attention into a 0–100 G-Score (higher = higher risk). Every input is sourced, time-stamped, normalized, and blended with outlier control and EWMA smoothing. No black boxes—click through to see the drivers and download the history.</li>
        </ul>
        
        <h2>Positioning & proof</h2>
        
        <ul>
          <li><strong>Positioning</strong>: Transparent risk telemetry for crypto + macro.</li>
          <li><strong>Promise</strong>: Signals, not hype. Methods before marketing.</li>
          <li><strong>Proof points</strong>:
            <ul>
              <li>Five-pillar model with published inputs & weights (35/25/20/10/10).</li>
              <li>Winsorized z-scores → logistic 0–100; stale data auto-excluded with weight re-normalization.</li>
              <li>Factor History CSVs updated daily; Provenance with source notes, schema tripwires, and fallbacks.</li>
              <li>ETF Flows via robust parser (21-day sum) with staleness & outlier guards.</li>
              <li>Optional small adjustments: cycle residual & spike detector—capped and disclosed.</li>
              <li>Clear risk bands and plain-English playbook.</li>
            </ul>
          </li>
        </ul>
        
        <h2>Audience & use cases</h2>
        
        <ul>
          <li><strong>PMs/Quants</strong>: Fast regime check; portfolio guardrails; risk-on/risk-off framing.</li>
          <li><strong>Sophisticated retail</strong>: Sanity check against headlines & influencer noise.</li>
          <li><strong>Media/Creators</strong>: Reliable daily artifact to cite/embed.</li>
          <li><strong>You (GrayGhost)</strong>: Anchor for weekly commentary and cross-asset context.</li>
        </ul>
        
        <h2>Messaging pillars (what we talk about)</h2>
        
        <ol>
          <li><strong>Transparency</strong> — clear inputs, weights, freshness.</li>
          <li><strong>Discipline</strong> — stable methodology; versioned updates.</li>
          <li><strong>Context</strong> — show drivers, not just a number.</li>
          <li><strong>Restraint</strong> — risk framing ≠ trade signals.</li>
          <li><strong>Macro-aware</strong> — liquidity and cross-market data matter.</li>
        </ol>
        
        <h2>Voice & tone</h2>
        
        <ul>
          <li><strong>Primary</strong>: Crisp, neutral, specific. Short sentences. No predictions.</li>
          <li><strong>Persona seasoning (optional)</strong>: A brief noir-tinged line in social/newsletter—not in the app chrome.</li>
          <li><strong>Always include</strong>: UTC timestamp and a path to methodology.</li>
        </ul>
        
        <h2>Ready-to-use lines</h2>
        
        <ul>
          <li>"Signals, not hype."</li>
          <li>"One score, five pillars, zero mystery."</li>
          <li>"Transparent risk for macro + crypto."</li>
        </ul>
        
        <h2>Naming & notation</h2>
        
        <h3>Public names</h3>
        <ul>
          <li>G-Score (BTC) / Bitcoin G-Score</li>
          <li>(Future-ready) G-Score (ETH)</li>
          <li>GhostGauge: product/site</li>
          <li>XAU Lens: BTC↔Gold module</li>
          <li>Sats Lens: Satoshis per Dollar module</li>
          <li>Alerts: zero-cross & band-change notices</li>
        </ul>
        
        <h3>Formal references</h3>
        <ul>
          <li>GRS v3 — GrayGhost Risk Score, versioned methodology.</li>
          <li>Modules: Drivers, Methodology, History, XAU Lens, Sats Lens, Alerts.</li>
        </ul>
        
        <h2>Risk bands (display + copy — align with app defaults)</h2>
        
        <ul>
          <li>0–14 Aggressive Buying</li>
          <li>15–34 Regular DCA Buying</li>
          <li>35–49 Moderate Buying</li>
          <li>50–64 Hold & Wait</li>
          <li>65–79 Reduce Risk</li>
          <li>80–100 High Risk</li>
        </ul>
        
        <p><em>(Note: these bands are configurable in app config; keep brand copy in sync with the live config and use live config as main source)</em></p>
        
        <h2>Slugs / API / data keys (examples)</h2>
        
        <ul>
          <li>gscore_btc, grs_version=3</li>
          <li>pillar_liquidity, pillar_momentum, pillar_leverage, pillar_macro, pillar_social</li>
        </ul>
        
        <h2>Do / Don't (naming)</h2>
        
        <ul>
          <li><strong>Do</strong>: Use G-Score in UI/social; use GRS in docs/methods.</li>
          <li><strong>Do</strong>: Qualify asset explicitly (e.g., "Bitcoin G-Score").</li>
          <li><strong>Don't</strong>: Call it an "index" or imply trade signals.</li>
          <li><strong>Don't</strong>: Use sensational qualifiers ("warning!", "guaranteed!", etc.).</li>
        </ul>
        
        <h2>Headline / subhead templates</h2>
        
        <h3>Dashboard H1</h3>
        <p>Today's Bitcoin G-Score: [value]</p>
        
        <h3>Dashboard subhead / tooltip</h3>
        <p>The GrayGhost Risk Score (GRS v3) blends five pillars into a transparent 0–100 risk measure.</p>
        
        <h3>Drivers section</h3>
        <p>Drivers — Liquidity · Momentum · Term Structure · Macro · Social</p>
        
        <h3>Band legend (match live config)</h3>
        <p>0–14 Aggressive Buying · 15–34 Regular DCA Buying · 35–49 Moderate Buying · 50–64 Hold & Wait · 65–79 Reduce Risk · 80–100 High Risk</p>
        
        <h3>Methodology CTA</h3>
        <p>Methodology (GRS v3) — inputs, normalization, weights, and staleness handling</p>
        
        <h2>SEO title</h2>
        <p>GhostGauge — Bitcoin G-Score (0–100 multi-factor market risk)</p>
        
        <h2>SEO description</h2>
        <p>Daily, transparent, factor-weighted risk for BTC. Liquidity, momentum, term structure, macro, social. Signals, not hype.</p>
        
        <h2>Social & newsletter patterns</h2>
        
        <h3>Crossing-band alert (X/Twitter, from @grayghost)</h3>
        <p>Bitcoin G-Score just crossed 70 — High risk. Drivers + chart on GhostGauge. ghostgauge.com</p>
        
        <h3>Weekly wrap (TWIMM)</h3>
        <p>W/W Δ: 58 → 66. Liquidity led; term structure cooled. Full breakdown in Drivers. ghostgauge.com</p>
        
        <h3>Multi-asset tease (future)</h3>
        <p>ETH G-Score: 48 (Hold & Wait). Compare BTC/ETH drivers on GhostGauge.</p>
        
        <h3>Persona-seasoned alt (sparingly)</h3>
        <p>"The street's loud. Signals aren't. BTC G-Score 72 — High."</p>
        
        <h2>How the metric works (brief public summary)</h2>
        
        <ul>
          <li><strong>Inputs → Pillars</strong>: Liquidity/Flows (35%), Momentum/Valuation (25%), Term Structure/Leverage (20%), Macro (10%), Social/Attention (10%).</li>
          <li><strong>Normalization</strong>: Winsorize tails → z-score vs history → apply direction (invert where "more = less risk") → logistic 0–100.</li>
          <li><strong>Smoothing</strong>: EWMA with configurable half-life; stale data excluded with weight re-normalization.</li>
          <li><strong>Transparency</strong>: Every input sourced, timestamped, and downloadable as CSV.</li>
        </ul>
      </div>
    </div>
  );
}
