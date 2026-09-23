# ETF SoSoValue source-history adjudication — 2026-09-23

Design and governance only. SoSoValue is **not** the production ETF source. Daily ETL still acquires ETF Flows from Farside HTML.

This amendment approves a future implementation contract. It does not authorize a production source switch, runtime implementation, scoring changes, model activation, or any H8 change.

Status labels used below:

- **DECIDED** — required by current code, frozen scoring, or already observed evidence.
- **APPROVED FOR FUTURE IMPLEMENTATION CONTRACT** — frozen for later implementation PRs. Not active in production.
- **UNRESOLVED** — intentionally not required before implementation, or not established by the evidence.
- **REJECTED** — must not be done.

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| Live provider | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | SoSoValue is the future primary machine-readable ETF source. It is not the current production source. |
| Canonical unit | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | USD. Convert the frozen Farside baseline from displayed millions by `×1e6` at the boundary. |
| Historical calibration | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Keep `public/data/etf-flows-historical.json` as a frozen Farside calibration baseline. Recent unit-aligned overlap supports comparability. Full 2024–2025 equivalence is unproven. ETF-S7 remains mandatory. |
| Ticker universe | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Exact tickers only. The approved scored universe is the 12 names in section 8, including MSBT. FBTC and BTC stay distinct. |
| Completeness | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Finite summary total, all 12 approved ticker rows present, and all 12 net flows finite, on an eligible T+1 date. |
| Finality | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Most recent completed U.S. trading session strictly before the current America/New_York market date. Do not carry 16:00 UTC forward as a SoSoValue publication time. |
| Durable history | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Normalized SoSoValue history, separate from scores and from the revision audit. Provider universe and scored universe are distinct fields. |
| Revisions | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Append-only audit. A revised in-window value updates materialized history and is recomputed on the next scheduled ETL, not by an automatic extra run. |
| Outage fallback | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Durable SoSoValue history only when it already has a complete row for the expected eligible date. Otherwise exclude ETF Flows. |
| Freshness | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Latest complete trading date versus the expected eligible America/New_York market date. Not file mtime, fetch time, or a synthetic 16:00 UTC stamp. |
| Farside role | APPROVED FOR FUTURE IMPLEMENTATION CONTRACT | Frozen calibration provenance and optional manual evidence. Not an automatic live fallback. |
| Versioning | DECIDED as a requirement | A live provider change, the 12-name HHI universe, and the unit/finality correction are scientifically material. Activation requires a source-contract version, an implementation revision, and lineage disclosure. The exact future model version identifier is UNRESOLVED. |

Production switch, runtime implementation, and model activation: **not authorized**.

## 2. Evidence reviewed

Repository files were inspected and not modified.

`computeEtfFlows()` calls `requireSubWeights(await getDashboardConfig(), 'etf_flows')`. `getDashboardConfig()` loads `config/dashboard-config.json`. `requireSubWeights()` reads `config.subweights.etf_flows` from that supplied dashboard config. `scripts/etl/lib/ssotSubweights.mjs` does not replace the config. It validates that the required keys exist, that each value is finite, and that the keys sum to approximately 1. The executing ETF values in `config/dashboard-config.json` are `sum_21d` 0.30, `acceleration` 0.30, and `diversification` 0.40. `LOCKED_OFFICIAL_BLENDS.etf_flows` records the same numbers. The config is not bypassed.

Also inspected:

