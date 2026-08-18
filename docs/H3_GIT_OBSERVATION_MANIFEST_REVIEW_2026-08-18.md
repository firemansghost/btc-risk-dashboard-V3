# GhostGauge H3 Git Observation Manifest Review

**Date:** 2026-08-18
**Phase:** H3 — forensic review / design only
**Audited `origin/main`:** `ed8293a32b4d496e3eaaf294194b953680197da4`
**Branch:** `review/h3-git-observation-manifest`

**Status:** Design record. **No manifest CSV was built.** Calibration gate remains **CLOSED**.

Labels used below:

- **FACT** — verified from Git objects reachable from this `origin/main`, or from H1/H1.1 records that this audit re-checked
- **INFERENCE** — reasonable reading of topology/messages where Git does not fully prove intent
- **RECOMMENDATION** — proposed H3.1 contract
- **UNKNOWN** — not established

H1 / H1.1 remain authoritative provenance constraints. This audit **does not reopen** the Sep 26 sibling split, the reconstructed `history.csv` prefix, or the frozen Aug 16 / Aug 17 boundary. It **does** flag one H1 wording that Git now contradicts (observational-tail dates 2025-10-07..28 were produced, then lost at a merge).

---

## 1. Executive verdict

**FACT.** Current `public/data/history.csv` is the wrong source for a research-grade observation manifest. The contemporaneous G-Score evidence lives in Git `public/data/latest.json` blobs.

**FACT.** Default `git log -- public/data/latest.json` is **not** a complete artifact inventory. History simplification omits blobs that were committed and later discarded by merge resolution (including `e9083962` G47 and the entire 2025-10-07..28 scheduled `latest.json` series). H3.1 **must** walk `git log --full-history origin/main -- public/data/latest.json`.

**FACT (this audit, `--full-history`):**

| Universe | Count |
|---|---|
| Commits that touch `latest.json` | **511** |
| Distinct `latest.json` blobs | **452** |
| Introducing commits (first occurrence of each blob by commit timestamp) | **452** |
| Carry-forward / duplicate-blob commits | **59** (58 merges carrying an already-seen blob; 1 non-merge duplicate) |
| `EXCLUDED_RECONSTRUCTION` introducing blob | **1** (`68462f34`, blob `1ae65b8d…`, `latest.json` **G67**) |
| Reconstruction merge carry | **1** (`a02a1a56`, identical blob `1ae65b8d…`) |
| `UNCERTAIN` invalid JSON (unresolved conflict markers) | **2** (`961b50c6`, `9e5b3332`) |
| `ACCEPTED_CONTEMPORANEOUS` introducing artifacts | **449** |
| Unique accepted observation dates | **327** |
| Dates with >1 accepted distinct blob | **27** |
| Earliest accepted date | **2025-09-15** |
| Latest accepted date | **2026-08-18** |

**FACT.** No accepted `latest.json` observation date is earlier than H1’s earliest proven contemporaneous artifact (`3d11cce2`, 2025-09-15). The 365-day forward-horizon constraint stands: **n = 0**.

**FACT — Sep 26 (required H3.1 assertion).**

- **ACCEPTED** contemporaneous candidate: `e9083962fcac56e305dff66810b9c5a7fceed394`, blob `f77f7e0dcd5aa1beaeab22c4e3403b0eca2e5652`, **G47 Hold/Neutral**, price `108739.09`, `as_of_utc` `2025-09-26T11:19:04.150Z`.
- **EXCLUDED** reconstruction path: `68462f34` / merge `a02a1a56` (same `latest.json` blob `1ae65b8d…`). That blob’s **headline score is G67 Begin Scaling Out**, not G85. **G85 High Risk** is the reconstructed `history.csv` row on the same path (`2025-09-26,85,High Risk,109108.44`). A future daily analytical view **must not** silently substitute reconstructed **G85** (or reconstruction-path **G67**) for contemporaneous **G47**.

**FACT — missing-date recovery.** Git recovers **defensible scheduled `latest.json` artifacts for all 22** `history.csv` observational-tail dates **2025-10-07 through 2025-10-28**. Those rows **were** in `history.csv` on their ETL commits and were **dropped** when merge `1e27313f` (2025-10-29) kept `54d054b1`’s sparse file (jump `2025-10-06` → `2025-10-29`). **Do not write them back to `history.csv`.** They belong in the research manifest only.

**RECOMMENDATION.** Build an **immutable artifact-event manifest** first (one row per distinct introducing `latest.json` blob). Derive a **daily analytical view** second. Prefer a scheduled Daily ETL artifact when one exists for that UTC date; do not collapse to “last write wins.”

