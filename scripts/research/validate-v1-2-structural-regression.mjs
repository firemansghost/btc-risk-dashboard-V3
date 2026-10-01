import os from 'node:os';
import path from 'node:path';
import { runV12StructuralRegression, writeStructuralRegressionReport } from './lib/v1-2-structural-regression.mjs';

const outputDirectory = process.argv[2] || path.join(os.tmpdir(), 'ghostgauge-v1-2-structural-regression');
const report = await runV12StructuralRegression();
const written = writeStructuralRegressionReport(outputDirectory, report);
console.log(JSON.stringify({
  disposition: report.overall_disposition,
  evidence_sha256: report.evidence_sha256,
  counts: report.counts,
  blockers: report.blockers.map((item) => ({ id: item.id, detail: item.detail })),
  limitations: report.limitations.map((item) => item.id),
  report: written,
}, null, 2));
if (report.blockers.length > 0) process.exitCode = 1;
