# GhostGauge H3 Git Observation Manifest Review

**Date:** 2026-08-18
**Phase:** H3 — forensic review / design only
**Audited `origin/main`:** `ed8293a32b4d496e3eaaf294194b953680197da4`
**Branch:** `review/h3-git-observation-manifest`
**Reviewed design HEAD (pre-correction):** `0737ce8e8b490c7a04daf51b539eafd765056ccd`

**Status:** Design record. **No manifest CSV was built.** Calibration gate remains **CLOSED**.
This revision tightens the H3.1 contract after independent review. Forensic Git counts and verified topology findings are unchanged.

Labels used below:

- **FACT** — verified from Git objects reachable from this `origin/main`, or from H1/H1.1 records that this audit re-checked
- **INFERENCE** — reasonable reading of topology/messages where Git does not fully prove intent
- **RECOMMENDATION** — proposed H3.1 contract
- **UNKNOWN** — not established

H1 / H1.1 remain authoritative provenance constraints. This audit **does not reopen** the Sep 26 sibling split, the reconstructed `history.csv` prefix, or the frozen Aug 16 / Aug 17 boundary. It **does** flag one H1 wording that Git now contradicts (observational-tail dates 2025-10-07..28 were produced, then lost at a merge). **Do not modify H1/H1.1 documents on this branch.**

---

## 1. Executive verdict

**FACT.** Current `public/data/history.csv` is the wrong source for a research-grade observation manifest. The contemporaneous G-Score evidence lives in Git `public/data/latest.json` blobs.

**FACT.** Default `git log -- public/data/latest.json` is **not** a complete artifact inventory. History simplification omits blobs that were committed and later discarded by merge resolution (including `e9083962` G47 and the entire 2025-10-07..28 scheduled `latest.json` series). H3.1 **must** walk `git log --full-history origin/main -- public/data/latest.json`.

**FACT (this audit, `--full-history`):**

| Universe | Count | How to read it |
|---|---|---|
| Full-history path sightings (`latest.json` commits) | **511** | Git topology rows; **mandatory** sighting table |
| Distinct `latest.json` blobs | **452** | Distinct artifact **content** |
| Later duplicate / carry-forward appearances | **59** | 58 merges carrying an already-seen blob; 1 non-merge duplicate. Timestamp-first-seen snapshot; H3.1 classifies via parent-blob comparison |
| Reconstruction-path content blob | **1** (`68462f34`, blob `1ae65b8d…`, `latest.json` **G67**) | Plus merge carry `a02a1a56` (same blob; sighting, not a second content row) |
| Uncertain invalid JSON | **2** (`961b50c6`, `9e5b3332`) | Conflict markers |
| Parseable non-reconstruction distinct **candidate** artifacts | **449** | Git evidence universe, **not** the final analytical sample |
| Unique **candidate** observation dates | **327** | Same: candidate universe, not daily-primary n |
| Candidate dates with >1 distinct parseable non-reconstruction blob | **27** | Includes development-heavy days |
| Earliest candidate date | **2025-09-15** | |
| Latest candidate date | **2026-08-18** | |

**FACT.** No candidate `latest.json` observation date is earlier than H1’s earliest proven contemporaneous artifact (`3d11cce2`, 2025-09-15). The 365-day forward-horizon constraint stands: **candidate n = 0**.

**FACT — Sep 26 (required H3.1 assertion).**

- **COMMITTED_CONTEMPORANEOUS_CANDIDATE** and **ELIGIBLE_SCHEDULED** / **DAILY_PRIMARY:** `e9083962fcac56e305dff66810b9c5a7fceed394`, blob `f77f7e0dcd5aa1beaeab22c4e3403b0eca2e5652`, **G47 Hold/Neutral**, price `108739.09`, `as_of_utc` `2025-09-26T11:19:04.150Z`.
- **EXCLUDED_RECONSTRUCTION / INELIGIBLE_RECONSTRUCTION** path: `68462f34` / merge `a02a1a56` (same `latest.json` blob `1ae65b8d…`). That blob’s **headline score is G67 Begin Scaling Out**, not G85. **G85 High Risk** is the reconstructed `history.csv` row on the same path (`2025-09-26,85,High Risk,109108.44`). A future daily analytical view **must not** silently substitute reconstructed **G85** (or reconstruction-path **G67**) for contemporaneous **G47**.

**FACT — missing-date recovery.** Git recovers **defensible scheduled `latest.json` artifacts for all 22** `history.csv` observational-tail dates **2025-10-07 through 2025-10-28**. Those rows **were** in `history.csv` on their ETL commits and were **dropped** when merge `1e27313f` (2025-10-29) kept `54d054b1`’s sparse file (jump `2025-10-06` → `2025-10-29`). **Do not write them back to `history.csv`.** They belong in the research manifests only.