---

## 2. Git artifact discovery method

**FACT.** Inspected path: `public/data/latest.json` on commits reachable from `origin/main` = `ed8293a32b4d496e3eaaf294194b953680197da4`.

**FACT.** Two inventories differ:

| Command | Commits | Distinct blobs |
|---|---|---|
| `git log origin/main -- public/data/latest.json` (default simplification) | 423 | 422 |
| `git log origin/main --full-history -- public/data/latest.json` | **511** | **452** |

**FACT.** Default simplification omitted at least:

- `e9083962` (Sep 26 G47) — sibling discarded by merge `a02a1a56`
- scheduled ETL commits 2025-10-07..28 — file versions discarded by merge `1e27313f`

**RECOMMENDATION — H3.1 discovery algorithm**

1. `git rev-list --full-history origin/main -- public/data/latest.json`
2. For each commit: record SHA, parent SHAs, `%aI` UTC, author, subject, `git rev-parse <commit>:public/data/latest.json`
3. Compare blob vs each parent blob (missing parent path = first introduction)
4. Sort by `commit_timestamp_utc` ascending, then SHA
5. **Introducing commit** = earliest commit that contains that blob SHA
6. Later identical blobs = `DUPLICATE_BLOB` or `MERGE_CARRY_FORWARD`, not a second observation
7. Parse JSON from `git cat-file -p <blob>` only; fail loudly on conflict markers / invalid JSON
8. Pin `source_main_sha` in builder output
9. No network, no ETL, no `history.csv` scores as the score source

**FACT.** A Git commit is not automatically a new observation. 59 of 511 touches reused an already-introduced blob.

**INFERENCE.** `chore(etl): update artifacts [skip ci]` by `ghostgauge-bot` is the scheduled Daily ETL writer. Human `firemansghost` commits that rewrite `latest.json` are manual / feature-bundled snapshots. Author alone does not prove validity.

---

## 3. latest.json schema evolution

**FACT.** There is no single stable schema. `ssot_version` **never** appears on `latest.json` in this inventory (H1 already recorded this). `raw_score` as a top-level field was **not** found. Early `composite` and later `composite_score` are the headline score. `band` is sometimes `{name,lo,hi}` and later `{key,label,range,...}`. Price is `price_usd` early, then `btc.spot_usd`.

Narrative eras (micro-changes collapsed). These are **schema eras**, not proven methodology eras.

| Schema era | Commit / date range | Present | Absent / uncertain | Normalization |
|---|---|---|---|---|
| **S0 seed, no factors** | `3d11cce2` 2025-09-15 | `version`, `updated_at`, `price_usd`, `composite`, `band` object, `pillars` | `as_of_utc`, `factors[]`, `model_version` field (seed uses `version` = `v3.0.0`), health | **LIMITED** — map `composite`→score, `updated_at`→legacy timestamp, `band.name`→band |
| **S1 factors + `updated_at`** | 2025-09-15 (`53ede5a6`) → ~2025-09-18 | S0 + `factors[]` (8; `key,label,pillar,weight,score,status,reason` ± `details`) | `as_of_utc`, `health`, `ok` | **YES** for score/band/price/factors; observation date from `updated_at` |
| **S2 invalid conflict objects** | `961b50c6` 2025-09-16; `9e5b3332` 2025-09-28 | Git blob contains `<<<<<<<` | Not parseable JSON | **NO** — keep identity, class `UNCERTAIN` |
| **S3 `as_of_utc` + health + `composite_score`** | `aecc6698` 2025-09-18 → 2025-10-29 | `ok`, `as_of_utc`, `composite_score`, `composite_raw`, `band`, `health`, `factors`, `btc`, `provenance`, `model_version` (`v3.1.0`) | `snapshot_date`, `implementation_revision`, `ssot_version` | **YES** — preferred observation time = `as_of_utc`; price = `btc.spot_usd` |
| **S4 7 factors, onchain removed** | `54d054b1` 2025-10-29 → 2025-12-10 | S3 with **7** factors | onchain factor | **YES**; do not invent an onchain score |
| **S5 labeled `v1.1`** | `6082a0f7` 2025-12-11 → 2026-05-06 | `model_version=v1.1`; `version` key often dropped | `snapshot_date`, `implementation_revision` | **YES** for label; **NOT** a proven methodology start (H1) |
| **S6 `daily_close_date`** | ~`348382d6` 2026-05-07 → 2026-08-16 | S5 + `daily_close_date` | `snapshot_date`, `implementation_revision` | **YES**; still prefer `as_of_utc` for observation time unless H3.1 proves otherwise |
| **S7 v1.1.1** | `db789cd9` 2026-08-17 → `3e0c07ff` 2026-08-18 | `snapshot_date`, `implementation_revision=integrity-2026-08`, `model_version=v1.1.1` | `ssot_version` still absent from artifact | **YES** — observation date = `snapshot_date` |

