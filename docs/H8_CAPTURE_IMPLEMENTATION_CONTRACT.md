# H8 Capture Implementation Contract

**Date:** 2026-08-20
**Phase:** H8 — capture implementation contract
**Status:** `IMPLEMENTATION CONTRACT CANDIDATE — NOT YET ACCEPTED`
**Proposed contract version:** `h8-capture-implementation-contract-v1`
**H8_CAPTURE_CONTRACT_VERSION:** `h8-capture-implementation-contract-v1`
**Branch:** `research/h8-capture-implementation-contract`
**Parent main HEAD at candidate creation:** `737cdce75e4c7e0f94b6268f502a2439943b5a7c`

This document specifies the **future machinery** that will prospectively capture already-frozen H8 evidence. It does **not** change H8 scientific methodology. Independent review of `f0095daf5dfd1737ce2531466d1d471698bc739b` approved the core contract design. This amendment records pre-freeze implementation / provenance hardening only. Capture code does **not** yet exist. `H8_CAPTURE_CONTRACT_SHA` is **not** assigned. `H8_CAPTURE_SOURCE_SHA` is **not** assigned.

Do **not** write a future freeze-commit SHA into this document. The Git commit that later freezes accepted contract bytes becomes `H8_CAPTURE_CONTRACT_SHA` only after independent review and an explicit freeze.

Labels used below:

- **FACT** — inherited from frozen H8 protocol identities or current production workflow/config at parent main
- **CANDIDATE IMPLEMENTATION DECISION** — proposed capture machinery; not accepted until independent review freezes this contract
- **FIREWALL** — a prohibition that is not open to casual weakening
- **LIMITATION** — a bound on what later capture implementation may do even after this contract is accepted

---

## 0. Frozen scientific protocol identity

**FACT.** The H8 scientific protocol is frozen, merged, and closed to methodology changes.

| Item | Value |
|---|---|
| H8 protocol status | `FROZEN / MERGED / CLOSED TO METHODOLOGY CHANGES` |
| `H8_PROTOCOL_VERSION` | `h8-prospective-three-model-v1` |
| `H8_PROTOCOL_SHA` | `85fb5bcbdb5c6d04333a3a9516629851efd890eb` |
| Frozen protocol tree | `2ceb039369be4ffba914384362963f0e91d71069` |
| Frozen protocol document | `docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md` |
| Frozen protocol document Git blob | `41594c82ab9d837fee4a5e894b3d2ed419d68bc9` |
| Frozen protocol document SHA256 | `b4776e7abc28b0e78d7d857627f737e91b5265013aee69ad17480a2863e9d5d7` |
| Current main at contract-candidate creation | `737cdce75e4c7e0f94b6268f502a2439943b5a7c` |
| `H8_CAPTURE_SOURCE_SHA` | `NOT YET ASSIGNED` |
| H8 observations | `ZERO` |
| H8 performance results | `NONE` |
| Calibration | `CLOSED` |

**FIREWALL.** This contract must **not** edit the frozen protocol document. Any scientific methodology change requires a new H8 protocol version.

**FIREWALL.** The implementation must **not** make new scientific decisions. It must mechanically implement the frozen protocol.

---

## 1. Purpose

**CANDIDATE IMPLEMENTATION DECISION.** The later capture implementation must mechanically implement:

- frozen model identities
- frozen score formulas
- common eligibility
- Official integrity check
- immutable prospective score observations
- immutable prospective BTC close artifacts
- deterministic automatic close catch-up
- fixed study dates
- fixed recovery dates
- provenance
- fail-closed model/capture identity verification

**FIREWALL.** The implementation must contain **no**:

- MACE calculation
- Spearman calculation
- rank calculation
- return calculation
- performance comparison
- tuning
- calibration
- model selection

---

## 2. Frozen scientific dates

**FACT / CANDIDATE IMPLEMENTATION DECISION.** Copy the frozen protocol dates exactly.

Observation window:

```text
2026-08-24 through 2027-02-19 inclusive
= 180 UTC observation opportunities
```

Required BTC close universe:

```text
2026-08-24 through 2027-03-21 inclusive
```

Automatic close-capture recovery may occur only during authorized first-attempt scheduled runs whose UTC run date is:

```text
T <= 2027-03-29
```

**FIREWALL.**

- no score observation before `2026-08-24`
- no score observation after `2027-02-19`
- no H8 close before `2026-08-24`
- no H8 close after `2027-03-21`
- no new H8 close artifact after the authorized `2027-03-29` UTC scheduled opportunity

---

## 3. Current Daily ETL workflow facts

**FACT.** Current workflow at parent main:

```text
path                         = .github/workflows/daily-etl.yml
git blob SHA                 = f2103048d384749310432eee610dffad2dad0f4f
label                        = PRE-H8 CAPTURE WORKFLOW BASELINE
cron                         = 0 11 * * *
triggers                     = schedule, workflow_dispatch
concurrency.group            = etl
concurrency.cancel-in-progress = false
```

**FACT.** Daily ETL currently serializes all ETL runs with:

```yaml
concurrency:
  group: etl
  cancel-in-progress: false
```

**CANDIDATE IMPLEMENTATION DECISION.** Stage A must preserve this concurrency behavior. H8 must not weaken or remove that serialization.

A `workflow_dispatch` ETL and scheduled ETL must not execute concurrently and race over `public/data/latest.json` or `public/data/btc_price_history.csv` during H8 capture.

The future accepted workflow must continue using the single ETL concurrency group with `cancel-in-progress: false` unless a separately reviewed implementation amendment proves an equivalent serialization mechanism.

Current sequence:

1. checkout with `fetch-depth: 0`
2. Node `20.18.0`
3. `npm ci`
4. `npm run etl:compute`
5. status / logging
6. configure git
7. stage production artifacts (`public/data`, `public/signals`, `public/extras`, `public/alerts`)
8. commit
9. `git pull --rebase origin main`
10. fallback merge if rebase fails
11. push retry loop

**FACT.** A scheduled ETL artifact commit can be rebased onto a later `main` before it is pushed.

**CANDIDATE IMPLEMENTATION DECISION.** `source_base_git_sha` / `github_sha` must identify the **original scheduled-run source checkout** used to calculate the scores. It must **not** be rewritten to the later rebased daily artifact commit SHA.

**FIREWALL.** This contract pass does **not** edit `.github/workflows/daily-etl.yml`.

---

## 4. Authorized future implementation files

**CANDIDATE IMPLEMENTATION DECISION.** The later implementation phase is narrowly scoped. Authorize the implementation candidate to change or create **only**:

1. `.github/workflows/daily-etl.yml`
2. `scripts/research/capture-h8-prospective.mjs`
3. `scripts/research/lib/h8-prospective-capture-core.mjs`
4. `scripts/research/lib/h8-prospective-capture-io.mjs`
5. `scripts/research/__tests__/h8-prospective-capture.test.mjs`

**FIREWALL.** Do **not** modify `package.json` merely to add a script alias unless independent review later finds a concrete reason.

