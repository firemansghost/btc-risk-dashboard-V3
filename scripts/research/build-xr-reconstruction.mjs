#!/usr/bin/env node
/**
 * H7.1 Stage A CLI — contract-check by default.
 * Historical generation requires Stage-B flags and is not executed here.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  FROZEN_H7_BLOBS,
  MODEL_CODE_BLOBS,
  MODEL_SOURCE_SHA,
  H7_1_STAGE_A_BASE_SHA,
  XR_OBSERVATION_COLUMNS,
  XR_FACTOR_LINEAGE_COLUMNS,
  XR_MISSINGNESS_COLUMNS,
  XR_BRIDGE_COLUMNS,
  generateObservationUniverse,
  validateObservationUniverse,
  assertWeightInvariants,
  serializeCsv,
  H7_PROTOCOL_VERSION,
  CASE_A_CHART_CAPTURES,
  TREND_B_ISLAND_CAPTURES,
  BRIDGE_PRODUCTION_CAPTURES,
  H6_1_EVIDENCE_MANIFEST_PATH,
  H6_1_EVIDENCE_MANIFEST_BLOB,
  ETF_HISTORICAL_BASELINE_PATH,
  ETF_HISTORICAL_BASELINE_BLOB,
  STAGE_B_OUTPUT_FILES,
  OFFICIAL_FACTOR_ORDER,
  FACTOR_COMPONENT_ORDER,
  SCORED_COMPONENT_ORDER,
  BRIDGE_DATES,
  csvRowsToObjects,
  selectReconstructionClock,
  scoreTrendComponents,
  scoreStablecoinComponents,
  scoreEtfComponents,
  scoreNetLiquidityComponents,
  scoreMacroComponents,
  scoreTermComponents,
  scoreSocialComponents,
  aggregateFactorRole,
  aggregateFactorAvailability,
  buildEligibility,
  buildBridgeRows,
  sortLineageRows,
  formatMissingFactors,
  firstMissingReason,
  reconstructTrendIslandSeries,
  createWeeklyCloses,
  filterCompletedWeeklyCloses,
  buildCaseBSurrogateVector,
  normalizeCoinGeckoDailyByUtcDate,
  selectCompletedCoinbase5mCandle,
  unwrapCoinGeckoCachePayload,
  validateH71OutputSet,
  validateH71CrossFileInvariants,
  extractProductionFactorScores,
  finalizeFactorRecords,
  appendLineageNote,
  deriveRequiredComponentRole,
  isWeeklyRsiHistorySufficient,
  H7_BASE_SHA,
  FACTOR_SCORE_FIELDS,
  FACTOR_ROLE_FIELDS,
  FACTOR_AVAIL_FIELDS,
} from './lib/xr-reconstruction-core.mjs';
import {
  gitRevParse,
  defaultGitExec,
  XrRuntimeSourceError,
  gitShowText,
  GIT_PATHS,
  indexPathBlobTransitions,
  resolveSharedPriceVector,
  resolveTrendBIsland,
  resolveFrozenEtfBaseline,
  resolveSameDateEtfHtml,
  resolveTermFunding,
  resolveSocialRank,
  resolveStablecoinCapture,
  resolveSelectedPrimaryArtifact,
  resolveBridgeProductionArtifact,
  fetchCoinbaseCompletedHistory,
  fetchCoinbase5mProxy,
  fetchCoinGeckoCaseBRange,
  fetchAlfredSeries,
  buildNetLiquidityRequests,
  buildMacroRequests,
  requireFredApiKey,
  parseFredObservations,
} from './lib/xr-source-adapters.mjs';

export const CONTRACT_CHECK_NETWORK_REQUESTS = 0;
export const CONTRACT_CHECK_FILES_WRITTEN = 0;
export const CONTRACT_CHECK_HISTORICAL_SCORES = 0;

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    contractCheck: false,
    analysisSourceSha: null,
    outputDir: null,
    allowNetwork: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--contract-check') out.contractCheck = true;
    else if (arg === '--allow-network') out.allowNetwork = true;
    else if (arg === '--analysis-source-sha') out.analysisSourceSha = argv[++i];
    else if (arg === '--output-dir') out.outputDir = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

export function verifyBlobMap(expected, gitExec = defaultGitExec, specPrefix = 'HEAD') {
  const mismatches = [];
  for (const [filePath, blob] of Object.entries(expected)) {
    const actual = gitRevParse(`${specPrefix}:${filePath}`, gitExec);
    if (actual !== blob) mismatches.push({ filePath, expected: blob, actual });
  }
  return mismatches;
}

export function runContractCheck({ gitExec = defaultGitExec } = {}) {
  assertWeightInvariants();
  const h7Mismatches = verifyBlobMap(FROZEN_H7_BLOBS, gitExec, 'HEAD');
  const modelMismatches = verifyBlobMap(MODEL_CODE_BLOBS, gitExec, MODEL_SOURCE_SHA);
  const extra = {
    [H6_1_EVIDENCE_MANIFEST_PATH]: H6_1_EVIDENCE_MANIFEST_BLOB,
    [ETF_HISTORICAL_BASELINE_PATH]: ETF_HISTORICAL_BASELINE_BLOB,
  };
  const extraMismatches = verifyBlobMap(extra, gitExec, 'HEAD');
  const caseAMismatches = [];
  for (const [date, expected] of Object.entries(CASE_A_CHART_CAPTURES)) {
    const actual = gitRevParse(`${expected.commitSha}:${expected.path}`, gitExec);
    if (actual !== expected.blobSha) {
      caseAMismatches.push({ date, expected: expected.blobSha, actual });
    }
  }
  const islandMismatches = [];
  for (const [date, expected] of Object.entries(TREND_B_ISLAND_CAPTURES)) {
    const latest = gitRevParse(`${expected.latestJsonCommitSha}:${GIT_PATHS.latestJson}`, gitExec);
    const csv = gitRevParse(
      `${expected.btcPriceHistoryCommitSha}:${GIT_PATHS.priceHistoryCsv}`,
      gitExec
    );
    if (latest !== expected.latestJsonBlobSha || csv !== expected.btcPriceHistoryBlobSha) {
      islandMismatches.push({ date, latest, csv });
    }
  }
  const bridgeProductionMismatches = [];
  for (const [date, expected] of Object.entries(BRIDGE_PRODUCTION_CAPTURES)) {
    const actual = gitRevParse(`${expected.commitSha}:${expected.path}`, gitExec);
    if (actual !== expected.blobSha) {
      bridgeProductionMismatches.push({ date, expected: expected.blobSha, actual });
    }
  }
  const dates = generateObservationUniverse();
  const universe = validateObservationUniverse(dates);
  const columnCounts = {
    xr_observations: XR_OBSERVATION_COLUMNS.length,
    xr_factor_lineage: XR_FACTOR_LINEAGE_COLUMNS.length,
    xr_missingness: XR_MISSINGNESS_COLUMNS.length,
    xr_bridge_check: XR_BRIDGE_COLUMNS.length,
  };
  const ok =
    h7Mismatches.length === 0 &&
    modelMismatches.length === 0 &&
    extraMismatches.length === 0 &&
    caseAMismatches.length === 0 &&
    islandMismatches.length === 0 &&
    bridgeProductionMismatches.length === 0 &&
    universe.ok;
  return {
    ok,
    h7Mismatches,
    modelMismatches,
    extraMismatches,
    caseAMismatches,
    islandMismatches,
    bridgeProductionMismatches,
    universe,
    columnCounts,
    caseACaptures: CASE_A_CHART_CAPTURES,
    trendBIslandCaptures: TREND_B_ISLAND_CAPTURES,
    bridgeProductionCaptures: BRIDGE_PRODUCTION_CAPTURES,
    networkRequests: CONTRACT_CHECK_NETWORK_REQUESTS,
    filesWritten: CONTRACT_CHECK_FILES_WRITTEN,
    historicalScoreCalculations: CONTRACT_CHECK_HISTORICAL_SCORES,
    protocolVersion: H7_PROTOCOL_VERSION,
    stageABaseSha: H7_1_STAGE_A_BASE_SHA,
  };
}

export function assertCleanWorktree(gitExec = defaultGitExec) {
  const out = gitExec(['status', '--porcelain']).toString('utf8').trim();
  if (out) {
    throw new XrRuntimeSourceError('implementation checkout is not a clean Git worktree');
  }
}

export function assertAnalysisSourceSha(expected, gitExec = defaultGitExec) {
  const head = gitRevParse('HEAD', gitExec);
  if (!expected || expected !== head) {
    throw new XrRuntimeSourceError(
      `analysis-source-sha ${expected} does not equal git rev-parse HEAD ${head}`
    );
  }
}

const FORBIDDEN_OUTPUT_SEGMENTS = Object.freeze([
  `${path.sep}public${path.sep}`,
  `${path.sep}app${path.sep}`,
  `${path.sep}lib${path.sep}`,
  `${path.sep}config${path.sep}`,
  `${path.sep}scripts${path.sep}etl${path.sep}`,
  '/public/',
  '/app/',
  '/lib/',
  '/config/',
  '/scripts/etl/',
]);

export function assertSafeOutputDir(outputDir, repoRoot) {
  if (!outputDir) throw new XrRuntimeSourceError('output-dir is required for generation');
  const resolved = path.resolve(outputDir);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, resolved);
  const insideRepo = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (insideRepo) {
    const probe = `${resolved}${path.sep}`;
    if (FORBIDDEN_OUTPUT_SEGMENTS.some((seg) => probe.includes(seg))) {
      throw new XrRuntimeSourceError(`refusing output-dir inside production path: ${resolved}`);
    }
  }
  if (fs.existsSync(resolved)) {
    throw new XrRuntimeSourceError(`final output directory already exists: ${resolved}`);
  }
  return resolved;
}

export function finalizeAtomicOutputs(finalDir, files, { fsImpl = fs } = {}) {
  const resolved = path.resolve(finalDir);
  if (fsImpl.existsSync(resolved)) {
    throw new XrRuntimeSourceError(`final output directory already exists: ${resolved}`);
  }
  const parent = path.dirname(resolved);
  fsImpl.mkdirSync(parent, { recursive: true });
  const staging = path.join(
    parent,
    `.${path.basename(resolved)}.staging-${process.pid}-${Date.now()}`
  );
  try {
    fsImpl.mkdirSync(staging);
    for (const name of STAGE_B_OUTPUT_FILES) {
      if (!(name in files)) {
        throw new XrRuntimeSourceError(`missing staged output: ${name}`);
      }
      fsImpl.writeFileSync(path.join(staging, name), files[name], { encoding: 'utf8' });
    }
    for (const name of STAGE_B_OUTPUT_FILES) {
      if (!fsImpl.existsSync(path.join(staging, name))) {
        throw new XrRuntimeSourceError(`staged file missing after write: ${name}`);
      }
    }
    const stagedNames = [...fsImpl.readdirSync(staging)].sort();
    const expectedNames = [...STAGE_B_OUTPUT_FILES].sort();
    if (
      stagedNames.length !== expectedNames.length ||
      stagedNames.some((name, i) => name !== expectedNames[i])
    ) {
      throw new XrRuntimeSourceError(
        `staged filename set mismatch: ${stagedNames.join(',')} !== ${expectedNames.join(',')}`
      );
    }
    for (const name of STAGE_B_OUTPUT_FILES) {
      const actual = fsImpl.readFileSync(path.join(staging, name));
      const expected = Buffer.from(files[name], 'utf8');
      if (!Buffer.isBuffer(actual)) {
        throw new XrRuntimeSourceError(`staged file read was not bytes: ${name}`);
      }
      if (!actual.equals(expected)) {
        const actualSha = crypto.createHash('sha256').update(actual).digest('hex');
        const expectedSha = crypto.createHash('sha256').update(expected).digest('hex');
        throw new XrRuntimeSourceError(
          `staged bytes mismatch for ${name}: ${actualSha} !== ${expectedSha}`
        );
      }
    }
    fsImpl.renameSync(staging, resolved);
  } catch (error) {
    try {
      fsImpl.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore cleanup failure */
    }
    throw error;
  }
  return resolved;
}

