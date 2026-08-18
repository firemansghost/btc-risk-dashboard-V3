#!/usr/bin/env node
/**
 * H3.1 research-only Git observation manifest builder.
 * Reads Git objects for public/data/latest.json. No network, no ETL, no production writes.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILDER_VERSION = 'h3.1-v1';
export const DAILY_RULE_VERSION = 'v1';
export const LATEST_JSON_PATH = 'public/data/latest.json';
export const PINNED_SOURCE_MAIN_SHA = 'c29601abff2252a553ef12c5ed843ea705f9956f';

export const RECONSTRUCTION_BLOB_SHA = '1ae65b8d78659543b177d31774793ca46645946c';
export const KNOWN_INVALID_COMMIT_SHAS = new Set([
  '961b50c693358719d5a952c3759488ec25cd13dd',
  '9e5b3332647f3c9b69e18705809d5b1d2500243d',
]);
export const VERIFIED_RECOVERY_COMMIT_SHAS = new Set([
  'db789cd9c59b474044d428bfdccbe07312798236',
]);
export const VERIFIED_MANUAL_REFRESH_COMMIT_SHAS = new Set();
export const GRADE_A_COMMIT_SHAS = new Set([
  'db789cd9c59b474044d428bfdccbe07312798236',
  '3e0c07ff08a236e59ad60e12373ff02eb138c7fb',
]);
export const REQUIRED_SEP26_COMMIT = 'e9083962fcac56e305dff66810b9c5a7fceed394';
export const REQUIRED_OCT29_COMMIT = '5c4535b2a8cc43ca52c74e66bba630b899c8cb09';
export const REQUIRED_AUG17_COMMIT = 'db789cd9c59b474044d428bfdccbe07312798236';
export const OCT29_HUMAN_COMMIT = '54d054b110ac779f45b073a27dac799d8a5b85a5';

export const SERIAL_RESTORE_BLOB_SHA = '8715f91aa5c946ab8d6eec938c8514bf24f17604';
export const SERIAL_RESTORE_FIRST_COMMIT = '37174a41097dfc3634e171db651431c59ed9f62f';
export const SERIAL_RESTORE_LATER_COMMIT = '70b4d93361f05332261e34f783191c36b36b97ae';

export const DAILY_RANGE_START = '2025-09-15';
export const DAILY_RANGE_END = '2026-08-18';
export const MARKET_SERIES_END = '2026-08-17';

export const NO_CANDIDATE_DATES = [
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

export const OCTOBER_RECOVERY_DATES = enumerateUtcDates('2025-10-07', '2025-10-28');

export const EXPECTED = {
  sightings: 511,
  distinctBlobs: 452,
  candidateArtifacts: 449,
  uniqueCandidateDates: 327,
  multiCandidateDates: 27,
  dailyRows: 338,
  invalidArtifacts: 2,
  reconstructionArtifacts: 1,
};

export const SIGHTING_COLUMNS = [
  'sighting_id',
  'commit_sha',
  'commit_timestamp_utc',
  'commit_author',
  'commit_message',
  'latest_blob_sha',
  'artifact_id',
  'parent1_sha',
  'parent1_latest_blob_sha',
  'parent2_sha',
  'parent2_latest_blob_sha',
  'is_new_blob_vs_parent1',
  'is_new_blob_vs_parent2',
  'sighting_class',
  'canonical_artifact_commit_sha',
  'source_main_sha',
  'builder_version',
];

export const ARTIFACT_COLUMNS = [
  'artifact_id',
  'latest_blob_sha',
  'canonical_artifact_commit_sha',
  'artifact_commit_sha',
  'parent_sha',
  'parent2_sha',
  'commit_timestamp_utc',
  'commit_author',
  'commit_message',
  'observation_date',
  'observation_as_of_utc',
  'observation_date_source',
  'score',
  'composite_raw',
  'raw_score',
  'band',
  'price_usd',
  'model_version',
  'implementation_revision',
  'ssot_version',
  'health_status',
  'ok',
  'factor_count',
  'successful_factor_count',
  'artifact_evidence_class',
  'analytical_eligibility',
  'operational_role',
  'evidence_grade',
  'selection_status',
  'exclusion_reason',
  'deployment_status',
  'source_main_sha',
  'builder_version',
];

export const FACTOR_COLUMNS = [
  'artifact_id',
  'artifact_commit_sha',
  'observation_date',
  'factor_key',
  'factor_label',
  'factor_score',
  'factor_weight_pct',
  'factor_weight_native',
  'factor_weight_source_field',
  'factor_weight_unit',
  'factor_status',
  'source_observation_time',
  'source_fetch_time',
  'model_version',
  'implementation_revision',
];

export const DAILY_COLUMNS = [
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

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '';
    return String(value);
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

export function utcDateFromInstant(iso) {
  if (iso === null || iso === undefined || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function dateOnly(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function toIsoUtc(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function addUtcDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function enumerateUtcDates(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return out;
}

export function compareIsoThenSha(aIso, aSha, bIso, bSha) {
  if (aIso !== bIso) return aIso < bIso ? -1 : 1;
  if (aSha !== bSha) return aSha < bSha ? -1 : 1;
  return 0;
}

function firstLegacyInstant(parsed) {
  if (!parsed || typeof parsed !== 'object') return { instant: null, dates: [] };
  const fields = ['updated_at', 'generated_at', 'timestamp'];
  const dates = [];
  let instant = null;
  for (const field of fields) {
    if (!(field in parsed) || parsed[field] === null || parsed[field] === '') continue;
    const iso = toIsoUtc(parsed[field]);
    const date = utcDateFromInstant(iso);
    if (!date) {
      throw new Error(`STOP: unparseable legacy timestamp field ${field}=${JSON.stringify(parsed[field])}`);
    }
    dates.push({ field, date, iso });
    if (!instant) instant = iso;
  }
  const unique = new Set(dates.map((d) => d.date));
  if (unique.size > 1) {
    throw new Error(
      `STOP: conflicting legacy timestamp UTC dates: ${dates.map((d) => `${d.field}=${d.date}`).join(', ')}`,
    );
  }
  return { instant, dates };
}

export function observationFieldsFromParsed(parsed, commitTimestampUtc, { invalidJson = false } = {}) {
  if (invalidJson || !parsed) {
    return {
      observation_date: null,
      observation_as_of_utc: null,
      observation_date_source: 'unknown',
    };
  }

  const snapshot = dateOnly(parsed.snapshot_date);
  const asOfIso = parsed.as_of_utc ? toIsoUtc(parsed.as_of_utc) : null;
  const asOfDate = asOfIso ? utcDateFromInstant(asOfIso) : null;
  const legacy = firstLegacyInstant(parsed);
  const dailyClose = dateOnly(parsed.daily_close_date);
  const commitDate = utcDateFromInstant(commitTimestampUtc);

  if (asOfDate && legacy.dates.length && legacy.dates[0].date !== asOfDate) {
    throw new Error(
      `STOP: as_of_utc date ${asOfDate} conflicts with legacy timestamp date ${legacy.dates[0].date}`,
    );
  }

  let observation_date = null;
  let observation_date_source = null;
  if (snapshot) {
    observation_date = snapshot;
    observation_date_source = 'snapshot_date';
  } else if (asOfDate) {
    observation_date = asOfDate;
    observation_date_source = 'as_of_utc';
  } else if (legacy.dates.length) {
    observation_date = legacy.dates[0].date;
    observation_date_source = 'legacy_timestamp';
  } else if (dailyClose) {
    observation_date = dailyClose;
    observation_date_source = 'daily_close_date';
  } else if (commitDate) {
    observation_date = commitDate;
    observation_date_source = 'commit_date_fallback';
  } else {
    observation_date = null;
    observation_date_source = 'unknown';
  }

  const observation_as_of_utc = asOfIso || legacy.instant || null;
  return { observation_date, observation_as_of_utc, observation_date_source };
}

export function normalizeScore(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(parsed, 'composite_score') && parsed.composite_score !== null && parsed.composite_score !== '') {
    return parsed.composite_score;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'composite') && parsed.composite !== null && parsed.composite !== '') {
    return parsed.composite;
  }
  return null;
}

export function normalizeBand(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const band = parsed.band;
  if (band === null || band === undefined || band === '') return null;
  if (typeof band === 'string') return band;
  if (typeof band === 'object') {
    if (band.label !== undefined && band.label !== null && band.label !== '') return band.label;
    if (band.name !== undefined && band.name !== null && band.name !== '') return band.name;
  }
  return null;
}

export function normalizePrice(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(parsed, 'price_usd') && parsed.price_usd !== null && parsed.price_usd !== '') {
    return parsed.price_usd;
  }
  if (parsed.btc && typeof parsed.btc === 'object' && parsed.btc.spot_usd !== null && parsed.btc.spot_usd !== undefined && parsed.btc.spot_usd !== '') {
    return parsed.btc.spot_usd;
  }
  return null;
}

export function normalizeModelVersion(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.model_version !== undefined && parsed.model_version !== null && parsed.model_version !== '') {
    return parsed.model_version;
  }
  if (parsed.version !== undefined && parsed.version !== null && parsed.version !== '') {
    return parsed.version;
  }
  return null;
}

export function nativeNumber(parsed, key) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) return null;
  const v = parsed[key];
  if (v === null || v === undefined || v === '') return null;
  return v;
}

export function healthStatus(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.health === 'string' && parsed.health !== '') return parsed.health;
  if (parsed.health && typeof parsed.health === 'object' && typeof parsed.health.status === 'string' && parsed.health.status !== '') {
    return parsed.health.status;
  }
  return null;
}

export function okField(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.ok === 'boolean') return parsed.ok;
  return null;
}

export function factorCount(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.factors)) return null;
  return parsed.factors.length;
}

export function isScheduledEtl({ commit_author, commit_message }) {
  const author = commit_author || '';
  const message = commit_message || '';
  return (
    author === 'ghostgauge-bot' &&
    message.includes('chore(etl): update artifacts') &&
    message.includes('[skip ci]')
  );
}

export function classifySightingTopology({
  latest_blob_sha,
  parent1_sha,
  parent1_latest_blob_sha,
  parent2_sha,
  parent2_latest_blob_sha,
}) {
  const is_new_blob_vs_parent1 = !parent1_sha || !parent1_latest_blob_sha || parent1_latest_blob_sha !== latest_blob_sha;
  let is_new_blob_vs_parent2 = null;
  if (parent2_sha) {
    is_new_blob_vs_parent2 = !parent2_latest_blob_sha || parent2_latest_blob_sha !== latest_blob_sha;
  }

  let sighting_class;
  if (parent2_sha) {
    const equalsParent1 = Boolean(parent1_latest_blob_sha) && parent1_latest_blob_sha === latest_blob_sha;
    const equalsParent2 = Boolean(parent2_latest_blob_sha) && parent2_latest_blob_sha === latest_blob_sha;
    sighting_class = equalsParent1 || equalsParent2 ? 'MERGE_CARRY_FORWARD' : 'MERGE_NEW_BLOB';
  } else if (is_new_blob_vs_parent1) {
    sighting_class = 'INTRODUCING_SIGHTING';
  } else {
    sighting_class = 'DUPLICATE_BLOB';
  }

  return { is_new_blob_vs_parent1, is_new_blob_vs_parent2, sighting_class };
}

export function applyInvalidSightingClass(topologyClass, invalidJson) {
  return invalidJson ? 'INVALID_OR_UNKNOWN' : topologyClass;
}

export function isIntroducingTopologyClass(sightingClass) {
  return sightingClass === 'INTRODUCING_SIGHTING' || sightingClass === 'MERGE_NEW_BLOB';
}

/**
 * Parent-relative introducing sightings of one blob.
 * A later sighting is a serial restore if another introducing sighting is a
 * Git ancestor. Timestamp is not used for independence.
 */