The workflow can directly execute:

```text
node scripts/research/capture-h8-prospective.mjs --capture
```

**FIREWALL.** No production model-contract file may change.

**FIREWALL.** If implementation genuinely requires another runtime file: **STOP**. Report why. Do not silently expand scope.

---

## 5. Two-stage capture-source freeze

**FACT.** A Git commit cannot contain its own future SHA.

**FIREWALL.** Do **not** solve this using:

- a placeholder later rewritten inside the frozen implementation
- a mutable GitHub repository variable as scientific identity
- current `HEAD` as the capture-source identity
- a floating branch or tag
- an environment secret

### 5.1 Stage A — implementation source commit

**CANDIDATE IMPLEMENTATION DECISION.** The future implementation candidate will contain:

- accepted workflow change
- capture CLI
- capture core
- capture IO
- synthetic tests

but **no**:

```text
research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt
```

After independent implementation review accepts exact Stage-A bytes, assign the immutable Stage-A commit SHA as:

```text
H8_CAPTURE_SOURCE_SHA
```

### 5.2 Stage B — activation commit

**CANDIDATE IMPLEMENTATION DECISION.** After `H8_CAPTURE_SOURCE_SHA` is assigned, create a separate activation commit whose only new scientific-control file is:

```text
research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt
```

Exact contents:

```text
<H8_CAPTURE_SOURCE_SHA>\n
```

Exactly:

- 40 lowercase hexadecimal characters
- plus one LF
- 41 bytes total
- no CR
- no spaces
- no additional lines

The activation commit must **not** modify any Stage-A implementation file.

**FIREWALL.** The activation commit is **not** `H8_CAPTURE_SOURCE_SHA`. It only activates the already-frozen source identity.

The implementation branch containing Stage A + Stage B is then independently verified and merged before the first study observation.

**FIREWALL.** Do **not** assign `H8_CAPTURE_SOURCE_SHA` during this contract-candidate pass.

---

## 6. Runtime capture-source verification

**CANDIDATE IMPLEMENTATION DECISION.** Real `--capture` mode must require `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` to exist.

Read and strictly parse it. Require:

- exactly 41 bytes
- exactly one 40-character lowercase Git SHA
- final LF
- no CR
- no spaces
- no additional lines

Let `captureSourceSha` = contents without LF.

Require:

```text
git cat-file -e <captureSourceSha>^{commit}
captureSourceSha is an ancestor of current checkout HEAD
```

**FIREWALL.** Do **not** require `HEAD == captureSourceSha` after activation, because routine daily artifact commits will advance `main`.

Runtime must verify both committed Git identity **and** actual working-tree bytes. Git `HEAD:path` identity is necessary but not sufficient, because the implementation executes working-tree bytes.

For Stage-A runtime files:

```text
.github/workflows/daily-etl.yml
scripts/research/capture-h8-prospective.mjs
scripts/research/lib/h8-prospective-capture-core.mjs
scripts/research/lib/h8-prospective-capture-io.mjs
```

require all of:

1. `HEAD` Git blob identity equals `<captureSourceSha>:<path>`
2. worktree file exists and is a normal file
3. worktree file is not a symlink
4. `git hash-object <path>` equals the expected frozen Git blob
5. no staged modification exists for that path

If any current runtime blob or worktree byte differs from the corresponding frozen Stage-A identity:

```text
STOP BEFORE WRITES.
No observation.
No close artifact.
```

The synthetic test file should be recorded in implementation acceptance provenance but need not be a runtime dependency.

---

## 7. Frozen H8 protocol verification at runtime

**CANDIDATE IMPLEMENTATION DECISION.** Hard-code / freeze in implementation:

```text
H8_PROTOCOL_VERSION = h8-prospective-three-model-v1
H8_PROTOCOL_SHA     = 85fb5bcbdb5c6d04333a3a9516629851efd890eb
Frozen protocol document blob = 41594c82ab9d837fee4a5e894b3d2ed419d68bc9
```

Before real capture require:

- `H8_PROTOCOL_SHA` is an ancestor of current `HEAD`
- current `docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md` Git blob equals exactly `41594c82ab9d837fee4a5e894b3d2ed419d68bc9`
- worktree file exists, is a normal file, is not a symlink
- `git hash-object` of that path equals `41594c82ab9d837fee4a5e894b3d2ed419d68bc9`
- no staged modification exists for that path

If mismatch: **STOP BEFORE WRITES**.

---

## 7.1 Frozen capture-contract identity at runtime

**CANDIDATE IMPLEMENTATION DECISION.** After this contract is frozen and merged, Stage-A implementation must know and hard-code:

```text
H8_CAPTURE_CONTRACT_VERSION = h8-capture-implementation-contract-v1
H8_CAPTURE_CONTRACT_SHA     = <assigned only after this contract is frozen>
Frozen contract document Git blob = <assigned only after this contract is frozen>
```

Do **not** invent those SHA/blob values in this candidate document. They are supplied to Stage A only after this contract is frozen.

The Stage-A runtime `--contract-check` / `--capture` identity checks must verify:

- `H8_CAPTURE_CONTRACT_SHA` exists as a commit
- it is an ancestor of the current checkout
- current `docs/H8_CAPTURE_IMPLEMENTATION_CONTRACT.md` Git blob equals the exact frozen contract-document blob
- worktree file exists, is a normal file, is not a symlink
- `git hash-object` of that path equals the frozen contract-document blob
- no staged modification exists for that path

If mismatch: **STOP BEFORE WRITES**.

---

## 8. Scientific model-contract runtime fingerprint

**CANDIDATE IMPLEMENTATION DECISION.** Before **any** H8 write, verify the frozen scientific model-contract fingerprint against the current scheduled-run checkout, using the exact frozen protocol identities.

| Path | Identity | Value |
|---|---|---|
| `config/dashboard-config.json` | blob | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` |
| `lib/config-loader.mjs` | blob | `8f439254ca813050703a7c17bcd658474c19e2b2` |
| `scripts/etl/compute.mjs` | blob | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` |
| `scripts/etl/factors.mjs` | blob | `e9fd06df79967f0041a901e2dd971b771e669b03` |
| `scripts/etl/stalenessUtils.mjs` | blob | `1c213b9b8eb659c9cda22d0834694ae3239eb768` |
| `scripts/etl/marketCalendar.mjs` | blob | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` |
| `scripts/etl/adjustments.mjs` | blob | `36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7` |
| `scripts/etl/coinGeckoCache.mjs` | blob | `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff` |
| `scripts/etl/priceHistory.mjs` | blob | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` |
| `scripts/etl/fetch-helper.mjs` | blob | `da8ca2b441088f2e13364249e7ecbbed40dc22a4` |
| `scripts/etl/factors/` | tree | `3921332c0decd56800e78580183931b718b9a345` |
| `scripts/etl/lib/` | tree | `64c73c01db27f1e6dbcd12d45d08c2f12bc47b12` |

Also verify authoritative production configuration byte SHA256:

