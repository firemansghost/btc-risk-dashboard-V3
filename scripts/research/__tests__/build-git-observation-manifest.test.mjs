import test from 'node:test';
import assert from 'node:assert/strict';
import {
  csvEscape,
  toCsv,
  observationFieldsFromParsed,
  normalizeBand,
  normalizePrice,
  normalizeScore,
  isScheduledEtl,
  classifySightingTopology,
  applyInvalidSightingClass,
  operationalRole,
  artifactEvidenceClass,
  analyticalEligibility,
  extractFactorRows,
  selectDailyPrimary,
  analyzeIntroducingSightings,
  RECONSTRUCTION_BLOB_SHA,
  SERIAL_RESTORE_BLOB_SHA,
  SERIAL_RESTORE_FIRST_COMMIT,
  SERIAL_RESTORE_LATER_COMMIT,
} from '../build-git-observation-manifest.mjs';

test('observation-date hierarchy: consistent snapshot_date and as_of_utc', () => {
  const out = observationFieldsFromParsed(
    {
      snapshot_date: '2026-08-17',
      as_of_utc: '2026-08-17T15:44:32.381Z',
    },
    '2026-08-19T00:00:00.000Z',
  );
  assert.equal(out.observation_date, '2026-08-17');
  assert.equal(out.observation_date_source, 'snapshot_date');
  assert.equal(out.observation_as_of_utc, '2026-08-17T15:44:32.381Z');
});

test('observation-date conflict: snapshot_date vs as_of_utc different UTC dates throws', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        {
          snapshot_date: '2026-08-17',
          as_of_utc: '2026-08-18T01:00:00Z',
        },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: conflicting high-priority observation UTC dates:.*snapshot_date=2026-08-17.*as_of_utc=2026-08-18/,
  );
});

test('observation-date conflict: snapshot_date vs legacy timestamp different UTC dates throws', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        {
          snapshot_date: '2026-08-17',
          updated_at: '2026-08-16T21:00:00.000Z',
        },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: conflicting high-priority observation UTC dates:.*snapshot_date=2026-08-17.*updated_at=2026-08-16/,
  );
});

test('observation-date conflict: as_of_utc vs legacy timestamp different UTC dates throws', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        {
          as_of_utc: '2026-08-17T15:44:32.381Z',
          updated_at: '2026-08-16T21:00:00.000Z',
        },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: conflicting high-priority observation UTC dates:.*as_of_utc=2026-08-17.*updated_at=2026-08-16/,
  );
});

test('malformed as_of_utc throws and does not fall back to commit date', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        { as_of_utc: 'not-a-timestamp' },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: malformed as_of_utc=/,
  );
});

test('malformed snapshot_date throws and does not fall back', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        { snapshot_date: '2026/08/17' },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: malformed snapshot_date=/,
  );
});

test('invalid date-only snapshot_date 2026-02-30 throws', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        { snapshot_date: '2026-02-30' },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: invalid calendar snapshot_date=/,
  );
});

test('observation-date hierarchy: as_of_utc wins over legacy timestamp', () => {
  const out = observationFieldsFromParsed(
    {
      as_of_utc: '2025-10-07T11:19:00.000Z',
      updated_at: '2025-10-07T10:00:00.000Z',
    },
    '2025-10-07T12:00:00.000Z',
  );
  assert.equal(out.observation_date, '2025-10-07');
  assert.equal(out.observation_date_source, 'as_of_utc');
  assert.equal(out.observation_as_of_utc, '2025-10-07T11:19:00.000Z');
});

test('observation-date hierarchy: legacy timestamp when no snapshot/as_of', () => {
  const out = observationFieldsFromParsed(
    { updated_at: '2025-09-15T21:08:21.493Z', composite: 47 },
    '2025-09-15T21:10:00.000Z',
  );
  assert.equal(out.observation_date, '2025-09-15');
  assert.equal(out.observation_date_source, 'legacy_timestamp');
  assert.equal(out.observation_as_of_utc, '2025-09-15T21:08:21.493Z');
});

test('observation-date hierarchy: commit fallback', () => {
  const out = observationFieldsFromParsed({}, '2025-09-20T04:00:00.000Z');
  assert.equal(out.observation_date, '2025-09-20');
  assert.equal(out.observation_date_source, 'commit_date_fallback');
  assert.equal(out.observation_as_of_utc, null);
});