- `scripts/etl/factors.mjs` — acquisition, HTML parser, historical baseline load, synthetic `lastUpdated`, and the `requireSubWeights` call above.
- `scripts/etl/lib/ssotSubweights.mjs` — subweight key, finiteness, and sum checks.
- `scripts/etl/marketCalendar.mjs` — `ETF_FLOW_PUBLISH_HOUR_UTC = 16`, expected trading day, published-row filter, and cadence freshness.
- `scripts/etl/stalenessUtils.mjs` — the ETF path calls the market-calendar cadence check. A 5-day TTL remains a fallback description.
- `scripts/etl/fetch-helper.mjs` — shared fetch helper. ETF HTML fetches discard per-URL errors.
- `public/data/etf-flows-historical.json` — Farside source, `fetchedAt` `2025-09-17T11:24:18.385Z`, 294 records, `2024-01-11` through `2025-09-16`. The `2024-01-11` daily flow is `655.3`.
- `public/data/cache/etf/**` — date-named HTML snapshots. The 2026-09-08 page title and `h1` say `(US$m)`. The table header cells are bare tokens such as `Total`, `FBTC`, and `BTC`.
- `docs/H8_V2_STOP_2026-09-22.md` and `research/h8-v2-prospective/H8_V2_STOP.json` — H8 v2 is stopped.

GitHub evidence. The diagnostic artifacts were not modified.

- PR #52 — R02 fixture: FBTC and BTC are distinct Farside identities. Production `header.includes` is not repaired here.
- PR #54 — closed, unmerged. GitHub-hosted runners received Cloudflare HTTP 403 challenge pages from the frozen Farside HTML URLs.
- PR #55 — merged H8 stop.
- PR #56 — merged Term & Leverage freshness repair. Not an ETF change.
- PR #57 — closed, unmerged. Run `35779748776`, artifact `10717398959`. Its diagnostic parser detected `(US$m)` from the archived Farside title and `h1`, set `unitMultiplier` to `1e6`, converted displayed millions to USD, and compared those USD values with SoSoValue USD values.
- PR #58 — closed, unmerged. Run `35899536329`, artifact `10768722673`.

Base for this document: `bb28999387435eb7a5cccc6330d71d9d21200963`.

## 3. Current production architecture

**DECIDED.** `computeEtfFlows` in `scripts/etl/factors.mjs` is the live ETF factor.

It reads `public/data/cache/etf/YYYY-MM-DD.html` for the UTC calendar date. If that file is absent, it fetches four Farside HTML URLs and may write the cache file. Per-URL fetch errors are discarded. Total failure returns `farside_unavailable`.

`parseEtfFlowsFromHtml` finds a table, reads a `Total` column when present, and maps fund columns with `header.includes(etf)` over `ibit`, `fbtc`, `bitb`, `arkb`, `btco`, `ezbc`, `brrr`, `hodl`, `btcw`, `gbtc`, `btc`. That list does not include `MSBT`. Substring matching is the known R02 collision: a search for `btc` can bind the `FBTC` header.

Scale is chosen only from the joined header text (`$bn`, `$m`, or `(us$m)`). The preserved page puts `(US$m)` in the title and `h1`, not in those header cells. The production parser can therefore leave values in displayed millions. Returned metrics are still named `day_flow_usd` and `sum21_usd`.

Scoring, which this document does not change:

- A 21-business-day rolling sum, then `riskFromPercentile` against `rollingSums` from the historical file when that file loads.
- Acceleration is the latest 7 daily flows minus the prior 7. Its percentile is taken from that same parsed series, not from the historical file.
- Diversification is an HHI of the latest individual absolute flows. Equal scaling cancels in the shares.
- The executing blend is `config.subweights.etf_flows`: `sum_21d` 0.30, `acceleration` 0.30, and `diversification` 0.40, loaded through `getDashboardConfig()` and checked by `requireSubWeights()`. A comment above the 21-day score still says 40 percent. The config values are what execute.
- `lastUpdated` is `${latestFlow.date}T16:00:00.000Z`.
- A separate rule inside `computeEtfFlows` nulls the score when the latest published date is more than 5 calendar days old.

`marketCalendar.mjs` treats an observation as unpublished before 16:00 UTC on a U.S. trading day. Daily ETL is scheduled at 11:00 UTC, which is still morning in America/New_York, so the scheduled run already selects the previous completed U.S. session. A manual run after 16:00 UTC can select the same calendar day. That clock is a Farside-era assumption.

`stalenessUtils.mjs` evaluates `etf_flows` through `isEtfFlowsFreshForSourceCadence`. That function parses `lastUpdated` as a date and compares it with `getExpectedLatestUsTradingDay`. The 5-day TTL remains a fallback description, not the cadence check itself.

