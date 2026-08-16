import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSignalV2Csv,
  signalV2FilePath,
} from '../lib/signalV2.mjs';
import { detectEtfZeroCrossFromRows } from '../lib/etfZeroCross.mjs';

test('v2 ETF zero-cross detects a signed 21d-sum flip', () => {
  const text = [
    'date,schema_version,day_flow_usd,sum21_usd,z,pct,score',
    '2026-08-14,v2,10,5000000,1,80,75',
    '2026-08-15,v2,-10,-5000000,-1,20,30',
  ].join('\n');
  const result = detectEtfZeroCrossFromRows(parseSignalV2Csv(text));
  assert.equal(result.detected, true);
  assert.equal(result.alerts[0].type, 'etf_zero_cross');
  assert.equal(result.alerts[0].direction, 'down');
});

test('v2 ETF zero-cross does not invent 0 for missing sum21_usd', () => {
  const text = [
    'date,schema_version,day_flow_usd,sum21_usd,z,pct,score',
    '2026-08-14,v2,10,,1,80,75',
    '2026-08-15,v2,-10,,-1,20,30',
  ].join('\n');
  const result = detectEtfZeroCrossFromRows(parseSignalV2Csv(text));
  assert.equal(result.detected, false);
  assert.equal(result.reason, 'insufficient_v2_rows');
});

test('signalV2FilePath points at v2 not frozen legacy', () => {
  const etfPath = signalV2FilePath('etf_flows');
  assert.ok(etfPath.includes('v2'));
  assert.ok(etfPath.endsWith(`etf_flows_21d.csv`));
  assert.ok(signalV2FilePath('social_interest').endsWith('social_interest.csv'));
  assert.equal(signalV2FilePath('missing'), null);
});
