# GhostGauge History UI Provenance & Presentation Review

**Date:** 2026-08-18  
**Phase:** H2 — review / design only  
**Audited `origin/main`:** `3b392e1568ec101eba43939a56f872275dbe2ca5`  
**Branch:** `review/h2-history-ui-provenance`  
**Status:** Design record. Not an implementation. Calibration gate remains **CLOSED**.

Companion records (authoritative for provenance; not reopened here):

- [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)
- [`docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md`](HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md)
- [`docs/MODEL_ERAS.md`](MODEL_ERAS.md)

Labels used below:

- **FACT** — verified from current source, current `history.csv`, or H1/H1.1 records
- **INFERENCE** — reasonable reading of current behavior, not independently user-tested in a browser for this phase
- **RECOMMENDATION** — proposed H2.1 product/engineering choice

---

## 1. Executive verdict

**FACT.** The Historical G-Score card fetches `public/data/history.csv` directly, filters by 30D / 90D / 180D / 1Y (default **90D**), then draws an EWMA-smoothed (`α = 0.1`) line. The tooltip shows only that smoothed `composite`. There is no provenance classification, no gap encoding, and no model-era marker.

**FACT.** At the H2 snapshot date **2026-08-18**, 30D / 90D / 180D display only the observational tail (from 2025-09-27). **1Y is the only current range that includes reconstructed Grade C rows** (current-file dates through 2025-09-26).

**FACT.** Because smoothing runs after range selection, 1Y EWMA **begins on reconstructed rows**. The first observational displayed values are therefore partially determined by reconstructed history. This is **CROSS-PROVENANCE DISPLAY CONTAMINATION**. It does not change stored official scores. It does change the line and tooltip inside the observational era.

**FACT.** The tooltip never shows the raw G-Score. On the 30D view, the official 2026-08-17 print is **G47**; the chart tooltip shows **53**. That is a display-truth defect even without reconstructed data.

**RECOMMENDATION.** Adopt **Option B**: observational history as the default trust surface; legacy reconstruction available only behind an explicit control; never a single unmarked mixed series. Show **raw G-Score as the primary series**, with EWMA only as a secondary trend that **resets** at the provenance boundary and at the verified Aug 16 / Aug 17 model-era boundary. Leave `public/data/history.csv` unmodified. Do not start calibration. Do not build a Git-recovered dataset in H2.1.

---

## 2. Current implementation map

### 2.1 Where the History UI lives

**FACT.**

| Surface | Role |
|---|---|
| `app/components/RealDashboard.tsx` | Parent card. Heading **“Historical G-Score”**. Renders `<HistoryChart />` inside a glass card, lazy-loaded (`delay={500}`). Comment documents a prior mobile overflow when an outer `h-[260px]` clipped the caption. |
| `app/components/HistoryChart.tsx` | Entire chart implementation: fetch, range buttons, Recharts `AreaChart`, caption. Inner title **“Risk History”**. |
| `lib/historyChartCsv.ts` | Parse / range-filter / EWMA. |
| `lib/__tests__/historyChartCsv.test.ts` | Parser, range filter (fake clock), EWMA smoke test. |

**FACT.** `HistoryChart` is the only React consumer of `parseGScoreHistoryCsv` / `filterHistoryByRange` / `smoothHistoryScores`. No Next.js API route transforms `history.csv` for this chart.

**FACT.** Other mentions are not this chart:

- `app/alerts/page.tsx` — prose that band-change alerts compare `history.csv` to `latest.json` (documentation copy, not a chart).
- `app/components/FactorHistoryModal.tsx` — factor-level history via `/api/factor-history/...` from `factor_history.csv` (diagnostic; Grade D sample prefix still present per H1). Out of H2.1 scope except as a related misleading-history surface.
- ETL / backtest scripts read `public/data/history.csv` on the server. They are not user-facing chart code.

### 2.2 Fetch path

**FACT.** `HistoryChart` loads:

```text
GET /data/history.csv?ts=<Date.now()>
cache: 'no-store'
```

Next serves `public/data/history.csv` as a static file. `next.config.ts` also sets `Cache-Control: public, max-age=0, must-revalidate` on `/data/:path*`. There is no rewrite and no server-side reshape.

### 2.3 Parse contract

**FACT.** `parseGScoreHistoryCsv` reads `date,score,band,price_usd`. Each point is:

- `date`, `score`, `band`, `price_usd`
- `composite` — **alias of raw `score` at parse time**

