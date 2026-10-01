// Shared latest/status projection for v1.2 successor factors.
// compute.mjs and the integration tests both use this serializer.

import fs from 'node:fs';
import path from 'node:path';

export function buildSuccessorProvenance(factors) {
  return (factors || []).filter((factor) => factor.publication_identity === true).map((factor) => ({
    key: factor.key,
    score: factor.score,
    status: factor.status,
    last_updated_utc: factor.lastUpdated || factor.last_utc || null,
    provider: factor.r10?.provider ?? factor.funding_provider ?? factor.selected_provider ?? null,
    source_observation_utc: factor.r10?.source_observation_utc ?? null,
    scored_observation_utc: factor.r10?.scored_observation_utc ?? null,
    raw_funding_observation_utc: factor.latest_raw_funding_observation_utc ?? factor.r10?.raw_funding_observation_utc ?? null,
    scored_funding_observation_utc: factor.funding_observation_utc ?? factor.r10?.scored_funding_observation_utc ?? null,
    scored_spot_observation_utc: factor.spot_observation_utc ?? factor.r10?.scored_spot_observation_utc ?? null,
    selected_scoring_date: factor.r10?.selected_scoring_date ?? null,
    scored_cutoff_D: factor.r10?.scored_cutoff_D ?? null,
    calibration_id: factor.r10?.calibration_id ?? null,
    acquisition: factor.r10?.acquisition ?? null,
    spot_acquisition: factor.r10?.spot_acquisition ?? null,
    fallback: factor.r10?.fallback ?? null,
    derivation: factor.r10?.derivation ?? null,
    trending_fetched_at: factor.r10?.trending_fetched_at ?? null,
    trending_from_cache: factor.r10?.trending_from_cache === true,
    score_cache_reuse: factor.r10?.score_cache_reuse === true,
    candidate_only: factor.candidate_only === true,
    successor_candidate_only: factor.successor_candidate_only === true,
    successor_production_active: factor.successor_production_active === true,
  }));
}

export function buildLatestDocument(factors, identity = {}) {
  return {
    ok: true,
    model_version: identity.model_version || null,
    implementation_revision: identity.implementation_revision || null,
    ssot_version: identity.ssot_version || null,
    factors,
  };
}

export function buildStatusDocument(factors) {
  return {
    successor_provenance: buildSuccessorProvenance(factors),
  };
}

export function writePublicationArtifacts(directory, factors, identity = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const latest = buildLatestDocument(factors, identity);
  const status = buildStatusDocument(factors);
  fs.writeFileSync(path.join(directory, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'status.json'), `${JSON.stringify(status, null, 2)}\n`);
  return { latest, status };
}