## 4. SoSoValue qualification findings

**DECIDED** as evidence from PR #57 and PR #58. This is not a production authorization.

- GitHub Actions authenticated with `SOSOVALUE_API_KEY`.
- Both runs observed this BTC/US universe, in this order: IBIT, FBTC, ARKB, BTCO, BTCW, BRRR, BITB, EZBC, HODL, GBTC, BTC, MSBT.
- FBTC and BTC were separate exact ticker strings.
- PR #57 compared unit-aligned USD series. It did not compare raw Farside displayed millions with SoSoValue dollars. On completed overlapping dates the series aligned closely. Residual differences remain and may reflect rounding, timing, revisions, or provider methodology.
- PR #58 summary history: 21 distinct dates, 2026-08-24 through 2026-09-22, 0 null totals, descending.
- Each of the 12 ticker histories in that artifact: 21 rows, the same date span, 0 null `net_inflow`.
- By `2026-09-23T18:01:07.605Z`, 2026-09-22 was present in the summary and in all 12 ticker histories. That is presence and completeness by query time. It does not prove the publication clock time.
- 2026-09-23 was absent from the summary and from every ticker history at that query.
- On that snapshot, the sum of the 12 Sep 22 ticker flows equaled the summary total (`714748985.505`). One exact match is not a permanent provider guarantee.
- The partial revision window versus PR #57 had 11 aggregate dates and 120 ticker/date cells, all unchanged. Snapshot #1 did not retain every raw row. This is initial stability evidence, not proof that SoSoValue never revises history.
- Operational, authentication, demonstrated 21-day history, and exact ticker semantics passed on that evidence. Initial revision stability passed inside the partial window. A production switch is not authorized by those passes alone.
- PR #54 showed the frozen Farside HTML URLs returning Cloudflare HTTP 403 from GitHub-hosted runners. That motivates a machine-readable replacement.

## 5. Source-provider adjudication

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** SoSoValue is the future primary machine-readable ETF source. It is not the current production source.

**REJECTED** for the current plan:

- Farside HTML as an automatic live acquisition fallback.
- CoinGlass, Bitbo, or any other undeclared provider as an automatic fallback.
- Scraping SoSoValue webpages.
- Treating the PR #57 or PR #58 diagnostic branches as production code. They were closed unmerged.

Qualified endpoint family:

- `GET /etfs?symbol=BTC&country_code=US`
- `GET /etfs/summary-history?symbol=BTC&country_code=US&limit=300`
- `GET /etfs/{ticker}/history?limit=300`

Authentication header: `x-soso-api-key`. Secret name: `SOSOVALUE_API_KEY`. The key must not be stored in repository files.

**DECIDED** as evidence: the demonstrated SoSoValue history window is about one month. A longer official history, if one appears later, is not required before implementation. The approved response is the durable GhostGauge history layer in section 11. That layer does not exist yet.

## 6. Unit contract adjudication

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** The canonical internal ETF monetary unit is USD.

Evidence, **DECIDED**:

- `etf-flows-historical.json` stores Farside displayed values. `2024-01-11` is `655.3`, not `655300000`. Rolling sums in that file use the same displayed-million units.
- SoSoValue `total_net_inflow` and `net_inflow` in the PR #58 artifact are dollar amounts. The Sep 22 summary total was about $714.7 million.
- Mixing those scales is about a 1,000,000x error.
- The live production parser's header-only unit test does not see `(US$m)` when that text sits outside the header cells.
- PR #57's diagnostic parser did see `(US$m)` in the archived title and `h1`, applied `unitMultiplier = 1e6`, and compared the converted Farside values with SoSoValue in USD.

**REJECTED:** a production adapter that adds SoSoValue USD values to the current historical millions without an explicit conversion.

Scale reasoning, **DECIDED** as mathematics, not yet applied:

- `percentileRank` and the z-score are unchanged if every compared flow and rolling sum is multiplied by the same positive constant.
- HHI divides absolute flows by their sum, so a uniform scale cancels.
- The acceleration percentile is computed inside one parsed series. Scaling every daily flow in that series by `1e6` does not change that percentile.
- Converting both the live SoSoValue observations and the frozen baseline from displayed millions to USD at the boundary therefore preserves rank-based ETF scores.
- Displayed dollar text, and any consumer that assumed the old magnitude, would change. That is a provenance and presentation correction, not a scoring-formula change.
- This adjudication does not perform the conversion.

## 7. Historical calibration-baseline adjudication

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** `public/data/etf-flows-historical.json` remains a frozen Farside calibration baseline. It is not the live source. It is the least-methodology-changing calibration path available.

The demonstrated SoSoValue API history is about one month. Replacing the 294-record baseline with those observations, or percentile-ranking only inside the current 21-day window, would change the methodology. Both are **REJECTED**.

PR #57 provides direct recent unit-aligned overlap evidence. That evidence supports economic comparability between Farside and SoSoValue on completed overlapping dates. The overlap showed strong alignment. Residual differences may reflect rounding, timing, revisions, or provider methodology.

That evidence does **not** prove:

- exact provider equivalence
- identical methodology
- comparability for every date in the frozen 2024–2025 calibration baseline
- absence of revisions

Full historical-period equivalence is unproven. Whether Farside revised any frozen-baseline date after `fetchedAt` `2025-09-17T11:24:18.385Z` is part of that unproven period. This adjudication does not rebuild the file and does not set a numeric equivalence threshold.

Required boundary conditions before any later implementation uses the frozen file together with SoSoValue live data:

- Provenance states that the baseline is Farside, frozen, and stored in displayed millions.
- Conversion to USD happens at the scoring boundary by multiplying displayed millions by `1e6`, unless a later PR explicitly versions a converted dataset.
- Live rows are labeled SoSoValue.
- Lineage records both providers. Mixed-source lineage must be explicit.
- Farside is not described as the current live provider.

ETF-S7, the guarded read-only production preview, remains a mandatory pre-activation guard. If that preview shows material scoring pathology caused by the cross-source calibration boundary, activation stops for re-adjudication.

## 8. Ticker identity and universe contract

**DECIDED.** Use exact normalized ticker strings. Do not use substring matching. FBTC is not BTC. The R02 fixture remains the semantic statement. This document does not repair `parseEtfFlowsFromHtml`.

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** The first corrected SoSoValue source contract uses this scored universe:

1. IBIT
2. FBTC
3. ARKB
4. BTCO
5. BTCW
6. BRRR
7. BITB
8. EZBC
9. HODL
10. GBTC
11. BTC
12. MSBT

MSBT is included. It is a legitimate U.S.-listed Bitcoin trust, not an alias or a malformed ticker. SoSoValue returned this exact 12-name BTC/US universe in both qualifications. The legacy Farside parser omits MSBT because that parser uses an older hard-coded 11-name list. Keeping that obsolete set would knowingly drop a current provider constituent. Including MSBT changes the HHI relative to today's production parser. That change is explicit, and it is part of the scientifically material source-contract version. It is not a silent parser fix.

The `/etfs` payload is the observed provider universe. GhostGauge also keeps the approved scored universe above. Observed membership and scored membership are separate fingerprints. They may differ later. They match for this first contract.

A later add or remove relative to the approved scored set is detected and recorded. It must not silently change diversification. ETF scoring fails closed, or enters an explicit review state, until a versioned source-contract update approves the new set.

## 9. Daily completeness contract

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** With the 12-name scored universe, an eligible trading date requires all of:

1. A finite SoSoValue summary total.
2. A row for every one of the 12 approved tickers.
3. A finite `net_inflow` on each of those 12 rows.
4. Exact ticker identities, including FBTC distinct from BTC.
5. The America/New_York T+1 rule in section 10.
6. Provider-universe and scored-universe checks.

**DECIDED.** A numeric zero is an observation. Missing, null, and error are not zero.

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** Compute `sum(12 ticker flows) - provider summary total` and retain that difference as an integrity diagnostic.

