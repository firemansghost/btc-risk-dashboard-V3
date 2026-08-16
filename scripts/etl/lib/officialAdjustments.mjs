/**
 * Official cycle/spike overlay gating.
 * When config.adjustments.*.enabled is false, adj_pts must be exactly 0
 * regardless of whether a price-history file exists.
 */

export function isAdjustmentEnabled(config, key) {
  return config?.adjustments?.[key]?.enabled === true;
}

export function disabledCycleAdjustment(nowIso, reason = 'disabled') {
  return {
    adj_pts: 0,
    residual_z: null,
    last_utc: nowIso,
    source: 'ETL disabled',
    reason,
  };
}

export function disabledSpikeAdjustment(nowIso, yClose, reason = 'disabled') {
  return {
    adj_pts: 0,
    r_1d: 0,
    sigma: 0,
    z: 0,
    ref_close: yClose,
    spot: yClose,
    last_utc: nowIso,
    source: 'ETL disabled',
    reason,
  };
}

/**
 * Force adj_pts to 0 when the corresponding flag is off.
 * Does not repair or run cycle/spike math.
 */
export function gateOfficialAdjustments({
  config,
  cycle_adjustment,
  spike_adjustment,
  nowIso,
  yClose,
}) {
  const cycleEnabled = isAdjustmentEnabled(config, 'cycle');
  const spikeEnabled = isAdjustmentEnabled(config, 'spike');

  return {
    cycleEnabled,
    spikeEnabled,
    cycle_adjustment: cycleEnabled
      ? cycle_adjustment
      : disabledCycleAdjustment(nowIso, 'disabled'),
    spike_adjustment: spikeEnabled
      ? spike_adjustment
      : disabledSpikeAdjustment(nowIso, yClose, 'disabled'),
  };
}