```text
config/dashboard-config.json SHA256 =
712a6d138b7e58dee3e325ec2740044aad2a7a80fe027a8f3e3fef294ac3b57a
```

For every frozen **individual** scientific file in the table above, require all of:

1. `HEAD` Git blob identity equals the expected frozen blob
2. worktree file exists and is a normal file
3. worktree file is not a symlink
4. `git hash-object <path>` equals the expected frozen Git blob
5. no staged modification exists for that path

For frozen scientific directories `scripts/etl/factors/` and `scripts/etl/lib/`, require **both**:

- `HEAD` tree identity equals the frozen tree SHA
- no tracked or untracked worktree difference exists inside that directory

An untracked file inside a frozen scientific directory must **not** silently pass. The exact shell/Node implementation can be decided in Stage A, but the contract requirement is: **actual scientific/runtime bytes executed by the run must match the frozen identities**.

**FIREWALL.** If **any** scientific fingerprint check differs: **STOP BEFORE ALL H8 WRITES**, including BTC-close writes. Do not silently continue. Do not classify compatibility automatically. A later explicit compatibility review is required. H8 capture is blocked; ordinary production ETL artifact handling continues (§11 production isolation).

**FIREWALL.** Routine `public/data` changes are **not** fingerprint changes.

---

## 9. Source-checkout identity

**CANDIDATE IMPLEMENTATION DECISION.** Real capture must receive GitHub operational provenance explicitly from the workflow. Pass at least:

```text
H8_GITHUB_RUN_ID        = ${{ github.run_id }}
H8_GITHUB_RUN_ATTEMPT   = ${{ github.run_attempt }}
H8_GITHUB_EVENT_NAME    = ${{ github.event_name }}
H8_GITHUB_SHA           = ${{ github.sha }}
H8_GITHUB_WORKFLOW_REF  = ${{ github.workflow_ref }}
```

The capture program must also run `git rev-parse HEAD` **before** the daily artifact commit.

Require:

```text
git rev-parse HEAD == H8_GITHUB_SHA
```

If mismatch: **STOP BEFORE WRITES**.

The frozen H8 observation later records this original `source_base_git_sha` even if the resulting artifact commit is subsequently rebased onto a newer `main` before push.

---

## 10. Real capture event gate — defense in depth

**CANDIDATE IMPLEMENTATION DECISION.** Workflow gate:

```text
if: github.event_name == 'schedule' && github.run_attempt == 1
```

The capture CLI itself must independently enforce the same rule. Require in real `--capture` mode:

```text
GITHUB_ACTIONS == true
H8_GITHUB_EVENT_NAME == schedule
H8_GITHUB_RUN_ATTEMPT == 1
valid numeric H8_GITHUB_RUN_ID
40-character lowercase H8_GITHUB_SHA
```

**FIREWALL.** No real capture from:

- `workflow_dispatch`
- GitHub rerun
- Refresh
- API
- local run
- developer shell
- test run

**FIREWALL.** There must be **no** `--date`, `--force`, `--backfill`, `--output-dir`, `--overwrite`, `--event`, `--run-attempt`, `--manifest-path`, or other CLI option that permits a human to make real capture eligible.

---

## 11. CLI modes

**CANDIDATE IMPLEMENTATION DECISION.** Future CLI supports exactly two conceptual modes.

### 11.1 `--contract-check`

READ-ONLY. No H8 artifact write.

May validate:

- frozen protocol identity
- frozen capture-contract identity
- scientific fingerprint
- capture runtime file structure
- working-tree scientific/runtime cleanliness
- current input schemas
- workflow static structure

The exact read-only candidate-source argument name is frozen as:

```text
--candidate-source-sha <Stage-A commit SHA>
```

It is allowed **only** with `--contract-check`.

Before `H8_CAPTURE_SOURCE_SHA` exists, `--contract-check --candidate-source-sha <Stage-A SHA>` is the source-anchored review check. It must require:

```text
HEAD == supplied candidate Stage-A SHA
```

and validate current Stage-A runtime blobs / worktree bytes against that exact commit.

After Stage-B activation / merge, ordinary `--contract-check` must read `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` and must **reject** `--candidate-source-sha`.

**FIREWALL.** `--candidate-source-sha` must **not** be accepted in `--capture` mode.

### 11.2 `--capture`

REAL CREATE-ONLY MODE.

Requires activated `H8_CAPTURE_SOURCE_SHA.txt`.
Requires GitHub scheduled first attempt.
Uses fixed repository paths.
No date / output override.

### 11.3 No default mode

**FIREWALL.** Calling the CLI with no mode must fail without writes.

---

## 12. Single capture-run timestamp

**CANDIDATE IMPLEMENTATION DECISION.** At the beginning of a real authorized `--capture` invocation, capture exactly one UTC timestamp:

```text
capture_run_utc = new Date().toISOString()
T               = UTC calendar-date portion of capture_run_utc
```

Use this single value consistently for the invocation.

```text
capture_created_utc  = capture_run_utc   (score observation)
captured_at_utc      = capture_run_utc   (close artifacts created by that invocation)
```

**FIREWALL.** Do not call the clock separately for each created file. This prevents a run crossing UTC midnight midway through writing from changing its date semantics.

---

## 12.1 Same-run ETL temporal marker

**CANDIDATE IMPLEMENTATION DECISION.** Immediately **before** `npm run etl:compute`, the workflow must capture one UTC timestamp:

```text
H8_ETL_STARTED_UTC
```

using an ISO-8601 UTC timestamp generated on the runner. It must be exported to subsequent H8 steps.

**FIREWALL.** The value must not be operator supplied. The value must not be accepted as a CLI override.

During real `--capture` require `H8_ETL_STARTED_UTC` is a valid UTC timestamp, and:

```text
H8_ETL_STARTED_UTC <= latest.json -> as_of_utc <= capture_run_utc
```

If not: **BLOCK H8 CAPTURE FOR THAT INVOCATION**. No H8 writes. Do not rewrite timestamps. Do not substitute an earlier `latest.json`.

This rule, together with preserved `concurrency.group = etl`, establishes that the H8 observation is tied to the current scheduled ETL invocation rather than an earlier manual or scheduled artifact.

Record `etl_started_utc` in each future score observation. It may also be stored in BTC-close provenance; score observation provenance is required.

---

## 13. Observation input authority

**CANDIDATE IMPLEMENTATION DECISION.** Observation scientific input comes from the post-ETL `public/data/latest.json` produced by the **same** scheduled ETL invocation.

Compute `latest_artifact_sha256` from the exact bytes after `npm run etl:compute` and before capture.

Strictly require from same-run `public/data/latest.json`:

- `latest.json` parses as JSON
- `ok == true`
- `as_of_utc` is a valid offset-aware UTC timestamp
- `model_version == "v1.1.1"`
- `implementation_revision == "integrity-2026-08"`

From verified frozen `config/dashboard-config.json` strictly require:

- `model_version == "v1.1.1"`
- `implementation_revision == "integrity-2026-08"`
- `ssot_version == "2.1.1"`

Also require:

