// Inactive v1.2.0 Net Liquidity successor candidate.
// Pure / deterministic. No network. No filesystem writes. No production routing.
// Governing docs:
//   docs/R01_R08_NET_LIQUIDITY_ADJUDICATION_2026-09-30.md
//   docs/V1.2.0_CORRECTED_ARCHITECTURE_FREEZE_2026-09-30.md

import { createHash } from 'node:crypto';
import {
  LOCKED_OFFICIAL_BLENDS,
  blendComponentScores,
} from '../../lib/ssotSubweights.mjs';
import {
  CORRECT_USD_MULTIPLIERS,
  DAY_MS,
  parseFredObservationRow,
  scoreNetLiquiditySeries,
} from '../../../research/lib/r01-r08-net-liquidity-diagnostic.mjs';

/**
 * Exact common Wednesday join on already-normalized USD rows.
 * No positional pairing. No fill. No RRP-zero substitution.
 */
export function exactCommonWednesdayJoin({ walclRows, rrpRows, wtregenRows }) {
  const mW = new Map(walclRows.map((r) => [r.date, r]));
  const mR = new Map(rrpRows.map((r) => [r.date, r]));
  const mT = new Map(wtregenRows.map((r) => [r.date, r]));
  const dates = [...mW.keys()].filter((d) => mR.has(d) && mT.has(d)).sort();
  return dates.map((date) => {
    const w = mW.get(date);
    const r = mR.get(date);
    const t = mT.get(date);
    return {
      date,
      walcl_usd: w.normalized_usd,
      rrp_usd: r.normalized_usd,
      wtregen_usd: t.normalized_usd,
      net_liquidity_usd: w.normalized_usd - r.normalized_usd - t.normalized_usd,
    };
  });
}

export const V12_NET_LIQUIDITY_CANDIDATE_ONLY = true;
export const V12_MODEL_VERSION_TARGET = 'v1.2.0';
export const V12_IMPLEMENTATION_REVISION_TARGET = 'semantic-correctness-2026-09';
export const V12_SSOT_VERSION = '2.1.1';
export const V12_FACTOR_KEY = 'net_liquidity';

export const NET_LIQUIDITY_FINGERPRINT_SCHEMA =
  'ghostgauge_v1_2_net_liquidity_input_fingerprint_v1';

export const V12_NET_LIQUIDITY_USD_MULTIPLIERS = Object.freeze({
  WALCL: CORRECT_USD_MULTIPLIERS.WALCL,
  WTREGEN: CORRECT_USD_MULTIPLIERS.WTREGEN,
  RRPONTSYD: CORRECT_USD_MULTIPLIERS.RRPONTSYD,
});

/** Frozen non-overridable source contracts. */
export const V12_NET_LIQUIDITY_SOURCE_CONTRACTS = Object.freeze({
  WALCL: Object.freeze({
    series_id: 'WALCL',
    query_semantics: 'NATIVE',
    usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WALCL,
    canonical_source_date: 'Wednesday',
  }),
  WTREGEN: Object.freeze({
    series_id: 'WTREGEN',
    query_semantics: 'NATIVE',
    usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WTREGEN,
    canonical_source_date: 'Wednesday',
  }),
  RRPONTSYD: Object.freeze({
    series_id: 'RRPONTSYD',
    frequency: 'wew',
    aggregation_method: 'avg',
    usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD,
    canonical_source_date: 'Wednesday',
  }),
});

function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function parseAsOfMs(asOfUtc) {
  if (asOfUtc == null || asOfUtc === '') return null;
  if (typeof asOfUtc === 'number' && Number.isFinite(asOfUtc)) return asOfUtc;
  const ms = Date.parse(String(asOfUtc));
  return Number.isFinite(ms) ? ms : null;
}

export function observationDateFromAsOfMs(asOfMs) {
  if (!Number.isFinite(asOfMs)) return null;
  return new Date(asOfMs).toISOString().slice(0, 10);
}

export function isUtcWednesday(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay() === 3;
}

