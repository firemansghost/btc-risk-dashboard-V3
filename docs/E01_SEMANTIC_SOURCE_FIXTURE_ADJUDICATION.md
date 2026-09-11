# E01 — Semantic / Source Fixture Adjudication

| Field | Value |
| --- | --- |
| Task | E01 |
| Status | Read-only adjudication. No fixtures or tests implemented. |
| Audited repository SHA | `c30d484cb0314d4a28a72372cb5a0cb255afcdc1` |
| Audit date | 2026-09-11 |
| Live H8 | Active (`h8-v2-prospective`). Frozen scientific and Stage-A identities control the live study. |

This document does **not** amend the H8 protocol, scientific fingerprint, model, or capture contract.

If this document conflicts with frozen executable H8 code or protocol artifacts, **those frozen artifacts control for the live H8 study**.

This pass does not repair R01, R02, or R03. It does not add tests that expect corrected behavior from the current frozen implementation. It does not inspect prospective scores, prices, or outcomes.

---

## Evidence classes

| Class | Meaning |
| --- | --- |
| **A. SOURCE FACT** | Objective upstream/source meaning independent of GhostGauge implementation. |
| **B. CURRENT FROZEN BEHAVIOR** | What the live frozen implementation actually does. Descriptive only. Not automatically the desired successor contract. |
| **C. SUCCESSOR INVARIANT** | A property corrected successor architecture should preserve without freezing implementation technique. |
| **D. SUCCESSOR DESIGN DECISION REQUIRED** | A future choice E01 does not have authority to freeze now. |

These four classes are not interchangeable. Characterization of current defects must not be labeled as a desired regression contract.

---

## Current test topology

Verified from `package.json` and `.github/workflows/tests.yml` at the audited SHA.

| Lane | Command | Runner | Discovery |
| --- | --- | --- | --- |
| Unit / Next-library | `npm test` → `vitest run` | Vitest | `lib/__tests__/*.test.ts` (and Vitest defaults) |
| ETL | `npm run test:etl` → `node --test scripts/etl/__tests__/*.test.mjs` | Node test runner | **Top-level** `scripts/etl/__tests__/*.test.mjs` only |
| Typecheck | `npm run typecheck -- --incremental false` | `tsc` | n/a |
| H8 contract | `node scripts/research/capture-h8-v2-prospective.mjs --contract-check` | CLI | explicit |
| E03 suite | `node --test scripts/admin/__tests__/h8-completeness-monitor.test.mjs` | Node test runner | explicit path in Tests workflow |
| E03 live | `node scripts/admin/h8-completeness-monitor.mjs` | CLI | explicit |
| Clean worktree | `git status --porcelain` must be empty | Tests workflow | `if: always()` |

R14 Tests workflow already runs all of the above after `npm ci`.

### `test:etl` discovery rule

`package.json` uses:

```text
node --test scripts/etl/__tests__/*.test.mjs
```

That glob is **non-recursive**. A new top-level file such as `scripts/etl/__tests__/semantic_source_units.test.mjs` **would be auto-discovered** by existing `npm run test:etl` and therefore by R14.

A support file under `scripts/etl/__tests__/fixtures/` would **not** be auto-run; it would be imported only.

**Finding:** future E01 fixture tests should require:

- **NO** `package.json` change
- **NO** `package-lock.json` change
- **NO** `tests.yml` change

unless a later implementation proves otherwise.

E03 tests are not part of `npm test` / `npm run test:etl`; the E03 suite is invoked explicitly by the Tests workflow. R14 does not invoke `scripts/research/__tests__/h8-v2-prospective-capture.test.mjs`; it runs the live H8 `--contract-check` CLI instead. Do not put E01 source semantics into E03 assurance or H8 capture/contract assurance.

There is currently **no** `scripts/etl/__tests__/fixtures/` directory.

---

## Test-layer classification for E01

### A. `scripts/etl/__tests__/*.test.mjs` — preferred future lane

- Already in R14 CI via `npm run test:etl`.
- Production-ETL adjacent.
- Another top-level `.test.mjs` needs no package/workflow change.

Distinguish:

| Safe during live H8 | Not safe during live H8 |
| --- | --- |
| Test-only source/semantic fixtures that do **not** require frozen code to already implement corrected semantics | Tests that import frozen scientific implementation and assert **corrected** R01/R02/R03 behavior |

Existing tests may import frozen modules as **historical/current coverage**. That is acceptable. New successor assertions against those same imports are not, if they would fail on frozen code and thereby demand a scientific change.

### B. `lib/__tests__/*.test.ts` — not the E01 home