Invalid / missing scores are skipped. Dates are kept as `YYYY-MM-DD` strings.

### 2.4 Range controls

**FACT.**

| Control | Key | Default |
|---|---|---|
| 30D | `'30d'` | no |
| 90D | `'90d'` | **yes** (`useState('90d')`) |
| 180D | `'180d'` | no |
| 1Y | `'1y'` | no |

No “All”. Range change does not refetch; it refilters in-memory.

**FACT.** Pipeline order in `useMemo`:

1. `filterHistoryByRange(data, range)`
2. `smoothHistoryScores(filtered, 0.1)`

Range filtering occurs **before** smoothing. Hypothesis C is confirmed.

### 2.5 Range-filter clock semantics

**FACT.** `filterHistoryByRange` does:

```ts
const now = new Date();
const cutoff = new Date(now);
// 30d/90d/180d: cutoff.setDate(now.getDate() - N)
// 1y: cutoff.setFullYear(now.getFullYear() - 1)
return points.filter((p) => new Date(p.date) >= cutoff);
```

**FACT.** `YYYY-MM-DD` parsed by `new Date(p.date)` is UTC midnight. `cutoff` keeps the viewer’s local time-of-day. On this review machine (America/Chicago, UTC−5/−6), a row whose date **equals** the local cutoff calendar date is **excluded**, because `2026-07-19T00:00:00.000Z` is earlier than `2026-07-19T17:00:00.000Z`.

**FACT.** At local 23:59:59 on 2026-08-18, 30D also dropped **2026-07-20** (29 rows instead of 30). Late local time can exclude both the nominal cutoff date **and** the following calendar date.

This is a **range-filter precision issue**, separate from provenance. The existing unit test freezes `2026-06-15T12:00:00.000Z` and therefore does not lock date-only semantics.

### 2.6 Smoothing

**FACT.** EWMA `α = 0.1`:

- first point: raw `score`
- later: `α * score + (1 − α) * previousSmoothed`
- every output `composite` is `Math.round(...)`

**FACT.** Return type is `{ date, composite }[]` only. Raw `score`, `band`, and `price_usd` are dropped before render.

### 2.7 Chart / tooltip / axis

**FACT.**

- Recharts `AreaChart` `data={pretty}` where `pretty` is smoothed.
- `XAxis dataKey="date"` with no `type="number"` / `scale="time"` / `dataKey` timestamp. Dates behave as **categories**.
- `YAxis domain={[0, 100]}`.
- `Area type="monotone" dataKey="composite"` — monotone interpolation between successive available rows. No `connectNulls` override; no nulls are inserted anyway, so the line **always** bridges whatever rows survived filtering.
- Default `Tooltip` — payload is `{ date, composite }`. Users see the smoothed rounded number, labeled `composite`. Band and price are not in the payload.

**INFERENCE.** A reasonable user reads the tooltip as “the G-Score that day.”

### 2.8 Caption / titles / mobile

**FACT.** Inner caption:

> Daily official G-Score from history.csv (EWMA-smoothed display).

Hypothesis E is confirmed.

**FACT.** Two titles exist: parent **Historical G-Score** and inner **Risk History**. Range buttons are a single horizontal row (`gap: 8px`, `padding: 4px 12px`). Plot height is `h-[260px]`. Caption is 12px gray under the plot.

**INFERENCE.** Four range buttons plus a provenance legend plus a boundary note will wrap or crowd on ~390px unless stacked. H2.1 must treat disclosure as a wrapping block, not a second dense toolbar.

### 2.9 Provenance / missing dates today

**FACT.** Current UI has:

- no reconstructed vs observed split
- no Sep 26 / Sep 27 marker
- no Aug 16 / Aug 17 marker
- no gap geometry
- no mention that history is mixed provenance

---

## 3. Current trust/presentation defects

Defects below are **display** defects. They do not authorize rewriting `history.csv`.

