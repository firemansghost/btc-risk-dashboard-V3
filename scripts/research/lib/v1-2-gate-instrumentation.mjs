// Test-only instrumentation. The checkout is never edited.
// Recorded substitutions wrap the production text that is actually executed.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { getStalenessConfig, getStalenessStatus } from '../../etl/stalenessUtils.mjs';
import { getFactorsArray, loadDashboardConfig } from '../../../lib/config-loader.mjs';
import { validateCompositeScore } from '../../../lib/composite-validator.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const GATE_AS_OF_UTC = '2026-09-30T18:00:00.000Z';

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function readGitRevision(repoRoot = ROOT) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

export function readGitRef(ref, repoRoot = ROOT) {
  return execFileSync('git', ['rev-parse', ref], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function extractBalanced(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const brace = source.indexOf('{', start);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

export function loadCalculateEnhancedGScore(factorsSource) {
  const source = extractBalanced(factorsSource, 'function calculateEnhancedGScore');
  if (!source) return null;
  const fn = new Function(`${source}\nreturn calculateEnhancedGScore;`)();
  return { fn, source, sha256: sha256(source) };
}

export function compositeLoopInstrumentation(factorsSource, asOfIso) {
  const lines = factorsSource.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes('const { loadDashboardConfig, getFactorsArray }'));
  const returnStart = lines.findIndex((line, index) => index > start && line.trim() === 'return {');
  if (start < 0 || returnStart < 0) return null;
  let depth = 0;
  let seen = false;
  let returnEnd = returnStart;
  for (let i = returnStart; i < lines.length; i += 1) {
    for (const char of lines[i]) {
      if (char === '{') {
        depth += 1;
        seen = true;
      } else if (char === '}') {
        depth -= 1;
        if (seen && depth === 0) {
          returnEnd = i;
          break;
        }
      }
    }
    if (seen && depth === 0) break;
  }
  const originalSlice = lines.slice(start, returnEnd + 1).join('\n');
  const replacement = `asOf: ${JSON.stringify(asOfIso)},`;
  const instrumented = originalSlice
    .replace('asOf: new Date().toISOString(),', replacement)
    .replace(
      "const { loadDashboardConfig, getFactorsArray } = await import('../../lib/config-loader.mjs');\n",
      '',
    )
    .replace(
      "const { validateCompositeScore } = await import('../../lib/composite-validator.mjs');\n",
      '',
    );
  return {
    original_sha256: sha256(originalSlice),
    instrumented_sha256: sha256(instrumented),
    boundaries: [{
      id: 'staleness_asof_frozen',
      original: 'asOf: new Date().toISOString(),',
      replacement,
    }],
    instrumented,
  };
}

export async function runProductionComposite(settledByKey, asOfIso = GATE_AS_OF_UTC) {
  const factorsSource = fs.readFileSync(path.join(ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  const gscore = loadCalculateEnhancedGScore(factorsSource);
  const loop = compositeLoopInstrumentation(factorsSource, asOfIso);
  if (!gscore || !loop || !loop.instrumented.includes(asOfIso)) {
    throw new Error('composite_source_extraction_failed');
  }
  const runner = new Function(
    'settledByKey',
    'getStalenessConfig',
    'getStalenessStatus',
    'loadDashboardConfig',
    'getFactorsArray',
    'validateCompositeScore',
    'calculateEnhancedGScore',
    `return (async () => {\n${loop.instrumented}\n})();`,
  );
  const result = await runner(
    settledByKey,
    getStalenessConfig,
    getStalenessStatus,
    loadDashboardConfig,
    getFactorsArray,
    validateCompositeScore,
    gscore.fn,
  );
  return {
    result,
    instrumentation: {
      calculateEnhancedGScore_sha256: gscore.sha256,
      loop_original_sha256: loop.original_sha256,
      loop_instrumented_sha256: loop.instrumented_sha256,
      boundaries: loop.boundaries,
    },
  };
}

function trendRecords() {
  const records = [];
  const endMs = Date.parse('2026-09-29T00:00:00.000Z');
  for (let age = 420; age >= 0; age -= 1) {
    records.push({
      date_utc: new Date(endMs - age * 86_400_000).toISOString().slice(0, 10),
      close_usd: 40_000 + (420 - age) * 25,
      source: 'gate_supplied',
      ingested_at_utc: GATE_AS_OF_UTC,
    });
  }
  return records;
}

function rewriteLocalImports(source, originalFile) {
  const dir = path.dirname(originalFile);
  const toUrl = (spec) => pathToFileURL(path.resolve(dir, spec)).href;
  return source
    .replace(/from\s+['"](\.[^'"]+)['"]/g, (match, spec) => match.replace(spec, toUrl(spec)))
    .replace(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g, (_match, spec) => `import(${JSON.stringify(toUrl(spec))})`);
}

async function importInstrumented(originalFile, source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-instrument-'));
  const target = path.join(directory, path.basename(originalFile));
  fs.writeFileSync(target, rewriteLocalImports(source, originalFile));
  try {
    return await import(pathToFileURL(target).href);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function frozenDate(asOfIso) {
  const frozenMs = Date.parse(asOfIso);
  return class GateDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(frozenMs);
      else super(...args);
    }

    static now() {
      return frozenMs;
    }
  };
}

export async function runInstrumentedTrend(asOfIso = GATE_AS_OF_UTC) {
  const relative = 'scripts/etl/factors/trendValuation.mjs';
  const absolute = path.join(ROOT, relative);
  const original = fs.readFileSync(absolute, 'utf8');
  const instrumented = original
    .replace(
      'const asOfUtc = new Date().toISOString();',
      `const asOfUtc = ${JSON.stringify(asOfIso)};`,
    )
    .replace('await loadPriceHistory()', 'globalThis.__GATE_TREND_RECORDS');
  const RealDate = globalThis.Date;
  globalThis.Date = frozenDate(asOfIso);
  globalThis.__GATE_TREND_RECORDS = trendRecords();
  try {
    const namespace = await importInstrumented(absolute, instrumented);
    const result = await namespace.computeTrendValuation(50_000);
    return {
      result,
      instrumentation: {
        module: relative,
        original_sha256: sha256(original),
        instrumented_sha256: sha256(instrumented),
        boundaries: [
          'freeze Trend asOfUtc to the gate as-of',
          'replace loadPriceHistory() with supplied deterministic rows',
          'evaluate the instrumented copy from a temp directory outside the repository',
        ],
      },
    };
  } finally {
    globalThis.Date = RealDate;
    delete globalThis.__GATE_TREND_RECORDS;
  }
}

function fredSeries(value) {
  const observations = [];
  const end = Date.parse('2026-09-30T00:00:00.000Z');
  for (let age = 90; age >= 0; age -= 1) {
    observations.push({
      date: new Date(end - age * 86_400_000).toISOString().slice(0, 10),
      value: String(value),
    });
  }
  return { observations };
}

function cboeCsv(endDate) {
  const lines = ['DATE,OPEN,HIGH,LOW,CLOSE'];
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  for (let age = 45; age >= 0; age -= 1) {
    const date = new Date(end - age * 86_400_000).toISOString().slice(0, 10);
    lines.push(`${date},18,19,17,18`);
  }
  return `${lines.join('\n')}\n`;
}

function fetchResponse(body, { status = 200, contentType = 'application/json' } = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers: {
      get: (name) => (String(name).toLowerCase() === 'content-type' ? contentType : null),
    },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    arrayBuffer: async () => Buffer.from(payload),
    text: async () => payload,
  };
}

export function createMacroFetch(mode) {
  const calls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('cdn-api.cboe.com')) {
      if (mode === 'fred_fallback' || mode === 'unavailable') {
        return fetchResponse('down', { status: 503, contentType: 'text/plain' });
      }
      if (mode === 'stale_cboe') return fetchResponse(cboeCsv('2026-08-01'), { contentType: 'text/csv' });
      return fetchResponse(cboeCsv('2026-09-30'), { contentType: 'text/csv' });
    }
    if (href.includes('series_id=VIXCLS')) {
      if (mode === 'unavailable') return fetchResponse({ observations: [] });
      return fetchResponse(fredSeries(18));
    }
    if (href.includes('series_id=DTWEXBGS')) return fetchResponse(fredSeries(100));
    if (href.includes('series_id=DGS2')) return fetchResponse(fredSeries(4));
    if (href.includes('series_id=DGS10')) return fetchResponse(fredSeries(5));
    if (href.includes('series_id=DFII10')) return fetchResponse(fredSeries(2));
    return fetchResponse({ observations: [] }, { status: 404 });
  };
  return { fetchImpl, calls };
}

export async function runInstrumentedMacro(mode = 'cboe_primary', asOfIso = GATE_AS_OF_UTC) {
  const relative = 'scripts/etl/factors.mjs';
  const absolute = path.join(ROOT, relative);
  const original = fs.readFileSync(absolute, 'utf8');
  let instrumented = original.replace(
    '    const end = new Date();\n    const start = new Date(end.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days for better trend analysis',
    `    const end = new Date(${JSON.stringify(asOfIso)});\n    const start = new Date(end.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days for better trend analysis`,
  );
  instrumented = instrumented
    .replace('async function loadMacroOverlayCache() {', 'async function loadMacroOverlayCache() { return null; }\nasync function loadMacroOverlayCacheDisabled() {')
    .replace('async function readMacroOverlayCacheRaw() {', 'async function readMacroOverlayCacheRaw() { return null; }\nasync function readMacroOverlayCacheRawDisabled() {')
    .replace('async function saveMacroOverlayCache(data) {', 'async function saveMacroOverlayCache() { return null; }\nasync function saveMacroOverlayCacheDisabled(data) {');
  instrumented += '\nexport { computeMacroOverlay as __gateComputeMacroOverlay };\n';
  const { fetchImpl, calls } = createMacroFetch(mode);
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.FRED_API_KEY;
  const RealDate = globalThis.Date;
  process.env.FRED_API_KEY = 'gate-test-key';
  globalThis.fetch = fetchImpl;
  globalThis.Date = frozenDate(asOfIso);
  try {
    const namespace = await importInstrumented(absolute, instrumented);
    const result = await namespace.__gateComputeMacroOverlay();
    return {
      result,
      calls: calls.slice(),
      instrumentation: {
        module: relative,
        original_sha256: sha256(original),
        instrumented_sha256: sha256(instrumented),
        mode,
        boundaries: [
          'freeze the macro window end at the gate as-of',
          'neutralize macro cache read and write in the instrumented copy',
          'export computeMacroOverlay only on the instrumented copy',
          'intercept global fetch for this invocation',
          'evaluate the instrumented copy from a temp directory outside the repository',
        ],
      },
    };
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.Date = RealDate;
    if (previousKey == null) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = previousKey;
  }
}

export function assertReportDirectoryOutsideRepo(outputDirectory, repoRoot = ROOT) {
  if (!outputDirectory || typeof outputDirectory !== 'string') {
    throw new Error('report_directory_required');
  }
  const repoReal = fs.realpathSync(repoRoot);
  let cursor = path.resolve(outputDirectory);
  const missing = [];
  while (!fs.existsSync(cursor)) {
    missing.push(path.basename(cursor));
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error('report_directory_unresolvable');
    cursor = parent;
  }
  const realParent = fs.realpathSync(cursor);
  const resolved = missing.length === 0
    ? realParent
    : path.join(realParent, ...missing.reverse());
  const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
  if (resolved === repoReal || resolved.startsWith(prefix)) {
    throw new Error('report_directory_inside_repository');
  }
}
