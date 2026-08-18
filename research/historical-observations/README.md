# GhostGauge historical observation archive (research only)

This directory is a **research-only** Git observation archive. It is **not** a production data source, **not** a History UI feed, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

## Purpose

Preserve what GhostGauge actually committed in `public/data/latest.json`, without collapsing or rewriting that evidence:

1. every `--full-history` Git path sighting
2. every distinct `latest.json` blob
3. factor rows parsed from those distinct blobs
4. a conservative derived calendar-day analytical view (Daily Rule v1)

Immutable Git evidence is built **first**. The daily analytical view is derived **last**.

## Pin / versions

| Item | Value |
|---|---|
| Source main SHA | `c29601abff2252a553ef12c5ed843ea705f9956f` |
| Builder version | `h3.1-v1` |
| Daily rule version | `v1` |

These values are also in `SOURCE_MAIN_SHA.txt` and `BUILDER_VERSION.txt`.

## Exact build command

From the repository root, Git objects only, no network:

```text
node scripts/research/build-git-observation-manifest.mjs --source-main-sha c29601abff2252a553ef12c5ed843ea705f9956f
```

Optional: `--output-dir <path>` for a temporary reproducibility check.

Do **not** hand-edit generated CSVs or the SHA/version text files. Regenerate with the builder.

## Tables

| File | Grain | H3.1 snapshot |
|---|---|---|
| `artifact_sightings.csv` | one row per full-history `latest.json` path sighting | 511 |
| `artifact_manifest.csv` | one row per distinct `latest.json` blob | 452 |
| `factor_manifest.csv` | `artifact_id × factor_key` when `factors[]` parses | generated from distinct blobs; **not** from `factor_history.csv` |
| `daily_analytical_view.csv` | one row per UTC date 2025-09-15 … 2026-08-18 | 338 |

CSV nulls are **empty fields**. Numeric `0` is preserved when present. Do not read empty as zero.

`deployment_status` is `UNKNOWN` on every row. Git existence is **not** proof that Vercel served the artifact.

## Immutable evidence vs derived daily view

`artifact_sightings.csv` and `artifact_manifest.csv` are the forensic base. A merge carrying an already-existing blob stays visible as a sighting and does **not** become a second content row.

`daily_analytical_view.csv` is derived with Daily Rule v1:

1. earliest `ELIGIBLE_SCHEDULED` `observation_as_of_utc`
2. else documented `ELIGIBLE_VERIFIED_RECOVERY`
3. else documented `ELIGIBLE_VERIFIED_MANUAL_PRINT` (none in H3.1)
4. else `REVIEW_REQUIRED` if candidate artifacts exist
5. else `NO_DAILY_PRIMARY`

A parseable Git blob is **not** automatically a daily primary. Human feature/development blobs stay in the event/content tables.

## Git topology / artifact identity

`artifact_id = latest_blob_sha`. `canonical_artifact_commit_sha` is the deterministic representative among **independent** introducing sightings (Git ancestry, then earliest timestamp / SHA). Immediate-parent `sighting_class` is mechanical and is **not** changed by ancestry.

One blob in this pinned source has two parent-relative introducing sightings:

- blob `8715f91aa5c946ab8d6eec938c8514bf24f17604`
- first introduction: `37174a41097dfc3634e171db651431c59ed9f62f`
- later restore: `70b4d93361f05332261e34f783191c36b36b97ae`

After the path passed through invalid conflict-marker JSON, `70b4d933` restored the exact earlier blob bytes. Both sightings remain `INTRODUCING_SIGHTING` under the immediate-parent rule. They are **one** distinct artifact content object, not two independent content origins. The later restore is preserved in `artifact_sightings.csv`. The single content row is `human_feature_commit` / `REVIEW_REQUIRED`. This is not a deployment claim.

No other true independent multi-introduction cases exist at this source SHA.

## Current production `history.csv` is untouched

H3.1 does **not** write recovered observations into `public/data/history.csv`. The live History chart still uses the current production file.

## October 7–28 recovery

Scheduled Daily ETL artifacts existed for 2025-10-07 through 2025-10-28. Those commits also contained contemporaneous `history.csv` rows. Merge `1e27313f` later kept the sparse `54d054b1` data-file path, so those 22 dates remain **absent from current production `history.csv`**. They appear here as research daily primaries only. Git still does not prove Vercel served them.

## September 26 distinction

For 2025-09-26:

- **DAILY_PRIMARY:** scheduled `e9083962fcac56e305dff66810b9c5a7fceed394` — G47 Hold/Neutral
- reconstruction-path `latest.json` is G67 (excluded from analytical use; retained as content evidence)
- reconstructed `history.csv` G85 is not a `latest.json` artifact and is not used here

Do not substitute G67 or G85 for contemporaneous G47.

## What this archive is not

- no forward returns, drawdowns, or hit rates
- not official-model calibration evidence
- not a current-model replay
- not a Vercel deployment log