export function analyzeIntroducingSightings(sightings, isAncestor) {
  const list = [...sightings];
  const independent = list.filter((sighting) => (
    !list.some((other) => (
      other.commit_sha !== sighting.commit_sha
      && isAncestor(other.commit_sha, sighting.commit_sha)
    ))
  ));
  const sortedIndependent = [...independent].sort((a, b) => (
    compareIsoThenSha(a.commit_timestamp_utc, a.commit_sha, b.commit_timestamp_utc, b.commit_sha)
  ));
  return {
    parent_relative_count: list.length,
    independent_count: independent.length,
    independent_shas: independent.map((s) => s.commit_sha),
    multiple_independent: independent.length > 1,
    canonical_commit_sha: sortedIndependent[0] ? sortedIndependent[0].commit_sha : null,
  };
}

export function operationalRole({
  blobSha,
  invalidJson,
  commit_sha,
  commit_author,
  commit_message,
}) {
  if (invalidJson) return 'invalid_conflict';
  if (blobSha === RECONSTRUCTION_BLOB_SHA) return 'reconstruction';
  if (VERIFIED_RECOVERY_COMMIT_SHAS.has(commit_sha)) return 'verified_recovery';
  if (VERIFIED_MANUAL_REFRESH_COMMIT_SHAS.has(commit_sha)) return 'verified_manual_refresh';
  if (isScheduledEtl({ commit_author, commit_message })) return 'scheduled_etl';
  if ((commit_message || '').startsWith('Merge ') || (commit_message || '').startsWith('Merge pull request')) {
    return 'merge';
  }
  const author = commit_author || '';
  if (author && author !== 'ghostgauge-bot' && author !== 'github-actions[bot]') {
    return 'human_feature_commit';
  }
  return 'unknown';
}

