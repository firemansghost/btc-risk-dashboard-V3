#!/usr/bin/env node
/**
 * H4.1 research-only frozen forward-return analysis.
 * Reads pinned Git objects. No network, no ETL, no production writes.
 * Implements docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md exactly.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROTOCOL_VERSION = 'h4-forward-return-v1';
export const PINNED_ANALYSIS_SOURCE_SHA = '2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b';
export const MARKET_SERIES_END = '2026-08-17';
export const CALCULATED_HORIZONS = [30, 90, 180];
export const START_PRICE_SOURCE = 'artifact_spot_price_usd';
export const END_PRICE_SOURCE = 'btc_price_history.close_usd';

export const DAILY_VIEW_PATH = 'research/historical-observations/daily_analytical_view.csv';
export const BTC_HISTORY_PATH = 'public/data/btc_price_history.csv';
export const EXPECTED_DAILY_BLOB = '95d4292580fb13c569efb4b618c3be8226d32948';
export const EXPECTED_DAILY_SHA256 = '375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9';
export const EXPECTED_BTC_BLOB = 'e472247d7099e3e999daa99917864e92477213b5';
export const EXPECTED_BTC_SHA256 = '85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44';

export const REQUIRED_DAILY_COLUMNS = [
  'observation_date',
  'daily_rule_version',
  'selection_status',
  'selection_reason',
  'primary_artifact_id',
  'primary_artifact_commit_sha',
  'primary_observation_as_of_utc',
  'score',
  'band',
  'price_usd',
  'model_version',
  'implementation_revision',
  'operational_role',
  'analytical_eligibility',
  'evidence_grade',
  'deployment_status',
  'candidate_artifact_count',
  'eligible_scheduled_count',
  'eligible_recovery_count',
  'eligible_manual_count',
  'source_main_sha',
  'builder_version',
];

export const REQUIRED_BTC_COLUMNS = ['date_utc', 'close_usd', 'source', 'ingested_at_utc'];

export const FORWARD_RETURN_COLUMNS = [
  'observation_date',
  'primary_artifact_id',
  'primary_artifact_commit_sha',
  'observation_as_of_utc',
  'g_score',
  'native_band',
  'numeric_band_crosswalk',
  'model_version',
  'implementation_revision',
  'operational_role',
  'evidence_grade',
  'start_price_usd',
  'start_price_source',
  'horizon_days',
  'target_date',
  'end_close_usd',
  'end_price_source',
  'forward_return_decimal',
  'forward_return_pct',
  'analysis_source_sha',
  'protocol_version',
];

export const HORIZON_SUMMARY_COLUMNS = [
  'horizon_days',
  'n',
  'mean_return_decimal',
  'median_return_decimal',
  'p25_return_decimal',
  'p75_return_decimal',
  'min_return_decimal',
  'max_return_decimal',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const SCORE_ASSOCIATION_COLUMNS = [
  'horizon_days',
  'n',
  'spearman_rho',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const NUMERIC_BAND_SUMMARY_COLUMNS = [
  'horizon_days',
  'numeric_band_crosswalk',
  'score_min',
  'score_max',
  'n',
  'mean_return_decimal',
  'median_return_decimal',
  'p25_return_decimal',
  'p75_return_decimal',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const MODEL_VERSION_SUMMARY_COLUMNS = [
  'horizon_days',
  'model_version',
  'n',
  'mean_return_decimal',
  'median_return_decimal',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const NUMERIC_BANDS = [
  { label: 'Aggressive Buying', score_min: 0, score_max: 14 },
  { label: 'Regular DCA Buying', score_min: 15, score_max: 34 },
  { label: 'Moderate Buying', score_min: 35, score_max: 49 },
  { label: 'Hold & Wait', score_min: 50, score_max: 64 },
  { label: 'Reduce Risk', score_min: 65, score_max: 79 },
  { label: 'High Risk', score_min: 80, score_max: 100 },
];

export const FROZEN_MODEL_VERSION_ORDER = ['v3.1.0', 'v1.1', 'v1.1.1'];

export const REVIEW_REQUIRED_DATES = ['2025-09-15', '2025-09-16', '2025-09-17', '2025-09-18'];
export const NO_DAILY_PRIMARY_DATES = [
  '2026-01-14',
  '2026-03-06',
  '2026-03-29',
  '2026-03-30',
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  '2026-04-12',
  '2026-05-25',
  '2026-06-01',
  '2026-06-20',
];

export const REQUIRED_SEP26_COMMIT = 'e9083962fcac56e305dff66810b9c5a7fceed394';
export const REQUIRED_OCT29_COMMIT = '5c4535b2a8cc43ca52c74e66bba630b899c8cb09';
export const REQUIRED_AUG17_COMMIT = 'db789cd9c59b474044d428bfdccbe07312798236';

export const STATUS_OK = 'OK';
export const STATUS_SMALL_N = 'SMALL N — DESCRIPTIVE ONLY';
export const STATUS_NO_OUTCOMES = 'NO_COMPLETED_OUTCOMES';
export const STATUS_ZERO_VARIANCE = 'UNDEFINED_ZERO_VARIANCE';
export const MISSING_MODEL_VERSION = 'MISSING';

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value.toString();
  }
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function serializeNumber(n) {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) {
    throw new Error(`STOP: non-finite number serialization ${n}`);
  }
  return n.toString();
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  if (!rows.length) throw new Error('STOP: empty CSV');
  const header = rows[0];
  const objects = rows.slice(1).map((cells) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = cells[i] === undefined || cells[i] === '' ? null : cells[i];
    }
    return obj;
  });
  return { header, rows: objects };
}

export function requireColumns(header, required, label) {
  const set = new Set(header);
  const missing = required.filter((c) => !set.has(c));
  if (missing.length) {
    throw new Error(`STOP: ${label} missing required column(s): ${missing.join(', ')}`);
  }
}

export function parseStrictUtcCalendarDate(value, fieldName) {
  const s = value === null || value === undefined ? '' : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`STOP: malformed ${fieldName}=${JSON.stringify(value)}`);
  }
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
    throw new Error(`STOP: invalid calendar ${fieldName}=${JSON.stringify(value)}`);
  }
  return s;
}

export function addUtcDays(ymd, n) {
  const s = parseStrictUtcCalendarDate(ymd, 'date');
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function enumerateUtcDates(start, end) {
  const out = [];
  let cur = parseStrictUtcCalendarDate(start, 'start');
  const last = parseStrictUtcCalendarDate(end, 'end');
  while (cur <= last) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return out;
}

export function parseIntegerScore(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new Error(`STOP: missing G-Score=${JSON.stringify(raw)}`);
  }
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) {
    throw new Error(`STOP: non-integer G-Score=${JSON.stringify(raw)}`);
  }
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`STOP: non-numeric G-Score=${JSON.stringify(raw)}`);
  }
  if (n < 0 || n > 100) {
    throw new Error(`STOP: out-of-range G-Score=${JSON.stringify(raw)}`);
  }
  return n;
}

export function parsePositiveFiniteNumber(raw, fieldName) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new Error(`STOP: missing ${fieldName}=${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`STOP: invalid ${fieldName}=${JSON.stringify(raw)}`);
  }
  return n;
}

export function simpleReturn(endCloseUsd, startPriceUsd) {
  return endCloseUsd / startPriceUsd - 1;
}

export function numericBandCrosswalk(score) {
  for (const band of NUMERIC_BANDS) {
    if (score >= band.score_min && score <= band.score_max) return band.label;
  }
  throw new Error(`STOP: G-Score ${score} outside numeric-band predicates`);
}

export function modelVersionGroup(value) {
  if (value === null || value === undefined || String(value).trim() === '') return MISSING_MODEL_VERSION;
  return String(value);
}

export function arithmeticMean(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function type7Quantile(values, p) {
  if (!values.length) return null;
  const x = [...values].sort((a, b) => a - b);
  const n = x.length;
  const h = (n - 1) * p;
  const j = Math.floor(h);
  const g = h - j;
  if (j + 1 < n) return x[j] + g * (x[j + 1] - x[j]);
  return x[j];
}

export function averageRanks(values) {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.i - b.i));
  const out = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j += 1;
    const meanRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) out[indexed[k].i] = meanRank;
    i = j + 1;
  }
  return out;
}

export function pearsonOfRanks(rx, ry) {
  if (rx.length !== ry.length) throw new Error('STOP: rank vector length mismatch');
  if (!rx.length) return { rho: null, status: STATUS_NO_OUTCOMES };
  const mx = arithmeticMean(rx);
  const my = arithmeticMean(ry);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < rx.length; i += 1) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return { rho: null, status: STATUS_ZERO_VARIANCE };
  return { rho: num / Math.sqrt(dx2 * dy2), status: STATUS_OK };
}

export function spearmanRho(scores, returns) {
  if (!scores.length) return { rho: null, status: STATUS_NO_OUTCOMES };
  return pearsonOfRanks(averageRanks(scores), averageRanks(returns));
}

export function descriptiveStatus(n) {
  if (n === 0) return STATUS_NO_OUTCOMES;
  if (n < 20) return STATUS_SMALL_N;
  return STATUS_OK;
}

export function emptyStats() {
  return {
    mean: null,
    median: null,
    p25: null,
    p75: null,
    min: null,
    max: null,
  };
}

export function computeReturnStats(values) {
  if (!values.length) return emptyStats();
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    mean: arithmeticMean(values),
    median: type7Quantile(values, 0.5),
    p25: type7Quantile(values, 0.25),
    p75: type7Quantile(values, 0.75),
    min,
    max,
  };
}

function git(repoRoot, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = encoding === 'utf8' ? result.stderr || result.stdout : String(result.stderr || '');
    throw new Error(`git ${args.join(' ')} failed: ${err}`);
  }
  return result.stdout;
}

export function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadPinnedCsv(repoRoot, commitSha, gitPath, expectedBlob, expectedSha256) {
  const blob = git(repoRoot, ['rev-parse', `${commitSha}:${gitPath}`]).trim();
  if (blob !== expectedBlob) {
    throw new Error(`STOP: ${gitPath} blob ${blob} != expected ${expectedBlob}`);
  }
  const bytes = git(repoRoot, ['cat-file', '-p', blob], { encoding: 'buffer' });
  const hash = sha256Bytes(bytes);
  if (hash !== expectedSha256) {
    throw new Error(`STOP: ${gitPath} SHA-256 ${hash} != expected ${expectedSha256}`);
  }
  return { blob, hash, text: bytes.toString('utf8') };
}

function assertExact(actual, expected, label) {
  if (actual !== expected) throw new Error(`STOP: ${label} ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

function assertDates(actual, expected, label) {
  const a = [...actual].sort().join(',');
  const e = [...expected].sort().join(',');
  if (a !== e) throw new Error(`STOP: ${label} ${a} != ${e}`);
}

export function frozenModelVersionGroups(primaries) {
  const groups = [];
  const present = new Set(primaries.map((p) => modelVersionGroup(p.model_version)));
  for (const label of FROZEN_MODEL_VERSION_ORDER) {
    if (present.has(label)) groups.push(label);
  }
  if (present.has(MISSING_MODEL_VERSION)) groups.push(MISSING_MODEL_VERSION);
  return groups;
}

export function buildHorizonSummaries(forwardRows) {
  return CALCULATED_HORIZONS.map((horizon) => {
    const values = forwardRows.filter((r) => r.horizon_days === horizon).map((r) => r.forward_return_decimal);
    const n = values.length;
    const stats = computeReturnStats(values);
    return {
      horizon_days: horizon,
      n,
      mean_return_decimal: stats.mean,
      median_return_decimal: stats.median,
      p25_return_decimal: stats.p25,
      p75_return_decimal: stats.p75,
      min_return_decimal: stats.min,
      max_return_decimal: stats.max,
      status: descriptiveStatus(n),
      analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
      protocol_version: PROTOCOL_VERSION,
    };
  });
}

export function buildScoreAssociation(forwardRows) {
  return CALCULATED_HORIZONS.map((horizon) => {
    const subset = forwardRows.filter((r) => r.horizon_days === horizon);
    const n = subset.length;
    const spearman = spearmanRho(
      subset.map((r) => r.g_score),
      subset.map((r) => r.forward_return_decimal),
    );
    return {
      horizon_days: horizon,
      n,
      spearman_rho: spearman.rho,
      status: n === 0 ? STATUS_NO_OUTCOMES : spearman.status,
      analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
      protocol_version: PROTOCOL_VERSION,
    };
  });
}

export function buildNumericBandSummaries(forwardRows) {
  const out = [];
  for (const horizon of CALCULATED_HORIZONS) {
    for (const band of NUMERIC_BANDS) {
      const values = forwardRows
        .filter((r) => r.horizon_days === horizon && r.numeric_band_crosswalk === band.label)
        .map((r) => r.forward_return_decimal);
      const n = values.length;
      const stats = computeReturnStats(values);
      out.push({
        horizon_days: horizon,
        numeric_band_crosswalk: band.label,
        score_min: band.score_min,
        score_max: band.score_max,
        n,
        mean_return_decimal: stats.mean,
        median_return_decimal: stats.median,
        p25_return_decimal: stats.p25,
        p75_return_decimal: stats.p75,
        status: descriptiveStatus(n),
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }
  return out;
}

export function buildModelVersionSummaries(forwardRows, versionGroups) {
  const out = [];
  for (const horizon of CALCULATED_HORIZONS) {
    for (const version of versionGroups) {
      const values = forwardRows
        .filter((r) => r.horizon_days === horizon && r.model_version === version)
        .map((r) => r.forward_return_decimal);
      const n = values.length;
      const stats = computeReturnStats(values);
      out.push({
        horizon_days: horizon,
        model_version: version,
        n,
        mean_return_decimal: stats.mean,
        median_return_decimal: stats.median,
        status: descriptiveStatus(n),
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }
  return out;
}

function atomicWrite(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8' });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fs.renameSync(tmp, filePath);
}

export function readmeText() {
  return `# GhostGauge H4.1 frozen forward-return analysis

This directory is a **research-only** output of protocol \`h4-forward-return-v1\`.
It is **not** a production data source, **not** a History UI feed, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

Authoritative protocol: \`docs/H4_FORWARD_RETURN_PROTOCOL_2026-08-18.md\`.

## Pin

| Item | Value |
|---|---|
| Analysis source SHA | \`${PINNED_ANALYSIS_SOURCE_SHA}\` |
| Protocol version | \`${PROTOCOL_VERSION}\` |
| Daily view Git blob | \`${EXPECTED_DAILY_BLOB}\` |
| Daily view SHA-256 | \`${EXPECTED_DAILY_SHA256}\` |
| BTC history Git blob | \`${EXPECTED_BTC_BLOB}\` |
| BTC history SHA-256 | \`${EXPECTED_BTC_SHA256}\` |

H4.1 reads Git objects at the analysis source SHA. It does **not** parse moving working-tree copies of \`btc_price_history.csv\`.

## Exact build command

From the repository root, Git objects only, no network:

\`\`\`text
node scripts/research/build-forward-return-analysis.mjs --analysis-source-sha ${PINNED_ANALYSIS_SOURCE_SHA}
\`\`\`

Optional: \`--output-dir <path>\` for a temporary reproducibility check.

Do **not** hand-edit generated files. Regenerate with the builder.

Numeric CSV serialization of computed returns uses JavaScript \`Number.prototype.toString()\` (shortest round-trip decimal). Source \`price_usd\` and \`close_usd\` strings are preserved after validation. Rounding is serialization only and is never fed back into aggregation.

## Inputs

- \`research/historical-observations/daily_analytical_view.csv\` at the analysis source SHA (H3.1 Daily Rule v1 view)
- \`public/data/btc_price_history.csv\` at the analysis source SHA (Grade-B market-outcome series; not publication-time proof for old G-Scores)

## Population

- 338 calendar rows (2025-09-15 through 2026-08-18)
- **323** \`DAILY_PRIMARY\` rows enter the analysis
- **4** \`REVIEW_REQUIRED\` excluded: 2025-09-15, 2025-09-16, 2025-09-17, 2025-09-18
- **11** \`NO_DAILY_PRIMARY\` excluded: 2026-01-14, 03-06, 03-29, 03-30, 04-04, 04-05, 04-06, 04-12, 05-25, 06-01, 06-20
- No substitute artifacts, human feature blobs, reconstruction artifacts, or production \`history.csv\` scores

## Return contract

- Calculated horizons: 30, 90, 180 UTC calendar days
- 365 days: coverage only; **no** 365 performance rows
- Start: \`daily_analytical_view.price_usd\` labeled \`${START_PRICE_SOURCE}\` (not same-day close, not prior close)
- End: \`btc_price_history.close_usd\` on exact \`observation_date + N\` UTC calendar days, labeled \`${END_PRICE_SOURCE}\`
- Formula: \`(end_close_usd / artifact_spot_start_price) - 1\` (simple return)
- Metric name: **N-calendar-day forward-close return**. The start is an intraday artifact snapshot; the endpoint is the completed UTC close on calendar date D+N. Elapsed hours vary with observation time.

Date-eligible \`DAILY_PRIMARY\` counts at this snapshot: 30d 292, 90d 235, 180d 152, 365d 0. Row-level \`forward_returns.csv\` has 679 rows.

## Numeric-band crosswalk (secondary)

Published integer G-Score only, not native band text:

| Predicate | Label |
|---|---|
| 0 <= score <= 14 | Aggressive Buying |
| 15 <= score <= 34 | Regular DCA Buying |
| 35 <= score <= 49 | Moderate Buying |
| 50 <= score <= 64 | Hold & Wait |
| 65 <= score <= 79 | Reduce Risk |
| 80 <= score <= 100 | High Risk |

\`summary_by_numeric_band.csv\` has exactly 18 rows (3 horizons × 6 bands). Empty groups are retained.

## Statistics

- Arithmetic mean of unrounded simple returns (no trim, winsorize, geometric mean, or annualization)
- Median / p25 / p75: Hyndman–Fan Type 7 linear interpolation on unrounded returns
- Spearman rho: sample Pearson correlation of independently ranked G-Score and forward return; ties use the arithmetic mean of occupied 1-based ranks
- Zero-variance Spearman: empty rho and status \`UNDEFINED_ZERO_VARIANCE\` (never 0 / NaN / Infinity)
- \`n = 0\`: status \`NO_COMPLETED_OUTCOMES\`; mean/median/p25/p75/min/max/Spearman empty; no quantile on an empty vector
- \`1 <= n < 20\`: \`SMALL N — DESCRIPTIVE ONLY\`
- \`n >= 20\`: \`OK\`
- No Pearson of unranked values, regression, p-values, confidence intervals, or significance labels

## Output files

| File | Contents |
|---|---|
| \`forward_returns.csv\` | one row per eligible \`DAILY_PRIMARY\` × 30/90/180 |
| \`summary_by_horizon.csv\` | exactly 3 rows (30, 90, 180) |
| \`score_association.csv\` | exactly 3 Spearman rows (30, 90, 180) |
| \`summary_by_numeric_band.csv\` | exactly 18 rows |
| \`summary_by_model_version.csv\` | exactly 9 rows at this snapshot (\`v3.1.0\`, \`v1.1\`, \`v1.1.1\` × 3 horizons) |
| \`ANALYSIS_SOURCE_SHA.txt\` | pin |
| \`PROTOCOL_VERSION.txt\` | \`h4-forward-return-v1\` |
| \`README.md\` | this file |

Model-version groups come from the full 323 \`DAILY_PRIMARY\` labels before horizon filtering. \`v1.1.1\` is retained with \`n = 0\` / \`NO_COMPLETED_OUTCOMES\` for all three calculated horizons at this snapshot. A \`MISSING\` group is emitted only if a missing \`model_version\` exists in that frozen population.

## Limits

- Git existence is not proof that Vercel historically served the artifact (\`deployment_status\` remains \`UNKNOWN\` in H3.1).
- Historical GhostGauge lineage is not validated current \`v1.1.1\` performance. Do not invent a v1.1 methodology start. The Aug 16 / Aug 17 \`v1.1\` → \`v1.1.1\` boundary remains explicit.
- Daily observations with overlapping 30/90/180-day windows are not statistically independent. This analysis is descriptive. It does not use naive t-tests, independent-observation standard errors, correlation p-values, or significance language.
- No factor analysis, trading-strategy backtest, drawdown, volatility, or hit-rate work.
- No calibration.

Special Daily Rule v1 observations inherited from H3.1: 2025-09-26 uses \`e9083962\` G47 (not reconstruction G67 / history.csv G85); 2025-10-29 uses \`5c4535b2\` G55 (not human G57 as primary); 2026-08-17 \`db789cd9\` G47 verified recovery has no completed 30/90/180 outcome at the pinned BTC series end.
`;
}

export function buildForwardReturnAnalysis({ repoRoot, analysisSourceSha, outputDir }) {
  if (!FULL_SHA_RE.test(analysisSourceSha)) {
    throw new Error(`STOP: --analysis-source-sha must be a full 40-character commit SHA, got ${JSON.stringify(analysisSourceSha)}`);
  }
  if (analysisSourceSha !== PINNED_ANALYSIS_SOURCE_SHA) {
    throw new Error(
      `STOP: protocol ${PROTOCOL_VERSION} refuses analysis source ${analysisSourceSha}; required ${PINNED_ANALYSIS_SOURCE_SHA}`,
    );
  }
  git(repoRoot, ['rev-parse', '--verify', `${analysisSourceSha}^{commit}`]);

  const dailyFile = loadPinnedCsv(
    repoRoot,
    analysisSourceSha,
    DAILY_VIEW_PATH,
    EXPECTED_DAILY_BLOB,
    EXPECTED_DAILY_SHA256,
  );
  const btcFile = loadPinnedCsv(
    repoRoot,
    analysisSourceSha,
    BTC_HISTORY_PATH,
    EXPECTED_BTC_BLOB,
    EXPECTED_BTC_SHA256,
  );

  const daily = parseCsv(dailyFile.text);
  const btc = parseCsv(btcFile.text);
  requireColumns(daily.header, REQUIRED_DAILY_COLUMNS, 'daily_analytical_view.csv');
  requireColumns(btc.header, REQUIRED_BTC_COLUMNS, 'btc_price_history.csv');

  assertExact(daily.rows.length, 338, 'calendar row count');
  const byStatus = { DAILY_PRIMARY: [], REVIEW_REQUIRED: [], NO_DAILY_PRIMARY: [] };
  for (const row of daily.rows) {
    if (!byStatus[row.selection_status]) byStatus[row.selection_status] = [];
    byStatus[row.selection_status].push(row);
  }
  assertExact(byStatus.DAILY_PRIMARY.length, 323, 'DAILY_PRIMARY count');
  assertExact(byStatus.REVIEW_REQUIRED.length, 4, 'REVIEW_REQUIRED count');
  assertExact(byStatus.NO_DAILY_PRIMARY.length, 11, 'NO_DAILY_PRIMARY count');
  assertDates(
    byStatus.REVIEW_REQUIRED.map((r) => r.observation_date),
    REVIEW_REQUIRED_DATES,
    'REVIEW_REQUIRED dates',
  );
  assertDates(
    byStatus.NO_DAILY_PRIMARY.map((r) => r.observation_date),
    NO_DAILY_PRIMARY_DATES,
    'NO_DAILY_PRIMARY dates',
  );

  const versionCounts = {};
  for (const row of byStatus.DAILY_PRIMARY) {
    parseStrictUtcCalendarDate(row.observation_date, 'observation_date');
    parseIntegerScore(row.score);
    parsePositiveFiniteNumber(row.price_usd, 'price_usd');
    if (!row.primary_artifact_id) throw new Error(`STOP: missing primary_artifact_id on ${row.observation_date}`);
    if (!row.primary_artifact_commit_sha) {
      throw new Error(`STOP: missing primary_artifact_commit_sha on ${row.observation_date}`);
    }
    const vg = modelVersionGroup(row.model_version);
    versionCounts[vg] = (versionCounts[vg] || 0) + 1;
  }
  assertExact(versionCounts['v3.1.0'] || 0, 83, 'v3.1.0 count');
  assertExact(versionCounts['v1.1'] || 0, 238, 'v1.1 count');
  assertExact(versionCounts['v1.1.1'] || 0, 2, 'v1.1.1 count');
  if (versionCounts[MISSING_MODEL_VERSION]) {
    throw new Error(`STOP: unexpected missing model_version count ${versionCounts[MISSING_MODEL_VERSION]}`);
  }

  assertExact(btc.rows.length, 731, 'BTC row count');
  const closes = new Map();
  const sourceCounts = {};
  for (const row of btc.rows) {
    const date = parseStrictUtcCalendarDate(row.date_utc, 'date_utc');
    const close = parsePositiveFiniteNumber(row.close_usd, 'close_usd');
    if (closes.has(date)) throw new Error(`STOP: duplicate BTC date ${date}`);
    closes.set(date, { close, raw: row.close_usd, source: row.source });
    sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
  }
  assertExact(closes.size, 731, 'BTC unique dates');
  const btcDates = [...closes.keys()].sort();
  assertExact(btcDates[0], '2024-08-17', 'BTC first date');
  assertExact(btcDates[btcDates.length - 1], MARKET_SERIES_END, 'BTC last date');
  const expectedDates = enumerateUtcDates('2024-08-17', MARKET_SERIES_END);
  assertExact(expectedDates.length, 731, 'BTC expected contiguous length');
  for (const d of expectedDates) {
    if (!closes.has(d)) throw new Error(`STOP: missing BTC date ${d}`);
  }
  assertExact(sourceCounts.coinbase_historical || 0, 716, 'coinbase_historical count');
  assertExact(sourceCounts.coinbase || 0, 15, 'coinbase count');

  const versionGroups = frozenModelVersionGroups(byStatus.DAILY_PRIMARY);
  assertExact(versionGroups.join(','), FROZEN_MODEL_VERSION_ORDER.join(','), 'model-version universe');

  const expectedN = { 30: 292, 90: 235, 180: 152 };
  const forwardRows = [];
  for (const row of byStatus.DAILY_PRIMARY) {
    const observationDate = row.observation_date;
    const score = parseIntegerScore(row.score);
    const startNum = parsePositiveFiniteNumber(row.price_usd, 'price_usd');
    const band = numericBandCrosswalk(score);
    const modelVersion = modelVersionGroup(row.model_version);
    for (const horizon of CALCULATED_HORIZONS) {
      const targetDate = addUtcDays(observationDate, horizon);
      if (targetDate > MARKET_SERIES_END) continue;
      const end = closes.get(targetDate);
      if (!end) {
        throw new Error(`STOP: missing endpoint close for ${observationDate} horizon ${horizon} target ${targetDate}`);
      }
      const ret = simpleReturn(end.close, startNum);
      forwardRows.push({
        observation_date: observationDate,
        primary_artifact_id: row.primary_artifact_id,
        primary_artifact_commit_sha: row.primary_artifact_commit_sha,
        observation_as_of_utc: row.primary_observation_as_of_utc,
        g_score: score,
        native_band: row.band,
        numeric_band_crosswalk: band,
        model_version: modelVersion,
        implementation_revision: row.implementation_revision,
        operational_role: row.operational_role,
        evidence_grade: row.evidence_grade,
        start_price_usd: row.price_usd,
        start_price_source: START_PRICE_SOURCE,
        horizon_days: horizon,
        target_date: targetDate,
        end_close_usd: end.raw,
        end_price_source: END_PRICE_SOURCE,
        forward_return_decimal: ret,
        forward_return_pct: ret * 100,
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }

  forwardRows.sort((a, b) => {
    if (a.observation_date !== b.observation_date) return a.observation_date < b.observation_date ? -1 : 1;
    return a.horizon_days - b.horizon_days;
  });

  const nByHorizon = {};
  for (const horizon of CALCULATED_HORIZONS) {
    nByHorizon[horizon] = forwardRows.filter((r) => r.horizon_days === horizon).length;
    assertExact(nByHorizon[horizon], expectedN[horizon], `${horizon}d row count`);
  }
  assertExact(forwardRows.length, 679, 'forward_returns row count');
  if (forwardRows.some((r) => r.horizon_days === 365)) {
    throw new Error('STOP: unexpected 365 performance row');
  }

  const sep26 = forwardRows.filter((r) => r.observation_date === '2025-09-26');
  assertExact(sep26.length, 3, 'Sep 26 row count');
  for (const r of sep26) {
    assertExact(r.primary_artifact_commit_sha, REQUIRED_SEP26_COMMIT, 'Sep 26 commit');
    assertExact(r.g_score, 47, 'Sep 26 score');
    assertExact(r.native_band, 'Hold/Neutral', 'Sep 26 native band');
    assertExact(String(r.start_price_usd), '108739.09', 'Sep 26 start price');
  }
  const oct29 = forwardRows.filter((r) => r.observation_date === '2025-10-29');
  assertExact(oct29.length, 3, 'Oct 29 row count');
  for (const r of oct29) {
    assertExact(r.primary_artifact_commit_sha, REQUIRED_OCT29_COMMIT, 'Oct 29 commit');
    assertExact(r.g_score, 55, 'Oct 29 score');
  }
  assertExact(forwardRows.filter((r) => r.observation_date === '2026-08-17').length, 0, 'Aug 17 rows');
  assertExact(forwardRows.filter((r) => r.observation_date === '2026-08-18').length, 0, 'Aug 18 rows');
  for (const d of REVIEW_REQUIRED_DATES) {
    assertExact(forwardRows.filter((r) => r.observation_date === d).length, 0, `${d} REVIEW_REQUIRED rows`);
  }
  for (const d of NO_DAILY_PRIMARY_DATES) {
    assertExact(forwardRows.filter((r) => r.observation_date === d).length, 0, `${d} NO_DAILY_PRIMARY rows`);
  }
  const octRows = forwardRows.filter((r) => r.observation_date >= '2025-10-07' && r.observation_date <= '2025-10-28');
  assertExact(octRows.length, 66, 'Oct 7–28 row count');

  const horizonSummary = buildHorizonSummaries(forwardRows);
  const scoreAssociation = buildScoreAssociation(forwardRows);
  const bandSummary = buildNumericBandSummaries(forwardRows);
  const versionSummary = buildModelVersionSummaries(forwardRows, versionGroups);
  assertExact(horizonSummary.length, 3, 'horizon summary rows');
  assertExact(scoreAssociation.length, 3, 'score association rows');
  assertExact(bandSummary.length, 18, 'numeric-band summary rows');
  assertExact(versionSummary.length, 9, 'model-version summary rows');
  for (const row of [...horizonSummary, ...scoreAssociation]) {
    if (row.n !== expectedN[row.horizon_days]) {
      throw new Error(`STOP: ${row.horizon_days}d summary n ${row.n} contradicts frozen eligibility ${expectedN[row.horizon_days]}`);
    }
    if (row.status !== STATUS_OK) throw new Error(`STOP: primary horizon ${row.horizon_days} status ${row.status}`);
  }
  const v111 = versionSummary.filter((r) => r.model_version === 'v1.1.1');
  assertExact(v111.length, 3, 'v1.1.1 summary rows');
  for (const row of v111) {
    assertExact(row.n, 0, 'v1.1.1 n');
    if (row.mean_return_decimal !== null || row.median_return_decimal !== null) {
      throw new Error('STOP: v1.1.1 empty stats must be null');
    }
    assertExact(row.status, STATUS_NO_OUTCOMES, 'v1.1.1 status');
  }

  const outDir = outputDir;
  fs.mkdirSync(outDir, { recursive: true });
  atomicWrite(path.join(outDir, 'forward_returns.csv'), toCsv(FORWARD_RETURN_COLUMNS, forwardRows));
  atomicWrite(path.join(outDir, 'summary_by_horizon.csv'), toCsv(HORIZON_SUMMARY_COLUMNS, horizonSummary));
  atomicWrite(path.join(outDir, 'score_association.csv'), toCsv(SCORE_ASSOCIATION_COLUMNS, scoreAssociation));
  atomicWrite(path.join(outDir, 'summary_by_numeric_band.csv'), toCsv(NUMERIC_BAND_SUMMARY_COLUMNS, bandSummary));
  atomicWrite(path.join(outDir, 'summary_by_model_version.csv'), toCsv(MODEL_VERSION_SUMMARY_COLUMNS, versionSummary));
  atomicWrite(path.join(outDir, 'ANALYSIS_SOURCE_SHA.txt'), `${PINNED_ANALYSIS_SOURCE_SHA}\n`);
  atomicWrite(path.join(outDir, 'PROTOCOL_VERSION.txt'), `${PROTOCOL_VERSION}\n`);
  const readme = readmeText();
  atomicWrite(path.join(outDir, 'README.md'), readme.endsWith('\n') ? readme : `${readme}\n`);

  return {
    analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
    protocol_version: PROTOCOL_VERSION,
    daily_blob: dailyFile.blob,
    daily_sha256: dailyFile.hash,
    btc_blob: btcFile.blob,
    btc_sha256: btcFile.hash,
    calendar_rows: daily.rows.length,
    daily_primary: byStatus.DAILY_PRIMARY.length,
    review_required: byStatus.REVIEW_REQUIRED.length,
    no_daily_primary: byStatus.NO_DAILY_PRIMARY.length,
    n_by_horizon: nByHorizon,
    forward_rows: forwardRows.length,
    horizon_summary: horizonSummary,
    score_association: scoreAssociation,
    band_summary: bandSummary,
    version_summary: versionSummary,
  };
}

function parseArgs(argv) {
  const args = { analysisSourceSha: null, outputDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--analysis-source-sha') {
      args.analysisSourceSha = argv[i + 1];
      i += 1;
    } else if (a === '--output-dir') {
      args.outputDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--analysis-source-sha=')) {
      args.analysisSourceSha = a.slice('--analysis-source-sha='.length);
    } else if (a.startsWith('--output-dir=')) {
      args.outputDir = a.slice('--output-dir='.length);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function isDirectRun() {
  const thisFile = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return Boolean(invoked) && path.normalize(thisFile) === path.normalize(invoked);
}

export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.analysisSourceSha) throw new Error('Required: --analysis-source-sha <full SHA>');
  const repoRoot = defaultRepoRoot();
  const outputDir = args.outputDir
    ? path.resolve(args.outputDir)
    : path.join(repoRoot, 'research', 'forward-returns');
  const summary = buildForwardReturnAnalysis({
    repoRoot,
    analysisSourceSha: args.analysisSourceSha,
    outputDir,
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