```text
latest.model_version == config.model_version
latest.implementation_revision == config.implementation_revision
```

Record:

```text
production_model_version              = latest.model_version
production_implementation_revision    = latest.implementation_revision
production_ssot_version               = config.ssot_version
```

Record the already-verified config Git blob and byte SHA256. No UI/config fallback.

The observation date is the UTC calendar-date portion of `latest.json -> as_of_utc`. This value becomes `observation_date`.

**FIREWALL.** Do **not** derive `observation_date` from:

- `T`
- cron date
- local date
- GitHub event date
- filename
- `snapshot_date` alone

If `snapshot_date` is present: require it is consistent with the UTC date of `as_of_utc`. If inconsistent: **STOP observation creation**. Do not rewrite either value.

**CANDIDATE IMPLEMENTATION DECISION.** Fail-closed: any structural `latest.json` integrity failure means **no H8 writes** during that invocation. Close catch-up does not proceed after an observation-input structural failure.

---

## 14. Required factor snapshot

**CANDIDATE IMPLEMENTATION DECISION.** Required factors, exact scientific order:

1. `trend_valuation`
2. `stablecoins`
3. `etf_flows`
4. `net_liquidity`
5. `term_leverage`
6. `macro_overlay`
7. `social_interest`

Require exactly one `latest.json` factor object for each required key. Reject duplicate required keys.

For each captured required factor preserve at least:

```text
key
score
status
last_updated_utc
official_weight
```

Frozen decimal Official weights:

```text
trend_valuation = 0.30
stablecoins     = 0.18
etf_flows       = 0.077
net_liquidity   = 0.043
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

**FIREWALL.** Do not derive scientific Official weights from the UI.

The frozen scientific Official weights are **decimal fractions**. Production `latest.json` currently publishes factor `weight` and `weight_pct` in **percent units**.

Freeze:

```text
expectedPublishedPercent = frozenOfficialDecimalWeight * 100
```

If latest factor `weight` exists: require exact finite numeric equality to `expectedPublishedPercent`.
If `weight_pct` exists: require exact finite numeric equality to `expectedPublishedPercent`.
If both exist: require they also equal each other.

Examples:

```text
trend_valuation:
  scientific decimal weight = 0.30
  published weight          = 30
  published weight_pct      = 30

etf_flows:
  scientific decimal weight = 0.077
  published weight          = 7.7
  published weight_pct      = 7.7
```

The observation's scientific `official_weight` field remains the **decimal** value (`0.30`, `0.18`, `0.077`, …). Do **not** store the published percent as the scientific model weight.

A published weight-unit mismatch is structural input failure for H8 capture for that invocation.

For `last_updated_utc`: use the production factor timestamp deterministically. If both `last_utc` and `lastUpdated` exist and are non-null: require equality. For a fresh factor require a valid timestamp. Do not invent one.

---

## 15. Common eligibility

**CANDIDATE IMPLEMENTATION DECISION.**

```text
common_eligibility_status = ELIGIBLE
```

only if all seven required factor snapshots:

- exist exactly once
- `score` is a real JavaScript `Number`
- `score` is finite
- `score` is within `0–100` inclusive
- `status` is exactly `fresh`

Otherwise:

```text
common_eligibility_status = NOT_ELIGIBLE
```

with a deterministic `eligibility_reason`.

All three models share this eligibility.

**FIREWALL.** Do not renormalize. Do not substitute stale data. Do not carry forward a score. Do not omit one model independently.

---

## 16. Frozen score formulas

**CANDIDATE IMPLEMENTATION DECISION.** Only if `common_eligibility_status = ELIGIBLE`, calculate scores from the seven captured factor scores.

Use JavaScript `Number` semantics. No intermediate rounding.

```text
weighted_sum =
  sum(score * weight)

score =
  Math.round(
    Math.max(
      0,
      Math.min(100, weighted_sum)
    )
  )
```

### 16.1 Official

```text
trend_valuation = 0.30
stablecoins     = 0.18
etf_flows       = 0.077
net_liquidity   = 0.043
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

### 16.2 Liq-Heavy `liq-heavy-v1`

```text
trend_valuation = 0.25
stablecoins     = 0.18 * (0.35 / 0.30)
etf_flows       = 0.077 * (0.35 / 0.30)
net_liquidity   = 0.043 * (0.35 / 0.30)
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

Ratio expressions remain the mathematical source of truth.

### 16.3 Mom-Tilted `mom-tilted-v1`

```text
trend_valuation = 0.35
stablecoins     = 0.18 * (0.25 / 0.30)
etf_flows       = 0.077 * (0.25 / 0.30)
net_liquidity   = 0.043 * (0.25 / 0.30)
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

**FIREWALL.** Do not import `lib/experimentalModel.ts` as the scientific formula implementation.

---

## 17. Official published-score integrity

**CANDIDATE IMPLEMENTATION DECISION.** `official_published_score` is exactly:

```text
public/data/latest.json -> composite_score
```

from the same post-ETL artifact.

On a common `ELIGIBLE` observation require `official_published_score` is finite and in `0–100`.

Compare using exact JavaScript `Number` equality:

```text
official_published_score === official_formula_score
```

| Result | `official_integrity_status` |
|---|---|
| equal | `MATCH` |
| not equal | `INTEGRITY_MISMATCH` |

An integrity mismatch remains captured as an immutable H8 observation for audit / provenance, but its later scientific analysis status is excluded under the frozen protocol.

**FIREWALL.** Do not repair it. Do not choose one score over the other. Do not rewrite production.

For `NOT_ELIGIBLE` dates:

```text
official_integrity_status = NOT_CHECKED_NOT_ELIGIBLE
```

---

## 18. Observation analysis-status field

**CANDIDATE IMPLEMENTATION DECISION.** Capture-time `analysis_status`:

```text
if common_eligibility_status != ELIGIBLE:
  analysis_status = OBSERVATION_NOT_ELIGIBLE
else if official_integrity_status == INTEGRITY_MISMATCH:
  analysis_status = INTEGRITY_MISMATCH
else:
  analysis_status = ELIGIBLE
```

This is capture-time eligibility only.

**FIREWALL.** Do **not** calculate `ELIGIBLE_OUTCOME_COMPLETE` or `OUTCOME_INCOMPLETE` during prospective score capture. Those require future outcome availability and belong only to the later frozen analysis phase.

---

## 19. Immutable observation path

**CANDIDATE IMPLEMENTATION DECISION.** Observation target:

```text
research/h8-prospective/observations/YYYY-MM-DD.json
```

where `YYYY-MM-DD` is exactly `observation_date`.

Create score observations only when:

```text
2026-08-24 <= observation_date <= 2027-02-19
```

Outside that window: create no observation. Do not treat this as an error.

Before writing, if the target already exists:

- do **not** overwrite
- validate that the existing artifact is structurally valid H8 data
- log `OBSERVATION_ALREADY_EXISTS`
- create no second observation
- continue only with permitted close-capture processing