This is the Vitest / Next-library layer. Using it for E01 would risk treating `lib/factors/**` (the dormant `/api/refresh` parallel scorer) as if it were the official Daily ETL scorer.

E07 already classified `lib/factors/**` vs `scripts/etl/factors.mjs` as **UNRESOLVED / not equivalent**. E01 does **not** make `lib/factors/**` semantic authority.

### C. H8 / admin tests — not a semantic-fixture home

Do not put E01 source-unit, ETF-identity, or Social-missingness fixtures into E03 or H8 `--contract-check` / capture-contract tests.

---

## Important current ETF test coupling

`scripts/etl/__tests__/etf_flows_source_cadence.test.mjs` imports `parseEtfFlowsFromHtml` from `scripts/etl/factors.mjs` (a **frozen** scientific file).

It currently covers:

- source cadence / publication timing / US-trading-day freshness;
- Total-row handling and pending Total behavior (synthetic HTML);
- some synthetic parsing of headers such as `Date, IBIT, FBTC, Total`.

It does **not** contain a targeted **FBTC vs BTC distinct-identity collision** fixture. Headers in that file include `FBTC` but no sibling `BTC` column, and there is no assertion that `btc` must resolve to a different index than `fbtc`.

That import is acceptable as current coverage. **Do not** add a corrected exact-symbol expectation against the frozen parser during live H8 if that expectation is known to fail.

---

## Existing Social test limitation

`scripts/etl/__tests__/social_interest_staleness.test.mjs` defines `mockComputeSocialInterest()` returning a hard-coded `score: 50` / `reason: "success"` object. It then tests:

- cache write includes `lastUpdated`;
- `getStalenessStatus()` TTL/grace windows.

It does **not** import or exercise `computeSocialInterest()`. It does **not** test provider-unavailable → numeric-neutral blending.

**Finding:** R03 actual missingness behavior is **not** covered by that test.

Note: that test writes under `public/data/cache/social_interest/` then unlinks. Future E01 fixtures must not write `public/` or `research/`.

---

## R01 — FRED source units / Net Liquidity

### SOURCE FACT

Independently recorded FRED series unit metadata (provenance only; not a CI network dependency):

| Series | FRED unit metadata | USD multiplier |
| --- | --- | --- |
| WALCL | Millions of U.S. Dollars | `1e6` |
| WTREGEN | Millions of U.S. Dollars | `1e6` |
| RRPONTSYD | Billions of U.S. Dollars | `1e9` |

References (documentation only):

- https://fred.stlouisfed.org/series/WALCL
- https://fred.stlouisfed.org/series/WTREGEN
- https://fred.stlouisfed.org/series/RRPONTSYD

These conversion facts are **SOURCE FACT**. They are not “whatever GhostGauge currently multiplies by.”

### CURRENT FROZEN BEHAVIOR

`scripts/etl/factors.mjs` `computeNetLiquidity()` applies `value * 1e6` to **WALCL, RRPONTSYD, and WTREGEN**, with comments that FRED returns millions. That common-`1e6` conversion is **not** desired successor behavior for RRPONTSYD.

This document does not calculate G-Score impact and does not inspect prospective H8 scores.

### SUCCESSOR INVARIANT

Corrected architecture must convert each series by its **source unit**, not by a single shared scale. WALCL/WTREGEN remain `1e6`; RRPONTSYD is `1e9`.

### SUCCESSOR DESIGN DECISION REQUIRED

None required for the unit-metadata table itself. How Net Liquidity combines WALCL − RRP − TGA after correct scaling is existing model structure; E01 does not reopen that formula.

### Future fixture shape (not implemented)

Declarative, network-free table. No live observation values.

Logical rows:

| series_id | source_unit | usd_multiplier |
| --- | --- | --- |
| WALCL | millions_usd | 1e6 |
| WTREGEN | millions_usd | 1e6 |
| RRPONTSYD | billions_usd | 1e9 |

Preferred home: `scripts/etl/__tests__/fixtures/` plus a top-level `scripts/etl/__tests__/semantic_source_units.test.mjs` discovered by existing `test:etl`.

The test should assert the **table**, not that frozen `computeNetLiquidity()` already uses `1e9` for RRP. Importing frozen code and expecting `1e9` would fail CI and become an implicit scientific-change demand.

Do **not** add a durable regression test that “RRPONTSYD must always use 1e6.”

---

## R02 — exact ETF ticker identity

### SOURCE FACT / SUCCESSOR INVARIANT

The upstream Farside Bitcoin ETF table has distinct columns for **FBTC** and **BTC**. They are different ETF identities and must not alias.