export function requireStageBFlags(args) {
  if (!args.analysisSourceSha || !args.outputDir || !args.allowNetwork) {
    throw new XrRuntimeSourceError(
      'Stage B generation requires --analysis-source-sha, --output-dir, and --allow-network'
    );
  }
}

export function previewCsv(columns, rows) {
  return serializeCsv(columns, rows);
}

export function missingComp(date, factorKey, componentKey, reasonCode, extra = {}) {
  return {
    observation_date: date,
    factor_key: factorKey,
    component_key: componentKey,
    reconstruction_role: 'MISSING',
    source_name: extra.source_name || '',
    source_type: extra.source_type || '',
    source_observation_start: extra.source_observation_start || '',
    source_observation_end: extra.source_observation_end || '',
    source_as_of_cutoff: extra.source_as_of_cutoff || '',
    git_commit_sha: extra.git_commit_sha || '',
    git_blob_sha: extra.git_blob_sha || '',
    external_snapshot_sha256: extra.external_snapshot_sha256 || '',
    is_point_in_time: false,
    is_surrogate: false,
    is_current_history: false,
    is_conservative_vintage: false,
    availability_status: 'MISSING',
    missing_reason: reasonCode,
    notes: extra.notes || '',
    h7_base_sha: H7_BASE_SHA,
    protocol_version: H7_PROTOCOL_VERSION,
  };
}

