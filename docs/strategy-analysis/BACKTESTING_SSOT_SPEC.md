# GhostGauge Strategy Analysis — Backtesting SSOT Design Spec

**Status:** The **`dca_vs_risk_comparison.json`** monthly strategy comparison path follows **SSOT v2** (see `scripts/etl/dca-vs-risk-strategy-comparison.mjs`). Other items in this doc (e.g. weekly script alignment) may still be **future work**.  
**Ground truth:** Repo `firemansghost/btc-risk-dashboard-V3`; regenerate comparison via `npm run etl:strategy-comparison`. **CI:** `.github/workflows/weekly-backtesting.yml` runs the same command weekly (after `etl:backtesting`) and commits `public/data/dca_vs_risk_comparison.json` when it changes.  
**Out of scope:** Official G-Score **composite** math — backtesting remains downstream of `history.csv`.

---

## 1. Current-state summary

### Artifacts (as implemented today)

| Artifact | Generator | Automation |
|----------|-------------|------------|
| `public/data/dca_vs_risk_comparison.json` | `scripts/etl/dca-vs-risk-strategy-comparison.mjs` | **Yes** — `.github/workflows/weekly-backtesting.yml` (`npm run etl:strategy-comparison`; weekly + manual dispatch) |
| `public/data/weekly_backtesting_report.json` | `scripts/etl/weekly-backtesting.mjs` (`npm run etl:backtesting`) | **Yes** — same workflow (weekly commit) |

### Shared input

- Both scripts read `public/data/history.csv` (`date`, `score`, `band`, `price_usd`), sorted by date.

### Methodology divergence (verified in code)

**Strategy comparison script (`dca-vs-risk-strategy-comparison.mjs`):**

- **Cadence:** Calendar-month loop; for each month, **closest row** to the 1st (not every Nth row).
- **Strategies:** Fixed **$1,000/mo** baseline DCA; risk-based uses **four mapped buckets** (`Begin Scaling In`, `Hold/Neutral`, `Begin Scaling Out`, `Increase Selling`) with multipliers **1.5 / 1.0 / 0.5 / 0**; collapses e.g. Moderate + Regular DCA → same bucket. **Value averaging** third strategy (ramped target, often **less capital** than full DCA).
- **Metrics:** Total return on invested capital; “Sharpe” / vol / max drawdown in generator are **trade-interval** constructs, **not** annualized textbook Sharpe.

**Weekly script (`weekly-backtesting.mjs`):**

- **Strategy block:** Samples **every 30th row** as “~monthly”; **six canonical bands** with **different** multipliers (e.g. Aggressive 1.5 … High Risk 0) after a **different** `mapHistoricalBands` (including legacy aliases to those six names).
- **Band block:** One “signal” per **row-day** in a band; forward **30d/90d** spot BTC returns — **descriptive / overlapping**, not independent strategy events.
- **`dataRange.totalDays`:** Row count (`historicalData.length`), not calendar-day span (UI has been clarified elsewhere).

### UI / docs (already true)

- Strategy Analysis uses **more than one source**; copy distinguishes snapshot vs weekly pipeline (`REPO_REONBOARD.md`, strategy-analysis components).
- Strategy Tester is **illustrative / preview**, not artifact-backed live backtest.
- No proven arithmetic bug was found in the methodology audit; issues are **divergence, provenance, labeling, interpretation**.

---

## 2. Problems with the current two-artifact model

1. **Two different “official-looking” percentage streams** (snapshot vs weekly summary) without a **single** named GhostGauge methodology — users can still mentally merge them.
2. **Incompatible strategy simulations:** Different monthly sampling, different band maps, different allocation tables — **not** interchangeable.
3. **Value averaging** as co-equal headline **% return** vs DCA: mathematically valid on **deployed** capital but **not** capital-comparable to equal monthly DCA.
4. **Band forward-return stats** are easy to read as “validation” of bands or thresholds; they are **regime-conditioned, overlapping observations** — research-y, not a clean OOS test of G-Score.
5. **Operational drift:** Weekly artifact updates in CI; comparison snapshot may **stale** unless someone regenerates and commits — provenance must stay explicit even after SSOT work.

---

## 3. Recommended SSOT backtesting scope (if GhostGauge adopts one canonical methodology)

### 3.1 Official purpose (priority order)

**Recommended ranking:**

