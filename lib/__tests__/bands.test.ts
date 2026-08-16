import { expect, test } from 'vitest';
import { getBandForScore } from '@/lib/riskConfig.client';
import { matchBandForScore } from '@/lib/riskBand';

const SSOT_BANDS = [
  { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 14] as [number, number] },
  { key: 'dca_buy', label: 'Regular DCA Buying', range: [15, 34] as [number, number] },
  { key: 'moderate_buy', label: 'Moderate Buying', range: [35, 49] as [number, number] },
  { key: 'hold_wait', label: 'Hold & Wait', range: [50, 64] as [number, number] },
  { key: 'reduce_risk', label: 'Reduce Risk', range: [65, 79] as [number, number] },
  { key: 'high_risk', label: 'High Risk', range: [80, 100] as [number, number] },
];

test('band mapping monotonic', () => {
  expect(getBandForScore(10).key).not.toEqual(getBandForScore(90).key);
});

test('integer edges keep official labels', () => {
  expect(getBandForScore(14).label).toBe('Aggressive Buying');
  expect(getBandForScore(15).label).toBe('Regular DCA Buying');
  expect(getBandForScore(34).label).toBe('Regular DCA Buying');
  expect(getBandForScore(35).label).toBe('Moderate Buying');
  expect(getBandForScore(49).label).toBe('Moderate Buying');
  expect(getBandForScore(50).label).toBe('Hold & Wait');
  expect(getBandForScore(64).label).toBe('Hold & Wait');
  expect(getBandForScore(65).label).toBe('Reduce Risk');
  expect(getBandForScore(79).label).toBe('Reduce Risk');
  expect(getBandForScore(80).label).toBe('High Risk');
  expect(getBandForScore(100).label).toBe('High Risk');
});

test('fractional gap scores do not fall through to High Risk', () => {
  expect(matchBandForScore(14.5, SSOT_BANDS)?.key).toBe('aggressive_buy');
  expect(matchBandForScore(34.5, SSOT_BANDS)?.key).toBe('dca_buy');
  expect(matchBandForScore(49.5, SSOT_BANDS)?.key).toBe('moderate_buy');
  expect(matchBandForScore(64.5, SSOT_BANDS)?.key).toBe('hold_wait');
  expect(matchBandForScore(79.5, SSOT_BANDS)?.key).toBe('reduce_risk');
  expect(getBandForScore(14.5).label).toBe('Aggressive Buying');
  expect(getBandForScore(34.5).label).toBe('Regular DCA Buying');
  expect(getBandForScore(49.5).label).toBe('Moderate Buying');
  expect(getBandForScore(64.5).label).toBe('Hold & Wait');
  expect(getBandForScore(79.5).label).toBe('Reduce Risk');
});