export function artifactEvidenceClass({ blobSha, invalidJson }) {
  if (invalidJson) return 'UNCERTAIN_INVALID_JSON';
  if (blobSha === RECONSTRUCTION_BLOB_SHA) return 'EXCLUDED_RECONSTRUCTION';
  return 'COMMITTED_CONTEMPORANEOUS_CANDIDATE';
}

export function analyticalEligibility({ evidenceClass, role }) {
  if (evidenceClass === 'UNCERTAIN_INVALID_JSON') return 'INELIGIBLE_INVALID';
  if (evidenceClass === 'EXCLUDED_RECONSTRUCTION') return 'INELIGIBLE_RECONSTRUCTION';
  if (role === 'scheduled_etl' && evidenceClass === 'COMMITTED_CONTEMPORANEOUS_CANDIDATE') {
    return 'ELIGIBLE_SCHEDULED';
  }
  if (role === 'verified_recovery') return 'ELIGIBLE_VERIFIED_RECOVERY';
  if (role === 'verified_manual_refresh') return 'ELIGIBLE_VERIFIED_MANUAL_PRINT';
  return 'REVIEW_REQUIRED';
}

export function evidenceGrade({ evidenceClass, canonicalCommitSha }) {
  if (evidenceClass === 'UNCERTAIN_INVALID_JSON') return 'U';
  if (evidenceClass === 'EXCLUDED_RECONSTRUCTION') return 'C';
  if (GRADE_A_COMMIT_SHAS.has(canonicalCommitSha)) return 'A';
  return 'B';
}

export function exclusionReason({ evidenceClass }) {
  if (evidenceClass === 'UNCERTAIN_INVALID_JSON') return 'unresolved_merge_conflict_markers';
  if (evidenceClass === 'EXCLUDED_RECONSTRUCTION') return 'reconstruction_path_latest_json';
  return null;
}

function factorFetchTime(factor) {
  if (!factor || typeof factor !== 'object') return null;
  const provenance = factor.provenance && typeof factor.provenance === 'object' ? factor.provenance : {};
  const keys = ['source_fetch_time', 'fetch_time', 'fetched_at'];
  for (const key of keys) {
    if (factor[key]) return factor[key];
    if (provenance[key]) return provenance[key];
  }
  return null;
}

export function extractFactorRows(artifact, parsed) {
  if (!parsed || !Array.isArray(parsed.factors) || parsed.factors.length === 0) return [];
  const rows = [];
  for (const factor of parsed.factors) {
    if (!factor || typeof factor !== 'object' || !factor.key) {
      throw new Error(`STOP: factor entry missing key on artifact ${artifact.artifact_id}`);
    }
    const hasWeightPct = Object.prototype.hasOwnProperty.call(factor, 'weight_pct') && factor.weight_pct !== null && factor.weight_pct !== '';
    const hasWeight = Object.prototype.hasOwnProperty.call(factor, 'weight') && factor.weight !== null && factor.weight !== '';
    let factor_weight_pct = null;
    let factor_weight_native = null;
    let factor_weight_source_field = null;
    let factor_weight_unit = null;
    if (hasWeightPct) {
      factor_weight_source_field = 'weight_pct';
      factor_weight_unit = 'pct';
      factor_weight_pct = factor.weight_pct;
      factor_weight_native = hasWeight ? factor.weight : factor.weight_pct;
    } else if (hasWeight) {
      factor_weight_source_field = 'weight';
      factor_weight_native = factor.weight;
      factor_weight_unit = 'unknown';
      factor_weight_pct = null;
    }
    const hasScore = Object.prototype.hasOwnProperty.call(factor, 'score');
    const factor_score = hasScore && factor.score !== null && factor.score !== undefined && factor.score !== ''
      ? factor.score
      : (hasScore && factor.score === 0 ? 0 : null);
    rows.push({
      artifact_id: artifact.artifact_id,
      artifact_commit_sha: artifact.canonical_artifact_commit_sha,
      observation_date: artifact.observation_date,
      factor_key: factor.key,
      factor_label: factor.label ?? null,
      factor_score: factor.score === 0 ? 0 : factor_score,
      factor_weight_pct,
      factor_weight_native,
      factor_weight_source_field,
      factor_weight_unit,
      factor_status: factor.status ?? null,
      source_observation_time: factor.last_utc || factor.lastUpdated || null,
      source_fetch_time: factorFetchTime(factor),
      model_version: artifact.model_version,
      implementation_revision: artifact.implementation_revision,
    });
  }
  return rows;
}

function sortKeyIso(value) {
  return value || '\uffff';
}