1. **Unmarked mixed series (1Y).** **FACT.** Eligibility already says the current chart is **YES** only as an honestly labeled mixed chart; otherwise **NO**. 1Y currently draws reconstructed and observational rows as one green area.
2. **False “official / daily” caption.** **FACT.** Caption says “Daily official G-Score from history.csv.” H1 established the file is mixed provenance and not a complete daily panel. “Official” is reserved for separately established observations (e.g. frozen Aug 16 / Aug 17).
3. **Tooltip ≠ observation.** **FACT.** Tooltip is rounded EWMA, not raw score. 30D 2026-08-17: raw **47**, tooltip **53**.
4. **CROSS-PROVENANCE DISPLAY CONTAMINATION (1Y).** **FACT.** See §5.
5. **CROSS-ERA DISPLAY CONTAMINATION (all current ranges).** **FACT.** 30D/90D/180D/1Y at this snapshot all include 2026-08-16 G54 and 2026-08-17 G47. EWMA blends that implementation boundary. 30D tooltip for Aug 17 is **53**, not **47**.
6. **Gaps look like consecutive days.** **FACT.** Category X axis + monotone `Area` + no nulls. A 22-day hole (2025-10-07..28) is one short chord on 1Y.
7. **Sep 26 current-file G85.** **FACT.** If 1Y is shown, the reconstructed High Risk 85 is drawn as if it were the contemporaneous print. Contemporaneous committed artifact is `e9083962` G47. H2 must not substitute that recovery; it must not present G85 as observed either.
8. **`composite` naming.** **FACT.** Parse-time alias of raw score is overwritten by smoothed output under the same key.
9. **Wall-clock range filter.** **FACT.** Same “90D” control is not a stable calendar-date window.

---

## 4. Range-by-range provenance analysis

**H2 snapshot rule.** Counts below freeze local noon **2026-08-18 12:00 America/Chicago** (`2026-08-18T17:00:00.000Z`), matching this review host and the spirit of the existing noon-based unit test. Latest `history.csv` row: **2026-08-18**.

**FACT.** Reconstructed current-file region: `date <= 2025-09-26` (731 rows in file). Observational tail: `date >= 2025-09-27` (293 rows through 2026-08-18).

**FACT.** Under current code, the nominal cutoff **calendar date is excluded** in America/Chicago because UTC-midnight parse `<` local-noon cutoff. Earliest displayed row is therefore the **next** existing observation after that date.

### 4.1 30D

| Item | Value |
|---|---|
| Cutoff instant | 2026-07-19 12:00 local (`2026-07-19T17:00:00.000Z`) |
| Cutoff local date row | **exists** (`2026-07-19`) but **excluded** (precision issue) |
| Earliest displayed row | **2026-07-20** |
| Latest displayed row | **2026-08-18** |
| Observations | **30** |
| Calendar span first→last | 30 days |
| Missing dates in that span | **0** |
| Grade C reconstructed rows | **none** |
| Entirely observational? | **yes** |
| Smoothing crosses provenance? | **no** |
| Smoothing crosses verified model-era boundary? | **yes** (Aug 16 / Aug 17) |

### 4.2 90D (default)

| Item | Value |
|---|---|
| Cutoff instant | 2026-05-20 12:00 local |
| Cutoff local date row | **exists** (`2026-05-20`) but **excluded** |
| Earliest displayed row | **2026-05-21** |
| Latest displayed row | **2026-08-18** |
| Observations | **87** |
| Calendar span first→last | 90 days |
| Missing dates in that span | **3**: 2026-05-25, 2026-06-01, 2026-06-20 |
| Grade C reconstructed rows | **none** |
| Entirely observational? | **yes** |
| Smoothing crosses provenance? | **no** |
| Smoothing crosses verified model-era boundary? | **yes** |

### 4.3 180D

| Item | Value |
|---|---|
| Cutoff instant | 2026-02-19 12:00 local (CST) |
| Cutoff local date row | **exists** (`2026-02-19`) but **excluded** |
| Earliest displayed row | **2026-02-20** |
| Latest displayed row | **2026-08-18** |
| Observations | **170** |
| Calendar span first→last | 180 days |
| Missing dates in that span | **10**: 2026-03-06, 2026-03-29, 2026-03-30, 2026-04-04, 2026-04-05, 2026-04-06, 2026-04-12, 2026-05-25, 2026-06-01, 2026-06-20 |
| Grade C reconstructed rows | **none** |
| Entirely observational? | **yes** |
| Smoothing crosses provenance? | **no** |
| Smoothing crosses verified model-era boundary? | **yes** |

### 4.4 1Y

