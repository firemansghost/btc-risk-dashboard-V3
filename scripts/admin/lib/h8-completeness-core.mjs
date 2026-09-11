/**
 * E03 H8 v2 completeness monitor — pure classification and rendering.
 * Completeness metadata only. No writes. No network. No outcome math.
 */

export const MONITOR_SCHEMA_VERSION = 'h8-v2-completeness-monitor-v1';
export const OBSERVATION_SCHEMA_VERSION = 'h8-v2-observation-v1';
export const CLOSE_SCHEMA_VERSION = 'h8-v2-close-v1';
export const START_SCHEMA_VERSION = 'h8-v2-start-v1';

export const SUCCESS_EXIT = 0;
export const STRUCTURAL_EXIT = 2;
export const USAGE_EXIT = 64;

export const AXIS_A_STATES = Object.freeze([
  'ELIGIBLE',
  'NOT_ELIGIBLE',
  'INTEGRITY_MISMATCH',
  'CAPTURE_MISSING',
]);

export const MISSING_DATE_RUN_NOTE =
  'Missing-date run identity is not reconstructed by this local monitor.';

const UTC_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const START_FIELDS = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'scientific_fingerprint',
  'start_date_utc',
  'observation_end_date_utc',
  'required_close_end_date_utc',
  'recovery_end_date_utc',
]);

const OBSERVATION_FIELDS = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'observation_date',
  'axis_a_status',
  'scientific_fingerprint',
  'github_run_id',
  'github_event_name',
  'github_run_attempt',
]);

const CLOSE_FIELDS = Object.freeze([
  'schema_version',
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
  'close_date_utc',
  'github_run_id',
  'github_event_name',
  'github_run_attempt',
]);

const IDENTITY_FIELDS = Object.freeze([
  'study_id',
  'protocol_version',
  'protocol_sha',
  'capture_contract_version',
  'capture_contract_sha',
]);

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = USAGE_EXIT;
  }
}

export class StructuralError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StructuralError';
    this.exitCode = STRUCTURAL_EXIT;
    this.details = details;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function pickAllowlisted(source, fields) {
  const out = {};
  if (!isPlainObject(source)) return out;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      out[field] = source[field];
    }
  }
  return out;
}

function copyFingerprint(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const [key, sha] of Object.entries(value)) {
    if (typeof sha !== 'string' || sha.length === 0) return null;
    out[key] = sha;
  }
  return out;
}

