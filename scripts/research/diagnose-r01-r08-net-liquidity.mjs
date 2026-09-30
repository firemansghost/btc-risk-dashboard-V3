#!/usr/bin/env node
// R01/R08-A Net Liquidity source/date/cache diagnostic CLI.
// Official live FRED only. Does not authorize production repair.

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORRECT_USD_MULTIPLIERS,
  FROZEN_SOURCE_UNITS_CONTRACT,
  PRODUCTION_USD_MULTIPLIERS,
  assertFrozenSourceUnitsFixture,
  attachFredReleaseAndSources,
  buildOfflineDiagnosticReport,
  loadFrozenSourceUnitsFixture,
  sha256Hex,
} from './lib/r01-r08-net-liquidity-diagnostic.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TRACKED_PATHS = [
  'scripts/etl/factors.mjs',
  'lib/factors/netLiquidity.ts',
  'config/dashboard-config.json',
  'config/subweights.json',
  'scripts/etl/__tests__/fixtures/fred-source-units.json',
  'public/data/cache/net_liquidity/net_liquidity_cache.json',
];

export function assertOutsideRepository(target, repoRoot = REPO_ROOT) {
  const resolved = path.resolve(target);
  const root = path.resolve(repoRoot);
  if (resolved === root || resolved.startsWith(root + path.sep)) {
    const error = new Error('refusing_repository_report_path');
    error.reason = 'refusing_repository_report_path';
    throw error;
  }
}

function argument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return null;
  return argv[index + 1];
}

function requireRepositorySha(value) {
  if (!value || !/^[0-9a-f]{40}$/i.test(value)) {
    const error = new Error('invalid_repository_sha');
    error.reason = 'invalid_repository_sha';
    throw error;
  }
  return value.toLowerCase();
}

async function writeJsonAtomic(target, value) {
  const directory = path.dirname(target);
  await fsPromises.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(target)}.tmp`);
  await fsPromises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsPromises.rename(temporaryPath, target);
}

function fileSha256OrNull(relPath, repoRoot = REPO_ROOT) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) return { path: relPath, exists: false, sha256: null };
  return { path: relPath, exists: true, sha256: sha256Hex(fs.readFileSync(abs)) };
}

function buildQueryWindow(asOfUtc) {
  const end = new Date(asOfUtc);
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  return {
    as_of_utc: asOfUtc,
    observation_start: start.toISOString().slice(0, 10),
    observation_end: end.toISOString().slice(0, 10),
    window_days: 365,
    production_query: {
      frequency: 'w',
      aggregation_method: 'avg',
    },
    wednesday_diagnostic_query: {
      frequency: 'wew',
      aggregation_method: 'avg',
      diagnostic_only: true,
    },
  };
}

async function fredGet(pathname, params, apiKey) {
  const url = new URL(`https://api.stlouisfed.org${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`fred_http_${response.status}_${pathname}`);
  }
  return response.json();
}

async function fetchFredObservations(seriesId, apiKey, startISO, endISO, { frequency = null, aggregationMethod = null } = {}) {
  const params = {
    series_id: seriesId,
    observation_start: startISO,
    observation_end: endISO,
  };
  if (frequency) params.frequency = frequency;
  if (aggregationMethod) params.aggregation_method = aggregationMethod;
  const data = await fredGet('/fred/series/observations', params, apiKey);
  return Array.isArray(data.observations) ? data.observations : [];
}

async function fetchFredSeriesMetadata(seriesId, apiKey) {
  const data = await fredGet('/fred/series', { series_id: seriesId }, apiKey);
  const row = Array.isArray(data.seriess) ? data.seriess[0] : null;
  if (!row) return null;
  return {
    series_id: row.id,
    title: row.title ?? null,
    units: row.units ?? null,
    frequency: row.frequency ?? null,
    frequency_short: row.frequency_short ?? null,
    seasonal_adjustment: row.seasonal_adjustment ?? null,
    seasonal_adjustment_short: row.seasonal_adjustment_short ?? null,
    last_updated: row.last_updated ?? null,
    observation_start: row.observation_start ?? null,
    observation_end: row.observation_end ?? null,
    popularity: row.popularity ?? null,
  };
}