**REJECTED** as a hard provider contract, and **UNRESOLVED** as a provider guarantee: exact equality of that sum and the summary total. PR #58 observed exact equality for 2026-09-22 across all 12 returned tickers. That one observation does not establish that SoSoValue will always define the summary as that sum. Exact equality is not required before implementation.

## 10. Finality

**REJECTED.** Carrying `ETF_FLOW_PUBLISH_HOUR_UTC = 16` forward as a SoSoValue publication time. The diagnostics do not establish that clock.

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** The eligible source observation is the most recent completed U.S. trading session strictly before the current America/New_York market date. The rule uses the U.S./NYSE market calendar in `America/New_York`. It does not use the UTC calendar date as the market date.

- A Tuesday ETL run, while the America/New_York date is Tuesday, scores Monday.
- A Monday ETL run scores Friday, unless a market holiday makes the previous completed session an earlier date.
- A weekend or holiday run scores the most recent completed U.S. trading session.
- A provider row for the current America/New_York market date may be stored. It is not scored.

The exact SoSoValue publication time is unnecessary for this contract. It remains **UNRESOLVED** and is not required before implementation.

Scheduled Daily ETL at 11:00 UTC is morning in America/New_York (07:00 EDT, 06:00 EST). On a Tuesday that run's market date is Tuesday, so the eligible session is Monday. That matches today's pre-16:00 UTC scheduled behavior.

The approved rule is stricter than today's 16:00 UTC rule in two ways. After 16:00 UTC on a trading day, today's code can accept that calendar date; this rule still waits until the America/New_York date advances. After midnight UTC and before midnight in America/New_York, the UTC date has already moved forward while the NY market date has not. Using the UTC date would treat the still-current NY session as eligible. This rule does not. No timezone or calendar code is implemented here.

## 11. Durable history schema

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** GhostGauge maintains normalized SoSoValue source history keyed by trading date. This schema is not implemented here.

Keep these layers separate:

1. Provider observation data.
2. Fetch metadata.
3. Revision audit.
4. Scoring output.

Fields for a later contract:

- `source_contract_version`
- `provider` (`sosovalue` for live rows)
- `asset` (`BTC`)
- `country` (`US`)
- `trading_date`
- `summary_total_usd`
- `ticker_flows_usd` for the approved scored set
- `provider_universe`
- `provider_universe_fingerprint`
- `scored_universe`
- `scored_universe_fingerprint`
- `fetched_at_utc`
- `first_seen_at_utc`
- `last_seen_at_utc`
- `complete`
- `revision_number`
- `revision_detected_at_utc`
- prior-value provenance when a revision is detected

There is no single `ticker_universe` field. Separate provider and scored fingerprints let GhostGauge record a provider membership change without silently changing HHI inputs. For this first contract the scored universe is the 12 names in section 8. Tickers present in the provider universe and absent from the scored universe are recorded and kept outside the HHI input.

The PR #58 diagnostic artifact is evidence. It is not this durable store.

## 12. Revision policy

**DECIDED.** No revisions in the partial PR #57 versus PR #58 window is not a promise that history is immutable.

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.**

- On each fetch, compare overlapping dates with durable canonical history.
- Append an audit record for every changed date or ticker cell. That audit is immutable.
- The materialized current history may replace the value for a date only when the newest successful complete SoSoValue observation for that date becomes current. The displaced value stays in the audit.
- Do not rewrite accepted H8 observations or any other frozen prospective capture.
- If a revision falls inside the active 21-business-day scoring window, expose it in provenance, update the materialized current source history under the rule above, and let the next scheduled ETL recompute from that current history.
- Do not automatically launch an immediate extra scoring run solely because a revision was detected. A separately authorized manual rerun is outside this default contract.

## 13. Cache and outage policy

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.**