**RECOMMENDATION.** H3.1 must emit **three** layers: (A) mandatory 511-row Git sighting manifest, (B) 452-row distinct artifact-content manifest, (C) derived daily analytical view that **never** overwrites A or B. A parseable Git blob is **not** automatically a daily primary. Daily Rule v1 is conservative: scheduled ETL, else documented recovery, else documented manual production print, else **NO_DAILY_PRIMARY / REVIEW_REQUIRED**. Do not maximize sample size by promoting human feature/development snapshots.

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
3. Compare blob vs **each parent blob** (missing parent path = new vs that parent)
4. Emit **one sighting row per path-history commit** (expected H3 snapshot: **511**)
5. Classify `sighting_class` from parent comparisons (see §4), **not** from “first time this SHA was seen in a timestamp sort” alone
6. Build the 452-row content table from distinct `latest_blob_sha`
7. `canonical_artifact_commit_sha` = deterministic representative among introducing sightings for that blob: earliest `commit_timestamp_utc`, then SHA
8. Parse JSON from `git cat-file -p <blob>` only; fail loudly on conflict markers / invalid JSON
9. Pin `source_main_sha` in builder output
10. No network, no ETL, no `history.csv` scores as the score source

**FACT.** A Git commit is not automatically a new observation. 59 of 511 H3 path-history commits reused a blob already present earlier in timestamp order.

**INFERENCE.** `chore(etl): update artifacts [skip ci]` by `ghostgauge-bot` is the scheduled Daily ETL writer. Human `firemansghost` commits that rewrite `latest.json` are often feature-bundled snapshots. Author identity alone does not prove analytical validity or a production refresh.

---

## 3. latest.json schema evolution

**FACT.** There is no single stable schema. `ssot_version` **never** appears on `latest.json` in this inventory (H1 already recorded this). `raw_score` as a top-level field was **not** found. Early `composite` and later `composite_score` are the headline score. `band` is sometimes `{name,lo,hi}` and later `{key,label,range,...}`. Price is `price_usd` early, then `btc.spot_usd`.

Narrative eras (micro-changes collapsed). These are **schema eras**, not proven methodology eras.

| Schema era | Commit / date range | Present | Absent / uncertain | Normalization |
|---|---|---|---|---|
| **S0 seed, no factors** | `3d11cce2` 2025-09-15 | `version`, `updated_at`, `price_usd`, `composite`, `band` object, `pillars` | `as_of_utc`, `factors[]`, `model_version` field (seed uses `version` = `v3.0.0`), health | **LIMITED** — map `composite`→score, `updated_at`→legacy timestamp, `band.name`→band |
| **S1 factors + `updated_at`** | 2025-09-15 (`53ede5a6`) → ~2025-09-18 | S0 + `factors[]` (8; `key,label,pillar,weight,score,status,reason` ± `details`) | `as_of_utc`, `health`, `ok` | **YES** for score/band/price/factors; observation date from `updated_at` |
| **S2 invalid conflict objects** | `961b50c6` 2025-09-16; `9e5b3332` 2025-09-28 | Git blob contains `<<<<<<<` | Not parseable JSON | **NO** — keep identity, class `UNCERTAIN_INVALID_JSON` |
| **S3 `as_of_utc` + health + `composite_score`** | `aecc6698` 2025-09-18 → 2025-10-29 | `ok`, `as_of_utc`, `composite_score`, `composite_raw`, `band`, `health`, `factors`, `btc`, `provenance`, `model_version` (`v3.1.0`) | `snapshot_date`, `implementation_revision`, `ssot_version` | **YES** — preferred observation time = `as_of_utc`; price = `btc.spot_usd` |
| **S4 7 factors, onchain removed** | `54d054b1` 2025-10-29 → 2025-12-10 | S3 with **7** factors | onchain factor | **YES**; do not invent an onchain score |
| **S5 labeled `v1.1`** | `6082a0f7` 2025-12-11 → 2026-05-06 | `model_version=v1.1`; `version` key often dropped | `snapshot_date`, `implementation_revision` | **YES** for label; **NOT** a proven methodology start (H1) |
| **S6 `daily_close_date`** | ~`348382d6` 2026-05-07 → 2026-08-16 | S5 + `daily_close_date` | `snapshot_date`, `implementation_revision` | **YES**; still prefer `as_of_utc` for observation time unless H3.1 proves otherwise |
| **S7 v1.1.1** | `db789cd9` 2026-08-17 → `3e0c07ff` 2026-08-18 | `snapshot_date`, `implementation_revision=integrity-2026-08`, `model_version=v1.1.1` | `ssot_version` still absent from artifact | **YES** — observation date = `snapshot_date` |

**FACT.** `git log -G model_version -- public/data/latest.json` (H1) still holds: labeled `model_version` appears `v3.1.0` then `v1.1` then `v1.1.1`. Seed used `version` = `v3.0.0`.

**RECOMMENDATION.** Store native field names plus normalized columns. Do not rename historical `composite` to `raw_score` unless the JSON actually has `raw_score`. Preserve `composite_raw` separately when present.

---

## 4. Artifact identity, sightings, and canonical representative

**FACT.** Distinct content ≈ distinct blob SHA. 452 blobs across 511 path-history commits.

**RECOMMENDATION — three mandatory layers**