async function fetchFredSeriesRelease(seriesId, apiKey) {
  return fredGet('/fred/series/release', { series_id: seriesId }, apiKey);
}

async function fetchFredReleaseSources(releaseId, apiKey) {
  return fredGet('/fred/release/sources', { release_id: releaseId }, apiKey);
}

/**
 * Official FRED-only series + release + source identity for one series.
 * Failed release/source fetches become explicit blockers (not silent omission).
 */
async function fetchFredSeriesMetadataBundle(seriesId, apiKey) {
  let seriesMetadata = null;
  let seriesError = null;
  try {
    seriesMetadata = await fetchFredSeriesMetadata(seriesId, apiKey);
  } catch (error) {
    seriesError = error;
  }

  let releaseDocument = null;
  let releaseError = seriesError;
  if (!seriesError) {
    try {
      releaseDocument = await fetchFredSeriesRelease(seriesId, apiKey);
    } catch (error) {
      releaseError = error;
    }
  }

  let sourcesDocument = null;
  let sourcesError = null;
  const releaseRow = Array.isArray(releaseDocument?.releases) ? releaseDocument.releases[0] : null;
  const releaseId = releaseRow?.id;
  if (releaseId != null && !releaseError) {
    try {
      sourcesDocument = await fetchFredReleaseSources(releaseId, apiKey);
    } catch (error) {
      sourcesError = error;
    }
  }

  const attached = attachFredReleaseAndSources({
    seriesId,
    seriesMetadata,
    releaseDocument,
    sourcesDocument,
    releaseError,
    sourcesError,
  });
  if (seriesError) {
    attached.blockers.unshift({
      type: 'fred_series_metadata_fetch_failed',
      series_id: seriesId,
      error: String(seriesError.message || seriesError),
      action: 'do_not_adjudicate_without_series_metadata',
    });
  }
  return attached;
}

function compareMetadataToFixture(liveMetadata, fixtureDocument) {
  const blockers = [];
  const byId = Object.fromEntries(fixtureDocument.series.map((row) => [row.series_id, row]));
  for (const meta of liveMetadata) {
    if (!meta) continue;
    const frozen = byId[meta.series_id];
    if (!frozen) {
      blockers.push({
        type: 'metadata_fixture_missing_series',
        series_id: meta.series_id,
      });
      continue;
    }
    // Compare units string loosely to frozen source_unit when both present.
    if (meta.units && frozen.source_unit && meta.units !== frozen.source_unit) {
      blockers.push({
        type: 'live_metadata_units_disagree_with_frozen_fixture',
        series_id: meta.series_id,
        live_units: meta.units,
        frozen_source_unit: frozen.source_unit,
        action: 'do_not_silently_update_fixture',
      });
    }
  }
  return blockers;
}

function readCacheSnapshot(repoRoot = REPO_ROOT) {
  const cachePath = path.join(repoRoot, 'public/data/cache/net_liquidity/net_liquidity_cache.json');
  if (!fs.existsSync(cachePath)) {
    return { exists: false };
  }
  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  return {
    exists: true,
    version: raw.version ?? null,
    score: raw.score ?? null,
    reason: raw.reason ?? null,
    lastUpdated: raw.lastUpdated ?? null,
    latestWalclDate: raw.latestWalclDate ?? null,
    cachedAt: raw.cachedAt ?? null,
    metrics: raw.metrics ?? null,
    raw_source_arrays_present: Boolean(
      raw.walclObservations || raw.rrpObservations || raw.wtregenObservations || raw.observations
    ),
    source_specific_latest_dates_stored: {
      walcl: Boolean(raw.latestWalclDate),
      rrp: Boolean(raw.latestRrpDate),
      wtregen: Boolean(raw.latestWtregenDate),
    },
    details_present: Array.isArray(raw.details),
  };
}

