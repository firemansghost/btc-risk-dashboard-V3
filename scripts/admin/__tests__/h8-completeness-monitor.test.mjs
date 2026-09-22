import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseStrictUtcDate,
  addUtcDays,
  previousUtcDate,
  inclusiveUtcDates,
  observationExpectedDates,
  btcCloseExpectedDates,
  parseCliArgs,
  UsageError,
  extractObservationMetadata,
  extractCloseMetadata,
  extractStartMetadata,
  compareScientificFingerprint,
  identityStatus,
  runIdentityStatus,
  frozenWorktreeDirtyPaths,
  buildMonitorReport,
  renderHumanReport,
  toSafeJson,
  AXIS_A_STATES,
} from '../lib/h8-completeness-core.mjs';
import { parseH8V2StopArtifact } from '../../research/lib/h8-v2-prospective-capture-core.mjs';

const FINGERPRINT = {
  'config/dashboard-config.json': 'aaa111',
  'lib/config-loader.mjs': 'bbb222',
  'scripts/etl/compute.mjs': 'ccc333',
  'scripts/etl/factors.mjs': 'ddd444',
  'scripts/etl/factors/': 'eee555',
  'scripts/etl/factors/trendValuation.mjs': 'fff666',
  'scripts/etl/lib/': 'ggg777',
  'scripts/etl/stalenessUtils.mjs': 'hhh888',
  'scripts/etl/marketCalendar.mjs': 'iii999',
  'scripts/etl/adjustments.mjs': 'jjj000',
  'scripts/etl/coinGeckoCache.mjs': 'kkk111',
  'scripts/etl/priceHistory.mjs': 'lll222',
  'scripts/etl/fetch-helper.mjs': 'mmm333',
};

const IDENTITY = {
  study_id: 'h8-v2-prospective',
  protocol_version: 'h8-prospective-three-model-v2',
  protocol_sha: 'protocol-sha-test',
  capture_contract_version: 'h8-v2-capture-implementation-contract-v1',
  capture_contract_sha: 'contract-sha-test',
};

function makeStart(overrides = {}) {
  return extractStartMetadata({
    schema_version: 'h8-v2-start-v1',
    ...IDENTITY,
    scientific_fingerprint: { ...FINGERPRINT },
    start_date_utc: '2026-09-02',
    observation_end_date_utc: '2027-02-28',
    required_close_end_date_utc: '2027-03-30',
    recovery_end_date_utc: '2027-04-07',
    ...overrides,
  });
}

function makeObservation(date, overrides = {}) {
  return extractObservationMetadata({
    schema_version: 'h8-v2-observation-v1',
    ...IDENTITY,
    observation_date: date,
    axis_a_status: 'ELIGIBLE',
    scientific_fingerprint: { ...FINGERPRINT },
    github_run_id: '1001',
    github_event_name: 'schedule',
    github_run_attempt: 1,
    official_published_score: 'CANARY_OFFICIAL_PUBLISHED',
    official_formula_score: 'CANARY_OFFICIAL_FORMULA',
    liq_heavy_score: 'CANARY_LIQ_HEAVY',
    mom_tilted_score: 'CANARY_MOM_TILTED',
    model_weight_definitions: { canary: 'CANARY_WEIGHTS' },
    ...overrides,
  });
}

function makeClose(date, overrides = {}) {
  return extractCloseMetadata({
    schema_version: 'h8-v2-close-v1',
    ...IDENTITY,
    close_date_utc: date,
    github_run_id: '2002',
    github_event_name: 'schedule',
    github_run_attempt: 1,
    close_usd: 'CANARY_CLOSE_USD',
    ...overrides,
  });
}

function artifactsFrom(dates, factory) {
  const out = {};
  for (const date of dates) out[date] = { metadata: factory(date) };
  return out;
}

function baseRepository() {
  return {
    headSha: 'headsha000',
    porcelain: '',
    headFingerprint: { ...FINGERPRINT },
  };
}

function reportWith(overrides = {}) {
  return buildMonitorReport({
    generatedAtUtc: '2026-09-10T00:00:00.000Z',
    throughDateUtc: '2026-09-04',
    throughMode: 'explicit',
    start: makeStart(),
    observationArtifacts: artifactsFrom(['2026-09-02', '2026-09-03', '2026-09-04'], makeObservation),
    closeArtifacts: artifactsFrom(['2026-09-02', '2026-09-03'], makeClose),
    repository: baseRepository(),
    ...overrides,
  });
}