If the existing target is malformed or has wrong protocol / capture identity: **FAIL CLOSED**. Do not replace it.

---

## 20. Observation JSON schema

**CANDIDATE IMPLEMENTATION DECISION.** Exact deterministic top-level key order:

```text
study_id
protocol_version
protocol_sha
h8_capture_source_sha
capture_contract_version
capture_contract_sha
observation_date
scheduled_event
observation_as_of_utc
capture_created_utc
etl_started_utc
source_base_git_sha
github_run_id
github_run_attempt
github_event_name
github_workflow_ref
github_sha
production_model_version
production_implementation_revision
production_ssot_version
production_config_git_blob
production_config_sha256
latest_artifact_sha256
common_eligibility_status
eligibility_reason
official_integrity_status
analysis_status
factors
official_published_score
official_formula_score
liq_heavy_score
mom_tilted_score
model_versions
model_weight_definitions
```

Recommended frozen constants:

```text
study_id         = h8-prospective-three-model-v1
scheduled_event  = DAILY_ETL
protocol_sha     = 85fb5bcbdb5c6d04333a3a9516629851efd890eb
capture_contract_version = h8-capture-implementation-contract-v1
capture_contract_sha     = <H8_CAPTURE_CONTRACT_SHA assigned after freeze>
```

For `NOT_ELIGIBLE` observations: challenger / formula fields that cannot scientifically be calculated without renormalization must be JSON `null`.

**FIREWALL.** Do not serialize `NaN`, `Infinity`, or `undefined`. Do not use string numbers.

---

## 21. Model version / weight definition record

**CANDIDATE IMPLEMENTATION DECISION.** Each observation must carry immutable model identifiers:

```text
official   = v1.1.1
liq_heavy  = liq-heavy-v1
mom_tilted = mom-tilted-v1
```

Preserve exact scientific weight definitions in a deterministic object. For challenger liquidity factors store **both**:

```text
definition:        "0.077 * (0.35 / 0.30)"
evaluated_weight:  <Number result>
```

The frozen protocol remains the mathematical authority.

---

## 22. Canonical JSON serialization

**CANDIDATE IMPLEMENTATION DECISION.** All H8 JSON artifacts must use deterministic serialization:

```text
JSON.stringify(value, null, 2) + '\n'
```

- UTF-8
- LF only
- final LF required
- fixed object-key construction order
- fixed factor order
- no locale formatting
- no date locale strings
- no BOM
- no CRLF

Before accepting a generated artifact: reparse serialized bytes, validate exact schema, validate all scientific identity fields, **then** allow filesystem write.

---

## 23. Create-only file writes

**CANDIDATE IMPLEMENTATION DECISION.** H8 artifacts are create-only.

Use exclusive creation semantics equivalent to `flag: 'wx'`.

**FIREWALL.** Never call ordinary `writeFile` on an existing H8 scientific artifact.

Build and validate all proposed outputs in memory before writes.

If an exclusive write fails with `EEXIST`: do not overwrite.

Real workflow must not commit any partial scientific artifact if capture exits nonzero.

Because the GitHub runner is ephemeral, files created during a failed script invocation are not scientific observations unless the workflow successfully commits / pushes them.

---

## 24. BTC source authority

**CANDIDATE IMPLEMENTATION DECISION.** BTC close source after ETL:

```text
public/data/btc_price_history.csv
```

Expected exact header:

```text
date_utc,close_usd,source,ingested_at_utc
```

The H8 capture implementation must use a stricter parser than permissive `parseFloat` behavior.

Reject:

- blank date
- malformed `YYYY-MM-DD`
- duplicate date
- blank close
- Number-invalid close
- non-finite close
- close `<= 0`
- trailing numeric junk
- missing source
- malformed required-row ingested timestamp

Compute `source_artifact_sha256` from the exact post-ETL CSV bytes before creating any close artifacts.

**FIREWALL.** Do not call Coinbase or another provider from H8 capture code. H8 capture is network-free. It consumes the production ETL artifact already generated locally.

---

## 25. Deterministic BTC close catch-up

**CANDIDATE IMPLEMENTATION DECISION.** Let `T` = UTC date of `capture_run_utc`.

Only if `T <= 2027-03-29`, consider missing required close dates.

Required close date `d` must satisfy:

```text
2026-08-24 <= d <= 2027-03-21
AND
d <= T - 1 UTC day
AND
research/h8-prospective/btc-closes/d.json does not already exist
```

Process candidate `d` values in **ascending date order**.

For each `d`:

- require exact source CSV row for `d`
- require row close finite and `> 0`
- require `d` is a completed UTC candle as of `capture_run_utc`

If valid: propose immutable close artifact.

If `d` row is missing or invalid: leave it missing. Do not substitute. Do not use spot. Do not stop later eligible dates merely because one earlier source date is missing, unless source-file structural corruption makes the whole artifact untrustworthy.

After `T > 2027-03-29`: create **zero** new H8 BTC-close artifacts.

---

## 26. First-authorized-value immutability

**CANDIDATE IMPLEMENTATION DECISION.** If `research/h8-prospective/btc-closes/d.json` already exists:

- do not replace it
- do not compare production's newer value and update H8
- do not synchronize revisions
- do not choose a later provider value
- validate the existing H8 close artifact
- then skip `d`

The first successfully committed authorized captured value remains permanent for H8 v1.

---

## 27. BTC close JSON schema

**CANDIDATE IMPLEMENTATION DECISION.** Exact deterministic top-level key order:

```text
study_id
protocol_version
protocol_sha
h8_capture_source_sha
capture_contract_version
capture_contract_sha
close_date_utc
close_usd
source
source_row_ingested_at_utc
captured_at_utc
source_artifact_path
source_artifact_sha256
source_base_git_sha
github_run_id
github_run_attempt
github_event_name
github_workflow_ref
github_sha
```

Recommended:

```text
source_artifact_path = public/data/btc_price_history.csv
capture_contract_version = h8-capture-implementation-contract-v1
capture_contract_sha     = <H8_CAPTURE_CONTRACT_SHA assigned after freeze>
```

**FIREWALL.** No MACE. No score. No forward return. No performance field.

---

## 28. Created-file manifest outside repository

**CANDIDATE IMPLEMENTATION DECISION.** Freeze environment name:

```text
H8_CREATED_MANIFEST_PATH
```

In GitHub Actions real capture, require `H8_CREATED_MANIFEST_PATH` resolves underneath `RUNNER_TEMP` and outside the repository root.

**FIREWALL.** Do not allow the CLI to expose a human `--manifest-path` override in `--capture` mode.

Freeze a deterministic JSON manifest. Exact top-level key order:

```text
manifest_version
capture_run_utc
files
```

```text
manifest_version = h8-created-manifest-v1
```

`files` is an array in deterministic repository-relative path order. Each entry exact key order:

```text
path
sha256
```

Canonical serialization: `JSON.stringify(value, null, 2) + '\n'`

For zero new files: `files = []`

Before workflow staging, strictly validate every path. Allowed exact patterns only:

```text
^research/h8-prospective/observations/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$
OR
^research/h8-prospective/btc-closes/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$
```

Additionally reject:

- absolute paths
- `..`
- `.`
- backslashes
- repeated separators
- non-canonical separators
- path normalization changes
- symlinks
- directories
- files outside repository root after resolution

Require each staged target:

- exists as a normal file
- is not a symlink
- SHA256 exactly equals the manifest entry

**FIREWALL.** A mere string-prefix check is **not** sufficient.

The activation sidecar `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` must **never** appear in a daily capture manifest.

---

## 29. H8 failure must not break production ETL

**CANDIDATE IMPLEMENTATION DECISION.** H8 is research infrastructure.

A failure of H8-specific identity verification, fingerprint verification, contract verification, observation validation, close validation, create-only write, H8 commit, or H8 push must **not** by itself prevent ordinary GhostGauge production ETL artifacts from being committed / pushed.

Production ETL failure itself may of course fail the production workflow. But: **H8 failure ≠ production ETL failure**.

Examples:

- If scientific fingerprint changes: write ZERO H8 artifacts, mark/log H8 capture `BLOCKED`, continue ordinary production artifact handling.
- If `latest.json` fails an H8-specific integrity requirement after a successful production ETL: write ZERO H8 artifacts; the H8 observation becomes effectively missed / `CAPTURE_MISSING`; production artifacts may still be committed normally.
- If H8 commit / push ultimately fails: the production update already remains safe; no rerun may recreate the score observation; later close recovery remains governed by protocol.

**FIREWALL.** Do not silently hide H8 failures. They must be visible in workflow logs / step summary.

---

## 29.1 Pre-ETL and post-ETL identity safety

**CANDIDATE IMPLEMENTATION DECISION.** The future workflow should perform a READ-ONLY H8 identity preflight on authorized first-attempt scheduled runs **before** production ETL.

The preflight must verify at least:

- activated capture source identity
- H8 protocol identity
- frozen capture-contract identity
- scientific model fingerprint
- runtime implementation bytes
- working-tree scientific / runtime cleanliness

**FIREWALL.** An H8 preflight failure must **not** stop the ordinary production ETL. Instead it sets an internal workflow state equivalent to `H8_CAPTURE_ALLOWED=false` and records / logs the reason. Production ETL then continues normally.

After ETL, real H8 `--capture` may run only if `H8_CAPTURE_ALLOWED=true` and must repeat the relevant fail-closed identity / worktree checks before H8 writes.

Thus:

- pre-ETL check proves the frozen scientific code at computation start
- post-ETL check proves it remained unchanged through computation

This is H8 research safety. It must not convert an H8 research problem into a production outage.

---

## 30. Separate production commit from H8 scientific commit

**CANDIDATE IMPLEMENTATION DECISION.** H8 capture still occurs **after** successful `npm run etl:compute` and **before** either artifact commit. This preserves the frozen protocol ordering.

After successful H8 capture:

### 30.1 Phase 1 — production artifact commit / push

Stage **only** normal production paths:

```text
public/data
public/signals
public/extras
public/alerts
```

**FIREWALL.** Do **not** stage H8 research artifacts in the production commit.

Commit / pull / rebase / push ordinary production artifacts using safe production behavior. H8 research files generated by this invocation remain uncommitted during this phase.

If production commit / push ultimately fails: the H8 research artifacts from this invocation must **not** be committed. The scientific observation did not successfully land.

### 30.2 Phase 2 — H8 scientific artifact commit / push

Only **after** the production artifact update has successfully landed, revalidate:

- H8 created-file bytes against `RUNNER_TEMP` manifest SHA256
- source `latest.json` SHA256 referenced by any new observation
- source `btc_price_history.csv` SHA256 referenced by any new close artifacts
- frozen identities still valid
- no existing target was introduced by the updated `main`

If any referenced source artifact bytes differ from those used during H8 capture: **DO NOT COMMIT H8**. The production update remains valid. Do not alter the H8 artifact. Do not recalculate it. Do not substitute new data. Treat the H8 capture for that score date as not successfully landed.

If all revalidation passes: stage **only** exact H8 paths from the trusted validated manifest. Create a separate H8 scientific commit.

Suggested runtime commit subject:

```text
research(h8): capture prospective artifacts [skip ci]
```

The exact subject may be finalized in Stage A but must remain deterministic.

Then pull / rebase against current `origin/main` if needed, reverify H8 bytes and relevant source hashes, then push.

**FIREWALL.** For the H8 scientific commit: **no** automatic merge fallback. Rebase conflict: **FAIL H8 CLOSED**. Production remains already updated. Do not rerun capture. Do not rebuild the score observation.

This separation ensures a research conflict cannot take down the live daily dashboard.

---

## 31. Exact H8 scientific staging

**CANDIDATE IMPLEMENTATION DECISION.** Production commit must **never** stage research paths.

H8 scientific commit must stage only exact files from the validated manifest.

**FIREWALL.** Do **not** use `git add research`.
**FIREWALL.** Do **not** use `git add research/h8-prospective`.
**FIREWALL.** Do **not** use wildcard broad staging.

Use exact validated path arguments individually.

Activation sidecar `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` is pre-existing tracked scientific control. It must **never** appear in a daily capture manifest. It must **never** be staged as a changed runtime artifact.

If it is modified: H8 capture is **BLOCKED**.

---

## 32. Source-artifact survival verification

**CANDIDATE IMPLEMENTATION DECISION.** In addition to verifying created H8 artifact SHA256 after rebase, require verification of the **source bytes** referenced by those H8 artifacts.

For a newly created score observation, recorded `latest_artifact_sha256` must still equal current `public/data/latest.json` SHA256 immediately before the separate H8 scientific commit.

For newly created close artifacts, recorded `source_artifact_sha256` must still equal current `public/data/btc_price_history.csv` SHA256 immediately before H8 scientific commit.

After any pull / rebase before the H8 push: repeat the applicable checks.

If source bytes differ: do not alter the H8 artifact; do not recalculate it; do not substitute new data; do not push it. Treat the H8 capture for that score date as not successfully landed. The production commit remains unaffected.

---

## 32.1 H8 local failure cleanup / transactionality

**CANDIDATE IMPLEMENTATION DECISION.** Because H8 research artifacts may be created locally before their separate scientific commit, freeze local-run failure semantics.

The capture implementation must track every repository H8 path successfully created by the current invocation.

If real H8 capture later fails before successful H8 scientific commit:

- never overwrite anything
- remove only **uncommitted** H8 files created by this same invocation from the ephemeral GitHub runner when necessary to permit production Git operations
- never remove a file that existed before the invocation
- never remove a tracked / committed prior H8 artifact
- never use a broad `rm` on `research/h8-prospective`

Local cleanup of an uncommitted ephemeral-run file is **not** rewriting H8 scientific history because the artifact never became a successfully committed H8 observation.

The implementation should minimize this need by validating all proposed H8 outputs before materialization. If Stage A can implement a safer temporary-materialization architecture under `RUNNER_TEMP` while preserving the frozen scientific semantics, document it during implementation review.