| Item | Value |
|---|---|
| Cutoff instant | 2025-08-18 12:00 local |
| Cutoff local date row | **exists** (`2025-08-18`, reconstructed) but **excluded** |
| Earliest displayed row | **2025-08-19** (reconstructed) |
| Latest displayed row | **2026-08-18** |
| Observations in view | **332** = **39 reconstructed** + **293 observational** |
| Calendar span first→last | 365 days |
| Missing dates in that span | **33** (all in the observational tail; reconstructed 2025-08-19..2025-09-26 is contiguous 39/39) |
| Grade C reconstructed rows | **yes** (2025-08-19 through 2025-09-26, including current-file Sep 26 **G85**) |
| Entirely observational? | **no** |
| Smoothing crosses provenance? | **yes — CROSS-PROVENANCE DISPLAY CONTAMINATION** |
| Smoothing crosses verified model-era boundary? | **yes** |

**FACT.** 1Y is the **only** current control that can include reconstructed data at this snapshot. That is not an architectural guarantee forever: as wall-clock time moves, 1Y’s cutoff moves. Do not encode “1Y always mixes” as a permanent rule; encode **date classification**.

**INFERENCE.** After ~2026-09-27, a 1Y window would no longer reach 2025-09-26, and reconstruction would drop out of 1Y **even with zero UI work**. That is not a reason to skip H2.1: the unmarked mix exists now, and “All” / longer ranges would revive it.

---

## 5. EWMA analysis

### 5.1 Does 30D / 90D / 180D smoothing consume only observational-tail rows?

**FACT. Yes**, at this H2 snapshot. Their earliest displayed dates are all after 2025-09-27.

They still smooth **across the verified model-era boundary**.

### 5.2 Does 1Y EWMA begin on reconstructed rows?

**FACT. Yes.** First 1Y point at this snapshot: 2025-08-19 reconstructed score 48. Last reconstructed point in the window: 2025-09-26 current-file **G85**. First observational point: 2025-09-27 raw **G75**.

Measured 1Y EWMA (α = 0.1, then round):

| Date | Provenance | Raw score | Displayed `composite` |
|---|---|---|---|
| 2025-09-26 | reconstructed | 85 | 59 |
| 2025-09-27 | observational | 75 | **61** |
| 2025-09-28 | observational | 77 | 62 |
| 2025-10-06 | observational | 61 | 60 |
| 2025-10-29 | observational | 57 | 59 |

**FACT.** The first observational displayed value is **61**, not 75. If EWMA reset at the provenance boundary, 2025-09-27 would display **75**.

Name: **CROSS-PROVENANCE DISPLAY CONTAMINATION.**

### 5.3 How long does reconstructed influence persist?

EWMA remaining weight of the pre-boundary state after *k observational steps* is `(1 − α)^k = 0.9^k`.

| k (observation steps, not calendar days) | Residual weight |
|---|---|
| 1 | 0.90 |
| 7 | 0.48 |
| 11 | 0.31 |
| 22 | 0.098 |
| 44 | 0.010 |
| 66 | 0.001 |

**FACT.** The observational tail has a **22-calendar-day** hole (2025-10-07..28) immediately after 2025-10-06. EWMA does not decay on missing calendar days; it decays only when the next **row** arrives. 2025-10-29 is only the **11th** observational step after Sep 26, so residual reconstructed state is still ~**31%**.

**Do not** invent a hard “contamination ends on date X.” Influence is asymptotic and **observation-indexed**. By 2025-12-11 residual is ~0.3%; by 2026-08 the right edge is not meaningfully reconstructed-weighted. The harm is concentrated in **early observational 1Y segments**, which is exactly where a user inspecting the provenance join would look.

### 5.4 Tooltip belief risk

**FACT.** Tooltip shows only rounded EWMA under the key `composite`.

**INFERENCE.** Users can believe the smoothed number was the published G-Score. Combined with the caption’s “official G-Score,” this is the highest-frequency honesty failure (it affects **every** range, every hover).

---

## 6. Missing-date analysis

**FACT.** H1: observational tail is an observation set, not a complete calendar panel. Through 2026-08-18: 293 / 326 dates; 33 gaps listed in inventory Appendix A. Missing date = **NO COMMITTED HISTORY OBSERVATION** unless independently proven. H2 does not classify those gaps as ETL failures.

### 6.1 Are missing dates visually obvious?

**FACT. No.** There are no markers, breaks, or axis holes.

### 6.2 Is horizontal spacing proportional to elapsed calendar time?

**FACT. No.** Category `XAxis`: each surviving row is one equal slot.

### 6.3 Does the line bridge multi-day gaps?

**FACT. Yes.** `Area type="monotone"` connects successive rows. The Oct 2025 22-day hole is one interpolated chord.

### 6.4 Could a user infer there was a score every day?