export function presentComp(date, factorKey, componentKey, role, extra = {}) {
  return {
    observation_date: date,
    factor_key: factorKey,
    component_key: componentKey,
    reconstruction_role: role,
    source_name: extra.source_name || '',
    source_type: extra.source_type || '',
    source_observation_start: extra.source_observation_start || '',
    source_observation_end: extra.source_observation_end || '',
    source_as_of_cutoff: extra.source_as_of_cutoff || '',
    git_commit_sha: extra.git_commit_sha || '',
    git_blob_sha: extra.git_blob_sha || '',
    external_snapshot_sha256: extra.external_snapshot_sha256 || '',
    is_point_in_time: role === 'B_METHOD_PIT' || role === 'C_PIT_CONSERVATIVE',
    is_surrogate: role === 'C_SURROGATE',
    is_current_history: role === 'C_CURRENT_HISTORY',
    is_conservative_vintage: role === 'C_PIT_CONSERVATIVE',
    availability_status: role === 'B_METHOD_PIT' ? 'AVAILABLE_B' : 'AVAILABLE_C',
    missing_reason: '',
    notes: extra.notes || '',
    h7_base_sha: H7_BASE_SHA,
    protocol_version: H7_PROTOCOL_VERSION,
  };
}

function vectorPrices(vector) {
  return (vector || []).map((p) =>
    Array.isArray(p) ? Number(p[1]) : Number(p.price ?? p.close ?? p)
  );
}

function finalizeFactor(date, factorKey, componentRecords, scoreResult) {
  return finalizeFactorRecords(componentRecords, scoreResult, factorKey);
}

function httpNote(requestIdentity, sha256) {
  return `request=${requestIdentity};sha256=${sha256}`;
}

function commitPartialFactor(lineage, factorScores, factorRoles, factorAvailability, factorKey, recs) {
  const requiredRoles = FACTOR_COMPONENT_ORDER[factorKey].map((componentKey) =>
    deriveRequiredComponentRole(recs.filter((row) => row.component_key === componentKey))
  );
  lineage.push(...recs);
  factorScores[factorKey] = null;
  factorRoles[factorKey] = aggregateFactorRole(requiredRoles);
  factorAvailability[factorKey] = aggregateFactorAvailability(requiredRoles);
}

function priceVectorProvenance(shared, priceRole, extra, caseBLineage = []) {
  if (priceRole === 'B_METHOD_PIT') {
    return {
      ...extra,
      git_commit_sha: shared.commitSha,
      git_blob_sha: shared.blobSha,
      source_name: 'market_chart_30_daily',
      source_type: 'git',
    };
  }
  return {
    ...extra,
    source_name: 'case_b_surrogate',
    source_type: 'http',
    notes: caseBLineage
      .map((item) => `${item.source_name};${httpNote(item.request, item.sha256)}`)
      .join('|'),
  };
}