| Layer | File | Row grain | H3 snapshot |
|---|---|---|---|
| **A. Git sighting manifest** | `artifact_sightings.csv` | one row per `--full-history` path sighting | **511** (required, not optional) |
| **B. Artifact content manifest** | `artifact_manifest.csv` | one row per distinct `latest.json` blob | **452** |
| **C. Daily analytical view** | `daily_analytical_view.csv` | derived selection only | never overwrite A or B |

A merge that carries an already-existing identical blob **must remain visible in A**. It **must not** become a second row in B.

### 4.1 Canonical identity vs introducing sightings

**RECOMMENDATION**

- **Content identity / row key:** `artifact_id = latest_blob_sha`
- **Canonical representative:** `canonical_artifact_commit_sha` = deterministic pick among **introducing sightings** for that blob (earliest `commit_timestamp_utc`, then commit SHA)
- **Introducing sighting:** a path-history commit whose `latest.json` blob **differs from every parent blob** that exists (or whose parent lacks the path). This is parent-relative Git evidence, **not** proof that the timestamp-earliest commit was the only topological introduction
- A blob **may** be introduced independently on sibling branches. Keep **all** introducing sightings in table A. Do **not** erase non-canonical introducing sightings. Table B still has **one** row per blob

H3’s 452 “first timestamp occurrence” count is a **deterministic canonical-representative snapshot**, not a claim that each blob has exactly one Git-topological introduction. H3.1 must recompute introducing vs carry using parent-blob flags. If that pass finds multiple introducing sightings for one blob, table A keeps them all; table B still has 452 content rows.

Do **not** use “commit SHA of every touch” as the artifact id. That would double-count `a02a1a56` as a second reconstruction **content** row. The merge **sighting** stays in table A as `MERGE_CARRY_FORWARD`.

### 4.2 Proposed sighting manifest schema

**RECOMMENDATION.** One row per full-history path sighting. CSV empty field = null.

| Column | Type | Null | Notes |
|---|---|---|---|
| `sighting_id` | string | no | deterministic: `commit_sha` (path is fixed) |
| `commit_sha` | string | no | |
| `commit_timestamp_utc` | string | no | `%aI` |
| `commit_author` | string | no | |
| `commit_message` | string | no | |
| `latest_blob_sha` | string | no | blob at this commit |
| `artifact_id` | string | no | = `latest_blob_sha` |
| `parent1_sha` | string | yes | |
| `parent1_latest_blob_sha` | string | yes | empty if parent lacks the path |
| `parent2_sha` | string | yes | empty if not a merge |
| `parent2_latest_blob_sha` | string | yes | |
| `is_new_blob_vs_parent1` | bool | no | true if parent1 missing path or blob differs |
| `is_new_blob_vs_parent2` | bool/empty | yes | empty if no parent2 |
| `sighting_class` | enum | no | see below |
| `canonical_artifact_commit_sha` | string | no | representative for this blob (same on every sighting of the blob) |
| `source_main_sha` | string | no | pinned audit SHA |
| `builder_version` | string | no | |

**RECOMMENDATION — `sighting_class`**

| Class | Meaning |
|---|---|
| `INTRODUCING_SIGHTING` | Single-parent (or first parent only): blob is new vs parent1 |
| `DUPLICATE_BLOB` | Non-merge: blob identical to parent1 |
| `MERGE_CARRY_FORWARD` | Merge: blob equals parent1 and/or parent2 (already-existing content remains visible here) |
| `MERGE_NEW_BLOB` | Merge: blob equals neither parent |
| `INVALID_OR_UNKNOWN` | Unparseable JSON / conflict markers / required comparison failed |

Parent-blob comparisons decide introducing vs carry. Timestamp sort only breaks ties for `canonical_artifact_commit_sha`.

---

## 5. Candidate artifact inventory

**FACT — H1 anchors re-checked**

| Anchor | Result |
|---|---|
| Earliest contemporaneous `latest.json` | **FACT** `3d11cce2` 2025-09-15, G47, `updated_at` 2025-09-15T21:08:21.493Z, `version` v3.0.0, **no `factors[]`**. Seeded `history.csv` 2025-09-05..14 are **not** separate `latest.json` artifacts. |
| Sep 26 sibling split | **FACT** confirmed (see §7 and §21) |
| Observational tail not calendar-contiguous in **current** `history.csv` | **FACT** remains true at HEAD |
| First `latest.json` `model_version=v1.1` | **FACT** `6082a0f7` 2025-12-11. Not a methodology start. |
| Last verified v1.1 | **FACT** `0032a729` 2026-08-16 G54 Hold & Wait |
| First verified v1.1.1 | **FACT** `db789cd9` 2026-08-17 G47 Moderate Buying, delayed recovery print |

**FACT.** Canonical-representative author mix (452 blobs, timestamp-first-seen): `ghostgauge-bot` 345, `firemansghost` 102, `github-actions[bot]` 5. `[skip ci]` on 350 of those representative commits.