**FACT.** `git log -G model_version -- public/data/latest.json` (H1) still holds: labeled `model_version` appears `v3.1.0` then `v1.1` then `v1.1.1`. Seed used `version` = `v3.0.0`.

**RECOMMENDATION.** Store native field names plus normalized columns. Do not rename historical `composite` to `raw_score` unless the JSON actually has `raw_score`. Preserve `composite_raw` separately when present.

---

## 4. Artifact identity / deduplication rules

**FACT.** Distinct content ≈ distinct blob SHA. 452 blobs across 511 commits.

**RECOMMENDATION — canonical identity for H3.1**

- **Content identity:** `latest_blob_sha` (Git blob SHA of `public/data/latest.json`)
- **Provenance identity:** `introducing_commit_sha` = earliest commit (by `commit_timestamp_utc`, then SHA) whose tree contains that blob
- **Row key:** `artifact_id = latest_blob_sha`

  Optional readable alias: `introducing_commit_sha` (unique for introducing rows)

Do **not** use “commit SHA of every touch” as the observation id. That would double-count `a02a1a56` as a second reconstruction observation.

**FACT / rules**

| Case | Rule |
|---|---|
| Single-parent commit, new blob vs parent | Introducing artifact |
| Single-parent commit, identical blob vs parent | `DUPLICATE_BLOB` / carry-forward; not an observation |
| Merge, blob equals parent 1 or parent 2 | `MERGE_CARRY_FORWARD`; record both parent blob comparisons |
| Merge, blob equals neither parent | Introducing (conflict resolution wrote new JSON). If JSON invalid → `UNCERTAIN` |
| Identical blob later on another branch | Same `artifact_id`; additional commits are sightings, not new artifacts |
| Bot vs human | Not a validity test. Validity = parseable contemporaneous semantics + class |

**RECOMMENDATION.** Keep a **sighting log** (optional, 511 rows) separate from the **artifact manifest** (452 rows, then class filters).

---

## 5. Candidate artifact inventory

**FACT — H1 anchors re-checked**

| Anchor | Result |
|---|---|
| Earliest contemporaneous `latest.json` | **FACT** `3d11cce2` 2025-09-15, G47, `updated_at` 2025-09-15T21:08:21.493Z, `version` v3.0.0, **no `factors[]`**. Seeded `history.csv` 2025-09-05..14 are **not** separate `latest.json` artifacts. |
| Sep 26 sibling split | **FACT** confirmed (see §7 and §20) |
| Observational tail not calendar-contiguous in **current** `history.csv` | **FACT** remains true at HEAD |
| First `latest.json` `model_version=v1.1` | **FACT** `6082a0f7` 2025-12-11. Not a methodology start. |
| Last verified v1.1 | **FACT** `0032a729` 2026-08-16 G54 Hold & Wait |
| First verified v1.1.1 | **FACT** `db789cd9` 2026-08-17 G47 Moderate Buying, delayed recovery print |

**FACT.** Introducing-author mix (452 blobs): `ghostgauge-bot` 345, `firemansghost` 102, `github-actions[bot]` 5. `[skip ci]` on 350 introducing commits.

**RECOMMENDATION.** Candidate universe for analysis = `ACCEPTED_CONTEMPORANEOUS` introducing blobs (449). Reconstruction and invalid JSON remain in the manifest with exclusion fields populated.

---

## 6. Same-date multiple-artifact cases

**FACT.** **27** UTC observation dates have more than one **accepted** distinct introducing blob. H3.1 must not pick a silent winner.

Selected high-stakes dates (not the full 27-row dump):

