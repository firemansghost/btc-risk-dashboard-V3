# GhostGauge Model Eras

Canonical human-readable registry of GhostGauge model-era boundaries for historical analysis and calibration.

## Purpose

`MODEL_ERAS` governs **verified model/implementation boundaries**. Historical analysis must also respect **DATA PROVENANCE**.

This registry currently records the verified **v1.1 → v1.1.1** implementation boundary (final verified v1.1 observation on **2026-08-16**; first verified v1.1.1 observation on **2026-08-17**). It does **not** by itself prove that every row in `public/data/history.csv` is a contemporaneous publication, an official observation, or a frozen-input replay.

Do not treat earlier historical rows as though they were computed under current `v1.1.1` / `integrity-2026-08` semantics.

---

## Historical-series provenance

Phase H1 established that current `public/data/history.csv` is a **mixed-provenance** artifact. It must not be globally described as an "as-published" series.

### Terminology

- **Contemporaneous committed artifact:** a Git artifact committed at or around the time of the observation. Git evidence proves the artifact existed in the repository. It does **not** by itself prove that the live Vercel site actually served that artifact unless deployment evidence was independently verified.
- **Official observation:** reserved for observations whose official-production status has been separately established, such as the frozen Aug 16 / Aug 17 boundary.
- **Reconstructed history:** current `history.csv` dates **2023-09-25** through **2025-09-26** that were placed into the reconstruction branch and retained by merge `a02a1a56`.
- **Observational tail:** successful committed production observations after **2025-09-26**. It is **not** a complete calendar-day panel.

### A. Current history.csv reconstructed region

**2023-09-25 through 2025-09-26**

- Grade C for G-Score analysis
- retrospective reconstruction retained by merge `a02a1a56`
- not a contemporaneous publication series
- must not be used as official historical G-Score calibration evidence

**Important Sep 26 distinction:**

- contemporaneous committed artifact: `e9083962`, **G47 Hold/Neutral**
- reconstructed branch / merged current history: **G85 High Risk**

When recovering a contemporaneous Git series for Sep 26, use `e9083962` G47, not current `history.csv` G85.

### B. Current history.csv observational tail

**2025-09-27 onward**

- successful production-artifact observation set
- Grade B for the committed headline numbers
- not a frozen-input replay
- not calendar-contiguous
- missing dates must remain missing unless independently recovered from defensible evidence

At the H1 audit date through **2026-08-18**, **293** observations existed across **326** possible calendar dates in this tail. That count is an **H1 audit snapshot**, not a permanent architectural assumption.

### C. Git-recovered earlier artifacts

Contemporaneous committed G-Score artifacts can be recovered beginning **2025-09-15**. Do not claim Git alone proves live Vercel deployment.

Do **not** extend this model-era registry backward merely because H1 identified candidate observational periods.

---

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

Future historical-lineage work may extend this registry backward as evidence supports it. H1 provenance findings do **not** themselves create new model-era starts.

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

Do **not** characterize all prior historical rows as though they were computed under current v1.1.1 semantics. Rows before this era boundary remain mixed-provenance historical records unless separately classified as official observations.

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

1. Current `public/data/history.csv` is **MIXED PROVENANCE**. It is not globally an as-published series.
2. Current rows **2023-09-25 through 2025-09-26** are reconstructed **Grade C** and are ineligible as contemporaneous G-Score calibration observations.
3. The Sep 26 contemporaneous committed G-Score is `e9083962` **G47**. Do not use the merged/current reconstructed **G85** as the contemporaneous Sep 26 print.
4. Successful committed history dates from **2025-09-27** forward form an **observational set**, not an assumed complete calendar panel.
5. Calendar gaps must not be silently filled or treated as observations.
6. Git `latest.json` artifacts are preferred evidence when reconstructing what was contemporaneously committed.
7. Git existence alone is not proof of live deployment.
8. `factor_history.csv` remains diagnostic output and contains a sample **Grade D** prefix.
9. Legacy signal histories remain untrusted.
10. Existing backtest artifacts built from the reconstructed headline series are not validated performance evidence.
11. The v1.1 start remains **unverified**.
12. The Aug 16 / Aug 17 boundary remains **frozen**.
13. v1.1.1 forward observations beginning **Aug 17** remain the corrected forward implementation era.
14. Do not fabricate or backdate observations.
15. Trustworthy replay requires frozen point-in-time inputs.

Additional operational rules:

- Earlier rows are **not** to be retroactively relabeled as v1.1.1 observations.
- Do **not** reconstruct past official scores by looping current live APIs over historical dates.
- Historical analysis spanning Aug 16/17 must explicitly **segment or mark** the model-era boundary.
- v1.1 and v1.1.1 results may be compared descriptively, but methodology / implementation-integrity changes must not be mistaken for market movement.
- The first **normal scheduled** v1.1.1 observation is **2026-08-18**. The Aug 17 observation is valid and official, but was a delayed manual recovery print.
- Failed Aug 17 runs produced **no official observations** and must not be inserted into history.
- Do **not** assign pre-boundary historical rows to v1.1 unless repository or artifact evidence establishes that they were produced under v1.1.

### Signals and frozen inputs

Legacy signal CSVs are **not** automatically valid frozen raw inputs for current-model replay. Historical signal columns were affected by older label/schema mismatches and synthetic zero behavior.

Signal v2 is the corrected **forward** signal-output contract. Do not claim that signal v2 alone contains every raw input needed for full historical recomputation.

### Related records

`MODEL_ERAS` is the **model/implementation boundary registry**. It is not the provenance forensic record and not the dataset-eligibility rulebook.

- Provenance forensic record: [`docs/HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md`](HISTORICAL_EVIDENCE_INVENTORY_2026-08-18.md)
- Permissible analytical use: [`docs/HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md`](HISTORICAL_DATA_ELIGIBILITY_2026-08-18.md)
- Detailed transition closeout: [`docs/V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md`](V1.1.1_TRANSITION_CLOSEOUT_2026-08-18.md)
- Architectural decision: [`docs/DECISIONS.md`](DECISIONS.md)
- Continuity checkpoint: [`REPO_REONBOARD.md`](../REPO_REONBOARD.md)