const CANARIES = [
  'CANARY_OFFICIAL_PUBLISHED',
  'CANARY_OFFICIAL_FORMULA',
  'CANARY_LIQ_HEAVY',
  'CANARY_MOM_TILTED',
  'CANARY_WEIGHTS',
  'CANARY_CLOSE_USD',
];

test('1. strict UTC date parsing', () => {
  assert.equal(parseStrictUtcDate('2026-09-09'), '2026-09-09');
  assert.equal(parseStrictUtcDate('2026-9-9'), null);
  assert.equal(parseStrictUtcDate('09/09/2026'), null);
  assert.equal(parseStrictUtcDate('2026-02-31'), null);
  assert.equal(parseStrictUtcDate('2026-09-09T00:00:00Z'), null);
  assert.equal(parseStrictUtcDate('yesterday'), null);
  assert.throws(() => parseCliArgs(['--through', '2026-9-9']), UsageError);
  assert.throws(() => parseCliArgs(['--through', '2026-02-31']), UsageError);
});

test('2. inclusive observation-date generation', () => {
  assert.deepEqual(
    observationExpectedDates({
      startDateUtc: '2026-09-02',
      observationEndDateUtc: '2027-02-28',
      throughDateUtc: '2026-09-05',
    }),
    ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
  );
});

test('3. observation range caps at observation_end_date_utc', () => {
  const dates = observationExpectedDates({
    startDateUtc: '2026-09-02',
    observationEndDateUtc: '2026-09-04',
    throughDateUtc: '2026-09-20',
  });
  assert.equal(dates[0], '2026-09-02');
  assert.equal(dates.at(-1), '2026-09-04');
  assert.equal(dates.length, 3);
});

test('4. missing expected observation becomes CAPTURE_MISSING', () => {
  const report = reportWith({
    observationArtifacts: artifactsFrom(['2026-09-02', '2026-09-03'], makeObservation),
  });
  const missing = report.observations.rows.find((row) => row.date === '2026-09-04');
  assert.equal(missing.axis_a_status, 'CAPTURE_MISSING');
  assert.equal(missing.artifact_status, 'MISSING');
  assert.equal(report.observations.axis_a_counts.CAPTURE_MISSING, 1);
});

test('5. stored ELIGIBLE preserved', () => {
  const report = reportWith();
  assert.equal(report.observations.rows[0].axis_a_status, 'ELIGIBLE');
  assert.equal(report.observations.axis_a_counts.ELIGIBLE, 3);
});

test('6. stored NOT_ELIGIBLE preserved', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': { metadata: makeObservation('2026-09-02', { axis_a_status: 'NOT_ELIGIBLE' }) },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].axis_a_status, 'NOT_ELIGIBLE');
  assert.equal(report.observations.axis_a_counts.NOT_ELIGIBLE, 1);
});

test('7. stored INTEGRITY_MISMATCH preserved', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': {
        metadata: makeObservation('2026-09-02', { axis_a_status: 'INTEGRITY_MISMATCH' }),
      },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  const row = report.observations.rows[0];
  assert.equal(row.axis_a_status, 'INTEGRITY_MISMATCH');
  assert.equal(report.observations.axis_a_counts.INTEGRITY_MISMATCH, 1);
  assert.equal(row.fingerprint_status, 'MATCH');
  assert.equal(row.identity_status, 'MATCH');
  assert.equal(row.run_identity_status, 'MATCH');
  assert.equal(report.observations.missing_dates.length, 0);
  assert.equal(report.btc_closes.missing, 0);
  assert.equal(report.repository.scientific_fingerprint_status, 'MATCH');
  assert.equal(report.repository.working_tree_clean, true);
  assert.equal(report.repository.frozen_worktree_clean, true);
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('8. invalid Axis A value fails closed', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': { metadata: makeObservation('2026-09-02', { axis_a_status: 'YES' }) },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].axis_a_status, null);
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
  assert.equal(report.structural_errors[0].message, 'axis_a_status is invalid');
  assert.ok(!AXIS_A_STATES.includes(report.observations.rows[0].axis_a_status));
});