1. **Educational / illustrative:** Show how simple **accumulation rules** behave against **historical G-Score bands and prices** — *not* proof that the score “predicts” returns.
2. **Transparency:** One clearly named methodology users can quote (“GhostGauge official accumulation backtest v…”) with documented limitations.
3. **Position-sizing narrative (secondary):** Rough sense of how **scaled contributions** by band differ from flat DCA — still not live trading advice.
4. **Explicitly *not* primary:** Validating or tuning **official G-Score thresholds** from these backtests alone — sample length and confounding rule choices are insufficient without a separate research program.

### 3.2 Official artifact set (recommendation)

| Role | Recommendation |
|------|----------------|
| **Canonical strategy comparison** | **One** published artifact + one generator path: baseline DCA vs risk-scaled DCA under **one** schedule, **one** band→allocation mapping aligned with **official band names** from `config/dashboard-config.json` (see §5). |
| **Band / monitoring** | **Separate** artifact (or clearly separated top-level sections in one file) for **descriptive** per-band forward returns / counts — labeled **monitoring / research**, not merged into strategy headline % as if the same experiment. |
| **Value averaging** | **Exploratory** or **secondary** — see §4. |

*Already true today:* Two files exist; **SSOT means naming which is canonical for “strategy %”** and demoting or isolating the other until aligned.

### 3.3 Official cadence (recommendation)

**Canonical:** **Calendar month + nearest available row** (or strictly **first row on/after** month start — pick one and document it).

**Why:** Matches user mental model of “monthly DCA,” is reproducible, and does not drift when `history.csv` gains or loses rows. **“Every N rows”** is fragile if row spacing changes.

*Note:* Current comparison script uses **closest** to the 1st; SSOT can keep that or switch to “first on/after” — decision should be explicit in a future ADR.

### 3.4 Official strategy set (recommendation)

| Strategy | SSOT role |
|----------|-----------|
| **Baseline DCA** | **Official** — fixed notional per execution date. |
| **Risk-based DCA** | **Official** — same schedule; allocation by **official six bands** and **one** published multiplier table (see §5). |
| **Value averaging** | **Exploratory** — keep in docs or a secondary panel with **equal-capital context** or clear “% on deployed capital only” framing; **not** a third headline % competing with DCA pair without caveats. |

### 3.5 Official risk-band mapping for backtesting (recommendation — no code change in this spec)

- **Labels:** Use the **same six band names** as live GhostGauge (`Aggressive Buying`, `Regular DCA Buying`, `Moderate Buying`, `Hold & Wait`, `Reduce Risk`, `High Risk`).

**Boundary-first rule (canonical backtest target):** When a numeric **score** is present on a row, the official backtest should derive that row’s band from **official SSOT score boundaries** — same ranges and **inclusive** min/max handling as live GhostGauge (e.g. `getBandForScore()` semantics against `config/dashboard-config.json`). The historical **`band` string in CSV** must **not** be the primary source of truth in that case; it is a **fallback** for legacy or incomplete rows (missing score), spot checks, or migration only. This keeps backtests aligned with SSOT and stops legacy label drift from sneaking in via “whatever was stored on the row.”

- **Legacy label strings:** Use only when score is unavailable or as an interim bridge; any **one** shared mapping helper for old strings → canonical names should converge on the same six labels SSOT already uses (future implementation).
- **Allocation multipliers:** Single SSOT table for **risk-based DCA** (example shape — numbers require product decision): monotonic scale from aggressive → high risk, zero or near-zero at **High Risk** if that matches product intent. **Do not** mix the current comparison script’s **four-bucket** collapse with the weekly script’s **six-band** table in one “official” story.

### 3.6 Metrics — official display (recommendation)

**Headline (safe, comparable for Baseline vs Risk-based DCA):**

- Total return **%** (same definition for both).
- Total invested, final value, total BTC.
- Trade count / execution dates span.

**Secondary (clearly labeled):**

- Max drawdown on **trade-date** portfolio value (not continuous).
- **Sharpe-like ratio** (mean/std of period returns between trades) — never implied to be **annualized** or **risk-free-adjusted** unless formally defined later.

**Exploratory / descriptive (not strategy headline):**

- Per-band forward 30d/90d **spot** returns, win rates — **“descriptive; overlapping days; not independent samples.”**

**Downgrade or avoid as headline:**

- VA **% return** without **side-by-side equal notional** or **dollar P/L** context.
- Any single number that mixes weekly pipeline % with snapshot % **before** methodology unification.

### 3.7 Remove or downgrade from headline treatment

- **Value averaging:** Keep available; **do not** feature as the hero “winner” on **% alone** without capital context (current UI has already softened this — SSOT formalizes “exploratory or secondary”).
- **Sharpe-like:** Secondary label + definition everywhere it appears; add **real** Sharpe only if you define annualization and risk-free rate (future).

---