- Conservative sequential pacing. Honor `Retry-After`. Allow one bounded retry. Do not loop aggressively.
- Partial ticker coverage is an incomplete day.
- If required coverage cannot be obtained, ETF scoring fails closed.
- If the live fetch fails, durable SoSoValue history may be used only when it already contains a complete row for the expected eligible trading date.
- If durable history is behind that date, ETF Flows is excluded. The reason names the SoSoValue source. It does not say `farside_unavailable`.

**REJECTED:**

- Treating a stale Farside HTML file as a fresh SoSoValue observation.
- Live Farside scraping as an automatic fallback.
- Automatic CoinGlass failover.
- Writing zeros for missing cells.
- Using fetch time as the source observation time.

The provider's numeric plan limit is not part of the scientific contract. It can change independently of model semantics. PR #58 saw one HTTP 429 on BITB, then success after a 20-second `Retry-After`. That observation supports Retry-After handling. It does not freeze a rate number.

## 14. Freshness and staleness contract

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.**

- Expected eligible date: section 10. The market date is the America/New_York date, using the U.S. trading calendar. 16:00 UTC is not a SoSoValue publication time.
- Actual date: the latest trading date in durable SoSoValue history that meets section 9.
- Fresh when actual equals expected.
- Stale or excluded when actual is earlier than expected, or when the expected date is incomplete.
- File modification time, the cache filename date, and fetch timestamp do not make a row fresh.
- Do not synthesize `T16:00:00.000Z`.

`stalenessUtils.mjs` should eventually call that comparison for `etf_flows`. The 5-day wall-clock nulling inside `computeEtfFlows` should not remain a second, conflicting rule. Removing it belongs to ETF-S4. It is not a change to the 21-day scoring window.

## 15. Provenance contract

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.** Future ETF factor output distinguishes:

- provider
- `source_contract_version`
- source trading date
- `fetched_at_utc`
- acquisition state: live, or durable-history fallback
- `provider_universe_fingerprint`
- `scored_universe_fingerprint`
- revision state when a revision exists
- historical calibration provider (`farside_frozen_baseline`) and the `×1e6` boundary conversion

**REJECTED:** collapsing those fields into one `lastUpdated` timestamp.

## 16. Farside future role

**APPROVED FOR FUTURE IMPLEMENTATION CONTRACT.**

Farside remains historical evidence, the frozen calibration-baseline provenance, and an optional manual validation source.

Farside does not remain an automatic live machine fallback.

The R02 exact-identity fixture stays in force for any future Farside reading. It is not a SoSoValue parser.

## 17. Versioning requirements

**DECIDED.** Changing the live ETF provider, adopting the 12-name scored universe including MSBT, and correcting unit, provenance, and finality handling are scientifically material. Activation requires:

- a source-contract version
- an implementation revision
- lineage disclosure that live acquisition is SoSoValue, the scored universe is the approved 12 names, and the percentile baseline is frozen Farside converted from displayed millions by `×1e6`

**UNRESOLVED.** The exact future model version identifier. This review did not find a rule that assigns the next number. This PR does not choose one. That identifier is not required before implementation work begins. It is required before model activation.

## 18. H8 boundary

**DECIDED.**

- H8 v2 stays stopped and historical-only.
- Do not reconstruct 2026-09-09 through 2026-09-21.
- Do not reopen H8, insert SoSoValue into H8, or recalculate accepted observations.
- Do not tune ETF handling from H8 outcomes.
- A successor prospective study can use the corrected ETF architecture only after that architecture is separately frozen and preregistered.

## 19. Proposed implementation slices

Design only. Merging this document does not authorize any slice, and it does not activate the model.

