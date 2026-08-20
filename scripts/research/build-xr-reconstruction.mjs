#!/usr/bin/env node
/**
 * H7.1 Stage A CLI — contract-check by default.
 * Historical generation requires Stage-B flags and is not executed here.
 */
import fs from 'node:fs';
import path from 'node:path';
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
  H6_1_EVIDENCE_MANIFEST_PATH,
  H6_1_EVIDENCE_MANIFEST_BLOB,
  ETF_HISTORICAL_BASELINE_PATH,
  ETF_HISTORICAL_BASELINE_BLOB,
  STAGE_B_OUTPUT_FILES,
  OFFICIAL_FACTOR_ORDER,
  FACTOR_COMPONENT_ORDER,
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
  sma200DenominatorCloses,
  createWeeklyCloses,
  filterCompletedWeeklyCloses,
  buildCaseBSurrogateVector,
  normalizeCoinGeckoDailyByUtcDate,
  selectCompletedCoinbase5mCandle,
  unwrapCoinGeckoCachePayload,
  validateH71OutputSet,
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
    universe.ok;
  return {
    ok,
    h7Mismatches,
    modelMismatches,
    extraMismatches,
    caseAMismatches,
    islandMismatches,
    universe,
    columnCounts,
    caseACaptures: CASE_A_CHART_CAPTURES,
    trendBIslandCaptures: TREND_B_ISLAND_CAPTURES,
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

function missingComp(date, factorKey, componentKey, reasonCode, extra = {}) {
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

function presentComp(date, factorKey, componentKey, role, extra = {}) {
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
  const roles = componentRecords.map((r) => r.reconstruction_role);
  if (roles.some((r) => r === 'MISSING')) {
    return {
      score: null,
      role: 'MISSING',
      availability: 'MISSING',
      records: componentRecords,
    };
  }
  if (!scoreResult || !Number.isFinite(scoreResult.factorScore)) {
    const reason = scoreResult?.reasonCode || 'MISSING_COMPONENT';
    return {
      score: null,
      role: 'MISSING',
      availability: 'MISSING',
      records: componentRecords.map((r) => ({
        ...r,
        reconstruction_role: 'MISSING',
        availability_status: 'MISSING',
        missing_reason: r.missing_reason || reason,
      })),
    };
  }
  return {
    score: scoreResult.factorScore,
    role: aggregateFactorRole(roles),
    availability: aggregateFactorAvailability(roles),
    records: componentRecords,
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

    const island = resolveTrendBIsland(observationDate, ctx.gitExec);
    let snapshotPrice = null;
    let snapshotRole = 'MISSING';
    let dailyCloses = [];
    let weeklyCloses = [];
    let historyRole = 'MISSING';
    if (island.ok) {
      snapshotPrice = island.snapshotPrice;
      snapshotRole = 'B_METHOD_PIT';
      dailyCloses = sma200DenominatorCloses(island.historyRows, asOfUtc).map((r) => r.close ?? r.close_usd);
      weeklyCloses = filterCompletedWeeklyCloses(
        createWeeklyCloses(
          island.historyRows.map((r) => ({ timestamp: r.timestamp, close: r.close_usd }))
        ),
        asOfUtc
      );
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
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
        }),
        presentComp(observationDate, 'trend_valuation', 'mayer_stretch', historyRole, {
          ...extra,
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
        }),
        presentComp(observationDate, 'trend_valuation', 'weekly_rsi', historyRole, {
          ...extra,
          git_blob_sha: island.btcPriceHistoryBlobSha,
          source_name: 'btc_price_history.csv',
        }),
      ];
      const fin = finalizeFactor(observationDate, 'trend_valuation', recs, trendScore);
      lineage.push(...fin.records);
      factorScores.trend_valuation = fin.score;
      factorRoles.trend_valuation = fin.role;
      factorAvailability.trend_valuation = fin.availability;
    } else {
      const proxy = await fetchCoinbase5mProxy(asOfUtc, ctx.runtime);
      const selected5m = selectCompletedCoinbase5mCandle(proxy.candles, asOfUtc);
      const history = await fetchCoinbaseCompletedHistory(asOfUtc, ctx.runtime);
      if (!selected5m.ok) {
        markAll('trend_valuation', selected5m.reasonCode || 'INCOMPLETE_CANDLE');
      } else {
        snapshotPrice = selected5m.close;
        snapshotRole = 'C_SURROGATE';
        dailyCloses = history.rows.map((r) => r.close);
        weeklyCloses = filterCompletedWeeklyCloses(
          createWeeklyCloses(history.rows.map((r) => ({ timestamp: r.timestamp, close: r.close }))),
          asOfUtc
        );
        historyRole = 'C_CURRENT_HISTORY';
        const trendScore = scoreTrendComponents({ snapshotPrice, dailyCloses, weeklyCloses });
        const recs = [
          presentComp(observationDate, 'trend_valuation', 'utc_intraday_snapshot', snapshotRole, {
            ...extra,
            source_name: 'coinbase_5m',
            external_snapshot_sha256: proxy.sha256,
          }),
          presentComp(observationDate, 'trend_valuation', 'bmsb_distance', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
          }),
          presentComp(observationDate, 'trend_valuation', 'mayer_stretch', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
          }),
          presentComp(observationDate, 'trend_valuation', 'weekly_rsi', historyRole, {
            ...extra,
            source_name: 'coinbase_daily',
          }),
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
    if (!etfHtml.ok || !etfBase?.ok) {
      markAll('etf_flows', !etfBase?.ok ? 'MISSING_BASELINE' : etfHtml.reasonCode || 'NO_SAME_DATE_ETF');
    } else {
      const scored = scoreEtfComponents({
        html: etfHtml.html,
        asOfUtc,
        historicalBaseline: etfBase.values,
      });
      const recs = FACTOR_COMPONENT_ORDER.etf_flows.map((componentKey) =>
        presentComp(observationDate, 'etf_flows', componentKey, 'B_METHOD_PIT', {
          ...extra,
          git_commit_sha: etfHtml.commitSha,
          git_blob_sha: etfHtml.blobSha,
          source_name: 'farside_html',
        })
      );
      const fin = finalizeFactor(observationDate, 'etf_flows', recs, scored);
      lineage.push(...fin.records);
      factorScores.etf_flows = fin.score;
      factorRoles.etf_flows = fin.role;
      factorAvailability.etf_flows = fin.availability;
    }

    const nlReqs = buildNetLiquidityRequests(observationDate, ctx.fredKey);
    const nlObs = {};
    for (const req of nlReqs) {
      const got = await fetchAlfredSeries(req, ctx.runtime);
      nlObs[req.seriesId] = parseFredObservations(got.json, observationDate);
    }
    const nlScored = scoreNetLiquidityComponents(nlObs, observationDate);
    if (!nlScored || !Number.isFinite(nlScored.factorScore)) {
      markAll('net_liquidity', nlScored?.reasonCode || 'INSUFFICIENT_LOOKBACK');
    } else {
      const recs = FACTOR_COMPONENT_ORDER.net_liquidity.map((componentKey) =>
        presentComp(observationDate, 'net_liquidity', componentKey, 'C_PIT_CONSERVATIVE', {
          ...extra,
          source_name: 'alfred',
        })
      );
      const fin = finalizeFactor(observationDate, 'net_liquidity', recs, nlScored);
      lineage.push(...fin.records);
      factorScores.net_liquidity = fin.score;
      factorRoles.net_liquidity = fin.role;
      factorAvailability.net_liquidity = fin.availability;
    }

    const shared = resolveSharedPriceVector(observationDate, ctx.gitExec);
    let priceVector = null;
    let priceRole = 'MISSING';
    let priceReason = shared.reasonCode || 'MISSING_CAPTURE';
    if (shared.ok) {
      priceVector = shared.vector;
      priceRole = 'B_METHOD_PIT';
    } else if (!shared.forbidSurrogate) {
      const cg = await fetchCoinGeckoCaseBRange(observationDate, ctx.runtime);
      const unwrapped = unwrapCoinGeckoCachePayload(cg.json);
      const prices = unwrapped.ok ? unwrapped.data?.prices : cg.json?.prices;
      const normalized = normalizeCoinGeckoDailyByUtcDate(prices);
      const proxy = await fetchCoinbase5mProxy(asOfUtc, ctx.runtime);
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
        } else priceReason = built.reasonCode;
      } else {
        priceReason = selected5m.ok ? normalized.reasonCode || 'MISSING_CAPTURE' : selected5m.reasonCode;
      }
    } else {
      priceReason = 'BRIDGE_CAPTURE_UNRESOLVED';
    }

    const termFund = resolveTermFunding(observationDate, asOfUtc, ctx.termIndex, ctx.gitExec);
    if (!termFund.ok || priceRole === 'MISSING') {
      markAll('term_leverage', !termFund.ok ? termFund.reasonCode || 'NO_BITMEX_EVIDENCE' : priceReason);
    } else {
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
        }),
        presentComp(observationDate, 'term_leverage', 'realized_vol', priceRole, {
          ...extra,
          source_name: priceRole === 'B_METHOD_PIT' ? 'market_chart_30_daily' : 'case_b_surrogate',
        }),
        presentComp(observationDate, 'term_leverage', 'stress', priceRole, {
          ...extra,
          source_name: priceRole === 'B_METHOD_PIT' ? 'market_chart_30_daily' : 'case_b_surrogate',
        }),
      ];
      const fin = finalizeFactor(observationDate, 'term_leverage', recs, scored);
      lineage.push(...fin.records);
      factorScores.term_leverage = fin.score;
      factorRoles.term_leverage = fin.role;
      factorAvailability.term_leverage = fin.availability;
    }

    const macroReqs = buildMacroRequests(observationDate, ctx.fredKey);
    const macroObs = {};
    for (const req of macroReqs) {
      const got = await fetchAlfredSeries(req, ctx.runtime);
      macroObs[req.seriesId] = parseFredObservations(got.json, observationDate);
    }
    const macroScored = scoreMacroComponents(macroObs, observationDate);
    if (!macroScored || !Number.isFinite(macroScored.factorScore)) {
      markAll('macro_overlay', macroScored?.reasonCode || 'INSUFFICIENT_LOOKBACK');
    } else {
      const recs = FACTOR_COMPONENT_ORDER.macro_overlay.map((componentKey) =>
        presentComp(observationDate, 'macro_overlay', componentKey, 'C_PIT_CONSERVATIVE', {
          ...extra,
          source_name: 'alfred',
        })
      );
      const fin = finalizeFactor(observationDate, 'macro_overlay', recs, macroScored);
      lineage.push(...fin.records);
      factorScores.macro_overlay = fin.score;
      factorRoles.macro_overlay = fin.role;
      factorAvailability.macro_overlay = fin.availability;
    }

    const social = resolveSocialRank(observationDate, ctx.trendingIndex, ctx.socialIndex, ctx.gitExec);
    if (!social.ok || priceRole === 'MISSING') {
      markAll('social_interest', !social.ok ? social.reasonCode || 'NO_BITCOIN_RANK' : priceReason);
    } else {
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
        }),
        presentComp(observationDate, 'social_interest', 'btc_price_momentum_7d', priceRole, {
          ...extra,
          source_name: priceRole === 'B_METHOD_PIT' ? 'market_chart_30_daily' : 'case_b_surrogate',
        }),
      ];
      const fin = finalizeFactor(observationDate, 'social_interest', recs, scored);
      lineage.push(...fin.records);
      factorScores.social_interest = fin.score;
      factorRoles.social_interest = fin.role;
      factorAvailability.social_interest = fin.availability;
    }
  }

  const eligibility = buildEligibility({ factorAvailability, factorScores });
  const observation = {
    observation_date: observationDate,
    reconstruction_as_of_utc: clock.valid ? clock.reconstruction_as_of_utc : '',
    reconstruction_clock_source: clock.valid ? clock.reconstruction_clock_source : '',
    xr_score: eligibility.xr_score == null ? '' : eligibility.xr_score,
    xr_status: eligibility.xr_status,
    reconstruction_grade: eligibility.reconstruction_grade,
    eligible_full_composite: eligibility.eligible_full_composite,
    missing_factor_count: eligibility.missing_factor_count,
    missing_factors: eligibility.missing_factors,
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
    eligible_full_composite: eligibility.eligible_full_composite,
    missing_factors: eligibility.missing_factors,
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
    eligibility,
    clock,
    rawArtifact,
  };
}