## 4. Official vs exploratory boundaries

| Category | What belongs |
|----------|----------------|
| **Official** | One methodology statement; Baseline DCA + Risk-based DCA on **one** schedule; **one** band map + allocation table aligned with live band names; artifact **version** + `history.csv` date range; CI or documented release cadence for the **canonical** file. |
| **Exploratory** | Value averaging; alternative multipliers; experimental charts; anything using **overlapping** band-day forward returns as “performance.” |
| **Do not present prominently** | Side-by-side **%** from **ununified** artifacts; Strategy Tester **mock** numbers as if real; implying G-Score **threshold** tuning from these backtests. |

**Strategy Tester:** **Remain preview-only** (already true) until/unless it calls the same engine as the canonical artifact.

---

## 5. Recommended canonical methodology (conceptual — not wired in)

When implemented (future):

1. **Input:** `history.csv` for price and score; **derive band from score + SSOT boundaries** per §3.5 when score is present; use CSV `band` only as fallback when score is missing (not as primary when both exist).
2. **Schedule:** Monthly anchor per §3.3; document edge cases (missing month, partial history).
3. **Strategies:** Baseline + Risk-based only for **primary** JSON fields; VA optional extension with `_exploratory` or separate file.
4. **Outputs:** Semantic versioning (`methodologyVersion`, `artifactType: strategy_comparison | band_descriptive`).
5. **Weekly job:** Either generates **both** canonical strategy block + band block, or **only** updates band block — avoid two divergent strategy sims permanently.

---

## 6. Metric display recommendations (UI principles)

- **One** primary “Risk-based vs DCA” story per page section, tied to **one** artifact version.
- **Hero:** Prefer **pair** metrics (both under same rules) over a **third** strategy **%** unless exploratory section.
- **Glossary / disclosures:** Keep “Sharpe-like” definition **short** and repeated where the number appears (tooltip or footnote).
- **Mobile:** No extra dense tables; same hierarchy as desktop (headline → secondary → research).

---

## 7. Migration plan (small, reversible steps — not executed here)

| Step | Action | Risk |
|------|--------|------|
| **1** | Treat **this doc** + **ADR** in `docs/DECISIONS.md` (e.g. **2026-04-15** — GhostGauge strategy backtesting SSOT target state) as the decision record. | None (docs only). |
| **2** | **Choose** canonical methodology parameters (schedule, six-band table, VA placement) in a PR that **only** updates docs + maybe renames UI sections — still **two** artifacts until ETL aligns. | Low. |
| **3** | **Align one script** to SSOT (likely extend weekly job or comparison script — product choice); **deprecate** duplicate strategy % from the other in UI (banner: “legacy methodology — see weekly v2”). | Medium — requires testing and JSON compatibility strategy. |
| **4** | Add **CI** for canonical comparison JSON **or** commit policy (“weekly job writes both files”) so snapshot is not stale. | Operational. |
| **5** | Optional: rename JSON fields (`totalRows` vs `totalDays`) in a **versioned** artifact bump. | Low if versioned. |

**Principles:** PR-sized, revertible, no change to **G-Score** computation; backtesting remains **downstream** of `history.csv`.

---

## 8. Open questions / deferred decisions

- **Exact allocation multipliers** and **monthly execution rule:** **Decision-ready recommendations** are in [`SSOT_PRODUCT_DECISIONS.md`](SSOT_PRODUCT_DECISIONS.md) (lock before first SSOT ETL PR).
- Any residual product tweaks (e.g. conservative vs preferred multiplier curve) remain a **business** sign-off, not a spec gap.
- **Whether** band forward-return block stays in the **same** JSON file as strategy summary or splits for mental hygiene.
- **Whether** to add **equal-notional** VA or **dollar** outcomes for VA in exploratory UI.
- **Annualized Sharpe:** only if formally specified; otherwise keep Sharpe-like only.

---

## References (repo)

- `docs/strategy-analysis/SSOT_PRODUCT_DECISIONS.md` — recommended multipliers + monthly execution rule (product lock-in)
- `docs/DECISIONS.md` — ADR entry (2026-04-15) for SSOT target state (design only)
- `scripts/etl/dca-vs-risk-strategy-comparison.mjs`
- `scripts/etl/weekly-backtesting.mjs`
- `.github/workflows/weekly-backtesting.yml`
- `REPO_REONBOARD.md` — Strategy Analysis backtesting artifacts
- `config/dashboard-config.json` — official band definitions (SSOT for **live** labels)
- `lib/riskConfig.ts` — `getBandForScore()` semantics (inclusive boundaries) for alignment when implementing §3.5
