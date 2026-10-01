#!/usr/bin/env node
// Deterministic builder for inactive v1.2 Stablecoin dated calibration artifact.
// Reuses R07-D first-parent PIT reconstruction. No network. Never writes public/data/**.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  R07D_CANDIDATE_SERIES_ID,
  R07D_CONFIG_LABEL,
  R07D_SCHEMA,
  loadFirstParentStablecoinCacheEvents,
  reconstructDatedBaselineFromEvents,
} from '../../../research/lib/r07-stablecoin-dated-baseline.mjs';
import {
  STABLECOIN_DATED_CALIBRATION_ID,
  STABLECOIN_DATED_CALIBRATION_SCHEMA,
  STABLECOIN_RECONSTRUCTION_LABEL,
  V12_IMPLEMENTATION_REVISION_TARGET,
  V12_MODEL_VERSION_TARGET,
  V12_SSOT_VERSION,
} from './stablecoins.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DEFAULT_EVIDENCE_THROUGH_SHA = '64f2ea06fbd810e2800fd9ae8c72c0eb50c72d2b';
const DEFAULT_ARTIFACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'stablecoin-dated-calibration-v1.json'
);

export const EXPECTED_CALIBRATION_OBSERVATION_COUNT = 327;
export const EXPECTED_EARLIEST_OBSERVATION_DATE = '2025-10-06';
export const EXPECTED_LATEST_OBSERVATION_DATE = '2026-09-29';
export const EXPECTED_MAX_PRIOR_DEPTH = 326;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildStablecoinDatedCalibrationDocument({
  repoRoot = REPO_ROOT,
  evidenceThroughSha = DEFAULT_EVIDENCE_THROUGH_SHA,
  loadEvents = loadFirstParentStablecoinCacheEvents,
  reconstruct = reconstructDatedBaselineFromEvents,
} = {}) {
  const events = loadEvents({
    repoRoot,
    repositorySha: evidenceThroughSha,
  });
  const report = reconstruct({
    repositorySha: evidenceThroughSha,
    generatedAtUtc: '1970-01-01T00:00:00.000Z',
    events,
  });

  const full = (report.candidate_series || []).filter((entry) =>
    entry.full_candidate_aggregate_ok === true
    && Number.isFinite(entry.aggregate_elapsed_30d_growth)
  );

  const observations = full
    .map((entry) => ({
      observation_date: entry.analysis_date,
      aggregate_elapsed_30d_growth: entry.aggregate_elapsed_30d_growth,
      analysis_event_commit_sha: entry.analysis_event_commit_sha,
      analysis_event_utc: entry.analysis_event_utc,
      initial_blob_sha: entry.initial_blob_sha,
      valid_coin_count: entry.valid_coin_count,
      configured_weight_coverage: entry.configured_weight_coverage,
    }))
    .sort((a, b) => a.observation_date.localeCompare(b.observation_date));

  // Collapse duplicate dates deterministically (keep first after sort = earliest event order
  // already encoded in analysis series; R07-D yields unique analysis dates).
  const byDate = new Map();
  for (const row of observations) {
    if (!byDate.has(row.observation_date)) byDate.set(row.observation_date, row);
  }
  const uniqueObservations = [...byDate.values()];

  const futureViolations =
    report.reconstruction_summary?.no_lookahead_integrity?.future_evidence_violation_count ?? null;
  const blockers = Array.isArray(report.blockers) ? report.blockers : [];
  const maxPriorDepth = Math.max(
    0,
    ...(report.candidate_series || []).map((e) => e.score?.prior_candidate_baseline_count || 0)
  );

  return {
    schema: STABLECOIN_DATED_CALIBRATION_SCHEMA,
    calibration_id: STABLECOIN_DATED_CALIBRATION_ID,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    reconstruction_label: STABLECOIN_RECONSTRUCTION_LABEL,
    evidence_through_sha: evidenceThroughSha,
    source_reconstruction_schema: R07D_SCHEMA,
    source_candidate_series_id: R07D_CANDIDATE_SERIES_ID,
    source_config_label: R07D_CONFIG_LABEL,
    legacy_baseline: {
      path: 'public/data/stablecoins-historical.json',
      classification: 'LEGACY_UNDATED_POSITIONAL_CALIBRATION',
      used_in_successor_calibration: false,
      synthetic_dates_assigned: false,
    },
    integrity: {
      future_evidence_violation_count: futureViolations,
      r07d_blocker_count: blockers.length,
      r07d_blockers: blockers,
      max_prior_candidate_baseline_depth: maxPriorDepth,
      observation_count: uniqueObservations.length,
      earliest_observation_date: uniqueObservations[0]?.observation_date ?? null,
      latest_observation_date: uniqueObservations.at(-1)?.observation_date ?? null,
    },
    observations: uniqueObservations,
  };
}