test('observation-date hierarchy: daily_close_date only if 1-3 absent', () => {
  const withAsOf = observationFieldsFromParsed(
    { as_of_utc: '2026-05-07T11:19:00.000Z', daily_close_date: '2026-05-06' },
    '2026-05-07T12:00:00.000Z',
  );
  assert.equal(withAsOf.observation_date_source, 'as_of_utc');
  assert.equal(withAsOf.observation_date, '2026-05-07');
  const onlyClose = observationFieldsFromParsed(
    { daily_close_date: '2026-05-06' },
    '2026-05-07T12:00:00.000Z',
  );
  assert.equal(onlyClose.observation_date, '2026-05-06');
  assert.equal(onlyClose.observation_date_source, 'daily_close_date');
});

test('daily_close_date may differ from as_of_utc without triggering a high-priority conflict', () => {
  const out = observationFieldsFromParsed(
    {
      as_of_utc: '2026-05-07T11:19:00.000Z',
      daily_close_date: '2026-05-06',
    },
    '2026-05-07T12:00:00.000Z',
  );
  assert.equal(out.observation_date, '2026-05-07');
  assert.equal(out.observation_date_source, 'as_of_utc');
  assert.equal(out.observation_as_of_utc, '2026-05-07T11:19:00.000Z');
});

test('malformed daily_close_date throws when it is the selected observation-time field', () => {
  assert.throws(
    () =>
      observationFieldsFromParsed(
        { daily_close_date: 'not-a-date' },
        '2026-08-19T00:00:00.000Z',
      ),
    /STOP: malformed daily_close_date=/,
  );
});

test('invalid JSON uses unknown observation date, not commit fallback', () => {
  const out = observationFieldsFromParsed({ as_of_utc: '2025-09-16T00:00:00Z' }, '2025-09-16T12:00:00Z', {
    invalidJson: true,
  });
  assert.equal(out.observation_date, null);
  assert.equal(out.observation_date_source, 'unknown');
  assert.equal(out.observation_as_of_utc, null);
});

test('true numeric 0 preserved for score and CSV', () => {
  assert.equal(normalizeScore({ composite_score: 0 }), 0);
  assert.equal(csvEscape(0), '0');
  assert.equal(toCsv(['score'], [{ score: 0 }]), 'score\n0\n');
});

test('null remains empty CSV field, not string null or 0', () => {
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
  assert.equal(toCsv(['score'], [{ score: null }]), 'score\n\n');
  assert.notEqual(csvEscape(null), '0');
  assert.notEqual(csvEscape(null), 'null');
});

test('band normalization prefers label then name then string', () => {
  assert.equal(normalizeBand({ band: { label: 'Hold/Neutral', name: 'hold' } }), 'Hold/Neutral');
  assert.equal(normalizeBand({ band: { name: 'Hold/Neutral' } }), 'Hold/Neutral');
  assert.equal(normalizeBand({ band: 'Hold/Neutral' }), 'Hold/Neutral');
  assert.equal(normalizeBand({}), null);
});

test('price normalization prefers price_usd then btc.spot_usd', () => {
  assert.equal(normalizePrice({ price_usd: 100, btc: { spot_usd: 200 } }), 100);
  assert.equal(normalizePrice({ btc: { spot_usd: 200 } }), 200);
  assert.equal(normalizePrice({}), null);
});

test('scheduled_etl requires all three H3 signals', () => {
  assert.equal(
    isScheduledEtl({
      commit_author: 'ghostgauge-bot',
      commit_message: 'chore(etl): update artifacts [skip ci]',
    }),
    true,
  );
  assert.equal(
    isScheduledEtl({
      commit_author: 'ghostgauge-bot',
      commit_message: 'chore(etl): update artifacts',
    }),
    false,
  );
  assert.equal(
    isScheduledEtl({
      commit_author: 'firemansghost',
      commit_message: 'chore(etl): update artifacts [skip ci]',
    }),
    false,
  );
});

test('human commit is not scheduled merely from latest.json update', () => {
  const role = operationalRole({
    blobSha: 'abc',
    invalidJson: false,
    commit_sha: 'deadbeef',
    commit_author: 'firemansghost',
    commit_message: 'fix: tweak mixer and refresh latest.json',
  });
  assert.equal(role, 'human_feature_commit');
  assert.equal(
    isScheduledEtl({
      commit_author: 'firemansghost',
      commit_message: 'fix: tweak mixer and refresh latest.json',
    }),
    false,
  );
});

test('verified recovery allowlist', () => {
  const role = operationalRole({
    blobSha: 'abc',
    invalidJson: false,
    commit_sha: 'db789cd9c59b474044d428bfdccbe07312798236',
    commit_author: 'firemansghost',
    commit_message: 'fix: delayed recovery print',
  });
  assert.equal(role, 'verified_recovery');
  assert.equal(
    analyticalEligibility({
      evidenceClass: 'COMMITTED_CONTEMPORANEOUS_CANDIDATE',
      role,
    }),
    'ELIGIBLE_VERIFIED_RECOVERY',
  );
});