| Date | n (accepted) | Scores | Notes |
|---|---|---|---|
| 2025-09-15 | 8 | 39, 44, 40, 38, 47, … | Seed `3d11cce2` G47 plus same-day human/ETL iterations. **INFERENCE:** development day, not 8 independent market prints. |
| 2025-09-16 | 6 | 53, 50, … | Includes invalid conflict blob `961b50c6` (**UNCERTAIN**, not in accepted n). |
| 2025-09-17 | 14 | 49–54 | Dense human feature commits |
| 2025-09-26 | 5 accepted + 1 excluded recon | 47, 50, 53, 67, 73 | See §7 / §20. Scheduled G47 vs reconstruction-path G67 vs later human G73/G53/G50 |
| 2025-10-05 | 16 | 61–65 | Many same-day rewrites |
| **2025-10-29** | 3 | **55 and 57** | Scheduled `5c4535b2` **G55** 11:21Z vs human `54d054b1` **G57** 15:42Z vs `983e04df` G57. Merge `1e27313f` kept G57 blob **and** dropped Oct 7–28 `history.csv` |
| 2025-12-11 | 3 | 52, 50 | Includes first `v1.1` label print `6082a0f7` vs earlier same-day `v3.1.0` (`ec1b931b` per H1) |
| 2026-03-25 | 2 | 58, 50 | Message: regenerate after keyed-merge fix |
| 2026-05-07 | 8 | 46, 47 | Same-day ETL repeats |

**RECOMMENDATION.** Commit-type labels (only when evidence supports them):

| Label | Evidence |
|---|---|
| `scheduled` | `ghostgauge-bot` + `chore(etl): update artifacts` + `[skip ci]` |
| `manual` | human author rewriting `latest.json` in a feature/fix commit |
| `recovery` | independently documented delayed print (Aug 17 `db789cd9`) |
| `merge` | merge commit that **introduces** a new blob |
| `reconstruction` | `68462f34` blob / `a02a1a56` carry |
| `unknown` | otherwise |
| `invalid_conflict` | unresolved `<<<<<<<` in blob |

If cause is not proven, use **UNKNOWN** / `unknown`.

---

## 7. Known reconstruction / exclusion cases

**FACT — Sep 26 topology (H1, re-verified)**

```
48c2c677 (21-row history, latest.json G49 as_of 2025-09-25)
    ├─ e9083962 11:19Z  scheduled  latest.json G47   history +row G47
    └─ 68462f34 12:30Z  reconstruction branch
            └─ a02a1a56 12:32Z  merge kept 68462f34 latest.json blob
```

| Path | `latest.json` | `history.csv` 2025-09-26 |
|---|---|---|
| `e9083962` | **G47 Hold/Neutral** 108739.09 | **G47 Hold/Neutral** 108739.09 |
| `68462f34` / `a02a1a56` | **G67 Begin Scaling Out** 109137.61 | **G85 High Risk** 109108.44 |

**FACT.** Reconstruction **latest.json ≠ reconstructed history.csv row**. Excluding the reconstruction **path** protects both G67 (artifact) and G85 (CSV). H3.1 daily view must not use either as the contemporaneous Sep 26 print.

**FACT — Oct 29 merge loss (new vs H1 wording)**

- Parent 2 `5c4535b2` (scheduled 11:21Z): `latest.json` **G55**; `history.csv` **contiguous through 2025-10-28** then 2025-10-29 G55.
- Parent 1 `54d054b1` (human 15:42Z): `latest.json` **G57**; `history.csv` jumps **2025-10-06 → 2025-10-29 G57** (30/30 + onchain-off bundled with the artifact).
- Merge `1e27313f` kept parent 1 files.

**INFERENCE.** HEAD `history.csv` gaps 2025-10-07..28 are **merge resolution**, not “ETL never ran.” Class those 22 `latest.json` blobs `ACCEPTED_CONTEMPORANEOUS` / `scheduled`. Do **not** call the gap an ETL failure. Do **not** patch production `history.csv` in H3/H3.1.

**FACT — invalid JSON**

- `961b50c6` 2025-09-16 — conflict markers in `latest.json`
- `9e5b3332` 2025-09-28 — conflict markers in `latest.json`

Keep SHA/blob, class `UNCERTAIN`, reason `unresolved_merge_conflict_markers`.

**FACT.** Seeded `history.csv` 2025-09-05..14 remain **EXCLUDED_SEEDED** as *daily publications*. They are not `latest.json` artifacts. The seed **artifact** is the single 2025-09-15 `3d11cce2` snapshot.

---

## 8. Missing-date Git recovery findings

Compare H1 Appendix A observational-tail missing `history.csv` dates vs accepted `latest.json` observation dates.

**FACT — recovered (22 dates).** Each has a scheduled `ghostgauge-bot` `[skip ci]` introducing blob ~11:17–11:21Z:

| Date | Commit (short) | Score | Band |
|---|---|---|---|
| 2025-10-07 | `dc935557` | 54 | Hold & Wait |
| 2025-10-08 | `644ac9f3` | 59 | Hold & Wait |
| 2025-10-09 | `26d731f9` | 59 | Hold & Wait |
| 2025-10-10 | `a6a2e785` | 58 | Hold & Wait |
| 2025-10-11 | `6825e3cd` | 56 | Hold & Wait |
| 2025-10-12 | `f6b18489` | 57 | Hold & Wait |
| 2025-10-13 | `e51a518d` | 60 | Hold & Wait |
| 2025-10-14 | `67049177` | 58 | Hold & Wait |
| 2025-10-15 | `7458993c` | 61 | Hold & Wait |
| 2025-10-16 | `778cbd12` | 63 | Hold & Wait |
| 2025-10-17 | `33668089` | 59 | Hold & Wait |
| 2025-10-18 | `7d7d8141` | 59 | Hold & Wait |
| 2025-10-19 | `21e77f36` | 60 | Hold & Wait |
| 2025-10-20 | `02796b83` | 61 | Hold & Wait |
| 2025-10-21 | `3fa06ba4` | 62 | Hold & Wait |
| 2025-10-22 | `6464ee83` | 61 | Hold & Wait |
| 2025-10-23 | `699695ec` | 61 | Hold & Wait |
| 2025-10-24 | `42772751` | 60 | Hold & Wait |
| 2025-10-25 | `43cb664b` | 60 | Hold & Wait |
| 2025-10-26 | `04a775aa` | 60 | Hold & Wait |
| 2025-10-27 | `271aaa52` | 60 | Hold & Wait |
| 2025-10-28 | `01abb8c4` | 58 | Hold & Wait |

**FACT.** Example: `dc935557` is an ancestor of `origin/main` and its `history.csv` **contains** `2025-10-07,54,Hold & Wait,124377.49`. HEAD `history.csv` does not. Cause: merge `1e27313f` (§7).

**FACT — still unrecovered vs H1 Appendix A.B (11 dates).** No accepted `latest.json` observation date found:

2026-01-14, 2026-03-06, 2026-03-29, 2026-03-30, 2026-04-04, 2026-04-05, 2026-04-06, 2026-04-12, 2026-05-25, 2026-06-01, 2026-06-20.

**UNKNOWN** why those 11 dates lack a `latest.json` artifact. Not classified as ETL failures.

**FACT.** Reconstructed-region `history.csv` holes 2024-06-21 and 2025-04-17 have **no** contemporaneous `latest.json` (no GhostGauge artifacts exist that early). Irrelevant to Git recovery of publications.

**RECOMMENDATION.** Research-manifest observation set **expands** H1’s 10-date 2025-09-27..10-28 window to **32 dates**. Production `history.csv` stays unchanged.

---

## 9. Observation-date semantics

**Do not assume commit date = observation date.**

**RECOMMENDATION — field hierarchy (evidence-driven)**

| Priority | `observation_date_source` | When |
|---|---|---|
| 1 | `snapshot_date` | S7 (2026-08-17+) when field present |
| 2 | `as_of_utc` (UTC calendar date of timestamp) | S3–S6 |
| 3 | `legacy_timestamp` | `updated_at` / `generated_at` / `timestamp` (S0–S1) |
| 4 | `daily_close_date` | only if 1–3 absent (**not** preferred while `as_of_utc` exists) |
| 5 | `commit_date_fallback` | only if JSON has no usable timestamp — **weaker evidence**, flag explicitly |
| 6 | `unknown` | invalid JSON |

Also store:

- `artifact_commit_utc` = introducing commit `%aI` (always)
- `observation_as_of_utc` = best instant (`snapshot` midnight is **not** an instant; use `as_of_utc` when present)

**FACT.** This audit used that hierarchy. Conflict blobs fell through to commit-date fallback and were then excluded as `UNCERTAIN`.

---

## 10. Artifact classification contract

**RECOMMENDATION — vocabulary**

| Class | Meaning |
|---|---|
| `ACCEPTED_CONTEMPORANEOUS` | Distinct parseable `latest.json` blob introduced in Git at/near observation time; not reconstruction-path excluded blob |
| `EXCLUDED_RECONSTRUCTION` | `68462f34` blob and any carry (`a02a1a56`) |
| `EXCLUDED_SEEDED` | Not a `latest.json` class; applies to `history.csv` 2025-09-05..14 only |
| `DUPLICATE_BLOB` | Non-merge commit repeating an already-introduced blob |
| `MERGE_CARRY_FORWARD` | Merge whose `latest.json` blob equals a parent blob |
| `UNCERTAIN` | Invalid JSON / conflict markers / unparseable schema required field |

Every excluded/uncertain row **keeps** `latest_blob_sha`, `introducing_commit_sha`, `exclusion_reason`, and evidence pointers.

