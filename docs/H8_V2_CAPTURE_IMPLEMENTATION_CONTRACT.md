# H8 v2 Capture Implementation Contract

**Date:** 2026-08-27
**Phase:** H8 v2 — capture implementation contract freeze
**Status:** `CONTRACT FROZEN — CAPTURE NOT IMPLEMENTED — START UNASSIGNED`
**Contract version:** `h8-v2-capture-implementation-contract-v1`
**H8_V2_CAPTURE_CONTRACT_VERSION:** `h8-v2-capture-implementation-contract-v1`
**Study namespace:** `h8-v2-prospective`
**Branch:** `research/h8-v2-capture-contract-candidate`
**Parent main HEAD at candidate creation:** `23d2ce476777577789ba10627b8156c90f28a96c`

```text
H8 v2 start date               = UNASSIGNED
H8 v2 observations             = ZERO
H8 v2 matured outcomes         = ZERO
H8 v2 performance              = NONE
H8 v2 capture implementation   = NOT YET IMPLEMENTED
H8_V2_CAPTURE_SOURCE_SHA       = NOT YET ASSIGNED
H8_V2_START_SHA                = NOT YET ASSIGNED
Calibration                    = CLOSED
```

This document is the **frozen H8 v2 capture implementation contract**.

The final accepted candidate immediately before freeze was:

```text
7de41cabfc02b8bdbdb8d092f2f183ce24827f9c
```

Its document blob was:

```text
038745688aa52a3a5ce1e47de6a15749242688c5
```

That candidate SHA is **not** `H8_V2_CAPTURE_CONTRACT_SHA`. Do **not** write the freeze-commit SHA into this document. `H8_V2_CAPTURE_CONTRACT_SHA` is the external Git identity of this contract-freeze commit; it is intentionally not self-embedded in this document. The Git commit that freezes these bytes becomes `H8_V2_CAPTURE_CONTRACT_SHA` only after independent verification.

The capture machinery described here is now frozen as the required implementation contract.

Capture implementation has not yet been written. `H8_V2_CAPTURE_SOURCE_SHA` remains unassigned. The study start remains unassigned. No H8 v2 scientific observation exists. Calibration remains **CLOSED**.

No Stage-A implementation exists. No Stage-B activation exists. No rehearsal exists. No start authorization exists. No observation exists. No BTC close exists.

Any later substantive change to a **FROZEN IMPLEMENTATION REQUIREMENT** requires a successor capture-contract version where the frozen protocol explicitly permits compatible capture-only repair, or a successor scientific protocol/study if scientific compatibility cannot be proven.

This contract does **not** change H8 v2 scientific methodology.

Labels used below:

- **FACT** — inherited from the frozen H8 v2 protocol, closed H8 v1 identities, or current production workflow/config at parent main
- **FROZEN SCIENTIFIC REQUIREMENT** — already frozen in `H8_V2_PROTOCOL_SHA`; this contract may not change it
- **FROZEN IMPLEMENTATION REQUIREMENT** — accepted frozen capture machinery; changing it requires a successor capture-contract version where the frozen protocol permits compatible capture-only repair, or a successor scientific protocol/study
- **FIREWALL** — a prohibition that is not open to casual weakening
- **LIMITATION** — a bound on what later capture implementation may do even after this contract is frozen

---

## 0. Contract authority

**FROZEN SCIENTIFIC REQUIREMENT.** The independently accepted H8 v2 scientific protocol is authoritative over this contract.

| Item | Value |
|---|---|
| Protocol status | `PROTOCOL FROZEN — CAPTURE NOT YET IMPLEMENTED — START UNASSIGNED` |
| `H8_V2_PROTOCOL_VERSION` | `h8-prospective-three-model-v2` |
| Permanent `H8_V2_PROTOCOL_SHA` | `a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3` |
| Frozen protocol document | `docs/H8_V2_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md` |
| Frozen protocol document Git blob | `1f4f4999afe1c3440c69ad54564dca948e61c603` |
| Frozen protocol document SHA256 | `d8a5a73107a17e470a30adfb4de33b2ea72b5fe4a69dc6c991e488cf577aafe6` |
| Frozen protocol tree | `6dc18721ed7a82b561172ad16f08aaa01eb5802b` |
| Current main at contract-candidate creation | `23d2ce476777577789ba10627b8156c90f28a96c` |
| Current main tree | `6dc18721ed7a82b561172ad16f08aaa01eb5802b` |

**FACT.** `H8_V2_PROTOCOL_SHA` is the freeze commit itself. It is **not** the protocol-merge commit `23d2ce476777577789ba10627b8156c90f28a96c`.

**FROZEN IMPLEMENTATION REQUIREMENT.** This contract freezes operational machinery, schemas, identity checks, Git policy, and runtime paths.

**FIREWALL.** This contract may **NOT** change:

- model family
- model weights
- factor formulas
- common eligibility
- Official integrity rule
- `MACE30`
- Spearman design
- observation-window arithmetic
- close-window arithmetic
- missingness rules
- no-interim-performance rule
- rehearsal requirement
- `R` timestamp source
- deterministic `S` rule
- calibration status

**FIREWALL.** Any conflict with the frozen protocol is resolved in favor of the protocol.

**FIREWALL.** If an implementation requirement would alter scientific semantics: **STOP**. Require a successor scientific protocol instead of silently changing this contract.

**FIREWALL.** Do not edit the frozen protocol document in this pass or in later Stage-A implementation.

---

## 1. Purpose

**FROZEN IMPLEMENTATION REQUIREMENT.** Later Stage-A implementation must mechanically implement:

- frozen model identities
- frozen score formulas
- common seven-factor eligibility
- Official same-run integrity check
- two-stage capture-source identity
- fail-closed runtime identity preflight
- genuine scheduled `NON_STUDY_REHEARSAL`
- committer-timestamp integrity for `R`
- mechanical `S` derivation after accepted rehearsal
- one-shot immutable `H8_V2_START.json` validation
- immutable prospective score observations
- immutable prospective BTC close artifacts
- deterministic automatic close catch-up
- production / research transaction separation
- provenance sufficient for independent reconstruction of capture integrity

**FIREWALL.** The implementation must contain **no**:

- `MACE` calculation
- Spearman / Pearson / rank calculation
- return calculation
- performance comparison
- tuning
- calibration
- model selection
- start-date selection in this contract pass

---

## 2. Zero state

**FACT.** At this contract freeze:

```text
H8 v2 start date               = UNASSIGNED
H8 v2 observations             = ZERO
H8 v2 matured outcomes         = ZERO
H8 v2 performance              = NONE
H8 v2 capture implementation   = NOT YET IMPLEMENTED
H8_V2_CAPTURE_SOURCE_SHA       = NOT YET ASSIGNED
H8_V2_START_SHA                = NOT YET ASSIGNED
Calibration                    = CLOSED
```

**FACT.** `research/h8-v2-prospective/` is absent.

**FACT.** Historical v1 sidecar `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` is absent.

**FACT.** No Stage-A implementation exists. No Stage-B activation exists. No rehearsal exists. No start authorization exists. No observation exists. No BTC close exists.

**FIREWALL.** This freeze pass must not create the v2 research namespace, a rehearsal, a start file, an observation, a close, or the v1 sidecar.

---

## 3. H8 v1 historical firewall

**FACT.** H8 v1 remains historical and closed:

| Item | Value |
|---|---|
| Protocol version | `h8-prospective-three-model-v1` |
| `H8_PROTOCOL_SHA` | `85fb5bcbdb5c6d04333a3a9516629851efd890eb` |
| Capture contract version | `h8-capture-implementation-contract-v1` |
| `H8_CAPTURE_CONTRACT_SHA` | `811359afc572c86aa3d2d8732a1efd2c72b9df8f` |
| Historical `H8_CAPTURE_SOURCE_SHA` | `8406b14f344a3c8805b6931ced55ac0d607af611` |
| Status | `STOPPED BEFORE SUCCESSFUL STUDY START` |
| Accepted v1 observations | **ZERO** |
| Accepted v1 BTC closes | **ZERO** |
| Performance | **NONE** |
| Calibration | **CLOSED** |

**FIREWALL.** Do not modify:

```text
docs/H8_PROSPECTIVE_30D_RISK_DISCRIMINATION_PREREGISTRATION.md
docs/H8_CAPTURE_IMPLEMENTATION_CONTRACT.md
docs/H8_V1_START_FAILURE_2026-08-24.md
scripts/research/capture-h8-prospective.mjs
scripts/research/lib/h8-prospective-capture-core.mjs
scripts/research/lib/h8-prospective-capture-io.mjs
scripts/research/__tests__/h8-prospective-capture.test.mjs
```

**FIREWALL.** Do not recreate `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt`.

**FIREWALL.** Treat the v1 contract and v1 capture scripts as historical engineering reference only. Do not copy v1 fixed calendar dates into v2. Do not reactivate v1.

**FROZEN IMPLEMENTATION REQUIREMENT.** Future v2 implementation creates **new** v2-specific runtime files. It must **not** edit the historical v1 capture scripts. Future workflow integration must **replace** the dormant v1 workflow calls with v2 calls. That workflow replacement is not a modification of the v1 capture scripts.

---

## 4. Current Daily ETL workflow baseline

**FACT.** Current workflow at parent main `23d2ce476777577789ba10627b8156c90f28a96c`:

```text
path                           = .github/workflows/daily-etl.yml
git blob SHA                   = 54f3df48fc4aba68fca484de34837d0ad5a16b7a
cron                           = 0 11 * * *
triggers                       = schedule, workflow_dispatch
concurrency.group              = etl
concurrency.cancel-in-progress = false
Node                           = 20.18.0
npm ci                         = npm ci --ignore-scripts --no-audit --fund=false
```

**FACT.** Daily ETL currently serializes all ETL runs with:

```yaml
concurrency:
  group: etl
  cancel-in-progress: false
```

**FACT.** The current workflow still contains dormant H8 v1 integration that calls the historical v1 scripts (`scripts/research/capture-h8-prospective.mjs` and v1 IO helpers), with `continue-on-error: true` so v1 failure does not fail production.

**FROZEN IMPLEMENTATION REQUIREMENT.** Stage A must preserve:

```text
concurrency.group = etl
concurrency.cancel-in-progress = false
cron = 0 11 * * *
triggers = schedule + workflow_dispatch
Node 20.18.0
npm ci --ignore-scripts --no-audit --fund=false
```

A `workflow_dispatch` ETL and a scheduled ETL must not execute concurrently and race over `public/data/latest.json` or `public/data/btc_price_history.csv` during H8 v2 capture.

**FROZEN IMPLEMENTATION REQUIREMENT.** Stage A replaces the WORKFLOW INTEGRATION with v2 integration. It does **not** modify historical v1 capture scripts. The deleted v1 activation sidecar remains absent permanently.

Current conceptual sequence, which Stage A must preserve as production-safe ordering:

```text
checkout
→ install
→ H8 identity preflight (scheduled attempt 1 only; fail-closed for H8, not production)
→ record ETL-started UTC
→ ETL compute
→ production commit/push of public/**
→ H8 research restore/commit/push if authorized and production landed
```

---

## 5. Authorized future v2 implementation surface

**FROZEN IMPLEMENTATION REQUIREMENT.** Stage A may change or create **only**:

```text
.github/workflows/daily-etl.yml
scripts/research/capture-h8-v2-prospective.mjs
scripts/research/lib/h8-v2-prospective-capture-core.mjs
scripts/research/lib/h8-v2-prospective-capture-io.mjs
scripts/research/__tests__/h8-v2-prospective-capture.test.mjs
```

**FIREWALL.** No `package.json` change unless a later independent review proves it unavoidable. The workflow can call the v2 CLI directly:

```text
node scripts/research/capture-h8-v2-prospective.mjs --contract-check
node scripts/research/capture-h8-v2-prospective.mjs --capture
```

**FIREWALL.** No production model-contract / scientific-fingerprint file may change.

**FIREWALL.** If implementation later genuinely requires an additional runtime file: **STOP** and request contract review. Do not silently expand scope.

---

## 6. Frozen H8 v2 scientific fingerprint

**FACT / FROZEN SCIENTIFIC REQUIREMENT.** Copy the accepted frozen identities exactly.

| Path | Git SHA | Kind |
|---|---|---|
| `config/dashboard-config.json` | `b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49` | blob |
| `lib/config-loader.mjs` | `8f439254ca813050703a7c17bcd658474c19e2b2` | blob |
| `scripts/etl/compute.mjs` | `6f16c1f24bc097d6079fffc0ea7b5889c91ea0d4` | blob |
| `scripts/etl/factors.mjs` | `e9fd06df79967f0041a901e2dd971b771e669b03` | blob |
| `scripts/etl/factors/` | `163b086f72ec43117e8bfcbbe5fd31732dae715d` | tree |
| `scripts/etl/factors/trendValuation.mjs` | `3abf6f0611f86f58aca06c736d9baf41c7eb4ae9` | blob |
| `scripts/etl/lib/` | `64c73c01db27f1e6dbcd12d45d08c2f12bc47b12` | tree |
| `scripts/etl/stalenessUtils.mjs` | `1c213b9b8eb659c9cda22d0834694ae3239eb768` | blob |
| `scripts/etl/marketCalendar.mjs` | `77c5669f77bef11cbc43fb85f82bb4a42bfc2136` | blob |
| `scripts/etl/adjustments.mjs` | `36a6d3c5220ac7ac9e7493bc49176840ed5fe9d7` | blob |
| `scripts/etl/coinGeckoCache.mjs` | `fbfc5e35b3bd4af60eb00e780892b62f94e8bbff` | blob |
| `scripts/etl/priceHistory.mjs` | `515b02acdd0cf4a72e62889dafb83cec6e8acd95` | blob |
| `scripts/etl/fetch-helper.mjs` | `da8ca2b441088f2e13364249e7ecbbed40dc22a4` | blob |

**FACT.** Ordinary Daily ETL `public/data/**`, `public/signals/**`, `public/extras/**`, and `public/alerts/**` artifact commits do **not** themselves change the frozen scientific fingerprint.

**FIREWALL.** H8 v2 must **not** reuse the old v1 factors tree `3921332c0decd56800e78580183931b718b9a345`.

**FIREWALL.** Do not use `lib/experimentalModel.ts` as scientific authority.

**FACT.** `config/weights.json` is **not** H8 Official authority.

---

## 7. Two-stage v2 capture-source freeze

**FACT.** A Git commit cannot contain its own future SHA.

**FIREWALL.** Do **not** solve capture-source identity using:

- a placeholder later rewritten inside the frozen implementation
- a mutable GitHub repository variable as scientific identity
- current `HEAD` as the capture-source identity
- a floating branch or tag
- an environment secret

### 7.1 Stage A — implementation source commit

**FROZEN IMPLEMENTATION REQUIREMENT.** The accepted implementation source commit contains:

- workflow integration
- v2 capture CLI
- v2 core
- v2 IO
- v2 tests

and does **not** contain:

```text
research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt
```

After independent Stage-A review, the exact accepted Stage-A commit becomes:

```text
H8_V2_CAPTURE_SOURCE_SHA
```

### 7.2 Stage B — activation commit

**FROZEN IMPLEMENTATION REQUIREMENT.** Create a separate activation commit whose only new scientific-control file is:

```text
research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt
```

Exact contents:

```text
<H8_V2_CAPTURE_SOURCE_SHA>\n
```

Require:

- 40 lowercase hexadecimal characters
- plus one LF
- 41 bytes total
- no CR
- no spaces
- no additional lines

The Stage-B activation commit is **not** `H8_V2_CAPTURE_SOURCE_SHA`.

Stage B must not modify any Stage-A implementation byte.

**FIREWALL.** No H8 v2 rehearsal may occur until Stage A + Stage B are independently accepted and merged.

**FIREWALL.** Do not assign `H8_V2_CAPTURE_SOURCE_SHA` in this freeze pass.

---

## 8. Runtime identity preflight

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze both pre-ETL and post-ETL fail-closed identity checks.

Before any H8 v2 write, verify all of the following:

1. Frozen protocol commit `a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3` exists and is an ancestor of current `HEAD`.
2. Frozen protocol document Git blob equals exactly `1f4f4999afe1c3440c69ad54564dca948e61c603`.
3. Frozen protocol worktree bytes: file exists, is a regular file, is not a symlink, `git hash-object` equals the frozen blob, no staged modification.
4. After contract freeze: frozen capture-contract commit exists, is an ancestor, contract document Git blob and worktree `git hash-object` match the frozen contract-document blob, no staged modification.
5. Capture-source sidecar `research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt` exists and parses exactly as specified in §7.2.
6. Capture-source SHA exists as a commit and is an ancestor of current `HEAD`.
7. Stage-A runtime Git blobs at `HEAD` equal the corresponding blobs at `H8_V2_CAPTURE_SOURCE_SHA`.
8. Stage-A worktree bytes equal those frozen blobs via `git hash-object`; files are regular files, not symlinks; no staged scientific/runtime modifications.
9. Frozen scientific fingerprint identities in §6 are exact at `HEAD` and in the worktree.
10. Historical v1 activation sidecar `research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt` remains **absent**. If present: **H8 V2 STOP BEFORE WRITES**.

Stage-A runtime files for blob equality:

```text
.github/workflows/daily-etl.yml
scripts/research/capture-h8-v2-prospective.mjs
scripts/research/lib/h8-v2-prospective-capture-core.mjs
scripts/research/lib/h8-v2-prospective-capture-io.mjs
```

The synthetic test file is recorded in implementation-acceptance provenance but need not be a runtime dependency.

Use Git object identity **and** `git hash-object` of the actual worktree bytes.

**FIREWALL.** `HEAD` does **not** need to equal `H8_V2_CAPTURE_SOURCE_SHA`, because routine ETL commits will advance `main`.

At **initial** pre-ETL identity preflight, before ETL or any production Git commit/rebase, require:

```text
HEAD == H8_V2_GITHUB_SHA == github.sha
```

That original checkout SHA is frozen into provenance (§11.1) and is **not** rewritten when later Git operations advance `HEAD`.

If any frozen identity differs:

```text
H8 V2 STOP BEFORE WRITES
```

This is a **GLOBAL H8 INTEGRITY FAILURE**. It stops all H8 v2 writes for the invocation, including rehearsal, observation, and BTC-close catch-up. Production ETL must continue independently.

Pre-ETL `--contract-check` failure sets workflow state equivalent to `H8_V2_CAPTURE_ALLOWED=false` and must **not** fail the production job. Post-ETL `--capture` may run only if that gate is true, and must repeat fail-closed identity / worktree checks before writes.

---

## 9. Event authority

**FROZEN SCIENTIFIC REQUIREMENT / FROZEN IMPLEMENTATION REQUIREMENT.** Real H8 v2 activity may occur only when:

```text
github.event_name == 'schedule'
AND
github.run_attempt == 1
```

**FIREWALL.** `workflow_dispatch` must **never** create rehearsal artifacts, observations, or BTC-close artifacts.

**FIREWALL.** Reruns with `attempt > 1` must **never** create them.

**FIREWALL.** No local run. No API reconstruction. No force. No backfill. No date override. No output-directory override. No event override. No run-attempt override.

**FIREWALL.** No operator flag may make an otherwise ineligible run scientifically eligible.

Defense in depth: the workflow `if:` condition is necessary but not sufficient. The v2 CLI `--capture` path must independently re-read and enforce the same event/attempt gate from runner-supplied environment and must fail closed if those values are missing, non-numeric, or inconsistent.

---

## 10. CLI modes

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze a small conceptual interface.

### 10.1 `--contract-check`

READ ONLY. No research writes.

May validate:

- frozen protocol identity
- frozen capture-contract identity after contract freeze
- scientific fingerprint
- capture-source sidecar / Stage-A runtime bytes after activation
- working-tree scientific/runtime cleanliness
- v1 sidecar absence
- workflow static structure
- current input schemas

Allowed only with `--contract-check`:

```text
--candidate-source-sha <Stage-A commit SHA>
```

Before `H8_V2_CAPTURE_SOURCE_SHA` exists, `--contract-check --candidate-source-sha <Stage-A SHA>` is the source-anchored review check and must require `HEAD ==` that SHA.

After Stage-B activation / merge, ordinary `--contract-check` must read the sidecar and must **reject** `--candidate-source-sha`.

**FIREWALL.** `--candidate-source-sha` must **not** be accepted in `--capture` or `--validate-start-candidate`.

### 10.2 `--capture`

REAL scheduled create-only mode.

Requires activated capture-source sidecar.
Requires GitHub scheduled first attempt.
Uses fixed repository paths.
No date / output / event / attempt override.

### 10.3 `--validate-start-candidate`

Optional READ-ONLY validation/derivation mode.

May accept a landed qualifying rehearsal commit SHA and mechanically report:

- parsed `R`
- derived candidate `S`
- derived window end dates
- `S-1` 11:00 UTC authorization deadline
- whether that deadline has already passed relative to current clock

**FIREWALL.** This mode must never create scientific artifacts, rehearsals, control records, or start authorization. It does **not** authorize capture. It does **not** assign `S`.

### 10.4 No default mode

**FIREWALL.** Calling the CLI without an explicit mode must fail without writes.

---

## 11. Workflow environment names

**FROZEN IMPLEMENTATION REQUIREMENT.** Use v2-prefixed runner environment names so v1 historical names are not reused:

```text
H8_V2_CAPTURE_ALLOWED
H8_V2_CAPTURE_COMPLETED
H8_V2_PRODUCTION_OK
H8_V2_ETL_STARTED_UTC
H8_V2_GITHUB_RUN_ID
H8_V2_GITHUB_RUN_ATTEMPT
H8_V2_GITHUB_EVENT_NAME
H8_V2_GITHUB_SHA
H8_V2_GITHUB_WORKFLOW_REF
H8_V2_CREATED_MANIFEST_PATH
H8_V2_ESCROW_DIR
```

**FIREWALL.** `H8_V2_ETL_STARTED_UTC` must be generated on the runner immediately before `npm run etl:compute` using `new Date().toISOString()` or equivalent. It must not be operator supplied. It must not be accepted as a CLI override.

**FROZEN IMPLEMENTATION REQUIREMENT.** At the beginning of the authorized workflow, before ETL or any production Git commit/rebase, require:

```text
H8_V2_GITHUB_SHA = github.sha
```

and require the checkout `HEAD` equals that value at initial identity preflight.

### 11.1 Original scheduled-run source checkout

