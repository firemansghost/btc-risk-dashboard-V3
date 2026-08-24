# H8 v1 Start Failure — 2026-08-24

**Status:** `STOPPED BEFORE SUCCESSFUL STUDY START`

This document is a historical postmortem / stop record only.

- It is **not** a replacement preregistration.
- It is **not** a protocol amendment.
- It is **not** a new capture contract.
- It is **not** a performance document.

No H8 performance claims are made here.

---

## Frozen identities

These identities remain historically recorded. Deleting the activation sidecar does **not** change them.

| Item | Value |
|---|---|
| `H8_PROTOCOL_SHA` | `85fb5bcbdb5c6d04333a3a9516629851efd890eb` |
| `H8_CAPTURE_CONTRACT_SHA` | `811359afc572c86aa3d2d8732a1efd2c72b9df8f` |
| `H8_CAPTURE_SOURCE_SHA` | `8406b14f344a3c8805b6931ced55ac0d607af611` |

The historical H8 v1 capture-source identity `8406b14f344a3c8805b6931ced55ac0d607af611` remains permanently recorded in prior Git history and in this stop record.

---

## Authorized scheduled run

| Field | Value |
|---|---|
| GitHub Actions run | `32722436285` |
| event | `schedule` |
| run_attempt | `1` |
| date | `2026-08-24` |

H8 v1's fixed scheduled observation window began `2026-08-24`. This run was the authorized first-attempt scheduled capture for that date.

---

## Capture result

The capture step generated an ephemeral proposed observation. It was never successfully committed or pushed.

| Field | Value |
|---|---|
| observationDate | `2026-08-24` |
| observationSkipped | `false` |
| observationFilesCreated | `1` |
| closeFilesCreated | `0` |
| filesWritten | `1` |
| networkRequests | `0` |
| performanceCalculations | `0` |

Proposed but unaccepted file:

```text
research/h8-prospective/observations/2026-08-24.json
```

Reported ephemeral SHA256:

```text
515c8fe0d3af9f983780d808faebf3b280eea0bcbd63b9104ca32f46b1d19963
```

That file must never be recreated. It is not an accepted immutable H8 observation.

---

## Failure

The production commit successfully landed as:

```text
f4a8cee87d47027d1d6d5eacf36f31e973c516d9
```

The separate H8 scientific phase then failed closed because:

```text
git pull --rebase origin main
```

refused the worktree due to unstaged tracked `node_modules` changes created by `npm ci`.

The production Git phase had merge fallback. The H8 scientific rebase correctly failed closed.

---

## Root cause summary

Tracked vendored `node_modules` remained in Git despite `.gitignore` rules. `npm ci` replaced the stale committed dependency tree, leaving tracked `node_modules` modifications/deletions outside the production staging roots (`public/data`, `public/signals`, `public/extras`, `public/alerts`).

---

## Scientific consequence

- The proposed observation never became an accepted immutable H8 observation.
- No score observation may be reconstructed or replayed for `2026-08-24`.
- H8 v1 does not restart on a later date.
- Accepted observation tape remains empty.
- Accepted close tape remains empty.
- No performance analysis occurred.
- Calibration remains **CLOSED**.
- A later H8 version requires a new prospective start date.

Therefore:

- accepted H8 v1 observations = ZERO
- accepted H8 v1 BTC-close artifacts = ZERO
- H8 v1 performance = NONE
- H8 v1 is scientifically **STOPPED BEFORE SUCCESSFUL STUDY START**