**RECOMMENDATION.** Treat **449** parseable non-reconstruction distinct blobs as **COMMITTED CANDIDATE ARTIFACTS** (Git evidence). Reconstruction and invalid JSON remain in tables A/B with exclusion fields populated. Do **not** treat 449 or 327 as the final daily analytical sample.

---

## 6. Same-date multiple-artifact cases

**FACT.** **27** UTC observation dates have more than one **parseable non-reconstruction** distinct blob. H3.1 must not pick a silent winner.

Selected high-stakes dates (not the full 27-row dump):

| Date | n (candidate blobs) | Scores | Notes |
|---|---|---|---|
| 2025-09-15 | 8 | 39, 44, 40, 38, 47, … | Seed `3d11cce2` G47 plus same-day human/ETL iterations. **INFERENCE:** development-heavy day, not 8 independent market prints. Daily Rule v1: do **not** auto-promote a human development blob. Select a scheduled print only if H3.1 proves `ELIGIBLE_SCHEDULED`; else **NO_DAILY_PRIMARY / REVIEW_REQUIRED**. |
| 2025-09-16 | 6 | 53, 50, … | Includes invalid conflict blob `961b50c6` (`UNCERTAIN_INVALID_JSON`, not in candidate n). Development-heavy. Same conservative daily rule. |
| 2025-09-17 | 14 | 49–54 | Dense human feature commits. Development-heavy. Same conservative daily rule. |
| 2025-09-26 | 5 candidates + 1 excluded recon | 47, 50, 53, 67, 73 | See §7 / §21. Scheduled G47 is **DAILY_PRIMARY**. Reconstruction G67 / history G85 are not. Later human blobs remain evidence, not primary. |
| 2025-10-05 | 16 | 61–65 | Many same-day rewrites. Development-heavy. Same conservative daily rule. |
| **2025-10-29** | 3 | **55 and 57** | Scheduled `5c4535b2` **G55** 11:21Z vs human `54d054b1` **G57** 15:42Z vs `983e04df` G57. Merge `1e27313f` kept G57 blob **and** dropped Oct 7–28 `history.csv`. Daily primary = scheduled G55. |
| 2025-12-11 | 3 | 52, 50 | Includes first `v1.1` label print `6082a0f7` vs earlier same-day `v3.1.0` (`ec1b931b` per H1) |
| 2026-03-25 | 2 | 58, 50 | Message: regenerate after keyed-merge fix |
| 2026-05-07 | 8 | 46, 47 | Same-day ETL repeats |

**RECOMMENDATION — operational role** (`operational_role`; evidence-driven, not author-as-validity):

| Role | Evidence |
|---|---|
| `scheduled_etl` | `ghostgauge-bot` **and** `chore(etl): update artifacts` **and** `[skip ci]` |
| `verified_recovery` | Independently documented delayed production print (Aug 17 `db789cd9`) |
| `verified_manual_refresh` | **Only** when evidence explicitly shows a user-triggered **production** refresh. Do **not** apply this label to ordinary human feature/fix commits that happen to rewrite `latest.json` |
| `human_feature_commit` | Human source/feature/fix commit containing a `latest.json` rewrite |
| `merge` | Merge commit (content may be carry or `MERGE_NEW_BLOB`) |
| `reconstruction` | `68462f34` blob / `a02a1a56` carry |
| `invalid_conflict` | Unresolved `<<<<<<<` in blob |
| `unknown` | otherwise |

If cause is not proven, use **UNKNOWN** / `unknown`. Author identity alone never establishes analytical validity.

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

**FACT.** Reconstruction **latest.json ≠ reconstructed history.csv row**. Excluding the reconstruction **path** protects both G67 (artifact) and G85 (CSV). H3.1 daily view must not use either as the contemporaneous Sep 26 print. The `a02a1a56` merge remains a **sighting** (`MERGE_CARRY_FORWARD`) of the G67 blob.

**FACT — Oct 29 merge loss (new vs H1 wording)**

- Parent 2 `5c4535b2` (scheduled 11:21Z): `latest.json` **G55**; `history.csv` **contiguous through 2025-10-28** then 2025-10-29 G55.
- Parent 1 `54d054b1` (human 15:42Z): `latest.json` **G57**; `history.csv` jumps **2025-10-06 → 2025-10-29 G57** (30/30 + onchain-off bundled with the artifact).
- Merge `1e27313f` kept parent 1 files.

**INFERENCE.** HEAD `history.csv` gaps 2025-10-07..28 are **merge resolution**, not “ETL never ran.” Class those 22 `latest.json` blobs `COMMITTED_CONTEMPORANEOUS_CANDIDATE` / `scheduled_etl` / `ELIGIBLE_SCHEDULED`. Do **not** call the gap an ETL failure. Do **not** patch production `history.csv` in H3/H3.1.

**FACT — invalid JSON**

- `961b50c6` 2025-09-16 — conflict markers in `latest.json`
- `9e5b3332` 2025-09-28 — conflict markers in `latest.json`

Keep SHA/blob, evidence class `UNCERTAIN_INVALID_JSON`, eligibility `INELIGIBLE_INVALID`, reason `unresolved_merge_conflict_markers`. Sighting class `INVALID_OR_UNKNOWN`.