**FROZEN IMPLEMENTATION REQUIREMENT.** Define the original scheduled-run source checkout exactly.

```text
source_base_git_sha =
  the original scheduled-run checkout SHA used to execute the production ETL
  whose snapshot is being captured

github_sha =
  that same original github.sha

H8_V2_GITHUB_SHA =
  that same original github.sha, captured into the runner environment
  before later Git history advances
```

Therefore for observation and close provenance:

```text
source_base_git_sha == github_sha == H8_V2_GITHUB_SHA
```

The value is captured **before** later Git history advances.

**FIREWALL.** It must **NOT** be rewritten to:

- production artifact commit SHA
- post-production rebased `HEAD`
- research commit SHA
- post-research rebased commit SHA
- final `origin/main` SHA

For `NON_STUDY_REHEARSAL`, `source_checkout_sha` has the **same** meaning: the original `github.sha` checkout used by that genuine scheduled run.

After production / research Git operations advance `HEAD`, provenance continues to record the original source checkout.

---

## 12. Pre-start state machine

**FROZEN SCIENTIFIC REQUIREMENT.** No market-based rehearsal selection. No convenience-based rejection. No rehearsal shopping.

**FROZEN IMPLEMENTATION REQUIREMENT.** Exact operational behavior:

### A. Capture source not activated

H8 v2 inactive. `--capture` writes nothing.

### B. Capture source activated + `H8_V2_START.json` absent + no live candidate rehearsal

If there is no successfully landed candidate rehearsal still within its readiness window, the next genuine first-attempt scheduled Daily ETL is armed as `NON_STUDY_REHEARSAL`.

### C. Successfully landed candidate rehearsal exists + no start authorization + readiness window has not expired

**Do not** create additional rehearsals while that candidate awaits independent review / start authorization.

### D. Candidate rehearsal independently rejected

Require an immutable non-scientific rejection/disqualification control record (§13) **before** another rehearsal is armed.

### E. Candidate rehearsal readiness expires

Readiness expires when the `S-1` 11:00 UTC authorization deadline passes without a valid merged start authorization.

The next qualifying genuine scheduled Daily ETL may create the next `NON_STUDY_REHEARSAL` automatically.

No disqualification record is required for expiry.

### F. Valid `H8_V2_START.json` exists

Rehearsal mode is permanently disabled for that study. Study-mode date rules apply.

### 12.1 Runtime definition of a live candidate rehearsal

**FROZEN IMPLEMENTATION REQUIREMENT.** A rehearsal is a **live candidate** if and only if all of:

- its artifact exists under `research/h8-v2-prospective/rehearsals/`
- the exact final Git commit containing that artifact is reachable from accepted `origin/main`
- that commit was produced by `schedule` + `run_attempt == 1`
- no matching disqualification control record exists for that rehearsal's `github_run_id`
- timestamp-integrity checks on that final commit pass the runtime checks in §16
- derived candidate `S` from that commit's `R` still has `11:00 UTC on S-1` in the future relative to this invocation's `capture_run_utc`

Runtime may derive a **candidate** `S` from a landed rehearsal's `R` solely to compute the authorization deadline and whether to arm another rehearsal.

**FIREWALL.** That derived candidate `S` is **not** an assigned study start date. Runtime must not write `H8_V2_START.json`. Runtime must not treat candidate `S` as authorized until a valid merged start file exists.

If a landed rehearsal fails runtime timestamp-integrity checks, it is **not** a live candidate and cannot be referenced by `H8_V2_START.json`. Independent review should still merge a disqualification record. Runtime must not wait for that record before refusing to treat the failed rehearsal as `R`.

Independent rejection for a defect that runtime did **not** already fail closed still requires the merged disqualification record before another rehearsal is armed. This preserves no-shopping.

---

## 13. Operational-control schema

**FROZEN IMPLEMENTATION REQUIREMENT.** Authorize one pre-start control namespace:

```text
research/h8-v2-prospective/controls/
```

Disqualification path:

```text
research/h8-v2-prospective/controls/disqualification-<github_run_id>.json
```

where `<github_run_id>` is the qualifying rehearsal's GitHub run ID.

**FIREWALL.** `--capture` must **never** create a disqualification record.
**FIREWALL.** `--capture` must **never** create `H8_V2_START.json`.
**FIREWALL.** The activation sidecar must **never** appear in a daily manifest.

A disqualification record is a separately reviewed prospective scientific-control artifact, analogous to start authorization: created outside `--capture`, independently reviewed, and merged before it has operational effect.

### 13.1 Disqualification JSON

Exact deterministic top-level key order:

```text
schema_version
study_id
artifact_type
protocol_version
protocol_sha
capture_contract_version
capture_contract_sha
capture_source_sha
qualifying_rehearsal_path
qualifying_rehearsal_commit_sha
qualifying_rehearsal_run_id
disqualification_reason_code
disqualification_created_utc
```

Constants:

```text
schema_version = h8-v2-disqualification-v1
study_id       = h8-v2-prospective
artifact_type  = REHEARSAL_DISQUALIFICATION
```

Allowed `disqualification_reason_code` values only:

```text
timestamp_integrity_failure
manufactured_committer_timestamp
identity_mismatch
artifact_contained_scientific_fields
event_gate_violation
push_reachability_unproven
empty_research_manifest
other_operational_integrity_defect
```

**FIREWALL.** No reason code for market conditions, convenience, or preferred start date.

**FIREWALL.** The record must contain **no** scores, outcomes, performance, Bitcoin price, market direction, factor values, MACE, rho, or rank.

Create-only. Canonical JSON (§35). One record per rehearsal run ID.

---

## 14. Non-study rehearsal artifact

**FROZEN SCIENTIFIC REQUIREMENT.** Rehearsal namespace:

```text
research/h8-v2-prospective/rehearsals/
```

**FROZEN IMPLEMENTATION REQUIREMENT.** Deterministic unique filename based on the genuine GitHub run ID:

```text
research/h8-v2-prospective/rehearsals/run-<github_run_id>.json
```

The artifact must visibly and permanently declare:

```text
artifact_type      = NON_STUDY_REHEARSAL
study_status       = NON_STUDY
observation_status = NOT_AN_OBSERVATION
btc_close_status   = NOT_A_BTC_CLOSE
performance_status = NOT_FOR_PERFORMANCE
```

### 14.1 Rehearsal JSON

Exact deterministic top-level key order:

```text
schema_version
study_id
artifact_type
study_status
observation_status
btc_close_status
performance_status
protocol_version
protocol_sha
capture_contract_version
capture_contract_sha
capture_source_sha
scientific_fingerprint
github_run_id
github_run_attempt
github_event_name
github_workflow_ref
source_checkout_sha
artifact_created_utc
etl_started_utc
```

```text
schema_version = h8-v2-rehearsal-v1
study_id       = h8-v2-prospective
```

`artifact_created_utc` is the invocation's single `capture_run_utc` (§25).

`scientific_fingerprint` is a deterministic object listing the §6 path → SHA identities.

`source_checkout_sha` equals the original scheduled-run `github.sha` checkout defined in §11.1. Rehearsal artifacts depend on neither `latest.json` nor `btc_price_history.csv` for scientific values.

The rehearsal artifact records only provenance known **before** its research commit. The escrow manifest, not the rehearsal JSON, records the artifact file's SHA256.

Do **not** put the future commit SHA, push result, reachability result, or `R` into the artifact.

**FIREWALL.** The rehearsal artifact must **not** contain:

- Official score
- formula score
- challenger score
- factor values
- MACE
- BTC close
- returns
- rho
- rank
- performance
- market direction
- Bitcoin price
- `latest.json` score
- any source value from which a rehearsal score is intentionally encoded

**FIREWALL.** Do not include scientific model calculations in rehearsal mode.

**FIREWALL.** The rehearsal artifact must **not** self-certify:

- future commit SHA
- future commit success
- future push success
- future reachability
- `R`

Those facts are determined only **after** the immutable artifact bytes exist.

### 14.2 Required non-empty research path

The rehearsal exists to test machinery. It must create a **NON-EMPTY** research manifest and traverse:

```text
artifact creation
→ escrow
→ production phase
→ research restore/stage
→ research commit
→ research rebase policy
→ research push
→ remote reachability verification
```

An empty research manifest does **not** qualify.

**FIREWALL.** Rehearsal artifacts can never become observations. Do not rename, copy, or infer scores from them.

---

## 15. Rehearsal qualification and R

**FROZEN SCIENTIFIC REQUIREMENT.** This contract must **not** redefine `R`.

```text
rehearsal_commit_sha =
  the exact FINAL Git commit containing the qualifying rehearsal artifact
  that successfully lands remotely

R =
  the Git COMMITTER timestamp of that exact final commit object,
  normalized to UTC without changing the represented instant
```

**FIREWALL.** Never use as `R`:

- artifact-created time
- cron time
- scheduled time
- workflow start time
- workflow completion time
- push time
- review time
- PR merge time
- operator-entered time
- author timestamp
- GitHub UI display time

Successful push / reachability remains a **separate qualification gate**.

An ephemeral local commit does not qualify.

The **FIRST** genuine first-attempt scheduled rehearsal that uses the final accepted implementation, creates a non-empty `NON_STUDY_REHEARSAL` artifact, traverses escrow, keeps production safe, successfully commits / pushes, and passes identity checks is the candidate qualifying rehearsal.

Independent review either accepts it or rejects it for a documented operational / integrity defect. It may **not** be rejected merely to wait for a more convenient start date.

---

## 16. Committer-timestamp integrity

**FROZEN IMPLEMENTATION REQUIREMENT.** This is a mandatory H8 v2 capture-integrity repair. It does **not** change the frozen scientific timestamp source. `R` remains the genuine Git committer timestamp of the final qualifying commit.

### 16.1 Prohibited timestamp manufacture

During the scientific research-commit phase, the implementation must **fail closed** if any of the following are detected:

- `GIT_COMMITTER_DATE` is set in the process environment
- `GIT_AUTHOR_DATE` is set in the process environment
- a custom committer-date environment override
- equivalent Git plumbing used to manufacture committer time (`git commit --date` with intent to control committer instant, `git filter-branch` / `git filter-repo` timestamp rewrite, `git commit-tree` with a supplied committer ident containing a chosen date)
- rebase options intended to manufacture a selected committer date (`GIT_COMMITTER_DATE` around rebase, `--committer-date-is-author-date` used to preserve/inject a chosen instant)
- operator-supplied commit timestamp
- manual construction of `R`

Prefer ordinary:

```text
git commit
git rebase
```

using the genuine runner clock.

Do not silently honor an override.

**FIREWALL.** `GIT_AUTHOR_DATE` is also prohibited in the scientific research-commit phase to remove provenance ambiguity even though author time is not `R`.

### 16.2 Rebase, replacement, and which commit may define R

If the research commit is rebased, replaced, or otherwise rewritten locally, the **pre-rebase / abandoned** commit is **not** the qualifying commit.

A **provisional research commit** is a local, unpushed commit created from the current landable set. It is **not** accepted scientific evidence. It may be rewritten or replaced locally by the frozen reconciliation process before any successful push.

A **final research commit** is the exact commit object that is ultimately successfully pushed and proven reachable from `origin/main`. Only that final commit can become accepted scientific evidence.

For `NON_STUDY_REHEARSAL`:

```text
rehearsal_commit_sha =
  the FINAL successfully pushed/reachable research commit

R =
  that FINAL commit's genuine Git COMMITTER timestamp
```

Any provisional, pre-rebase, abandoned, or superseded commit:

- does not qualify
- does not define `R`
- is not scientific evidence

Committer-timestamp integrity checks apply to the exact **final local commit proposed for push**. If reconciliation creates a replacement commit: run the timestamp-integrity checks again. Its genuine committer timestamp supersedes abandoned local commit timestamps. Do **not** preserve the abandoned commit SHA, abandoned committer timestamp, pre-rebase timestamp, or old parent identity.

**FIREWALL.** Do **not** attempt to preserve the old pre-rebase or abandoned committer timestamp.

For a rehearsal, `R` may be derived **only** after final successful push and remote reachability.

### 16.3 Parsing R

After the final commit object is established, parse its Git committer date using:

```text
git show -s --format=%cI <final_commit_sha>
```

Normalize to UTC without changing the represented instant. Serialize as a `YYYY-MM-DDTHH:MM:SS.sssZ` ISO-8601 UTC string, or exact `YYYY-MM-DDTHH:MM:SSZ` if the Git timestamp has whole-second precision. Do not apply a timezone other than the stored instant.

### 16.4 Runtime sanity bounds

Git commit timestamps have whole-second precision, while `artifact_created_utc` and `H8_V2_ETL_STARTED_UTC` may carry milliseconds. Compare the lower bounds at Git's effective precision so a legitimate commit later within the same integer second does not false-fail.

Recommended exact rule:

```text
final_committer_epoch_seconds
  >= floor(Date.parse(artifact_created_utc) / 1000)

AND

final_committer_epoch_seconds
  >= floor(Date.parse(H8_V2_ETL_STARTED_UTC) / 1000)

AND

final_committer_epoch_seconds
  <= floor(Date.parse(immediate_post_commit_verification_utc) / 1000) + 120
```

An equivalent rigorously defined whole-second comparison is acceptable.

**FIREWALL.** Do **not** add 120 seconds to the scientific `R` value. The 120-second future bound is only a runner-clock sanity check against a manufactured-future timestamp. It does **not** redefine `R`.

`R` remains the exact stored Git committer instant of the final qualifying commit.

If any runtime timestamp-integrity check fails: **do not push** that commit as a qualifying rehearsal. If it somehow already exists remotely, it is disqualified and cannot be referenced by `H8_V2_START.json`.

### 16.5 Independent-review sanity bound

Independent post-run review must additionally compare the final committer timestamp with genuine GitHub Actions run metadata:

```text
run_started_at - 5 minutes
  <= final research commit committer timestamp
  <= workflow run updated_at + 5 minutes
```

This bound is only timestamp-integrity validation. It does **NOT** redefine `R`.

Any timestamp-integrity failure:

```text
DISQUALIFIES THE REHEARSAL BEFORE START AUTHORIZATION
```

No `H8_V2_START.json` may reference it.

---

## 17. Mechanical S derivation

**FROZEN SCIENTIFIC REQUIREMENT.** Implement the already-frozen rule exactly:

```text
start_selection_rule =
  earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1

S = the earliest UTC calendar date D such that
      11:00 UTC on D  >=  R + 72 hours
  AND all start-readiness requirements remain satisfied
```

No market input. No convenience input.

Then derive mechanically:

```text
observation_end_date_utc     = S + 179 calendar days
required_close_end_date_utc  = S + 209 calendar days
recovery_end_date_utc        = S + 217 calendar days
```

**FIREWALL.** No start date is selected in this contract pass.

### 17.1 Synthetic examples — not an assigned S

**LIMITATION.** The following dates are **synthetic**. They do **not** imply an actual H8 v2 start date.

Example A — exact 72-hour boundary:

```text
SYNTHETIC R = 2099-06-01T11:00:00.000Z
R + 72 hours = 2099-06-04T11:00:00.000Z
11:00 UTC on 2099-06-04 = 2099-06-04T11:00:00.000Z  → allowed
11:00 UTC on 2099-06-03 = 2099-06-03T11:00:00.000Z  → not allowed
candidate S = 2099-06-04
S-1 authorization deadline = 2099-06-03T11:00:00.000Z
observation_end = 2099-11-30
required_close_end = 2099-12-30
recovery_end = 2100-01-07
```

Example B — one millisecond after the 11:00 boundary:

```text
SYNTHETIC R = 2099-06-01T11:00:00.001Z
R + 72 hours = 2099-06-04T11:00:00.001Z
11:00 UTC on 2099-06-04 is not >= R + 72 hours
candidate S = 2099-06-05
```

Example C — R earlier the same UTC morning:

```text
SYNTHETIC R = 2099-06-01T08:00:00.000Z
R + 72 hours = 2099-06-04T08:00:00.000Z
11:00 UTC on 2099-06-04 is >= R + 72 hours
candidate S = 2099-06-04
```

---

## 18. H8 v2 start-authorization schema

**FROZEN SCIENTIFIC REQUIREMENT.** Path:

```text
research/h8-v2-prospective/H8_V2_START.json
```

**FIREWALL.** The capture implementation must **never** create this file automatically. It is a separately reviewed prospective scientific-control artifact.

### 18.1 Required JSON

Exact deterministic top-level key order:

```text
schema_version
study_id
protocol_version
protocol_sha
capture_contract_version
capture_contract_sha
capture_source_sha
scientific_fingerprint
qualifying_rehearsal_path
qualifying_rehearsal_commit_sha
qualifying_rehearsal_run_id
qualifying_rehearsal_commit_committer_utc
start_selection_rule
start_date_utc
observation_end_date_utc
required_close_end_date_utc
recovery_end_date_utc
authorization_created_utc
```

```text
schema_version       = h8-v2-start-v1
study_id             = h8-v2-prospective
protocol_version     = h8-prospective-three-model-v2
protocol_sha         = a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3
capture_contract_version = h8-v2-capture-implementation-contract-v1
start_selection_rule = earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1
```

**FIREWALL.** Even though the frozen rule string ends in `_v1`, preserve it **exactly**. Do not “clean up” the name.

`qualifying_rehearsal_commit_committer_utc` **MUST** equal `R` derived directly from the exact qualifying commit object.

`capture_contract_sha` and `capture_source_sha` are filled only after those identities exist. This frozen contract document does not invent them.

Date fields `start_date_utc`, `observation_end_date_utc`, `required_close_end_date_utc`, and `recovery_end_date_utc` are `YYYY-MM-DD` UTC calendar dates.

Canonical JSON (§35). Create-only after independent review. One-shot.

---

## 19. Start-authorization immutability and main-entry time

**FROZEN SCIENTIFIC REQUIREMENT.** Exactly one accepted start-authorization artifact exists for an H8 v2 study. Never modified, overwritten, deleted, or rewritten after merge.

### 19.1 Two identities

**FROZEN IMPLEMENTATION REQUIREMENT.** Do not confuse:

```text
A. H8_V2_START_SHA
   = the exact one-shot Git commit that creates H8_V2_START.json
     (the commit whose tree first contains the start-file bytes;
      not the later merge commit)

B. start_authorization_merge_time
   = the Git COMMITTER timestamp of the first mainline commit
     on accepted origin/main in which H8_V2_START.json becomes present
```

### 19.2 Required merge strategy

**FROZEN IMPLEMENTATION REQUIREMENT.** The start authorization must enter `main` through a reviewed **normal two-parent PR merge**. Not squash. Not rebase-onto-main as the landing method. Not amend. Not direct rewrite of `main`.

Expected merge parents after current `main` is unchanged except for the start file:

```text
parent 1 = then-current origin/main
parent 2 = the start-file commit (H8_V2_START_SHA)
```

### 19.3 Exact main-entry proof

Let `M` be the main-entry commit. The following **semantic** conditions are authoritative:

1. `M` is on the first-parent history of accepted `origin/main`.
2. `M` contains `research/h8-v2-prospective/H8_V2_START.json` with exactly the independently accepted start-file blob.
3. `M^1` does **not** contain that path.
4. `M` has exactly two parents.
5. `M^2` is exactly `H8_V2_START_SHA`.
6. `H8_V2_START_SHA` is the exact file-creating commit. It is **not** redefined as `M`.
7. Relative to its parent, `H8_V2_START_SHA` adds exactly **one** repository path:

```text
research/h8-v2-prospective/H8_V2_START.json
```

No other file.
8. The reviewed PR introducing the start authorization changes exactly that one path.
9. From `M` through current accepted `origin/main` first-parent history, no later commit may:

- modify the start file
- delete it
- replace it
- delete and re-add it
- change its blob

Runtime / independent verification must prove the start blob remained unchanged for the entire first-parent history after main entry.

A useful implementation method for locating `M` is:

```text
git log --first-parent --reverse --diff-filter=A --format=%H \
  origin/main -- research/h8-v2-prospective/H8_V2_START.json
```

The first SHA printed is a candidate for `M` and must then be checked against conditions 1–9. The command is **not** itself the proof.

Parse `M`'s committer timestamp:

```text
git show -s --format=%cI <M>
```

Normalize to UTC. That instant is `start_authorization_merge_time`.

**FIREWALL.** The start-file creation commit's older timestamp alone must **not** be used to fake the 24-hour lead time if the file entered `main` later.

### 19.4 Lead-time rule

**FROZEN SCIENTIFIC REQUIREMENT.**

```text
start_authorization_merge_time
  <=
11:00 UTC on calendar date S-1
```

If the file misses this deadline:

```text
READINESS EXPIRES FOR THAT REHEARSAL
```

Do **not** move `S` later. Require another genuine scheduled rehearsal.

### 19.5 GitHub merge-time cross-check

**FROZEN IMPLEMENTATION REQUIREMENT.** Because the contract requires a reviewed normal GitHub two-parent PR merge, independent review must retrieve that PR's GitHub `merged_at` and compare it with `M`'s Git committer timestamp.

Recommended sanity tolerance:

```text
abs(M committer timestamp - PR merged_at) <= 5 minutes
```

This cross-check validates that the Git merge-commit time is consistent with the GitHub server merge event.

**FIREWALL.** It does **NOT** redefine `start_authorization_merge_time`. That remains `M`'s Git committer timestamp.

If the cross-check fails **after** the start authorization has already entered `main`:

```text
H8 V2 START AUTHORIZATION IS INVALID
STOP BEFORE STUDY CAPTURE
```

Do **NOT**:

- edit `H8_V2_START.json`
- replace it
- delete / re-add it
- create another `H8_V2_START.json`
- choose another `S`
- merely wait for another rehearsal
- treat readiness expiry as permitting repair inside the same study

Require a **successor protocol / study**, in accordance with the frozen protocol's one-shot invalid-start rule.

This cross-check is mandatory **independent post-merge acceptance**. It depends on GitHub server metadata. Local capture CLI cannot independently prove that the review occurred. Do not fabricate a local machine-readable proof of external review. Do not add a mutable environment override saying “review passed.”

Study capture is organizationally unauthorized until this independent post-merge acceptance is complete. The mandatory ≥24-hour pre-start lead time provides the review window.

If implementation review later concludes that fully automated enforcement requires another immutable control artifact: **STOP** and request a capture-contract amendment before adding it. Do not silently invent one during Stage A.

### 19.6 Pre-merge vs post-merge start failure