**INFERENCE. Yes**, especially on 30D (which happens to be contiguous at this snapshot) and on 90D (three single-day holes that look like ordinary steps). The caption currently reinforces “Daily.”

### 6.5 Implementation options

| Option | Honesty | Complexity | Mobile | Notes |
|---|---|---|---|---|
| **A. Continuous time axis** | High | Medium | Ticks must be sparse | True elapsed-time gaps. Best geometry. Requires numeric timestamps, not category strings. |
| **B. Null points + `connectNulls={false}`** | High for line breaks | Medium | Fine | Must **not** invent scores. Insert `{ date, score: null }` for missing calendar days in the **displayed** interval only. Dense 22-day null runs can flatten the axis if still categorical; better with A. |
| **C. Segmented series** | High | Medium | Fine | Split into contiguous runs; multiple `Area`s. Provenance split is a special case. |
| **D. Caption warning only** | Low–medium | Low | Best | Does not stop the line from looking continuous. Insufficient as the only 1Y treatment. |

**RECOMMENDATION.** H2.1: **C for provenance** (observed vs reconstructed as separate series) plus **D always** (plain-language gap sentence). Prefer **A** (time scale) in the same phase if cheap; if not, keep category axis for H2.1 but **do not** fill gaps with interpolated “daily” implication in copy. Do not silently insert scores. A later pass can add time-scale + visual breaks for long holes (especially Oct 2025) without changing artifacts.

---

## 7. Product-option comparison

### Option A — Full mixed history, visually distinguished

Continue showing reconstructed + observed in one chart, different styling, boundary marker, legend.

| Criterion | Assessment |
|---|---|
| Trust / honesty | Better than today; still invites reading one story |
| Visual complexity | Medium |
| Mobile | Boundary + two styles + four ranges is tight |
| Implementation | Medium |
| Historical context | Preserved |
| Misunderstanding risk | User still sees G85 on Sep 26 as “the line” |
| Future Git-recovered series | Awkward: reconstructed region should eventually be *replaced*, not restyled |

### Option B — Observational by default, legacy reconstruction optional

Default trust surface = observational tail only. Explicit “Legacy reconstructed context” control. Distinct style. Never silently combined.

| Criterion | Assessment |
|---|---|
| Trust / honesty | **Highest among single-chart options** |
| Visual complexity | Low by default; extra only when requested |
| Mobile | Default stays simple; toggle + note can wrap |
| Implementation | Medium (toggle + classification helper) |
| Historical context | Available, not forced |
| Misunderstanding risk | Lowest if 1Y default is observed-only and caption explains the start date |
| Future Git-recovered series | Clean: observed source can widen without changing the toggle model |

### Option C — Observational only, no toggle

Hide reconstruction in UI; keep it in git/docs.

| Criterion | Assessment |
|---|---|
| Trust / honesty | High |
| Visual complexity | Lowest |
| Mobile | Best |
| Implementation | Low |
| Historical context | Lost in-product |
| Misunderstanding risk | 1Y will not span a year; users may think data is missing/broken unless copy is excellent |
| Future Git-recovered series | Compatible, but throws away a labeled-context path |

### Option D — Separate charts

“Observed G-Score History” and “Legacy Reconstruction.”

| Criterion | Assessment |
|---|---|
| Trust / honesty | High |
| Visual complexity | High (two plots) |
| Mobile | Poor in the current card |
| Implementation | High |
| Historical context | Explicit |
| Misunderstanding risk | Low if titled well |
| Future Git-recovered series | Compatible but heavy |

### Verdict

**RECOMMENDATION: Option B.**

Reasons:

- Default 90D is already observational; Option B matches what most users already see, while **fixing 1Y**.
- Eligibility forbids an unlabeled mixed chart; Option A still presents one visual object.
- Option C is acceptable later if the toggle is unused, but 1Y without explanation looks like a product bug.
- Option D does not fit the current homepage card.

H1 Grade letters, merge SHAs, and `e9083962` stay in docs — not in the toggle label.

---

## 8. Recommended UX

**RECOMMENDATION.**