**FACT.** Seeded `history.csv` 2025-09-05..14 remain **EXCLUDED_SEEDED** as *daily publications*. They are **not** `latest.json` artifacts and are **not** rows in the 452-blob table. The seed **artifact** is the single 2025-09-15 `3d11cce2` snapshot (`human_feature_commit` / development-era; not automatically a daily primary).

---

## 8. Missing-date Git recovery findings

Compare H1 Appendix A observational-tail missing `history.csv` dates vs candidate `latest.json` observation dates.

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

**FACT — still unrecovered vs H1 Appendix A.B (11 dates).** No candidate `latest.json` observation date found:

2026-01-14, 2026-03-06, 2026-03-29, 2026-03-30, 2026-04-04, 2026-04-05, 2026-04-06, 2026-04-12, 2026-05-25, 2026-06-01, 2026-06-20.

**UNKNOWN** why those 11 dates lack a `latest.json` artifact. Not classified as ETL failures. Daily view: **NO_DAILY_PRIMARY** (no committed candidate), which is distinct from a date that has only development blobs.

**FACT.** Reconstructed-region `history.csv` holes 2024-06-21 and 2025-04-17 have **no** contemporaneous `latest.json` (no GhostGauge artifacts exist that early). Irrelevant to Git recovery of publications.

**RECOMMENDATION.** Research **candidate** dates in 2025-09-27..10-28 expand H1’s 10-date `history.csv` window to **32 candidate dates**. Production `history.csv` stays unchanged. After H3 merge and **before** analytical use of H3.1 outputs, perform a **narrow canonical documentation correction** of the H1 statements that describe these 22 dates as having no committed observation. That future docs correction **must not** rewrite `history.csv`. **Do not edit H1/H1.1 on this branch.**

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

- `canonical_artifact_commit_utc` = canonical representative commit `%aI` (always on table B)
- `observation_as_of_utc` = best instant (`snapshot` midnight is **not** an instant; use `as_of_utc` when present)

**FACT.** This audit used that hierarchy. Conflict blobs fell through to commit-date fallback and were then classed `UNCERTAIN_INVALID_JSON`.

---

## 10. Classification contract (two dimensions)

Git evidence and analytical use are **separate**. A parseable committed blob is **not** automatically a daily analytical primary.

### 10.1 Artifact evidence class

Applies to distinct content rows (table B).

| Class | Meaning |
|---|---|
| `COMMITTED_CONTEMPORANEOUS_CANDIDATE` | Distinct parseable `latest.json` blob committed in Git; not the reconstruction-path excluded blob |
| `EXCLUDED_RECONSTRUCTION` | `68462f34` blob (and the same blob on carry sightings in table A) |
| `UNCERTAIN_INVALID_JSON` | Conflict markers / unparseable JSON |

`EXCLUDED_SEEDED` remains a **non-artifact** exclusion for `history.csv` 2025-09-05..14 only. It is not a `latest.json` evidence class.

Sighting-only classes (`DUPLICATE_BLOB`, `MERGE_CARRY_FORWARD`, `MERGE_NEW_BLOB`, `INTRODUCING_SIGHTING`) live on table A, not as substitutes for evidence class on table B.

### 10.2 Analytical eligibility

Applies when deriving table C. Independent of “the JSON parsed.”

| Class | Meaning |
|---|---|
| `ELIGIBLE_SCHEDULED` | `operational_role = scheduled_etl` and evidence class is `COMMITTED_CONTEMPORANEOUS_CANDIDATE` |
| `ELIGIBLE_VERIFIED_RECOVERY` | Independently documented recovery (Aug 17 `db789cd9`) |
| `ELIGIBLE_VERIFIED_MANUAL_PRINT` | Only a proven user-triggered production refresh |
| `REVIEW_REQUIRED` | Candidate artifact exists, but Daily Rule v1 will not force a primary |
| `INELIGIBLE_RECONSTRUCTION` | Reconstruction path |
| `INELIGIBLE_INVALID` | Invalid JSON |

Human feature/development blobs stay in A/B as evidence. They are **not** `ELIGIBLE_SCHEDULED` and must not silently become research observations.

### 10.3 Daily selection_status

On table C (and copied onto selected artifact rows if useful):

| Status | Meaning |
|---|---|
| `DAILY_PRIMARY` | Selected by Daily Rule v1 |
| `DAILY_ALTERNATE` | Same-date eligible or candidate context, not primary |
| `NO_DAILY_PRIMARY` | Rule produced no primary (including development-only dates) |
| `REVIEW_REQUIRED` | Candidate(s) exist; human/H3.1 review needed before any primary |
| `UNSELECTED` | Default on tables A/B |

`deployment_status` = `UNKNOWN` unless a future pass proves Vercel served that blob. Git existence is not deployment proof.

`evidence_grade` (align H1): **B** typical committed artifact; **A** reserved for frozen v1.1.1 official prints as *Git evidence of what was committed*; **C** reconstruction path; **U** conflict/unknown.