export function selectDailyPrimary(artifactsForDate) {
  const candidates = artifactsForDate.filter((a) => a.artifact_evidence_class === 'COMMITTED_CONTEMPORANEOUS_CANDIDATE');
  const scheduled = candidates.filter((a) => a.analytical_eligibility === 'ELIGIBLE_SCHEDULED');
  const recovery = candidates.filter((a) => a.analytical_eligibility === 'ELIGIBLE_VERIFIED_RECOVERY');
  const manual = candidates.filter((a) => a.analytical_eligibility === 'ELIGIBLE_VERIFIED_MANUAL_PRINT');

  const byRuleOrder = (a, b) => {
    const aAsOf = sortKeyIso(a.observation_as_of_utc);
    const bAsOf = sortKeyIso(b.observation_as_of_utc);
    if (aAsOf !== bAsOf) return aAsOf < bAsOf ? -1 : 1;
    const ts = compareIsoThenSha(
      a.commit_timestamp_utc,
      a.canonical_artifact_commit_sha,
      b.commit_timestamp_utc,
      b.canonical_artifact_commit_sha,
    );
    if (ts !== 0) return ts;
    if (a.artifact_id !== b.artifact_id) return a.artifact_id < b.artifact_id ? -1 : 1;
    return 0;
  };

  if (scheduled.length) {
    const chosen = [...scheduled].sort(byRuleOrder)[0];
    return {
      primary: chosen,
      selection_status: 'DAILY_PRIMARY',
      selection_reason: 'earliest_eligible_scheduled',
      candidate_artifact_count: candidates.length,
      eligible_scheduled_count: scheduled.length,
      eligible_recovery_count: recovery.length,
      eligible_manual_count: manual.length,
    };
  }
  if (recovery.length) {
    const chosen = [...recovery].sort(byRuleOrder)[0];
    return {
      primary: chosen,
      selection_status: 'DAILY_PRIMARY',
      selection_reason: 'verified_recovery',
      candidate_artifact_count: candidates.length,
      eligible_scheduled_count: scheduled.length,
      eligible_recovery_count: recovery.length,
      eligible_manual_count: manual.length,
    };
  }
  if (manual.length) {
    const chosen = [...manual].sort(byRuleOrder)[0];
    return {
      primary: chosen,
      selection_status: 'DAILY_PRIMARY',
      selection_reason: 'verified_manual_print',
      candidate_artifact_count: candidates.length,
      eligible_scheduled_count: scheduled.length,
      eligible_recovery_count: recovery.length,
      eligible_manual_count: manual.length,
    };
  }
  if (candidates.length) {
    return {
      primary: null,
      selection_status: 'REVIEW_REQUIRED',
      selection_reason: 'candidate_artifacts_exist_but_no_eligible_primary',
      candidate_artifact_count: candidates.length,
      eligible_scheduled_count: scheduled.length,
      eligible_recovery_count: recovery.length,
      eligible_manual_count: manual.length,
    };
  }
  return {
    primary: null,
    selection_status: 'NO_DAILY_PRIMARY',
    selection_reason: 'no_committed_candidate',
    candidate_artifact_count: 0,
    eligible_scheduled_count: 0,
    eligible_recovery_count: 0,
    eligible_manual_count: 0,
  };
}

export function blobHasConflictMarkers(text) {
  return text.includes('<<<<<<<') || text.includes('=======') || text.includes('>>>>>>>');
}