1. **Default series:** observational points from current `history.csv` with `date >= 2025-09-27`, then range-filtered.
2. **Default range:** keep **90D**.
3. **1Y without legacy toggle:** show only observational points in the 1Y window. Caption must say observed history begins Sep 27, 2025, so a full observed year does not yet exist.
4. **Legacy toggle:** `Show legacy reconstruction` (off by default). When on **and** the selected range includes dates `<= 2025-09-26`, draw that prefix as a separate, visually weaker series (e.g. gray/dashed, lower opacity). When on but the range is 30/90/180 at this snapshot, do **not** auto-switch range; show a one-line note: “Legacy reconstruction is earlier than this range. Choose 1Y to view it.”
5. **Do not add All** in H2.1. If added later, it must still default to observed-only.
6. **Primary line:** raw G-Score. **Secondary:** EWMA trend, reset at provenance and at the verified model-era boundary (§9, §11).
7. **Do not** backfill missing dates. Do not connect reconstructed to observed as one `Area`.
8. **Sep 26 in current file:** if shown via toggle, it is legacy reconstruction (G85 in this file). Do not silently plot Git G47 in H2.1.
9. Unify titles: keep parent **Historical G-Score**; drop or demote inner **Risk History** so the card does not claim two different things.

---

## 9. Recommended data/provenance architecture

**FACT.** H2 must leave `public/data/history.csv` as-is. Do not delete reconstructed rows to simplify UI.

**RECOMMENDATION.** Separate **DATA PROVENANCE** from **VISUAL PRESENTATION**.

```text
history.csv  (forensic mixed file, unchanged)
        │
        ▼
 classifyCurrentHistoryCsv(date)     ← testable helper, not JSX magic dates
        │
        ├─ reconstructed: date <= 2025-09-26
        └─ observed:      date >= 2025-09-27
        │
        ▼
 presentation adapter (range, toggle, smoother resets, optional future source)
        │
        ▼
 HistoryChart series + tooltip + caption
```

**Future Git-recovered observational series** (not built in H2/H2.1):

- New artifact, for example `public/data/history_observed.csv` or `public/data/history_observed.json`.
- Naming preference: **`history_observed`** — explicit, not “canonical” until a migration decision exists.
- That source would classify contemporaneous Git prints (from 2025-09-15, with Sep 26 = G47) as observed, and would **not** use current-file G85.
- Chart should depend on `HistoryPointSource { id, points, classify(date) }` so swapping/extending the observed source does not restyle the chart from scratch.
- Until that artifact exists, the observed presentation series is simply the current-file tail.

Do not put Grade B/C, SHAs, or merge hashes in UI.

---

## 10. Tooltip / caption copy

User-facing language: plain English. No Grade letters, no commit hashes.

### 10.1 Tooltip (H2.1)

**RECOMMENDATION.** Keep it short:

```text
Sep 27, 2025
G-Score 75
Increase Selling          ← historical band label as stored; not a current-model claim
BTC $109,367              ← omit if price is null
Observed                  ← or “Legacy reconstruction”
Trend 61                  ← only if EWMA overlay is visible; never instead of G-Score
```

If the date is 2026-08-17 or later (verified v1.1.1):

```text
Aug 17, 2026
G-Score 47
Moderate Buying
Observed · v1.1.1
```

If the date is 2026-08-16 (last verified v1.1):

```text
Aug 16, 2026
G-Score 54
Hold & Wait
Observed · last v1.1 print
```

Do **not** stamp “v1.1” on every pre-Aug-17 row. v1.1 start is unverified.

Band labels are historical strings from `history.csv`. **INFERENCE:** some older labels may not match current band maps. Tooltip should not say “official band under today’s rules.” If space is tight, omit band before omitting provenance.

### 10.2 Caption / labels

**RECOMMENDATION.**

| Slot | Copy |
|---|---|
| **A. Chart title** | Historical G-Score |
| **B. Primary caption** | Observed G-Score prints. Days without a print are left blank — they are not filled in. The trend line is a display aid, not the published score. |
| **C. Reconstructed-history label** | Legacy reconstruction (not published at the time) |
| **D. Observed-history label** | Observed history |
| **E. Provenance boundary marker** | Observed history begins Sep 27, 2025 |
| **F. Optional help** | Earlier values in this file are a later reconstruction. They are shown only if you turn on legacy reconstruction, and only for context. |
| **1Y observed-only note** | Observed history starts Sep 27, 2025, so this 1Y view cannot yet show a full year of observed prints. |
| **Legacy toggle (off, short range)** | Legacy reconstruction is earlier than this range. Choose 1Y to view it. |
| **Model-era marker label** | Scoring implementation changed Aug 17, 2026. The Aug 16→17 move is not a pure market reading. |

Do not use: “as-published history.csv,” “Grade C,” “a02a1a56,” “e9083962,” “official daily series.”

---