**FIREWALL.** Do not silently change the scientific artifact paths or accepted-byte rules.

---

## 32.2 Push retries for the H8 scientific commit

**CANDIDATE IMPLEMENTATION DECISION.** A push retry inside the **same** GitHub Actions `run_attempt == 1` is operationally allowed. It does **not** constitute a second scientific capture.

**FIREWALL.** Do **not** rerun the capture script to regenerate H8 artifacts during push retry. Reuse the exact originally generated bytes.

After each pull / rebase: reverify SHA256 against the `RUNNER_TEMP` manifest and the applicable source-artifact survival hashes.

If the workflow run ultimately cannot push the H8 scientific commit: the uncommitted / unpushed H8 file does **not** become an accepted H8 observation.

A later GitHub Actions rerun has `run_attempt != 1` and therefore cannot recreate the missed score observation.

BTC closes may later be recovered only by the already-frozen deterministic scheduled catch-up rule.

---

## 33. No performance code

**FIREWALL.** The future H8 capture implementation must contain **no** function or helper that calculates:

- MACE
- MAE
- future return
- rank
- Spearman
- Pearson
- correlation
- delta rho
- hit rate
- band performance
- quintile
- AUC
- realized volatility

References in comments explaining prohibited functionality are okay.

**FIREWALL.** No imported H7.2 outcome-analysis engine. No performance module dependency.

---

## 34. Network firewall

**FIREWALL.** H8 capture code itself is local-artifact-only. No:

- `fetch`
- `http`
- `https`
- `axios`
- Coinbase request
- CoinGecko request
- FRED request

inside H8 capture runtime files.

The ordinary production ETL may continue using its existing network sources. H8 runs only after ETL has produced the local artifacts.

Synthetic tests must not use network.

---

## 35. Contract-check mode

**CANDIDATE IMPLEMENTATION DECISION.** The future read-only `--contract-check` mode must prove at least:

- protocol commit exists
- protocol is ancestor
- protocol document blob exact, including worktree `git hash-object`
- frozen capture-contract identity / blob exact after the contract is frozen
- frozen scientific model fingerprint exact, including worktree bytes
- current production config SHA256 exact
- frozen scientific directories have no dirty or untracked worktree difference
- current workflow has required future H8 gate once implemented
- current H8 runtime files are structurally present
- no real output is written
- `filesWritten` counter = `0`

Source-SHA-anchored candidate `--contract-check` is **not** required before the Stage-A commit exists.

After the Stage-A commit, and only then, run:

```text
node scripts/research/capture-h8-prospective.mjs --contract-check --candidate-source-sha <Stage-A SHA>
```

requiring `HEAD ==` that SHA.

After Stage-B activation / merge, ordinary `--contract-check` must read `H8_CAPTURE_SOURCE_SHA.txt`, validate runtime blobs against that source, and **reject** `--candidate-source-sha`.

**FIREWALL.** No `--contract-check` may create observations, close artifacts, research directories, or performance output.

---

## 36. Instrumentation counters

**CANDIDATE IMPLEMENTATION DECISION.** For independent runtime review expose simple counters. At minimum:

```text
networkRequests
observationFilesCreated
closeFilesCreated
filesWritten
overwriteAttempts
performanceCalculations
```

Expected:

```text
networkRequests = 0
overwriteAttempts = 0
performanceCalculations = 0
```

A normal pre-window dress-rehearsal scheduled run before `2026-08-24` should produce:

```text
observationFilesCreated = 0
closeFilesCreated = 0
filesWritten = 0
```

while all identity checks pass.

---

## 37. Synthetic test requirements

**CANDIDATE IMPLEMENTATION DECISION.** The later implementation test suite must cover at least:

**A. Protocol identity**

- correct protocol SHA passes
- wrong protocol doc blob fails

**B. Scientific fingerprint**

- each representative wrong blob fails
- wrong `factors/` tree fails
- wrong `lib/` tree fails
- ordinary `public/data` changes do not count as scientific fingerprint change

**C. Capture-source activation**

- missing `H8_CAPTURE_SOURCE_SHA.txt` fails real capture
- malformed sidecar fails
- non-ancestor SHA fails
- changed runtime capture blob fails
- `HEAD` may be later than capture source and still pass when frozen runtime blobs match

**D. Event gate**

- `schedule` + `run_attempt 1` passes
- `workflow_dispatch` fails
- `run_attempt 2` fails
- local / non-GitHub fails

**E. Observation date**

- derived from `latest.as_of_utc`
- not derived from capture `T`
- delayed run crossing UTC date behaves correctly
- before `2026-08-24` creates no observation
- after `2027-02-19` creates no observation

**F. Common eligibility**

- all seven fresh / valid => `ELIGIBLE`
- one stale => `NOT_ELIGIBLE`
- one excluded => `NOT_ELIGIBLE`
- one null score => `NOT_ELIGIBLE`
- one NaN / non-finite fixture => `NOT_ELIGIBLE` / rejected according to frozen schema
- duplicate required factor => structural failure

**G. Score arithmetic**

- Official exact fixture
- Liq-Heavy exact ratio arithmetic
- Mom-Tilted exact ratio arithmetic
- no intermediate rounding
- exact `Math.round` behavior

**H. Official integrity**

- exact published / formula match
- mismatch produces `INTEGRITY_MISMATCH`
- mismatch is not silently repaired

**I. Observation immutability**

- existing observation never overwritten
- duplicate observation date creates no second file
- malformed existing observation fails closed

**J. Close source parser**

- exact header
- duplicate date rejection
- blank close rejection
- trailing numeric junk rejection
- non-positive close rejection
- malformed date rejection

**K. Close schedule**

- Aug 24 scheduled run produces no Aug 24 close yet
- Aug 25 may capture `C_2026-08-24`
- normal March 22 may capture `C_2027-03-21`
- March 29 catch-up allowed
- March 30 creates no new H8 close

**L. Close catch-up**

- missing older eligible date is automatically considered later
- ascending processing
- source-missing date remains missing
- later eligible dates can still capture
- no operator-selected date mechanism

**M. First-authorized-value rule**

- existing close remains unchanged when production source later changes
- no overwrite attempt

**N. Canonical serialization**

- stable JSON key order
- LF only
- final LF
- deterministic fixture bytes
- no `NaN` / `Infinity` / `undefined`

**O. Created manifest**

- exact paths + SHA256
- rejects path outside the two H8 scientific artifact directories
- zero-file run clear

**P. No-performance firewall**

- `performanceCalculations` remains `0`
- no analysis artifact written

**Q. Network firewall**

- `networkRequests` remains `0`
- no network dependency

**R. CLI**

- no default capture
- `--capture` rejects `--candidate-source-sha`
- `--candidate-source-sha` rejected after activation where appropriate
- no `--date`
- no `--force`
- no `--backfill`
- no `--output-dir`
- no `--manifest-path` in `--capture`
- `--contract-check` is write-free

**S. Worktree identity**