**FROZEN IMPLEMENTATION REQUIREMENT.** Distinguish the two failure regimes.

**BEFORE** start authorization merges:

If independent review finds the proposed start file invalid:

- do **not** merge it
- repair / recreate the still-unmerged candidate as permitted by the review process
- if the frozen `S-1` deadline is missed, readiness expires
- require another rehearsal
- do **not** move `S`

**AFTER** start authorization merges:

If independent verification finds the merged authorization invalid — including `merged_at` cross-check failure, wrong main-entry topology, wrong start blob, wrong second parent, start SHA not a one-path creation, or any other merged start-authorization integrity failure — then:

```text
STOP H8 V2
```

No in-place repair. Successor protocol / study required.

---

## 20. Start-file one-shot validation

**FROZEN IMPLEMENTATION REQUIREMENT.** Separate runtime-verifiable start conditions from independent post-merge acceptance.

### 20.1 Runtime-verifiable start conditions

Before any study capture, runtime must verify repository-contained facts:

- `H8_V2_START.json` exists
- valid canonical JSON
- correct `protocol_version` / `protocol_sha`
- correct `capture_contract_version` / `capture_contract_sha`
- correct `capture_source_sha`
- correct scientific fingerprint
- qualifying rehearsal artifact exists at `qualifying_rehearsal_path`
- qualifying rehearsal commit is reachable from `origin/main`
- qualifying run was `schedule` + attempt `1`
- rehearsal artifact contains no scientific scores / outcomes
- `qualifying_rehearsal_commit_committer_utc` equals `R` parsed from that exact commit
- timestamp-integrity checks passed
- `start_selection_rule` equals `earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1` exactly
- `start_date_utc` exactly matches frozen derivation from `R`
- derived end dates exact
- main-entry lead-time from `M`'s Git committer timestamp
- main-entry commit `M` satisfies the exact Git topology proof in §19.3
- file blob on `HEAD` equals the blob at `H8_V2_START_SHA`
- immutable start-file Git history: never modified, overwritten, deleted, replaced, or deleted-and-re-added after main entry
- no later first-parent commit changes the start-file blob
- no second start-authorization path exists

If those repository-contained facts are malformed or inconsistent:

```text
STOP H8 V2 BEFORE SCIENTIFIC WRITES
```

Do not repair the merged start file in place. Require a successor protocol / study.

**FIREWALL.** Runtime must **not** claim it can independently prove GitHub `merged_at` or that independent review occurred. Those are not locally derivable Git-object facts.

### 20.2 Independent post-merge acceptance conditions

Independent post-merge review additionally proves:

- PR identity
- reviewed one-file PR
- GitHub `merged_at`
- `merged_at` vs `M` timestamp sanity (§19.5)
- overall start-authorization acceptance

If that independent post-merge verification fails after merge: §19.6 applies. The authorization is invalid. **STOP H8 v2.** Successor protocol / study required.

Do not add a mutable environment override marking independent review as passed.

---

## 21. Production / research transaction separation

**FROZEN SCIENTIFIC REQUIREMENT.** H8 failure must not break GhostGauge production.

**FROZEN IMPLEMENTATION REQUIREMENT.** Future sequence:

```text
pre-ETL identity check
→ ETL compute
→ post-ETL identity check
→ H8 artifact generation / escrow if authorized
→ production commit / push
→ research restore
→ research commit / push
```

Stage production paths only:

```text
public/data
public/signals
public/extras
public/alerts
```

**FIREWALL.** Never stage `research/**` in the production commit.

If production commit / push fails: do not land the H8 research artifact.

Production must land successfully before the separate H8 research commit.

H8-specific identity / capture / escrow / research-git failure must set H8 blocked/failed, remain visible in logs / step summary, and allow production to continue.

Suggested production commit subject remains the existing production convention:

```text
chore(etl): update artifacts [skip ci]
```

Suggested research commit subjects, deterministic by mode:

```text
research(h8-v2): non-study rehearsal [skip ci]
research(h8-v2): capture prospective artifacts [skip ci]
```

Production Git may retain its existing pull/rebase/merge-fallback behavior **for production paths only**.

**FIREWALL.** The H8 research Git phase must **not** use automatic merge fallback (§24).

---

## 22. Explicit v1 root-cause defense

**FACT.** The v1 start failure occurred because `npm ci` dirtied tracked `node_modules` and the research rebase failed before the scientific artifact could land. `node_modules` tracking has since been repaired.

**FROZEN IMPLEMENTATION REQUIREMENT.** The v2 contract still defends generically against dirty tracked state.

Before restoring escrowed H8 v2 artifacts for the research commit, require a **clean tracked worktree** after the production Git phase.

No unexplained tracked modifications or deletions may exist.

After restoring the exact escrow manifest:

the only permitted unstaged/staged research differences are the exact manifest paths created by the current invocation.

Reject:

- unexpected tracked modifications
- unexpected deletions
- unexpected staged paths
- unexpected research paths
- symlinks
- path traversal
- broad staging

This check must occur **before** the research commit.

---

## 23. Escrow and created-file manifest

**FROZEN IMPLEMENTATION REQUIREMENT.** Preserve the strong v1 escrow architecture with v2 names.

```text
H8_V2_CREATED_MANIFEST_PATH
H8_V2_ESCROW_DIR
```

In GitHub Actions real capture, both must resolve underneath `RUNNER_TEMP` and outside the repository root.

**FIREWALL.** No human CLI override for those paths in `--capture` mode.

Deterministic JSON manifest. Exact top-level key order:

```text
manifest_version
capture_run_utc
files
```

```text
manifest_version = h8-v2-created-manifest-v1
```

`files` is an array in deterministic repository-relative path order. Each entry exact key order:

```text
path
sha256
```

Canonical serialization: `JSON.stringify(value, null, 2) + '\n'`

For zero new files: `files = []`. A rehearsal that qualifies must **not** produce a zero-file manifest.

Every path must be repository-relative and strictly validated. Allowed daily scientific / authorized control patterns only:

```text
^research/h8-v2-prospective/rehearsals/run-[0-9]+\.json$
^research/h8-v2-prospective/observations/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$
^research/h8-v2-prospective/btc-closes/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$
```

**FIREWALL.** Disqualification records and `H8_V2_START.json` must never be generated by `--capture` and must never appear in a daily manifest.

**FIREWALL.** The activation sidecar must never appear in a daily manifest.

Additionally reject: absolute paths, `..`, `.`, backslashes, repeated separators, non-canonical separators, path normalization changes, symlinks, directories, files outside repository root after resolution.

A mere string-prefix check is **not** sufficient.

If real capture later fails before successful research commit: never overwrite anything; remove only **uncommitted** files created by this same invocation from the ephemeral runner when necessary to permit production Git operations; never remove a file that existed before the invocation; never use a broad `rm` on `research/h8-v2-prospective`.

### 23.1 Original created manifest vs landable commit set

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze two distinct concepts.

**A. ORIGINAL CREATED MANIFEST** — `H8_V2_CREATED_MANIFEST_PATH`

This records the complete set of repository artifacts originally created by the authorized capture invocation before escrow.

Once escrow succeeds, this original manifest is **immutable** for the invocation.

Do **NOT** rewrite it. Do **NOT** delete entries from it. It remains evidence of what the capture invocation originally created.

**B. LANDABLE COMMIT SET** — `landableCommitEntries`

After production lands and all post-production / rebase survival checks run, derive a deterministic subset from `originalManifest.files`.

Preserve original repository-relative manifest order. `landableCommitEntries` must be an order-preserving subset of `originalManifest.files`.

No new path may be added. No artifact may be regenerated. No artifact bytes may be changed. No new scientific calculation may occur.

An original manifest entry belongs to `landableCommitEntries` only if **all** artifact-specific requirements still pass immediately before the research commit.

**OBSERVATION entry** — all of:

- artifact SHA256 equals the original manifest entry
- `latest.json` source-survival hash still passes
- target has not been invalidly replaced / intentionally conflicted
- all required H8 identities still pass

**BTC-CLOSE entry** — all of:

- artifact SHA256 equals the original manifest entry
- `btc_price_history.csv` source-survival hash still passes
- target remains create-only compatible
- all required H8 identities still pass

**REHEARSAL entry** — all of:

- artifact SHA256 equals the original manifest entry
- no observation / close source-survival dependency
- all rehearsal identity / path requirements still pass

Invalidated entries are simply **NOT LANDED**. Their original manifest entries remain unchanged outside the repository.

For invalidated score observations: the observation did not successfully land → `CAPTURE_MISSING` under frozen accounting when applicable → never recreate it.

For invalidated BTC closes: the close remains missing → later recovery only through frozen scheduled catch-up rules.

For a rehearsal: a qualifying rehearsal requires its rehearsal artifact itself to land. If the rehearsal artifact is removed from the landable set, the rehearsal does **not** qualify.

The landable set does **not** need to become a new repository artifact. It may be an in-memory / `RUNNER_TEMP` operational structure. If serialized under `RUNNER_TEMP` for transaction safety:

- deterministic canonical JSON
- outside the repository
- no operator path override
- derived mechanically from the immutable original manifest
- must **not** replace or mutate the original manifest

Stage-A implementation review must prove both structures.

### 23.2 Exact staging rule

**FROZEN IMPLEMENTATION REQUIREMENT.**

```text
set(stagedPaths)
  ==
set(landableCommitEntries.paths)

AND

landableCommitEntries
  ⊆
originalManifest.files
```

Require:

- exact individual `git add` arguments
- no wildcard staging
- no extra research path
- no missing landable path
- no path outside the original manifest
- staged artifact SHA256 equals the original manifest entry SHA256

The original created manifest remains the immutable upper bound. No staged path may exist that was not in the original created manifest.

### 23.3 Zero-landable-entry rule

If `landableCommitEntries.length == 0`:

- create **NO** research commit
- push **NO** empty scientific commit
- the H8 scientific transaction for that invocation ends as not landed
- production remains valid

For a prospective score observation originally created in that invocation: it remains unaccepted / `CAPTURE_MISSING` when applicable.

For closes: gaps remain governed by normal future close recovery.

For `NON_STUDY_REHEARSAL`: the scheduled run does **NOT** qualify as a successful rehearsal. No empty commit may satisfy the mandatory rehearsal requirement.

### 23.4 Rebase revalidation and local unpushed commit rebuild

After **every** research rebase or origin-main synchronization of an unpushed research transaction:

1. Revalidate the immutable **original created manifest**. Do **NOT** rewrite it.
2. Recompute `landableCommitEntries` from that original manifest. Do **NOT** regenerate artifact bytes.
3. Compare the newly derived landable set with the artifact paths contained in the current local provisional / rebased research commit.

**CASE A — SET UNCHANGED**

If committed research paths equal current `landableCommitEntries` paths, and all artifact hashes / source-survival / identity checks still pass: the rebased commit may proceed toward final push after all remaining checks.

**CASE B — LANDABLE SET SHRANK**

If one or more previously committed entries are no longer landable:

- **DO NOT** push the current rebased commit
- **DO NOT** merely restage while leaving the old commit unchanged

Staging alone cannot remove an invalid artifact from an already-created commit object.

The current local research commit must be **ABANDONED / REPLACED** before push.

Build a replacement local research commit on top of the current accepted `origin/main` using **ONLY** the current `landableCommitEntries`.

A replacement research commit must satisfy:

- parent is the then-current synchronized main base
- contains only current `landableCommitEntries`
- every included artifact path existed in `originalManifest.files`
- every included artifact byte SHA256 equals its immutable original-manifest SHA256
- no artifact is recalculated
- no artifact is regenerated from market/provider data
- no source value is substituted
- no new scientific path is introduced
- no invalidated path remains in the commit
- original manifest remains unchanged
- exact commit subject remains the frozen subject for that mode
- ordinary genuine runner clock is used
- no `GIT_COMMITTER_DATE`
- no `GIT_AUTHOR_DATE`
- no timestamp preservation from the abandoned commit

It is permissible to restore the exact original escrowed artifact bytes for the surviving landable paths.

This is **COMMIT RECONSTRUCTION**. It is **NOT** scientific recapture.

The replacement commit is a new ordinary Git commit object. Its own genuine committer timestamp applies. For a rehearsal, if that replacement commit ultimately lands and qualifies, **that final commit's committer timestamp is `R`**. No earlier local commit may define `R`.

**CASE C — ZERO LANDABLE AFTER REBASE**

If the revalidated landable set becomes empty:

- abandon the current local research commit
- create **no** replacement commit
- push **no** research commit
- production remains valid

Observation originally created → never landed → `CAPTURE_MISSING` when applicable → never recreate.

BTC close → remains missing → future recovery only through frozen scheduled catch-up.

Rehearsal → does not qualify.

If `origin/main` moves again before the replacement commit successfully pushes: the same frozen reconciliation process repeats. Do **NOT** rerun scientific capture. Do **NOT** regenerate artifact bytes. Do **NOT** mutate the original manifest.

The implementation may impose a finite retry limit. If the transaction ultimately cannot land: **FAIL H8 CLOSED FOR THAT INVOCATION**. Production remains valid. No observation replay.

**FIREWALL.** Never rewrite remote accepted history. Never force push. Never alter a previously pushed H8 scientific commit.

This rebuild authority applies **ONLY** to a local, not-yet-successfully-pushed research transaction from the **same** authorized `run_attempt == 1`.

---

## 24. Research Git policy

**FROZEN IMPLEMENTATION REQUIREMENT.** Fail-closed research Git policy after production lands.

Conceptual sequence:

```text
production lands
→ synchronize origin/main
→ clean tracked state
→ restore escrow
→ derive landable set
→ if zero: stop research transaction
→ stage exact landable set
→ create PROVISIONAL research commit
→ fetch origin/main
→ if unchanged: final commit-content validation / push
→ if moved: rebase / synchronize
→ revalidate landable set
→ if commit contents still equal landable set: continue
→ if landable set shrank: abandon / rebuild local commit (§23.4)
→ repeat bounded reconciliation as needed
→ FINAL push
→ remote reachability / blob verification
```

**NO** merge fallback. **NO** recapture. **NO** force push.

Mechanically:

1. synchronize safely with `origin/main`
2. verify clean tracked state
3. restore exact escrow bytes
4. validate original-manifest hashes against restored escrow bytes
5. derive `landableCommitEntries` from the immutable original manifest (§23.1)
6. if `landableCommitEntries.length == 0`: create **no** research commit; end the scientific transaction as not landed (§23.3)
7. otherwise stage exact landable paths individually
8. verify staged path set equals `landableCommitEntries` paths exactly (§23.2)
9. verify each staged artifact SHA256 equals the original manifest entry SHA256
10. create a **provisional** local research commit **without** `GIT_COMMITTER_DATE` / `GIT_AUTHOR_DATE`
11. fetch current `origin/main`
12. if `origin/main` is unchanged: proceed to final commit-content verification
13. if `origin/main` moved: rebase / synchronize using ordinary `git rebase` and the genuine runner clock. **NO automatic merge fallback**
14. after every rebase / synchronization, apply §23.4:
    - revalidate original manifest (unchanged)
    - recompute landable status
    - **CASE A:** committed paths still equal landable set and checks pass → continue
    - **CASE B:** landable set shrank → abandon the current local commit and rebuild a replacement commit from exact surviving escrow bytes
    - **CASE C:** landable set empty → abandon; create no replacement; push nothing
15. before any push, verify the **actual commit tree/diff**, not merely the index:
    - changed paths in the FINAL local research commit == current `landableCommitEntries` paths exactly
    - for every committed research artifact: commit blob bytes SHA256 == original manifest SHA256
    - no extra path
    - no missing landable path
    - no production path inside the research commit
16. run committer-timestamp integrity checks on that exact final local commit proposed for push (§16.2 / §16.4)
17. push (retries inside the same `run_attempt == 1` may be allowed; never recapture; never force push)
18. fetch origin
19. prove the exact FINAL research commit:
    - exists remotely
    - is reachable from `origin/main`
    - has the expected parent/history relationship after reconciliation
    - contains exactly the final landable research paths
    - contains exact original artifact bytes
    - contains no invalidated artifact

Only then are its artifacts accepted as successfully landed.

For rehearsal qualification, only then may its FINAL commit SHA and final committer timestamp be considered for `R`.

The contract does not freeze one exact Git command sequence. Stage A may use a safe local mechanism such as abandoning/resetting the unpushed research commit, synchronizing to current `origin/main`, restoring exact surviving escrow bytes, staging only landable paths, and creating a new ordinary research commit — or an independently reviewed equivalent — provided the semantic result above holds.

**FIREWALL.** Do not use `git add research`.
**FIREWALL.** Do not use `git add research/h8-v2-prospective`.
**FIREWALL.** Do not use wildcard broad staging.
**FIREWALL.** Never rewrite remote accepted history. Never force push. Never alter a previously pushed H8 scientific commit.
**FIREWALL.** Do not rerun capture to regenerate artifact bytes. Reuse the exact escrowed bytes.

If the transaction ultimately cannot land: **FAIL H8 CLOSED FOR THAT INVOCATION**. Production remains valid. No observation replay.

For a score observation that was originally created but never landed: that date becomes `CAPTURE_MISSING` according to the frozen protocol. Never recreate that observation later.

Future close recovery may still operate according to the frozen close rules.

---

## 25. Same-run observation input

**FROZEN IMPLEMENTATION REQUIREMENT.** At the beginning of a real authorized `--capture` invocation, capture exactly one UTC timestamp:

```text
capture_run_utc = new Date().toISOString()
T               = UTC calendar-date portion of capture_run_utc
```

Use this single value consistently for the invocation.

Immediately before ETL compute, the workflow records:

```text
H8_V2_ETL_STARTED_UTC
```

After ETL, observation input authority is:

```text
public/data/latest.json
```

Require:

```text
H8_V2_ETL_STARTED_UTC
  <= latest.json.as_of_utc
  <= capture_run_utc
```

```text
observation_as_of_utc = latest.json.as_of_utc
observation_date      = UTC date of latest.json.as_of_utc
```

**FIREWALL.** Do not derive observation date from cron date, nominal scheduled date, local date, capture date alone, filename, or workflow-dispatch input.

This preserves delayed-scheduler semantics.

Compute `latest_artifact_sha256` from the exact bytes after `npm run etl:compute` and before capture.

Strictly require from same-run `public/data/latest.json`:

- parses as JSON
- `ok == true`
- `as_of_utc` is a valid offset-aware UTC timestamp
- `model_version == "v1.1.1"`
- `implementation_revision == "integrity-2026-08"`

From verified frozen `config/dashboard-config.json` strictly require:

- `model_version == "v1.1.1"`
- `implementation_revision == "integrity-2026-08"`
- `ssot_version == "2.1.1"`

Also require `latest.model_version == config.model_version` and `latest.implementation_revision == config.implementation_revision`.

If `snapshot_date` is present: require it is consistent with the UTC date of `as_of_utc`. If inconsistent: **STOP observation creation** for this invocation. Do **not** automatically block independently valid BTC-close catch-up.

Record, when an observation is created:

```text
production_model_version           = latest.model_version
production_implementation_revision = latest.implementation_revision
production_ssot_version            = config.ssot_version
source_base_git_sha                = H8_V2_GITHUB_SHA
github_sha                         = H8_V2_GITHUB_SHA
```

### 25.1 Independent write gating after global H8 integrity

**FROZEN IMPLEMENTATION REQUIREMENT.** The frozen scientific protocol governs the observation tape and BTC-close tape separately. After global H8 identity / start / event gates pass, validate the two artifact classes independently.

**GLOBAL H8 INTEGRITY FAILURE** stops **all** H8 v2 writes for the invocation. Examples:

- frozen protocol mismatch
- frozen contract mismatch
- capture-source mismatch
- scientific fingerprint mismatch
- invalid start authorization
- event / attempt gate failure
- runtime implementation identity failure
- initial checkout `HEAD` ≠ `github.sha` at pre-ETL preflight

**OBSERVATION-SPECIFIC INPUT FAILURE** examples:

- `latest.json` malformed
- `latest.json` same-run timestamp invalid
- latest model / implementation mismatch
- required factor structure invalid
- published factor-weight unit mismatch
- observation-specific structural failure

These failures:

- create **NO** score observation
- do **NOT** reconstruct it later
- that opportunity ultimately becomes `CAPTURE_MISSING` when appropriate
- do **NOT** automatically block independently valid BTC-close catch-up

BTC-close catch-up may continue in the same authorized scheduled invocation if:

- global H8 identity / preflight passes
- valid `H8_V2_START.json` exists
- schedule + attempt 1 gate passes
- run date is inside authorized recovery rules
- `btc_price_history.csv` independently passes its required validation

**BTC-CLOSE-SPECIFIC INPUT FAILURE** examples:

- malformed BTC CSV
- duplicate BTC date
- invalid / nonpositive close
- structurally untrustworthy BTC source artifact

These failures:

- create no affected BTC-close artifact(s)
- do **NOT** automatically invalidate an otherwise valid score observation

**FIREWALL.** Do not use one source artifact's structural failure as an automatic reason to discard scientifically independent valid evidence from the other tape.

This does not authorize partial overwrites or reconstruction.

Rehearsal mode does not consume `latest.json` or `btc_price_history.csv` for scientific values. Identity preflight and production landing still apply.

If a later Stage-A design cannot safely land independently valid artifact classes when another class fails source-survival validation: **STOP** during Stage-A review and report the limitation rather than silently changing this contract. Do not invent a performance consequence.

---

## 26. Observation window

**FROZEN SCIENTIFIC REQUIREMENT.** Only after valid start authorization.

Observation opportunities:

```text
S through S+179 inclusive
= exactly 180 UTC calendar dates
```

Authorized score observation only when:

```text
schedule
AND attempt 1
AND actual observation_date within window
```

If scheduled execution never occurs on a date: `CAPTURE_MISSING`.

No reconstruction. No later replay. No `workflow_dispatch` repair. No rerun repair.

A scheduler miss on `S` does **not** invalidate the study if readiness was completed before `S`.

At most one immutable observation artifact may exist for one UTC date. First successfully committed and pushed valid artifact wins.

Outside the window: create no observation. Do not treat mere outside-window as a workflow error.

Before writing, if the target already exists: do not overwrite; if structurally valid, log already-exists and continue only with permitted close-capture processing; if malformed or identity-incompatible: **FAIL CLOSED**. Do not replace it.

---

## 27. Required factor snapshot

**FROZEN IMPLEMENTATION REQUIREMENT.** Required factors, exact scientific order:

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