## 11. Model-era boundary treatment

Two different boundaries:

| Boundary | Dates | Meaning |
|---|---|---|
| **Provenance** | 2025-09-26 / 2025-09-27 | reconstructed current-file prefix vs observational tail |
| **Verified model-era** | 2026-08-16 / 2026-08-17 | last verified v1.1 vs first verified v1.1.1 |

**FACT.** v1.1 methodology start remains unverified. Do not invent historical era coloring for 2025-12-11 or any other unlabeled start.

**RECOMMENDATION: C — mark both, with different visual weight.**

- **Provenance** (stronger, only when reconstructed series is actually drawn): region contrast + the Sep 27 caption/marker. If the toggle is off, **do not** clutter 90D with a Sep 2025 line that is off-screen.
- **Model-era** (light, whenever the window includes Aug 16 and Aug 17 — currently every range): one vertical reference at 2026-08-17 (or a point marker), short label “Implementation change,” tooltip note as in §10. This is the least cluttered way to stop Aug 16 G54 → Aug 17 G47 being read as a seven-point market crash on the **default 90D** chart.

**Not recommended:** D (disclosure only) — the default chart already contains the era jump. **Not recommended:** labeling a long “v1.1 era” band before Aug 16.

---

## 12. H2.1 implementation plan

Narrow UI honesty pass. No ETL. No artifact mutation. No calibration. No Git-recovered dataset.

### 12.1 Likely files

| File | Change |
|---|---|
| **NEW** `lib/historyProvenance.ts` | Classification contract, series split, smoother reset, date-only range cutoff helper if not kept in `historyChartCsv.ts` |
| **NEW** `lib/__tests__/historyProvenance.test.ts` | §13 cases |
| `lib/historyChartCsv.ts` | Date-only range filter; smoothing must retain raw `score` / `band` / `price_usd`; optional segmented smooth |
| `lib/__tests__/historyChartCsv.test.ts` | Boundary-date semantics; raw preserved through smooth |
| `app/components/HistoryChart.tsx` | Dual series, toggle, tooltip, caption, era marker, a11y |
| `app/components/RealDashboard.tsx` | Only if parent title/caption must stop duplicating inner “Risk History” |

No `public/data/**`, `public/signals/**`, `config/**`, workflows, or ETL scripts.

### 12.2 Provenance classification contract

```ts
export const CURRENT_HISTORY_RECONSTRUCTED_THROUGH = '2025-09-26';
export const CURRENT_HISTORY_OBSERVED_FROM = '2025-09-27';
export const VERIFIED_V11_LAST_DATE = '2026-08-16';
export const VERIFIED_V111_FIRST_DATE = '2026-08-17';

export type HistoryProvenance = 'reconstructed' | 'observed';
export type VerifiedModelEra = 'v1.1-last' | 'v1.1.1+' | 'unclassified';

classifyCurrentHistoryCsvDate(date: string): HistoryProvenance
classifyVerifiedModelEra(date: string): VerifiedModelEra
```

`unclassified` covers observational dates before Aug 16 and is **not** labeled v1.1 in UI.

### 12.3 UI behavior

- Fetch path unchanged: `/data/history.csv` + `no-store`.
- Default range 90D; controls unchanged (no All).
- Default: observed series only.
- Toggle: `Show legacy reconstruction` (`aria-pressed`).
- Raw score primary `Area`/`Line`; EWMA secondary dashed, **reset** when provenance changes and when crossing `VERIFIED_V111_FIRST_DATE`.
- Tooltip custom renderer per §10.
- Caption per §10.
- Range filter: compare `YYYY-MM-DD` strings to a **UTC date-only** cutoff derived from a frozen “today” (prefer latest history row date or `latest.json` `snapshot_date` if already in memory; otherwise UTC date of `new Date()`). Include the cutoff date. Document in tests.

### 12.4 Chart-series behavior

- Two data keys or two Recharts series: `observedScore`, `reconstructedScore` (null where not applicable).
- Do not use a single monotone path across 2025-09-26 → 2025-09-27.
- Do not fabricate points for Appendix A gaps.
- Optional H2.1 stretch: `scale="time"` so Oct 2025 is visually wide. If deferred, caption must still deny “daily complete.”

### 12.5 Accessibility

- Range buttons: `aria-pressed`.
- Toggle: labeled, keyboard-accessible, not icon-only.
- Tooltip values available to keyboard (Recharts default is hover-weak; at minimum caption states raw vs trend).
- Boundary text in the DOM, not color-only (reconstructed vs observed must not rely on green vs gray alone).
- Contrast on gray reconstructed stroke against the glass card.