`selection_status` on the **event** manifest should stay `UNSELECTED` until a derived daily view marks `DAILY_PRIMARY` / `DAILY_ALTERNATE`.

`deployment_status` = `UNKNOWN` unless a future pass proves Vercel served that blob. Git existence is not deployment proof.

`evidence_grade` (align H1): **B** typical committed artifact; **A** reserved for frozen v1.1.1 official prints as *Git evidence of what was committed*; **C** reconstruction path; **U** conflict/unknown.

---

## 11. Artifact-event vs daily-view analysis

**FACT.** 449 accepted artifacts span 327 dates (mean ~1.4 artifacts/date; tail of 14–16 on some 2025-09 days). Collapsing first **destroys** auditability.

| Option | Reproducible? | Look-ahead | Operational meaning | Bias | Missing dates / recovery | Forward returns |
|---|---|---|---|---|---|---|
| 1 First valid of UTC date | Yes | Low | Often a morning/dev snapshot | Favors incomplete prints (Sep 15 G39 before seed G47) | Keeps recovered Oct dates if first is scheduled | Can use pre-revision scores |
| 2 Last valid of UTC date | Yes | **High** | “Final git write” | Favors human post-hoc mixer/weight edits (Oct 29 G57 over scheduled G55) | Same | Mixes publication with later same-day revision |
| 3 Scheduled ETL if present; else explicit fallback | Yes | Medium | Matches Daily ETL intent | Bot schedule ~11:19Z; misses documented recoveries if too strict | Recovers Oct 7–28 | Best alignment with “what ETL published that morning” |
| 4 No daily collapse | Yes | N/A | Event study / intraday | None from collapse | Full | Must define event time ≠ date |
| 5 Deployment-confirmed only | **No today** | Low | Live site | Almost empty (`UNKNOWN`) | Drops almost everything | Not viable |

**RECOMMENDATION (verified, matches expected direction):**

1. **Immutable artifact-event manifest** is the base (Option 4 stored).
2. **Derived daily analytical view** uses **Option 3**:
   - If ≥1 `scheduled` accepted artifact exists for `observation_date`, select the **earliest `observation_as_of_utc`** among those scheduled artifacts.
   - Else select the **earliest** remaining `ACCEPTED_CONTEMPORANEOUS` artifact by `observation_as_of_utc`.
   - Never select `EXCLUDED_RECONSTRUCTION` or `UNCERTAIN`.
   - Sep 26 daily primary = `e9083962` G47 even if later same-day human blobs exist.
   - Oct 29 daily primary = `5c4535b2` G55 (scheduled), with G57 retained as same-date alternates.
   - Aug 17 is `recovery` not `scheduled`; fallback still accepts `db789cd9` as the only accepted artifact that date.

Record `daily_rule_version` on the derived file so the rule can change without rewriting the event manifest.

---

## 12. Factor-extraction feasibility

**FACT.** Do **not** use `factor_history.csv` as the authoritative factor source (H1 sample prefix Grade D).

**FACT.** `latest.json` `factors[]` exists from `53ede5a6` (2025-09-15) onward except:

- seed `3d11cce2` (pillars only)
- 2 conflict blobs
- onchain member removed from 2025-10-29 (`54d054b1`) — 8 factors → 7

**FACT.** Common factor fields when present: `key`, `label`, `pillar`, `weight` and/or `weight_pct`, `score`, `status`, `reason`, sometimes `details`, `last_utc`, later provenance objects.

**RECOMMENDATION.** Yes — H3.1 should emit **two** research tables:

- A. artifact observations

- B. factor observations (`artifact_id × factor_key`)

Omit fields the source blob lacks (empty, not `0`). Factor extraction is **impossible** for S0 seed and `UNCERTAIN` blobs; **inconsistent** for onchain across S3 vs S4.

**INFERENCE.** `last_utc` / provenance timestamps are source observation times when present; they are not guaranteed frozen vendor payloads (H1).

---

## 13. Proposed research storage layout

**RECOMMENDATION.** Non-production only. Do **not** put research manifests under `public/data/**` or `public/signals/**`.

```text
research/historical-observations/
  README.md
  artifact_manifest.csv          # immutable event table (H3.1)
  artifact_sightings.csv         # optional: 511 commit touches
  factor_manifest.csv            # artifact_id × factor
  daily_analytical_view.csv      # derived; never overwrite event table
  SOURCE_MAIN_SHA.txt
  BUILDER_VERSION.txt

scripts/research/
  build-git-observation-manifest.mjs   # Git objects only; not implemented in H3
```

H3 **did not create** these paths.

---