test('reconstruction exclusion', () => {
  const evidenceClass = artifactEvidenceClass({ blobSha: RECONSTRUCTION_BLOB_SHA, invalidJson: false });
  const role = operationalRole({
    blobSha: RECONSTRUCTION_BLOB_SHA,
    invalidJson: false,
    commit_sha: '68462f345a075d56ad1f697722f16b35abc89262',
    commit_author: 'firemansghost',
    commit_message: 'feat: historical rewrite',
  });
  assert.equal(evidenceClass, 'EXCLUDED_RECONSTRUCTION');
  assert.equal(role, 'reconstruction');
  assert.equal(analyticalEligibility({ evidenceClass, role }), 'INELIGIBLE_RECONSTRUCTION');
});

test('invalid conflict exclusion', () => {
  const evidenceClass = artifactEvidenceClass({ blobSha: 'ff'.repeat(20), invalidJson: true });
  const role = operationalRole({
    blobSha: 'ff'.repeat(20),
    invalidJson: true,
    commit_sha: '961b50c693358719d5a952c3759488ec25cd13dd',
    commit_author: 'firemansghost',
    commit_message: 'Merge conflict',
  });
  assert.equal(evidenceClass, 'UNCERTAIN_INVALID_JSON');
  assert.equal(role, 'invalid_conflict');
  assert.equal(analyticalEligibility({ evidenceClass, role }), 'INELIGIBLE_INVALID');
  assert.equal(applyInvalidSightingClass('INTRODUCING_SIGHTING', true), 'INVALID_OR_UNKNOWN');
});

test('non-merge introducing classification', () => {
  const out = classifySightingTopology({
    latest_blob_sha: 'aaa',
    parent1_sha: 'parent',
    parent1_latest_blob_sha: 'bbb',
    parent2_sha: null,
    parent2_latest_blob_sha: null,
  });
  assert.equal(out.sighting_class, 'INTRODUCING_SIGHTING');
  assert.equal(out.is_new_blob_vs_parent1, true);
  assert.equal(out.is_new_blob_vs_parent2, null);
});

test('non-merge duplicate classification', () => {
  const out = classifySightingTopology({
    latest_blob_sha: 'aaa',
    parent1_sha: 'parent',
    parent1_latest_blob_sha: 'aaa',
    parent2_sha: null,
    parent2_latest_blob_sha: null,
  });
  assert.equal(out.sighting_class, 'DUPLICATE_BLOB');
  assert.equal(out.is_new_blob_vs_parent1, false);
});

test('merge carry classification', () => {
  const out = classifySightingTopology({
    latest_blob_sha: 'keep',
    parent1_sha: 'p1',
    parent1_latest_blob_sha: 'keep',
    parent2_sha: 'p2',
    parent2_latest_blob_sha: 'other',
  });
  assert.equal(out.sighting_class, 'MERGE_CARRY_FORWARD');
  assert.equal(out.is_new_blob_vs_parent1, false);
  assert.equal(out.is_new_blob_vs_parent2, true);
});

test('merge-new classification', () => {
  const out = classifySightingTopology({
    latest_blob_sha: 'resolved',
    parent1_sha: 'p1',
    parent1_latest_blob_sha: 'left',
    parent2_sha: 'p2',
    parent2_latest_blob_sha: 'right',
  });
  assert.equal(out.sighting_class, 'MERGE_NEW_BLOB');
  assert.equal(out.is_new_blob_vs_parent1, true);
  assert.equal(out.is_new_blob_vs_parent2, true);
});

function artifact(partial) {
  return {
    artifact_id: partial.artifact_id || 'id',
    canonical_artifact_commit_sha: partial.canonical_artifact_commit_sha || 'c1',
    commit_timestamp_utc: partial.commit_timestamp_utc || '2025-09-26T11:19:00.000Z',
    observation_as_of_utc: partial.observation_as_of_utc || '2025-09-26T11:19:00.000Z',
    artifact_evidence_class: partial.artifact_evidence_class || 'COMMITTED_CONTEMPORANEOUS_CANDIDATE',
    analytical_eligibility: partial.analytical_eligibility,
    operational_role: partial.operational_role,
    score: partial.score ?? 47,
    ...partial,
  };
}