### 12.6 Mobile

- Stack: title → ranges → chart → caption → toggle/help.
- Do not place four ranges + toggle on one row.
- Caption wraps; avoid `whitespace-nowrap` on disclosure.
- Keep plot height ~260px; do not reintroduce outer clip (`RealDashboard` comment).
- Era marker label may be chart-only on small screens if the caption already contains the Aug 17 sentence when the window includes that date.

---

## 13. H2.1 test contract

No production tests are changed in H2. Required for the **future** H2.1 PR:

1. **Sep 26** in current-history-csv classifier → `reconstructed`.
2. **Sep 27** → `observed`.
3. **1Y** at frozen 2026-08-18 includes reconstructed dates only when legacy toggle is on; default 1Y excludes `<= 2025-09-26`.
4. **No smoothing carry across provenance:** first observed EWMA after reset equals raw Sep 27 score (before rounding identity).
5. **No smoothing carry across model-era** unless a documented opt-in exists (H2.1 default: reset). First v1.1.1 EWMA point equals raw Aug 17 score.
6. **Tooltip / presentation point** retains raw `score`; smoothed value is a separate field.
7. **Missing dates not fabricated:** filter+present never invents 2026-06-20 or 2025-10-15.
8. **Range-filter boundary-date:** with frozen `2026-08-18`, 30D **includes** `2026-07-19` if that row exists (date-only), unlike current wall-clock code.
9. **30/90/180 at H2 snapshot** (frozen 2026-08-18 noon or date-only): observed-only; zero reconstructed points.
10. **Aug 16 / Aug 17** era classifier: last v1.1 vs v1.1.1+; no v1.1 start invented for 2025-12-11.
11. **Legacy toggle:** off → no reconstructed series in chart data; on + 1Y → reconstructed points present and not merged into observed key.
12. **Copy/a11y smoke:** reconstructed vs observed labels exist in accessible text when reconstructed is shown; caption readable without color.

Keep the existing production-schema parse test. Add fake-timer tests; do not call live APIs.

---

## 14. Explicit non-goals

H2 and H2.1 must **not**:

- modify `public/data/history.csv` or any other artifact
- substitute `e9083962` G47 into the chart
- build `history_observed.*`
- run `etl:compute`, dispatch Daily ETL, or call live market APIs
- start calibration or retune weights/bands
- extend `MODEL_ERAS` backward
- freeze a v1.1 start date
- treat missing dates as failures
- rewrite Factor History modal (separate file, Grade D prefix — later phase)
- redesign the backtesting UI
- add an All range
- claim Git existence proves Vercel served the file

Calibration gate: **CLOSED**.

---

## 15. Open questions

1. **Range “today” source.** Date-only UTC from wall clock vs last `history.csv` date vs `latest.json` `snapshot_date`. **RECOMMENDATION leaning:** last committed history date when loaded, so SSR/client and timezones do not reshuffle the window.
2. **Time-scale axis in H2.1 vs follow-up.** Honesty vs Recharts churn. Leaning: try time scale in H2.1; fall back to caption + series split if layout regresses.
3. **EWMA on by default** as a thin secondary line vs hidden until “Show trend.” Leaning: secondary visible, tooltip leads with raw (Option C smoothing).
4. **Band strings** for reconstructed / old observational rows — show as “label at the time” vs omit. Leaning: show when present, no “official today” wording.
5. **Factor History modal** honesty pass — out of H2.1, but it can still mislead. Track as H2.2 candidate.
6. **When a Git-recovered observed series exists**, should the legacy toggle remain (current-file reconstruction) or disappear? Leaning: remain until a migration retires the forensic prefix from presentation sources.

---

## Smoothing recommendation (summary)

**RECOMMENDATION: C** — raw G-Score primary, EWMA secondary.

Not A (today’s EWMA-as-the-chart fails tooltip truth and both boundaries).  
Not D (readability on 180D/1Y still benefits from a trend, if reset and labeled).  
B (optional overlay) is acceptable if C is too busy on mobile; then default raw-only on small viewports.

If smoothing remains anywhere:

- no EWMA state across provenance
- no EWMA state across the verified Aug 16 / Aug 17 era boundary unless intentionally disclosed (H2.1: reset, do not disclose a blended trend)
- tooltip distinguishes raw observation from trend