export async function reconstructOneDate(observationDate, ctx) {
  const dailyRow = ctx.dailyByDate.get(observationDate) || {
    selection_status: 'NO_DAILY_PRIMARY',
    observation_date: observationDate,
  };
  let rawArtifact = null;
  const selected = resolveSelectedPrimaryArtifact(dailyRow, ctx.gitExec);
  if (selected.ok) rawArtifact = selected.raw;
  const clock = selectReconstructionClock({ observationDate, dailyRow, rawArtifact });
  const asOfUtc = clock.valid ? clock.reconstruction_as_of_utc : '';
  const lineage = [];
  const factorScores = {};
  const factorRoles = {};
  const factorAvailability = {};

  const markAll = (factorKey, reason) => {
    for (const componentKey of FACTOR_COMPONENT_ORDER[factorKey]) {
      lineage.push(missingComp(observationDate, factorKey, componentKey, reason));
    }
    factorScores[factorKey] = null;
    factorRoles[factorKey] = 'MISSING';
    factorAvailability[factorKey] = 'MISSING';
  };

  if (!clock.valid) {
    for (const factorKey of OFFICIAL_FACTOR_ORDER) markAll(factorKey, clock.reasonCode || 'INVALID_CLOCK');
  } else {
    const extra = { source_as_of_cutoff: asOfUtc };
    let coinbase5mPromise = null;
    const getCoinbase5m = () => {
      if (!coinbase5mPromise) {
        coinbase5mPromise = fetchCoinbase5mProxy(asOfUtc, ctx.runtime);
      }
      return coinbase5mPromise;
    };

    const island = resolveTrendBIsland(observationDate, ctx.gitExec);
    let snapshotPrice = null;
    let snapshotRole = 'MISSING';
    let dailyCloses = [];
    let weeklyCloses = [];
    let historyRole = 'MISSING';
    if (island.ok) {
      snapshotPrice = island.snapshotPrice;
      snapshotRole = 'B_METHOD_PIT';
      const series = reconstructTrendIslandSeries(island, asOfUtc);
      dailyCloses = series.dailyCloses;
      weeklyCloses = series.weeklyCloses;
      historyRole = 'B_METHOD_PIT';
      const trendScore = scoreTrendComponents({ snapshotPrice, dailyCloses, weeklyCloses });
      const recs = [
        presentComp(observationDate, 'trend_valuation', 'utc_intraday_snapshot', snapshotRole, {
          ...extra,
          git_commit_sha: island.latestJsonCommitSha,
          git_blob_sha: island.latestJsonBlobSha,
          source_name: 'latest.json',
        }),
        presentComp(observationDate, 'trend_valuation', 'bmsb_distance', historyRole, {
          ...extra,
          git_commit_sha: island.btcPriceHistoryCommitSha,
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
          source_type: 'git',
        }),
        presentComp(observationDate, 'trend_valuation', 'mayer_stretch', historyRole, {
          ...extra,
          git_commit_sha: island.btcPriceHistoryCommitSha,
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
          source_type: 'git',
        }),
        presentComp(observationDate, 'trend_valuation', 'weekly_rsi', historyRole, {
          ...extra,
          git_commit_sha: island.btcPriceHistoryCommitSha,
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
          source_type: 'git',
        }),
      ];
      const fin = finalizeFactor(observationDate, 'trend_valuation', recs, trendScore);
      lineage.push(...fin.records);
      factorScores.trend_valuation = fin.score;
      factorRoles.trend_valuation = fin.role;
      factorAvailability.trend_valuation = fin.availability;
    } else {
      const proxy = await getCoinbase5m();
      const selected5m = selectCompletedCoinbase5mCandle(proxy.candles, asOfUtc);
      const history = await fetchCoinbaseCompletedHistory(asOfUtc, ctx.runtime);
      dailyCloses = history.rows.map((r) => r.close);
      weeklyCloses = filterCompletedWeeklyCloses(
        createWeeklyCloses(history.rows.map((r) => ({ timestamp: r.timestamp, close: r.close }))),
        asOfUtc
      );
      const weeklyOk = isWeeklyRsiHistorySufficient(weeklyCloses);
      const historyExtras = (history.lineage || []).map((chunk, i) =>
        presentComp(observationDate, 'trend_valuation', 'weekly_rsi', 'C_CURRENT_HISTORY', {
          ...extra,
          source_name: `coinbase_daily_chunk_${i}`,
          source_type: 'http',
          external_snapshot_sha256: chunk.sha256,
          notes: httpNote(chunk.url, chunk.sha256),
        })
      );
      if (!selected5m.ok) {
        const recs = [
          missingComp(observationDate, 'trend_valuation', 'utc_intraday_snapshot', selected5m.reasonCode || 'INCOMPLETE_CANDLE', {
            ...extra,
            source_name: 'coinbase_5m',
            source_type: 'http',
            external_snapshot_sha256: proxy.sha256,
            notes: httpNote(proxy.url, proxy.sha256),
          }),
          missingComp(observationDate, 'trend_valuation', 'bmsb_distance', selected5m.reasonCode || 'INCOMPLETE_CANDLE', {
            ...extra,
            source_name: 'coinbase_daily',
            source_type: 'http',
          }),
          missingComp(observationDate, 'trend_valuation', 'mayer_stretch', selected5m.reasonCode || 'INCOMPLETE_CANDLE', {
            ...extra,
            source_name: 'coinbase_daily',
            source_type: 'http',
          }),
          weeklyOk
            ? presentComp(observationDate, 'trend_valuation', 'weekly_rsi', 'C_CURRENT_HISTORY', {
                ...extra,
                source_name: 'coinbase_daily',
                source_type: 'http',
              })
            : missingComp(observationDate, 'trend_valuation', 'weekly_rsi', 'INSUFFICIENT_LOOKBACK', {
                ...extra,
                source_name: 'coinbase_daily',
                source_type: 'http',
              }),
          ...historyExtras,
        ];
        commitPartialFactor(lineage, factorScores, factorRoles, factorAvailability, 'trend_valuation', recs);
      } else {
        snapshotPrice = selected5m.close;
        snapshotRole = 'C_SURROGATE';
        historyRole = 'C_CURRENT_HISTORY';
        const trendScore = scoreTrendComponents({ snapshotPrice, dailyCloses, weeklyCloses });
        const recs = [
          presentComp(observationDate, 'trend_valuation', 'utc_intraday_snapshot', snapshotRole, {
            ...extra,
            source_name: 'coinbase_5m',
            source_type: 'http',
            external_snapshot_sha256: proxy.sha256,
            notes: httpNote(proxy.url, proxy.sha256),
          }),
          presentComp(observationDate, 'trend_valuation', 'bmsb_distance', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
            source_type: 'http',
            notes: (history.lineage || [])
              .map((chunk, i) => `chunk=${i};${httpNote(chunk.url, chunk.sha256)}`)
              .join('|'),
          }),
          presentComp(observationDate, 'trend_valuation', 'mayer_stretch', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
            source_type: 'http',
          }),
          presentComp(observationDate, 'trend_valuation', 'weekly_rsi', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
            source_type: 'http',
          }),
          ...historyExtras,
        ];
        const fin = finalizeFactor(observationDate, 'trend_valuation', recs, trendScore);
        lineage.push(...fin.records);
        factorScores.trend_valuation = fin.score;
        factorRoles.trend_valuation = fin.role;
        factorAvailability.trend_valuation = fin.availability;
      }
    }

    const stable = resolveStablecoinCapture(observationDate, ctx.gitExec);
    if (!stable.ok) markAll('stablecoins', stable.reasonCode || 'MISSING_CAPTURE');
    else {
      const scored = scoreStablecoinComponents({
        responses: Array.isArray(stable.capture) ? stable.capture : stable.capture?.coins || [],
        baseline: stable.baseline,
      });
      const recs = FACTOR_COMPONENT_ORDER.stablecoins.map((componentKey) =>
        presentComp(observationDate, 'stablecoins', componentKey, 'B_METHOD_PIT', {
          ...extra,
          git_commit_sha: stable.captureCommitSha,
          git_blob_sha: stable.captureBlobSha,
          source_name: 'stablecoins_dated_cache',
          notes: `capture_commit=${stable.captureCommitSha};capture_blob=${stable.captureBlobSha};first_parent=${stable.firstParentSha};baseline_blob=${stable.baselineBlobSha}`,
        })
      );
      const fin = finalizeFactor(observationDate, 'stablecoins', recs, scored);
      lineage.push(...fin.records);
      factorScores.stablecoins = fin.score;
      factorRoles.stablecoins = fin.role;
      factorAvailability.stablecoins = fin.availability;
    }

    const etfHtml = resolveSameDateEtfHtml(observationDate, ctx.gitExec);
    const etfBase = ctx.etfBaseline;
    const etfBaselineRow =
      etfBase?.ok
        ? presentComp(observationDate, 'etf_flows', 'sum_21d', 'B_METHOD_PIT', {
            ...extra,
            source_name: 'etf_historical_baseline',
            source_type: 'git',
            git_blob_sha: ETF_HISTORICAL_BASELINE_BLOB,
            notes: `frozen_baseline_path=${ETF_HISTORICAL_BASELINE_PATH}`,
          })
        : null;
    if (!etfHtml.ok || !etfBase?.ok) {
      markAll('etf_flows', !etfBase?.ok ? 'MISSING_BASELINE' : etfHtml.reasonCode || 'NO_SAME_DATE_ETF');
      if (etfBaselineRow) lineage.push(etfBaselineRow);
    } else {
      const scored = scoreEtfComponents({
        html: etfHtml.html,
        asOfUtc,
        historicalBaseline: etfBase.values,
      });
      const recs = [
        ...FACTOR_COMPONENT_ORDER.etf_flows.map((componentKey) =>
          presentComp(observationDate, 'etf_flows', componentKey, 'B_METHOD_PIT', {
            ...extra,
            git_commit_sha: etfHtml.commitSha,
            git_blob_sha: etfHtml.blobSha,
            source_name: 'farside_html',
            source_type: 'git',
          })
        ),
        etfBaselineRow,
      ];
      const fin = finalizeFactor(observationDate, 'etf_flows', recs, scored);
      lineage.push(...fin.records);
      factorScores.etf_flows = fin.score;
      factorRoles.etf_flows = fin.role;
      factorAvailability.etf_flows = fin.availability;
    }

    const nlReqs = buildNetLiquidityRequests(observationDate, ctx.fredKey);
    const nlObs = {};
    const nlLineageExtras = [];
    for (const req of nlReqs) {
      const got = await fetchAlfredSeries(req, ctx.runtime);
      nlObs[req.seriesId] = parseFredObservations(got.json, observationDate);
      nlLineageExtras.push({
        seriesId: req.seriesId,
        sanitizedUrl: req.sanitizedUrl,
        sha256: got.sha256,
      });
    }
    const nlScored = scoreNetLiquidityComponents(nlObs, observationDate);
    const nlComponentBySeries = {
      WALCL: 'level',
      RRPONTSYD: 'rate_of_change',
      WTREGEN: 'momentum',
    };
    const nlRecs = [
      ...FACTOR_COMPONENT_ORDER.net_liquidity.map((componentKey) =>
        presentComp(observationDate, 'net_liquidity', componentKey, 'C_PIT_CONSERVATIVE', {
          ...extra,
          source_name: 'alfred',
          source_type: 'http',
          notes: nlLineageExtras
            .map((item) => `${item.seriesId};${httpNote(item.sanitizedUrl, item.sha256)}`)
            .join('|'),
        })
      ),
      ...nlLineageExtras.map((item) =>
        presentComp(
          observationDate,
          'net_liquidity',
          nlComponentBySeries[item.seriesId],
          'C_PIT_CONSERVATIVE',
          {
            ...extra,
            source_name: `alfred_${item.seriesId}`,
            source_type: 'http',
            external_snapshot_sha256: item.sha256,
            notes: httpNote(item.sanitizedUrl, item.sha256),
          }
        )
      ),
    ];
    const nlFin = finalizeFactor(observationDate, 'net_liquidity', nlRecs, nlScored);
    lineage.push(...nlFin.records);
    factorScores.net_liquidity = nlFin.score;
    factorRoles.net_liquidity = nlFin.role;
    factorAvailability.net_liquidity = nlFin.availability;

    const shared = resolveSharedPriceVector(observationDate, ctx.gitExec);
    let priceVector = null;
    let priceRole = 'MISSING';
    let priceReason = shared.reasonCode || 'MISSING_CAPTURE';
    let caseBLineage = [];
    if (shared.ok) {
      priceVector = shared.vector;
      priceRole = 'B_METHOD_PIT';
    } else if (!shared.forbidSurrogate) {
      const cg = await fetchCoinGeckoCaseBRange(observationDate, ctx.runtime);
      const unwrapped = unwrapCoinGeckoCachePayload(cg.json);
      const prices = unwrapped.ok ? unwrapped.data?.prices : cg.json?.prices;
      const normalized = normalizeCoinGeckoDailyByUtcDate(prices);
      const proxy = await getCoinbase5m();
      const selected5m = selectCompletedCoinbase5mCandle(proxy.candles, asOfUtc);
      if (normalized.ok && selected5m.ok) {
        const built = buildCaseBSurrogateVector({
          observationDate,
          completedDailyByUtcDate: normalized.byDate,
          coinbaseProxyPrice: selected5m.close,
        });
        if (built.ok) {
          priceVector = built.vector;
          priceRole = 'C_SURROGATE';
          caseBLineage = [
            {
              source_name: 'coingecko_range',
              sha256: cg.sha256,
              request: cg.request?.url,
            },
            {
              source_name: 'coinbase_5m',
              sha256: proxy.sha256,
              request: proxy.url,
            },
          ];
        } else priceReason = built.reasonCode;
      } else {
        priceReason = selected5m.ok ? normalized.reasonCode || 'MISSING_CAPTURE' : selected5m.reasonCode;
      }
    } else {
      priceReason = 'BRIDGE_CAPTURE_UNRESOLVED';
    }

    const termFund = resolveTermFunding(observationDate, asOfUtc, ctx.termIndex, ctx.gitExec);
    const priceFields = priceVectorProvenance(shared, priceRole, extra, caseBLineage);
    const caseBPriceExtras = (componentKey) =>
      caseBLineage.map((item) =>
        presentComp(observationDate, 'term_leverage', componentKey, priceRole, {
          ...extra,
          source_name: item.source_name,
          source_type: 'http',
          external_snapshot_sha256: item.sha256,
          notes: httpNote(item.request, item.sha256),
        })
      );
    if (termFund.ok && priceRole !== 'MISSING') {
      const scored = scoreTermComponents({
        fundingRates: termFund.rates,
        spotPrices: vectorPrices(priceVector),
      });
      const recs = [
        presentComp(observationDate, 'term_leverage', 'funding', 'B_METHOD_PIT', {
          ...extra,
          git_commit_sha: termFund.commitSha,
          git_blob_sha: termFund.blobSha,
          source_name: 'term_leverage_cache',
          source_type: 'git',
        }),
        presentComp(observationDate, 'term_leverage', 'realized_vol', priceRole, priceFields),
        presentComp(observationDate, 'term_leverage', 'stress', priceRole, priceFields),
        ...caseBPriceExtras('realized_vol'),
      ];
      const fin = finalizeFactor(observationDate, 'term_leverage', recs, scored);
      lineage.push(...fin.records);
      factorScores.term_leverage = fin.score;
      factorRoles.term_leverage = fin.role;
      factorAvailability.term_leverage = fin.availability;
    } else {
      const recs = [];
      if (termFund.ok) {
        recs.push(
          presentComp(observationDate, 'term_leverage', 'funding', 'B_METHOD_PIT', {
            ...extra,
            git_commit_sha: termFund.commitSha,
            git_blob_sha: termFund.blobSha,
            source_name: 'term_leverage_cache',
            source_type: 'git',
          })
        );
      } else {
        recs.push(
          missingComp(observationDate, 'term_leverage', 'funding', termFund.reasonCode || 'NO_BITMEX_EVIDENCE', extra)
        );
      }
      if (priceRole !== 'MISSING') {
        recs.push(presentComp(observationDate, 'term_leverage', 'realized_vol', priceRole, priceFields));
        recs.push(
          missingComp(
            observationDate,
            'term_leverage',
            'stress',
            termFund.ok ? priceReason : termFund.reasonCode || 'NO_BITMEX_EVIDENCE',
            extra
          )
        );
        recs.push(...caseBPriceExtras('realized_vol'));
      } else {
        recs.push(
          missingComp(observationDate, 'term_leverage', 'realized_vol', priceReason, extra)
        );
        recs.push(missingComp(observationDate, 'term_leverage', 'stress', priceReason, extra));
      }
      commitPartialFactor(lineage, factorScores, factorRoles, factorAvailability, 'term_leverage', recs);
    }

    const macroReqs = buildMacroRequests(observationDate, ctx.fredKey);
    const macroObs = {};
    const macroLineageExtras = [];
    for (const req of macroReqs) {
      const got = await fetchAlfredSeries(req, ctx.runtime);
      macroObs[req.seriesId] = parseFredObservations(got.json, observationDate);
      macroLineageExtras.push({
        seriesId: req.seriesId,
        sanitizedUrl: req.sanitizedUrl,
        sha256: got.sha256,
      });
    }
    const macroScored = scoreMacroComponents(macroObs, observationDate);
    const macroComponentBySeries = {
      DTWEXBGS: 'dxy_20d',
      DGS2: 'us2y_20d',
      DGS10: 'us2y_20d',
      VIXCLS: 'vix_pct',
    };
    const macroRecs = [
      ...FACTOR_COMPONENT_ORDER.macro_overlay.map((componentKey) =>
        presentComp(observationDate, 'macro_overlay', componentKey, 'C_PIT_CONSERVATIVE', {
          ...extra,
          source_name: 'alfred',
          source_type: 'http',
          notes: macroLineageExtras
            .map((item) => `${item.seriesId};${httpNote(item.sanitizedUrl, item.sha256)}`)
            .join('|'),
        })
      ),
      ...macroLineageExtras.map((item) =>
        presentComp(
          observationDate,
          'macro_overlay',
          macroComponentBySeries[item.seriesId],
          'C_PIT_CONSERVATIVE',
          {
            ...extra,
            source_name: `alfred_${item.seriesId}`,
            source_type: 'http',
            external_snapshot_sha256: item.sha256,
            notes: httpNote(item.sanitizedUrl, item.sha256),
          }
        )
      ),
    ];
    const macroFin = finalizeFactor(observationDate, 'macro_overlay', macroRecs, macroScored);
    lineage.push(...macroFin.records);
    factorScores.macro_overlay = macroFin.score;
    factorRoles.macro_overlay = macroFin.role;
    factorAvailability.macro_overlay = macroFin.availability;

    const social = resolveSocialRank(observationDate, ctx.trendingIndex, ctx.socialIndex, ctx.gitExec);
    const socialPriceFields = priceVectorProvenance(shared, priceRole, extra, caseBLineage);
    const socialCaseBExtras = caseBLineage.map((item) =>
      presentComp(observationDate, 'social_interest', 'btc_price_momentum_7d', priceRole, {
        ...extra,
        source_name: item.source_name,
        source_type: 'http',
        external_snapshot_sha256: item.sha256,
        notes: httpNote(item.request, item.sha256),
      })
    );
    if (social.ok && priceRole !== 'MISSING') {
      const scored = scoreSocialComponents({
        bitcoinRank: social.rank,
        prices: vectorPrices(priceVector),
      });
      const recs = [
        presentComp(observationDate, 'social_interest', 'coingecko_trending_rank', 'B_METHOD_PIT', {
          ...extra,
          git_commit_sha: social.commitSha,
          git_blob_sha: social.blobSha,
          source_name: social.source,
          source_type: 'git',
        }),
        presentComp(observationDate, 'social_interest', 'btc_price_momentum_7d', priceRole, socialPriceFields),
        ...socialCaseBExtras,
      ];
      const fin = finalizeFactor(observationDate, 'social_interest', recs, scored);
      lineage.push(...fin.records);
      factorScores.social_interest = fin.score;
      factorRoles.social_interest = fin.role;
      factorAvailability.social_interest = fin.availability;
    } else {
      const recs = [];
      if (social.ok) {
        recs.push(
          presentComp(observationDate, 'social_interest', 'coingecko_trending_rank', 'B_METHOD_PIT', {
            ...extra,
            git_commit_sha: social.commitSha,
            git_blob_sha: social.blobSha,
            source_name: social.source,
            source_type: 'git',
          })
        );
      } else {
        recs.push(
          missingComp(observationDate, 'social_interest', 'coingecko_trending_rank', social.reasonCode || 'NO_BITCOIN_RANK', extra)
        );
      }
      if (priceRole !== 'MISSING') {
        recs.push(
          presentComp(observationDate, 'social_interest', 'btc_price_momentum_7d', priceRole, socialPriceFields)
        );
        recs.push(...socialCaseBExtras);
      } else {
        recs.push(
          missingComp(observationDate, 'social_interest', 'btc_price_momentum_7d', priceReason, extra)
        );
      }
      commitPartialFactor(lineage, factorScores, factorRoles, factorAvailability, 'social_interest', recs);
    }
  }

  const eligibility = buildEligibility({ factorAvailability, factorScores });
  return assembleDateRecords({
    observationDate,
    clock,
    factorScores,
    factorRoles,
    factorAvailability,
    lineage,
    eligibility,
  });
}