export async function runStageBGeneration({
  analysisSourceSha,
  outputDir,
  allowNetwork,
  gitExec = defaultGitExec,
  fetchImpl,
  env = {},
  observationDates = null,
  skipIdentityGuards = false,
  requireFrozenUniverse = true,
  fsImpl = fs,
} = {}) {
  if (!allowNetwork) {
    throw new XrRuntimeSourceError('Stage B generation requires --allow-network');
  }
  if (!skipIdentityGuards) {
    assertCleanWorktree(gitExec);
    assertAnalysisSourceSha(analysisSourceSha, gitExec);
    const identity = runContractCheck({ gitExec });
    if (!identity.ok) {
      throw new XrRuntimeSourceError('frozen identity mismatch before generation');
    }
  }
  const resolvedOut = assertSafeOutputDir(outputDir, process.cwd());
  const runtime = { fetchImpl, redact: (u) => u };
  const dailyText = gitShowText(`HEAD:${GIT_PATHS.dailyView}`, gitExec);
  const dailyRows = csvRowsToObjects(dailyText);
  const dailyByDate = new Map(dailyRows.map((r) => [r.observation_date, r]));
  const dates = observationDates || generateObservationUniverse();
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
  const observations = [];
  const lineage = [];
  const missingness = [];
  const bridge = [];
  for (const date of dates) {
    const one = await reconstructOneDate(date, ctx);
    observations.push(one.observation);
    lineage.push(...one.lineage);
    missingness.push(one.missingness);
    if (BRIDGE_DATES.includes(date)) {
      const prod = one.rawArtifact
        ? {
            factorScores: Object.fromEntries(
              OFFICIAL_FACTOR_ORDER.map((k) => {
                const score = Number(one.rawArtifact?.factors?.[k]?.score);
                return [k, Number.isFinite(score) ? score : null];
              })
            ),
            gScore: Number(one.rawArtifact?.composite_score),
          }
        : { factorScores: {}, gScore: null };
      bridge.push(
        ...buildBridgeRows({
          observationDate: date,
          xrFactorScores: one.factorScores,
          productionFactorScores: prod.factorScores,
          xrRoles: one.factorRoles,
          eligible: one.eligibility.xr_status === 'ELIGIBLE',
          xrScore: one.eligibility.xr_score,
          productionGScore: prod.gScore,
        })
      );
    }
  }
  const files = {
    'xr_observations.csv': serializeCsv(XR_OBSERVATION_COLUMNS, observations),
    'xr_factor_lineage.csv': serializeCsv(XR_FACTOR_LINEAGE_COLUMNS, lineage),
    'xr_missingness.csv': serializeCsv(XR_MISSINGNESS_COLUMNS, missingness),
    'xr_bridge_check.csv': serializeCsv(XR_BRIDGE_COLUMNS, bridge),
    'ANALYSIS_SOURCE_SHA.txt': `${analysisSourceSha}\n`,
    'PROTOCOL_VERSION.txt': `${H7_PROTOCOL_VERSION}\n`,
  };
  const validated = validateH71OutputSet({
    observationDates: dates,
    observations,
    missingness,
    lineage,
    bridge,
    analysisSourceSha,
    protocolVersion: H7_PROTOCOL_VERSION,
    requireFrozenUniverse,
  });
  if (!validated.ok) {
    throw new XrRuntimeSourceError(`output validation failed: ${validated.error}`);
  }
  finalizeAtomicOutputs(resolvedOut, files, { fsImpl });
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