---

## 11. Artifact-event vs daily-view analysis

**FACT.** 449 **candidate** artifacts span 327 **candidate** dates (mean ~1.4 artifacts/date; tail of 14–16 on some 2025-09 days). Collapsing first **destroys** auditability.

| Option | Reproducible? | Look-ahead | Operational meaning | Bias | Missing dates / recovery | Forward returns |
|---|---|---|---|---|---|---|
| 1 First valid of UTC date | Yes | Low | Often a morning/dev snapshot | Favors incomplete prints (Sep 15 G39 before seed G47) | Can keep recovered Oct dates if first is scheduled | Can use pre-revision scores |
| 2 Last valid of UTC date | Yes | **High** | “Final git write” | Favors human post-hoc mixer/weight edits (Oct 29 G57 over scheduled G55) | Same | Mixes publication with later same-day revision |
| 3 Scheduled ETL if present; **permissive** fallback to earliest remaining candidate | Yes | Medium | Over-promotes development snapshots | Sample-size maximizing | Recovers Oct 7–28 scheduled dates | Inflates n with feature commits |
| 4 No daily collapse | Yes | N/A | Event study / intraday | None from collapse | Full candidate set | Must define event time ≠ date |
| 5 Deployment-confirmed only | **No today** | Low | Live site | Almost empty (`UNKNOWN`) | Drops almost everything | Not viable |
| **Daily Rule v1** (below) | Yes | Medium | Scheduled / documented recovery / documented manual production only | Conservative; some dates stay empty | Recovers Oct 7–28 as scheduled primaries | **Final n not claimed in H3** |

**RECOMMENDATION (architecture):**

1. **Mandatory sighting table A** (511 rows) preserves topology.
2. **Immutable content table B** (452 rows) preserves distinct artifacts (Option 4 stored).
3. **Derived daily view C** uses **Daily Rule v1**. Never overwrite A or B.

**RECOMMENDATION — Daily Rule v1** (`daily_rule_version = v1`):

1. If one or more `ELIGIBLE_SCHEDULED` artifacts exist for a UTC `observation_date`, choose the **earliest `observation_as_of_utc`** among those scheduled artifacts → `DAILY_PRIMARY`.
2. Else if a specifically `ELIGIBLE_VERIFIED_RECOVERY` artifact exists, use that verified recovery artifact → `DAILY_PRIMARY`. Do **not** require a `scheduled_etl` classification for Aug 17.
3. Else if a specifically `ELIGIBLE_VERIFIED_MANUAL_PRINT` exists, select according to documented manual-print semantics → `DAILY_PRIMARY`.
4. Otherwise: **do not force a daily primary.** `selection_status = NO_DAILY_PRIMARY` or `REVIEW_REQUIRED`. Human feature/development blobs remain in A/B as evidence.

**Required known assertions under Daily Rule v1**

| Date | DAILY_PRIMARY | Not primary |
|---|---|---|
| 2025-09-26 | scheduled `e9083962` **G47 Hold/Neutral** | reconstruction G67; history.csv G85; later same-day human blobs |
| 2025-10-29 | scheduled `5c4535b2` **G55** | human `54d054b1` G57 remains same-date artifact context / alternate |
| 2026-08-17 | `db789cd9` **verified recovery** **G47** | n/a (do not require scheduled) |

**Development-heavy dates.** Explicitly flag at least 2025-09-15, 2025-09-16, 2025-09-17, and 2025-10-05. If H3.1 proves an `ELIGIBLE_SCHEDULED` print on one of those dates, that print **may** be selected. Otherwise the daily view **must** leave the date `REVIEW_REQUIRED` / `NO_DAILY_PRIMARY`. Do **not** invent certainty to maximize sample size.

Record `daily_rule_version`, `analytical_eligibility`, and `selection_reason` on table C so the rule can change without rewriting A or B.

---

## 12. Factor-extraction feasibility

**FACT.** Do **not** use `factor_history.csv` as the authoritative factor source (H1 sample prefix Grade D).

**FACT.** `latest.json` `factors[]` exists from `53ede5a6` (2025-09-15) onward except:

- seed `3d11cce2` (pillars only)
- 2 conflict blobs
- onchain member removed from 2025-10-29 (`54d054b1`) — 8 factors → 7

**FACT.** Common factor fields when present: `key`, `label`, `pillar`, `weight` and/or `weight_pct`, `score`, `status`, `reason`, sometimes `details`, `last_utc`, later provenance objects.

**RECOMMENDATION.** H3.1 should emit factor observations from **distinct artifacts** (table B): `artifact_id × factor_key`.

Omit fields the source blob lacks (empty, not `0`). Factor extraction is **impossible** for S0 seed and `UNCERTAIN_INVALID_JSON` blobs; **inconsistent** for onchain across S3 vs S4.

**INFERENCE.** `last_utc` / provenance timestamps are source observation times when present; they are not guaranteed frozen vendor payloads (H1).

---

## 13. Proposed research storage layout