export function assembleDateRecords({
  observationDate,
  clock,
  factorScores,
  factorRoles,
  factorAvailability,
  lineage,
  eligibility = null,
}) {
  const resolvedEligibility =
    eligibility || buildEligibility({ factorAvailability, factorScores });
  const observation = {
    observation_date: observationDate,
    reconstruction_as_of_utc: clock.valid ? clock.reconstruction_as_of_utc : '',
    reconstruction_clock_source: clock.valid ? clock.reconstruction_clock_source : '',
    xr_score: resolvedEligibility.xr_score == null ? '' : resolvedEligibility.xr_score,
    xr_status: resolvedEligibility.xr_status,
    reconstruction_grade: resolvedEligibility.reconstruction_grade,
    eligible_full_composite: resolvedEligibility.eligible_full_composite,
    missing_factor_count: resolvedEligibility.missing_factor_count,
    missing_factors: resolvedEligibility.missing_factors,
    h7_base_sha: H7_BASE_SHA,
    model_source_sha: MODEL_SOURCE_SHA,
    protocol_version: H7_PROTOCOL_VERSION,
  };
  for (const key of OFFICIAL_FACTOR_ORDER) {
    observation[FACTOR_SCORE_FIELDS[key]] = factorScores[key] == null ? '' : factorScores[key];
    observation[FACTOR_ROLE_FIELDS[key]] = factorRoles[key];
  }
  const missingness = {
    observation_date: observationDate,
    eligible_full_composite: resolvedEligibility.eligible_full_composite,
    missing_factors: resolvedEligibility.missing_factors,
    primary_missing_reason: firstMissingReason(lineage),
    protocol_version: H7_PROTOCOL_VERSION,
  };
  for (const key of OFFICIAL_FACTOR_ORDER) {
    missingness[FACTOR_AVAIL_FIELDS[key]] = factorAvailability[key];
  }
  return {
    observation,
    lineage: sortLineageRows(lineage),
    missingness,
    factorScores,
    factorRoles,
    eligibility: resolvedEligibility,
    clock,
  };
}