test('Daily Rule scheduled selection uses earliest as_of_utc', () => {
  const selected = selectDailyPrimary([
    artifact({
      artifact_id: 'later',
      analytical_eligibility: 'ELIGIBLE_SCHEDULED',
      observation_as_of_utc: '2025-10-29T12:00:00.000Z',
      score: 57,
    }),
    artifact({
      artifact_id: 'earliest',
      canonical_artifact_commit_sha: '5c4535b2a8cc43ca52c74e66bba630b899c8cb09',
      analytical_eligibility: 'ELIGIBLE_SCHEDULED',
      observation_as_of_utc: '2025-10-29T11:21:00.000Z',
      score: 55,
    }),
    artifact({
      artifact_id: 'human',
      analytical_eligibility: 'REVIEW_REQUIRED',
      observation_as_of_utc: '2025-10-29T10:00:00.000Z',
      score: 99,
    }),
  ]);
  assert.equal(selected.selection_status, 'DAILY_PRIMARY');
  assert.equal(selected.selection_reason, 'earliest_eligible_scheduled');
  assert.equal(selected.primary.artifact_id, 'earliest');
  assert.equal(selected.primary.score, 55);
});

test('Daily Rule recovery fallback', () => {
  const selected = selectDailyPrimary([
    artifact({
      artifact_id: 'dev',
      analytical_eligibility: 'REVIEW_REQUIRED',
      score: 40,
    }),
    artifact({
      artifact_id: 'recovery',
      canonical_artifact_commit_sha: 'db789cd9c59b474044d428bfdccbe07312798236',
      analytical_eligibility: 'ELIGIBLE_VERIFIED_RECOVERY',
      score: 47,
    }),
  ]);
  assert.equal(selected.selection_reason, 'verified_recovery');
  assert.equal(selected.primary.artifact_id, 'recovery');
});

test('Daily Rule manual fallback architecture', () => {
  const selected = selectDailyPrimary([
    artifact({
      artifact_id: 'manual',
      analytical_eligibility: 'ELIGIBLE_VERIFIED_MANUAL_PRINT',
      score: 50,
    }),
    artifact({
      artifact_id: 'human',
      analytical_eligibility: 'REVIEW_REQUIRED',
      score: 12,
    }),
  ]);
  assert.equal(selected.selection_reason, 'verified_manual_print');
  assert.equal(selected.primary.artifact_id, 'manual');
});

test('candidate-only date => REVIEW_REQUIRED', () => {
  const selected = selectDailyPrimary([
    artifact({
      artifact_id: 'human',
      analytical_eligibility: 'REVIEW_REQUIRED',
      operational_role: 'human_feature_commit',
      score: 39,
    }),
  ]);
  assert.equal(selected.selection_status, 'REVIEW_REQUIRED');
  assert.equal(selected.selection_reason, 'candidate_artifacts_exist_but_no_eligible_primary');
  assert.equal(selected.primary, null);
});

test('no-candidate date => NO_DAILY_PRIMARY', () => {
  const selected = selectDailyPrimary([]);
  assert.equal(selected.selection_status, 'NO_DAILY_PRIMARY');
  assert.equal(selected.selection_reason, 'no_committed_candidate');
  assert.equal(selected.candidate_artifact_count, 0);
  assert.equal(selected.primary, null);
});

test('factor null score does not become 0', () => {
  const rows = extractFactorRows(
    { artifact_id: 'a', canonical_artifact_commit_sha: 'c', observation_date: '2025-09-18', model_version: 'v3.1.0', implementation_revision: null },
    { factors: [{ key: 'onchain', label: 'Onchain', score: null, status: 'excluded', weight: 10 }] },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].factor_score, null);
  assert.notEqual(rows[0].factor_score, 0);
  assert.equal(csvEscape(rows[0].factor_score), '');
});

test('factor native weight preserved; weight_pct only from weight_pct field', () => {
  const nativeOnly = extractFactorRows(
    { artifact_id: 'a', canonical_artifact_commit_sha: 'c', observation_date: '2025-09-18', model_version: 'v3.1.0', implementation_revision: null },
    { factors: [{ key: 'trend', score: 25, weight: 25, status: 'fresh' }] },
  )[0];
  assert.equal(nativeOnly.factor_weight_native, 25);
  assert.equal(nativeOnly.factor_weight_source_field, 'weight');
  assert.equal(nativeOnly.factor_weight_unit, 'unknown');
  assert.equal(nativeOnly.factor_weight_pct, null);

  const both = extractFactorRows(
    { artifact_id: 'a', canonical_artifact_commit_sha: 'c', observation_date: '2026-08-17', model_version: 'v1.1.1', implementation_revision: 'integrity-2026-08' },
    { factors: [{ key: 'trend', score: 20, weight: 0.3, weight_pct: 30, status: 'fresh', last_utc: '2026-08-17T00:00:00Z' }] },
  )[0];
  assert.equal(both.factor_weight_pct, 30);
  assert.equal(both.factor_weight_native, 0.3);
  assert.equal(both.factor_weight_source_field, 'weight_pct');
  assert.equal(both.factor_weight_unit, 'pct');
  assert.equal(both.source_observation_time, '2026-08-17T00:00:00Z');
});