**RECOMMENDATION.** Non-production only. Do **not** put research manifests under `public/data/**` or `public/signals/**`.

```text
research/historical-observations/
  README.md
  artifact_sightings.csv          # REQUIRED: 511 path-history rows
  artifact_manifest.csv           # REQUIRED: 452 distinct blobs
  factor_manifest.csv             # artifact_id × factor
  daily_analytical_view.csv       # derived last; never overwrite A or B
  SOURCE_MAIN_SHA.txt
  BUILDER_VERSION.txt

scripts/research/
  build-git-observation-manifest.mjs   # Git objects only; not implemented in H3
```

H3 **did not create** these paths.

---

## 14. Proposed artifact content manifest schema

**RECOMMENDATION.** One row per distinct blob. CSV empty field = null. Numeric `0` only if JSON number is `0`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `artifact_id` | string | no | = `latest_blob_sha` |
| `latest_blob_sha` | string | no | Git blob |
| `canonical_artifact_commit_sha` | string | no | deterministic representative introducing sighting |
| `artifact_commit_sha` | string | no | same as `canonical_artifact_commit_sha` on this table |
| `parent_sha` | string | yes | parent 1 of the **canonical** commit |
| `parent2_sha` | string | yes | |
| `commit_timestamp_utc` | string | no | canonical commit `%aI` |
| `commit_author` | string | no | canonical commit |
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
| `artifact_evidence_class` | enum | no | §10.1 |
| `analytical_eligibility` | enum | no | §10.2 |
| `operational_role` | enum | no | §6 |
| `evidence_grade` | string | no | |
| `selection_status` | string | no | `UNSELECTED` on content table |
| `exclusion_reason` | string | yes | required if reconstruction/invalid |
| `deployment_status` | string | no | `UNKNOWN` unless proven |
| `source_main_sha` | string | no | pinned audit SHA |
| `builder_version` | string | no | |

Additional introducing sightings for the same blob are **not** extra B rows; they live only in A.

---

## 15. Proposed factor manifest schema

**RECOMMENDATION.** One row per `artifact_id × factor_key` when `factors[]` parses on a distinct blob.

| Column | Type | Notes |
|---|---|---|
| `artifact_id` | string | |
| `artifact_commit_sha` | string | canonical representative |
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

**COMMITTED CANDIDATE ARTIFACTS** only: parseable non-reconstruction distinct blobs (excludes reconstruction blob and 2 invalid JSON blobs). These are **not** Daily Rule v1 primaries.

| Period | Candidate artifacts | Unique candidate dates | Notes |
|---|---|---|---|
| 2025-09-15 .. 2025-09-26 | **71** | **12** | Includes Sep 26 G47; excludes G67 reconstruction blob. Seeded 09-05..14 have no `latest.json` rows. Includes development-heavy dates. |
| 2025-09-27 .. 2025-10-28 | **80** | **32** | H1 `history.csv` had 10 dates; Git recovers 22 more (07..28) as scheduled candidates |
| 2025-10-29 .. 2025-12-10 | **45** | **43** | Includes Oct 29 G55 and G57; onchain dropped in this window |
| 2025-12-11 .. 2026-08-16 | **251** | **238** | Labeled `v1.1`; start unverified |
| 2026-08-17 onward | **2** | **2** | Frozen v1.1.1 |
| **Total** | **449** | **327** | Candidate universe |

Universe extras: sightings 511; blobs 452; recon content 1; recon carry sighting 1; timestamp-order duplicate/carry 59; uncertain 2.

**Final daily analytical n is not claimed in H3.** It may be smaller after H3.1 applies Daily Rule v1.

---

## 17. Forward-horizon counts — candidate-date coverage only

**Convention (H1, unchanged):** canonical completed BTC market-history coverage ends **2026-08-17**. Observation date `D` is eligible for horizon `N` iff `D + N days` (UTC calendar) ≤ `2026-08-17`.

**Population:** unique **candidate** `observation_date` values (n_dates = 327). This is **CANDIDATE-DATE HORIZON COVERAGE**: an **upper-bound / candidate-universe** count **before** daily-primary eligibility is finalized.

**No returns. No averages. No hit rates. No calibration.**

| Horizon | Latest eligible `D` | **Candidate n** |
|---|---|---|
| 30d | 2026-07-18 | **296** |
| 90d | 2026-05-19 | **239** |
| 180d | 2026-02-18 | **156** |
| 365d | 2025-08-17 | **0** |

**FACT.** Earliest candidate GhostGauge date remains **2025-09-15**. `2025-09-15 + 365d` = 2026-09-15, after the market series end. **No genuine observation has a completed 365-day forward outcome.** H1 is not contradicted on this point. October Git recovery does not create a pre-2025-09-15 print.

Final daily analytical n at each horizon **may be smaller** after H3.1 applies Daily Rule v1. H3 does not claim a final analytical n.

---

## 18. H3.1 deterministic builder plan

**RECOMMENDATION.** Yes — a local builder under `scripts/research/`.

Build order (mandatory):