export function assembleStageBOutputSet({
  dates,
  reconstructions,
  analysisSourceSha,
  protocolVersion = H7_PROTOCOL_VERSION,
  productionByDate = {},
  frozenUniverse = true,
}) {
  const observations = reconstructions.map((row) => row.observation);
  const lineage = sortLineageRows(reconstructions.flatMap((row) => row.lineage));
  const missingness = reconstructions.map((row) => row.missingness);
  const bridge = [];
  for (const row of reconstructions) {
    const date = row.observation.observation_date;
    const includeBridge = frozenUniverse
      ? BRIDGE_DATES.includes(date)
      : Boolean(productionByDate[date]);
    if (!includeBridge) continue;
    const prod = productionByDate[date] || { factorScores: {}, gScore: null };
    bridge.push(
      ...buildBridgeRows({
        observationDate: date,
        xrFactorScores: row.factorScores,
        productionFactorScores: prod.factorScores,
        xrRoles: row.factorRoles,
        eligible: row.eligibility.xr_status === 'ELIGIBLE',
        xrScore: row.eligibility.xr_score,
        productionGScore: prod.gScore,
      })
    );
  }
  const files = {
    'xr_observations.csv': serializeCsv(XR_OBSERVATION_COLUMNS, observations),
    'xr_factor_lineage.csv': serializeCsv(XR_FACTOR_LINEAGE_COLUMNS, lineage),
    'xr_missingness.csv': serializeCsv(XR_MISSINGNESS_COLUMNS, missingness),
    'xr_bridge_check.csv': serializeCsv(XR_BRIDGE_COLUMNS, bridge),
    'ANALYSIS_SOURCE_SHA.txt': `${analysisSourceSha}\n`,
    'PROTOCOL_VERSION.txt': `${protocolVersion}\n`,
  };
  const validated = frozenUniverse
    ? validateH71OutputSet({
        observationDates: dates,
        observations,
        missingness,
        lineage,
        bridge,
        analysisSourceSha,
        protocolVersion,
        sidecarAnalysisSourceSha: files['ANALYSIS_SOURCE_SHA.txt'],
        sidecarProtocolVersion: files['PROTOCOL_VERSION.txt'],
      })
    : validateH71CrossFileInvariants({
        observationDates: dates,
        observations,
        missingness,
        lineage,
        bridge,
        analysisSourceSha,
        protocolVersion,
        sidecarAnalysisSourceSha: files['ANALYSIS_SOURCE_SHA.txt'],
        sidecarProtocolVersion: files['PROTOCOL_VERSION.txt'],
        requireFrozenBridgeDates: false,
      });
  if (!validated.ok) {
    throw new XrRuntimeSourceError(`output validation failed: ${validated.error}`);
  }
  return { files, observations, lineage, missingness, bridge, validated };
}