E01 does not freeze the entire changing provider schema. The required semantic fact is: **FBTC and BTC are distinct source identities**. Exact/normalized **token** identity is the requirement, not a particular parser technology (regex vs map vs DOM).

### CURRENT FROZEN BEHAVIOR

`parseEtfFlowsFromHtml()` in `scripts/etl/factors.mjs`:

- lowercases headers;
- `etfColumns` contains both `'fbtc'` and `'btc'` (`btc` last);
- resolution is `header.findIndex(h => h.includes(etf))`.

Because `"fbtc".includes("btc")` is true, a `btc` lookup can bind to an **FBTC** header. That is substring identity, not exact token identity.

Do not repair it in this PR.

### Existing test gap

No targeted FBTC-vs-BTC collision fixture in `etf_flows_source_cadence.test.mjs` (verified: no `'BTC'` sibling column / no collision assertion).

### Future fixture shape (not implemented)

Synthetic, deterministic headers. No live Farside call.

Preferred concept:

```text
Date | FBTC | BTC | Total
```

Expected semantic identity:

- FBTC → its own index
- BTC → a different index

A future test may assert that identity table, or exercise a **test-only** exact-token helper that is not production code. It must **not** call frozen `parseEtfFlowsFromHtml()` with an expectation that BTC ≠ FBTC until successor implementation exists.

Do not specify the production parser refactor here.

Do **not** add a durable test that “BTC must resolve to an FBTC header.”

---

## R03 — Social missingness

### CURRENT FROZEN BEHAVIOR

`computeSocialInterest()` in `scripts/etl/factors.mjs`:

- defaults `searchScore = 50` and `momentumScore = 50` (“neutral default”);
- official blend keys via `requireSubWeights` / `blendComponentScores` are `coingecko_trending_rank` (0.7) and `btc_price_momentum_7d` (0.3) from SSOT / `scripts/etl/lib/ssotSubweights.mjs`;
- volatility may be computed/displayed (`volatilityScore`) but is **not** one of the two official Social blend keys;
- comments in the function still mention 40%/35%/25% weights; those comments are **not** the official locked blend;
- if trending rank is absent, `searchScore` remains 50 and still enters the blend;
- if price history is absent or too short, `momentumScore` remains 50 and still enters the blend;
- the result-building path still sets `reason: "success"` and `status: "fresh"` when that numeric blend is produced;
- a thrown error in the outer `catch` can return `score: null` — that is a different path from silent component defaults.

This is descriptive. It is not desired successor semantics.

### SUCCESSOR INVARIANT

**Unavailable / missing / fetch error must not be silently represented as a genuine neutral observation.**

`missingness ≠ evidence of neutral signal`

Do not assign future factor scores for missing/error cases in fixtures.

### SUCCESSOR DESIGN DECISION REQUIRED

No existing decision ledger in-repo resolves successor treatment. E01 does **not** choose among:

- exclude the entire Social factor;
- exclude or reweight the missing component;
- prefer eligible stale cache;
- preserve last valid observation;
- return null;
- some explicit degraded status vocabulary.

### Future fixture matrix (not implemented)

State table, not scores:

| input_state | may_be_treated_as_observed_neutral? |
| --- | --- |
| trending available / price available | (observed path; not a missingness case) |
| trending missing / price available | NO |
| trending available / price missing | NO |
| both missing | NO |
| trending fetch error | NO |
| price fetch error | NO |
| both fetch error | NO |

Do not prescribe reweight/exclusion logic in that table.

Do **not** add a durable test that “missing Social input must equal numeric 50.”

---

## Three future fixture classes

This taxonomy is appropriate for later E01 implementation:

| Class | Role |
| --- | --- |
| **SOURCE CONTRACT FIXTURE** | Objective upstream metadata/identity. Deterministic. Network-free in CI. |
| **SUCCESSOR SEMANTIC FIXTURE** | Desired invariant for corrected architecture. Must not be run as “frozen code already complies” unless it actually does. |
| **CURRENT-FROZEN CHARACTERIZATION** | Describes existing behavior only. Not a desired future contract. Add only if a later migration PR specifically needs it. |

E01 prefers documenting current frozen behavior **in this adjudication** rather than adding CI tests that bless known defects.

---

## Preferred safety property

Future E01 implementation should:

- live **outside** all 13 frozen scientific identities;
- live **outside** all four Stage-A identities;
- make **no** package/lockfile changes;
- make **no** workflow changes;
- make **no** network calls in CI;
- write **nothing** to `public/` or `research/`;
- perform **no** H8 outcome access;
- **not** require current frozen code to pass corrected successor semantics.