export async function runR01R08NetLiquidityDiagnostic({
  repositorySha,
  reportPath,
  asOfUtc = new Date().toISOString(),
  apiKey = process.env.FRED_API_KEY,
  repoRoot = REPO_ROOT,
  fetchImpl = null,
}) {
  assertOutsideRepository(reportPath, repoRoot);
  const sha = requireRepositorySha(repositorySha);
  if (!apiKey) {
    const error = new Error('missing_fred_api_key');
    error.reason = 'missing_fred_api_key';
    throw error;
  }

  const queryWindow = buildQueryWindow(asOfUtc);
  const { observation_start: startISO, observation_end: endISO } = queryWindow;

  const fetchObservations = fetchImpl
    ? fetchImpl
    : (seriesId, opts) => fetchFredObservations(seriesId, apiKey, startISO, endISO, opts);

  const [
    walclWeekly,
    rrpWeekly,
    wtregenWeekly,
    walclNative,
    rrpNative,
    wtregenNative,
    rrpWednesdayFred,
    bundleWalcl,
    bundleRrp,
    bundleTga,
  ] = await Promise.all([
    fetchObservations('WALCL', { frequency: 'w', aggregationMethod: 'avg' }),
    fetchObservations('RRPONTSYD', { frequency: 'w', aggregationMethod: 'avg' }),
    fetchObservations('WTREGEN', { frequency: 'w', aggregationMethod: 'avg' }),
    fetchObservations('WALCL', {}),
    fetchObservations('RRPONTSYD', {}),
    fetchObservations('WTREGEN', {}),
    fetchObservations('RRPONTSYD', { frequency: 'wew', aggregationMethod: 'avg' }),
    fetchFredSeriesMetadataBundle('WALCL', apiKey),
    fetchFredSeriesMetadataBundle('RRPONTSYD', apiKey),
    fetchFredSeriesMetadataBundle('WTREGEN', apiKey),
  ]);

  const fixture = loadFrozenSourceUnitsFixture(
    path.join(repoRoot, 'scripts/etl/__tests__/fixtures/fred-source-units.json')
  );
  assertFrozenSourceUnitsFixture(fixture);
  const fredMetadata = {
    WALCL: bundleWalcl.metadata,
    RRPONTSYD: bundleRrp.metadata,
    WTREGEN: bundleTga.metadata,
  };
  const metadataFixtureBlockers = [
    ...compareMetadataToFixture(
      [bundleWalcl.metadata, bundleRrp.metadata, bundleTga.metadata],
      fixture
    ),
    ...bundleWalcl.blockers,
    ...bundleRrp.blockers,
    ...bundleTga.blockers,
  ];

  const implementationInventory = {
    canonical_production: 'scripts/etl/factors.mjs',
    repository_sha: sha,
    files: TRACKED_PATHS.map((rel) => fileSha256OrNull(rel, repoRoot)),
    frozen_source_units_contract: FROZEN_SOURCE_UNITS_CONTRACT,
    correct_usd_multipliers: CORRECT_USD_MULTIPLIERS,
    production_usd_multipliers: PRODUCTION_USD_MULTIPLIERS,
  };

  const report = buildOfflineDiagnosticReport({
    repositorySha: sha,
    generatedAtUtc: asOfUtc,
    queryWindow,
    walclWeekly,
    rrpWeekly,
    wtregenWeekly,
    walclNative,
    rrpNative,
    wtregenNative,
    rrpWednesdayFred,
    fredMetadata,
    metadataFixtureBlockers,
    cacheSnapshot: readCacheSnapshot(repoRoot),
    implementationInventory,
  });

  // Ensure live network flag is true for official CLI path.
  report.provider_network_performed = true;
  report.provider_network_scope = 'FRED_ONLY';

  await writeJsonAtomic(reportPath, report);
  return { ok: true, report, reportPath };
}

async function main() {
  const reportPath = argument('--report');
  const repositorySha = argument('--repository-sha');
  const asOfUtc = argument('--as-of-utc') || new Date().toISOString();
  if (!reportPath) {
    console.error('Missing --report <outside-repo-path>');
    process.exit(2);
  }
  if (!repositorySha) {
    console.error('Missing --repository-sha <40-char-sha>');
    process.exit(2);
  }
  try {
    const result = await runR01R08NetLiquidityDiagnostic({
      repositorySha,
      reportPath,
      asOfUtc,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          reportPath: result.reportPath,
          schema: result.report.schema,
          repository_sha: result.report.repository_sha,
          blockers: result.report.blockers?.length ?? 0,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error.reason || error.message || String(error));
    process.exit(1);
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main();
}