export function parseStrictUtcDate(value) {
  if (typeof value !== 'string') return null;
  const match = UTC_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function addUtcDays(dateUtc, days) {
  const parsed = parseStrictUtcDate(dateUtc);
  if (!parsed) return null;
  const match = UTC_DATE_RE.exec(parsed);
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)
  );
  const year = utc.getUTCFullYear().toString().padStart(4, '0');
  const month = (utc.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = utc.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function previousUtcDate(now = new Date()) {
  const today = `${now.getUTCFullYear().toString().padStart(4, '0')}-${(now.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;
  return addUtcDays(today, -1);
}

export function inclusiveUtcDates(startUtc, endUtc) {
  const start = parseStrictUtcDate(startUtc);
  const end = parseStrictUtcDate(endUtc);
  if (!start || !end || start > end) return [];
  const dates = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return dates;
}

export function observationExpectedDates({
  startDateUtc,
  observationEndDateUtc,
  throughDateUtc,
}) {
  const start = parseStrictUtcDate(startDateUtc);
  const observationEnd = parseStrictUtcDate(observationEndDateUtc);
  const through = parseStrictUtcDate(throughDateUtc);
  if (!start || !observationEnd || !through) return [];
  if (through < start) return [];
  const end = through < observationEnd ? through : observationEnd;
  return inclusiveUtcDates(start, end);
}

export function btcCloseExpectedDates({
  startDateUtc,
  requiredCloseEndDateUtc,
  throughDateUtc,
}) {
  const start = parseStrictUtcDate(startDateUtc);
  const requiredEnd = parseStrictUtcDate(requiredCloseEndDateUtc);
  const through = parseStrictUtcDate(throughDateUtc);
  if (!start || !requiredEnd || !through) return [];
  const latestCaptureOpportunity = addUtcDays(through, -1);
  if (!latestCaptureOpportunity || latestCaptureOpportunity < start) return [];
  const end = latestCaptureOpportunity < requiredEnd ? latestCaptureOpportunity : requiredEnd;
  return inclusiveUtcDates(start, end);
}

export function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const parsed = {
    help: false,
    json: false,
    throughDateUtc: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }
    if (token === '--json') {
      parsed.json = true;
      continue;
    }
    if (token === '--through') {
      const value = args[i + 1];
      if (value == null || value.startsWith('--')) {
        throw new UsageError('Usage: --through YYYY-MM-DD');
      }
      if (parsed.throughDateUtc != null) {
        throw new UsageError('Usage: --through may be supplied once');
      }
      const date = parseStrictUtcDate(value);
      if (!date) {
        throw new UsageError(`Invalid --through date: ${value}. Expected strict UTC YYYY-MM-DD.`);
      }
      parsed.throughDateUtc = date;
      i += 1;
      continue;
    }
    throw new UsageError(`Unknown argument: ${token}`);
  }

  return parsed;
}

export function extractStartMetadata(source) {
  const picked = pickAllowlisted(source, START_FIELDS);
  const fingerprint = copyFingerprint(picked.scientific_fingerprint);
  return {
    schema_version: picked.schema_version,
    study_id: picked.study_id,
    protocol_version: picked.protocol_version,
    protocol_sha: picked.protocol_sha,
    capture_contract_version: picked.capture_contract_version,
    capture_contract_sha: picked.capture_contract_sha,
    scientific_fingerprint: fingerprint,
    start_date_utc: picked.start_date_utc,
    observation_end_date_utc: picked.observation_end_date_utc,
    required_close_end_date_utc: picked.required_close_end_date_utc,
    recovery_end_date_utc: picked.recovery_end_date_utc,
  };
}

export function extractObservationMetadata(source) {
  const picked = pickAllowlisted(source, OBSERVATION_FIELDS);
  return {
    schema_version: picked.schema_version,
    study_id: picked.study_id,
    protocol_version: picked.protocol_version,
    protocol_sha: picked.protocol_sha,
    capture_contract_version: picked.capture_contract_version,
    capture_contract_sha: picked.capture_contract_sha,
    observation_date: picked.observation_date,
    axis_a_status: picked.axis_a_status,
    scientific_fingerprint: copyFingerprint(picked.scientific_fingerprint),
    github_run_id: picked.github_run_id ?? null,
    github_event_name: picked.github_event_name ?? null,
    github_run_attempt: picked.github_run_attempt ?? null,
  };
}

export function extractCloseMetadata(source) {
  const picked = pickAllowlisted(source, CLOSE_FIELDS);
  return {
    schema_version: picked.schema_version,
    study_id: picked.study_id,
    protocol_version: picked.protocol_version,
    protocol_sha: picked.protocol_sha,
    capture_contract_version: picked.capture_contract_version,
    capture_contract_sha: picked.capture_contract_sha,
    close_date_utc: picked.close_date_utc,
    github_run_id: picked.github_run_id ?? null,
    github_event_name: picked.github_event_name ?? null,
    github_run_attempt: picked.github_run_attempt ?? null,
  };
}

export function compareScientificFingerprint(expected, actual) {
  const expectedMap = copyFingerprint(expected) || {};
  const actualMap = copyFingerprint(actual);
  if (!actualMap) {
    return { status: 'MISMATCH', mismatchedPaths: Object.keys(expectedMap).sort() };
  }
  const keys = new Set([...Object.keys(expectedMap), ...Object.keys(actualMap)]);
  const mismatchedPaths = [...keys]
    .filter((key) => expectedMap[key] !== actualMap[key])
    .sort();
  return {
    status: mismatchedPaths.length === 0 ? 'MATCH' : 'MISMATCH',
    mismatchedPaths,
  };
}

export function identityStatus(start, artifact) {
  for (const field of IDENTITY_FIELDS) {
    if (start[field] !== artifact[field]) return 'MISMATCH';
  }
  return 'MATCH';
}

export function runIdentityStatus(artifact) {
  if (artifact?.github_event_name === 'schedule' && artifact?.github_run_attempt === 1) {
    return 'MATCH';
  }
  return 'INVALID';
}

export function gitPathForFingerprintKey(key) {
  return key.endsWith('/') ? key.slice(0, -1) : key;
}

export function frozenScientificPaths(fingerprint) {
  return Object.keys(fingerprint || {}).map(gitPathForFingerprintKey);
}

function unquotePorcelainPath(value) {
  const trimmed = String(value).trim();
  return trimmed.replace(/^"(.*)"$/, '$1');
}

export function parsePorcelainPaths(porcelain) {
  if (!porcelain) return [];
  return String(porcelain)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length >= 4)
    .flatMap((line) => {
      const rest = line.slice(3);
      return rest
        .split(' -> ')
        .map(unquotePorcelainPath)
        .filter((entry) => entry.length > 0);
    });
}

export function frozenWorktreeDirtyPaths(porcelain, fingerprint) {
  const dirty = parsePorcelainPaths(porcelain);
  const frozen = frozenScientificPaths(fingerprint);
  return dirty.filter((path) =>
    frozen.some((frozenPath) => path === frozenPath || path.startsWith(`${frozenPath}/`))
  );
}

function validateStart(start) {
  if (start.schema_version !== START_SCHEMA_VERSION) {
    return 'start schema_version is not h8-v2-start-v1';
  }
  const dates = [
    start.start_date_utc,
    start.observation_end_date_utc,
    start.required_close_end_date_utc,
  ];
  if (dates.some((value) => !parseStrictUtcDate(value))) {
    return 'start artifact is missing a valid study calendar date';
  }
  if (!start.study_id || !start.protocol_version || !start.protocol_sha) {
    return 'start artifact is missing protocol identity fields';
  }
  if (!start.scientific_fingerprint) {
    return 'start artifact is missing scientific_fingerprint';
  }
  return null;
}

function observationStructuralError(filenameDate, metadata) {
  if (!metadata) return 'observation artifact could not be parsed';
  if (metadata.schema_version !== OBSERVATION_SCHEMA_VERSION) {
    return 'observation has the wrong schema';
  }
  for (const field of IDENTITY_FIELDS) {
    if (typeof metadata[field] !== 'string' || metadata[field].length === 0) {
      return `observation is missing required identity field ${field}`;
    }
  }
  if (!parseStrictUtcDate(metadata.observation_date)) {
    return 'observation_date is not a strict UTC calendar date';
  }
  if (metadata.observation_date !== filenameDate) {
    return 'observation filename date does not equal observation_date';
  }
  if (!metadata.scientific_fingerprint) {
    return 'observation is missing scientific_fingerprint';
  }
  if (typeof metadata.github_run_id !== 'string' && typeof metadata.github_run_id !== 'number') {
    return 'observation is missing github_run_id';
  }
  if (typeof metadata.github_event_name !== 'string') {
    return 'observation is missing github_event_name';
  }
  if (metadata.github_run_attempt == null) {
    return 'observation is missing github_run_attempt';
  }
  if (!AXIS_A_STATES.includes(metadata.axis_a_status)) {
    return 'axis_a_status is invalid';
  }
  return null;
}

function closeStructuralError(filenameDate, metadata) {
  if (!metadata) return 'close artifact could not be parsed';
  if (metadata.schema_version !== CLOSE_SCHEMA_VERSION) {
    return 'close has the wrong schema';
  }
  for (const field of IDENTITY_FIELDS) {
    if (typeof metadata[field] !== 'string' || metadata[field].length === 0) {
      return `close is missing required identity field ${field}`;
    }
  }
  if (!parseStrictUtcDate(metadata.close_date_utc)) {
    return 'close_date_utc is not a strict UTC calendar date';
  }
  if (metadata.close_date_utc !== filenameDate) {
    return 'close filename date does not equal close_date_utc';
  }
  if (typeof metadata.github_run_id !== 'string' && typeof metadata.github_run_id !== 'number') {
    return 'close is missing github_run_id';
  }
  if (typeof metadata.github_event_name !== 'string') {
    return 'close is missing github_event_name';
  }
  if (metadata.github_run_attempt == null) {
    return 'close is missing github_run_attempt';
  }
  return null;
}

function emptyAxisCounts() {
  return {
    ELIGIBLE: 0,
    NOT_ELIGIBLE: 0,
    INTEGRITY_MISMATCH: 0,
    CAPTURE_MISSING: 0,
  };
}

function deriveOverallStatus({
  headFingerprintStatus,
  frozenDirty,
  observationRows,
  closeRows,
  structuralErrors,
}) {
  const integrity =
    headFingerprintStatus === 'MISMATCH' ||
    frozenDirty ||
    structuralErrors.length > 0 ||
    observationRows.some(
      (row) =>
        row.axis_a_status === 'INTEGRITY_MISMATCH' ||
        row.fingerprint_status === 'MISMATCH' ||
        row.identity_status === 'MISMATCH' ||
        row.run_identity_status === 'INVALID'
    ) ||
    closeRows.some(
      (row) => row.identity_status === 'MISMATCH' || row.run_identity_status === 'INVALID'
    );
  if (integrity) return 'INTEGRITY_ALERT';

  const attention =
    observationRows.some((row) => row.axis_a_status === 'CAPTURE_MISSING') ||
    closeRows.some((row) => row.artifact_status === 'MISSING');
  return attention ? 'ATTENTION' : 'OK';
}

export function buildMonitorReport({
  generatedAtUtc,
  throughDateUtc,
  throughMode,
  start,
  observationArtifacts = {},
  closeArtifacts = {},
  repository,
}) {
  const startError = validateStart(start);
  if (startError) {
    throw new StructuralError(startError);
  }

  const expectedObservationDates = observationExpectedDates({
    startDateUtc: start.start_date_utc,
    observationEndDateUtc: start.observation_end_date_utc,
    throughDateUtc,
  });
  const expectedCloseDates = btcCloseExpectedDates({
    startDateUtc: start.start_date_utc,
    requiredCloseEndDateUtc: start.required_close_end_date_utc,
    throughDateUtc,
  });

  const dirtyFrozen = frozenWorktreeDirtyPaths(
    repository?.porcelain || '',
    start.scientific_fingerprint
  );
  const headComparison = compareScientificFingerprint(
    start.scientific_fingerprint,
    repository?.headFingerprint
  );
  const structuralErrors = [];

  const axisCounts = emptyAxisCounts();
  const observationRows = expectedObservationDates.map((date) => {
    const artifact = observationArtifacts[date];
    if (!artifact) {
      axisCounts.CAPTURE_MISSING += 1;
      return {
        date,
        artifact_status: 'MISSING',
        axis_a_status: 'CAPTURE_MISSING',
        fingerprint_status: 'NOT_APPLICABLE',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: null,
        github_event_name: null,
        github_run_attempt: null,
      };
    }
    if (artifact.parseError) {
      structuralErrors.push({ date, kind: 'observation', message: artifact.parseError });
      return {
        date,
        artifact_status: 'LANDED',
        axis_a_status: null,
        fingerprint_status: 'NOT_APPLICABLE',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: null,
        github_event_name: null,
        github_run_attempt: null,
      };
    }
    const structural = observationStructuralError(date, artifact.metadata);
    if (structural) {
      structuralErrors.push({ date, kind: 'observation', message: structural });
      return {
        date,
        artifact_status: 'LANDED',
        axis_a_status: null,
        fingerprint_status: 'NOT_APPLICABLE',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: artifact.metadata?.github_run_id ?? null,
        github_event_name: artifact.metadata?.github_event_name ?? null,
        github_run_attempt: artifact.metadata?.github_run_attempt ?? null,
      };
    }

    const fingerprint = compareScientificFingerprint(
      start.scientific_fingerprint,
      artifact.metadata.scientific_fingerprint
    );
    const identity = identityStatus(start, artifact.metadata);
    const runIdentity = runIdentityStatus(artifact.metadata);
    axisCounts[artifact.metadata.axis_a_status] += 1;
    return {
      date,
      artifact_status: 'LANDED',
      axis_a_status: artifact.metadata.axis_a_status,
      fingerprint_status: fingerprint.status,
      identity_status: identity,
      run_identity_status: runIdentity,
      github_run_id: artifact.metadata.github_run_id,
      github_event_name: artifact.metadata.github_event_name,
      github_run_attempt: artifact.metadata.github_run_attempt,
      fingerprint_mismatched_paths: fingerprint.mismatchedPaths,
    };
  });

  const closeRows = expectedCloseDates.map((date) => {
    const artifact = closeArtifacts[date];
    if (!artifact) {
      return {
        date,
        artifact_status: 'MISSING',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: null,
        github_event_name: null,
        github_run_attempt: null,
      };
    }
    if (artifact.parseError) {
      structuralErrors.push({ date, kind: 'close', message: artifact.parseError });
      return {
        date,
        artifact_status: 'LANDED',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: null,
        github_event_name: null,
        github_run_attempt: null,
      };
    }
    const structural = closeStructuralError(date, artifact.metadata);
    if (structural) {
      structuralErrors.push({ date, kind: 'close', message: structural });
      return {
        date,
        artifact_status: 'LANDED',
        identity_status: 'NOT_APPLICABLE',
        run_identity_status: 'NOT_APPLICABLE',
        github_run_id: artifact.metadata?.github_run_id ?? null,
        github_event_name: artifact.metadata?.github_event_name ?? null,
        github_run_attempt: artifact.metadata?.github_run_attempt ?? null,
      };
    }
    return {
      date,
      artifact_status: 'LANDED',
      identity_status: identityStatus(start, artifact.metadata),
      run_identity_status: runIdentityStatus(artifact.metadata),
      github_run_id: artifact.metadata.github_run_id,
      github_event_name: artifact.metadata.github_event_name,
      github_run_attempt: artifact.metadata.github_run_attempt,
    };
  });

  const missingObservationDates = observationRows
    .filter((row) => row.artifact_status === 'MISSING')
    .map((row) => row.date);
  const missingCloseDates = closeRows
    .filter((row) => row.artifact_status === 'MISSING')
    .map((row) => row.date);

  const overallStatus = deriveOverallStatus({
    headFingerprintStatus: headComparison.status,
    frozenDirty: dirtyFrozen.length > 0,
    observationRows,
    closeRows,
    structuralErrors,
  });

  return {
    schema_version: MONITOR_SCHEMA_VERSION,
    study_id: start.study_id,
    generated_at_utc: generatedAtUtc,
    through_date_utc: throughDateUtc,
    through_mode: throughMode,
    repository: {
      head_sha: repository?.headSha || null,
      working_tree_clean: parsePorcelainPaths(repository?.porcelain || '').length === 0,
      frozen_worktree_clean: dirtyFrozen.length === 0,
      scientific_fingerprint_status: headComparison.status,
      scientific_fingerprint_mismatched_paths: headComparison.mismatchedPaths,
      scientific_fingerprint_current: repository?.headFingerprint || {},
      frozen_dirty_paths: dirtyFrozen,
    },
    observations: {
      expected: expectedObservationDates.length,
      landed: observationRows.filter((row) => row.artifact_status === 'LANDED').length,
      axis_a_counts: axisCounts,
      missing_dates: missingObservationDates,
      rows: observationRows.map((row) => ({
        date: row.date,
        artifact_status: row.artifact_status,
        axis_a_status: row.axis_a_status,
        fingerprint_status: row.fingerprint_status,
        identity_status: row.identity_status,
        run_identity_status: row.run_identity_status,
        github_run_id: row.github_run_id,
        github_event_name: row.github_event_name,
        github_run_attempt: row.github_run_attempt,
        fingerprint_mismatched_paths: row.fingerprint_mismatched_paths || [],
      })),
    },
    btc_closes: {
      expected: expectedCloseDates.length,
      landed: closeRows.filter((row) => row.artifact_status === 'LANDED').length,
      missing: missingCloseDates.length,
      missing_dates: missingCloseDates,
      rows: closeRows.map((row) => ({
        date: row.date,
        artifact_status: row.artifact_status,
        identity_status: row.identity_status,
        run_identity_status: row.run_identity_status,
        github_run_id: row.github_run_id,
        github_event_name: row.github_event_name,
        github_run_attempt: row.github_run_attempt,
      })),
    },
    overall_status: overallStatus,
    structural_errors: structuralErrors,
    start,
    observation_window: {
      start: start.start_date_utc,
      end: start.observation_end_date_utc,
    },
    required_close_end_date_utc: start.required_close_end_date_utc,
    observation_detail_rows: observationRows,
    close_detail_rows: closeRows,
  };
}

function dash(value) {
  return value == null || value === '' ? '—' : String(value);
}

function naStatus(value) {
  return value == null || value === 'NOT_APPLICABLE' ? '—' : value;
}

function joinDates(dates) {
  return dates.length ? dates.join('\n') : '(none)';
}

function observationFingerprintMismatchBlock(rows) {
  const mismatched = (rows || []).filter(
    (row) =>
      row.fingerprint_status === 'MISMATCH' &&
      Array.isArray(row.fingerprint_mismatched_paths) &&
      row.fingerprint_mismatched_paths.length > 0
  );
  if (mismatched.length === 0) return '';
  const lines = ['Observation fingerprint mismatch:'];
  for (const row of mismatched) {
    lines.push(row.date);
    for (const pathName of row.fingerprint_mismatched_paths) {
      lines.push(`  ${pathName}`);
    }
  }
  return lines.join('\n');
}

export function renderHumanReport(report) {
  const repo = report.repository;
  const obs = report.observations;
  const closes = report.btc_closes;
  const headLine =
    repo.scientific_fingerprint_status === 'MATCH'
      ? 'MATCH'
      : `MISMATCH\n${repo.scientific_fingerprint_mismatched_paths
          .map(
            (path) =>
              `  ${path} expected=${report.start.scientific_fingerprint[path] || '—'} current=${
                repo.scientific_fingerprint_current[path] || '—'
              }`
          )
          .join('\n')}`;

  const observationTable = [
    'Date       | Artifact | Axis A            | Fingerprint     | Identity        | Run ID | Event    | Attempt',
    ...report.observation_detail_rows.map((row) => {
      const axis =
        row.axis_a_status == null ? 'STRUCTURAL_ERROR' : row.axis_a_status.padEnd(17, ' ');
      return [
        row.date,
        (row.artifact_status || '').padEnd(8, ' '),
        axis,
        naStatus(row.fingerprint_status).padEnd(15, ' '),
        naStatus(row.identity_status).padEnd(15, ' '),
        dash(row.github_run_id),
        dash(row.github_event_name),
        dash(row.github_run_attempt),
      ].join(' | ');
    }),
  ].join('\n');

  const closeTable = [
    'Date       | Artifact | Identity        | Run ID | Event    | Attempt',
    ...report.close_detail_rows.map((row) =>
      [
        row.date,
        (row.artifact_status || '').padEnd(8, ' '),
        naStatus(row.identity_status).padEnd(15, ' '),
        dash(row.github_run_id),
        dash(row.github_event_name),
        dash(row.github_run_attempt),
      ].join(' | ')
    ),
  ].join('\n');

  const structuralBlock =
    report.structural_errors.length === 0
      ? ''
      : `\nMONITOR STRUCTURAL ERROR\n${report.structural_errors
          .map((error) => `${error.date}: ${error.message}`)
          .join('\n')}\n`;

  const frozenDirtyBlock = repo.frozen_worktree_clean
    ? ''
    : `\nFROZEN WORKTREE DIRTY\n${repo.frozen_dirty_paths.join('\n')}\n`;

  const worktreeWarning =
    repo.working_tree_clean || !repo.frozen_worktree_clean
      ? ''
      : '\nWarning: working tree is DIRTY. Git fingerprint describes committed HEAD only.\n';

  return [
    '==================================================',
    'H8 v2 COMPLETENESS MONITOR',
    'Completeness metadata only',
    '==================================================',
    `Repository HEAD:`,
    repo.head_sha || '—',
    `Working tree:`,
    repo.working_tree_clean ? 'CLEAN' : 'DIRTY',
    `Study:`,
    report.study_id,
    `Observation window:`,
    `${report.observation_window.start} → ${report.observation_window.end}`,
    `Required BTC closes through:`,
    report.required_close_end_date_utc,
    `Through date:`,
    report.through_date_utc,
    `Through mode:`,
    report.through_mode,
    `HEAD scientific fingerprint:`,
    headLine,
    '--------------------------------------------------',
    'OBSERVATION COMPLETENESS',
    '--------------------------------------------------',
    `Expected:`,
    String(obs.expected),
    `Landed:`,
    String(obs.landed),
    `ELIGIBLE:`,
    String(obs.axis_a_counts.ELIGIBLE),
    `NOT_ELIGIBLE:`,
    String(obs.axis_a_counts.NOT_ELIGIBLE),
    `INTEGRITY_MISMATCH:`,
    String(obs.axis_a_counts.INTEGRITY_MISMATCH),
    `CAPTURE_MISSING:`,
    String(obs.axis_a_counts.CAPTURE_MISSING),
    `Missing dates:`,
    joinDates(obs.missing_dates),
    observationTable,
    observationFingerprintMismatchBlock(report.observation_detail_rows),
    MISSING_DATE_RUN_NOTE,
    '--------------------------------------------------',
    'BTC-CLOSE COMPLETENESS',
    '--------------------------------------------------',
    `Expected:`,
    String(closes.expected),
    `Landed:`,
    String(closes.landed),
    `Missing:`,
    String(closes.missing),
    `Missing dates:`,
    joinDates(closes.missing_dates),
    closeTable,
    structuralBlock.trimEnd(),
    frozenDirtyBlock.trimEnd(),
    worktreeWarning.trimEnd(),
    '--------------------------------------------------',
    'OVERALL',
    '--------------------------------------------------',
    report.overall_status,
    '==================================================',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function toSafeJson(report) {
  return {
    schema_version: report.schema_version,
    study_id: report.study_id,
    generated_at_utc: report.generated_at_utc,
    through_date_utc: report.through_date_utc,
    through_mode: report.through_mode,
    repository: {
      head_sha: report.repository.head_sha,
      working_tree_clean: report.repository.working_tree_clean,
      frozen_worktree_clean: report.repository.frozen_worktree_clean,
      scientific_fingerprint_status: report.repository.scientific_fingerprint_status,
      scientific_fingerprint_mismatched_paths:
        report.repository.scientific_fingerprint_mismatched_paths,
    },
    observations: report.observations,
    btc_closes: report.btc_closes,
    overall_status: report.overall_status,
    structural_errors: report.structural_errors,
  };
}

export function exitCodeForReport(report) {
  return report.overall_status === 'INTEGRITY_ALERT' ? STRUCTURAL_EXIT : SUCCESS_EXIT;
}

export const HELP_TEXT = `H8 v2 completeness monitor (E03)
Read-only local administrative CLI. Completeness metadata only.

Usage:
  node scripts/admin/h8-completeness-monitor.mjs
  node scripts/admin/h8-completeness-monitor.mjs --through YYYY-MM-DD
  node scripts/admin/h8-completeness-monitor.mjs --through YYYY-MM-DD --json
  node scripts/admin/h8-completeness-monitor.mjs --help

--through YYYY-MM-DD   Explicit UTC cutoff (strict calendar date)
Default through date   Previous UTC calendar date
--json                 Machine-readable administrative schema on stdout

Exit codes:
  0   completed, including ordinary ATTENTION from missing captures
  2   structural/integrity monitor error
  64  invalid CLI usage
`;