function git(repoRoot, args, { allowFail = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function assertFullSha(sha) {
  if (!FULL_SHA_RE.test(sha)) {
    throw new Error(`--source-main-sha must be a full 40-character commit SHA, got ${JSON.stringify(sha)}`);
  }
}

function gitIsAncestor(repoRoot, earlier, later) {
  const result = git(repoRoot, ['merge-base', '--is-ancestor', earlier, later], { allowFail: true });
  return result.status === 0;
}

function verifyCommitExists(repoRoot, sha) {
  const r = git(repoRoot, ['cat-file', '-t', sha], { allowFail: true });
  if (r.status !== 0 || r.stdout.trim() !== 'commit') {
    throw new Error(`source SHA ${sha} is not a local Git commit object`);
  }
}

function loadPathHistory(repoRoot, sourceMainSha) {
  const format = '%H%x1f%P%x1f%aI%x1f%an%x1f%s';
  const r = git(repoRoot, [
    '-c',
    'log.showSignature=false',
    'rev-list',
    '--full-history',
    `--format=${format}`,
    sourceMainSha,
    '--',
    LATEST_JSON_PATH,
  ]);
  const commits = [];
  const blocks = r.stdout.split('\n');
  let i = 0;
  while (i < blocks.length) {
    const header = blocks[i];
    if (!header) {
      i += 1;
      continue;
    }
    if (header.startsWith('commit ')) {
      i += 1;
      continue;
    }
    const parts = header.split('\x1f');
    if (parts.length < 5) {
      i += 1;
      continue;
    }
    const [sha, parentsRaw, authorIso, author, ...subjectParts] = parts;
    const subject = subjectParts.join('\x1f');
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(' ') : [];
    if (parents.length > 2) {
      throw new Error(`STOP: octopus merge ${sha} has ${parents.length} parents`);
    }
    commits.push({
      commit_sha: sha,
      parents,
      commit_timestamp_utc: toIsoUtc(authorIso),
      commit_author: author,
      commit_message: subject,
    });
    i += 1;
  }
  return commits;
}

function batchBlobShas(repoRoot, specs) {
  const input = specs.map((s) => `${s}\n`).join('');
  const result = spawnSync('git', ['cat-file', '--batch-check=%(objectname)'], {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git cat-file --batch-check failed: ${result.stderr}`);
  }
  const lines = result.stdout.split('\n').filter((l) => l.length > 0);
  if (lines.length !== specs.length) {
    throw new Error(`batch-check returned ${lines.length} lines for ${specs.length} specs`);
  }
  return lines.map((line) => (line.endsWith(' missing') || line === 'missing' ? null : line.trim()));
}

function loadBlobText(repoRoot, blobSha, cache) {
  if (cache.has(blobSha)) return cache.get(blobSha);
  const r = git(repoRoot, ['cat-file', '-p', blobSha]);
  cache.set(blobSha, r.stdout);
  return r.stdout;
}

function parseLatestJson(text) {
  if (blobHasConflictMarkers(text)) {
    return { invalidJson: true, parsed: null };
  }
  try {
    return { invalidJson: false, parsed: JSON.parse(text) };
  } catch (err) {
    throw new Error(`STOP: unexpected non-conflict invalid latest.json JSON: ${err.message}`);
  }
}

function atomicWrite(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8' });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fs.renameSync(tmp, filePath);
}

function horizonEligible(dates, horizonDays) {
  const latestStart = addUtcDays(MARKET_SERIES_END, -horizonDays);
  return dates.filter((d) => d <= latestStart).length;
}

export function buildManifests({ repoRoot, sourceMainSha, outputDir }) {
  assertFullSha(sourceMainSha);
  verifyCommitExists(repoRoot, sourceMainSha);

  const rawCommits = loadPathHistory(repoRoot, sourceMainSha);
  if (rawCommits.length !== EXPECTED.sightings) {
    throw new Error(`STOP: sighting count ${rawCommits.length} != expected ${EXPECTED.sightings}`);
  }

  const selfSpecs = rawCommits.map((c) => `${c.commit_sha}:${LATEST_JSON_PATH}`);
  const selfBlobs = batchBlobShas(repoRoot, selfSpecs);
  const parent1Specs = rawCommits.map((c) => (c.parents[0] ? `${c.parents[0]}:${LATEST_JSON_PATH}` : null));
  const parent2Specs = rawCommits.map((c) => (c.parents[1] ? `${c.parents[1]}:${LATEST_JSON_PATH}` : null));
  const parent1Blobs = batchBlobShas(
    repoRoot,
    parent1Specs.map((s, i) => s || `${rawCommits[i].commit_sha}:${LATEST_JSON_PATH}`),
  ).map((blob, i) => (parent1Specs[i] ? blob : null));
  const parent2Blobs = batchBlobShas(
    repoRoot,
    parent2Specs.map((s, i) => s || `${rawCommits[i].commit_sha}:${LATEST_JSON_PATH}`),
  ).map((blob, i) => (parent2Specs[i] ? blob : null));

  const blobCache = new Map();
  const parsedCache = new Map();
  const topologySightings = [];

  for (let i = 0; i < rawCommits.length; i += 1) {
    const commit = rawCommits[i];
    const blobSha = selfBlobs[i];
    if (!blobSha) throw new Error(`STOP: missing ${LATEST_JSON_PATH} blob on ${commit.commit_sha}`);
    const text = loadBlobText(repoRoot, blobSha, blobCache);
    if (!parsedCache.has(blobSha)) parsedCache.set(blobSha, parseLatestJson(text));
    const { invalidJson } = parsedCache.get(blobSha);
    const topology = classifySightingTopology({
      latest_blob_sha: blobSha,
      parent1_sha: commit.parents[0] || null,
      parent1_latest_blob_sha: parent1Blobs[i],
      parent2_sha: commit.parents[1] || null,
      parent2_latest_blob_sha: parent2Blobs[i],
    });
    topologySightings.push({
      ...commit,
      latest_blob_sha: blobSha,
      parent1_sha: commit.parents[0] || null,
      parent1_latest_blob_sha: parent1Blobs[i],
      parent2_sha: commit.parents[1] || null,
      parent2_latest_blob_sha: parent2Blobs[i],
      ...topology,
      topology_class: topology.sighting_class,
      sighting_class: applyInvalidSightingClass(topology.sighting_class, invalidJson),
      invalidJson,
    });
  }

  const introducingByBlob = new Map();
  for (const s of topologySightings) {
    if (isIntroducingTopologyClass(s.topology_class)) {
      if (!introducingByBlob.has(s.latest_blob_sha)) introducingByBlob.set(s.latest_blob_sha, []);
      introducingByBlob.get(s.latest_blob_sha).push(s);
    }
  }

  const ancestorCache = new Map();
  const isAncestor = (earlier, later) => {
    const key = `${earlier}:${later}`;
    if (!ancestorCache.has(key)) ancestorCache.set(key, gitIsAncestor(repoRoot, earlier, later));
    return ancestorCache.get(key);
  };

  const introductionAnalyses = new Map();
  const trueIndependentCases = [];
  for (const [blob, list] of introducingByBlob.entries()) {
    const analysis = analyzeIntroducingSightings(list, isAncestor);
    introductionAnalyses.set(blob, analysis);
    if (analysis.multiple_independent) {
      trueIndependentCases.push({
        blob,
        independent_shas: analysis.independent_shas,
        parent_relative_count: analysis.parent_relative_count,
        commits: list.map((s) => ({
          commit_sha: s.commit_sha,
          commit_timestamp_utc: s.commit_timestamp_utc,
          commit_author: s.commit_author,
          commit_message: s.commit_message,
          topology_class: s.topology_class,
        })),
      });
    }
  }
  if (trueIndependentCases.length) {
    const detail = trueIndependentCases
      .map((m) => `${m.blob}: independent ${m.independent_shas.join(',')}`)
      .join('\n');
    const err = new Error(`STOP: true multiple independent introductions for ${trueIndependentCases.length} blob(s)`);
    err.multipleIntroductions = trueIndependentCases;
    err.detail = detail;
    throw err;
  }

  const serialRestoreList = introducingByBlob.get(SERIAL_RESTORE_BLOB_SHA) || [];
  const serialRestoreAnalysis = introductionAnalyses.get(SERIAL_RESTORE_BLOB_SHA);
  const serialRestoreShas = new Set(serialRestoreList.map((s) => s.commit_sha));
  if (
    serialRestoreList.length !== 2
    || !serialRestoreShas.has(SERIAL_RESTORE_FIRST_COMMIT)
    || !serialRestoreShas.has(SERIAL_RESTORE_LATER_COMMIT)
    || serialRestoreAnalysis?.independent_count !== 1
    || serialRestoreAnalysis?.multiple_independent
    || serialRestoreAnalysis?.canonical_commit_sha !== SERIAL_RESTORE_FIRST_COMMIT
  ) {
    throw new Error(`STOP: known serial-restore invariant failed for ${SERIAL_RESTORE_BLOB_SHA}: ${JSON.stringify(serialRestoreAnalysis)} shas=${[...serialRestoreShas]}`);
  }

  const canonicalByBlob = new Map();
  const allBlobs = [...new Set(topologySightings.map((s) => s.latest_blob_sha))];
  for (const blob of allBlobs) {
    const intros = introducingByBlob.get(blob) || [];
    const analysis = introductionAnalyses.get(blob);
    if (analysis?.canonical_commit_sha) {
      canonicalByBlob.set(blob, analysis.canonical_commit_sha);
    } else {
      const pool = intros.length ? intros : [...topologySightings.filter((s) => s.latest_blob_sha === blob)];
      pool.sort((a, b) => compareIsoThenSha(a.commit_timestamp_utc, a.commit_sha, b.commit_timestamp_utc, b.commit_sha));
      canonicalByBlob.set(blob, pool[0].commit_sha);
    }
  }

  const unexpectedInvalid = [];
  const artifacts = [];
  for (const blob of allBlobs) {
    const { invalidJson, parsed } = parsedCache.get(blob);
    const canonicalSha = canonicalByBlob.get(blob);
    const canonical = topologySightings.find((s) => s.commit_sha === canonicalSha);
    if (invalidJson) {
      const knownCommit = KNOWN_INVALID_COMMIT_SHAS.has(canonical.commit_sha)
        || topologySightings.some((s) => s.latest_blob_sha === blob && KNOWN_INVALID_COMMIT_SHAS.has(s.commit_sha));
      if (!knownCommit) unexpectedInvalid.push({ blob, commit: canonical.commit_sha });
    }
    const obs = observationFieldsFromParsed(parsed, canonical.commit_timestamp_utc, { invalidJson });
    const evidenceClass = artifactEvidenceClass({ blobSha: blob, invalidJson });
    const role = operationalRole({
      blobSha: blob,
      invalidJson,
      commit_sha: canonical.commit_sha,
      commit_author: canonical.commit_author,
      commit_message: canonical.commit_message,
    });
    artifacts.push({
      artifact_id: blob,
      latest_blob_sha: blob,
      canonical_artifact_commit_sha: canonical.commit_sha,
      artifact_commit_sha: canonical.commit_sha,
      parent_sha: canonical.parent1_sha,
      parent2_sha: canonical.parent2_sha,
      commit_timestamp_utc: canonical.commit_timestamp_utc,
      commit_author: canonical.commit_author,
      commit_message: canonical.commit_message,
      observation_date: obs.observation_date,
      observation_as_of_utc: obs.observation_as_of_utc,
      observation_date_source: obs.observation_date_source,
      score: invalidJson ? null : normalizeScore(parsed),
      composite_raw: invalidJson ? null : nativeNumber(parsed, 'composite_raw'),
      raw_score: invalidJson ? null : nativeNumber(parsed, 'raw_score'),
      band: invalidJson ? null : normalizeBand(parsed),
      price_usd: invalidJson ? null : normalizePrice(parsed),
      model_version: invalidJson ? null : normalizeModelVersion(parsed),
      implementation_revision: invalidJson ? null : (parsed.implementation_revision ?? null),
      ssot_version: invalidJson ? null : (parsed.ssot_version ?? null),
      health_status: invalidJson ? null : healthStatus(parsed),
      ok: invalidJson ? null : okField(parsed),
      factor_count: invalidJson ? null : factorCount(parsed),
      successful_factor_count: null,
      artifact_evidence_class: evidenceClass,
      analytical_eligibility: analyticalEligibility({ evidenceClass, role }),
      operational_role: role,
      evidence_grade: evidenceGrade({ evidenceClass, canonicalCommitSha: canonical.commit_sha }),
      selection_status: 'UNSELECTED',
      exclusion_reason: exclusionReason({ evidenceClass }),
      deployment_status: 'UNKNOWN',
      source_main_sha: sourceMainSha,
      builder_version: BUILDER_VERSION,
      invalidJson,
      parsed,
    });
  }
  if (unexpectedInvalid.length) {
    throw new Error(`STOP: unexpected invalid latest.json blob(s): ${JSON.stringify(unexpectedInvalid)}`);
  }

  const sightings = topologySightings
    .map((s) => ({
      sighting_id: s.commit_sha,
      commit_sha: s.commit_sha,
      commit_timestamp_utc: s.commit_timestamp_utc,
      commit_author: s.commit_author,
      commit_message: s.commit_message,
      latest_blob_sha: s.latest_blob_sha,
      artifact_id: s.latest_blob_sha,
      parent1_sha: s.parent1_sha,
      parent1_latest_blob_sha: s.parent1_latest_blob_sha,
      parent2_sha: s.parent2_sha,
      parent2_latest_blob_sha: s.parent2_latest_blob_sha,
      is_new_blob_vs_parent1: s.is_new_blob_vs_parent1,
      is_new_blob_vs_parent2: s.is_new_blob_vs_parent2,
      sighting_class: s.sighting_class,
      canonical_artifact_commit_sha: canonicalByBlob.get(s.latest_blob_sha),
      source_main_sha: sourceMainSha,
      builder_version: BUILDER_VERSION,
    }))
    .sort((a, b) => compareIsoThenSha(a.commit_timestamp_utc, a.commit_sha, b.commit_timestamp_utc, b.commit_sha));

  artifacts.sort((a, b) => {
    const aDate = a.observation_date || '\uffff';
    const bDate = b.observation_date || '\uffff';
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    const aAsOf = a.observation_as_of_utc || '\uffff';
    const bAsOf = b.observation_as_of_utc || '\uffff';
    if (aAsOf !== bAsOf) return aAsOf < bAsOf ? -1 : 1;
    if (a.artifact_id !== b.artifact_id) return a.artifact_id < b.artifact_id ? -1 : 1;
    return 0;
  });

  const factorRows = [];
  let artifactsWithoutFactors = 0;
  for (const artifact of artifacts) {
    const rows = extractFactorRows(artifact, artifact.parsed);
    if (!rows.length) artifactsWithoutFactors += 1;
    factorRows.push(...rows);
  }
  factorRows.sort((a, b) => {
    const aDate = a.observation_date || '\uffff';
    const bDate = b.observation_date || '\uffff';
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    if (a.artifact_id !== b.artifact_id) return a.artifact_id < b.artifact_id ? -1 : 1;
    if (a.factor_key !== b.factor_key) return a.factor_key < b.factor_key ? -1 : 1;
    return 0;
  });

  const byDate = new Map();
  for (const artifact of artifacts) {
    if (!artifact.observation_date) continue;
    if (!byDate.has(artifact.observation_date)) byDate.set(artifact.observation_date, []);
    byDate.get(artifact.observation_date).push(artifact);
  }

  const calendarDates = enumerateUtcDates(DAILY_RANGE_START, DAILY_RANGE_END);
  const dailyRows = calendarDates.map((observation_date) => {
    const selected = selectDailyPrimary(byDate.get(observation_date) || []);
    const primary = selected.primary;
    return {
      observation_date,
      daily_rule_version: DAILY_RULE_VERSION,
      selection_status: selected.selection_status,
      selection_reason: selected.selection_reason,
      primary_artifact_id: primary ? primary.artifact_id : null,
      primary_artifact_commit_sha: primary ? primary.canonical_artifact_commit_sha : null,
      primary_observation_as_of_utc: primary ? primary.observation_as_of_utc : null,
      score: primary ? primary.score : null,
      band: primary ? primary.band : null,
      price_usd: primary ? primary.price_usd : null,
      model_version: primary ? primary.model_version : null,
      implementation_revision: primary ? primary.implementation_revision : null,
      operational_role: primary ? primary.operational_role : null,
      analytical_eligibility: primary ? primary.analytical_eligibility : null,
      evidence_grade: primary ? primary.evidence_grade : null,
      deployment_status: 'UNKNOWN',
      candidate_artifact_count: selected.candidate_artifact_count,
      eligible_scheduled_count: selected.eligible_scheduled_count,
      eligible_recovery_count: selected.eligible_recovery_count,
      eligible_manual_count: selected.eligible_manual_count,
      source_main_sha: sourceMainSha,
      builder_version: BUILDER_VERSION,
    };
  });

  const candidates = artifacts.filter((a) => a.artifact_evidence_class === 'COMMITTED_CONTEMPORANEOUS_CANDIDATE');
  const candidateDates = [...new Set(candidates.map((a) => a.observation_date).filter(Boolean))];
  const multiCandidateDates = candidateDates.filter((d) => (byDate.get(d) || []).filter((a) => a.artifact_evidence_class === 'COMMITTED_CONTEMPORANEOUS_CANDIDATE').length > 1);
  const invalidCount = artifacts.filter((a) => a.artifact_evidence_class === 'UNCERTAIN_INVALID_JSON').length;
  const reconCount = artifacts.filter((a) => a.artifact_evidence_class === 'EXCLUDED_RECONSTRUCTION').length;
  const primaryCount = dailyRows.filter((r) => r.selection_status === 'DAILY_PRIMARY').length;
  const reviewCount = dailyRows.filter((r) => r.selection_status === 'REVIEW_REQUIRED').length;
  const noneCount = dailyRows.filter((r) => r.selection_status === 'NO_DAILY_PRIMARY').length;

  const mismatches = [];
  if (sightings.length !== EXPECTED.sightings) mismatches.push(`sightings ${sightings.length}!=${EXPECTED.sightings}`);
  if (artifacts.length !== EXPECTED.distinctBlobs) mismatches.push(`blobs ${artifacts.length}!=${EXPECTED.distinctBlobs}`);
  if (candidates.length !== EXPECTED.candidateArtifacts) mismatches.push(`candidates ${candidates.length}!=${EXPECTED.candidateArtifacts}`);
  if (candidateDates.length !== EXPECTED.uniqueCandidateDates) mismatches.push(`candidateDates ${candidateDates.length}!=${EXPECTED.uniqueCandidateDates}`);
  if (multiCandidateDates.length !== EXPECTED.multiCandidateDates) mismatches.push(`multiCandidateDates ${multiCandidateDates.length}!=${EXPECTED.multiCandidateDates}`);
  if (dailyRows.length !== EXPECTED.dailyRows) mismatches.push(`dailyRows ${dailyRows.length}!=${EXPECTED.dailyRows}`);
  if (invalidCount !== EXPECTED.invalidArtifacts) mismatches.push(`invalid ${invalidCount}!=${EXPECTED.invalidArtifacts}`);
  if (reconCount !== EXPECTED.reconstructionArtifacts) mismatches.push(`reconstruction ${reconCount}!=${EXPECTED.reconstructionArtifacts}`);
  if (primaryCount + reviewCount + noneCount !== EXPECTED.dailyRows) {
    mismatches.push(`daily status sum ${primaryCount + reviewCount + noneCount}!=${EXPECTED.dailyRows}`);
  }

  const sep26 = dailyRows.find((r) => r.observation_date === '2025-09-26');
  const oct29 = dailyRows.find((r) => r.observation_date === '2025-10-29');
  const aug17 = dailyRows.find((r) => r.observation_date === '2026-08-17');
  if (sep26?.primary_artifact_commit_sha !== REQUIRED_SEP26_COMMIT || sep26?.score !== 47 || sep26?.band !== 'Hold/Neutral' || sep26?.operational_role !== 'scheduled_etl') {
    mismatches.push(`Sep26 primary assertion failed: ${JSON.stringify(sep26)}`);
  }
  if (oct29?.primary_artifact_commit_sha !== REQUIRED_OCT29_COMMIT || oct29?.score !== 55 || oct29?.operational_role !== 'scheduled_etl') {
    mismatches.push(`Oct29 primary assertion failed: ${JSON.stringify(oct29)}`);
  }
  if (aug17?.primary_artifact_commit_sha !== REQUIRED_AUG17_COMMIT || aug17?.score !== 47 || aug17?.operational_role !== 'verified_recovery') {
    mismatches.push(`Aug17 primary assertion failed: ${JSON.stringify(aug17)}`);
  }

  const octRecovery = OCTOBER_RECOVERY_DATES.map((d) => dailyRows.find((r) => r.observation_date === d));
  const octOk = octRecovery.every((r) => r && r.selection_status === 'DAILY_PRIMARY' && r.operational_role === 'scheduled_etl');
  if (!octOk) mismatches.push('Oct 7-28 scheduled primary assertion failed');
  const unrecoveredOk = NO_CANDIDATE_DATES.every((d) => {
    const row = dailyRows.find((r) => r.observation_date === d);
    return row && row.selection_status === 'NO_DAILY_PRIMARY' && row.candidate_artifact_count === 0 && row.score === null;
  });
  if (!unrecoveredOk) mismatches.push('11 unrecovered NO_DAILY_PRIMARY assertion failed');

  const serialArtifact = artifacts.find((a) => a.artifact_id === SERIAL_RESTORE_BLOB_SHA);
  if (
    !serialArtifact
    || serialArtifact.canonical_artifact_commit_sha !== SERIAL_RESTORE_FIRST_COMMIT
    || serialArtifact.operational_role !== 'human_feature_commit'
    || serialArtifact.analytical_eligibility !== 'REVIEW_REQUIRED'
    || serialArtifact.selection_status !== 'UNSELECTED'
    || serialArtifact.artifact_evidence_class !== 'COMMITTED_CONTEMPORANEOUS_CANDIDATE'
  ) {
    mismatches.push(`serial-restore artifact row failed: ${JSON.stringify({
      canonical: serialArtifact?.canonical_artifact_commit_sha,
      role: serialArtifact?.operational_role,
      eligibility: serialArtifact?.analytical_eligibility,
      selection: serialArtifact?.selection_status,
      evidence: serialArtifact?.artifact_evidence_class,
    })}`);
  }
  const serialSightingClasses = sightings
    .filter((s) => s.commit_sha === SERIAL_RESTORE_FIRST_COMMIT || s.commit_sha === SERIAL_RESTORE_LATER_COMMIT)
    .map((s) => ({ sha: s.commit_sha, cls: s.sighting_class, blob: s.latest_blob_sha }));
  if (
    serialSightingClasses.length !== 2
    || serialSightingClasses.some((s) => s.cls !== 'INTRODUCING_SIGHTING' || s.blob !== SERIAL_RESTORE_BLOB_SHA)
  ) {
    mismatches.push(`serial-restore sighting_class failed: ${JSON.stringify(serialSightingClasses)}`);
  }

  if (mismatches.length) {
    throw new Error(`STOP: H3 snapshot mismatch:\n- ${mismatches.join('\n- ')}`);
  }

  const artifactOut = artifacts.map((a) => {
    const copy = { ...a };
    delete copy.parsed;
    delete copy.invalidJson;
    return copy;
  });

  if (outputDir) {
    atomicWrite(path.join(outputDir, 'artifact_sightings.csv'), toCsv(SIGHTING_COLUMNS, sightings));
    atomicWrite(path.join(outputDir, 'artifact_manifest.csv'), toCsv(ARTIFACT_COLUMNS, artifactOut));
    atomicWrite(path.join(outputDir, 'factor_manifest.csv'), toCsv(FACTOR_COLUMNS, factorRows));
    atomicWrite(path.join(outputDir, 'daily_analytical_view.csv'), toCsv(DAILY_COLUMNS, dailyRows));
    atomicWrite(path.join(outputDir, 'SOURCE_MAIN_SHA.txt'), `${sourceMainSha}\n`);
    atomicWrite(path.join(outputDir, 'BUILDER_VERSION.txt'), `${BUILDER_VERSION}\n`);
  }

  const countBy = (rows, key) => {
    const out = {};
    for (const row of rows) {
      const k = row[key] ?? '';
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };

  const developmentDates = ['2025-09-15', '2025-09-16', '2025-09-17', '2025-10-05'].map((d) => {
    const row = dailyRows.find((r) => r.observation_date === d);
    return {
      observation_date: d,
      candidate_artifact_count: row.candidate_artifact_count,
      eligible_scheduled_count: row.eligible_scheduled_count,
      primary_artifact_commit_sha: row.primary_artifact_commit_sha,
      selection_status: row.selection_status,
      selection_reason: row.selection_reason,
      score: row.score,
    };
  });

  return {
    sightings,
    artifacts: artifactOut,
    factorRows,
    dailyRows,
    report: {
      source_main_sha: sourceMainSha,
      builder_version: BUILDER_VERSION,
      daily_rule_version: DAILY_RULE_VERSION,
      sighting_count: sightings.length,
      artifact_count: artifacts.length,
      candidate_count: candidates.length,
      invalid_count: invalidCount,
      reconstruction_count: reconCount,
      unique_candidate_dates: candidateDates.length,
      multi_candidate_dates: multiCandidateDates.length,
      multiple_independent_introductions: trueIndependentCases.length,
      serial_restore: {
        blob: SERIAL_RESTORE_BLOB_SHA,
        parent_relative_introducing_sightings: serialRestoreAnalysis.parent_relative_count,
        independent_introductions: serialRestoreAnalysis.independent_count,
        multiple_independent_introduction: serialRestoreAnalysis.multiple_independent,
        canonical_artifact_commit_sha: SERIAL_RESTORE_FIRST_COMMIT,
        later_restore_commit_sha: SERIAL_RESTORE_LATER_COMMIT,
        operational_role: serialArtifact.operational_role,
        analytical_eligibility: serialArtifact.analytical_eligibility,
      },
      factor_row_count: factorRows.length,
      artifacts_without_factors: artifactsWithoutFactors,
      daily_row_count: dailyRows.length,
      daily_primary_count: primaryCount,
      review_required_count: reviewCount,
      no_daily_primary_count: noneCount,
      development_dates: developmentDates,
      sep26: sep26,
      oct29: oct29,
      aug17: aug17,
      oct_7_28_scheduled_primaries: octRecovery.filter((r) => r.selection_status === 'DAILY_PRIMARY').length,
      unrecovered_no_primary: NO_CANDIDATE_DATES.length,
      candidate_horizon: {
        d30: horizonEligible(candidateDates, 30),
        d90: horizonEligible(candidateDates, 90),
        d180: horizonEligible(candidateDates, 180),
        d365: horizonEligible(candidateDates, 365),
      },
      primary_horizon: {
        d30: horizonEligible(dailyRows.filter((r) => r.selection_status === 'DAILY_PRIMARY').map((r) => r.observation_date), 30),
        d90: horizonEligible(dailyRows.filter((r) => r.selection_status === 'DAILY_PRIMARY').map((r) => r.observation_date), 90),
        d180: horizonEligible(dailyRows.filter((r) => r.selection_status === 'DAILY_PRIMARY').map((r) => r.observation_date), 180),
        d365: horizonEligible(dailyRows.filter((r) => r.selection_status === 'DAILY_PRIMARY').map((r) => r.observation_date), 365),
      },
      observation_date_source_counts: countBy(artifacts, 'observation_date_source'),
      operational_role_counts: countBy(artifacts, 'operational_role'),
      analytical_eligibility_counts: countBy(artifacts, 'analytical_eligibility'),
      sighting_class_counts: countBy(sightings, 'sighting_class'),
      evidence_grade_counts: countBy(artifacts, 'evidence_grade'),
      factor_weight_unit_counts: countBy(factorRows, 'factor_weight_unit'),
      factor_weight_source_field_counts: countBy(factorRows, 'factor_weight_source_field'),
    },
  };
}

export function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function parseArgs(argv) {
  const args = { sourceMainSha: null, outputDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source-main-sha') {
      args.sourceMainSha = argv[i + 1];
      i += 1;
    } else if (a === '--output-dir') {
      args.outputDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--source-main-sha=')) {
      args.sourceMainSha = a.slice('--source-main-sha='.length);
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
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.sourceMainSha) {
      throw new Error('Required: --source-main-sha <full SHA>');
    }
    const repoRoot = defaultRepoRoot();
    const outputDir = path.resolve(args.outputDir || path.join(repoRoot, 'research/historical-observations'));
    const result = buildManifests({
      repoRoot,
      sourceMainSha: args.sourceMainSha,
      outputDir,
    });
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    if (err.detail) process.stderr.write(`${err.detail}\n`);
    process.exitCode = 2;
  }
}
