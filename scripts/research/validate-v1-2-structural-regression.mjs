import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runV12StructuralRegression, writeStructuralRegressionReport } from './lib/v1-2-structural-regression.mjs';

const negative = process.argv.indexOf('--negative-control');
if (negative >= 0) {
  const kind = process.argv[negative + 1] || 'swap_keys';
  const report = await runV12StructuralRegression({ mutate: kind });
  console.log(JSON.stringify({
    disposition: report.overall_disposition,
    blockers: report.blockers.map((item) => item.id),
  }));
  process.exit(report.overall_disposition === 'BLOCKED' ? 1 : 0);
}

const outputDirectory = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-structural-'));
const report = await runV12StructuralRegression();
const written = writeStructuralRegressionReport(outputDirectory, report);
console.log(JSON.stringify({
  disposition: report.overall_disposition,
  evidence_sha256: report.evidence_sha256,
  counts: report.counts,
  blockers: report.blockers.map((item) => ({ id: item.id, detail: item.detail })),
  limitations: report.limitations.map((item) => item.id),
  tested_revision: report.run_metadata_excluded_from_evidence_hash.tested_revision,
  report: written,
}, null, 2));
process.exit(report.overall_disposition === 'PASS' ? 0 : 1);