1. Build the **511-row** sighting manifest first
2. Build the **452-row** distinct artifact-content manifest second
3. Build the factor manifest from distinct artifacts
4. Build the derived daily view **last**
5. Preserve `REVIEW_REQUIRED` / `NO_DAILY_PRIMARY` dates rather than force a primary
6. Record `daily_rule_version`
7. Expose `analytical_eligibility` and `selection_reason`
8. Never maximize sample size by silently promoting development blobs

Other requirements:

- Git objects only (`cat-file` / `rev-parse` / `rev-list --full-history`)
- no network APIs, no ETL, no current-factor recomputation
- no `history.csv` as score source
- parent-blob comparisons for `sighting_class`
- deterministic canonical representative: `commit_timestamp_utc`, then SHA
- stable CSV (quoted RFC4180)
- fail loudly on required-schema unknowns and on `<<<<<<<`
- record `builder_version` and `source_main_sha`
- invariant tests for Sep 26 G47 primary, Oct 29 G55 primary, Aug 17 recovery primary

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
- treat `COMMITTED_CONTEMPORANEOUS_CANDIDATE` as daily-primary approval
- omit the 511-row sighting table
- modify H1/H1.1 documents as part of H3.1 artifact build (narrow H1 wording correction is a **separate later docs task**)

---

## 20. Open questions

1. **UNKNOWN:** live Vercel serving of any recovered blob (including Oct 7–28 and `e9083962`).
2. **UNKNOWN:** whether Oct 29 G57 (`54d054b1`) should ever be a *descriptive* same-day alternate in studies of the 30/30 cutover — it is a bundled `human_feature_commit`, not scheduled ETL, and is **not** Daily Rule v1 primary.
3. **INFERENCE / open:** same-day human blobs after scheduled ETL (Sep 26 G73, May 7 repeats) — retain on A/B; daily rule excludes them from primary.
4. **UNKNOWN:** why 11 post-2026-01 `history.csv` holes have no `latest.json` candidate.
5. **UNKNOWN:** exact `weight` vs `weight_pct` unit on every schema micro-era — H3.1 must record native fields.
6. **H1 wording vs Git (next step, not this branch):** H1 said observational-tail missing dates were “never filled.” Git shows 2025-10-07..28 **were filled then merge-dropped**. After H3 merge and **before** analytical use of H3.1 outputs, correct that H1 wording in a narrow docs change. **Do not change production `history.csv`.** **Do not edit H1/H1.1 on this branch.**
7. **UNKNOWN until H3.1 parent-comparison pass:** whether any blob has multiple independent introducing sightings on sibling branches.

---

## 21. H3.1 recommendation

1. Implement `scripts/research/build-git-observation-manifest.mjs` against a pinned main SHA using `--full-history`.
2. Write `artifact_sightings.csv` (**511** rows), then `artifact_manifest.csv` (**452** rows), then `factor_manifest.csv`, then `daily_analytical_view.csv` last.
3. Apply Daily Rule v1. Leave development-only dates `NO_DAILY_PRIMARY` / `REVIEW_REQUIRED`.
4. Hard-code the Sep 26 / Oct 29 / Aug 17 assertions below as builder invariant tests.
5. Include Oct 7–28 scheduled artifacts in the research set; **leave `history.csv` untouched**.
6. Leave `deployment_status=UNKNOWN`.
7. Keep the calibration gate **CLOSED**.
8. After H3 merge, schedule the narrow H1 October wording correction **before** analytical use of H3.1 outputs.

### Required future H3.1 assertions

For observation date **2025-09-26**:

- **DAILY_PRIMARY:** `e9083962fcac56e305dff66810b9c5a7fceed394` — **G47 Hold/Neutral** (`latest.json` blob `f77f7e0dcd5aa1beaeab22c4e3403b0eca2e5652`, price 108739.09), `scheduled_etl` / `ELIGIBLE_SCHEDULED`.
- **EXCLUDED / INELIGIBLE reconstruction:** `68462f345a075d56ad1f697722f16b35abc89262` / `a02a1a56ae87f974370851e6ede03f2ab7cf6f5d` path — `latest.json` **G67** (blob `1ae65b8d78659543b177d31774793ca46645946c`) and reconstructed `history.csv` **G85 High Risk**. Merge `a02a1a56` remains a sighting of the G67 blob, not a second content artifact.

A future daily analytical view **must not** silently substitute G85 (or reconstruction-path G67) for the contemporaneous G47 artifact.

For observation date **2025-10-29**:

- **DAILY_PRIMARY:** scheduled `5c4535b2` **G55**.
- Human `54d054b1` **G57** remains same-date artifact context / alternate, not primary.

For observation date **2026-08-17**:

- **DAILY_PRIMARY:** `db789cd9` **verified recovery** **G47**. Do not require a scheduled classification.

---

## Related

- [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)
- [`docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md`](HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md)
- [`docs/MODEL_ERAS.md`](MODEL_ERAS.md)
- [`docs/HISTORY_UI_PROVENANCE_REVIEW_2026-08-18.md`](HISTORY_UI_PROVENANCE_REVIEW_2026-08-18.md)