If a proposed fixture cannot satisfy these properties, it is **successor / post-H8** work.

---

## Preferred storage (not created)

| Path | Role |
| --- | --- |
| `scripts/etl/__tests__/fixtures/` | JSON/tables imported by tests; not auto-discovered |
| `scripts/etl/__tests__/semantic_source_units.test.mjs` | R01 table assertions |
| `scripts/etl/__tests__/semantic_etf_identity.test.mjs` | R02 identity assertions |
| `scripts/etl/__tests__/semantic_social_missingness.test.mjs` | R03 state-matrix assertions |

---

## Implementation sequencing (not implemented)

One concern per future PR. All three can remain tests/fixtures-only if they do not import frozen production code for corrected assertions.

| Future PR | Concern | Likely scope | Imports frozen production code? | `test:etl` picks it up? | Package/workflow change? | H8 risk |
| --- | --- | --- | --- | --- | --- | --- |
| **E01-A** | R01 source-unit fixture/spec | `scripts/etl/__tests__/semantic_source_units.test.mjs` + `fixtures/` | **No** for successor assertions | Yes, if top-level `.test.mjs` | No | Safe during H8 if it does not call `computeNetLiquidity()` with 1e9 expectations |
| **E01-B** | R02 exact ETF identity fixture/spec | `scripts/etl/__tests__/semantic_etf_identity.test.mjs` + `fixtures/` | **No** for successor assertions (do not assert against frozen `parseEtfFlowsFromHtml`) | Yes | No | Safe during H8 as a source-identity spec |
| **E01-C** | R03 missingness-state fixture/spec | `scripts/etl/__tests__/semantic_social_missingness.test.mjs` + `fixtures/` | **No**; no scores; no `computeSocialInterest()` successor expectations | Yes | No | Safe during H8 as a state invariant spec |

Corrected **production** behavior for R01/R02/R03 remains **deferred** (post-H8 / separate scientific change). None of E01-A/B/C should modify frozen code.

---

## Parallel scorer

`app/api/refresh/route.ts` still contains unused `buildLatest()` using `lib/factors/**`. E01 does **not** validate that path. Canonical semantic authority for successor architecture is Daily ETL (`scripts/etl/factors.mjs` and SSOT), not the dormant parallel scorer. Equivalence remains unproven and is out of scope.

---

## H8 availability watch (not E01)

Recent administrative E03 `CAPTURE_MISSING` / provider-availability misses do **not** authorize:

- relaxing capture rules;
- substituting observations;
- changing the ETF parser;
- changing frozen scoring code.

E01 is future semantic-assurance architecture only.

---

## Evidence table

| Risk | Objective source fact? | Current frozen behavior proven? | Successor invariant clear? | Successor design choice remains? | Safe fixture possible during H8? | Can use existing `test:etl` lane? | Requires production code change now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R01** | Yes — FRED unit metadata (WALCL/WTREGEN millions; RRPONTSYD billions) | Yes — all three series use `* 1e6` in `computeNetLiquidity()` | Yes — convert by source unit (`1e9` for RRP) | No for unit table | Yes — metadata table, no live values, no frozen-code assertion | Yes | **No** |
| **R02** | Yes — FBTC and BTC are distinct Farside columns | Yes — `h.includes(etf)` can alias BTC onto FBTC | Yes — exact token identity; no aliasing | Parser technique deferred | Yes — synthetic headers; do not assert frozen parser already complies | Yes | **No** |
| **R03** | Partial — missingness is a model/product semantic, not an external unit fact | Yes — defaults 50/50 still blend; `success`/`fresh` | Yes — missing/error ≠ genuine neutral observation | Yes — exclude / reweight / stale cache / null / degraded status | Yes — state matrix with `may_be_treated_as_observed_neutral? = NO`; no scores | Yes | **No** |

High-level adjudication (supported by repository evidence):

- **R01:** source fact unambiguous; safe source fixture possible; corrected production behavior deferred.
- **R02:** source identity fact unambiguous; safe synthetic identity fixture possible; corrected production parser deferred; existing ETF tests do not cover the collision.
- **R03:** current defect behavior proven; invariant “missing ≠ neutral” is clear; exact successor treatment unresolved; safe state fixture/spec possible if it does not prescribe a score; existing Social staleness test does not cover actual missingness; corrected production behavior deferred.
- **Test lane:** `scripts/etl/__tests__` preferred; no package/workflow change required; future fixtures should not couple corrected expectations directly to frozen `factors.mjs` until successor implementation.