Production `latest.json` currently publishes factor `weight` / `weight_pct` in **percent units**. Freeze:

```text
expectedPublishedPercent = frozenOfficialDecimalWeight * 100
```

If latest factor `weight` exists: require exact finite numeric equality to `expectedPublishedPercent`.
If `weight_pct` exists: require exact finite numeric equality to `expectedPublishedPercent`.
If both exist: require they also equal each other.

The observation's scientific `official_weight` remains the **decimal** value. Do not store the published percent as the scientific model weight.

A published weight-unit mismatch is structural input failure for H8 capture for that invocation.

For `last_updated_utc`: use the production factor timestamp deterministically. If both `last_utc` and `lastUpdated` exist and are non-null: require equality. For a fresh factor require a valid timestamp. Do not invent one.

---

## 28. Common eligibility

**FROZEN SCIENTIFIC REQUIREMENT.** The three models use the same eligible observation set. No missing-factor renormalization.

**FROZEN IMPLEMENTATION REQUIREMENT.**

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

Do not calculate scientific formula / challenger scores using stale / missing / invalid factors.

---

## 29. Score arithmetic

**FROZEN SCIENTIFIC REQUIREMENT.** Copy the exact frozen protocol model formulas and weights.

JavaScript `Number` semantics. No intermediate rounding.

```text
weighted_sum = sum(score * weight)

score =
  Math.round(
    Math.max(
      0,
      Math.min(100, weighted_sum)
    )
  )
```

All three models produce integer scores in `0–100`.

Official:

```text
trend_valuation = 0.30
stablecoins     = 0.18
etf_flows       = 0.077
net_liquidity   = 0.043
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

Liq-Heavy `liq-heavy-v1` — ratio expressions are the definition:

```text
trend_valuation = 0.25
stablecoins     = 0.18 * (0.35 / 0.30)
etf_flows       = 0.077 * (0.35 / 0.30)
net_liquidity   = 0.043 * (0.35 / 0.30)
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

Mom-Tilted `mom-tilted-v1` — ratio expressions are the definition:

```text
trend_valuation = 0.35
stablecoins     = 0.18 * (0.25 / 0.30)
etf_flows       = 0.077 * (0.25 / 0.30)
net_liquidity   = 0.043 * (0.25 / 0.30)
term_leverage   = 0.20
macro_overlay   = 0.10
social_interest = 0.10
```

**FIREWALL.** Do not replace ratio expressions with independently rounded decimals as the scientific definition.

**FIREWALL.** Do not import `lib/experimentalModel.ts` as the scientific formula implementation.

**FIREWALL.** Cycle and spike remain disabled. Reactivating them is a methodology change.

On an H8 `ELIGIBLE` observation, all seven Official weights participate and Official `totalWeight = 1.00`, so production normalization does not change the weighted sum.

Calculate scientific scores only when `common_eligibility_status = ELIGIBLE`. For `INTEGRITY_MISMATCH`, Official formula is computed for audit; challenger scientific scores remain JSON `null`.

---

## 30. Official same-run integrity

**FROZEN SCIENTIFIC REQUIREMENT.** Official published value:

```text
public/data/latest.json -> composite_score
```

Independently recompute Official from captured factors and frozen Official weights.

Require exact integer equality.

Mismatch:

```text
axis_a_status = INTEGRITY_MISMATCH
```

Do not repair. Do not choose one. Do not calculate challenger scientific scores for that observation.

**FROZEN IMPLEMENTATION REQUIREMENT.** Capture-time Axis A:

```text
if common_eligibility_status != ELIGIBLE:
  axis_a_status = NOT_ELIGIBLE
  official_integrity_status = NOT_COMPUTED
else if official published != official formula:
  axis_a_status = INTEGRITY_MISMATCH
  official_integrity_status = INTEGRITY_MISMATCH
else:
  axis_a_status = ELIGIBLE
  official_integrity_status = MATCH
```

**FIREWALL.** Do **not** calculate Axis B (`OUTCOME_COMPLETE` / `OUTCOME_INCOMPLETE`) during capture. Those belong only to later analysis.

`CAPTURE_MISSING` is **not** written as an observation artifact.

---

## 31. Observation schema

**FROZEN IMPLEMENTATION REQUIREMENT.** Path:

```text
research/h8-v2-prospective/observations/YYYY-MM-DD.json
```

where `YYYY-MM-DD` is exactly `observation_date`.

Create-only writes. Canonical JSON.

Exact deterministic top-level key order:

```text
schema_version
study_id
protocol_version
protocol_sha
capture_contract_version
capture_contract_sha
h8_v2_capture_source_sha
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
scientific_fingerprint
common_eligibility_status
eligibility_reason
official_integrity_status
axis_a_status
factors
official_published_score
official_formula_score
liq_heavy_score
mom_tilted_score
model_versions
model_weight_definitions
```

```text
schema_version  = h8-v2-observation-v1
study_id        = h8-v2-prospective
scheduled_event = DAILY_ETL
protocol_sha    = a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3
```

Require:

```text
source_base_git_sha == github_sha == H8_V2_GITHUB_SHA
```

as defined in §11.1. Later production/research rebases must not rewrite these provenance fields.

`model_versions`:

```text
official   = v1.1.1
liq_heavy  = liq-heavy-v1
mom_tilted = mom-tilted-v1
```

For challenger liquidity factors store both:

```text
definition:       "0.077 * (0.35 / 0.30)"
evaluated_weight: <Number result>
```

The frozen protocol remains the mathematical authority.

Production snapshot BTC price may be omitted from this schema. If later needed for provenance only, it must be clearly labeled non-MACE. Prefer omission in v2 observation schema so rehearsal-score encoding via price is not available here.

**FIREWALL.** Do not include future outcome data in an observation artifact.

### 31.1 Score-presence rules

**FROZEN SCIENTIFIC REQUIREMENT / FROZEN IMPLEMENTATION REQUIREMENT.** This schema uses **fixed fields** and JSON `null` for scientifically absent scores.

**ELIGIBLE**

- all seven factor snapshot values
- published Official
- formula Official
- both challenger scores

**NOT_ELIGIBLE**

- factor snapshot and reason
- no H8 scientific formula/challenger scores
- `official_formula_score`, `liq_heavy_score`, `mom_tilted_score` = JSON `null`
- production published composite may be retained only as clearly labeled production provenance (`official_published_score`); it is **not** an H8 scientific score

**INTEGRITY_MISMATCH**

- factor snapshot
- published Official
- formula Official
- `liq_heavy_score` and `mom_tilted_score` = JSON `null`
- permanently excluded

**CAPTURE_MISSING**

- **NO** later observation artifact is created

**FIREWALL.** Do not serialize `NaN`, `Infinity`, or `undefined`. Do not use string numbers for scores.

---

## 32. BTC close source

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze the same local source architecture used by v1:

```text
public/data/btc_price_history.csv
```

Expected canonical header:

```text
date_utc,close_usd,source,ingested_at_utc
```

Strict parser. Reject:

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

Compute SHA256 of exact source bytes after ETL and before creating any close artifacts.

**FIREWALL.** H8 v2 scientific capture logic must make **ZERO** external data/provider requests. See §37.

No direct Coinbase / CoinGecko / FRED / provider calls.

The ordinary production ETL performs network collection. H8 consumes only the locally produced canonical artifact.

A BTC-close-specific source failure does **not** automatically invalidate an otherwise valid score observation (§25.1).

---

## 33. BTC close window and catch-up

**FROZEN SCIENTIFIC REQUIREMENT.** Only after `H8_V2_START.json` exists.

Required close universe:

```text
S through S+209 inclusive
```

Path:

```text
research/h8-v2-prospective/btc-closes/YYYY-MM-DD.json
```

On authorized scheduled run date `T` consider missing dates `d` in **ascending** order where:

```text
S <= d <= S+209
d <= T-1
target does not already exist
T <= S+217
```

`T` is the UTC date of `capture_run_utc`.

Capture only completed UTC closes.

If a source row is missing/invalid: leave the gap. Do not stop later eligible dates merely because one earlier source date is missing, unless source-file structural corruption makes the whole artifact untrustworthy.

Later qualifying scheduled runs may retry until `S+217`.

After `S+217`: remaining gaps are permanent.

**FIREWALL.** No manual close backfill.
**FIREWALL.** No `workflow_dispatch` recovery.
**FIREWALL.** No rerun recovery.
**FIREWALL.** No overwrite.

First successfully committed authorized value permanently wins.

No MACE in close artifacts.

If the target already exists: do not replace it; do not synchronize to a later production history revision; if malformed or identity-incompatible: **FAIL CLOSED**.

---

## 34. BTC close JSON schema

**FROZEN IMPLEMENTATION REQUIREMENT.** Exact deterministic top-level key order:

```text
schema_version
study_id
protocol_version
protocol_sha
capture_contract_version
capture_contract_sha
h8_v2_capture_source_sha
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

```text
schema_version       = h8-v2-close-v1
study_id             = h8-v2-prospective
source_artifact_path = public/data/btc_price_history.csv
captured_at_utc      = capture_run_utc
```

Require:

```text
source_base_git_sha == github_sha == H8_V2_GITHUB_SHA
```

as defined in §11.1. Later production/research rebases must not rewrite these provenance fields.

**FIREWALL.** No MACE. No score. No forward return. No performance field.

---

## 35. Canonical serialization / create-only

**FROZEN IMPLEMENTATION REQUIREMENT.** Use deterministic serialization:

```text
JSON.stringify(value, null, 2) + '\n'
```

- UTF-8
- LF only
- final LF
- fixed object construction order
- fixed factor order
- no BOM
- no CRLF
- no locale date formatting
- no `NaN`
- no `Infinity`
- no `undefined`

Scientific / rehearsal / control artifacts that this contract treats as create-only use exclusive file creation equivalent to flag `'wx'`.

Never overwrite existing accepted artifacts.

If existing artifact is malformed or identity-incompatible: **FAIL CLOSED**. Do not replace it.

Before accepting a generated artifact: reparse serialized bytes, validate exact schema, validate all scientific identity fields, **then** allow filesystem write.

Build and validate all proposed outputs in memory before writes.

---

## 36. Source-byte survival

**FROZEN IMPLEMENTATION REQUIREMENT.** Clarify source-survival validation **by artifact class**.

Observation artifacts depend on:

```text
public/data/latest.json
```

BTC-close artifacts depend on:

```text
public/data/btc_price_history.csv
```

Rehearsal artifacts depend on neither for scientific values.

Before the separate research commit, and again after any research rebase:

- a new observation artifact hash must still equal the escrow manifest
- that observation's referenced `latest.json` hash must still equal the source bytes used at capture
- a new close artifact hash must still equal the escrow manifest
- that close's referenced `btc_price_history.csv` hash must still equal the source bytes used at capture
- a new rehearsal artifact hash must still equal the escrow manifest

A `latest.json` source-survival failure invalidates the **affected observation** artifact. It does **not** by itself invalidate independently valid close artifacts whose CSV source bytes still match.

A `btc_price_history.csv` source-survival failure invalidates the **affected close** artifacts. It does **not** by itself invalidate an independently valid observation whose `latest.json` source bytes still match.

**FIREWALL.** Do not describe one source as scientific authority for the other class.

Do not recalculate an invalidated research artifact. Do not substitute new values. Do not push an invalidated artifact.

Invalidated entries are omitted from `landableCommitEntries` (§23.1). The original created manifest remains unchanged. Independently valid entries may still land in the same research commit if they remain in the landable set.

If a later Stage-A design cannot safely land independently valid artifact classes when another class fails source-survival validation: **STOP** during Stage-A review and report the limitation rather than silently changing this contract.

Production remains valid. Do not invent a performance consequence.

---

## 37. Network and performance firewalls

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze the distinction between scientific/data-source network use and required Git transport.

### 37.1 Scientific / data-source network firewall

H8 v2 scientific capture logic must make **ZERO** external data/provider requests.

No:

- JavaScript `fetch` for market/provider data
- `http` / `https` provider clients
- `axios` provider calls
- Coinbase requests
- CoinGecko requests
- FRED requests
- any substitute external price/factor provider

The ordinary production ETL remains responsible for external data collection.

H8 consumes the local production artifacts.

**FIREWALL.** Do not weaken the provider-data firewall.

Runtime-file responsibility:

- core / scientific capture logic (`h8-v2-prospective-capture-core.mjs` and scientific portions of the CLI): no provider network clients
- IO layer (`h8-v2-prospective-capture-io.mjs`): ordinary Git transport is allowed **only** for the contract-authorized repository transaction

### 37.2 Git transport is explicitly permitted

Repository synchronization required by the frozen research transaction may use ordinary Git commands such as:

```text
git fetch
git pull --rebase   where this contract authorizes it
git push
```

These Git transport operations are operational repository plumbing. They are **NOT** scientific/data-source network requests.

### 37.3 Performance firewall

**FIREWALL.** No performance implementation:

- MACE
- future returns
- Spearman
- Pearson correlation
- rank calculations
- delta rho
- hit rates
- AUC
- quintiles
- rolling performance
- band performance

Rehearsal must also calculate zero scientific scores.

Calibration remains **CLOSED**.

References in comments explaining prohibited functionality are okay.

**FIREWALL.** No imported H7.2 outcome-analysis engine.

---

## 38. Instrumentation

**FROZEN IMPLEMENTATION REQUIREMENT.** Freeze simple counters useful for independent review:

```text
networkRequests
rehearsalFilesCreated
observationFilesCreated
closeFilesCreated
filesWritten
overwriteAttempts
scientificScoresCalculated
performanceCalculations
```

Expected universally:

```text
networkRequests = 0
overwriteAttempts = 0
performanceCalculations = 0
```

```text
networkRequests = 0
```

means:

```text
external scientific/data-provider requests made by H8 capture logic = 0
```

It must **NOT** count required Git transport operations (`git fetch` / authorized `git pull --rebase` / `git push`).

For `NON_STUDY_REHEARSAL`:

```text
rehearsalFilesCreated        = 1
observationFilesCreated      = 0
closeFilesCreated            = 0
scientificScoresCalculated   = 0
performanceCalculations      = 0
filesWritten                 = 1
```

The rehearsal must prove the NON-EMPTY research path.

`--contract-check` and `--validate-start-candidate` must keep `filesWritten = 0`.

---

## 39. Synthetic test contract

**FROZEN IMPLEMENTATION REQUIREMENT.** The future Stage-A test suite must cover at least the following. Later Stage-A implementation review determines PASS/FAIL objectively against this list.

**A. Identities**

- exact protocol SHA / blob / worktree hash-object pass
- wrong protocol document blob fails
- exact capture-contract identity after freeze
- exact scientific fingerprint
- wrong `factors/` tree fails
- wrong Trend blob fails
- changed runtime bytes fail
- ordinary `public/data` changes do not count as scientific fingerprint change

**B. Capture-source activation**

- missing / malformed sidecar fails real capture
- source SHA not ancestor fails
- later `HEAD` allowed when runtime bytes unchanged
- v1 sidecar presence causes block

**C. Event gate**

- `workflow_dispatch` block
- rerun `attempt > 1` block
- local capture block
- `schedule` + attempt `1` required for writes

**D. Pre-start state machine**

- pre-start rehearsal automatic arming when activated and no live candidate
- no second rehearsal while candidate awaits review
- readiness expiry arms next scheduled rehearsal
- explicit operational rejection / merged disqualification permits next rehearsal
- valid start file permanently disables rehearsal mode

**E. Rehearsal artifact**

- contains no score / outcome / price / performance fields
- rehearsal manifest non-empty
- does not self-certify future commit / push / `R`

**F. Committer-timestamp integrity**

- `GIT_COMMITTER_DATE` causes fail closed
- `GIT_AUTHOR_DATE` causes fail closed
- manufactured future committer timestamp rejected
- final post-rebase commit is the only `R` candidate
- pre-rebase commit cannot define `R`
- failed / unpushed commit cannot define `R`
- remote reachability required
- same-second legitimate commit passes the whole-second lower bound
- one genuinely earlier whole second fails the lower bound
- manufactured future timestamp fails the upper bound
- `R` equals the exact stored Git committer instant and is not shifted by the 120-second tolerance
- timestamp-integrity checks apply to the final local commit proposed for push
- a replacement commit is re-checked; abandoned timestamps do not apply
- `R` is derived only after final successful push / reachability

**G. Research Git**

- clean-worktree requirement catches unexpected tracked changes
- exact research staging only
- no merge fallback in research Git phase
- escrow hash mismatch fails
- `latest.json` source-byte mutation after production sync invalidates the observation artifact only
- `btc_price_history.csv` source-byte mutation after production sync invalidates close artifacts only
- original created manifest remains unchanged when one entry becomes invalid
- observation fails source survival while valid close remains landable
- close fails source survival while valid observation remains landable
- staged paths equal the landable set, not the original full manifest
- landable set can never add a path absent from the original manifest
- artifact SHA must still equal the original manifest SHA
- all entries invalid => no research commit
- invalid rehearsal entry => no qualifying rehearsal
- rebase can shrink the landable set without regenerating bytes
- original manifest remains immutable across revalidation
- full manifest all-valid lands all entries
- observation-only landing
- close-only landing
- landable subset preserves original manifest hashes
- no new path can appear in the landable set
- rebase with unchanged landable set preserves valid final commit contents
- rebase shrinking an observation+close set does NOT push the old full commit
- shrinking set causes replacement of the local provisional commit, not mere restaging
- replacement commit contains only surviving landable entries
- replacement artifact bytes equal original manifest hashes
- abandoned local commit is never treated as accepted
- abandoned rehearsal commit cannot define `R`
- replacement rehearsal commit, if finally pushed, is the only `R` candidate
- second origin movement repeats reconciliation without recapture
- zero landable after rebase => no replacement commit / no push
- final commit diff equals the landable set exactly
- no force push
- no rewrite of previously pushed scientific history

**H. Start authorization**

- start schema validation
- qualifying rehearsal identity
- mechanical `S` derivation around date/time boundaries
- 72-hour rule boundary (exact equality allowed; 1 ms over not allowed)
- `S-1` 11:00 UTC authorization deadline
- expired readiness
- one-shot immutable start file
- main-entry time, not creation-commit time, governs lead time
- `--capture` cannot create the start file
- main-entry first parent lacks the start file
- main-entry contains the exact accepted blob
- second parent equals `H8_V2_START_SHA`
- `H8_V2_START_SHA` adds exactly one path
- later start-file modification fails
- delete / re-add fails
- PR `merged_at` / merge-commit timestamp sanity passes when within 5 minutes
- PR `merged_at` / merge-commit timestamp sanity fails when outside 5 minutes
- failed cross-check does not redefine `start_authorization_merge_time`
- proposed / unmerged start failure can be rejected before merge
- missing `S-1` deadline before merge => readiness expiry / new rehearsal
- post-merge `merged_at` cross-check failure => terminal H8 v2 stop
- post-merge topology / blob failure => terminal H8 v2 stop
- no second start file after a merged invalid start authorization
- runtime validates Git-contained start provenance
- external GitHub `merged_at` is not falsely treated as locally derivable
- no environment / manual override can mark independent review as passed

**I. Observation semantics**

- delayed scheduled run crossing UTC midnight
- observation actual-date semantics from `latest.json.as_of_utc`
- common eligibility
- Official score match
- integrity mismatch
- null score rules
- duplicate observation target
- no Axis B calculation at capture

**J. Closes**

- close catch-up ascending order
- close recovery endpoint `T <= S+217`
- `d <= T-1`
- malformed CSV
- duplicate CSV date
- first-authorized-value immutability

**K. Firewalls**

- provider/data network call is prohibited
- `networkRequests` remains `0` for scientific/data-provider requests
- ordinary required `git fetch` / `git push` is permitted
- Git transport does not increment scientific `networkRequests`
- no performance (`performanceCalculations = 0`)
- production / research separation
- no CLI date / force / backfill override
- no default mode

**L. Tape independence**

- `latest.json` structural failure blocks observation but permits valid close catch-up
- BTC CSV structural failure blocks closes but permits valid observation when all observation requirements pass
- global scientific identity failure blocks both

**M. Source-checkout provenance**

- initial `HEAD` must equal `github.sha`
- `source_base_git_sha` remains original `github.sha` after production rebase
- `source_base_git_sha` remains original `github.sha` after research rebase
- rehearsal `source_checkout_sha` has the same original-checkout meaning

---

## 40. Compatible capture-only successor

**FROZEN SCIENTIFIC REQUIREMENT.** A later capture-only defect **MAY** be eligible for a successor capture-contract version under the **same** v2 scientific protocol only if independent review proves:

- no scientific fingerprint byte changes
- no model formula changes
- no weights change
- no factor semantics change
- no eligibility-rule change
- no observation reconstruction
- no missed-date repair

Any dates missed during an outage remain permanently missing.

If compatibility cannot be proven: **STOP H8 v2** and require a successor study.

---

## 41. What this freeze pass does and does not do

This freeze-only pass modifies **only**:

```text
docs/H8_V2_CAPTURE_IMPLEMENTATION_CONTRACT.md
```

It converts the accepted capture-contract candidate into a visibly frozen contract. It does **not** change implementation requirements or scientific methodology.

It does **not**:

- assign `H8_V2_CAPTURE_CONTRACT_SHA` inside this document
- assign `H8_V2_CAPTURE_SOURCE_SHA` / `H8_V2_START_SHA`
- implement capture machinery
- edit `.github/workflows/daily-etl.yml`
- create v2 runtime files
- edit historical v1 capture scripts
- modify H8 v1 protocol, contract, or stop-record documents
- recreate the v1 activation sidecar
- create `research/h8-v2-prospective/`
- choose `S`
- create `H8_V2_START.json`
- create a rehearsal, observation, or BTC close
- calculate MACE, Spearman, or any performance statistic
- tune weights
- reopen calibration

The next authorized phases after independent freeze verification are:

```text
STAGE-A IMPLEMENTATION
→ STAGE-B ACTIVATION
→ REAL SCHEDULED NON-STUDY REHEARSAL
→ START AUTHORIZATION
→ PROSPECTIVE STUDY
```

---

## 42. Stop

**STOP FOR INDEPENDENT H8 V2 CAPTURE-CONTRACT FREEZE VERIFICATION.**

Do not implement capture machinery in this pass.
Do not select a study start date in this pass.
Do not reactivate H8 v1.
Do not calculate performance.
Do not open a PR until independent freeze verification accepts the freeze commit.
