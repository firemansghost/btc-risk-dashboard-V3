# GhostGauge Model Eras

Canonical human-readable registry of GhostGauge model-era boundaries for historical analysis and calibration.

## Purpose

GhostGauge historical observations are **as-published observations**. They must be analyzed according to the model and implementation era under which they were actually published.

`public/data/history.csv` is an as-published headline series. It does **not** currently contain model-version, implementation-revision, or era metadata. Era membership is determined by this registry and by the publication/snapshot date of each official observation—not by relabeling rows inside `history.csv`.

Do not treat earlier historical rows as though they were computed under current `v1.1.1` / `integrity-2026-08` semantics.

## Current registry scope

This registry currently establishes the **verified v1.1 → v1.1.1 boundary**.

It establishes:

- the final verified v1.1 observation on **2026-08-16**
- the first verified v1.1.1 observation on **2026-08-17**

It does **not** yet establish:

- the original start date of v1.1
- the complete model/version lineage of earlier historical observations

Therefore:

Historical rows before a separately verified v1.1 start boundary must **not** be automatically classified as v1.1 merely because they precede 2026-08-17.

For era-specific calibration, earlier observations should remain **legacy/unclassified** unless their producing implementation/version can be established from repository or artifact evidence.

Future historical-lineage work may extend this registry backward as evidence supports it.

---

## Era: v1.1 legacy production

**Status:** Closed

**Verified start:** Not established by this closeout.

**Verified end:** 2026-08-16.

**Last official observation:**

- Snapshot / publication date: `2026-08-16`
- `as_of_utc`: `2026-08-16T11:25:56.794Z`
- G-Score: `54`
- Band: Hold & Wait
- Artifact commit: `0032a72942f70cf26a5dc7ca66a8161bfc0db909`

This is the **final official v1.1 observation**.

Do **not** characterize all prior historical rows as though they were computed under current v1.1.1 semantics. Rows published before this era boundary remain as-published observations of the implementation that produced them.

---

## Era: v1.1.1 / integrity-2026-08

**Status:** Active

**First official observation:**

- `snapshot_date`: `2026-08-17`
- `as_of_utc`: `2026-08-17T15:44:32.381Z`
- G-Score: `47`
- Band: Moderate Buying
- Trigger: `workflow_dispatch` delayed recovery
- Workflow run: `32043136063`
- Artifact commit: `db789cd9c59b474044d428bfdccbe07312798236`

This Aug 17 observation is valid and official. It was a **delayed manual recovery print**, not the first normal scheduled v1.1.1 observation.

**First normal scheduled observation:**

- `snapshot_date`: `2026-08-18`
- `as_of_utc`: `2026-08-18T11:30:48.147Z`
- G-Score: `47`
- Band: Moderate Buying
- Trigger: `schedule`
- Workflow run: `32131944952`
- Artifact commit: `3e0c07ff08a236e59ad60e12373ff02eb138c7fb`

**Production code / config:**

- `model_version`: `v1.1.1`
- `implementation_revision`: `integrity-2026-08`
- `ssot_version`: `2.1.1`

v1.1.1 is primarily an **implementation-integrity revision**. It preserves the official 30/30 pillar architecture and factor weights while correcting time, provenance, source-cadence, and configuration-integrity behavior. It is not a wholesale new scoring methodology.

### Era-boundary warning

The Aug 16 G54 → Aug 17 G47 difference **crosses an implementation / model-era boundary** and must **not** automatically be interpreted as a seven-point change in underlying market risk.

---

## Historical-analysis rules

1. `public/data/history.csv` is an **as-published headline series**.
2. It is **not** a current-model historical replay.
3. Earlier rows are **not** to be retroactively relabeled as v1.1.1 observations.
4. `public/data/factor_history.csv` is diagnostic factor/status attribution. It is **not** proof of a frozen-input historical replay.
5. Do **not** reconstruct past official scores by looping current live APIs over historical dates.
6. Trustworthy historical recomputation requires point-in-time / frozen inputs with defensible source vintages.
7. Historical analysis spanning Aug 16/17 must explicitly **segment or mark** the model-era boundary.
8. v1.1 and v1.1.1 results may be compared descriptively, but methodology / implementation-integrity changes must not be mistaken for market movement.
9. Calibration work should treat v1.1.1 forward observations beginning **2026-08-17** as the corrected forward era.
10. The first **normal scheduled** v1.1.1 observation is **2026-08-18**. The Aug 17 observation is valid and official, but was a delayed manual recovery print.
11. Failed Aug 17 runs produced **no official observations** and must not be inserted into history.
12. Never fabricate or backdate an observation to fill an operational gap.
13. Do **not** assign pre-boundary historical rows to v1.1 unless repository or artifact evidence establishes that they were produced under v1.1.

### Signals and frozen inputs

Legacy signal CSVs are **not** automatically valid frozen raw inputs for current-model replay. Historical signal columns were affected by older label/schema mismatches and synthetic zero behavior.

Signal v2 is the corrected **forward** signal-output contract. Do not claim that signal v2 alone contains every raw input needed for full historical recomputation.

### Related records

- Detailed transition closeout: [`docs/V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md`](V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md)
- Architectural decision: [`docs/DECISIONS.md`](DECISIONS.md)
- Continuity checkpoint: [`REPO_REONBOARD.md`](../REPO_REONBOARD.md)