export function assertHardBaseCalibrationInvariants(document) {
  const errors = [];
  if (document.schema !== STABLECOIN_DATED_CALIBRATION_SCHEMA) {
    errors.push(`schema=${document.schema}`);
  }
  if (document.calibration_id !== STABLECOIN_DATED_CALIBRATION_ID) {
    errors.push(`calibration_id=${document.calibration_id}`);
  }
  if (document.reconstruction_label !== STABLECOIN_RECONSTRUCTION_LABEL) {
    errors.push(`reconstruction_label=${document.reconstruction_label}`);
  }
  if (document.evidence_through_sha !== DEFAULT_EVIDENCE_THROUGH_SHA) {
    errors.push(`evidence_through_sha=${document.evidence_through_sha}`);
  }
  if (document.legacy_baseline?.used_in_successor_calibration !== false) {
    errors.push('legacy baseline flagged as used');
  }
  if (document.integrity?.observation_count !== EXPECTED_CALIBRATION_OBSERVATION_COUNT) {
    errors.push(`observation_count=${document.integrity?.observation_count}`);
  }
  if (document.observations?.length !== EXPECTED_CALIBRATION_OBSERVATION_COUNT) {
    errors.push(`observations.length=${document.observations?.length}`);
  }
  if (document.integrity?.earliest_observation_date !== EXPECTED_EARLIEST_OBSERVATION_DATE) {
    errors.push(`earliest=${document.integrity?.earliest_observation_date}`);
  }
  if (document.integrity?.latest_observation_date !== EXPECTED_LATEST_OBSERVATION_DATE) {
    errors.push(`latest=${document.integrity?.latest_observation_date}`);
  }
  if (document.integrity?.future_evidence_violation_count !== 0) {
    errors.push(`future_violations=${document.integrity?.future_evidence_violation_count}`);
  }
  if (document.integrity?.r07d_blocker_count !== 0) {
    errors.push(`blockers=${document.integrity?.r07d_blocker_count}`);
  }
  if (document.integrity?.max_prior_candidate_baseline_depth !== EXPECTED_MAX_PRIOR_DEPTH) {
    errors.push(`max_prior_depth=${document.integrity?.max_prior_candidate_baseline_depth}`);
  }
  const dates = document.observations.map((o) => o.observation_date);
  for (let i = 1; i < dates.length; i += 1) {
    if (dates[i] <= dates[i - 1]) errors.push(`dates_not_strictly_ascending_at_${i}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dates[i])) errors.push(`bad_date_${dates[i]}`);
  }
  if (dates.length && !/^\d{4}-\d{2}-\d{2}$/.test(dates[0])) errors.push(`bad_date_${dates[0]}`);
  for (const row of document.observations) {
    if (!Number.isFinite(row.aggregate_elapsed_30d_growth)) {
      errors.push(`non_finite_aggregate_${row.observation_date}`);
    }
  }
  if (errors.length) {
    const error = new Error(`calibration_invariant_failure: ${errors.join('; ')}`);
    error.errors = errors;
    throw error;
  }
  return true;
}

export function verifyStablecoinDatedCalibrationArtifact({
  artifactPath = DEFAULT_ARTIFACT_PATH,
  repoRoot = REPO_ROOT,
  evidenceThroughSha = DEFAULT_EVIDENCE_THROUGH_SHA,
} = {}) {
  const expected = buildStablecoinDatedCalibrationDocument({
    repoRoot,
    evidenceThroughSha,
  });
  assertHardBaseCalibrationInvariants(expected);
  const actualRaw = fs.readFileSync(artifactPath, 'utf8');
  const actual = JSON.parse(actualRaw);
  const expectedText = stableStringify(expected);
  if (actualRaw !== expectedText) {
    // Compare structurally if whitespace differs.
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      const error = new Error('calibration_artifact_mismatch');
      error.expected_observation_count = expected.observations.length;
      error.actual_observation_count = actual.observations?.length;
      throw error;
    }
  }
  return { ok: true, artifactPath, observation_count: expected.observations.length };
}

function parseArgs(argv) {
  const out = { verify: null, write: null, sha: DEFAULT_EVIDENCE_THROUGH_SHA };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--verify') {
      out.verify = argv[i + 1] || DEFAULT_ARTIFACT_PATH;
      i += 1;
    } else if (arg === '--write') {
      out.write = argv[i + 1];
      i += 1;
    } else if (arg === '--sha') {
      out.sha = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.verify && !args.write) {
    console.error('Usage: --verify <path> | --write <path> [--sha <evidenceThroughSha>]');
    process.exitCode = 2;
    return;
  }
  if (args.verify) {
    const result = verifyStablecoinDatedCalibrationArtifact({
      artifactPath: path.resolve(args.verify),
      evidenceThroughSha: args.sha,
    });
    console.log(JSON.stringify({ ok: true, mode: 'verify', ...result }));
    return;
  }
  const document = buildStablecoinDatedCalibrationDocument({
    evidenceThroughSha: args.sha,
  });
  assertHardBaseCalibrationInvariants(document);
  const outPath = path.resolve(args.write);
  if (outPath.includes(`${path.sep}public${path.sep}data${path.sep}`)
    || outPath.replace(/\\/g, '/').includes('/public/data/')) {
    throw new Error('refusing_to_write_public_data');
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stableStringify(document), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    mode: 'write',
    path: outPath,
    observation_count: document.observations.length,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