function normalizeProvenance(raw) {
  if (raw == null) {
    return {
      status: 'UNPROVEN',
      provider: null,
      note: 'provider identity not supplied to candidate; not invented',
    };
  }
  if (typeof raw === 'string') return { status: 'SUPPLIED', provider: raw };
  return {
    status: raw.status || 'SUPPLIED',
    provider: raw.provider ?? raw.source ?? null,
    ...raw,
  };
}

function readQuerySemantics(source) {
  if (typeof source?.query_semantics === 'string') return source.query_semantics;
  if (source?.query_semantics?.mode) return source.query_semantics.mode;
  if (typeof source?.semantics === 'string') return source.semantics;
  return null;
}

export function validateNetLiquiditySourceContracts({ walcl, rrp, wtregen } = {}) {
  const errors = [];
  const push = (code) => errors.push(code);

  if (!walcl || typeof walcl !== 'object') push('walcl_missing');
  else {
    if (walcl.series_id !== 'WALCL') push('walcl_series_id_mismatch');
    if (readQuerySemantics(walcl) !== 'NATIVE') push('walcl_query_semantics_not_native');
    if (walcl.frequency != null && walcl.frequency !== 'NATIVE') {
      // Explicit frequency=w or other aggregate transforms are rejected.
      if (String(walcl.frequency).toLowerCase() === 'w') push('walcl_frequency_w_forbidden');
      else if (String(walcl.frequency).toLowerCase() !== 'native') push('walcl_non_native_frequency');
    }
    if (walcl.usd_multiplier != null && walcl.usd_multiplier !== V12_NET_LIQUIDITY_USD_MULTIPLIERS.WALCL) {
      push('walcl_multiplier_override_forbidden');
    }
  }

  if (!wtregen || typeof wtregen !== 'object') push('wtregen_missing');
  else {
    if (wtregen.series_id !== 'WTREGEN') push('wtregen_series_id_mismatch');
    if (readQuerySemantics(wtregen) !== 'NATIVE') push('wtregen_query_semantics_not_native');
    if (wtregen.frequency != null && String(wtregen.frequency).toLowerCase() === 'w') {
      push('wtregen_frequency_w_forbidden');
    } else if (
      wtregen.frequency != null
      && String(wtregen.frequency).toLowerCase() !== 'native'
    ) {
      push('wtregen_non_native_frequency');
    }
    if (
      wtregen.usd_multiplier != null
      && wtregen.usd_multiplier !== V12_NET_LIQUIDITY_USD_MULTIPLIERS.WTREGEN
    ) {
      push('wtregen_multiplier_override_forbidden');
    }
  }

  if (!rrp || typeof rrp !== 'object') push('rrp_missing');
  else {
    if (rrp.series_id !== 'RRPONTSYD') push('rrp_series_id_mismatch');
    if (rrp.frequency !== 'wew') {
      if (rrp.frequency === 'w') push('rrp_frequency_w_forbidden');
      else push('rrp_frequency_not_wew');
    }
    if (rrp.aggregation_method !== 'avg') push('rrp_aggregation_method_not_avg');
    if (rrp.usd_multiplier != null && rrp.usd_multiplier !== V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD) {
      push('rrp_multiplier_override_forbidden');
    }
  }

  return {
    ok: errors.length === 0,
    reason: errors.length === 0 ? null : 'invalid_net_liquidity_source_contract',
    errors,
  };
}

/**
 * Normalize one source into canonical Wednesday in-window rows.
 * Fails closed on ambiguous duplicate usable dates.
 */
