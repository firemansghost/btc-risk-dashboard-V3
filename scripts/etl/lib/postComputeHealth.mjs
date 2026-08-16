/**
 * Strict post-compute health-check decision.
 * --soft-fail is an explicit opt-in. There is no Social-only exception.
 */

export function decidePostComputeHealthCheck({ failedFactors = [], softFail = false } = {}) {
  const failures = Array.isArray(failedFactors) ? failedFactors : [];
  if (failures.length === 0) {
    return {
      ok: true,
      exitProcess: false,
      reason: 'all_required_factors_fresh',
      failedFactors: [],
    };
  }
  if (softFail) {
    return {
      ok: false,
      exitProcess: false,
      reason: 'soft_fail_opt_in',
      failedFactors: failures,
    };
  }
  return {
    ok: false,
    exitProcess: true,
    reason: 'required_factor_not_fresh',
    failedFactors: failures,
  };
}