test('RFC4180 escaping and deterministic output', () => {
  const csv = toCsv(['commit_message', 'score'], [
    { commit_message: 'say "hello", world', score: 0 },
    { commit_message: 'plain', score: null },
  ]);
  assert.equal(csv, 'commit_message,score\n"say ""hello"", world",0\nplain,\n');
});

test('serial restore: both parent-relative INTRODUCING, one independent origin', () => {
  const a = classifySightingTopology({
    latest_blob_sha: 'X',
    parent1_sha: 'root',
    parent1_latest_blob_sha: 'prior',
    parent2_sha: null,
    parent2_latest_blob_sha: null,
  });
  const c = classifySightingTopology({
    latest_blob_sha: 'X',
    parent1_sha: 'B',
    parent1_latest_blob_sha: 'Y',
    parent2_sha: null,
    parent2_latest_blob_sha: null,
  });
  assert.equal(a.sighting_class, 'INTRODUCING_SIGHTING');
  assert.equal(c.sighting_class, 'INTRODUCING_SIGHTING');
  const analysis = analyzeIntroducingSightings(
    [
      { commit_sha: 'A', commit_timestamp_utc: '2025-09-16T21:00:00.000Z' },
      { commit_sha: 'C', commit_timestamp_utc: '2025-09-16T21:32:00.000Z' },
    ],
    (earlier, later) => earlier === 'A' && later === 'C',
  );
  assert.equal(analysis.parent_relative_count, 2);
  assert.equal(analysis.independent_count, 1);
  assert.equal(analysis.multiple_independent, false);
  assert.equal(analysis.canonical_commit_sha, 'A');
});

test('actual independent sibling introductions request STOP', () => {
  const analysis = analyzeIntroducingSightings(
    [
      { commit_sha: 'left', commit_timestamp_utc: '2025-09-16T20:00:00.000Z' },
      { commit_sha: 'right', commit_timestamp_utc: '2025-09-16T20:01:00.000Z' },
    ],
    () => false,
  );
  assert.equal(analysis.parent_relative_count, 2);
  assert.equal(analysis.independent_count, 2);
  assert.equal(analysis.multiple_independent, true);
});

test('pinned serial-restore blob 8715f91a uses correct SHAs and REVIEW_REQUIRED', () => {
  assert.equal(SERIAL_RESTORE_BLOB_SHA, '8715f91aa5c946ab8d6eec938c8514bf24f17604');
  assert.equal(SERIAL_RESTORE_FIRST_COMMIT, '37174a41097dfc3634e171db651431c59ed9f62f');
  assert.equal(SERIAL_RESTORE_LATER_COMMIT, '70b4d93361f05332261e34f783191c36b36b97ae');
  assert.match(SERIAL_RESTORE_LATER_COMMIT, /261e34/);
  assert.doesNotMatch(SERIAL_RESTORE_LATER_COMMIT, /261f34/);
  const analysis = analyzeIntroducingSightings(
    [
      { commit_sha: SERIAL_RESTORE_FIRST_COMMIT, commit_timestamp_utc: '2025-09-16T21:00:56.000Z' },
      { commit_sha: SERIAL_RESTORE_LATER_COMMIT, commit_timestamp_utc: '2025-09-16T21:32:44.000Z' },
    ],
    (earlier, later) => earlier === SERIAL_RESTORE_FIRST_COMMIT && later === SERIAL_RESTORE_LATER_COMMIT,
  );
  assert.equal(analysis.parent_relative_count, 2);
  assert.equal(analysis.independent_count, 1);
  assert.equal(analysis.multiple_independent, false);
  assert.equal(analysis.canonical_commit_sha, SERIAL_RESTORE_FIRST_COMMIT);
  const role = operationalRole({
    blobSha: SERIAL_RESTORE_BLOB_SHA,
    invalidJson: false,
    commit_sha: SERIAL_RESTORE_FIRST_COMMIT,
    commit_author: 'firemansghost',
    commit_message: 'ETL: update Bitcoin price to ,914 and refresh all factors',
  });
  assert.equal(role, 'human_feature_commit');
  assert.equal(
    analyticalEligibility({
      evidenceClass: 'COMMITTED_CONTEMPORANEOUS_CANDIDATE',
      role,
    }),
    'REVIEW_REQUIRED',
  );
});