test('9. observation filename/body date mismatch fails closed', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': { metadata: makeObservation('2026-09-03') },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
  assert.match(report.structural_errors[0].message, /filename date does not equal observation_date/);
  assert.equal(report.observations.rows[0].axis_a_status, null);
});

test('10. protocol identity MATCH', () => {
  const start = makeStart();
  const obs = makeObservation('2026-09-02');
  assert.equal(identityStatus(start, obs), 'MATCH');
  const report = reportWith();
  assert.equal(report.observations.rows[0].identity_status, 'MATCH');
});

test('11. protocol identity MISMATCH', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': {
        metadata: makeObservation('2026-09-02', { protocol_sha: 'other-protocol' }),
      },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].identity_status, 'MISMATCH');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('12. scientific fingerprint exact MATCH', () => {
  const result = compareScientificFingerprint(FINGERPRINT, { ...FINGERPRINT });
  assert.equal(result.status, 'MATCH');
  assert.deepEqual(result.mismatchedPaths, []);
  const report = reportWith();
  assert.equal(report.observations.rows[0].fingerprint_status, 'MATCH');
  assert.deepEqual(toSafeJson(report).observations.rows[0].fingerprint_mismatched_paths, []);
});

test('13. scientific fingerprint MISMATCH', () => {
  const changed = { ...FINGERPRINT, 'scripts/etl/compute.mjs': 'changed' };
  const result = compareScientificFingerprint(FINGERPRINT, changed);
  assert.equal(result.status, 'MISMATCH');
  assert.deepEqual(result.mismatchedPaths, ['scripts/etl/compute.mjs']);
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': {
        metadata: makeObservation('2026-09-02', { scientific_fingerprint: changed }),
      },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].fingerprint_status, 'MISMATCH');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
  const json = toSafeJson(report);
  assert.deepEqual(json.observations.rows[0].fingerprint_mismatched_paths, [
    'scripts/etl/compute.mjs',
  ]);
  assert.deepEqual(json.observations.rows[1].fingerprint_mismatched_paths, []);
  const human = renderHumanReport(report);
  assert.match(human, /Observation fingerprint mismatch:/);
  assert.match(human, /2026-09-02/);
  assert.match(human, /scripts\/etl\/compute\.mjs/);
  for (const canary of CANARIES) {
    assert.equal(JSON.stringify(json).includes(canary), false, canary);
    assert.equal(human.includes(canary), false, canary);
  }
});

test('14. schedule + attempt 1 run identity MATCH', () => {
  assert.equal(runIdentityStatus(makeObservation('2026-09-02')), 'MATCH');
  const report = reportWith();
  assert.equal(report.observations.rows[0].run_identity_status, 'MATCH');
});