## 14. Proposed artifact manifest schema

**RECOMMENDATION.** One row per introducing blob. CSV empty field = null. Numeric `0` only if JSON number is `0`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `artifact_id` | string | no | = `latest_blob_sha` |
| `latest_blob_sha` | string | no | Git blob |
| `artifact_commit_sha` | string | no | = introducing commit |
| `introducing_commit_sha` | string | no | same as artifact_commit_sha on this table |
| `parent_sha` | string | yes | parent 1; merges also fill `parent2_sha` |
| `parent2_sha` | string | yes | |
| `commit_timestamp_utc` | string | no | `%aI` |
| `commit_author` | string | no | |
| `commit_message` | string | no | |
| `observation_date` | string | yes | `YYYY-MM-DD` |
| `observation_as_of_utc` | string | yes | instant |
| `observation_date_source` | enum | no | see §9 |
| `score` | number | yes | `composite_score` else `composite` |
| `composite_raw` | number | yes | native `composite_raw` only |
| `raw_score` | number | yes | only if JSON has `raw_score` (currently unused) |
| `band` | string | yes | `band.label` or `band.name` |
| `price_usd` | number | yes | `price_usd` or `btc.spot_usd` |
| `model_version` | string | yes | `model_version` else seed `version` |
| `implementation_revision` | string | yes | S7 only |
| `ssot_version` | string | yes | expect empty historically |
| `health_status` | string | yes | |
| `ok` | bool/empty | yes | |
| `factor_count` | number | yes | |
| `successful_factor_count` | number | yes | |
| `artifact_class` | enum | no | §10 |
| `evidence_grade` | string | no | |
| `selection_status` | string | no | `UNSELECTED` on event table |
| `exclusion_reason` | string | yes | required if not accepted |
| `commit_type` | enum | no | scheduled/manual/recovery/merge/reconstruction/unknown/invalid_conflict |
| `deployment_status` | string | no | `UNKNOWN` unless proven |
| `source_main_sha` | string | no | pinned audit SHA |
| `builder_version` | string | no | |

---

## 15. Proposed factor manifest schema

**RECOMMENDATION.** One row per `artifact_id × factor_key` when `factors[]` parses.

| Column | Type | Notes |
|---|---|---|
| `artifact_id` | string | |
| `artifact_commit_sha` | string | |
| `observation_date` | string | |
| `factor_key` | string | |
| `factor_label` | string | empty if absent |
| `factor_score` | number | empty if null/excluded; **never coerce null→0** |
| `factor_weight_pct` | number | from `weight_pct` or `weight` if that was percent; **do not guess** — store native `factor_weight_native` + `factor_weight_unit` if mixed |
| `factor_status` | string | |
| `source_observation_time` | string | `last_utc` / provenance source time if present |
| `source_fetch_time` | string | only if a distinct fetch timestamp exists |
| `model_version` | string | copied from artifact |
| `implementation_revision` | string | copied when present |

Do not promise `ssot_version` or `implementation_revision` on pre-S7 rows.

---

## 16. Candidate counts by audit period

Audit periods are **not** proven model eras.

Accepted contemporaneous introducing artifacts only (excludes reconstruction blob and 2 invalid JSON blobs).

| Period | Artifacts | Unique dates | Notes |
|---|---|---|---|
| 2025-09-15 .. 2025-09-26 | **71** | **12** | Includes Sep 26 G47; excludes G67 reconstruction blob. Seeded 09-05..14 have no `latest.json` rows. |
| 2025-09-27 .. 2025-10-28 | **80** | **32** | H1 `history.csv` had 10 dates; Git recovers 22 more (07..28) |
| 2025-10-29 .. 2025-12-10 | **45** | **43** | Includes Oct 29 G55 and G57; onchain dropped in this window |
| 2025-12-11 .. 2026-08-16 | **251** | **238** | Labeled `v1.1`; start unverified |
| 2026-08-17 onward | **2** | **2** | Frozen v1.1.1 |
| **Total** | **449** | **327** | |

Universe extras: commits 511; blobs 452; recon intro 1; recon carry 1; duplicate/carry 59; uncertain 2.

---

## 17. Forward-horizon eligible counts only

**Convention (H1, unchanged):** canonical completed BTC market-history coverage ends **2026-08-17**. Observation date `D` is eligible for horizon `N` iff `D + N days` (UTC calendar) ≤ `2026-08-17`.

**Population:** unique **accepted** `observation_date` values (n_dates = 327). **No returns. No averages.**