| Slice | Concern |
|---|---|
| ETF-S1 | Source contract and deterministic fixtures: exact tickers, the approved 12-name scored universe including MSBT, USD units, completeness, and America/New_York T+1 finality. No live compute change. |
| ETF-S2 | SoSoValue normalized acquisition and durable source-history adapter, including separate provider and scored fingerprints and the revision audit. No score change. |
| ETF-S3 | Enforce the approved 12-name scored universe. Fail closed on a later provider add or remove until a new source contract approves it. |
| ETF-S4 | Replace the Farside publication-hour freshness rule with the America/New_York T+1 complete-date rule. |
| ETF-S5 | Convert the frozen Farside baseline to USD at the boundary, with provenance. Do not replace the baseline with 21 SoSoValue days. |
| ETF-S6 | Point `computeEtfFlows` at the adapter. Preserve subweights, the 21-day sum, 7-versus-prior-7 acceleration, HHI, and `riskFromPercentile`. The HHI inputs become the approved 12 tickers. |
| ETF-S7 | Mandatory guarded read-only preview before activation. If it shows material scoring pathology from the cross-source calibration boundary, activation stops for re-adjudication. |
| ETF-S8 | Production activation, plus disclosure and the version update. Blocked until ETF-S7 passes review. |

ETF-S1 blocks ETF-S3 and ETF-S6. ETF-S2 blocks ETF-S4 and ETF-S6. ETF-S5 must land before ETF-S6 scores against the historical file. ETF-S7 blocks ETF-S8.

## 20. Explicit unresolved questions

These items are intentionally not required before implementation:

- The exact SoSoValue publication time, if one exists. The T+1 America/New_York rule does not depend on it.
- Whether the provider summary total is contractually equal to the sum of the 12 ticker flows. The difference stays an integrity diagnostic.
- The exact future model version identifier. It is required before activation, not before the implementation slices begin.

Full historical-period equivalence between the frozen Farside baseline and SoSoValue is unproven. It is not left open as a blocker. The approved path is the frozen baseline with an explicit mixed-source lineage, and ETF-S7 stops activation if that boundary causes material scoring pathology.

## 21. What this adjudication does not authorize

- Implementing an adapter, or changing `scripts/etl/**`, `config/**`, `lib/**`, `public/**`, workflows, or H8 artifacts.
- Changing the ETF factor weight, the subweights (`0.30` / `0.30` / `0.40`), the 21-business-day window, the 7-day versus prior-7-day acceleration definition, the HHI formula, `riskFromPercentile`, or composite weighting. The future HHI input set is the approved 12 tickers; the formula itself is unchanged.
- G-Score tuning or outcome optimization.
- Declaring SoSoValue the current production source.
- Activating the model or switching production acquisition.
- Declaring SoSoValue exactly equivalent to Farside, or declaring full 2024–2025 equivalence.
- Reopening H8, or repairing R01, R02, or R03 production behavior.
- Using CoinGlass or live Farside HTML as a silent fallback.
- An automatic extra ETL run when a revision is detected.

## 22. Where later implementation must replace Farside-specific behavior

These files are not edited here. Later slices have to touch them.

`scripts/etl/factors.mjs`

- Direct Farside HTML acquisition and the date-named raw HTML cache.
- `parseEtfFlowsFromHtml` and substring ticker matching.
- Header-only source-unit detection.
- The hard-coded 11-name column list that omits MSBT.
- Loading `public/data/etf-flows-historical.json` as if it were same-scale live data.
- Synthetic `T16:00:00.000Z` `lastUpdated`.
- The `farside_unavailable` failure reason.
- The separate 5-day calendar nulling of the score.
- The subweight read stays `requireSubWeights(await getDashboardConfig(), 'etf_flows')`. Later slices do not bypass `config/dashboard-config.json`.

`scripts/etl/marketCalendar.mjs`

- `ETF_FLOW_PUBLISH_HOUR_UTC = 16`.
- `getExpectedLatestUsTradingDay`.
- `selectPublishedEtfFlowRows`.
- `isEtfFlowsFreshForSourceCadence`.
- The future eligible date must be derived from the America/New_York market date, not from the UTC calendar date alone.

`scripts/etl/stalenessUtils.mjs`

- The `etf_flows` freshness branch, which currently depends on the synthetic timestamp and the 16:00 rule.

`public/data/etf-flows-historical.json`

- Farside provenance, displayed-million units, `fetchedAt` `2025-09-17T11:24:18.385Z`, and the `2024-01-11` through `2025-09-16` range.