export function normalizeCanonicalWednesdayRows({
  observations,
  usdMultiplier,
  startDate,
  endDate,
  sourceLabel,
}) {
  const source = Array.isArray(observations) ? observations : [];
  const byDate = new Map();
  let excludedNonFinite = 0;
  let excludedNonWednesday = 0;
  let excludedOutsideWindow = 0;
  let excludedMalformedDate = 0;

  for (let i = 0; i < source.length; i += 1) {
    const parsed = parseFredObservationRow(source[i]);
    if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      excludedMalformedDate += 1;
      continue;
    }
    if (parsed.date < startDate || parsed.date > endDate) {
      excludedOutsideWindow += 1;
      continue;
    }
    if (!isUtcWednesday(parsed.date)) {
      excludedNonWednesday += 1;
      continue;
    }
    if (!parsed.finite) {
      excludedNonFinite += 1;
      continue;
    }
    if (byDate.has(parsed.date)) {
      return {
        ok: false,
        reason: 'ambiguous_duplicate_source_date',
        source: sourceLabel,
        date: parsed.date,
        rows: [],
        provenance: null,
      };
    }
    byDate.set(parsed.date, {
      date: parsed.date,
      raw_value: parsed.value,
      normalized_usd: parsed.value * usdMultiplier,
      original_source_index: i,
    });
  }

  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ok: true,
    reason: null,
    source: sourceLabel,
    date: null,
    rows,
    provenance: {
      eligible_in_window_row_count: rows.length,
      excluded_non_finite_count: excludedNonFinite,
      excluded_non_wednesday_count: excludedNonWednesday,
      excluded_outside_window_or_after_asof_count: excludedOutsideWindow,
      excluded_malformed_date_count: excludedMalformedDate,
      latest_available_eligible_source_date: rows.at(-1)?.date ?? null,
    },
  };
}

export function buildCanonicalInputFingerprint({
  scoringWindowStartDate,
  scoringWindowEndDate,
  walclRows,
  rrpRows,
  wtregenRows,
}) {
  const payload = {
    fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    source_semantic_identities: {
      WALCL: {
        series_id: 'WALCL',
        query_semantics: 'NATIVE',
        usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WALCL,
      },
      RRPONTSYD: {
        series_id: 'RRPONTSYD',
        frequency: 'wew',
        aggregation_method: 'avg',
        usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD,
      },
      WTREGEN: {
        series_id: 'WTREGEN',
        query_semantics: 'NATIVE',
        usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WTREGEN,
      },
    },
    scoring_window_start_date: scoringWindowStartDate,
    scoring_window_end_date: scoringWindowEndDate,
    walcl_rows: walclRows.map((r) => ({ date: r.date, value_usd: r.normalized_usd })),
    rrp_rows: rrpRows.map((r) => ({ date: r.date, value_usd: r.normalized_usd })),
    wtregen_rows: wtregenRows.map((r) => ({ date: r.date, value_usd: r.normalized_usd })),
  };
  const serialized = JSON.stringify(payload);
  return {
    fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
    canonical_input_fingerprint: sha256Hex(serialized),
    fingerprint_payload: payload,
  };
}

export function canReuseV12NetLiquidityCache({ currentFingerprint, cached } = {}) {
  if (!cached || typeof cached !== 'object') return false;
  if (cached.model_version_target !== V12_MODEL_VERSION_TARGET) return false;
  if (cached.implementation_revision_target !== V12_IMPLEMENTATION_REVISION_TARGET) return false;
  if (cached.ssot_version !== V12_SSOT_VERSION) return false;
  if (!cached.canonical_input_fingerprint) return false;
  if (cached.fingerprint_schema !== NET_LIQUIDITY_FINGERPRINT_SCHEMA) return false;
  return cached.canonical_input_fingerprint === currentFingerprint;
}

/**
 * Pure inactive v1.2 Net Liquidity candidate scorer.
 * Caller supplies source observations + contracts. No network. No filesystem writes.
 */