| Horizon | Latest eligible `D` | **n** |
|---|---|---|
| 30d | 2026-07-18 | **296** |
| 90d | 2026-05-19 | **239** |
| 180d | 2026-02-18 | **156** |
| 365d | 2025-08-17 | **0** |

**FACT.** Earliest accepted GhostGauge date remains **2025-09-15**. `2025-09-15 + 365d` = 2026-09-15, after the market series end. **No genuine observation has a completed 365-day forward outcome.** H1 is not contradicted on this point. October Git recovery does not create a pre-2025-09-15 print.

---

## 18. H3.1 deterministic builder plan

**RECOMMENDATION.** Yes — a local builder under `scripts/research/`.

Requirements:

- Git objects only (`cat-file` / `rev-parse` / `rev-list --full-history`)
- no network APIs, no ETL, no current-factor recomputation
- no `history.csv` as score source
- deterministic sort: `commit_timestamp_utc`, `sha`
- stable CSV (quoted RFC4180)
- explicit `artifact_class` / `exclusion_reason`
- fail loudly on required-schema unknowns and on `<<<<<<<`
- record `builder_version` and `source_main_sha`
- emit event table first, daily view second with `daily_rule_version`

**Not implemented in H3.**

---

## 19. Explicit non-goals

H3 did **not** and H3.1 must **not** by default:

- modify `public/data/**` or `public/signals/**`
- rewrite `history.csv` with recovered October rows
- recompute historical G-Scores
- call live market APIs
- calculate returns, drawdowns, or hit rates
- start calibration or select weights/bands
- treat Git as Vercel deployment proof
- collapse silently to one row per day without a versioned derived view
- substitute Sep 26 G85 or reconstruction G67 for `e9083962` G47
- use `factor_history.csv` as the factor SSOT
- reopen H1 reconstruction-prefix grading for 2023-09-25..2025-09-25 `history.csv`

---

## 20. Open questions

1. **UNKNOWN:** live Vercel serving of any recovered blob (including Oct 7–28 and `e9083962`).
2. **UNKNOWN:** whether Oct 29 G57 (`54d054b1`) should ever be a *descriptive* same-day alternate in studies of the 30/30 cutover — it is a bundled code+artifact print, not scheduled ETL.
3. **INFERENCE / open:** same-day human blobs after scheduled ETL (Sep 26 G73, May 7 repeats) — retain on event table; daily rule excludes them from primary.
4. **UNKNOWN:** why 11 post-2026-01 `history.csv` holes have no `latest.json` candidate.
5. **UNKNOWN:** exact `weight` vs `weight_pct` unit on every schema micro-era — H3.1 must record native fields.
6. **H1 wording vs Git:** H1 said observational-tail missing dates were “never filled.” Git shows 2025-10-07..28 **were filled then merge-dropped**. Flag for H1.x doc correction; do not change production artifacts here.

---

## 21. H3.1 recommendation

1. Implement `scripts/research/build-git-observation-manifest.mjs` against a pinned main SHA using `--full-history`.
2. Write `research/historical-observations/artifact_manifest.csv` (452 blob rows, classes applied) and `factor_manifest.csv`.
3. Derive `daily_analytical_view.csv` with **Option 3** (scheduled earliest `as_of_utc`, else earliest accepted).
4. Hard-code the Sep 26 assertion below as a builder invariant test.
5. Include Oct 7–28 scheduled artifacts in the research set; **leave `history.csv` untouched**.
6. Leave `deployment_status=UNKNOWN`.
7. Keep the calibration gate **CLOSED**.

### Required future H3.1 assertion (Sep 26)

For observation date **2025-09-26**:

- **ACCEPTED** contemporaneous candidate: `e9083962fcac56e305dff66810b9c5a7fceed394` — **G47 Hold/Neutral** (`latest.json` blob `f77f7e0dcd5aa1beaeab22c4e3403b0eca2e5652`, price 108739.09).
- **EXCLUDED** reconstruction: `68462f345a075d56ad1f697722f16b35abc89262` / `a02a1a56ae87f974370851e6ede03f2ab7cf6f5d` path — `latest.json` **G67** (blob `1ae65b8d78659543b177d31774793ca46645946c`) and reconstructed `history.csv` **G85 High Risk**.

A future daily analytical view **must not** silently substitute G85 (or reconstruction-path G67) for the contemporaneous G47 artifact.

---

## Related

- [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)
- [`docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md`](HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md)
- [`docs/MODEL_ERAS.md`](MODEL_ERAS.md)
- [`docs/HISTORY_UI_PROVENANCE_REVIEW_2026-08-18.md`](HISTORY_UI_PROVENANCE_REVIEW_2026-08-18.md)