test('15. workflow_dispatch run identity INVALID', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': {
        metadata: makeObservation('2026-09-02', { github_event_name: 'workflow_dispatch' }),
      },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].run_identity_status, 'INVALID');
  assert.equal(report.observations.rows[0].axis_a_status, 'ELIGIBLE');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('16. attempt 2 run identity INVALID', () => {
  const report = reportWith({
    observationArtifacts: {
      '2026-09-02': { metadata: makeObservation('2026-09-02', { github_run_attempt: 2 }) },
      '2026-09-03': { metadata: makeObservation('2026-09-03') },
      '2026-09-04': { metadata: makeObservation('2026-09-04') },
    },
  });
  assert.equal(report.observations.rows[0].run_identity_status, 'INVALID');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('17. BTC close expected range uses through minus one day', () => {
  assert.deepEqual(
    btcCloseExpectedDates({
      startDateUtc: '2026-09-02',
      requiredCloseEndDateUtc: '2027-03-30',
      throughDateUtc: '2026-09-09',
    }),
    inclusiveUtcDates('2026-09-02', '2026-09-08')
  );
});

test('18. close range continues after observation end', () => {
  const dates = btcCloseExpectedDates({
    startDateUtc: '2026-09-02',
    requiredCloseEndDateUtc: '2027-03-30',
    throughDateUtc: '2027-03-10',
  });
  assert.equal(dates[0], '2026-09-02');
  assert.equal(dates.at(-1), '2027-03-09');
  assert.ok(dates.includes('2027-03-01'));
});

test('19. close range caps at required_close_end_date', () => {
  const dates = btcCloseExpectedDates({
    startDateUtc: '2026-09-02',
    requiredCloseEndDateUtc: '2027-03-30',
    throughDateUtc: '2027-04-10',
  });
  assert.equal(dates.at(-1), '2027-03-30');
  assert.ok(!dates.includes('2027-03-31'));
});

test('20. missing close is reported only as MISSING', () => {
  const report = reportWith({
    closeArtifacts: artifactsFrom(['2026-09-02'], makeClose),
  });
  const missing = report.btc_closes.rows.find((row) => row.date === '2026-09-03');
  assert.equal(missing.artifact_status, 'MISSING');
  assert.equal(report.btc_closes.missing_dates.includes('2026-09-03'), true);
  const json = JSON.stringify(toSafeJson(report));
  assert.equal(json.includes('OUTCOME_COMPLETE'), false);
  assert.equal(json.includes('OUTCOME_INCOMPLETE'), false);
});

test('21. close filename/body mismatch fails closed', () => {
  const report = reportWith({
    closeArtifacts: {
      '2026-09-02': { metadata: makeClose('2026-09-03') },
      '2026-09-03': { metadata: makeClose('2026-09-03') },
    },
  });
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
  assert.match(report.structural_errors[0].message, /filename date does not equal close_date_utc/);
});

test('22. overall OK', () => {
  const report = reportWith();
  assert.equal(report.observations.missing_dates.length, 0);
  assert.equal(report.btc_closes.missing, 0);
  assert.equal(report.overall_status, 'OK');
});

test('23. overall ATTENTION from missing observation', () => {
  const report = reportWith({
    observationArtifacts: artifactsFrom(['2026-09-02', '2026-09-03'], makeObservation),
  });
  assert.equal(report.overall_status, 'ATTENTION');
});

test('24. overall ATTENTION from missing close', () => {
  const report = reportWith({
    closeArtifacts: artifactsFrom(['2026-09-02'], makeClose),
  });
  assert.equal(report.overall_status, 'ATTENTION');
});

test('25. overall INTEGRITY_ALERT from fingerprint mismatch', () => {
  const report = reportWith({
    repository: {
      ...baseRepository(),
      headFingerprint: { ...FINGERPRINT, 'lib/config-loader.mjs': 'nope' },
    },
  });
  assert.equal(report.repository.scientific_fingerprint_status, 'MISMATCH');
  assert.equal(report.scientific_fingerprint_enforcement, 'ACTIVE');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('26. human output contains no score or price values', () => {
  const report = reportWith();
  const human = renderHumanReport(report);
  for (const canary of CANARIES) {
    assert.equal(human.includes(canary), false, canary);
  }
  assert.equal(human.includes('official_published_score'), false);
  assert.equal(human.includes('close_usd'), false);
});

test('27. JSON output contains no score or price fields', () => {
  const report = reportWith();
  const json = JSON.stringify(toSafeJson(report));
  for (const canary of CANARIES) {
    assert.equal(json.includes(canary), false, canary);
  }
  assert.equal(json.includes('official_published_score'), false);
  assert.equal(json.includes('official_formula_score'), false);
  assert.equal(json.includes('liq_heavy_score'), false);
  assert.equal(json.includes('mom_tilted_score'), false);
  assert.equal(json.includes('model_weight_definitions'), false);
  assert.equal(json.includes('close_usd'), false);
  assert.equal(json.includes('"factors"'), false);
});

test('28. no performance calculations are present', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const core = await readFile(path.join(here, '..', 'lib', 'h8-completeness-core.mjs'), 'utf8');
  const cli = await readFile(path.join(here, '..', 'h8-completeness-monitor.mjs'), 'utf8');
  const production = `${core}\n${cli}`;
  for (const needle of [
    'MACE',
    'Spearman',
    'correlation',
    'future return',
    'forward return',
    'OUTCOME_COMPLETE',
    'OUTCOME_INCOMPLETE',
  ]) {
    assert.equal(production.includes(needle), false, needle);
  }
  const report = reportWith();
  assert.equal(addUtcDays('2026-09-09', -1), '2026-09-08');
  assert.equal(previousUtcDate(new Date('2026-09-10T15:00:00Z')), '2026-09-09');
  assert.ok(!('performance' in toSafeJson(report)));
});

test('29. rename away from a frozen path is FROZEN WORKTREE DIRTY', () => {
  const porcelain = 'R  config/dashboard-config.json -> scratch/dashboard-config.json\n';
  const dirty = frozenWorktreeDirtyPaths(porcelain, FINGERPRINT);
  assert.equal(dirty.includes('config/dashboard-config.json'), true);
  const report = reportWith({
    repository: { ...baseRepository(), porcelain },
  });
  assert.equal(report.repository.frozen_worktree_clean, false);
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
  assert.match(renderHumanReport(report), /FROZEN WORKTREE DIRTY/);
});

test('30. rename into a frozen path is FROZEN WORKTREE DIRTY', () => {
  const porcelain = 'R  scratch/dashboard-config.json -> config/dashboard-config.json\n';
  const dirty = frozenWorktreeDirtyPaths(porcelain, FINGERPRINT);
  assert.equal(dirty.includes('config/dashboard-config.json'), true);
  const report = reportWith({
    repository: { ...baseRepository(), porcelain },
  });
  assert.equal(report.repository.frozen_worktree_clean, false);
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});

test('31. unrelated rename does not mark frozen worktree dirty', () => {
  const porcelain = 'R  README.md -> README-old.md\n';
  const dirty = frozenWorktreeDirtyPaths(porcelain, FINGERPRINT);
  assert.deepEqual(dirty, []);
  const report = reportWith({
    repository: { ...baseRepository(), porcelain },
  });
  assert.equal(report.repository.working_tree_clean, false);
  assert.equal(report.repository.frozen_worktree_clean, true);
  assert.equal(report.overall_status, 'OK');
});

test('32. ordinary modified and deleted frozen paths remain dirty', () => {
  const modified = frozenWorktreeDirtyPaths(' M scripts/etl/compute.mjs\n', FINGERPRINT);
  assert.equal(modified.includes('scripts/etl/compute.mjs'), true);
  const deleted = frozenWorktreeDirtyPaths(' D lib/config-loader.mjs\n', FINGERPRINT);
  assert.equal(deleted.includes('lib/config-loader.mjs'), true);
  const treeChild = frozenWorktreeDirtyPaths(
    ' M scripts/etl/factors/trendValuation.mjs\n',
    FINGERPRINT
  );
  assert.equal(treeChild.includes('scripts/etl/factors/trendValuation.mjs'), true);
});

function officialStop() {
  return parseH8V2StopArtifact({
    schema_version: 'h8-v2-stop-v1',
    study_id: 'h8-v2-prospective',
    protocol_version: 'h8-prospective-three-model-v2',
    protocol_sha: 'a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3',
    capture_contract_version: 'h8-v2-capture-implementation-contract-v1',
    capture_contract_sha: 'b1adc9889e40efd94197f33e75ddb012ec486fa2',
    capture_source_sha: '10a34be3e9a6955a972774a26b50377cb872e5bc',
    start_date_utc: '2026-09-02',
    last_accepted_observation_date_utc: '2026-09-08',
    last_expected_observation_date_utc: '2026-09-21',
    closure_decision_date_utc: '2026-09-22',
    status: 'STOPPED_DURING_PROSPECTIVE_COLLECTION',
    reason_code: 'EXTERNAL_SOURCE_CAPTURE_AVAILABILITY_FAILURE',
    accepted_observation_count: 7,
    capture_missing_count_through_closure: 13,
    future_observation_capture_authorized: false,
    future_close_capture_authorized: false,
    missed_observation_reconstruction_authorized: false,
    successor_study_required_for_future_scientific_capture: true,
  });
}

function acceptedObservationArtifacts() {
  return artifactsFrom(
    [
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ],
    makeObservation
  );
}

test('33. valid STOP artifact is accepted by the closure parser', () => {
  const stop = officialStop();
  assert.equal(stop.last_expected_observation_date_utc, '2026-09-21');
  assert.equal(stop.future_observation_capture_authorized, false);
});

test('34. STOP artifact rejects a count that does not match the date window', () => {
  assert.throws(
    () =>
      parseH8V2StopArtifact({
        ...officialStop(),
        capture_missing_count_through_closure: 12,
      }),
    /capture_missing_count_through_closure/
  );
});

test('35. closed E03 caps observations at 2026-09-21 and keeps 13 CAPTURE_MISSING dates', () => {
  const missing = [
    '2026-09-09',
    '2026-09-10',
    '2026-09-11',
    '2026-09-12',
    '2026-09-13',
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
    '2026-09-20',
    '2026-09-21',
  ];
  for (const throughDateUtc of ['2026-09-21', '2026-09-22', '2026-09-30']) {
    const report = buildMonitorReport({
      generatedAtUtc: '2026-09-30T00:00:00.000Z',
      throughDateUtc,
      throughMode: 'explicit',
      start: makeStart(),
      observationArtifacts: acceptedObservationArtifacts(),
      closeArtifacts: {},
      repository: baseRepository(),
      stop: officialStop(),
    });
    assert.equal(report.observations.expected, 20, throughDateUtc);
    assert.equal(report.observations.landed, 7, throughDateUtc);
    assert.equal(report.observations.axis_a_counts.CAPTURE_MISSING, 13, throughDateUtc);
    assert.equal(report.observations.axis_a_counts.INTEGRITY_MISMATCH, 0, throughDateUtc);
    assert.deepEqual(report.observations.missing_dates, missing, throughDateUtc);
    assert.equal(
      report.observations.rows.some((row) => row.date >= '2026-09-22'),
      false,
      throughDateUtc
    );
    assert.equal(
      report.btc_closes.rows.some((row) => row.date > '2026-09-20'),
      false,
      throughDateUtc
    );
    assert.equal(report.close_accounting, 'historical_incomplete_not_active_recovery');
    assert.equal(report.scientific_fingerprint_enforcement, 'HISTORICAL_ONLY');
    assert.notEqual(report.overall_status, 'INTEGRITY_ALERT');
  }
});

test('36. closed study does not alert solely because current production HEAD diverges', () => {
  const report = buildMonitorReport({
    generatedAtUtc: '2026-09-30T00:00:00.000Z',
    throughDateUtc: '2026-09-30',
    throughMode: 'explicit',
    start: makeStart(),
    observationArtifacts: acceptedObservationArtifacts(),
    closeArtifacts: {},
    repository: {
      ...baseRepository(),
      headFingerprint: { ...FINGERPRINT, 'scripts/etl/factors.mjs': 'future-production-sha' },
    },
    stop: officialStop(),
  });
  assert.equal(report.stop.status, 'STOPPED_DURING_PROSPECTIVE_COLLECTION');
  assert.equal(report.scientific_fingerprint_enforcement, 'HISTORICAL_ONLY');
  assert.equal(report.repository.scientific_fingerprint_status, 'MISMATCH');
  assert.equal(
    report.repository.scientific_fingerprint_mismatched_paths.includes('scripts/etl/factors.mjs'),
    true
  );
  assert.equal(report.observations.axis_a_counts.CAPTURE_MISSING, 13);
  assert.equal(report.overall_status, 'ATTENTION');
  assert.match(renderHumanReport(report), /HISTORICAL_ONLY/);
  assert.match(renderHumanReport(report), /scripts\/etl\/factors\.mjs/);
});

test('37. an accepted observation fingerprint mismatch remains INTEGRITY_ALERT after closure', () => {
  const artifacts = acceptedObservationArtifacts();
  artifacts['2026-09-08'] = {
    metadata: makeObservation('2026-09-08', {
      scientific_fingerprint: { ...FINGERPRINT, 'scripts/etl/factors.mjs': 'altered-historical-sha' },
    }),
  };
  const report = buildMonitorReport({
    generatedAtUtc: '2026-09-30T00:00:00.000Z',
    throughDateUtc: '2026-09-30',
    throughMode: 'explicit',
    start: makeStart(),
    observationArtifacts: artifacts,
    closeArtifacts: {},
    repository: baseRepository(),
    stop: officialStop(),
  });
  assert.equal(report.scientific_fingerprint_enforcement, 'HISTORICAL_ONLY');
  assert.equal(report.repository.scientific_fingerprint_status, 'MATCH');
  assert.equal(report.overall_status, 'INTEGRITY_ALERT');
});