export function computeV12NetLiquidityCandidate({
  walcl,
  rrp,
  wtregen,
  asOfUtc,
} = {}) {
  const asOfMs = parseAsOfMs(asOfUtc);
  const asOfDate = observationDateFromAsOfMs(asOfMs);
  const sourceValidation = validateNetLiquiditySourceContracts({ walcl, rrp, wtregen });

  const base = {
    candidate_only: true,
    production_active: false,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    factor_key: V12_FACTOR_KEY,
    source_contracts: V12_NET_LIQUIDITY_SOURCE_CONTRACTS,
    usd_multipliers: { ...V12_NET_LIQUIDITY_USD_MULTIPLIERS },
    component_blend: { ...LOCKED_OFFICIAL_BLENDS.net_liquidity },
    as_of_utc: asOfUtc ?? null,
    as_of_ms: asOfMs,
    as_of_date: asOfDate,
    source_contract_validation: sourceValidation,
  };

  if (asOfMs == null || asOfDate == null) {
    return {
      ...base,
      score: null,
      reason: 'invalid_or_missing_as_of_utc',
      scoring_window_start_date: null,
      scoring_window_end_date: null,
      selected_common_scoring_date: null,
      lastUpdated: null,
      latest_available_walcl_source_date: null,
      latest_available_rrp_wew_source_date: null,
      latest_available_wtregen_source_date: null,
      canonical_input_fingerprint: null,
      fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
      canonical_common_wednesday_count: 0,
      component_scores: null,
      level_percentile: null,
      roc4w_pct: null,
      net_liquidity_usd: null,
      source_provenance: null,
      canonical_series: [],
    };
  }

  if (!sourceValidation.ok) {
    return {
      ...base,
      score: null,
      reason: 'invalid_net_liquidity_source_contract',
      scoring_window_start_date: null,
      scoring_window_end_date: null,
      selected_common_scoring_date: null,
      lastUpdated: null,
      latest_available_walcl_source_date: null,
      latest_available_rrp_wew_source_date: null,
      latest_available_wtregen_source_date: null,
      canonical_input_fingerprint: null,
      fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
      canonical_common_wednesday_count: 0,
      component_scores: null,
      level_percentile: null,
      roc4w_pct: null,
      net_liquidity_usd: null,
      source_provenance: {
        WALCL: normalizeProvenance(walcl?.provider ?? walcl?.provenance),
        RRPONTSYD: normalizeProvenance(rrp?.provider ?? rrp?.provenance),
        WTREGEN: normalizeProvenance(wtregen?.provider ?? wtregen?.provenance),
      },
      canonical_series: [],
    };
  }

  const scoringWindowStartDate = new Date(asOfMs - 365 * DAY_MS).toISOString().slice(0, 10);
  const scoringWindowEndDate = asOfDate;

  const walclNorm = normalizeCanonicalWednesdayRows({
    observations: walcl.observations,
    usdMultiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WALCL,
    startDate: scoringWindowStartDate,
    endDate: scoringWindowEndDate,
    sourceLabel: 'WALCL',
  });
  const rrpNorm = normalizeCanonicalWednesdayRows({
    observations: rrp.observations,
    usdMultiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD,
    startDate: scoringWindowStartDate,
    endDate: scoringWindowEndDate,
    sourceLabel: 'RRPONTSYD',
  });
  const wtregenNorm = normalizeCanonicalWednesdayRows({
    observations: wtregen.observations,
    usdMultiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WTREGEN,
    startDate: scoringWindowStartDate,
    endDate: scoringWindowEndDate,
    sourceLabel: 'WTREGEN',
  });

  const sourceProvenance = {
    WALCL: {
      series_id: 'WALCL',
      query_semantics: 'NATIVE',
      usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WALCL,
      ...walclNorm.provenance,
      provider_source_provenance: normalizeProvenance(walcl.provider ?? walcl.provenance),
    },
    RRPONTSYD: {
      series_id: 'RRPONTSYD',
      frequency: 'wew',
      aggregation_method: 'avg',
      usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.RRPONTSYD,
      ...rrpNorm.provenance,
      provider_source_provenance: normalizeProvenance(rrp.provider ?? rrp.provenance),
    },
    WTREGEN: {
      series_id: 'WTREGEN',
      query_semantics: 'NATIVE',
      usd_multiplier: V12_NET_LIQUIDITY_USD_MULTIPLIERS.WTREGEN,
      ...wtregenNorm.provenance,
      provider_source_provenance: normalizeProvenance(wtregen.provider ?? wtregen.provenance),
    },
  };

  for (const norm of [walclNorm, rrpNorm, wtregenNorm]) {
    if (!norm.ok) {
      return {
        ...base,
        score: null,
        reason: 'ambiguous_duplicate_source_date',
        ambiguous_source: norm.source,
        ambiguous_date: norm.date,
        scoring_window_start_date: scoringWindowStartDate,
        scoring_window_end_date: scoringWindowEndDate,
        selected_common_scoring_date: null,
        lastUpdated: null,
        latest_available_walcl_source_date: walclNorm.provenance?.latest_available_eligible_source_date ?? null,
        latest_available_rrp_wew_source_date: rrpNorm.provenance?.latest_available_eligible_source_date ?? null,
        latest_available_wtregen_source_date: wtregenNorm.provenance?.latest_available_eligible_source_date ?? null,
        canonical_input_fingerprint: null,
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_common_wednesday_count: 0,
        component_scores: null,
        level_percentile: null,
        roc4w_pct: null,
        net_liquidity_usd: null,
        source_provenance: sourceProvenance,
        canonical_series: [],
      };
    }
  }

  const fingerprint = buildCanonicalInputFingerprint({
    scoringWindowStartDate,
    scoringWindowEndDate,
    walclRows: walclNorm.rows,
    rrpRows: rrpNorm.rows,
    wtregenRows: wtregenNorm.rows,
  });

  const canonicalSeries = exactCommonWednesdayJoin({
    walclRows: walclNorm.rows,
    rrpRows: rrpNorm.rows,
    wtregenRows: wtregenNorm.rows,
  });
  const selectedCommonScoringDate = canonicalSeries.at(-1)?.date ?? null;
  const lastUpdated = selectedCommonScoringDate
    ? `${selectedCommonScoringDate}T00:00:00.000Z`
    : null;

  const commonExtras = {
    scoring_window_start_date: scoringWindowStartDate,
    scoring_window_end_date: scoringWindowEndDate,
    selected_common_scoring_date: selectedCommonScoringDate,
    lastUpdated,
    latest_available_walcl_source_date: walclNorm.provenance.latest_available_eligible_source_date,
    latest_available_rrp_wew_source_date: rrpNorm.provenance.latest_available_eligible_source_date,
    latest_available_wtregen_source_date: wtregenNorm.provenance.latest_available_eligible_source_date,
    canonical_input_fingerprint: fingerprint.canonical_input_fingerprint,
    fingerprint_schema: fingerprint.fingerprint_schema,
    canonical_common_wednesday_count: canonicalSeries.length,
    source_provenance: sourceProvenance,
    canonical_series: canonicalSeries,
  };

  if (canonicalSeries.length < 8) {
    return {
      ...base,
      ...commonExtras,
      score: null,
      reason: 'insufficient_exact_common_wednesday_history',
      component_scores: null,
      level_percentile: null,
      roc4w_pct: null,
      net_liquidity_usd: null,
    };
  }

  const usdSeries = canonicalSeries.map((r) => r.net_liquidity_usd);
  const scored = scoreNetLiquiditySeries(usdSeries);
  if (!scored.ok) {
    return {
      ...base,
      ...commonExtras,
      score: null,
      reason: scored.reason === 'insufficient_data_for_analysis'
        ? 'insufficient_exact_common_wednesday_history'
        : scored.reason,
      component_scores: null,
      level_percentile: null,
      roc4w_pct: null,
      net_liquidity_usd: null,
    };
  }

  // SSOT blend already applied inside scoreNetLiquiditySeries via NET_LIQUIDITY_SUBWEIGHTS
  // (== LOCKED_OFFICIAL_BLENDS.net_liquidity). Re-assert equality for isolation.
  const composite = blendComponentScores(
    scored.component_scores,
    LOCKED_OFFICIAL_BLENDS.net_liquidity
  );
  if (composite !== scored.composite_score) {
    throw new Error('ssot_blend_parity_violation');
  }

  return {
    ...base,
    ...commonExtras,
    score: scored.composite_score,
    reason: null,
    component_scores: scored.component_scores,
    level_percentile: scored.level_percentile,
    roc4w_pct: scored.roc4w_pct,
    net_liquidity_usd: scored.latest_net_liquidity_usd,
  };
}