- correct committed + worktree bytes pass
- `HEAD` blob correct but modified worktree file fails
- staged scientific / runtime modification fails
- untracked file inside frozen scientific tree fails
- symlink substituted for frozen runtime file fails

**T. Same-run temporal proof**

- valid ETL start `<= latest.as_of <=` capture time passes
- `latest.as_of` before ETL start blocks H8
- `latest.as_of` after capture time blocks H8
- malformed ETL-start timestamp blocks H8

**U. Weight units**

- trend published `30` maps to scientific `0.30`
- ETF published `7.7` maps to scientific `0.077`
- direct `0.30` published value fails where `30` is required
- `weight` vs `weight_pct` mismatch fails

**V. SSOT version**

- config `ssot_version` `2.1.1` passes
- missing / wrong `ssot_version` fails
- latest / config model revision disagreement fails

**W. Contract identity**

- frozen capture-contract SHA ancestor passes
- wrong contract document blob fails
- artifact schema records contract version / SHA

**X. Candidate contract-check**

- source-anchored candidate check runs after Stage-A commit
- supplied candidate SHA must equal `HEAD`
- candidate-source argument rejected in `--capture`
- candidate-source argument rejected after activation where appropriate

**Y. Production isolation**

- H8 blocked before writes still allows production staging path
- H8 validation failure produces no staged H8 path
- production commit does not include H8 files
- H8 commit does not include production files
- H8 rebase failure does not rewrite or rerun capture
- H8 rebase failure does not undo already-landed production update

**Z. Source survival**

- unchanged latest hash permits observation H8 commit
- changed latest hash blocks observation H8 commit
- unchanged BTC-history hash permits close H8 commit
- changed BTC-history hash blocks close H8 commit

**AA. Manifest path safety**

- canonical observation path passes
- canonical close path passes
- `../` traversal rejected
- absolute path rejected
- backslash path rejected
- prefix-plus-traversal rejected
- symlink rejected
- wrong SHA256 rejected
- activation sidecar path rejected

---

## 38. Pre-window dress rehearsal

**CANDIDATE IMPLEMENTATION DECISION.** The implementation should be merged / activated early enough that at least one normal scheduled first-attempt Daily ETL before `2026-08-24` can exercise the real capture machinery.

Because the observation window has not opened, that run should:

- pass protocol identity
- pass scientific fingerprint
- pass capture-source identity
- pass event gate
- parse post-ETL inputs
- create **zero** score observations
- create **zero** H8 BTC closes
- write **zero** H8 scientific artifacts

This is an operational dress rehearsal, **not** an H8 observation.

**FIREWALL.** Do not artificially trigger this through `workflow_dispatch`. Use the ordinary scheduled run if calendar timing permits.

---

## 39. First study observation

**CANDIDATE IMPLEMENTATION DECISION.** The first authorized study score observation is the first qualifying first-attempt scheduled ETL whose `latest.json -> as_of_utc` has UTC date `2026-08-24`.

**FIREWALL.** If capture infrastructure is not accepted, activated, merged, and operational before that scheduled observation: H8 v1 must **not** silently start late. **STOP.** A new protocol version / start date would be required.

---

## 40. Implementation acceptance sequence

**CANDIDATE IMPLEMENTATION DECISION.** Freeze the future process:

1. Freeze and merge this capture implementation contract. `H8_CAPTURE_CONTRACT_SHA` must be assigned **before** Stage-A implementation.
2. Create Stage-A implementation branch from the then-current merged `main`.
3. Implement only authorized Stage-A files.
4. Run dedicated synthetic tests, `npm test`, `npm run typecheck`, and `git diff --check`. No source-SHA-anchored candidate `--contract-check` yet.
5. Commit Stage A.
6. Require clean Stage-A worktree. Run read-only `--contract-check --candidate-source-sha <Stage-A SHA>`.
7. Independent Stage-A review. If accepted assign `H8_CAPTURE_SOURCE_SHA = <Stage-A SHA>`.
8. Create Stage-B activation commit adding only `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` with exact Stage-A SHA + LF.
9. Independent activation review.
10. Merge Stage A + Stage B normally.
11. On merged `main` run ordinary activated read-only `--contract-check`.
12. Allow ordinary scheduled pre-window dress rehearsal.
13. First qualifying observation-date `2026-08-24` begins H8.

**FIREWALL.** No Stage-A coding begins before this contract is frozen and merged.
**FIREWALL.** Do not assign `H8_CAPTURE_SOURCE_SHA` before Stage-A review.

---

## 41. Repository checks for future implementation

**CANDIDATE IMPLEMENTATION DECISION.** Require at least:

```text
node --test scripts/research/__tests__/h8-prospective-capture.test.mjs
npm test
npm run typecheck
git diff --check
read-only H8 --contract-check
```

CI / Vercel green where applicable.

**FIREWALL.** No real `--capture` during developer review.

---

## 42. Contract status / SHA

**FACT.** This pass creates only the implementation-contract candidate.

**FIREWALL.** Do **not** assign `H8_CAPTURE_CONTRACT_SHA` yet.

After independent review accepts the exact contract bytes, a later freeze commit may become `H8_CAPTURE_CONTRACT_SHA`.

**FIREWALL.** Do **not** assign `H8_CAPTURE_SOURCE_SHA` during contract work.

---

## 43. What this candidate amendment does and does not do

This candidate amendment modifies **only**:

```text
docs/H8_CAPTURE_IMPLEMENTATION_CONTRACT.md
```

It hardens implementation / provenance rules. It does **not** change frozen H8 scientific methodology.

It does **not**:

- write H8 capture code
- edit Daily ETL
- create `research/h8-prospective/` directories or files
- create H8 observations or BTC-close artifacts
- calculate MACE, returns, ranks, or correlations
- tune weights
- create a fourth or fifth model
- modify the frozen H8 protocol
- modify H7 / H7.1 / H7.2
- assign `H8_CAPTURE_CONTRACT_SHA`
- assign `H8_CAPTURE_SOURCE_SHA`
- merge this branch

---

## 44. Stop

```text
H8 PROTOCOL STATUS:
FROZEN / MERGED / CLOSED TO METHODOLOGY CHANGES

H8_PROTOCOL_VERSION:
h8-prospective-three-model-v1

H8_PROTOCOL_SHA:
85fb5bcbdb5c6d04333a3a9516629851efd890eb

CAPTURE IMPLEMENTATION:
NOT YET IMPLEMENTED

H8_CAPTURE_CONTRACT_SHA:
NOT YET ASSIGNED

H8_CAPTURE_SOURCE_SHA:
NOT YET ASSIGNED

OBSERVATIONS:
ZERO

PERFORMANCE RESULTS:
NONE

CALIBRATION:
CLOSED
```

**STOP FOR FINAL INDEPENDENT H8 CAPTURE-CONTRACT REVIEW.**

Do not freeze this contract until that review accepts or amends it.
Do not write capture code until a freeze exists.
Do not start H8 if accepted capture implementation is not operational before the scheduled `2026-08-24` observation.
