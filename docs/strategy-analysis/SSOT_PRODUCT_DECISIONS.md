# SSOT backtesting — product decisions (recommendations)

**Status:** Decision-ready **recommendations** for implementation prep — **not** implemented in ETL/JSON/UI.  
**Grounding:** `config/dashboard-config.json` (band order and score ranges), `scripts/etl/weekly-backtesting.mjs`, `scripts/etl/dca-vs-risk-strategy-comparison.mjs`, `docs/strategy-analysis/BACKTESTING_SSOT_SPEC.md`.

---

## 1. Context (already in repo)

- **Six official bands** (low score → more accumulation-friendly; high score → more caution), ranges in SSOT:  
  Aggressive Buying (0–14) → … → High Risk (80–100).
- **Weekly script** already uses a **six-band** multiplier table (`1.5` … `0`) with calendar-agnostic sampling (`i += 30`).
- **Comparison script** uses **four** collapsed buckets and **closest-to-1st** monthly rows — SSOT intends to replace this split with one methodology.

---

## 2. Recommended official six-band multiplier table (preferred)

**Rule:** Multipliers apply to a **fixed base monthly notional** (e.g. $1,000). **Higher G-Score band ⇒ lower multiplier** — monotonic, plain English: *“scale monthly buys down as the score moves into more cautious bands.”*

| Band | Multiplier | Rationale |
|------|------------|-----------|
| **Aggressive Buying** | **1.5×** | Deepest value / washed-out regime in product language; modest **upweight** vs baseline — not “all-in,” still monthly discipline. |
| **Regular DCA Buying** | **1.0×** | **Baseline** — same as flat DCA; the reference users already understand. |
| **Moderate Buying** | **0.75×** | Still accumulating, but **less** than baseline as conditions are less favorable. |
| **Hold & Wait** | **0.5×** | **Half** pace — “hold core; don’t force full checks” without going to zero. |
| **Reduce Risk** | **0.25×** | **Minimal** adds while trimming risk in narrative; keeps simulation continuous. |
| **High Risk** | **0×** | **No new buys** this month — aligns with “crowded tape / disorderly” language; no hyperactive trading, just off. |

**Why this table:** It matches the **existing weekly backtest** allocation block, so adopting it as SSOT **minimizes surprise** for anyone comparing old weekly headlines to v1 official methodology, avoids inventing a new curve without need, and stays **monotonic** with clear user-facing story.

**Plain-English line for UI/docs:** *“Each month we apply your base amount times a band multiplier: more when the score is in greener bands, less as it moves toward red, and zero new buys in High Risk.”*

---

## 3. Conservative alternate (optional product choice)

Use if you want **less aggression** in the lowest band and a **slightly tighter** curve (still monthly, still not day-trading):

| Band | Multiplier |
|------|------------|
| Aggressive Buying | **1.25×** |
| Regular DCA Buying | **1.0×** |
| Moderate Buying | **0.70×** |
| Hold & Wait | **0.45×** |
| Reduce Risk | **0.20×** |
| High Risk | **0×** |

**Tradeoff:** Flatter headline difference vs baseline DCA in backtests; may feel more “conservative product” at the cost of a weaker narrative contrast in Aggressive.

---

## 4. Recommended monthly execution rule

### Options considered

| Rule | Pros | Cons |
|------|------|------|
| **Closest row to calendar 1st** | Already used in comparison script; symmetric around target date | Can select a row **in the prior month** if early-month data missing — odd for “January contribution” |
| **First row on or after the 1st** | **Always in the intended calendar month**; matches “this month’s buy”; easy to explain | If data starts mid-month historically, first month may be thin — acceptable |
| **Every N rows** | Simple index | **Not** recommended for SSOT — breaks when row cadence changes |

### **Recommendation: first row on or after the 1st of each month**

- **User intuition:** “We invest on the first available day in that month at or after the 1st.”
- **Reproducibility:** Deterministic given sorted `history.csv`.
- **Robustness:** No pull-back into the previous month; gaps only shorten which day fires, not which month.
- **Implementation:** One pass per month: `min({ row.date | row.date >= monthStart })` in ISO date order; if **no row** in that month, **skip** that month for **both** baseline and risk-based (fair comparison).

**Explicit non-goal:** This does not fix missing prices or stale scores — only **which row** anchors the monthly trade.

---

## 5. Pressure-test (tradeoffs)

**What this improves**

- One **published** multiplier curve + one **published** date rule → SSOT can be quoted without “which script?” ambiguity.
- Monthly cadence stays **accumulation-sized**, not intraday theater.

**What it does not solve**

- Past performance ≠ future; bands are **not** proof of predictive power.
- **Boundary-first band** from score (per main SSOT spec) must still be implemented — multipliers assume **correct band** per row.

**What users may still misunderstand**

- **% return** differences between risk-based and DCA are **rule-dependent**, not “GhostGauge is right/wrong.”
- **0×** in High Risk is **model discipline**, not personal financial advice.

**Keep labeled in UI post-implementation**

- Base notional, multiplier table version, monthly rule name, `history.csv` date range, **educational / illustrative** disclaimer (existing trust language).

---

## 6. Next implementation task (later — not in this doc)

**First SSOT ETL PR:** Implement **one** canonical generator that (1) uses **first row on or after** the 1st, (2) assigns band from **score + SSOT boundaries** when score exists, (3) applies the **preferred multiplier table** above for Risk-Based DCA vs flat baseline, (4) writes a **versioned** artifact and deprecates or clearly labels the legacy dual-artifact strategy block until removed.

---

## References

- `docs/strategy-analysis/BACKTESTING_SSOT_SPEC.md`
- `docs/DECISIONS.md` (2026-04-15 SSOT target-state ADR)
- `config/dashboard-config.json` — `bands[]`
- `scripts/etl/weekly-backtesting.mjs` — `allocationMultipliers` (matches **preferred** table)