export async function runStageBGeneration({
  analysisSourceSha,
  outputDir,
  allowNetwork,
  gitExec = defaultGitExec,
  fetchImpl,
  env = {},
} = {}) {
  if (!allowNetwork) {
    throw new XrRuntimeSourceError('Stage B generation requires --allow-network');
  }
  if (typeof fetchImpl !== 'function') {
    throw new XrRuntimeSourceError('Stage B generation requires an injected fetchImpl');
  }
  assertCleanWorktree(gitExec);
  assertAnalysisSourceSha(analysisSourceSha, gitExec);
  const identity = runContractCheck({ gitExec });
  if (!identity.ok) {
    throw new XrRuntimeSourceError('frozen identity mismatch before generation');
  }
  const resolvedOut = assertSafeOutputDir(outputDir, process.cwd());
  const runtime = { fetchImpl, redact: (u) => u };
  const dailyText = gitShowText(`HEAD:${GIT_PATHS.dailyView}`, gitExec);
  const dailyRows = csvRowsToObjects(dailyText);
  const dailyByDate = new Map(dailyRows.map((r) => [r.observation_date, r]));
  const dates = generateObservationUniverse();
  const etfBaseline = resolveFrozenEtfBaseline(gitExec);
  const fredKey = requireFredApiKey(env);
  const termIndex = indexPathBlobTransitions(GIT_PATHS.termCache, gitExec);
  const trendingIndex = indexPathBlobTransitions(GIT_PATHS.trending, gitExec);
  const socialIndex = indexPathBlobTransitions(GIT_PATHS.socialCache, gitExec);
  const ctx = {
    gitExec,
    runtime,
    dailyByDate,
    etfBaseline,
    fredKey,
    termIndex,
    trendingIndex,
    socialIndex,
  };
  const reconstructions = [];
  for (const date of dates) {
    reconstructions.push(await reconstructOneDate(date, ctx));
  }
  const productionByDate = {};
  for (const date of BRIDGE_DATES) {
    const artifact = resolveBridgeProductionArtifact(date, gitExec);
    productionByDate[date] = extractProductionFactorScores(artifact.raw);
  }
  const assembled = assembleStageBOutputSet({
    dates,
    reconstructions,
    analysisSourceSha,
    productionByDate,
    frozenUniverse: true,
  });
  finalizeAtomicOutputs(resolvedOut, assembled.files);
  return { ok: true, dates, filesWritten: STAGE_B_OUTPUT_FILES.length, outputDir: resolvedOut };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.contractCheck || argv.length === 0) {
    const result = runContractCheck();
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return result;
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          networkRequests: result.networkRequests,
          historicalScoreCalculations: result.historicalScoreCalculations,
          filesWritten: result.filesWritten,
          dateCount: result.universe.ok ? 252 : null,
          columnCounts: result.columnCounts,
        },
        null,
        2
      )
    );
    return result;
  }
  requireStageBFlags(args);
  return runStageBGeneration({
    analysisSourceSha: args.analysisSourceSha,
    outputDir: args.outputDir,
    allowNetwork: args.allowNetwork,
    fetchImpl: globalThis.fetch,
    env: process.env,
  });
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
