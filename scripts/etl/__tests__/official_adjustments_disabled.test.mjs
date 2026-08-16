import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gateOfficialAdjustments,
  isAdjustmentEnabled,
} from '../lib/officialAdjustments.mjs';

const nowIso = '2026-08-16T11:00:00.000Z';
const yClose = 62918.32;

test('cycle and spike flags default off in a disabled config', () => {
  const config = {
    adjustments: {
      cycle: { enabled: false },
      spike: { enabled: false },
    },
  };
  assert.equal(isAdjustmentEnabled(config, 'cycle'), false);
  assert.equal(isAdjustmentEnabled(config, 'spike'), false);
});

test('disabled flags zero adj_pts even if computed overlays are non-zero', () => {
  const gated = gateOfficialAdjustments({
    config: {
      adjustments: {
        cycle: { enabled: false },
        spike: { enabled: false },
      },
    },
    cycle_adjustment: { adj_pts: 2, residual_z: 1, reason: 'significant_deviation' },
    spike_adjustment: { adj_pts: -1.5, r_1d: 0.1, z: 3, reason: 'significant_volatility' },
    nowIso,
    yClose,
  });

  assert.equal(gated.cycleEnabled, false);
  assert.equal(gated.spikeEnabled, false);
  assert.equal(gated.cycle_adjustment.adj_pts, 0);
  assert.equal(gated.spike_adjustment.adj_pts, 0);
  assert.equal(gated.cycle_adjustment.reason, 'disabled');
  assert.equal(gated.spike_adjustment.reason, 'disabled');
});

test('dashboard-config.json cycle and spike are disabled', async () => {
  const { getDashboardConfig, clearConfigCache } = await import('../../../lib/config-loader.mjs');
  clearConfigCache();
  const config = await getDashboardConfig();
  assert.equal(config.adjustments.cycle.enabled, false);
  assert.equal(config.adjustments.spike.enabled, false);
});

test('missing adjustments config is treated as disabled', () => {
  const gated = gateOfficialAdjustments({
    config: {},
    cycle_adjustment: { adj_pts: 1.2 },
    spike_adjustment: { adj_pts: 0.8 },
    nowIso,
    yClose,
  });
  assert.equal(gated.cycle_adjustment.adj_pts, 0);
  assert.equal(gated.spike_adjustment.adj_pts, 0);
});
